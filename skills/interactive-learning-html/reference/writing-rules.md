# Writing rules (STE-inspired)

These rules follow the ideas of ASD-STE100 Simplified Technical English. They
help the reader and they help the model write the same way each time.

This is not official STE. The real standard has a controlled dictionary and a
license. Do not say that a page "complies with ASD-STE100".

## Rules

1. **Short sentences.** Use 20 words or fewer. `build.mjs` warns above 20.
2. **One idea in a sentence.** Split a sentence that has "and" twice.
3. **Active voice.** Write "Auto Loader finds new files." Do not write
   "New files are found by Auto Loader."
4. **Simple verbs.** Use *use*, *send*, *start*, *stop*, *show*. Do not use
   *utilize*, *leverage*, *facilitate*.
5. **One word for one meaning.** After you write "lakehouse", never write
   "data platform" for the same thing.
6. **Define a term once.** Put the definition in the first sentence that uses
   the term.
7. **Name the thing.** Write "the scheduler sends the job". Do not write "it
   is sent".
8. **Command form for actions.** Write "Press Play." Do not write "You may
   wish to press Play."
9. **No idioms and no figures of speech** in definitions. A headline may
   have one light image, such as "Data walks in."
10. **No marketing words.** Do not write *powerful*, *seamless*, *revolutionary*,
    *best-in-class*.
11. **Numbers as digits.** Write "3 stages", not "three stages".
12. **Facts only from sources.** Mark general knowledge in `meta.notes`.

## Field length guide

| Field | Limit |
| --- | --- |
| `title` (block) | 1 to 3 words |
| `sub` (box block) | 24 characters |
| `does` | 1 or 2 sentences, 25 words in total or fewer |
| `example` | 1 sentence |
| stage `headline` | 2 to 6 words |
| stage `text` | 2 sentences |
| idea `text` | 2 sentences |

## Fixed words for the interface

The template uses these labels. Do not change them in the content.

| Use | Do not use |
| --- | --- |
| Play, Pause, Replay, Reset | Start, Stop, Restart |
| Stage | Step, Phase |
| Block (the thing you tap) | Node, Box, Item |
| Role | Persona, Lens |

## Examples

| Not good | Good |
| --- | --- |
| The platform leverages a unified governance layer in order to facilitate secure access. | Unity Catalog sets who can see each table. |
| Data is ingested by the connectors, after which it is transformed and then it is stored. | Connectors bring data in. Pipelines clean it. Tables store it. |
| A really powerful assistant that makes querying seamless. | A chat assistant. You ask in words. It writes the query. |
