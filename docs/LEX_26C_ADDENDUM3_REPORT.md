# LEX 26-C ADDENDUM 3 REPORT — the page model, per Charlie, 20 September

## §22 — the 22 deleted ideas, answered first, as instructed

**All 22 still exist. None are gone.** Read directly off production: every row shows
`deletedAt` set (soft-deleted, not purged) — 19 on 26 Aug (a single-second batch, almost
certainly an old litter sweep of empty "Untitled idea" shells from before 25-I existed), one
on 19 Aug, one on 3 Sep ("Reinstating Biodegradable Plastic Straws" — a real idea, not a
shell), and the two from testing Delete during the last addendum (20 Sep, 04:45/04:51).

**How Charlie gets them back:** open "Your ideas" (`/ideas/mine`), click "22 deleted", press
**Restore** on any row. This is the exact mechanism built for §20 last time — nothing new was
needed, because "archive, never hard-delete" was already the rule Delete follows.

---

## §23 — five pages, and the mixed page removed

Built. The route map:

| Page | Route | What changed |
|---|---|---|
| New idea | `/ideas/build` | Stripped to the left-hand panel alone — no library column, no divider. |
| Your ideas | `/ideas/mine` (new) | The right-hand list, alone, on its own page — extracted from the old mixed page. |
| Idea overview | `/ideas/[id]` | Unchanged route; tidied per §24 below. |
| Edit idea | `/ideas/create?ideaId=…` | Unchanged route; now only ever reached via a decision made on the overview (§23d). |
| Mixed page | — | Removed. `/ideas/build` no longer renders `MyIdeasList`. |

- **§23a** — the "My ideas" nav link (`PublicNav.tsx`) now points at `/ideas/mine`.
  `/ideas/mine/page.tsx` checks the user's idea count first: **zero → redirects to the New
  idea door** (`doorPath(newIdeaDoor())`, the same switch every other "start an idea" control
  already uses); **some → renders Your ideas**. One URL for the nav to point at; the branch
  lives server-side, in the one place that can actually read the count.
- **§23b** — "New idea" carries a prominent "My ideas" button (styled as the on-screen label
  for "Your ideas" — see below), **greyed out and inert when the user has no ideas at all**.
  "Your ideas" carries a prominent "New idea" button, never greyed out — starting something
  new is always available.
- **§23c** — `MyIdeasList.hrefFor()` now always returns `/ideas/{id}` — every card opens the
  Idea overview, built or not. The old built/unbuilt branch that lived here moved to the
  overview's own "Edit" link (§23d) — see §23e for why that move matters, not just relocates.
- **§23d** — built. `IdeaDetailClient.tsx`'s "Edit" link now takes a `hasBuild` prop
  (`app/ideas/[id]/page.tsx`, computed on the same terminal-build criterion — DONE/FAILED/
  CANCELLED — that `/ideas/build`'s and `/ideas/create`'s own gates already use) and points
  at `/ideas/create?ideaId=…` when true, `/ideas/build?ideaId=…` when false. An unbuilt idea's
  Edit now returns straight to its own conversation on the New idea screen.

### §23e — the cause, not just the removal

**All three symptoms — "Editing returns to the mixed page," "Delete resets the layout," "a
card click returns to the default" — share one root, but it is not a single bug living in one
function. It is the same shape appearing at two different layers:**

**Layer 1 — the "New idea" screen was doing two jobs.** Before this addendum, `/ideas/build`
was simultaneously "the New idea screen" AND "the fallback destination for an idea that isn't
built yet" (via the §4 gate built two addenda ago). That gate was already correct: an unbuilt
idea's "Edit" link (`/ideas/create?ideaId=…`, unconditional at the time) got redirected back
to `/ideas/build` exactly as designed. But because `/ideas/build` was *also* rendering the
library beside the create flow, what Charlie saw at the end of that correct redirect was **the
still-"mixed" page** — indistinguishable from "Edit sent me to the wrong place," even though
the underlying decision was right. Splitting the pages (§23) doesn't patch this — it removes
the condition that made a correct redirect look like a wrong one. §23d additionally removes
the redirect hop itself: the overview now decides the destination directly, so there is no
hop left to be caught by anything downstream.

**Layer 2 — Delete and the card click were a genuine bug, found and fixed in the previous
addendum, and confirmed live.** `DeleteIdeaDialog`'s "Delete" button lived *inside* the card's
`<a href>`. `stopPropagation()` on an ancestor does not stop an anchor's native default
action — only `preventDefault()` does, and that dialog (built for a page with no enclosing
link) never called it. The delete succeeded every time (both test shells show `deletedAt` set
at the exact times Charlie tested); the same click's leftover navigation then fired anyway,
landing on the now-deleted idea and falling back to blank. Fixed structurally: the link and
the controls are siblings now, never one nested in the other.

**So: two mechanisms, not one, but both are now closed** — Layer 1 by §23's page split plus
§23d's direct decision, Layer 2 by the previous addendum's structural fix, which this
addendum's own testing (§22's evidence) confirms held.

---

## §24 — the Idea overview, tidied

- **§24a** — the five-tile stage stepper (`StageStepper`, `Create · Draft · Develop · Campaign
  · Legislate`) is removed from `IdeaDetailClient.tsx`. The single-stage badge in the header
  and the metadata column still say which stage the idea is at; only the five-tile bar is
  gone, along with the now-dead component that rendered it.
- **§24b** — the grey statistics box (`EvidenceFactsStrip`, rendered inline in the header) is
  removed.
- **§24c** — its contents move to a new **Stats** tab, between Research and Contributions, as
  bullet points: issues raised/resolved/open, known unknowns declared, sources by type, last
  deepening run. New file `app/ideas/[id]/StatsTab.tsx`; the old `components/lex/
  EvidenceFactsStrip.tsx` is deleted (fully superseded, and nothing else imported it).
  Owner-only, matching the retired strip's own rule.
- **§24d** — "Facts, not a score — only you can see these for now" is kept on the tab,
  verbatim, per your instruction not to lose it by omission. Flagging it here in case you
  disagree once you've seen it on the tab, rather than deciding for you.

`check:deepening`'s §24.1/§24.2 assertions were rewritten to point at the new file and render
site (same properties: the progress label, the triage logic, owner-gating, no score
vocabulary, no unreachable rungs) — one new assertion added for §24d specifically.

---

## §25 — grouping: still reported as its own sprint, not started

Reaffirming the previous addendum's answer, now against Charlie's fuller spec
(checkboxes + a Group control + a name box, drag-to-reorder, drag-one-idea-onto-another):
**this remains a sprint (realistically two) on its own, not a slice of this one.** Nothing
about the fuller spec changes that conclusion — if anything it confirms it, since drag-to-
reorder across groups is explicitly the larger of the two halves already flagged. The
proposed data model (`IdeaGroup` + float `orderIndex` on both the group and the idea, for
drag-drop without renumbering) stands from the previous report. Not built this pass, per your
own instruction not to half-build it.

---

## Checks run

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `npm run check:client-boundary` | clean (591 files, 139 client) |
| `npm run check:scripts` | clean |
| `npx tsx scripts/check-lex-25j.ts` | 12/0 (two rules rewritten for §23c/§23; comment-detection bug in the second-person check fixed along the way — see below) |
| `npx tsx scripts/verify-my-ideas-ui.tsx` | 17/0 (hrefFor assertions rewritten for §23c) |
| `npx tsx scripts/verify-lex-25e-ui.tsx` | 20/0 |
| `npx tsx scripts/check-lex-25e.ts` | 25/0 |
| `npx tsx --env-file=.env scripts/check-lex-26c-addendum.ts` | 6/0 (rewritten for §23c/§23d — every card opens the overview; the overview's Edit link is what's asserted cold now) |
| `npx tsx scripts/check-deepening.ts` | 1 pre-existing failure, unrelated (see below); every §24 assertion passes |
| `npx tsx scripts/check-lex-25h.ts` | 19/1 — the same pre-existing, unrelated failure carried from the last two reports |

**A real check bug found and fixed along the way, not just papered over:** `check-lex-25j.ts`'s
second-person-heading rule skipped comment lines starting with `//` or a continuation `*`, but
missed two real shapes — a `/**`/`/*` block's own opening line, and a `{/* … */}` JSX comment
whose continuation lines carry plain indented prose with no per-line marker (exactly this
addendum's own comment style). Both were flagging my *comments* as violations. Fixed properly:
block comments are now stripped from the source before the regex ever runs, rather than
guessing at every prefix a continuation line might start with. Separately, one **real**
violation was found and fixed in actual UI copy: the new "Your ideas" page had literally
rendered `<h1>Your ideas</h1>` and a button said "Your ideas" — both renamed to **"My ideas"**
to match the established first-person rule for a collection heading (25-J §1). "Your ideas" is
this page's name in the brief and in my own comments; the product's own voice still says "My."

**Pre-existing, unrelated, confirmed by inspection:** `check-lex-25h`/`check-deepening` both
report the same one red — `lib/lex/build-client.ts` and `lib/lex/deepening-adversarial.ts`
respectively missing strings this addendum never touched. Verified by grep before writing this
down, per CLAUDE.md §0.

---

## What only your browser can still confirm

- The full five-page loop, clicked through: nav → New idea or Your ideas → a card → the
  overview → Edit → the right destination, for both a built and an unbuilt idea.
- §23b's greyed-out button, actually looked at (is "inert and visibly so" clear enough with
  colour removed, per the standing CLAUDE.md §21 rule).
- The Stats tab's bullet layout and whether "Facts, not a score" still reads right in its new
  home (§24d — flag it if you want it gone).
- §22's Restore, clicked for real, on one of the 22.
