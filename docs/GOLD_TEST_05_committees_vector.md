# GOLD_TEST_05_committees_vector — committees stream, BM25 vs vector vs fusion

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

*Generated 2026-08-06T09:22:29.006Z. Offline against the Lance tables (`corpus_fts`, `corpus_vec`) — no HTTP path, nothing deployed. Both arms prefiltered to `tier='parliamentary'`, matching query-router.ts::fusedStream. CAND_K=100, RRF_K=60, recall@20. Model gemini-embedding-001 @768d.*

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
| 30/70 | 100.0% **← best** | +0.0pp |
| 40/60 | 100.0% **← best** | +0.0pp |
| 50/50 | 100.0% **← best** | +0.0pp |
| 60/40 | 100.0% **← best** | +0.0pp |
| 70/30 ←prior default | 100.0% **← best** | +0.0pp |
| 80/20 | 100.0% **← best** | +0.0pp |
| vector only | 100.0% **← best** | +0.0pp |

**Best weight in this sweep: BM25 only, 30/70, 40/60, 50/50, 60/40, 70/30, 80/20, vector only — tied at 100.0%.** The prior default 0.7 scores 100.0% (+0.0pp vs BM25 alone); the best weight beats it by +0.0pp.

## Per query

| id | query | BM25 | vector | 70/30 (prior) | best-in-sweep |
|---|---|---|---|---|---|
| CM1 *(draft)* | What did MPs conclude were the causes of the collapse of Carillion? | 100.0% | 100.0% | 100.0% | 100.0% |
| CM2 *(draft)* | Why were failures in the Post Office Horizon IT system not addressed f… | 100.0% | 100.0% | 100.0% | 100.0% |
| CM3 *(draft)* | What evidence was given about the effects of the two-child limit on ch… | 100.0% | 100.0% | 100.0% | 100.0% |
| CM4 *(draft)* | What did committees find caused the failures in the UK response to the… | 100.0% | 100.0% | 100.0% | 100.0% |
