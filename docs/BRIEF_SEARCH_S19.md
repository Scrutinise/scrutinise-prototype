# BRIEF — SEARCH S19: THE UNIT, AND THE REACH

**For:** CC-Search
**Written:** 8 September 2026, by CCh-Search
**Executes:** the two constraints named in `SCRUTINISE_SEARCH_STATUS_v2` §4.1 as gating everything
else — the **unit** (12 of 32 failures) and the **reach** (8 of 32)
**Evidence base:** `SEARCH_S16_REPORT.md` §2 · `ARGUMENT_1A_REPORT.md` §2 · `SEARCH_S18_REPORT.md` §1
**Format:** diagnose, then build. **§1 and §2 report before anything is changed.** No git during the
sprint; one **`commit-search-s19.sh`** at the end. Scoped commits by explicit path.
`SEARCH_CONTRACT.md` updated in the same commit as any capability change.

---

## §0 — THE TWO CONSTRAINTS, AND WHY THEY ARE ONE SPRINT

Both decide **what can be found at all**, before ranking gets a say. Neither is a quality-tuning
problem and neither should be approached as one.

**The unit.** Three sprints found the same thing from three directions:

| where | what was measured |
|---|---|
| S16 autopsy | **12 of 32** failures are a long document scored as a whole when the answer is a paragraph |
| ARGUMENT 1A | half of what dense retrieval returns on an argument probe is a **fragment** — 48.8% under 30 words, median 32 against 83 for a random passage. *"Where is the money to come from?"* returned four times from four decades. **92.6% of parliamentary sections are a single chunk** |
| S18 §1 | impact assessments, scoped to their own collection, BM25 only: **section-level 0 of 9 · document-level 4 of 9 · document-level in top 200, 8 of 9** |

⚠⚠ **Read those together and the finding is not "our unit is too big" or "too small". It is that the
unit is wrong in opposite directions in different collections, and one grain cannot be right for all
five.** An impact assessment answers at document level and scores nothing at section level. A debate
answers at paragraph level and is currently drowned by six-word interventions. A section of an Act
*is* the unit and needs nothing done to it.

**The reach.** Four collections cannot be returned by any query at any setting, and four more are
never routed to. ⚠ And the mechanism behind one of them is the deeper problem: **`uk-treaties` and
`tax-treaties-dta` are unreachable because they are display-typed `TREATY`, while `uk-treaties-fcdo`
— seven times larger, the same material — is reachable purely because it happens to be typed
`DEBATE`.** Whether a document can be *found* currently depends on a label chosen for how it should
be *rendered*.

⚠ **A caution on every number in this sprint.** Four sets of re-keyed questions are with Charlie
(debates, committees, costing, impact assessments). **Recall figures will move when they land, for
reasons that have nothing to do with this sprint's work.** Report against the set as it stands, name
the version of the set used, and do not present a re-keying gain as a retrieval gain.

---

## §1 — THE REACH SWEEP. CHEAPER, BOUNDED, DO IT FIRST.

### §1.1 Finish the enumeration

S17 §2 was to list every collection in the `other` tier before widening anything into it. **Confirm
whether that landed and report the list.** If it did not, do it here: **every collection, with its
section count, its display type, its tier, and whether any query can return it in production with
the router on.** ⚠ **Answer by probing the live index, one collection at a time — never by reading a
configuration file.** `cps-guidance` was found by probing; the others were inferred from its pattern.

### §1.2 Separate what a document *is* from where it can be *found*

⚠⚠ **This is the durable fix and the reason this section exists.** Two collections of the same
material have opposite fates because of a rendering label. That is not a bug in one place; it is a
design in which reachability is a side effect.

- **Report the design options and the cost of each**, with a recommendation: a routing attribute
  independent of display type; a mapping table from type to streams; or keeping the coupling and
  fixing the two collections by hand.
- ⚠ **Fixing the two treaty collections by hand is not the answer to the question**, and if that is
  what gets built, say so plainly — it leaves the mechanism in place to bite again.
- ⚠ **This touches how every result is rendered as well as how it is found.** If the recommendation
  is large, **report and stop**; it is Charlie's decision, not a change to ride along behind a grain
  experiment.

### §1.3 The four not-routed

S18 overturned this for impact assessments: they **are** routed, on 5 of 9 questions, and the failure
was the unit and the keys instead. ⚠ **Re-check the other three the same way before treating any of
them as a routing problem.** Print the streams the router chose per question.

---

## §2 — THE UNIT: MEASURE THE RIGHT GRAIN PER COLLECTION

**No code in this section. A table is the deliverable.**

For each of the five sources, score the validated questions at **three grains** and report recall at
each:

| grain | what it means |
|---|---|
| **chunk** | the paragraph-sized piece the meaning-based index already uses |
| **section** | what we score today — one speech, one clause, one committee answer |
| **document** | the whole sitting, the whole Act, the whole assessment |

- Report **recall@20 at each grain, per collection, with n stated.** ⚠ S18's numbers for impact
  assessments were taken BM25-only, scoped to the collection. **Take these through the real gateway
  as well**, and report both — a grain that wins in isolation and loses in the merge is not a win.
- ⚠ **Report the length distribution of what is returned at each grain**, because 1A's fragment
  finding is the other half of this. A grain that improves recall while returning six-word
  interventions has moved the problem rather than solved it.
- **Predict first.** State, per collection, which grain you expect to win and why. The expected
  shape: documents for impact assessments, paragraphs for debates and committee evidence, sections
  for legislation. ⚠ **A refuted prediction here is worth more than a confirmed one** — it would mean
  the grain is not the mechanism and §3 should not be built as written.

---

## §3 — BUILD WHAT §2 POINTS AT

Only after §2 reports. Likely shape, but **the measurement decides**:

- **A per-collection grain setting**, defaulting to today's behaviour so the change is a no-op until
  a grain is set — nothing widened before it is measured.
- **Retrieve at the grain that finds it; display the passage that matched.** ⚠ These are different
  decisions and must stay separable. S18 shows the right document coming back for 8 of 9 questions
  at document level; the user still needs the paragraph. **Locate the passage inside the document
  after retrieval**, rather than choosing between finding it and showing it.
- **A minimum-length floor at retrieval, not at display.** ⚠ A fragment that wins a slot has already
  displaced a real passage; hiding it afterwards does not give the slot back.
- ⚠ **Consider joining adjacent short sections into a passage for the parliamentary collections**,
  where 92.6% of sections are a single chunk and many are one-line interventions. **Report the effect
  before adopting it** — merging changes identifiers, which the ingest stream must be told about
  because it invalidates anything keyed to them.
- Flag-gated, default off, read through `flagEnabled()` — never a bare `=== 'true'`.

⚠ **Do not tune to 64 questions.** Report the *shape* of any sweep, not the winning point, and say
explicitly where you decline to change anything. A flat curve means the grain does not matter there;
a single spike is more likely noise than discovery.

---

## §4 — MEASURE, AND SAY WHAT IT SUPERSEDES

- Both arms in one session against the same index, with the index version stamped either side.
- Per collection, **n stated every time**, plus the four-way split (hit · diluted · not-retrieved ·
  not-routed).
- ⚠ **Record the flag string and the degraded state in the artefact itself.** S14's figures described
  a keyword-only system for a fortnight because nobody wrote down what ran.
- **Name every figure this supersedes.** Two baselines are already void and a third is stale.
- ⚠ **Report the split between what this sprint changed and what re-keying changed**, if any re-keys
  land mid-sprint. If they cannot be separated, say so rather than attributing the whole movement to
  the work.

---

## §5 — STANDING RULES AND THE REPORT

- Scoped commits by explicit path; `commit-search-s19.sh`; nothing owned by ingest, graph, lex or the
  argument stream edited — report the change needed instead.
- **Every guard states what it counted**, never whether something exists. An existence check is not a
  completeness check, and that distinction has cost this project five separate incidents — most
  recently a `--verify-only` that asked whether an index existed and answered yes while it was
  missing 6.5% of the table.
- Every check watched failing against the real broken state.
- ⚠ Auto-deploy is live on `vector-serve` for pushes touching `scripts/ingest/search/` — check nothing
  is measuring before pushing there. A redeploy is not a rebuild; `/api/health` carries the deployed
  commit and the flag states.
- **Report `docs/SEARCH_S19_REPORT.md`:** §2's three-grain table first, per collection, with n and
  the length distributions — **that table is the sprint**, and it is the first time anyone will have
  seen the platform's own answer to "what is the right unit". Then §1's reachability list and the
  type/routing recommendation. Then what was built and its measured effect. Then what is NOT done,
  named. Decisions for Charlie as numbered questions with a recommendation and the consequence of
  each option.
- Change-log, contract and handoff entries labelled **SEARCH**.
