# BRIEF — Sprint 25-J: the ideas hub, and the front door a stranger meets

**Thread:** LEX. **Written:** 27 August 2026.

## §0 — Run mode

**Continuous.** Diagnose, record in the CHANGE_LOG, proceed — including where a finding contradicts
this brief. Batch the rest into one report. **Stop only for** spend beyond §5's ceiling or a change of
scope. Shell per CLAUDE.md §22. **Walk the signed-in site** (extension works; text extraction, not
screenshots). Delivery per §20.

---

## §1 — Naming: "my", consistently

The dashboard says **"Your ideas"** beside **"My Communities and teams"**. Pick one voice and use it
everywhere: **"My ideas", "My communities", "My teams"**. Sweep the whole app for the inconsistency
rather than fixing the two Charlie noticed.

## §2 — "Create" becomes "My Ideas", and becomes a hub

The nav item **Create** is renamed **My Ideas** and the page it leads to becomes the place a user
lives, not a form they fill.

**On arrival:**

- **A large, obvious space to start a new idea** — the first question, ready to answer, dominant on
  the page. Not a button that leads to a form; the form itself.
- **A list of the user's ideas** beneath it, each showing enough to be recognisable: title, stage,
  when it was last worked on. ⚠ **Not eleven rows called "Untitled idea"** — where a title has not
  been generated, identify it by the user's own opening words.
- **The dashboard's focus, not the old create page's clutter.**

**On answering the first question**, the page transitions to the three-column working view. That
transition is the moment the product starts; it should feel like a beginning, not a page load.

**Keep:** ideas are created on the first answer, never on page load (25-I §1). Verify the sweep held.

## §3 — Progressive disclosure through the transition

Carried from 25-H §5 and to be verified on the live site, since it interacts with §2:

- The proposal and legislation panels **collapse to slim labelled edges** at the first stage — visibly
  coming, not missing.
- They **expand as they gain content**.
- A **persistent control** to collapse and restore each, and to move between the build and the
  proposal in both directions.
- **Returning to a built idea lands on the proposal.**

## §4 — Statutory consequences: wire it into the flow it belongs to

`BRIEF_STATUTORY_CONSEQUENCES.md` specifies the pass. This section is only about where the user meets
it.

- The pass runs as the **fifth Deepening pass**, triggered when the proposal touches an existing
  enactment, skipped cleanly when it does not.
- Its output appears in the **right-hand panel under its own question heading** — *"What else refers to
  this law"* — alongside the other interrogation-library headings (25-H §6).
- ⚠ **The coverage statement sits next to the count, not below the list.** *"1,868 that we found in the
  layers we have searched"* — and the wording is computed from what the graph reports, never a literal
  in the code.
- A **group opens to its members**; the tail is counted; nothing is silently dropped.

**Do not build the pass here** if it has not already been built — this section wires and places it.

## §5 — The measurement still open from 25-H and 25-I

⚠ **Whether §25.7's six qualities reach the output has never been measured.** Both attempts were
spoiled by defects that are now fixed — the second build failed at pass 3 with zero evidence rows, so
its 2-of-6 score measured the defect.

**Charlie has authorised one run.** Report: the six qualities in the output, cost, duration, and — from
a **complete** build this time — the reuse saving. ⚠ 85% is currently a ceiling taken from a run that
died at pass 5; the real figure needs a run that finishes.

**Ceiling: one build.**

## §6 — Acceptance criteria

- One voice throughout: "My ideas", "My communities", "My teams" — swept, not spot-fixed.
- **My Ideas** is a hub: the first question is the dominant element, the user's ideas are listed and
  recognisable, and no idea is listed as "Untitled" without the user's own words identifying it.
- Answering the first question transitions to the three-column view; no idea is created before that
  answer.
- Panels collapse, expand and restore; the route between build and proposal works both ways;
  returning lands on the proposal.
- Statutory consequences appears under its own question heading, with the computed coverage statement
  adjacent to the count and groups that open.
- One complete build run: six qualities assessed, cost, duration, **and a reuse figure from a build
  that finished.**
- Walked signed-in on production and reported as a walk.
