#!/usr/bin/env node
// Build one interactive word-learning HTML page from a word JSON file.
// Usage: node scripts/build.mjs <word.json | page.html | -> [out.html]
//   "-" reads the JSON from stdin. Without out.html the page is written to
//   <repo>/generated_output/learn-chinese-word-<slug>.html.
// Print the embedded JSON of a page:  node scripts/build.mjs --extract <page.html>
// No dependencies. Exit code 1 means the content has errors.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tpl = (f) => readFileSync(join(here, "..", "template", f), "utf8");
const EMBED = /<script type="application\/json" id="content">([\s\S]*?)<\/script>/;
const args = process.argv.slice(2);

if (args[0] === "--extract") {
  const m = readFileSync(resolve(args[1] || ""), "utf8").match(EMBED);
  if (!m) { console.error("error: no embedded content found"); process.exit(1); }
  process.stdout.write(m[1].trim() + "\n");
  process.exit(0);
}
const [inPath, outArg] = args;
if (!inPath) {
  console.error("Usage: node scripts/build.mjs <word.json | page.html | -> [out.html]");
  process.exit(2);
}

const raw = inPath === "-" ? readFileSync(0, "utf8") : readFileSync(resolve(inPath), "utf8");
let jsonText = raw;
if (/\.html?$/i.test(inPath)) {
  const m = raw.match(EMBED);
  if (!m) { console.error("error: no embedded content found in " + inPath); process.exit(1); }
  jsonText = m[1];
}
const c = JSON.parse(jsonText);
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);
const str = (v) => typeof v === "string" && v.trim().length > 0;
const HAN = /\p{Script=Han}/u;

/* ---------- word ---------- */
if (!str(c.word)) err("word is missing");
const hanChars = Array.from(c.word || "").filter((ch) => HAN.test(ch));
if (str(c.word) && hanChars.length !== Array.from(c.word).length) err("word must contain only Chinese characters");
if (hanChars.length > 4) err("word must have 1 to 4 characters");
if (!str(c.pinyin)) err("pinyin is missing");
if (!str(c.meaning)) err("meaning is missing");
if (!str(c.explain)) err("explain is missing (one or two child-friendly sentences)");
if (!str(c.emoji)) warn("emoji is missing. The picture side of cards will be empty.");

/* ---------- characters ---------- */
if (!Array.isArray(c.chars) || c.chars.length !== hanChars.length) {
  err(`chars must have one entry per character of "${c.word}" (${hanChars.length})`);
} else {
  c.chars.forEach((ch, i) => {
    const at = `chars[${i}]`;
    if (ch.char !== hanChars[i]) err(`${at}.char must be "${hanChars[i]}"`);
    if (!str(ch.pinyin)) err(`${at}.pinyin is missing`);
    if (!str(ch.meaning)) err(`${at}.meaning is missing`);
    if (ch.strokes != null && !(Number.isInteger(ch.strokes) && ch.strokes > 0 && ch.strokes < 40)) err(`${at}.strokes must be a whole number`);
    if (ch.radical != null && !str(ch.radical)) err(`${at}.radical must be text`);
  });
}
if (c.mnemonic != null && !str(c.mnemonic)) err("mnemonic must be text");
if (c.funFact != null && !str(c.funFact)) err("funFact must be text");

/* ---------- phrases and sentences ---------- */
const phrases = c.phrases || [];
if (!Array.isArray(phrases) || phrases.length < 3 || phrases.length > 8) err("phrases must have 3 to 8 items");
phrases.forEach((p, i) => {
  const at = `phrases[${i}]`;
  if (!str(p.zh) || !str(p.pinyin) || !str(p.en)) err(`${at} needs zh, pinyin and en`);
  else if (!p.zh.includes(c.word)) warn(`${at} "${p.zh}" does not contain "${c.word}"`);
});
const sentences = c.sentences || [];
if (!Array.isArray(sentences) || sentences.length < 2 || sentences.length > 5) err("sentences must have 2 to 5 items");
sentences.forEach((s, i) => {
  const at = `sentences[${i}]`;
  if (!str(s.zh) || !str(s.pinyin) || !str(s.en)) { err(`${at} needs zh, pinyin and en`); return; }
  if (!s.zh.includes(c.word)) warn(`${at} does not contain "${c.word}"`);
  if (s.tiles != null) {
    if (!Array.isArray(s.tiles) || s.tiles.length < 2 || s.tiles.length > 8) err(`${at}.tiles must have 2 to 8 items`);
    else if (s.tiles.join("") !== s.zh.replace(/[，。！？、,.!?\s]/g, "")) err(`${at}.tiles must join to the sentence without punctuation`);
  } else {
    warn(`${at} has no tiles. The sentence game will split it into single characters.`);
  }
});

/* ---------- games ---------- */
const distractors = c.distractors || [];
if (!Array.isArray(distractors) || distractors.length < 3 || distractors.length > 8) err("distractors must have 3 to 8 items");
distractors.forEach((d, i) => {
  if (!str(d.zh) || !str(d.pinyin) || !str(d.en)) err(`distractors[${i}] needs zh, pinyin and en`);
  else if (d.zh === c.word) err(`distractors[${i}] must not be the target word`);
});

/* ---------- quiz ---------- */
const TYPES = new Set(["listen", "meaning", "pinyin", "picture", "fill", "char"]);
const quiz = c.quiz || [];
if (!Array.isArray(quiz) || quiz.length < 4 || quiz.length > 10) err("quiz must have 4 to 10 questions");
quiz.forEach((q, i) => {
  const at = `quiz[${i}]`;
  if (!TYPES.has(q.type)) err(`${at}.type must be one of: ${[...TYPES].join(", ")}`);
  if (!Array.isArray(q.choices) || q.choices.length < 2 || q.choices.length > 4 || !q.choices.every(str)) err(`${at}.choices must have 2 to 4 text items`);
  else if (new Set(q.choices).size !== q.choices.length) err(`${at}.choices has repeated items`);
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= (q.choices || []).length) err(`${at}.answer must be a valid zero-based index`);
  if (q.type === "listen" && !str(q.speak)) err(`${at}: listen questions need speak`);
  if (["meaning", "pinyin", "picture", "char"].includes(q.type) && !str(q.show)) err(`${at}: ${q.type} questions need show`);
  if (q.type === "fill" && !(str(q.show) && q.show.includes("___"))) err(`${at}: fill questions need show with ___`);
});
const answers = quiz.map((q) => q.answer);
if (quiz.length >= 4 && new Set(answers).size === 1) warn("every quiz answer has the same position. Mix them.");

/* ---------- sources ---------- */
const sources = c.sources || [];
if (!Array.isArray(sources) || !sources.length) warn("sources is empty. Cite the dictionary used to check the word.");
sources.forEach((s, i) => {
  if (!str(s.title) || !/^https:\/\//.test(s.url || "")) err(`sources[${i}] needs title and an https url`);
});

for (const w of warnings) console.warn("warn  " + w);
if (errors.length) {
  for (const e of errors) console.error("error " + e);
  process.exit(1);
}

/* ---------- assemble ---------- */
const safeJson = JSON.stringify(c, null, 1)
  .replace(/</g, "\\u003c")
  .replace(new RegExp("\\u2028", "g"), "\\u2028")
  .replace(new RegExp("\\u2029", "g"), "\\u2029");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const parts = {
  TITLE: esc(`${c.word} ${c.pinyin} · Learn a Chinese word`),
  CSS: tpl("theme.css"),
  CONTENT: safeJson,
  ENGINE: tpl("engine.js"),
};
let html = tpl("shell.html");
// split-and-join avoids "$" patterns in replace()
for (const [k, v] of Object.entries(parts)) html = html.split(`{{${k}}}`).join(v);

// Only the approved CDNs may be loaded.
const ALLOWED = ["https://cdn.jsdelivr.net/npm/", "https://fonts.googleapis.com/", "https://fonts.gstatic.com/"];
const urls = [...html.matchAll(/(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)/gi), ...html.matchAll(/["'](https:\/\/cdn\.[^"']+)["']/g)]
  .map((m) => m[1]);
const sourceUrls = new Set(sources.map((s) => s.url));
const bad = urls.filter((u) => !sourceUrls.has(u) && !ALLOWED.some((a) => u.startsWith(a) || u + "/" === a));
if (bad.length) {
  console.error("error: the page loads files from hosts that are not approved:");
  for (const u of bad) console.error("  " + u);
  process.exit(1);
}

const slug = (c.slug || c.pinyin).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "word";
const outPath = outArg ? resolve(outArg) : join(here, "..", "..", "..", "generated_output", `learn-chinese-word-${slug}.html`);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html);
console.log(`built ${outPath} (${(html.length / 1024).toFixed(0)} KB, ${warnings.length} warnings)`);
