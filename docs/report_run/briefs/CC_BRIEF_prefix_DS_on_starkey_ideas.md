# CC brief — prefix the Starkey-derived ideas with "DS"

**23 September 2026. Two phases. Phase 1 is read-only and ends in a report. Do not write anything until Charlie has seen the Phase 1 list and said go.**

**What Charlie wants:** his idea list mixes his own ideas with ideas that came out of David Starkey's Restoration Programme. He wants the Starkey ones marked with a `DS` prefix in the title so the two groups separate at a glance.

**Why this is your job and not CCW's:** the ideas are rows in the platform database. CCW has no credentials and no corpus access.

---

## Phase 1 — establish what is a Starkey idea, and report. No writes.

### 1.1 Find the grouping, do not assume it

Before selecting anything, establish **how the schema actually distinguishes a Starkey idea from one of Charlie's.** Report which of these it is:

- a parent/child link — the twelve measures hanging off a single Restoration Programme idea, and `spawnedFromIdeaId` hanging off those;
- a project, workspace, tag or owner column;
- nothing structural, in which case selection has to be by title or by created-date window and that is a materially worse answer.

⚠ **Say which it is before you select on it.** If it turns out to be date or title matching, stop at the end of Phase 1 and say so plainly — Charlie needs to know the selection is a guess before he approves a rename.

### 1.2 The population, as best it can be defined

Working definition, subject to what 1.1 finds:

1. **The Restoration Programme idea itself**, if one exists as a row.
2. **The twelve measures** — M-01 to M-12, the Human Rights Act through to the Great Repeal.
3. **Every idea with `spawnedFromIdeaId` pointing at any of those.** `docs/report_run/SPAWNED_IDEAS.md` records 33 spawned questions across the twelve, of which three were already written as rows at stage 1:

```
9dcc50f4-35be-47b7-96f5-082bb272c9aa  Defining the state's duty to investigate deaths after HRA repeal
31298946-6760-409e-847d-eedfedabdb42  Policy on the UK's adherence to other international human rights treaties
693d3cd8-ab53-4bc7-99d3-0693e8a202e8  The future of data protection adequacy decisions with the EU
```

⚠ **That file is a report of a run, not the database.** Treat it as a cross-check on your query, not as the source of truth. **If your query returns a different set, the query wins and the difference is worth reporting** — it means ideas were spawned or deleted since 10 September.

⚠⚠ **`452c5ade-3153-400a-bf48-3b71aaa52773` is hard-coded as a default idea in several scripts** (see `SEAM_REGISTER.md`). Establish what it is before including or excluding it. If it is the Restoration Programme root, renaming it may affect nothing, or may affect a script that matches on title — check for title matching in the scripts before the write phase.

### 1.3 What to report

A table: **id, current title, stage, why it is in scope** (measure / spawned from which measure / root), and separately **any idea you were unsure about**, with the reason.

Also report the total count of ideas in the list overall, so Charlie can see what proportion is being marked.

---

## Phase 2 — the rename, once Charlie has approved the list

### 2.1 Format

```
DS · <existing title>
```

The `·` is the separator used throughout the report, and it makes the prefix read as a label rather than as the first word of the title. **If Charlie prefers plain `DS ` or `DS: `, use that — this is his call and the Phase 1 report is where he makes it.**

### 2.2 Three rules that matter more than the rename

1. **Idempotent.** Skip any title that already starts with the prefix. This will be run twice by accident at some point; the second run must be a no-op, not `DS · DS · …`.
2. **Reversible.** Before writing, save the full before/after list — id, old title, new title — to `docs/report_run/DS_PREFIX_RENAME_<date>.json`, and commit it. **That file is the undo.** Without it, reversing means guessing where the prefix ended and the title began.
3. **Bounded.** Update `title` only. No other column, no other row. If the update statement could match a row not in the approved list, it is the wrong statement.

### 2.3 Check before you commit to it

Run the update inside a transaction and **report the row count before committing.** If the count does not equal the approved list length exactly, roll back and report — do not adjust the query until it matches, because a query that needed adjusting is a query whose selection was wrong.

### 2.4 Check the display side

Search the codebase for anywhere an idea title is **matched, parsed or compared** rather than merely displayed — an exact-title lookup, a slug derived from the title, a test fixture asserting a title, a hard-coded title in a script. **A rename breaks all of those silently.** Report what you find before Phase 2 rather than after.

---

## What to report

**Phase 1:** how the grouping works, the scoped list, anything ambiguous, the total list size, and anything that matches on title in code.

**Phase 2, after approval:** the transaction row count, the path of the undo file, and a spot-check of five renamed titles read back from the database.

⚠ **Nothing in Phase 2 runs until Charlie has said go on the Phase 1 list.**
