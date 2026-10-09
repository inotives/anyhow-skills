---
name: interactive-learning-html
description: Use this skill when the user wants to learn a complex topic through an interactive question, explanation, diagram, chart, or self-checking HTML page.
status: experimental
---

# Interactive Learning HTML

Create one focused HTML learning page that helps a person understand and
recall a topic. The page is an explainer and a question at the same time. It
must make the learner think before it reveals the answer.

## When to use

Use this skill when the topic benefits from one or more of these forms:

- a conceptual question with a worked explanation;
- a multi-step process or causal relationship;
- a comparison, timeline, hierarchy, or system model;
- a small dataset or quantitative relationship;
- a misconception that benefits from a hint and correction.

Do not use it for a one-line factual answer, a simple translation, or a topic
that does not need interaction.

## Output

Write a single self-contained `.html` file. Put the answer in the file, not in
the surrounding chat. Use a descriptive filename such as
`tcp-three-way-handshake.html`.

The page must contain:

1. A short title and a one-sentence learning objective.
2. One primary question that can be answered before reading the explanation.
3. A visible response area: text input, choice buttons, ordering controls, or
   a small interactive diagram.
4. A `Show hint` action that gives a useful clue without giving the answer.
5. A `Reveal answer` action that shows the answer and reasoning.
6. A short self-check with feedback such as `Correct`, `Almost`, or `Review
   this step`.
7. A compact summary of the ideas to remember.

The page must work with keyboard input, have visible focus states, use readable
contrast, and remain useful on a narrow screen. Keep interaction local to the
browser. Do not collect, send, or persist learner responses unless the user
explicitly requests it.

## Visual dependency policy

Use the smallest visual tool that fully explains the idea:

| Need | Default | Rule |
| --- | --- | --- |
| Quantitative chart or scale | D3 | Use for axes, scales, data marks, and chart interaction. Do not use it for a decorative shape. |
| Flow, sequence, state, relationship, or hierarchy | Mermaid | Use for a semantic diagram when the diagram can be expressed clearly as Mermaid syntax. |
| Custom illustration, annotation, icon, or simple geometry | Inline SVG | Draw directly in the page. Keep coordinates and labels understandable. |
| Polished component styling or themes | daisyUI via CDN | Use for buttons, cards, badges, tabs, and themes when a shared component vocabulary improves the lesson. Keep learning behavior in plain JavaScript. |
| Layout, controls, feedback, and text | HTML and CSS | Do not add a frontend framework. |

For D3 pages, use the official CDN ESM bundle unless the user supplies a local
asset policy:

```html
<script type="module">
  import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
</script>
```

For Mermaid pages, load the official ESM bundle and render explicitly after
initialization:

```html
<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";

  mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });
  await mermaid.run({ querySelector: ".mermaid" });
</script>
```

For a networked HTML prototype that needs daisyUI components, load the pinned
v5 stylesheet and Tailwind browser runtime:

```html
<link href="https://cdn.jsdelivr.net/npm/daisyui@5" rel="stylesheet" type="text/css" />
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
```

daisyUI is optional. It provides Tailwind CSS components and themes, not the
learning behavior; use plain JavaScript for question state, feedback, and
accessibility. If the page must work offline, do not use this CDN path—use the
existing HTML/CSS approach or a user-provided local build instead.

Pin a tested major version in the generated page. Do not add npm installation
steps or a build tool for one page. If the page must work offline, replace the
CDN dependency with inline SVG or a user-provided local copy and state that
choice in a small source note.

## Authoring workflow

1. Define the learner and one observable learning objective.
2. Choose one question. Prefer prediction, diagnosis, ordering, comparison, or
   explanation over passive reading.
3. Write the expected answer and the reasoning before writing the page.
4. Choose the visual form using the dependency policy.
5. Build the page as plain HTML, CSS, and minimal JavaScript.
6. Add the hint, reveal, feedback, and summary states.
7. Test the page in a browser at desktop and narrow widths.
8. Check keyboard navigation, focus visibility, contrast, and that the answer
   remains hidden until the learner asks to reveal it.

## Content rules

- Use short paragraphs and direct language.
- Explain terms before using them in the question.
- Make distractors plausible and explain why they are wrong.
- Keep charts and diagrams subordinate to the learning objective.
- Label estimates, simplifications, and heuristics.
- Do not invent data, sources, or citations.
- Add a `Sources` section when the topic depends on external facts.
- Include a small `Made with` note listing D3, Mermaid, or other external
  assets actually used.

## Acceptance checklist

- The page opens as one HTML file and has no required server.
- The learner can attempt the primary question before seeing the answer.
- Hint, answer, feedback, and summary interactions work.
- The visual is semantically appropriate and not decorative filler.
- External dependencies are limited to the libraries used and are clearly
  identified in the page.
- The page has no telemetry, hidden network request, or credential handling.
- Keyboard and narrow-screen checks pass.
