---
name: chinese-learning
description: Teach Mandarin Chinese characters, words, and phrases through adaptive conversation and interactive HTML lessons. Use when a learner asks to study a Chinese target or Singapore Primary 1–3 curriculum lesson; supports adults, children, and parents or teachers helping a child.
---

# Chinese learning

Teach a target in chat and create a matching interactive HTML lesson. Treat the bundled Singapore Primary 1–3 curriculum as an initial sequence, not an age limit or the only allowed source of targets.

## Start with the learner and target

1. Ask whether the learner is an adult or child, their approximate proficiency and learning goal, and whether they prefer English, Chinese, or a mix. For a child, address the child directly when appropriate and let a parent or teacher provide context. Do not request a name or other identifying details.
2. Ask for a curriculum level, semester, and lesson, or accept a character, word, or phrase directly. Look up curriculum requests in `assets/curriculum__singapore-primary-chinese.md`; preserve the lesson order and distinguish 识读字 (recognise/read) from 识写字 (recognise/write). This asset is coverage data, not a dictionary or source for meanings.
3. Ask for a recent event, interest, place, or story that could make the target relevant. If the learner has none, offer one ordinary everyday scenario and let them choose or change it.
4. If a curriculum lesson contains several characters, agree on a manageable micro-lesson target with the learner. Explain how it relates to the requested lesson; do not silently skip or relabel curriculum items.

Default to Simplified Chinese, clear English explanations, and tone-marked Hanyu Pinyin. Adapt vocabulary, explanation depth, examples, and language balance to the learner. Do not assume the learner is a child because the target came from a primary curriculum.

## Research before teaching

Research every target on the web before writing lesson content. First check whether the `agent-reach` skill is available in the active terminal and use it for web search when it is. Otherwise use the configured web search capability, such as the Codex web search tool when available. If neither is available, pause and tell the learner that you cannot verify this target yet; do not fill the gap from model memory.

Search the exact character, word, or phrase. Consult reliable dictionaries and educational or linguistic references for meaning, pronunciation, usage, collocations, and relevant character structure. Look for historical/origin claims only when they help explain the target and a reliable source supports them. Open and inspect the sources used; search snippets alone are not evidence. Prefer authoritative references and cite claims close to where they appear in chat and on the lesson page.

Keep these categories distinct:

- **Verified usage and meaning:** teach only what the sources support, with appropriate context and register.
- **Character history or origin:** include only when the source clearly supports the particular claim. Character components or visual resemblance alone do not establish historical origin. When sources disagree or evidence is weak, say the origin is uncertain and omit the unsupported story.
- **Memory aid:** a created image, story, or association can help recall, but label it as a mnemonic, not etymology or historical fact.

For each source used in the HTML input, provide its actual page title, direct URL, and a short note describing which claim it supports. Never invent a citation or imply that a source says more than it does. If research finds no dependable history, teach meaning and use without an origin section.

## Design a lesson for this target

Use the researched facts and learner context to choose the explanation, example, visual idea, page structure, and activities. Do not force targets into a fixed sequence or reuse a generic metaphor regardless of meaning. Choose only activities that help this learner understand or recall this target: for example, a visual scene for a concrete noun, a short action sequence for a verb, a contrast for easily confused words, or a dialogue for a useful phrase. These are options, not a required recipe.

Teach the meaning, pronunciation, a useful word or phrase, and an everyday example. Explain a component character or character form only when it helps this target. Keep examples natural and culturally appropriate; use the learner's chosen context where it fits, without bending the meaning to fit the story. Make sourced facts consistent between the conversation and page. Invite the learner to respond or try a brief recall activity in chat.

## Build the interactive HTML

Follow `references/lesson-schema.md` and pass a JSON lesson to the existing renderer:

```sh
node skills/chinese-learning/scripts/build-lesson.mjs <lesson.json> <lesson.html>
```

The JSON uses `meta` (required `title` and `target`; optional `pinyin`, `meaning`, `context`, `concept`), a non-empty `sections` array, optional safe `illustration`, optional `practice`, and optional `sources`. Use only supported section types: `scene`, `meaning`, `origin`, `usage`, `reveal`, `popover`, `compare`, `dialogue`, and `quiz`. Pick and order sections and interactions to fit the target and learner. Use `popover` for one useful, target-specific detail that benefits from a tap to reveal; supply a short `prompt`, `answer`, and optional button `label`. For compare use `items` with `label` and `text`; for dialogue use `lines` with `speaker` and `text`; for quiz supply `question`, at least two `choices`, and a valid zero-based `answerIndex`. Set `practice.writing` to `true` when copying the character shape adds value; this gives the learner a finger/stylus canvas and clear button. The writing guide shows the target as a shape reference and does not provide stroke order or correctness scoring. The renderer escapes lesson text; provide content as text, not markup.

The illustration field accepts only the safe SVG primitives and attributes documented in the schema. DaisyUI/Tailwind CDN styling and a local CSS fallback are already provided by the renderer. Its Learn, Use, and Practice tabs keep the content inside an iPad viewport. Include researched source links in `sources` using `title`, `url`, and an optional explanatory `note`. The renderer only builds supplied content; it does not research facts or choose the lesson design for you.

The renderer writes a single HTML output: the lesson JSON is safely embedded as non-executable data, and generated illustrations are inline SVG. Do not create a JSON sidecar in the generated-output folder. The authoring JSON examples stay under `skills/chinese-learning/examples/`; the approved styling CDN and source links remain external URLs.

Choose an output path appropriate to the user's project or request, and state where the HTML was saved. Keep learner details, responses, handwriting, scores, and progress in the current conversation/page only. Do not add storage, accounts, analytics, or tracking. Speech synthesis is optional and browser-dependent. Writing practice is optional, uses freehand finger/stylus input to practice character shape, and does not teach stroke order or score correctness.
