#!/usr/bin/env node
// Build one HTML report from report JSON. Checks the content, then scans it for sensitive data.
//   node scripts/build.mjs <report.json | report.html | -> <out.html> [--deny terms.txt] [--inline]
//   node scripts/build.mjs --extract <report.html>
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const T = f => readFileSync(join(ROOT, "template", f), "utf8");
const D3 = "https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js";
const PALETTES = ["centience", "teal", "slate"];
const CONF = ["public", "internal", "client"];
const TOKENS = ["c1", "c2", "c3", "c4", "c5", "c6", "good", "warn", "risk", "accent", "ink-3"];
const CHARTS = ["bars", "stacked", "donut", "line", "radar", "treemap", "flow"];
const BLOCKS = [...CHARTS, "text", "kpis", "cards", "table", "callout", "findings", "steps", "grid"];

const args = process.argv.slice(2);
const flag = n => { const i = args.indexOf(n); if (i < 0) return null; const v = args[i + 1]; args.splice(i, v && !v.startsWith("--") ? 2 : 1); return v && !v.startsWith("--") ? v : true; };
const denyFile = flag("--deny"), inline = flag("--inline");
const readIn = p => (p === "-" ? readFileSync(0, "utf8") : readFileSync(p, "utf8"));
const parse = src => {
  const m = src.match(/<script type="application\/json" id="report">([\s\S]*?)<\/script>/);
  return JSON.parse(m ? m[1] : src);
};

if (args[0] === "--extract") { process.stdout.write(JSON.stringify(parse(readIn(args[1])), null, 1) + "\n"); process.exit(0); }
if (args.length < 2) { console.error("Usage: build.mjs <report.json | report.html | -> <out.html> [--deny terms.txt] [--inline]\n       build.mjs --extract <report.html>"); process.exit(2); }

const errors = [], warns = [], leaks = [];
const err = m => errors.push(m), warn = m => warns.push(m);
let R;
try { R = parse(readIn(args[0])); } catch (e) { console.error("ERROR  Input is not valid JSON: " + e.message); process.exit(1); }

/* ---------- 1. structure ---------- */
const M = R.meta || {};
if (!M.title) err("meta.title is required.");
if (!PALETTES.includes(M.palette)) err(`meta.palette must be one of: ${PALETTES.join(", ")}.`);
if (!CONF.includes(M.confidentiality)) err(`meta.confidentiality is required: ${CONF.join(", ")}.`);
if (!M.standfirst) warn("meta.standfirst is empty. Write 2 to 3 sentences that give the answer.");
if (!Array.isArray(R.tabs) || !R.tabs.length) err("tabs[] needs at least 1 tab.");
const tabIds = new Set((R.tabs || []).map(t => t.id));
if (tabIds.size !== (R.tabs || []).length) err("Tab ids must be unique.");
const tok = (c, where) => { if (c != null && !TOKENS.includes(c)) err(`${where}: color "${c}" is not a token (${TOKENS.join(", ")}).`); };
const words = s => s.trim().split(/\s+/).filter(Boolean).length;

function checkBlock(b, where) {
  if (!BLOCKS.includes(b.type)) return err(`${where}: unknown block type "${b.type}". Use ${BLOCKS.join(", ")}.`);
  const need = (c, m) => { if (!c) err(`${where} (${b.type}): ${m}`); };
  switch (b.type) {
    case "text": need(Array.isArray(b.paragraphs) && b.paragraphs.length, "needs paragraphs[]."); break;
    case "kpis": need(Array.isArray(b.items) && b.items.length, "needs items[]."); (b.items || []).forEach(k => need(k.label && k.value != null, "each item needs label and value.")); break;
    case "cards": need(Array.isArray(b.items) && b.items.length, "needs items[]."); (b.items || []).forEach(c => { tok(c.color, where); if (c.goto && !tabIds.has(c.goto)) err(`${where}: card goto "${c.goto}" is not a tab id.`); }); break;
    case "table": need(Array.isArray(b.columns) && Array.isArray(b.rows), "needs columns[] and rows[]."); (b.columns || []).forEach(c => need(c.key && c.label, "each column needs key and label.")); break;
    case "callout": need(b.text, "needs text."); if (b.kind && !["note", "warn", "risk", "good"].includes(b.kind)) err(`${where}: callout kind must be note, warn, risk, or good.`); break;
    case "findings": case "steps": need(Array.isArray(b.items) && b.items.length, "needs items[]."); break;
    case "bars": case "donut": case "treemap": need(Array.isArray(b.items) && b.items.length && b.items.every(i => i.label && typeof i.value === "number"), "needs items[] with label and numeric value."); (b.items || []).forEach(i => tok(i.color, where)); break;
    case "stacked": need(Array.isArray(b.categories) && Array.isArray(b.series) && b.series.every(s => s.values?.length === b.categories.length), "needs categories[] and series[] with one value for each category."); break;
    case "line": need(Array.isArray(b.x) && Array.isArray(b.series) && b.series.every(s => s.values?.length === b.x.length), "needs x[] and series[] with one value for each x."); break;
    case "radar": need(Array.isArray(b.axes) && Array.isArray(b.series) && b.series.every(s => s.values?.length === b.axes.length), "needs axes[] and series[] with one value for each axis."); break;
    case "flow": {
      need(Number.isInteger(b.cols) && Array.isArray(b.nodes) && Array.isArray(b.edges), "needs cols, nodes[], edges[].");
      const ids = new Set((b.nodes || []).map(n => n.id));
      need(ids.size === (b.nodes || []).length, "node ids must be unique.");
      (b.edges || []).forEach(([a, c]) => need(ids.has(a) && ids.has(c), `edge [${a}, ${c}] uses an unknown id.`));
      if ((b.nodes || []).length > 14) warn(`${where}: flow has ${b.nodes.length} nodes. Use 14 or fewer.`);
      break;
    }
    case "grid": need(Array.isArray(b.blocks) && b.blocks.length, "needs blocks[]."); (b.blocks || []).forEach((x, i) => { if (x.type === "grid") err(`${where}: a grid cannot hold a grid.`); else checkBlock(x, `${where}.blocks[${i}]`); }); break;
  }
  for (const s of b.series || []) tok(s.color, where);
}
(R.tabs || []).forEach((t, i) => {
  const w = `tab "${t.id || i}"`;
  if (!/^[a-z][a-z0-9-]*$/.test(t.id || "")) err(`${w}: id must be lowercase kebab-case.`);
  if (!t.label) err(`${w}: label is required.`);
  tok(t.color, w);
  if (!Array.isArray(t.sections) || !t.sections.length) err(`${w}: needs sections[].`);
  (t.sections || []).forEach((s, j) => { if (!s.heading) err(`${w} section ${j + 1}: heading is required.`); (s.blocks || []).forEach((b, k) => checkBlock(b, `${w} section ${j + 1} block ${k + 1}`)); });
});

/* ---------- 2. sentence length ---------- */
const SKIP = /^(id|type|color|kind|tone|palette|goto|href|key|code|width|height|min|max|unit)$/;
(function lint(o, p, k) {
  if (typeof o === "string") { if (!SKIP.test(k || "")) for (const s of o.split(/(?<=[.!?])\s+/)) if (words(s) > 30) warn(`${p}: sentence over 30 words: "${s.slice(0, 60)}…"`); }
  else if (Array.isArray(o)) o.forEach((v, i) => lint(v, `${p}[${i}]`, k));
  else if (o && typeof o === "object") for (const [kk, v] of Object.entries(o)) lint(v, `${p}.${kk}`, kk);
})(R, "$");

/* ---------- 3. safety scan: runs on every string in the report ---------- */
const allow = new Set((M.allowTerms || []).map(s => s.toLowerCase()));
const deny = denyFile && denyFile !== true ? readFileSync(denyFile, "utf8").split("\n").map(s => s.trim()).filter(s => s && !s.startsWith("#")) : [];
const RULES = [
  // credentials and secrets
  ["credential", /AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}/, "AWS access key id"],
  ["credential", /-----BEGIN [A-Z ]*(PRIVATE|CERTIFICATE)/, "key or certificate block"],
  ["credential", /\b(?:xox[abpr]-|gh[pousr]_|github_pat_|glpat-|sk-[A-Za-z0-9]{16,}|AIza[0-9A-Za-z_-]{20,})/, "API token"],
  ["credential", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./, "JWT"],
  ["credential", /\b(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?key|token|bearer)\b\s*[:=]\s*\S{4,}/i, "credential assignment"],
  ["credential", /[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@/i, "connection string with a password"],
  ["credential", /\b[A-Za-z0-9+/_=-]{40,}\b/, "long random-looking string"],
  // infrastructure
  ["infrastructure", /\barn:aws[a-z-]*:/, "AWS ARN"],
  ["infrastructure", /\b(?:s3|gs|abfss?|wasbs?|hdfs):\/\//i, "storage URI"],
  ["infrastructure", /\b\d{12}\b(?=.*(?:aws|account|iam|role))|\baccount[ _-]?id\W{0,3}\d{8,}/i, "cloud account id"],
  ["infrastructure", /\b(?:\d{1,3}\.){3}\d{1,3}\b/, "IP address"],
  ["infrastructure", /\b[\w.-]+\.(?:amazonaws\.com|snowflakecomputing\.com|databricks\.com|motherduck\.com|azuredatabricks\.net|internal|local|corp|lan)\b|\blocalhost\b/i, "internal or vendor host name"],
  // data identifiers
  ["data-identifier", /\b[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*\b(?<!\.(?:com|org|net|io|co|ai|dev|app|sg|md))/i, "database.schema.table name"],
  ["data-identifier", /\b(?:raw|bronze|silver|gold|stg|staging|prod|production|dwh|core|mart|public)\.[a-z_][a-z0-9_]+\b/i, "schema.table name"],
  ["data-identifier", /\b[a-z][a-z0-9]*(?:_[a-z0-9]+){2,}\b/, "snake_case identifier (table or column name)"],
  ["data-identifier", /\b[a-z][a-z0-9]*_(?:id|at|date|ts|code|flag|amt|amount|name|no|num|key|type|status|cnt|count)\b/, "column-style name"],
  ["data-identifier", /\b(?:SELECT\s.+\sFROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW)|ALTER\s+TABLE|DROP\s+TABLE|JOIN\s+\w+\s+ON)\b/i, "SQL statement"],
  // personal data
  ["personal-data", /[\w.+-]+@[\w-]+\.[\w.-]+/, "email address"],
  ["personal-data", /\b[STFGM]\d{7}[A-Z]\b/, "national id number"],
  ["personal-data", /(?<!\d)(?:\+?65[ -]?)?[89]\d{3}[ -]?\d{4}(?!\d)/, "phone number"],
  ["personal-data", /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, "UUID (a record id)"],
];
const stripLinkHost = (k, s) => (k === "href" ? "" : s);
let scanned = 0;
(function scan(o, p, k) {
  if (typeof o === "string") {
    scanned++;
    const s = stripLinkHost(k, o);
    for (const [cat, re, what] of RULES) {
      const m = s.match(re);
      if (!m) continue;
      if (allow.has(m[0].toLowerCase())) continue;
      leaks.push(`${p}: ${what} [${cat}]: "${m[0].slice(0, 50)}"`);
    }
    for (const d of deny) if (s.toLowerCase().includes(d.toLowerCase())) leaks.push(`${p}: deny-list term found: "${d}"`);
    if (k === "href") {
      if (!/^https:\/\//.test(o)) leaks.push(`${p}: links must be https: "${o.slice(0, 50)}"`);
      else warn(`${p}: external link "${o.slice(0, 60)}". Confirm the reader may open it and it names nothing sensitive.`);
    }
  } else if (Array.isArray(o)) o.forEach((v, i) => scan(v, `${p}[${i}]`, k));
  else if (o && typeof o === "object") for (const [kk, v] of Object.entries(o)) { if (kk === "allowTerms") continue; scan(v, `${p}.${kk}`, kk); }
})(R, "$");
if (!denyFile) warn("No --deny list. Write the real table, column, schema, account, and client names from your source into a local file and pass it with --deny. The built-in patterns cannot know your names.");

/* ---------- 4. result ---------- */
if (errors.length || leaks.length) {
  if (errors.length) console.error(errors.map(e => "ERROR  " + e).join("\n"));
  if (leaks.length) console.error(leaks.map(e => "LEAK   " + e).join("\n") + `\n\n${leaks.length} possible leak(s). Generalize the text (use an alias such as "Table A" or "the payments app"), then build again. If a term is generic and safe, add it to meta.allowTerms.`);
  process.exit(1);
}

/* ---------- 5. assemble ---------- */
let libs = `<script src="${D3}"></script>`;
if (inline) { const r = await fetch(D3); if (!r.ok) { console.error("ERROR  Could not fetch D3 for --inline."); process.exit(1); } libs = `<script>\n${(await r.text()).replace(/<\/script/gi, "<\\/script")}\n</script>`; }
const json = JSON.stringify(R, null, 1).replace(/</g, "\\u003c").replace(new RegExp("\\u2028", "g"), "\\u2028").replace(new RegExp("\\u2029", "g"), "\\u2029");
const out = T("shell.html").split("{{PALETTE}}").join(M.palette).split("{{TITLE}}").join(M.title.replace(/</g, "&lt;"))
  .split("{{CSS}}").join(T("theme.css")).split("{{CONTENT}}").join(json).split("{{LIBS}}").join(libs).split("{{ENGINE}}").join(T("engine.js"));
for (const m of out.matchAll(/\b(?:src|href)\s*=\s*"((?:https?:)?\/\/[^"]+)"/g))
  if (m[1] !== D3 && !/^https:\/\/fonts\.(googleapis|gstatic)\.com/.test(m[1])) { console.error("ERROR  Unexpected external resource in output: " + m[1]); process.exit(1); }
writeFileSync(args[1], out);
const blocks = JSON.stringify(R).match(/"type":"(?:bars|stacked|donut|line|radar|treemap|flow)"/g) || [];
console.log(`Built ${args[1]}: ${R.tabs.length} tabs, ${blocks.length} charts, ${(out.length / 1024).toFixed(0)} KB${inline ? " (D3 inlined, works offline)" : " (D3 from pinned CDN)"}.`);
console.log(`Safety scan: ${scanned} strings checked, 0 leaks. Deny-list: ${deny.length ? deny.length + " terms" : "none"}. Allowed terms: ${allow.size}. Confidentiality: ${M.confidentiality}.`);
if (warns.length) console.log(warns.map(w => "WARN   " + w).join("\n"));
