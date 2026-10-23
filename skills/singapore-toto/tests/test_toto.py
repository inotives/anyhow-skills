import os
import re
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIXTURE = ROOT / "tests" / "fixtures" / "toto.csv"
METHODS = ["frequency", "recency", "bayesian", "overdue", "hot-cold", "pairs", "balanced", "sum-range", "monte-carlo", "ensemble"]


class TotoCliTest(unittest.TestCase):
    def setUp(self):
        # Run a copy of the skill so each test gets its own data/ folder.
        self.dir = Path(tempfile.mkdtemp(prefix="anyhow-toto-test-"))
        self.addCleanup(shutil.rmtree, self.dir, ignore_errors=True)
        (self.dir / "scripts").mkdir()
        (self.dir / "schema").mkdir()
        shutil.copy(ROOT / "scripts" / "toto.py", self.dir / "scripts" / "toto.py")
        shutil.copy(ROOT / "schema" / "001_initial.sql", self.dir / "schema" / "001_initial.sql")
        self.db = self.dir / "data" / "singapore_toto.sqlite3"

    def run_cli(self, *args, env=None, stdin=""):
        return subprocess.run(
            [sys.executable, str(self.dir / "scripts" / "toto.py"), *args],
            cwd=tempfile.gettempdir(), input=stdin, capture_output=True, text=True,
            env={**os.environ, **(env or {})}, timeout=60,
        )

    def rows(self):
        with sqlite3.connect(self.db) as database:
            return database.execute("SELECT draw, draw_date FROM toto_results ORDER BY draw").fetchall()

    def test_imports_valid_rows_and_rejects_malformed_or_out_of_range_rows(self):
        self.assertEqual(self.run_cli("init").returncode, 0)
        imported = self.run_cli("import", "--path", str(FIXTURE))
        self.assertEqual(imported.returncode, 0, imported.stderr)
        self.assertRegex(imported.stdout, r"Imported 2 rows")
        self.assertEqual(self.rows(), [(9001, "2020-01-02"), (9003, "2020-01-16")])

    def test_missing_database_prompt_cancels_without_creating_it(self):
        result = self.run_cli("latest", stdin="n\n")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Cancelled", result.stdout)
        self.assertFalse(self.db.exists())

    def test_predict_fails_clearly_when_local_history_is_empty(self):
        self.assertEqual(self.run_cli("init").returncode, 0)
        result = self.run_cli("predict")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("No historical Toto draws found", result.stderr)

    def test_every_estimator_picks_six_distinct_numbers_from_1_to_49(self):
        # Cover every number 1-49 so an out-of-range number would look most overdue.
        csv = self.dir / "full.csv"
        lines = [f"{5001 + i},2024-02-{i + 1:02d},{','.join(str((i * 6 + k) % 49 + 1) for k in range(6))},49" for i in range(9)]
        csv.write_text("\n".join(["Draw,Date,1,2,3,4,5,6,Additional", *lines]))
        self.assertEqual(self.run_cli("init").returncode, 0)
        self.assertEqual(self.run_cli("import", "--path", str(csv)).returncode, 0)
        result = self.run_cli("predict", "--estimator_method", ",".join(METHODS))
        self.assertEqual(result.returncode, 0, result.stderr)
        picks = re.findall(r"Estimated next numbers \(([\w-]+)\): ([\d ]+)", result.stdout)
        self.assertEqual([method for method, _ in picks], METHODS)
        for method, numbers in picks:
            values = [int(n) for n in numbers.split()]
            self.assertEqual(len(set(values)), 6, f"{method}: {numbers}")
            self.assertTrue(all(1 <= n <= 49 for n in values), f"{method}: {numbers}")

    def test_refresh_pages_crawls_each_history_page(self):
        requested = []

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                page = int(re.search(r"/page/(\d+)/", self.path).group(1))
                requested.append(page)
                body = f"<tr><td>{4000 + page}</td><td>2024-01-0{page}</td><td>1, 2, 3, 4, 5, {page + 10}</td><td>49</td></tr>" if page <= 2 else "<p>No results</p>"
                self.send_response(200)
                self.end_headers()
                self.wfile.write(body.encode())

            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        self.assertEqual(self.run_cli("init").returncode, 0)
        url = f"http://127.0.0.1:{server.server_address[1]}/history/page/1/per-page/50/summary-view"
        result = self.run_cli("refresh", "--pages", "3", env={"TOTO_HISTORY_URL": url})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertRegex(result.stdout, r"stored 2 draws")
        self.assertEqual(requested, [1, 2, 3])
        self.assertEqual(self.rows(), [(4001, "2024-01-01"), (4002, "2024-01-02")])

    def test_refresh_failure_preserves_stale_local_data(self):
        self.assertEqual(self.run_cli("init").returncode, 0)
        self.assertEqual(self.run_cli("import", "--path", str(FIXTURE)).returncode, 0)
        before = self.rows()
        result = self.run_cli("latest", env={"TOTO_HISTORY_URL": "http://127.0.0.1:1/unavailable"})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Could not refresh results", result.stderr)
        self.assertEqual(self.rows(), before)


if __name__ == "__main__":
    unittest.main()
