# Design guidelines

Rules for every deck. The template applies most of them. You apply the rest
when you write the slides.

## Canvas

- 1280×720 (16:9). Padding: 44 px top, 56 px sides, 26 px bottom.
- The footer (deck name and slide number) is added for you. Turn it off for
  one slide with `data-foot="off"`.
- Keep important content inside the padding. Controls sit in the bottom-right
  corner.

## One idea for each slide

- The `<h1>` is the claim. A reader who reads only the `<h1>`s gets the story.
- Use the eyebrow (small caps line above the title) for the section, such as
  `2 of 5 · The effect`.
- Put the picture first and the words second. If a slide is all text, make it
  a callout, a quote, or a big number.
- 90 words or fewer. 3 to 5 points at most. A list of 6 points becomes 2 slides.

## Type

| Role | Font | Size |
| --- | --- | --- |
| Headline `h1` | Source Serif 4, bold | 46 px (title slide 64 px) |
| Lead sentence `.lead` | Source Serif 4 | 28 px |
| Body | IBM Plex Sans | 19 to 22 px |
| Labels, eyebrows, code | IBM Plex Mono | 12 to 15 px, caps, wide spacing |

- Body text is never below 17 px. Labels inside a chart are never below 15 px.
- Do not center body text. Slides are left-aligned.

## Color

Each palette has the same tokens. Write the token, never the hex.

| Token | Use |
| --- | --- |
| `--ground`, `--surface`, `--surface-2`, `--warm` | Backgrounds, from page to card |
| `--ink`, `--ink-2`, `--ink-3` | Text: main, support, quiet |
| `--accent`, `--accent-soft` | The one brand color and its tint |
| `--s1` … `--s5` | Series and stages. Use in order. |
| `--good`, `--warn`, `--risk` | Status only. Do not use them as decoration. |
| `--dk-*`, `--br1..3` | Dark and brand slide backgrounds |

- Use 1 accent plus 2 or 3 series colors on one slide.
- Use `--risk` for a bad number and `--good` for a good one. Pair color with a
  word, so a color-blind reader can follow.
- Text on a dark or brand slide uses `--dk-ink`. The template sets this when
  you use `data-bg="dark"` or `"brand"`.

## Background rhythm

| `data-bg` | Use |
| --- | --- |
| `brand` | Title slide and closing slide |
| `light` | Most slides |
| `soft` | A quiet slide, such as a table or a list |
| `warm` | A decision, a risk, or an ask |
| `dark` | A big idea, a demo, or a story |

Change the background about every 3 slides. Do not put 3 dark slides in a row.

## Motion

- Motion shows order or change. Use it to build a picture one part at a time.
- Use steps (`data-steps`) for a diagram, a chart, or a list that you explain
  one part at a time. 3 to 6 steps is the right range.
- A slide has 1 motion idea. A moving diagram plus a spinning icon is too much.
- Loop classes (`pulse`, `float`, `march`, `spin`) go on 1 small object, not a
  whole diagram.
- Reduced-motion users see the final state. Do not rely on motion for meaning.
- Reveal's slide transition is `slide`. Do not change it.

## Diagrams and charts

- Use a D3 widget first. Use custom SVG when a widget cannot draw the picture.
- Label things on the picture. Avoid a separate legend when you can.
- Show the number on the bar or the line end. Do not make the reader read an axis.
- Start a bar chart at 0.
- Mark made-up numbers with the `illustrative` tag.

## Language

- Use short sentences and plain words (see `interactive-learning-html`
  `reference/writing-rules.md`). Build warns at 20 words in a sentence.
- Write the headline as a full claim. Write numbers as digits.
- Name the source on the slide or in the notes when you show a fact.

## Accessibility

- Every `<svg>` has `role="img"` and an `aria-label`. Widgets set it from `label`.
- Text contrast: use `--ink` on light and `--dk-ink` on dark. Do not put
  `--ink-3` on a colored fill.
- Every button works with the keyboard. Use `<button>`, not a `<div>`.
