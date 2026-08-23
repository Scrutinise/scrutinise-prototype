# SPRINT 25-E — the front door opens

**Executes:** `docs/BRIEF_25E_ELICITATION.md` §1–§5. **Thread:** LEX. **Written:** 2026-08-23 08:45 UTC.
**Guards:** `check:lex-25e` **27/27, 17 controls, all fired** · `verify:lex-25e` **19/19 live** ·
`verify:lex-25e-ui` **16/16 rendered, 6 controls fired** · `check:lex-25d` 77/77 ·
`check:build-25a` 40/40 · `check:build-25b` 54/54 · `check:lex-25c` 32/32 · `check:20bd` 47/47 ·
`check:flags` 54/54 · `check:never-claim` pass · `tsc` clean.

---

## The finding, before anything else

**`IdeaBuild` was empty. Not one build has ever been started, by anyone, on this platform.**

Eleven elicitation rows exist. One is CONFIRMED — Charlie's, at 01:56:52 on 22 August, with a
750-character understanding paragraph he had read and agreed to. It has no build. The other ten
are empty `"Untitled idea"` shells, three of them created **within eight seconds of each other**.

Everything the brief describes follows from those two facts, and neither of the three sections
turned out to be quite what it looked like from the outside.

---

## §1 — the dead end: one bug, three faces, and it is not the one the brief guessed

**The confirmation control was there all along, and Charlie used it.** His elicitation is
CONFIRMED with a `confirmedAt` timestamp. What failed was the *acknowledgement*.

`confirm()` wrote `setElicit(...)` **and nothing else.** The page held two server objects —
the elicitation and the build — and refreshed only the first. So at the instant he pressed
*"That's right — build it"*:

- the confirmation buttons vanished (`status === 'AWAITING_CONFIRMATION'` was now false);
- the build card appeared (`status === 'CONFIRMED'` was now true);
- and it appeared **greyed out**, beside `blockedReason` from the *boot-time* fetch, which read
  ***"Confirm what I've understood first — I won't build on a reading you haven't seen."***

He was told to do the thing he had just done, with no control left on the page to do it with.
There was no way forward and no way back. **All three of the brief's symptoms are that one
missing refresh** — 1a "no way to confirm" (he had confirmed; nothing said so), 1b "no *Not
quite*" (it disappeared with the rest of the confirmation block), 1c "the chat has gone" (the
question card is suppressed once CONFIRMED).

⚠ **`canStart` was never wrong. It was stale.** Which is why no server-side check could have
found it, and why none did.

### ⚠⚠ And a second, independent dead end on the same step

When `writeUnderstanding` fails, `runUnderstanding` returns early: `status` stays `IN_PROGRESS`
and `understanding` stays null, while `currentStep` is `'confirm'`. The client chose between
three blocks on three **independent** conditions — `currentStep !== 'confirm'`,
`status === 'AWAITING_CONFIRMATION'`, `status === 'CONFIRMED'` — and in that state **all three
are false.** The page rendered nothing at all. Lex's own apology said *"try again in a moment"*
and there was no way to try again.

### The fix

1. **The server decides one value.** `ElicitationPhase` — `QUESTION` · `UNDERSTANDING_FAILED` ·
   `AWAITING_CONFIRMATION` · `CONFIRMED` — a closed union with a branch each. Three booleans
   that must be exhaustive and are never checked for exhaustiveness is a dead end waiting to be
   reached; one value from a closed union cannot be. The file header had claimed this contract
   since 25-A; this is the first version of the code that keeps it.
2. **Every mutation returns both halves.** The route answers `{ state, build }`, so a stale half
   is impossible rather than the client's job to remember.
3. **A contradictory reason is never shown as fact.** In the CONFIRMED card a *"you have not
   confirmed"* reason is stale by construction: it is suppressed, and the unreadable state is
   reported instead (§18).
4. **The confirmation offers accept, "not quite", and a live text box, together.** The box is no
   longer behind the button — Lex has just said *"tell me if I've got this wrong"*, and the means
   of telling it must be on screen.
5. **A failed understanding can be retried**, through its own action, so it is not recorded as
   the user correcting Lex.
6. **A backstop card** renders if nothing else would.

---

## §2 — the answers were never lost

**Every one of Charlie's answers was in the database the whole time and is there now** — 2,934
characters of problem, 690 of his own knowledge, the 750-character understanding. `answerStep`
has always persisted each answer on the turn it was given. The brief's premise is refuted, and
the truth is worse in one way and better in another.

**What was lost was the page.** `/ideas/build` with no `?ideaId=` made the client POST
`/api/ideas` and mint a **brand new idea**, and the id was never written to the URL — so a
refresh minted another one and orphaned the first. The user sees an empty form and concludes,
correctly from what they can see, that their writing is gone. The ten empty shells are the
litter from exactly this.

- **The id goes into the URL** (`replaceState`) the moment it exists.
- **A bare visit resumes** the most recent idea with no build, and **says so**.
- **"Unfinished" means no build started, not "not confirmed"** — Charlie's idea is CONFIRMED
  with no build, which is precisely the state the dead end created. A status-based rule would
  have left his work stranded by the fix meant to recover it.
- `?fresh=1` is the way to start something else.

### ⚠⚠ The trap this sprint's own first fix fell into

The first version filtered for "has something in it" **after** the query. `findFirst` is
`ORDER BY … LIMIT 1` — so the newest row won the ordering and was then discarded for being
empty, and **one blank shell hid every real row behind it**. Measured against production, it
landed on a row created at 00:29 with nothing in it, and Charlie's idea never came back at all,
because it is older.

**The fix for losing his work would have failed to find it.** The condition is now in the
`WHERE` clause, and a control guards it. Same shape as GRAPH 3B: a property asserted over a
ranked, truncated result set is only a property of the top of the ranking.

---

## §3 — nothing crashed. The build never started.

**`IdeaBuild` contains zero rows across the entire database.** No build was ever claimed, no
pass was ever reached, nothing was ever written to FAILED or left RUNNING. There is no crash to
diagnose.

Per the brief's own instruction — *"If no build was ever started, that is §1: the button was
never enabled. Report which"* — **it is §1.** What Charlie read as "paused and crashed" was the
dead-ended page: a greyed-out button, a note contradicting what he had just done, and nothing
else on screen. A page with no controls on it is indistinguishable from a crash, which is why
the backstop card now exists.

---

## §4 — the three smaller defects

**4a.** The opening question was printed twice, verbatim, because `question` for the first step
**is** `OPENING_ASK` — the paragraph Lex has already said in the transcript directly above the
card. Steps now carry a separate short `cardPrompt`; the opening step's is `null`, so the card
shows the hint list, which is the brief's own instruction. ⚠ It falls back to `null`, **not** to
`question` — a fallback to the question is the duplication this removes.

**4b.** Send really is disabled until a category is chosen, and nothing said so. The reason is
now **computed as a string** (`blockedSend`) that drives both the `disabled` attribute and the
sentence beside it — one expression, so the button and the explanation cannot disagree — and the
requirement is stated *before* the control is pressed.

**4c.** *"Usually a few minutes — we don't have enough builds yet to be precise"* answered the
question and then confessed our sample size, at the moment the user was deciding whether to
commit. Now *"This usually takes a few minutes."* It claims no figure, so there is nothing to
disclaim; the precision caveat still appears once there **is** a number.

---

## The check that would have caught this — and why none of the existing ones could

Every previous sprint's checks were **true**. They tested the functions behind the door.

This defect lived in the seam: a client choosing between three blocks whose conditions can all
be false, holding two server objects and refreshing one. Both halves were correct. Neither was
ever tested against the other, and **no grep over the source could have found it** — the source
contained a perfectly good confirmation block. A grep tells you a `<button>` is written down. It
cannot tell you the branch containing it is reachable.

So the phase cards were **extracted into pure components** (`components/lex/ElicitationCards.tsx`)
for one reason: so they can be **rendered and looked at**. `verify:lex-25e-ui` renders every
phase with real props and asserts that an *enabled* control comes out — including the exact
state Charlie was stuck in, a CONFIRMED elicitation beside a build object still saying
"confirm first".

⚠ **And the render harness caught its own defect first.** Its "is this button enabled" matcher
reported **every** button as disabled, failing five assertions against perfectly correct
components — because every button carries the Tailwind class `disabled:opacity-40`, and a
lookahead for `\sdisabled` matches that class name inside `class`. It failed in the direction
that *looks like it caught something*, which is the shape that sends a session hunting a bug in
working code.

Three harnesses, three different questions:

| harness | asks | would it have caught this? |
|---|---|---|
| `check:lex-25e` | is the wiring right? | no — the source was fine |
| `verify:lex-25e` | does the server walk end to end? | no — the server was fine |
| **`verify:lex-25e-ui`** | **does a control come out of the render?** | **yes** |

---

## §5 — acceptance criteria

| criterion | status |
|---|---|
| the confirmation offers accept, "not quite" **and** a text input; "not quite" re-runs only the confirmation | ✅ rendered and walked live |
| answers survive a refresh, a closed tab and a return; the resumption is announced | ✅ live; the resume query lands on Charlie's own idea |
| the cause of the apparent crash is named, with the `IdeaBuild` row as evidence | ✅ **there is no row — that is the evidence** |
| no question text appears twice; question 2 explains its requirement; the estimate reads cleanly | ✅ asserted on rendered markup |
| **a human completes the elicitation and starts a build** | ❌ **NOT DONE — see below** |
| delivery verified per CLAUDE.md §20 | see the change log |

### ⚠ The acceptance criterion this sprint cannot meet

**A person has not completed the flow, and I cannot be that person.** The extension has no host
permission for `localhost:3000` and this session has no Clerk session on production. The brief
anticipated this: *"If the extension still cannot hold a session, say so and Charlie runs it."*
Saying so.

What I have instead is the strongest substitute available and it is not the same thing: the
server walked end to end through the real functions and reached `canStart === true`, and every
phase was rendered and produces a usable control. **Neither proves a click works.**

▶ **Charlie: the run is one link.** `https://www.scrutinise.org/ideas/build` now resumes your
existing idea — the one with the 2,934-character problem — and should open on the confirmation
with a working *"That's right — build it"*. If you would rather start clean:
`https://www.scrutinise.org/ideas/build?fresh=1`.

---

## What is NOT verified

1. **No human run.** The whole point of the brief, and the one thing I cannot do.
2. **No click has been exercised anywhere** — every assertion is a server walk or a first
   paint. Effects, polling and the build's own progress display are untouched by this sprint
   and remain unproven end to end.
3. **The build itself has still never run.** Fixing the door does not prove the room. Sections B
   through G of Charlie's walk remain entirely untested, exactly as the brief says.
4. **The ten empty shells are not cleaned up.** Resuming stops the litter at source; removing
   what is already there is a destructive step and was not taken.
