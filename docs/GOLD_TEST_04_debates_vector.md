# GOLD_TEST_04_debates_vector — debates stream, BM25 vs vector vs fusion

> ## ✅ ANSWER KEY VALIDATED — 6 Aug 2026
> **Charlie's answer-key validation pass completed 6 Aug 2026.** It covered archetypes A, C, D, E
> and F (B was validated in June/July), and these numbers are **confirmed, not provisional**.
> They are measured against `corpus_fts` as it stands AFTER both of this week's index changes —
> the 4 Aug coverage fix (1,191,345 rows merged) and the 5 Aug dedup (19,161 rows removed, which
> moved BM25 document frequencies) — so the re-score those changes required has been done, not
> deferred. The superseded figures in `VECTOR_FULL_RECONFIRM.md` do not apply.
> **The flag stays OFF.** This is measurement, not a live decision.

*Generated 2026-08-06T09:21:06.336Z. Offline against the Lance tables (`corpus_fts`, `corpus_vec`) — no HTTP path, nothing deployed. Both arms prefiltered to `tier='parliamentary'`, matching query-router.ts::fusedStream. CAND_K=100, RRF_K=60, recall@20. Model gemini-embedding-001 @768d.*

**Stream note.** E legislative intent, F bills+debates. Tier `parliamentary` also holds committees; the router separates them by display type downstream, not by tier.

## Weight sweep

| weight (vector/BM25) | recall@20 | vs BM25-only |
|---|---|---|
| BM25 only | 90.0% | — |
| 30/70 | 95.0% **← best** | +5.0pp |
| 40/60 | 95.0% **← best** | +5.0pp |
| 50/50 | 95.0% **← best** | +5.0pp |
| 60/40 | 90.0% | +0.0pp |
| 70/30 ←prior default | 80.0% | -10.0pp |
| 80/20 | 80.0% | -10.0pp |
| vector only | 75.0% | -15.0pp |

**Best weight in this sweep: 30/70, 40/60, 50/50 — tied at 95.0%.** The prior default 0.7 scores 80.0% (-10.0pp vs BM25 alone); the best weight beats it by +15.0pp.

## Per query

| id | query | BM25 | vector | 70/30 (prior) | best-in-sweep |
|---|---|---|---|---|---|
| E1 | What did ministers say the under-occupancy provisions of the Welfare R… | 100.0% | 100.0% | 100.0% | 100.0% |
| E2 | Why was the sugar tax designed as a levy on manufacturers instead of a… | 100.0% | 100.0% | 100.0% | 100.0% |
| E3 | What assurances were given during the passage of the Investigatory Pow… | 100.0% | 50.0% | 100.0% | 100.0% |
| E4 | Why does the indoor smoking ban not apply to private homes? What was s… | 50.0% | 50.0% | 50.0% | 100.0% |
| E5 | When the Hunting Act 2004 was passed, what did ministers say about how… | 100.0% | 100.0% | 100.0% | 100.0% |
| F1 | Has anyone tried to ban single-use plastics completely? What happened? | 100.0% | 100.0% | 100.0% | 100.0% |
| F2 | Previous Private Members’ Bills attempting to restrict fireworks sales… | 100.0% | 100.0% | 100.0% | 100.0% |
| F3 | I want a law making landlords accept tenants with pets. Has this been … | 100.0% | 50.0% | 50.0% | 100.0% |
| F4 | Attempts since 2010 to introduce proportional representation for Westm… | 50.0% | 50.0% | 50.0% | 50.0% |
| F5 | Has Parliament ever tried to make first aid training compulsory in sch… | 100.0% | 50.0% | 50.0% | 100.0% |
