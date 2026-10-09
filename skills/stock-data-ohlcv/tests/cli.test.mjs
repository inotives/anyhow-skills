import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
function run(cli, args, env) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: tmpdir(), encoding: "utf8", env: { ...process.env, ...env } });
}

test("fetches a fixture and shows the stored OHLCV row", () => {
  const dir = mkdtempSync(join(tmpdir(), "stock-ohlcv-test-"));
  const env = { OHLCV_DB_PATH: join(dir, "state.duckdb"), OHLCV_CHART_FILE: join(root, "tests/fixtures/chart.json"), OHLCV_SOURCE_LABEL: "fixture" };
  try {
    const cli = join(root, "dist/cli.js");
    assert.equal(run(cli, ["fetch", "--ticker", "aapl", "--date", "2024-01-02"], env).status, 0);
    const shown = run(cli, ["show", "--ticker", "AAPL", "--date", "2024-01-02"], env);
    assert.equal(shown.status, 0, shown.stderr);
    const rows = JSON.parse(shown.stdout);
    assert.deepEqual(rows[0], {
      ticker: "AAPL",
      trading_date: "2024-01-02",
      open: 100,
      high: 105,
      low: 99,
      close: 104,
      adj_close: 104,
      volume: "1000000",
      source: "fixture",
      fetched_at: rows[0].fetched_at
    });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("rejects malformed dates before fetching", () => {
  const dir = mkdtempSync(join(tmpdir(), "stock-ohlcv-test-"));
  try {
    const result = run(join(root, "dist/cli.js"), ["fetch", "--ticker", "AAPL", "--date", "2024-02-30"], { OHLCV_DB_PATH: join(dir, "state.duckdb") });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /not a real calendar date/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a failed fetch leaves existing data available", () => {
  const dir = mkdtempSync(join(tmpdir(), "stock-ohlcv-test-"));
  const db = join(dir, "state.duckdb");
  try {
    const cli = join(root, "dist/cli.js");
    const fixtureEnv = { OHLCV_DB_PATH: db, OHLCV_CHART_FILE: join(root, "tests/fixtures/chart.json") };
    assert.equal(run(cli, ["fetch", "--ticker", "AAPL", "--date", "2024-01-02"], fixtureEnv).status, 0);
    const failed = run(cli, ["fetch", "--ticker", "AAPL", "--date", "2024-01-03"], { OHLCV_DB_PATH: db, OHLCV_CHART_FILE: join(dir, "missing.json") });
    assert.notEqual(failed.status, 0);
    const shown = run(cli, ["show", "--ticker", "AAPL"], { OHLCV_DB_PATH: db });
    assert.equal(JSON.parse(shown.stdout).length, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
