---
name: stock-data-ohlcv
description: Retrieve daily stock OHLCV data for a requested ticker and date or date range, normally from Yahoo Finance's chart endpoint, and store it in the skill's local DuckDB database. Use this skill whenever a user asks to look up historical stock prices, open/high/low/close/volume data, download market candles, or persist ticker data locally, even if they do not name OHLCV or Yahoo Finance.
---

# Stock OHLCV data

Fetch daily market candles for a ticker and persist them locally. The default
source is Yahoo Finance's chart endpoint. The database lives at
`skills/stock-data-ohlcv/.state/stock_data.duckdb` and is ignored by Git.

## Requirements

- Node.js 20 or later.
- Run `npm install` once in this skill directory.
- Network access for `fetch`.
- The `@duckdb/node-api` package.

## Commands

Run commands from this directory, or use the package script from any directory:

```sh
npm run ohlcv -- init
npm run ohlcv -- fetch --ticker AAPL --date 2026-01-02
npm run ohlcv -- fetch --ticker AAPL --from 2026-01-02 --to 2026-01-09
npm run ohlcv -- show --ticker AAPL --from 2026-01-02 --to 2026-01-09
```

`--date` fetches one UTC calendar date. `--from` and `--to` fetch an inclusive
date range. `--to` cannot precede `--from`. The CLI rejects malformed dates and
tickers before making a network request.

## Stored data

The `ohlcv_daily` table has one row per `(ticker, trading_date)`:

```text
ticker, trading_date, open, high, low, close, adj_close, volume,
source, fetched_at
```

The primary key makes repeated fetches safe. A later fetch updates the same
date instead of creating a duplicate. Rows with missing OHLCV values are not
stored.

## Provenance and refresh behavior

- The default source is `https://query1.finance.yahoo.com/v8/finance/chart`.
- Set `OHLCV_CHART_URL` to a compatible chart endpoint for testing or a
  controlled source.
- Set `OHLCV_CHART_FILE` only for deterministic local tests with a saved JSON
  chart response. It bypasses the network and is not a production input.
- Set `OHLCV_DB_PATH` to use a temporary database in tests or another local
  location. The normal path remains `.state/stock_data.duckdb`.
- Each row records the source label and fetch timestamp.
- The fetch downloads data before opening the write transaction. A failed HTTP
  request, parse, or validation step leaves existing local rows unchanged.
- Yahoo Finance data is market data, not a guarantee of trade execution or
  settlement. Check exchange calendars and corporate actions before using it.

## Failure safety and limits

- Do not invent a candle when the source returns no row for the requested date.
- A weekend or market holiday can produce zero rows. Report that clearly.
- `adj_close` may differ from `close` because of corporate actions.
- This skill stores daily data only. It does not provide intraday candles,
  fundamentals, news, signals, or investment advice.
- Do not commit `.state/`, downloaded responses, credentials, or source dumps.

## Validation

From this directory:

```sh
npm test
npm run build
git diff --check
```

Tests use a local HTTP fixture. They do not depend on live Yahoo Finance data.
