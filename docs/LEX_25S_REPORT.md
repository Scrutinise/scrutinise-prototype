# Sprint 25-S — make the diagnosis workable and the sort visible

**1 September 2026, 17:41 UTC.** Brief: `docs/BRIEF_25S.md`.

Every check in this sprint is a cold read — CLAUDE.md §26, written this afternoon and available
from the start of a sprint for the first time.

```
check:lex-25s   33 passed, 0 failed, 1 NOT CHECKED, 6 controls (0 dead)
```

---

## §1 — The sort has to show its working

### §1.4 first, because it changes how to read the rest

⚠⚠ **The sort has still never run in a real build.** All five completed builds in the database
predate the in-build sort shipping at 14:00 today:

```
  31055aef v1  12:36   predates it
  452c5ade v8  10:40   predates it
  452c5ade v6, v5, v1  (August)
  35 policy options · 35 numbered · 0 sorted · 0 carry a reason · all GUIDING_POLICY
```

**So everything in §1.1 and §1.2 is built against data that does not exist yet.** The groups will be
empty of actions and goal-restatements until a build runs, and the history lines will say
"Guiding policy" and nothing else. That is reported rather than papered over, and the check records
it as **NOT CHECKED** rather than passing on an empty set. *Do not read §1 as verified.*

**What is verified cold**: all 35 policy options carry their stable number. 25-R's fix holds.

### §1.1 — the headings are the sort

⚠ **Partly already built, and the missing part was the one that mattered.** "Really coherent
actions (3)" and "Really the goal restated (2)" have carried headings and counts since 25-P. The
**guiding-policy group had none** — so the top of the screen read as *the list* and the other two as
appendices to it. A heading with a count is there now, and the three read as three groups.

### §1.2 — one line of its own history

`lib/lex/policy-history.ts`, pure, so the cold read runs the same function the browser runs. The
vocabulary is §1.2's, verbatim: kept, demoted, set aside, clustered, merged, restored, ruled out.

⚠ **The property under test is the *distinction*, not the presence.** §1.2's last sentence — *"A
card with no history carries no line. Do not invent one."* — is the whole feature: if every card
gets a line, the line stops meaning anything, which is the failure §1 is about one level down. The
check asserts that every untouched candidate on production produces `null`.

⚠ **A cluster is not history, and it is a separate function.** A cluster is a relationship computed
from the causes each policy attacks — nothing was written, so §1.3's undo has nothing to undo there.
Reporting it as history would promise a control that cannot exist.

### §1.3 — every move can be undone

One op, `undoSort`, for both directions the sort can move a card: demoted to a coherent action, or
set aside as a restatement. Two ops would be two things to keep in step; the user is doing one
thing. The number comes back because it never left.

**Asserted both directions, as §1.3 demands** — and this is the one fixture in the file, because a
restore cannot be read off production, only performed: undo returns it to the guiding-policy group
with its number, **and it is genuinely gone from the group it left**.

---

## §2 — Causes: numbers, order, nesting

### §2c — what the model already supports, reported before building

**Everything the drag needs.** `DiagnosisCause` already has the self-relation — `parentCauseId`
with `parent`/`children`, `onDelete: Cascade`, indexed — plus `orderIndex`. 25-M introduced it,
25-O settled the direction. **So drag-to-nest writes `parentCauseId` and drag-to-reorder writes
`orderIndex`; there is no second structure.** Measured: 22 causes across 7 ideas, 6 with a parent,
deepest chain **2**.

### §2d — what happens today if a loop is attempted

⚠⚠ **It cannot be attempted, because there is no move operation.** `add` takes an optional
`parentCauseId` — creating a *new* child — and `update` writes only `cause`, `whyPersisted` and
`evidence`. **Nothing re-parents an existing cause.** A cycle has been unreachable rather than
guarded.

That matters for how the guard was built: **it ships in the same change as the move that makes a
loop possible.** And a loop here would be worse than a wrong answer — `children` is walked
recursively to render, so a cycle is a hang. The route refuses by name, 409, rather than
silently no-opping.

⚠ The guard's walk is bounded by a `seen` set rather than a depth limit, so it terminates on data
that is *already* cyclic and answers "yes, a cycle" — the safe direction.

### §2a/§2b/§2e — what was built

- **`DiagnosisCause.number`**, assigned **where the row is created** (25-R's lesson applied before
  it could be repeated), and **22 rows backfilled** — re-read confirms 0 unnumbered, 0 collisions.
- ⚠ **It is not `orderIndex`.** That is the display position and is exactly the thing that moves.
  Reorder rewrites `orderIndex` for the whole list and never touches `number`, so a cause dragged
  to the top is still cause 7 and "cause 7 is wrong" survives the drag.
- **Two drop targets, because there are two gestures**: the card body nests, a thin strip along the
  top edge reorders. One target doing both would make every reorder a coin-toss, and the undo for
  one is not the undo for the other.
- **Undo** is the same operation with a null parent — one code path, so the undo cannot drift from
  the do.

⚠ **`orderIndex` is barely populated** — 22 causes use 6 distinct values — so a reorder rewrites
the whole list rather than trying to slot a value between two neighbours that frequently have no
gap between them.

---

## §3 — The Map is a diagram

### §3d — the width, reported before building

⚠ **Computed from `panel-layout.ts`, not measured — the browser renderer froze during 25-R's
addendum and I did not get a live figure.** `DEFAULT_LAYOUT.width.middle` is **0.3125** of the row;
`MIN_WIDTH` is **0.15**. On a 1512 px window (~1480 px of row): **≈462 px default, ≈222 px at the
floor**, less ~40 px padding → **≈420 px and ≈180 px usable**.

**A four-deep tree does not fit in 180 px.** So the diagram lays out at its natural width and
**scrolls horizontally inside its own container** — the panel never scrolls sideways. It is legible
at the 420 px default. ⚠ **If Charlie wants it comfortable at the minimum width, the answer is an
expand control or opening it in THE RESEARCH panel** — that is a design decision, reported rather
than assumed.

### §3a — SVG, not Mermaid, and why

1. **Mermaid is ~half a megabyte** of client bundle for one diagram of a dozen nodes, on the app's
   busiest page.
2. **Its layout engine assumes it can have the width it wants** — it would produce a correct
   diagram at a width this column does not have.
3. **Its styling is where colour creeps in.** §3c forbids meaning carried by colour alone, and
   Mermaid encodes node classes as fills; overriding that is more work than drawing the tree.

A tree of at most four levels with one parent each has a closed-form layout. Hand-drawn SVG, no
dependency.

### §3b/§3c/§3e

- **Direction**: material cause at the top, what it follows from beneath — 25-O's settled
  convention, the same one the list's indentation already uses. No second convention.
- **Nothing encoded by colour alone**: a material cause is a 2 px border **and the word
  "material"**; contributory is a 1 px dashed border **and the word**; the root carries a "root"
  label; and every node carries its §2a **number**, so the diagram and the list name the same
  things the same way. Colour remains, and is never the only cue.
- **The list keeps its indentation** — that is the view whose job is to show nesting inside a
  linear read.

---

## Notes on the run

⚠ **`package.json` was not touched.** §0 flags it as contended with a CENTRAL session. It was
unmodified when I checked, so no conflict exists — but rather than add a `check:lex-25s` script and
create one, the check runs as
`npx tsx --env-file=.env scripts/check-lex-25s.ts`. **If you want it in the suite, that one line is
yours to add when the CENTRAL work lands.**

⚠ **44 files in the tree belong to that other session** and none of them is in these commits, which
are by explicit path only.

⚠ **One thing caught before it shipped**: the two undo buttons were wired to `post()`, which is the
`sort`/`merge` endpoint, rather than `patch()`, which takes the ops. They would have 422'd — two
controls that look right and do nothing, which is the class of the last three sprints. Found by
reading the call site against the route's own schema.

---

## §5 — What only Charlie's browser can confirm

1. **The drag interactions.** Reorder and nest are HTML5 drag events; the check asserts the routes,
   the guard and the API shape, and cannot press a mouse. In particular: whether the thin strip
   along the top edge of a card is findable, and whether dragging feels like it grabs the right
   thing in a 420 px column.
2. **Whether the diagram is legible at the panel's real width.** The 420 px figure is *computed*,
   not measured, and everything about the layout follows from it.
3. **Whether the group headings and history lines make the sort visible to somebody who did not
   build it** — the actual question §1 exists to answer, and the one no assertion can reach.
4. **⚠ All of §1's output, because the sort has never run.** Until one full build runs after 14:00
   today, the groups and the history lines have nothing to show but "Guiding policy". That build
   costs three credits and is the only way to see whether this sprint worked.
