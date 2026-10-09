# Slide patterns

Copy a pattern. Change the text. The template wraps each `<section>` in the
canvas, adds the footer, and sets the background from `data-bg`.

The first line of the input is the deck comment:

```html
<!--deck {"title":"Deck title","palette":"teal","footer":"Team · Topic"} -->
```

## 1. Title (brand)

```html
<section data-bg="brand" data-layout="title-slide">
  <div class="eyebrow">Team · Date</div>
  <h1>The main claim in one line</h1>
  <p class="lead">One sentence that says why it matters.</p>
</section>
```

## 2. Path with steps (flow + captions)

```html
<section data-steps="2">
  <div class="eyebrow">1 of 4 · The path</div>
  <h1>One change travels two stages</h1>
  <div class="wd" data-wd="flow"><script type="application/json">
    { "cols": 2, "h": 250, "label": "Two stages",
      "nodes": [ { "id": "a", "col": 0, "row": 0, "title": "Ask", "sub": "Someone asks", "icon": "💡", "color": "s1", "at": 1 },
                 { "id": "b", "col": 1, "row": 0, "title": "Build", "sub": "Small change", "icon": "🔧", "color": "s2", "at": 2 } ],
      "edges": [ ["a","b"] ] }
  </script></div>
  <div class="row" style="margin-top:12px">
    <button class="btn" data-step-to="1">Ask</button> <button class="btn" data-step-to="2">Build</button>
  </div>
  <div class="cap"><p data-only="1">First caption.</p><p data-only="2">Second caption.</p></div>
</section>
```

## 3. Chart + takeaway (split)

```html
<section data-steps="3">
  <div class="eyebrow">2 of 4 · The effect <span class="ex-tag">illustrative</span></div>
  <h1>The claim the chart proves</h1>
  <div class="split">
    <div class="wd" data-wd="bars"><script type="application/json">
      { "w": 620, "fmt": "{v} days", "lw": 190, "rh": 80,
        "data": [ { "label": "Before", "value": 45, "color": "risk", "at": 1 },
                  { "label": "After", "value": 7, "color": "good", "at": 2 } ] }
    </script></div>
    <div class="callout fade" data-at="3"><b>6 times faster</b> in this example.</div>
  </div>
</section>
```

## 4. Big numbers (kpi)

```html
<section data-steps="3">
  <div class="eyebrow">Results</div>
  <h1>Three numbers to remember</h1>
  <div class="grid g3" style="margin-top:24px">
    <div class="kpi c-s1 fade" data-at="1"><b>-74%</b><span>failed releases</span></div>
    <div class="kpi c-s2 fade" data-at="2"><b>7 days</b><span>from merge to users</span></div>
    <div class="kpi c-s3 fade" data-at="3"><b>12</b><span>weeks to roll out</span></div>
  </div>
</section>
```

## 5. Cards (3 or 4 points)

```html
<section data-steps="3">
  <div class="eyebrow">Rules</div>
  <h1>Three rules keep the train on time</h1>
  <div class="grid g3" style="margin-top:20px">
    <div class="card accent c-s1 fade" data-at="1"><h3>Rule 1</h3><p>The train leaves every Thursday.</p></div>
    <div class="card accent c-s2 fade" data-at="2"><h3>Rule 2</h3><p>A late change waits.</p></div>
    <div class="card accent c-s3 fade" data-at="3"><h3>Rule 3</h3><p>A failed check stops the train.</p></div>
  </div>
</section>
```

## 6. Compare two options (table)

```html
<section data-bg="soft">
  <div class="eyebrow">Options</div>
  <h1>Option B costs less and ships sooner</h1>
  <table class="t">
    <tr><th></th><th>Option A</th><th>Option B</th></tr>
    <tr><td>Cost</td><td>High</td><td><span class="pill good">Low</span></td></tr>
    <tr><td>Time</td><td>12 weeks</td><td><span class="pill good">4 weeks</span></td></tr>
    <tr><td>Risk</td><td><span class="pill risk">High</span></td><td><span class="pill warn">Medium</span></td></tr>
  </table>
</section>
```

## 7. Big idea or quote (dark)

```html
<section data-bg="dark">
  <div class="eyebrow">The idea</div>
  <div class="quote center">A short sentence the room should remember.<small>Source or speaker</small></div>
</section>
```

## 8. Decision / ask (warm)

```html
<section data-bg="warm">
  <div class="eyebrow">The ask</div>
  <h1>Approve a 12-week pilot</h1>
  <p class="lead">One team. One train each week. A review at week 12.</p>
  <div class="callout"><b>Decision needed today:</b> name one team.</div>
</section>
```

## 9. Custom SVG with motion

```html
<section>
  <h1>The agent reads from one shared memory</h1>
  <svg viewBox="0 0 600 260" role="img" aria-label="Three agents read one shared memory" style="width:100%;max-width:760px">
    <circle class="pulse" cx="300" cy="130" r="40" fill="var(--s1)"/>
    <g class="pop" data-at="0"><circle cx="100" cy="60" r="26" fill="var(--s2)"/></g>
    <path class="march" d="M126,70 L262,118" stroke="var(--ink-3)" stroke-width="3" fill="none"/>
  </svg>
</section>
```

## 10. Toggle: before and after

`data-only="0"` shows at the start. `data-only="1"` shows after the click.
The button works as a switch with Reveal's ← and →.

```html
<section data-steps="1">
  <h1>Shared memory removes the repeat work</h1>
  <button class="btn" data-step-to="1">Turn on shared memory</button>
  <svg viewBox="0 0 600 200" role="img" aria-label="Agents before and after sharing memory" style="width:100%;max-width:700px">
    <g data-only="0"><circle cx="150" cy="100" r="40" fill="var(--risk)"/></g>
    <g data-only="1"><circle cx="150" cy="100" r="40" fill="var(--good)"/></g>
  </svg>
</section>
```

## Deck skeleton

| # | Pattern | Background |
| --- | --- | --- |
| 1 | Title | `brand` |
| 2 | The problem (one big number or quote) | `dark` |
| 3 to n-2 | Path, chart, cards, compare | `light` or `soft` |
| n-1 | The ask | `warm` |
| n | Close: contact or next step | `brand` |
