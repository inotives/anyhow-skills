# Safety rules: what a report must never show

A report is easy to forward. Treat every report as if a person outside the
team will read it. The report names **ideas, not systems**.

## Never put in a report

| Group | Examples |
| --- | --- |
| Production tables and schemas | `schema.table` names, table names, view names, database names |
| Columns and fields | Column names, field names, JSON keys, file layouts, primary keys |
| Credentials | Passwords, tokens, API keys, access keys, private keys, connection strings, secrets, `.env` values |
| Infrastructure | Cloud account ids, ARNs, bucket names, storage paths, host names, IP addresses, cluster names, workspace URLs |
| Real data | Rows, sample values, customer names, emails, phone numbers, national ids, record ids |
| Client identity | Client or product code names, when the report is not for that client |
| Queries and code | SQL, pipeline code, config files that use real names |
| Internal links | Links to private sheets, tickets, repos, or dashboards, unless the reader may open them |

## Use these instead

| Instead of | Write |
| --- | --- |
| `cash.txn_detail` | "the main transactions table" or **Table A** |
| `customer_id`, `created_at` | "the customer key", "the creation time" |
| `s3://client-prod/raw/` | "the landing zone" |
| a real client or app name | **Client 1**, **App 1**, or a role such as "the payments app" |
| a real vendor account | "the production account" |
| `SELECT … FROM …` | a sentence that says what the query does |
| a screenshot of a console | an SVG or D3 picture drawn from aliases |

Keep one alias for one thing, in the whole report. **App 1** is always the same app.

## Numbers

- Counts, sizes, scores, and dates are allowed. They are the point of a report.
- Round a number when its exact value could identify a client or a system
  ("about 40 tables", not "41 of 339 tables in the CASH schema").
- A number that comes from a real system and is marked confidential by the user
  needs the user's approval before it goes in.
- Mark made-up numbers with the word "illustrative".

## Before you write the JSON

1. Read the source. List every real name in it: tables, columns, schemas,
   apps, clients, accounts, hosts, people.
2. Map each real name to an alias. Keep this map **outside the report**: in
   your scratch folder, never in the JSON, the HTML, or a comment.
3. Write the report in aliases only. Never type a real name into the JSON,
   even if you plan to replace it later.
4. Write the real names, one for each line, into a deny-list file in your
   scratch folder: `terms.txt`. Give it to the build with `--deny terms.txt`.
5. Delete the map and the deny-list after the report is accepted. Do not commit
   them.

## What the build checks

The build scans **every string** in the report: titles, text, labels, chart
data, table cells, chip text, and link addresses. It stops with a `LEAK` line
for each hit. It writes no file until the report is clean.

| Group | Examples it finds |
| --- | --- |
| credential | AWS keys, private-key blocks, API tokens, JWTs, `password: …`, connection strings with a password, long random strings |
| infrastructure | ARNs, `s3://` style paths, account ids, IP addresses, cloud and vendor host names, `localhost` |
| data-identifier | `a.b.c` and `schema.table` names, `snake_case` names, column-style names (`user_id`, `created_at`), SQL statements |
| personal-data | Email addresses, national id numbers, phone numbers, UUIDs |
| deny-list | Any term in your `--deny` file, in any case |
| links | Any link that is not `https` (other links give a warning) |

**This is a safety net, not a proof.** Patterns cannot know your real names, so
the deny-list matters. A clean build does not replace a review. Before you give
the file to anyone:

- Read the whole report once, as the outside reader would.
- Search the HTML for every real name on your list. The command
  `grep -i -f terms.txt report.html` must print nothing.
- Check the tab titles, chart labels, and tooltips. They are text too.

## When the build flags a safe word

A generic term can look like an identifier (for example `data_lake`). Prefer a
plain-words rewrite ("data lake"). If you must keep it, add it to
`meta.allowTerms`. The build prints how many terms you allowed. Do not use
`allowTerms` to get past a real name.

## The file itself

- The page has `noindex` set and loads only fonts and D3 from fixed addresses.
- The page shows its confidentiality level (`public`, `internal`, or `client`)
  in a chip. Pick the level the reader group allows.
- Do not paste the HTML or the JSON into chat. Give the file path.
