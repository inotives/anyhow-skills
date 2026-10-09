#!/usr/bin/env node
// Build one Reveal.js deck HTML file from slide markup.
//   node scripts/build.mjs <slides.html | deck.html | -> <out.html> [--inline]
//   node scripts/build.mjs --extract <deck.html>
// Slide markup starts with <!--deck {"title":"…","palette":"teal"} --> then <section> blocks.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const T = f => readFileSync(join(ROOT, "template", f), "utf8");
const CDN = "https://cdnjs.cloudflare.com/ajax/libs/";
const LIBS = {
  revealCss: CDN + "reveal.js/5.1.0/reveal.min.css",
  reveal: CDN + "reveal.js/5.1.0/reveal.min.js",
  notes: CDN + "reveal.js/5.1.0/plugin/notes/notes.min.js",
  d3: CDN + "d3/7.9.0/d3.min.js",
};
const PALETTES = ["teal", "indigo", "ember", "forest", "slate"];
const BGS = ["light", "soft", "warm", "dark", "brand"];
const WIDGETS = ["flow", "bars", "donut", "line", "timeline"];
const TOKENS = ["accent", "s1", "s2", "s3", "s4", "s5", "good", "warn", "risk"];
const SKIP_LINT = /^(id|url|color|kind|icon)$/;

const args = process.argv.slice(2);
const inline = args.includes("--inline");
const pos = args.filter(a => a !== "--inline");
const errors = [], warns = [];
const err = m => errors.push(m), warn = m => warns.push(m);
const readIn = p => (p === "-" ? readFileSync(0, "utf8") : readFileSync(p, "utf8"));
const MARK = /<!--SLIDES-->([\s\S]*?)<!--\/SLIDES-->/;

function parse(src) {
  const page = src.match(MARK);
  if (page) {
    const m = src.match(/<script type="application\/json" id="deck-meta">([\s\S]*?)<\/script>/);
    return { meta: JSON.parse(m[1]), slides: page[1].trim() };
  }
  const m = src.match(/<!--\s*deck\s*(\{[\s\S]*?\})\s*-->/);
  if (!m) throw new Error('Missing <!--deck {"title":"…","palette":"teal"} --> comment at the top.');
  return { meta: JSON.parse(m[1]), slides: src.replace(m[0], "").trim() };
}

if (pos[0] === "--extract") {
  const { meta, slides } = parse(readIn(pos[1]));
  process.stdout.write(`<!--deck ${JSON.stringify(meta)} -->\n${slides}\n`);
  process.exit(0);
}
if (pos.length < 2) {
  console.error("Usage: build.mjs <slides.html | deck.html | -> <out.html> [--inline]\n       build.mjs --extract <deck.html>");
  process.exit(2);
}

let { meta, slides } = parse(readIn(pos[0]));
if (!meta.title) err("meta.title is required.");
if (!PALETTES.includes(meta.palette)) err(`meta.palette must be one of: ${PALETTES.join(", ")}.`);

// --- structure
const opens = (slides.match(/<section\b/g) || []).length, closes = (slides.match(/<\/section>/g) || []).length;
if (opens !== closes) err(`Unbalanced <section> tags (${opens} open, ${closes} close).`);
let depth = 0, nested = false;
for (const t of slides.match(/<\/?section\b/g) || []) { depth += t[1] === "/" ? -1 : 1; if (depth > 1) nested = true; }
if (nested) err("Nested <section> found. Use a flat list of slides.");
const secs = [...slides.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)];
if (secs.length < 3) warn(`Only ${secs.length} slides. A deck needs at least 3.`);
if (secs.length > 20) warn(`${secs.length} slides. Keep a deck to 20 slides or fewer.`);

// --- external resources inside slides
for (const m of slides.matchAll(/\b(?:src|href)\s*=\s*["']\s*(?:https?:)?\/\/[^"']+|url\(\s*["']?(?:https?:)?\/\/[^)]+/gi))
  err(`External resource in slides: ${m[0].slice(0, 80)}. Draw it inline as SVG instead.`);

const words = s => s.trim().split(/\s+/).filter(Boolean).length;
const plain = h => h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<aside[\s\S]*?<\/aside>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ")
  .replace(/<svg[\s\S]*?<\/svg>/g, " ").replace(/<\/?(?:p|li|ul|ol|h[1-6]|div|td|th|tr|button|section|br)\b[^>]*>/g, "\n").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ");

secs.forEach((m, i) => {
  const n = i + 1, attrs = m[1], body = m[2];
  const bg = (attrs.match(/data-bg="([^"]*)"/) || [])[1];
  if (bg && !BGS.includes(bg)) err(`Slide ${n}: data-bg "${bg}" is not one of ${BGS.join(", ")}.`);
  const st = (attrs.match(/data-steps="([^"]*)"/) || [])[1];
  if (st && !(/^\d+$/.test(st) && +st >= 1 && +st <= 8)) err(`Slide ${n}: data-steps must be 1 to 8.`);
  const maxAt = Math.max(0, ...[...body.matchAll(/data-(?:at|only|step-to)="(\d+)"/g)].map(x => +x[1]));
  const specAts = [...body.matchAll(/"at"\s*:\s*(\d+)/g)].map(x => +x[1]);
  const top = Math.max(maxAt, ...specAts, 0);
  if (top > (st ? +st : 0)) err(`Slide ${n}: a step number ${top} is above data-steps="${st || 0}".`);
  if (st && !top) warn(`Slide ${n}: data-steps is set but nothing uses data-at, data-only or "at".`);
  if (!/<h1\b|class="quote/.test(body)) warn(`Slide ${n}: no <h1>. Give each slide one headline.`);
  if ((body.match(/<h1\b/g) || []).length > 1) warn(`Slide ${n}: more than one <h1>.`);

  const txt = plain(body);
  if (words(txt) > 90) warn(`Slide ${n}: ${words(txt)} words. Keep a slide to 90 words or fewer.`);
  for (const s of txt.split(/\n|(?<=[.!?])\s+/)) if (words(s) > 20) warn(`Slide ${n}: sentence over 20 words: "${s.trim().slice(0, 60)}…"`);

  // widgets
  for (const w of body.matchAll(/<div\b[^>]*data-wd="([^"]*)"[^>]*>\s*<script type="application\/json">([\s\S]*?)<\/script>/g)) {
    const kind = w[1];
    if (!WIDGETS.includes(kind)) { err(`Slide ${n}: unknown widget "${kind}". Use ${WIDGETS.join(", ")}.`); continue; }
    let spec; try { spec = JSON.parse(w[2]); } catch (e) { err(`Slide ${n}: ${kind} spec is not valid JSON (${e.message}).`); continue; }
    const need = (c, msg) => { if (!c) err(`Slide ${n}: ${kind} ${msg}`); };
    if (kind === "flow") {
      need(Number.isInteger(spec.cols) && spec.cols > 0, "needs integer cols.");
      const ids = new Set((spec.nodes || []).map(x => x.id));
      need(ids.size === (spec.nodes || []).length && ids.size > 0, "needs nodes with unique ids.");
      for (const x of spec.nodes || []) need(x.title && x.col != null && x.row != null || false, `node "${x.id}" needs title, col, row.`);
      for (const [a, b] of spec.edges || []) need(ids.has(a) && ids.has(b), `edge [${a}, ${b}] uses an unknown id.`);
      if ((spec.nodes || []).length > 12) warn(`Slide ${n}: flow has ${spec.nodes.length} nodes. Use 12 or fewer.`);
    }
    if (kind === "bars" || kind === "donut") need(Array.isArray(spec.data) && spec.data.length, "needs data[].");
    if (kind === "line") need(Array.isArray(spec.x) && Array.isArray(spec.series) && spec.series.every(s => s.values?.length === spec.x.length), "needs x[] and series[] with one value for each x.");
    if (kind === "timeline") need(Array.isArray(spec.items) && spec.items.length, "needs items[].");
    for (const c of JSON.stringify(spec).matchAll(/"color"\s*:\s*"([^"]*)"/g)) if (!TOKENS.includes(c[1])) err(`Slide ${n}: color "${c[1]}" is not a token (${TOKENS.join(", ")}).`);
    (function lint(o, k) {
      if (typeof o === "string" && !SKIP_LINT.test(k || "") && words(o) > 20) warn(`Slide ${n}: ${kind} text over 20 words: "${o.slice(0, 50)}…"`);
      else if (o && typeof o === "object") for (const [kk, v] of Object.entries(o)) lint(v, kk);
    })(spec);
  }
  if (/#[0-9a-fA-F]{6}\b/.test(body.replace(/<script[\s\S]*?<\/script>/g, ""))) warn(`Slide ${n}: hex color found. Use palette tokens (var(--s1), var(--accent)) so the palette can change.`);
});

if (errors.length) { console.error(errors.map(e => "ERROR  " + e).join("\n")); process.exit(1); }

// --- assemble
async function fetchText(u) { const r = await fetch(u); if (!r.ok) throw new Error(`${u} -> ${r.status}`); return r.text(); }
let revealCss = `<link rel="stylesheet" href="${LIBS.revealCss}">`;
let libs = [LIBS.reveal, LIBS.notes, LIBS.d3].map(u => `<script src="${u}"></script>`).join("\n");
if (inline) {
  const [css, rv, nt, d3] = await Promise.all([LIBS.revealCss, LIBS.reveal, LIBS.notes, LIBS.d3].map(fetchText));
  const safe = s => s.replace(/<\/script/gi, "<\\/script");
  revealCss = `<style>\n${css}\n</style>`;
  libs = [rv, nt, d3].map(s => `<script>\n${safe(s)}\n</script>`).join("\n");
}
const safeJson = JSON.stringify(meta, null, 1).replace(/</g, "\\u003c");
const out = T("shell.html")
  .split("{{PALETTE}}").join(meta.palette).split("{{TITLE}}").join(meta.title.replace(/</g, "&lt;"))
  .split("{{REVEAL_CSS}}").join(revealCss).split("{{CSS}}").join(T("theme.css"))
  .split("{{META}}").join(safeJson).split("{{LIBS}}").join(libs)
  .split("{{ENGINE}}").join(T("engine.js")).split("{{SLIDES}}").join(slides);

if (!inline) {
  const allowed = new Set(Object.values(LIBS));
  for (const m of out.matchAll(/\b(?:src|href)\s*=\s*"((?:https?:)?\/\/[^"]+)"/g))
    if (!allowed.has(m[1]) && !/^https:\/\/fonts\.(googleapis|gstatic)\.com/.test(m[1])) { console.error("ERROR  Unexpected external resource: " + m[1]); process.exit(1); }
}
writeFileSync(pos[1], out);
console.log(`Built ${pos[1]}: ${secs.length} slides, palette ${meta.palette}, ${(out.length / 1024).toFixed(0)} KB${inline ? " (libraries inlined, works offline)" : " (libraries from pinned CDN)"}.`);
if (warns.length) console.log(warns.map(w => "WARN   " + w).join("\n"));
