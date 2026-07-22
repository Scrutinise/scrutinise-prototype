# VECTOR_NPROBES_DIAG — query-time recovery diagnostic (2026-07-21)

*Investigates whether the vector-alone recall regression found in `VECTOR_FULL_RECONFIRM.md` (71.2% full-index vs 85.9% pilot subset) is fixable with a query-time knob (nprobes/refineFactor) or reflects a structurally degraded index from skipping fragment compaction. Read-only, no rebuild, no spend.*

## Self-test — proving the mixer before trusting "fused == vector at all weights"

- Self-test A (pure `fuseWeighted`): w=0 reproduces BM25 order, w=1 reproduces vector order, w=0.5 differs from both — **PASS**
- Self-test B (live wiring, A1+B1 vs the stored sweep): **PASS**

## nprobes sweep (refineFactor=2, production default)

| nprobes | overall excl-floor | A | B (lay concept) | C | D | E | F | mean ANN latency |
|---|---|---|---|---|---|---|---|---|
| 24 (baseline) | **71.2%** | 80.0% | 30.6% | 93.3% | 86.7% | 90.0% | 70.0% | 31137ms |
| 64 | **69.9%** | 90.0% | 30.6% | 86.7% | 86.7% | 80.0% | 70.0% | 8311ms |
| 128 | **69.9%** | 90.0% | 30.6% | 86.7% | 86.7% | 80.0% | 70.0% | 7535ms |
| 256 | **71.2%** | 90.0% | 36.1% | 86.7% | 86.7% | 80.0% | 70.0% | 5239ms |
| 512 | **71.2%** | 90.0% | 36.1% | 86.7% | 86.7% | 80.0% | 70.0% | 6001ms |

## refineFactor sweep @ nprobes=24 (best from the sweep above)

| refineFactor | overall excl-floor | mean ANN latency |
|---|---|---|
| 2 | **71.2%** | 31137ms |
| 4 | **71.2%** | 2805ms |

## Verdict

*Yardstick: BM25-alone's full-index recall is 62.2% vs the pilot's 68.3% (−6.1pp) — that gap is the expected corpus-scale control (16.5M rows of real distractors vs the pilot's 60k-row curated subset), not a defect. "Recovered" for vector-alone means landing near ~80%, not chasing the pilot's exact-cosine 85.9% (ANN always trades some recall for speed, and the full corpus is a harder retrieval problem than the subset).*

**Baseline (nprobes=24): 71.2%. Best setting (nprobes=24, refineFactor=2): 71.2%. Verdict: PARTIAL.**
