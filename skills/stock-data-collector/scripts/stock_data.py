#!/usr/bin/env python3
"""Stock data collector CLI: store daily OHLCV candles and market sentiment in local SQLite.

Every table keys on the same normalized ticker so collected data can be joined.

Standard library only; runs on the system Python 3.9+ shipped with macOS and Linux.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import sqlite3
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

SKILL_ROOT = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.environ.get("OHLCV_DB_PATH") or SKILL_ROOT / "data" / "stock_data.sqlite3").resolve()
SCHEMA_DIR = SKILL_ROOT / "schema"
NEWS_SOURCES_PATH = SKILL_ROOT / "references" / "news-sources.json"
DEFAULT_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart"
CHART_URL = os.environ.get("OHLCV_CHART_URL", DEFAULT_CHART_URL).rstrip("/")
SOURCE_LABEL = os.environ.get("OHLCV_SOURCE_LABEL", "Yahoo Finance chart API")
CHART_FILE = os.environ.get("OHLCV_CHART_FILE")
MAX_SAFE_INTEGER = 2 ** 53 - 1
# Score bands for each sentiment level: 0 is most negative, 100 most positive.
SENTIMENT_LEVELS = {"negative": range(0, 40), "neutral": range(40, 61), "positive": range(61, 101)}
CLI = "python3 scripts/stock_data.py"

OhlcvRow = Dict[str, Any]


class CliError(Exception):
    pass


def normalize_ticker(value: Optional[str]) -> str:
    ticker = (value or "").strip().upper()
    if not re.fullmatch(r"[A-Z0-9.^_-]{1,20}", ticker):
        raise CliError("Ticker must contain 1-20 letters, numbers, '.', '^', '_' or '-'.")
    return ticker


def validate_date(value: Optional[str], name: str) -> str:
    if not value or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise CliError(f"{name} must use YYYY-MM-DD.")
    try:
        date.fromisoformat(value)
    except ValueError:
        raise CliError(f"{name} is not a real calendar date.") from None
    return value


def requested_range(args: argparse.Namespace) -> Tuple[str, str]:
    if args.date and (args.from_ or args.to):
        raise CliError("Use --date or --from/--to, not both.")
    start = validate_date(args.date or args.from_, "--date" if args.date else "--from")
    end = validate_date(args.date or args.to, "--date" if args.date else "--to")
    if start > end:
        raise CliError("--to cannot be earlier than --from.")
    return start, end


def finite(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def at(values: Optional[List[Any]], index: int) -> Any:
    return values[index] if values and index < len(values) else None


def parse_chart_response(payload: Any, ticker: str, start: str, end: str, source: str = SOURCE_LABEL) -> List[OhlcvRow]:
    chart = payload.get("chart") if isinstance(payload, dict) else None
    if not chart:
        raise CliError("Chart response did not contain chart data.")
    if chart.get("error"):
        raise CliError(chart["error"].get("description") or "Chart source returned an error.")
    result = (chart.get("result") or [None])[0]
    indicators = (result or {}).get("indicators") or {}
    quote = (indicators.get("quote") or [None])[0]
    if not result or not quote or not isinstance(result.get("timestamp"), list):
        raise CliError("Chart response did not contain daily quote data.")
    adjusted = ((indicators.get("adjclose") or [{}])[0] or {}).get("adjclose") or []
    rows = []
    for index, timestamp in enumerate(result["timestamp"]):
        trading_date = datetime.fromtimestamp(timestamp, timezone.utc).date().isoformat()
        if not start <= trading_date <= end:
            continue
        open_, high, low, close, volume = (at(quote.get(key), index) for key in ("open", "high", "low", "close", "volume"))
        if not all(finite(v) for v in (open_, high, low, close, volume)) or volume != int(volume) or abs(volume) > MAX_SAFE_INTEGER:
            continue
        adj_close = at(adjusted, index)
        rows.append({
            "ticker": ticker, "trading_date": trading_date, "open": open_, "high": high, "low": low, "close": close,
            "adj_close": adj_close if finite(adj_close) else None, "volume": int(volume), "source": source,
        })
    return rows


def open_store() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, isolation_level=None)
    connection.row_factory = sqlite3.Row
    for schema in sorted(SCHEMA_DIR.glob("*.sql")):
        connection.executescript(schema.read_text(encoding="utf-8"))
    return connection


def upsert_rows(connection: sqlite3.Connection, rows: List[OhlcvRow]) -> None:
    connection.execute("BEGIN")
    try:
        connection.executemany(
            """INSERT INTO ohlcv_daily (ticker, trading_date, open, high, low, close, adj_close, volume, source)
            VALUES (:ticker, :trading_date, :open, :high, :low, :close, :adj_close, :volume, :source)
            ON CONFLICT (ticker, trading_date) DO UPDATE SET
              open = excluded.open,
              high = excluded.high,
              low = excluded.low,
              close = excluded.close,
              adj_close = excluded.adj_close,
              volume = excluded.volume,
              source = excluded.source,
              fetched_at = CURRENT_TIMESTAMP""",
            rows,
        )
        connection.execute("COMMIT")
    except Exception:
        connection.execute("ROLLBACK")
        raise


def epoch(value: str) -> int:
    return int(datetime.fromisoformat(value).replace(tzinfo=timezone.utc).timestamp())


def fetch_rows(ticker: str, start: str, end: str) -> List[OhlcvRow]:
    if CHART_FILE:
        try:
            payload = json.loads(Path(CHART_FILE).read_text(encoding="utf-8"))
        except (OSError, ValueError):
            raise CliError("OHLCV fixture file returned invalid JSON or could not be read.") from None
    else:
        period2 = epoch((date.fromisoformat(end) + timedelta(days=1)).isoformat())
        query = urllib.parse.urlencode({"period1": epoch(start), "period2": period2, "interval": "1d", "events": "history", "includeAdjustedClose": "true"})
        url = f"{CHART_URL}/{urllib.parse.quote(ticker, safe='')}?{query}"
        request = urllib.request.Request(url, headers={"user-agent": "stock-data-collector/1.0"})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                body = response.read()
        except urllib.error.HTTPError as error:
            raise CliError(f"OHLCV source returned HTTP {error.code}.") from None
        except (urllib.error.URLError, OSError) as error:
            raise CliError(f"Could not reach OHLCV source: {getattr(error, 'reason', error)}") from None
        try:
            payload = json.loads(body)
        except ValueError:
            raise CliError("OHLCV source returned invalid JSON.") from None
    rows = parse_chart_response(payload, ticker, start, end, SOURCE_LABEL)
    if not rows:
        raise CliError(f"No complete daily OHLCV row was returned for {ticker} between {start} and {end}.")
    return rows


def show_rows(connection: sqlite3.Connection, args: argparse.Namespace) -> None:
    ticker = normalize_ticker(args.ticker)
    start, end = requested_range(args) if args.date or args.from_ or args.to else ("0000-01-01", "9999-12-31")
    rows = connection.execute(
        """SELECT ticker, trading_date, open, high, low, close, adj_close, volume, source, fetched_at
        FROM ohlcv_daily
        WHERE ticker = ? AND trading_date BETWEEN ? AND ?
        ORDER BY trading_date""",
        (ticker, start, end),
    ).fetchall()
    print(json.dumps([dict(row) for row in rows], indent=2))


def read_analysis(args: argparse.Namespace) -> str:
    if args.analysis and args.analysis_file:
        raise CliError("Use --analysis or --analysis-file, not both.")
    if args.analysis_file == "-":
        text = sys.stdin.read()
    elif args.analysis_file:
        try:
            text = Path(args.analysis_file).read_text(encoding="utf-8")
        except OSError:
            raise CliError(f"Could not read analysis file {args.analysis_file}.") from None
    else:
        text = args.analysis or ""
    if not text.strip():
        raise CliError("Provide the full sentiment analysis with --analysis or --analysis-file.")
    return text.strip()


def news_sources(urls: Optional[List[str]]) -> List[Dict[str, str]]:
    """Resolve each URL to an allowlisted publisher; sentiment must come from established outlets."""
    if not urls:
        raise CliError("Provide at least one --source URL from an established news outlet.")
    try:
        allowed = json.loads(NEWS_SOURCES_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        raise CliError(f"Could not read the news source allowlist at {NEWS_SOURCES_PATH}.") from None
    sources = []
    for url in urls:
        parsed = urllib.parse.urlparse(url.strip())
        host = (parsed.hostname or "").lower()
        domain = next((d for d in allowed if host == d or host.endswith(f".{d}")), None)
        if parsed.scheme not in ("http", "https") or domain is None:
            raise CliError(f"{url} is not from an allowlisted news outlet. Use an established outlet listed in {NEWS_SOURCES_PATH.relative_to(SKILL_ROOT)}.")
        sources.append({"publisher": allowed[domain], "url": url.strip()})
    return sources


def add_sentiment(connection: sqlite3.Connection, args: argparse.Namespace) -> None:
    ticker = normalize_ticker(args.ticker)
    sentiment_date = validate_date(args.date, "--date") if args.date else datetime.now(timezone.utc).date().isoformat()
    level = (args.level or "").strip().lower()
    if level not in SENTIMENT_LEVELS:
        raise CliError(f"--level must be one of: {', '.join(SENTIMENT_LEVELS)}.")
    if args.score is None or not 0 <= args.score <= 100:
        raise CliError("--score must be a whole number from 0 (most negative) to 100 (most positive).")
    band = SENTIMENT_LEVELS[level]
    if args.score not in band:
        raise CliError(f"--score {args.score} does not match level '{level}' ({band.start}-{band.stop - 1}).")
    analysis = read_analysis(args)
    sources = news_sources(args.source)
    connection.execute(
        """INSERT INTO market_sentiment (ticker, sentiment_date, level, score, analysis, sources)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (ticker, sentiment_date) DO UPDATE SET
          level = excluded.level,
          score = excluded.score,
          analysis = excluded.analysis,
          sources = excluded.sources,
          created_at = CURRENT_TIMESTAMP""",
        (ticker, sentiment_date, level, args.score, analysis, json.dumps(sources, ensure_ascii=False)),
    )
    publishers = ", ".join(sorted({source["publisher"] for source in sources}))
    print(f"Stored {level} sentiment ({args.score}/100) for {ticker} on {sentiment_date} from {publishers}.")


def show_sentiment(connection: sqlite3.Connection, args: argparse.Namespace) -> None:
    ticker = normalize_ticker(args.ticker)
    start, end = requested_range(args) if args.date or args.from_ or args.to else ("0000-01-01", "9999-12-31")
    rows = connection.execute(
        """SELECT ticker, sentiment_date, level, score, analysis, sources, created_at
        FROM market_sentiment
        WHERE ticker = ? AND sentiment_date BETWEEN ? AND ?
        ORDER BY sentiment_date""",
        (ticker, start, end),
    ).fetchall()
    print(json.dumps([{**dict(row), "sources": json.loads(row["sources"])} for row in rows], indent=2, ensure_ascii=False))


def print_help() -> None:
    print(f"""Stock data collector CLI

Usage: {CLI} <command> [options]

Commands:
  init            Create the local SQLite database and tables.
  fetch           Fetch and upsert daily OHLCV rows from the chart source.
  show            Read locally stored OHLCV rows without making a network request.
  add-sentiment   Store a market sentiment analysis for a ticker and date.
  show-sentiment  Read stored sentiment analyses.
  help            Show this help.

Sentiment levels and scores (0 most negative, 100 most positive):
  negative 0-39, neutral 40-60, positive 61-100

Examples:
  {CLI} fetch --ticker AAPL --date 2026-01-02
  {CLI} fetch --ticker AAPL --from 2026-01-02 --to 2026-01-09
  {CLI} show --ticker AAPL --from 2026-01-02 --to 2026-01-09
  {CLI} add-sentiment --ticker AAPL --level positive --score 72 \\
      --analysis-file analysis.md --source https://www.reuters.com/technology/...
  {CLI} show-sentiment --ticker AAPL --from 2026-01-02 --to 2026-01-09

Database: {DB_PATH}""")


def parse_args(argv: List[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog=CLI, add_help=False)
    parser.add_argument("command", nargs="?", default="help")
    parser.add_argument("--ticker")
    parser.add_argument("--date")
    parser.add_argument("--from", dest="from_")
    parser.add_argument("--to")
    parser.add_argument("--level")
    parser.add_argument("--score", type=int)
    parser.add_argument("--analysis")
    parser.add_argument("--analysis-file")
    parser.add_argument("--source", action="append")
    parser.add_argument("-h", "--help", action="store_true")
    return parser.parse_args(argv)


def main(argv: List[str]) -> None:
    args = parse_args(argv)
    if args.help or args.command == "help":
        print_help()
        return
    if args.command not in ("init", "fetch", "show", "add-sentiment", "show-sentiment"):
        raise CliError(f"Usage: {CLI} [init|fetch|show|add-sentiment|show-sentiment|help]")
    connection = open_store()
    try:
        if args.command == "init":
            print(f"Database ready: {DB_PATH}")
        elif args.command == "show":
            show_rows(connection, args)
        elif args.command == "add-sentiment":
            add_sentiment(connection, args)
        elif args.command == "show-sentiment":
            show_sentiment(connection, args)
        else:
            ticker = normalize_ticker(args.ticker)
            start, end = requested_range(args)
            rows = fetch_rows(ticker, start, end)
            upsert_rows(connection, rows)
            print(f"Stored {len(rows)} OHLCV row{'' if len(rows) == 1 else 's'} for {ticker} ({start} to {end}).")
    finally:
        connection.close()


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except (CliError, OSError, sqlite3.Error) as error:
        print(f"Error: {error}", file=sys.stderr)
        sys.exit(1)
