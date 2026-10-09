---
name: interactive-deck-reveal
description: Use this skill when the user wants a presentation deck as one interactive HTML file, with animated diagrams and charts. It uses Reveal.js, D3.js, and inline SVG. Output is one HTML file.
status: experimental
---

# Interactive Deck (Reveal.js)

Make a presentation deck that runs in a browser. Each slide has one message.
Diagrams and charts build up step by step as the presenter presses →.

You write the slides as HTML. A build script puts them inside a fixed
template. Every deck then has the same canvas, fonts, colors, and motion.

## Output rule: one HTML file

The deliverable is **one `.html` file and nothing else**.

- The design, code, and slides are inside it. Do not make a separate `.css`,
  `.js`, or image file.
- Libraries load from pinned CDN versions (Reveal.js 5.1.0, D3 7.9.0 on
  cdnjs). The presenter needs network, or builds with `--inline`.
- `--inline` puts the libraries inside the file (about 520 KB). Use it when
  the deck must work offline. Only the web fonts stay online. System fonts
  replace them.
- Do not load an image or script from any other URL. The build fails if you do.
  Draw pictures as inline SVG.

## When to use

- A pitch, a proposal, a team update, a training talk, or a project summary.
- A talk that needs a path, a comparison, a trend, or a plan shown as a picture.

Do not use it for a long document, a reading page, or a one-screen explainer.
For a one-screen explainer, use `interactive-learning-html`.

## Requirements

- Node.js 18 or later. No `npm install`.
- A web browser to check the result.
- Network access for the CDN libraries, and for `--inline` at build time.

## Files

```text
template/shell.html    page frame (do not edit)
template/theme.css     5 palettes, layouts, components, motion (do not edit)
template/engine.js     wraps slides, steps, D3 widgets, starts Reveal (do not edit)
scripts/build.mjs      checks the slides and writes the one HTML file
reference/design-guidelines.md   canvas, type, color, motion rules
reference/slide-patterns.md      copy-ready slide markup
reference/widgets.md             the 5 D3 widgets and their JSON
examples/release-train.html      example deck: 6 slides, indigo palette
```

## Workflow

1. Define the audience, the one decision or idea, and the time. Plan 1 slide
   for each minute at most.
2. Write the storyline as 5 to 12 headlines. Each headline is a full claim
   ("Smaller releases wait less"), not a topic ("Release size").
3. Pick the palette (table below).
4. Pick a pattern for each slide from `reference/slide-patterns.md`.
5. Write the slides. Start with a `<!--deck {...} -->` comment, then
   `<section>` blocks. Pipe them into the build:

   ```sh
   node scripts/build.mjs - <deck-name>.html <<'HTML'
   <!--deck {"title":"…","palette":"teal","footer":"Team · Topic"} -->
   <section data-bg="brand" data-layout="title-slide"> … </section>
   <section data-steps="3"> … </section>
   HTML
   ```

   Add `--inline` for an offline file.
6. Read the build output. Fix every error and every warning. Build again.
7. Open the file. Do the checks in "Acceptance checks".
8. Give the user the file path. Do not paste the HTML into chat.

## Edit a deck

```sh
node scripts/build.mjs --extract deck.html          # print the slides
node scripts/build.mjs deck.html deck.html          # rebuild in place
```

A rebuild also applies template updates to old decks.

## Choose a palette

Set `palette` in the `<!--deck-->` comment. Use palette tokens in slides
(`var(--s1)`, `var(--accent)`). Never write a hex color.

| Palette | Use for |
| --- | --- |
| `teal` | Data, platforms, knowledge, general business. Default. |
| `indigo` | Product, engineering, strategy, AI. |
| `ember` | Finance, sales, operations, history. |
| `forest` | Sustainability, health, growth, people. |
| `slate` | Formal, legal, board and executive decks. |

## Slide rules

- One `<h1>` for each slide. It states the message.
- 90 words or fewer for each slide. Sentences of 20 words or fewer.
- Slides sit on a fixed 1280×720 canvas. Reveal scales it to the screen.
- Use `data-bg` to set the background: `light` (default), `soft`, `warm`,
  `dark`, `brand`. Start and end with `brand`, or `dark`. Use `dark` for a
  big idea or a demo. Do not use more than 2 dark slides in a row.
- Add `<aside class="notes">…</aside>` to each slide. The presenter sees it
  with the S key.
- Mark any number you did not check with `<span class="ex-tag">illustrative</span>`.
- Do not invent data, names, or quotes. Use the sources the user gave.

## Steps: show a slide in parts

Set `data-steps="N"` on a `<section>`. Each → press then shows step 1, 2, … N.

- `data-at="2"` on any element: it shows from step 2 onward.
- `data-only="2"` on any element: it shows only at step 2 (for captions).
- `<button data-step-to="3">`: a click jumps to step 3.
- Widgets take `"at": n` on their items.
- Build checks that no number is above `data-steps`.

## D3 widgets

`<div class="wd" data-wd="flow"><script type="application/json">{…}</script></div>`

Five widgets: `flow`, `bars`, `donut`, `line`, `timeline`. Fields are in
`reference/widgets.md`. Use a widget for any diagram or chart. Set `"w"` to
about 1168 for full width and about 600 in a two-column `split`.

## Custom SVG

Use inline `<svg viewBox="…">` for a picture a widget cannot draw. Style it
with tokens and animate it with the built-in classes:

- Step classes (need `data-at`): `pop`, `fade`, `rise`, `grow`, `draw`
  (`draw` needs `pathLength="1"`).
- Loop classes (run while the slide shows): `pulse`, `float`, `march`, `spin`.
- Do not put a CSS `transform` class on an element that has a `transform`
  attribute. Wrap it in a `<g>` instead.
- Give the `<svg>` a `role="img"` and an `aria-label`.

## Acceptance checks

- `build.mjs` prints no error and no warning.
- Press → through every slide. Each step shows what the caption says.
- Press ← from the end. Steps hide again in reverse order.
- No text is cut off or overlaps at 1280×720. Check with browser zoom at 100%.
- The deck reads in light and dark slides. Text stays readable.
- Press S. Speaker notes open. Press O. The overview shows all slides.
- Change `palette` and rebuild. All colors change. No color stays fixed.
- The build output is one HTML file.

## Limits

- Fixed 16:9 canvas. Reveal scales it. It does not reflow for a phone.
- No stroke-order, map, or 3D support. Draw with custom SVG.
- PDF export does not work yet. A test with `?print-pdf` dropped the D3
  diagrams. Share the HTML file to present.
- Web fonts need network. Without it, serif and sans system fonts show.
