# GOLD_TEST_03_fusion_reweight — legislation stream, BM25 vs vector vs fusion

> ## ✅ ANSWER KEY VALIDATED — 6 Aug 2026
> **Charlie's answer-key validation pass completed 6 Aug 2026.** It covered archetypes A, C, D, E
> and F (B was validated in June/July), and these numbers are **confirmed, not provisional**.
> They are measured against `corpus_fts` as it stands AFTER both of this week's index changes —
> the 4 Aug coverage fix (1,191,345 rows merged) and the 5 Aug dedup (19,161 rows removed, which
> moved BM25 document frequencies) — so the re-score those changes required has been done, not
> deferred. The superseded figures in `VECTOR_FULL_RECONFIRM.md` do not apply.
> **The flag stays OFF.** This is measurement, not a live decision.

*Generated 2026-08-06T09:18:14.764Z. Offline against the Lance tables (`corpus_fts`, `corpus_vec`) — no HTTP path, nothing deployed. Both arms prefiltered to `tier='legislation'`, matching query-router.ts::fusedStream. CAND_K=100, RRF_K=60, recall@20. Model gemini-embedding-001 @768d.*

**Stream note.** A citation-lookup, B concept-bridge (the vector target), C policy sweep.

## Weight sweep

| weight (vector/BM25) | recall@20 | vs BM25-only |
|---|---|---|
| BM25 only | 43.8% | — |
| 30/70 | 49.0% | +5.2pp |
| 40/60 | 49.0% | +5.2pp |
| 50/50 | 63.0% **← best** | +19.3pp |
| 60/40 | 57.8% | +14.1pp |
| 70/30 ←prior default | 55.7% | +12.0pp |
| 80/20 | 55.7% | +12.0pp |
| vector only | 52.6% | +8.9pp |

**Best weight in this sweep: 50/50 at 63.0%.** The prior default 0.7 scores 55.7% (+12.0pp vs BM25 alone); the best weight beats it by +7.3pp.

## Per query

| id | query | BM25 | vector | 70/30 (prior) | best-in-sweep |
|---|---|---|---|---|---|
| A1 | Section 21 Housing Act 1988 | 100.0% | 50.0% | 100.0% | 100.0% |
| A2 | What does section 1 of the Theft Act 1968 actually say? | 50.0% | 100.0% | 100.0% | 100.0% |
| A3 | Working Time Regulations 1998 | 100.0% | 100.0% | 100.0% | 100.0% |
| A4 | Equality Act 2010 section 149 | 50.0% | 100.0% | 100.0% | 100.0% |
| A5 | Find me the law that says you have to wear a seatbelt | 50.0% | 100.0% | 100.0% | 100.0% |
| B1 | Can my landlord kick me out without giving a reason? | 0.0% | 25.0% | 25.0% | 25.0% |
| B2 | I want to stop people renting out whole houses as Airbnbs all year rou… | 0.0% | 0.0% | 0.0% | 0.0% |
| B3 | Is it illegal to take a photo of someone in public without their permi… | 0.0% | 33.3% | 33.3% | 33.3% |
| B4 | Statutory duty of candour — who does it bind and where is it heading? | 50.0% | 0.0% | 0.0% | 50.0% |
| B5 | What are the rules about how much noise my neighbours can make at nigh… | 33.3% | 33.3% | 33.3% | 66.7% |
| C1 | Everything currently regulating short-term holiday lets in England | 33.3% | 66.7% | 66.7% | 66.7% |
| C2 | What laws govern e-scooters? | 100.0% | 33.3% | 33.3% | 33.3% |
| C3 | The statutory framework for adult social care funding in England | 0.0% | 33.3% | 33.3% | 33.3% |
| C4 | What duties do water companies have about sewage discharges, and where… | 66.7% | 66.7% | 66.7% | 66.7% |
| C5 | What protections do people who live in park homes / mobile homes have? | 66.7% | 66.7% | 66.7% | 100.0% |
| B6 | I want to revoke MiFID II | 0.0% | 33.3% | 33.3% | 33.3% |
