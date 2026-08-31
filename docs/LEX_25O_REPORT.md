# LEX 25-O — clearing the road to Pilot A

**Executed:** `docs/BRIEF_25O.md`. **Run mode:** continuous, per §0.
**Built:** §1, §2, §4, §5. **Measured and deliberately NOT changed:** §7.
**Diagnosed, not built:** §6. **⚠ NOT DONE, and it is a decision for Charlie:** §3.

---

## 0. Three things before anything else

> ### ⚠⚠ 1. §3 would break §1d, and `/ideas/build` is not a testing surface — it is Stage 1 AND the live new-idea door.
>
> **Measured, not supposed.** The `newIdeaDoor` row in `PlatformConfig` reads **`"build"`** in
> production right now. So `/ideas/build` is where every NEW idea currently starts. It is also
> `stageHref('idea')` — **"1 · The Idea"**, the tile 25-N verified live showing *"7 runs, 4
> documents"* — and it is the only page that renders `BuildProgress`, the re-run dialogue, the
> findings, and **the resume control §1d of this same brief requires to be reachable.**
>
> Redirecting it would send every new pilot user through the OLD chat elicitation (25-F §9d kept
> it behind that flag), delete Stage 1 from a three-stage product, and remove the resume control.
> **I have not done it.** §3 is the one section of this brief I have left undone; the options are
> below and the choice is yours.

> ### ⚠⚠ 2. §1's stated symptom does not exist. The real defect is worse and quieter.
>
> §1 says a build *"can begin, run passes, spend real money and then be refused part-way"*.
> **Nothing in the pass path has ever read the allowance** — no build has ever been stopped
> mid-run by it. What could happen instead: **the door check was priced against the mode the
> caller ASKED for, and twenty lines later `reuseFrom` decides what will actually RUN.** A REUSE
> request with nothing to reuse is downgraded to FULL and recorded as FULL. So a user with
> **exactly one third left** could ask for a redraft, pass a check priced at one third, and have
> the engine run the whole ten-pass build and charge three — clamped silently to zero.
>
> §1a's prescription — reserve, don't check — fixes the other half (the race), and its reasoning
> was right even though the symptom was not.

> ### ⚠ 3. §7's measurement says: do not optimise. The duplicates are not the cause.
>
> Measured on Charlie's own idea, three runs each: `/panel` **24–28 ms**, the duplicate `/panel`
> **28 ms**, `/agenda` **~100 ms** each — and **`/build` at 324 ms**, which is by far the slowest
> and is *not* a duplicate. Total server time for the whole first paint is **579 ms**. 25-N's walk
> saw *several seconds*, so **the assemblers are not where the seconds are**. Details in §7.

---

## §1 — The allowance is reserved before the build starts

**1a — reserve, not check.** `readAllowance` now counts, alongside the DONE builds it always
counted, the builds that are **QUEUED or RUNNING**, priced at the row's own mode. A build in
flight holds its thirds by existing.

⚠⚠ **The hole this closes is a RACE, and it is the one §1a's reasoning names.** Spend counted only
DONE builds, so two builds started inside the same ten minutes — two ideas, two tabs — **both
passed the door check because neither was DONE yet, and only one of them was paid for.**

⚠ **And the check moved.** It ran above `reuseFrom`, against the requested mode; it now runs after
it, against `effectiveMode`, which is the same expression the row is written with. Two places
deciding "is this a reuse" is two places that can disagree, and the disagreement is exactly what
let a full build through a redraft-sized check.

⚠ **The refusal names the shortfall**, per §1a: *"a full build needs 3 thirds and you have 1 (2
more are held by a build running now), so you are 2 short."*

**1b — the release is structural, and that is the design.** A reservation **is** the row being
QUEUED or RUNNING, so the moment the status leaves that set the hold is gone. ⚠⚠ **There is no
release write, which means there is no path on which a release can be missed** — and 25-M already
recorded that the spend test is an allow-list, so a leaked hold would be a permanent deduction
with no row saying why.

⚠ **The one case structure cannot cover is a row STUCK at RUNNING** — a worker killed between
settle sweeps, on an idea nobody opens. So a hold also **expires**: past the whole-build hard stop
plus a wide margin it stops counting, because the build cannot still be running whatever the row
says. Both directions are asserted: **a FAILED or CANCELLED build reports what it gave back on
screen — *"This did not use any of your allowance"* — and a DONE one reports nothing, because it
spent it.**

**1c — three full builds and three re-runs = 12 thirds**, from `LEX_PILOT_ALLOWANCE_THIRDS`.

⚠ **"Explicitly granted" is read off the NOTE, not the number.** `buildAllowanceThirds` has a
database default of 4, so a user nobody has touched is **indistinguishable by value** from one an
admin deliberately set to 4. The note is required on every admin write and is written by nothing
else. Changing the pilot number cannot overwrite a decision somebody recorded a reason for.

**1d — the resume control renders**, and `check:lex-25o` asserts it on both the component and the
call site. ⚠⚠ **This is a RENDER assertion and I am not calling it more than that.** It proves the
control is on the page and reachable. **It does not prove a resume resumes** — that needs a build
that actually stops, and costs two passes' spend. §1d asked for exactly this distinction and here
it is.

## §2 — The public view: a holding page

New route `/ideas/[id]/public`. The idea's **title and summary**, and §2's line verbatim:
*"The public view is being built. This is what your team sees today; the version the public will
see is coming."* Nothing else — 25-N §6's design stands and lands later.

⚠ **It is its own route, not a mode on the team page.** A `?public=1` flag on a page that already
renders privileged material is one forgotten conditional away from publishing it, and the real
view will now *replace this file* rather than add a branch to a page that must never leak.

⚠ **An absent title or summary is stated, not blank** — a blank reads as a page that failed to
load.

## §3 — ⚠ NOT DONE. A decision for Charlie.

**What §3 assumes:** `/ideas/build` is a leftover testing surface and everything is now at
`/ideas/create`.

**What is measurably true:**

| | |
|---|---|
| `PlatformConfig.newIdeaDoor` | **`"build"`** — every NEW idea starts there today |
| `stageHref('idea')` | `/ideas/build?ideaId=…` — **Stage 1, "The Idea"** |
| `/ideas/create` | Stages **2 and 3 only** (`strategy`, `deepening`) |
| Only on `/ideas/build` | `BuildProgress`, the re-run dialogue, `BuildFindings`, **the resume control §1d requires** |

**Redirecting it — under either reading — breaks something:**

- **The whole route** → Stage 1 disappears, the resume control (§1d) becomes unreachable, and
  every new pilot user is sent through the OLD chat elicitation that 25-F §9d kept behind the flag.
- **The bare route only** (no `ideaId`) → breaks 25-E §2's *resume rather than mint*, which was
  built specifically to recover **2,934 characters of Charlie's own writing** that the old
  mint-on-every-visit behaviour had orphaned. `verify:lex-25e-live` asserts it.

### §3b/§3c — the probe enumeration, by name, as asked

⚠ **§3's premise about the probes is inverted, and this is good news.** *"Several probes read
marker strings off that page"* — they read the **source file** `app/ideas/build/BuildIdeaClient.tsx`,
not the URL. **Redirecting the route would blind none of them**, because the file would still
exist. Deleting the component would blind all of them.

| probe | what it reads | homeless if the route redirects? |
|---|---|---|
| `check:build-25a`, `check:build-25b`, `check:lex-25e`, `check:lex-25f`, `check:lex-25g`, `check:lex-25h`, `check:lex-25i`, `check:lex-25k`, `check:lex-25l`, `check:lex-25m`, `check:lex-25n` | the source file | **No** — file-path assertions |
| `verify:build-25a-ui`, `verify:lex-25g-ui` | render the component | **No** |
| `check:lex-25j`, `verify:my-ideas-ui` | `hrefFor(unbuilt) === '/ideas/build?ideaId=…'` | **Yes** — asserts the Stage-1 link |
| `verify:lex-25e-live` §2 | *"returning to a bare `/ideas/build` resumes THIS idea rather than minting a new one"* | ⚠⚠ **Yes, and it has no home on `/ideas/create`** |

**Your options:**

1. **Leave it (what I have done).** `/ideas/build` stays as Stage 1 and the new-idea door.
2. **Flip the door back to `create`** — one `PlatformConfig` write, no deploy, reversible by the
   same write (25-F built it for exactly this). New ideas then use the old chat elicitation.
   ⚠ **Stage 1 still lives at `/ideas/build`**, so this does not "retire" the route.
3. **Move Stage 1's content into `/ideas/create`** and then redirect. That is a real sprint, not
   a redirect, and it is the only option that makes §3 literally true.

## §4 — Archiving the pre-rebuild ideas

**4a — the list, and nothing was hidden.** `--archive` is refused without `--ids` or `--owners`,
and the default run is a dry run that changes nothing. Six ideas, three testers, all `builds=0`,
all created March–May 2026:

| id | created | stage | owner | title |
|---|---|---|---|---|
| `c34e8c5f` | 2026-03-26 | STAGE_2 | johnduggan6@icloud.com | Addressing Litter in Huddersfield |
| `727cf3c5` | 2026-03-27 | STAGE_1 | johnduggan6@icloud.com | Proposing a Ban on Mobile Phone Use in Specific… |
| `63d3e881` | 2026-03-27 | STAGE_1 | johnduggan6@icloud.com | Universal Free School Meals for All Children |
| `d55eadc8` | 2026-04-15 | STAGE_1 | michaeljocallagahan@gmail.com | Restricting Men's Access to Women's Pool at… |
| `ba8e7524` | 2026-05-12 | STAGE_1 | johnduggan6@icloud.com | E-Cycle Speed Restriction |
| `bf5eae91` | 2026-05-18 | STAGE_1 | rossengineering56@gmail.com | Defence Infrastructure Reform |

⚠ **`charlie@whatmusic.com` (1 idea) and `charlieleach1@gmail.com` (2) are NOT on this list, and I
have not guessed.** They may be yours. Say if they should be included. The `historical+…` and
`editorial@` accounts are seeded demo content and are excluded.

⚠⚠ **NOTHING OF THEIRS HAS BEEN HIDDEN.** §4a says you see the list first, and you are reading it.
One command, when you say:

```
tsx --env-file=.env scripts/archive-ideas.ts \
  --ids c34e8c5f,727cf3c5,63d3e881,d55eadc8,ba8e7524,bf5eae91 \
  --archive --reason "Made under the previous structure; explained to the three testers directly."
```

**4b — archived is its own column, and the separation is the design.** `deletedAt` means the
**owner** deleted it — their act, undoable by them. `archivedAt` records that an **admin** hid
somebody else's work. One column would make the two indistinguishable afterwards, so nobody could
answer *"did the user delete this, or did we hide it?"* — and the second is the one you have to be
able to answer for. **Every row is kept.**

**4c/4d — the mechanism is PROVEN LIVE, on a row that was not theirs.** Rather than run it on the
testers before you have seen the list, I ran the whole thing on one of your own empty *"Untitled
idea"* rows (`25d54dec`, builds=0) and restored it in the same session:

```
updateMany reported: 1 rows. ⚠ That is its OPINION — the re-read follows.
── re-read from the database ──
  ✓ 25d54dec  archivedAt=2026-08-31T13:50  Untitled idea
  §4d — of 1 archived ideas, 0 still pass the live-idea filter.  ✓ zero, as required.
  control — an idea that was NOT archived: d55eadc8 … ✓ still visible
```
then `--unarchive` → `✓ 25d54dec  archivedAt=null`.

⚠ **The control is the half that matters.** A filter returning nothing because it is broken looks
exactly like one returning nothing because it worked.

⚠ **The hide goes through ONE predicate, `LIVE_IDEA`, imported by six read paths** — §4d's own
sentence is the argument: *a hide that one read path forgets is worse than no hide at all*, and the
ninth call site is always the one nobody remembered. **Two exceptions, both deliberate and both
named in the code:** the admin search (or nothing could ever put one back) and ⚠ **the user's GDPR
data export — archiving hides an idea from the PRODUCT; it does not un-give somebody their own
writing.**

## §5 — The opening commentary on the causes

A new pass, `CAUSES_COMMENTARY`, and ⚠⚠ **it is the only pass that reads the causes as a SET.**
Every other pass reasons about one cause at a time, which is precisely why the output is a list —
a list is what you get when nothing ever looks at the whole.

**Where it runs:** `… RESEARCH → REVISE → CAUSES_COMMENTARY → SMART → KERNEL_CHECK → …`. After
`REVISE`, because that is the pass that rewrites the causes against the research, so anything
earlier would describe a terrain about to change. Before the four verification passes, which are
all `continueOnFailure` — **so if the whole-build ceiling fires late, what is lost is a check and
not the commentary.**

**What it writes:** `terrain`, `complexity` (`SINGLE_CAUSE` / `SEVERAL_BIND` / `UNCLEAR`) with its
reason, `howPiecesFit`, and **`conflicts[]` — claim, what stands against it, why it matters.**

⚠⚠ **Contrary evidence is a STRUCTURED field, not a sentence in the prose**, and that is what makes
§5's *"assert the value, not the schema"* possible. Your own standard is the test — *"he gives no
hard numbers, there are plenty of numbers saying the opposite, and the figures no longer hold"* —
three separate claims, and prose would let a model deliver one and imply three.

⚠ **"No conflict" is an answer, with a reason.** §5 asks for an assertion that the commentary names
at least one conflict. Taken literally that is a requirement to *find* one, which on an
uncontested problem is a requirement to **invent** one — the §24 failure with the sign flipped. So
`conflicts` may be empty **only** when `noConflictFound` says what was examined and why nothing
contradicted it, and the check accepts exactly those two shapes and no others.

⚠ **It describes; it does not decide.** No `recommended` field, no ranking, and the prompt forbids
naming a winner — §0 is explicit that 25-P owns the choice mechanics and this must not pre-empt
them. It renders **above** the causes, before any choice is offered; a briefing under the list is
a footnote to a decision already made.

### The cost, as §5 asks

| | |
|---|---|
| **Baseline** | ~23p for a 10-pass build (25-M's measured run: 22.98p, 249s) |
| **What this adds** | **one model call, no retrieval** — it reads the causes and up to 60 findings already in the database |
| **Model** | `gemini-2.5-pro`, capped at 4,000 output tokens |
| **Estimated** | ⚠ **~2–4p, and this is an ESTIMATE, not a measurement.** The input is the causes plus ≤60 findings truncated to 600 chars — on Charlie's idea roughly 25–35k tokens in, ~1.5k out. **No build has been run with this pass.** |
| ⚠ **The real cost is the ceiling** | Build v7 hit the 900s hard stop at **922s with TEN** passes. This makes eleven. It does no retrieval so it is the cheapest kind of pass — but it is not free, and 25-N's resume is what makes a ceiling survivable. |

## §6 — Date-checking a claim: DIAGNOSED, not built

§6 says diagnose first, and the diagnosis changes what the fix is.

**The claim, found:** *"Civil Service productivity has increased"* — `The Future of the Civil
Service — Motion to Take Note`, `publications.parliament.uk/pa/ld201314/ldhansrd/text/140116-0001.htm`.
`ld201314` is the 2013–14 Lords session; `140116` is **16 January 2014**.

**Where the acceptance happened:** the **RESEARCH** pass wrote it, twice, under two interrogation
questions — `question:LEGAL_LANDSCAPE` and `question:CAUSAL_EVIDENCE` — both as `kind: CONTRADICTS`.
It then fed **REVISE**, which produced the `causes` contradiction now on the agenda.

**Was the date available and ignored, or never retrieved?**

> ⚠⚠ **NEITHER, EXACTLY — AND THAT IS THE ANSWER THAT MATTERS. `EvidenceItem` HAS NO DATE COLUMN
> AT ALL.** The full row is: `passKey, runVersion, fieldRef, kind, title, body, sourceType,
> sourceId, citation, url, status, note, siftReason, precedentTestPassed, headingKey, createdAt,
> updatedAt`. **The only dates are our own row timestamps.** The claim's date is sitting in the
> URL and in the corpus row, and the evidence layer has **nowhere to put it**.

**So the fix is not a prompt.** No instruction to "consider the date" can work, because the date
never reaches the model that would consider it. In order:

1. **`EvidenceItem` gains `sourceDate`**, carried from the corpus row at write time (the sift and
   the research pass both write these rows).
2. **A staleness rule keyed on the KIND of claim, not on age.** ⚠ A blanket "flag anything over N
   years" is the guard-measuring-the-wrong-dimension shape — it would flag durable constitutional
   principles and miss a two-year-old number that has already moved. A *measurement* decays; a
   *principle* does not.
3. **"Figures or assertion" as a stored field.** A remark with no numbers and a remark citing an
   ONS series are currently identical to us.
4. **A contradiction records which finding moved it.** ⚠ Cheap, and it is what would have made
   this one *findable*: today the agenda says the evidence changed Lex's mind and cannot say what
   evidence.

⚠ **Steps 1 and 4 are cheap and make it findable. Steps 2 and 3 are what would have caught it.**

## §7 — Measured, and the answer is: do not optimise

`tsx --env-file=.env scripts/measure-panel-fetches.ts 452c5ade` — 3 runs each, one uncounted
warm-up so a cold Neon compute is not attributed to whichever call ran first:

| call | runs (ms) | median |
|---|---|---|
| `/agenda` (WorkList) | 108 · 104 · 100 | **104** |
| `/agenda` (AgendaPanel — the duplicate) | 109 · 92 · 99 | **99** |
| `/panel` (ReportAdditions — added by 25-N) | 50 · 26 · 28 | **28** |
| `/panel?field` (QuestionPanel) | 25 · 24 · 24 | **24** |
| **`/build`** (BuildProgress + RerunBanner) | 367 · 324 · 314 | **324** |

**Total server time for the whole first paint: 579 ms. The two duplicates: 127 ms (21.9%).**

⚠⚠ **The slowest single call is `/build` at 324 ms, and it is not a duplicate.** These run in
parallel in the browser, so removing a duplicate only moves the paint if it is on the critical
path — and it is not. **De-duplicating would save requests, not seconds.**

⚠ **And the assemblers are not where 25-N's "several seconds" went.** 579 ms of server work cannot
produce a multi-second pending paint; the rest is network, serverless cold start and Clerk. §7's
own instruction — *"either de-duplicate or report why it is not the cause"* — and this is the
report. **Nothing was changed.**

## §8 — Held for Charlie

- **`prisma/lex_25n_backfill_against.sql`** — still unrun, as 25-N left it. §8 asks for a preview
  before you run it, and it must run **after** §4 so it does not operate on rows about to be
  archived. ⚠ **§4 has not run either**, so the ordering is not yet a live constraint. The preview
  is the file's own step 1 (`SELECT count(*) … WHERE "headingKey" = 'AGAINST'`), which changes
  nothing.
- **Notes visibility — decided: private only, one list.** ⚠ **Nothing was built**, and nothing
  needed to be: 25-N's `IdeaNote` already has no visibility column, by argument. Team-visible
  notes later become a **second list**, not a per-note switch — which was CC's recommendation and
  is now your decision, and the schema is already shaped for it.

---

## Checks

`check:lex-25o` — **44 passed, 0 failed, 11 negative controls, all 11 fired.**

**Whole suite RUN and reported (§23.2), not a selection:** 25-c 32, 25-d 77, 25-e 28, 25-f 62,
25-g 27, 25-h 20, 25-i 14, 25-j 12, 25-k 18, 25-l 19, 25-m 12, **25-n 98**, **25-o 44**,
build-25a 40, build-25b 54, 20bd 47, statutory 17, documents pass, corpus-types 156. Harnesses all
executed: 25g-ui 14, 25e-ui 16, my-ideas-ui 15, stages-ui 23, outputs-ui 7, build-25a-ui 45.

⚠ **Three guards fired and were REPOINTED, not relaxed**, and two of the three were exact-list
assertions that could only ever have been right by accident:

1. `check:lex-25f` **§7** asserted `href={`/ideas/${ideaId}`}` — which was the button §2 fixed.
   Asserting it now would be asserting the defect. Repointed to the property (*the user can find
   the idea by name*) **plus a new assertion that no control points at the team page as though it
   were the public view.**
2. `check:lex-25f` **live-2** required `continueOnFailure` to be an **exact list** of three. That
   fails whenever a pass is added for any reason and says nothing about what the flag is for.
   Repointed to the two properties it was protecting: **ADVERSARIAL must never be steppable**, and
   the three 25-F passes must be. ⚠ **Stronger than what it replaced** — a drafting pass appearing
   in the list still fails it.
3. `check:build-25b` counted **10 passes**. Bumped to 11, deliberately and with the ceiling cost
   written into the comment, because that literal's job is to make a pass appearing a **decision**.

`tsc`, `check:scripts`, `next build` and `check-clean-build --fast` all clean.

## Applied to the database

Neon `ep-old-dust-aboxi69a`, host checked with `scripts/whichdb.ts` first (§16):
**`prisma/lex_25o.sql`** — `Idea.archivedAt`, `Idea.archivedReason`, `IdeaBuild.causesCommentary`,
and a partial index `Idea_visible_idx`.

⚠ **That index is on the CLAUDE.md §21 hazard register** — `schema.prisma` cannot declare a partial
index, and `prisma migrate diff` will propose **dropping** it as drift.

## ⚠ VERIFIED LIVE — 2026-08-31, production, signed in

**§20 checks 3 and 4 are SATISFIED, and not by the SHA alone.** `/api/health` reports
`commit: 66458ac…`, `env: production`. Both new surfaces were walked signed-in.

**§2 — the holding page, at `/ideas/452c5ade…/public`:**

> The public view · Improving Civil Service Accountability and Productivity · **There is no
> summary on this idea yet — the public view will open on one.** · **The public view is being
> built. This is what your team sees today; the version the public will see is coming.** · See
> what your team sees · Back to your draft

§2's line came back **verbatim**, and ⚠ the honest empty state fired on real data — this idea has
no `summaryDescription`, and the page says so rather than rendering a blank.

**§1 — on build v7, the very build 25-N diagnosed:**

| § | read back off production |
|---|---|
| §1b | ⚠⚠ **"This did not use any of your allowance. The 3 thirds it was holding have come back to you."** — the release, priced from the row's own mode, on a real FAILED build |
| §1a | **"This build did not finish"**, with the 922-second reason |
| §1d | ⚠ **the resume control renders: "Carry on from …"**, with *"This picks the same build up where it stopped"* |
| §1c | **"You have 4 builds left."** — 12 thirds, nothing spent since the epoch, `floor(12/3)` = 4 |

### ⚠⚠ AND THE WALK FOUND A CONSEQUENCE I SHOULD HAVE ANTICIPATED

The resume control on build v7 reads:

> **"Carry on from "Describing the terrain""** — 8 of **11** passes

Build v7 ran under a **ten**-pass configuration and stopped after `KERNEL_CHECK` with 8 of 10.
`readPassLog` reconciles a stored log against the CURRENT `BUILD_PASSES` array — so inserting
`CAUSES_COMMENTARY` between `REVISE` and `SMART` has **changed what a historic build reports about
itself**, and has made the new pass the resume point for every build that stopped before it.

⚠ **`check:build-25b`'s own comment warned about exactly this** — *"a pass added by accident
changes what every historic build reports about itself"* — and I bumped that literal deliberately
without following the consequence through to the historic rows. The bump was right; not tracing it
was not.

**Is it harmful? No, and here is the reasoning rather than the reassurance:**

- **"8 of 11" is TRUE.** v7 genuinely did not run the commentary; it did not exist. The count is a
  statement about the current pass set, which is what the screen everywhere else describes.
- **A resume would do the right thing.** `resumablePassKey` returns the first PENDING or
  NOT_REACHED pass, so v7 would run the commentary, skip `SMART` and `KERNEL_CHECK` (both DONE in
  its stored log), and then run `LOGIC_CHECK` and `ADVERSARIAL` — the two it never reached. That
  is a better outcome than before, not a worse one.
- ⚠ **What it is NOT is free.** A user resuming an old build now gets a pass they had not been
  quoted for, and the allowance does not charge for a resume (§1a) — so the commentary on a
  resumed historic build is unbilled. On a pilot of twelve thirds that is immaterial; it is
  recorded here so it is a known consequence rather than a surprise.

**Still unverified, and the biggest of these is unchanged:**

1. ⚠⚠ **The commentary has never been generated.** No build has run the new pass — its prose, its
   conflict-finding and its ~2–4p estimate are all unmeasured. One full build settles it, and
   **build v7's resume is now the cheapest way to get one.**
2. ⚠ **A live resume has still never been run.** The control renders and names the right pass;
   pressing it is untested.
3. **The archive on the testers' rows** — deliberately not run, pending the list above.
4. **The reservation under a real race** — two builds started at once has not been provoked.

⚠ **One wording point, not a defect: "You have 4 builds left" under-describes §1c.** Twelve thirds
genuinely is four full builds, and `remainingBuilds` divides by three. But §1c's intent is *three
builds and three re-runs*, and the sentence does not say so. The ALLOWANCE is right; the sentence
describes its cheapest reading. Worth a line change if you want the 3+3 shape visible.

---

## ⚠ What only Charlie's browser — or a real build — can confirm

1. ⚠⚠ **The commentary has never been generated.** No build has run with the new pass. Its prose
   quality, its conflict-finding, and its real cost are all **unmeasured**. That is the single
   biggest unknown in this sprint and it needs one full build to settle.
2. ⚠ **A live resume has still never been run** (§1d) — carried forward from 25-N.
3. **The allowance arithmetic on a real user.** The reservation is asserted over the real query
   shapes, but no two-builds-at-once race has been run against production.
4. **The holding page, the archive, and the commentary panel** are three new surfaces that have
   not been walked signed-in. 25-N's walk is the model; this sprint's was not run.
5. **The six testers' ideas are still visible** — by design, pending your sight of the list above.

---

# ADDENDUM — Charlie's browser pass, 31 August

## §A1 — "Add to report" wrote nothing. **The write happened; the panel read the wrong key.**

⚠⚠ **The answer to §A1's question is: written, and not read.** Measured on Charlie's own idea —
three `IdeaSourceDecision` rows with `status: PRIORITY`, **two of them stamped 13:51 on 31 August**,
which is his browser pass. Every one of them matches an `EvidenceItem.id`. **None matches any
`sourceId`.**

The defect is an asymmetry between two lookups of the same map, eleven lines apart:

```
exclusion read:  [e.sourceId, e.id].find(...)          ← BOTH keys
priority  read:  e.sourceId && priority.has(e.sourceId) ← sourceId ONLY
```

The panel **writes** under `entry.id` — both `QuestionPanel` and `ReportAdditions` send it — and
**read** under `sourceId`. They can never match, so the star reverted the moment the panel
refetched and nothing ever reached DRAFT STRATEGY. A refresh could not help: the row was always
there and the join always missed it.

⚠⚠ **AND THIS IS WHY IT SURVIVED TWO SPRINTS OF CHECKS: THE FEATURE WORKED IN THE DOCUMENT.**
`proposal-snapshot.ts` builds `prioritySources` **directly off the decision rows** and never joins
at all — so 25-L §3d's "priority reaches the proposal document" was true, and its only stated
effect was inside a `.docx` nobody opened. 25-N's `ReportAdditions` did not break it; it made the
breakage **visible for the first time**.

⚠ **A third detail that decides the fix.** All three of Charlie's prioritised findings share one
`sourceId` (`828deef8…`). So "fixing" the write to store `sourceId` would have made prioritising
one finding silently prioritise every finding from that source. **The row's own id is the right
key**, and the read now tries it first with the source-level key as a fallback, so no older row is
orphaned and nothing needs migrating.

**The fix is one shared function.** `exclusion` and `priority` now resolve through the same
`decisionKey(e, map)` — two expressions that happen to agree is one that will drift, and this is
what drifting looked like.

### The round trip, asserted end to end — `verify:write-paths`

```
§A1 — the rows Charlie's own clicks left behind
  3 PRIORITY decision row(s) on this idea
  3 of them render as priority through the assembler
  ✓ every stored PRIORITY row reaches the panel — 3/3

§A1 — click, row exists, row renders, row survives a reload
  ✓ before the click, it is NOT priority
  ✓ the row EXISTS, and is stored under the EvidenceItem id
  ✓ it RENDERS — the assembler the middle column reads returns priority=true
  ✓ it SURVIVES A RELOAD — a second independent assembly still returns it
  ✓ CONTROL — a finding nobody prioritised is still NOT priority
  ✓ cleaned up — and the removal is READ BACK, not assumed
```

⚠⚠ **THIS IS THE CHECK THAT COULD HAVE CAUGHT IT AND DID NOT EXIST.** `check:lex-25n` asserted
that `ReportAdditions` filters on `e.priority` and that the button says "Add to report" — **both
true, both passing, for a feature that wrote a row and rendered nothing.** A source assertion
cannot see a join that misses. Only reading the value back through the real assembler can.

### And the other two write paths, as §A1 instructs — no longer assumed

§A1 is right that one of the three failing makes the other two unproven rather than fine. Both are
now demonstrated against the live database, with their own controls:

```
§A1 — the Notes write path (25-N §3c)
  ✓ a note saves and reads back under (ideaId, userId)
  ✓ CONTROL — the same note is invisible to another user on the same idea
  ✓ the note is gone, read back

§A1 — the worklist tick write path (25-N §3e)
  ✓ a tick saves and comes back in the set the route builds from
  ✓ a second press leaves ONE row, not two
  ✓ the untick removes it, read back
```

**13 passed, 0 failed.** ⚠ The notes control is the one that mattered: a note that saves but is
readable under the wrong key is a worse defect than one that does not save.

## §A2 — the middle column shows the kernel, and the rest opens deliberately

New `CollapsedSection`, used by **"What you have put in the report"** and **"What to do next"**.

⚠ **Closed by default is the opposite of the kernel's rule, and that is the point.** A kernel
section you are working in opens expanded (25-N §1c); these open shut. The middle column is a
**report**, and everything under the kernel is apparatus *about* the report.

⚠ **Same control as the kernel headings**, per §A2: a word beside the glyph (`show +` / `hide −`),
never a bare chevron, with `aria-expanded`. **A count and a hint stay readable while it is shut**
— a section you must open deliberately needs a reason to open, and "3" is the cheapest one.

⚠ **An empty section renders nothing at all** rather than a collapsed heading promising content.
And the research panel's copy of the agenda is **not** wrapped: it already lives inside a
one-item-at-a-time contents list, and a collapse inside a collapse is two controls for one act.

## §A3 — where "See this as others would" renders

**It renders in exactly one place: `app/ideas/build/BuildIdeaClient.tsx` — Stage 1, `/ideas/build`.
It does not render on `/ideas/create` at all.**

⚠ **And it is gated twice.** The container needs `(finished || stopped)`; the control itself needs
**`finished`**. So on an idea whose most recent build **stopped** — which is Charlie's idea right
now, v7 having hit the ceiling — **the control is not on screen at all.**

**So 25-O §2 was not built against a false premise:** the control exists, and it did point at
`/ideas/[id]`, the team view. §2 stands and the repoint is correct. What §A3 usefully establishes
is that it is **not where one would assume** — it is on Stage 1, not on the strategy surface where
Charlie spends his time, and it disappears whenever the last build did not finish. **If you want it
on `/ideas/create`, or visible after a stopped build, say so — neither is built.**

---

## Addendum checks

`check:lex-25o` — **56 passed, 0 failed, 14 controls, all 14 fired** (up from 44/11).
`verify:write-paths` — **13 passed, 0 failed** against the live database.
Whole suite re-run: **every check green**, including the three §0 named as must-not-disturb — the
divider fix, the toggling headings and the report running header are untouched and still pass.

⚠ **What is still unproven:** the collapse (§A2) and the fix (§A1) have not been walked in a
browser. The round trip is proven at the assembler; **the click itself is not.**
