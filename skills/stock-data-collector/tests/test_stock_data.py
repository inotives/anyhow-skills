import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent.parent
CLI = ROOT / "scripts" / "stock_data.py"
FIXTURE = ROOT / "tests" / "fixtures" / "chart.json"
REUTERS = ("--source", "https://www.reuters.com/markets/example")


class StockDataCliTest(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp(prefix="stock-data-test-"))
        self.addCleanup(shutil.rmtree, self.dir, ignore_errors=True)
        self.db = str(self.dir / "state.sqlite3")

    def run_cli(self, *args, stdin="", **env):
        return subprocess.run(
            [sys.executable, str(CLI), *args], cwd=tempfile.gettempdir(), input=stdin, capture_output=True, text=True,
            env={**os.environ, "OHLCV_DB_PATH": self.db, **env}, timeout=60,
        )

    def sentiments(self, *args):
        result = self.run_cli("show-sentiment", "--ticker", "AAPL", *args)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def show(self, *args):
        result = self.run_cli("show", "--ticker", "AAPL", *args)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_fetches_a_fixture_and_shows_the_stored_ohlcv_row(self):
        fetched = self.run_cli("fetch", "--ticker", "aapl", "--date", "2024-01-02", OHLCV_CHART_FILE=str(FIXTURE), OHLCV_SOURCE_LABEL="fixture")
        self.assertEqual(fetched.returncode, 0, fetched.stderr)
        self.assertIn("Stored 1 OHLCV row for AAPL", fetched.stdout)
        rows = self.show("--date", "2024-01-02")
        self.assertEqual(rows, [{
            "ticker": "AAPL", "trading_date": "2024-01-02", "open": 100, "high": 105, "low": 99, "close": 104,
            "adj_close": 104, "volume": 1000000, "source": "fixture", "fetched_at": rows[0]["fetched_at"],
        }])

    def test_rejects_malformed_dates_before_fetching(self):
        result = self.run_cli("fetch", "--ticker", "AAPL", "--date", "2024-02-30")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("not a real calendar date", result.stderr)

    def test_a_failed_fetch_leaves_existing_data_available(self):
        self.assertEqual(self.run_cli("fetch", "--ticker", "AAPL", "--date", "2024-01-02", OHLCV_CHART_FILE=str(FIXTURE)).returncode, 0)
        failed = self.run_cli("fetch", "--ticker", "AAPL", "--date", "2024-01-03", OHLCV_CHART_FILE=str(self.dir / "missing.json"))
        self.assertNotEqual(failed.returncode, 0)
        self.assertEqual(len(self.show()), 1)

    def test_fetches_a_range_from_the_chart_endpoint(self):
        requested = []

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                requested.append(self.path)
                self.send_response(200)
                self.end_headers()
                self.wfile.write(FIXTURE.read_bytes())

            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        url = f"http://127.0.0.1:{server.server_address[1]}/v8/finance/chart/"
        result = self.run_cli("fetch", "--ticker", "AAPL", "--from", "2024-01-02", "--to", "2024-01-03", OHLCV_CHART_URL=url)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Stored 2 OHLCV rows", result.stdout)
        request = urlparse(requested[0])
        self.assertEqual(request.path, "/v8/finance/chart/AAPL")
        query = parse_qs(request.query)
        # period2 is exclusive, so it is midnight UTC after --to.
        self.assertEqual((query["period1"], query["period2"], query["interval"]), (["1704153600"], ["1704326400"], ["1d"]))
        self.assertEqual([row["trading_date"] for row in self.show()], ["2024-01-02", "2024-01-03"])

    def test_stores_and_shows_a_sentiment_analysis(self):
        analysis = "Strong iPhone demand and services growth.\n\nRisk: China supply chain."
        stored = self.run_cli(
            "add-sentiment", "--ticker", "aapl", "--date", "2024-01-02", "--level", "Positive", "--score", "72",
            "--analysis-file", "-", "--source", "https://www.reuters.com/a", "--source", "https://www.wsj.com/b", stdin=analysis,
        )
        self.assertEqual(stored.returncode, 0, stored.stderr)
        self.assertIn("Stored positive sentiment (72/100) for AAPL on 2024-01-02 from Reuters, The Wall Street Journal.", stored.stdout)
        rows = self.sentiments("--date", "2024-01-02")
        self.assertEqual(rows, [{
            "ticker": "AAPL", "sentiment_date": "2024-01-02", "level": "positive", "score": 72, "analysis": analysis,
            "sources": [{"publisher": "Reuters", "url": "https://www.reuters.com/a"}, {"publisher": "The Wall Street Journal", "url": "https://www.wsj.com/b"}], "created_at": rows[0]["created_at"],
        }])

    def test_rejects_scores_outside_the_level_band(self):
        for level, score in (("negative", 40), ("neutral", 39), ("neutral", 61), ("positive", 60), ("positive", 101)):
            result = self.run_cli("add-sentiment", "--ticker", "AAPL", "--level", level, "--score", str(score), "--analysis", "text", *REUTERS)
            self.assertNotEqual(result.returncode, 0, f"{level} {score}")
        missing = self.run_cli("add-sentiment", "--ticker", "AAPL", "--level", "neutral", "--score", "50", *REUTERS)
        self.assertIn("full sentiment analysis", missing.stderr)
        self.assertEqual(self.sentiments(), [])

    def test_rejects_sources_outside_the_news_allowlist(self):
        base = ("add-sentiment", "--ticker", "AAPL", "--level", "neutral", "--score", "50", "--analysis", "text")
        for url in ("https://smallstocksblog.example/aapl", "https://reuters.com.evil.example/a", "ftp://www.reuters.com/a"):
            result = self.run_cli(*base, "--source", "https://www.reuters.com/ok", "--source", url)
            self.assertNotEqual(result.returncode, 0, url)
            self.assertIn("not from an allowlisted news outlet", result.stderr)
        self.assertIn("at least one --source", self.run_cli(*base).stderr)
        self.assertEqual(self.sentiments(), [])

    def test_a_second_sentiment_on_the_same_date_replaces_the_first(self):
        for level, score in (("negative", 10), ("neutral", 50)):
            result = self.run_cli("add-sentiment", "--ticker", "AAPL", "--date", "2024-01-02", "--level", level, "--score", str(score), "--analysis", level, *REUTERS)
            self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual([(row["level"], row["score"], row["analysis"]) for row in self.sentiments()], [("neutral", 50, "neutral")])

    def test_sentiment_joins_ohlcv_on_ticker_and_date(self):
        self.assertEqual(self.run_cli("fetch", "--ticker", "AAPL", "--date", "2024-01-02", OHLCV_CHART_FILE=str(FIXTURE)).returncode, 0)
        self.assertEqual(self.run_cli("add-sentiment", "--ticker", "aapl", "--date", "2024-01-02", "--level", "positive", "--score", "80", "--analysis", "up", *REUTERS).returncode, 0)
        with sqlite3.connect(self.db) as database:
            joined = database.execute(
                "SELECT o.ticker, o.trading_date, o.close, s.level, s.score FROM ohlcv_daily o "
                "JOIN market_sentiment s ON s.ticker = o.ticker AND s.sentiment_date = o.trading_date"
            ).fetchall()
        self.assertEqual(joined, [("AAPL", "2024-01-02", 104.0, "positive", 80)])


if __name__ == "__main__":
    unittest.main()
