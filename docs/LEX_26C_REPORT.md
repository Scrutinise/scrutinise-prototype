# LEX 26-C REPORT — one box, and the library

**Brief:** `docs/BRIEF_26C_v2.md`. **Run:** 19 September 2026, 01:1x–03:19 UTC.
**Mode:** continuous, per §0 — diagnose, record, proceed; batch the report.

---

## §1 — The page froze (diagnosed first, as instructed)

### What actually happened, read off production

Idea `a1a08ff4-c0ef-46ad-8c2b-428c9a638536` ("MiFID II"), Charlie's account, is the frozen idea.
Read directly from Neon (`ideaElicitation` row + `Idea.aiChatHistory` transcript), not inferred:

```
problem: "It raises the cost of doing research which means less information is available
          on the stocks trading in the market, amongst other issues which I hope your
          first build will surface."
problemPresses: 1
problemGateFired: true
goalDetail: null      ← never reached
status: IN_PROGRESS
createdAt: 01:10:36 UTC   updatedAt: 01:14:47 UTC
build count: 0
```

Transcript, in order:
1. `01:10:36` Lex — opening ask.
2. `01:10:38` **user** — "I want to revoke Mifid II because it is damaging and expensive
   legislation that undermines the City of London as a financial centre."
3. `01:10:38` **Lex** — the problem-gate press (the text is solution-shaped: "revoke X"), asking
   what is actually going wrong.
4. `01:14:47` **user** — his second answer, quoted above, answering the press.

Nothing after (4). No build, no further messages, updated-at frozen at 01:14:47.

### Which of the three named hypotheses

**§1a asked: swallowed error, silent turn cap, or a reply produced and never rendered? "The third
has been the answer six times this month."** It is the third again, with the mechanism now traced
exactly:

`answerStep`'s 'problem' case, on Charlie's second answer: `looksLikeASolution()` on his SECOND
text returns **false** (he is now describing a harm, not a remedy) — so `shaped = false`,
`willPress = false`, and the code takes the **non-press branch**: it updates `problem` in the
database (this is why the DB shows his SECOND text, overwriting the first) and, because
`shaped` was false, **appends no Lex bubble at all**. `maybeAskForConfirmation` then recomputes
state: `problem` is now "done" (gate no longer outstanding), so `current` advances to `'goal'` —
correctly, silently, with **nothing written to the transcript** to say so.

Every step's question OTHER than 'problem' was never written to the transcript in the first
place — it lived only as a static string on the `QuestionCard`, rendered directly from
`ELICITATION_STEPS[key].question`/`cardPrompt`. So the sequence a real user experiences at this
exact moment is: their own message appears (a chat bubble), and the ONLY thing that should
happen next is a **card**, not a bubble, appearing below it with the next question — a
different visual grammar from everything before it, with no transitional acknowledgement in
the conversation itself. If the client has *any* hiccup rendering that card at that instant
— and the request/response cycle here involved no network delay to explain one — there is
**nothing else on the page to suggest a turn was taken at all.** That is indistinguishable
from "the page froze."

**This is the same fault, generalised, that 25-E already fixed once** (the `UNDERSTANDING_FAILED`
dead end): a step can complete with no acknowledgement, and the acknowledgement is precisely
where a defect hides best, because its absence looks like nothing happened rather than like
something failed.

### The fix

Rebuilt as part of §2/§3's redesign (below), on a principle stated in the code: **every user turn
now either appends a Lex bubble to the transcript, or is the LAST allowed turn — in which case the
same request also runs `maybeAskForConfirmation`, which writes the understanding paragraph.** No
path through `answerStep`'s rewritten 'problem' case leaves the transcript exactly as it found it.
This is not a patch on the old four-step machine; it is a property of the new one-box, two-reply
engine (§2/§3), so it did not need a second, separate fix.

### §1c — "2 of 8 approved" on THE BASIC IDEA with nothing built

Traced to `lib/lex/page-one.ts::projectElicitationOntoPageOne`: the four derived page-one fields
(`yourAccount`, `yourGoal`, `yourKnowledge`, `yourReading`) are marked `ACCEPTED` the moment the
elicitation has content for them — correct for that projection (they are the user's own words,
nothing to confirm), and `FieldsPanel`'s "N of M approved" counts `ACCEPTED`+`SKIPPED` fields.
**Elicitation answers being read as approvals is exactly what is happening, and it is not itself
a separate bug**: the real defect is that a pre-build user could see the FieldsPanel/three-panel
workspace at all. §1c is subsumed by §4 below — once §4's gate holds, an idea with no build never
reaches this panel, and the count becomes meaningless-until-relevant rather than wrong.

### §1b — silence is never the behaviour

Held to by construction (above): the engine no longer has a branch that both advances state and
says nothing.

---

## §2 — One box

Built. The new-idea screen is `IntakeCard` (`components/lex/ElicitationCards.tsx`): one large box
for the problem (§2a), the four bullets beside it with §2c's paragraph above them (§2b/§2c), a
second, smaller box to the right for background information (§2d), and the file/link "+" control
attached to that second box (§2e — background material is what a report or a letter is).
`StageBar` is removed from this screen (§2g); the layout header is described in §6.

**§2f — what is NOT lost:** Lex's understanding-paragraph readback (`ConfirmationCard`,
unchanged) survives exactly as before, as part of the running conversation rather than a
labelled fourth step — there is no fourth step any more, so there was nothing to relabel.

**§2f — what IS lost, reported rather than silently dropped:** the per-answer edit pill (25-H §3:
`openStep`/`saveEdit`, a rail of buttons that reopened any earlier answer for editing). The
one-box shape has no discrete prior answers to enumerate a rail over — 'goal' and 'profile' are
no longer asked here at all (see §3), and the problem/background boxes are not yet re-editable
once sent. `check-lex-25h.ts`'s §3 assertion is rewritten to assert the retirement rather than
left permanently red; `answerStep`'s `editing: true` path still works server-side if a future
screen wants to offer editing again.

**§2h** — Ask Lex is suppressed until `elicit.hasBuild` is true (there was no "Notes" panel on
this screen to suppress; only Ask Lex applied).

---

## §3 — Two prompts, then the build

Built. `lib/lex/elicitation.ts`'s `'problem'` case is rewritten around one property: **at most
two Lex-initiated replies, and the closing question is always the last one asked.**

- The intake answer is stored as BOTH boxes together: `problem` (verbatim, the account, never
  rewritten again — the same provenance rule `yourAccount` already had) and `background` →
  `ownKnowledge`.
- If the account is solution-shaped (`looksLikeASolution`, reused from §19-D unchanged), Lex's
  first reply is the existing clarifying press. Otherwise the first reply is the closing question.
- Whichever reply is first, if a reply remains and the closing question has not yet been asked,
  the SECOND (and final) reply is always the closing question, verbatim (§3a):
  *"Is there anything more you can tell me, or anything you can add, to give focus to this
  before I build the first draft?"*
- `MAX_PROBLEM_PRESSES` (`lib/lex/method.ts`) was **already 2** — "at most twice, not three
  times" needed no new constant.
- Every reply after the intake is appended to `ownKnowledge` rather than overwriting `problem`.

**§3b/§3c — the build offer and the allowance figure.** The brief's draft message says "you have
twelve builds at our expense." Verified against `lib/lex/allowance.ts`:
`PILOT_ALLOWANCE_THIRDS = 12`, and the unit is **thirds**, not full builds — a full build costs 3,
a re-run costs 1, so 12 is **four full builds**, or any mix (e.g. 3 full builds + 3 re-runs). This
is exactly the distinction 25-P §4a already fixed once, in `balanceSentence()`, which
`StartBuildCard` already prints live beside the "Build it" button. Rather than hardcode a second,
driftable number, `BUILD_OFFER_MESSAGE` (`elicitation-config.ts`) says the balance is "below" and
leaves the figure to the one sentence that computes it correctly. Charlie's recollection of
"twelve" was right about the number, wrong about the unit.

**§3d — the email sentence.** Not added. The brief is explicit that this waits on Charlie sending
himself a test and confirming an id/delivery; nothing here can verify an inbox. **Action needed
from Charlie:** send a test via whatever the current build-notification path is, confirm receipt,
and say so — the sentence is a one-line addition once that's true.

---

## §4 — Nothing leaves the simple screen until a build has run

**§4c, measured:** the product had no rule of its own. `/ideas/build/page.tsx` redirects FORWARD
to `/ideas/create?ideaId=…` once a build reaches a terminal status — that direction was already
built (25-A/25-G). Nothing existed in the other direction: `/ideas/create/page.tsx` accepted any
`ideaId` with no build-state check at all. `hrefFor()` in `MyIdeasList.tsx` already routed
correctly (build `DONE` → `/ideas/create`, else → `/ideas/build`), which is why the library's own
links were never the exposure — but any OTHER path to `/ideas/create?ideaId=…` (a stale link, a
pasted URL, a future control this brief didn't anticipate) had nothing stopping it. Idea
`a1a08ff4` has zero builds; Charlie reports landing on the 3-panel workspace regardless, which
this gap explains regardless of exactly which click sent him there.

**Built:** `app/ideas/create/page.tsx` now redirects back to `/ideas/build?ideaId=…` using the
IDENTICAL criterion the forward redirect uses (`IdeaBuild.status IN (DONE, FAILED, CANCELLED)`),
so the two pages cannot disagree about which side of the line an idea is on (§4a). Exiting and
re-entering an unbuilt idea now always lands back on the simple screen and the same conversation
(§4b) — the elicitation row is unchanged by any of this, so nothing is lost by the redirect.

---

## §5 — The idea has no title

**Reported, then built.** Titling did not exist on this door at all: `Idea.title` is a
`proposed`-origin field in `ORIENTATION_FIELDS`, and the only pass that has ever proposed one is
inside a full BUILD — before a build runs, an idea is unconditionally "Untitled idea." §5's
premise ("Lex should name the idea in its first response and does not") was the second case
CLAUDE.md's own vocabulary distinguishes: it does not exist, rather than existing and failing
to fire.

**Built:** `proposeTitle()` (new, `lib/lex/elicitation-client.ts`) — a small model call, same
shape as `pressOnProblem`/`writeUnderstanding`, six words or fewer. Called from the intake branch
of `answerStep`, guarded on `Idea.title` still being the literal placeholder `"Untitled idea"` so
a title the user has since typed themselves can never be overwritten by a slow or retried call.

---

## §6 — The layout of the front screen

Built. `BuildIdeaClient.tsx`'s pre-build render is now a responsive two-column layout: "Create a
new idea" (left, `leftPct` state defaulting to 75) and the library (right, `100 - leftPct`),
with a local pointer-capture + arrow-key draggable divider between them (same mechanism as
`components/lex/PanelDivider.tsx`, deliberately not the same component — that one's props are
typed to the 3-panel workspace's own `PanelKey`/`PANEL_ROLES`, and widening it to a second,
unrelated caller would mix two layouts' vocabularies for one screen's convenience). Collapses to
a single column below `lg`.

- **§6c:** left heading "Create a new idea"; right heading kept as **"My ideas"** (the existing
  term the rest of the product already uses for this list) rather than inventing "My Previous
  Ideas" / "Idea History" — Charlie's choice is still open; this is a placeholder pending it, not
  a decision made on his behalf.
- **§6d:** "How this works" moved under the left heading; Exit moved to the library column,
  right-aligned, below its own header line.
- The whole two-column layout is scoped to `!elicit.hasBuild` — once a build exists this is a
  different screen (progress/findings), which reverts to the previous single, narrower column.

---

## §7 — The library

**§7a, measured before changing anything, per the brief's own instruction.** Charlie's ~50 ideas
against a visible 16 was **a filter, not a limit or a page size**: the query was
`prisma.ideaElicitation.findMany({ where: { idea: {...} } })` — joined THROUGH the elicitation
row. Any idea made at the older `/ideas/create` door has no `IdeaElicitation` row at all and could
never appear on this list, regardless of how many exist. Fixed: `app/ideas/build/page.tsx` now
queries `Idea` directly (`take: 100` — a soft cap, not true pagination, sufficient headroom for
Charlie's current count but worth naming as a limit that still exists).

**§7b built.** Schema and migration together and FIRST, applied to Neon and read back before any
code depended on it: `prisma/lex_26c_owner_archive.sql` adds `Idea.ownerArchivedAt` (nullable,
additive). **Deliberately a separate column from the existing `Idea.archivedAt`** (25-O §4b),
whose own comment already states the reason precisely: that column is an ADMIN act on someone
else's idea, and collapsing an owner's own archive onto it would make the two indistinguishable
afterwards — the exact failure `archivedAt` exists to prevent, one column over. New route
`PATCH /api/ideas/[id]/owner-archive` (owner-only, like `DELETE`). `MyIdeasList.tsx` now renders
archive (an outline-to-filled glyph, reversible, no confirmation) and delete (the existing,
unchanged `DeleteIdeaDialog` — names the idea, asks once) on every card, visually distinct per
§7b's own requirement (different shape, different border weight, delete additionally in red).

**§7c/§7d — reported, not built, per §7e's explicit permission not to half-build a sprint's worth
of work.** Neither drag-reorder (needs a persisted per-user order — no `orderIndex` column exists
anywhere on `Idea`) nor grouping (needs a new model: group membership, a name, shown/hidden state)
has any existing data model to extend. Building either as a side effect of this migration would
be exactly the "half-building it" the brief warns against. **Recommendation:** treat §7d
(grouping) as its own brief — it is the larger of the two and touches a new entity, not a column.

---

## §8 — Colour

Built, computed rather than eyeballed, following the exact discipline CLAUDE.md §21 already
established (and whose own register records a palette that "had never been measured" failing at
4.18:1). New fields on `StageAccent` (`lib/lex/stage-accents.ts`): `headingBg`/`onHeadingBg` —
**not** a redefinition of the existing `bg` field, which `ChatPanel.tsx` and
`CreateIdeaClient.tsx` already use expecting a pale wash behind ordinary dark text; repainting it
heavy would have broken two other surfaces to fix one.

WCAG contrast computed by hand (formula and working shown in the code comment) for white text on
each stage's saturated hue:

| Stage | Hue | White-text contrast | AA (4.5:1)? |
|---|---|---|---|
| ORIENTATION | `blue-600` | 5.18:1 | ✅ |
| DIAGNOSIS | `amber-600` | 3.19:1 | ❌ — used `amber-700` (5.02:1) instead |
| GUIDING_POLICY | `violet-600` | 5.70:1 | ✅ |
| COHERENT_ACTIONS | `emerald-600` | 3.77:1 | ❌ — used `emerald-700` (5.48:1) instead |

`FieldsPanel.tsx`'s active-section heading now takes `headingBg` for its container (§8a's literal
ask) and `onHeadingBg` for the label. The status dot switches to plain white when active (it was
previously the SAME saturated hue as its own new background and would have vanished onto it); the
"N of M approved" and "show +/hide −" text switch to the same measured white rather than
`text-zinc-400`, which fails against every one of the four backgrounds above.

**§8b — not independently re-testable here.** "Test with colour removed" needs a rendered screen
and a desaturation pass Charlie can look at; what changed structurally should help it (a solid,
heavy background vs. white is a real luminance difference in greyscale, where a pale wash next to
white was close to indistinguishable) but this is asserted, not verified, and is named in §10.

---

## Checks run (§23.2 — reported as a suite, not a selection)

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `npm run check:client-boundary` | clean (588 files, 138 client) |
| `npm run check:scripts` | clean |
| `npx tsx scripts/check-lex-25e.ts` | 28/0, 17 controls fired |
| `npx tsx scripts/verify-lex-25e-ui.tsx` | 20/0, 6 controls fired (extended with INTAKE/REPLY assertions — see below) |
| `npx tsx scripts/check-lex-25j.ts` | 12/0 (one rule rewritten, break-control re-verified) |
| `npx tsx scripts/verify-my-ideas-ui.tsx` | 15/0 (one control's match rewritten) |
| `npx tsx --env-file=.env scripts/check-lex-26b.ts` | 69/0, 2 not checked (pre-existing, unrelated) |
| `npx tsx scripts/check-lex-25h.ts` | 19/1 — the one red is pre-existing and unrelated |

**Two checks were edited because this sprint deliberately changed the behaviour they asserted,
not because they were wrong when written:**

1. `check-lex-25j.ts` §2 asserted the hub list is gated on `!ideaId` (only before an idea exists).
   §6a makes the library persistent through the whole pre-build front screen. Rewritten to assert
   the new gate (`!elicit?.hasBuild`) instead of the old one, with its own break-control re-fired
   to confirm it can still fail.
2. `check-lex-25h.ts` §3 asserted the pill rail opens and populates. §2a retires the rail
   entirely (see §2 above). Rewritten to assert the retirement (the functions are genuinely gone,
   not half-removed) rather than left failing forever.

**`verify-lex-25e-ui.tsx` needed extending, not fixing, per CLAUDE.md §23.1** ("a check must prove
its subject is reachable"): its existing assertions all render `QuestionCard`, which
`BuildIdeaClient.tsx` no longer calls after this sprint — they still pass and no longer prove
anything about the live screen. Added three assertions rendering `IntakeCard`/`ReplyCard`
directly (the cards the client actually uses now), including the disabled/enabled Send transition
on the intake box.

**One check's own control was a false positive from unrelated new markup**, corrected rather than
weakened: `verify-my-ideas-ui.tsx`'s "no omission note when nothing was omitted" control matched
the bare substring `"hidden"`; the new archive button's `aria-hidden="true"` attribute put that
substring in every render regardless of the omission note, so the control fired on the wrong
thing. Narrowed to match the omission sentence's own fixed suffix.

**One pre-existing failure, confirmed unrelated and left alone:** `check-lex-25h.ts` §7e expects
the string `"REFRAME THE INSTRUMENT IF IT IS WRONG"` in `lib/lex/build-client.ts`, which this
sprint never opened. Verified absent by direct grep before writing this down, per CLAUDE.md §0.

---

## Migration

`prisma/lex_26c_owner_archive.sql` — `ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS
"ownerArchivedAt" TIMESTAMP(3);` — additive, nothing dropped, applied to Neon via
`scripts/apply-sql.ts` and read back before any code path depended on it, per CLAUDE.md's
schema-before-code rule (and the incident that rule exists because of).

---

## §10 — What only Charlie's browser can confirm

- The intake → (0, 1 or 2 replies) → confirm → build flow, actually clicked through, not rendered
  in isolation. The render harnesses prove a usable control exists at each phase; they do not
  prove a click works end to end (same caveat `verify-lex-25e-ui.tsx` has always carried).
- The draggable divider's feel — pointer capture across browsers, and whether 50–85% is the right
  clamp range for how he actually resizes things.
- The two-column layout at the widths he actually uses, and whether it degrades sensibly below
  `lg`.
- The auto-proposed title's quality across a range of real accounts (six words or fewer, no
  fabricated specificity) — this is a fresh model call with no adversarial testing yet.
- The contrast fix, looked at directly — and, per §8b specifically, with colour removed (a
  greyscale or a colour-blindness simulator), which was not re-testable from here without a
  browser.
- §6c's library heading — a decision for Charlie, not inferred.

---

## Not committed

Per CLAUDE.md §12, nothing was committed mid-sprint. `commit-all.sh` is prepared at the project
root and awaits a single approved execution, after which it deletes itself.
