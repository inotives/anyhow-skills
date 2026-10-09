---
name: interactive-learning-html
description: Use this skill when the user wants to understand a topic through one interactive infographic page, such as a system, a process, a set of services, or a comparison. Output is one self-contained HTML file.
status: experimental
---

# Interactive Learning HTML

Make one infographic page that a person can look at and understand. The page
fits one screen. It has a journey animation, clickable blocks, and popups. It is
not a quiz.

You do not write HTML. You write the page content as JSON. A build script
puts that JSON inside a fixed template. Every page then has the same design.

## Output rule: one HTML file

The deliverable is **one `.html` file and nothing else**.

- Everything is inside it: the design, the code, the content (as JSON), the
  diagrams, and the sources.
- Do not create a separate `.json`, `.css`, or `.js` file for the user.
- Do not load a library, font, or image from a URL. The build fails if the
  page loads anything external.
- To share the page, send the HTML file. To edit it, change the JSON block
  inside it (see "Edit a page").

## When to use

Use this skill for a topic that has parts, steps, or layers:

- a system or platform (for example, how a database platform works);
- a process with stages (for example, how a request reaches a server);
- a set of services or terms that belong to groups;
- a comparison of two or more options.

Do not use it for a one-line answer, a translation, or a long essay.

## Requirements

- Node.js 18 or later. No `npm install`.
- A web browser to check the result.
- Network access only if you must research the topic.

## Files

```text
template/shell.html    page frame (do not edit)
template/theme.css     design tokens, 5 palettes, components (do not edit)
template/engine.js     builds tabs, diagrams, popups (do not edit)
scripts/build.mjs      validates the JSON and writes the one HTML file
reference/content-spec.md   every field of the content JSON
reference/writing-rules.md  writing rules (STE-inspired)
examples/databricks-overview.html  example: a tech topic (graphite)
examples/learn-shu.html            example: a language lesson for a child (forest)
```

## Workflow

1. Define the topic, the reader, and one learning goal.
2. Research with primary sources if the topic has facts that change. Keep a
   list of source URLs. Mark every fact you did not check.
3. Pick the palette (table below).
4. Pick the views (table below). Use 2 to 4 views.
5. Write the content as JSON. Follow `reference/content-spec.md` and
   `reference/writing-rules.md`. Pipe it into the build. No file is needed:

   ```sh
   node scripts/build.mjs - <topic-name>.html <<'JSON'
   { "meta": { ... }, "views": [ ... ] }
   JSON
   ```

   To start from an example, print its JSON with
   `node scripts/build.mjs --extract examples/learn-shu.html`.
6. Read the build output. Fix every error. Fix every warning about long
   sentences. Build again. Check that only the one HTML file exists. If you
   saved the JSON in a file, delete it.
7. Open the HTML file. Do the checks in "Acceptance checks".
8. Give the user the file path. Do not paste the HTML into chat.

## Edit a page

The HTML holds its content in `<script type="application/json" id="content">`.

```sh
node scripts/build.mjs --extract page.html        # print the JSON
node scripts/build.mjs page.html page.html        # validate and rebuild in place
```

Edit the JSON block by hand, then rebuild. A rebuild also applies template
updates to old pages.

## Choose a palette

Set `meta.palette`. The reader can change it later with the 🎨 button.

| Palette | Use for |
| --- | --- |
| `graphite` | Tech, software, data, engineering. This is the default. |
| `ocean` | Science, maths, space, physics. |
| `forest` | Nature, health, biology, sustainability. |
| `ember` | Business, finance, history, economics. |
| `dusk` | Language, arts, culture, humanities. |

## Choose views

| Need | View type |
| --- | --- |
| Show how parts connect or how steps flow | `diagram` (the main view) |
| Show where something runs, or a second flow | `diagram` (a second one) |
| List many items in groups | `catalog` |
| Practice writing (a character, a word, a letter) | `trace` |
| Give 3 to 5 take-away points | `ideas` |

The first view opens first. Make it a `diagram`.

## Diagram rules

- Place blocks on a grid with `col` and `row`. Do not write pixel positions.
- Use 8 to 14 blocks. Use more only if each one is needed.
- Read left to right. One column for each stage.
- Give each stage 1 to 4 blocks.
- Use `band` blocks for things that span all columns, such as governance,
  scheduling, or storage.
- Use one color for each group of blocks. Colors are tokens: `k1` to `k9`,
  `hl`, `accent`. Never write a hex color.
- Write 3 to 8 stages. Each stage lists the blocks that light up. Flow dots
  follow the arrows between those blocks.
- Every block needs `does` and `example`. The reader sees them on click.

## Language lessons

- Set `meta.speakLang` (for example `zh-CN`). Set `speak: true` on a diagram or
  catalog view. Each block then gets a 🔊 Listen button. The voice comes from
  the browser. No network is used.
- Show a character with `glyph` on a block. Put the pinyin in `title` and
  the meaning in `sub`.
- Use pinyin with tone marks. Write words, not single letters, in sentences.
- Add a `trace` view. The guide fades over the rounds, and the last round has
  no guide.
- Write a note in `meta.notes` that a teacher should check the content.

## Writing rules

Short version. The full rules are in `reference/writing-rules.md`.

- Use sentences of 20 words or fewer. Write one idea in each sentence.
- Use the active voice. Use simple words.
- Use one name for one thing. Do not use synonyms.
- Define a term the first time you use it.
- Write button text and labels in the same way each time: `Play`, `Reset`.
- State facts you checked. Mark general knowledge in `meta.notes`.
- Do not invent data, names, or sources.

## Acceptance checks

- `build.mjs` prints no error and no long-sentence warning.
- The page does not scroll at 1280×720. Only the catalog and the ideas view
  may scroll inside their own box on a small screen.
- All block text fits inside its block.
- Press Play on each diagram. Gold dots move. The stage text matches the lit
  blocks.
- Click 3 blocks. The detail card is correct. The ← and → buttons work.
- Open the catalog popup, the ⓘ sources popup, and the 🎨 palette popup.
- Switch light and dark mode. Switch palette. Text stays readable.
- Keyboard: Tab reaches every block and button. Enter opens a block.
- The page makes no network request. It has no external library.
- The build output is one HTML file. No `.json`, `.css`, or `.js` file remains.

## Limits

- The `trace` view has no stroke-order guide. It needs pointer or touch input.
- No chart view yet. Do not load D3 or Mermaid from a CDN. For a real
  quantitative chart, extend the engine in a new change.
- The grid layout suits 4 to 7 columns. A free graph with many crossing links
  does not fit.
- The page does not store answers. It stores only the light or dark mode.
- A diagram on a phone scrolls sideways inside its box.
