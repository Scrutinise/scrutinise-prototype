# BRIEF — LEX 26-K: the update pass, and what it makes of the Deepening

**Thread:** LEX. **Written:** 27 September 2026.
**Source:** CCh-Search's design proposal of 26 September, approved in principle by Charlie. **Lex to
scope and decide; this brief does both.**

⚠⚠ **The framing that governs everything below: this is the Deepening's engine, not a separate
feature.** Charlie's own description of Stage 3 is *"Lex researching each question on demand rather
than in one pass"*. **"Research an angle" is exactly that.** Build it as Stage 3's core, alongside the
re-read and the coherence test already recorded in 26-J §5.

## §0 — Run mode

**Continuous.** Diagnose, record in the CHANGE_LOG, proceed. Batch the report. **Stop only for** spend
or scope. ⚠ **CLAUDE.md §25–§28 apply.** Run the cold-read instrument.

⚠ **Dependency.** Search's S26 is building the reusable pieces — a corpus search that takes any list
of seed terms, and a four-model check that takes an optional angle — to be described in
`docs/HANDOVER_RESEARCH_SEQUENCE.md`. **Steps 3 and 4 below do not depend on S26 and can be built now
against the existing search path. Step 2 swaps to S26's functions when they land.** ⚠ **Report if
that swap would mean rework you can avoid by waiting.**

---

## §1 — Why this is better than a rebuild

**Today, new material means a full rebuild**: it repeats all the research, costs a full build, and
**reshuffles parts of the kernel the new material had nothing to do with.**

**The update pass treats new material as a proposed amendment.** It only touches what the material
touches, and **nothing changes until the user accepts it.**

⚠ **It also resolves 25-X §4's open risk.** A cumulative rebuild can entrench an earlier build's
mistakes. **An update pass cannot, because it proposes rather than overwrites.**

## §2 — The four steps

1. **Extract findings** from the new material — the existing `runMaterialFindings`, unchanged.
2. **Search the corpus on the new material's vocabulary only.**
3. **Compare with the current kernel**, sorting each finding into exactly one of:
   - **supports** an existing cause, policy or action;
   - **suggests a new cause**;
   - **suggests a new policy option or coherent action**;
   - ⚠ **contradicts something already there**;
   - **changes nothing.**
4. **Present as proposed changes**, accepted or dismissed one by one.

⚠⚠ **"Contradicts" is the most valuable category and must be the most prominent.** A finding that
contradicts the kernel is exactly what the platform exists to surface. **It is never folded into a
count or collapsed by default.**

## §3 — The extension: research an angle

**The user types an angle** — *"how does the private sector handle this?"* — **instead of researching
elsewhere and uploading the result.** Lex runs a focused round on that angle only — corpus plus the
four-model check — and **returns the same proposed-changes output as §2.**

⚠ **Web material stays web-tier: `[W]` numbering, never renumbered into the corpus sequence** —
decision 85.

## §4 — Search's three questions, decided

**4a. How a proposed change is shown and accepted.**
⚠ **Reuse what exists; do not build a third proposal mechanism.** The workspace already has two:
*PROPOSED BY LEX — REFINE* cards, and 25-Q's rewrite card showing current text beside proposed.
- **A change to an existing field** appears at that field as current-beside-proposed, **with the
  finding it came from and its source.** Accept or dismiss.
- **A new cause** appears as a proposed cause, accepted or dismissed.
- ⚠ **A new policy option is a new candidate** — it enters the guiding-policy sort numbered, and is
  **tested by 26-I's judge like any other.** No separate path.
- **The working area's list shows "N proposed changes from [source]"**, so nothing sits unseen in a
  collapsed section.

**4b. Accepting a change re-runs nothing. It marks what depends on it as stale.**
⚠ **Automatic downstream re-runs are the "reshuffle" problem this pass exists to avoid**, and they
spend money the user did not decide to spend. **Stale is marked with its reason** — *"this may need
revisiting because cause 3 was amended"* — **and follows the kernel's existing dependency chain**, the
same one that makes four fields wait on Chosen approach.

**4c. Automatic or on request: offer, do not run.**
- **Extraction runs automatically on upload, as today** — *"Lex read this and took N findings."*
- **The comparison is offered, not run.** ⚠ **It costs money and the user may be adding several
  documents at once.** The offer **accumulates**: *"3 new items since your last comparison — compare
  them with your kernel?"* One pass over all of them.
- ⚠ **The offer must be visible where the material was added and in the working area.** A user who
  uploads a document and sees nothing happen will not know to ask.

## §5 — What this changes in the end-of-kernel options (26-F)

⚠ **When new material has been added since the last build, the first option offered is "Compare the
new material with your kernel" — not "Re-run".** A full re-run becomes the right answer far less
often than it is today, and the options box must say so.

## §6 — Measure it against a rebuild

**Report the cost and time of one update pass against one full build, on the same idea, on a run that
finished.** ⚠ Search's premise is that it is cheaper. **Confirm it rather than assume it.**

## §7 — Acceptance criteria

- New material produces proposed changes in five categories; nothing in the kernel changes until
  accepted.
- A contradiction is always shown prominently, never collapsed into a count.
- Proposed changes use the existing proposal mechanisms, and a new policy option enters the sort and
  is judged.
- Accepting a change marks dependants stale with a reason, and re-runs nothing.
- The comparison is offered, accumulates across several additions, and is visible in the working area.
- The end-of-kernel options offer the comparison ahead of a re-run when new material exists.
- An angle typed by the user returns the same proposed-changes output.
- Cost and time are reported against a full build, measured on a finished run.
