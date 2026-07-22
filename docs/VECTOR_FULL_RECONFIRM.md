# VECTOR_FULL_RECONFIRM — fusion/recall re-confirm on the full-corpus ANN index

*Generated 2026-07-21T22:08:06.054Z. Real production indexes: `corpus_fts` (16509051 rows, BM25 live) + `corpus_vec` (21846364 vectors, IVF_PQ ANN, built 2026-07-21 with `VECTOR_SKIP_COMPACT=true` — see handoff CURRENT STATE for the caveat this run validates). CAND_K=100, RRF_K=60. Model gemini-embedding-001 @768d, query embedded live (RETRIEVAL_QUERY task type). Scored on the same 31-query scoreable recall@20 gold set as `score-fts.ts`/`pilot-fusion.ts` (excl.-floor n=26).*

## Headline — shipped weight (0.7) vs the pilot subset measurement

| arm | full-index (this run) | pilot subset (60k rows, exact cosine) | delta |
|---|---|---|---|
| BM25-alone | 62.2% | 68.3% | -6.1pp |
| vector-alone | 71.2% | 85.9% | -14.7pp |
| **fused 70/30 (SHIPPED)** | **71.2%** | 87.8% | -16.7pp |

**Read:** a large negative delta on vector-alone or fused vs the pilot is the signal for the compaction-skip caveat (degraded ANN partitioning). A small/positive delta means the un-compacted index is fine and the earlier kmeans warnings were benign chatter at this scale.

## Full weight sweep (this run, full index)

| w (vec/BM25) | overall excl-floor | A (citation) | B (lay concept) | B6 | C | E | F |
|---|---|---|---|---|---|---|---|
| 0/100 (BM25) | **62.2%** | 60.0% | 27.8% | 0.0% | 60.0% | 80.0% | 90.0% |
| 50/50 | **70.5%** | 80.0% | 30.6% | 16.7% | 80.0% | 90.0% | 80.0% |
| 60/40 | **69.9%** | 80.0% | 30.6% | 16.7% | 86.7% | 90.0% | 70.0% |
| 70/30 (SHIPPED) | **71.2%** | 80.0% | 30.6% | 16.7% | 93.3% | 90.0% | 70.0% |
| 80/20 | **71.2%** | 80.0% | 30.6% | 16.7% | 93.3% | 90.0% | 70.0% |
| 90/10 | **71.2%** | 80.0% | 30.6% | 16.7% | 93.3% | 90.0% | 70.0% |
| 100/0 (vector) | **71.2%** | 80.0% | 30.6% | 16.7% | 93.3% | 90.0% | 70.0% |

## By archetype at the shipped weight (0.7)

| archetype | stream | recall@20 | n |
|---|---|---|---|
| A | legislation | 80.0% | 5 |
| B | legislation | 30.6% | 6 |
| C | legislation + guidance | 93.3% | 5 |
| D | citation graph | 100.0% | 5 |
| E | debates | 90.0% | 5 |
| F | bills + debates | 70.0% | 5 |

## Per-query detail (w=0.7)

| id | archetype | recall@20 (fused 0.7) | recall@20 (vector-alone) | recall@20 (BM25-alone) |
|---|---|---|---|---|
| A1 | A | 50.0% | 50.0% | 100.0% |
| A2 | A | 100.0% | 100.0% | 50.0% |
| A3 | A | 100.0% | 100.0% | 100.0% |
| A4 | A | 50.0% | 50.0% | 50.0% |
| A5 | A | 100.0% | 100.0% | 0.0% |
| B1 | B | 0.0% | 0.0% | 0.0% |
| B2 | B | 0.0% | 0.0% | 0.0% |
| B3 | B | 0.0% | 0.0% | 0.0% |
| B4 | B | 100.0% | 100.0% | 100.0% |
| B5 | B | 66.7% | 66.7% | 66.7% |
| C1 | C | 66.7% | 66.7% | 33.3% |
| C2 | C | 100.0% | 100.0% | 66.7% |
| C3 | C | 100.0% | 100.0% | 33.3% |
| C4 | C | 100.0% | 100.0% | 66.7% |
| C5 | C | 100.0% | 100.0% | 100.0% |
| D1 | D·fl | 100.0% | 100.0% | 50.0% |
| D2 | D·fl | 100.0% | 100.0% | 100.0% |
| D3 | D·fl | 100.0% | 100.0% | 100.0% |
| D4 | D·fl | 100.0% | 33.3% | 33.3% |
| D5 | D·fl | 100.0% | 100.0% | 100.0% |
| E1 | E | 100.0% | 100.0% | 50.0% |
| E2 | E | 100.0% | 100.0% | 100.0% |
| E3 | E | 100.0% | 100.0% | 100.0% |
| E4 | E | 50.0% | 50.0% | 50.0% |
| E5 | E | 100.0% | 100.0% | 100.0% |
| F1 | F | 100.0% | 100.0% | 100.0% |
| F2 | F | 100.0% | 100.0% | 100.0% |
| F3 | F | 50.0% | 50.0% | 100.0% |
| F4 | F | 50.0% | 50.0% | 50.0% |
| F5 | F | 50.0% | 50.0% | 100.0% |
| B6 | B | 16.7% | 16.7% | 0.0% |
