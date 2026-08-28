# LEX 25-K — Three stages, named for what the user does

**Run:** 2026-08-28, closing 09:03 UTC. **Thread:** LEX. **Brief:** `docs/BRIEF_25K.md`.
**Mode:** continuous (§0).

---

## The headline

**§1–§5 are built. §6 is designed and deliberately unbuilt — nothing is charged. §7 is
answered from a measurement already in hand, so no spend was needed.**

Two things found on the way matter more than any of the individual items:

⚠⚠ **25-J's nav rename never reached a user.** 25-J §1 reports *"nav Create → My ideas"*.
That rename went into `components/ui/Navbar.tsx` — **which nothing in the application
renders.** `grep -rn "Navbar"` over `app/`, `components/` and `lib/` returns the file's own
`export default`, two check scripts asserting on it, and one comment. The nav every
signed-in page actually draws is `components/PublicNav.tsx`, and it still said "Create".
`check:lex-25j` passed the whole time, because it asserts on the file, not on the screen.
**This is the "check that cannot fail" family with a new member: a check pointed at a file
nobody renders.** 25-K §5 names the item "Create" — which is what Charlie saw when he
walked the site — so the live nav now says "Create" and the discrepancy is recorded rather
than quietly resolved either way. **Charlie's call: keep "Create", or move "My ideas" onto
the live nav?**

⚠⚠ **`tsc` was clean on code that could not be built.** Putting the stage vocabulary and
its prisma-backed counts in one module dragged `lib/prisma` → `@prisma/adapter-pg` → `pg` →
`require('tls')` into the **browser** bundle, because `CreateIdeaClient` is a client
component and imports the stage names. `tsc --noEmit` exited 0; `next build` failed
outright. This is CLAUDE.md §20 check 0's fault class one level down — a package boundary
the type checker cannot see — and it is why `next build` ran before this report was
written. Fixed by splitting `lib/lex/stages.ts` (pure vocabulary, client-safe) from
`lib/lex/stage-context.ts` (the reads, server-only), with the reason recorded in both.

---

## §1 — Three stages, named for the user

| stage | name | what the user does there |
|---|---|---|
| 1 | **The Idea** | Say what you want to change. Add information and files, then re-run. |
| 2 | **The Strategy** | Work through what Lex drafted: read what matters, make the decisions. |
| 3 | **The Deepening** | Go deeper — more research, more evidence, harder questions. |

`lib/lex/stages.ts` holds that table and nothing else may restate it: `check:lex-25k`
sweeps every `.tsx` under `app/` and `components/` and fails on any hardcoded stage name.
That rule exists **because of the 25-J finding above** — a rename that reaches one file and
not the screen is the failure this sprint is repairing, and the only defence is that there
is one string.

**The indicator** (`components/lex/StageBar.tsx`) is on every screen of both routes. It
carries three tiles, each with its stage number, its name and **what is on it, counted** —
"23 fields, 10 decisions waiting" — plus one line beneath: *"Stage 2 of 3, The Strategy.
Work through what Lex drafted…"*.

⚠ **Which stage you are on is not signalled by colour.** Charlie is colour blind
(CLAUDE.md §21). Four cues carry it and each survives greyscale: **the words "You are
here"** printed in the tile, a **filled disc ● against hollow ○** (different characters,
not one recoloured), a **filled dark background** against white (a lightness difference,
which colour blindness preserves), and **`border-2`** weight. `aria-current="step"` is
there too and is explicitly *not* counted as the second cue.

⚠⚠ **The one that would have shipped broken.** 25-G §2 redirects a returning user with a
finished build from `/ideas/build` to `/ideas/create`. Without an escape, pressing
**"1 · The Idea"** would have bounced the user straight back to Stage 2 — a control that
visibly does nothing, which is this sprint's own complaint wearing a new coat. `stageHref`
writes `stage=idea` and the page honours it, alongside the older `build=1` spelling so
links already in the wild keep working. Asserted twice: once in `check:lex-25k`, once in
the render harness, which reads the real `href` off the rendered markup.

**"Build" and "proposal" are retired as navigation.** `SurfaceSwitch.tsx` and
`lib/lex/surfaces.ts` are deleted. The sweep found and fixed three live labels nobody had
mentioned — the "How this works" tour was still *teaching* the vocabulary ("Your proposal",
"The build"), which is worse than a stray label: a user who is told the middle column is
called "Your proposal" then goes looking for that label and does not find it.

⚠ **The sweep distinguishes a label from an identifier.** Its first version flagged
`searchParams.get('build')` and `variant="build"` — the route and the query parameter,
which §1 explicitly allows to survive as "the technical record" — and it flagged **its own
comment explaining the rule**, because a line-prefix comment test cannot see the
continuation lines of a multi-line JSX comment. It now strips comments properly and
requires the phrase to occupy a whole JSX text node, or a whole quoted string **with its
article**. A sweep that flags the documentation of its own rule teaches everyone to ignore
it.

⚠ **25-G's three §2 assertions were repointed, not deleted.** What they guard is three
properties — both surfaces render the indicator, it names where you are, the offer of the
other place is counted rather than labelled. All three still hold and are still asserted,
against the files that now carry them. Retiring the vocabulary must not retire the guard.

## §2 — Stage 1: one clean panel

Stage 1 was already a single `max-w-3xl` column and stays one; `check:lex-25k` now forbids
a `lg:grid-cols-*` grid, a fields panel or a legislation panel from appearing on it.

⚠⚠ **File and link upload is now a "+" in the composer, and the old placement is exactly
why Charlie could not find it.** 25-H wired `YourMaterial` into this screen — on the
`reading` step **only**, plus a bare `Choose File` input further down the page. So it was
absent at question one, where a user with the document in front of them would reach for it,
and gone again once they had moved past question four. It is now the first control in the
composer row, on **every** question, labelled *"Add a file or link"* with a count, and it
takes both a file and a pasted link through the same control.

⚠ **A stale disclaimer was talking users out of a feature that works.** The `reading` step
printed: *"I can't read documents yet — nothing I draft will come from it."* That was
honest when written and became false the day 25-H wired the pipeline in and 25-I got it
running. **Never-claim cuts both ways.** It now says what actually happens.

⚠ **25-H's own guard fired on this change and was right to.** It asserted the upload was
on the `reading` step. The assertion has been moved from a **placement** to the stronger
**property** — on the composer for every question, and after the elicitation — and it now
fails if the one-step gate ever comes back. A check that pinned the old placement would
have been forbidding the fix.

⚠⚠ **The re-run was invisible four ways.** It rendered only when `(finished || stopped)`
**and** `build.canStart`, at the very bottom of the page, beneath the findings. A user
watching a build run, a user whose re-run was blocked, and a user who had not scrolled all
saw **nothing** — which is how Charlie came to ask Lex to do it in conversation. It is now
on the page whenever a build exists, in every state, and it **says which state**: running
shows the reason, blocked shows `blockedReason`, available shows both prices with the
expensive one the one you have to ask for, and the full run quotes its own measured cost
line.

**And Lex now gives directions instead of a refusal.** `lib/lex/platform-controls.ts` is a
map of the controls that exist — built from `LEX_STAGES`, so a renamed stage cannot leave
Lex directing people to a door with a different name on it — injected into the idea-chat
system prompt. The rule is *not* "say yes": Lex genuinely cannot re-run a build, and
claiming otherwise would be the never-claim failure, which is worse. The rule is that a
refusal **carries directions** — which stage, what the control is called on screen, and
what pressing it does. The old `RESEARCH REQUESTS` rule, which was the same failure with a
different subject, was rewritten the same way.

## §3 — Stage 2: the task list is the point

The left column now runs: **what to do next → what this stage is, one line → the chat**.

`components/lex/WorkList.tsx` reads the agenda 25-C already assembles — contradictions,
decisions, challenges, reading, gaps — and compresses it to one imperative line per task
with a count and a jump. **It adds no new source of truth and makes no model call**; it is
the same agenda, in the place the work happens. `AgendaPanel` remains the chapter; this is
the table of contents, and both take their order from the same `AGENDA_SECTIONS` constant.

⚠ **Contradictions lead, and that is not styling.** 25-C §3b: *"I first concluded X; the
evidence says Y"* is the most valuable sentence a build produces. The ordering is asserted
by running `tasksFrom` over a fixture, with a control.

⚠ **Only the gaps that are the user's to close reach the user's list.** A gap tagged
`research` is our job; one tagged `limitation` is nobody's. Listing either would be telling
the user to do our work, or work that cannot be done. `agenda.ts` tags them at creation, so
nothing here guesses.

⚠ **Every worklist row is a jump, and the anchors are asserted to exist.** A row saying
"read the two contradictions" that does not take you to them is a second thing to work out.
The check takes the anchors the worklist actually emits and requires each to be present in
the panel markup.

Carried over unchanged and asserted: the honest empty state (*"This wasn't asked of your
draft, so there is nothing here — which is not the same as nothing existing"*), the "from
Lex" provenance chips, "collapse", and the stage banner.

## §4 — Stage 3: The Deepening

It was reachable only by scrolling past everything else — a stage of work filed as a
footnote to another one. It is now `/ideas/create?ideaId=…&stage=deepening`: same route,
because Stage 2 and Stage 3 share the canonical state, the chat and the legislation panel
and differ only in the middle column. A second route would have duplicated the boot, the
transcript and the panel wiring so one column could change, and the two copies would drift.

Its worklist is the same shape as §3's, over the deepening's own work: the issues raised,
the passes not yet run, and — **separately** — the passes that **failed**. A list that
merged those two would tell the user to "run" something that already tried and stopped,
which is §18's rule about a degradation announcing its cause, applied to a task list.

What stays at Stage 2 is a route to Stage 3, so nobody has to discover that it exists.

## §5 — Navigation

**Create · Browse · Central · About · Support · [Admin]**, desktop and drawer, both
asserted by reading the link labels out of the source and comparing to one expected order.
**Legislation is gone from both navs**; `/legislation-compare` itself is untouched and
still reachable by URL and from the admin panel.

⚠ The nav check's first version failed on the comment recording that Legislation had been
**removed** — a check that fails on its own changelog. It reads link labels now, not the
file.

---

## §6 — Pilot allowance: the design, and nothing built

**Nothing counts, limits or charges builds today.** Confirmed by reading, not assumed:
there is no allowance, quota or gate anywhere in `lib/` or the schema. A build is a button
with no ceiling behind it, and a full run's own ceiling is `LEX_BUILD_COST_PENCE`
(**50p** default) *per build*, not per user. A thousand pilot users is unbounded spend.

⚠ **The instrumentation already exists and is the reason this is small.** `LlmSpend`
records every call with `tokensIn`, `tokensOut`, `estCostPence`, **`userId`** and
`ideaId` — so an allowance is a counter and a gate over data we already write, not a new
measurement layer. It also already carries a `communityId` column, added before the feature
that needs it, which is the natural home for "this branch bought tokens for its members".

**The minimum viable design, for your decision:**

| | proposal |
|---|---|
| **Unit** | A **build**. One `IdeaBuild` row with `mode = FULL`. |
| **Re-runs** | Counted **separately and priced lower**. A `REUSE` re-run skips the two search passes; 25-J measured the saving at **48% of the input tokens on the passes it skips** — ⚠ *not* 48% of a build. Suggested: a full build costs **1**, a reuse re-run costs **1/3**, held as thirds in an integer column so no float rounding decides whether someone may press a button. |
| **Default** | **One free build**, plus **3 re-run thirds** (i.e. one build and one redraft), on a new `User.buildAllowance` column defaulting to `3 + 3`. |
| **Visible balance** | On the same line as the existing cost-and-duration estimate — *"This usually takes 4 minutes and costs about 34p to run. You have 1 build left."* One sentence, before the button, never after. |
| **Hard stop** | The `canStart: false` / `blockedReason` path **already exists and already renders** (§2's re-run block shows the reason). An exhausted allowance is one more reason string plus a `mailto:` link. No new UI. |
| **Admin grant** | One admin action writing the column, with an `ActivityLog` row — the privacy-log pattern already in use. |

⚠ **Two things I would not do, and why.** (1) **Not a pence budget.** A user cannot
predict what a build costs and should not have to; a count of builds is a promise they can
hold. The pence stay in `LlmSpend` for us. (2) **Not a monthly reset.** A pilot lasts weeks
and a reset invents a renewal contract nobody agreed; grant more by hand instead.

⚠ **The decision that is yours and is not a detail:** whether a **failed** build spends the
allowance. Charging for a run that produced nothing is indefensible; not charging makes the
allowance gameable by cancelling at pass nine. My recommendation is to **charge on
`DONE` only, and record `FAILED` and `CANCELLED` against the user without charging**, so
the abuse is visible before it is priced. **Nothing above is built. No schema change, no
column, no gate.**

## §7 — Three of the six qualities reach the output; three do not

⚠ **Reported before any fix, as the brief requires, and from a measurement already in
hand** — 25-I's addendum, on a build that *finished* (`docs/LEX_25I_REPORT.md`). Running
another build for a number we already have would have been spend for nothing.

**The three that are missing are 1, 5 and 6:**

| | quality | in the output |
|---|---|---|
| 1 | a causal chain, not an inventory | ✗ — **0 of 4 causes nested** |
| 2 | a counterintuitive finding | ✓ 8 CONTRADICTS |
| 3 | the finding, not the citation | ✓ 80 of 82 substantive |
| 4 | reframes the instrument if wrong | ✓ |
| 5 | a test the user can apply | ✗ |
| 6 | the next action | ✗ |

⚠ **Quality 1 is a live regression against 25-H's own fix, not a measurement artefact.**
`nestByDrivenBy` is in the code and `check:lex-25h` asserts it; the output still nests
nothing. The wiring exists and **the model is not populating `drivenBy`**. It is the single
most valuable of the six — the brief calls it *"a causal chain, not an inventory"*.

⚠ **Qualities 5 and 6 have never been observed in any output**, across every build measured
in 25-H and 25-I. The instructions reach every drafting pass (checked, controlled) and
nothing comes back. On the evidence, **reaching the prompt is not sufficient**; the next
step is whether any pass is asked for them in its *output contract* rather than merely told
about them in its method block. Not attempted here.

---

## §8 — Acceptance, and where the walk fails

| criterion | state |
|---|---|
| Three named stages, persistent indicator, free movement, no "build"/"proposal" as navigation | **met** — swept, not spot-checked |
| Stage 1 one clean column, "+" upload in the composer, visible re-run stating what and what it costs | **met** |
| Asking Lex for something the platform does produces directions | **met in the prompt**; ⚠ *not observed in a live turn* — see below |
| Stage 2's left column leads with a task list, chat beneath | **met** |
| Stage 3 reachable as a stage in its own right | **met** |
| Nav reordered; Legislation removed | **met** |
| Allowance design reported; nothing charged | **met** |
| The three missing qualities named | **met** — 1, 5, 6 |

**How this was verified, and what that does and does not prove.**

⚠ **§0 is right and it was tested, not assumed: the three-column desktop layout cannot be
walked from a CC session.** The browser reports a 0×0 viewport, so every `lg:` breakpoint
fails to match and the desktop arrangement never renders — a walk would be measuring the
mobile stack and reporting it as the desktop one. So the indicator is verified **by
harness**: `verify:stages-ui` renders `StageBar` for all three stages plus the
before-any-idea case and reads the markup — **23 assertions**, including that the current
tile is named in words, that the filled/hollow glyphs are 1 and 2, and that the real
`href` back to Stage 1 carries the anti-bounce escape.

⚠ **A harness found a check that had never run.** `verify:lex-25e-ui` — the render harness
for exactly the cards this sprint changed — died on `ReferenceError: React is not defined`
before its first assertion, because it never imported React while the two harnesses beside
it do. **It appears in no sprint's reported results and cannot have passed since it was
written.** Fixed (one import); it now runs and is **16/16** on the modified cards.

✅ `check:lex-25k` **18 passed, 0 failed, 0 without a negative control** — every control
watched rejecting a broken copy. ⚠ One of those controls was **written backwards** and
`--self-test` caught it: it returned "the broken version passed" in the case where the
property held. A control that cannot fail and a control that always fails are the same bug.

✅ Neighbours all green after the change: `check:lex-25c` 32, `25-d` 77, `25-e` 28, `25-f`
62, `25-g` 27, `25-h` 20, `25-i` 14, `25-j` 12, `check:deepening`, `check:statutory` 17.
`verify:stages-ui` 23, `verify:lex-25e-ui` 16, `verify:lex-25g-ui` 14,
`verify:my-ideas-ui` 15.

✅ `tsc --noEmit` clean, `next build` clean, `check-clean-build.sh --fast` clean
(0 cross-package files).

**Where the §8 test still fails, honestly:**

1. ⚠ **Lex's new directions are asserted in the prompt, not observed in an answer.** The
   block reaches `buildLexSystemPrompt` and the check proves it. Whether the model actually
   *uses* it instead of refusing is a live-turn question, and §18's own history says a
   thing reaching the prompt is not sufficient — that is precisely what qualities 5 and 6
   demonstrate one section up. **This needs one real conversation to confirm.**
2. ⚠ **Nothing here is verified on the running site** (CLAUDE.md §20). The honest sentence
   is: *pushed; NOT verified live, because the change is not deployed at the time of
   writing.* A local build proves the files on this machine are consistent with each other.
3. **Stage 1 before an idea exists** now shows three tiles, two of which say *"Opens once
   you've told me the idea."* That is honest, and it is also the one place where a stranger
   sees two things they cannot press. The alternative — hiding them — is what made "where
   am I" unanswerable in the first place, so this is a deliberate trade and worth watching
   in the pilot.

---

## What I would do next, in order

1. **One live conversation** asking Lex to re-run, to confirm §2's last criterion.
2. **Quality 1** — `drivenBy` is wired and unpopulated. It is the most valuable of the six
   and the only one that is a regression rather than an absence.
3. **Charlie's §6 decisions** — the unit, the default, and whether a failed build spends.
4. **The nav question above** — "Create" or "My ideas" on the live nav.
