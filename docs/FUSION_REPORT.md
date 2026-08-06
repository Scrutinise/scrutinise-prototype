# FUSION TUNING — weighted RRF vs kind-based routing: decision report

> ## ⛔ SUPERSEDED ON THE WEIGHT — 6 Aug 2026. The shipped weight is now **0.5, not 0.7**.
> See `GOLD_TEST_08_fusion_weight_decision.md`. This report tuned the weight on the **pilot
> subset** (60k curated rows, exact cosine, n=26). Re-measured on 6 Aug against the current
> full index, per stream, with a validated answer key and a wider grid, 0.5 is the
> best-or-joint-best weight in all five streams and 0.7 is the *worst* fusion weight tested on
> the debates stream (10pp below BM25 alone).
>
> **What in here still stands.** The formula itself (weighted RRF, `RRF_K=60`), the finding
> that routing adds nothing, and the reasoning about the citation-resolver pin. It is the
> *number* that did not survive the move from a curated subset to the real corpus — and the
> specific claim below that "equal weight is NOT the safe default" is the sentence that
> reversed. Read this as the provenance of the method, not as the current setting.

*2026-07-03 22:51 UTC. Follow-up to `PILOT_REPORT.md`: the bake-off found naive equal-weight
RRF actively hurts strong models (hybrid < vector-alone; voyage B6 collapsed 50%→0%), so the
vector flag stayed off pending a fusion fix. This sprint tuned the fusion on the same pilot
subset (no new embedding cost). Numbers: `docs/FUSION_RESULTS.md` + `docs/fusion_tuning.json`;
harness: `scripts/ingest/search/pilot-fusion.ts`. All figures recall@20 excl. the archetype-D
[GRAPH] floor, n=26, same arms/scoring as the pilot (w=0.5 self-checked byte-identical to the
pilot's naive-RRF hybrid for all three models).*

## Decision: ship **weighted RRF at a single fixed 70/30 (vector/BM25)** — routing NOT needed

| gemini (ship model) | recall@20 |
|---|---|
| BM25 (current engine) | 68.3% |
| naive RRF 50/50 (the regression the pilot flagged) | 84.3% |
| vector-alone | 85.9% |
| **weighted RRF 70/30** | **87.8%** |
| best kind-routed (full grid) | 87.8% (tie) |

**Weighted RRF at 70/30 beats everything** — naive RRF (+3.5pp), vector-alone (+1.9pp), and
BM25 (+19.5pp). It resolves the pilot's blocker: fusion is no longer a regression against
vector-alone, it is strictly the best arm.

**A single fixed weight is competitive with kind-based routing — routing adds exactly nothing.**
The full (wCit, wCon) grid over the `parseCitation()` router tops out at 87.8%, the same as
fixed 70/30 (several routed combos tie it; none beat it). The reason: at 70/30 the BM25
citation-resolver pin still survives fusion, so citation queries keep 100% *without* being
routed to a BM25-heavy arm. Routing only becomes necessary if the fixed weight were pushed to
≥80/20, where A1 ("Section 21 Housing Act 1988") drops 100%→50% — dilution drowning the pin.
70/30 is the sweet spot where both signals coexist. Simpler system, same recall: **no router**.

## Why 70/30 and not higher/lower

- **≤50/50 under-weights the vector**: B (lay concept) falls from 69.4% to 59.7% at 50/50 and
  40.3% at 30/70 — surrendering the vocabulary-bridge win the vector layer exists for.
- **≥80/20 breaks citations**: A drops 100%→90% (A1 100→50) — the exact-section pin gets
  diluted out of the top 20.
- **70/30 sits on a plateau, not a spike**: 60/40 = 85.3%, 70/30 = 87.8%, 80/20 = 85.9% — the
  ±10 neighbours are within ~2.5pp, so the choice is robust to gold-set noise. At 70/30 the
  gemini profile is A 100% · B 69.4% (equal to vector-alone's best) · B6 50% · C 93.3% ·
  E 100% · F 80%.
- **Fusion at 70/30 is synergistic, not interpolation**: it beats vector-alone on A (100 vs
  90), C1 (66.7 vs 66.7 — from BM25's exact-term hits surviving), and E1/D4/D5, while keeping
  every vector win. The only per-query cost vs naive is F5 (100→50, one bill query where BM25
  chatter was actually right).

## Robustness checks

- **voyage confirms the direction** — its optimum is also vector-heavy (80/20 = 86.9%), and the
  weighting **fixes the B6 collapse** the pilot flagged (naive 0% → 33.3% at 70/30–80/20). The
  vector-heavy prescription generalises across strong models, it is not a gemini quirk.
- **e5 confirms the mechanism** — the weak model's optimum stays at naive 50/50 (77.2%), i.e.
  the right weight tracks the vector arm's strength. If the embed model is ever swapped, the
  weight needs re-tuning (one cheap re-run of `pilot-fusion.ts`).
- **Router over-trigger noted, harmless**: `parseCitation()` fires on 12/31 queries including
  E1/E3/E5 (debate queries that merely *name* an Act) and all D floors. In the routed grid this
  over-trigger cost nothing at vector-leaning wCit — but it is another reason to prefer the
  no-router design: the production signal is blunter than "citation lookup".

## What to ship (the flag-flip spec)

1. Fusion = weighted RRF, `score = 0.7/(60+rank_vec) + 0.3/(60+rank_bm25)` (RRF_K=60 as
   piloted), over the BM25 arm **including the citation-resolver pin** (it is what holds
   A at 100%).
2. No query-kind router in the fusion layer. (The existing production scoping — expansion on
   Page-1 keywords, not citation lookups — is orthogonal and stays.)
3. Weight as config, not constant (`LEX_FUSION_VECTOR_WEIGHT`, default 0.7), so the full-corpus
   re-measure can adjust without a deploy.

## Caveats

- Same pilot caveats as `PILOT_REPORT.md`: gold expected-sources are the unvalidated draft;
  n=26 recall queries; 60k-section subset, exact cosine (production ANN adds its own recall
  tradeoff). 70/30 should be re-confirmed on the full-corpus index once embedded — but the
  plateau (60/40–80/20 all ≥85.3%) means the flag-flip decision does not hang on the re-run.
- F5's 100→50 regression is the one watch-item; it is a BILLS-stream query, worth an eye when
  the bills tier is re-ranked.

## Reproduce

```
tsx search/pilot-fusion.ts   # → docs/FUSION_RESULTS.md + docs/fusion_tuning.json
```
Requires the pilot Lance tables (`pilot_chunks`, `pilot_vec_*`) still on R2 and the provider
keys in `scrutinise-web/.env`. Weights grid + RRF_K env-overridable (`PILOT_RRF_K`).
