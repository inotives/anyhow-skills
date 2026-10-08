---
name: singapore-toto
description: Use this skill when the user asks to check Singapore Toto results, refresh local Toto history, import Toto CSV data, or estimate numbers using historical Singapore Toto draws.
---

# Singapore Toto Skill

Use the TypeScript CLI in this repository to maintain local Singapore Toto
results and generate heuristic number estimates.

## Setup

Run once after cloning or changing dependencies:

```sh
npm install
npm run build
```

The SQLite database is stored at:

```text
.state/singapore_toto.sqlite3
```

The default historical CSV is:

```text
.state/ToTo.csv
```

The database and imported history are local runtime state. Do not commit the
database, CSV history, credentials, or generated dependencies.

The refresh source is Lottolyzer:

```text
https://en.lottolyzer.com/history/singapore/toto/page/1/per-page/50/summary-view
```

This is the source provenance for refreshed draw history. To reset local
state, remove `.state/singapore_toto.sqlite3` and run `npm run toto -- init`;
then import a CSV or run `refresh` again.

`init` creates the database from `schema/001_initial.sql`. `import` and
`refresh` upsert draws inside a transaction; a failed refresh leaves the
existing database unchanged. `latest`/`check` may use the latest local draw
when an online refresh fails, and reports that it is local data.

If a command other than `init` is run before the database exists, the CLI warns
that initialization creates an empty database. Answer `y` to continue, then
import the CSV or run `refresh`; answer `n` to cancel safely.

## Import historical CSV data

Import the default CSV with:

```sh
npm run import
```

For a CSV saved elsewhere, provide its path:

```sh
npm run toto -- import --path /path/to/ToTo.csv
```

Historical Toto data can be downloaded from:

```text
https://en.lottolyzer.com/history/singapore/toto/page/1/per-page/50/summary-view
```

The import creates `toto_results` if it does not exist and upserts existing
draws safely.

## Update the latest result before estimating

Always refresh the local database before running an estimator:

```sh
npm run toto -- refresh
```

`refresh` crawls the Lottolyzer history page, stores the available draws, and
prints the latest draw and date. Then run the estimator:

```sh
npm run toto -- predict --estimator_method ensemble
```

The normal result command also checks freshness automatically:

```sh
npm run latest
```

Results are expected after 7pm Singapore time on Mondays and Thursdays. If
the expected draw is missing, `latest` attempts the same online refresh.

If the online site is unavailable, use the most recent local result and retry
the refresh later. Do not present stale data as the latest draw without saying
that it came from the local database.

## Estimator methods

The estimator window is 624 draws, approximately six years:

- `frequency`: most common numbers.
- `recency`: weights newer draws more heavily.
- `bayesian`: applies frequency smoothing.
- `overdue`: favors numbers absent for more draws.
- `hot-cold`: combines frequency and time since appearance.
- `pairs`: uses historical number co-occurrence.
- `balanced`: applies range and odd/even constraints.
- `sum-range`: favors tickets near a typical total-number sum.
- `monte-carlo`: samples 10,000 candidate tickets.
- `ensemble`: combines frequency, recency, overdue, and pair scores.

Run one method:

```sh
npm run toto -- predict --estimator_method recency
```

Run several methods:

```sh
npm run toto -- predict --estimator_method frequency,recency,ensemble
```

Predictions are statistical selection heuristics. Singapore Toto draws are
random, so these methods cannot improve the mathematical odds of a ticket.

Privacy: the CLI sends requests only to the documented Lottolyzer source during
`refresh` or an automatic `latest` refresh. It does not upload local CSV files
or the SQLite database. Predictions are descriptive heuristics, not forecasts,
and cannot improve random-lottery odds.

## Useful commands

```sh
npm run toto -- help
npm run toto -- init
npm run toto -- import
npm run toto -- latest
npm run toto -- check
npm run toto -- refresh
npm run toto -- predict --estimator_method ensemble
```
