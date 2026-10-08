import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { cpSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
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
  return { dir, cli: join(dir, "dist/cli.js"), db: join(dir, ".state/singapore_toto.sqlite3") };
}

function run(cli, args, env = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: tmpdir(),
    encoding: "utf8",
    env: { ...process.env, ...env },
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
