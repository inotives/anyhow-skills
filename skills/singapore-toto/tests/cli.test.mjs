import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const fixture = join(root, "tests/fixtures/toto.csv");

function runtime() {
  const dir = mkdtempSync(join(tmpdir(), "anyhow-toto-test-"));
  mkdirSync(join(dir, "dist"), { recursive: true });
  mkdirSync(join(dir, "schema"), { recursive: true });
  cpSync(join(root, "dist/cli.js"), join(dir, "dist/cli.js"));
  cpSync(join(root, "schema/001_initial.sql"), join(dir, "schema/001_initial.sql"));
  return { dir, cli: join(dir, "dist/cli.js"), db: join(dir, "data/singapore_toto.sqlite3") };
}

function run(cli, args, env = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: tmpdir(),
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

// spawnSync would block the event loop, so tests that serve HTTP use this instead.
function runAsync(cli, args, env = {}) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd: tmpdir(), env: { ...process.env, ...env } });
    let stdout = ""; let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => done({ code, stdout, stderr }));
  });
}

function rows(db) {
  const database = new DatabaseSync(db);
  const result = database.prepare("SELECT draw, draw_date FROM toto_results ORDER BY draw").all().map((row) => ({ ...row }));
  database.close();
  return result;
}

test("imports valid rows and rejects malformed or out-of-range rows", () => {
  const { dir, cli, db } = runtime();
  try {
    assert.equal(run(cli, ["init"]).status, 0);
    const imported = run(cli, ["import", "--path", fixture]);
    assert.equal(imported.status, 0, imported.stderr);
    assert.match(imported.stdout, /Imported 2 rows/);
    assert.deepEqual(rows(db), [
      { draw: 9001, draw_date: "2020-01-02" },
      { draw: 9003, draw_date: "2020-01-16" },
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("predict fails clearly when local history is empty", () => {
  const { dir, cli } = runtime();
  try {
    assert.equal(run(cli, ["init"]).status, 0);
    const result = run(cli, ["predict"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /No historical Toto draws found/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("every estimator picks six distinct numbers from 1-49", () => {
  const { dir, cli } = runtime();
  try {
    // Cover every number 1-49 so an out-of-range number would look most overdue.
    const csv = join(dir, "full.csv");
    const lines = Array.from({ length: 9 }, (_, i) => `${5001 + i},2024-02-${String(i + 1).padStart(2, "0")},${Array.from({ length: 6 }, (_, k) => ((i * 6 + k) % 49) + 1).join(",")},49`);
    writeFileSync(csv, ["Draw,Date,1,2,3,4,5,6,Additional", ...lines].join("\n"));
    assert.equal(run(cli, ["init"]).status, 0);
    assert.equal(run(cli, ["import", "--path", csv]).status, 0);
    const methods = ["frequency", "recency", "bayesian", "overdue", "hot-cold", "pairs", "balanced", "sum-range", "monte-carlo", "ensemble"];
    const result = run(cli, ["predict", "--estimator_method", methods.join(",")]);
    assert.equal(result.status, 0, result.stderr);
    const picks = [...result.stdout.matchAll(/Estimated next numbers \(([\w-]+)\): ([\d ]+)/g)];
    assert.deepEqual(picks.map((match) => match[1]), methods);
    for (const [, method, numbers] of picks) {
      const values = numbers.trim().split(" ").map(Number);
      assert.equal(new Set(values).size, 6, `${method}: ${numbers}`);
      assert.ok(values.every((n) => n >= 1 && n <= 49), `${method}: ${numbers}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("refresh --pages crawls each history page", async () => {
  const { dir, cli, db } = runtime();
  const requested = [];
  const server = createServer((request, response) => {
    requested.push(request.url);
    const page = Number(request.url.match(/\/page\/(\d+)\//)?.[1]);
    response.end(page <= 2 ? `<tr><td>${4000 + page}</td><td>2024-01-0${page}</td><td>1, 2, 3, 4, 5, ${page + 10}</td><td>49</td></tr>` : "<p>No results</p>");
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  try {
    assert.equal(run(cli, ["init"]).status, 0);
    const url = `http://127.0.0.1:${server.address().port}/history/page/1/per-page/50/summary-view`;
    const result = await runAsync(cli, ["refresh", "--pages", "3"], { TOTO_HISTORY_URL: url });
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /stored 2 draws/);
    assert.deepEqual(requested.map((path) => path.match(/\/page\/(\d+)\//)[1]), ["1", "2", "3"]);
    assert.deepEqual(rows(db), [
      { draw: 4001, draw_date: "2024-01-01" },
      { draw: 4002, draw_date: "2024-01-02" },
    ]);
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("refresh failure preserves stale local data", () => {
  const { dir, cli, db } = runtime();
  try {
    assert.equal(run(cli, ["init"]).status, 0);
    assert.equal(run(cli, ["import", "--path", fixture]).status, 0);
    const before = rows(db);
    const result = run(cli, ["latest"], { TOTO_HISTORY_URL: "http://127.0.0.1:1/unavailable" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /Could not refresh results/);
    assert.deepEqual(rows(db), before);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
