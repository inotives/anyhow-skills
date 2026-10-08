import { readFile } from "node:fs/promises";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createInterface } from "node:readline/promises";

const SKILL_ROOT = resolve(import.meta.dirname, "..");
const DB_PATH = resolve(SKILL_ROOT, ".state/singapore_toto.sqlite3");
const CSV_PATH = resolve(SKILL_ROOT, ".state/ToTo.csv");
const SCHEMA_PATH = resolve(SKILL_ROOT, "schema/001_initial.sql");
const HISTORY_URL = process.env.TOTO_HISTORY_URL ?? "https://en.lottolyzer.com/history/singapore/toto/page/1/per-page/50/summary-view";
const ESTIMATION_DRAWS = 624; // approximately six years at two draws per week

type Draw = { draw: number; draw_date: string; numbers: number[]; additional_number: number | null };
type SqlRow = Record<string, string | number | null>;

function db(): DatabaseSync {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const database = new DatabaseSync(DB_PATH);
  database.exec(readFileSync(SCHEMA_PATH, "utf8"));
  return database;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; continue; }
    if (c === '"') { quoted = !quoted; continue; }
    if (c === "," && !quoted) { row.push(cell.trim()); cell = ""; continue; }
    if ((c === "\n" || c === "\r") && !quoted) { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; continue; }
    cell += c;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows;
}

function toInt(value: string | undefined): number | null { const n = Number(value); return value && Number.isFinite(n) ? n : null; }

function upsert(database: DatabaseSync, rows: Draw[]): number {
  const statement = database.prepare(`INSERT INTO toto_results
    (draw, draw_date, winning_number_1, winning_number_2, winning_number_3, winning_number_4, winning_number_5, winning_number_6, additional_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(draw) DO UPDATE SET draw_date=excluded.draw_date, winning_number_1=excluded.winning_number_1,
    winning_number_2=excluded.winning_number_2, winning_number_3=excluded.winning_number_3, winning_number_4=excluded.winning_number_4,
    winning_number_5=excluded.winning_number_5, winning_number_6=excluded.winning_number_6, additional_number=excluded.additional_number,
    updated_at=CURRENT_TIMESTAMP`);
  database.exec("BEGIN");
  try { for (const row of rows) statement.run(row.draw, row.draw_date, ...row.numbers, row.additional_number); database.exec("COMMIT"); }
  catch (error) { database.exec("ROLLBACK"); throw error; }
  return rows.length;
}

async function importCsv(database: DatabaseSync, path = CSV_PATH): Promise<number> {
  const rows = parseCsv(await readFile(path, "utf8"));
  const draws: Draw[] = [];
  for (const r of rows.slice(1)) {
    const draw = toInt(r[0]); const numbers = r.slice(2, 8).map(toInt);
    if (Number.isInteger(draw) && /^\d{4}-\d{2}-\d{2}$/.test(r[1] ?? "") && numbers.length === 6 && numbers.every((n): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 49)) {
      draws.push({ draw: draw as number, draw_date: r[1], numbers, additional_number: toInt(r[8]) });
    }
  }
  return upsert(database, draws);
}

function option(name: string, fallback: string): string {
  const index = process.argv.findIndex((arg) => arg === name || arg.startsWith(`${name}=`));
  if (index < 0) return fallback;
  return process.argv[index].includes("=") ? process.argv[index].split("=").slice(1).join("=") : process.argv[index + 1] ?? fallback;
}

function htmlDraws(html: string): Draw[] {
  const body = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  const draws: Draw[] = []; const re = /(\d{4})\s+(\d{4}-\d{2}-\d{2})\s+((?:[1-9]|[1-4]\d)(?:\s*,\s*(?:[1-9]|[1-4]\d)){5})\s+((?:[1-9]|[1-4]\d))/g;
  for (const match of body.matchAll(re)) { const numbers = match[3].split(",").map(Number); if (numbers.length === 6) draws.push({ draw: Number(match[1]), draw_date: match[2], numbers, additional_number: Number(match[4]) }); }
  return draws;
}

async function fetchLatest(database: DatabaseSync): Promise<number> {
  const response = await fetch(HISTORY_URL, { headers: { "user-agent": "singapore-toto-cli/1.0" } });
  if (!response.ok) throw new Error(`history site returned HTTP ${response.status}`);
  const draws = htmlDraws(await response.text());
  if (!draws.length) throw new Error("history site returned no parseable Toto draws");
  return upsert(database, draws);
}

async function ensureLatest(database: DatabaseSync): Promise<Draw | null> {
  let latest = localLatest(database);
  if (latest && latest.draw_date >= expectedLatestDate()) return latest;
  const imported = await fetchLatest(database);
  if (!imported) throw new Error("history site returned no draws to import");
  return localLatest(database);
}

function localLatest(database: DatabaseSync): Draw | null {
  const row = database.prepare("SELECT * FROM toto_results ORDER BY draw_date DESC LIMIT 1").get() as SqlRow | undefined;
  if (!row) return null;
  return { draw: Number(row.draw), draw_date: String(row.draw_date), numbers: [1,2,3,4,5,6].map((i) => Number(row[`winning_number_${i}`])), additional_number: row.additional_number == null ? null : Number(row.additional_number) };
}

function expectedLatestDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const date = new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00Z`); const weekday = get("weekday");
  if (Number(get("hour")) < 19 || (weekday !== "Mon" && weekday !== "Thu")) date.setUTCDate(date.getUTCDate() - 1);
  while (![1, 4].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function printDraw(draw: Draw | null): void { if (!draw) { console.log("No Toto results found."); return; } console.log(`Draw ${draw.draw} (${draw.draw_date})\nWinning: ${draw.numbers.map((n) => String(n).padStart(2, "0")).join(" ")}\nAdditional: ${draw.additional_number == null ? "—" : String(draw.additional_number).padStart(2, "0")}`); }

function printHelp(): void {
  console.log(`Singapore Toto CLI

Commands:
  init       Create the SQLite database and toto_results table.
  import     Import .state/ToTo.csv into SQLite.
             Use --path /path/to/file.csv for a different CSV.
  latest     Show the latest local result; refresh if the expected draw is missing.
  check      Alias for latest.
  refresh    Crawl Lottolyzer and upsert the available draw history.
  predict    Estimate six numbers using one or more statistical methods.
  help       Show this help.

Prediction:
  npm run toto -- predict --estimator_method frequency
  npm run toto -- predict --estimator_method recency,overdue,ensemble

Methods:
  frequency    Most common numbers in approximately six years of draws.
  recency      Exponentially weights newer draws more heavily.
  bayesian     Uses smoothed frequency estimates.
  overdue      Favors numbers absent for more draws.
  hot-cold     Combines occurrence frequency and time since appearance.
  pairs        Scores numbers by historical co-occurrence.
  balanced     Applies range and odd/even balance constraints.
  sum-range    Prefers tickets near a typical total-number sum.
  monte-carlo  Samples 10,000 candidate tickets and ranks their history score.
  ensemble     Combines frequency, recency, overdue, and pair scores.

Database: ${DB_PATH}
Estimation window: ${ESTIMATION_DRAWS} draws (~6 years).
All predictions are heuristics and cannot improve random lottery odds.`);
}

type Method = "frequency" | "recency" | "bayesian" | "overdue" | "hot-cold" | "pairs" | "balanced" | "sum-range" | "monte-carlo" | "ensemble";
const METHODS: Method[] = ["frequency", "recency", "bayesian", "overdue", "hot-cold", "pairs", "balanced", "sum-range", "monte-carlo", "ensemble"];

function history(database: DatabaseSync): number[][] {
  const rows = database.prepare(`SELECT winning_number_1, winning_number_2, winning_number_3, winning_number_4, winning_number_5, winning_number_6 FROM toto_results ORDER BY draw_date DESC LIMIT ${ESTIMATION_DRAWS}`).all() as SqlRow[];
  return rows.map((row) => [1, 2, 3, 4, 5, 6].map((i) => Number(row[`winning_number_${i}`])).filter((n) => n >= 1 && n <= 49));
}

function frequencies(draws: number[][]): number[] {
  const counts = Array(51).fill(0) as number[];
  for (const draw of draws) for (const n of draw) counts[n]++;
  return counts;
}

function choose(scores: number[], constraints = false): number[] {
  const candidates = Array.from({ length: 50 }, (_, i) => i + 1).sort((a, b) => scores[b] - scores[a] || a - b);
  if (!constraints) return candidates.slice(0, 6).sort((a, b) => a - b);
  const pick: number[] = [];
  for (const n of candidates) {
    const ranges = pick.filter((x) => Math.ceil(x / 10) === Math.ceil(n / 10)).length;
    if (ranges >= 2) continue;
    if (pick.length >= 3 && pick.filter((x) => x % 2 === 0).length === 3 && n % 2 === 0) continue;
    if (pick.length >= 3 && pick.filter((x) => x % 2 !== 0).length === 3 && n % 2 !== 0) continue;
    pick.push(n); if (pick.length === 6) break;
  }
  return pick.sort((a, b) => a - b);
}

function pairScores(draws: number[][]): number[] {
  const pairs = Array.from({ length: 51 }, () => Array(51).fill(0) as number[]);
  for (const draw of draws) for (const a of draw) for (const b of draw) if (a < b) { pairs[a][b]++; pairs[b][a]++; }
  return Array.from({ length: 51 }, (_, n) => pairs[n].reduce((sum, count) => sum + count, 0));
}

function estimate(draws: number[][], method: Method): number[] {
  const counts = frequencies(draws); const scores = Array(51).fill(0) as number[]; const pairs = method === "pairs" || method === "ensemble" ? pairScores(draws) : [];
  if (method === "frequency") for (let n = 1; n <= 50; n++) scores[n] = counts[n];
  if (method === "recency") for (let i = 0; i < draws.length; i++) for (const n of draws[i]) scores[n] += Math.pow(0.97, i);
  if (method === "bayesian") for (let n = 1; n <= 50; n++) scores[n] = (counts[n] + 1) / (draws.length + 2);
  if (method === "overdue") for (let n = 1; n <= 50; n++) scores[n] = draws.findIndex((draw) => draw.includes(n)) + 1 || draws.length + 1;
  if (method === "hot-cold") for (let n = 1; n <= 50; n++) scores[n] = counts[n] > 0 ? counts[n] * (1 + (draws.length - (draws.findIndex((draw) => draw.includes(n)) + 1)) / draws.length) : 0;
  if (method === "pairs") for (let n = 1; n <= 50; n++) scores[n] = pairs[n];
  if (["balanced", "sum-range"].includes(method)) for (let n = 1; n <= 50; n++) scores[n] = counts[n];
  if (method === "ensemble") {
    const recency = Array(51).fill(0) as number[]; const overdue = Array(51).fill(draws.length + 1) as number[];
    for (let i = 0; i < draws.length; i++) for (const n of draws[i]) { recency[n] += Math.pow(0.97, i); overdue[n] = Math.min(overdue[n], i + 1); }
    for (let n = 1; n <= 50; n++) scores[n] = counts[n] / Math.max(...counts) * 0.35 + recency[n] / Math.max(...recency) * 0.25 + overdue[n] / Math.max(...overdue) * 0.15 + pairs[n] / Math.max(...pairs) * 0.25;
  }
  if (method === "monte-carlo") {
    let best: number[] = []; let bestScore = -1;
    for (let trial = 0; trial < 10000; trial++) { const ticket = Array.from({ length: 50 }, (_, i) => i + 1).sort(() => Math.random() - 0.5).slice(0, 6); const score = ticket.reduce((sum, n) => sum + counts[n], 0); if (score > bestScore) { bestScore = score; best = ticket; } }
    return best.sort((a, b) => a - b);
  }
  if (method === "balanced") return choose(scores, true);
  if (method === "sum-range") {
    const target = 150; const candidates = Array.from({ length: 50 }, (_, i) => i + 1).sort((a, b) => scores[b] - scores[a] || a - b); const pick: number[] = [];
    while (pick.length < 6) pick.push(candidates.find((n) => !pick.includes(n) && Math.abs(pick.reduce((s, x) => s + x, 0) + n - target) < Math.abs(pick.reduce((s, x) => s + x, 0) - target)) ?? candidates.find((n) => !pick.includes(n))!);
    return pick.sort((a, b) => a - b);
  }
  return choose(scores);
}

function predict(database: DatabaseSync, method: Method): void {
  const draws = history(database);
  if (!draws.length) throw new Error("No historical Toto draws found. Import data or run refresh first.");
  const pick = estimate(draws, method);
  console.log(`Estimated next numbers (${method}): ${pick.map((n) => String(n).padStart(2, "0")).join(" ")}`);
  console.log(`Based on ${draws.length} historical draws; this cannot improve random lottery odds.`);
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "latest";
  if (["help", "--help", "-h"].includes(command)) { printHelp(); return; }
  if (command !== "init" && !existsSync(DB_PATH)) {
    const readline = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await readline.question(`WARNING: database not found at ${DB_PATH}. Initialize an empty database now? You must import CSV data or run refresh afterward. [y/N] `);
    readline.close();
    if (!/^y(es)?$/i.test(answer.trim())) { console.log("Cancelled. Run `npm run toto -- init` when ready."); return; }
  }
  const database = db();
  if (command === "init") { console.log(`Database ready: ${DB_PATH}`); return; }
  if (command === "import") { const path = option("--path", CSV_PATH); console.log(`Imported ${await importCsv(database, path)} rows from ${path}`); return; }
  if (command === "refresh") {
    console.log(`Crawled and stored ${await fetchLatest(database)} draws from Lottolyzer.`);
    console.log("Latest result:");
    printDraw(localLatest(database));
    return;
  }
  if (command === "predict") {
    const flagIndex = process.argv.findIndex((arg) => arg === "--estimator_method" || arg.startsWith("--estimator_method="));
    const flag = flagIndex < 0 ? "frequency" : process.argv[flagIndex].includes("=") ? process.argv[flagIndex].split("=")[1] : process.argv[flagIndex + 1];
    const methods = (flag || "frequency").split(",").map((value) => value.trim()).filter(Boolean) as Method[];
    const invalid = methods.filter((method) => !METHODS.includes(method));
    if (invalid.length) throw new Error(`Unknown estimator_method: ${invalid.join(", ")}. Choose: ${METHODS.join(", ")}`);
    methods.forEach((method, index) => { if (index) console.log(""); predict(database, method); });
    return;
  }
  if (!["latest", "check"].includes(command)) throw new Error("Usage: npm run toto -- [init|import|refresh|latest|check|predict]");
  let latest = localLatest(database);
  if (!latest || latest.draw_date < expectedLatestDate()) { try { latest = await ensureLatest(database); } catch (error) { if (!latest) throw error; console.error(`Could not refresh results: ${(error as Error).message}`); } }
  printDraw(latest);
}

main().catch((error) => { console.error(`Error: ${(error as Error).message}`); process.exitCode = 1; });
