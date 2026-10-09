# Report JSON specification

`scripts/build.mjs` checks every rule on this page. Colors are tokens: `c1` to
`c6`, `good`, `warn`, `risk`, `accent`, `ink-3`. Never write a hex color. A
`**word**` in text makes bold text.

```text
{ meta, tabs: [ { id, label, color?, sections: [ { heading, note?, blocks: [ … ] } ] } ] }
```

## meta

| Field | Required | Meaning |
| --- | --- | --- |
| `title` | yes | Page title. 2 to 6 words. |
| `eyebrow` | no | Small caps line above the title. |
| `standfirst` | yes | 2 to 3 sentences that give the answer. Put the verdict first. |
| `palette` | yes | `centience` (orange), `teal`, or `slate`. |
| `confidentiality` | yes | `public`, `internal`, or `client`. Shown in a chip. |
| `status` | no | `draft` or `final`. |
| `date` | no | `YYYY-MM-DD`. |
| `chips` | no | `[{ text, tone? }]` or `[{ text, href }]`. `tone`: `warn`, `good`, `risk`. A link must be `https`. |
| `notes` | no | List of strings shown in the footer. Put the alias key and data limits here. |
| `allowTerms` | no | Generic words the safety scan may skip. Do not use for real names. |

## tab and section

A report with 1 tab has no tab bar. Use 3 to 5 tabs for a longer report.

| Field | Meaning |
| --- | --- |
| `tab.id` | Lowercase kebab-case. Used in the URL `#id` and in `goto`. |
| `tab.label` | 1 to 3 words. |
| `section.heading` | A claim or a clear topic, 3 to 8 words. |
| `section.note` | One short line under the heading. |

## Text and structure blocks

| `type` | Fields |
| --- | --- |
| `text` | `paragraphs: [string]` |
| `kpis` | `items: [{ label, value, sub?, tone? }]`. Use 3 to 6. |
| `cards` | `items: [{ title, tag?, color?, stats: [{ label, value, pct? }], line?, goto?, gotoLabel? }]`. `pct` (0 to 100) draws a bar. `goto` is a tab id. Use 2 to 4 cards. |
| `table` | `caption?`, `columns: [{ key, label, kind? }]`, `rows: [{ key: value }]`. `kind`: `num` (right-aligned), `score` (0 to 5, colored). A cell `{ text, tone }` is a pill. |
| `callout` | `kind` (`note`, `warn`, `risk`, `good`), `title?`, `text`. |
| `findings` | `items: [{ title, text }]`. Numbered. Use 3 to 6. |
| `steps` | `items: [{ title, text?, code? }]`. `code` must hold no real names. |
| `grid` | `blocks: [...]`, `min?` (min column width in px, default 320). Puts blocks side by side. A grid cannot hold a grid. |

## Chart blocks (D3)

Every chart has `title?`, `hint?` (one line under the title), and `width?`
(drawing width in px; the default fits the column). Text in a chart is drawn
at this width and scales down.

| `type` | Fields | Use for |
| --- | --- | --- |
| `bars` | `items: [{ label, value, color? }]`, `unit?`, `max?`, `sort?` (`false` keeps the order), `labelWidth?` | Compare a few values |
| `stacked` | `categories: [..]`, `series: [{ name, values, color? }]`, `unit?` | Parts of a total, for each item |
| `donut` | `items: [{ label, value, color? }]`, `unit?`, `center?`, `centerSub?` | Parts of one whole (2 to 5 parts) |
| `line` | `x: [..]`, `series: [{ name, values, color? }]`, `unit?`, `min?`, `max?`, `height?` | A trend over time |
| `radar` | `axes: [..]`, `series: [{ name, values, color? }]`, `max?` (default 5) | Score profiles (3 to 8 axes) |
| `treemap` | `items: [{ label, value, group?, color? }]`, `unit?`, `height?` | Share of a total. `group` sets the color. |
| `flow` | `cols`, `rows?`, `nodes: [{ id, col, row, cs?, title, sub?, color? }]`, `edges: [[from, to]]`, `nodeHeight?` | How parts connect (14 blocks or fewer) |

Rules:

- Every `values` list has one value for each `x`, `axes`, or `categories` entry.
- Label things in the picture. Add a `hint` that says how to read the chart.
- Start a bar chart at 0. Use `max` when a score has a fixed top.
- Use 1 chart for 1 claim. Put the claim in the section heading.
- Pair two small charts in a `grid`. Put a wide `flow` alone.
- Chart labels, node titles, and hints are scanned for sensitive data like any text.

## Sharing

The built HTML holds this JSON in `<script type="application/json" id="report">`.

- Print it: `node scripts/build.mjs --extract report.html`
- Rebuild after a template change (the safety scan runs again):
  `node scripts/build.mjs report.html report.html --deny terms.txt`
