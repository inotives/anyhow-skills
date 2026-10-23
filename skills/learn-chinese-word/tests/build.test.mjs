import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const build = join(skillDir, "scripts", "build.mjs");
const example = JSON.parse(readFileSync(join(skillDir, "examples", "xiongmao.json"), "utf8"));

function run(content) {
  const dir = mkdtempSync(join(tmpdir(), "learn-chinese-word-"));
  const out = join(dir, "page.html");
  try {
    const r = spawnSync(process.execPath, [build, "-", out], { input: JSON.stringify(content), encoding: "utf8" });
    return { ...r, html: r.status === 0 ? readFileSync(out, "utf8") : "" };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const clone = () => structuredClone(example);

test("example builds one page with embedded content and no warnings", () => {
  const r = run(example);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stderr, "");
  assert.match(r.html, /<script type="application\/json" id="content">/);
  assert.match(r.html, /three@0\.160\.0/);
  assert.match(r.html, /hanzi-writer@3\.7\.2/);
  assert.ok(!r.html.includes("{{"), "all template placeholders are filled");
  const json = JSON.parse(r.html.match(/id="content">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(json, example);
});

test("embedded text cannot close the script tag", () => {
  const c = clone();
  c.explain = "</script><script>alert(1)</script>";
  const r = run(c);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!r.html.includes("</script><script>alert(1)"));
});

test("chars must match the word", () => {
  const c = clone();
  c.chars = c.chars.slice(0, 1);
  const r = run(c);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /chars must have one entry per character/);
});

test("quiz answers must be valid", () => {
  const c = clone();
  c.quiz[0].answer = 9;
  c.quiz[4].show = "no blank here";
  const r = run(c);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /quiz\[0\]\.answer/);
  assert.match(r.stderr, /quiz\[4\]: fill questions need show with ___/);
});

test("sentence tiles must rebuild the sentence", () => {
  const c = clone();
  c.sentences[0].tiles = ["我", "熊猫"];
  const r = run(c);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /sentences\[0\]\.tiles must join/);
});

test("distractors cannot be the target word", () => {
  const c = clone();
  c.distractors[0].zh = "熊猫";
  const r = run(c);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /must not be the target word/);
});
