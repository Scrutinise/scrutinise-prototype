# For the GRAPHS stream — the amending-provision text lookup (SEARCH-28, 19 Oct 2026)

`statute_effects` returns rows whose other end is an amending provision. This is the function that turns that into text.

```ts
import { amendingText } from '@/lib/lex/amending-text'

// row: EffectRow from effectsFor(); targetTitle: the title of the Act being asked about
const t = await amendingText(row.otherEnd, { mentioning: [targetTitle] })
```

- **Input** is `EffectRow['otherEnd']` as it is — `{ corpus, gid, provision, title }`. No translation. (`refFromEdgeId('corpus:gid:provision')` exists for a raw `from_id`.)
- **Output** `{ status, reason, heldSections, sections[{ id, provision, wordCount, text, mentions }], truncated, nearby? }`.
- `status` is one of `text` · `held-no-match` · `held-no-text` · `provision-not-held` · `act-not-held`. `reason` is always a sentence. A caller must show it when `status !== 'text'`; it is how "we do not hold that" is told from "nothing there".

**Pass `mentioning`.** The edge table records the amending provision at the grain of the effects feed: `schedule-9`, not `schedule-9-paragraph-36`. Without `mentioning` you get the first 40 sections of the schedule, in order, with `truncated: true`. With it you get the paragraphs whose text names the Act being amended. `readText: false` gives existence and status only, with no R2 read.

**Not changed:** `statutory-graph.ts`, `effectsFor`, `EffectRow`. Search owns `lib/lex/amending-text.ts` only. Nothing here is written to any table.

**Not pushed yet.** Both this and `statute_effects` (7dd2931) are local commits or working-tree files. Neither is live.
