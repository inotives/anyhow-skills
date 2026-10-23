# Word JSON spec

The build script reads one JSON object. Every text field is plain text; the
engine inserts it with `textContent`, so markup is shown literally.

```jsonc
{
  "word": "熊猫",                 // required, 1–4 Simplified Chinese characters
  "pinyin": "xióngmāo",           // required, tone-marked Hanyu Pinyin
  "meaning": "panda",             // required, short English gloss
  "emoji": "🐼",                  // recommended, picture for cards and the 3D tile back
  "explain": "…",                 // required, 1–2 child-friendly sentences
  "slug": "xiongmao",             // optional, file name part; defaults to pinyin without tones

  "chars": [                      // required, one entry per character, in order
    { "char": "熊", "pinyin": "xióng", "meaning": "bear",
      "radical": "灬", "radicalMeaning": "fire dots", "strokes": 14 }   // radical*, strokes optional
  ],

  "mnemonic": "…",                // optional, labelled "memory trick, not history"
  "funFact": "…",                 // optional, shown only when there is no mnemonic

  "phrases": [                    // 3–8; each should contain the word
    { "zh": "大熊猫", "pinyin": "dà xióngmāo", "en": "giant panda", "emoji": "🎋" }
  ],
  "sentences": [                  // 2–5 short sentences that contain the word
    { "zh": "我喜欢熊猫。", "pinyin": "Wǒ xǐhuan xióngmāo.", "en": "I like pandas.",
      "tiles": ["我", "喜欢", "熊猫"] }   // tiles join to zh without punctuation
  ],
  "distractors": [                // 3–8 other words for Bubble Pop and Memory Match
    { "zh": "老虎", "pinyin": "lǎohǔ", "en": "tiger", "emoji": "🐯" }
  ],
  "quiz": [                       // 4–10 questions, 2–4 choices each, answer is zero-based
    { "type": "listen",  "speak": "熊猫", "choices": ["老虎", "熊猫"], "answer": 1 },
    { "type": "meaning", "show": "熊猫",  "choices": ["cat", "panda"], "answer": 1 },
    { "type": "pinyin",  "show": "熊猫",  "choices": ["xióngmāo", "xiōngmào"], "answer": 0 },
    { "type": "picture", "show": "🐼",    "choices": ["兔子", "熊猫"], "answer": 1 },
    { "type": "fill",    "show": "___爱吃竹子。", "choices": ["熊猫", "老虎"], "answer": 0 },
    { "type": "char",    "prompt": "Which one means cat?", "show": "熊猫", "choices": ["熊", "猫"], "answer": 1,
      "explain": "猫 māo means cat." }  // prompt, explain and speak are optional on every type
  ],
  "sources": [                    // dictionary pages actually checked
    { "title": "熊 – Wiktionary", "url": "https://en.wiktionary.org/wiki/%E7%86%8A", "note": "meaning, radical, strokes" }
  ]
}
```

## How each field is used

| Field | Where it appears |
| --- | --- |
| `word`, `pinyin` | header chip (tap to hear), page title, file name |
| `chars` | 3D tiles, syllable buttons, Character parts, tones, Write tab |
| `meaning`, `emoji`, `explain` | Learn tab meaning card, tile backs, Memory Match |
| `mnemonic` / `funFact` | Learn tab tip card (omitted when both are missing) |
| `phrases` | Words tab cards (4 per page), Memory Match pairs |
| `sentences` | Words tab sentence strip, Build a Sentence game |
| `distractors` | wrong bubbles in Bubble Pop, extra Memory Match pairs |
| `quiz` | Quiz tab, in the given order |
| `sources` | ⓘ dialog |

## Content rules

- Memory Match uses the word plus the first five phrases (topped up from
  distractors). Give those six items different emojis.
- Distractors must not equal the word. Components of the word (for 熊猫:
  熊, 猫) make good distractors because children learn to tell them apart.
- `fill` questions must contain `___` exactly once.
- Spread quiz answers over different positions; the build warns otherwise.
- Without `tiles`, the sentence game keeps the word together and splits the
  rest into single characters. Supply `tiles` for multi-character words such
  as 喜欢 or 动物园.
- Stroke data is fetched by Hanzi Writer at view time; `strokes` in the JSON is
  only shown as text and in the offline fallback.
