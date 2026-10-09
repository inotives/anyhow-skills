# D3 widgets

Every widget has this shape:

```html
<div class="wd" data-wd="bars">
  <script type="application/json">{ … }</script>
</div>
```

`build.mjs` checks the JSON. Colors are tokens: `accent`, `s1` … `s5`,
`good`, `warn`, `risk`. Never write a hex color.

Common fields:

| Field | Meaning |
| --- | --- |
| `w`, `h` | Drawing size in px. `w` is 1168 for full width, about 600 in a `split`. Text is in px at this size. |
| `label` | Screen-reader text for the whole drawing. Always set it. |
| `at` (on an item) | The step where the item shows. Leave it out to show the item when the slide opens, one after another. |

Use `at` values from 1 up to the slide's `data-steps`.

## flow

Blocks on a grid, joined by arrows. Flow dots move along an arrow when it shows.

```json
{ "cols": 5, "rows": 1, "h": 250, "nh": 120,
  "nodes": [ { "id": "a", "col": 0, "row": 0, "cs": 1, "rs": 1,
               "title": "Idea", "sub": "Someone asks", "icon": "💡", "color": "s1", "at": 1 } ],
  "edges": [ ["a", "b"], ["b", "c", { "label": "weekly", "at": 3 }] ] }
```

- `cols` is required. `rows` defaults to 1.
- `col` and `row` count from 0. Decimals are allowed, such as `row: 0.5`.
- `title`: 1 to 3 words. `sub` (one line) or `lines` (up to 2 lines). Long text
  shrinks to fit the block. Keep titles under 16 characters.
- An edge shows at its own `at`, or at the `at` of the block it points to.
- Use 12 blocks or fewer. Read left to right.

## bars

Horizontal bars that grow.

```json
{ "w": 620, "fmt": "{v} days", "lw": 190, "rh": 80, "max": 45,
  "data": [ { "label": "Weekly train", "value": 7, "color": "good", "at": 3 } ] }
```

- `fmt` turns a value into text. `{v}` is the value.
- `lw` is the label width. `rh` is the row height. `max` sets the full-bar value.
- Sort bars from largest to smallest, or in time order.

## donut

Parts of a whole. Values add up to the whole.

```json
{ "h": 320, "center": "72%", "sub": "on time", "unit": "%",
  "data": [ { "label": "On time", "value": 72, "color": "good", "at": 1 },
            { "label": "Late", "value": 28, "color": "risk", "at": 2 } ] }
```

Use 2 to 5 parts. Put the key part first.

## line

A trend over categories. Lines draw in.

```json
{ "w": 620, "h": 330, "x": ["Q1", "Q2", "Q3", "Q4"], "min": 0, "max": 40,
  "series": [ { "name": "After", "values": [30, 22, 14, 9], "color": "good", "at": 2 } ] }
```

- Each series has one value for each `x`.
- Use 1 to 3 series. The series name labels the line end.

## timeline

Events on a line. Labels alternate above and below.

```json
{ "h": 250, "items": [ { "title": "Week 1", "sub": "Agree the rules", "color": "s1", "at": 1 } ] }
```

Use 3 to 6 items. Titles and subs shrink to 210 px.

## Not enough?

Use custom inline SVG (see `SKILL.md`), or write a `<script>` at the end of the
slide that calls `d3` (it is loaded). Keep the result inside the slide's
`<section>`. Use palette tokens for color.
