# VECTOR_FULL_RECONFIRM — fusion/recall re-confirm on the full-corpus ANN index

> ## ⛔ SUPERSEDED — 6 Aug 2026. Every number below was measured against an index that no
> ## longer exists, at a weight that is no longer shipped.
> Two index changes have landed since: the **4 Aug coverage fix** (1,191,345 un-indexed rows
> merged) and the **5 Aug dedup/orphan removal** (19,161 rows removed, which moved BM25
> document frequencies and therefore every BM25 rank the fusion consumes). The shipped weight
> also moved from 0.7 to **0.5** on 6 Aug.
>
> Current figures: `GOLD_TEST_03`–`07` per stream and `GOLD_TEST_08_fusion_weight_decision.md`
> for the weight. **Do not quote "fused 71.2%" as a current number** — it is neither the
> current index nor the current weight nor the current (per-stream) retrieval path.
>
> **What still stands, and it is the important part:** the headline finding that compaction was
> *not* the bottleneck, and that something caps full-index vector recall well below the pilot
> subset. That diagnosis is unaffected by either index change.

*Generated 2026-07-22T17:13:07.738Z. Real production indexes: `corpus_fts` (16509051 rows, BM25 live) + `corpus_vec` (21846364 vectors, IVF_PQ ANN). **This run is POST-REBUILD**: `corpus_vec` was properly compacted (1,821 fragments → 40, no `VECTOR_SKIP_COMPACT`) and reindexed on a 128GB Vultr box on 2026-07-22 — see handoff CURRENT STATE. Reproduced twice (two independent runs against the rebuilt index both landed at vector-alone 70.5% / fused 71.2%, bit-for-bit). Compare against the PRE-rebuild numbers this harness produced on 2026-07-21 (vector-alone 71.2%, fused 71.2%) — the properly-compacted rebuild did NOT move the needle. **Headline finding: compaction was not the actual bottleneck** — something else caps full-index vector recall around ~70-71%, most likely an inherent gap between ANN over 21.8M diverse real sections and the pilot's exact-cosine search over a curated 60k-row subset, not a build-quality defect. CAND_K=100, RRF_K=60. Model gemini-embedding-001 @768d, query embedded live (RETRIEVAL_QUERY task type). Scored on the same 31-query scoreable recall@20 gold set as `score-fts.ts`/`pilot-fusion.ts` (excl.-floor n=26).*

## Headline — shipped weight (0.7) vs the pilot subset measurement

| arm | full-index (this run) | pilot subset (60k rows, exact cosine) | delta |
|---|---|---|---|
| BM25-alone | 62.2% | 68.3% | -6.1pp |
| vector-alone | 70.5% | 85.9% | -15.4pp |
| **fused 70/30 (SHIPPED)** | **71.2%** | 87.8% | -16.7pp |

**Read:** a large negative delta on vector-alone or fused vs the pilot is the signal for the compaction-skip caveat (degraded ANN partitioning). A small/positive delta means the un-compacted index is fine and the earlier kmeans warnings were benign chatter at this scale.

## Full weight sweep (this run, full index)

| w (vec/BM25) | overall excl-floor | A (citation) | B (lay concept) | B6 | C | E | F |
|---|---|---|---|---|---|---|---|
| 0/100 (BM25) | **62.2%** | 60.0% | 27.8% | 0.0% | 60.0% | 80.0% | 90.0% |
| 50/50 | **75.6%** | 90.0% | 30.6% | 16.7% | 86.7% | 90.0% | 90.0% |
| 60/40 | **71.2%** | 90.0% | 33.3% | 33.3% | 80.0% | 90.0% | 70.0% |
| 70/30 (SHIPPED) | **71.2%** | 90.0% | 33.3% | 33.3% | 80.0% | 90.0% | 70.0% |
| 80/20 | **69.2%** | 90.0% | 33.3% | 33.3% | 80.0% | 80.0% | 70.0% |
| 90/10 | **70.5%** | 90.0% | 33.3% | 33.3% | 86.7% | 80.0% | 70.0% |
| 100/0 (vector) | **70.5%** | 90.0% | 33.3% | 33.3% | 86.7% | 80.0% | 70.0% |

## By archetype at the shipped weight (0.7)

| archetype | stream | recall@20 | n |
|---|---|---|---|
| A | legislation | 90.0% | 5 |
| B | legislation | 33.3% | 6 |
| C | legislation + guidance | 80.0% | 5 |
| D | citation graph | 76.7% | 5 |
| E | debates | 90.0% | 5 |
| F | bills + debates | 70.0% | 5 |

## Per-query detail (w=0.7)

| id | archetype | recall@20 (fused 0.7) | recall@20 (vector-alone) | recall@20 (BM25-alone) |
|---|---|---|---|---|
| A1 | A | 50.0% | 50.0% | 100.0% |
| A2 | A | 100.0% | 100.0% | 50.0% |
| A3 | A | 100.0% | 100.0% | 100.0% |
| A4 | A | 100.0% | 100.0% | 50.0% |
| A5 | A | 100.0% | 100.0% | 0.0% |
| B1 | B | 0.0% | 0.0% | 0.0% |
| B2 | B | 0.0% | 0.0% | 0.0% |
| B3 | B | 0.0% | 0.0% | 0.0% |
| B4 | B | 100.0% | 100.0% | 100.0% |
| B5 | B | 66.7% | 66.7% | 66.7% |
| C1 | C | 66.7% | 66.7% | 33.3% |
| C2 | C | 100.0% | 100.0% | 66.7% |
| C3 | C | 66.7% | 66.7% | 33.3% |
| C4 | C | 100.0% | 100.0% | 66.7% |
| C5 | C | 66.7% | 100.0% | 100.0% |
| D1 | D·fl | 50.0% | 50.0% | 50.0% |
| D2 | D·fl | 100.0% | 100.0% | 100.0% |
| D3 | D·fl | 100.0% | 100.0% | 100.0% |
| D4 | D·fl | 33.3% | 33.3% | 33.3% |
| D5 | D·fl | 100.0% | 100.0% | 100.0% |
| E1 | E | 100.0% | 100.0% | 50.0% |
| E2 | E | 100.0% | 100.0% | 100.0% |
| E3 | E | 100.0% | 50.0% | 100.0% |
| E4 | E | 50.0% | 50.0% | 50.0% |
| E5 | E | 100.0% | 100.0% | 100.0% |
| F1 | F | 100.0% | 100.0% | 100.0% |
| F2 | F | 100.0% | 100.0% | 100.0% |
| F3 | F | 50.0% | 50.0% | 100.0% |
| F4 | F | 50.0% | 50.0% | 50.0% |
| F5 | F | 50.0% | 50.0% | 100.0% |
| B6 | B | 33.3% | 33.3% | 0.0% |
