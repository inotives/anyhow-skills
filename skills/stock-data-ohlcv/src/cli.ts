import { readFile } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";

const SKILL_ROOT = resolve(import.meta.dirname, "..");
const DB_PATH = resolve(process.env.OHLCV_DB_PATH ?? resolve(SKILL_ROOT, ".state/stock_data.duckdb"));
const SCHEMA_PATH = resolve(SKILL_ROOT, "schema/001_initial.sql");
const DEFAULT_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const CHART_URL = (process.env.OHLCV_CHART_URL ?? DEFAULT_CHART_URL).replace(/\/$/, "");
const SOURCE_LABEL = process.env.OHLCV_SOURCE_LABEL ?? "Yahoo Finance chart API";
const CHART_FILE = process.env.OHLCV_CHART_FILE;

type Args = Record<string, string | undefined>;
type OhlcvRow = {
  ticker: string;
  trading_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adj_close: number | null;
  volume: number;
  source: string;
};
type ChartPayload = {
  chart?: {
    error?: { description?: string | null } | null;
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{ open?: Array<number | null>; high?: Array<number | null>; low?: Array<number | null>; close?: Array<number | null>; volume?: Array<number | null> }>;
        adjclose?: Array<{ adjclose?: Array<number | null> }>;
      };
    } | null>;
  };
};

function option(args: string[], name: string): string | undefined {
  const index = args.findIndex((arg) => arg === name || arg.startsWith(`${name}=`));
  if (index < 0) return undefined;
  return args[index].includes("=") ? args[index].split("=").slice(1).join("=") : args[index + 1];
}

function parseArgs(args: string[]): Args {
  return {
    ticker: option(args, "--ticker"),
    date: option(args, "--date"),
    from: option(args, "--from"),
    to: option(args, "--to"),
  };
}

function normalizeTicker(value: string | undefined): string {
  const ticker = value?.trim().toUpperCase() ?? "";
  if (!/^[A-Z0-9.^_-]{1,20}$/.test(ticker)) throw new Error("Ticker must contain 1-20 letters, numbers, '.', '^', '_' or '-'.");
  return ticker;
}

function validateDate(value: string | undefined, name: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${name} must use YYYY-MM-DD.`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error(`${name} is not a real calendar date.`);
  return value;
}

function nextDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function requestedRange(args: Args): { from: string; to: string } {
  if (args.date && (args.from || args.to)) throw new Error("Use --date or --from/--to, not both.");
  const from = validateDate(args.date ?? args.from, args.date ? "--date" : "--from");
  const to = validateDate(args.date ?? args.to, args.date ? "--date" : "--to");
  if (from > to) throw new Error("--to cannot be earlier than --from.");
  return { from, to };
}

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function parseChartResponse(payload: ChartPayload, ticker: string, from: string, to: string, source = SOURCE_LABEL): OhlcvRow[] {
  const chart = payload.chart;
  if (!chart) throw new Error("Chart response did not contain chart data.");
  if (chart.error) throw new Error(chart.error.description ?? "Chart source returned an error.");
  const result = chart.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  if (!result || !quote || !Array.isArray(result.timestamp)) throw new Error("Chart response did not contain daily quote data.");
  const adjusted = result.indicators?.adjclose?.[0]?.adjclose ?? [];
  const rows: OhlcvRow[] = [];
  for (let index = 0; index < result.timestamp.length; index++) {
    const tradingDate = new Date(result.timestamp[index] * 1000).toISOString().slice(0, 10);
    if (tradingDate < from || tradingDate > to) continue;
    const open = quote.open?.[index];
    const high = quote.high?.[index];
    const low = quote.low?.[index];
    const close = quote.close?.[index];
    const volume = quote.volume?.[index];
    if (!finite(open) || !finite(high) || !finite(low) || !finite(close) || !finite(volume) || !Number.isSafeInteger(volume)) continue;
    rows.push({ ticker, trading_date: tradingDate, open, high, low, close, adj_close: finite(adjusted[index]) ? adjusted[index] : null, volume, source });
  }
  return rows;
}

async function openStore(): Promise<{ instance: DuckDBInstance; connection: DuckDBConnection }> {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const instance = await DuckDBInstance.create(DB_PATH);
  const connection = await instance.connect();
  await connection.run(await readFile(SCHEMA_PATH, "utf8"));
  return { instance, connection };
}

function closeStore(store: { instance: DuckDBInstance; connection: DuckDBConnection }): void {
  store.connection.disconnectSync();
  store.instance.closeSync();
}

async function upsertRows(connection: DuckDBConnection, rows: OhlcvRow[]): Promise<void> {
  await connection.run("BEGIN TRANSACTION");
  try {
    for (const row of rows) {
      await connection.run(`
        INSERT INTO ohlcv_daily (ticker, trading_date, open, high, low, close, adj_close, volume, source)
        VALUES ($ticker, CAST($trading_date AS DATE), $open, $high, $low, $close, $adj_close, $volume, $source)
        ON CONFLICT (ticker, trading_date) DO UPDATE SET
          open = excluded.open,
          high = excluded.high,
          low = excluded.low,
          close = excluded.close,
          adj_close = excluded.adj_close,
          volume = excluded.volume,
          source = excluded.source,
          fetched_at = now()`, row);
    }
    await connection.run("COMMIT");
  } catch (error) {
    await connection.run("ROLLBACK");
    throw error;
  }
}

async function fetchRows(ticker: string, from: string, to: string): Promise<OhlcvRow[]> {
  const period1 = Math.floor(Date.parse(`${from}T00:00:00Z`) / 1000);
  const period2 = Math.floor(Date.parse(`${nextDate(to)}T00:00:00Z`) / 1000);
  let payload: ChartPayload;
  if (CHART_FILE) {
    try { payload = JSON.parse(await readFile(CHART_FILE, "utf8")) as ChartPayload; }
    catch { throw new Error("OHLCV fixture file returned invalid JSON or could not be read."); }
  } else {
    const url = `${CHART_URL}/${encodeURIComponent(ticker)}?period1=${period1}&period2=${period2}&interval=1d&events=history&includeAdjustedClose=true`;
    const response = await fetch(url, { headers: { "user-agent": "stock-data-ohlcv/1.0" } });
    if (!response.ok) throw new Error(`OHLCV source returned HTTP ${response.status}.`);
    try { payload = await response.json() as ChartPayload; }
    catch { throw new Error("OHLCV source returned invalid JSON."); }
  }
  const rows = parseChartResponse(payload, ticker, from, to, SOURCE_LABEL);
  if (!rows.length) throw new Error(`No complete daily OHLCV row was returned for ${ticker} between ${from} and ${to}.`);
  return rows;
}

async function showRows(connection: DuckDBConnection, args: Args): Promise<void> {
  const ticker = normalizeTicker(args.ticker);
  const range = args.date || args.from || args.to ? requestedRange(args) : { from: "0000-01-01", to: "9999-12-31" };
  const { from, to } = range;
  const reader = await connection.runAndReadAll(`
    SELECT ticker, CAST(trading_date AS VARCHAR) AS trading_date, open, high, low, close, adj_close, volume, source, CAST(fetched_at AS VARCHAR) AS fetched_at
    FROM ohlcv_daily
    WHERE ticker = $ticker AND trading_date BETWEEN CAST($from AS DATE) AND CAST($to AS DATE)
    ORDER BY trading_date`, { ticker, from, to });
  console.log(JSON.stringify(reader.getRowObjectsJson(), null, 2));
}

function printHelp(): void {
  console.log(`Stock OHLCV CLI

Commands:
  init       Create the local DuckDB database and ohlcv_daily table.
  fetch      Fetch and upsert daily OHLCV rows from the chart source.
  show       Read locally stored rows without making a network request.
  help       Show this help.

Examples:
  npm run ohlcv -- fetch --ticker AAPL --date 2026-01-02
  npm run ohlcv -- fetch --ticker AAPL --from 2026-01-02 --to 2026-01-09
  npm run ohlcv -- show --ticker AAPL --from 2026-01-02 --to 2026-01-09

Database: ${DB_PATH}`);
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const command = argv[0] ?? "help";
  if (["help", "--help", "-h"].includes(command)) { printHelp(); return; }
  const store = await openStore();
  try {
    if (command === "init") { console.log(`Database ready: ${DB_PATH}`); return; }
    if (command === "show") { await showRows(store.connection, parseArgs(argv.slice(1))); return; }
    if (command !== "fetch") throw new Error("Usage: npm run ohlcv -- [init|fetch|show|help]");
    const args = parseArgs(argv.slice(1));
    const ticker = normalizeTicker(args.ticker);
    const { from, to } = requestedRange(args);
    const rows = await fetchRows(ticker, from, to);
    await upsertRows(store.connection, rows);
    console.log(`Stored ${rows.length} OHLCV row${rows.length === 1 ? "" : "s"} for ${ticker} (${from} to ${to}).`);
  } finally {
    closeStore(store);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
