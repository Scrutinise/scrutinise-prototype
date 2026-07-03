# Type-taxonomy audit + fix (SEARCH_STRATEGY §10.2)

*2026-07-03. Trigger: "Revoke MiFID II" shows no answer in the legislation panel despite
retained MiFIR / SI 2017/701 existing in the corpus. Audited the raw-corpus → display-bucket
map empirically (`scripts/ingest/search/typemap-audit.ts`, throwaway) against the real 68
corpus types and the live BM25 retrieval.*

## Finding 1 — retained-EU and SI ALREADY map correctly (the brief's mechanism was off)

In the current codebase `corpus-type-map.ts` already routes:
- `retained-eu` / `eur-lex` → **EU_LEGISLATION** ("Retained EU law")
- `uksi/*` (any tier-legislation SI doctype) → **STATUTORY_INSTRUMENT** ("Statutory instruments")
- `ukpga/*` → **PRIMARY_LEGISLATION**

All three buckets are in `BackgroundPanel`'s `TYPE_ORDER` and render. The enum was extended
24 Jun (EU_LEGISLATION/GUIDANCE/BILL/TREATY). Direct check confirms:

```
retained-eu:eur/2014/600  → tier=legislation → EU_LEGISLATION      ✓
uksi/2017/701             → tier=legislation → STATUTORY_INSTRUMENT ✓
ukpga/2023/29 (FSMA 2023) → tier=legislation → PRIMARY_LEGISLATION  ✓
```

So retained-EU already has its own correct, rendered bucket and SI-tier routes correctly.

## Finding 2 — the MiFID "empty" is a RETRIEVAL/RANKING problem, not display

Top-30 for "I want to revoke MiFID II" (bare BM25): **17 STATUTORY_INSTRUMENT + 9 GUIDANCE + 4
dropped explanatory-memoranda**. The retrieved SIs (RAO amendment orders) and guidance (RPC
opinions) DO map to rendered buckets. But the **validated answers — retained MiFIR
(`eur/2014/600`), SI `2017/701`, FSMA 2023 — are absent from the results entirely.** They are
in the corpus and bucket correctly; BM25 simply never ranks them in. This is the **B6 ranking
problem** documented in the Stage-3 A/B (legislation buried under parliamentary/HMRC noise even
when the Act is named) — the flagship case for the vector layer (see `docs/PILOT_REPORT.md`,
which measured BM25 B6 = 0% → vector 50%). **A type-map change cannot make MiFIR/SI-701 appear**;
that requires the retrieval/ranking fix, not the display layer. Reported honestly rather than
claimed fixed.

## Finding 3 — the REAL taxonomy bug: 13 corpora were hidden (now 4, all intentional)

The FTS `tier` is baked into the index at build time. Corpora seeded after `corpus-map.ts`
`tierFor` last covered them carry `tier:'other'` in the live index and fell through to `null`
→ the panel hid them. Fixing `tierFor` only helps a future reindex, so the fix lives in the
**display layer** (`corpus-type-map.ts`, `CORPUS_DISPLAY_OVERRIDE`, keyed by corpus name —
effective on the live index now).

| corpus | sections | was | now |
|---|---:|---|---|
| **scottish-parliament-or** | 1,042,819 | ⛔ null | **DEBATE** |
| early-day-motions | 60,737 | ⛔ null | DEBATE |
| petitions | 49,482 | ⛔ null | DEBATE |
| cma-cases | 21,525 | ⛔ null | GUIDANCE |
| ofgem | 17,142 | ⛔ null | GUIDANCE |
| ofcom | 4,169 | ⛔ null | GUIDANCE |
| independent-reviews | 657 | ⛔ null | GUIDANCE |
| cps-guidance | 270 | ⛔ null | GUIDANCE |
| inquiry-evidence | 89 | ⛔ null | GUIDANCE |
| lgsco | 20 | ⛔ null | GUIDANCE |

`scottish-parliament-or` alone (1.04M Scottish Official Report debate sections) was the largest
single loss. Regulators / reviews / ombudsmen / inquiry material → GUIDANCE (matches the
"Guidance & regulators" bucket that already holds ico/fca/nao/inquiry-reports).

**Still null after the fix — 4, all intentional:** `explanatory-notes`, `explanatory-memoranda`
(legislation ANNOTATIONS, not the Act/SI — mapping them would mislabel a note as the law),
`erskine-may`, `members-interests` (procedural reference / a registry, not topical content).

## Fix

`scrutinise-web/lib/lex/corpus-type-map.ts` — `CORPUS_DISPLAY_OVERRIDE` checked before the tier
switch. No index rebuild needed (works on the baked-tier live index); idempotent w.r.t. a future
reindex that tiers these correctly. `tsc` on `scrutinise-web` = only the two pre-existing
`react-markdown` errors.

## Follow-ups (not this change)
- For reindex consistency, update `scripts/ingest/search/corpus-map.ts` `tierFor` so these
  corpora stamp the right tier at build time (the display override then just agrees).
- `buildInitialBackground` briefing PROSE still narrates only 4 of 9 types (EU_LEGISLATION /
  GUIDANCE etc. absent from the summary text) — the enum already flags this TODO. The structured
  cards render all buckets, so the panel shows the headings; the prose is a separate improvement.
- The actual MiFID answer surfacing is the vector-layer workstream (`docs/PILOT_REPORT.md`).
