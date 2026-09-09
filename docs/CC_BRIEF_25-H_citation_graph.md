# CC BRIEF — Sprint 25-H: Statutory Citation Graph + CRAG Pilot

**Stream owner:** CC-Graph (co-ordinate with CC-Ingest on corpus reads)
**Standing rules apply:** CLAUDE.md. No git during sprint. No flag flips. Single commit script at end, named `commit_25H_graph.sh`, deleted after execution.

---

## 1. Why this sprint exists (context — read before starting)

We are running a bespoke research programme ("the Starkey Programme") that maps what a large
constitutional repeal package would actually entail, provision by provision. It is a stress test of
the platform on the hardest possible input. We are **not** building a Programme object or any new
user-facing feature this sprint. We are building one missing corpus capability that the research
cannot proceed without, and proving it on one small Act.

The missing capability: **inbound statutory citation lookup**. Given an Act (or a Part of an Act),
return every provision *elsewhere in the statute book* that refers to it.

Why this matters in plain terms: if you repeal an Act, every other law that mentions it is now
broken — it points at something that no longer exists. Someone has to find every one of those
references and decide what to do about it. Today we cannot list them. That list is the single
largest deliverable of the whole programme, and it is a data problem, not a legal one.

---

## 2. Task 1 — Audit before building (bytes before hypotheses)

**Do not build anything until this reports.**

legislation.gov.uk XML (CLML schema) marks cross-references with `<Citation>` and `<CitationSubRef>`
elements carrying a `URI` attribute that resolves to the cited legislation. Our ingest may or may not
have preserved them.

Establish, against the actual stored corpus (not against the source site):

1. Do stored legislation documents retain `Citation` / `CitationSubRef` elements? Yes/no, with a
   sample raw fragment pasted into the report.
2. If yes: total count of `Citation` elements across the primary legislation holding.
3. Count of distinct `URI` values.
4. What proportion of `URI` values resolve to an Act we hold? (Report the numerator, the
   denominator, and what the denominator is a count of.)
5. Same four questions for statutory instruments.
6. If citations were stripped during ingest: report where in the pipeline, and the cost of
   re-ingesting with them preserved. Do not re-ingest without approval.

**Record a prediction in CHANGE_LOG.md before running each count.** If the prediction and the result
diverge by more than an order of magnitude, stop and report rather than proceeding.

---

## 3. Task 2 — Build the citation edge table

Only if Task 1 confirms citations are present.

Table `citation_edge` in Neon:

| column | type | notes |
|---|---|---|
| `id` | pk | |
| `source_doc_uri` | text | the document containing the reference |
| `source_provision_ref` | text | section/regulation/schedule paragraph, as precise as the XML allows |
| `target_uri` | text | raw URI from the XML, unmodified |
| `target_act_id` | text | normalised — nullable if unresolvable |
| `target_provision_ref` | text | nullable |
| `citation_text` | text | the literal words in the source, e.g. "section 3 of the Human Rights Act 1998" |
| `raw_fragment` | text | surrounding XML, for evidence |
| `resolved` | bool | whether `target_act_id` was resolved |
| `source_type` | enum | primary / SI / other |

Design notes to follow:

- **Store the raw URI unmodified alongside the normalised id.** We have been bitten before by
  normalisation that silently drops rows; keeping the raw value means a normalisation bug is
  recoverable without re-ingest.
- **`citation_text` and `raw_fragment` are not optional.** Every edge must carry its own evidence.
  An edge with no quotable source is a claim, not a fact, and this programme's entire credibility
  rests on that distinction.
- Index on `target_act_id` and on `target_uri`. The dominant query is inbound, not outbound.

---

## 4. Task 3 — Query surface

A single function, callable from a script (no UI this sprint):

```
inbound(target_act_id, target_provision_ref=None, include_unresolved=False)
  -> rows of {source_doc_uri, source_provision_ref, citation_text, source_type}
```

Plus `inbound_summary(target_act_id)` returning counts grouped by `source_type` and by source Act.

---

## 5. Task 4 — Pilot: Constitutional Reform and Governance Act 2010, Part 1

CRAG 2010 Part 1 is the Civil Service provisions — it puts the civil service on a statutory footing,
provides for the Civil Service Code, and governs appointments. It is the pilot target because it is
small, self-contained, and its reference tail should be short enough to check by hand.

1. Record a prediction in CHANGE_LOG.md: how many inbound references do you expect for CRAG 2010
   Part 1? State the number before running.
2. Run `inbound()`. Report actual against prediction.
3. **Hand-verify a 20-row random sample** against legislation.gov.uk. Report how many of the 20 are
   correct, how many are wrong, and what the wrong ones have in common.
4. Export the full result as `crag_part1_inbound.json` for the research agents to consume.

## 6. Task 5 — Negative control and scale control

A test that cannot fail is not a test. Two controls, both run before the pilot result is trusted:

- **Negative control:** pick an Act we hold that should have close to zero inbound references (a
  narrow, recent, single-purpose Act — CC to choose and state its reasoning). If it returns a large
  number, the query is matching on something other than the citation URI and the pilot result is
  worthless.
- **Scale control:** run `inbound_summary()` on the Equality Act 2010 and the Human Rights Act 1998.
  These should return substantially *more* inbound references than CRAG Part 1. If CRAG returns more
  than either, stop — the ordering is wrong and the cause must be found before anything else runs.

State both predictions before running.

---

## 7. Out of scope this sprint

- No Programme object, no schema above Proposal.
- No UI.
- No feature flags.
- No changes to Lex, search routing, or the position graph.
- No re-ingest without a separate approval.

## 8. Deliverables

1. `CITATION_AUDIT.md` — Task 1 results, predictions vs actuals, sample fragments.
2. `citation_edge` table populated for primary legislation (SIs may follow in 25-J if volume allows).
3. `inbound()` / `inbound_summary()` callable and documented in `SEARCH_STRATEGY.md`.
4. `crag_part1_inbound.json`.
5. Control results with predictions stated in advance.
6. `commit_25H_graph.sh`.
7. Any surprises appended to `OPEN_ITEMS.md` — do not bury them in the changelog.

## 9. Report format

Lead with plain English. For each task: what you predicted, what you found, whether they matched,
and what it means for the next step. If a task could not be completed, say which one and why —
a declared gap is worth more than an inferred completion.
