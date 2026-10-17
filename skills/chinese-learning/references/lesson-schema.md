# Interactive lesson input

`scripts/build-lesson.mjs` turns a lesson JSON file into a single, portable HTML page. Research and lesson design happen before the renderer is called. Pick only the sections and interactions that suit the target's meaning, form, learner context, and sourced facts; do not reuse one fixed lesson sequence.

```json
{
  "meta": {
    "title": "A short page title",
    "target": "树",
    "pinyin": "shù",
    "meaning": "tree",
    "context": "A tree the learner passed on the way to school",
    "concept": "Connect the written form and meaning through a remembered place"
  },
  "illustration": {
    "label": "A tree beside a path",
    "viewBox": "0 0 320 180",
    "elements": [
      { "type": "rect", "x": 0, "y": 140, "width": 320, "height": 40, "fill": "#d9edce" },
      { "type": "circle", "cx": 160, "cy": 62, "r": 42, "fill": "#5c9b69" },
      { "type": "rect", "x": 150, "y": 95, "width": 20, "height": 50, "fill": "#805b3d" }
    ]
  },
  "sections": [
    { "type": "scene", "title": "Picture the place", "text": "..." },
    { "type": "reveal", "title": "Recall", "prompt": "What does 树 mean?", "answer": "tree" },
    { "type": "popover", "title": "Notice the setting", "label": "Why does this matter?", "prompt": "Where might you see one?", "answer": "..." },
    { "type": "usage", "title": "Everyday phrase", "text": "..." },
    { "type": "quiz", "title": "Choose the meaning", "question": "...", "choices": ["...", "..."], "answerIndex": 0 }
  ],
  "practice": { "writing": true, "prompt": "Write the character shape from memory, then compare with the guide." },
  "sources": [
    { "title": "Source title", "url": "https://example.org/page", "note": "Supports the usage example" }
  ]
}
```

## Fields

- `meta.title` and `meta.target` are required. `pinyin`, `meaning`, `context`, and `concept` are optional. Context can be about an adult or child.
- `sections` is required and can use any number or order of these types: `scene`, `meaning`, `origin`, `usage`, `reveal`, `popover`, `compare`, `dialogue`, and `quiz`. The renderer groups them into Learn, Use, and Practice tabs. A `popover` needs `prompt` and `answer`, with an optional button `label`; use it for a relevant detail the learner can choose to reveal.
- Text fields are rendered as text, not HTML. Compare sections use `items: [{ "label", "text" }]`; dialogue sections use `lines: [{ "speaker", "text" }]`.
- Quiz sections use `question`, at least two `choices`, and a zero-based `answerIndex`. Feedback remains in the page and is not saved.
- Set optional `practice.writing` to `true` to add a freehand canvas using touch or stylus Pointer Events; `practice.prompt` can provide brief guidance. The faded target is a shape reference. The canvas does not teach stroke order, assess the writing, or save strokes.
- `sources` accepts `{ "title", "url", "note?" }` entries. Give sources for claims about origins/history and other researched facts. Omit unsupported etymology instead of filling the gap with speculation.
- `illustration` is optional and accepts only `rect`, `circle`, `line`, `ellipse`, and `text` SVG primitives with numeric geometry and simple named/hex colors. This avoids inserting arbitrary markup or scripts.

## Build

From the repository root:

```sh
node skills/chinese-learning/scripts/build-lesson.mjs lesson.json lesson.html
```

The renderer writes one HTML artifact. It embeds the authoring JSON in a non-executable `application/json` script block and escapes HTML-significant characters so lesson text cannot close that block. Illustrations are inline SVG; no image sidecars are generated. The page retains DaisyUI/Tailwind CDN styling plus local CSS for a readable iPad viewport-fitted fallback. It uses browser speech synthesis when available. Tabs, tap-to-open dialogs, and writing practice are keyboard operable where applicable. Answers and writing remain in page memory and are never written to storage. Shape practice does not teach stroke order or score correctness.
