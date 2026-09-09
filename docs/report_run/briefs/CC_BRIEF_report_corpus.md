# CC BRIEF — Report run, corpus track (29 Aug – 2 Sep)

**Stream owner:** CC-Graph
**You are one of two tracks.** A Cowork session owns analysis, drafting and production. You own
everything that needs credentials: Neon, R2, the graph tables, `node_modules`. Nothing you produce is
prose — you produce data files that the other track reads.

**Output location:** `docs/report_run/`. Everything goes there, nowhere else.
**Standing rules apply:** `CLAUDE.md`. No git during a sprint; one commit script at the end.

---

## 1. Why this exists

Charlie is producing a scrutiny report on a proposed constitutional repeal programme, for delivery on
paper by Thursday evening 3 September. The report's first rule is that every assertion resolves to a
corpus row. Your job is to produce those rows, verified, with their evidence attached.

Three measures are worked in full; a fourth is conditional on Tuesday morning.

| ID | Target |
|---|---|
| WS-05 | Constitutional Reform and Governance Act 2010, Part 1 |
| WS-01 | Human Rights Act 1998 |
| WS-04 | Equality Act 2010 |
| WS-02/03 | Constitutional Reform Act 2005 — **conditional, see §5** |

---

## 2. T1 — Reference maps (Saturday, first thing)

For each of WS-05, WS-01, WS-04, run `inbound()` and write:

`docs/report_run/{ws_id}_inbound.json` containing:
- the full row set, every row carrying `citation_text`, `raw_fragment`, `detection`,
  `source_doc_uri`, `source_provision_ref`
- the `coverage` block **exactly as returned**, unedited, with its generation timestamp

`docs/report_run/{ws_id}_inbound.csv` — the same rows, flat, for the analysis track.

⚠ **Do not merge the three `detection` values into a total.** `markup`, `text` and `enabling` are
different strengths of evidence and the report reports them separately. A merged count is a wrong
count, and it is wrong in the direction that inflates the work.

⚠ **Return the coverage block verbatim.** It is generated from live state and the report prints it as
generated. Do not summarise it, tidy it, or convert it to prose.

**Record a prediction before each run.** Order expectation, from the 25-H controls: Equality Act >
Human Rights Act > CRAG. If that ordering breaks, stop and report — something upstream has changed.

## 3. T2 — Provision-level detail (Saturday, after T1)

For each measure, the report needs to quote actual statutory words. Produce
`docs/report_run/{ws_id}_provisions.json`:

- the target Act's own provisions in scope (for WS-05, Part 1 only)
- for each inbound reference, enough surrounding text to quote the referring provision accurately —
  the full sentence containing the reference, not a fragment

This is the single highest-value output you produce. One quoted clause showing what breaks does more
work than a page of explanation.

## 4. T3 — Gate evidence (Sunday)

Not analysis — retrieval. For each measure, retrieve and file the text of:

- **Devolution:** Scotland Act 1998 s.29 and Sch 6; Government of Wales Act 2006 s.108A; Northern
  Ireland Act 1998 s.6 and Sch 10. Plus any inbound reference from these Acts to the target.
- **Northern Ireland:** Northern Ireland Act 1998 s.76 and the fair employment provisions.
- **Instrument allocation:** for each target, the enabling powers it confers (from the `enabling`
  edges) — this is what tells the report which statutory instruments fall with the parent.

File as `docs/report_run/gates_{ws_id}.json` with the retrieved text attached to each item.

⚠ **Retrieve, do not interpret.** Whether a gate is engaged is the analysis track's call. Your job is
to put the words in front of them.

## 5. T4 — Conditional fourth measure

**Decision point: Tuesday 1 September, 09:00.** Charlie decides. If yes, run T1–T3 for the
Constitutional Reform Act 2005 (Parts 2 and 3) that morning.

Whether or not it is worked, produce **now**, on Saturday, a one-line scoping row for it and for the
remaining eight measures: reference count and detection breakdown only. Cheap, and the report needs
it for Part 4 regardless.

One thing to check and report rather than assume: does the Supreme Court hold the devolution
reference jurisdiction under Scotland Act 1998 Sch 6 and Northern Ireland Act 1998 Sch 10? If so,
abolishing the court requires that jurisdiction to be relocated, and no source in the proposer's own
material mentions it. **Report what the statute says. Do not conclude.**

## 6. T5 — Hand verification (Monday)

Take a 20-row random sample across the three measures and verify live against legislation.gov.uk.
Report the rate, and what any failures have in common.

⚠ **If the verification finds failures, verify the verifier before reporting them.** In sprint 25-H
the first pass reported 18/20 and both failures were the checker's. A false finding in this report
is worse than a missing one.

## 7. Working with the analysis track

- You do not write prose and you do not draw conclusions. Data and evidence only.
- Corrections will arrive as new briefs from the Cowork session, relayed by Charlie, with the defect
  named. Execute them; don't ask Charlie to explain them.
- If an output cannot be produced, say so the same day with the reason. A declared gap on Saturday is
  a chapter section rewritten; a gap discovered on Wednesday is a hole in a printed document.

## 8. Deliverables checklist

- [ ] `{ws_id}_inbound.json` and `.csv` × 3 (4 if T4 runs)
- [ ] `{ws_id}_provisions.json` × 3 (4)
- [ ] `gates_{ws_id}.json` × 3 (4)
- [ ] `scoping_remaining.csv` — reference counts for the eight/nine unworked measures
- [ ] `verification_sample.md` — the 20-row check with its rate
- [ ] predictions recorded in `CHANGE_LOG.md` before each run, actuals against them after
- [ ] commit script, run once, deleted

## 9. Reporting

End of each day, short. What you predicted, what you found, whether they matched, and anything that
failed. Plain English. If a "must be true by end of day" condition failed, say so that evening.
