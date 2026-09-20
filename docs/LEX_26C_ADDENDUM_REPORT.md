# LEX 26-C ADDENDUM REPORT — Charlie's walkthrough, 19–20 September

Two addenda, taken together. **§16 first, as instructed** — Charlie had had no report from
26-C at all before this walkthrough and was inferring entirely from screenshots.

---

## §16 — what 26-C actually shipped, section by section

| Section | Status | Note |
|---|---|---|
| §1 (the freeze) | **Done** | Diagnosed against the real frozen idea (`a1a08ff4`) and fixed at the root — invisible from a screenshot because it's an absence-of-a-bug, not a UI change. |
| §2 (one box) | **Done**, now revised again by this addendum's §14 | |
| §3 (two prompts, then build) | **Done** | |
| §3d (email sentence) | **Not added** — waiting on you to send a test and confirm it arrived. Invisible because nothing changed. |
| §4 (build gate) | **Done** | |
| §5 (draft title) | **Done in code, unverified against a real build** — see §12 below; no new idea has been started since the 26-C deploy to exercise it, so I could not confirm it from data alone. |
| §6 (layout) | **Done**, now revised again by this addendum's §15 | |
| §7a (every idea listed) | **Done** | |
| §7b (archive/delete) | **Done in 26-C, revised by this addendum's §18** — Archive is removed (§18b) | |
| §7c (drag to reorder) | **Not started** — correctly read from your screenshots. No schema exists. Folded into §19 below. |
| §7d (grouping) | **Not started** — correctly read. §19 below is the design. |
| §8 (colour) | **Done** — invisible from a plain screenshot; needs the section actually opened, and ideally with colour removed, to see. |

**Why §1, §3d and §8 read as invisible:** §1 is the absence of a bug, which a screenshot
cannot show either way. §3d is copy that was deliberately NOT added. §8 only shows on the
FieldsPanel's active-section heading inside an idea's own workspace, not on the front screen
your screenshots were taken from.

---

## §17/§21 — Delete resets the page; clicking a card doesn't open it

**§21a asked for one mechanism, not two symptoms. Found.**

Both are the same bug: `DeleteIdeaDialog`'s own "Delete" confirm button lived **inside** the
card's `<a href>` (via `CardControls`, nested inside the link). `stopPropagation()` on an
ancestor does not stop an anchor's native default action — only `preventDefault()` does, and
`DeleteIdeaDialog` (built for a page with no enclosing link) never calls it. So:

1. The delete API call succeeds.
2. The SAME click's native default action then fires anyway, navigating the browser to that
   now-deleted idea's own `href`.
3. Landing on a just-deleted idea finds nothing to open, and the page falls back to a blank
   screen — which reads as "the layout springs back to default."

**Confirmed live, not just in the code**: two "Untitled idea" shells on your account show
`deletedAt` set at 04:45 and 04:51 on 20 September — the delete genuinely worked every time;
it was the leftover navigation afterwards that looked like a reset.

The reason this is the SAME mechanism as "clicking an idea doesn't open it": the identical
anti-pattern — an interactive control nested inside a link — makes ANY click near a control
button in that row unreliable, not just Delete's. The fix removes the pattern rather than
patching one button: the link and the controls (Archive/Unarchive, Delete) are now **siblings**
in one row, never one nested inside the other, so nothing interactive can ever hijack the
anchor's navigation again — in this file or the next thing added to it.

**§21c — asserted cold, on real ideas, not fixtures.** New check
`npm run check:lex-26c-addendum`, which reproduces both routing decisions against your actual
account: idea `a1a08ff4` (unbuilt) resolves to `/ideas/build` and opens correctly there; idea
`31055aef…` (built) resolves to `/ideas/create` and the build-gate does not bounce it back. 5/5
passed, including a control proving the gate can still refuse an idea that has no build.

---

## §11 — "My ideas" always opens on a blank new idea

Built. The auto-resume query (25-E §2) is removed entirely. A bare landing on `/ideas/build`
is now always the blank intake screen; resuming a specific idea only happens via an explicit
`?ideaId=`, i.e. a click in the library. The "Picking up where you left off / Start a
different idea instead" banner is retired with it.

**Refines §4b, does not reverse it**, as you specified: exiting and returning **from within** a
specific idea's own page still returns to that idea (its id is already in the URL). Only a
bare landing with no id at all is now always fresh.

**Replaces the old banner with an identity confirmation** (feeds directly into §21): whenever
an idea is opened explicitly, the screen now says "Continuing: {title, or your own words, or
'a new, empty idea'}" — so opening an old, titleless, mostly-empty idea no longer looks
identical to starting fresh.

---

## §12 — every idea gets a draft title the moment the first message is sent

**This was already built by 26-C's own §5** — the same `proposeTitle()` call, in the same
place (the intake branch of `answerStep`, which only runs once, on the first message).
§12 restates §5's requirement rather than asking for something new. **Not independently
verified against a live build**: no new idea has been started on your account since the 26-C
deploy (only the pre-existing frozen `a1a08ff4`, from before this code existed, and two empty
shells that were deleted). The frozen MiFID idea showing no title is exactly what a title
generated only at build time — the OLD, pre-26-C behaviour — looks like, and predates the fix
by design; it is not evidence the fix doesn't work. **Action needed:** start one genuinely new
idea and confirm a title appears after the first send.

---

## §13 — the right-hand list

All three built, alongside the §17/§21 restructure (they turned out to need the same change
to the row's markup):

- **§13a** — the text column is now `flex-1`, sitting beside the controls rather than sharing
  a flex row where wrapping could squeeze it. It runs the full width available to it at every
  size.
- **§13b** — below `sm:`, the row is `flex-col` with the controls FIRST (their own line) and
  the text SECOND, per your ordering; at `sm:` and above it reverts to text-left,
  controls-right.
- **§13c** — the library `<section>` carries `min-w-[220px]`; the divider's drag range
  (50–85% for the left column, unchanged) can now only take width AWAY from the left column
  once the right one hits that floor, rather than continuing to compress it into
  unreadability.

---

## §14 — the left panel

All built:

- **§14a** — the second box is gone. One box.
- **§14b** — its own encouragement is now the fifth bullet, verbatim
  (`BACKGROUND_INTRO`, unchanged as a string, just relocated).
- **§14c** — the placeholder is now "In your words…"; the instruction above the bullets
  (`PROBLEM_INTRO`) is unchanged and no longer duplicated by the placeholder.
- **§14d** — "The first step" is bold; the rest of the sentence is not. Split on the
  constant string itself, so the bold prefix and the constant cannot drift apart.
- **§14e** — "Write something in the first box." is removed from beside Send; the disabled
  button already carries that information.
- **§14f** — the box is `2fr`, the instruction+bullets column `1fr` (two-thirds/one-third).
- **§14g** — the "+" file/link control now sits under the one remaining box, and — new in
  this addendum — it **creates the idea on click** if none exists yet, rather than waiting
  for the first Send. A deliberate click on "+" is the same kind of act as pressing Send
  (25-I §1's rule was about silent creation on merely ARRIVING, not on a click), so this
  does not reopen that defect.

---

## §15 — the header

Built, superseding this sprint's own earlier §6d placement:

- **§15a** — "How this works" is back to the blue, bold pill, top right, beside Exit — on
  every screen this component renders (front screen and post-build alike), not only once a
  build exists.
- **§15b** — "Create a new idea" and "My ideas" are both `text-lg font-semibold
  text-zinc-900` — the same level, size and weight — sitting on the line below the header bar,
  one per column.

---

## §18 — Archive

**§18a, answered before anything was removed, as instructed.** An idea archived before this
addendum (or after §18b, if anything is un-archived and re-archived by some other means —
though the action to newly archive no longer exists) stays reachable exactly as it always
was: the library's "N archived" link reveals them, and each carries **Unarchive** to bring it
straight back to the active list. Nothing already hidden becomes unreachable.

**§18b — built.** The **Archive** action button is removed from every active-idea card.
Grouping (§19, below) is where "hide something without deleting it" moves to, once it exists.
**Unarchive stays** on any card that is already archived, so existing archived ideas are not
stranded in between now and whenever §19 ships.

---

## §19 — Grouping, reported per §19e before any of it is built

**§19e: this is a sprint on its own, not a slice of this one.** Both halves are new per-user
state with no existing column to extend — the same conclusion §7d already reached about
grouping specifically, now with your fuller spec (§19a–§19d) making the size clearer rather
than smaller.

### Proposed data model

```prisma
model IdeaGroup {
  id        String   @id @default(uuid())
  ownerId   String
  owner     User     @relation(fields: [ownerId], references: [id])
  name      String
  hidden    Boolean  @default(false)
  orderIndex Float   // among the owner's groups; see note below
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  ideas     Idea[]
}
```

`Idea` gains two nullable columns: `groupId String?` (FK to `IdeaGroup`, `SET NULL` on
delete — deleting a group ungroups its ideas rather than deleting them) and `orderIndex
Float?` (position within whichever list currently contains it — a group, or the top-level
ungrouped list).

**Why `Float`, not `Int`, for both order columns:** a plain integer position needs every
later row renumbered on every insert; a float lets a drop between position 3 and 4 take the
value `3.5` with nothing else touched, and is the standard technique for exactly this UI
(occasionally renormalised in a background pass if values get too close together — not
needed at the scale one user's idea list will ever reach).

### What has to be built, roughly in this order

1. **Schema migration** (additive, as above) — its own commit, applied and read back before
   any code depends on it, per standing practice.
2. **Checkbox mode** (§19a second method) — a toggle that puts a checkbox on every card;
   selecting more than one reveals a "Group" button and a name box (§19b); submitting creates
   an `IdeaGroup` and assigns `groupId` to the selected ideas.
3. **Drag-onto-another-idea** (§19a first method) — dropping idea A onto idea B either joins
   an existing group (if B has one) or creates a new one from just those two.
4. **Show/hide per group** (§19c) — `hidden` toggle; a hidden group's ideas drop out of the
   active list the way archived ones used to, which is the thing §18b's removal is betting on
   existing soon.
5. **Drag to reorder, within and across groups** (§19d) — the `orderIndex` writes, plus the
   library's rendering grouped-then-ordered rather than a flat list.

Item 5 is the largest of the five on its own — cross-group drag-and-drop with persisted order
is a materially different UI from the flat list this sprint built, needs its own pointer/touch
handling (distinct from the column-resize divider, which only moves in one dimension), and
needs deciding what "drop onto a group's header" versus "drop onto a specific position inside
it" each do. **Recommendation: land 1–3 as one sprint (grouping exists, can be created and
populated) and 4–5 as a second (grouping is actually useful day to day)** — 3 alone restores
what Archive did (something is hidden from the default view) via item 4, without yet
committing to the harder cross-group drag mechanics.

---

## §20 — Delete must be recoverable (Archive is gone; this is now the only removal)

**Proposed as two options; Charlie chose B (the reachable view). Built.**

**A — confirm, name, and a time-boxed undo** (not built): `DeleteIdeaDialog` (unchanged) plus
a toast for N minutes offering Undo. Cheap, but recovery needs a database operation by hand
once the window closes.

**B — a reachable "Deleted" view — BUILT.** Symmetrical with the archived-ideas toggle: "N
deleted" reveals every soft-deleted idea, each with a **Restore** button
(`PATCH /api/ideas/[id]/restore`, the exact inverse of the existing delete route — it clears
the same `deletedAt` column). No time limit and no purge job: a deleted idea stays reachable
for as long as the row exists, which is the same "archive, never hard-delete" principle
Archive itself always followed, now covering the one action that replaced it.

**Deliberately not built:** an automated purge after N days. Nothing currently ages out a
soft-deleted row, so deleted ideas accumulate in the database indefinitely (harmlessly — they
are excluded from every query that matters, per `deletedAt: null` filters already in place
everywhere). If storage or a data-retention policy ever makes this worth doing, it is a
separate, schedule-driven job, not a change to this screen.

---

## Checks run

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `npm run check:client-boundary` | clean |
| `npm run check:scripts` | clean |
| `npx tsx scripts/check-lex-25e.ts` | 25/0 (four §2 assertions retired for §11, one new pair added — same pattern as 26-C's own first pass) |
| `npx tsx scripts/verify-lex-25e-ui.tsx` | 20/0 (IntakeCard assertions updated for the one-box shape) |
| `npx tsx scripts/verify-my-ideas-ui.tsx` | 17/0 (two new §20 assertions — the "N deleted" toggle appears/doesn't) |
| `npx tsx scripts/check-lex-25j.ts` | 12/0 (one rule widened for the third `deletedIdeas` prop) |
| `npx tsx --env-file=.env scripts/check-lex-26c-addendum.ts` (new) | 5/0 — §21c's cold assertion, on real ideas |

## What only your browser can still confirm

- §12: start a genuinely new idea and confirm a title appears after the first send.
- §17/§21's fix, clicked through for real — the diagnosis is confirmed by the database
  evidence above, but the fix itself has not been through a browser.
- §20: delete an idea, open "N deleted", press Restore, confirm it's back on the active list.
- §13's stacking at an actual narrow width, and the divider's new floor.
- §14's 2/3–1/3 split and the bold lead-in, as rendered.
- §15's header, and whether the blue pill reads right back at top-right rather than centred.
