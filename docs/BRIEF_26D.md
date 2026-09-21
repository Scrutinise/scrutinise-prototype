# BRIEF — LEX 26-D: managing 49 ideas

**Thread:** LEX. **Written:** 20 September 2026.
**Source:** Charlie's specification of 20 September. CC has already reported this as one to two
sprints of its own rather than a slice of 26-C, and that assessment stands.

## §0 — Run mode and ordering

**Continuous.** Diagnose, record in the CHANGE_LOG, proceed — including where a finding contradicts
this brief. Batch the report. **Stop only for** spend beyond a ceiling or a change of scope.

⚠ **§1 is a report before it is a build.** Order and groups are both new per-user state. **Report the
data model, and if the honest answer is that this is two sprints, say so and do the first.**

⚠ **CLAUDE.md §25–§28 apply. Cold reads.** A CENTRAL session shares this repository: explicit file
paths only.

⚠ **Nothing here touches the workspace.** The three-panel editing view is confirmed working and is
the core of the product — **do not refactor anything it depends on.**

---

## §1 — Report the data model first

**Report, before building:**
- where a per-user ordering of ideas would live, and what it costs to read on every list render;
- what a group is — a row, a label, a join — and ⚠ **whether an idea may belong to more than one.**
  **Recommend one group at a time**, moving between groups rather than belonging to several, unless
  there is a reason not to;
- whether ordering and grouping are one piece of work or two.

⚠ **If it is two, build the ordering and stop.** Half a grouping feature is worse than none.

## §2 — Drag to reorder

**2a.** Ideas can be dragged into any order, and the order persists for that user.
**2b.** ⚠ **Report how this behaves on a touch screen.** Charlie walks the product on an iPad, and a
drag handle that works with a mouse and not a thumb is a feature he cannot use.

## §3 — The Manage button

**3a.** A **Manage** control at the top of the list. Clicking it puts a **checkbox on every card** and
reveals two actions:

1. **Delete selected**
2. **Group selected ideas under a heading**

**3b.** ⚠ **Both actions are disabled until at least one idea is ticked**, and say how many are
selected.
**3c.** Manage can be turned off again, and leaving it clears the selection.

## §4 — Delete selected

**4a.** ⚠ **It asks once, names how many will go, and lists them** — this is a bulk action and a
mis-click is expensive.
**4b.** ⚠⚠ **Deleted ideas remain recoverable**, as they are today, through the existing
*"N deleted → Restore"* route. **Confirm the bulk path uses the same mechanism as the single delete
and does not bypass it.**
**4c.** ⚠ **Delete must not reset the page.** That fault was reported in the last addendum; assert it
does not return with the bulk version.

## §5 — Group selected

**5a.** Choosing to group offers two routes:
- **A new heading** — a text box for its name;
- **An existing heading** — a dropdown of the groups that already exist.

**5b.** ⚠ **Where there are no existing groups yet, the second option is absent rather than an empty
dropdown.**
**5c.** An idea moved into a group leaves whichever group it was in.
**5d.** ⚠ **Report what happens to an empty group** — one whose last idea has been moved out.
**Recommend removing it silently** and say if that is wrong.

## §6 — How groups appear

**6a.** A group is a heading with its ideas beneath it, and **can be shown or hidden.** ⚠ Hiding a
group is what archiving used to be for, and it is better because it is named, visible and reversible.
**6b.** Ungrouped ideas sit above the groups. Both can be reordered.
**6c.** A group can be renamed, and ungrouped — its ideas returning to the ungrouped list, not
deleted.
**6d.** ⚠ **The count in the header stays honest.** *"My ideas (49)"* counts every idea, including
those inside hidden groups.

## §7 — The problem this is really solving

**Charlie, on the ideas list:** *"I am a little confused which ideas are David's from the Starkey
Thesis project and which are mine."*

⚠ **Report whether an idea already carries anything that distinguishes those** — an owner, a project,
a source. **If it does, say so: a label may solve his problem faster than grouping will**, and the two
are not alternatives.

## §8 — Acceptance criteria

- Ideas can be dragged into an order that persists, and the behaviour on a touch screen is reported.
- Manage reveals checkboxes and two actions, both disabled until something is ticked.
- Bulk delete asks once, names what will go, and its rows are recoverable by the existing route.
- Neither delete resets the page.
- Grouping offers a new heading or an existing one, and the existing option is absent when there are
  none.
- A group can be shown, hidden, renamed and ungrouped without losing an idea.
- The header count includes ideas inside hidden groups.
- Every check is a cold read.

## §9 — Say what only Charlie's browser can confirm

⚠ **Dragging is the item CC can least test.** Say plainly what was asserted and what was not.
