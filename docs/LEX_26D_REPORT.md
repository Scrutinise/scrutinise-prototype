# LEX 26-D REPORT — managing 49 ideas

**Date:** 2026-09-20 17:02 UTC. **Brief:** `docs/BRIEF_26D.md`.

## §1 — The data model, reported before anything was built

**Where a per-user ordering would live, and its read cost.** An idea already belongs to exactly
one creator (`Idea.creatorId`), so an ordering of "my ideas" is per-user by construction — no join
table is needed unless the same idea could be ordered differently for two different viewers of it,
which is not a thing this product does. Built as one new nullable column, `Idea.ownerOrderIndex
Float?`. Cost to read: one extra column in the query `/ideas/mine/page.tsx` already runs — no
extra join, no extra round trip. `NULL` means "never explicitly ordered", and sorts after every
explicitly-ordered row, by `updatedAt` as today — so nothing about the existing list changes until
a user's first drag.

**What a group would be, and whether an idea may belong to more than one.** A group is one row
(`IdeaGroup`, or equivalent) with a name and an owner, and membership is a single nullable FK on
`Idea` (`groupId`) — one group at a time, moving between groups rather than belonging to several.
This was already the recommendation in the 26-C addendum 3 report and nothing in this sprint's
investigation changes it: Charlie's own stated problem (§7, below) is "which ideas are David's
and which are mine" — a partition, not an overlapping tag set — and a single FK is the simplest
structure that answers it. **Not built this sprint** — see below.

**One piece of work or two.** Two. Ordering touches one existing table (`Idea` gets one column)
and one list's sort order. Grouping needs a new table, a new relation, bulk-select UI (§3), a
delete/group action bar (§4–§5), and display/rename/hide semantics (§6) — a materially larger
surface, and one the 26-C addendum 3 report already scoped as its own 1–2 sprints. That assessment
stands. **Per the brief's own instruction ("if it is two, build the ordering and stop"), this
sprint built §1's report and §2's drag-to-reorder only. §3–§6 (Manage mode, bulk delete, bulk
group, group display/rename/hide) are NOT built.**

## §2 — Drag to reorder

**§2a — built.** `Idea.ownerOrderIndex` (migration `prisma/lex_26d_owner_order.sql`, applied to
production Neon before the schema commit, per CLAUDE.md's schema-before-migration-together rule).
`PATCH /api/ideas/reorder` (`app/api/ideas/reorder/route.ts`) takes the full dropped order as a
list of idea ids, scopes it to the caller's own, non-deleted ideas — silently excluding any id
that is not theirs rather than erroring the whole drop, so a stale list on one tab can't block an
otherwise-valid drag — and rewrites `ownerOrderIndex` as sequential integers `0..N-1` for the
dropped order, in one transaction. `/ideas/mine/page.tsx` now sorts active ideas by
`ownerOrderIndex` (nulls last) then `updatedAt`. `components/lex/MyIdeasList.tsx` renders a drag
handle (⠿) on each active-view row, using Pointer Events (`onPointerDown` + `setPointerCapture` +
`pointermove`/`pointerup`/`pointercancel`) — this codebase's established cross-device drag
mechanism (`components/lex/PanelDivider.tsx`), chosen because native HTML5 `draggable` does not
fire on touchscreens without a polyfill. A keyboard fallback (arrow-up/arrow-down on the handle,
via `onNudge`) reorders one row at a time and persists the same way, for anyone who cannot
perform a pointer drag at all. Deleted-view rows do not get a handle — the brief's own scope is
the active library list.

**§2b — reported, not assumed.** Pointer Events are the correct API for touch — they unify mouse,
touch and pen input, and are what this codebase already relies on for a working touch control
(the panel divider). **This has NOT been tested on an actual touchscreen or iPad.** I have no way
to simulate a real touch gesture, `pointercapture` semantics, or iOS Safari's touch-scroll
interaction with a drag handle from here. `touch-action: none` is set on the handle specifically
to stop the browser's own scroll gesture from competing with the drag, which is the standard fix
for that interaction — but whether it actually feels right on an iPad, whether the target is big
enough for a thumb, and whether `elementFromPoint` correctly resolves the row under a touch point
(as opposed to a mouse pointer) are all unverified. The keyboard nudge exists as a fallback
precisely because dragging is the one control here that cannot be proven from a terminal.

## §7 — Does an idea already carry a distinguishing label?

Charlie: *"I am a little confused which ideas are David's from the Starkey Thesis project and
which are mine."* Queried production directly rather than reasoning from the schema:

- `Idea.ideaOrigin` — an enum, but its only value across every row is `USER`. No project/source
  distinction lives here.
- `Idea.collaborators` (`IdeaCollaborator`) — exists as a relation, but does not distinguish
  *who created* an idea; it records who else has access to it.
- `Idea.spawnedFromIdeaId` — a parent-idea link (CCW-B22 §7's "questions that need their own
  idea"), not an owner or project field, and unrelated to this problem.
- Title search for "Starkey" and a search for any user named David: **no match found** in
  production. Whatever Charlie means by "the Starkey Thesis project" is not currently represented
  anywhere in the data — not as a project field, not as a second account, not as a title
  convention.

**Conclusion: no existing field or label solves this.** There is nothing to surface faster than
building it. Grouping (§1, §6) is the mechanism that would actually answer Charlie's stated
problem, and it remains scoped as its own sprint, not built here.

## §9 — What only Charlie's browser can confirm

- **The drag gesture itself, on a touchscreen** (§2b) — Pointer Events should work in principle;
  untested on real touch hardware from here.
- **Whether the drag handle is comfortably sized and positioned for a thumb** on an iPad, as
  opposed to a mouse pointer — a render check cannot judge a hit-target size against a real
  finger.
- **Whether the pointer-capture drag interacts correctly with page/list scrolling** on iOS Safari
  specifically (`touch-action: none` is set to prevent the conflict, but iOS Safari has its own
  history of exceptions to standard touch-action behaviour that only a real device will show).
- **Whether the reordered list "feels" right** — visual feedback during a drag (the dragged row's
  `opacity-40` state) is a design choice made without seeing it move on a real screen.

## What was checked

Full regression suite run after the change, all cold reads against real or fixture data as
established by each script's own convention — no new regressions:

- `npx tsc --noEmit` — clean.
- `npm run check:scripts` — clean.
- `npm run check:client-boundary` — clean, 592 source files, 139 client components, no edge.
- `verify:my-ideas-ui` — 17/0.
- `check:lex-25j` — 12/0.
- `check:lex-26c-addendum` (`--env-file=.env`) — 8/0.
- `check:lex-25e` — 26/0.
- `verify:lex-25e-ui` — 20/0.
- `check:lex-25r` (the cold-read instrument) — 43/0, 1 honestly not-checked, 8/8 controls fired.

A case was added to the standing cold-read instrument, `check:lex-25r`, per CLAUDE.md §26 ("every
sprint that ships a user-visible feature adds a case to it"): it asserts the reorder route's
owner-scoping and the page's `ownerOrderIndex`-first sort as source properties (legitimate here
because the property genuinely is about the code, not a value — proving the scoping live needs an
authenticated cross-account request this script does not have), then reads production read-only
for any row actually carrying a value. **It found none** — nobody has dragged since the feature
shipped — and reports that honestly as NOT CHECKED rather than skipping it silently or asserting
against a fixture it created itself.

⚠ **Running the full suite also surfaced a stale, unrelated assertion**: `check:lex-25r`'s check on
`FieldsPanel.tsx` calling the shared collapse rule was written against `pageCollapsedByDefault(page.status)`
with one argument; a prior sprint (25-Z §2a, before this session's 26-C/26-D work) added a second
argument (`{ freshlyOpened }`) to that call and nobody re-ran `check:lex-25r` to catch the drift —
it wasn't part of any 26-C addendum's reported suite. The underlying property still holds (the
panel calls the shared function, not a local copy); only the regex's arity was stale. Fixed in the
same pass, `check:lex-25r` now 43/0/1-not-checked/8-controls-fired, 0 dead.

## What was deliberately NOT built this sprint

Per §1's own conclusion and the brief's explicit instruction:

- §3 — the Manage button, checkbox mode, bulk-select state.
- §4 — bulk delete (confirmation dialog, count, list of what will go).
- §5 — bulk group assignment (new-heading / existing-heading routes).
- §6 — group display, show/hide, rename, ungroup, and the header count's honesty across hidden
  groups.

The three-panel workspace was not touched, and nothing it depends on was refactored, per the
brief's explicit instruction.

## Left for next session

- §3–§6 (grouping and bulk actions) as their own sprint, per §1's conclusion.
- Once a real drag has happened on production, re-run `check:lex-25r` — the "26-D §2" case will
  move from NOT CHECKED to a real pass, which is the confirmation that persistence works end to
  end on a genuine user action rather than only on the route's own source.
