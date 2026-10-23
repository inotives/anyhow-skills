---
name: learn-chinese-word
description: Use this skill when the user gives a Chinese word (or asks for one) and wants an interactive page that teaches it to a child, with meaning, phrases, sentences, stroke-order writing practice, small games and a quiz. Output is one single-page HTML file that fits an iPad or laptop screen without vertical scrolling, built with Three.js from a CDN.
status: experimental
---

# Learn Chinese Word

Turn one Chinese word into a playful, one-screen learning app for children.
You research the word and write its content as JSON. A build script puts the
JSON into a fixed template, so every page has the same design and controls.

## What the page contains

The page is a single-page app with five tabs. Every tab fits the screen; long
lists page sideways (◀ ▶) instead of scrolling down.

| Tab | Contents |
| --- | --- |
| 📖 学 Learn | 3D character tiles (Three.js, tap to flip and hear), tone-coloured pinyin, meaning with emoji, character parts (radical, strokes), memory trick, tone contours |
| 💬 说 Words | phrase cards with the word highlighted, sample sentences with pinyin and English, tap to hear |
| ✍️ 写 Write | 田字格 grid with Hanzi Writer: watch the stroke order, trace, or write from memory, with stars per character |
| 🎮 玩 Play | 🫧 Bubble Pop (Three.js: pop bubbles that show the word), 🃏 Memory Match (word ↔ picture), 🧩 Build a Sentence |
| ⭐ 考 Quiz | 4–10 questions: listen, meaning, pinyin, picture, fill in the blank, character |

Stars, confetti (Three.js), sound effects and device text-to-speech (zh-CN)
reward the child. A 🐢 button slows the voice.

## When to use

Use it for one word or character a child is learning, for example 熊猫, 朋友,
水, or a word from a school word list. For a full adaptive lesson around a
story or curriculum unit, use `chinese-learning` instead. Do not use it for
long texts or grammar topics.

## Requirements

- Node.js 18 or later. No `npm install`.
- Web search (prefer the `agent-reach` skill when available) to check the word.
- Viewing the page needs internet for the CDNs: Three.js 0.160.0 and Hanzi
  Writer 3.7.2 from jsDelivr, fonts from Google Fonts. Without them the page
  still works: the 3D parts become plain text, Bubble Pop is hidden, and
  writing practice falls back to freehand drawing over a grey character.

## Files

```text
template/shell.html          page frame and panel markup (do not edit per word)
template/theme.css           one-screen layout, iPad landscape first, portrait fallback
template/engine.js           tabs, Three.js scenes, Hanzi Writer, games, quiz
scripts/build.mjs            validates the JSON and writes the HTML
reference/content-spec.md    every field of the word JSON
examples/xiongmao.json       complete example for 熊猫 (panda)
tests/build.test.mjs         build and validation tests
```

## Workflow

1. **Get the word.** Confirm the target word (Simplified Chinese, 1–4
   characters). Ask the child's rough level only if it changes the content;
   default to an early-primary reader with English support.
2. **Research before writing.** Look the word and each character up in a
   reliable dictionary (for example Wiktionary, MDBG, or Zdic). Open the pages;
   do not rely on search snippets or memory. Check: tone-marked pinyin, meaning,
   radical, stroke count, and that each phrase and sentence is natural Mandarin.
   Record the pages in `sources` with a note of what each supports. If you
   cannot verify the word, tell the user instead of guessing.
3. **Write the JSON** following `reference/content-spec.md`:
   - a short, concrete `explain` a 6–9 year old understands;
   - 3–8 common phrases that contain the word, each with an emoji;
   - 2–5 short sentences with `tiles` for the sentence game;
   - 3–8 distractors (look-alike or same-topic words, or the word's components);
   - 4–10 quiz questions mixing types, with answers in varied positions;
   - an optional `mnemonic`. It is shown as a memory trick, never as character
     history. Only state an origin story if a source supports it.
4. **Build.** From the repository root, pipe the JSON in (no temporary file needed):

   ```sh
   node skills/learn-chinese-word/scripts/build.mjs - <<'JSON'
   { "word": "…", … }
   JSON
   ```

   The page is written to `generated_output/learn-chinese-word-<pinyin>.html`
   (pass a second argument to choose another path). Fix every `error` and read
   every `warn`, then build again.
5. **Check.** Open the file in a browser at an iPad landscape size (for example
   1180×820) and confirm: no vertical scrollbar on any tab, the 3D tiles and
   Bubble Pop render, the Write tab animates strokes, and the quiz finishes.
6. **Report** the file path. Do not paste the HTML into chat.

To change a built page, print its JSON, edit it, and build again:

```sh
node skills/learn-chinese-word/scripts/build.mjs --extract generated_output/learn-chinese-word-xiongmao.html
```

## Local data

None. The page stores nothing: stars and progress live only in the open tab.
No accounts, analytics, or tracking. Speech uses the device's own voices.

## Limitations

- Pronunciation quality depends on the device's Chinese text-to-speech voice;
  some browsers have none.
- Hanzi Writer checks stroke shape and order loosely; it is practice, not a
  handwriting assessment.
- Content is only as accurate as the research step; the build checks structure,
  not meaning or grammar.
- Designed for landscape tablets and laptops; portrait and phones are
  supported but tighter.
