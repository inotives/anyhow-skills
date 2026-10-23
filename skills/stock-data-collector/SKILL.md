---
name: stock-data-collector
description: Collect per-ticker market data into the skill's local SQLite database - daily stock OHLCV candles (normally from Yahoo Finance's chart endpoint) and market sentiment analyses with a positive/neutral/negative level and a 0-100 score. Use this skill whenever a user asks to look up or store historical stock prices, open/high/low/close/volume data, or market candles, or to analyze, record, or review market sentiment for a stock ticker, even if they do not name OHLCV, sentiment, or Yahoo Finance.
---

# Stock data collector

Collect market data for stock tickers and persist it locally:

- Daily market candles (OHLCV), fetched from Yahoo Finance's chart endpoint by
  default.
- Market sentiment analyses that you write, stored per ticker and date.

The database lives at `data/stock_data.sqlite3` in this skill folder and is
ignored by Git. Every table uses the same normalized, uppercase ticker, so
collected data can be joined on `ticker` (and on date).

## Requirements

- Python 3.9 or later and its standard library, which macOS and most Linux
  distributions already ship as `python3`. There is nothing to install or
  build.
- Network access to the chart source for `fetch`.

## Commands

Run commands from this skill folder:

```sh
python3 scripts/stock_data.py init
python3 scripts/stock_data.py fetch --ticker AAPL --date 2026-01-02
python3 scripts/stock_data.py fetch --ticker AAPL --from 2026-01-02 --to 2026-01-09
python3 scripts/stock_data.py show --ticker AAPL --from 2026-01-02 --to 2026-01-09
```

`--date` fetches one UTC calendar date. `--from` and `--to` fetch an inclusive
date range. `--to` cannot precede `--from`. The CLI rejects malformed dates and
tickers before making a network request. `show` prints stored rows as JSON and
never makes a network request.

## Stored data

The `ohlcv_daily` table has one row per `(ticker, trading_date)`:

```text
ticker, trading_date, open, high, low, close, adj_close, volume,
source, fetched_at
```

`trading_date` is stored as `YYYY-MM-DD` text and `fetched_at` as a UTC
`YYYY-MM-DD HH:MM:SS` timestamp. The primary key makes repeated fetches safe. A
later fetch updates the same date instead of creating a duplicate. Rows with
missing OHLCV values are not stored.

## Market sentiment

The CLI does not analyze sentiment itself. You write the analysis, then store
it with `add-sentiment`:

1. Gather recent news about the ticker from established news outlets only, such
   as Reuters, Bloomberg, The Wall Street Journal, Financial Times or CNBC. Do
   not base sentiment on small news sites, blogs, forums, social media, press
   releases or content aggregators. Note the article URL for each piece of
   evidence.
2. Write the full analysis from those articles: the main drivers, the evidence
   for each, risks and counterpoints, and the time frame it covers. Do not
   invent facts or sources.
3. Pick a level and a score from 0 (most negative) to 100 (most positive). The
   score must fall inside its level's band:

   | Level | Score |
   | --- | --- |
   | `negative` | 0-39 |
   | `neutral` | 40-60 |
   | `positive` | 61-100 |

4. Store it. Pass short text with `--analysis`, or longer text with
   `--analysis-file path` (`-` reads standard input). Pass `--source` once for
   each article URL. At least one is required:

```sh
python3 scripts/stock_data.py add-sentiment --ticker AAPL --level positive --score 72 \
  --analysis-file analysis.md \
  --source https://www.reuters.com/technology/... \
  --source https://www.wsj.com/tech/...
python3 scripts/stock_data.py show-sentiment --ticker AAPL --from 2026-01-02 --to 2026-01-09
```

### Allowed news sources

`references/news-sources.json` maps each allowed news domain to its publisher
name. `add-sentiment` rejects any source URL whose domain (or subdomain) is not
on that list, and stores each source with its publisher. To allow another
established outlet, add its domain and publisher name to the file. Do not add
small or unvetted sites to get past the check.

`--date` defaults to today's UTC date, the date the analysis was created. The
`market_sentiment` table keeps one analysis per `(ticker, sentiment_date)`.
Storing another one for the same ticker and date replaces it.

```text
ticker, sentiment_date, level, score, analysis, sources, created_at
```

`sources` is a JSON array such as
`[{"publisher": "Reuters", "url": "https://www.reuters.com/..."}]`. To list
sentiment by publisher:

```sql
SELECT s.ticker, s.sentiment_date, json_extract(src.value, '$.publisher') AS publisher
FROM market_sentiment s, json_each(s.sources) src;
```

To compare sentiment with prices, join on ticker and date:

```sql
SELECT o.ticker, o.trading_date, o.close, s.level, s.score
FROM ohlcv_daily o
JOIN market_sentiment s ON s.ticker = o.ticker AND s.sentiment_date = o.trading_date;
```

Sentiment created on a weekend or market holiday has no matching candle for
that date.

Sentiment is an interpretation of public information, not investment advice
or a price forecast. Say so when you present it.

## Provenance and refresh behavior

- The default source is `https://query1.finance.yahoo.com/v8/finance/chart`.
- Set `OHLCV_CHART_URL` to a compatible chart endpoint for testing or a
  controlled source.
- Set `OHLCV_CHART_FILE` only for deterministic local tests with a saved JSON
  chart response. It bypasses the network and is not a production input.
- Set `OHLCV_DB_PATH` to use a temporary database in tests or another local
  location. The normal path remains `data/stock_data.sqlite3`.
- Each row records the source label and fetch timestamp.
- The fetch downloads data before opening the write transaction. A failed HTTP
  request, parse, or validation step leaves existing local rows unchanged.
- Yahoo Finance data is market data, not a guarantee of trade execution or
  settlement. Check exchange calendars and corporate actions before using it.
- If a fetch fails with `CERTIFICATE_VERIFY_FAILED` on a network that inspects
  HTTPS traffic, set `SSL_CERT_FILE` to a CA bundle that includes that
  network's root certificate instead of disabling verification.

## Failure safety and limits

- Do not invent a candle when the source returns no row for the requested date.
- A weekend or market holiday can produce zero rows. Report that clearly.
- `adj_close` may differ from `close` because of corporate actions.
- This skill stores daily candles only. It does not provide intraday candles,
  fundamentals, news, signals, or investment advice.
- Do not commit `data/`, downloaded responses, credentials, or source dumps.

## Validation

From this skill folder:

```sh
python3 -m unittest discover -s tests
git diff --check
```

Tests use a saved chart fixture and a local HTTP server. They do not depend on
live Yahoo Finance data.
