# GOLD_TEST_06_caselaw_vector — caselaw stream, BM25 vs vector vs fusion

> ## ⚠ PROVISIONAL — NOT A FINAL NUMBER
> Charlie's answer-key validation pass is **outstanding**, and `corpus_fts` changed twice this week
> (coverage fix 4 Aug: 1,191,345 rows merged; dedup 5 Aug: 19,161 rows removed, which moved BM25
> document frequencies). A confirmatory re-score is required once the validation lands.
>
> **PROVISIONAL TWICE OVER:** this stream has no gold questions, so the questions below were
> **drafted by CC** and are themselves unvalidated. Review them before trusting any number here.
> **The flag stays OFF.** This is measurement, not a live decision.

*Generated 2026-08-06T05:57:53.958Z. Offline against the Lance tables (`corpus_fts`, `corpus_vec`) — no HTTP path, nothing deployed. Both arms prefiltered to `tier='caselaw'`, matching query-router.ts::fusedStream. CAND_K=100, RRF_K=60, recall@20. Model gemini-embedding-001 @768d.*

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
| 50/50 | 100.0% **← best** | +12.5pp |
| 60/40 | 100.0% | +12.5pp |
| 70/30 ←carried | 100.0% | +12.5pp |
| 80/20 | 100.0% | +12.5pp |
| vector only | 100.0% | +12.5pp |

**Best weight in this sweep: 50/50 at 100.0%.** Carried weight 0.7 scores 100.0% (+12.5pp vs BM25 alone).

## Per query

| id | query | BM25 | vector | 70/30 | best-in-sweep |
|---|---|---|---|---|---|
| CL1 *(draft)* | What is the test for whether a public body’s decision is so unreasonab… | 50.0% | 100.0% | 100.0% | 100.0% |
| CL2 *(draft)* | When is a consultation by a public authority unlawful because it was i… | 100.0% | 100.0% | 100.0% | 100.0% |
| CL3 *(draft)* | Can the government suspend Parliament to avoid scrutiny? | 100.0% | 100.0% | 100.0% | 100.0% |
| CL4 *(draft)* | How do courts decide if someone driving for an app is an employee or s… | 100.0% | 100.0% | 100.0% | 100.0% |
