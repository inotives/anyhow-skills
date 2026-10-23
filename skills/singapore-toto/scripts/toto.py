#!/usr/bin/env python3
"""Singapore Toto CLI: local draw history and heuristic number estimates.

Standard library only; runs on the system Python 3.9+ shipped with macOS and Linux.
"""
from __future__ import annotations

import argparse
import csv
import math
import os
import random
import re
import sqlite3
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, NamedTuple, Optional

SKILL_ROOT = Path(__file__).resolve().parent.parent
DB_PATH = SKILL_ROOT / "data" / "singapore_toto.sqlite3"
CSV_PATH = SKILL_ROOT / "data" / "ToTo.csv"
SCHEMA_PATH = SKILL_ROOT / "schema" / "001_initial.sql"
HISTORY_URL = os.environ.get("TOTO_HISTORY_URL", "https://en.lottolyzer.com/history/singapore/toto/page/1/per-page/50/summary-view")
ESTIMATION_DRAWS = 624  # approximately six years at two draws per week
HISTORY_PAGE_SIZE = 50
FULL_HISTORY_PAGES = math.ceil(ESTIMATION_DRAWS / HISTORY_PAGE_SIZE)
MAX_NUMBER = 49  # Singapore Toto draws 6 numbers from 1-49
NUMBERS = list(range(1, MAX_NUMBER + 1))
SGT = timezone(timedelta(hours=8))  # Singapore has no daylight saving
METHODS = ["frequency", "recency", "bayesian", "overdue", "hot-cold", "pairs", "balanced", "sum-range", "monte-carlo", "ensemble"]
CLI = "python3 scripts/toto.py"


class Draw(NamedTuple):
    draw: int
    draw_date: str
    numbers: List[int]
    additional_number: Optional[int]


class CliError(Exception):
    pass


def db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    database = sqlite3.connect(DB_PATH, isolation_level=None)
    database.row_factory = sqlite3.Row
    database.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    return database


def to_int(value: Optional[str]) -> Optional[int]:
    try:
        return int(value) if value else None
    except ValueError:
        return None


def upsert(database: sqlite3.Connection, rows: List[Draw]) -> int:
    database.execute("BEGIN")
    try:
        database.executemany(
            """INSERT INTO toto_results
            (draw, draw_date, winning_number_1, winning_number_2, winning_number_3, winning_number_4, winning_number_5, winning_number_6, additional_number)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(draw) DO UPDATE SET draw_date=excluded.draw_date, winning_number_1=excluded.winning_number_1,
            winning_number_2=excluded.winning_number_2, winning_number_3=excluded.winning_number_3, winning_number_4=excluded.winning_number_4,
            winning_number_5=excluded.winning_number_5, winning_number_6=excluded.winning_number_6, additional_number=excluded.additional_number,
            updated_at=CURRENT_TIMESTAMP""",
            [(row.draw, row.draw_date, *row.numbers, row.additional_number) for row in rows],
        )
        database.execute("COMMIT")
    except Exception:
        database.execute("ROLLBACK")
        raise
    return len(rows)


def import_csv(database: sqlite3.Connection, path: Path) -> int:
    with open(path, newline="", encoding="utf-8-sig") as handle:
        rows = [[cell.strip() for cell in row] for row in csv.reader(handle) if any(cell.strip() for cell in row)]
    draws = []
    for r in rows[1:]:
        draw = to_int(r[0] if r else None)
        numbers = [to_int(value) for value in r[2:8]]
        date = r[1] if len(r) > 1 else ""
        if draw is not None and re.fullmatch(r"\d{4}-\d{2}-\d{2}", date) and len(numbers) == 6 and all(n is not None and 1 <= n <= MAX_NUMBER for n in numbers):
            draws.append(Draw(draw, date, numbers, to_int(r[8] if len(r) > 8 else None)))
    return upsert(database, draws)


DRAW_PATTERN = re.compile(r"(\d{4})\s+(\d{4}-\d{2}-\d{2})\s+((?:[1-9]|[1-4]\d)(?:\s*,\s*(?:[1-9]|[1-4]\d)){5})\s+((?:[1-9]|[1-4]\d))")


def html_draws(html: str) -> List[Draw]:
    body = re.sub(r"<[^>]+>", " ", html).replace("&nbsp;", " ").replace("&amp;", "&")
    draws = []
    for match in DRAW_PATTERN.finditer(body):
        numbers = [int(n) for n in match.group(3).split(",")]
        if len(numbers) == 6:
            draws.append(Draw(int(match.group(1)), match.group(2), numbers, int(match.group(4))))
    return draws


def fetch_latest(database: sqlite3.Connection, pages: int = 1) -> int:
    draws: List[Draw] = []
    paged = re.search(r"/page/\d+/", HISTORY_URL) is not None
    for page in range(1, (pages if paged else 1) + 1):
        url = re.sub(r"/page/\d+/", f"/page/{page}/", HISTORY_URL, count=1)
        request = urllib.request.Request(url, headers={"user-agent": "singapore-toto-cli/1.0"})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                html = response.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as error:
            raise CliError(f"history site returned HTTP {error.code} for page {page}") from error
        except (urllib.error.URLError, OSError) as error:
            raise CliError(f"could not reach history site: {getattr(error, 'reason', error)}") from error
        page_draws = html_draws(html)
        if not page_draws:
            break
        draws.extend(page_draws)
    if not draws:
        raise CliError("history site returned no parseable Toto draws")
    return upsert(database, draws)


def local_latest(database: sqlite3.Connection) -> Optional[Draw]:
    row = database.execute("SELECT * FROM toto_results ORDER BY draw_date DESC LIMIT 1").fetchone()
    if row is None:
        return None
    return Draw(row["draw"], row["draw_date"], [row[f"winning_number_{i}"] for i in range(1, 7)], row["additional_number"])


def expected_latest_date(now: Optional[datetime] = None) -> str:
    """Most recent Monday or Thursday draw date whose 7pm SGT result should be out."""
    local = (now or datetime.now(timezone.utc)).astimezone(SGT)
    date = local.date()
    if local.hour < 19 or date.weekday() not in (0, 3):
        date -= timedelta(days=1)
    while date.weekday() not in (0, 3):
        date -= timedelta(days=1)
    return date.isoformat()


def ensure_latest(database: sqlite3.Connection) -> Optional[Draw]:
    latest = local_latest(database)
    if latest and latest.draw_date >= expected_latest_date():
        return latest
    fetch_latest(database)
    return local_latest(database)


def pad(n: int) -> str:
    return f"{n:02d}"


def print_draw(draw: Optional[Draw]) -> None:
    if draw is None:
        print("No Toto results found.")
        return
    additional = "—" if draw.additional_number is None else pad(draw.additional_number)
    print(f"Draw {draw.draw} ({draw.draw_date})\nWinning: {' '.join(pad(n) for n in draw.numbers)}\nAdditional: {additional}")


def print_help() -> None:
    print(f"""Singapore Toto CLI

Usage: {CLI} <command> [options]

Commands:
  init       Create the SQLite database and toto_results table.
  import     Import data/ToTo.csv into SQLite.
             Use --path /path/to/file.csv for a different CSV.
  latest     Show the latest local result; refresh if the expected draw is missing.
  check      Alias for latest.
  refresh    Crawl Lottolyzer and upsert the latest {HISTORY_PAGE_SIZE} draws.
             Use --pages N for N pages of {HISTORY_PAGE_SIZE} draws, or --full for
             the {FULL_HISTORY_PAGES} pages that cover the estimation window.
  predict    Estimate six numbers using one or more statistical methods.
  help       Show this help.

Prediction:
  {CLI} predict --estimator_method frequency
  {CLI} predict --estimator_method recency,overdue,ensemble

Methods:
  frequency    Most common numbers in approximately six years of draws.
  recency      Exponentially weights newer draws more heavily.
  bayesian     Uses smoothed frequency estimates.
  overdue      Favors numbers absent for more draws.
  hot-cold     Combines occurrence frequency and time since appearance.
  pairs        Scores numbers by historical co-occurrence.
  balanced     Applies range and odd/even balance constraints.
  sum-range    Prefers tickets near the average winning-number sum.
  monte-carlo  Samples 10,000 candidate tickets and ranks their history score.
  ensemble     Combines frequency, recency, overdue, and pair scores.

Database: {DB_PATH}
Estimation window: {ESTIMATION_DRAWS} draws (~6 years).
All predictions are heuristics and cannot improve random lottery odds.""")


def history(database: sqlite3.Connection) -> List[List[int]]:
    rows = database.execute(
        "SELECT winning_number_1, winning_number_2, winning_number_3, winning_number_4, winning_number_5, winning_number_6 "
        "FROM toto_results ORDER BY draw_date DESC LIMIT ?",
        (ESTIMATION_DRAWS,),
    ).fetchall()
    return [[n for n in row if 1 <= n <= MAX_NUMBER] for row in rows]


def frequencies(draws: List[List[int]]) -> List[float]:
    counts = [0.0] * (MAX_NUMBER + 1)
    for draw in draws:
        for n in draw:
            counts[n] += 1
    return counts


def ranked(scores: List[float]) -> List[int]:
    return sorted(NUMBERS, key=lambda n: (-scores[n], n))


def choose(scores: List[float], constraints: bool = False) -> List[int]:
    candidates = ranked(scores)
    if not constraints:
        return sorted(candidates[:6])
    pick: List[int] = []
    for n in candidates:
        decade = (n + 9) // 10
        if sum(1 for x in pick if (x + 9) // 10 == decade) >= 2:
            continue
        evens = sum(1 for x in pick if x % 2 == 0)
        if len(pick) >= 3 and ((evens == 3 and n % 2 == 0) or (len(pick) - evens == 3 and n % 2 != 0)):
            continue
        pick.append(n)
        if len(pick) == 6:
            break
    return sorted(pick)


def pair_scores(draws: List[List[int]]) -> List[float]:
    scores = [0.0] * (MAX_NUMBER + 1)
    for draw in draws:
        for a in draw:
            for b in draw:
                if a != b:
                    scores[a] += 1
    return scores


def last_seen(draws: List[List[int]], n: int) -> int:
    """1-based index of the newest draw containing n, or len(draws) + 1 if absent."""
    return next((i + 1 for i, draw in enumerate(draws) if n in draw), len(draws) + 1)


def estimate(draws: List[List[int]], method: str) -> List[int]:
    counts = frequencies(draws)
    scores = [0.0] * (MAX_NUMBER + 1)
    if method == "monte-carlo":
        best: List[int] = []
        best_score = -1.0
        for _ in range(10000):
            ticket = random.sample(NUMBERS, 6)
            score = sum(counts[n] for n in ticket)
            if score > best_score:
                best, best_score = ticket, score
        return sorted(best)
    if method in ("frequency", "balanced", "sum-range"):
        scores = counts
    elif method == "recency":
        for i, draw in enumerate(draws):
            for n in draw:
                scores[n] += 0.97 ** i
    elif method == "bayesian":
        scores = [(count + 1) / (len(draws) + 2) for count in counts]
    elif method == "overdue":
        scores = [0.0] + [last_seen(draws, n) for n in NUMBERS]
    elif method == "hot-cold":
        scores = [0.0] + [counts[n] * (1 + (len(draws) - last_seen(draws, n)) / len(draws)) if counts[n] else 0.0 for n in NUMBERS]
    elif method == "pairs":
        scores = pair_scores(draws)
    elif method == "ensemble":
        pairs = pair_scores(draws)
        recency = [0.0] * (MAX_NUMBER + 1)
        overdue = [float(len(draws) + 1)] * (MAX_NUMBER + 1)
        for i, draw in enumerate(draws):
            for n in draw:
                recency[n] += 0.97 ** i
                overdue[n] = min(overdue[n], i + 1)
        scores = [0.0] + [
            counts[n] / max(counts) * 0.35 + recency[n] / max(recency) * 0.25 + overdue[n] / max(overdue) * 0.15 + pairs[n] / max(pairs) * 0.25
            for n in NUMBERS
        ]
    if method == "balanced":
        return choose(scores, constraints=True)
    if method == "sum-range":
        target = math.floor(sum(sum(draw) for draw in draws) / len(draws) + 0.5)
        candidates = ranked(scores)
        pick: List[int] = []
        while len(pick) < 6:
            total = sum(pick)
            closer = next((n for n in candidates if n not in pick and abs(total + n - target) < abs(total - target)), None)
            pick.append(closer if closer is not None else next(n for n in candidates if n not in pick))
        return sorted(pick)
    return choose(scores)


def predict(database: sqlite3.Connection, method: str) -> None:
    draws = history(database)
    if not draws:
        raise CliError("No historical Toto draws found. Import data or run refresh first.")
    pick = estimate(draws, method)
    print(f"Estimated next numbers ({method}): {' '.join(pad(n) for n in pick)}")
    print(f"Based on {len(draws)} historical draws; this cannot improve random lottery odds.")


def parse_args(argv: List[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog=CLI, add_help=False)
    parser.add_argument("command", nargs="?", default="latest")
    parser.add_argument("--path", type=Path, default=CSV_PATH)
    parser.add_argument("--pages", type=int, default=1)
    parser.add_argument("--full", action="store_true")
    parser.add_argument("--estimator_method", default="frequency")
    parser.add_argument("-h", "--help", action="store_true")
    return parser.parse_args(argv)


def main(argv: List[str]) -> None:
    args = parse_args(argv)
    command = args.command
    if args.help or command == "help":
        print_help()
        return
    if command not in ("init", "import", "refresh", "predict", "latest", "check"):
        raise CliError(f"Usage: {CLI} [init|import|refresh|latest|check|predict]")
    if command != "init" and not DB_PATH.exists():
        try:
            answer = input(f"WARNING: database not found at {DB_PATH}. Initialize an empty database now? You must import CSV data or run refresh afterward. [y/N] ")
        except EOFError:
            answer = ""
        if not re.fullmatch(r"y(es)?", answer.strip(), re.IGNORECASE):
            print(f"Cancelled. Run `{CLI} init` when ready.")
            return
    database = db()
    if command == "init":
        print(f"Database ready: {DB_PATH}")
    elif command == "import":
        print(f"Imported {import_csv(database, args.path)} rows from {args.path}")
    elif command == "refresh":
        pages = FULL_HISTORY_PAGES if args.full else args.pages
        if pages < 1:
            raise CliError("--pages must be a positive whole number")
        print(f"Crawled and stored {fetch_latest(database, pages)} draws from Lottolyzer.")
        print("Latest result:")
        print_draw(local_latest(database))
    elif command == "predict":
        methods = [value.strip() for value in (args.estimator_method or "frequency").split(",") if value.strip()]
        invalid = [method for method in methods if method not in METHODS]
        if invalid:
            raise CliError(f"Unknown estimator_method: {', '.join(invalid)}. Choose: {', '.join(METHODS)}")
        for index, method in enumerate(methods):
            if index:
                print()
            predict(database, method)
    else:
        latest = local_latest(database)
        if latest is None or latest.draw_date < expected_latest_date():
            try:
                latest = ensure_latest(database)
            except CliError as error:
                if latest is None:
                    raise
                print(f"Could not refresh results: {error}", file=sys.stderr)
        print_draw(latest)


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except (CliError, OSError, sqlite3.Error) as error:
        print(f"Error: {error}", file=sys.stderr)
        sys.exit(1)
