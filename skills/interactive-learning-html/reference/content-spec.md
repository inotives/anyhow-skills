# content.json specification

`scripts/build.mjs` checks every rule on this page. Colors are tokens:
`k1` … `k9`, `hl`, `accent`. A `**word**` in `tagline` makes bold text.

```text
{ meta, views: [ diagram | catalog | ideas, … ] }
```

## meta

| Field | Required | Meaning |
| --- | --- | --- |
| `title` | yes | Page title. 2 to 5 words. |
| `tagline` | no | One short line under the title. |
| `palette` | yes | `graphite`, `ocean`, `forest`, `ember`, or `dusk`. |
| `speakLang` | no | Voice language for 🔊 Listen, such as `zh-CN`. Default `en-US`. |
| `sources` | no | List of `{ label, url?, note? }`. Shown in the ⓘ popup. |
| `notes` | no | List of strings. Use for unchecked facts and name changes. |

## view (all types)

| Field | Meaning |
| --- | --- |
| `id` | Unique short id. |
| `type` | `diagram`, `catalog`, `ideas`, or `trace`. |
| `speak` | `diagram` and `catalog`: `true` adds a 🔊 Listen button that reads `glyph` (or the item `name`). |
| `tab` | Tab label. 1 to 3 words. |
| `icon` | One emoji for the tab. |

## diagram

| Field | Meaning |
| --- | --- |
| `label` | Screen-reader text for the whole diagram. |
| `intro` | One sentence shown before Play. |
| `grid` | Layout. See below. |
| `nodes` | The blocks. |
| `edges` | Arrows: `[["from","to"], …]`. Data flows from → to. |
| `ticks` | Optional dashed links with no arrow: `[["a","b"], …]`. |
| `zones` | Optional dashed areas that group blocks. |
| `heads` | Optional column labels. |
| `people` | Optional roles: `{ id, name, color }`. Shows "Who uses what?". |
| `stages` | The journey. 3 to 8 items. |

### grid

```json
{ "w": 1100, "h": 500, "pad": 20, "gx": 40, "gy": 14,
  "cols": [1, 1.5, 1.5, 1], "rows": [1, 1, 1, 1] }
```

`cols` and `rows` are size ratios. A block at `col: 1, row: 2` sits in the
second column and the third row (counting from 0). Use decimals for
in-between positions, such as `row: 2.5`.

Row tips:
- Put a top band (for example governance) in row 0.
- Put a row for column labels (`heads`) after it.
- Put a bottom band (for example storage) in the last row.

### node

| Field | Meaning |
| --- | --- |
| `id` | Unique id. |
| `kind` | `box` (default), `tall` (centered, for large blocks), `band` (wide strip). |
| `col`, `row` | Grid position. |
| `cs`, `rs` | Column span and row span. Default 1. |
| `color` | Color token. |
| `icon` | One emoji. |
| `glyph` | Optional. Large text shown in place of the icon, such as a Chinese character or word. |
| `speak` | Optional. Text to read aloud instead of `glyph`. |
| `title` | Block name. 1 to 3 words. |
| `sub` | Short line under the title (`box`, `band`). Up to 24 characters in a `box`. |
| `lines` | Up to 2 short lines (`tall`). |
| `layer` | Group name shown in the detail card. |
| `does` | What it does. One or two short sentences. |
| `example` | One concrete example. |
| `who` | List of `people` ids that use this block. |

### stage

```json
{ "name": "Ingest", "headline": "Data walks in.",
  "text": "Sources make raw data. Connect pulls it in.",
  "nodes": ["src", "connect"] }
```

An arrow lights up when both of its blocks are in `nodes`.

### zone and head

```json
{ "col": 0, "row": 1, "cs": 2, "rs": 5, "color": "k2",
  "title": "CONTROL PLANE", "sub": "The brain.", "align": "end" }
{ "col": 1, "row": 1, "num": "1", "text": "INGEST" }
```

## catalog

```json
{ "layers": [ { "id": "data", "name": "Data", "color": "k1", "icon": "🔌" } ],
  "items":  [ { "layer": "data", "name": "Tool", "pinyin": "(optional small line)", "does": "…", "more": "…" } ],
  "note": "One line under the columns." }
```

Use 4 to 8 layers. Keep each layer to 6 items or fewer.

## ideas

```json
{ "cards": [ { "icon": "🧱", "title": "Idea", "text": "…", "color": "k3",
               "button": "See it →", "go": { "view": "journey", "node": "lake" } } ] }
```

Use 3 to 5 cards. `go` is optional. It opens another view. Use `node` to
select a block or `stage` (a number from 0) to show a stage.

## trace

A writing practice grid. The reader draws with a mouse, a finger, or a pen.
Round 1 shows a clear guide. Round 2 shows a light guide. Round 3 has no guide.

```json
{ "type": "trace", "id": "write", "tab": "Write it", "icon": "✍️", "repeat": 3,
  "items": [ { "text": "树", "pinyin": "shù", "meaning": "tree", "note": "9 strokes" } ] }
```

Use 1 to 8 items. Each `text` has 1 to 3 characters. `repeat` is 1 to 5.

## Sharing

The built HTML holds this JSON in `<script type="application/json" id="content">`.
Send the HTML file only. There is no separate JSON file to keep.

- Rebuild after a template change: `node scripts/build.mjs page.html page.html`
- Print the JSON: `node scripts/build.mjs --extract page.html`
