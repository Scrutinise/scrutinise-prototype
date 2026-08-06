# GOLD_TEST_07_guidance_vector — guidance stream, BM25 vs vector vs fusion

> ## ⚠ PROVISIONAL — NOT A FINAL NUMBER
> Charlie's answer-key validation pass is **outstanding**, and `corpus_fts` changed twice this week
> (coverage fix 4 Aug: 1,191,345 rows merged; dedup 5 Aug: 19,161 rows removed, which moved BM25
> document frequencies). A confirmatory re-score is required once the validation lands.
>
> **PROVISIONAL TWICE OVER:** this stream has no gold questions, so the questions below were
> **drafted by CC** and are themselves unvalidated. Review them before trusting any number here.
> **The flag stays OFF.** This is measurement, not a live decision.

*Generated 2026-08-06T05:59:26.494Z. Offline against the Lance tables (`corpus_fts`, `corpus_vec`) — no HTTP path, nothing deployed. Both arms prefiltered to `tier='guidance'`, matching query-router.ts::fusedStream. CAND_K=100, RRF_K=60, recall@20. Model gemini-embedding-001 @768d.*

**Stream note.** Archetype G is `lesson`-metric with 0 scoreable. Scored on CC-DRAFTED questions.

## ⚠ DRAFTED QUESTIONS — please confirm or correct

These are CC's drafts, presented here rather than as a separate round-trip so they can be waved through alongside the results. If a question is wrong, its row below is meaningless.

| id | question | why it tests this stream | expected sources |
|---|---|---|---|
| GD1 | How does HMRC decide whether a contractor counts as employed or self-employed for tax? | The answer lives in HMRC manuals, not in the Act — tests that guidance wins where it should. | HMRC employment status manual; The named status tests |
| GD2 | What must a financial firm do when a customer complains? | FCA DISP is the operative rulebook; statute alone would be the wrong answer. | FCA Handbook DISP; The DISP time limits |
| GD3 | When do I have to tell the regulator about a personal data breach? | ICO guidance carries the operational 72-hour rule; tests guidance-over-statute retrieval. | ICO personal data breach guidance; The 72-hour reporting duty |
| GD4 | What are the rules about political advertising on television? | Ofcom Broadcasting Code; a lay question whose answer is a regulator code section. | Ofcom Broadcasting Code; Section 320 / the political-advertising ban |

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
| GD1 *(draft)* | How does HMRC decide whether a contractor counts as employed or self-e… | 100.0% | 100.0% | 100.0% | 100.0% |
| GD2 *(draft)* | What must a financial firm do when a customer complains? | 50.0% | 100.0% | 100.0% | 100.0% |
| GD3 *(draft)* | When do I have to tell the regulator about a personal data breach? | 100.0% | 100.0% | 100.0% | 100.0% |
| GD4 *(draft)* | What are the rules about political advertising on television? | 100.0% | 100.0% | 100.0% | 100.0% |
