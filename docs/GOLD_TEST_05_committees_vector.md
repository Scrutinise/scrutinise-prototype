# GOLD_TEST_05_committees_vector — committees stream, BM25 vs vector vs fusion

> ## ⚠ PROVISIONAL — NOT A FINAL NUMBER
> Charlie's answer-key validation pass is **outstanding**, and `corpus_fts` changed twice this week
> (coverage fix 4 Aug: 1,191,345 rows merged; dedup 5 Aug: 19,161 rows removed, which moved BM25
> document frequencies). A confirmatory re-score is required once the validation lands.
>
> **PROVISIONAL TWICE OVER:** this stream has no gold questions, so the questions below were
> **drafted by CC** and are themselves unvalidated. Review them before trusting any number here.
> **The flag stays OFF.** This is measurement, not a live decision.

*Generated 2026-08-06T05:56:13.470Z. Offline against the Lance tables (`corpus_fts`, `corpus_vec`) — no HTTP path, nothing deployed. Both arms prefiltered to `tier='parliamentary'`, matching query-router.ts::fusedStream. CAND_K=100, RRF_K=60, recall@20. Model gemini-embedding-001 @768d.*

**Stream note.** No gold coverage exists. Scored on CC-DRAFTED questions — see the review table at the top.

## ⚠ DRAFTED QUESTIONS — please confirm or correct

These are CC's drafts, presented here rather than as a separate round-trip so they can be waved through alongside the results. If a question is wrong, its row below is meaningless.

| id | question | why it tests this stream | expected sources |
|---|---|---|---|
| CM1 | What did MPs conclude were the causes of the collapse of Carillion? | A joint-committee inquiry IS the authoritative account of the causes; no statute or judgment answers it. | Carillion inquiry report (BEIS + Work and Pensions); The inquiry’s own findings on audit/pensions |
| CM2 | Why were failures in the Post Office Horizon IT system not addressed for so long? | Tests whether committee evidence sessions surface for a causal question about institutional failure. | Post Office / Horizon committee work; The Horizon-specific findings |
| CM3 | What evidence was given about the effects of the two-child limit on child poverty? | An effects question whose best source is submitted written/oral evidence rather than a report conclusion. | Two-child limit evidence; The policy-specific evidence |
| CM4 | What did committees find caused the failures in the UK response to the coronavirus pandemic? | The "lessons learned" joint report is a pure causes-and-effects artefact of the committee stream. | Coronavirus: lessons learned to date; The inquiry’s named conclusions |

## Weight sweep

| weight (vector/BM25) | recall@20 | vs BM25-only |
|---|---|---|
| BM25 only | 100.0% **← best** | — |
| 50/50 | 100.0% | +0.0pp |
| 60/40 | 100.0% | +0.0pp |
| 70/30 ←carried | 100.0% | +0.0pp |
| 80/20 | 100.0% | +0.0pp |
| vector only | 100.0% | +0.0pp |

**Best weight in this sweep: BM25 only at 100.0%.** Carried weight 0.7 scores 100.0% (+0.0pp vs BM25 alone).

## Per query

| id | query | BM25 | vector | 70/30 | best-in-sweep |
|---|---|---|---|---|---|
| CM1 *(draft)* | What did MPs conclude were the causes of the collapse of Carillion? | 100.0% | 100.0% | 100.0% | 100.0% |
| CM2 *(draft)* | Why were failures in the Post Office Horizon IT system not addressed f… | 100.0% | 100.0% | 100.0% | 100.0% |
| CM3 *(draft)* | What evidence was given about the effects of the two-child limit on ch… | 100.0% | 100.0% | 100.0% | 100.0% |
| CM4 *(draft)* | What did committees find caused the failures in the UK response to the… | 100.0% | 100.0% | 100.0% | 100.0% |
