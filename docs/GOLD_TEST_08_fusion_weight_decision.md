# GOLD_TEST_08 — the fusion weight, decided across all five streams

*Generated 2026-08-06T09:25:17.480Z by `weight-decision.ts` from the five `.weight-sweep` sidecars written by `score-stream-fusion.ts`. Recall@20, CAND_K=100, RRF_K=60, gemini-embedding-001 @768d, both arms tier-scoped per stream. Answer key validated 6 Aug 2026.*

## Recommendation: **50/50 — vector weight 0.5**

**The optimum does not vary by stream.** 50/50 is the best-or-joint-best weight in **all 5 streams**, so it is not a compromise or an average — no stream would do better on a different weight, and adopting it trades nothing away. A per-stream weight table would therefore be spurious precision.

Replaces the carried default of **0.7**, which was tuned on the pilot subset against an index that has since been rebuilt twice (4 Aug coverage fix, 5 Aug dedup).

## The full grid, every stream

| weight | caselaw | committees | debates | guidance | legislation | macro avg | micro avg (per query) |
|---|---|---|---|---|---|---|---|
| BM25 only | 87.5% | 100.0% | 90.0% | 87.5% | 43.8% | 81.8% | 71.1% |
| 30/70 | 87.5% | 100.0% | 95.0% **★** | 100.0% **★** | 49.0% | 86.3% | 75.9% |
| 40/60 | 87.5% | 100.0% | 95.0% **★** | 100.0% **★** | 49.0% | 86.3% | 75.9% |
| 50/50 | 100.0% **★** | 100.0% | 95.0% **★** | 100.0% **★** | 63.0% **★** | 91.6% **←** | 83.1% **←** |
| 60/40 | 100.0% **★** | 100.0% | 90.0% | 100.0% **★** | 57.8% | 89.6% | 79.6% |
| 70/30 *(prior default)* | 100.0% **★** | 100.0% | 80.0% | 100.0% **★** | 55.7% | 87.1% | 76.1% |
| 80/20 | 100.0% **★** | 100.0% | 80.0% | 100.0% **★** | 55.7% | 87.1% | 76.1% |
| vector only | 100.0% **★** | 100.0% | 75.0% | 100.0% **★** | 52.6% | 85.5% | 73.5% |

★ = best-or-joint-best for that stream (omitted where the stream cannot discriminate — see below).

## How much each stream actually contributes to this decision

| stream | queries | spread across the grid | discriminates? | answer key |
|---|---|---|---|---|
| caselaw | 4 | 12.5% | yes — best 50/50, 60/40, 70/30, 80/20, vector only | ⚠ CC-drafted, unvalidated |
| committees | 4 | 0.0% | **no — flat at every weight** | ⚠ CC-drafted, unvalidated |
| debates | 10 | 20.0% | yes — best 30/70, 40/60, 50/50 | validated 6 Aug |
| guidance | 4 | 12.5% | yes — best 30/70, 40/60, 50/50, 60/40, 70/30, 80/20, vector only | ⚠ CC-drafted, unvalidated |
| legislation | 16 | 19.3% | yes — best 50/50 | validated 6 Aug |

**Read this before quoting "all five streams agree".** committees scores identically at every weight, so it is consistent with the recommendation but provides no evidence for it. The weight is genuinely chosen by caselaw, debates, guidance and legislation — 34 of the 38 queries. committees at 100% everywhere is a ceiling effect, not a strong result; a test everything passes measures nothing.

And of those, only **debates and legislation** have validated answer keys — 26 queries. The drafted streams separate 0.5 from BM25-only but barely separate 0.5 from 0.7, so the case for moving the default rests on debates and legislation.

## Gain over what the code carries today

| stream | 0.7 (prior) | 50/50 (recommended) | change |
|---|---|---|---|
| caselaw | 100.0% | 100.0% | +0.0pp |
| committees | 100.0% | 100.0% | +0.0pp |
| debates | 80.0% | 95.0% | +15.0pp |
| guidance | 100.0% | 100.0% | +0.0pp |
| legislation | 55.7% | 63.0% | +7.3pp |
| **macro avg** | 87.1% | 91.6% | +4.5pp |
| **micro avg** | 76.1% | 83.1% | +7.0pp |

**No stream regresses.** The whole of the effect comes from debates and legislation — the other 3 streams are already at ceiling at 0.7 and simply stay there.

## What this does NOT establish

- **It is not a licence to turn the flag on.** This is a retrieval-quality measurement taken offline against the Lance tables. `LEX_SEARCH_VECTOR` stays OFF, and flipping it remains Charlie's call.
- **The three drafted-question streams still have unvalidated answer keys.** The 6 Aug pass validated the gold set, and the gold set has no questions for committees, caselaw or guidance. Their *shape* (vector beats BM25, 0.5 is fine) is informative; their absolute recall is not.
- **It is a recall@20 result only.** Nothing here measures precision, latency, or cost, and the vector arm currently has no deployed serving path at all.
- **The grid is discrete.** 0.5 is an interior maximum on a 0.1-ish grid, not a continuously optimised value; the sweep deliberately extended below 0.5 (0.3, 0.4) so the answer is not an artefact of where the grid stopped.
