# SPRINT 25-A — minimum elicitation and the first build

*Executes `docs/BRIEF_25A.md` §0–§7. Report written 2026-08-17.*

**What this sprint had to prove.** §25 inverts the flow: the user decides, Lex writes. 25-A builds
the smallest end-to-end version of that — four questions, then Lex drafts a rough kernel and shows
it — so Charlie can judge the premise before we commit to 25-B/C/D. *If a kernel drafted from four
answers is not worth reviewing, nothing in the later sprints rescues it.* Built, then stopped.

---

## ⚠ FIRST, THE THING THE BRIEF ASKED FOR THAT DOES NOT EXIST

**`LEX_DESIGN_ADDENDUM_25.md` is not in the repository.** The brief cites it as the spec and
references §25.1 (fields and storage), §25.3 item 5 (why the user's own knowledge must be told apart
from retrieved material) and §25.4 (the domain-transfer question). There is no file
`docs/LEX_DESIGN_ADDENDUM_25*`, and no other document in `docs/` contains a §25.

The brief is detailed enough to build from, so it was built from the brief. **The one place this
bites is §25.1 — "fields and storage per §25.1" — where I had to choose.** I chose a dedicated
`IdeaElicitation` table rather than new `IdeaFieldState` rows, and the reasoning is in
`prisma/lex_build_25a.sql`: the field machine's statuses describe a *proposal contract*, and the four
answers are not proposals — they are the user's own words, taken before anything has been drafted.
Overloading the field machine to carry them would have meant changing it, which §1 says not to do.
**If §25.1 says something else, this is the decision to revisit, and it is one table.**

---

## What is running

**A new route: `/ideas/build`.** §0 says 25-A *adds a path, it does not remove one*, and the
cleanest way to make that literally true was a second entry point rather than a flag over the first.
`/ideas/create` is untouched — same page, same conductor, same fields, same behaviour. When a 25-A
build finishes it hands off to `/ideas/create?ideaId=…`, so §5's "present it in the panel as it
stands today" needed no new viewer, and the four exchanges are already in the chat above the draft
because the elicitation wrote into the same transcript.

There is no navigation link to it. It is reachable by URL, deliberately: this is a premise to judge,
not a path to put in front of every user.

### §1 — Page 1: four exchanges, then a confirmation

| | Exchange | Stored |
|---|---|---|
| 1 | The problem, in their words | `IdeaElicitation.problem`, behind the existing §19-D problem gate |
| 2 | What you want to happen · anything already ruled out | `goalKind` (4 options) + `goalDetail` + `ruledOut` |
| 3 | What you know that we won't find | `ownKnowledge` + **`ownKnowledgeProvenance = USER_TESTIMONY`** |
| 4 | Anything to read? | `readingUrl` / `readingFileName` + **`readingStatus = NOT_READ`** |
| + | About you | the existing `aboutYou` User-scoped field — **skipped for a returning user** |

**The problem gate is reused, not reimplemented.** `looksLikeASolution` and `MAX_PROBLEM_PRESSES`
come straight from `lib/lex/method.ts`; the elicitation engine caps the press at two and then takes
what it is given without reproach. `check:build-25a` asserts the cap in the engine *and* in
`method.ts`, and that the canonical 10-Aug answer ("I want to change the amount charged for plastic
bags in shops") still trips it.

**Exchange 3's provenance is load-bearing, not decoration.** It is stored with its provenance and
carried into every prompt inside a block that says, in the prompt itself: *USER TESTIMONY — not a
retrieved source, never cite it as one.* A check walks every `${ctx.ownKnowledge}` /
`${input.ownKnowledge}` interpolation in the codebase and fails if the label is not within 400
characters of it.

**Exchange 4 says out loud that Lex cannot read it.** The label is next to the input, not in a
footnote afterwards, and `readingStatus` is written as `'NOT_READ'` at every write site — asserted by
a check that scans for any other literal.

**§1c — the confirmation blocks the build, and it blocks it in `claimBuild`**, not by the UI
declining to render a button. Live-verified both ways: an unconfirmed elicitation is refused and
leaves no row behind; the same call with the elicitation confirmed succeeds.

⚠ **There is deliberately NO fallback paragraph.** If the model fails to write the understanding,
Lex says so and offers to try again. A stitched-together restatement of the four answers would look
exactly like a paragraph Lex had thought about, and the user would confirm it — which is the §19-C
silent-stub failure at the one step whose entire job is catching a misunderstanding.

### §2 — the build harness

`IdeaBuild { id, ideaId, version, status, framing, passesComplete, currentPass, passes,
uncertainties, summaryMessage, queryUsed, startedAt, completedAt, failureReason, cancelRequested,
tokensIn, tokensOut, estCostPence }`, plus `BuildFork`. Additive, idempotent SQL, applied to Neon
after `npm run whichdb` and **re-applied to prove idempotence**.

- **One active build per idea**, enforced twice: a **partial** unique index on `(ideaId) WHERE status
  IN ('QUEUED','RUNNING')` — which Prisma cannot declare, and which a future `migrate diff` will want
  to drop and must not — and a conditional update **whose count is read**. Live-verified: three
  simultaneous claims all lose to the one already running, leaving exactly one active row.
- **Status by polling the row.** `GET /api/ideas/{id}/build`.
- **Incremental persistence.** Four named passes, each committing its own proposals, child rows,
  forks and uncertainties as it completes, and rewriting the pass log with it.
- **Cancel is co-operative.** The route writes `cancelRequested`; the engine checks it between passes
  and settles the row itself. A cancel that flipped the status in the route would produce a row
  saying CANCELLED while the work carried on writing proposals underneath it. Live-verified that the
  route does *not* change the status, and that a cancel on a finished build applies to nothing.
- **A re-run is the normal case**, not an error: versions 1, 2, 3 all survive.

#### ⚠ THE FIFTEEN-MINUTE CEILING CANNOT FIRE ON THIS PLATFORM, AND IT SAYS SO

§2 asks for "target 5–10 minutes, **hard stop at 15**". A Next.js route handler on Vercel cannot run
for fifteen minutes — `maxDuration` tops out at 300s for these functions. **A 900,000 ms budget
checked inside the request is a guard that cannot fail**, which is the failure mode this codebase has
already recorded.

So both numbers are declared and the code reports which one binds:

```
HARD_STOP_MS      900000   the brief's ceiling. Reachable the day the build moves to a worker.
REQUEST_BUDGET_MS 270000   inside maxDuration=300. THIS IS THE ONE THAT ACTUALLY FIRES TODAY.
```

`effectiveBudgetMs()` returns the smaller and names the binding one; the progress display prints it
(`ceiling 270s (request) / 50p`); and a check fails if the effective budget ever exceeds 300s.
**A build the platform kills outright is caught by `settleAbandonedBuilds` and written to FAILED** —
which is exactly the acceptance criterion, arrived at from the other direction.

*Measured: a complete four-pass build takes **44–47 seconds**. The fifteen-minute ceiling is not
currently a live constraint on anything; it becomes one when 25-B adds the research and adversarial
passes.*

#### The cost ceiling, and the one thing that can defeat it

Spend is recorded on **every terminal path, failures included** — a build that burned tokens and then
failed still cost money. `estCostPence` is **nullable, and null means UNPRICED, never free**: a model
with no rate on file must not silently cost zero, because zero is a claim and it is the claim most
likely to be believed.

⚠ **The corollary is that an unpriced run cannot be stopped on cost, and the code says so out loud**
rather than treating null as zero: `[lex-diag] 25a cost ceiling NOT ENFORCEABLE this run — unpriced
model(s)`. The gap is visible instead of assumed away.

⚠ **The rates are list prices recorded from Google's published pricing on 2026-08-17. They have NOT
been reconciled against a bill.** That is why the column is `estCostPence` and the UI says
"estimated". `LEX_BUILD_RATES` overrides them without a deploy.

### §3 — pass 1: orient, and the query-framing experiment

Two gateway searches (`BACKGROUND_BRIEFING` + `LEGAL_LANDSCAPE`), deduped, stored where the existing
panel already looks for them, plus the domain-transfer question — *"Who else has this problem,
outside this sector, and what have they built to deal with it?"*

⚠ **The domain-transfer answer is labelled as reasoning in the artefact itself**, above the answer
and not in a footnote: *"Reasoning, not retrieval — this comes from Lex's general knowledge, not from
the corpus, and is worth checking."* No corpus can answer that question, which is exactly why §25.4
calls it the highest-yield generic question we have and exactly why presenting it as retrieval would
be a fabricated grounding claim. The prompt tells Lex to say so in its own first clause as well.

A cited source id that was not in the set handed to the model is **dropped before it can be
persisted**, so a fabricated citation cannot survive even if the model produces one.

**§3a — AMENDED MID-SPRINT BY CHARLIE, and the amendment is honoured here.**

The brief asked for both framings to be run on three ideas and reported side by side. Partway
through the sprint that was withdrawn: *"Build pass 1 with the query framing as a switchable
strategy (naive / contextualised) and record which was used on every build, exactly as briefed.
Remove the comparison itself… The comparison transfers to the Search stream, which will run it
across the scored gold set."*

So what is here is the strategy and the record, and **not** the comparison:

- `frameQuery(framing, ctx)` builds both arms. **A — naive:** the user's problem as they would put
  it into a chat window, and nothing else. **B — contextualised:** the problem plus goal,
  ruled-outs, their own knowledge and the profile.
- The arm is chosen per build (`POST /api/ideas/{id}/build` takes `framing`; `LEX_BUILD_FRAMING`
  sets the default) and **written onto the row** — `IdeaBuild.framing` is `NOT NULL` **with no
  default**, so a build cannot fail to say which arm it ran — along with `queryUsed`, the string
  actually issued.
- `DEFAULT_FRAMING` is `B_CONTEXTUALISED` and **that is not a verdict** — it is the framing closest
  to what the rest of the product does today.

⚠ **Both arms issue the SAME search terms, and a check asserts they stay identical.** The variable
is the framing — what the model is *told* — and changing the term extraction as well would confound
whoever runs the comparison later. A second check reads arm A's branch and fails if it so much as
mentions `ownKnowledge`, `ruledOut`, `aboutYou` or `goalKindLabel`: **two arms that quietly converged
would keep running, keep recording an arm, and be recording a distinction that no longer existed.**
That check is the thing Search inherits; it is what makes their gold-set run mean something.

**Removed, per the amendment:** `scripts/measure-build-framing.ts` and
`docs/BUILD_25A_FRAMING_AB.md`. The six harness ideas it created were hard-deleted from Neon.

⚠ **Two real defects were found by that harness before it was withdrawn**, and they are the reason
this sprint is not shipping with them: the NUL byte below, and the duplicate instrument fork in §4.
Both were found by running six real builds, and neither would have been found by reading the code.

### §4 — pass 2: the rough kernel

Three passes, straight through, into the existing canonical fields **as proposals**
(`AWAITING_CONFIRMATION`) via the unchanged `setProposal` and the existing child-entity seeders. A
check fails if `build.ts` ever calls `acceptField` or `submitBox`: **nothing is accepted on the
user's behalf.**

- **Forks are recorded** — `BuildFork`, two alternatives per fork with the genuine case for each, and
  the excess counted rather than dropped silently (`trimForkAlternatives` is a pure function so that
  cap can be executed by a test rather than asserted by a grep).
- **Per-field uncertainty**, in a sentence, shown first.
- **The instrument question is asked**: primary legislation · secondary legislation · regulator rule
  or guidance · funding · organisational change · a quango's remit, plus local/national and
  devolved/reserved, recorded as its own fork under `guidingPolicy:instrument`. ⚠ **A build that
  names no instrument REPORTS the gap** rather than looking like a build that answered the question.
- ⚠ **A duplicate of the instrument fork had to be stopped IN CODE, because the prompt would not
  do it.** All six exercise builds emitted an instrument fork of their own — `instrument:chosen`,
  `instrument:type`, `instrument:regulatorRule` — alongside the platform's canonical
  `guidingPolicy:instrument`, so the same decision reached the user twice under two names, and 25-C
  would have inherited both. A prompt line forbidding it was added and the very next build produced
  `approach:instrument` regardless. A filter scoped to the approach pass then failed too, because
  the duplicate does not always come from that pass. **The rule now lives in `persistForks`, where
  every pass's forks go through it, and the drop is COUNTED** — a silent de-duplication is
  indistinguishable from a model that stopped doing it. Verified by a build that was watched failing
  this assertion twice before it passed.
- **The build never invents a cost.** A check fails if it writes `implementationCost`,
  `enforcementCost`, `regulatoryFriction` or `costSummary`. Costing is the user's work with Lex, and
  a fabricated range would travel into a cost-benefit case as though it had a source.

⚠ **A completed build moves `Idea.lexPage` to `COHERENT_ACTIONS`, and this is load-bearing.**
`assertWritableField` refuses a write to a page ahead of the pointer. Without the move, the panel
would fill with drafts across all four pages and **every Save beyond Orientation would 409** — a
panel of things you can look at and cannot keep. Live-verified both ways: with the pointer at
ORIENTATION three of four spread fields are refused; with it at COHERENT_ACTIONS none are.

### §5 — presenting the draft

No review agenda (that is 25-C). The kernel appears in the existing panel, and in the chat above it:
Lex's "what I did and what I'm unsure about", then Charlie's credibility paragraph, then the
invitation to edit. **The order is the decision** — a warning before the user has invested reads as a
threat; after the work is done it reads as respect — and a check fails if the credibility note is
ever written before the summary.

---

## ⚠ A LATENT DEFECT THE HARNESS FOUND, IN THREE PLACES, NONE OF THEM NEW

The second of the three framing fixtures died with:

```
[lex-diag] 25a build threw { reason: 'unsupported Unicode escape sequence' }
```

That is PostgreSQL refusing **a NUL byte (U+0000) inside a `jsonb` value**. Unlike `text`, `jsonb`
has no representation for one — the JSON spec allows the escape and Postgres does not — so **a single
NUL anywhere in a retrieved snippet fails the entire UPDATE**. A corpus search that had *succeeded*
(240 results across five routed streams) took the whole build down, reported as a bare driver message
that named nothing a reader would connect to the corpus.

**It is not a 25-A defect.** Three write paths carry corpus text into `jsonb` and all three had it:

| path | since | why it had not bitten |
|---|---|---|
| `saveStageSearches` — every stage entry | §19-C | stores `grouped`, ~20 results |
| `fireSearchTrigger` → `Idea.legislationRefs` | Sprint 1 | same, ~20 results |
| the 25-A orient pass | today | retrieves across five streams, and hit it on fixture 2 of 3 |

Fixed at the boundary and in **one** place — `lib/lex/json-safe.ts` — because this codebase has
already paid for the alternative (eight sources each rolling their own HTML-entity decoder, 17 Aug).
Applied to all four `jsonb` writes that can carry model or corpus text, including the transcript.
Only U+0000 is stripped: TAB, LF and CR are legal in JSON and carry meaning in extracted text, and a
broader strip would silently reflow snippets. The strip **logs the count** — a silent repair is still
a repair, and the count is the only evidence it happened.

---

## Verification

| | |
|---|---|
| `tsc --noEmit` | clean |
| `next build` | compiles; all four new routes present (`/ideas/build`, `/api/ideas/[id]/build`, `/…/build/cancel`, `/…/elicitation`) |
| `npm run check:build-25a` | **40/40** |
| `npm run check:build-25a -- --self-test` | **40 controls fired · 0 without a control · 0 that could not fail** |
| `npm run verify:build-25a` (live, against Neon) | **23/23** |
| `npm run verify:build-25a-ceilings` × 3 (time / cost / control) | **8 + 8 + 7 = 23/23** |
| `npm run verify:build-25a-ui` (render assertions) | **31/31** |

**Every assertion was watched failing before it was trusted to pass.** `--self-test` corrupts the
source for each check and requires the check to reject it; it runs first, and it exits non-zero if
any assertion cannot be made to fail. It earned its keep twice:

1. The credibility-order control used a literal `
` and **silently matched nothing on a Windows
   checkout**, so the assertion reported a pass while testing an unmodified file.
2. The `'truncated'` control removed the reason from the type union only — the string still appeared
   in `plainFailure`'s switch, so the check passed anyway.

Two further checks were reporting **failures on correct code** and were themselves wrong: one
searched the raw source for a sentence the file splits across a `' +` concatenation, and one looked
for the instrument options in the file that *interpolates* them rather than the one that *declares*
them.

**Both sides of every state machine are asserted.** A settle that killed everything and a settle that
killed nothing both pass a one-sided test, so: a build that started seconds ago is **not** settled; an
unconfirmed elicitation is refused **and** a confirmed one succeeds; a cancel applies to a running
build **and not** to a finished one; three later-page fields are refused with the pointer at
ORIENTATION **and** none are with it at COHERENT_ACTIONS.

### The ceilings were verified by making them fire

| run | expected | result |
|---|---|---|
| `LEX_BUILD_BUDGET_MS=1` | time ceiling | **FAILED**, 0/4 passes, *"ran out of time after 0 seconds"*, nothing half-written, 0 tokens |
| `LEX_BUILD_COST_PENCE=0.0001` | cost ceiling | **FAILED**, 1/4 passes, *"hit its spend ceiling"*, **what pass 1 drafted is still there**, 49,263 tokens recorded |
| neither set | **must complete** | **DONE**, 4/4 passes, 46–53s, ~4p, no failure reason |

The third row is the one that makes the first two mean anything: a ceiling that always fires looks
identical, from a one-sided test, to a ceiling that works.

### ⚠ THE BROWSER WALK COULD NOT BE DONE FROM THIS SESSION, AND THIS IS NOT A BROWSER WALK

The standing rule is browser-verify before reporting done, and §2's progress display cannot be judged
any other way. **Two blockers, both outside this session's reach:**

1. **The Chrome extension has no host permission for `localhost:3000`.** A dev server was started and
   `/ideas/build` correctly redirected to `/sign-in?redirect_url=%2Fideas%2Fbuild` — which is real
   evidence that the route exists and is protected — but every screenshot and page read returned
   *"Extension manifest must request permission to access the respective host."* The same tools read
   `www.scrutinise.org` without complaint, so it is the host, not the tooling.
2. **The browser has no Clerk session on production** — `/dashboard` redirects to `/` — and the local
   instance is a separate DEV Clerk instance, so there is no account to sign in with either way.

**What was done instead:** `verify:build-25a-ui` renders `BuildProgress` to static markup with
fixture props and asserts 31 things a user would see — every named pass and its detail line, the
elapsed time, the per-pass output, the spend, the ceiling and which one binds, the absence of any
percentage, the forks grouped by decision point with the case for each alternative, the per-field
uncertainties, and the three status shapes (running with Stop offered · done with Stop **not**
offered · stopped, saying "Stopped" not "Done", naming the reason, and marking unrun passes NOT
REACHED).

**That covers shape and copy. It does not cover click handling, polling, or layout, and it is not a
substitute for the walk.** ▶ **Charlie: `/ideas/build` on production is the thing to open**, once
this deploys. If you want me to do it, granting the Chrome extension access to `localhost` is the
one thing that unblocks it from here.

## What is NOT done, and why

- **The 15-minute hard stop is unreachable in production.** It needs a background worker; that is not
  in 25-A. Both numbers are declared and the code says which one binds.
- **The cost rate card is unreconciled** — list prices, not a bill.
- **`readingStatus` is never anything but `NOT_READ`.** Ingestion is 25-D, as the brief says.
- **The framing comparison is not run here** — withdrawn mid-sprint and transferred to Search. The
  switchable strategy, the recorded arm and the checks that keep the two arms distinct all remain.
- **No browser walk.** See above. Render assertions are not a substitute and are not offered as one.
- **Three copies of the transcript-append function still exist** (`orchestrator.pushLex`,
  `fields/route.postLexPointer`, `stage.postLexBubble`). 25-A added `lib/lex/transcript.ts` and used
  it rather than a fourth copy, but did not repoint the three — they sit in files two other threads
  are working in this week. Five lines; it should be made.
- **Not in this sprint by design:** the interrogation library, the revision loop and adversarial read
  (25-B); the review agenda and forks-as-decisions (25-C); the RH panel reorganisation and document
  ingestion (25-D).

## Spend

**~£0.60 in total.** Ten full four-pass builds at 3.5–5.6p each (six exercising both framings before
the comparison was withdrawn, four verifying the ceilings and the fork de-duplication), plus a
handful of failed runs. A complete build is **44–53 seconds** and **123,000–190,000 input tokens** —
the input dominates, because pass 1 hands ~240 retrieved documents to the model and passes 2–4 carry
the orientation forward.

Every harness idea was created under a `[25-A …]` title and **hard-deleted** afterwards
(`npm run cleanup:25a` exists for the case where a script dies between creating and cleaning, which
happened once).

## For Charlie

1. **Open `/ideas/build` on production** once this deploys, and judge the premise: is a kernel
   drafted from four answers worth reviewing? That is the whole question 25-A exists to answer.
2. **`LEX_DESIGN_ADDENDUM_25.md` is missing.** If §25.1 specifies storage other than a dedicated
   table, say so — it is one table to move.
3. **Decide whether `/ideas/build` gets a way in.** It is URL-only today, deliberately.
4. **The Chrome extension needs `localhost` access** if you want me to do browser walks from here in
   future sprints.
