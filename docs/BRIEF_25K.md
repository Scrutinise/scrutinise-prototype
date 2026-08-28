# BRIEF — Sprint 25-K: three stages, named for what the user does

**Thread:** LEX. **Written:** 28 August 2026.

⚠ **The finding this sprint exists for, in Charlie's words after walking his own product:**

> *"I'm confused about where I am now, and I know it back to front. This is really confusing."*

If the person who designed it is lost, a pilot tester has no chance. **This is a pilot blocker and it
outranks everything else outstanding.**

**The diagnosis:** "the build" and "the proposal" are named for **how they were made**, not for **what
the user does there**. They are implementation words on a user's screen. Charlie's replacement names
them by purpose, and it is right.

**Order matters and is not negotiable:** §1–§4 first. **If the sprint is running long, stop after §4
and report** — §5 and §6 are worth less than a coherent flow.

---

## §0 — Run mode

**Continuous.** Diagnose, record in the CHANGE_LOG, proceed — including where a finding contradicts
this brief. Batch the rest into one report. **Stop only for** spend beyond §6's ceiling or a change of
scope. Shell per CLAUDE.md §22. Walk the signed-in site; ⚠ **the three-column desktop layout cannot be
walked from a CC session** (0×0 viewport, `lg:` breakpoints never match) — verify by harness and say
so.

## §1 — Three stages, named for the user

Replace "the build" and "the proposal" with three stages, always visible, always showing which one you
are in and what it is for:

| stage | what the user does there |
|---|---|
| **1 · The Idea** | Say what you want to change. Add information and files. **Re-run.** |
| **2 · The Strategy** | Work through what Lex drafted: read what matters, make the decisions. |
| **3 · The Deepening** | Go deeper — more research, more evidence, harder questions. |

- **A persistent stage indicator** on every screen: which stage, what it is for in one line, and how to
  move.
- **Movement is free in both directions.** Nothing is locked behind completion.
- ⚠ **Retire the words "build" and "proposal" as navigation.** They may survive in the technical record
  and in "how this was made"; they must not be how a user finds their way.

## §2 — Stage 1: The Idea — one clean panel

Charlie: *"one panel, clean, chat style."*

- **A single column.** No three-panel layout here. The proposal and legislation panels do not appear at
  this stage — there is nothing in them yet and their presence is what makes the page unreadable.
- **The conversation and the idea in one place**: what you wrote, what Lex understood, and the ability
  to add to it.
- ⚠ **File upload as a "+" in the chat composer**, the way Claude does it — not a separate panel, not a
  "Choose File" control further down the page. Charlie looked for it, in the obvious place, and it was
  not there. **Links too, same control.**
- ⚠ **A clear, present "Re-run" button.** This is the item that most needs fixing: he asked Lex in
  conversation to re-run and got *"I can't rerun the whole project from here, as the platform manages
  those stages"* — true, unhelpful, and a dead end. **Where a user asks for something the platform
  does, Lex says where the control is**, and the control is on this page.
- The re-run states what it will do: reuse the research, or search again because the idea changed —
  and what each costs.

## §3 — Stage 2: The Strategy — the task list is the point

The three-column layout belongs here, and **the left column stops being a transcript and becomes a
worklist.**

**Left column, in this order:**

1. ⚠ **What to do next** — a plain task list from Lex: the decisions waiting, what to read, the
   questions to answer. **This is the single most important change in the sprint.** The user should
   never have to work out what to do; the list tells them, in order.
2. **What this stage is** — one line, always visible.
3. **The chat**, beneath the list, for asking questions about any of it.

**Middle:** the kernel, as now. **Right:** the findings by question, as now.

**Carry over unchanged** (they work): the stage banner, "collapse", the honest empty state — *"This
wasn't asked of your draft, so there is nothing here — which is not the same as nothing existing"* —
and "FROM LEX" provenance chips.

## §4 — Stage 3: The Deepening

Reviewing and going deeper: the passes, their findings, the issues to work through, and the ability to
add material and re-run a pass. **Currently reachable only by scrolling past everything else** — give
it its own stage, with its own worklist in the same shape as §3.

## §5 — Navigation

- **Order, left to right:** Create · Browse · Central · About · Support · [Admin].
- **Remove Legislation** — not being tested, and it is clutter on the way to the pilot.

## §6 — Pilot allowance *(do this only if §1–§4 are complete)*

⚠ **Nothing counts, limits or charges for builds.** A thousand pilot users with an unlimited button is
unbounded spend. Minimum viable:

- A **build allowance per user**, defaulting to **one free build**, with re-runs counted separately
  and priced lower (they reuse the research — measured at 48%).
- **A visible balance** before a build starts, alongside the existing cost and duration line.
- **A hard stop when spent**, with a plain message and a way to ask for more — an email link is
  sufficient for a pilot.
- **Admin can grant** allowance to a user.

**Report the design before building anything charged** — the pricing decision is Charlie's.

## §7 — Three of six qualities *(carry-over, lowest priority here)*

§25.7's six answer-quality instructions: **three reach the output, three do not.** ⚠ **Report which
three are missing before attempting a fix** — this has been guessed at twice and measured once.

## §8 — Acceptance criteria

- Three named stages, a persistent indicator saying which and why, movement free in both directions,
  and **no user-facing "build" or "proposal" as navigation.**
- Stage 1 is a single clean column with **file and link upload in the chat composer** and a **visible
  re-run control** that states what it will do and cost.
- Asking Lex to do something the platform controls produces **directions to the control**, never a
  bare refusal.
- Stage 2's left column leads with **a task list of decisions and reading**, chat beneath it.
- Stage 3 is reachable as a stage in its own right.
- Nav reordered; Legislation removed.
- *(if reached)* Allowance design reported; nothing charged without Charlie's sign-off.
- The three missing qualities are named.
- **The test that matters: a stranger opens the product, and at every screen can answer "where am I,
  and what do I do next?" without being told.** Walk it and report where that fails.

---

## Noted, not in this sprint

**Browse's pre-populated ideas need re-running through the new engine.** A script that takes each
existing idea's content as elicitation input and produces a full build. Real work, real spend, and
worth doing before the pilot so Browse shows the product at its best rather than its oldest — but not
now.

**And one thing worth recording as working:** the domain-transfer question surfaced **SOX** and the
**UK Senior Managers and Certification Regime** from Charlie's own uploaded document, filed under
"where this mechanism works elsewhere". SMCR is the cross-sector analogue four public chat models
missed when asked this question directly. **That is the feature working exactly as designed** — do not
disturb it.
