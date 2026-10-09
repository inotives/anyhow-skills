#!/usr/bin/env node
// Build one self-contained HTML file from a content.json file.
// Usage: node scripts/build.mjs <content.json | page.html | -> <out.html>
//   "-" reads the JSON from stdin, so no temporary file is needed.
// A built page keeps its content as JSON inside the HTML, so the page itself can be the input.
// Print the embedded JSON of a page:  node scripts/build.mjs --extract <page.html>
// No dependencies. Exit code 1 means the content has errors.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tpl = (f) => readFileSync(join(here, "..", "template", f), "utf8");
const args = process.argv.slice(2);
if (args[0] === "--extract") {
  const m = readFileSync(resolve(args[1] || ""), "utf8").match(/<script type="application\/json" id="content">([\s\S]*?)<\/script>/);
  if (!m) { console.error("error: no embedded content found"); process.exit(1); }
  process.stdout.write(m[1].trim() + "\n");
  process.exit(0);
}
const [inPath, outPath] = args;
if (!inPath || !outPath) {
  console.error("Usage: node scripts/build.mjs <content.json | page.html | -> <out.html>");
  process.exit(2);
}

const raw = inPath === "-" ? readFileSync(0, "utf8") : readFileSync(resolve(inPath), "utf8");
let jsonText = raw;
if (/\.html?$/i.test(inPath)) {
  const m = raw.match(/<script type="application\/json" id="content">([\s\S]*?)<\/script>/);
  if (!m) { console.error("error: no embedded content found in " + inPath); process.exit(1); }
  jsonText = m[1];
}
const content = JSON.parse(jsonText);
const errors = [];
const warnings = [];
const PALETTES = ["graphite", "ocean", "forest", "ember", "dusk"];
const COLORS = new Set(["accent", "hl", ...Array.from({ length: 9 }, (_, i) => `k${i + 1}`)]);
const TYPES = new Set(["diagram", "catalog", "ideas", "trace"]);
const err = (m) => errors.push(m);

/* ---------- structure checks ---------- */
const meta = content.meta || {};
if (!meta.title) err("meta.title is missing");
if (!PALETTES.includes(meta.palette)) err(`meta.palette must be one of: ${PALETTES.join(", ")}`);
if (!Array.isArray(content.views) || !content.views.length) err("views must be a non-empty array");
if ((content.views || []).length > 5) warnings.push("More than 5 views. Keep the tab bar short.");

const viewIds = new Set();
for (const v of content.views || []) {
  const at = `view "${v.id}"`;
  if (!v.id || viewIds.has(v.id)) err(`${at}: id is missing or repeated`);
  viewIds.add(v.id);
  if (!TYPES.has(v.type)) err(`${at}: type must be diagram, catalog, ideas or trace`);
  if (!v.tab) err(`${at}: tab label is missing`);

  if (v.type === "diagram") {
    const ids = new Set();
    if (!v.grid || !Array.isArray(v.grid.cols) || !Array.isArray(v.grid.rows)) err(`${at}: grid.cols and grid.rows are required`);
    for (const n of v.nodes || []) {
      if (!n.id || ids.has(n.id)) err(`${at}: node id missing or repeated: ${n.id}`);
      ids.add(n.id);
      if (!n.title) err(`${at}: node ${n.id} has no title`);
      if (n.color && !COLORS.has(n.color)) err(`${at}: node ${n.id} has unknown color ${n.color}`);
      if (n.col == null && n.x == null) err(`${at}: node ${n.id} needs col and row, or x, y, w, h`);
      if (!n.does) warnings.push(`${at}: node ${n.id} has no "does" text`);
      for (const w of n.who || []) if (!(v.people || []).some((p) => p.id === w)) err(`${at}: node ${n.id} uses unknown person ${w}`);
    }
    if (ids.size > 16) warnings.push(`${at}: ${ids.size} nodes. More than 16 is hard to read.`);
    for (const [a, b] of [...(v.edges || []), ...(v.ticks || [])]) {
      if (!ids.has(a) || !ids.has(b)) err(`${at}: edge or tick uses unknown node ${a} → ${b}`);
    }
    if (!Array.isArray(v.stages) || v.stages.length < 3 || v.stages.length > 8) err(`${at}: stages must have 3 to 8 items`);
    for (const s of v.stages || []) {
      for (const id of s.nodes || []) if (!ids.has(id)) err(`${at}: stage "${s.name}" uses unknown node ${id}`);
      if (!s.name || !s.headline || !s.text) err(`${at}: each stage needs name, headline and text`);
    }
    for (const z of v.zones || []) if (z.color && !COLORS.has(z.color)) err(`${at}: zone has unknown color ${z.color}`);
  }
  if (v.type === "catalog") {
    const layers = new Set((v.layers || []).map((l) => l.id));
    for (const l of v.layers || []) if (!COLORS.has(l.color)) err(`${at}: layer ${l.id} has unknown color ${l.color}`);
    for (const i of v.items || []) if (!layers.has(i.layer)) err(`${at}: item "${i.name}" uses unknown layer ${i.layer}`);
    if ((v.layers || []).length > 8) warnings.push(`${at}: more than 8 layers`);
  }
  if (v.type === "trace") {
    if (!Array.isArray(v.items) || !v.items.length || v.items.length > 8) err(`${at}: items must have 1 to 8 entries`);
    for (const i of v.items || []) {
      if (!i.text) err(`${at}: every item needs text`);
      else if (Array.from(i.text).length > 3) warnings.push(`${at}: "${i.text}" has more than 3 characters. The grid gets small.`);
    }
    if (v.repeat != null && (v.repeat < 1 || v.repeat > 5)) err(`${at}: repeat must be 1 to 5`);
  }
  if (v.type === "ideas") {
    if (!Array.isArray(v.cards) || v.cards.length < 2 || v.cards.length > 6) err(`${at}: cards must have 2 to 6 items`);
    for (const c of v.cards || []) if (c.color && !COLORS.has(c.color)) err(`${at}: card "${c.title}" has unknown color ${c.color}`);
  }
}
for (const v of content.views || []) {
  if (v.type !== "ideas") continue;
  for (const c of v.cards || []) if (c.go && !viewIds.has(c.go.view)) err(`ideas card "${c.title}" points to unknown view ${c.go.view}`);
}

/* ---------- writing lint (STE-inspired): sentences of 20 words or fewer ---------- */
const SKIP = new Set(["id", "url", "icon", "color", "kind", "type", "palette", "view", "pinyin", "speak", "speakLang", "glyph"]);
(function lint(o, path) {
  if (typeof o === "string") {
    const text = o.replace(/\*\*/g, "");
    if (text.split(/\s+/).length < 21 && !/\.\s+\S/.test(text)) return;
    for (const s of text.split(/(?<=[.!?])\s+/)) {
      const n = s.trim().split(/\s+/).length;
      if (n > 20) warnings.push(`${path}: sentence has ${n} words (max 20): "${s.slice(0, 60)}…"`);
    }
  } else if (Array.isArray(o)) o.forEach((x, i) => lint(x, `${path}[${i}]`));
  else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) if (!SKIP.has(k)) lint(v, `${path}.${k}`);
})(content.views, "views");

for (const w of warnings) console.warn("warn  " + w);
if (errors.length) {
  for (const e of errors) console.error("error " + e);
  process.exit(1);
}

/* ---------- assemble ---------- */
const safeJson = JSON.stringify(content, null, 1).replace(/</g, "\\u003c").replace(new RegExp("\\u2028", "g"), "\\u2028").replace(new RegExp("\\u2029", "g"), "\\u2029");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const parts = { PALETTE: meta.palette, TITLE: esc(meta.title), CSS: tpl("theme.css"), CONTENT: safeJson, ENGINE: tpl("engine.js") };
// split-and-join avoids "$" patterns in replace()
let html = tpl("shell.html");
for (const [k, v] of Object.entries(parts)) html = html.split(`{{${k}}}`).join(v);
// Single-file rule: the page must not load anything from outside.
const external = html.match(/<(?:script|link|img|iframe|source|video|audio)\b[^>]*\b(?:src|href)\s*=\s*["'](?:https?:)?\/\/[^"']+/gi) || [];
const imports = html.match(/@import\s+url\(|import\s*\(\s*["']https?:/g) || [];
if (external.length || imports.length) {
  console.error("error: the page loads external files. Everything must be inside one HTML file.");
  for (const e of external) console.error("  " + e.slice(0, 100));
  process.exit(1);
}
writeFileSync(resolve(outPath), html);
console.log(`built ${outPath} (${(html.length / 1024).toFixed(0)} KB, ${content.views.length} views, ${warnings.length} warnings)`);
