# GOLD_TEST_07_guidance_vector — guidance stream, BM25 vs vector vs fusion

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

*Generated 2026-08-06T09:25:12.814Z. Offline against the Lance tables (`corpus_fts`, `corpus_vec`) — no HTTP path, nothing deployed. Both arms prefiltered to `tier='guidance'`, matching query-router.ts::fusedStream. CAND_K=100, RRF_K=60, recall@20. Model gemini-embedding-001 @768d.*

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
| 30/70 | 100.0% **← best** | +12.5pp |
| 40/60 | 100.0% **← best** | +12.5pp |
| 50/50 | 100.0% **← best** | +12.5pp |
| 60/40 | 100.0% **← best** | +12.5pp |
| 70/30 ←prior default | 100.0% **← best** | +12.5pp |
| 80/20 | 100.0% **← best** | +12.5pp |
| vector only | 100.0% **← best** | +12.5pp |

**Best weight in this sweep: 30/70, 40/60, 50/50, 60/40, 70/30, 80/20, vector only — tied at 100.0%.** The prior default 0.7 scores 100.0% (+12.5pp vs BM25 alone); the best weight beats it by +0.0pp.

## Per query

| id | query | BM25 | vector | 70/30 (prior) | best-in-sweep |
|---|---|---|---|---|---|
| GD1 *(draft)* | How does HMRC decide whether a contractor counts as employed or self-e… | 100.0% | 100.0% | 100.0% | 100.0% |
| GD2 *(draft)* | What must a financial firm do when a customer complains? | 50.0% | 100.0% | 100.0% | 100.0% |
| GD3 *(draft)* | When do I have to tell the regulator about a personal data breach? | 100.0% | 100.0% | 100.0% | 100.0% |
| GD4 *(draft)* | What are the rules about political advertising on television? | 100.0% | 100.0% | 100.0% | 100.0% |
