# SPRINT 25-E — the front door opens

**Executes:** `docs/BRIEF_25E_ELICITATION.md` §1–§5. **Thread:** LEX. **Written:** 2026-08-23 22:45 UTC. ⚠ The commit trailers read 08:45 UTC — the machine clock was ~14 hours slow and resynced mid-sprint; see Delivery.
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

## Delivery (CLAUDE.md §20) — and it does not close

Six scoped commits pushed as `dd2bdd4`, via **`commit-lex-25e.sh`** — named per stream, explicit
paths only; another thread has uncommitted work in this tree and none of it appears in any commit.
Deleted after the push.

| # | check | result |
|---|---|---|
| 1 | every file created is committed | ✅ `check:committed` **474 files clean** — and it CAUGHT `ElicitationCards.tsx` before the commit, which is the §20 incident-3 class exactly. `git check-ignore -v` run on each new file: none ignored |
| 2 | the remote has the commits | ✅ `git ls-remote origin Main` = `dd2bdd4`, which is my tip; `merge-base --is-ancestor` confirms all six |
| 3 | the deployment is green **and Production** | ⚠ **not readable** — `VERCEL_TOKEN` is SAML-blocked (§19) |
| 4 | **the running site serves the change** | ❌ **NO. Production is still serving pre-25-E code.** |

### ⚠⚠ Check 4 failed, and it is reported as a failure

**~25 minutes after the push, `https://www.scrutinise.org/ideas/build` serves a byte-identical
bundle to the one it served before it** — 16 client chunks, 812,883 bytes, unchanged across
thirteen fetches. All five 25-E markers ABSENT; the control ABSENT in both runs.

The probe is sound and I proved it rather than assuming it, because a probe that cannot see the
bundle would produce exactly this result:

- **every pre-existing string from that same component is PRESENT** in those chunks — *"That's
  everything I need"*, *"Could not start a session"*, *"Nothing to add"*. The probe is reading the
  right bundle; the bundle is old code.
- `x-vercel-cache: MISS`, `age: 0` — a fresh render from the deployment, not a cached response.
- **25-D's markers ARE live** on `/ideas/create`, so production is not stuck far back; it is at
  or after 21 August and before this push.

And the code is not what is stopping it: **`npm run build` compiles successfully in 36.8s** on
this tree. (One warning, `EINVAL` copying a `node:inspector` chunk into `.next/standalone` — a
Windows filename artefact, not a Linux build failure.)

So: pushed, on the remote, builds clean, **and not serving**. Whether that is a queue, a failed
Production build, or a Preview-only build cannot be established from here.

▶ **CHARLIE — the one thing I cannot check.** Vercel → Deployments → find `dd2bdd4`
(*"docs(lex): 25-E report, change log and handoff"*). Is it **green**, and is its Environment
column **Production**? Both of the failure modes this project has already had look identical from
outside: 6–9 Aug production served three-day-old code for a week because pushes were building as
Previews; 17–18 Aug production failed to build for ten hours. **Nothing in this sprint is on the
site until that deployment is green and Production**, so the human run cannot start before it.

### ⚠⚠ And a second thing to correct: the commit timestamps are wrong by ~14 hours

The `Date:` trailers on all six commits read **`2026-08-23 08:45 UTC`**. The true time was
**about 22:00 UTC**. This was not a copied-forward stamp — it was read from the system clock as
CLAUDE.md requires, and **the system clock was itself ~14 hours slow and resynced during the
sprint**. The git author dates carry the same error (`09:47 +0100`), because they came from the
same clock.

Confirmed against three independent sources, all agreeing: `date -u`, the Vercel `date` response
header, and Google's `date` header.

**The history is NOT rewritten** — three threads share this branch and a force-push to correct a
timestamp would be far worse than the timestamp. The documents carry the true time, and this
paragraph is the reconciliation, because the entire purpose of the trailer is to let a
CHANGE_LOG entry be matched to the commit that was live when something went wrong. Anyone doing
that for 23 August must add ~14 hours to these six commits.

⚠ The neighbouring ingest commits show the same divergence (author `20:45 +0100`, trailer
`01:50 UTC`), which suggests the clock has been unreliable for longer than this sprint. Worth
Charlie checking the machine's time sync.

---

## What is NOT verified

1. ⚠⚠ **NOTHING IS ON THE SITE YET.** Check 4 failed: production still serves pre-25-E code. Every claim below about behaviour is a claim about the CODE.
2. **No human run.** The whole point of the brief, and the one thing I cannot do — and it cannot even begin until the deployment lands.
3. **No click has been exercised anywhere** — every assertion is a server walk or a first
   paint. Effects, polling and the build's own progress display are untouched by this sprint
   and remain unproven end to end.
4. **The build itself has still never run.** Fixing the door does not prove the room. Sections B
   through G of Charlie's walk remain entirely untested, exactly as the brief says.
5. **The ten empty shells are not cleaned up.** Resuming stops the litter at source; removing
   what is already there is a destructive step and was not taken.
