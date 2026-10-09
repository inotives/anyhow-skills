---
name: html-report-d3
description: Use this skill when the user wants a shareable HTML report with tabs, tables, and D3 charts or SVG diagrams, such as an evaluation, a findings report, a data landscape, or a project summary. The report is sanitized: it names no production tables, columns, credentials, or accounts. Output is one HTML file.
status: experimental
---

# HTML Report (D3 + SVG)

Make one report page that a reader can scan in 2 minutes: a verdict at the top,
tabs for detail, tables, charts, and diagrams. It follows the report outline
used in the team's earlier reports: masthead with chips, sticky tabs, cards,
panels, callouts, findings, and a light/dark toggle.

You do not write HTML. You write the report as JSON. A build script checks it,
**scans it for sensitive data**, and puts it inside a fixed template.

## Safety first

A report gets forwarded. **It names ideas, not systems.** Never show:

- production table, view, schema, or database names;
- column or field names, file layouts, SQL, or code that uses real names;
- credentials, keys, tokens, connection strings, account ids, hosts, bucket
  names, or IP addresses;
- real rows, customer or client names, emails, phone numbers, or record ids.

Use aliases (**Table A**, **App 1**, "the payments app") and plain words. The
build scans every string and refuses to write the file if it finds a leak. The
scan is a net, not a proof. Read `reference/safety-rules.md` before you write.

## Output rule: one HTML file

The deliverable is **one `.html` file and nothing else**.

- The design, code, and content (as JSON) are inside it.
- Only D3 (pinned 7.9.0, cdnjs) and web fonts load from the network. Build with
  `--inline` to embed D3 for an offline file (about 320 KB). Fonts then fall
  back to system fonts.
- Do not create a separate `.json`, `.css`, or `.js` file for the user.
- Do not paste the HTML or the JSON into chat. Give the file path.

## When to use

- An evaluation or comparison (options, scores, costs, risks).
- A findings or status report with numbers and a recommendation.
- A landscape of systems, data flows, or readiness, drawn from aliases.

Do not use it for a slide talk (use `interactive-deck-reveal`), a one-screen
explainer (use `interactive-learning-html`), or a runbook that needs real
commands and names.

## Requirements

- Node.js 18 or later. No `npm install`.
- A web browser to check the result.
- Network access only for `--inline` at build time.

## Files

```text
template/shell.html    page frame (do not edit)
template/theme.css     3 palettes, light and dark, components (do not edit)
template/engine.js     tabs, blocks, D3 charts, theme toggle (do not edit)
scripts/build.mjs      checks the JSON, scans for leaks, writes the one HTML file
reference/content-spec.md   every field of the report JSON
reference/safety-rules.md   what never goes in, what to use instead, what the scan finds
examples/platform-options-review.html   example: 4 tabs, 7 charts, aliases only
```

## Workflow

1. Define the reader, the decision they must make, and the one-sentence answer.
2. Read the source material. **List every real name in it** (tables, columns,
   schemas, apps, clients, accounts, hosts, people). Follow
   `reference/safety-rules.md`, "Before you write the JSON".
3. Map each real name to an alias. Keep the map and a deny-list file `terms.txt`
   (one real name per line) in the scratch folder. They never go in the report.
4. Plan the page: verdict first, then 3 to 5 tabs. Pick a palette and the
   `confidentiality` level.
5. Write the JSON in aliases only. Follow `reference/content-spec.md`. Pipe it in:

   ```sh
   node scripts/build.mjs - <topic>-report.html --deny terms.txt <<'JSON'
   { "meta": { ... }, "tabs": [ ... ] }
   JSON
   ```

6. Fix every `ERROR` and every `LEAK` line. Rewrite the text. Do not hide a real
   name with `allowTerms`. Build again until it is clean.
7. Open the file and do the checks in "Acceptance checks".
8. Run `grep -i -f terms.txt <topic>-report.html`. It must print nothing. Then
   delete `terms.txt` and the alias map. Do not commit them.
9. Give the user the file path and the confidentiality level you used.

## Edit a report

```sh
node scripts/build.mjs --extract report.html                       # print the JSON
node scripts/build.mjs report.html report.html --deny terms.txt    # rebuild in place
```

A rebuild applies template updates and runs the safety scan again.

## Choose a palette

| Palette | Use for |
| --- | --- |
| `centience` | Team reports. Warm orange accent. Default. |
| `teal` | Data and platform reports. |
| `slate` | Formal and executive reports. |

The reader can switch Auto, Light, and Dark with the button at the top right.

## Page design

- **Masthead:** a title, a 2 to 3 sentence standfirst that gives the answer, and
  chips for scope, status, and limits. Add a `draft` chip when it is not approved.
- **Tabs:** `Summary` first. It holds cards, a callout, and 1 or 2 charts. Detail
  goes in later tabs. Do not use more than 5 tabs.
- **Sections:** the heading is a claim. One chart for one claim.
- **Choose the block:**

  | Need | Block |
  | --- | --- |
  | The verdict for each option | `cards` |
  | Many criteria, exact values | `table` with `score` columns |
  | Compare a few values | `bars` |
  | Parts of a total, for each item | `stacked` |
  | Parts of one whole | `donut` |
  | A trend | `line` |
  | A score profile | `radar` |
  | Share of a total | `treemap` |
  | How parts connect | `flow` |
  | A warning, a limit, a caveat | `callout` |
  | 3 to 6 take-aways | `findings` |
  | An action plan | `steps` |

- **Color:** tokens only. `good`, `warn`, `risk` mean status and nothing else.
  Pair color with a word so a color-blind reader can follow.
- Mark every figure you did not check, and every made-up figure
  ("illustrative"). Put data limits in `meta.notes`.

## Writing rules

- Sentences of 30 words or fewer. Build warns above 30.
- Put the answer first. Use plain words and the active voice.
- One name for one thing. Keep each alias fixed in the whole report.
- State facts you checked. Do not invent data, names, or sources.

## Acceptance checks

- `build.mjs` prints no `ERROR`, no `LEAK`, and no warning you cannot explain.
- The report holds no real table, column, schema, account, host, or client name.
  The `grep -f terms.txt` check prints nothing.
- Every tab opens. Cards with a button jump to the right tab.
- Hover a chart: the tooltip shows. Hover a `flow` block: its links stay lit.
- Switch Auto, Light, and Dark. Text and charts stay readable.
- Resize to 400 px wide. Tables scroll inside their box. The page does not scroll sideways.
- The build output is one HTML file.

## Limits

- The safety scan is pattern-based. It cannot know a real name unless it is in
  `--deny`. A clean build does not replace a human read.
- No map, network graph, or Sankey chart. Use `flow` or a custom diagram in a
  new change.
- A treemap is two levels deep at most. A radar suits 3 to 8 axes.
- PDF export is untested. The print style shows all tabs, but charts were not checked in print.
- Web fonts need network. Without it, system fonts show.
