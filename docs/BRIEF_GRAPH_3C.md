# BRIEF — GRAPH 3C: MAKE THE SCORE MEAN SOMETHING

**For:** CC-Graph
**Written:** 21 August 2026, by CCh-Search/Graph
**Executes:** `GRAPH_3B_REPORT.md` §1.5 (the scoring proposal), D-7, D-8, D-10;
`POSITION_GRAPH_DESIGN.md` §5 (weighting) and §8 (the gate)
**Reads first:** `GRAPH_3B_REPORT.md`. This brief is written against what 3B found, not against what
3B was asked to do.
**Format:** audit-then-build. No git during the sprint; one **`commit-graph-3c.sh`** at the end.
Scoped commits by explicit path; additive migrations only.

---

## §0 — WHAT 3B ESTABLISHED, AND WHY THIS SPRINT IS THE HONEST ONE

3B was asked to find out why the graph could not rank. It found the problem was larger than the
symptom, and it correctly changed nothing.

**Three findings, all of which this sprint must fix or explicitly decline:**

1. **The stance score is not a spectrum.** Across all 2,304,748 estimates there are exactly **three**
   distinct values — +1, 0, −1 — and 92.87% sit at exactly ±1.00. `stanceScore = signed / mass`
   divides out both volume and consistency, so **one consistent vote and fifty consistent votes give
   the identical 1.00.** It is a three-valued flag printed to two decimal places.
2. **Confidence rewards an inconsistent record.** Nine votes the same way scores 0.748; five one way
   and four the other scores **0.881**, because the harmonic discount is grouped by direction and
   disagreeing signals dodge it. On a real Bill the 425 mixed records average *higher* than the one
   consistent record. **Confidence is measuring turnout, not conviction.** Both ranking keys tried so
   far are biased in opposite directions (D-7): 3A's buried the undecided, 3B's puts them top.
3. **The free-vote heuristic emits false rebellions.** On the 2 of 11 assisted-dying divisions it
   misses, it produces **328 `rebellion:v1` signals at weight 0.9 for members who rebelled against
   nothing.** 3A's claim that a missed free vote "understates rather than overstates" is refuted —
   it overstates, and that is the mechanism that put 108 people at the top of the admin page.

⚠ **And one methodological finding worth more than the three above.** 3A published as a finding that
"all 400 voted the same way both times". 16 of 587 changed side, and all 16 ranked 612th–627th of
627 — below the harness's own limit of 400. **The check could not have failed, and its passing was
reported as evidence.** That is the standing rule breached by its own author. Every check in this
sprint must be shown failing against the real broken state, not a synthetic one.

---

## §1 — FIX THE SCORE. THIS IS THE SPRINT.

3B's §1.5 is a proposal with the evidence for each option. **Read it, choose, and justify the
choice** — do not implement all of it and do not implement none of it.

**The properties the new scoring must have**, each asserted by a check with a constructed case:

- **Volume must matter.** Fifty consistent votes must not equal one.
- **Consistency must matter, and in the right direction.** A record that is 9-for must outrank one
  that is 5-for-4-against, on both stance magnitude and confidence. This is the exact inversion 3B
  found; the check must fail against today's function.
- **Direction-0 signals cannot manufacture certainty.** The design's confidence ceiling for
  attention-only signal types (start 0.15) still holds.
- **Decay still applies**, and an old consistent record must not outrank a recent one of equal size.
- **Absence is absence.** An actor with no signals has no row — never a score of 0.
- **The distribution must actually be a distribution.** Report the histogram of stance and of
  confidence after the change: if there are still fewer than, say, twenty distinct stance values
  across 2.3M rows, the fix has not worked, whatever the arithmetic says.

⚠ **Do not tune the weights to make a particular Bill look right.** The validation set (§3) is the
only legitimate judge, and it is not scored yet. Choose the *shape* on principle; leave the
*numbers* provisional and versioned, and say in the report which is which.

⚠ **Everything is a recompute, not a rewrite.** The signal layer is immutable and the estimate layer
is derived — that separation exists precisely so this sprint is safe. Every estimate row carries the
new `config_version`.

⚠ **3B truncated `position_estimate` and left it half-rebuilt** by optimising one access pattern
without asking who else read the same object. Before any rebuild: establish who reads the table,
write it down, and make the rebuild atomic from a reader's point of view or explicitly offline.

---

## §2 — FIX THE FALSE REBELLIONS

The heuristic misses free votes and then labels the resulting cross-party voting as rebellion at the
highest weight in the system. Two things to do:

1. **Widen or replace the detection.** 3B named the 2 of 11 divisions it misses; use them as the
   test case, and report which divisions the revised rule tags — the classic free votes must be in
   that list, and the whipped Northern Ireland abortion regulations must not be.
2. ⚠ **More important than the detection: make the failure mode safe.** A rule that mislabels will
   always exist, so the weighting must not put the maximum weight behind an inference. Options to
   evaluate and choose between, with reasoning: cap the weight of any *derived* classification below
   that of a plain recorded fact; or emit rebellion only where party-at-time-of-vote is known and
   party cohesion on that division is high. **The principle: an inference must not travel at the
   weight of a measurement.**

---

## §3 — THE VALIDATION SET: HELP CHARLIE FINISH IT

`docs/POSITION_VALIDATION_CANDIDATES.md` holds **157 candidates**, each with an MNIS id and a
checkable citation, non-circular by construction. Until it is scored, design §8's gate is shut and
**no accuracy figure exists for the graph at all.**

157 is too many for one sitting. **Do this, and nothing more:**

- **Propose a subset of ~50** that gives the widest coverage — spread across matters, parties, and
  across both strongly-held and genuinely ambivalent positions, since the ambivalent ones are where
  the scoring change above will show. Mark the rest `DEFERRED`, not deleted.
- Make it one-pass reviewable in the shape that worked for the search gold set: numbered, one
  VERDICT line, the citation visible without leaving the file.
- **Score nothing.**

⚠ Once Charlie returns it, scoring is a separate sprint and the fixed scoring from §1 is what gets
scored. Do not score the old function against the new key.

---

## §4 — THE TWO REGISTER ITEMS, ONE DECISION EACH

**§4.1 APPG (D-8).** The register is behind a Cloudflare bot challenge. 3B correctly did not build a
way around it. Take the cheapest of its three legitimate routes — and if the cheapest is a manual or
semi-manual download of a published register, **say so plainly and do it**; a public register
published as a document is not a technical problem. ⚠ Do not build a bot-challenge workaround. If
all three routes need Charlie's decision, report and stop.

**§4.2 Electoral Commission entity resolution (D-10).** 89,861 records produced only 244 signals,
because resolution is by exact key. **14,879 records carry a Companies House number we do not
hold** — roughly 11× the current yield available by acquiring those numbers, not by loosening the
matching. ⚠ **Never merge two identities on similarity** (standing rule): the fix is more
identifiers, never fuzzier matching. Report what acquiring them would take; build it only if it is
small.

---

## §5 — HOUSEKEEPING

**The storage question is settled and the answer changes the decision.** Neon is on the Launch plan
with **no fixed storage allowance** — it is usage-priced at $0.35 per GB-month. Current storage is
19.09 GB costing **$3.96 a month**, against **$33.01 of compute**. So:

- **The 17.5 GB "limit" is not a limit and never was.** Find the constant (3B located it at
  `scripts/ingest/search/serve-observer.ts:50`, with circular provenance) and **replace the
  threshold with a cost-based one** tied to the $50 spending notification already set in Neon,
  recording the source and the date checked beside it.
- **3A's D-1 — dropping 90% of the estimate rows to save space — is now definitively the wrong
  call.** The whole 596 MB table costs about **$0.21 a month**. Close the decision in the report.
- ⚠ The real cost lever is **compute, at eight times storage**. If anything in the graph stream is
  driving compute — a long-running rebuild, a hot query — that is worth a line in the report.

---

## §6 — STANDING RULES AND THE REPORT

- Scoped commits by explicit path; `commit-graph-3c.sh`; additive migrations only; nothing owned by
  search, ingest or lex edited — report needed changes instead.
- **Every check watched failing against the real broken state**, per §0. A check that cannot fail is
  not a check, and a harness limit that hides the failing rows is the same defect wearing a
  different hat.
- Predictions logged before rebuilds; bytes before hypotheses.
- **Report `docs/GRAPH_3C_REPORT.md`:** the before/after distributions first, with what each figure
  is a proportion OF — that is the evidence the score now means something. Then the false-rebellion
  fix with the tagged-division list. Then the registers. Then what is NOT done, named. Decisions for
  Charlie as numbered questions with a recommendation and the consequence of each option.
- ▶ Name what Charlie should click: `/admin` → Position Graph → a Bill with mixed voting, and
  confirm the ordering now separates the committed from the ambivalent, and that the page still says
  plainly when a set is tied.
- Change-log and handoff entries labelled **GRAPH**.
