# GOLD_TEST_06_caselaw_vector — caselaw stream, BM25 vs vector vs fusion

> ## ✅ ANSWER KEY VALIDATED — 6 Aug 2026
> **Charlie's answer-key validation pass completed 6 Aug 2026.** It covered archetypes A, C, D, E
> and F (B was validated in June/July), and these numbers are **confirmed, not provisional**.
> They are measured against `corpus_fts` as it stands AFTER both of this week's index changes —
> the 4 Aug coverage fix (1,191,345 rows merged) and the 5 Aug dedup (19,161 rows removed, which
> moved BM25 document frequencies) — so the re-score those changes required has been done, not
> deferred. The superseded figures in `VECTOR_FULL_RECONFIRM.md` do not apply.
>
> **⚠ ONE CAVEAT STILL STANDS, and the validation pass does not clear it.** That pass reviewed
> the GOLD SET, and the gold set contains no questions for this stream. The questions below are
> still **CC drafts, unvalidated by Charlie**. The answer-key caveat is lifted; this one is not.
> Treat the weight sweep as sound and the absolute recall as untrusted.
> **The flag stays OFF.** This is measurement, not a live decision.

*Generated 2026-08-06T09:23:55.371Z. Offline against the Lance tables (`corpus_fts`, `corpus_vec`) — no HTTP path, nothing deployed. Both arms prefiltered to `tier='caselaw'`, matching query-router.ts::fusedStream. CAND_K=100, RRF_K=60, recall@20. Model gemini-embedding-001 @768d.*

**Stream note.** No gold query anywhere names a caselaw source. Scored on CC-DRAFTED questions.

## ⚠ DRAFTED QUESTIONS — please confirm or correct

These are CC's drafts, presented here rather than as a separate round-trip so they can be waved through alongside the results. If a question is wrong, its row below is meaningless.

| id | question | why it tests this stream | expected sources |
|---|---|---|---|
| CL1 | What is the test for whether a public body’s decision is so unreasonable that a court will overturn it? | Plain-language route to Wednesbury — the H2 vocabulary bridge, but into caselaw rather than statute. | Associated Provincial Picture Houses v Wednesbury; The reformulated GCHQ/irrationality standard |
| CL2 | When is a consultation by a public authority unlawful because it was inadequate? | Tests retrieval of a named doctrinal line (Gunning/Moseley) from a question naming neither. | R (Moseley) v Haringey LBC; The Gunning/Sedley criteria |
| CL3 | Can the government suspend Parliament to avoid scrutiny? | A constitutional question with one decisive authority; a strong signal if vector finds it from lay wording. | R (Miller) v The Prime Minister; Cherry v Advocate General; The named 2019 authority |
| CL4 | How do courts decide if someone driving for an app is an employee or self-employed? | Gig-economy status; tests whether the leading authority surfaces from entirely non-legal wording. | Uber BV v Aslam; The limb (b) worker / Autoclenz line |

## Weight sweep

| weight (vector/BM25) | recall@20 | vs BM25-only |
|---|---|---|
| BM25 only | 87.5% | — |
| 30/70 | 87.5% | +0.0pp |
| 40/60 | 87.5% | +0.0pp |
| 50/50 | 100.0% **← best** | +12.5pp |
| 60/40 | 100.0% **← best** | +12.5pp |
| 70/30 ←prior default | 100.0% **← best** | +12.5pp |
| 80/20 | 100.0% **← best** | +12.5pp |
| vector only | 100.0% **← best** | +12.5pp |

**Best weight in this sweep: 50/50, 60/40, 70/30, 80/20, vector only — tied at 100.0%.** The prior default 0.7 scores 100.0% (+12.5pp vs BM25 alone); the best weight beats it by +0.0pp.

## Per query

| id | query | BM25 | vector | 70/30 (prior) | best-in-sweep |
|---|---|---|---|---|---|
| CL1 *(draft)* | What is the test for whether a public body’s decision is so unreasonab… | 50.0% | 100.0% | 100.0% | 100.0% |
| CL2 *(draft)* | When is a consultation by a public authority unlawful because it was i… | 100.0% | 100.0% | 100.0% | 100.0% |
| CL3 *(draft)* | Can the government suspend Parliament to avoid scrutiny? | 100.0% | 100.0% | 100.0% | 100.0% |
| CL4 *(draft)* | How do courts decide if someone driving for an app is an employee or s… | 100.0% | 100.0% | 100.0% | 100.0% |
