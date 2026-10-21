# SEARCH — where things stand, 19 October 2026

*Report only; nothing fixed. Reads taken 19 Oct from the repository, production `/api/health` (commit `0d83f18`) and the Neon ledger (read-only). From now on Search sprints are named SEARCH-28, SEARCH-29.*

## 1. Every Search sprint and report since 25 September

| Date | Sprint | One line |
|---|---|---|
| 25 Sep | S20b | Search inside one document: built, measured, makes things worse, flag off. |
| 24–25 Sep | S21, S22 | Web orientation made provider-independent; chat web search, source attribution, alerts, orphaned-hit handling. |
| 25 Sep | S23 | Bill amendment papers: ingested versus reachable measured. Only 5 of 10 reach the user. |
| 25 Sep | S24 | Router bill vocabulary built (flag off); Google redirect links resolved; orphaned hits excluded. |
| 25–26 Sep | S24b | Grok key on the build worker; Anthropic web-search adapter. |
| 26 Sep | **S25** | **Charlie's last report.** Daily £ cost digest; alert flood stopped; OpenAI web-search adapter. |
| 27 Sep | S26 | Brief written (the three-round research sequence). **No code, no measurement, no report.** |
| 11 Oct | S27 | Report only (not committed): router vocabulary re-measured, "what amended this Act" unanswerable, tool specified. |

No Search commit exists after 26 Sep. S27 was never committed and was written after S25, so Charlie may not have seen it.

## 2. The items you asked about

**Web orientation produced a non-empty result on a real idea since 27 Sept: NOT DONE.**
- The switch is on in production (`LEX_WEB_ORIENTATION: true`). The last stored run is 23 Sep and is empty. All four orientation records ever stored have no arguments and no comparisons.
- 12 provider calls were billed in the week of 21 Sep (£0.09); none after 27 Sep.
- Why: orientation only fires from the old Page 1 "accept keywords" step. **No idea has been created since 27 Sep** (0 rows), and the Lex builds since then do not call it. S26's rewrite of it was never started. I have not investigated why the 23 Sep run came back empty.

**S26 research sequence: NOT STARTED.**
- Built: nothing for stages 1–3. The brief is in `docs/SPRINT.md` (uncommitted). Prediction and with/without-vocabulary gold measurement: not run.
- Hand-over for Lex, `docs/HANDOVER_RESEARCH_SEQUENCE.md`: **does not exist.** `BRIEF_26K.md` told the Lex stream to expect it, so Lex has been waiting on a file that was never written.
- Parts that exist from S25: the OpenAI adapter (code complete; I did not check for a live run). The Lex stream separately built a four-model digest for actions (26-T1); that is not the S26 stage 3.

**Search inside one document (S20b): DONE (measured), flag off.**
- Measured 25 Sep, 65 gold questions: right section shown 29 and 27 with the flag off (the spread is noise), 25 with it on. A real regression (legislation 5→3, debates 3→2). `LEX_SEARCH_WITHIN_DOC: false` in production.

**Router bill vocabulary (`LEX_ROUTER_BILL_VOCAB`): DONE (built, measured), OFF in production.**
- Hit rate on S23's ten bill questions, S27 run 11 Oct (3 rolls each): **5 of 10 off, 10 of 10 on.** Today's `/api/health` still reads false. Cost when on: S24 measured about 8 of 68 gold questions losing a stream against 3 of 68 noise; not re-measured.

**Gold-question documents waiting for Charlie: PARTLY DONE, four open, copied to `docs/FOR_CHARLIE/`.**

| File | What he does | Time |
|---|---|---|
| `1_committees_rekey_S17.md` | Verdict on the ten committee answer-key re-keys (S17 D-2, since 27 Aug) | ~30 min |
| `2_debates_rekey_S13.md` | Fill in eleven blank verdicts on debates keys (since 24 Aug) | ~30 min |
| `3_costing_questions_S18.md` | Validate eight costing questions (since 7 Sep) | ~20 min |
| `4_impact_assessments_S18_decision.md` | Answer D-1: re-key the nine impact-assessment questions, yes/no. No re-key file exists yet | ~5 min |

- **Treaty questions (S19 Q3): no document exists.** Nobody has written the 5–8 questions; it needs writing, not checking. 3,588 treaty sections stay unreachable until it is done.
- Every number in S19 and S20b is stamped pre-re-key and will move when these land.
- Not opened: `GOLD_KEY_VALIDATION_REVIEW.docx` (14 Sep) looks like the first gold set; I assumed it was settled.
