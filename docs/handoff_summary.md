# SCRUTINISE — HANDOFF SUMMARY

*Read this first every session. Top section is authoritative.*

*Last updated: 2026-09-01 11:45 UTC — ▼ **25-Q ADDENDUM — BUILD TIME MEASURED, NOTHING
CHANGED.** ⚠⚠ **The commentary pass is 25.4s, 3.6% of v8 — it did NOT consume the headroom.** What
changed is that **v8 is the first build ever to run all eleven passes** (previous completed runs did
7, 8 and 10). **Three slowest: SMART 285.5s (40%), RESEARCH 244.5s (34%), ORIENT 34.6s (5%)** — the
first two are 74% of the build; the other nine total 183.4s.
▶▶ **THE CEILING HAS NEVER BEEN REACHED BY WORK.** The gap is ONE STALL per build, not spread
overhead: v7 waited **368.6s before SMART** and is the only build the clock has stopped (its passes
did 519.3s; without the stall it finishes ~553s); v6 waited **595.4s for its first pass** and hit 94%
on 245.4s of work. v8 did twice v6's work and finished lower.
▶ **RECOMMENDATION: raise neither.** A ceiling raised to accommodate a stall is a stall you stop
noticing — the exposure is **worker pickup**, already measurable in the pass log. ⚠ **And
`PASS_BUDGET_MS` (240s) binds on ONE pass in eleven** (research only, between questions; `build.ts`
merely logs it) — **SMART is unbudgeted** and has run 285.5s; the only backstop is the 360s stuck
threshold. ⚠ Sample is 7 builds, 1 complete, one idea: 85% is ONE OBSERVATION, not a rate.
`npm run measure:pass-time`. Earlier: 2026-09-01 11:11 UTC — ▼ **LEX 25-Q: LEX CAN WRITE TO THE MIDDLE PANEL, AND
FIVE OF THE BRIEF’S EIGHT SECTIONS WERE ALREADY BUILT.**
⚠⚠ **§1a — THE CHAT WAS NEVER READ-ONLY; IT COULD NOT REACH THE FIELDS THE PANEL RENDERS.**
`validateProposal` has no schema for `policyOptions` / `chosenApproach` / `actions`, so a rewrite
of a candidate guiding policy returned `null` and was **dropped with no sign at all** — and even a
successful `setProposal` writes `IdeaFieldState.proposal`, which a loop field does not render.
Measured on Charlie’s own idea: `currentField` IS `policyOptions`.
▶▶ **LEX NOW OFFERS AND ONLY A CLICK WRITES.** `/lex` computes the offer and writes nothing;
`/field-edit` writes and computes nothing — **a model cannot reach it, because a model does not
have a mouse.** Addressed by 25-P’s stable numbers; ambiguity refused, never guessed. ⚠ The
superseded wording is kept in `FieldRevision` (a TABLE, not a column — a column loses the version
before last) with WHO wrote it, and rendered.
⚠⚠ **§7 — EVERY COVERAGE CHALLENGE WAS HEADED BY ELEVEN CAPITALISED WORDS OF ITS OWN
PROVENANCE** (*“ANOTHER MODEL MADE THIS POINT AND OUR PROPOSAL DOES NOT ADDRESS IT — ”*), with the
model named mid-sentence. Now a `title` and a `sourceModel` at the foot; **36 rows backfilled**,
a third of which carried the attribution twice. Titles are NOT backfilled — the producer tags.
▶▶ **FIVE PREMISES OVERTURNED, FOUR BECAUSE 25-N ALREADY FIXED IT:** §2a (banner verified live
against v8 mid-run), §4a (openable since §1f — and **downloadable cannot be built without storing
the binary**, which §25.6 deliberately does not), §8a, §8c. §2c **measured: first paint 46 ms**, so
“Building reports” would be false.
⚠ **§2b FOUND A REAL DEFECT IN 25-N’S OWN BANNER:** on the build page its finished control linked
to the page the user was already on. Now surface-aware.
▶ §3 Stage 1 gets an Ask-Lex/Notes pair that **answers and does not conduct** (`mode: 'ASK'`,
enforced by the route); re-run + add-a-file + a new “anything else” box **moved to the top**.
§6 gives Lex eight operating facts from **the same array the tour renders**. §5 says which of two
things “characters kept” means.
✅ `check:lex-25q` **50/0, 10 controls, 0 dead**; `check:lex-25p` 72/0/24; whole suite green.
⚠⚠ **THE CHECKS CAUGHT THREE THINGS IN MY OWN WORK:** a round trip that re-implemented the route’s
transaction (CLAUDE.md §25.3, added last sprint by this same thread); two prompt blocks inserted
between `sourceValuesBlock` and `fieldBlock`, which are adjacent on purpose; and `check:lex-25p`’s
own `findFirst` picking a REJECTED row once the live build wrote new ones.
⚠ **UNPROVEN WITHOUT A BROWSER (§10):** the rewrite round trip on a real model call; the banner
during a real run; a file opened on a real upload; the Stage-1 Ask box; the re-ordered Stage 1 page;
and whether the coverage check’s new titles are titles. `docs/LEX_25Q_REPORT.md`.**
Earlier: 2026-09-01 02:49 UTC — ▼ **LEX 25-P: THE GUIDING POLICY BECAME A DECISION — AND
315 OF 501 EVIDENCE ROWS TURN OUT TO BE FIVE OR MORE YEARS OLD WITH NONE OF THEM SAYING SO.**
⚠⚠ **§2 — `EvidenceItem` HAD NO DATE COLUMN AT ALL**, which is why 25-O §6's framing as a content
problem was wrong: no prompt instruction can work against a missing column. Added `sourceDate` +
`sourceDateBasis` (Neon `ep-old-dust-aboxi69a`), wired into **all twelve** `evidenceItem.create`
sites at write time **from the corpus row and never from a model**, and backfilled:
**404 of 501 dated (368 corpus record, 36 recovered from the URL), 97 undated — of which 77 have
no source row at all.** A reasoning step Lex wrote is not an undated document and the two are kept
apart. Rows now read *"From 2011-09-22, 14 years old. Check the figures against current ones before
relying on them."* ⚠ **An undated row is NEVER `CURRENT`** — that substitution is the original
defect in one line. Also: no figures → labelled an assertion, not evidence; a claim that changed
Lex's position names what it was weighed against **or says nothing was**.
▶ **§1 — the guiding-policy screen.** Stable numbers that never move (a rejected 7 leaves a gap;
restore returns the original number with the old reason kept as history); a sort into policies /
actions / restated goals with reasons shown; an action **offered**, never moved, and **parked with
the policy it implements** so it follows that policy's fate; merge-by-number → four verdicts, only
`MERGE` writes, parents superseded not deleted; two ratings never combined, each `REASONED /
RETRIEVED / NOT_FOUND`; two rounds then an offer to proceed unresolved with a reason required.
⚠⚠ **§1.5 RESTED ON A LINK NOTHING HAD EVER WRITTEN — `targetCauseIds` was set on ZERO of 18
rows.** The sort assigns it now, labelled as Lex's judgement rather than as a structural fact.
⚠ **§1.11 — a targeted edit is safe here STRUCTURALLY:** state lives in individually-addressable
rows, and the one single-value overwrite (`policyOptions`) is **re-derived from every live row**
after each mutation by `syncPolicyField`, its only writer.
▶▶ **§3 — THE JOIN-BLIND CHECK CLASS, ENUMERATED BEFORE ANYTHING WAS CHANGED. `npm run
audit:join-blind`: 876 of 1,060 assertions (83%) cannot see a lookup that misses** — 483 in checks
that read no system output at all, 393 source-shaped inside checks that read some. A shape count,
not a defect count. ⚠ The audit **declares its own blind spot**: nine checks assert in a style it
cannot count and are excluded from every total rather than reported as zero. **Now CLAUDE.md §25.**
⚠⚠ **The class bit twice mid-sprint: two `check-sprint3e-ui` assertions were RED BECAUSE THE CODE
GOT BETTER** — they asserted the literal `deletedAt: null` that 25-O §4b replaced with the
`LIVE_IDEA` predicate. A source assertion cannot tell "the filter is gone" from "the filter moved".
▶ §1.8 — the chain-link renders in **both** documents, from one shared function, under the policy
it qualifies. §4a — the allowance now reads *"4 full builds, or 3 full builds and 3 re-runs, or 12
re-runs"* and names the prices. §4b — "What to do next" counts what is **blocked on you** (2), with
the total one line lower, inside. §5 — the free pass on a resumed historic build is **recorded with
its reason and announced on screen**; ⚠ and the resume copy's hardcoded *"the eight passes already
done"* was a literal copied from build v7, so **every other stopped build was told a number that
was not its own.**
⚠⚠ **ONE ACCEPTANCE CRITERION WAS HALF BUILT (`753ee13`): accepting an implied cause added the
row and did NOT mark the causes section changed**, leaving the field claiming the user had agreed
to a diagnosis that had since grown by one. ⚠ And my first assertion of it would have passed
without the fix — it counted `source: 'USER'` rows, and USER is that column's DEFAULT.
✅ `check:lex-25p` **72/0, 24 controls, 0 dead** — every §1.12 assertion runs the route's own
`writeSort` / `writeMerge` / `applyPolicyOp` against a scratch idea it creates and deletes, then
reads back what the screen and the documents show. ⚠ **It failed 3 of its own assertions with 3
dead controls on its first run**, which is the only evidence it can fail. `lex-25n` 98/0, `lex-25o`
56/0, `lex-25d` 77/0, `sprint3e-ui`, `scripts` and `npm run build` all clean.
⚠ **UNPROVEN WITHOUT A BROWSER (§7):** the guiding-policy screen end to end on a real idea with a
real model call; "Add to report" on a fresh item since the fix; the resumed v7 build and its
commentary prose; whether 315 rows saying "check the figures" reads as useful or as noise; the new
allowance sentence and the split "what to do next" count in place. `docs/LEX_25P_REPORT.md`.**
Earlier: 
2026-08-31 14:44 UTC — ▼ **25-O ADDENDUM: "ADD TO REPORT" WROTE THE ROW; THE
PANEL READ THE WRONG KEY — AND IT SURVIVED TWO SPRINTS BECAUSE IT WORKED IN THE DOCUMENT.**
⚠⚠ Three `IdeaSourceDecision` PRIORITY rows exist on Charlie's idea, **two stamped 13:51 on 31
Aug — his own clicks** — every one matching an `EvidenceItem.id`, **none matching any `sourceId`**.
The exclusion read tried `[e.sourceId, e.id]`; the priority read tried `e.sourceId` alone; the
write sends `entry.id`. Eleven lines apart, and they could never match. ⚠⚠ **`proposal-snapshot.ts`
builds `prioritySources` STRAIGHT off the decision rows and never joins — so the feature genuinely
worked in the generated document and nowhere on screen.** 25-N's `ReportAdditions` did not break
it; it made it visible. ⚠ All three prioritised findings share ONE `sourceId`, so storing
`sourceId` instead would have made one click prioritise every finding from that source — the row's
own id is right. One shared `decisionKey()` now serves both reads.
▶ **`verify:write-paths` (new): the round trip end to end** — click, row exists, row RENDERS
through the real assembler, survives a second assembly, a control that stays false, a cleanup read
back. ⚠⚠ **THE CHECK THAT COULD HAVE CAUGHT IT DID NOT EXIST:** `check:lex-25n` asserted the
filter and the button label, both true, for a feature that rendered nothing. **A source assertion
cannot see a join that misses.** ▶ And Notes + worklist ticks are now DEMONSTRATED rather than
assumed (13/0), with the control that matters: a note is invisible to another user on the idea.
▶ **§A2 — DRAFT STRATEGY's supporting sections are CLOSED by default** in the kernel's own
`show +` / `hide −` vocabulary; count and hint readable while shut; empty renders nothing.
▶ **§A3 — "See it as others would" renders in ONE place: Stage 1 (`/ideas/build`), NOT on
`/ideas/create`** — and it is gated on `finished`, so on an idea whose last build STOPPED it is
not on screen at all. 25-O §2 was not built on a false premise. **Neither "put it on
/ideas/create" nor "show it after a stopped build" is built.**
✅ `check:lex-25o` **56/0, 14 controls all fired** (was 44/11); `verify:write-paths` 13/0 live;
whole suite green; the three §0 must-not-disturb items untouched.
✅✅ **WALKED LIVE (`181702e`) — CHARLIE'S OWN CLICK IS NOW ON SCREEN**, with no new write:
DRAFT STRATEGY shows "What you have put in the report · 3", holding his three findings under the
two headings that travelled with them, with three "Remove from report" buttons; THE RESEARCH reads
"3 items are in your report". ⚠ Secondary confirmation: the worklist's **Things to read went
0 of 3 → 0 of 6**. ▶ §A2 confirmed — both sections collapsed with counts and hints.
⚠⚠ **I REPORTED THE TOGGLE AS UNRESPONSIVE THREE TIMES BEFORE TESTING IT PROPERLY AND I WAS
WRONG** — a real `.click()` flips `aria-expanded`. The clicks were landing on the NAV because the
screenshot came back SCALED (1512→1375) and coordinates read off it do not map to the viewport.
**A coordinate from a scaled screenshot is not a viewport coordinate.**
⚠ "What to do next · 136" is accurate (2 decisions + 135 challenges) but reads as a wall. Not changed.
⚠ **Still unproven: pressing "Add to report" on a FRESH item in a browser.**
`docs/LEX_25O_REPORT.md`.**
Earlier: 2026-08-31 14:04 UTC — ▼ **LEX 25-O: `/ideas/build` IS NOT A TESTING SURFACE —
IT IS STAGE 1 *AND* THE LIVE NEW-IDEA DOOR, MEASURED. §3 NOT DONE, AND IT IS CHARLIE'S CALL.**
Built §1, §2, §4, §5; §7 measured and deliberately unchanged; §6 diagnosed, not built.
⚠⚠ **`PlatformConfig.newIdeaDoor` READS `"build"` IN PRODUCTION.** Every new idea starts there
today, AND it is `stageHref('idea')` — "1 · The Idea", verified live in 25-N. `/ideas/create` is
stages 2–3 ONLY, and `/ideas/build` is the only page rendering `BuildProgress`, the re-run and
**the resume control §1d of the same brief requires.** Redirecting the whole route sends new pilot
users through the OLD chat elicitation and deletes Stage 1; redirecting the bare route breaks
25-E §2's resume-rather-than-mint, built to recover **2,934 characters of Charlie's own writing**.
▶ **§3's premise about the probes is INVERTED (good news):** eleven checks + two harnesses read the
SOURCE FILE, not the URL — a redirect blinds NONE. Only `check:lex-25j`/`verify:my-ideas-ui` and
⚠ **`verify:lex-25e-live` §2 (no home on `/ideas/create` at all)** depend on the route. **Three
options in the report.**
⚠⚠ **§1's STATED SYMPTOM DOES NOT EXIST.** Nothing in the pass path has ever read the allowance.
The real defect: **the check was priced against the mode ASKED FOR and `reuseFrom` decides what
RUNS** — a REUSE with nothing to reuse is downgraded to FULL, so **one third could buy a
three-third build**. Now checked AFTER that decision, from the same expression the row is written
with. ▶ And reserve-don't-check fixes a real race: spend counted only DONE builds, so **two builds
in the same window both passed and one was unpaid.** ▶ **The release is STRUCTURAL — no write, so
no path can miss it** — plus an expiry for a row stuck at RUNNING. ▶ 12 thirds from config; ⚠
"explicitly granted" reads off the NOTE, because the column defaults to 4.
⚠ **§1d IS A RENDER ASSERTION. A LIVE RESUME HAS STILL NEVER BEEN RUN.**
⚠⚠ **§7 SAYS DO NOT OPTIMISE.** `/panel` 24–28ms, duplicate 28ms, `/agenda` ~100ms each, **`/build`
324ms and NOT a duplicate.** Whole first paint = **579ms server**; duplicates 21.9%, in parallel
with the slowest call → **saves requests, not seconds.** 579ms cannot produce 25-N's "several
seconds": the rest is network, cold start, Clerk. **Nothing changed.**
⚠⚠ **§6: `EvidenceItem` HAS NO DATE COLUMN AT ALL.** The 2014 claim came from a Lords debate of
16 Jan 2014, written by RESEARCH under two interrogation questions as CONTRADICTS, fed to REVISE.
The date is in the URL and the corpus row and **there is nowhere to put it** — so no prompt fix
can work. Four ordered steps in the report.
▶ **§5 — the commentary is the ONLY pass that reads the causes as a SET**, which is why the output
was ever a list. Runs after REVISE, before the verifiers. ⚠ Contrary evidence is STRUCTURED;
⚠⚠ **"no conflict" needs a REASON** — §5 read literally would require inventing one. ⚠ **COST
~2–4p ESTIMATED on a ~23p baseline; NO BUILD HAS RUN IT.** Eleven passes now; v7 hit the 900s stop
at 922s with ten.
▶ **§4 — THE LIST IS PRINTED AND NOTHING OF THEIRS IS HIDDEN.** 6 ideas, 3 testers, all builds=0.
⚠ `charlie@whatmusic.com` / `charlieleach1@gmail.com` NOT included and NOT guessed. ⚠⚠ Mechanism
**PROVEN LIVE on one of Charlie's own empty rows and restored in the same session** — re-read,
zero-lists, and **a control that must still be visible**. One command in the report when he says.
✅ `check:lex-25o` 44/0, 11 controls all fired. ⚠ **Three guards repointed, not relaxed** — two were
EXACT-LIST assertions right only by accident. Whole suite run: 25-c 32 … 25-n 98, **25-o 44**,
build-25a 40, build-25b 54, 20bd 47, statutory 17, corpus-types 156; harnesses all executed.
📦 `prisma/lex_25o.sql` applied to Neon (host checked). ⚠ Its partial index is on the §21 register.
`lex_25n_backfill_against.sql` still unrun and must run AFTER §4.
✅✅ **VERIFIED LIVE, production, signed in** — §20 checks 3+4. §2's line verbatim off
`/ideas/452c5ade…/public` with its empty state firing on real data; and on build v7: **"This did
not use any of your allowance. The 3 thirds it was holding have come back to you."**, **"This
build did not finish"** + the 922s reason, **the resume control rendering**, **"You have 4 builds
left."**
⚠⚠ **THE WALK FOUND A CONSEQUENCE I SHOULD HAVE ANTICIPATED: v7 now reads "8 of 11 passes" and
resumes from "Describing the terrain".** `readPassLog` reconciles a stored log against the CURRENT
pass array, so inserting `CAUSES_COMMENTARY` changed what a historic build says about itself and
made it the resume point for every build that stopped earlier. `check:build-25b`'s own comment
warned of this and I bumped the literal without tracing it. **Not harmful** (the count is true; a
resume runs the commentary, skips the DONE passes, and finishes LOGIC_CHECK + ADVERSARIAL) but a
resumed historic build gets an **unbilled** pass. ⚠ And **"4 builds left" under-describes §1c** —
12 thirds IS four builds, but the intent was 3 + 3 re-runs.
⚠ **BIGGEST UNKNOWN: THE COMMENTARY HAS NEVER BEEN GENERATED.** One full build settles it —
**and v7's resume is now the cheapest way to get one.**
`docs/LEX_25O_REPORT.md`.**
Earlier: 2026-08-31 10:17 UTC — ▼ **LEX 25-N: THE BUILD THAT "STOPPED WITH NO
RE-START" WAS WORKING CORRECTLY, AND `resumable` WAS IN THE PAYLOAD RENDERED BY NOTHING.**
§1–§5 and §11 built; §6–§8 designed and reported; §9–§10 reported.
⚠⚠ **BUILD v7 OF `452c5ade`, 30 Aug 11:14–11:30 UTC, DIAGNOSED FROM THE ROW:** 8 of 10 passes
DONE, LOGIC_CHECK and ADVERSARIAL NOT_REACHED, stopped at **922s against the 900s hard stop,
between passes** — the ceiling doing its job. **FOUR things then made it invisible and
irreversible.** (1) `stopBuild` rewrites remaining passes to `NOT_REACHED` and `nextPassKey` only
ever returns PENDING or RUNNING, so **`isResumable` was FALSE BY CONSTRUCTION for every build that
has ever hit a ceiling**. (2) ⚠⚠ **`resumable` was in `BuildView` and RENDERED BY NOTHING** —
`grep -rn resumable` returned the producer, the type, two checks and two fixtures, no component;
there has never been a resume control on any screen. (3) The clock made a resume impossible even
with a button — `checkStop` measured from `startedAt`, so a build 922s over a 900s ceiling stops
again *before its first resumed pass*, for ever; now `resumedAt ?? startedAt`, and **the SPEND
ceiling is deliberately NOT reset**. (4) `claimQueuedBuild` stamped `startedAt` unconditionally.
▶ A partial build now names **which passes did not run**, says **the summary is missing**
(`composeSummary` runs only in `finishBuild`, so every stopped build has a NULL `summaryMessage`),
and offers **"Carry on from 'Logic check'"** — no new `IdeaBuild` row, so **no allowance spent**,
bounded at `MAX_RESUMES = 3`.
⚠⚠ **"PANELS RESIZE THEMSELVES AND CANNOT BE RESTORED" IS ONE CSS TOKEN.** `Nfr` is
`minmax(auto, Nfr)`; the automatic minimum lets a long citation or an unbreakable
legislation.gov.uk URL — exactly what appears when you click a research item — **widen that column
past the fraction the user set**. Nothing in our code moved and the stored layout was untouched,
**which is why nothing put it back**. Now `minmax(0, …)` in both templates plus `min-w-0` on the
panel bodies.
⚠⚠ **"SECTIONS CANNOT BE CLOSED" WAS CAUSED BY "WORK ON THIS":** `collapsible = complete ||
visited`, and pressing it makes a section **active** — neither — so the heading stopped being a
toggle at the exact moment the user chose to open it. Decisions and "Where the research changed my
mind" had **no toggle at all**.
⚠ **THE ALLOWANCE WAS BUILT AND WIRED INTO ONE PLACE** — the re-run dialogue, not "Build it".
⚠⚠ **"CLICKING A CONTENTS ITEM SHOWS NEIGHBOURING SECTIONS TOO" — THE LIST WAS NEVER AT FAULT.**
`QuestionPanel` renders one item correctly; `BackgroundPanel` went on rendering the type fold, the
stage search, the exports and the page-one cards underneath it. **The library sat on top of a
scroll.** Fixed by §4's own Inputs group.
⚠⚠ **DELETING "THE STRONGEST CASE AGAINST" FOUND THREE REAL DEFECTS, TWO BY A CHECK.** The heading
goes, the KEY stays (every adversarial row is tagged `AGAINST`; removing it from the union would
turn them all into "not filed" — the material §4 is trying to KEEP). Redirect `AGAINST → ARGUED`
via `liveHeading()`. **(1)** `deepening-config.ts` still declared `heading: 'AGAINST'` on
POLITICAL_RISK — a SECOND producer — caught by `check:lex-25l`. **(2)** The evidence pack tested
`QUESTION_HEADINGS.some(...)` directly, so those rows fell into "not filed", **where the pack tells
the reader their question was never recorded** — caught by `check:lex-25d`. **(3)** The public
proposal page did the same. *A redirect applied in two of three places puts the same finding under
two headings.*
⚠⚠ **§5d WAS A PAGE LOAD:** `readProposalExportStatus` called `buildProposalSnapshot` on every GET
— the whole twelve-table assembler — to hash it for staleness. **Five seconds for "is this
current?" before the file's NAME appeared.** `?quick=1`; staleness comes back `null`, **a third
state rendered as "Checking…", never as current**.
⚠ **§1f: the file itself has never been stored** (§25.6 = text, no binary), so "open what you
uploaded" shows **the text Lex read**, saying which it is. *"9 findings · 87k characters kept"* →
**"Lex read this and took 9 findings from it."**
⚠ **§3e's mobile clickability had a cause:** the rows were `#anchor` links, and on a phone the
anchor is **inside a tab that is not on screen**. Real checkboxes now, or links to ROUTES.
⚠ **NOTES: privacy is the KEY, not a flag** — no `visibility` column, every query `(ideaId,
userId)`. ⚠ **`IdeaNote` carries a PARTIAL unique index prisma cannot express**
(`WHERE source <> 'USER'`); the obvious `@@unique` would let a user have exactly ONE note.
CLAUDE.md §21 register.
✅ `check:lex-25n` **98 passed, 0 failed, 18 controls, all 18 fired.** ⚠⚠ **Four of my own
assertions failed against correct code** — every "must NOT appear" test was reading the ⚠ comment
that EXPLAINS the deletion and quotes the deleted string; there is now a `code()` reader that
strips comments. ⚠ **Three controls did not fire**, all the same inversion.
✅ Whole suite RUN (§23.2): 25-c 32, 25-d 77, 25-e 28, 25-f 62, 25-g 27, 25-h 20, 25-i 14, 25-j 12,
25-k 18, 25-l 19, 25-m 12, **25-n 98**, build-25a 40, build-25b 54, 20bd 47, statutory 17,
documents pass, corpus-types 156; harnesses 25g-ui 14, 25e-ui 16, my-ideas-ui 15, stages-ui 23,
outputs-ui 7, build-25a-ui 43. ⚠ **Seven guards from three sprints repointed, not relaxed.**
`tsc`, `check:scripts`, `next build`, `check-clean-build --fast`, `prisma validate` clean.
📦 **Applied to Neon** (`ep-old-dust-aboxi69a`, host checked first): `lex_25n.sql`,
`lex_25n_notes.sql`, `lex_25n_worklist.sql`. ⚠ **`lex_25n_backfill_against.sql` NOT RUN —
Charlie's**; the panel is already correct without it.
✅✅ **VERIFIED LIVE, production, signed in** — §20 checks 3+4 satisfied and NOT by the SHA
alone. Read back off the running site: WORKING AREA · DRAFT STRATEGY · THE RESEARCH, "Hide this
Panel", THE RESEARCH's sentence verbatim, "8 of 8 approved", **`hide −` on the ACTIVE section**
(the exact case "Work on this" locked), "Challenges 135 · hide −", both §3d texts verbatim, the
Lex/Notes tabs, ReportAdditions in the middle column, **all four worklist parts with real counts
("Decisions to make 2 of 4 done" with nothing ticked = the server ticking two resolved forks)**,
and the contents in §4's order Decisions → Outputs → Cost and duration → Inputs. ⚠ **Control fired
live too:** no "The strongest case against" in the accessibility tree, while every neighbour is
there. All six API reads 200 incl. the two new routes.
⚠⚠ **THE WALK FOUND WHAT NO HARNESS COULD: `/panel` IS FETCHED TWICE** (I added the second caller
in `ReportAdditions`), and `/agenda` twice (pre-existing) — three heavy reads on one paint,
several seconds pending on a real idea. **NOT FIXED**; new finding, wants measuring first. Fix is
§5d's shape: hoist the read or project it.
⚠ **Still needs Charlie's browser:** that the panels stop re-proportioning; **a live resume, never
run** (two passes' spend); the three new WRITE paths; the .docx header in Word; mobile in a hand.
⚠⚠ **CHARLIE — ONE QUESTION RECORDED, NOT RESOLVED:** should notes be visible to the idea-team?
Three options in `docs/LEX_25N_REPORT.md` §3c, with a recommendation. **Say which.**
`docs/LEX_25N_REPORT.md`.**
Earlier: 2026-08-30 12:06 UTC — ▼ **B8 + B9 DONE. THE FIRST IDENTIFICATION METRIC I WROTE PUT
THE TWO CLASSES IN THE WRONG ORDER, AND THE CRAG VOCABULARY IS ABSENT FROM ALL EIGHT THESIS VIDEOS.**
⚠⚠ **B8 step 1 was needed in THREE places, not one.** The seven .docx were untracked but not ignored;
the next `git add` would have committed full lecture transcripts to a GitHub-backed repo. They exist
in TWO directories — `sources/youtube/` and `report_run/` root — and a directory `.gitignore` does
not reach the level above it. A second CC session had covered `report_run/`; I covered
`sources/youtube/`. ⚠ **`_docx_extract/` was in the same position and nearly missed** — text
extracted FROM those documents, covered by nothing. Now ignored. All confirmed with
`git check-ignore -v` against real paths, never the pattern. `starkey_hits.json` ignored BEFORE it
was written.
⚠⚠ **MY FIRST METRIC SCORED THE SCRAPED DOCUMENTS 0.61–0.81 AND THE INDEPENDENT ONES 0.90–0.94 — the
classes separated in the OPPOSITE direction**, which would have loaded four copies of the ASR as
second sources and skipped the three real ones. Cause: the normaliser kept digits and the three tools
stamp times in three notations (`(1:36)`, `[00:02]`, bare `00:00:02.240`); only TurboScribe's was
stripped. **It was measuring which notation the tool used, not the words.** After stripping all
three: **independent 0.899–0.943, scraped 0.993–0.996, gap 0.050, no overlap. B8's verdicts confirmed.**
▶ Parts 1–3 are genuine TurboScribe and are LOADED (302 / 229 / 289 cues, all ≥99.9% coverage).
Parts 4–6 and the Full lecture are scraped copies of the ASR and are deliberately NOT loaded —
a single-sourced passage that looks double-sourced stops a human checking.
⚠ **Both "mislabelled URL" cases are sharper than B8 reported: visible URL and embedded hyperlink
disagree** (P4 shows Part 3's id, links Part 4's; the lecture shows Part 6's, links the lecture's).
⚠⚠ **A SECOND PARSER DEFECT, found by a check that was meant to be a formality** — Part 1's docx vs
the already-loaded copy came back DIFFERS on 288 of 289 cues. Not a different transcript:
`parseVtt` was swallowing the next cue's SRT sequence number onto the end of each cue's text. Fixed →
IDENTICAL. A third fix beside it: rolling carry-over de-duplication is WRONG for SRT and is now gated
on the inline word-timing tags only rolling files carry. Full reload confirmed a no-op: 179,561 + 531.
▶ Corpus now **287 transcripts, 180,092 cues, 1,176,129 words**.
▶▶ **B9: NOT ONE CRAG HIT IN ANY OF THE EIGHT THESIS VIDEOS** — `treaty` 0, `ratification` 0,
`royal prerogative` 0, `parliamentary scrutiny` 0. Dense elsewhere — **distinct moments, phrase
matched, de-duplicated across transcripts**: `constitution` 17, `restoration` 9, `sovereignty` 6
(three in Part 3), `repeal` 6, `equality` 5. 87 hits in `docs/report_run/starkey_hits.json`.
⚠⚠ **THE FIRST PUBLISHED VERSION OF THAT ROW WAS INFLATED BY TWO INDEPENDENT MECHANISMS, both found
by the second CC session's questions rather than by my own checks.** It read `constitution` 26,
`restoration` 12, `sovereignty` 10 (six in Part 3), `constitutional reform` 9.
⚠⚠ **(1) `plainto_tsquery` on a multi-word term is an AND of lexemes anywhere in the same 60–90s
passage, NOT a phrase.** `constitutional reform` = 9 co-occurrences, **0 uses of the phrase**;
corpus-wide 74 → 9, 88% looser. The peer found a worse one in B10: **`civil service commission` has
7 hits and is NEVER UTTERED** — verified here three ways (phrase 0, ILIKE cue 0, ILIKE passage 0).
⚠⚠ **(2) THE TABLE DOUBLE-COUNTED THE THREE VIDEOS WITH TWO TRANSCRIPTS.** Parts 1–3 store every
minute twice, so one thing said once matched twice — **and the inflation fell entirely on the three
videos that already have a second transcript and need no credit**, which is the worst possible bias
for a table whose only job is choosing where the next credit goes. The tell was in the published
numbers: nearly every count for those three was EVEN. Found via a peer claim of "Equality Act 0"
that was itself wrong (there is one, in Part 2) — both numbers wrong, the disagreement exposed it.
⚠⚠ **AND MY FIRST FIX WAS WRONG THE OTHER WAY, caught before publishing by reading rows not totals.**
Merging overlapping intervals CHAINS across interleaved source boundaries — `constitution` in
`8veLovq5NWQ` is 5 per transcript and merged to **2**, a 2.5× undercount replacing a 2× overcount.
Now **max-over-sources**: cannot chain, equals what a single-transcript video reports, declared as a
FLOOR — and the floor direction is safe for this decision.
⚠ **The stopword worry that started all this did NOT apply** — all 22 B9 terms lex non-empty, with a
`we should` control proving the check can see the empty case. **Every CRAG zero holds on every
reading**; a zero surviving the LOOSER query is the stronger result.
⚠⚠ **(3) A PHRASE MATCH IS ADJACENT *STEMS*, NOT LITERAL WORDS — and here that SAVED a finding the
peer tried to delete.** They challenged `equality act` = 1 with a decisive-looking test (every cue
containing the bare word "equality": exactly one, the DEI phrase in the lecture). **The passage
actually says *"the human rights act, the equalities act"*** — Starkey names the measure as the
**Equalities** Act. My 1 stands; their 0 is wrong, and their test could not have found it because
"equality" cannot see "equalities". `phraseto_tsquery('equality act')` is `'equal' <-> 'act'`, which
those stems satisfy.
⚠⚠ **CONSEQUENCE FOR QUOTE VERIFICATION: `phrase_match: true` does NOT license quoting the term's
own wording.** Someone could write "the Equality Act" over audio saying "the Equalities Act". Every
hit now carries **`literal_match`** beside `phrase_match` — 77 phrase matches, **11 of them not
literal**.
⚠ **And the bare term `equality` is not measuring equality**: stem `equal` covers "equally". Of its
5 moments, **three are the adverb**, one is DEI, one is the Equalities Act. A term chosen for a
subject was counting a function word.
⚠⚠ **(4) EVERY DEEP LINK IN THE EXPORT OPENED UP TO 72 SECONDS BEFORE THE WORDS.** `watch_url` is
anchored to the PASSAGE start, and a passage runs 60–90s. Measured across all 77 phrase matches:
**the words sit 0–72s after it, median 25s** — the difference between landing on a quote and hunting
for it, paid every time the file is used. Every hit now carries **`match_start_s` / `match_url`**,
located by testing each cue **concatenated with the next**, because a phrase can straddle the
boundary and this one does (`"...the equalities"` / `"Act."`). Located for 77 of 87; the 10
co-occurrence-only hits have no phrase position by definition. ⚠ Surfaced only because the peer and
I cited the same moment with two different numbers (their 3:43, my 5:05 — the answer is **5:17**).
▶ B9 now prints corpus AND, corpus phrase and per-video distinct moments, flags any term where they
disagree, and stamps each exported hit with `phrase_match`, `literal_match` and `match_url`: **77
phrase, 10 co-occurrence only — do not quote the 10 as instances of the phrase.** ▶ **One term is
WHOLLY variant-only: `equality act`, 0 literal of 2 — the statute is only ever named as "the
Equalities Act".**
⚠⚠ **`ratification` is zero CORPUS-WIDE and that is vocabulary, not subject** — `ratify`/`ratified`
appear 6 times each. **Every zero is now re-asked with ILIKE against raw text before it can be
published as a gap**; an index miss and a real absence look identical in a table.
▶ Second-engine divergence at the brief's 0.95 line: P1 9/10, P2 10/11, P3 5/8 — ⚠ but similarity
never drops below 0.882 and medians are 0.916–0.935; most of the gap is ASR filler ("um", "uh") that
TurboScribe drops. Read the distribution, not the count.
▶ B7's `2Khgz5sMMBU` flag re-tested from the other direction and HOLDS — 0 of its 5 hits start after
20:20, with a control confirming the time filter can see late passages (21 in the lecture).
▶ **Raw corpus backed up: `r2://scrutinise-legislation/research/starkey/`, 857 objects**, every key
verified by size read-back plus an absent-control key. The .docx are NOT in the R2 copy.
✅ `tsc` clean on every file B8/B9 touched; repo's 8 pre-existing errors unchanged.
**B5 STILL NOT STARTED** — `register_proposals.json` still absent. B10/B11 appeared mid-run and are
NOT mine; a second CC session has them and was told so rather than raced.
Earlier: 2026-08-30 10:05 UTC — ▼ **B7 DONE — THE STARKEY CORPUS IS BUILT AND SEARCHABLE, AND
THE SECOND TRANSCRIPT CAUGHT THE ASR NAMING THE WRONG MAN ON THE FIRST VIDEO LOADED.**
285 videos, 128.4 hours, **1,172,546 words**, 179,561 cues, 6,138 passages in the Neon `starkey`
schema (production app DB `ep-old-dust-aboxi69a`, own schema, deliberately NOT in `schema.prisma`).
Raw files under `docs/report_run/sources/youtube/`, **git-ignored** (314 MB, and the brief says do
not expose the corpus). Full account: `docs/report_run/sources/youtube/_README.md`.
▶▶ **ZERO FETCH FAILURES — all 285 of CCW's hand-transcribed IDs resolved**, so nothing in the list
was mistyped.
▶▶ **THE SIX THESIS VIDEOS ARE IDENTIFIED**: `soNnF0sjF5Y` P1, `jnsiLNNL8s8` P2, `8veLovq5NWQ` P3,
`okJNAMPBRqg` P4, `q1Mto3BxMcA` P5, `Mwf_SwRa2F0` P6 (Q&A), uploaded 2–6 Dec 2025.
⚠ **TWO MORE VIDEOS CARRY "THESIS" AND ARE NOT IN THE SIX** — `EMbRv6aaQrs` (2025-09-21, **46m23s**,
the full lecture, ten weeks EARLIER and longer than any part) and `2Khgz5sMMBU` (32m50s, the Q&A
interview). Treating the six as the whole thesis misses the lecture.
▶▶ **THE ERROR DETECTOR PAID FOR ITSELF IMMEDIATELY**: at 5:01 of Part 1 the ASR says
*"But **Israeli** in the wake of that"*; TurboScribe says *"But **Disraeli**"*. A quote lifted from
the ASR alone would have printed the wrong man. No comparison tool built (brief says not to).
⚠⚠ **`2Khgz5sMMBU`'s ASR STOPS AT 20:20 OF A 32:50 VIDEO — 62.9% COVERAGE.** The last 12½ minutes
are not in the corpus and cannot be searched. **The brief's own "<200 words" check PASSES this
video** — 20 minutes of speech is not thin, and only `max(end_s)` vs `duration_s` can see it. That
coverage check was added and is the only check in the sweep that found anything (median 100.0%).
YouTube's gap, not ours: confirmed by the stored VTT and an independent json3 re-fetch.
⚠ **`LsGrhLDcz9Q`** (21m34s) has **no caption track of any kind** — in `starkey.video` with no
transcript row, so the corpus says "no words" rather than omitting it. 283 of 285 are ASR-only.
▶ **Timestamp alignment: 100.0% on all nine windows**, checked against YouTube's own json3 timings
(different container, different code — re-parsing our VTT would reproduce any parser bug and pass).
⚠ The control was built before the result was reported: the same text against a window +120s away
scores 36.7 / 43.6 / 43.3%. Sampled by `md5(video_id)`, never id order. Confirmed by eye too.
⚠ A first parser version terminated cues at the format's whitespace padding line, silently losing
the block that carries the true start time; caught by reading six cues against the raw file first.
▶ Search: `human rights act` 103 passages, `common law` 127, `sovereignty` 101, nonsense control 0.
✅ `tsc` clean on every file B7 added; the repo's 8 pre-existing errors in 6 untouched files remain.
**B5 STILL NOT STARTED** — `docs/report_run/register_proposals.json` is still not on disk, re-checked
at the start of this run. B7 was independent of B2–B6 and touched none of them.
Earlier: 2026-08-29 15:32 UTC — ▼ **B2, B3, B4 DONE. THE MARKUP DETECTOR VERIFIES AT 80%,
AND EVERY ONE OF ITS FAILURES IS THE MISATTRIBUTION T2 FOUND — TWO METHODS, TWO SAMPLES, ONE RATE.**
B5 **NOT STARTED**: `docs/report_run/register_proposals.json` is not on disk, checked first and
re-checked last. Not improvised.
⚠⚠ **B4: 20 of 25 markup rows correct (80%). All five surviving failures are one class** — the
reference real, the target real, and NOT in the provision `source_provision_ref` names. **5 of 25 =
20% against T2's 496 of 2,593 = 19.1%**, measured by different means over different rows (T2 read
local CLML; B4 fetched live from legislation.gov.uk). The misattribution is no longer one script's
result. ⚠ **The markup 80% and the T5 text 100% are NEVER averaged** — two detectors, two
denominators. ⚠ **Two first-pass failures were the CHECKER's** and were caught by pass 2; published
raw, the rate would have read 18 of 25. The verifier is **IMPORTED** from `report-t5-verify.ts`, not
restated, so a disagreement between the rates can only be about the rows.
⚠⚠ **B2: `argument-questions.ts` IS NOT A QUERY INTERFACE** — a hardcoded ten-question gold set with
hand-picked chunk ids that writes a markdown file from constants, taking no query and no measure.
That is why `argument:questions` is absent from `package.json` while the 1A report cites it. Ran the
two-arm draw from `argument-seed-draw.ts` instead, with the taxonomy's own regex as the confirm.
Objections: **WS-01 36, WS-04 32, WS-05 20**; over the 30-word floor 35 / 28 / 20.
⚠⚠ **AND THE COLUMN TO SORT ON IS `subject_terms_present`, ADDED AFTER READING THE FIRST RUN.** A
confirmed row is either the cross-subject find (the unbounded-duty argument made in 2005 about
*advertising marches*) or pattern noise (a COST pattern on "burden on small businesses" in a
question about *fuel protesters*), and they look identical in JSON. **For WS-04, 28 of 32 rows use
none of the measure's own subject words.** Mechanical field; rules on nothing.
⚠ B2 confirm rate **6.1%** against ≥25% predicted — wrong, badly. ARGUMENT 1A's "48.8% of dense
candidates under 30 words" did **not** reproduce (dense 8.1%): its denominator was the candidate
pool, mine is the pool that survived a pattern confirm.
⚠⚠ **B3: THE FRONT MATTER'S "case law from 2001 only" IS WRONG — the measured floor is 1965-08-09**
over 280,573 rows in five collections. **AND `coverage.ts`'s OWN `CASE_LAW_CORPORA` IS WRONG**: two
of its four names hold ZERO rows (`caselaw`, `caselaw-fcl`) and it misses the two largest that exist
(`tna-caselaw`, the 1965 floor; `ni-judgments`), so the boundary it prints starts in 1989 — 24 years
late. Block reproduced **verbatim, defect and all**, with the corrected measurement beside it. NOT
fixed: it changes what the report prints while the analysis track drafts against it.
▶▶ **CRAG 2010 IS ESSENTIALLY UNLITIGATED — ONE judgment** (`ni-judgments:2021-nica-49`, JR83 (No 2)
and The Prime Minister). A finding, not a retrieval failure: the HRA through the identical path
returns **53 of 60**.
⚠⚠ **A GAP I ALMOST FILED THAT WOULD HAVE BEEN FALSE**: "the principle of legality" returned nothing
on two phrase terms — and the phrase **is** in the corpus (found via "fundamental rights":
`[2009] EWCA Civ 786`, `[2010] EWHC 3110 (Admin)`). A **retrieval failure, not a corpus gap**, and
filed as a gap it would have told the report the common law is silent on a doctrine it is loud
about. Every empty principle is now re-asked broader and the returned judgments tested for its own
words. One real gap survives (WS-04, "common law duty to act fairly towards the disabled").
▶ Set A / Set B: WS-01 **53 / 44**, WS-04 **60 / 8**, WS-05 **1 / 10**. ⚠ My "Set B will be thin"
prediction was **wrong**, and WS-05's Set B exceeds its Set A.
✅ `check:scripts` and the web `tsc` clean on **every file these briefs added**. ⚠ Still not clean on
the repo — the same 8 pre-existing errors in 6 untouched files.
`docs/report_run/_README.md` carries all four caveats for the analysis track.**
Earlier: 2026-08-28 22:40 UTC — ▼ **REPORT RUN, CORPUS TRACK: EVERY §8 DELIVERABLE EXISTS —
AND ONE IN FIVE PROVISION REFERENCES POINTS AT A PROVISION THAT DOES NOT CONTAIN THE REFERENCE.**
T1–T5 of `docs/CC_BRIEF_report_corpus.md` complete, in `docs/report_run/`, `_README.md` in front.
⚠⚠ **496 of the 2,593 rows that NAME a source provision do not contain the referenced Act inside
it** — WS-05 38/149 (25.5%), WS-01 139/892 (15.6%), WS-04 319/1,552 (20.6%). The citation is real
and the target is real; the words are elsewhere in the same document: **Explanatory Note 184**,
elsewhere 101, schedule heading 76, cross-heading 47, repeals table 43, heading 42. **Certain:** you
cannot QUOTE those provisions as containing the reference. **Not settled:** whether they still BEAR
on the target — a cross-heading naming the Act above a paragraph is good evidence it amends it. Not
496 false rows; 496 rows whose evidence sits one element away. ⚠ It is NOT
`coverage.notInAProvision`, which counts the NULLs — **nothing before this run counted the
non-null-and-elsewhere case**, and `source_provision_ref` is the column that answers "which
provision breaks". Found by two code paths: T2 against local CLML, and T5's supplementary draw
against LIVE legislation.gov.uk.
⚠⚠ **MY OWN PASS-2 CHECK PRINTED A CONCLUSION ITS EVIDENCE REFUTED** — no branch for
`!local && whole`, so it fell through to *"neither our copy nor the live document supports this
row"* while its own field said `true` three lines above. That missing branch WAS the misattribution.
⚠⚠ **ONE GID NAMES TWO DOCUMENTS AND MY FIRST INDEX LET THE LAST ONE WIN** — the bulk CLML file
holds 133,361 documents under 130,096 gids, **2,894 with both an as-made and a revised copy**. The
GRAPH 4B "last entry silently won" defect in a new place; caught by a result that could not be true
(`uksi/2005/384` quotes HRA s.4 and the copy handed back never says "Human Rights Act" — it is the
revoked Criminal Procedure Rules 2005, a shell). Now `revised` preferred and DECLARED, every read
says which copy, **41 rows labelled `as-made-text`** = references amended or revoked away.
⚠⚠ **AND A CONSEQUENCE FOR `citation_edge`, REPORTED NOT FIXED: `extract-citation-edges.ts`
iterates ENTRIES, not gids**, so for those 2,894 documents it extracted from BOTH copies under one
`source_gid` with no column saying which. Needs a re-extraction + schema column.
⚠ **A sentence extractor that split on the chapter number** produced *"Constitutional Reform and
Governance Act 2010 (c."* as a quotable sentence. Fixed; the honest whole-sentence rate went DOWN,
98.0% → **96.9%**.
▶ **PREDICTIONS: P1 96.9% (≥85% ✅), P2 19 refs (15–35 ✅), P3 6/6 + 7 found by search (≥6 ✅),
P4 ✅, P5 holds on all three axes ✅, P6 half wrong** — 20/20 correct but 0 verifier failures.
⚠ **The 20-row sample drew markup 0, text 19, enabling 1**, so the brief's rate tests ONE detector
of three — and markup is the one the report leans on hardest. A supplementary 3-per-detector draw,
never merged: markup **2/3**, text 3/3, enabling 3/3.
▶ **CRAG Part 1 confers NO exercised enabling power** (26 for the Act, **0** in Part 1); its
act-level band is **3.6×** the part-scoped band (106 vs 29). ▶ **Scotland Act 1998 Sch 6, NI Act
1998 Sch 10 AND GoWA 2006 Sch 9** all route devolution issues to the **Supreme Court**, Judicial
Committee ×0 — **Wales is not on the brief's list and is in the same position**. Reported, not
concluded. ▶ SA 1998 s.51 and GoWA 2006 s.52 both name **CRAG Part 1 and section 3** expressly.
▶ **A bare 0 caught by a guard**: CRA 2005 Part 2 literal-matches 0 on every axis; expanded it is
markup 1 / text 13 / enabling 5. Public Order Act 1986's Part 3 is `part-III` in Roman numerals.
⚠ **T4 (CRA 2005 at full depth) NOT worked — Charlie's 09:00 Tuesday decision.** Scoped; the full
run is `--include-t4` on three scripts, ~15 minutes.
✅ `check:scripts` clean on every file this run added. ⚠ **NOT clean on the repo** — 8 pre-existing
errors in 6 untouched files; 25-M reported it clean this morning, so something regressed since.
No statutory text fetched for T1–T4 (all 1,235 source documents are local, measured; Neon only). `docs/report_run/_README.md`.**
Earlier: 2026-08-28 12:01 UTC — ▼ **LEX 25-M: THE FIRST CAUSAL CHAIN A BUILD HAS EVER
PRODUCED — AND NO CHECK OR VERIFY SCRIPT IN THIS REPO HAD EVER BEEN TYPECHECKED.** §1–§5 built.
⚠⚠ **§5b PASSES: THE CAUSES NEST.** One live build (RESUMED, not re-claimed, so the one-build
ceiling held): 10 passes, **22.98p, 249s**. Baseline measured BEFORE spending: **0 nested
causes from any build in the whole database** — the single nested row was made by a user by
hand on 14 Aug. After: **2 of 3 build-written causes sit beneath another.** Asserted on
`parentCauseId` — the VALUE, not the schema.
⚠⚠ **§4's PREMISE IS WRONG ABOUT THE DATA.** §4 says count `LlmSpend`; it holds **2,702 rows,
2 with a userId**, and 0 of 306 build-stream rows sampled carried one — `SpendAttribution` is
optional and the build passes never pass it. An allowance counted there **reads zero for
everybody and hands out unlimited free builds.** The counter is `IdeaBuild`, which is the unit
§4 states its own rule in. `check:lex-25m` asserts it is NOT LlmSpend.
⚠⚠ **§3's GAP WAS THE SNAPSHOT RETURNING AN EMPTY EVIDENCE ARRAY** — it took ACCEPTED only,
rightly, and **nothing has ever been accepted**, so §2b's write-up would have had none of the
panel's material and an empty array renders as a document with no findings section, not an
error. Now: carry it, **LABEL it** (each finding says whose it is), never promote it silently.
⚠⚠ **`scripts/**` IS EXCLUDED FROM THE WEB TS PROGRAM — 172 CHECK AND VERIFY FILES, NEVER
TYPECHECKED.** Surfaced when my §5b harness called a 3-arg function with 2 args, reached a
LIVE RUN, claimed a build row and died in its first pass — **and reported exit 0 over the
crash**. New `scripts/tsconfig.json` + `npm run check:scripts`; its first run found **four real
defects**: a `source.reason` `reuseSourceFor` never returned; two fixtures missing
`userCritique` since 25-L; a `StageContext` import 25-L invalidated; and a spread that hid
**three fields missing since 25-F**.
⚠⚠ **AND §23.2 IMMEDIATELY FOUND A SECOND DEAD HARNESS**: `verify:build-25a-ui`, same missing
React import as 25-L's. Now 43/43 — and running it exposed a STALE ASSERTION requiring the
build summary in a panel 25-G deliberately removed it from.
▶ **§1 Outputs is in the resources panel**, top and set apart; both documents, when each was
generated, whether it still matches. ⚠ **One generator, two doors.** ⚠ Found: the contents list
rendered UNDERNEATH the special items (gated on `!openHeading`, not `!openKey`).
▶ **§2b the write-up carries every panel section** in the panel's order, imported not restated.
▶ **§3 audit**: every heading has a carrier **except `POSITIONS`** (no producer — 25-L put a
live beta surface there, not a snapshot field).
▶ **§4 built**: one free build + one re-run (4 thirds). ⚠⚠ The spend test is an **ALLOW-LIST**
— only DONE spends — so FAILED/CANCELLED/QUEUED/RUNNING and any future status are "not spent"
by construction. Hard stop at the WRITE PATH, 402 not 500. Admin grant SETS, requires a note,
logs. `IdeaBuild.mode` now recorded (what RAN, not what was asked).
▶ **§5a backfill RAN**: 5 → HOW_HARD, 1 → KEY_SOURCES, **0 left under AGAINST** (re-read, not
reported from intent). ▶ **§5c: CLAUDE.md §23.3 and §24.1 added.**
✅ `check:lex-25m` **11/11, 0 uncontrolled**. Whole suite reported (§23.2): 25-c 32, 25-d 77,
25-e 28, 25-f 62, 25-g 27, 25-h 20, 25-i 14, 25-j 12, 25-k 18, 25-l 19, 25-m 11, scripts clean,
20bd 47, statutory 17, build-25a 40, build-25b 54, +4 pass. Harnesses ALL EXECUTED: stages-ui
23, 25e-ui 16, 25g-ui 14, my-ideas-ui 15, **build-25a-ui 43 (first ever)**, **outputs-ui 7**.
`tsc`, `check:scripts`, `next build`, clean-build `--fast`, `prisma validate` clean.
`prisma/lex_25m.sql` applied to Neon. Spend: one build, 22.98p.
⚠ **NOT verified on the running site**; §1/§2/§4's user half is behind sign-in and a route probe
Clerk 307s proves nothing — render harness and source assertion only.
⚠⚠ **CHARLIE: your allowance is 4 thirds and today's build spent 3** — you will see "enough
for a redraft, not a full search". `PATCH /api/admin/allowance` clears it.
`docs/LEX_25M_REPORT.md`.**
Earlier: 2026-08-28 10:25 UTC — ▼ **LEX 25-L: THE RE-RUN ASKS BEFORE IT SPENDS, THE
RIGHT PANEL IS A LIBRARY, AND QUALITY 1's CAUSE WAS A PROMPT THAT NEVER MENTIONED THE FIELD.**
§1–§6 built with three stated exceptions; all three amendments done.
⚠⚠ **QUALITY 1: THE CHAIN WAS BUILT AND THEN DESTROYED BY A PASS THAT DID NOT KNOW IT
EXISTED.** Two passes write causes. The DIAGNOSIS pass carries eight lines explaining
`drivenBy`; the REVISION pass declares it in its type, **REQUIRES it in its JSON schema**, and
its prompt has never mentioned the field — and `build.ts` deletes the diagnosis pass's causes
and replaces them with the revision's. Nothing errored, because `""` is a valid string. Three
sprints called it a model failure. One shared `DRIVEN_BY_INSTRUCTION` now goes to both passes.
**CLAUDE.md §24, third instance of schema-permits ≠ prompt-requires.**
⚠⚠ **THE NAV SAYS "MY IDEAS" IN THE FILE THAT RENDERS** (`PublicNav.tsx`). `check:lex-25j`
is repointed and now **proves its subject is reachable from a route first** — new CLAUDE.md
§23.1, implemented as `scripts/reachability.ts`, with the dead `Navbar.tsx` as its control.
§23.2 added: **report checks RUN, not only checks passed.**
▶▶ **§1 — the re-run button opens a dialogue.** Text, files and links all before go. ⚠ The
critique reaches the passes **as an instruction** (`⚠ ACT ON THIS`) — 25-F: material with no
instruction is material a pass ignores — and does NOT demand agreement. Stored on the build
that received it, shown back, readable at `/api/admin/lex-signals`.
▶▶ **§2 — a YouTube link was refused with "that page had no readable text".** Now refused
before the fetch, naming the transcript; ⚠ **nothing fetches one** and the check greps to keep
it so. Eight kinds, every refusal logged with kind + target — **that table IS the evidence for
the decision §2 defers.**
▶▶ **§3c — THE SMART PASS'S OUTPUT WAS FILED UNDER "THE STRONGEST CASE AGAINST", WHICH IS
WHY CHARLIE COULD NOT FIND IT.** New headings **How hard will this be to achieve?** and **Key
sources**. ⚠ Existing rows keep `AGAINST`; **backfill prepared and UNRUN** —
`prisma/lex_25l_backfill_prognosis.sql`, one command, Charlie's.
▶ **§3a/b/d** — contents list + worded home; contents computed from the pass configs; every
empty item says WHICH KIND of empty, never a `0`; sources tag **priority · listed · set
aside** and priority **reaches the proposal document**. ⚠ A pre-25-L frozen snapshot would
have thrown on re-render — three cases, not two.
▶ **§4** — three hideable panels, draggable dividers, layout **per USER** (a column, not
`localStorage`), minimums, reset, roles stated. ⚠⚠ `normaliseLayout` had a real bug the check
found and reading did not: clamp-then-renormalise pushed columns back UNDER the floor.
▶▶ **§5 (as amended) — THE GRAPH IS JUDGED BLIND FIRST.** Sourced record shown, user judges,
**then** ours is revealed. ⚠⚠ **Our assessment is ABSENT FROM THE GET, not hidden in it** —
asserted, with a control that plants the leak. Order enforced by two DB CHECK constraints;
our claim copied in at reveal time; **corroboration, not verification** — the rate travels
with its caveat (*a partisan sample agrees with itself*) over a denominator of ANSWERED
judgements. `POSITIONS` finally has something under it.
▶ **§6** — the mobile tab bar moved to the **bottom**, with a **count** on the draft tab from
the worklist itself (a number and a word, never a coloured dot).
▶▶ **CHARLIE'S DECISION RECORDED: a failed build does NOT spend the allowance.** Nothing
charges yet.
⚠ **NOT BUILT, with reasons:** citation sheets (`ChatPanel` renders **no citations at all** —
the idea-chat's prompt forbids them, so there is nothing to tap); "Case studies" as its own
item (no producer distinct from TRIED_BEFORE/ELSEWHERE); a real-device mobile test.
⚠ **CHARLIE — one contradiction between briefs:** §6 calls the middle tab "Proposal"; 25-K
§1 retired that word as navigation. Navigation won; it is **"The draft"**. Say the word.
✅ `check:lex-25l` **19/19, 0 without a negative control** — ⚠ three failed first and **two
were real defects in this sprint's code**. Whole suite reported, not a selection: 25-c 32,
25-d 77, 25-e 28, 25-f 62, 25-g 27, 25-h 20, 25-i 14, 25-j 12, 25-k 18, 25-l 19, build-25a 40,
build-25b 54, 20bd 47, statutory 17, deepening/panel-claims/documents/never-claim pass. All
four harnesses EXECUTED: stages-ui 23, 25e-ui 16, 25g-ui 14, my-ideas-ui 15. ⚠ **Seven guards
from five sprints fired and were repointed, not relaxed.** `tsc`, `next build`, clean-build
`--fast`, `prisma validate` clean. `prisma/lex_25l.sql` applied to Neon (host checked first) —
additive only. ⚠ **NOT verified on the running site at the time of writing.**
`docs/LEX_25L_REPORT.md`.**
Earlier: 2026-08-28 09:03 UTC — ▼ **LEX 25-K: THE PRODUCT HAS THREE NAMED STAGES,
AND 25-J's NAV RENAME NEVER REACHED A USER.** §1–§5 built; §6 designed and deliberately
unbuilt; §7 answered from a measurement already in hand.
▶▶ **"The build" and "the proposal" are gone as navigation** — they named the screens for how
they were MADE. Now **1 · The Idea**, **2 · The Strategy**, **3 · The Deepening**, from one
table in `lib/lex/stages.ts`, with a persistent indicator on every screen saying which
stage, what it is for in one line, and how to move. Movement is free both ways.
`SurfaceSwitch.tsx` and `lib/lex/surfaces.ts` deleted; 25-G's three §2 assertions
**repointed, not relaxed**.
⚠⚠ **25-J's nav rename went into a file NOTHING RENDERS.** 25-J §1 reports "nav Create → My
ideas"; it landed in `components/ui/Navbar.tsx`, which no page imports. The live nav is
`PublicNav.tsx` and it still said "Create". **`check:lex-25j` passed the whole time — a new
member of the "check that cannot fail" family: a check pointed at a file nobody renders.**
▶ CHARLIE: 25-K §5 names it "Create" (what you saw); say if you want "My ideas" live.
⚠⚠ **`tsc` WAS CLEAN ON CODE THAT COULD NOT BE BUILT** — the stage vocabulary beside its
prisma counts pulled `pg` → `require('tls')` into the BROWSER bundle via a client component;
`next build` failed outright. Split into `stages.ts` (pure) / `stage-context.ts` (reads).
▶▶ **§2 — two controls that existed and could not be found.** File/link upload is now a "+"
in the composer on EVERY question (25-H had it on the `reading` step only, plus a bare file
input further down — absent at question one, gone after question four). ⚠ That step also
still printed *"I can't read documents yet"*, false since 25-H wired the pipeline in —
**never-claim cuts both ways**. ⚠⚠ **The re-run was invisible FOUR WAYS** (gated on
`finished||stopped`, gated again on `canStart`, at the page bottom under the findings) — now
present in every state and SAYS which, with both prices. **And Lex now answers "re-run it"
with directions to the control, not a dead end** (`lib/lex/platform-controls.ts`, built from
`LEX_STAGES`) — ⚠ asserted in the prompt, NOT yet observed in a live turn.
▶▶ **§3 — the left column is a WORKLIST with the chat under it**, reading the agenda 25-C
already assembles: one imperative line per task, a count, and a jump. No new source of
truth, no model call. Contradictions lead. ⚠ Only `only-you` gaps reach the user's list.
▶ **§4 — the Deepening is a stage** (`?stage=deepening`), with its own worklist listing unrun
and FAILED passes SEPARATELY. ▶ **§5 nav:** Create · Browse · Central · About · Support ·
[Admin]; Legislation removed from both navs (page untouched).
▶▶ **CHARLIE — §6, REPORTED AND NOTHING BUILT: there is NO allowance, quota or gate
anywhere.** A build is a button with no ceiling behind it. ⚠ `LlmSpend` already carries
`userId` and `estCostPence`, so an allowance is a counter and a gate over data we already
write. Design in `docs/LEX_25K_REPORT.md` §6 — **the decision that is yours: does a FAILED
build spend the allowance?**
▶▶ **§7 — the three missing qualities are 1, 5 and 6.** ⚠ **Quality 1 is a live regression**:
`nestByDrivenBy` is in the code and asserted, and the output still nests 0 of 4 causes — the
model is not populating `drivenBy`. ⚠ 5 and 6 have never been observed in ANY output.
⚠ **A render harness that had NEVER RUN**: `verify:lex-25e-ui`, covering exactly the cards
this sprint changed, died on `ReferenceError: React is not defined` before its first
assertion and appears in no sprint's results. One missing import; now 16/16.
✅ `check:lex-25k` **18/18, 0 without a negative control** — ⚠ one control was written
BACKWARDS and `--self-test` caught it. `verify:stages-ui` **23** (§0 is right: the
three-column desktop layout cannot be walked from a CC session — 0×0 viewport, `lg:` never
matches — so the indicator is verified by rendering it). 25-c 32, 25-d 77, 25-e 28, 25-f 62,
25-g 27, 25-h 20, 25-i 14, 25-j 12, deepening, statutory 17. `tsc`, `next build`,
clean-build `--fast` clean. ⚠ **NOT verified on the running site at the time of writing.**
`docs/LEX_25K_REPORT.md`.**
Earlier: 2026-08-28 00:47 UTC — ▼ **GRAPH 4B: THE BRIDGE IS BUILT, AND IT FOUND A DEFECT IN
BOTH THE COPIES IT REPLACED — 419 CALENDAR IDS NAME TWO ACTS EACH AND THE LAST ONE SEEN WAS WINNING.**
⚠⚠ 41 Geo 3 and 42 Geo 3 are both **1801**, and each session numbers its chapters from one, so
`ukpga/1801/16` **is two different Acts**. Both old alias maps wrote `calendar → regnal` in a single
pass, so **the last entry silently won, for 419 ids** — a merge with no basis at all, reached by
iteration order, inside the code that exists to prevent one. The bridge **refuses** them and
**STORES THE REFUSAL AS A ROW** (NULL canonical, `basis = 'ambiguous-refused'`), because a form
merely absent from a table cannot be told from one nobody has ever seen.
▶ **The join was watched returning ZERO first and the failing state is PINNED, not described:**
three known pre-1963 Acts return **0** `cites` rows today and **59 / 50 / 50** through the bridge —
GRAPH 4A's exact figures. ⚠ **One correction to 4A**: "the regnal form returns 0" holds for the
`cites` edge type ONLY — `legislation_edges` carries **63,520** regnal-form rows from the TNA effects
CSVs. **Both forms are in that table, from different code paths, and neither reaches the other.**
⚠ **4A named two copies of the alias map; there were THREE** (`extract-citation-edges.ts`,
`audit-25h-citations.ts`, `v37-citation-gaps.ts`). All gone; the guard greps every file the graph
reads and was watched firing on all three, and on a planted fourth. §6 re-answered: overlap
**98.1% → 98.7%**, 600 pairs out of "missing". **Nothing retired.**
▶▶ **LAYER 2 IS BUILT: 191,258 enabling rows over 70,576 instruments, every one carrying the
enacting words** — `detection = 'enabling'`, 0.212 GB, **$0.07/month**, 63 seconds. ⚠⚠ **AND READING
ITS OUTPUT FOUND A SECOND DEFECT: 36.1% OF THE OLD PREAMBLE PARSER'S SECTION-LEVEL REFS WERE WRONG,
AND `legislation_edges` STILL HOLDS THEM.** A bracketed subsection read as a section (*"sections
191(2) and 195(3)"* → `section-191`, **`section-2`**, `section-195`) and a ref list attached to the
wrong Act in a preamble naming several (FSMA's anchor given the European Communities Act's s.2).
Over 2,000 documents with both parsers fed IDENTICAL bytes: 3,094 → 2,059 refs, **975 subsection
artefacts + 142 re-attributions.** Act-level rows were never affected — only the section-level ones,
which are the rows a repeal analysis reads. ⚠ My first attempt to measure it reported 0 artefacts
because it compared two regexes' whole matched spans, which can never be equal.
▶ **Why keeping the fact separate matters, in one row:** `ukpga/1972/68`, the **repealed** European
Communities Act 1972 — **126 mentions, 6,017 instruments MADE UNDER it**; `uksi/1981/238` — **0
mentions, 3,459 made under it.** Flattening those produces a confident, wrong consequence list.
⚠⚠ **§2.2's GATE PASSES BUT NOT CLEANLY: schedule retention is 41.3%** — matched on the SAME
documents, 118 of 201 schedule-bearing instruments reached the corpus without their schedule. A
corpus ratio set against a zip ratio hides this, and my first version did exactly that.
▶▶ **§3's REAL ANSWER: 127 OF THE 247 MISSING DOUBLE TAXATION AGREEMENTS ARE ALREADY ON THIS
MACHINE.** 286 Orders, **39 hold a schedule (13.6%)** — 4A's 39-of-288 reproduces exactly. Layer 2
recovers **0** and not by accident (an enabling row is a PREAMBLE fact; the missing thing is a
SCHEDULE — counted anyway rather than argued from construction), but **127 carry a ≥4,000-character
schedule in the bulk CLML the corpus dropped.** No fetch needed; an ingest pass. The other 120 need
the source. ▶ **The reverse direction IS answerable** (both columns indexed, read from `pg_indexes`;
"what is made under TIOPA 2010" → 110 instruments). ▶ **MLI positions NOT held**, and Layer 2 cannot
change that — the MLI modifies agreements without amending the Orders.
▶ **§4: the coverage block carries the bridge residual and schedule coverage, LIVE**, and all three
reach the RENDERED WORDS. ⚠ **4A's probe was NOT edited — it flipped on its own**, which is what it
was written to do. ⚠⚠ **One of 4A's assertions had to change and was watched FAILING first**; it now
pins the original regression directly (layer count 191,258 vs 2,356 incidental phrase matches, so the
858-row false positive cannot return). **§5 accepted: `docs/CROSS_REFERENCE_GRAPH.md`** names the
cross-reference graph as its own listed capability, its coverage block a DATED READING.
▶ **Predictions: 7 confirmed, 3 refuted — and the three share one cause.** I sized Layer 2 from a
parser producing 36.1% wrong section refs, so every row-count prediction was anchored to a defect;
P4 fell by almost exactly the share that was wrong. P8's own flagged caveat came true.
✅ `check-4b-identity` **30/30** · `check-4b-layer2` **18/18** (hand-check **18/18** on the Act and
**9/9** on the provision, fetched LIVE from legislation.gov.uk) · `check-4a-coverage` **30/30** ·
25-H checks 37/37, 12/12, 8/8. ⚠ `check-25h-verify` was **fixed**: it fired four requests back to
back with no retry and died on an HTTP 500 that moved between documents — **a check that dies on
someone else's throughput reports a fault in OUR data.**
▶▶ **CHARLIE: six numbered decisions in `docs/GRAPH_4B_REPORT.md`.** The two that matter most:
**Q2 re-extract `legislation_edges`' `made-under` rows** (needs a scoped production DELETE, prepared
not run) and **Q3/Q4 the 41.3% schedule retention**, an ingest sprint the 127 treaties are a symptom
of. ▶▶ **Nothing touches the live site** — no UI, no flags, no re-ingest; two additive tables and one
widened CHECK.
Earlier: 2026-08-28 00:40 UTC — ▼ **ARGUMENT 1A: THE PERORATION HYPOTHESIS IS SUPPORTED,
AND SEED-BASED PROPAGATION HAS ZERO MEASURED RECALL.**
▶▶ **§1.1 — 8,959 SPEECHES, 10.2 MILLION WORDS: the OPENING fifth is the sparsest and the CLOSING
fifth the densest. closing/opening 1.57×** on the ten tags' own patterns and **1.30×** on a second,
independent stance instrument. **My prediction was the opposite and was logged first.**
⚠⚠ **The confound I went looking for STRENGTHENED it.** A committee report's Conclusions chapter is
at the end by construction, so reports and speeches were measured apart: **speeches 1.57×,
committee documents 0.86×** — the documents were diluting the effect, not creating it. Procedural
closers spike 8.8× in the final fifth and are counted on a separate axis so they cannot drive it.
⚠ **My counter-hypothesis was refuted too**: short interventions are **0.81×** as argumentative as
long speeches, not more.
⚠⚠ **AND IT COULD NOT BE TESTED THROUGH THE VECTOR INDEX AT ALL: 12,705,570 of 13,724,557
parliamentary sections — 92.6% — ARE A SINGLE CHUNK**, so nine in ten have no "position within the
speech". A chunk-based experiment would have measured the chunker. Read from R2 instead.
▶▶ **§4 IS THE RESULT THAT MATTERS: propagation from 71 hand-verified seeds retrieved 0 OF 20
hand-tagged RANDOM passages — 0.0%, at top-200 per seed, out of 400–980 candidates per tag.**
⚠⚠ **The control that decides what that means was built BEFORE it was reported.** Each held-out
passage was asked for by its OWN WORDS: **19 of 19 came back, all at RANK 1.** They are in the
index and retrievable; propagation never reaches them. **Similarity to a seed retrieves paraphrases
of the seed, not instances of the move.**
⚠⚠⚠ **THE SPLIT THAT SHOULD DECIDE WHAT HAPPENS NEXT: the deterministic pattern arm is tag-right
18/20 (90%) against the dense arm's 17/40 (42.5%). The cheap half that works is the regex.**
▶ **§4's two numbers, apart: tag right 35/60 (58.3%) · should have been tagged at all 41/60
(68.3%) · and of those that should, right on 35/41 (85.4%).** ⚠⚠ **My prediction of which would be
lower was wrong** — the system is NOT over-claiming (the position graph's failure mode); it is
putting **the wrong one of the ten** on arguments that are really there.
⚠ **Three failure shapes named: WORD SENSE** (*"is the zero option a dead letter?"* — arms control,
tagged ENFORCEMENT), **phrase-mention without the move**, and **the fragment**.
⚠⚠ **48.8% of dense candidates are under 30 words, 28.2% under fifteen** — median 32 against 83 for
a random passage. *"Where is the money to come from?"* came back four times from four decades.
▶ **§3 — `docs/ARGUMENT_QUESTIONS_V1.md`: ten questions of a new shape, 10/10 tags, 21 keys, 21
bodies read from R2, 21 confirmed. SEVEN have their answer in a debate about a DIFFERENT SUBJECT**
(short-term-lets enforcement answered from Sunday trading 1985). **Nothing is scored against them.**
⚠⚠ **THREE OF MY OWN INSTRUMENTS WERE WRONG AND RUNNING THEM CAUGHT ALL THREE** — a shoulder test
that cannot work over a top-K set, a `corpus` column filled with a TIER name, and **a
`tier: 'parliamentary'` filter that silently excluded 1,044,188 Scottish Parliament sections**
(caught by a control built for a different purpose; recall unchanged at 0 of 20 after the fix).
⚠ Reported to ingest: `historic-hansard` holds **788 rows dated before 1800, earliest 23 June 1013**.
⚠ **The database is 18.85 GiB, ABOVE the 17.5 GiB ops alert line.** No per-paragraph model call was
made; spend is ~500 embeddings. `check:argument-1a` **17 passed, 0 failed**.
▶▶ **CHARLIE: six decisions in `docs/ARGUMENT_1A_REPORT.md`** — D-1 fund the full scan, **D-3 run
the pattern arm corpus-wide (the arm that works)**, D-4 the fragment problem.
Earlier: 2026-08-27 23:22 UTC — ▼ **SEARCH S17: THE COMMITTEES KEYS ARE RE-KEYED, AND S16's
UNREACHABLE CLASS IS ZERO — NOT FOUR.**
⚠⚠ **`cps-guidance` HAS BEEN REACHABLE SINCE 21 AUGUST AND NOBODY RE-READ THE INDEX.** It sits in
the `guidance` tier of the SERVED index and the guidance stream returns all three of its keys today
(**ranks 36 / 2 / 18** BM25-only, **70 / 34 / 33** fused, raw query, configuration in the artefact).
S16 published them as UNREACHABLE because its autopsy took the tier from
`corpus_reachability.json` — generated **2026-08-20 23:59 UTC, one day before S11's re-tier** — and
because its `admits()` was a **re-implementation** that compares `s.tier !== tier` FIRST and
**never looks at `extraCorpora`**, so `scottish-parliament-or` (reached by the debates stream's
extra corpus-only leg) came out "admitted by NO stream". `stream-scopes.ts`'s own header warns that
a COPY of the scope test is how a matrix keeps saying *reachable* after a filter narrows; **this was
that failure from the other direction.** Both fixed — the scope test is imported, and every tier is
now read back off `fts-serve` from hits carrying their own `tier` field.
▶ **RECOUNT, same 32 failures, same arms data, only the tier source and the scope test changed:
UNREACHABLE 4→0 · NOT-ROUTED 4→5 · RANKING 4→6 · NOT-MATCHED 19→20 · search owns 12→11.**
⚠ The unit modifier moves 12→15 as arithmetic, not a finding (it is set only on NOT-MATCHED/RANKING
and three of the four reclassified rows are ≥1,500 words). S16's artefact is untouched; the recount
has its own path.
▶▶ **§2's ANSWER: NOBODY NEEDS TO FIX THE `other` TIER — not ingest, not search.** Twelve
collections enumerated; **seven have already moved to `guidance`**; the only two with no stream
(`early-day-motions` 60,737 · `petitions` 49,529) are `DEFERRED_TO_GRAPH` by a written decision and
`members-interests` is excluded by design. **A scope change made on S16's account would have widened
a stream to admit collections it already admits.**
▶ **§1 — `docs/GOLD_COMMITTEES_REKEY.md`: 10 questions · 50 keys · 50 bodies READ OUT OF R2 · 50
confirming terms found · 0 missing · 0 front matter**, and that last zero counts only because the
front-matter detector was watched firing on two known cover pages and staying silent on a
substantive one (3/3). ⚠⚠ **C1's currently-PASSING key is the report's COVER PAGE** — crest,
membership list, the clerk's telephone number — retrieving on its title and answering nothing;
dropped, and the pass may go with it. ⚠ **C3's correspondence key was RIGHT all along**: *"what has
Parliament been TOLD"* asks for a letter; the defect was 1-of-8, and all eight are keyed. ⚠ A
`%Grenfell%` match takes correspondence from **Michael Grenfell of the CMA** — a surname, not the
tower. ⚠⚠ **The leasehold report is held THREE TIMES (standard / Large Print / Easy Read) as
separate documents**, so a hit on the Large Print copy scores WRONG while giving the user the right
report — this sprint's own defect arriving from the ingest side, reported not fixed.
▶ **The durable artefact is the key-kind distribution: committees 52.6% off-kind, every other
collection 0.0% across 76 keys — there is NO second instance of the wrong-kind defect.** The
one-of-many HAZARD is elsewhere though: a debates key is 1 of a **369-speech median sitting day**
(max 3,594), a legislation key 1 of a **200-section median Act**. ⚠⚠ **My own first version printed
`1` there and the 1 was a DEFAULT** — those corpora carry a NULL `parentDocId`; an undeterminable
group now prints `n/a` and is counted.
▶ **§3 — the flag state is readable in one request.** `/api/health` reports all 15 capability flags
through `capabilitySnapshot()`, so it says what is IN FORCE not what was SET, plus three presence
booleans. `check:s17-flags` **11 passed**, leak detector watched naming a planted key. ⚠⚠ **One of
my own assertions was wrong about the world and the first run caught it** — I required a capitalised
`TRUE` to report FALSE, but `env-flags.ts` normalises it; the real test is a value set and
UNRECOGNISED. `SEARCH_CONTRACT` §4's "the live flag state is NOT readable" is replaced.
⚠⚠ **AND THE FIRST READING OFF PRODUCTION CONTRADICTS WHAT EVERY RECENT MEASUREMENT ASSUMED**
(`d048738`, verified live): **`LEX_SEARCH_JUDGED_MERGE` ON · `LEX_QUERY_EXPANSION` ON ·
`LEX_SEARCH_RERANKER` ON.** Every gold run since S14 records `QUERY_EXPANSION=off`, and S15's
*"today's production configuration returns 19 of 64"* describes the merge-**OFF** arm. **The
instrument and the product are differently configured and nobody could see it until this endpoint
existed.** A reading, not a history — neither change can be dated from here. **D-6: re-take the
baseline under production's real flag string, AFTER the re-keys are validated.**
⚠⚠ **AND I REPRODUCED C1'S DEFECT TWO HUNDRED LINES BELOW THE PARAGRAPH DESCRIBING IT** — the first
run reported front-matter 0 truthfully while **four of C10's five confirming sentences were a table
of CONTENTS**. The guard belongs on the printed QUOTE, not on the chunk. Three now run; ⚠ and a
length threshold was wrong too (twelve words flagged three real eleven-word submissions), so the
rule is a SHAPE, not a number tuned to four examples.
❌ **NO recall figure published and none superseded** — the baseline is NOT re-run until Charlie
validates the re-keys, per the brief. ⚠ When it is, **expect the headline to rise for a reason that
is not an improvement in search.**
▶▶ **CHARLIE: five decisions in `docs/SEARCH_S17_REPORT.md`** — D-1 a document-level match rule,
**D-2 validate the ten re-keys (the gate on everything else)**, D-3 regenerate the eight-day-old
`corpus_reachability.json` that is wrong for seven collections. ⚠ No file under
`scripts/ingest/search/` was touched, so `vector-serve`'s auto-deploy was not triggered and no
measurement was interrupted — checked, not assumed.
Earlier: 2026-08-27 23:23 UTC — ▼ **OPS: THE TWO SEARCH SERVICES NOW SLEEP, AND THE LEGACY DATABASE
`pg_stat` CALLS EMPTY HOLDS 1.25M ROWS.** ⚠ **Order kept**: search timeouts raised **and confirmed
in the live build** before `sleepApplication` was touched — the other order breaks search for
whoever arrives first after each doze. ⚠⚠ **`scrutinise-db` IS NOT EMPTY.**
`pg_stat_user_tables.n_live_tup` reported **0 rows for all 68 tables**; real counts are
**1,251,338 rows over 2,029 MB**, incl. **29 Users and 54 Ideas from before the Neon migration**.
Stats were reset; the data was not. **Anyone reading that view would have deleted it.** ▶ No
`pg_dump`/Docker here, so the dump goes through the wire protocol (catalogue DDL + `COPY … TO
STDOUT`): **585.3 MB gz in R2 → 1,918.2 MB SQL**, verified by re-download against **all 68 live
row counts**. ⚠ **The verifier is streamed because v1 could not read its own backup** — held the
SQL in a string, died on V8's 512 MB cap. **A verification step that cannot run on the real
artefact verifies nothing.** ▶▶ **CHARLIE: THE DELETION IS PREPARED, NOT DONE** (it destroys a
volume, no undo) — one command in `docs/OPS_SLEEP_AND_DECOMMISSION.md`; it **refuses unless it
re-verifies the backup against live in the same run**. ⚠⚠ **THE MEASUREMENT PREVENTED THE THING IT
MEASURED** — the first cold-start script polled `/health` every 15s, which IS inbound traffic, so
it held both services awake and reported they never slept (reads as "sleep doesn't work on this
plan"). Now waits in SILENCE, one request, and refuses to call anything under 3s a cold start. ⚠ **I
made the same mistake by hand with curl.** ⚠ **DO NOT SIZE THE TIMEOUT FROM `/health`**: restart →
first SERVED QUERY was fts **12.1s** (health 10.0s) and vector **13.5s** (health **6.7s**) — a
**6.8s window where the container is up, health is green and a search still fails.** Budgets
**25s → 75s**, named `*_COLD_START_MS` and commented as a wake allowance so nobody tunes them as a
latency target; **code defaults, not env vars** (Vercel token is SAML-blocked). ▶ `sleepApplication`
confirmed available **by querying the GraphQL schema**, set and **read back** on both. ▶
`POST /api/search/warm` from **exactly two places** (ideas hub, proposal surface) — ⚠ **never a
layout: that would keep both awake and silently undo the saving**; signed-in only, **401 verified
live**. ▶ `search-wait.ts` keeps **waking/searching/failed** apart, shown only when the probe says a
service really was asleep. ⚠ **THE COST MODEL WAS OUT BY 60×** — `MEMORY_USAGE_GB` is a SUM OF
PER-MINUTE SAMPLES, not GB-hours ($2,530/mo for a project billing tens); corrected and calibrated
against the one known figure (bill $3.11 vs computed $2.59). ▶▶ **$42.17/month, of which fts-serve
$18.30 + vector-serve $19.44 = $37.74 — 89% — for two services idle almost all the time.** After
sleeping + removing the legacy DB: **≈$5–9/mo plus awake time**; ⚠ no single saving figure claimed
until pilot traffic exists — re-run `ops/cost-estimate.ts` in a week.
`docs/OPS_SLEEP_AND_DECOMMISSION.md`.**
Earlier: 2026-08-27 16:35 UTC — ▼ **THE CASE REFERENCE LAYER: WE CAN SAY WHAT A CASE IS
WITHOUT HOLDING IT, AND FIVE OF SEVEN PREDICTIONS WERE REFUTED.**
Ask about **Caparo** today and rank 3 is *Unite The Union v Caparo Atlas Fastenings Ltd*; ask about
**ex p Coughlan** and you get *Mrs M Coughlan v Brookes Jordan Ltd*. Re-measured live: **10/10
authorities not held, 3/10 returning a DIFFERENT same-name case, and 10/10 still returning a full
answer set.** Nothing returns nothing — a confident wrong answer is worse than an empty one.
▶ **74,894 judgments read in 25 minutes · 708,371 citation occurrences · 184,613 distinct citations ·
49,666 pre-2003 · 641,617 citing-document links.** The top of the list is what a lawyer would name:
ICS v West Bromwich 798, Easyair 771, Johnson v Gore Wood 587, Ladd v Marshall 436, **Wednesbury
400**. **200 reference records built** — 54 held, 88 not held, **58 UNKNOWN** (a law-report citation
dated 2003+ may be held under its neutral form; claiming "not held" would tell a user we lack
something we have). **162 of 200 say only that the case exists and is cited** — nothing we hold says
what they decided, so the record says nothing. That is the design, not a shortfall.
⚠⚠ **THREE DEFECTS FOUND BY READING THE OUTPUT, NOT THE CODE.** (1) The "malformed matches" list was
not malformed — **nine of the ten most-cited-but-never-named citations are `Re B`, `Re H`, `In re E`**.
A `X v Y` pattern cannot match a name with no "v" in it, so **the entire family-law canon was
arriving unnamed and therefore unfindable by name**; fixed, and unnamed among the top 200 fell
**10 → 1**. (2) **Every judgment cites itself** — its header carries its own neutral citation, 176 of
a random 200 (88.0%) — so every held case overstated its citation count by one; corrected per record,
and it fired on **54 of 54**. (3) A description taken from the top of a document **is not about the
case**: the dry run put an Explanatory Note about remedial powers under *Anisminic*'s name.
⚠⚠ **AND THE FIRST FULL RUN LOST ITSELF** — 36,000 judgments and 97,940 citations gone to
`memory allocation failed`, with everything in a Map and the JSONL written once at the end: **the
exact defect that file's own header warned about**, and it **exited with code 0** because the Rust
allocator aborts without setting a failure status. Sharded now; the merge refuses to write an
aggregate smaller than its largest input.
▶ **FOR CC-SEARCH — the handover, no search file edited.** Before **10/10 absent, 3/10 decoy**;
after **10/10 resolve to the right reference record**, as a SUFFICIENCY DEMONSTRATION over the
records and not the shipped ranking. The three numbers in order: **6/10** (all-words matcher, pilot
data) → **8/10** (overlap matcher, pilot data) → **10/10** (matcher UNCHANGED, full data). ⚠ Do not
suppress the decoys — *Mrs M Coughlan* is a real case.
▶ **BAILII read, not assumed:** linking is *"encouraged"*; bulk downloading and storing HTML versions
of judgments are forbidden. **So we link and never fetch.** 75 of 200 links are deep (the neutral
citation determines the path, flagged `derived`, unverified because verifying means fetching); the
other 125 carry BAILII's search page. No URL is invented.
⚠⚠ **THE PREDICTION LESSON: THE PILOT WAS NOT A RANDOM SAMPLE AND I TREATED IT AS ONE.** It said
76.1% pre-2003; the corpus says **26.9%**. A `tna-caselaw` id BEGINS WITH ITS CITATION, so id order
is chronological and the "first 400" were all from 2003, our earliest year. **Sample by `md5(id)` on
this corpus, never by `id`.** Also: *Donoghue v Stevenson* is cited in **67** of 74,894 judgments, a
sixth as often as *Wednesbury* — foundational authority is assumed, not cited.
▶▶ **CHARLIE: four numbered decisions in `docs/CASE_REFERENCE_LAYER_REPORT.md`** — how many records
ship, whether derived BAILII links ship unverified, whether held cases get records too, and whether
`committees-reports` gets its ~3-hour scan. ⚠ **The collection is STAGED, not loaded**, and a row in
the database is not a row a user can find until the index is rebuilt and the rebuild verified through
the real gateway. Nothing here touched the live site.
Earlier: 2026-08-27 18:54 UTC — ▼ **LEX 25-J: THE IDEAS HUB, AND A GUARD THAT CRIES WOLF GETS TURNED
OFF.** ⚠ **§5 IS SUPERSEDED AND ITS ONE-BUILD CEILING IS UNSPENT** — the brief says the six qualities
"have never been measured"; they were measured at 12:28 UTC the same day (25-I addendum), so running
another would be spend for a number already in hand. From v5, a build that FINISHED: **three of six
in the output**, and the figure §5 wanted — **107,380 → 55,626 input tokens, 48% reuse saving**,
replacing the 85% ceiling taken from runs that died at pass 5 and looked cheaper for stopping early.
▶ **§1 one voice**: nine collection labels to "my" across six surfaces, nav **Create → My ideas**.
⚠ **The five-stage vocabulary is UNTOUCHED** — `STAGE_1` is still *Create* (CLAUDE.md §4); a sweep
that renamed it would have broken the shared vocabulary and looked like tidying. ⚠⚠ **THE SWEEP
GUARD FIRED ON CORRECT PROSE TWICE** — `ideas?` flagged *"Your idea has reached Parliament"*, the
plural still flagged *"Export all your ideas, contributions and votes"*. **The distinction is HEADING
vs SENTENCE: a heading IS the whole label**, so the phrase must occupy the entire text node. A rule
about structure, not a list of exceptions — a new `<h2>Your ideas</h2>` fails the day it is written.
▶ **§2 the hub**: `RecentIdeasPanel` deleted (its own header said to, once a real surface existed).
⚠ **It carried `title` and deliberately never showed it** — right for a stopgap when 11 of 11 ideas
were "Untitled idea", wrong for a front door. Now a real title wins and the user's **own opening
words** stand in otherwise, LABELLED as theirs. ⚠ Placeholder test is an EXACT match — "looks
generated" would misfire silently on *Untitled thoughts on buses*. The list shows only before an idea
exists, so the transition is a transition. ⚠ **25-I §1 HELD and is re-asserted: nothing is created by
arriving.** ▶ **§4 — I CORRECTED MY OWN REASONING**: last sprint filed statutory consequences under
`LAW_NOW`; §4 is right that they are **two questions, not two answers to one**, and sharing a heading
made the pass INVISIBLE among the legal map's findings. New heading **`REFERS_TO_THIS` — "What else
refers to this law"**, immediately after `LAW_NOW` since `HEADING_ORDER` is the panel order. **A
group now OPENS TO ITS MEMBERS**, deduplicated on (document, provision), capped at 12 with the
remainder counted — two references in one section are ONE place to read. ▶ Other sprints' guards
fired and were right every time: **25-F** pinned the deleted panel (repointed, property unchanged);
**25-D**'s "ten headings" is now eleven (still counted — a check that stops counting stops noticing a
section nobody designed). ✅ `check:lex-25j` **12 passed, 7 controlled**; `verify:my-ideas-ui` **15
passed** (renders markup); deepening pass, statutory 17, 25a–25i green; `tsc`, `next build`,
clean-build `--fast` clean. `docs/LEX_25J_REPORT.md`.**
Earlier: 2026-08-27 15:21 UTC — ▼ **INGEST CENSUS C1 PARTS B AND C: THE EMAIL FINALLY READS A DENOMINATOR SOMEBODY ELSE SET — AND THIS MORNING'S PURGE IS ONE LAYER SHORT.**
⚠⚠⚠ **READ THIS FIRST: THE PURGE RAN AT 02:20 TODAY BUT ONLY INTO NEON. `corpus_fts` STILL HOLDS
18,272,377 ROWS INCLUDING 36,919 FROM THE SEVEN PURGED COLLECTIONS**, measured 15:00. Rows deleted
twelve hours ago are still being returned with no source row behind them. ⚠ `l2-purge-index.ts`
**cannot run from this machine** — OOM in LanceDB's Rust layer at batch 4,000 and again at 400
(131,650 ids against 18M rows, no scalar index on `id`). §17. **DECISION B-1, and the only item
currently costing a user anything.** C3 steps 6–8 and ALL of C3A also still unrun.
✅ **Part A confirmed complete**; nothing needed re-running.
▶▶ **`corpus_census` EXISTS, AND ITS CHECK CONSTRAINTS ARE THE DELIVERABLE.** It refuses MEASURED
without a denominator, without a walk artefact, an undefined state, hollow>held, and published==held
without a deliberate `EXACT:` token. Seven refusals + one acceptance, watched.
⚠⚠ **TWO OF MY OWN CONSTRAINTS WERE WRONG AND THE TEST CAUGHT BOTH.** The first accepted any
non-null `notes` — and every walker writes notes, so it waved through **six** exact matches. Then
`notes LIKE '%EXACT:%'` let through the one row it most needed to refuse, because **`NULL LIKE …`
is NULL and a CHECK constraint PASSES on NULL**.
✅ **pwdata 7/7 MEASURED, unit = sitting DAY not file** (20,080 files → 16,039 days). CCh predicted
>98%; measured **100% on six streams, one day short on the seventh — and that day is the HTTP 503
in this same email's ISSUES block**.
⚠⚠ **FOUR API DENOMINATORS WERE BROKEN ON THE FIRST RUN AND WERE DEMOTED, NOT SHIPPED**
(`quangos-govuk` 126,306.5% · `consultations` 647.7% · `hmrc-tiins` 791/0 · `tax-tribunals`).
**A wrong denominator is worse than none — it prints as fact.** consultations was a missing
`consultation_outcome` filter → **99.8%**; the rest are UNMEASURED behind a new `proxy:true` flag.
▶ **GAPS THAT PRINTED AS COMPLETE YESTERDAY: `bills-api` 10.4% · `petitions` 36.6% · `echr-hudoc`
55.0% · `committees-reports` 58.1% · `hmrc-manuals` 80.9% · `members-interests` 84.1%.**
`committees-reports` is S16's finding from the ingest side — **42% of the publications Parliament
lists are not held at all**, which is a different problem from S16's broken answer keys.
✅ **LEGISLATION DONE — 1,280 feeds walked by ENTRY, 0 unreadable, 20 rows.**
**`primary-acts-pre-2000` 21.7%, independently reproducing the brief's 21.4%** · `si-pre-2010`
**72.2%** · `si-2010plus` **69.9%** · `devolved-nisr` **63.4%** · `devolved-wsi` **70.1%** ·
`asp` 99.8%. ▶▶ **FOUR TYPES AT 0%, 20,764 PUBLISHED INSTRUMENTS: `ukla` 20,172 · `apni` 288 ·
`ukcm` 244 · `ukci` 60** — none had a row of any kind before today. **B-7: do `apni` first**, it is
288 instruments and OI-18 already blames absent NI legislation for the commonest unresolved
citation in the corpus.
⚠⚠ **THE RETRY WAS WORTH MORE THAN THE FIRST WALK: 31 throttled feeds were recorded as NOTHING, not
as zero**, and recovering them moved `uksi` 80,418 → **109,212** and `eur` 73,981 → **124,855** —
79,000 instruments, 32% of the universe. A 429 written down as a 0 would have made `si-pre-2010`
read ~97% instead of 72.2%.
⚠ **THE ONE PERCENTAGE I WOULD NOT DEFEND: the three EU rows.** `/eur/` publishes what
legislation.gov.uk holds for the UK; our collection is scoped to **assimilated** law, a subset. So
20.2% is a floor on a possibly larger universe. Caveat carried in the census row itself. **B-6.**
⚠⚠ **TWO PERFORMANCE DEFECTS IN MY OWN WALKER** (a 109,212-element array against an unindexed
expression, and a per-type correlated GROUP BY costing ~30 min each) — both now read once per corpus
key. **And eight `walk-legislation` processes were still alive while I diagnosed it: every run the
harness reported "killed" was still running and contending for Neon. I trusted the notification
instead of the process tree.**
✅ **Part C: the email reads `corpus_census` and CANNOT fall back to `est_sections`.** Headline is
now the **SEARCHABLE** corpus (18,103,959) with the legacy 914,274 beneath it and never added in.
`100% complete` lives behind ONE clamp in ONE function. **The negative control was watched printing
the tick first: the old rule ticks 7/7 of the 22 Aug fixture including a corpus holding ZERO
sections; the new one ticks 0/7.** ⚠ It also caught **a shortfall that ROUNDS to 100.0%**
(4,681 of 4,682) — now prints the missing day in words.
⚠⚠ **AND THE CENSUS CONTRADICTED THE PURGE: `et-decisions` was retired AND blocked though only its
landing pages were deleted — 161,753 real judgments sit under a retired flag.** Hides nothing from
users (`runSearch()` does not read `corpus_targets` — checked), but drops them out of every report
that filters on it. **DECISION B-2, one UPDATE.**
**FINAL CENSUS: MEASURED 40 · CLAIMED 1 · UNMEASURED 40 · RETIRED 18 · NOT_STARTED 2 · BLOCKED 1,
and 331,751 units measurably absent — a number that did not exist this morning.**
▶▶ **CHARLIE: seven decisions in `docs/INGEST_CENSUS_C1_B_REPORT.md`.** Parts D, E, F not started;
historic-hansard, Find Case Law and the three devolved Official Reports not walked.
Earlier: 2026-08-27 14:23 UTC — ▼ **SEARCH S16: HALF THE QUESTIONS FIND NOTHING — AND FOR COMMITTEES THE RULER IS BROKEN, NOT THE RETRIEVER.**
▶▶ **§2 IS THE SPRINT: all 32 failing questions classified one at a time, by probing.**
ABSENT **1** · UNREACHABLE **4** · NOT-ROUTED **4** · RANKING **4** · NOT-MATCHED **19**, with
**12 of 32** on long documents scored whole. Artefact `docs/census/s16-autopsy.json`; the classifier
**refuses to run against a degraded arms file**, so S14's mistake cannot repeat.
⚠⚠ **THE FINDING THAT CHANGES WHAT THE NUMBER MEANS: committees' documents ARE indexed and
retrievable — each key's own title returns it at rank 1, 1, 2 and 4. The ANSWER KEYS are not what
the questions ask for.** 10 of committees' 19 keys are `Correspondence:` ministerial letters
(**0 of 19** in every other collection) while the questions ask what a *committee* said; 3 more are
ONE evidence submission out of **525 · 115 · 54** equally valid ones. **Control: the only
evidence-keyed committees question that IS found comes from the smallest class, 1 of 26.**
▶ **8 of 10 committees questions cannot be scored fairly as posed. D-3 — re-key it, as debates is
already being re-keyed. Highest-value item in the sprint.**
▶ **§1 `fts-serve` HARDENED AND PROVEN LIVE** on `build: S16-fts-cancel-bounded`. ⚠ Its width is
**16, not the 4 the brief states** (code default 4, env override on Railway — read `/stats`, never
the file). `check-fts-shed` **9/9** (48 at capacity → **0 shed**; 56 → **8 for 8 excess**, slowest
refusal **468 ms**), `check-fts-cancel` **3/3** — 40 abandoned, **served +16 (exactly the width),
abandoned +24 (exactly the queue)**, recovery **6 s**. Its `/stats` reported `maxQueue: null,
rejections: null` before, so a saturated service and a healthy one looked identical.
⚠ **The index question was asked: `corpus_fts` 18,272,377 indexed / 0 unindexed.** Not S15's defect.
▶▶ **§3.2 DENSE FOR `debates` REVERSES THE JUNE DECISION: 0/11 → 3/11, 3 gained 0 lost**, one answer
not-found → **rank 2**. June asked "does this find the right debate?"; this asks "the right
passage?". **D-1.**
⚠ **§3.1 `LEX_ROUTER_STREAMS_V2` NOT RECOMMENDED, and my prediction was wrong in direction** —
predicted 32 → 34-36, **measured 32 → 29**; impact-assessments **4/9 → 2/9**. With 8 streams the
router gets MORE selective: **34 of 64 questions route to ONE stream, against 20.** The dedicated
stream works (S10-Q33 unreachable → **rank 1**) and costs more than it gains. ⚠ Confounded by
`--reroute`, which **also silently overwrote the shared route cache** — restored from git.
▶ **§4 the gold queries are CLEAN: 41 of 41 written, median 7 tokens, 0 truncated.** The
`… those system pr` defect is on the BUILD path → Lex stream. ⚠⚠ **Two of my own guards were caught
being wrong by their own self-tests** — a stopword *threshold* that could not catch the one real
example, and an arrival check looking for `'fused'` when fusion writes **`'rrf'`**.
❌ **NOTHING WAS ENABLED IN PRODUCTION. 45 of 64 questions still return nothing correct.**
▶▶ **CHARLIE: six decisions in `docs/SEARCH_S16_REPORT.md`** — D-3 re-key committees, D-1 debates
dense, D-2 who owns the unreachable `other` tier (`cps-guidance`, `scottish-parliament-or`).
Earlier: 2026-08-27 10:44 UTC — ▼ **SEARCH S15-CAPACITY: THE BLOCK IS THE OBJECT STORE, AND THE PLATFORM HAS NEVER ONCE MEASURED ITSELF WITH DENSE RETRIEVAL ACTUALLY WORKING — UNTIL NOW.**
▶▶ **§1, four hypotheses, predictions logged before testing. TWO OF THREE WERE WRONG.**
**H1 arbitrary constant ✅** · **H2 processor ⚠ PARTLY** · **H3 memory ❌** · **H4 storage/network ✅ DOMINANT.**
⚠⚠ **`os.cpus()` ON RAILWAY REPORTS THE HOST, NOT OUR QUOTA. The container has 8 vCPU, not 48**, and
at width 16 it already burns **4.1–4.6** of them. The 04:12 draft called CPU "nowhere near a limit…
against a host reporting 48 cores" — that was an inference wearing a measurement's grammar (§19),
and it is the number every future width decision rests on. It also retro-explains why width 32 was
worse.
⚠⚠ **H3's size prediction was wrong by 20×, and the reason is the finding.** `corpus_vec.lance` is
**147.58 GB** (`data` 130.55 + `_indices` 16.92) = **6,990 bytes/vector, 2.3× LARGER than raw f32.**
PQ compression is real but lives ONLY in `_indices` (746 B/vector, 4.1×); `data` keeps the original
vectors — and **`refineFactor: 2` fetches them on every query**. Also: `corpus_chunks/_versions` is
**13.39 GB of stale manifests**, 29% of that dataset, serving nothing.
⚠ **NOT measured, named: bytes per query.** Railway's `NETWORK_RX_GB` never moved. H4 rests on four
converging indirect lines. **Its fix — co-location on a volume — is costed at ~$31/month for 193 GB,
inside the brief's $50 line, and deliberately NOT done: D-8.**
▶▶ **§6: THE BASELINE IS RETAKEN AND IT IS THE FIRST NON-DEGRADED FOUR-STREAM MEASUREMENT EVER
TAKEN HERE** (`degraded: []`, `vector+209`). ⚠ S14's own artefact is named **`s14-arms-bm25.json`**
and records `streams=NONE … DEGRADED(1)` — its recall figures describe a **keyword-only** system.
**in-stream@20: S13 27/64 · S14 19/64 · S15 32/64. round-robin: 15 · 14 · 19/64. judged+reranker:
— · 19 · 30/64. @5 judged+reranker: — · 15 · 26/64.** Both earlier baselines are VOID.
**Dense retrieval is worth THIRTEEN points of in-stream recall; S14 predicted "roughly twelve".**
My predictions (logged first): in-stream 24–32 → **32** ✅; arm A 18–24 → **19** ✅; dense arrived ✅;
rejections 0 ✅.
⚠⚠⚠ **READ THIS BEFORE THE GOOD NEWS: with today's production configuration 45 of 64 questions
return nothing correct. With the merge+reranker on, 34 of 64. A PERFECT merge could only reach 32,
because retrieval finds nothing at all for half the set. THE MERGE IS NO LONGER THE CONSTRAINT;
RETRIEVAL IS.** `debates` **0/11** every arm · `committees` **2/10** · `impact-assessments` finds
4/9 and displays **0/9**.
▶ **§3's acceptance measure — rejection rate — is ZERO on every real workload** (40/64/96 legs at
2/4/8 users, and **209 across the whole gold sweep**); non-zero only when the shed path is
deliberately overloaded (6 of 54, by design).
▶ **Proof the capacity work landed: the gold harness no longer needs its throttle.** `s14-run.sh`
ran at `LEX_STREAM_CONCURRENCY=1`/90 s because that was "what makes the measurement possible at
all"; `s15-run.sh` uses production's 3/25 s and finished clean.
▶▶ **CHARLIE: eight decisions in `docs/SEARCH_S15_REPORT.md`.** D-5 turn the merge+reranker ON
(+11 questions, ZERO lost, 0.214p/query). D-3 the next sprint is RETRIEVAL, not ranking. D-4 needs
one dashboard action (connect the `vector-serve` repo trigger). **Spend: €0.008 + 13.68p.**
Earlier: 2026-08-27 11:58 UTC — ▼ **LEX STATUTORY CONSEQUENCES: THE FIFTH DEEPENING PASS IS BUILT,
WIRED AND DRIVEN LIVE — AND THE COUNT IS THE SCALE, THE CLASSIFICATION IS THE WORK.** ⚠⚠ Charlie's
question answered with real numbers: **repealing the Equality Act does NOT mean 1,868 consequential
amendments.** CRaG 2010's 149 provision references classify **92 no-action, 44 replace, 13
amendment-related**. ⚠⚠ **§5'S SUGGESTED CAVEAT IS FALSE AND WOULD HAVE MISLED EVERY USER** — the
brief says SIs are not indexed; **SIs are the LARGEST source type, 793,616 of 1,034,548 rows, and
1,347 of the Equality Act's 1,868 references come FROM SIs**, so that sentence would tell a user we
cannot see the layer supplying 72% of their answer. What IS missing is the **made-under** relation.
⚠ **This is the case FOR the computed rule**: a hand-written caveat was wrong within a fortnight.
⚠⚠ **A THIRD OF `citation_text` IS LEAKED XML — 334,740 of 1,034,548 rows (32.4%)**, which matters
most here because §3 requires every disposition to be traceable to those words; cleaned at read
time, what cannot be cleaned is **counted not dropped**, and **reported upstream rather than fixed**
(the extractor owns the column). ⚠ **`inbound()` CANNOT BE CALLED FROM THE WEB APP** — different
package, §20 check 0, plus `fs` and a 4GB zip absent on serverless; the TABLE is reachable, so
`statutory-graph.ts` is a **second reader**, a drift risk made LOUD by `verify:statutory-parity`
which **found a real gap on its first run** (the `amendment-effects` layer was missing — the one
this feature can least afford to lose). Parity now holds row-for-row 182/182 and 1,868/1,868.
⚠ **INDEX DEFEAT**: `lower(target_act_id)` = seq scan over 1M rows, **474ms vs 3.7ms — 127×**; but
dropping `lower()` naively would be WRONG — **3,531 rows are the pre-1963 regnal-year Acts**
(`ukpga/Vict/24-25/100`), exactly what a repeal programme touches. Measured first: **no id is
stored in two casings**, so equality against both forms is complete AND indexable. 25,005ms →
4,771ms. ▶▶ **§6 COST: the large target costs the SAME as the small one** — 1,552 refs and 149 both
give **6 groups, ONE call** — and a wired run is **0.1007p, re-read from `LlmSpend`, ~1.5% of a
6.8p build. It does NOT double a build.** ▶ **DECISION FOR CHARLIE: include it in every build, or
offer on request?** §6 said report the figure, do not choose. ▶ **check:deepening fired 3× and was
right every time** — job key == pass key (now `CITATION_CONSEQUENCES`); the hardcoded four-pass
count; and "every pass must declare intents", whose real invariant is *a pass must be able to
retrieve* — ⚠ as written it would have FORCED the defect §7 forbids. `jobQuestion`'s two-way
ternary would have silently handed a third job the devolution question; now a `Record<JobKey,…>`.
✅ `check:statutory` **17 passed, 7 controlled**, all watched rejecting, incl. §8's *"a check fails
if any coverage wording is a literal"*; deepening all pass; 25a–25i green; `tsc`, `next build`,
clean-build `--fast` (0 cross-package files). ⚠ **check:statutory failed twice first and both
defects were in the CHECK** — it matched a template literal containing code and read an array index
as a corpus figure. **A guard for prose has to know what prose looks like.** ▶ **TO SEARCH/GRAPH,
reported as sent, none of their files edited**: (1) the cross-reference graph should be its OWN
listed graph in `SEARCH_STRATEGY` §9; (2) the **32.4% XML-in-`citation_text`** defect.
`docs/LEX_STATUTORY_CONSEQUENCES_REPORT.md`.**
Earlier: 2026-08-27 04:12 UTC — ▼ **SEARCH S15: `vector-serve` NOW REFUSES WORK NOBODY IS WAITING FOR — AND THE REASON IT WAS SLOW WAS NEVER ITS WIDTH.**
▶▶ **§1, FIRST, BECAUSE IT REWROTE THE BRIEF. 1,478,964 rows of `corpus_chunks` (6.5% of
22,670,808) had fallen outside its `sectionId` index and were brute-force scanned on every single
snippet lookup.** An equality lookup on the **indexed** column took **133,401 ms**; the same table's
**unindexed** `chunkId` answered in **21,470 ms**; the ANN it decorates takes **1,301 ms**. Corroborated
on the bill — `vector-serve` shows **3,168.5 GB of ingress** month-to-date.
⚠⚠ **The file's own header predicted it in writing** ("THIS INDEX WILL NEED REBUILDING IF THE
MAX_CHUNKS TOP-UP HAPPENS") **and its `--verify-only` could not fail**: it asked *"is there an index on
this column?"*, which an index missing 6.5% of the table answers YES, and printed **"Nothing to do."**
It now reads coverage and exits 4, watched firing against the real state first.
▶ **Rebuild: 45.1 s, €0.008, 0 unindexed. Snippet stage 3,296 → 1,233 ms · total 5,421 → 3,394 ms ·
peak RSS under load 5,586 MB (73% of cap) → 1,253 MB — with the ANN unchanged (1,889 → 1,934) as the
control.** ⚠ **This is a RECURRING job: every append to `corpus_chunks` leaves new rows outside the
index. Run `build-chunks-scalar-index.ts --verify-only` after any ingest that appends chunks.**
▶ **§2 proven from OUTSIDE, both ways.** Before: **12 of 12** abandoned requests executed after every
client was killed, recovery **19 s**. After: `served +0 · abandoned +48`, recovery **6 s** — and not
even the four already running finished, because the between-stages check dropped them before the
expensive scan. ⚠ Abandonment is counted **per cache key, not per socket**, or coalesced requests
would be stranded.
▶ **§3:** queue cap is now `2 × width` (was 64 on a 4-wide service — sixteen service times);
**6 shed for 6 excess, slowest refusal 420 ms** against the 25,000 ms timeout it replaces, with a
negative control at exactly-capacity that refuses nothing. A shed now reaches the gateway as
`meta.denseDegraded` / `reason: 'overloaded'` — **closing S14 §0, where a refused dense leg was
byte-for-byte identical to a stream that never had one.** `check:dense-degraded` **14/14**, and it
caught a real `Promise.all` fault turning one stream's fault into a total batch failure.
▶ **§5: width 4 → 16, throughput 2.20 → 4.43 req/s, cost £0.00** (one env var, same single replica,
peak 16.4% of cap). The 4 was a constant **copied from `fts-query-service.ts`**, whose own 7 Aug note
already recorded that 64 concurrent survived here.
▶ **§6: eight concurrent users × four dense streams = 96 legs, 0 shed, 0 timed out**, per-stream p50
4.3–5.9 s — against S14 where ONE user saturated it and `warm_p95` hit 706,954 ms, still climbing
forty minutes after every client had died.
⚠⚠ **§4 IS REFUTED BY ITS OWN MEASUREMENT.** The batch endpoint is **126% SLOWER** (6,495 vs 2,873 ms)
— it serialises four ANNs inside one slot while four solo requests parallelise theirs. Built, live,
**id-for-id identical 20/20**, and **not recommended for wiring**.
❌ **NOT DONE, NAMED: the 64-question recall baseline is NOT re-taken** — the next sprint's first job,
and possible for the first time. ⚠ **`fts-serve` still has an unbounded queue, no cancellation and the
same copied width of 4** — recommended as the next sprint.
▶▶ **CHARLIE: six decisions in `docs/SEARCH_S15_REPORT.md`.** D-4 needs one dashboard action —
connect the GitHub repo trigger for `vector-serve`, which the project token cannot do.
**Total sprint spend €0.008.** Earlier: 2026-08-27 03:15 UTC — ▼ **PRINCIPLE 7: THE LICENCE APPLICATION'S CLAIM WAS FALSE IN
EVERY PART, AND ITS PREMISE WAS WRONG TOO.** The draft says judgment pages carry `noindex, nofollow`
and that `robots.txt` disallows those paths. Read off production before touching anything:
`robots.txt` said **`Allow: /ideas/`**, **no page carried a meta robots tag**, **no response carried
an `X-Robots-Tag`**, and **GPTBot / ClaudeBot / CCBot / Bytespider were each served the full 42 KB**
of a public proposal page. No rate limit (20 sequential and 10 concurrent all 200), no WAF.
⚠⚠ **AND THERE IS NO JUDGMENT PAGE TO NOINDEX.** Judgment text reaches a reader only as a
**252-character median extract** inside a PROPOSAL page — the surface the product had deliberately
made public, and which `sitemap.ts` was written to advertise to Google **the day any proposal
reached Stage 4**. It produced 0 entries only because none has: the sitemap was clean by accident,
not by design.
▶ **Every `/ideas` page is now `noindex, nofollow` in THREE places** — the meta tag, the
`X-Robots-Tag` header (which also covers the public JSON reads that have no HTML to tag), and
`robots.txt`, because a crawler may honour any one and ignore the others. **`robots.txt` names 27 AI
and bulk-collection crawlers individually**; a wildcard does not bind an agent that looks for its own
name. Proposals are out of the sitemap.
⚠ **A per-proposal flag was REJECTED — Charlie's call, and the right one.** It would have kept
proposals discoverable by noindexing only the ones carrying a judgment extract, but the application
states this as a **fact**, and a detector that silently stops firing turns a legal claim false with
nobody watching. **Cost accepted: no proposal page appears in any search engine.**
✅ **VERIFIED FROM OUTSIDE on `b093e89`, with a control**: the three proposal pages return
`noindex, nofollow, noarchive, nosnippet` on both the header and the meta tag, the sitemap has
**0 of 25** entries under `/ideas/`, all five named AI crawler User-Agents get the noindex header —
and **`/` and `/about` still read `(none)`**, which is what distinguishes a targeted rule from a
blanket one.
▶ A **120/min per-hashed-IP speed bump** now covers the corpus-bearing paths, **watched firing at
request 141 with `Retry-After: 60`**. ⚠ It fired at 141 rather than 121 because the counter lives in
one edge instance's memory — **reported as a speed bump, never as a control**, since a collector
that spreads its requests gets a fresh budget from each instance.
▶▶ **Q21 = NO.** An extract is 252 characters at the median (max 776) against a median stored
case-law section of ~37,575 — about **0.7% of one section** — and **74,896 of 74,896** case-law
records carry their Find Case Law URL. Today **0 of 135** evidence rows carry any judgment text at
all.
▶▶ **CHARLIE: two things before 4 September.** (1) `docs/PRINCIPLE_7_EVIDENCE.md` is written and
every line in it was read off production — attach or paraphrase it. (2) ⚠ **The definitive index
check is Google Search Console, which cannot be read from this machine (§19)** — one minute of your
time, and the number belongs in §5 of the pack before submission. ⚠ Nothing here touches retrieval:
Lex's corpus search is server-side and reads no robots directive.
Earlier: 2026-08-27 03:09 UTC — ▼ **LEX 25-I: THE DOCUMENT PIPELINE HAD NEVER ONCE RUN, AND THE
REUSE CARRY DESTROYED THE RESEARCH IT REUSED.** The brief's instruction to VERIFY ON THE LIVE SITE
BEFORE CHANGING ANYTHING is what made the sprint worth running — three of six sections found
something different from what the brief or 25-H believed. ⚠⚠ **`IdeaUserMaterial` held ZERO ROWS
across the whole production database**; 25-H reported §4 shipped and the component IS real, but
nothing had ever been through it. Driven with Charlie's own document (40,877 bytes) it **discarded
73% of what it read** — 15 findings offered, **11 dropped** as *"the quote could not be found in the
document"*, and **ten of the eleven WERE in the document**. The eleventh shows the mechanism: the
model wrote `…over government. there` where the document has `…over government there` — ONE ADDED
FULL STOP. ⚠ `quoteIsInText` is ALL-OR-NOTHING over a whole passage, so one tidied character at
position 200 discarded a 300-character finding and told the user their document produced nothing.
⚠ **THE FIX MAKES PROVENANCE STRONGER, NOT LOOSER** — a similarity score would admit a
reconstruction, which is what the check exists to stop; `verbatimSpan` stores **the DOCUMENT'S own
words** for the longest matching span, so a quote is verbatim BY CONSTRUCTION rather than by passing
a test. **4 → 8 findings**, floor 20 → 60 chars, all four reconstruction controls still refused.
**Charlie's document is now attached to his idea with 8 findings** — it had been lost twice.
⚠⚠ **AND `carryEvidenceForward` MOVED THE EVIDENCE INSTEAD OF COPYING IT.** It runs inside
`claimBuild`, BEFORE a single pass, so any re-run claimed and then failed/cancelled/crashed took the
previous build's research away PERMANENTLY and the next one died with *"the research pass produced
nothing to revise against"*. Measured live: **69 rows stranded on a CANCELLED v2 that ran ZERO
passes**, v1 left with 9 of its 78. ⚠ `runVersion` must be a fact about that version — moving made
it mean "the newest run interested in this row", and v1's screen would blank the moment anyone
clicked Re-run. **Now copies; Charlie's 69 rows restored, each count re-read.** ▶ **§1: loading a
page created an idea** — the boot POSTed `/api/ideas` not to record intent but because it had no way
to draw the first question without a row. ⚠ **25-E's resume made this LESS VISIBLE without fixing
it** (minting only hit users whose rows were all empty or all built): *resume is not creation
control*. `blankElicitationState()` projects the first question from a blank row through **the same
`projectState`**, writing nothing; `ensureIdea()` creates on the FIRST ANSWER. ⚠ id in a **ref**
(state would not update in time and the first answer would drop) and the **URL still written**.
⚠ The old door had the identical defect — a bare `/ideas/create` now redirects to the current door,
testing the **resolved path** not the flag, or a flip back would loop. **Sweep 95 → 68 live ideas,
27 soft-deleted and each re-read, 12 KEPT for having real proposal fields.** ▶ **The walk found the
stale banner quoting the WRONG PRICE** — `staleUnderstanding` is `updatedAt > confirmedAt`,
`reuseSourceFor` refuses on `updatedAt > lastBuild.startedAt`; 25-H coupled them as "one event" and
they have DIFFERENT CONDITIONS. ▶ **§4a** cost joins duration, **measured**, unpriced builds
EXCLUDED not counted as zero, and it says "uses one of your builds" even with no figure because
silence reads as free. ▶ **§4b's premise is contradicted — it already exists** (25-G §1b, quoted
verbatim off the running site); verified and now guarded, not rebuilt. ▶ **§4c** the note renders
above the box and NOT hidden on a proposal. ▶▶ ⚠ **THE REUSE SAVING, MEASURED AT LAST: 107,380 →
15,590 input tokens, 91,790 saved, 85%** against 65% predicted (compare PERCENTAGES — the prediction
was against a 217,687-token build). ⚠ **It is a CEILING: the run died at pass 5**, so a completed
reuse build spends more. ▶▶ **CHARLIE: §5's six-qualities measurement is THE ONE THING NOT DONE.**
The build failed at pass 3 of 10 with zero evidence rows, so its 2-of-6 score measures the defect,
not the qualities. The defect is fixed; a second run costs ~7p and answers it properly — **§5's
ceiling is one build and spend is an explicit stop, so it waits on your word.** ✅ `check:lex-25i`
**14/14, 13 with negative controls**, all watched rejecting; 25a 40, 25b 54, 25c 32, 25d 77,
**25e 28**, 25f 62, 25g 27, 25h 20; `tsc`, `next build` clean. ⚠ **The 25-I check FAILED FIRST RUN
AGAINST CORRECT CODE** — its §5 assertion looks for the `updateMany` that used to move evidence, and
the fix DOCUMENTS that expression, so the guard matched its own explanation; it now strips comments.
**A source-text guard that cannot tell code from prose guards the topic, not the behaviour.**
⚠ **My harness produced a finding about itself again** — deleting a material without the route's
transaction orphaned 4 findings and the reconciliation caught it; I was one step from reporting it
as a product defect. **A cleanup path must be as faithful as the path under test.**
`docs/LEX_25I_REPORT.md`, `docs/CITATION_PASS_PREP.md`.**
2026-08-27 22:55 UTC — ▼ **CENTRAL STAGE 2i — THE RESOURCE GRID COULD NOT RENDER AN UPLOADED
FILE AT ALL, AND NEITHER SETTINGS SCREEN COULD BE FOUND.** Verified by walking production as
Charlie in the browser, which is how three of the four items were settled.

⚠⚠ **Item 4, the acceptance item never verified from either side, FAILED.** I uploaded a real PDF
and a real image through the live form: both saved, both appeared in the grid, and **both rendered
the generic type-icon tile**. The bucket is private, so a card needs a signed URL to show anything
— and **only the DETAIL view ever fetched one**, so `isImage && signedUrl` was false for every card
and each fell through to the fallback. `listResources` now mints a short-lived signed URL per
file-backed row (presigning is local HMAC, no network call); PDFs render their first page.
**⚠ Both existing checks passed throughout and were not wrong — they asked whether a resource was
CREATED and never whether it could be SEEN.** After the fix both URLs return HTTP 200 with the
right Content-Type and full byte counts (430,278 PNG / 49,680 PDF).

**Item 1 — the routes are `/communities/{id}/settings` (Community admins; a branch id redirects up
to its root) and `/settings` (per-user).** Both existed; neither was findable. ⚠ **THERE WAS NO
AVATAR MENU** — the avatar was a bare Link to /dashboard, and `/settings` was linked from **exactly
one place in the whole app**: an inline sentence in the Training exchange, shown only when you had
no phone number saved. No amount of looking would have found the accent picker. There is a menu
now and it names what is behind it. Community settings WAS in the Managing panel — as the fourth of
four identical outline buttons *below* the cards; it is now a peer card among Requests, Members and
Invite, which is where the eye goes.

**Item 2 — the rights gate was not a dead button.** It submitted, the server refused, and the
message appeared beside the BUTTON rather than the checkbox it was about. Now a dedicated error AT
the checkbox, in the error colour, row outlined and scrolled to, worded as an instruction. ⚠ The
button deliberately stays clickable: `disabled={!rights}` is the obvious fix and the wrong one,
because a disabled button cannot explain itself — which is exactly the reported state. ⚠ Second
defect found while fixing it: **the gate ran only server-side, AFTER the file was written to R2**,
so every refusal orphaned an object in the bucket.

**Item 3 — 2e specified the styled picker and the bulk-upload screen got it; the resource form,
written two sprints later, did not inherit it** and shipped a bare native input. **A specification
applied to one screen is not inherited by the next; a component is.** One shared `FilePicker` now,
asserted per screen.

⚠ **Two of my own new guards were too loose, and only their paired absence-checks caught them:** a
presence check for `href="/settings"` over the whole nav passed when the MENU's link was broken
because the mobile one still matched, and `includes('<FilePicker')` matched `<FilePickerX`. Scope a
presence check to the block under test, and use a word boundary on a component name.

✅ **720/720** (was 693), `tsc` and `next build` clean, deployed `9170bf2` and verified.
▶ **Two verification resources are left in Reform Branch Community**, both titled as such and both
saying “Safe to delete” in the note, so the thumbnails can be SEEN rather than taken on trust.
▶ Not verified: the PDF first page RENDERING in the card. The browser went to a 0×0 viewport near
the end and I stopped rather than thrash it; the data path is proven, the pixels are not.

2026-08-27 08:41 UTC — ▼ **CENTRAL STAGE 2h ITEMS 6–8 ARE BUILT — AND CHARLIE FOUND, IN THE
BROWSER, THAT THE APPROVAL FRAME HAD BEEN WIRED TO ONE SURFACE OUT OF TWO.**

⚠⚠ **The frame defect.** He reported the checkbox and the flag UI working and no bold or colour
framing on “Approved by Reform UK”. Correct: the answer card rendered `ApprovalLabel` and
`ApprovalCheckbox` and **never `ApprovalFrame`** — the 2px border and the superscript existed in the
component and were used by the Resources grid alone, so an approved answer was indistinguishable
from an unapproved one on the surface that matters most. **My check grepped the COMPONENT for
`borderWidth: 2`, which proves the component CAN draw a frame and cannot notice a surface that
imports the label and not the frame. A component test is not a surface test** — the third instance
of that shape this sprint. The check now asserts per surface that frame, tick and Context note are
each rendered. Fixed and deployed as `1c03af0`.

**Item 8** — unapproved now reads **“Awaiting {Organisation} approval”**, not “Not approved
material”: a position in a process rather than a verdict on the content.

**Item 6 — colour independence.** Charlie is colour blind, so a voted state differing from an
unvoted one only by teal-versus-grey means he cannot tell whether his own click registered.
⚠ **`aria-pressed` was already on every one of these controls and does not help** — it speaks to a
screen reader, not to a sighted person who cannot separate two hues. `lib/state-cues.ts` is one
vocabulary: a **solid glyph on, hollow off** (▲/△, ▼/▽ — four different characters, not one
recoloured) plus **`border-2`**. Five controls changed (question vote in the list, question vote on
the detail header, answer vote, resource vote, resource type chips). Left alone because they
already carry a second cue: flags and role badges (text), the AI label, the approval stamp,
favourites (★/☆), context chips and leaderboard tabs (**a filled background vs a white one is a
LIGHTNESS difference, which colour blindness preserves**), bulletin votes (`strokeWidth`), and the
leaderboard delta (red/green, but it prints a leading + or − and the sign is the cue).

⚠⚠ **Two findings came from the check, not from reading.** The platform’s OWN accent text
`--central-teal-text: #0f8b7f` scores **4.18:1** on white — **below the WCAG AA floor of 4.5, and
never measured**; now `#0d7a6f` at 5.21, same hue. And a **second question-vote control** on the
detail header the first sweep missed — found because the guard asserts the **absence of a bare
triangle** rather than the presence of a fix.

**Item 7 — per-user accent.** Reason on record: the platform accent is a teal close to one party’s
brand colour, poor for a neutral platform. Seven-entry **fixed palette**, each with three
**hand-set** values — deriving text colours by a fixed lightness shift is exactly what makes the
unreadable combinations free hex was rejected for. ⚠ **The check computes WCAG contrast per entry
and fails below 4.5:1**, which is what “pre-vetted” has to mean; it is what caught the platform
teal. Stores the palette **KEY, not a hex** (a hex column is free hex with extra steps); NULL =
never chosen, kept distinct from “chose the default”. ⚠ **Applied CLIENT-side on purpose**: reading
it in the root layout would opt the whole app, static signed-out pages included, into dynamic
rendering for a cosmetic preference. The check asserts the override set equals the tokens
`globals.css` declares, so a ninth token cannot leave a half-applied accent.

⚠ **Two of my own guards were narrower than their property.** The bare-glyph grep looked for a
triangle in quotes or between `>` and `<`, and a planted bare ▲ in JSX text walked past it — assert
the absence totally, and route even the hint copy through the vocabulary. And the token comparison
was **[] against []**, because `globals.css` has TWO `:root` blocks and the accent tokens are in
the second.

✅ **693/693** (was 620), `tsc` and `next build` clean, deployed `343a871` and verified via
`/api/health`. **Items 1–5 of the 2h brief were audited and found ALREADY BUILT** — invite
normalisation, the topic taxonomy, fractional referral accrual, all four training-UI items, the
Choose File button and the vote hint — reported rather than rebuilt, per the brief.

▶ **CHARLIE TO CHECK:** an approved answer now carries a 2px frame and a top-right superscript;
Settings → Platform accent changes the colour immediately and persists; a vote you have cast shows
a SOLID triangle and one you have not shows a HOLLOW one. Still unverified from here: the resource
image and PDF previews, which need an authenticated browser session.

2026-08-27 04:39 UTC — ▼ **CENTRAL STAGE 2g + ITEMS 12–15 ARE BUILT — AND TWO PARTIAL INDEXES HAD
BEEN ADDED WITH NO REGISTER ROW BECAUSE THE CHECK THAT ENFORCES §21 NAMED TWO INDEXES LITERALLY.**

**Resources tab** — nine types, card grid with thumbnails (image, PDF first page, YouTube still
derived from the URL with no API key and no render-time fetch), type chips primary + topic dropdown
secondary, top/newest. Voting is the answer vote: up/down, one per member, no self-voting, same
tariffs, same ledger, AI-authored content ranks and mints nothing. Delete/restore is the 2f pattern
unchanged. ⚠ **The upload gate is an ALLOW-LIST against the SNIFFED BYTES** — “no executables or
archives” as a deny-list is whack-a-mole, and a client declares any MIME it likes, so a renamed
`setup.exe` → `poster.png` changes the declaration and not the bytes. Images and PDFs only, 10 MB,
**gated before R2 sees it** (checking after storing means the rejected file was already reachable by
key). Copyright confirmation is a hard gate **recorded against the row**; Report is on every
resource for **every member**, because the person who recognises their own work has no rights over
the Community that posted it.

**Item 12** — root-only settings (name, colour, show/hide, four modes, default SELF), Reform UK /
`#17B9D1` seeded. ⚠ **The brief asked me to check that colour against the platform teal and it
failed the check**: ΔE2000 **15.14**, hue gap 15° — plainly different side by side, indistinguishable
at the size a 1px border and a 10px superscript render. The frame is therefore carried by **2px
border weight and its words**, colour reinforcing only: a party stamp must not read as a platform
live-state.

**Item 13** — ⚠ **the stamp names whoever marked it in EVERY mode.** Under the default the tick is
the poster’s own claim about their own material, and an unverified self-tick rendered as a bare
organisational endorsement puts the organisation’s name on something it has never seen. Hiding the
feature **retains** the data — approve, hide, assert the stamp stops rendering, assert the column is
still populated, re-enable, same name back. A `Do not use` flag takes visual precedence and the two
**coexist in the data**. Context box is permanent, placeholder not pre-filled (pre-filled text is
submitted verbatim by everyone who ignores it). ⚠ The four modes are ONE pure function both the
route gate and the client control call — two copies drift into a tick that appears for people the
route refuses, silently.

**Item 14** — ⚠ **a video answer has an EMPTY body**, so every surface rendering `answer.body`
printed a blank block: the library preview, the collapsed row, and all four pack formats. One
function now decides what a text-only surface prints, and all four formats plus the list call it.
The submit guard was `!body.trim()` and silently swallowed a link-only answer. **Item 15** — the
three headings verbatim; tab order Questions · Training · Resources · Leaderboard · Teams, asserted
by index order.

⚠⚠ **`Community_live_children_idx` (item 11) and `Resource_live_idx` (2g) were both created in
hand-written SQL with NO §21 register row, and I found them by sweeping `pg_indexes` by hand — not
by any check.** §21 rule 5 says `check:central` asserts these indexes exist; the assertion named two
of them literally and had never been widened, so it had been passing on a quarter of the register.
Both registered (eight entries), both models carry the rule-3 doc comment, and the check now
enumerates every guarded index AND sweeps `pg_indexes` for a partial index on a Central table that
is missing from the register. Watched failing both ways.

⚠ **A planted break found one of my own new assertions reading the wrong guard.** Removing the
no-self-voting check from `applyResourceVote` left “you cannot vote on your own resource” **green**,
because `assertCanMark` also refuses self-marking — saying “your own **post**” — and the assertion
was `.includes('your own')`. Now the exact wording, plus a case on an **AI-authored** resource where
nothing is minted so the backstop never runs at all.

✅ **620/620** (was 472; 148 new), `tsc` and `next build` clean, four planted-break batches watched
failing. `prisma/central_2g_resources.sql` applied. ⚠ A Neon connection drop mid-run left orphaned
`zz-check-*` fixtures that the next run reported as failures — swept; worth knowing that a crashed
check run makes the NEXT one lie.

Earlier: 2026-08-26 23:32 UTC — CENTRAL: **the content soft-delete pattern is built — the thing item 11 was blocked on.** Four columns on Question, Answer and BulletinPost; ⚠ `deletedWithParent` is the load-bearing one, because restoring a question must bring back the answers that went WITH it and must not resurrect one its own author had deleted separately — without the flag those rows are identical and the difference is unrecoverable. Points reverse at the value they were awarded and the ledger only appends: award, reversal, restore is three rows, nothing edited. ⚠ `Answer.hidden` is moderation, NOT deletion, and stays — asserted both ways. Deleted means invisible, enforced at the two chokepoints every read flows through and asserted surface by surface, because a soft delete one read forgets is worse than none. Deleted-items view at `/communities/[id]/deleted`, cascaded rows labelled. **436/436**, six planted breaks all watched failing. ▶ Item 11 is now unblocked and is next. Earlier: 2026-08-26 20:52 UTC — ▼ **INGEST C3-A (the addendum): ONE LINE OF SEEDER MADE A COLLECTION 84.7% NOT-OTS, AND A SECOND SEEDER PARAMETER HAS BEEN RETURNING HTTP 422 AND YIELDING NOTHING, SILENTLY.**
`searchGovUk('office of tax simplification report', …, 500)` is a relevance search over **348,062**
results; we kept the first 500. Re-classified all 497 rows against the gov.uk content API and the
verdicts are **identical to 24 August, 497 of 497** — 76 KEEP / 421 DELETE / 0 HOLD. The delete now
runs across **all three layers** instead of ending by printing *"INDEX LAYER NOT DONE HERE"* (421 in
`corpus_fts`, 740 chunk rows in each of `corpus_chunks`/`corpus_vec`), and **⛔ `--execute` was refused
by the classifier, exactly as in C3.** ▶ Seeder fixed to `filter_organisations=` (**222** documents, a
closed universe — the OTS was abolished in 2023); the re-seed is a **146-document fetch**, every one of
the 76 held rows resolving by exact id into the 222.
⚠⚠ **222 DOCUMENTS IS NOT 222 REPORTS.** Every row is `format = null`, median **399 words** — the gov.uk
landing page — and **143 of the 222 (64.4%) keep their substance in a PDF attachment nobody fetches**.
Same shape as `building-regs`; the fix exists one function along (`processGovukContent` fetches
attachments, `processGovUk` does not). **OI-24.**
⚠⚠ **AND THE ADDENDUM'S §2 IS REFUTED IN ITS MECHANISM.** The OTS rule in `source-audit.ts` has NOT
"passed for months": the URL 404s, `!r.ok` short-circuits every later check, and it has printed **⛔**
since the file was written on 2026-06-04 — `minSize: 5000` is never reached. The real defect is worse:
**14 of 50 rules print ⛔ and nothing acts on the output**, and that one column merges **6 dead URLs**
with **5 bot challenges** and a transient. Simulation validated against a live run **44 of 44**. Also:
**1 rule that CANNOT PASS** (`jsOnly` tests `bodySnippet.length > 200` against a 200-char slice), **10
that cannot fail**, **5 that assert the gov.uk SEARCH answers rather than that the source publishes
what the collection claims** — the `oecd` rule is green off `q=OECD` while that collection holds no OECD
content — and **BAILII reported ✅ 200 while serving a bot check**. Nothing changed: the list comes first.
▶▶ **THE HOUSE OF LORDS ARCHIVE IS REACHABLE — GATE 1 IS GREEN.** The route §7 nominated first, the
National Archives' web archive, is the one that does NOT work (**405 "Human Verification"**);
**the Internet Archive answers Node's own fetch**. **2,820 archived judgment pages, 1,088 distinct
cases, ~2.2 s each — under two hours**, an afternoon not a multi-day job. ⚠ The C3 quality gate was
wrong **three ways** against real bytes: it **accepted raw HTML**, its `[YYYY] UKHL n` rule would have
**rejected every pre-2001 judgment** (neutral citations began in 2001), and its 4–7% stopword band sits
below the measured distribution (**min 7.2 · median 9.0 · max 10.7%**; navigation chrome is **0.0%**).
⚠⚠ **Hand-reading five then found two more** — one page passed everything while opening *"Search
Advanced Search Home Glossary Index Contact Us…"* (a different era's navigation vocabulary), and **4 of
20 pages end with the word "Continue"** because a Lords opinion is paginated. **NOT READY TO INGEST:**
the unit is the case, assembled across opinion pages and across pagination.
▶ **D-2 measured, no search file edited:** reachability **0/12 → 12/12** for both treaty collections
under option A, identical to a sixth stream; **0 treaty rows entered the top 20** of any of the 11
validated Gold v2 debates questions, all 11 returning a full 20-row set. ⚠ The recall half could NOT be
taken — **0 of 14 keys are retrievable in this BM25-only harness even when the query is the document's
own title**, so a 0-vs-0 says nothing. ▶ **Recommend option A**, with the definitive before-and-after
re-taken through the hybrid gateway. ▶ **D-5: Lane D's seven predictions are logged in `CHANGE_LOG.md`
BEFORE the run**, and they record a **2.7× disagreement** the sprint refused to average away (the brief
says ~91,500 sections; A5's own projection says 250,725).
▶ **The 503 ET orphans, now read in full rather than sampled: 51 have a judgment · 452 do not · 0 gone ·
0 error.** The boundary separates cleanly — **425 of the 452 (94%) are Scottish** by the six-digit
pre-2013 numbering or a 41xx office, against **0 of the 51** — and is declared in `CORPUS_SCOPE.md` in
B1's words. ⚠ 27 English rows are unexplained (**OI-22**). The 51 are staged through the general path.
✅ **LanceDB quoted-identifier sweep: 65 call sites, ZERO** — detector watched flagging both broken
forms first, and its two undecidable call sites named rather than counted clean.
⚠⚠ **31 OF 77 LIVE COLLECTIONS ANSWER "HOW COMPLETE ARE WE?" WITH THEIR OWN ROW COUNT** (23 flagged
confirmed) — completeness is 100% by arithmetic, whatever is missing. **OI-25.**
▶▶ **CHARLIE: `bash docs/C3_EXECUTE.sh` — STILL UNRUN, all eight purge collections measured at full
count at 13:05 UTC — then `bash docs/C3A_EXECUTE.sh`.** Four decisions in `docs/INGEST_C3A_REPORT.md`.
⚠ **B1 is blocked on a document: `BRIEF_INGEST_REPEALED.md` is not in the repository** (OI-23), and §9
requires its wording and B1's to match. Nothing here touches the live site.
Earlier: 2026-08-26 20:45 UTC — CENTRAL item 10: **the topic taxonomy is replaced — 22 controlled topics, the 24 ministerial departments dropped, root-only and inherited by branches.** ⚠ Four labels were renamed ON LIVE QUESTIONS as well as on the tag, because `topicTags` is a string array and not a foreign key — renaming the tag alone strands every question using it. No "Other": the topic field is optional and a new admin view at `/communities/[id]/topics` shows counts per topic plus an Untagged list, which is the evidence base for adding one. Template aligned and rebuilt from one source of truth; the Harrogate handover file re-mapped (13 questions, 0 errors). **387/387**, five planted breaks. ⚠ Found on the way: a raw NUL byte in two source files made grep treat them as BINARY, so they had silently dropped out of every code search; and one of my own new guards could not fail. ▶▶ **ITEM 11 IS BLOCKED AND NOT STARTED** — it depends on a content soft-delete pattern, a `deletedWithParent` marker, a content points-reversal rule and a deleted-items view, and NONE of the four exists in the repo; items 1–9 of this sprint never reached disk (`docs/SPRINT.md` still holds the 6 Aug search brief). Earlier: 2026-08-26 15:08 UTC — CENTRAL: **filling the upload template with a real branch’s Q&A found two faults that reading the code did not.** (1) A comma counted as a separator, so **five of the thirty-five topics the template itself offers** — every department name with a comma in it — were silently split into junk tags; the template always said "separate with a semicolon", so the parser now matches its own documentation. (2) **A Community created after the migrations has NO question tags at all** — creation seeded bulletin categories and nothing else — which for a new top-level Community means an empty chip row and a bulk upload where every row fails; found because a branch created at 13:40 turned check:central red. Creation seeds them now, backfill script added, the one bare node seeded. ▶ `docs/ReformUK_Harrogate_Questions_UPLOAD.xlsx` — 13 questions, 0 errors, drop-down intact, template XML edited in place. **377/377.** ⚠ Eleven of the thirteen questions had to be written from the scripts they answer (the source records topics, not questions), and the Tom Gordon MP row’s division numbers are NOT verified — both flagged in the file’s Notes column.
▶▶ **CHARLIE: the file is at `docs/ReformUK_Harrogate_Questions_UPLOAD.xlsx`** (untracked, as its source PDF is). Read the Notes column before handing it on. Earlier: 2026-08-26 14:45 UTC — ▼ **SEARCH S14: THE MERGE STOPS RATIONING SLOTS — AND
`vector-serve` CANNOT SERVE FOUR DENSE STREAMS, WHICH IS THE ONLY THING HERE HAPPENING ON A RUNNING
SERVICE.**
▶▶ **§0, FIRST, BECAUSE IT IS LIVE.** `vector-serve` runs **4 wide behind a 64-deep queue and a
client abort does not cancel work already queued** — so a dense leg that times out at the 25 s
client ceiling is still executed after the caller has gone, and every timeout ADDS load rather than
shedding it. Measured: `inFlight 4 · queued 64/64 · rejections 101`, and `warm_p95` off the same
counter at four points in one afternoon — **7,698 ms quiet → 205,754 → 351,301 → 706,954 ms**.
⚠⚠ **It kept climbing for forty minutes after every client had been killed.** Every earlier
measurement in this project used `LEX_VECTOR_STREAMS=legislation` — ONE dense call. **Production
reads four.** The per-stream timings are their own control: at width 20 the four dense-enabled
streams returned at **25,0xx ms** on all three probes, within 36 ms of each other, while `debates`
— the one stream with no dense leg — returned in **4.0–6.1 s**, nine times out of nine. ⚠ It leaves
no mark on the result: every hit keeps `scorer: 'bm25'`, byte-for-byte what a stream with no dense
leg produces. ⚠ **I cannot confirm this is production's behaviour** (SAML, §19) — **what settles it
in a minute: read `warm_p95_ms` and `concurrency.queued` off `vector-serve/stats` at a busy moment
when nobody is running a harness.** **D-1, and it comes before every other decision.**
▶ **THE DURABLE FINDING, on the record so nobody rebuilds it: plain rank fusion across streams IS
round-robin.** The streams are disjoint — **0 of 10 stream pairs shared a single document on any of
three probes** — and over disjoint sets unweighted RRF takes every stream's rank 1, then every
stream's rank 2. Scores are no better: caselaw's rank-1 at **53.4** against legislation's **254.2**,
with caselaw's BEST below legislation's MEDIAN every time. Normalisation is REJECTED — it promotes a
stream that found nothing good to parity with one that found something excellent.
▶ **`LEX_SEARCH_JUDGED_MERGE` (OFF).** ≥20 retrieved per routed stream always; the displayed twenty
chosen over the whole pool; **one source may hold all twenty** (constructed case: round-robin 4 of
20 → judged 20 of 20). Measured over the 40 questions routing 3+ streams: **the round-robin's mean
maximum share is 5.4 and it never exceeds 7.** The degenerate case is today's behaviour **id for
id**, which is what makes every arm attributable. `LEX_MERGE_COVERAGE` **deleted**, not defaulted
off.
▶▶ **§5, n = 64, keyword-only and labelled — AND THE RERANKER CLOSES THE GAP THE SPRINT EXISTS TO
CLOSE.** in-stream@20 **19/64**, round-robin **14/64**, confidence 14/64, gate 11/64, both 12/64,
**reranker 18/64 (pro) and 19/64 (flash) — which is in-stream@20 EXACTLY: everything retrieval found
is displayed.** @5 goes **6/64 → 15/64**. Every gain is a document deeper than floor(20/S) in its own
stream (in-stream 14, 16, 39, 47) — exactly the ones S13's arithmetic said could never be shown.
⚠ Its one loss is the shape to watch: a document its own stream ranked FIRST taken to merged 27.
▶▶ **AND THE MODEL COMPARISON REVERSED MY OWN CHOICE.** `gemini-2.5-flash` vs `gemini-2.5-pro`,
identical inputs, echoed model checked every call: **19/64 vs 18/64 @20, 15/64 vs 10/64 @5, 0.221p
vs 2.551p per query, 1.6 s vs 34.7 s, 63 of 64 calls completed vs 44.** Pro exhausts its output
budget on a third of queries even with full thinking headroom. **Registry default moved to Flash on
the measurement.** **D-4: reranker recommended ON, after D-1.**
⚠⚠ **Against S13 on the same index, dense retrieval was worth ~12 points of in-stream recall
(42% → 30%) — a bigger number than anything the merge does.** The deterministic arms are S13's
coverage arm again: three quarters of rankings moved to buy nothing, with documents their own stream
ranked SECOND landing at merged **143** and **161**.
▶ **§1(b): ask for a PERMUTATION, not a number.** Numeric confidences **broke the router — 12 of 55
calls truncated (21.8%) against 0 of 55 without the question**, the tails showing an endless decimal.
The ranking encoding: **0 truncations, 64 of 64 usable.** ⚠ But it **widens routing** (27 of 64
questions, fan-out 2.91 → 3.69), so it is a retrieval change wearing a ranking change's clothes —
**D-3: not recommended.**
⚠⚠ **FOUR DEFECTS OF MY OWN, ALL FOUND BY MEASUREMENT, ALL FIXED AND ALL RE-MEASURED:** a cost
ceiling that refused its own configuration (1.5p against a 4.34p estimate); a reranker output budget
that truncated **29 of 64** queries — each **naming itself**, because §18's guard is in the shared
helper; ⚠⚠ **a model comparison that was never taken, because both arms ran `gemini-2.5-pro`**
(`LEX_MODEL__SEARCH__RERANKER` vs the real `LEX_MODEL__SEARCH_RERANKER`) — and the evidence was in
the output the whole time, two models priced four times apart returning **3.622p and 3.719p** and
**29.1 s and 30.4 s**; the harness now compares the **ECHOED** model on every call. And a rank-decay
of 0.35 that meant a stream's priority was worth **21 ranks**, so one source took **19.9 of 20 slots
on 40 of 40** questions — corrected to 0.07 from the arithmetic.
▶ The harness now also **saves and replays a retrieval pass** (`--save-retrieval` / `--load-retrieval`,
refusing if the index stamp moved), which is what made re-measuring the model arms against
byte-identical candidate lists possible at all after a three-hour retrieval.
✅ `check:s14-merge` **20 assertions, 10 negative controls, every one watched firing** — constructed
cases only, no network, no DB, no model. Arm A merged **IDENTICALLY** to `runRoutedSearch` 3 of 3;
retrieval reproducibility **20/20/20**; index stamps matched; `fts +749`.
▶ **§4 reported, NOT built:** statutes can be confirmed exactly TODAY against `corpus_acts.title`
(250,808 rows, 135,531 titled) with no search and no LLM call; doctrines need positions in the index.
▶▶ **Nothing is on by default and no service needs a redeploy** — every flag OFF, every change under
`scrutinise-web`, `scripts/ingest/search/*` untouched.
⚠ For CENTRAL: `check:score-scope` has been red on Main since `4ffec90` — a bare score sort in
`lib/question-library.ts:250` and `:337`. **`docs/SEARCH_S14_REPORT.md`.**
Earlier: 2026-08-26 13:13 UTC — ▼ **GRAPH 4A: THE 1,650-ACT HOLE IS 0.76% AND HAS NEVER REACHED A USER — AND T3 ANSWERED THE BRIEF'S QUESTION AND THEN REFUSED ITS PREMISE.**
▶ **§1 T1 — the blast radius is entirely internal.** Six code paths read `legislation_edges`; four touch rows the defective filter built; **zero files under `scrutinise-web/` reference either graph table**, so the graph has no user-facing surface and no user has ever seen an answer from it. Measured on the zip: **2,431 of 132,990 documents skipped — 1,650 ukpga (37% of every Act), all 660 `aep`, all 58 `apgb`, and 0 of 85,971 SIs.** Proved by consequence: of 121,279 `cites` edges **0** have a regnal source, against 29,800 from the CSV-fed in-force path.
▶ **The brief's real question — "what else did we get wrong the same way" — has three answers, all measured.** (a) The identical regex **is** in `extract-madeunder-edges.ts:125` and **costs nothing** (0 SI-type entries carry a regnal filename); it shares the exported constant now anyway, because the defect's shape was two places that must agree with no check that they agree. (b) The widening is **strict** — 0 entries matched by the old regex fail the new one; checked because `ENTRY_RX` tightens the suffix group and that is where a widening could fail to be one. (c) ⚠⚠ **A THIRD DIVERGENCE, FOUND WHILE LOOKING: the two graph tables do not agree on what a pre-1963 Act is called.** `legislation_edges` keeps the URI's calendar form (`ukpga/1961/33`); `citation_edge` normalises to the canonical regnal form (`ukpga/Eliz2/9-10/33`). Under the `citation_edge` form three sample Acts return **0 rows** where the URI form returns 59, 50 and 50 — **a join on gid silently drops every pre-1963 Act and the loss presents as a coverage result, not a bug. OI-19.**
▶ **§2 T2 — 924 edges, 0.76%, under the 3% threshold and non-zero.** Re-ran the real extractor (imported, never re-implemented) over the 2,431 skipped documents, **writing nothing**. Delta on all four control Acts: **zero on all four** — it lands on the Interpretation Act 1889, the Public Health Act 1936, the Education Act 1944. ⚠ **The brief's trap is real: 29 edges run from a pre-1963 source to a post-2000 target** (a 1932 Act citing the Data Protection Act 2018), because legislation.gov.uk serves revised text; my prediction of ≥50 is refuted on magnitude and confirmed on direction. ⚠ 718 documents produced ZERO and that was **checked, not assumed** — every one of their 1,220 `<Citation>` elements sits inside `<Commentaries>`, while `ukla` carries 2,759, so the counter can be non-zero.
▶▶ **§3 T3 — 29.9%, so on the rule fixed beforehand short-form resolution is "WANTED, NOT URGENT" — and then the top-twenty list refused the premise.** The 93,772 figure is a STATISTIC, not a table, so the shipped detector was re-run over all 132,990 documents with a callback added to it: 97,095 spans, 29,009 in a target-citing document, leave-one-out band **23.0–28.0%**, decision survives every one. ⚠⚠ **But the commonest unresolved name in the corpus is "the Interpretation Act (Northern Ireland) 1954" — 3,732 spans, a FULL statutory title, not an abbreviation of anything.** By cause over the 60 commonest names: **title-absent 59.2% · title-mismatch 31.6% · short-form 9.3%.** ▶ **Short-form resolution would recover under a tenth of the gap; the dominant cause is titles absent from `corpus_acts`, `apni` above all.** ⚠ My pass counted 97,095 where 25-H's counter said 93,772 — **a 3.5% difference I have not explained**, flagged rather than papered over.
▶ **§3 T4 — the redaction holds.** 0 live CLML handles across three published exports and four new ones; **`citation_edge` still holds 15,413 rows with the true bytes** — the change is to the export, not the evidence. No bypass of secret scanning used or proposed.
▶ **§4 — Layer 2's textual half is ALREADY BUILT and the brief's sizing expectation is refuted.** 25-H ran over all 132,990 documents: **793,616 rows (77%) are SI-sourced** from 64,189 instruments, **137,296 of them inside an SI schedule**. What is missing is the **enabling relationship** — 230,681 `made-under` rows exist with **no evidence column**, and `citation_edge` structurally cannot hold them (the extractor excludes `<SecondaryPreamble>`). Priced from the live table: **0.27 GB ≈ $0.09/month** to re-extract with evidence.
▶▶ **§5 — CHARLIE'S TAX QUESTION: the mechanism works and the text is missing.** ⚠⚠ **We hold the scheduled agreement for 39 of 288 double taxation Orders (13.5%)** — the other 249 are the three operative articles with the treaty absent (26 of 256 before 2018). **The absence presents as a short document, not an error.** OI-20. ▶ The direction DOES reverse and the graph already answers it (symmetric, both columns indexed) — but only as well as the missing text allows. ▶ **MLI positions are NOT held** and cannot come from legislation.gov.uk. OI-21. ▶ ⚠⚠ **OI-3 binds §5 harder than anything in this sprint**: `uk-treaties` and `tax-treaties-dta` can be returned by NO query at any setting, so `permits_suspension` would be built over text the platform cannot retrieve.
▶▶ **§6 ANSWERED: `citation_edge` supersedes the `cites` rows, and NOTHING ELSE.** 109,099 of 111,193 pairs (**98.1%**) are already there, plus **226,516 more**, plus quotable evidence; of the 2,094 that look missing, **1,980 are the same edge under a different identity string**. ⚠ `legislation_edges` is the sole holder of **2,227,714 rows** of five other edge types. **Retire nothing until OI-19's identity bridge exists.**
▶ **§7 BUILT — `inbound()` returns `{ rows, coverage }`, not a bare array**, because an array lets a caller present a short list as a complete one. Layers searched/not-built each with **what the reader loses**; facts carry their measurement date and **announce themselves STALE** past 30 days; a grep fails the check if any string in `coverage.ts` states a figure, **watched firing on a planted "17.5 GB"**. ⚠ **The check caught a real defect in the block on its first run** — a probe counting 858 incidental matches of "in exercise of the powers" reported an unbuilt layer as SEARCHED, a caveat lying in the reassuring direction.
✅ `check-4a-coverage` **28/28** with every negative control watched firing; `check-25h-parser` 37/37, `check-25h-inbound` **12/12**, `check-25h-verify` 8/8; `tsc` clean on every file touched. ▶▶ **Nothing touches the live site** — no UI, no flags, no re-ingest; one additive table.
▶▶ **CHARLIE: seven numbered decisions in `docs/GRAPH_4A_REPORT.md`.** The two that unblock most: **Q3 build the identity bridge** (prerequisite for every layer) and **Q4 do NOT build short-form resolution — ingest the absent Acts and re-measure.** ⚠ The handover the brief executes, `HANDOVER_search_graph_citation.md`, is **not in this repository**; the twelve research targets and the five treaty relationship types are therefore assumptions of mine, flagged where used.
Earlier: 2026-08-26 13:06 UTC — CENTRAL invite: **the address carried an invisible character, and TWO validators disagreed about it.** The panel’s new message named the field, and a character matrix named the cause: JS `\s` does not match ZWSP/ZWNJ/ZWJ/LRM/word-joiner/soft-hyphen, so `.trim()` left them in, the lookup’s loose shape test passed them and Zod’s `.email()` rejected them — the panel offered an address the endpoint then refused. ⚠ Hypothesis (b) ruled out: an empty value fails the lookup’s own test, so that panel could never have rendered. Now ONE `normaliseEmail` + ONE `isValidEmail` on both paths, `EMAIL_SHAPE` deleted, and the route’s Zod keeps a size bound and no second opinion. Byte-level logging fires only when cleaning changes the string or validation fails. **372/372**, four planted breaks incl. the original bug restored. ▶ `/api/health` now reports `mail: <bool>` so the RESEND_API_KEY question is readable without the SAML-blocked dashboard.
▶▶ **CHARLIE: the invite should now go through.** If anything is still wrong the panel names it, and the server log carries the exact characters received. Earlier: 2026-08-26 12:27 UTC — CENTRAL invite panel: **the red "Could not create the invite" was the PANEL losing the evidence, not the endpoint refusing an email-only invite.** Production is serving the code in question (`/api/health` → `918cde8`), and against the live database every step succeeds: the lookup offers the address, the schema accepts the panel’s exact body, Charlie is OWNER of all four nodes, and the insert works. The message is the panel’s FALLBACK, fired when a JSON body carries no string `error` — and the route’s 422 returned `error.flatten()`, an object. ⚠ `CommunityInvite` holds two rows in its entire history, both open links: **no email-tied invite has ever been written in production.** Now: the route always returns a string, the panel prints the server’s words or `HTTP <status>` plus the raw body, the "invite this address anyway" dead end is one line and one primary action, and the invite logic moved out of the Clerk-gated route into `createCommunityInvite` so a check can run it. **359/359.** ⚠ A Resend send to an unregistered address is NOT confirmed — no key on this machine, Vercel unreadable (§19).
▶▶ **CHARLIE: try the invite again.** If it fails now it will name the status and the server’s own words instead of a generic line — that is the artefact that settles the original cause. Earlier: 2026-08-26 01:13 UTC — ▼ **GRAPH 25-H: THE XML MARKS UP 2% OF THE CITATIONS THAT ARE
ACTUALLY IN THE TEXT, AND A GRAPH BUILT ON IT ANSWERS "TWO" WHERE THE ANSWER IS 29.** Measured over
6,045 documents: **5.4%** of body mentions of the Human Rights Act carry `<Citation>` markup, **1.8%**
of the Equality Act, **0% of CRAG 2010** — the sprint's own pilot target. So a citation graph built
the obvious way, from `<Citation URI>` attributes, is roughly **2% complete**, and it does not fail
loudly: it returns a short, confident, wrong list. ⚠⚠ **For a repeal programme whose central
deliverable is "every provision that refers to this Act", that is the worst failure mode there is.**
▶ **`citation_edge` therefore has TWO detectors and keeps them apart in a `detection` column** —
`markup` (the document asserted the identity by URI) and `text` (we resolved the Act's NAME against
`corpus_acts` titles; `target_uri` is DERIVED, not read). `inboundSummary` always reports the split;
they are never summed unnamed. **1,034,548 rows**, every one carrying `citation_text` and
`raw_fragment` as `NOT NULL` — an edge with no quotable source is a claim, not a fact.
▶ **Q1 REFUTES OUR OWN JULY REPORT**: `GRAPH_TIER1_REPORT.md` §1.1 says the per-section R2 store has
"no `<Citation>` markup at all". It has **122 citations in 40 large sections** — and **0 in 40 random
ones**, which is why July said zero: those 40 averaged **2.1 KB** and were mostly repealed dot-leader
stubs. ⚠ What the markup does NOT carry is the provision: CLML wraps the Act's NAME and leaves
"section 53 of" as running text (3 of 286,659 body elements carried a `SectionRef` on a
`CitationSubRef`), so `target_provision_ref` is PARSED from the words. ▶ **98.9% of citation markup
in Acts is amendment commentary**, excluded and counted — those edges already exist from TNA effects
data. ⚠ **SIs, not Acts, are where the references live**: 261,599 body citations against the Acts'
25,060. A repeal programme reading only primary legislation misses most of the damage.
▶▶ **A DEFECT IN THE SHIPPED JULY EXTRACTOR — it never opened 37% of the Acts.**
`extract-cites-edges.ts` requires a CALENDAR year in the zip entry name, so every regnal-year
filename was skipped: **2,431 documents, 1,650 of them ukpga**, all pre-1963. Proved by consequence:
of 121,279 `cites` edges, **exactly 0** have a regnal-year source against **29,800** edges of other
types that do. July fixed regnal ids in the URI *parser* and never carried it to the entry *filter*.
`legislation_edges` has NOT been re-extracted. **OI-15.**
▶ **THE PILOT: CRAG 2010 Part 1 = 29 inbound references** (predicted 15); CRAG as a whole **182**
from 75 instruments. `expandPart` derived Part 1 = sections 1–19 from the Act's own CLML and
**legislation.gov.uk confirms it**. **Of the 29, only 2 came from markup.** They are one story — the
statutory definition of "civil servant", borrowed by the Scotland Act 1998, the Government of Wales
Act 2006, the Northern Ireland Act 1998, FOIA 2000, five Scottish SIs and a dozen more.
▶ **CONTROLS RAN FIRST.** Negative control (Down Syndrome Act 2022): **13**, above the predicted 0–3,
all read by hand and genuine — its own commencement SI and one consequential amendment. Scale
control: **EqA 1,868 > HRA 938 > CRAG 182 > Down Syndrome 13 — the ordering HOLDS.**
**Hand verification 20/20 against legislation.gov.uk.**
⚠⚠ **THREE DEFECTS IN MY OWN EXTRACTOR, EVERY ONE PRODUCING A PLAUSIBLE NUMBER RATHER THAN AN
ERROR**: a provision parser with no act-name anchor scraping SI **commencement tables**; a composed
**`schedule-12-section-310`**, a provision that exists nowhere (3,130 rows); and ⚠⚠ **an act-name
regex requiring every word before "Act" to be capitalised**, so *"Constitutional Reform **and**
Governance Act 2010"* captured as *"Governance Act 2010"* and resolved to nothing — **the pilot
target was invisible to the detector built to find it**, and the evidence had been on screen an hour
earlier as "top unresolved names" (`taxes act 1988`, `markets act 2000`) which I read as names we do
not hold. The fix moved unresolved spans **296,233 → 93,772** and CRAG Part 1 **2 → 29**.
⚠⚠ **AND TWO IN THE CHECKS.** Verification first reported **18/20** and both failures were the
verifier's — it anchored on the FIRST mention of the Act name, while `ukpga/2006/32` s.52 names CRAG
six times and the one that mattered was the second. **Reporting those as parse errors would have put
a false finding in the headline.** The corrected check was then made to fail on purpose (4 true
claims accepted, 4 false rejected) — and ⚠ the first version of THAT control re-implemented the logic
instead of importing it, a heredoc ate its regex escapes, and it briefly "disproved" a correct
result. **A control that is a copy tests the copy.**
✅ `check-25h-parser` **37/37**, `check-25h-inbound` **11/11** (one rule **declared untested** rather
than counted as passed), `check-25h-verify` **8/8**; `tsc` clean for all eight new files.
⚠⚠ **SIZE — I RAISED A STORAGE ALARM AGAINST A FICTION THIS PROJECT HAD ALREADY RETIRED, AND IT IS
RETRACTED.** `citation_edge` is **1,144 MB** and the database moves **18 GB → 19 GB** — those are
measured. The "17.5 GB alert line" I measured them against **does not exist and never did**:
`neon.max_cluster_size` is 16 TiB, storage is a **bill not a wall** ($0.35/GB-month, $15/month
budget), 19 GB is **~$6.65 = 44%, quiet**, and this table's share is about **$0.40 a month**. I took
it from a July header comment in `setup-edges-table.ts` without checking it was current — **GRAPH 3B
§4.1 had proved the constant was ours and circular, GRAPH 3C §5 retired it, and `serve-observer.ts`
says "There is NO storage ceiling to hit" in the live code.** ⚠ §19 failed precisely: the 18 GB was
measured, the line was inherited, and both went on the page at one confidence. The stale comment is
corrected in place. **OI-17 closed as a false alarm — there is NO decision waiting.**
⚠ Two caveats stated not buried: **11.3% of text rows are in a document's title/metadata, not a
provision** (CRAG's 182 → 149 filtered), and **93,772 name-spans resolved to nothing**. **OI-18.**
▶▶ **Nothing here touches the live site** — no UI, no flags, no re-ingest, no Lex or search changes.
`docs/CITATION_AUDIT.md` · `docs/crag_part1_inbound.json` · `SEARCH_STRATEGY.md` §9 Tier 1a.**
Earlier: 2026-08-26 00:14 UTC — ▼ **LEX 25-H: THE PAGE-ONE FIELDS WERE WRITTEN ONCE AND NEVER
AGAIN — THE BRIEF'S STATED CAUSE WAS WRONG, AND THE FIX IS A REFRESH PATH, NOT A WRITE PATH.**
Charlie's amendment corrected the diagnosis before I could: `confirmElicitation` *did* write those
fields — it wrote them **once**, and nothing wrote them again, so §3's pill-edit (added the same
sprint) would have left page one showing an answer the user had since replaced. A write path passes
*"the fields get filled"*; only a refresh path passes *"they change when the answer changes"*.
`projectElicitationOntoPageOne` now runs on **every canonical-state read**; the four account fields
are DERIVED, projected never copied, and the one-time copy inside `confirmElicitation` is gone —
⚠ two writers for one field is how they come to disagree. ⚠⚠ **The check does not assert that
something writes them** — it projects, edits one answer, projects again, and requires the value to
change, to be verbatim, and the untouched answers not to churn; `--self-test` runs that assertion
against a **write-once stub** (a projection that memoises its first result — precisely the defect)
and requires it to FAIL. ▶ **§2:** the account fields are un-writeable, guarded in the STATE MACHINE
not the panel, and it **throws** — ⚠ a silent refusal leaves the caller believing the write landed;
`ideaNarrative` is NOT derived, seeded once as a PROPOSAL gated on the field being untouched.
▶ **§3:** each pill opens its own answer POPULATED (⚠ a pill that opens an empty box is the same
complaint one step along); `ElicitationClosed` narrowed not removed, so a stale-tab POST is still
refused; an edit states **both** consequences together — stale reading *and* a costlier next build.
▶ **§4: the document pipeline EXISTED and the new door had never been connected to it.** The three
states are now named apart, because ⚠ "we have a filename" is not "we read it"; an old-shape record
says **"NAMED but never uploaded"**. ▶ **§5:** a collapsed panel is a labelled EDGE, present not
absent, and the state is `boolean | null` — ⚠ `null` means *nobody has said*, so it follows content;
a boolean would freeze the first render's answer. ▶ **§6:** the vocabulary box now LEADS the panel
(it sat fifth, under a heading about vocabulary, which is where it read as a footnote).
▶▶ **§7a: THE MAP VIEW WAS NEVER BROKEN.** `CauseTreeView` draws from `parentCauseId` and the build
never set one — every cause was a root, so the map rendered a flat list IDENTICAL to the list view.
⚠⚠ **A view that silently looks like another view is indistinguishable from a view that failed.** It
now nests via `drivenBy`, says so when there is genuinely no chain, keeps an unresolvable parent as a
root with the loss counted, and breaks cycles. ▶ 7b title follows the goal not the loudest retrieved
term; 7c the incentive reading JOINS the structural causes; 7d a queued field names its blocker
(⚠ "next up" is a position, not a condition); 7f the 25-F/25-G surfaces verified undisturbed.
▶ **§7e is HALF-ANSWERED**: the six qualities reach every drafting pass (checked, controlled), but
**the output side is not measurable** — the only build left in the DB is 24 Aug, seven passes,
pre-25-F; 3 of 6 qualities present and quality 1 fails at 0-of-4 nested, which is the §7a defect
itself. Closing it needs one live build = spend = a stop. **FIRST ITEM FOR CHARLIE.**
⚠⚠ **THREE VERIFICATION COPIES I REPORTED DELETED IN 25-G WERE STILL IN THE DATABASE FIVE DAYS
LATER** — `22406bd8`, `ce77b998`, `263ae5ae`; **two carried the REAL title**, so on any list they
were indistinguishable from Charlie's own ideas. Deleted now, each re-read after deletion. I reported
the first deletion **without re-reading** — the same failure as the harness one: asserting a state
instead of checking it. ⚠ Deleting them took the only post-25-F build with them, which is why §7e
cannot be closed. ▶ Leftover copy `48388e8b` deleted and verified gone; `verify-lex-25f-live.ts`
**fixed** — it now confirms through `confirmElicitation` instead of writing the column and bypassing
the only code that writes the page-one fields. ⚠⚠ *A verification artefact that isn't a faithful copy
produces findings about itself* — that bypass is why 48388e8b's page one was empty and why a brief
got written on a false premise. ▶ **§8's signed-in walk: WALK BLOCKED — NO HOST PERMISSION**;
acceptance rests on the checks, the build, and Charlie's own walk. ✅ `check:lex-25h` **20 passed, 18
with negative controls**, all watched rejecting; 25a 40/40, 25b 54, 25c 32, 25d 77, 25e 27, 25f 62,
25g 27; `tsc`, `next build`, clean-build `--fast` clean. Migration **idempotent** (11/10/1 first run,
11/0/11 on the re-run). ⚠ One check FAILED FIRST RUN AND THE DEFECT WAS IN THE CHECK — §7f looked for
`kind === 'CONTRADICTS'` in `build.ts`, which *writes* it and never compares it.
`docs/LEX_25H_REPORT.md`.**
Earlier: 2026-08-25 13:35 UTC — ▼ **LEX 25-G: TWO PASSES ARE 65% OF WHAT A BUILD READS, AND A RE-RUN NEED
NOT RUN THEM. ⚠⚠ §6'S FLIP HAS NOT BEEN PERFORMED AND THE CHECK ASSERTS IT** — the flag is `create`,
and §6 gates it on §1a/§2/§3/§4 *and* on Charlie confirming the rebuild reads well. The first four
are done; the fifth is a fact about a rebuild he has read, not a permission. ⚠⚠ **THE AUDIT'S
HEADLINE: NOBODY HAD LOOKED AT WHERE THE MONEY GOES, AND IT IS NOT WHERE THE COST IS.** Per pass:
**ORIENT 77,970 input tokens (36%) and RESEARCH 63,956 (29%) — two passes are 65% of what a build
READS — while SMART is 17.75p of 33.4p, 53% of what it COSTS.** Different passes. ⚠⚠ **AND THE ORIENT
PASS WAS READING ~434 DOCUMENTS AND STORING 20** — the gateway returns ~15× what it is asked, all of
it went into the prompt at ~39,000 tokens a call, and a citation to source #300 counted as "cited"
against a document never kept. Capped at 40: **~78,000 → ~8,000 input tokens, 32% of a whole build's
input**, and the citation check got STRICTER as a side effect. ⚠ Not §1c's forbidden truncation —
nothing is summarised, and a prefix is stream-balanced because `interleaveStreams` round-robins.
▶ **§1a: a re-run reuses ORIENT and RESEARCH — the CARRY, not the usages**, which is what decides
whether the saving is real rather than merely reported. ⚠⚠ **The reused EVIDENCE is carried forward to
the new `runVersion`, and that is what makes reuse mean reuse rather than skip** — everything
downstream is version-scoped, so a re-run that merely skipped would show no findings while the carry
told the revision there were seventy-five. Only PROPOSED rows move. ⚠ **Reuse is REFUSED when the
elicitation changed**, with the reason on screen. ⚠ **The measured figure is NOT taken** — it needs a
real REUSE build (~12p, a fourth production copy); the arithmetic is on the record and the figure
belongs to the first real re-run. ▶ **§1b** both prices on screen and ⚠ **the route defaults to FULL**,
the safe direction not the cheap one. ▶ **§2: one `SurfaceSwitch` on BOTH screens**, each naming
itself, the detail counted — ⚠ forks PLUS open issues, because forks alone would have said 4 where
there were 21 — and a returning user lands on the proposal, with `build=1` as the escape that stops a
refresh throwing someone off a running build. ▶ **§3: ALL SEVEN BUILT, NOTHING DEFERRED** — feedback
first, with a PERMANENT route as well as the offer, because ⚠ a control that only appears when we
guess the user is unhappy is not a feedback route; the tour is a variant of the same modal sharing
the FAQ; ⚠ the greeting is RENDERED not written to the transcript; ⚠ "say the word" does not clear the
box. ▶ **§4:** 4a was `composeSummary` writing one string to BOTH the transcript and the row —
**537 characters twice on one screen**; ⚠⚠ **4b COULD NOT BE REPRODUCED** (the data has terms and the
render shows them), so the guard makes the symptom impossible rather than fixing a diagnosed cause;
4c forks labelled, ⚠ keyed on `fieldKey` because the model invents its own fork keys; 4d stripped in
code, because telling a model not to repeat an opener is a request and removing it is the guarantee;
**4e checked and PASSES — 6 of 6 failures quote the failing text.** ▶ **§5: a build that STOPPED EARLY
never named its idea**, which is precisely when someone goes looking. ✅ `check:lex-25g` **27/27**
with every source-level control proven; **`verify:lex-25g-ui` 14/14** — it RENDERS both components
and reads the markup; 25-F 62/62, 25-a 40/40, 25-b 54/54; `tsc`, `next build`, clean-build `--fast`
all clean. ⚠⚠ **FOUR DEFECTS THE CHECKS FOUND AND TWO WERE THE CHECKS THEMSELVES** — a control
corrupted a COMMENT; the same control broke the wrong condition (**a control must break the
assertion's FIRST condition or it tests the order of the ifs**); and **two OTHER sprints' checks
called this sprint's fixes regressions**, both because they matched a literal from the code they
guard rather than stating a property. ▶▶ **CHARLIE: §6 IS READY AND UNFLIPPED** —
`PlatformConfig["newIdeaDoor"]` is ABSENT and resolves to `create`; `/ideas/new` is live
(`X-Matched-Path: /ideas/new`, `NEXT_REDIRECT;replace;/ideas/create;307`) against a control that
matches `/ideas/[id]`. Flip: `PATCH /api/admin/config { "newIdeaDoor": "build" }`; revert is the same
row. **No browser walk** — no Clerk session exists from a CC session.
`docs/LEX_25G_REPORT.md`.**
Earlier: 2026-08-25 07:07 UTC — ▼ **LEX 25-F: THE REVISION PASS HAS NEVER BEEN SHOWN A
FINDING — IT WAS BEING HANDED THE ARITHMETIC OF THE EVIDENCE.** `researchSummary()` emitted one line
per question — a heading and a COUNT — and that string IS the whole `═══ WHAT THE RESEARCH FOUND ═══`
block given to pass 4. **That is the mechanism behind the brief's §0**: 70 cited findings in the
database, and a revised kernel that reads *"incentives encourage diffusion of responsibility"*. The
material was never lost; **it was never delivered.** ⚠ **Three of the brief's specifics are refuted
with the measurement.** (1) **The query was NOT truncated** — `queryUsed` is an unbounded `String?`
and the stored value continues *"…northern lack :: context(1359 chars)"*; the `pr` is where the
brief's own blockquote wrapped. What is real is worse: `withTerms()` gave **every** library question
the same fourteen frequency-ranked words, so nine questions issued nine near-identical queries.
(2) **The testimony already reached five of seven passes** — what was missing was any instruction to
USE it (the only sentence attached was a prohibition), and it reached **neither the sift, the gather
nor the hostile clerk**. (3) **§6c is TWO defects**: our own `updateMany` with no `alternativeIndex`
wrote one alternative onto every row of the instrument fork, and separately two model-invented keys
recorded one decision twice. ⚠⚠ **AND THE FIRST LIVE RUN OF THE NEW CODE CRASHED, WHICH IS WHY IT WAS
RUN**: a panel model returned `coherentActions` as a STRING where the schema asked for an array, the
smart pass threw on `.join`, and **four of ten passes died with it — including the hostile clerk —
over one field of one reply.** `?? []` guards against `null` and nothing else. Replies are now
normalised at the boundary, and `continueOnFailure` marks the three passes 25-F added so an
enhancement cannot kill the adversarial read; **the pass stays FAILED, not SKIPPED**, and the summary
names it deterministically. ▶ **§1: 70 cited findings were rendered on NO screen** — no build surface
had ever read `EvidenceItem`. `BuildFindings` now leads with contradictions and named sources
(ranking: contradiction +100, citation +50, precedent +25), reads the drafted kernel from
`IdeaFieldState.proposal` (the `Idea` columns are empty after a build and correctly so), and **counts
what it demotes**. ▶ **§2: the smart pass** — the whole of page one out verbatim to two outside models
for a Rumelt-shaped answer; every statute, doctrine, office and mechanism they name becomes **its own**
corpus query; the coverage check; and a critique **with a rewrite mandate**. ⚠ **A term is CONFIRMED
only by a retrieved document mentioning it**; anything else is kept and labelled UNVERIFIED and may
never be cited. ⚠⚠ **`grok-4.6` is out of the panel: `GROK_API_KEY` is set so `hasKeyFor` is TRUE and
`callModelJson` returns `unroutable` for every xAI model — A KEY IS NOT A CLIENT**, and it would have
printed "grok-4.6 did not answer" on every build for ever. ▶ **§3: two verification passes** — nine
method-layer tests as data, each failure quoting the text that fails it, **an unanswered test recorded
as UNRUN rather than passed**; and a chain trace that excludes first-hand testimony from
"unsupported", because it IS evidence. ▶ **§2e: the adversarial read leaves `gemini-2.5-flash`** —
407 output tokens for six issues against a whole constitutional proposal. Every pass now reports the
model that ANSWERED. ▶ §6b: the four fields were **never wired**, in any sprint; two are now drafted
and **`costSummary` stays empty with the reason stated**. ▶ §7: the build names its idea over the
placeholder only, without accepting the title field. ▶▶ **§9: THE CUTOVER IS PREPARED AND THE FLAG IS
SET TO `create` — nothing about the front door behaves differently today, and the check asserts it.**
Seven creation entries point at `/ideas/new`; the switch is a **`PlatformConfig` row, not an env var**,
because a Vercel env change needs a redeploy and that would make the REVERT a build-and-wait.
**Nothing a returning user touches moved.** ⚠ **`docs/LEX_25F_CUTOVER.md` §9c names EIGHT things
genuinely lost at the new door** — the "How this works" tour first, then the FAQ, the first-idea modal
and intro, the greeting by preferred name, "say the word", **feedback capture** and Exit — **and
recommends they are built BEFORE the flag is flipped.** ✅✅ **AND IT WAS RUN, TWICE, END TO END ON A COPY OF CHARLIE'S OWN ELICITATION — 10/10 PASSES, 621s,
33.8p.** **§4's criterion is MET AND MEASURED: pass 1 went from "231 sources read; 0 cited" to "372
read; 12 cited", 8 of 8 queries WRITTEN, none falling back.** **§8's single measure is MET
decisively — all five terms it names surfaced (carltona, osmotherly, accounting officer, senior
responsible owner, ministerial responsibility), none in the 2,934 characters he wrote, 14 of 18
CONFIRMED by the corpus with 14 cited findings under them.** The screen: 8 drafted fields, 8 leading
findings of 85, six judgements, **56 cited sources** — where it showed none. Verdict **WEAK**, **2 of
9 kernel tests passed**, and the chain **did not hold** on this run having held on the previous one,
which says that pass is reading rather than returning a constant. ⚠⚠ **A THIRD DEFECT, in §1's own
ordering, found by the run**: the screen led with **eight "The critique rewrote…" rows above 56 cited
sources**, because `CONTRADICTS` scored 100 and a citation 50 — and **the check's own §1 assertion had
been passing on it**, because it read the literal out of the code it was guarding. ✅ `tsc` and
`next build` clean; **`check:lex-25f` 62/62 with every source-text control proven**; 25-a 40/40,
25-b 54/54; clean-build `--fast` PASS. ⚠⚠ **The check found EIGHT defects before a human did and FIVE were its own
controls** — including one that matched **the comment explaining the defect it forbade**, and one
that renamed a symbol to a **superstring of itself**. And `check:build-25b`'s "a question builds its
own query" had been **passing on the very defect it was written to catch**. ▶▶ **CHARLIE: the browser
walk is yours** — no Clerk session exists from a CC session. `npm run verify:lex-25f -- --execute`
runs a real build **on a COPY**; it never touches `452c5ade`, because a re-run would supersede the 70
findings that are `LEX_FIRST_BUILD_KERNEL.md`. `docs/LEX_25F_REPORT.md` · `docs/LEX_25F_CUTOVER.md`.**
Earlier: 2026-08-24 15:36 UTC — ▼ **CENTRAL STAGE 2e: THE POINTS FAILURE IS DIAGNOSED, AND IT
WAS NOT A BUG — AN ANSWER VOTE WAS NEVER WIRED TO THE LEDGER AT ALL.** `recordPointsEvent` had three
call sites, all for bulletin marks and claim approval; `setAnswerVote` wrote a vote row and stopped.
Stage 2b built the vote, Stage 2 built the ledger, **nobody joined them**. ⚠ **`PointsEvent` held
ZERO rows across the whole database** — nothing had ever paid a point in Central by any route. ✅ And
**"Log this session" worked exactly as designed**: two claims, both PENDING, both correct — the points
were waiting for an approval nobody had told Charlie to give. ▶ **STAGE 2c's AI-ATTRIBUTION BLOCKER
IS BUILT.** `Answer.authorType`/`aiModel`; **27 labelled before and after**; the answer card used to
render **no author at all**, so all 27 Claude-written answers looked like members' work on every
screen. One component now answers "who wrote this" and three surfaces use it — list, detail, pack —
with the printed sheet using plain text, because a badge is what a printer loses. **An AI answer
ranks but mints nothing.** ▶ **Answer votes now pay**, mirroring bulletin marks: same tariffs, same
event types, ONE shared daily budget across both surfaces. Charlie's existing upvote was backfilled;
**charlie is on 44, chas on 20.** ▶ **Pre-approval is gone** (Charlie's call): claims and logged
sessions pay on submission, and a manager reverses with a **required** reason at the **original**
award value, both events left in the ledger. The two claims the old gate stranded were awarded by the
migration. ⚠⚠ **THE CHECK CAUGHT A BUG THIS SPRINT CREATED**: `logSessionForMatch` builds its claims
directly (it raises the *other* person's), so with the gate gone it paid nothing and said nothing —
both routes now go through one `awardClaimPoints`. ⚠ **It also caught an assertion of mine that could
not fail** (it read a return value, not the ledger) and **its own collision with Charlie's live
claims** — the one-per-day guard looks at real rows too, so a fixture reused his GAVE_TRAINING claim
and silently paid zero. Fixtures now own their dates and assert `reused === false`. ▶ **The referral
chain paid nothing and the reason was arithmetic** — 10% of a 4-point mark floors to 0. Links now
accrue a decimal and mint on crossing 1.0: ten marks pay the L1 inviter 4, where flooring paid 0.
▶ **The template is Charlie's file, edited in place** — Stage 2d's SheetJS-generated one made Excel
offer to repair it. `styles.xml` and the Questions sheet come out byte-identical and the Context
drop-down survives. ⚠ Two alignment defects it exposed would have broken a real upload: the Notes
column is headed `Notes (not imported)`, and sheet ONE is "Read me first" — the parser now finds the
Questions sheet by name. ⚠ **The topics dropdown is now 35 entries per node, not 11**, because the 24
ministerial departments were added. ✅ `tsc` and `next build` clean; **check:central 344/344** (from
295), self-cleaning; **four planted-break runs**, two of which found real defects rather than
confirming a guard. ▶▶ **CHARLIE: the browser walk is yours** — open the template in Excel and confirm
no repair prompt, then fill it in and upload it; and check an upvote moves the other account's total.
No Clerk session exists from a CC session. **Events (the old 2c scope) stays deferred, per the brief.**
Earlier: 2026-08-24 02:07 UTC — ▼ **CENTRAL STAGE 2d IS BUILT — AND THE FIRST THING THE AUDIT
FOUND IS THAT STAGE 2c NEVER WAS.** The brief asks whether 2c is done before anyone is invited: **it
is not.** No `central_stage2c.sql`, no Events model, no `TrainingSession`, and **no `authorType`
column anywhere in the database** — so the AI-attribution item is still the pilot launch blocker and
**27 Claude-written answers still render as members' work**. Nothing since 11 Aug touched it, and 2d
did not quietly absorb it. `TrainingSession` (a 2c item) is created by `central_stage2d.sql` because
"Log this session" cannot exist without it; a later 2c must ADD to that table, not recreate it.
✅ `tsc --noEmit` and `next build` clean; **`npm run check:central` 295/295** against the live app DB,
up from 189, self-cleaning down to the borrowed phone numbers and the config row. **Schema applied
to Neon and read back column by column** (`prisma/central_stage2d.sql` — three tables, `User.phone`,
one config row, the tag update; ⚠ *no* partial or expression indexes this time, so unlike Stage 1.2
and Stage 2 nothing in 2d is invisible to `schema.prisma`). ▶ **Tabs now read Questions · Training ·
Leaderboard · Teams**; the tree and the "Managing {node}" rail moved into Teams; the header is
breadcrumb, name, role badge and points. ⚠ **A `?panel=` deep link now lands on Teams** —
`lib/community.ts` writes `?panel=requests` into every join-request notification and those links are
already in people's inboxes, so a tab move that ignored them would have broken every one silently.
▶ **The chip row is contexts only** (topics filter on a different axis; `promoted` now orders the
dropdown instead). **Party conduct 11 · Media skills 6 · Economy 3 · Social issues 3 · Law & rights 1
promoted; Housing unpromoted at 0** — across all four nodes, the 20 rows the update flagged.
▶ **Bulk upload is Community-admins-only, two-step, and fails ROWS not files** — the one deliberate
departure from `import-central-seed.ts`; an unknown context still fails that row and names it rather
than being guessed. Every row imports as authored by the uploader, said above the file picker.
⚠ **The template is a stand-in** — none had been supplied; replacing it is dropping Charlie's file in
at `public/central-question-upload-template.xlsx` (the importer keys off column *names*).
▶ **Contact sharing has exactly one reader**: `lib/training.ts` `contactFor()`, requiring both
acceptances, no closure, the viewer being one of the two, and the channel the *other* side ticked.
Two acceptance timestamps rather than one, so "both accepted" is read back, not inferred. ⚠ **Phone
sharing is Charlie's call, flagged not taken** — ships ON per the brief, and email-only is one row
(`UPDATE "PointsConfig" SET "numericValue" = 0 WHERE "key" = 'TRAINING_PHONE_SHARING'`), read at
**display** time so it applies retroactively. Both states asserted. ⚠⚠ **Two of my own new checks
could not have failed, and the planted-break runs are what found them** — "the Notes column is never
imported" tested the *plan*, which never carries answer text, and SheetJS reads almost any bytes as a
one-cell CSV so "it parsed" proved nothing. Both rebuilt to fail, and every new guard was watched
failing first in three break runs (2, 5 and 9 failures respectively). ▶▶ **CHARLIE: the browser walk
is yours** — no Clerk session exists from a CC session and local Clerk is a dev instance, so the five
acceptance walks (tabs, chips, upload of three rows with one bad context, a two-sided match, log-a-
session) have not been clicked. Not attempted, not inferred, not reported as passing.**
Earlier: 2026-08-24 01:56 UTC — ▼ **SEARCH S13: THE MERGE IS ARITHMETIC, AND IT IS ALREADY
SHOWING ALMOST EVERYTHING IT CAN.** `merged rank ≈ in-stream rank × streams routed` holds for **29
of 34** keys found and merged — that relation IS the round-robin, so a top-20 window can show at most
the first **floor(20/S)** of each stream. Of the 35 questions where retrieval found the answer, **16
sit inside their own ceiling and 15 of those 16 are displayed.** ⚠⚠ **The brief's framing is refuted
both ways:** the merge does not DISCARD (pure reordering, budget = total, drops nothing) and it makes
almost no bad trades — "a low-value result displaced a high-value one" is **1 question, 10 slots,
across all 65**, and that one is misattributed. **12 of 65 are recoverable by a merge change: 23% →
a ceiling of 42%**; four of the seven unrecoverable **routed only ONE stream, where there is no merge
at all.** ✅ No cross-stream raw-score comparison exists anywhere in the merge. **New baseline
merged@20 15/65 (23%), in-stream@20 28/65 (43%) on `corpus_fts` v7308 — it SUPERSEDES NOTHING**
(S10's are void, S12's was never taken). ⚠ Length is NOT the mechanism: the 773-vs-280-word headline
is confounded by collection, every within-collection cell has n≤5, and **no normalisation change was
made.** ⚠⚠ **V2-Q15's answer key is a 66-character dot-leader placeholder** — s.28 Local Government
Act 1988 is stored as `28 . . . .`; found at in-stream rank 2 and correctly suppressed. We do not
hold the text. ⚠⚠⚠ **THE PLATFORM WAS SHOWING 1.1% OF THE SPRING STATEMENT, FROM THE TOP.** Both legs
returned `body.slice(0,300)`; the ANN had already chosen the matching chunk and `vectorSearchSections`
**dropped `r.chunkId` on the line that built the hit**, so the service hydrated chunk 0. Keyed debates
speeches run 920–5,714 words. ✅ Fixed with ONE selector shared by both legs (they cannot disagree),
**no re-index needed — `corpus_vec` already carries `chunkId`**, $0. `check-passage` **15/15, all 5
negative controls FIRED** — and it caught its own first version reporting `matched:true` on a passage
centred on the word **"the"**. ⚠⚠ **THE S12 SNIPPET FIX HAD BEEN COMMITTED, PUSHED AND NOT DEPLOYED FOR
THREE DAYS** — the running `vector-serve` reproduced the pre-fix table exactly (limit=10 → **5 of 10
empty**); a restart re-runs the existing artefact. ✅ **BOTH SERVICES REBUILT FROM MAIN and verified
behaviourally: 0 of 10 empty where it returned exactly 5, controls still passing — `verify-s13-passage`
5/5, was 2/5.** ✅ **§3 measured through the platform, before → after: 54 of 81 (67%) → 68 of 80 (85%)
of displayed results contain a query term; mean coverage 25.2% → 36.1%; Spring Statement 38% → 92%.**
⚠ The title-only control held at 64% either side. ⚠ The brief's "close to zero" is refuted, and **the
metric had to be repaired first** (title+snippet together read 80% on the OLD build; the 80% was the
title).
✅ **§2's merge arm is built, MEASURED and RECOMMENDED OFF** (`LEX_MERGE_COVERAGE`, default OFF).
Both arms, one session, cached routes: **A 15/65 (23%) → B 17/65 (26%)**, and engagement verified
positively (the round-robin relation holds 29/34 in A, **10/34 in B**). ⚠⚠ **The net hides the shape:
4 gained, 2 lost, and 24 of 34 merged ranks MOVED to buy a net of two — and the two losses take
documents their own stream ranked SECOND to merged rank 149 and 117.** Helps committees (+2, off a
floor of zero) and caselaw/impact-assessments (+1 each); costs guidance and legislation (−1 each),
the two best collections in the set. ❌ **§5 not run**, gated on your re-key validation. ⚠ Debates is **9 of 11 NOT-RETRIEVED** — retrieval, not merge.
▶▶ **CHARLIE: (a) verdicts on the eleven rows in `docs/GOLD_V2_DEBATES_REKEY.md`; (b) five decisions
in `docs/SEARCH_S13_REPORT.md` §6 — D-2 (rebuild both serve services) unblocks everything else.**
The signal that proves D-2: `vector-search limit=10 tier=caselaw` returning **0** empty snippets
where it returns exactly **5** today. Not an absence of errors. `docs/SEARCH_S13_REPORT.md`.**
Earlier: 2026-08-24 01:31 UTC — ▼ **INGEST C3: THE PURGE IS PROVEN AND STILL UNRUN — AND THIS
TIME IT IS A HARNESS BOUNDARY, NOT A CLEARED CONTEXT.** Claude Code's auto-mode classifier refuses
production DELETE and DDL from a session whatever the brief authorises; `l2-purge.ts --execute` and
`e1-drop-ftsvector.ts --execute` were both refused. Every manifest, guard, dry run and expected
count is on disk. ▶▶ **CHARLIE: `bash docs/C3_EXECUTE.sh`** — eight steps, one confirmation each.
$0.00 of the $150 ceiling; no embedding ran. ⚠⚠⚠ **THE FINDING THAT MATTERS MOST IS A SILENT NO-OP
THAT NEARLY SHIPPED: LanceDB accepts a DOUBLE-QUOTED identifier, matches NOTHING, and raises
NOTHING.** `id = 'x'` returns 1 and `"id" = 'x'` returns 0, measured on all three tables — so a
`delete()` carrying the quoted form removes 0 rows, returns normally, and **the purge reports
success with 168,569 rows still serving.** It is also ~70x FASTER because it prunes every fragment,
which is what makes it look like an optimisation. What caught it was counting before deleting and
printing the count; the script now refuses to run when a predicate matches zero. ✅ Lane A staged:
**all eight collections match the brief exactly (168,569)**, and **layer three now exists** —
`l2-purge.ts` used to end by printing *"NEXT (index layer, not done here)"*, the same defect one
layer along. `verify-retired-gone.ts` **watched at 0/3 before anything was touched**, both sides of
all three probes returning 10. ⚠⚠ **`ots-reports`: the brief's premise is INVERTED.** Not "~14%
contaminated, ~428 genuine" — measured 497 of 497 through the gov.uk content API, **76 published by
the OTS and 421 by somebody else (84.7% not-OTS)**. The cause is one seeder line: a free-text
relevance search with no publisher filter over **347,938** results, of which we kept the first 500.
Ten bodies read at random before any rule was written: **zero were OTS reports** — *Renew your
driving licence*, *Apply online for a UK passport*, *Spain travel advice*. ⚠ `document_type` cannot
make the cut (nine types carry both verdicts) and **the brief's own rule destroys 27 genuine OTS
press releases while leaving 380 non-OTS rows serving**. NOT DELETED — decision D-1. ✅ **B2/B4: the
exclusion is WIRED, not just the annotation** — 249,256 dot leaders have been labelled since Surface
1 and returned anyway; the filter keys on the EVIDENCE not the state, so a repealed provision whose
text we hold is still returned with its label. Check watched failing 8/2, passing 10/0. ✅⚠ **B3:
32,040 partially repealed sections [CI 25,956-40,088], counted for the first time** —
`section_repeals` had no row of that kind at all. ⚠⚠⚠ **And the dot-leader bug has now worn THREE
costumes: this one was the provision number itself** (`12ZA . . . .`, `234ZA`, `502GC`) — one letter
was always fine, which is why it survived two fixes. B2's 249,256 is a **floor**, ~1,487 short.
✅⚠ **B5: titles 54.2% → 99.1%** and 1,575 citations repointed — ⚠⚠ the obvious fix would have
resolved *Vagrancy Act 1824* and then **fetched zero rows**, because the title is on `ukpga/1824/83`
(0 sections) and the text is on `ukpga/Geo4/5/83` (20). NOT DELIVERED: titles are baked in at index
build, so step 8 must run. ⚠⚠ **B6: verified live and two-sided (0/20 through every stream scope,
3-4/20 with the tier filter alone) — and its stated blocker is GONE**, because Gold v2 shipped 11
debates questions on 22 Aug and `corpus-map.ts` still says there are none. ✅ **C2: only 10.5% of the
503 ET orphans have a judgment** — 131 of the 179 without one are Scottish, 134 carry 6-digit case
numbers, 105 are from 2006: a coverage boundary, not a fetch failure. ❌ **C3 gate 1 RED** — every
parliament.uk host 403s with a Cloudflare challenge including the root. ✅ E3 · E4 was already done
by GRAPH 3C · F4 generated. ❌ **NOT STARTED: B1 · C1 · C4 · Lane D entirely · E2 · F1-F3.**
`docs/INGEST_C3_REPORT.md` · `docs/OPEN_ITEMS.md` · `docs/CORPUS_SCOPE.md`.**
Earlier: 2026-08-24 01:12 UTC — ▼ **25-E's DELIVERY RECORD IS REDONE AND CHECK 4 NOW PASSES:
25-E IS LIVE ON THE RUNNING SITE.** The boundary fix worked. `/ideas/build` now serves a bundle
carrying **4 of 4 25-E markers** — *"Picking up where you left off"*, *"I couldn't put together what
I understand you're trying to do just then"*, *"I couldn't check whether the build is ready to
start"*, *"Let me try again"* — where ~1 hour after the 25-E push it carried **0 of 4**. ⚠ **The
probe carries its controls, because "all markers absent" is also what a probe that cannot see the
bundle returns**: all 3 pre-25-E strings from the same components (*"That's everything I need"*,
*"Could not start a session"*, *"Nothing to add"*) are PRESENT, so the probe reads the right bundle;
`x-vercel-cache: MISS`, `age: 0`. Bundle 16 chunks / **816,612 bytes against the stuck build's
812,883** — it moved. **No redeploy was needed.** ✅ `verify:lex-25e` re-run against Neon: **19/19**,
including the assertion that was false in production for eight sprints (after confirming,
`canStart=true`, `blockedReason=null`). ⚠ **The route probe is still worthless and was not used** —
Clerk 307s `/api/ideas/…/build`, `/elicitation` AND a deliberately non-existent control alike. That
the build route is deployed is an INFERENCE, not a measurement: it was committed at `854303c`, long
before the deployment the client bundle proves we are at. ✅ **The live DB says Charlie's run is set
up**: idea `452c5ade` (cl@scrutinise.org) is **CONFIRMED, 2,934 chars of problem, 690 of own
knowledge, a 750-char understanding paragraph, 0 builds** — and the page's OWN resume query, run
verbatim against production for his user id, **returns that idea and not the blank 23 Aug shell**.
So a bare visit to `https://www.scrutinise.org/ideas/build` should open on the build card with a
working control (`?fresh=1` to start clean). ⚠⚠⚠ **AND THEN CHARLIE RAN IT. THE ACCEPTANCE
CRITERION IS MET: `IdeaBuild` HOLDS ITS FIRST ROW.** `a7f7151c` — **DONE, 7 of 7 passes, 5m 14s,
107,380 in / 21,446 out, 6.78p**, framing `B_CONTEXTUALISED`, `failureReason` null — **on the
RESUMED idea `452c5ade`**, so 25-E's resume did exactly the thing it was built to do rather than
handing him a blank page. `Idea.lexPage` moved to `COHERENT_ACTIONS` as 25-A designed. ✅ **The
kernel: 16 fields at `AWAITING_CONFIRMATION`, 3 `ACCEPTED` (his own words), 4 `EMPTY`; 10 fork rows
over 5 decision points, 0 resolved; 4 coherent actions, 7 deepening passes, 70 evidence items, 34
adversarial issues.** ⚠⚠ **THE CANONICAL `Idea` COLUMNS ARE ALL EMPTY AND THAT IS CORRECT** — the
draft lives in `IdeaFieldState.proposal` until a human accepts it, so anyone reading the `Idea` row
alone would conclude the build produced nothing. That warning leads the review document. ⚠ **The
build's own most interesting output is a challenge to its premise:** pass 5 found that **CRaG 2010
s.3(1) already confers the power to manage the civil service**, and the instrument fork now offers
"use the existing power" against "new primary legislation" — Lex flagged it as the first thing to
decide. ✅ **NEW, and temporary: `/ideas/build` now lists your previous ideas** (`RecentIdeasPanel`,
`verify:recent-ideas-ui` **10/10 incl. a break-test**) — nothing in the product listed them, so that
first build was reachable only by pasting a URL. ⚠ It is keyed on the user's OWN WORDS, not titles:
11 of 11 ideas on this path are called "Untitled idea", so a title list renders eleven identical
rows. The 10 blank shells are hidden **and counted on screen**. ✅ `npm run dump:kernel` renders any
build for review → **`docs/LEX_FIRST_BUILD_KERNEL.md`** (287KB, complete, for CCh). ▶ **CHARLIE:
sections B–G of your walk are now testable for the first time, and 25-C's decision agenda has never
been walked — all 10 forks are unresolved.**
Earlier: 2026-08-23 23:46 UTC — ▼ **BUILD FIXED AND PUSHED: production was failing for two
days on a PACKAGE BOUNDARY, not a missing dependency.** Vercel died on
`../scripts/ingest/search/lance.ts: Cannot find module '@lancedb/lancedb'`. Chain found with
`tsc --listFiles`, not guessed: `scrutinise-web/scripts/measure-s12-baseline.ts` →
`../../scripts/ingest/search/index-state` → `./lance` → `@lancedb/lancedb`, which lives in the
INGEST package's node_modules; **Vercel installs only scrutinise-web's.** It compiles on any dev
machine because both trees exist. ⚠⚠ **The web build was pulling in 716 files from the ingest
package** — 7 source files + 709 type declarations resolved across the boundary. **After the fix: 0.**
✅ Fix is the boundary, not the symptom: **`scripts/**` excluded from the web tsconfig**. lancedb was
NOT added to the web app (it would ship a native module into a serverless bundle for a file the app
must never compile). Verified safe first: the 114 files in `scrutinise-web/scripts/` run through
`tsx`, which does not typecheck and reads only compilerOptions, so all ~40 check:*/measure:* commands
are unaffected; and **no app file crosses the boundary**. ⚠ **Ten further crossing imports remain and
are now inert** — each was one dependency away from the same outage. ✅ **DELIVERY CHECK 0 ADDED**
(`scripts/check-clean-build.sh` + CLAUDE.md §20): **A** `--fast` asserts 0 cross-package files (a
COUNT, so the next crossing fails it automatically); **B** full does a git-worktree checkout of HEAD,
`npm ci` in scrutinise-web ALONE, then tsc. **Watched failing on the real broken state (716, exit 1)
and passing after (exit 0); the full clean-room build PASSES.** This is the check that would also
have caught the 18 Aug uncommitted-file outage, which `check:committed` cannot. ▶▶ **CHARLIE: read
the Vercel dashboard for a green PRODUCTION deployment — I cannot (token SAML-blocked, §19), and
`/ideas/build` returns 200 as a Clerk-gated shell so a route probe proves nothing.** ⚠ **25-E's
delivery record must be redone by LEX** — its check 4 could not have passed against a site serving
25-D. `docs/URGENT_BUILD_BROKEN.md` executed.**
Earlier: 2026-08-23 22:45 UTC (⚠ the commit trailers read 08:45 — the machine clock was ~14h slow; see the CHANGE_LOG entry) — ▼ **LEX 25-E: THE FRONT DOOR OPENS. ⚠⚠⚠ `IdeaBuild`
CONTAINED ZERO ROWS ACROSS THE WHOLE DATABASE — NOT ONE BUILD HAS EVER BEEN STARTED, BY ANYONE.
Eight sprints of work sat behind a step nobody could get past.** ⚠⚠ The confirmation control was
there all along and Charlie USED it — his elicitation is CONFIRMED with a 750-char paragraph he
agreed to. What failed was the acknowledgement: `confirm()` refreshed ONE of the two server
objects the page held, so the instant he pressed "That's right — build it" the confirm buttons
vanished and a greyed-out "Build it" appeared beside the BOOT-TIME `blockedReason` — *"Confirm
what I've understood first"* — telling him to do what he had just done, with no control left to
do it with. **All three of the brief's symptoms are that one missing refresh.** `canStart` was
never wrong; it was STALE, which is why no server-side check could have found it. ⚠⚠ A SECOND
dead end: when the understanding paragraph fails to write, three independent render conditions
are ALL false and the page renders NOTHING — Lex apologises and says "try again in a moment" and
there is no way to try again. Fixed by a server-decided `ElicitationPhase` (closed union, one
branch each), a route returning BOTH halves, a retry that isn't counted as a correction, and a
backstop card. ⚠⚠ **§2: THE ANSWERS WERE NEVER LOST — the brief's premise is refuted.** 2,934
chars of problem and 690 of own knowledge were in the database throughout. What was lost was the
PAGE: `/ideas/build` minted a NEW idea on every visit and never put the id in the URL, so a
refresh orphaned everything (ten empty shells prove it, three within eight seconds). Now the id
goes in the URL, a bare visit RESUMES and says so, `?fresh=1` starts clean. ⚠⚠ **And this
sprint's own first fix fell into the `LIMIT 1` trap** — it filtered for "has content" AFTER
`findFirst`, so one blank shell hid every real row and **the fix for losing his work would have
failed to find it**; measured against production before shipping, now in the WHERE clause with a
control. ✅ §3: nothing crashed — the build never started, so it is §1. ✅ §4: the opening
question was printed twice because the card's `question` IS the paragraph Lex just said; the
Send button's reason is now one computed string driving both the `disabled` attribute and the
sentence; the estimate no longer confesses our sample size at the moment of commitment. ⚠⚠ The
phase cards were EXTRACTED into pure components so they can be RENDERED — no grep could have
caught this, because the source contained a perfectly good confirmation block. `verify:lex-25e-ui`
renders every phase and asserts an ENABLED control comes out, including the exact state Charlie
was stuck in — and it caught its own defect first (`disabled:opacity-40`, a Tailwind CLASS, made
its matcher report every button as disabled). ▶▶ **CHARLIE, FIRST: NOTHING IS ON THE SITE YET.** ~25 min after the push `/ideas/build` still serves a byte-identical pre-25-E bundle (probe PROVED sound — every pre-existing string from the same component is present, `x-vercel-cache: MISS`, and 25-D IS live). `npm run build` compiles clean, so it is not the code; `VERCEL_TOKEN` is SAML-blocked so I cannot read why. **Vercel → Deployments → is `dd2bdd4` GREEN and PRODUCTION?** ⚠ **Re-probed ~1 hour after the push: still byte-identical** (16 chunks, 812,883 bytes; the pre-existing control string is still PRESENT, so the probe still reads the right bundle). 25-D landed within minutes of its push, so this is not a queue. ⚠ Also: the six commit trailers read `08:45 UTC` and the true time was ~22:00 — the MACHINE CLOCK was ~14h slow and resynced mid-sprint (author dates carry it too; the ingest commits diverge the same way). History not rewritten; add ~14h when matching these commits. ▶ **AND THE ACCEPTANCE CRITERION IS A HUMAN RUN, WHICH I CANNOT BE** — no Clerk session from here. The server walk reaches
`canStart === true` and every phase renders a usable control; neither proves a click works.
`https://www.scrutinise.org/ideas/build` now RESUMES your existing idea and should open on the
confirmation with a working "That's right — build it" (`?fresh=1` to start clean). And the build
itself has still never run, so sections B–G of your walk remain untested.
`docs/LEX_25E_REPORT.md`.**
Earlier: 2026-08-23 08:40 UTC — ▼ **GRAPH 3C-2: THE VALIDATION KEY WAS RESTING ON AN UNSIGNED
FACT AND IS REBUILT ON MEMBERS' OWN WORDS. Charlie paused the pass and caught it on Sir Edward
Leigh — cited as supporting the assisted dying Bill for sponsoring an amendment to it, when he is
one of its most prominent opponents. 136 of 157 rows rested on AMENDMENT SPONSORSHIP, which is
unsigned: a wrecking and a strengthening amendment are the same recorded fact. ⚠⚠⚠ THE REASONING
ERROR MATTERS MORE THAN THE INCIDENT — 3B chose that basis because it is NON-CIRCULAR and proved it
with a query, which is genuinely valuable and incomplete: NON-CIRCULARITY IS NECESSARY, NOT
SUFFICIENT; THE BASIS MUST ALSO DETERMINE A DIRECTION. An independent signal that does not settle
the answer is worse than useless in an answer key, because it marks the graph WRONG every time the
graph is RIGHT. ✅ All 14 candidate bases audited on BOTH tests before anything was rebuilt, with
the independence half a query and the verdict DERIVED rather than typed in — 3 pass. ⚠ The
dangerous one is TheyWorkForYou's "voted consistently for…" summaries: circular WHILE APPEARING
INDEPENDENT. ✅ 50 sound rows, every one a member's own Hansard words, 46 members, 9 parties, all
with a WORKING per-speech URL (our stored id is a sequence index, not TWFY's gid — a constructed
URL 404s, so the generator recovers the real gid from each day's XML: 50 of 50). The graph holds no
speech-derived signal, so speech is independent; identity resolves exact-normalised-name with 0
ambiguous of 677. Route (b), a web statement, was NOT NEEDED — 144 of 157 had spoken. THE ROW
STATES THE EVIDENCE, NOT THE CONCLUSION: 0 proposed directions, asserted on every write, and
`NO POSITION ESTABLISHED` is an explicit verdict option. ⚠⚠ THE UNSIGNED-AMENDMENT DEFECT CAME BACK
IN A DIFFERENT COSTUME and only reading the output caught it — a 20,246-word "speech" for Lord
Callanan that was the text of an amendment. ⚠⚠ THE GENERATOR ATE ITS OWN INPUT, the same shape as
last sprint's bug, one sprint later: run twice it reported `pool 136: 0 bill-sponsor`. The pool now
lives in `scripts/graph/validation-pool.json`; re-running is byte-identical. ⚠ The self-test caught
my own first-person filter rejecting *"My Lords, this issue has been raised with me…"* — a
case-sensitivity bug that would have silently dropped genuine Lords speeches. The 136 unsound rows
are KEPT under `⛔ UNSOUND BASIS — NOT SCORABLE` with their withdrawn claims visible. ⚠⚠ Every sound
row is marked `hansard-speech` and THAT MARK EXPIRES: if extracted-position signals are ever folded
in (design §4, P3), those rows stop being independent and must be excluded from scoring. ▶ CHARLIE:
read the quote, then write the position; spot-check S1.04, Sir Edward Leigh.
`docs/GRAPH_3C2_REPORT.md`.**
Earlier: 2026-08-23 01:50 UTC — ▼ **INGEST CENSUS C1 PART A (audit only, nothing written to
Neon; STOP POINT REACHED, Part B not started): THE WORK LIST IS 79% NO-TEXT-AT-SOURCE, AND TWO
COLLECTIONS CONTAIN NONE OF THEIR OWN SUBJECT.** ⚠ Four of the brief's named inputs DO NOT EXIST
(`CORPUS_REGISTER_V31.csv`, `DAILY_EMAIL_V31_REBUILT.md`, `CORPUS_SCOPE.md`, `OPEN_ITEMS.md`) — A2's
columns are mine, every walk lead is CC-PROPOSED, and **Part C has no target format to build
against.** ✅ **A1: 46 rows where est==compiled, exactly as predicted; and a SIXTH rebaseline script**
— `v30-denominator-rebaseline.ts`, whose header records the motive: summed est had fallen BELOW
compiled, was correctly called an "honest-denominator violation", and **the remedy chosen was to set
the denominator to the numerator.** `scottish-courts` carries `est_is_confirmed=true` beside its own
note reading "ROUGH order-of-magnitude only … UNMEASURED". ⚠⚠ **A3: the brief's OWN thresholds find
2 of the 4 cases it names** — `et-decisions` landing pages sit at a MEDIAN 18 WORDS (above the
15-word floor, missing 97.6% of the defect); `building-regs` can't fail a distribution test at all.
The instrument that works is `sourceUrl` pointing at a landing page — but it over-flags
(`planning-policy` is a verified false positive). ⚠⚠⚠ **`oecd` holds 505 rows and NOT ONE is from
OECD** — all gov.uk, 52 news stories, 31 speeches, one about the London 2012 Olympics — and it prints
[100% complete] because est==compiled. ⚠⚠ **A4: the biggest pair in the brief is NOT duplicated and
my first measurement said it was** — 8,697 "shared sitting days" compared historic-hansard's LORDS
volumes against pwdata's COMMONS stream. Split by House: Commons abuts at 1918-11-21/1919-02-04,
Lords at 1999-11-11/1999-11-17, **zero shared days both**. Real item-level duplication IS proved for
Commons divisions and treaties (TS No.8 (2016) appears twice within `uk-treaties-fcdo` alone). ⚠⚠⚠
**A5 (n=501): 394 of 501 work-list instruments return NO PROVISIONS AT SOURCE (78.6%).** classb
recovery 37.5% (predicted 20-40% ✓); unseen recovery **17.0% against a predicted 80-95% — wrong by
5×**. ⚠ My first pilot said 96/96 and 405/405 recovered — false, it counted the source's
no-provisions MARKER as a recovery. ⚠ Throughput **93.5/min single-threaded vs 8.2/min with two
fetchers** — concurrency against TNA costs an order of magnitude; Part D must run single-threaded.
⚠ Projection needed isolating the Companies Act 2006 (2,093 sections = 88% of the sample's words)
then projecting per (stratum × reason): **~91,500 sections, ~11.5M words, $1.33 on batch** against
CCh's 0.45-0.6M and $6-9. **Part D is ~5× smaller than briefed.** ⚠⚠⚠ **THE OPERATIVE SPLIT IS
`reason`, NOT `corpus`: the 7,924 `classb` rows — instruments WE marked "No CLML/HTML/PDF found on
TNA" — recover at 37.5% and carry the rich instruments; run them FIRST.** ⚠⚠ **Correction to my own
earlier figure: the pre-2000 Acts DO yield text** — at n=69, `unseen` 0 of 67 but `classb` 2 of 2,
one being the **Public Health Act 1875 (143 sections)**. The recoverable set is the 258 classb rows,
~19,866 sections projected (n=2, needs the other 256). All 87 modern pre-2000 Acts probed
exhaustively: 11 with text, 182 sections. ✅ **A6: `neon.max_cluster_size = 16,384 GiB`, we are at 0.11%.** Case law's 7,496
B/row is **96% `ftsVector`** — and **`corpus_sections.ftsVector` is 1,178 MB (6.2% of the DB) that
nothing in the serving path reads.** ✅ **A7: the legacy table's independent contribution is 29
instruments / 211 sections, not 914,274** — ⚠ my first run said 1,579 and every one was a false gap
from building the regnal map out of the worklist (absences only). ✅ A2 reconciles exactly: live
18,243,823 + retired 28,629 = 18,272,452. ▶ **CHARLIE: five numbered decisions in
`docs/INGEST_CENSUS_C1_A_REPORT.md`.** The two that change money: re-order Part D to run SIs first
and pre-2000 Acts last; and **Part F's re-fetch is 503 documents, not 131,650 — 131,147 of the
landing pages already have their real judgment PDF ingested alongside them.**
Earlier: 2026-08-23 00:13 UTC — ▼ **INGEST — CASE LAW BEFORE 2001 (scoping only; nothing
built, nothing fetched in bulk). BAILII IS SHUT BY ITS OWN PUBLISHED TERMS** — paragraph 6 forbids
*"storing search results or HTML versions of judgments"*, *"bulk downloading"* and robot indexing;
`robots.txt` disallows every jurisdiction path and `GPTBot` entirely; an Anubis proof-of-work wall
now fronts the site. ⚠ **There is no commercial/non-commercial line to exploit — this is `blocked`,
not `commercialUseExcluded`.** ⚠⚠ **THE FINDING NOBODY ASKED FOR: WE HOLD ZERO UKHL JUDGMENTS** —
the House of Lords was the final court of appeal until 30 July 2009 and Find Case Law does not
publish it at all. All ~760 of them (14 Nov 1996 – 30 Jul 2009, ~250 pre-2001) sit on
`publications.parliament.uk` under **OPL v3.0 — commercial use expressly permitted, NO
computational-analysis exclusion — for under $2 and 3–5 days.** ⚠ **The brief's premise is half
wrong both ways:** we hold **3,703 pre-2001 case-law sections** (`echr-hudoc` 2,053, `scottish-courts`
1,203 back to 1999, `ni-judgments` 235 back to **1984**, `tna-caselaw` 210 incl. *Burchell* and
*Polkey*), and the cliff is **2003**, not 2001 (29 items dated 2001–2002 against 74,657 from 2003).
⚠⚠ **§3 RAN TEN PRE-2001 AUTHORITIES THROUGH THE REAL `runSearch()`: 10 of 10 ABSENT, 3 of 10
returned a DIFFERENT CASE WITH THE SAME NAME** — *Caparo* → **Caparo Atlas Fastenings** (ET 2017),
*ex p Coughlan* → **Mrs M Coughlan v Brookes Jordan Ltd** (ET 2020), GCHQ → the **Strasbourg**
sequel — **and 0 of 10 returned nothing.** *M v Home Office* returns the Contempt of Court Act
1981 twice and an **1888** Commons question; *Pepper v Hart* returned a meat-controls-charges
explanatory memorandum on run 1 and the Interpretation Act 1978 on run 2 — routing is an LLM
decision, so **the wrong answers move between runs and the verdicts did not.** The absence never
presents as an absence. ⚠⚠ **My own harness made the same mistake first and reported 3 of 10 HELD**
on a name match; the classifier now requires the right era AND not-a-tribunal collection.
⚠ n=10, hand-picked, **NOT a score** — never to be quoted beside the 65-question baseline.
⚠ Two corrections to our own records: the register's *"declined by BAILII"* is **unevidenced**
(the request doc is still a draft, no reply logged), and `corpus-census.md`'s "BAILII 2,000,000" is
about double BAILII's own published 1,001,463 documents. ▶ CHARLIE, five numbered decisions in
`docs/CASELAW_PRE2001_SCOPE.md` §4: **D-1 declare the coverage boundary (~2 days, recommended
regardless)** · **D-2 the Lords archive** (confirm OPL/judicial copyright by email; pilot 20 docs —
Node's fetch is Cloudflare-blocked on parliament.uk) · **D-3 the FCL computational licence — 25
granted, 0 refused, and the legal exposure is on the STATUS QUO, not the change** · **D-4 two emails
(TNA: extend backwards? ICLR: what does a Computational Licence cost?)** · **D-5 BAILII stays
blocked.** `docs/CASELAW_PRE2001_SCOPE.md` · `docs/pre2001_probe.json`.**
Earlier: 2026-08-22 01:32 UTC — ▼ **SEARCH GOLD v2 IS VALIDATED — 24 of 24: 22 ACCEPT,
2 AMEND, 0 REJECT — and `debates` and `legislation` have test questions for the first time.** The
baseline set goes **44 → 65 recall-scoreable** (+3 negative controls, where a 0% is a PASS).
⚠ **The two AMENDs are APPLIED, not logged as accepts** (Q6 "hanging" → "the death penalty"; Q12
"make me leave" → "evict me"), and ⚠⚠ **Q6's amendment reclassifies it** — "the death penalty" IS
the document's own wording, so it stops being a vocabulary-avoided question and that count drops
**9 → 8**. Transcribed to `gold/gold-v2-set.ts`; `npm run check:goldv2` asserts it against the
signed-off document in both directions, 24 questions · 27 keys · no sampling. ⚠ Keys come from the
R2-verified list, NOT the prose — the markdown's ellipsis shorthand makes a regex drop 3 of 27.
✅ This unblocks S12 §4's treaty decision (it can now ship with a before/after) and S10's held
debates/legislation vector settings. ❌ **S12 §2's case-law embed is still running** — 4 of 14
shards, 160,000 vectors, **$9.44 of ~$33**, paced by Batch-API 429s at 90s a time; §3's baseline is
gated on it and is NOT taken. ▶ CHARLIE: let it finish → `vector-index` job → **redeploy
`vector-serve`** (today a caselaw `limit=10` returns 5 of 10 EMPTY snippets, after it 0 of 10) →
then the 65-question baseline. `docs/SEARCH_S12_REPORT.md`.**
Earlier: 2026-08-21 22:17 UTC — ▼ **SEARCH S12: THE REPLACE PATH EXISTS AND THE BRIEF'S
PREMISE WAS WRONG.** There is no global chunk numbering — `chunkId` is `${sectionId}#${k}`,
content-addressed, and every fetch and delete keys off it by RANGE, so re-cutting one collection
cannot attach another's vectors to different text. What IS global is the shard plan, so the real
hazard is a stale-checkpoint RESUME. Measured blast radius of a naive re-cut: **70,890 of
22,689,587 chunks, 0.31%, two shards of 568.** ✅ `vec-replace.ts` built, scoped to one collection,
priced before it spends; the pilot watched its guard fail on the REAL broken state (446 chunks →
225, **221 orphan vectors**, red before green) and isolation compared **74 of 74 collections, every
row, no sampling — 0 unexpectedly changed**. ⚠⚠ **A LIVE SERVING DEFECT FOUND AND NEARLY
MISATTRIBUTED TO MY OWN CHANGE**: caselaw snippets were coming back EMPTY, which looked like the
re-cut losing chunks — the table held all 539,454 with judgment text in chunk 0, and the real cause
is a PRE-EXISTING shared row budget (`sectionIds.length * 4`) that starves sections with many
chunks: **limit=10 → 5 of 10 results have no snippet**, the same document has one at limit=3 and
none at limit=10. That is the 'inconsistent hydration' ingest flagged; it is a budget, and it is
fixed. ⚠ My chunk-count prediction was REFUTED — 539,454 not 480–520k — because capped documents
still cap: the gain is more judgment text UNDER the cap, not fewer chunks. ✅ §4 sweep: 74 of 74
classified, **0 type-blocked, 0 tier-blocked**, only the 2 treaty collections affected. ❌ §2's
embed is an OVERNIGHT run (Batch API pacing at 90s per 429) and §3's baseline is therefore NOT
taken. ▶ CHARLIE: let it finish → `vector-index` job → **redeploy `vector-serve`** (5-of-10 empty
snippets → 0 of 10) → then the baseline. **GOLD V2 still needs your validation pass.**
`docs/SEARCH_S12_REPORT.md`.**
Earlier: 2026-08-21 02:58 UTC — ▼ **SEARCH GOLD v2: THE TEST QUESTIONS FOR DEBATES AND
LEGISLATION EXIST — 21 questions plus 3 negative controls, nothing scored, awaiting Charlie's pass
(`docs/GOLD_CANDIDATES_V2.md`).** 27 of 27 keys verified by reading the document body out of R2
against a claim written down BEFORE the read; `runSearch()` never called, because keying a question
on what retrieval returns makes recall 100% by construction. ⚠⚠ THE CHECK CAUGHT A WRONG KEY ON ITS
FIRST RUN: two rows titled `Senedd Plenary: The 20 mph Speed Limit` are, in the body, a debate about
oesophageal and stomach cancers — and the mechanism is collection-wide: **61.1% of all 191,730
`senedd-cofnod` speeches sit in their session's single biggest heading block** (14.6 headings per 279
speeches), so the tail inherits whatever heading came last. ⚠⚠ Compounding it, **95% of a 40-row
sample has WELSH bodies**, so an English query can only match the English heading — the one that is
wrong for most rows. A Welsh devolved question is not askable in English today; Q3 moved to Northern
Ireland. ⚠⚠ LEGISLATION TITLES ARE UNRELIABLE TOO: Online Safety Act `section-12` is titled
"Serious Crime Act 2007" while its body is the children's safety duties (2 wrong of 3 read) — not
measured, and it degrades retrieval as well as keying. ⚠ Vagrancy Act 1824, National Minimum Wage Act
1998 and Housing Act 1996 are ABSENT (pre-2000 coverage is 21.4%), so "is it illegal to sleep rough?"
cannot be answered at all. ⚠ The sourcing split is 16 outside-in to 5 document-outward against §2's
"about half each" — stated as a shortfall, needing ~5 more. ▶ CHARLIE: one VERDICT line each.**
Earlier: 2026-08-21 01:44 UTC — ▼ **SEARCH S11: NINE COLLECTIONS — 48,883 SECTIONS —
COULD NOT BE RETURNED BY ANY QUERY AT ANY SETTING, AND SEVEN OF THEM NOW CAN.** Confirmed one at a
time against the live index rather than inferred from `cps-guidance`'s pattern: 8 of 8 probed come
back at rank 0–4 scoped to their own corpus and are returned by NO router stream with its real
scope. ⚠⚠ THE BRIEF'S CENTRAL WARNING IS REFUTED AS APPLIED HERE, and the refutation is the useful
part: "widening a stream is zero-sum" belongs to the EXTRA-LEG mechanism, where `mergeLegs` divides
a fixed budget — a tier move puts the rows in the MAIN leg where they earn their place. Measured
BEFORE building: guidance 3/10 → 8/10, consultations 4/9 → 4/9, **not one question lost and not one
rank moved**, where S10's flag arm had cost them 6/9 → 4/9. ⚠⚠ THE FINDING NOBODY ASKED FOR: S10's
recall numbers, taken twenty hours earlier, NO LONGER REPRODUCE — 0 of 5 sampled rankings survive,
because the 20 Aug case-law re-compile rewrote 74,896 bodies and a delete-and-re-add moves BM25
document frequencies for the whole table. **Our own playbook already said a baseline measured across
that is void; nobody had applied it to a content repair.** S10's absolute per-collection numbers are
VOID, not stale. ✅ Reindex: 118,789 un-indexed → 0 (predicted exactly), 546s, €0.056, query
44,274ms → 1,639ms (27×), box destroyed; case-law titles verified IN THE BUILT INDEX at 99.98%.
⚠⚠ 118,789 un-indexed rows — a TENTH of the 1.19M behind the August incident — produced a WORSE
query time than that incident did; the penalty is not linear. ⚠ The re-tier's first run would have
taken three hours (`corpus_fts` has NO scalar index on `id`, so every batched delete was a full
18.2M-row scan); the second took 5.3 minutes. ✅ `fts-refresh.ts` + `fts-drift.ts` close the
stale-index defect — and generalising the case-law refresh found a latent bug first: it omits the
citation rewrite, which would have stripped the title from every legislation row it touched.
❌ THE $31 CASE-LAW RE-EMBED WAS NOT STARTED AND IS UNSPENT — `build-vector-index` shards a
`corpus_chunks` it requires to be immutable, so a REPLACE path must be written and staged first.
✅ DELIVERED AND VERIFIED LIVE, and the check changed the answer: this was drafted saying "nothing
has reached a user", then `fts-serve` turned out to have restarted itself at 01:28 UTC. Two-sided
control either side of it: `{"tier":"other","corpora":["cps-guidance"]}` 5 rows → 0,
`{"tier":"guidance"}` 0 rows → 3 — SWAPPED. On the guidance stream's own scope `cps-guidance` is
now **13 of the top 20, at ranks 0, 1 and 2**. Warm p50 **44,274ms → 318ms (139×)**, zero-match
probe 44,815ms → 3ms. ▶ CHARLIE: one action left — delete `LEX_GUIDANCE_CPS` from Vercel (inert
now); plus one DECISION, the two treaty collections, unmeasurable until a debates validated set
exists. `docs/SEARCH_S11_REPORT.md`.**
Earlier: 2026-08-21 01:23 UTC — ▼ **GRAPH 3C: THE SCORE IS A SPECTRUM AND THE RANKING POINTS
THE RIGHT WAY — 3 distinct stance values across 2,304,858 estimates → 13,448, and 92.87% at exactly
±1.00 → 0%. The evidence is a rank, not an adjective: on the assisted dying Bill the ONE entirely
consistent member of 426 ranked 426th of 426 under the arithmetic 3B inherited, and ranks 1st under
3C's. The sort key is the same line of code; confidence now saturates on the NET evidence rather
than on turnout, so the mixed records went from averaging 0.8947 to 0.3066. ⚠⚠ THE FALSE
REBELLIONS WERE NEVER A FREE-VOTE-HEURISTIC PROBLEM: `is_whipped_party` never meant the whip HELD,
and the ladder used it as though it did — on commons:2051 Labour split 126/181 (cohesion 0.5896)
and one Conservative party of 83 holding at 0.8554 made the division "whipped" for everyone, so 126
Labour members were recorded as rebels at the highest weight in the config. Cohesion was already
stored on every row and nothing read it. rebellion:v1 18,493 → 10,050 (−45.7%); 328 → 0 on 3B's two
named divisions; total unchanged — reclassified, none created or lost. ⚠⚠ THE OBVIOUS DETECTION FIX
IS REFUTED BY THE BRIEF'S OWN CONTROL — "use the largest whipped party" tags 7 of the 9 whipped
Northern Ireland abortion Regulations as free votes. ⚠⚠⚠ A CHECK THAT COULD NOT FAIL, THIRD SPRINT
RUNNING, THIRD DIRECTION: 3B rewrote 3A's false assertion and left the `limit: 400` that had
defeated it, so 3C's ranking change buried the same 16 counter-examples from the other end and the
harness reported 3A's exact false sentence. It failed rather than passed — but the fix survived
only as long as the key it was written against. ⚠ check-3a has been 32/33 since 3B and nobody
looked. ⚠⚠ THE 17.5 GB "CEILING" IS RETIRED for a cost line ($0.35/GB-month, $15 budget, source and
date recorded in the file); today 19.01 GB = $6.65 = 44.3%, quiet, where the old constant read
108.6% and had been raising a CRITICAL alert against a fiction since 3B. 3A's D-1 closed: the whole
estimate table costs $0.22 a month. ⚠⚠ APPG: REPORT AND STOP, and two of 3B's three route
descriptions are WRONG — interests-api has zero categories mentioning a group, and 3B's register URL
renders as "as at 30 July 2015". The live edition is 29 June 2026, 571 pages or one 6.5 MB PDF, and
its officers carry a NAME AND PARTY WITH NO MNIS ID. ⚠ D-10's "11×" is a ratio of rows: the signal
ceiling is 7.7×, and 84.3% of the 4,458 companies unlock nothing. ▶ CHARLIE: the config version at
the foot of /admin/positions should read `3c.7bac2c10d652`; and
`docs/POSITION_VALIDATION_CANDIDATES.md` now has 50 PRIORITY rows, nothing scored. ⚠
`app/ideas/create/CreateIdeaClient.tsx` HAS AN UNCOMMITTED SYNTAX ERROR — LEX-owned, not touched,
production unaffected because it is uncommitted, but `next build` cannot run in this tree.
`docs/GRAPH_3C_REPORT.md`.**
Earlier: 2026-08-21 01:20 UTC — ▼ **LEX 25-D / 20-E: THE PANEL ANSWERS QUESTIONS NOW,
AND AN EMPTY HEADING SAYS WHY IT IS EMPTY. All six sections shipped — §5 was reachable, so
nothing was stopped short. The ten §25.5 headings replace the filing system, with the
type-grouped list kept and folded underneath. ⚠⚠ The hard part was the EMPTY headings, and
there are FOUR reasons a heading can be empty which must never share a sentence: the question
ran and found nothing · it did not fire on this draft · NOTHING WE HAVE CAN ANSWER IT · the
user has added nothing. The third is the one that would otherwise be a false statement about
the world — "Who has taken a position" has no producer at all, because the position graph
holds 2.3M signals and nothing in Lex reads it, and rendering that as "we looked and found
nothing" blames the record for a gap of ours. ⚠⚠ THE REACHABILITY CHECK CERTIFIED A MODEL ON
WHICH EVERY REAL CALL WOULD HAVE FAILED, and it was WATCHED FAILING before it was fixed: with
the sampling gate emptied it reports 5 REJECTED on `temperature`, with it restored 15 usable
/ 0 rejected. UNUSABLE is the verdict 25-C did not have and is exactly where `claude-sonnet-5`
lived. The echoed model now comes back on EVERY call, not only in the check. ⚠⚠ A DEFECT THIS
SPRINT INTRODUCED AND CAUGHT BY READING REAL OUTPUT: a control-character class that also
matched the LETTER `u` silently deleted every `u` from every uploaded document ("Treasury" →
"Treasry"), with no error and nothing in a log; and a raw NUL byte in the source made the
whole module read as BINARY to grep. ⚠ Sources can be excluded with a reason and STAY —
a row, not a flag, because a decision written into the retrieval JSON is destroyed the next
time the search runs, and the row carries the source's own title so an exclusion survives the
source dropping out of retrieval. ⚠ Publishing PINS the outstanding items: live 0/0/3, pinned
version 1/1/2. ⚠ Documents and links are read ONCE into findings, never enter a prompt again,
and every quote is verified against the stored text — 3 of 3 verbatim on the live run.
▶ CHARLIE: STILL NO SIGNED-IN BROWSER WALK — the by-question panel and the "Your material"
control have never been seen in a browser, no real multipart upload has gone through the route
(the PDF and Word extractors have not run on a real file), and the Evidence Pack has never
been rendered through R2, so the first download will be the first render.
`docs/LEX_25D_REPORT.md`.**
Earlier: 2026-08-20 23:24 UTC — ▼ **LEX 25-C: THE INSTRUMENT FORK MOVED — a build drafted
"Primary legislation (Act of Parliament)", the research found the Renters' Rights Act 2025, and the
fork visibly changed to offer it. That acceptance criterion had carried "undemonstrated" for two
sprints and took THREE stacked defects to reach. ⚠⚠ The gate was never shut: probed in isolation it
recognised 3 of 3 real powers — the assessment simply ran inside the question loop, on the leading
question's own findings, while the powers were surfaced by the OTHER questions. The one question
named after the power was the one place the power was not. ⚠⚠ `recordInstrumentRetirement` logged
"instrument fork changed by research" without reading its `updateMany` count — it reported this
sprint's headline criterion as MET while the database showed no such fork. ⚠⚠ And pass 4 was ERASING
pass 3: resolving a fork overwrote `caseForAlternative`, destroying the research's own
"THE RESEARCH FOUND AN EXISTING POWER" text. ⚠⚠⚠ THE SIFT'S FAILURE IS NOT A DEEPENING BUG — it is a
platform-wide retrieval fan-out: `GatewayQuery.limit` goes to EVERY routed stream, each over-fetches
×3, and the sum returns. `limit:10` → 150 results; `limit:34` → 500. 15× at small limits, and
`grouped` is 20 either way, which is why nobody has seen it — seven callers take the flood. Reported
to CC-Search as `docs/FINDING_FOR_SEARCH_gateway-limit-fanout.md`; THE GATEWAY IS UNTOUCHED. ⚠ The
brief's 6/6/6/6 "cap before the sift" is REFUTED — it is round-robin interleave; the sift sees all
630. ⚠ The attribution note had INVERTED the rule it exists to enforce, disclaiming witness names on
rows that now carry them 96.87% of the time, in three places. ⚠⚠ `claude-sonnet-5` REJECTS
`temperature` with a hard 400 — reachability said OK, every structured call would have failed; only
a real call found it, and it is an allow-list, not a version rule. `gemini-2.5-pro` is reachable for
the first time (thinkingBudget is now per-model). The review agenda is built and mounted,
contradictions first, and it assembles rather than generates. ▶ CHARLIE: THE AGENDA HAS NEVER BEEN
SEEN IN A BROWSER — no host permission for localhost, no Clerk session on production from here. And
`grok-4.20-multi-agent-0309` needs your call: drop it from REACHABLE or route it to the endpoint
that accepts it. `docs/LEX_25C_REPORT.md`.**
Earlier: 2026-08-20 07:44 UTC — ▼ **INGEST CASELAW TEXT: the judgment was under the stylesheet all along. 74,896 of 74,896 case-law bodies re-compiled from AKN we already held — 0 re-fetches, £0 — hand-read 30 of 30 correct against judgments re-fetched live from the National Archives, with the same three checks scoring 0 of 30 on the old writer. 74,896 of 74,896 dates moved to the handed-down date, residual ZERO. ⚠⚠ THE FINDING NOBODY WAS LOOKING FOR: the keyword index carried 0 of 74,896 case-law titles and 74,066 wrong dates — last night's title recovery reached the database and stopped there, so NO USER HAD EVER SEEN A RECOVERED CASE NAME. Now 99.98% titled in the index. ⚠⚠ The brief's premise is half wrong: the judgments were never lost, the stylesheet was a median 5.7% of the characters at the HEAD — which is exactly what is served as a snippet. ⚠⚠ The guard caught three shapes my 300-document census missed and TWO WERE MY OWN BUGS: 20 judgments the source publishes as the single word `withdrawn`, 4 anonymised family judgments my CSS detector called a stylesheet because anonymisation writes `{ }`, and 2 the National Archives publishes with NO TEXT AT ALL (uk:hash = SHA-256 of the empty string) where refusing to write left a PURE STYLESHEET. ⚠ THE MEANING-BASED HALF IS STILL SERVING CSS — 12.7% of everything ever embedded for case law is stylesheet, chunk 0 is >50% stylesheet in 77% of documents, ~$31 to re-embed. ⚠ et-decisions: 131,654 of 293,403 rows (44.9%) are a LANDING PAGE, not a decision. ▶ CHARLIE: NOTHING REACHES A USER UNTIL `fts-serve` IS REDEPLOYED — Railway service c268ec09-e489-4cfa-837a-7740d95c24c7 → Deployments → Redeploy.**
Earlier: 2026-08-20 06:50 UTC — ▼ **SEARCH S10: THE BINDING CONSTRAINT IS LIFTED — these are
the first retrieval numbers this project has taken on questions it did not write. Overall recall@20
is 34% (15/44); consultations 78%, committees 30%, guidance 10%. ⚠⚠⚠ AND `cps-guidance` IS
UNREACHABLE BY ANY QUERY AND HAS BEEN ALL ALONG — display-typed GUIDANCE, indexed under tier
`other`, so the guidance stream's prefilter excludes it; all five CPS keys return at rank 0–2 scoped
to their own corpus and `streamCanSelect` is false for every one. Found because guidance scored 1/10
while consultations scored 8/9 FROM THE SAME STREAM. ⚠⚠ The one-line fix is zero-sum (guidance 2/10
→ 8/10, consultations 6/9 → 4/9) so it shipped behind `LEX_GUIDANCE_CPS`, default OFF. ⚠⚠ A single
recall number hides three different failures: 15 hit · 11 DILUTED · 14 NOT-RETRIEVED · 4 NOT-ROUTED,
and the round-robin interleave alone costs six questions. ⚠⚠ `debates` and `legislation` have ZERO
validated questions, so their vector settings are held on absence of evidence and §3's central
hypothesis CANNOT BE TESTED. ⚠⚠ S9's licence headline describes the arm production does not run —
non-commercial withholds 0, not 40.6%. ▶ CHARLIE: five decisions in the report, and the first is
just "what is `LEX_VECTOR_STREAMS` actually set to?" — the arms differ by 9 questions of 44.**
Earlier: 2026-08-20 06:44 UTC — ▼ **LEX 20-B/D: the proposal document EXISTS — a completed
proposal renders to a readable Proposal and a one-page Summary in docx and PDF, and a shared link is
PINNED to the version that was shared (publish v1, edit, mint v2, and the recipient still gets v1,
content and all). ⚠⚠ The fixture check passed 46/46 and the FIRST LIVE RUN found a defect it could
not see: Postgres `jsonb` sorts object keys by length then bytewise, so the change note said "2 fields
edited" when one had been. ⚠⚠ The headline cost REFUSES to sum a partial set. ▶ CHARLIE: §4's
recommendation is MERGE — §25.3 item 9 already absorbs §20.2's claims check and I do not think it was
noticed.**
Earlier: 2026-08-20 06:20 UTC — ▼ **GRAPH 3B: the position graph's stance score has
exactly THREE values — +1, 0, −1, with zero rows in between and 92.87% at exactly ±1.00 — so the
"top 40" had nothing to sort on. ⚠⚠ CONFIDENCE CURRENTLY REWARDS AN INCONSISTENT RECORD: nine
votes the same way scores 0.748, five-one-way-and-four-the-other scores 0.881, and on the real
Bill the 425 mixed records average HIGHER than the 1 consistent one. ⚠⚠ 3A's "a missed free vote
understates rather than overstates" is REFUTED — it emits 328 rebellion signals at weight 0.9 for
members who rebelled against nothing. ⚠⚠ And 3A's "all 400 voted the same way both times" is
FALSE (16 of 587 changed side); all 16 ranked 612th–627th of 627, below the harness's limit of
400, so the check could not have failed. 9,048 ms → 91 ms, and it was never a missing index.
Electoral Commission register ingested (89,861 rows, 244 direction-0 signals); APPG is behind a
Cloudflare bot challenge and was NOT worked around.**
Earlier: 2026-08-19 22:57 UTC — ▼ **INGEST NAMES: the case name and the witness were
inside requests we were already paying for. Case law 0% → 99.98% titled, committee evidence
0% → 96.87%, committee reports 0% → 85.58% with no fetch at all — and 21 of 23 committee
search results now carry a name, up from zero. ⚠⚠ My prediction that the citation-shaped guard
would never fire was REFUTED: the source publishes a bare citation as a case name twice, and
those two rows are blank only because the guard exists. ⚠⚠ The snippet a user and Lex see for
a judgment is a STYLESHEET — 200 of 200 documents.**
Earlier: 2026-08-19 22:25 UTC — ▼ **SEARCH S9: THE STATISTICS CATALOGUE IS BUILT — 5,733 official series discoverable through the router, and the layer STRUCTURALLY CANNOT RETURN A NUMBER. Two of the brief's three residuals were refuted (`sourceSeriesId` is null on ZERO rows, not a large minority; the per-vintage licence restriction it says is inexpressible already has a column and is in use). The licence register now GATES retrieval — 40.6% of series, half the observations, filtered before scoring. ⚠⚠ Both my predictions were refuted, one each way: 10/10 selection where I predicted 9, and 0/10 false positives where I predicted 2. ⚠⚠ MY OWN FIX BROKE THE NEGATIVE CONTROL MID-SPRINT — "UK NHS waiting list" returned five plausible UK series for a question the store cannot answer, because World Bank labels BEGIN with the country name. Fixed with two relevance floors. ⚠⚠ AND FOUR OF THE TEN CASE-LAW GOLD KEYS ARE WRONG, exposed by CC-Ingest's extracts. ▶ CHARLIE: `docs/GOLD_CANDIDATES_S8.md` is now one-pass reviewable, Q1–Q60.**
Earlier: 2026-08-19 21:45 UTC — ▼ **LEX 25-B + AMENDMENT: `/ideas/build` WAS DOWN BECAUSE ITS API ROUTE HAD NEVER BEEN COMMITTED — `app/api/ideas/[id]/build/route.ts` appears in no commit on any branch, ever. Third file-not-in-the-repository outage in a week, second on this feature. Fixed, verified live, and `check:committed` now makes the class impossible. The build itself now researches the draft against a 9-question interrogation library, revises it, and keeps the contradictions — "I first concluded primary legislation; the evidence says an existing power may already reach this" — then reads the whole thing back as a hostile clerk. 7 passes, 214s, 5.6p. ⚠ §3's premise is wrong: `intent` never selects streams for ANY caller. ⚠ §7 multi-perspective DOUBLED the cost for 7% more findings. ⚠ `gemini-2.5-pro` was unreachable through every Gemini client we have. ▶ CHARLIE: the worker is built and proven (closed-tab test 9/9) but needs a Railway service + `LEX_BUILD_DRIVER=worker` in Vercel — see `docs/BUILD_WORKER_DEPLOY.md`.**
Earlier: 2026-08-19 17:09 UTC — ▼ **GRAPH 3A: the position graph has a factual layer — 2.32M signals, 2.30M estimates, no model anywhere in it, and the ten highest-confidence records it produces are the Labour left, found from nothing but who voted against their own party. ⚠⚠ The free-vote heuristic finds every assisted dying and hunting division and NONE of the abortion ones — because the abortion divisions we hold are whipped NI Regulations, not conscience votes. ⚠⚠ Amendment sponsorship and committee membership have NO SOURCE DATA at all.**
Earlier: 2026-08-19 09:35 UTC — ▼ **SEARCH S8: the first-pass search infrastructure is finished. FOUR of eight sections reversed a premise — the two "non-existent" fallback models both return HTTP 200 (one is silently substituted), attribution exists everywhere EXCEPT the committees collection it was built for, and raising stream concurrency to 4 makes five-stream questions WORSE because 4 is exactly vector-serve's width.**
Earlier: 2026-08-17 23:12 UTC — ▼ **SEARCH S7: the carried backlog is cleared. Twice the
measurement came back "this cannot answer the question", and that is reported as the result. The
brief's committees-first prediction cannot hold — committees is at a ceiling — while caselaw and
guidance have a measured +12.5pp and debates is 15pp WORSE.**
Earlier: 2026-08-17 22:52 UTC — ▼ **INGEST CORPUS FRESHNESS: 35.7% of committee publication
citations do not open and NONE of them were withdrawn — they are PDF-only publications addressed
through a documentId we never stored, or records with no file at all. documentId now captured, the
join proven 404 → 200, and NOT landed downstream. §2: 0% → 99.3% of mentions can show the name as it
appeared (99.93% of stored edges), 93.4% of it from a view change — the names were already in
`division_votes.member_name`.**
⚠⚠ 1,785 organisations display as "mention only" while we hold a Companies House or charity number.
Earlier: 2026-08-17 22:44 UTC — ▼ **SEARCH S5: Lex can see the whole corpus at last —
0 → 100 non-legislation results on the same ten questions, 7 of 7 previously-unserved questions now
served, no legislation lost. The old path was answering an assisted-dying question from "assist
investi" matched inside an investigatory-powers SI.**
Earlier: 2026-08-17 21:52 UTC — ▼ **GRAPH 2D-5: the actual documents are readable at last
in `docs/POSITION_SAMPLE.md`, and Charlie's bottom-up architecture was measured rather than argued —
it finds 74.4% more than the 83 propositions can reach, 85% of it real, and costs 3.73× more while
recovering only 57% of the positions we know are right. A supplement, not a switch.**
Earlier: 2026-08-17 21:17 UTC — ▼ **LEX 25-A: THE §25 PREMISE IS BUILT AND RUNNABLE AT
`/ideas/build` — four questions, a confirmation the user must give, then a four-pass build that
drafts the whole kernel as proposals in 44–53 seconds for about 4p. ⚠ THE BRIEF'S SPEC
(`LEX_DESIGN_ADDENDUM_25.md`) DOES NOT EXIST IN THE REPO, and the brief's 15-minute hard stop CANNOT
FIRE on Vercel — both ceilings are declared and the code names which one binds.** Earlier:
2026-08-17 08:35 UTC — INGEST entity decode; 2026-08-17 02:49 UTC — GRAPH 2D-3; SEARCH S4, GRAPH
AMENDMENT 2, LEX 3-E, INGEST V38, GRAPH 2D-2.*

2026-08-20 06:50 UTC — ▼ **SEARCH S10 IS COMPLETE: THE BINDING CONSTRAINT ON EVERY RETRIEVAL CLAIM
THIS PROJECT HAS MADE SINCE S7 IS LIFTED.** Executes `docs/BRIEF_SEARCH_S10.md` §0–§7 against
Charlie's completed validation pass. Report: **`docs/SEARCH_S10_REPORT.md`**.
CHANGE_LOG (2026-08-20 06:50 UTC). `check:s10-fusion` **19/19 with all 5 breaks firing**,
`check:s10-stats-licence` **9/9 with all 4 breaks firing**, `verify:s10-keys` **68/68**, `tsc` clean
in `scrutinise-web`. **Cost ~£0.03.**

✅ **THE HEADLINE, WITH n BESIDE IT EVERY TIME.** Scored through `runSearch()` — the real gateway —
after proving all 68 answer-key rows present in `corpus_sections`, so every zero is a retrieval
result and not a missing row. **Overall recall@20 15/44 (34%), recall@5 16%.** Consultations
**7/9 (78%)** · caselaw **3/6 (50%, PRE-FIX BASELINE ONLY)** · committees **3/10 (30%)** · impact
assessments **1/9 (11%)** · guidance **1/10 (10%)**. These supersede S7's "committees at a 100%
ceiling" (a ceiling, not a result), S7's "+12.5pp" on caselaw and guidance, and S9's "0 of 10 false
positives" — each measured on a set its own author wrote.

⚠⚠⚠ **`cps-guidance` IS UNREACHABLE BY ANY QUERY AND HAS BEEN ALL ALONG.** Guidance scored 1/10
while consultations scored 8/9 **from the same stream** — both sit in the `guidance` tier. Not a
search-quality story, so the index was asked rather than reasoned about: all five CPS keys return at
**rank 0–2** scoped to their own corpus and `streamCanSelect` is **false** for every one. The
collection is display-typed GUIDANCE and **indexed under tier `other`**, which the guidance stream's
prefilter excludes. ⚠ Already recorded in `CORPUS_REACHABILITY.md` (10 Aug) as `keyword-only`,
deferred "pending the reranker decision" — and `keyword-only` means *reachable only when routing is
OFF*, which in production means unreachable. **The deferral was reasonable when nothing could price
it. Charlie's set prices it: five of ten guidance questions.** ⚠⚠ The one-line fix is **zero-sum** —
guidance 2/10 → 8/10 in-stream, consultations **6/9 → 4/9** — because `mergeLegs` sorts both legs on
one BM25 scale and slices to a fixed budget, so a strong extra leg takes the main leg's room. Shipped
as `LEX_GUIDANCE_CPS`, **default OFF**; the durable fix is a reindex with the collection in the
`guidance` tier, which trades nothing. ⚠ Eight more collections (~48,600 sections) are in the same
state and were not touched.

⚠⚠ **ONE RECALL NUMBER HIDES THREE DIFFERENT FAILURES WITH THREE DIFFERENT FIXES: 15 hit · 11
DILUTED · 14 NOT-RETRIEVED · 4 NOT-ROUTED.** In-stream recall@20 is **21/44 (48%)** against 34%
merged, so **the round-robin interleave alone costs six questions** — with four streams routed the
merged top 20 holds ~5 per stream, and Q4 missed by a single position. Not a defect (concatenation
was worse, S5) but now a measured allocation decision rather than an invisible one. And **4
impact-assessment questions were NOT ROUTED to `legislation`**, the only stream that can reach one
with `LEX_ROUTER_STREAMS_V2` off — the sharpest evidence yet for that flag.

⚠⚠ **FOUR OF FIVE PREDICTIONS REFUTED, AND THE WORST ONE IS WHY THE BUG WAS FOUND.** guidance
predicted **80%**, measured **10%**; committees 60% → 30%; consultations 55% → 78%; impact
assessments 25% → 11%; caselaw 50% held exactly. **An 80%-predicted collection landing at 10% forced
the question "why is its neighbour at 78%?"** ⚠ Also scored: the exact-citation control Q20 came
back at rank 2 as predicted; "the committee misses will concentrate in written evidence" was WRONG —
five of seven misses are reports.

✅ **§2 — THE ONE VECTOR DECISION WITH EVIDENCE UNDER IT REVERSES TODAY'S SETTING:** committees
**0/10 → 3/10, +30.0pp**, and vector is OFF there today. caselaw +50.0pp but over text being
replaced, **so no recommendation**. guidance **+0.0pp is a FLOOR EFFECT, not a null result**. ⚠⚠
**`debates` and `legislation` cannot be re-taken at all — the validated set has ZERO questions
either stream owns**, so S7's "debates is 15pp worse" is neither confirmed nor refuted and both
settings are now held on absence of evidence and labelled so. Latency: p50 flat, **p95 4,495 →
9,249 ms** — the dense leg costs the tail.
▶ **`LEX_VECTOR_STREAMS=legislation,caselaw,guidance,committees`.**

✅ **§3 — THE DIAL IS BUILT AND ADOPTED NOWHERE, AND SAYS SO.** `LEX_FUSION_WEIGHTS` (default OFF),
**a no-op proven by comparing rankings, not by reading the constant**. committees plateaus at 65/35
so today's 0.5 is already on it; caselaw is a step function at 0.5 on n=6 over void text; guidance is
a floor. ⚠⚠ **§3's hypothesis is about DEBATES and could not be tested.** ✅ The dial costs **no**
latency, structurally — a weight only changes how two already-retrieved rankings merge. ⚠ Every arm
comes from ONE retrieval pass captured in the PRODUCTION path, with a fidelity control that
re-derives the live call's own per-stream id order: **50 of 50 id-for-id**, without which the sweep
would have measured a copy of the pipeline.

⚠⚠ **§4.1 — S9's LICENCE HEADLINE DESCRIBES THE ARM PRODUCTION DOES NOT RUN.** The gate withholds
under `commercial`, so `commercialUseExcluded` **permits** non-commercial use. Measured:
**non-commercial withheld=0 over all 5,733 series; commercial withheld=2,329.** With
`STATS_USE_CONTEXT=non-commercial` set in Vercel, **nothing is withheld.** The setting now carries a
date, an owner, a basis and a re-take trigger, with a check that fails on divergence.

✅ **§4 — STATISTICS: 9/9 selection · 3/50 false positives · 6/9 retrieval · negative control
PASSES.** False positives measured on **Charlie's fifty** legal/evidential questions, not S9's ten
probes; **my prediction of "3–6, naming Q10/Q31/Q33/Q35/Q38" measured 3, three of them named, none
unnamed.** All three are impact-assessment questions with quantitative surface. ⚠⚠ **Q57 returned
NOTHING because `departmental` matches nothing while `department` matches the right dataset** — a
tokenisation failure, not a floor failure — and **the floors that make the NHS control pass are the
same floors that killed it.** ▶ Recommend flipping `LEX_STATS_STREAM` on, with Q53/Q57/Q59 named as
the cost.

⚠ **§6.1 REFUTED — the dense leg ALREADY embeds the rewritten, stream-specific query.** Five streams,
five different strings, none the raw question. So that improvement is banked and **cannot be part of
the debates explanation.** ⚠ My first version of this verification was itself wrong and reported a
false defect by comparing against a separately-rolled route.
✅ **§6.2 — widening `vector-serve` is ONE env var (`VECTOR_MAX_CONCURRENT`, default 4)** and our own
2 Aug measurement already shows the cap is a **throughput choice, not a safety floor** (64 concurrent
did not crash; a handle pool measured **0.82×** once run-order was controlled). Cost is memory: live
**rss 3,737 MB / peak 4,821 / cap 7,629**. That document's own "re-measure on Railway once deployed"
has never been done. ▶ Probe on Railway → `VECTOR_MAX_CONCURRENT=8` → `LEX_STREAM_CONCURRENCY` 3→7,
**never the last without the first.**

▶ **CHARLIE — five decisions, all in the report, and the first is free:** Q1 **what is
`LEX_VECTOR_STREAMS` actually set to?** (the arms differ by 9 questions of 44 and nobody here can
read it) · Q2 add `committees` to it · Q3 `LEX_GUIDANCE_CPS` on as a bridge, reindex as the fix ·
Q4 flip `LEX_STATS_STREAM` · Q5 **the next validated set should be debates and legislation and
nothing else.**

⚠ **CROSS-THREAD, RAISED NOT FIXED — `check:committed` fires on `lib/lex/known-unknowns.ts` and
`lib/lex/evidence-labels.ts`, on this machine and in no commit.** It is **LATENT, not a live break**,
and I first read it as live: checking the importing *paths* said "five committed files import two
missing ones", but checking the committed *content* says nothing in the repository imports either
(the one HEAD hit is a comment). Production is fine — HTTP 200 during this check. **The break fires
the moment the Lex thread commits its modified `deepening.ts` / `DeepeningPanel.tsx` /
`deepening-jobs.ts` without the two new files** — the `build-cost.ts` incident of 17–18 Aug exactly.
⚠ `next build` passed locally and proves nothing, because the files exist here. ▶ **Whoever owns
Deepening: `git add` both in the same commit as their importers.** Not committed by search — a
half-written file from a live session is worse than an absent one.

❌ **Not done:** `debates`/`legislation` unevaluated · no weight adopted · case law pre-fix only and
**searching a case BY NAME still cannot match the name** until reindex · the four rejects preserved
but not re-keyed · `vector-serve` not widened, no stress test run against the serving host ·
Q53/Q57/Q59 stats top hits wrong, causes named not fixed · interleave dilution measured not changed ·
`LEX_ROUTER_STREAMS_V2` still unscored · **no browser walk was possible and none is claimed** ·
every "production" configuration named is an INFERENCE about Vercel, labelled in the same sentence.

2026-08-20 06:20 UTC — ▼ **GRAPH 3B IS COMPLETE: THE GRAPH NOW SAYS WHAT ITS ORDER MEANS, WHAT ITS
STANCE IS A STANCE TOWARD, AND WHEN IT CANNOT RANK AT ALL.** Executes `docs/BRIEF_GRAPH_3B.md`
§1–§5. Report: **`docs/GRAPH_3B_REPORT.md`**. Validation draft:
**`docs/POSITION_VALIDATION_CANDIDATES.md`**. CHANGE_LOG (2026-08-20 06:20 UTC).
`check-3b.ts` **50/50** with all **7** self-test breaks firing and **6 negative controls**;
`verify:positions` **35/35** live against Neon; `tsc` clean in `scrutinise-web`. ⚠ The scripts
tree has 2 **pre-existing** `tsc` errors, neither in a file 3B touched (`check-3a.ts:405`, a
deliberately-broken literal in 3A's own self-test; `download-graph-sources.ts:55`, ingest-owned).
**Cost £0 — no LLM call.**

⚠⚠ **THE SCORE DOES NOT DISCRIMINATE BECAUSE IT IS NOT A SPECTRUM.** Over all 2,304,748 estimates
there are exactly **three distinct stance values** (+1, 0, −1) and **zero rows in between**; 92.87%
sit at exactly ±1.00. `stanceScore = signed / mass` is a normalised mean and a per-target estimate
aggregates one signal, so **one consistent vote and fifty give the identical 1.00**. Three of four
predictions hit exactly.

⚠⚠ **CONFIDENCE REWARDS AN INCONSISTENT RECORD — the sharpest finding of the sprint.** The harmonic
discount groups by `(type, class, DIRECTION)`, so disagreeing signals dodge it and each counts in
full. 9 votes one way → **0.7481**; 5 one way + 4 the other → **0.8810**. On the assisted dying
Bill, of 426 members with 9+ votes, the **one** consistent member averages 0.8957 and the **425**
mixed ones average **0.9188**. So the brief's confidence-first sort key (implemented as specified)
puts the *least decided* members at the top, where 3A's key buried them. **Both keys are biased, in
opposite directions** — decision D-7, and nothing was retuned (§1.5 is a proposal with evidence).

⚠⚠ **TWO 3A STATEMENTS ARE REFUTED.** (1) *"A missed free vote is scored at the whipped weight,
which understates rather than overstates"* — it does not: on the 2 of 11 assisted-dying divisions
the heuristic misses, it emits **328 `rebellion:v1` signals at weight 0.9**, the highest in the
config, for members who rebelled against nothing. That is the mechanism that put 108 people at the
top of Charlie's page. (2) *"All 400 who voted in both voted the same way both times"* — **16 of 587
changed side**; all 16 ranked **612th–627th of 627** under 3A's sort key and the harness passed
`limit: 400`, so **the check could not have failed**, and its passing was written up as a finding.

✅ **9,048 ms → 91 ms, AND IT WAS NEVER A MISSING INDEX.** `idx_dv_div` already existed and does the
scan in 1.95 ms; it was unreachable because **a view cannot take a parameter**, so the target filter
became a hash join and the plan materialised all 2,317,523 signals to return 981. Fixed with
`position_signal_for(types[], ids[])`, a set-returning function — no new storage.

✅ **THE PAGE NOW PRINTS ITS SORT KEY AND ITS TIES**, and renders the target inside every claim:
*"40 of 555 actors, tied at this confidence (0.671, 2 signals) — ordered by name. This is not a
ranking."* Per-division results are separately labelled and **never summed** (Charlie's D-2).

✅ **§2.2 ELECTORAL COMMISSION REGISTER INGESTED** — 89,861 records, **244 direction-0 signals** over
122 members and 80 donor organisations. Neither end resolved on similarity: donors on Companies
House number only, donees only on a normalised name that is **unique** among MNIS-identified people;
2,056 rows excluded on donee type alone (Mayor, Councillor, MSP, Candidate, Members Association).
84.6% of eligible individual rows resolve. ⚠ **244 is thin because of our entity layer, not the
register — 14,879 records carry a CH number we do not hold** (D-10, ~11× widening available).

⛔ **§2.1 APPG NOT BUILT: it is behind a Cloudflare bot challenge and I did not build a way around
one.** `publications.parliament.uk` 403s every programmatic request including its homepage while
every other parliament.uk API returns 200; headless Chromium gets "Just a moment…"; real Chrome
renders it. Three legitimate routes in D-8, and **`interests-api.parliament.uk` is open and carries
member ids** — a better identity story for a later sprint.

⚠⚠ **NEON HAS PASSED THE 17.5 GiB LINE (17.68 GiB, 101.1%) AND THE LINE CANNOT BE SOURCED.** It
lives at `scripts/ingest/search/serve-observer.ts:50`, comments itself as the "Neon plan ceiling"
(it is not — the enforced ceiling read from this compute is 16 TiB), and cites "the handoff", whose
percentage is emitted by that observer. **Circular.** Reported not edited (ingest-owned) — D-11.

⚠⚠ **I BROKE `position_estimate` MID-SPRINT AND IT IS WORTH THE PARAGRAPH.** Redefining
`position_signal_vote` over the new function was correct, byte-identical, and **measured on the
wrong access pattern**: the estimate build filters `WHERE actor_id BETWEEN`, and against a function
`actor_id` is an output column, so every batch hash-joined the whole vote arm. **The table was
truncated and left half-rebuilt (1,357,000 of 2.3M) after a read timeout.** Fixed by keeping the
view's own FROM clause and replacing only the CASE with `position_vote_class()`; rebuilt 2,304,858
estimates in 248.1s (3A: 225s; the ~9% is the scalar call, named not absorbed). *One object, two
readers, one benchmark.* Separately: `weightFunctionSql()` hard-coded its signal-type list, so a new
config weight produced **NULL** in SQL while TypeScript returned 0.1 — now derived from the config's
own keys, with a check that was watched failing first.

▶ **CHARLIE:** `/admin` → **Position Graph** → search `Terminally Ill Adults` → tick **Amendment (b)
to New Clause 14** and **Amendment 12** → *Show positions*. The amber tie sentence is the string
that proves this deployed. Then **`docs/POSITION_VALIDATION_CANDIDATES.md`** — one VERDICT line per
row; it is the gate on any of this reaching a user, and its citations are **non-circular by
construction** (bill/amendment sponsorship, of which the graph holds provably zero signals).
⚠ No browser walk was possible from here and none is claimed — every surface is behind Clerk and 3A
proved an unauthenticated probe cannot tell a deployed route from an absent one.

❌ **Not done:** APPG (D-8) · Companies House joins, no API key (D-12) · **nothing scored, no
accuracy figure claimed anywhere** · no weight retuned · the free-vote heuristic's misses diagnosed
not fixed (D-13) · amendment sponsorship measured and specified (§4.3) not ingested · the deepening
wiring still unapplied · 97.1% of EDM signatures still missing.

2026-08-20 06:44 UTC — ▼ **LEX 20-B/D IS COMPLETE: THE PROPOSAL DOCUMENT EXISTS, AND A SHARED LINK
CANNOT SHIFT UNDER ITS RECIPIENT.** Executes `docs/BRIEF_20BD.md` §0–§5. Report:
**`docs/PROPOSAL_20BD_REPORT.md`**. CHANGE_LOG (2026-08-20 06:44 UTC). `check:20bd` **47/47 with all
13 self-test breaks firing**, `verify:20bd` **45/45 live against Neon and R2**, `tsc` clean,
`next build` compiled with all nine new routes, Sprint 2.5's `check:documents` still passes.
**Cost $0 — no model call anywhere in this sprint, by design.**

✅ **EVERYTHING BUILT SO FAR WAS AN INPUT TO A DOCUMENT THAT DID NOT EXIST. IT EXISTS.** A completed
proposal renders to a readable Proposal and a one-page Summary in docx and PDF from one snapshot,
through Sprint 2.5's block model — two renderers over one block model, as `model.ts`'s own header
said §20-B was meant to use it. Owner page `/ideas/[id]/publish`; recipient link `/proposals/[token]`.

⚠⚠ **THE FIXTURE CHECK PASSED 46/46 AND THE FIRST LIVE RUN FOUND A DEFECT IT COULD NOT SEE.** The
change note said *"2 fields edited"* when **one** had been. **Postgres `jsonb` does not preserve key
order — it sorts keys by length then bytewise** (verified against Neon: `{affectedGroups, impact,
cost}` returns as `{cost, impact, affectedGroups}`), so comparing a stored snapshot against a fresh
one with `JSON.stringify` marked every structured field permanently edited. **The content hash was
never affected because both its sides are freshly built objects — one comparison had the guard and
its neighbour did not.** §24 computes "12 of 14 findings resolved since" off exactly this field.
⚠ My original assertion (`changeNote.includes('Chosen approach')`) was true in both the broken and
the fixed output and would have shipped it; it now asserts the COUNT and the ABSENCE.
⚠ **A second error was mine, in my own test** — `JSON.stringify(a, Object.keys(a).sort())` reported a
hash defect that does not exist: the replacer-ARRAY form does not reorder keys, it FILTERS them at
every level.

✅ **THE SEAM HELD AND WAS WATCHED FAILING AGAINST REAL CODE.** `buildProposalSnapshot` is the only
thing in the document stack that reads idea state; the import ban and the no-Prisma-in-a-renderer
rule are asserted over the whole directory, and both were proved by adding the banned import to
`build-proposal.ts` for real, watching the assertion go red, and restoring byte-identical.
⚠ **`lib/lex/known-unknowns.ts` is deliberately NOT imported — it is 25-C's and it is UNCOMMITTED in
this shared tree**, so importing it would put a file on Main whose import does not resolve (the
`build-cost.ts` incident). The assembler reads the JSON column instead.

✅ **ALL FOUR VERSIONING PROPERTIES PROVED AGAINST THE LIVE DATABASE, NOT ASSERTED.** Append-only by
**watching Postgres refuse a second write of version 1** (`P2002`). Unchanged mints nothing. **Publish
v1 → edit → mint v2 → the resolver still returns v1 and the recipient's CONTENT is still the old
content.** COMMUNITY reads the published version only; non-member `not_in_community`, signed-out
`sign_in_required`. ⚠ **The version number is in the R2 object key** — without it a v3 re-render
overwrites the object a v1 link points at and the recipient's document changes with no URL change.
⚠ **The share token is minted once and kept**, so a link already in an MP's inbox survives a
re-publish.

⚠ **THE HEADLINE COST REFUSES TO SUM A PARTIAL SET** — one uncosted action and the Summary says "not
costed in the record", because a total silently omitting three of five actions is the most dangerous
number the document could carry. ⚠ **The unsupported marker is deliberately not on every field and
both halves are asserted** — a guiding-policy field is a decision, not a claim, and a fully sourced
proposal must carry NO marker or the marker is decoration. ⚠ **The gaps section is never empty**, and
⚠ **only ACCEPTED evidence enters the snapshot** (a PROPOSED finding is a judgement nobody made).

▶ **CHARLIE — §4 RECOMMENDATION: MERGE 20-C's claims check and source curation INTO 25.3's agenda**,
and give publishing a thin confirmation rather than a second gate. Decisive reason:
**`LEX_REBUILD_DESIGN.md` §25.3 item 9 already says so** — *"(Absorbs §20.2's claims check; it belongs
here.)"* — in the spec 25-C is building from right now, and I do not think it was noticed. The one
thing genuinely not in the agenda: the agenda is per-idea and continuous, curation is per-artefact
and frozen, so publishing should pin the agenda's outstanding items **into the version** — which is
what makes §24.4's sentence computable, and `describeChange` computes it today. Full reasoning in the
report.
▶ **CHARLIE (browser, 6 steps in the report):** Documents/Exports tab → "Open publishing" → generate
both, publish to a link, edit a field, and confirm the link **still** shows the old version.
▶ **REPORTED NOT MADE, nobody owns it:** §20.2.1 needs an `excluded` state on a source ("excluded, not
deleted") and **no such state exists anywhere in the schema** — the Evidence Pack is blocked on it.
▶ **25-C:** when the known-unknowns collapse is committed, the assembler should call it.

❌ **Not done:** the Evidence Pack, the Online View and the standalone Legislative Annex — scaffolded
in the snapshot with their inputs defined, deliberately unbuilt (`/proposals/[token]` is the link
resolver made visible and says so) · 20-C itself · the `excluded` source state · **per-claim
attribution at the sentence level** (support is per field/cause/action, the honest limit of a
structural check) · **no browser walk was possible from here and none is claimed.**

2026-08-19 22:25 UTC — ▼ **SEARCH S9 IS COMPLETE: THE STATISTICS CATALOGUE IS BUILT, ROUTED AND
FLAG-GATED — THE LAST UNBUILT STREAM IN THE FIRST-PASS ARCHITECTURE.** Executes
`docs/BRIEF_SEARCH_S9.md` §1–§6. Report: **`docs/SEARCH_S9_REPORT.md`**.
CHANGE_LOG (2026-08-19 22:25 UTC). `check:s9-catalogue` **30/30 with all 9 self-test breaks
firing**, `tsc` clean. **Cost ~£0.02** (60 router calls; no embedding, no index build, no heavy job).

✅ **5,733 official series — ONS, OBR, HMRC, PESA, World Bank, IMF — are discoverable through the
router exactly as legislation is (`LEX_STATS_STREAM`, default OFF), and the layer STRUCTURALLY
CANNOT RETURN A NUMBER.** Only catalogue headings are indexed; `stat_observation.value` appears
nowhere in the SQL; `SeriesDescriptor` has no field a value could travel in, and
`assertNoObservationValues()` re-checks that at the boundary on every call. The payload travels on
`GatewayResult.statistics`, **not** in `results`, so a catalogue heading can never be quoted as
evidence of a fact — it is evidence a *measurement exists*. `SEARCH_CONTRACT.md` §2/§3 updated in
the same commit.

⚠⚠ **TWO OF THE BRIEF'S THREE RESIDUALS WERE WRONG.** `sourceSeriesId` is null on **zero** rows,
not "a large minority" (the ingest side backfilled it since the 4 Aug snapshot the code comment
still quotes) — **but do not simplify the key**: the natural key without `seriesLabel` still
collides on 1,306 series (22.8%), so `seriesKey` remains the only unique stable handle, and 79% of
`sourceSeriesId` is our own synthesised slug rather than provenance. And the per-vintage licence
restriction the brief says cannot be expressed **already has a column and is in use** (2,329
explicit overrides); what is genuinely inexpressible is only a restriction changing part-way
through one series' own time range.

✅ **THE LICENCE REGISTER GATES RETRIEVAL RATHER THAN SITTING BESIDE IT.** 2,329 of 5,733 series
(40.6%, all IMF) are restricted — **50.2% of all observations, half the store.** Filtered on the
row set *before* scoring, so a restricted series is never a candidate; `useContext` is required
with no default, so a caller that forgets does not compile; an unrecognised value fails to the
restrictive branch; the withheld count is logged every call. ⚠ The load-bearing break asserts the
permissive arm *does* reach 10 of them — otherwise "none in the commercial arm" would pass just as
well if the query had never matched IMF.

⚠⚠ **BOTH PREDICTIONS REFUTED, ONE IN EACH DIRECTION.** Recorded before the run. The router
selected statistics on **10/10** quantitative questions where I predicted 9 (and named the wrong
miss). It selected it on **0/10** legal/evidential questions where I predicted 2 and named them —
that is the number §5 says matters most.

⚠⚠ **MY OWN FIX BROKE THE NEGATIVE CONTROL MID-SPRINT.** Telling the router to name the geography
made "UK NHS waiting list" return **five plausible UK series** for a question the store cannot
answer at all — because World Bank and IMF labels *begin with the country name*, so `uk` matches
the LABEL of thousands of rows. **One meaningless token manufactured five plausible hits.** Fixed
with two structural floors (an identity-heading match, and a discriminating term ≤10% of the
population). Also fixed: dataset title and publisher, identical on every row of a dataset, were
outranking each row's own identity — "Gini coefficient" returned *Unemployment rate*.

⚠ **THE A/B REGRESSION ARM IS UNREADABLE and an earlier version of it was SATURATED** — the router
re-rolls every query per arm, and `FTS_SEARCH_URL` is unset locally so the first run compared 0
results against 0 and printed "identical on 10/10". Replaced by a deterministic proof that is
stronger than the A/B could be: adding `statistics` to a fixed route gives byte-identical
`perStream` over 36 results.

⚠ **Retrieval quality 8/10 plausible top hits — NOT a recall figure** (the questions are mine and
UNVALIDATED). The two failures name a real mechanism: a heading is ~5 words, so one incidental
token dominates (`international` matched *GDP per capita, PPP (current international $)*).

▶ **CHARLIE: `docs/GOLD_CANDIDATES_S8.md` is now one-pass reviewable — Q1–Q60, one VERDICT line
each.** ⚠⚠ **Four of the ten case-law keys are WRONG** (Q11, Q17, Q18, Q19), exposed by
CC-Ingest's extracts: `[2015] UKSC 21` is *R (Evans) v Attorney General*, not an equality-duty or
benefit-cap case. Left in place and marked — **deleting them would delete the finding**, which is a
40% error rate on keys asserted from outside knowledge and the sharpest evidence yet for
SEARCH_STRATEGY §5.2.
▶ **CHARLIE (Vercel, unreadable from here):** `LEX_STATS_STREAM` stays OFF until Q51–Q60 are
validated; set `STATS_USE_CONTEXT=non-commercial` explicitly.
⚠ No browser walk was possible from here (no localhost host permission, no Clerk session on
production) and none is claimed — what to click is named in the report.

❌ **Not done:** nothing validated, no recall figure claimed · 27 of ~40 code-labelled measure
families still unglossed (and **a gloss will not be invented** — same failure class as an invented
figure) · Q53 and Q59 top hits wrong · no `department` column and `oecd-cofog-expenditure` holds
**0 series** (both raised to the stats thread, neither edited) · the values path is unscored.

2026-08-19 22:57 UTC — ▼ **INGEST NAMES IS COMPLETE: THE CASE NAME AND THE WITNESS WERE INSIDE
REQUESTS WE WERE ALREADY PAYING FOR.** Executes `docs/BRIEF_INGEST_NAMES.md` §0–§3. Report:
**`docs/INGEST_NAMES_REPORT.md`**. CHANGE_LOG (2026-08-19 22:57 UTC). `check:names` **33/33**,
`check:names-negative` **5/5 fired with the rollback demonstrated**, `verify:names-e2e` run live,
`tsc` clean in `scrutinise-web`. **Cost $0 — no LLM call anywhere.**

✅ **CASE LAW 0% → 99.98%** (74,883 of 74,896; 74,877 route `source`, 6 `parsed:v1`, route stored
per row). **COMMITTEE EVIDENCE 0% → 96.87%** (written 97.72%, oral 90.11%; 1,603 API pages, 0 failed,
0 incomplete windows, ~1.9 h, metadata only). **COMMITTEE REPORTS 0% → 85.58%** with **no fetch at
all** — the committee's name was already in our own `notes` blob.

✅ **AND IT REACHES A USER: 21 of 23 committee results now carry a name (91%)**, measured through
the platform's own search with both services' counters read either side, against S8's 0. Verbatim:
`Water Quality in Rivers — WQR0085 — Salmon and Trout Conservation` — §0's own example. ⚠ n is
small and the router is non-deterministic; an intermediate run measured 57%.

⚠⚠ **MY PREDICTION WAS REFUTED BY THE GUARD I DOUBTED.** I predicted zero citation-shaped rejects
because "the source never publishes a bare citation as a case name". It does, twice
(`FRBRname="[2015] EWHC 1842 (Fam)"`). Those rows are blank instead of titled with their own
citation **only because the guard exists**. ⚠ A third is my guard's own false negative:
`FRBRname="M"` is the real name of an anonymised family case and my rule strips it to nothing.

⚠⚠ **THE BRIEF'S PREMISE THAT EVERY JUDGMENT IS UNTITLED IS WRONG** — `tna-caselaw` was the only
blank collection; `et-decisions` 100%, `scottish-courts` 99.9%, `echr-hudoc` 100%, `ni-judgments`
98.0%, `cma-cases` 94.0%, `tax-tribunals` 92.3%. ⚠ Titled is not well titled and those were not
improved.

⚠⚠ **THE SNIPPET A USER AND LEX SEE FOR A JUDGMENT IS A STYLESHEET** — 200 of 200 sampled
`tna-caselaw` documents open with the AKN generator's CSS (p50 5.3%, p90 23.5%, max 67.9%), and the
snippet is cut from the head. Lex's evidence for *R (Miller) v The Prime Minister* literally begins
`#judgment { font-family: 'Times New Roman'; … }`. NOT fixed — needs a re-compile of 74,896
documents plus an index rebuild (D-4).

⚠⚠ **8,302 GOVERNMENT RESPONSES ARE DELIBERATELY UNATTRIBUTED.** They are the Government's text
under a committee's inquiry, carrying that committee's name on the row — the obvious sweep would
have labelled them as the committee's findings. A live negative control corrupts one and watches
the guard turn red.

⚠ **PER-SPEECH ORAL ATTRIBUTION IS SCOPED OUT AND SAYS SO.** One row per whole transcript, so we
store **who appeared**, never a speaker: **0 of 15,806 oral rows carry `speaker`**, asserted live.

▶ **CHARLIE — four decisions, all in the report:** D-1 the committee ROLE phrase (a search-owned
one-liner; and `lib/lex/attribution.ts` now documents the OPPOSITE of the data — its
`ATTRIBUTION_ABSENCE_NOTE` goes into the prompt saying we hold no committee names) · D-2 provenance
in `notes` vs its own column (recommend: leave) · **D-3 `itemDate` on 74,896 case-law rows is the
citation year, not the judgment date** — `[2019] UKSC 41` reads 2019-01-01, handed down 2019-09-24;
the live writer now stores the true date, so old and new rows are on two bases until a 13-minute
rerun you authorise · D-4 the CSS re-compile.

▶ **CC-SEARCH — one line, reported not made:** `lib/lex/corpus-type-map.ts:226`,
`TITLE_FROM_DB = new Set(['bills-api'])` → add `'tna-caselaw'`. Without it the dense half shows the
recovered case name and the BM25 half shows the literal slug `tna-caselaw` (the FTS index still
holds `sectionTitle: null`, confirmed by querying `fts-serve`). ⚠ It does not fix
`titleBoosted: false` — **searching for a case BY NAME still cannot match the name** until reindex.

✅ **§1.3's extracts found four bad gold keys** — K1/K7 are both *R (Evans) v Attorney General*, K8
is a notice-of-termination case, K9 is a data-breach vicarious-liability case. Already committed by
the search thread (975ecc4), which records a 40% key error rate off the back of them.

❌ **Not done:** per-speech oral attribution · the BM25 title line and the name-match reindex · the
CSS re-compile · 41,419 `committees-reports` rows (12.0%) with no metadata blob and so no author ·
1,401 oral sessions with no witness record at source · the 13 untitled case-law rows · the other
case-law collections' poor titles · **no browser walk was possible from here and none is claimed.**

2026-08-19 17:09 UTC — ▼ **GRAPH 3A IS COMPLETE: THE POSITION GRAPH HAS A FACTUAL LAYER — 2,317,523
signals and 2,304,748 estimates, built from votes, EDM signatures, witness appearances and declared
interests, with no model anywhere in it.** Executes `docs/BRIEF_GRAPH_3A.md` §1–§7 against
`docs/POSITION_GRAPH_DESIGN.md`. Report: **`docs/GRAPH_3A_REPORT.md`**.
CHANGE_LOG (2026-08-19 17:09 UTC). `check-3a.ts` **33/33** with **all 15 self-test breaks firing**,
`verify:positions` **23/23 live against Neon**, `tsc` clean in both trees, `next build` compiled.
**Cost $0 — no LLM call anywhere.**

✅ **THE SANITY CHECK NOBODY DESIGNED: the ten highest-confidence records in the whole graph are
Richard Burgon, Bell Ribeiro-Addy, Nadia Whittome, Grahame Morris, Ian Byrne, Imran Hussain, Apsana
Begum and Rachael Maskell.** The arithmetic found the Labour left from nothing but who voted against
their own party's majority. Nobody told it who they were.

⚠⚠ **THE FREE-VOTE HEURISTIC WORKS AND THE BRIEF'S EXPECTATION OF IT IS HALF WRONG.** The ten
most-split divisions it flags are all the assisted dying Bill; the 2006 and 2015 Assisted Dying
Bills, the 2003 Hunting Bill, House of Lords Reform and the Coroners and Justice Bill are all in the
list. But **abortion is 0 of 11 — because the abortion divisions we hold are not free votes.** They
are Northern Ireland abortion *Regulations*, which the Government whipped (Labour cohesion 0.92–0.99);
the classic conscience votes predate our Commons coverage, which starts 2016-03-09. ⚠ And the
hunting misses generalise: Lords Conservative cohesion on hunting was 0.97–0.99 *by conviction*, so
**a free vote a party happens to agree on is indistinguishable from a whipped one, and always will
be.** My own prediction of 565 free-vote-like divisions measured **34** — I predicted conscience
votes; the heuristic detects visible party splits, and those are not the same thing.

⚠⚠ **THE BRIEF EXPECTED PARTY-AT-TIME-OF-VOTE TO NEED INFERRING. WE ALREADY STORE IT** on 2,527,966
of 2,528,032 vote rows — verified, not assumed, from dated transitions (Corbyn Labour→Independent→Your
Party; Rosindell Con→Reform UK). So rebellion is a plain fact with no inference caveat. It works end
to end: **Imran Hussain's two assisted-dying votes classify differently** — unwhipped-group in Nov
2024 (he had lost the whip), free-vote-heuristic in Jun 2025 (readmitted). Nothing was told that.

⚠⚠ **TWO OF THE FIVE P0 SIGNAL TYPES HAVE NO SOURCE DATA.** Amendment sponsorship: `bills-api` holds
6,574 publication PDFs and **no sponsor or amendment rows anywhere in the database**. Committee
membership: `graph_member_post` is 7,970 *government/opposition* posts; searching it for committees
returns 165 rows, all Lords "Deputy Chairman of Committees" or party NEC seats. Both reported by name
in the script's own output every run, never silently skipped.

⚠⚠ **DO NOT ROLL SEVERAL DIVISIONS ON ONE BILL INTO ONE NUMBER YET.** 448 of 453 members with 3+
votes on the assisted dying Bill read as a "divided record", because voting *for* the Bill and
*against* an amendment to it are opposite directions once summed. Structural, not a bug — it is what
3B's amendment classification exists to fix.

⚠ **`position_estimate` cost 596 MB and the database is now at 99.2% of the 17.5 GiB ops ALERT line**
(the enforced ceiling is 16 TiB, and the observer has been red since 95.3% before this sprint). 90%
of those rows summarise exactly one vote. **The vote SIGNALS were deliberately NOT stored** — derived
as a view over `division_votes`, saving 0.48 GiB, on 2D-2's rule: store the fact you do not already
have. Decision D-1 in the report.

▶ **CHARLIE: click `/admin` → "Position Graph"**, search "Terminally Ill Adults", tick the two
readings, and open the evidence on anyone you have a view about. ⚠ No browser walk was possible from
here (no localhost host permission, no Clerk session on production) and none is claimed.

❌ **Not done:** the deepening wiring (§0 held it for S8, which has since landed — snippet ready in
the report) · §3.3 and §3.4 for want of data · 3B's amendment classification · the §8 validation set,
which is the gate on any of this reaching a user · 97.1% of EDM signatures, still primary-sponsor
only · **120 members excluded although we know exactly who they are** (name collisions; 50,491 votes,
including every vote by Lord Patel, Lord Jopling and Lord Moynihan).

2026-08-19 09:35 UTC — ▼ **SEARCH S8 IS COMPLETE: THE FIRST-PASS SEARCH INFRASTRUCTURE IS
FINISHED, AND FOUR OF THE EIGHT SECTIONS REVERSED A PREMISE THE BRIEF OR THE CODEBASE HELD.**
Executes `docs/BRIEF_SEARCH_S8.md` §1–§8. Report: **`docs/SEARCH_S8_REPORT.md`**.
CHANGE_LOG (2026-08-19 09:35 UTC). `verify:s8-deepening` **25/25 live against Neon**,
`check:s8-attribution` **33/33**, `check:s8-config` **18/18 with --probe**,
`check:model-registry` **25/25**, `check:deepening` all pass. `tsc` clean (a mid-session failure in `lib/lex/build.ts` was another session's working copy, never `HEAD`, and has resolved).
**Cost £1.01, measured from the `LlmSpend` ledger, not estimated** — `deepening.sift` 64.5p (the sift dominates, and it is the same component whose truncation caused §1's fourth defect), `deepening.gather` 28.9p, `search.query-router` 6.8p across 242 calls, `deepening.adversarial` 0.9p. ⚠ My own pre-run estimate was ~£0.40; the ledger says 2.5x that.

✅ **§1 — PRECEDENT AND DEVOLUTION_SCOPE ARE WIRED, AND THE ARTEFACTS WERE READ BACK FROM NEON.**
The "nobody has checked whether this worked" sentence is **reachable in real stored output**, not
just present as a constant. ⚠⚠ **FOUR DEFECTS FOUND BY RUNNING IT.** The linked-instrument path
**could never return anything** — `IdeaLegislation.legislationItemId` is a UUID, not a gid, so the
strongest of the two sources was silently dead on every idea. `retrieveDevolutionScope` **ignored
its own limit** and wrote a **577-line** body into `EvidenceItem` (asked for 24, stored 360).
And the job loop sat after both the zero-candidate return AND `writePassReferences` — a truncated
sift returned 500 candidates, the JSONB write threw, and the LEGAL pass ended FAILED having run no
job and recorded no reason. ⚠ The sift-passthrough root cause is NOT fixed.

⚠⚠ **§2 — ATTRIBUTION IS BUILT, AND THE COLLECTION IT WAS BUILT FOR HAS NOTHING.** Of **54**
non-legislation collections, **14 carry attribution and 40 carry none**. `committees-evidence` is
**0 of 800 rows** across four id offsets, on both columns; `committees-reports` 0 of 600. The
witness's name is in the R2 body and in no metadata we hold — **an ingest job, not a search one**.
✅ What IS carried: the whole pwdata family, Holyrood, the Senedd, `early-day-motions` (⚠ the
SPONSOR), `tax-tribunals` (⚠ the JUDGE), `pwdata-wrans` (⚠ the minister ANSWERING) — three roles
that any plausible default would have described wrongly, all read off the ingest writer.
✅ On the S5 ten questions: **34 of 100** results attributed; **DEBATE 97%** against a store rate
of 4.0–99.5% — retrieval favours modern Hansard, so the user sees far better than the average.
⚠ **Two of my own measurement bugs, both caught by running it:** the first audit probed corpus
names I had GUESSED (`caselaw`, `guidance`, `hansard` — none exist) and never sampled
`tna-caselaw`; and `LIMIT 200` with no `ORDER BY` read **0/200** on a collection that is 99.5%
populated from 2010.

✅ **§3 — THE FRAMING EXPERIMENT CAN ANSWER ITS QUESTION AT LAST, AND THE ANSWER IS NO.** Re-homed
through `runSearch()`: **headroom 4/31 → 22/31**, recall 8.1% → **42.2%**. Framing effect
**−1.1pp**, better on 3 and worse on 3 — a **real null result** rather than S7's floor effect.
Both predictions, recorded in the change log before the run, held. ⚠ Which comparison ran is
stated: bare vs **caller-enriched**, NOT the Lex user-profile contrast.

⚠⚠ **§6 — THE PREDICTION IS REFUTED AND THE MECHANISM IS IN THE SERVICE'S OWN COUNTERS. DO NOT
RAISE `LEX_STREAM_CONCURRENCY`.** On five-stream questions cap 4 is **worse on every statistic**:
p50 7,205 → 11,136 ms, p95 13,071 → **19,885 ms**. **4 is exactly `vector-serve`'s width** — its
`/stats` shows `max: 4` and `queueHighWaterMark: 4` during the run. Per-stream fusion means each
stream issues a vector call, so a cap of 4 fills the service exactly and the fifth stream queues.
**Raising the cap buys saturation, not a wave** — which is the reasoning S5 §2 used to pick 3,
holding up under test. ⚠ n=5 per arm on the binding subset; direction consistent, price imprecise.

⚠⚠ **§7 — THE BRIEF'S PREMISE IS FALSE, TWICE.** Both "non-existent" fallback models return
**HTTP 200**. `claude-haiku-4-5-20251001` echoes its own id — **callable, never stale**; the
registry had excluded it on a `/v1/models` read, and **a model-list read is not a callability
test**. `grok-3-fast-beta` returns 200 and echoes **`grok-4.3`** — xAI **silently substitutes**, so
the model our config named was never the model any user got, on every Lex turn that path served.
Both routes now name `grok-4.3`; `KNOWN_STALE` is empty. ✅ Anthropic and xAI prices added with
source URL and date-checked; no configured model resolves to "unpriced". ⚠ Declared inaccuracies:
xAI is prompt-length tiered and this table records the LOW band (understates by up to 2×), and
Sonnet 5's LIST price is recorded rather than its expiring promotion. ✅ **Nothing live wants an
OpenAI key** — the only server-side read sits behind two entry points that throw.

⚠ **§4 — `LEX_ROUTER_STREAMS_V2` BUILT, FLAG OFF, GATE NOT CLEANLY ADJUDICABLE.** Recall flat
(41.1% → 41.1%), latency near-free (p50 −232 ms, p95 +810 ms). ⚠ It adds **no reachability** — the
three collections are already inside tiers an existing stream selects; it adds a SLOT in the
interleave. ⚠⚠ Three regressions, **only one of them the change**: F2 lost `legislation` and
`guidance` to `consultations` (100% → 50%), while C2 and B6 **selected identical streams in both
arms** and still moved — that is the router's per-stream query rewrite, a fresh LLM call per arm.
**Displacement and router non-determinism are confounded at n=1 per arm.** ⚠ `impact-assessments`
— the stream §4 quotes verbatim — was chosen on **1 of 44** and its own probe did not select it.
**Leave it OFF** until §5 is validated and `explanatory` has questions.

📋 **§5 — 50 DRAFT GOLD QUESTIONS in `docs/GOLD_CANDIDATES_S8.md`, NOTHING SCORED.** 21 outside-in
/ 29 document-outward, six new question shapes. ⚠⚠ **CASE LAW CANNOT BE KEYED FROM THE DATABASE AT
ALL** — every `tna-caselaw` row has `sectionTitle = NULL`, the id IS the neutral citation, and the
subject lives only in R2. All ten case-law questions are marked `PRESENT / SUBJECT UNVERIFIED`.
⚠ Only **52%** of impact assessments resolve to a named instrument; four guidance collections
(`ico`, `fca-handbook`, `sentencing-council`, `planning-policy`) are unaskable by title.

▶ **CHARLIE: `docs/GOLD_CANDIDATES_S8.md` needs your validation pass — the case-law section most.**
▶ **CHARLIE (browser):** run the Deepening on a real idea and confirm the two new cards; then ask
Lex about a debate (expect a named speaker) AND about committee evidence (expect NO name — that
absence is correct and is the §2 finding).
▶ **CHARLIE (Vercel, unreadable from here):** `LEX_ROUTER_STREAMS_V2` OFF unless §4's numbers
persuade; `LEX_STREAM_CONCURRENCY` stays 3; S7's `LEX_VECTOR_STREAMS` recommendation stands.

❌ **Not done, named:** committee attribution (ingest) · the sift passthrough that caused §1's
fourth defect · `explanatory` has no gold questions, so §4 is only two-thirds scoreable · every
case-law subject unverified · `check:score-scope` still fails on the Central thread's
`lib/question-library.ts` (reported, not edited).

2026-08-17 22:52 UTC — ▼ **INGEST CORPUS FRESHNESS IS COMPLETE: nothing was withdrawn, and the
missing names were already stored.** Executes `docs/BRIEF_INGEST_CORPUS_FRESHNESS.md` §1 and §2.
Report: **`docs/CORPUS_FRESHNESS_REPORT.md`**. CHANGE_LOG (2026-08-17 22:52 UTC). **Cost ~$0.00 —
no LLM calls.**

⚠⚠ **§1 — THE RATE IS WORSE THAN THE BRIEF THOUGHT AND ITS DIAGNOSIS IS WRONG. 35.7% of committee
publication citations do not open (n=498 scored of a deterministic 500), and `gone` is 0 of 498**
(95% CI 0–0.8%). They are **PDF-only publications addressed through a `documentId` we never stored**
(13.9%, ~6,300) or **records with no file at all** (21.9%, ~10,000). The brief's own example `22140`
returns 200 from the API and its document opens. **A publication is addressable three ways and we
store the one that never works.**
✅ `committee_publication_document` now captures every `documentId`, and **the downstream join was
RUN and PROBED** — `42694` goes 404 → 200. ▶ **The web resolver is NOT changed, so 35.7% is still
35.7% for a user**: the join belongs to `lib/lex/committee-url.ts`'s thread and its data now exists.
⚠ **"Mark them unavailable" would change nothing today** — `availability_status` reaches the FTS
index but **no serve path reads it**. Charlie's call, both halves.
⚠⚠ **I corrected my own recommendation before it shipped:** "no link where `document_id` is null"
was WRONG — **45.0% of no-file publications still open at `/html/`** (n=60, CI 33.1–57.5%), so
dropping the link would have removed working citations. NULL means *no file in the API*, not
*nothing to open*; the user-facing 21.9% needs BOTH halves.

⚠⚠ **TWO DEFECTS IN MY OWN MEASUREMENT.** Node's `fetch` is refused by `committees.parliament.uk`
regardless of User-Agent (Cloudflare TLS fingerprinting) — **documented in our own
`sources/committees-portal.ts`, which I did not read first**; 300 of 300 probes came back 403 and
the classifier correctly refused to call them dead. Then the corrected run **manufactured two
"gone" verdicts out of 403s** on the document URL. Fixed, watched failing first; a live/dead canary
pair now refuses to let the script run blind.

✅ **§2 — 0% → 99.4% of mentions can show the name as it appeared (2,701,597 of 2,717,900), and
93.4% of that came from a VIEW CHANGE with no sweep at all.** `division_votes.member_name` and
`edm_sponsor.sponsor_name` already held it for 2.5M mentions. The stored half took a 36.5-minute
two sweep re-runs (36.5 min + 4 min): **164,131 of 164,238 edges — 99.93% — 1,470 VARYING**.
✅ The grain differs from the brief's "one column on the edge" on purpose: the FACT lives on
`graph_evidence` (one appearance), the edge carries a first-seen copy plus `subject_surface_varies`.
✅ **794,019 surfaces differ from our canonical name** (`Zenobe` for `Zenobē`) — our own
normalisation, until now unrecoverable. ⚠ An INFERRED edge carries NULL on purpose.

⚠⚠ **A RED CHECK THAT IS NOT MINE, WITH A LIVE COST: 1,785 organisations display as "the name as it
appeared, and nothing more" while we hold a Companies House or charity number for them.**
`match-registers.ts --promote` writes the key and never updates `key_source`. One line plus one
UPDATE — **not run, because it changes what 1,785 entities claim about their identity. CC-GRAPH's.**

⚠ **Neon is at 16.63 GiB — 95.0% of the 17.5 GiB ops ALERT line** (the enforced ceiling is 16 TiB
per V38, so this is a warning, not a wall).

❌ **Not done:** the web resolver join · marking the ~10,000 no-document rows · the
`match-registers` key_source fix · 2 of 500 probes unresolved and excluded rather than assumed.

2026-08-17 23:12 UTC — ▼ **SEARCH S7 IS COMPLETE: THE BACKLOG CARRIED SINCE S3 IS CLEARED.**
Executes `docs/BRIEF_SEARCH_S7.md` §1–§4. Report: **`docs/SEARCH_S7_REPORT.md`**.
CHANGE_LOG (2026-08-17 23:12 UTC). `check:s7-retrieval` **31/31**, `tsc` clean. **Cost $0.**

⚠⚠ **§1 — THE BRIEF'S ORDER IS WRONG, AND THAT IS THE FINDING IT ASKED FOR.** It predicted
committees would gain most from semantic search and said "if it does not, that is worth knowing
before spending four sprints". **Committees sits at 100% on the only questions it has — a ceiling,
not a result.** Meanwhile caselaw and guidance each have a measured **+12.5pp**, and **debates is
15pp WORSE with vector on**.
▶ **CHARLIE: `LEX_VECTOR_STREAMS=legislation,caselaw,guidance`** — that env var is yours to set and
unreadable from here. Latency cost: caselaw +289 ms p50, guidance **+2,528 ms** (watch that one).
⚠ NOT debates. ⚠ Committees cannot be evaluated until somebody writes committee gold questions.

⚠⚠ **The pre-batching latency scare does NOT reproduce.** Two simultaneous users, against their own
serial baseline in the same session: **1.37× / 0.95× / 0.75× / 1.19×** of serial p95. No doubling
anywhere. (n=3 per stream — this kills the 2× catastrophe, it does not price concurrency precisely.)

⚠ **My first live metric was saturated and is reported, not dropped** — on-kind counts came back
180 of 180 in every arm because every routed stream returns its full window regardless. The useful
number is the **43–68% top-20 overlap**: the dense half changes a third to a half of the results, so
it is far from inert.

✅ **§2 — `PRECEDENT` and `DEVOLUTION_SCOPE` built.** PRECEDENT returns intended/predicted/observed
as a GROUP around one instrument. ⚠ The PIR leg is **1,014 sections inside `impact-assessments`**
(brief said 1,235), and ⚠⚠ **a missing PIR is never filled from the impact assessment** — that turns
"nobody checked whether this worked" into "here is what it achieved". DEVOLUTION_SCOPE derives
jurisdiction from the ID, never the title (**the Scotland Act 1998 is `ukpga`**), covers all three
nations, and ⚠⚠ **refuses to answer "is it reserved"** — it names the schedules that decide instead.
Public sources number `[W1]`, provably non-colliding with corpus `[1]`.

⚠⚠ **§3 — the framing experiment is UNDERPOWERED and says so in its own output.** +0.0pp, but **27
of 31 queries scored zero in both arms** so only 4 could have differed. Cause: the harness runs bare
BM25 against `corpus_fts` (no scoping, fusion or expansion) versus a platform headline of ~62%.
▶ Fix is to run it through `runSearch()` from the web side — `scripts/ingest` cannot import it.
⚠ Which comparison ran is stated: bare vs caller-held context, **NOT** the Lex user-profile contrast.
⚠⚠ The answer-leak test was excluding **13 of 31** queries whose "leak" was in the ORIGINAL question
("What laws govern e-scooters?" trips `/e-scooter/i`). Now differential; 0 excluded.

▶ **PRECEDENT and DEVOLUTION_SCOPE are built and tested and NOTHING CALLS THEM YET.**

2026-08-17 22:44 UTC — ▼ **SEARCH S5 IS COMPLETE: THE LEX CONVERSATION NOW SEES THE WHOLE CORPUS.**
Executes `docs/BRIEF_SEARCH_S5_LEX_SCOPE.md` §1–§5. Report: **`docs/SEARCH_S5_REPORT.md`**.
CHANGE_LOG (2026-08-17 22:44 UTC). `check:lex-scope` **29/29**, `tsc` clean. **Cost ~$0.02.**

**On the same ten questions S4 audited: 0 → 100 non-legislation results; 0 of 7 → 7 of 7
non-legislation questions served; 3 of 3 legislation questions keep their legislation.**
Latency p50 3,345 → 5,392 ms, p95 5,280 → 9,034 ms — reported, not buried.

⚠⚠ **THE OLD PATH'S ANSWER IS THE ARGUMENT.** Asked *"what did MPs argue in the debate on assisted
dying"* it answered from **`"assist investi"`, matched inside The Regulation of Investigatory Powers
(Communications Data) Order 2010.** The new path returns four dated Hansard citations and then
declines to overclaim. On sewage it returns the Environmental Audit Committee's "huge chemical
cocktail" finding, every claim tagged `(Committee evidence)`.

✅ **All three gates moved**, and gate 3 is structural: `EvidenceResult` has **no `actId`, no
`actTitle`, no `sectionNumber`**, so a committee transcript cannot be rendered as a section of an Act
— the outcome the brief calls worse than doing nothing. ⚠ A **Bill sits in the evidence channel**: it
is a proposal, and citing a clause as though in force is the error SURFACE 1 just closed.
✅ **The legislation panel is NOT widened** — S4 measured its scope as right; asserted by the check.
✅ **Batching shipped with it** (§2 made it a prerequisite): `Promise.all` over five streams against a
four-wide service was one user saturating it. Capped at 3, **maxInFlight OBSERVED**, negative control
run.

✅ **`docs/SEARCH_CONTRACT.md` §6** is the never-claim rule: name the gap specifically, never a vague
deflection, never general knowledge dressed as corpus. ⚠⚠ The check **found a real bug in it** —
`committee` does not match "committees", the plural the first probe actually uses, so the gap
note would have been silent on the exact case §4 exists for.
✅ **Unmet requests are logged** (`LexUnmetRequest` / `LexUnmetDemand`) for V37's gap-filler — kind,
keywords, **which streams the router chose**, result count. ⚠ No question text: a Stage-1 idea is
private.

⚠ **Named, not done:** `SearchResult` has no `attribution`, so **who said it** is unavailable for a
committee transcript — a gap in the gateway contract. p95 at 9s is acceptable-ish, not good; try
`LEX_STREAM_CONCURRENCY=4`. The gap note never fired live (all ten questions were served), so its
production behaviour is asserted by the check rather than observed. 2 of 4 answer pairs completed.
▶ **CHARLIE: ask Lex on a real idea what select committees have said about something, and confirm the
answer cites committee evidence AS committee evidence.**

2026-08-17 21:52 UTC — ▼ **GRAPH 2D-5 IS COMPLETE: THE DOCUMENTS ARE SHOWN, AND THE BETTER
ARCHITECTURE IS BETTER AT DISCOVERY AND WORSE AT EVERYTHING ELSE.**
Executes `docs/BRIEF_GRAPH_2D5.md` §1–§5. Report: **`docs/POSITION_GRAPH_2D5_REPORT.md`**.
CHANGE_LOG (2026-08-17 21:52 UTC). `verify-2d5.ts` **26/26** with two negative controls firing.
**Cost $0.88.** No re-extraction — §0 honoured.

▶ **CHARLIE: `docs/POSITION_SAMPLE.md` IS THE THING YOU ASKED FOR.** Thirteen cases in full prose —
the claim, the submission, what the extractor recorded, what the hand-read concluded and why. Three
it got right, one where it correctly stayed silent on four claims its author certainly holds views
on, two reversed polarities, one where it quoted a **bibliography**, and ⚠ **two where I mark my own
hand-read as arguable**. All fifty are dumped to JSON so the twelve I did not pick can be read too.

⚠⚠ **THE SPRINT'S BIGGEST FINDING IS ONE MISSING INPUT.** A bibliography entry quoted as a position
(top-down) and a bare bullet turned into a claim with a verb the model supplied (bottom-up) are the
same bug: **we strip the document's structure — headings, reference lists, tables — before the model
sees the text.** Two failure modes, two architectures, one cause. It is the cheapest high-value fix
available here and it is not a prompt change.

⚠ **§2 — the qualification second pass fixes 3 of 11, and proved the BASELINE was understated.** Its
schema has no polarity field, so it cannot change a direction (asserted; fires on a planted field).
⚠⚠ My own first precision figure (18%) was wrong: it counted qualifications found on baseline-CORRECT
rows as false positives, but those rows were scored on polarity and extract and were **never asked
about qualification**. Re-read all 14 by hand — **6 genuine, 8 not** (commonest false shape: a REASON
recorded as a CONDITION). Real precision 53%. **And 6 of the 23 rows we call correct carry an
unrecorded qualification, so the nuance problem is bigger than 11 in 50.**

⚠⚠ **§3 — YOUR FRAMING POINT IS NOT HYPOTHETICAL. 2 of 12 published inquiry "scopes" are the
Committee's own report conclusions.** Inquiry 3005 in full: *"Primary care is … under unprecedented
strain …, **warns the Health Committee in its report**."* Stored beside the position and **never
applied to it** — the no-adjustment rule is greped and fires on a planted UPDATE. ⚠ The inquiry page
is Cloudflare-403; the API is open, and the field is `scope`, not `termsOfReference`. ⚠ Inquiry 277's
whole scope is an administrative status note that replaced the terms of reference — 6,255 position
rows under it.

⚠ **§4 — measured both ways on the same 49 submissions, same meter, scoring fixed and printed first.**
· **COST bottom-up 3.73× top-down** ($0.5819 v $0.1560). The brief's "probably not more expensive" is
  refuted: input IS cheaper (161k v 271k, no vocabulary) but **output is 7× larger** and bills at 8.3×.
  ⚠ Censored — **35 of 49 hit the 40-claim cap**.
· **RECALL 13 of 23 = 57%** of the positions we know are right (2 more refused by the verbatim-echo
  guard rather than snapped to a nearest row).
· **NOVELTY 1,439 of 1,933 claims (74.4%) covered by none of the 83.** ⚠⚠ Nearly an artefact — the
  obvious subtraction would have said 1,920, because it only ever tests 23 propositions.
· **HAND READ 34 of 40 (85%) REAL** — the measure that decides. 3 self-description, 2 trivia, 1 failure.
· ⚠⚠ **CLUSTERING NOT MEASURED.** The duplicate-string floor came back 0 of 1,933, which is a fact
  about the model's phrasing, not the corpus. Reported as uninformative, not as reassurance.
**VERDICT against the rule fixed in advance: 2 of 3 — a SUPPLEMENT, not a switch.**

✅ **§5 — graph of record untouched**: 37,657 rows, 16,196 positions, 5 run ids, no new column, all
asserted. ⚠ Still nothing user-facing, and §2 says the true error rate is worse than 22 in 50.

2026-08-17 21:17 UTC — ▼ **LEX SPRINT 25-A IS BUILT: the inverted flow — the user decides, Lex
writes — runs end to end at `/ideas/build`.** Executes `docs/BRIEF_25A.md` §0–§7 plus Charlie's
mid-sprint §3a amendment. Report: **`docs/BUILD_25A_REPORT.md`**. CHANGE_LOG (2026-08-17 21:17 UTC).
`tsc` clean, `next build` clean. **`check:build-25a` 40/40 with all 40 negative controls fired;
`verify:build-25a` 23/23 live against Neon; ceilings 23/23 across three modes; UI render assertions
31/31.** Spend ~£0.60 across ten full builds.

⚠⚠ **THE BRIEF CITES A SPEC THAT IS NOT IN THE REPOSITORY.** `LEX_DESIGN_ADDENDUM_25.md` does not
exist, and it is cited for §25.1 (fields and storage), §25.3 item 5 and §25.4. Built from the brief.
**The one place it bites is the storage choice** — a dedicated `IdeaElicitation` table rather than
field-machine rows, because the field machine's statuses describe a *proposal contract* and the four
answers are the user's own words taken before anything is drafted. **If §25.1 says otherwise it is
one table to move.**

⚠⚠ **THE 15-MINUTE HARD STOP CANNOT FIRE ON VERCEL** — `maxDuration` tops out at 300s, so a
900,000 ms budget checked inside the request is a guard that cannot fail. **Both numbers are
declared**, `effectiveBudgetMs()` returns the one that binds and NAMES it, the UI prints it
(`ceiling 270s (request) / 50p`), and a check fails if the effective budget ever exceeds 300s. A
build the platform kills outright is caught by `settleAbandonedBuilds` and **written** to FAILED.

✅ **THE CEILINGS WERE VERIFIED BY MAKING THEM FIRE, AND THE CONTROL IS WHAT MAKES THAT MEAN
SOMETHING.** `LEX_BUILD_BUDGET_MS=1` → FAILED 0/4, *"ran out of time"*, nothing half-written;
`LEX_BUILD_COST_PENCE=0.0001` → FAILED 1/4, *"hit its spend ceiling"*, **pass 1's draft still
there**; neither set → **DONE 4/4**. A ceiling that always fires looks identical, one-sided, to one
that works.

⚠⚠ **A LATENT DEFECT IN THREE EXISTING WRITE PATHS, FOUND BY RUNNING SIX REAL BUILDS: one NUL byte
(U+0000) in a corpus snippet makes PostgreSQL reject the entire `jsonb` write.** A search that had
SUCCEEDED — 240 results across five routed streams — took a whole build down with *"unsupported
Unicode escape sequence"*, a message naming nothing a reader would connect to the corpus.
`saveStageSearches` (since §19-C) and `fireSearchTrigger`'s `legislationRefs` (since Sprint 1) have
always been exposed; they store ~20 grouped results, so the odds had not caught up. **Fixed at the
boundary in ONE place** (`lib/lex/json-safe.ts`), across all four `jsonb` writes, **only U+0000**
(TAB/LF/CR carry meaning), and the strip **logs its count**.

⚠ **A DUPLICATE INSTRUMENT FORK HAD TO BE STOPPED IN CODE, BECAUSE THE PROMPT WOULD NOT DO IT.** All
six exercise builds emitted their own instrument fork beside the platform's canonical
`guidingPolicy:instrument`, so the same decision reached the user twice under two names and 25-C
would have inherited both. A prompt line was added and **the next build produced
`approach:instrument` anyway**; a filter scoped to the approach pass then failed too, because the
duplicate does not always come from that pass. The rule now lives in `persistForks`, and **the drop
is counted**.

⚠ **§3a WAS AMENDED MID-SPRINT BY CHARLIE.** The framing comparison is withdrawn and **transfers to
the Search stream's scored gold set**. The switchable strategy stays: `IdeaBuild.framing` is NOT NULL
**with no default**, `queryUsed` records the string issued, and the checks keeping the two arms
distinct stay — including one that fails if arm A's branch so much as mentions `ownKnowledge` /
`ruledOut` / `aboutYou`, because two arms that quietly converged would keep recording a distinction
that no longer existed. `measure-build-framing.ts` and `BUILD_25A_FRAMING_AB.md` deleted; six harness
ideas hard-deleted from Neon.

✅ **§0 HOLDS, AND IS ASSERTED RATHER THAN ASSUMED.** `/ideas/create` is untouched; `PAGE_SEQUENCE`
is still exactly the four kernel pages; all 23 field keys present; no elicitation step key collides
with a field key; the 25-A schema contains no ALTER/DROP outside its own three tables; and a live
control makes an idea the existing way and proves it still starts at ORIENTATION on
`ideaNarrative`/EMPTY **with 25-A having created nothing for it**.

⚠ **A completed build moves `Idea.lexPage` to COHERENT_ACTIONS and that is load-bearing** —
`assertWritableField` refuses a write to a page ahead of the pointer, so without it **every Save
beyond Orientation would 409**: a panel of drafts you can look at and cannot keep. Verified both ways.

⚠ **NO BROWSER WALK WAS POSSIBLE, AND NONE IS CLAIMED.** The Chrome extension has no host permission
for `localhost:3000` (the same tools read www.scrutinise.org fine) and the browser has no Clerk
session on production. `/ideas/build` *did* correctly redirect to `/sign-in?redirect_url=…`. ✅ **DEPLOYED AND CONFIRMED
ON PRODUCTION**: `https://www.scrutinise.org/ideas/build` returns 200 carrying the server-side
redirect from this sprint's `page.tsx`, and a nonexistent-route control carries no such marker.
`verify:build-25a-ui` renders `BuildProgress` and asserts 31 things a user would see — **shape and
copy, NOT click handling, polling or layout.**

▶ **FOR CHARLIE:** open `/ideas/build` on production and judge the premise — *is a kernel drafted
from four answers worth reviewing?* · supply or confirm §25.1's storage · decide whether
`/ideas/build` gets a way in (URL-only today) · grant the Chrome extension `localhost` access if you
want browser walks from here.

2026-08-17 08:35 UTC — ▼ **INGEST: THE UNDECODED ENTITIES ARE REAL, IN 16 OF 74 CORPORA, AND COST
ZERO RECALL — the brief's own mechanism is wrong. All 16,805 user-visible values are repaired; the
R2 backfill is priced at $0.90-plus-an-index-rebuild and DEFERRED with its reason.**
Executes `docs/BRIEF_INGEST_ENTITY_DECODE.md` §1–§4. Report: **`docs/ENTITY_DECODE_REPORT.md`**.
CHANGE_LOG (2026-08-17 08:35 UTC). `tsc` clean; `check:entity-decode` + `check:html-entities` (26/26)
added to `scripts/ingest/package.json`. **No LLM tokens spent — total cost ~$0.005.**

⚠⚠ **§0's PREMISE FAILS THREE WAYS.** It says `&#xa0;` glues two words into one token. The FTS
`simple` tokeniser splits on EVERY non-alphanumeric character, so `Barbara&#xa0;Rayment` indexes as
`barbara | xa0 | rayment` and **both real words survive**; `withPosition:false` means no phrase query
can be disrupted; and in 300 real documents the shape `word&#xa0;word` occurs **0 times** — it is a
paragraph spacer standing alone between spaces. **Decoding recovers 0 searchable tokens in
15,659,766.**

✅ **SO THE ANSWER TO §2 IS STRONGER THAN THE BRIEF EXPECTED: the gold-set recall figures, the ABSENT
counts and the tier-fusion measurement are NOT floors.** No previously reported search number needs
a caveat and no CHANGE_LOG entry needs amending.

⚠⚠ **THE WORST-AFFECTED CORPUS WAS NOT THE ONE BEING WATCHED: `tna-caselaw` carries an entity in
95.3% of documents** (74,896 judgments) against `committees-evidence`'s 12.0%. Also `planning-policy`
78.1%, `building-regs` 57.1%, `hmrc-codes-guidance` 50.7%, `eur-lex` 32.0%. ✅ **The big political
corpora are clean** (pwdata-debates, historic-hansard, pwdata-lords, committees-reports, all
legislation — 0 in 150). The volume is typographic (`&#8217;` 7,653, `&#8220;` 5,145), so it is a
RENDERING defect, provably not a retrieval one.

✅ **REPAIRED: all 16,805 user-visible values in Neon** — `sectionTitle` 4,532 → 0, `speaker`
10,660 → 0, `attribution` 1,613 → 0, each read back and reconciled against the prediction. Titles
were exhaustive, not sampled, because they live in Neon.

✅ **ROOT CAUSE NAMED AND IT IS A CLASS DEFECT.** `committees-portal.ts` decoded `&nbsp;` and not
`&#xa0;` — the numeric form of the same character — from a hand-written list, twice in one file.
**17 source files decode from hand-written lists; none decodes a numeric form.** Now one decoder,
`shared/html-entities.ts`, with `check:entity-decode` as a **RATCHET**: the 16 remaining are a
baseline that may fall and must not rise.

⚠ **THREE OF MY OWN MEASUREMENTS WERE WRONG FIRST, ALL THE SAME WAY — a control not matched to its
treatment.** A "non-breaking hyphen destroys the word" verdict whose clean twin also failed; a
character-adjacency classifier that cannot tell `Barbara&#xa0;Rayment` from `preven&#xad;tative`; and
a live retrieval test that reported "62.5% lost" when the damaged phrase came from boilerplate and
the control from distinctive prose. With a matched control the damaged arm retrieves MORE often
(7 v 4) and the test is **reported as underpowered** rather than quoted. ⚠ **And the fix shipped
INERT first** — decoded into a new variable, returned the old one; the guard for that was watched
failing on the exact broken form.

⚠ **Two decoder bugs found by reading its own output:** `&#145;` must map through **Windows-1252**
(naively it is an invisible C1 control, so the repair would have DELETED quotation marks from 73
titles), and LF/CR/TAB must decode where other C0 controls must not (28 speaker values).

▶ **CHARLIE'S CALL — a real choice, not a rubber stamp:** decode-at-render in the search adapters
(cheap, immediate, all 16 corpora, but every future reader must remember) versus a one-off R2
rewrite of ~184,000 objects ($0.90 + an FTS rebuild via the Heavy Job Runner + re-embedding changed
chunks — the real cost). **My recommendation: decode-at-render now, and fold the rewrite into the
next reprocessing pass that is happening anyway.** ⚠ Also reported, not fixed: 73 titles hold
`&#65533;` (bytes already lost — needs a re-fetch), and `scotlawcom` holds 1,337 literal U+00AD
characters.

2026-08-17 02:49 UTC — ▼ **GRAPH 2D-3 IS COMPLETE: 16,196 positions extracted and
the hand-read error rate is 54% — the extraction is NOT ready to be shown, and the failure shapes
say why (4% polarity errors, 46% of failures are positions on claims the submission never
addressed). §2 landed cleanly: 5,496 organisations now carry a Companies House or Charity
Commission key.** ⚠ For ingest: 12% of committee documents in R2 carry undecoded HTML entities.
Earlier: 2026-08-16 11:52 UTC — ▼ **SEARCH S4: THE LEX CHAT ROUTE — the platform's main
conversation — CANNOT RETURN A COMMITTEE DOCUMENT, A DEBATE OR A JUDGMENT, ON ANY QUESTION, EVER;
and the router already knew, because it picks `committees` and the caller overrules it with a
constant.** ⚠ TWO gates in series, so widening the tier alone would measure as a no-op. ✅
`LEX_TIER_FUSION` measured in both run orders: **+21.7pp recall, latency inside the cache noise —
recommended ON, after confirming `LEX_QUERY_ROUTER` is on.** And ▼ **GRAPH AMENDMENT 2 is BUILT:
a mention may always be displayed, and behavioural agreement is now MEASURED to be useless as merge
evidence (97.9% between random same-party pairs of different people).** LEX 3-E, INGEST V38, GRAPH
2D-2 and SEARCH S3 follow.*

2026-08-17 02:49 UTC — ▼ **GRAPH 2D-3 IS COMPLETE: 16,196 POSITIONS EXTRACTED, AND 54% OF FIFTY
READ BY HAND AGAINST THEIR SOURCES IS WRONG OR PARTLY WRONG. The error rate is the product; the
count is not.** Executes `BRIEF_GRAPH_2D3.md` §1–§2 and `BRIEF_GRAPH_2D3_CONTINUED.md` §1–§4.
Report: **`docs/POSITION_GRAPH_2D3_REPORT.md`**. CHANGE_LOG (2026-08-17 02:49 UTC). All code in
`scripts/ingest/position-graph/`. `tsc` clean for that directory; **21 verify checks pass, all seven
negative controls fire**. ⚠ **§3 and §4 are the Amendment 2 session's** on Charlie's instruction —
`schema-amd2.sql`, `setup-amd2.ts` and `signal-behaviour.ts` were not touched. **Nothing is
user-facing.** Spend: **$9.20 against $9.06 predicted (+1.5%)**.

⚠⚠ **THE ACCEPTANCE TEST: 46% correct, 26% partly right, 28% wrong.** 16,196 `holds-position` edges
over 2,979 submissions and 3,405 actors, **100% carrying a passage and 98.4% of those found verbatim
in their own document** — and the passages being real is not the same as the positions being right.

✅ **THE FAILURE SHAPES SAY IT IS FIXABLE.** `position-invented` 12, `nuance-flattened` 11,
`proposition-mismatch` 2, **`polarity-flipped` only 2 of 50 (4%)** — the model reads DIRECTION
correctly and over-attributes. Corroborated independently: **81.7% of all positions are `for`**
against 13.7% `against`. Three remedies named in the report, **none applied** — replacing a measured
54% with an unmeasured number is not an improvement. ⚠ Two failures the extract check CANNOT catch:
one quotation was a line from the document's **bibliography**, another was **the submitter
introducing itself**.

✅ **AREA CHOSEN BY THE DATA, recomputed from `graph_edge`:** Health and Social Care (794 orgs in >1
inquiry vs Environmental Audit's 754), bounded to the top 12 inquiries. **Vocabulary reported before
use: 83 propositions.** ⚠ Only ONE is cross-cutting — these inquiries overlap far less than assumed,
which is why the priced-in 40 became 83. Contestedness MEASURED rather than asserted: **60 of 83
(72.3%) carry both sides.**

⚠⚠ **THE PILOT'S 25.9% "FABRICATION RATE" WAS 83.9% OUR OWN MATCHER: `committees-evidence` text in
R2 CARRIES LITERAL HTML ENTITIES** — 24 of 200 random documents (12.0%), 5,322 occurrences, `&#xa0;`
(5,212) — plus words broken by stray spaces from PDF extraction. Diagnosed by dumping the bytes
(§13). Matcher repaired and stored rows re-scored for nothing: **25.9% → 2.9%, 0 rows moved the
other way**; fresh calls **1.6%**. ▶ **FOR INGEST: the entities are still in R2 and still in whatever
the search stack indexed.**

⚠ **THE MODEL'S ARRAY INDEXES ARE UNRELIABLE, INTERMITTENTLY** — the EDM test filed one motion's
proposition under another's index and it did NOT reproduce (0 of 120). Everything now correlates by
**verbatim echo**; the check fired **255 times** in the full run.

✅ **§2 IS USABLE NOW — 5,496 organisations (13.6%) carry an external stable key.** Companies House
**4,812**, Charity Commission **2,405**, from open keyless bulk downloads (5.70M and 0.40M register
rows, OGL v3.0). Exact match on the same `normaliseName()` that built `name_norm`. **389 charity
splits vs 17 company splits, 0 merges in both — reported separately, and measured.**

⚠⚠ **OFFICE-BY-DATE: THE INSIGHT IS RIGHT, THE DATA WILL NOT CARRY IT.** Of 6,512 register surfaces
exactly **1** is an office; scored against ground truth it is **63.8% accurate (17 wrong people)**,
because `graph_member_name`'s windows record when a NAME FORM was carried, not office tenure. The
Members API publishes only Lords entry dates. **Nothing was resolved and `verify-2d3.ts` asserts
zero rows.** Needs a real tenure source — Lords Spiritual appointments, the ministerial
appointments feed, or Companies House officer dates (already downloaded).

▶ **FOR THE AMENDMENT 2 SESSION:** the submitter's own name IS in the document — **64.5% of 600
random written-evidence files**, 91.7% carrying the internal reference, agreeing with the API
submitter 96.3% of the time. ⚠ My first claim of this was too strong (three hand-picked files; the
first parser measured 15.7%). The 3.7% that disagree are the useful ones — *Dame Diana Johnson,
Minister of State* where the graph says *Home Office*. `parseDocumentHeader` written and self-tested
(27/27); **handed over, not built into a competing layer.**

2026-08-16 11:52 UTC — ▼ **SEARCH S4 §1 + §2. Report: `docs/SEARCH_S4_REPORT.md`.** CHANGE_LOG
(2026-08-16 11:49 UTC). `tsc` clean. **Nothing was widened — §1 says report before changing.**

⚠⚠ **§1 — CHARLIE'S REFRAME IS RIGHT, AND THE EVIDENCE IS THE SYSTEM'S OWN JUDGEMENT.** The harness
asked `routeQuery` directly per probe: it picks **`committees`** for "what have select committees
said about sewage discharge" and **`debates`** for "what did MPs argue in the debate on assisted
dying". The tier-scoped branch keeps the router's query REWRITE and **throws its stream selection
away**. Measured: the Lex chat route returns `ukpga×7 uksi×4 nisi×1` while the corpus holds *Fourth
Report — Water quality in rivers* it cannot show. **36–146 non-legislation documents per question
are unreachable.**
⚠⚠ **TWO GATES IN SERIES, which the brief did not have:** `tier:'legislation'` then a
`LEGISLATION_TYPES` filter that drops **24 of 36 on every probe**. **Widening the tier alone
measures as a no-op.** A third gate is the contract — `LegacySearchResult` has `actTitle`/
`sectionNumber`, so a committee transcript admitted through a widened scope **would be handed to Lex
as a section of an Act**. The fix is a second context channel, not a constant.
✅ **The panel scope is RIGHT, measured** (returns *Sewerage (Scotland) Act 1968 s.39* on the
committee question). ⚠ **`POST /api/search` is a legislation endpoint with a general name and no
first-party caller** — Charlie's naming call.
✅ **§2 — `LEX_TIER_FUSION`: recall@20 42.4% → 64.1%, +21.7pp, both run orders, no query regressed**
(8 of 16 improved, two from zero). ⚠ The population had to be established first — **the flag governs
TIER-SCOPED callers only**, so the untiered gold set would have shown "no effect". ⚠⚠ **It is INERT
unless `LEX_QUERY_ROUTER` is also on** — turning it on alone does nothing, silently. ⚠ **S3's +62%
latency does not survive end-to-end: +7%, smaller than the ON condition's own 435 ms cache swing**
(the router's LLM call dominates at ~5s either way). ⚠ The preference metric moved its denominator
(1 scoreable pair → 6) and must not be read as a regression.
❌ **NOT started: §3 (batching, PRECEDENT / DEVOLUTION_SCOPE).** Batching becomes a prerequisite the
moment the Lex-chat widening is authorised — five streams against `vector-serve`'s cap of 4.
▶ **CHARLIE:** authorise the second context channel · flip `LEX_TIER_FUSION` after checking the
router · decide what `/api/search` is for.

2026-08-16 11:52 UTC — ▼ **GRAPH AMENDMENT 2 BUILT, and Amendments 1 + 2 FOLDED INTO
`POSITION_GRAPH_DESIGN.md`.** Report: **`docs/POSITION_GRAPH_AMD2_REPORT.md`**. All code new, in
`scripts/ingest/position-graph/`. **16/16 checks pass, every negative control fired.** 88 kB added.
⚠ A concurrent CC-GRAPH session is running 2D-3 in the same directory — **no existing graph file was
edited.**

⚠⚠ **THE HEADLINE SETTLES §2 BY MEASUREMENT: random SAME-PARTY pairs of members who are certainly
different people agree 97.9% of the time** (n=150, ≥20 shared divisions); cross-party 10.5%.
Agreement is a party signal, not an identity signal. **Two successive Archbishops of Canterbury share
an identical register display name, 21 divisions and 100% agreement** — a merge behaviour would
endorse and that would fabricate a person.
✅ **§1** `graph_mention` has no resolution filter and the absence is ASSERTED — the negative control
is the pre-amendment design, firing at **73,829 mentions lost**. The old gate hid **94.6% of people**
while keeping 68.5% of mentions, so *a single "coverage" number would have said whichever the author
preferred*; **38,903 of 45,018 unresolved people hold exactly one mention.**
⚠ **"Name as it appeared" is NOT recoverable per appearance** — `corpus_sections.speaker` is NULL on
5,000/5,000 sampled committee sections. Flagged on every row, not faked. **Fix belongs in the sweeps.**
✅ **§3** three tiers defined once in SQL; unknown `key_source` → `unclassified`, not a safe default.
⚠ A control refused to fire and taught the lesson: **all 788 name-matches carry `parl_member_id`**,
so a tier read off the id column would promote every one of them to "identified".
✅ **§2** 187 pairs scored; the table has **no column a resolution could be written into** and
`finding` **refuses** a merging value (tested by attempting the write and requiring rejection).
⚠ 80 of 500 clusters are **episcopal sees** — an office held in succession — so `disjoint-service` is
its own finding, and it is 150 of the 187 pairs. `sharma`: Virendra (Lab) vs Lord Sharma (Con),
**868 shared divisions, 5.4% agreement**.
✅ **§6** organisations **64.4%** identified, people **5.4%** — a factor of 12; the 32.3% blend is
printed once, labelled as the number to stop quoting.
⚠⚠ **LIVE DEFECT, reported not fixed: MNIS's "address as" is often just the surname**, so `brown` and
`geoffrey` are live match surfaces that `isUselessName()` cannot catch. **Three of the 788 stand on a
surface the register says is shared** — `Mr  George` (Bruce George vs The Lord George) and `Robinson`
(Geoffrey vs Iris) are coin flips at confidence 0.9. NOT unmatched: that is a resolution.
▶ **NEXT FOR CC-GRAPH:** record the surface ON the edge · a rule refusing a match on a shared
surface · Companies House / Charity Commission (columns and tier decisions already in place) ·
organisation `first_seen` repair.

2026-08-16 10:54 UTC — ▼ **LEX SPRINT 3-E: THE TRUNCATION'S CAUSE IS `acceptedSummary()`
SLICING EVERY FIELD AT 80 CHARACTERS INTO THE PROMPT — proved to the character on all five clauses,
including one cut at 106 because `{"avoidance":"` takes 14 of the JSON slice's 120.** ⚠ The brief says
three clauses end mid-word; only one does, and the other two are undetectable after the fact — which is
why the fix is the marker plus complete source values, not a better regex. ⚠ And Lex's refusal to answer
Charlie's question was three lines in its own prompt. INGEST V38, GRAPH 2D-2 and SEARCH S3 follow.*

2026-08-16 10:54 UTC — ▼ **LEX SPRINT 3-E IS BUILT: THE TRUNCATION'S CAUSE IS NAMED AND PROVED TO
THE CHARACTER, AND LEX'S REFUSAL TO ANSWER TURNS OUT TO BE THREE LINES IN ITS OWN PROMPT.**
Executes `docs/SPRINT_3E_BRIEF.md` §1–§8 in full. CHANGE_LOG (2026-08-16 10:54 UTC); full detail
**`docs/LEX_PLAYBOOK.md` §17**. `tsc` clean, `next build` passes, every offline check green.

✅✅ **TASK 1 — IT IS `acceptedSummary()`, AND IT IS NEITHER OF THE TWO OBVIOUS CANDIDATES.** Not a
bounded `VarChar`, not `maxOutputTokens`. Every accepted field went into the prompt as
`value.slice(0, 80)`, that line was the ONLY place the accepted values appeared, and the
guiding-policy instruction said *"ground it strictly in what the user accepted"*. **All five clauses
reconcile to the character** against the production row: three cut at exactly 80, and the fifth —
`…or break th` — at **106**, which is precisely what `JSON.stringify(v).slice(0, 120)` leaves once
`{"avoidance":"` has taken its 14 characters. That fifth number is what makes this a diagnosis
rather than a plausible story.

⚠ **THE BRIEF SAYS THREE CLAUSES END MID-WORD. ONLY ONE DOES — AND THAT CHANGES THE FIX.** Two were
cut at a *word boundary* and read as finished sentences: silent, and **undetectable after the fact by
any regex**. So the answer is not a cleverer detector. `abridge()` never cuts inside a word and
**always marks the cut**; and the half that actually removes the defect is that a composed field is
now handed the **COMPLETE** text of the fields it composes from. Raising the cap would only have made
it rarer. ⚠ `acceptedSummary` existed **twice** — conductor and chat route — as two identical slices,
and the chat route's was the one Charlie's turns went through. One copy now.

✅ **TASK 2 — THE UNHELPFULNESS IS OURS, NOT THE MODEL'S.** Three prompt facts, all fixed: the field
instruction sat directly under the question telling Lex to propose (the field is now CONTEXT ONLY on
a question turn and **the route discards any proposal regardless**); `chatText is always 1–4
sentences` made a real answer impossible (lifted); and never-claim was being read as "say nothing you
cannot cite" (it now says, in the prompt, that reasoning from general knowledge is expected, must be
labelled, and that **fabrication is the only hard line**).

✅ **TASK 3 — AND A CAP NOBODY HAD NOTICED.** The pass read `res.grouped`; `groupForPanel` caps at 3
per display type and ~20 overall, so **however high `limit` went a pass could never see a fourth
impact assessment**. The limit was never the binding constraint. Now ~100 candidates through an LLM
sift, a reason required per keep, the discard count reported to the user, and the **precedent test
enforced** — a `PRECEDENT` whose source fails it is downgraded to `FINDING`, not deleted.

✅ **TASK 4** — the issues are a separate hostile-clerk call reading the findings critically; the
deterministic templates stay, and a failed adversarial call falls back **and says so**.

✅ **TASKS 5/6/7/8** — auto-sizing, drag-resizable editors; soft owner-only delete (`Idea.deletedAt`)
with a dialog that names the idea; the root-cause chat path with a matcher that **refuses when two
causes fit equally well**; the dictation hint verbatim; and the committee URL repair.

⚠⚠ **TASK 8's NUMBER IS WORSE THAN THE BRIEF ASSUMED AND THE FIX IS NOT COMPLETE.** The bare
committee URL form 404s for ALL THREE families and the corpus stores it on **264,773 of 487,088
committee rows (54.4%)** — every one a 404 at rest. `/html/` fixes the form: live, **stored 0/24 open
→ repaired 21/24**. The residue are ids **dead at source in both forms**, including
`/publications/13110/` — the very id `check-legislation-urls.ts` used to assert. **That is corpus
freshness, and it belongs to the ingest thread.**

⚠ **TWO ENVIRONMENT TRAPS THAT WILL RECUR:** committees.parliament.uk answers a bare curl/fetch
User-Agent with **403 on every path** (reads exactly like a dead link; is not), and **Node's `fetch`
is 403'd regardless of headers** while curl with the same UA gets 200 in the same second — a
TLS-fingerprint block. The live probe shells out to curl and **skips rather than fails** without it.

▶ **THE REMAINING GATE IS CHARLIE'S BROWSER, AND NOTHING IS DEPLOYED YET.** Everything is built and
check-guarded; the acceptance criteria that need a live model and a browser are **not walked**. Per
the 12 Aug finding, **a push is not a deploy for this project** — prove it by reading a string back
off the running site. The four to walk: (1) ask the Charter question verbatim and check Lex answers
it, distinguishes reasoning from citation, and does not re-propose a field; (2) run a Deepening pass
and read the "reviewed N, kept M" line; (3) open a long Lex draft and check it is readable and
draggable; (4) delete a pre-rebuild idea and confirm it leaves the dashboard.

⚠ `check:score-scope` still fails on the Central thread's `lib/question-library.ts`, unchanged and
not this sprint's code — reported, not edited.

2026-08-16 07:45 UTC — ▼ **INGEST V38: THE 17.5 GiB WALL DOES NOT EXIST. The enforced ceiling is
16 TiB and we occupy 0.10% of it, at $6.23/month.** Executes `BRIEF_INGEST_V38_STORAGE.md`.
Report: **`docs/V38_STORAGE_REPORT.md`**. CHANGE_LOG (2026-08-16 07:45 UTC).
**Nothing was dropped, vacuumed, rewritten or re-labelled.**

✅ **§1 SETTLED FROM THE ENFORCEMENT MECHANISM, not a figure about it.** `neon.max_cluster_size =
16777216 MB = 16 TiB`, read off the running compute, corroborated independently against Neon's
published plan docs ("16 TB per branch", **no hard storage cap** on Launch, $0.35/GB-month).
**16.58 GiB = 0.10% of the ceiling.**

⚠ **17.5 WAS AN ALERT THRESHOLD AND THE LABEL DEGRADED, NOT THE NUMBER.** `GRAPH_TIER1_REPORT.md`
correctly said "17.5 GB **alert line**"; it became "**ceiling**" in the V26 recheck and "**2.4× the
space that exists**" in my own 2D-2 schema comment. **The chain is circular** — `serve-observer.ts`
takes 17.5 from the handoff, and the handoff's 91% alert is emitted by that observer. Neither end
touches Neon. `progress-reporter.ts` meanwhile carries a *different* unsourced number (20 GB) whose
comment already said *"any hard limit is console-side"*, and `SPRINT_V18_BRIEF.md` had already
recorded *"billing is per-GB automatically"*. **The answer sat in the repo for two months.**

⚠ **THIS CHANGED A DESIGN, AND IT WAS MINE.** 2D-2 built its edges as views because 2.21 GiB "would
not fit". It would have reached **18.79 GiB = 0.11% of 16 TiB**, for **$0.83/month**. I still think
the view was the better design — it cannot drift from `division_votes` — but that is not the
argument I made.

✅ **§2 MEASURED AND ALMOST ENTIRELY NOT WORTH DOING.** `corpus_sections` is **12.54 GiB = 76%** of
the database and **has no body-text column at all** (`xmlPreview` 0%, `ftsVector` ~0.02%) — the
R2-first design is already fully in effect. Largest column is `sourceUrl`, 2.50 GiB. Dropping any
column would rewrite 12.5 GiB to return ~0.
⚠⚠ **INDEX DROPS BLOCKED ON EVIDENCE:** 203 indexes read zero scans (0.64 GiB / **$0.24 a month**)
but `stats_reset` is NULL, the compute had been up **2m22s**, and a **positive control over eight
known-used indexes came back 6/8**. Dropping on that would repeat this brief's own error inside the
sprint written to correct it. Built **`v38-index-usage-snapshot.ts`** + `index_usage_snapshots`
instead — deltas over a known interval, with the postmaster start recorded so a reset counter is
distinguishable from an unused index. **Run it again in a week; wire it into `ops.ts`.**
✅ **Maintenance: nothing to return** — no table has >10,000 dead tuples. Predicted zero, not run.

✅ **§3: storage is not a constraint and is not close to one.** $6.23/mo now, $12.46/mo at double the
corpus; the corpus could grow twenty-fold for ~$125/mo. Scale shows the same storage rate — no
storage reason to move. ⚠ No `NEON_API_KEY` here, so **billing and any console-side soft limit are
unreadable** and stay labelled so; Neon limits per PROJECT while `pg_database_size` sees one branch.

⚠⚠ **§4.1 — THE BLOCKER IS 67% BIGGER THAN THE ESTIMATE. Census: 38,407 sections held only in the
legacy table** (band to 43,252) against S3's extrapolated ~23,000, out of 79,495 legacy provisions in
short instruments.
⚠ **My first run said 47,427 and was wrong for the exact reason S3 had already documented** — the
regnal/calendar alias. Law of Property Act 1925 read as 218 legacy vs **0** corpus when it is there
as `ukpga/Geo5/15-16/20`. V36's alias map (14,294 pairs) moved **1,406 instruments** out of "short".
**Class confirmed at population scale:** amending instruments' own provisions — `uksi/2010/686`
(590/580, **523 orphans**), `uksi/2019/459` (307), `uksi/2019/775` (269). Work list:
`scripts/ingest/v38-orphan-census.json`. **`LegislationSection` DROP still blocked** — and now worth
only **$0.63/month**, so do it carefully rather than soon.

✅ **§4.2 — the `pdf-only` label is false, independently confirmed: 0 of 60 serve a PDF, 60 of 60 are
404** (GET, not the HEAD that TNA answers 405). With the prior 0/52 that is **0 of 112**.
⚠ **NOT re-labelled**: the absence of a PDF says what the 117,667 rows are *not*, not what they
*are*. The replacement label needs its own positive test — next sprint's first task.

⚠ **§4.3 — suspicion MOSTLY REFUTED: 43 keys malformed by shape, not ~288** (42 `…/paragraph-/…`,
1 `//`, 0 trailing-dash). The ref bug explains ~15%; **the other ~245 have a second, unidentified
cause.**

⚠ **FOR CC-SEARCH: `s3-drop-readiness.ts` throws at its VERDICT block** (`absentRegnal` undefined,
`tsc` flags it twice). Flagged, not fixed.

▶ **CHARLIE:** confirm the plan/billing from the console (unreadable here), and decide whether the
17.5 alert threshold is retired or re-sourced as a **cost** threshold with an owner.

2026-08-16 03:29 UTC — ▼ **GRAPH 2D-2: 2,478,613 `voted` EDGES AND 59,996 `signed-motion` EDGES
THAT COST ZERO BYTES — BECAUSE WRITING THEM PROPERLY WOULD HAVE NEEDED 2.21 GiB AND NEON HAS 0.93.**
Executes `BRIEF_GRAPH_2D2.md` in full. Report: **`docs/POSITION_GRAPH_2D2_REPORT.md`**.
CHANGE_LOG (2026-08-16 03:29 UTC). All code in `scripts/ingest/position-graph/`. `tsc` clean for that
directory. **All 16 verification checks pass and every negative control fired.** Nothing user-facing.

✅ **`voted`** — 2,478,613 edges, **2,616 people, all 5,645 divisions, 1999-11-24 → 2026-07-22, 100%
evidence coverage** (proved: every derived section id resolves, with a control that fires).
✅ **`signed-motion`** — 59,996 edges, 1,675 sponsors, 1989-11-21 → 2026-06-18, keyed on the member id
our ingest was dropping.

⚠⚠ **THE STORAGE FINDING IS THE ONE THAT MATTERS BEYOND THIS SPRINT. Neon is at 16.58 GiB of the
17.5 GiB line — 94.8%.** §1's 2.53M edges were priced from this database's own measured per-row cost
BEFORE anything was written: `graph_edge` 584.5 B/row + `graph_evidence` 355.8 B/row = **2.21 GiB
against 0.93 GiB of headroom, 2.4× the space that exists.** `division_votes` already holds the same
fact at **193.2 B/row**, so `voted` and `signed-motion` are **VIEWS** and every §1 requirement is
checked rather than dropped. **This sprint's entire storage cost is 14.2 MB.** The rule, in
`schema-2d2.sql`: *store the fact we do not already have; derive the edge from it.* ▶ **The next
thing that wants to write millions of rows will not have that option** — flagged for Charlie.

⚠ **CHARLIE'S CALL — mySociety's `parlparse/members/people.json` REFUSED on licence.** It is the only
crosswalk from the TheyWorkForYou person id to MNIS; its `LICENSE.txt` covers the *software*
(AGPL-3.0) and GitHub reports the repo `NOASSERTION`, so the DATA licence is unstated — the Public
Whip ODbL question again. **Consequence, measured: 67.6% of sampled Hansard speeches carry a
*membership* id and only 16.2% a *person* id, so the older majority of Hansard cannot be
person-resolved until this is ruled on.** Parliament's own Members API (OPL v3.0) was used instead
and does not publish the crosswalk.

⚠ **§2's honest result: the graph's people are still mostly name clusters, which is what §2 asked to
be told.** Stable-key person entities **438 → 2,603 (5.9×)**; **788 more carry a register member id at
`key_source='name-match'` confidence 0.9 — deliberately NOT `parl-member-id`/1.0**, because a name
match against a curated register is still a name match; **45,018 unresolved**, correctly (they are
committee witnesses). **24 splits detected, logged, NONE resolved** — and the inherited peerages
(`Viscount Camrose`, `Lord Ashton of Hyde`) are the dangerous ones, being the same title held by
different people in succession. **24 is a floor, not a census.** 54 merges, all read by hand.
**119 of 2,735 voters unresolved, four of the five largest being split cases — the price of refusing
to guess.**

⚠ **A DEFECT IN 2D-1's SPINE: `graph_entity.first_seen` equals `last_seen` on 100% of the 46,298
person entities** — "first" records the LAST sighting. **Repaired on 7,739 people.** ⚠ **The 40,518
ORGANISATION entities are very likely affected the same way and were NOT touched — CC-GRAPH's next
job, flagged rather than silently changed.**

⚠ **THE BRIEF'S "98.5% of Hansard speeches carry the person id" IS TRUE OF RECENT FILES ONLY** — the
attribute is renamed around 2010 and the older half carries a *membership* id instead. The first
probe searched only for `person_id` and reported whole decades at exactly 0.0%, which is what a
parser gap looks like; dumping the bytes (§13) found the rename. **Name-matching that population
would merge 1.6% of names and SPLIT 16.8% of people** — the measured argument for §2's own
instruction that `spoke-in` stays unbuilt.

✅ **§4 ANSWERED, EDGE NOT BUILT: consultation responders are NOT structured and NOT in the text we
hold.** 0 of 60 gov.uk API records carry any responder field; at most 2.3% of 300 compiled documents
carry a named-list signal and **every hit is a POINTER to a linked PDF**. It is a fetch job plus a
PDF-extraction job — a different sprint, as the brief anticipated.

✅ **§5 — three read by hand, 9 of 9 divisions re-fetched from `votes.parliament.uk` and matched.**
⚠ **The merge flagged in advance as riskiest is probably wrong** (entity #43723 holds MNIS 565 next
to the surface "Dr John Morris"; the register records no doctorate). Flagged, not silently kept.
⚠⚠ **The obvious fix for it was tested and FAILED** — "distrust a match on an out-of-date name" flags
102 of 788 including hand-verified-correct Theresa May, Kenneth Clarke and Norman Tebbit, because
`nameHistory` end dates track a change of *style*. **Recorded so nobody builds that screen.**

⚠ **AN API DEFECT WORTH RECORDING: `EarlyDayMotions/list?skip=5200` returns HTTP 200 wrapping
`{"StatusCode":400,"Success":false}`** — `res.ok` is TRUE so every retry rule waves it through. It
cost 100 motions. **I first called it deterministic and was wrong; six requests to the identical URL
gave 400,400,400,400,200,200.** Gap now closed, 60,995 of 60,995. **Rule: on this API check the
BODY's StatusCode, not the transport's.**

▶ **NEXT FOR CC-GRAPH:** organisation `first_seen` repair · the 119 unresolved members (blocked by
the ambiguity screen, and resolving them needs evidence the register does not carry) · full EDM
signatories (**97.1% of the 2,125,547 signatures are still absent**; a scrape with its own licence
and rate-limit questions, and where withdrawn signatures live) · `spoke-in`, still correctly unbuilt.

2026-08-16 02:48 UTC — ▼ **SEARCH S3: §7 AND §1 DONE. ⚠ THE `LegislationSection` DROP IS *NOT*
UNBLOCKED — and the reason has changed.**

❌ **DROP STAYS BLOCKED.** Five measurements, the first two of which were my own errors and are
kept in the record because the correction sequence is the finding:
**121,306 covered → alias-resolved to 122,683 covered, 5,106 short, 1 absent.** The shortfall is
NOT dot leaders (0.0%) and NOT a naming difference. The two sides **model amending instruments
differently**: legacy `ukpga/2015/21` holds `357TA` (as inserted into CTA 2010); the corpus holds
`schedule-1-paragraph-N` and puts `357TA` under `ukpga/2010/4`. **9 of 9 spot-checked provisions
are held under the target.** But a random **n=400 by title: 132 of 350 held elsewhere, 218 not** —
roughly **23,000 sections of real text held only in the legacy table**, dominated by the amending
instruments' OWN provisions ("Insertion of article 22A"), whose corpus copies are incomplete.
**New blocking reason: incomplete corpus copies of amending instruments. A gap class V36 did not
target and nothing reports.**
⚠ Two self-corrections worth keeping: my regnal classifier asked whether the *`LegislationItem`* id
looks regnal — it never does, that IS the V36 §1 finding — and called 1,617 aliased Acts real
absences; and the orphan matcher could not match legacy `45.42` to corpus `rule-45-42`.

✅ **§7.1** `disabled` is now a distinct `RouteOutcome` with its own counted line; gateway names
`router DISABLED` apart from `router FAIL-OPEN`; `routerEnabled()` exported for reporters.
⚠ `check-flags` asserted the weaker "fail-open is console.error", which ONE branch covering both
states satisfied — strengthened to assert they are told apart. **54/54.**
✅ **§7.2** `harness-preflight.ts` — `assertRetrievalConfig()` refuses to run degraded,
`resolvedConfigLine()` prints the config beside the number, wired into `diagnose-recall.ts`.
**Watched failing first, `check-s3-preflight.ts` 7/7**, each degrader tested individually.
✅ **§1** ⚠ the brief's premise was partly stale — the surfaces already reach `runSearch`; the real
gap is that **per-stream fusion lives in `runRoutedSearch`, which the tier-scoped branch never
called**, so they had no dense retrieval at all. Fixed by letting a tier-scoped call use its
stream's fused `search()` (only where the tier maps to exactly ONE stream). **Before/after on 8
questions: ~20 of 48 results change, latency 2,295ms → 3,710ms (+62%).** Shipped behind
**`LEX_TIER_FUSION`, DEFAULT OFF** per the brief's own hold-behind-a-flag rule — better-looking is
not measured, and the gold key is still the binding constraint.
❌ **NOT DONE: §2 (batch per-stream vector calls) and §3 (PRECEDENT / DEVOLUTION_SCOPE intents,
Public sources block) — not started.** §1's flip is not shipped; the flag is the gate.

2026-08-16 02:13 UTC — ▼ **INGEST: THE V36 CORPUS IS NOW REACHABLE BY A USER, NOT JUST PRESENT.**
Run overnight under standing pre-authorisation. **No stop condition fired.**

✅ **ACCEPTANCE TEST PASSED — `ABSENT 9 → 6` of 30**, IN_TOP_K 13 → 16, RANKING 5 → 2, ROUTING 0 → 0.
✅ **RETRIEVED THROUGH THE PRODUCT**, via `runSearch` with routing/tiering/typing/merge all in the
path — **Companies Act 2006 at RANK 1**, 2/2 targets. That is the instrument the 5-minute
`ROW_TIMEOUT` threw away on the run's first attempt.

⚠⚠ **THE FIRST ACCEPTANCE RUN WAS NOT COMPARABLE, AND WOULD HAVE READ AS V36 BREAKING ROUTING.**
It said ABSENT 7 but **ROUTING 16/30** against a baseline of 0, with `routed: [NONE — fail-open]`
on every query. `LEX_QUERY_ROUTER` is unset locally and `query-expansion.ts:401` returns null for a
disabled router — **rendered identically to a router that tried and failed. §18's corollary, still
live in the product.** Three local flags silently degrade the harness and all three make a healthy
corpus look broken: `FTS_SEARCH_URL` (absent → FTS leg throws), `LEX_VECTOR_STREAMS` (absent →
dense off), `LEX_QUERY_ROUTER` (absent → fail-open). Only `VECTOR_SEARCH_URL` is in `.env`.
**Set all three explicitly before quoting any recall number from this machine.**

✅ Embed **75,935 vectors, 0 misses, $1.18** (modelled $1.08–1.10, +9%, inside the CPW band);
reconciliation declared first and **met exactly**, `corpus_vec == corpus_chunks == 22,689,587`.
✅ FTS catch-up **73,602 of 73,602, 0 body misses**, 8 corpora reconciled individually.
✅ `fts-index` **unindexed 105,451 → 0**, query 5,934ms → 1,941ms, peak RSS **20.7 GB** (never
Railway), €0.069, destroyed. ✅ `vector-reindex` ANN **0.00% unindexed**, €0.096, destroyed.
✅ **Both serves restarted and PROVEN** by `started_at` moving.
**SPEND ≈ £1.07** of £20.

⚠⚠ **THE CANARY NEARLY CAUSED THE FAILURE IT EXISTS TO PREVENT.** Its shard 0 is 400 chunks; a full
run's shard 0 is 40,000, and both record index 0 — so the next run would have skipped 40,000 chunks
and printed `2/2 shards done`. Clearing `doneShards` alone would have duplicated instead, since
`vecTbl.add()` has no `mergeInsert`. Both halves undone together; `corpus_vec` returned to
**22,613,652**, the exact V35 baseline, which is what *proved* the repair. Fixed with a
`canaryShards` flag, **watched failing first** (1/2 disabled → 2/2 restored, with an
over-application control).

❌ **FOUND, NOT ACTED ON — ~288 sections point at R2 objects that do not exist.** The 227 "body
misses" were not the benign no-key kind; **zero** were. Sampling within groups: **V36-written
0 absent of 400**; **pre-existing 193 absent of 200**. So V36 is clean and this is a separate
pre-existing defect across `scottish-parliament-or`, `si-pre-2010`, `primary-acts-*`, `regional` —
unreachable sections that nothing reports. Broken keys ending `schedule-N-paragraph-` suggest a
section-ref bug; **suspicion, not a finding.** Kept out of this run for attributability.

2026-08-13 09:14 UTC — ▼ **MORNING CHECK ON THE OVERNIGHT RUNS. Both healthy; one number retracted;
one new defect found and fixed.**

✅✅ **V36 §2 IS COMPLETE — 41,911 done, 2 failed, of 41,913.** Last completion **2026-08-13
10:33:12 UTC**. It never tripped; the breaker check the last session flagged as "check this first in
the morning" came back clean and no un-parking was needed.

**THE PREDICTION, SCORED** (`v36-score-prediction.ts`, read-only):

| | predicted | actual | |
|---|---|---|---|
| instruments seeded | 41,913 | **41,913** | +0.0% |
| instruments yielding text | 7,868 | **8,187** | **+4.1%** |
| sections of real text | 45,636 | **73,467** | +61.0% — but **inside** the stated 27,539–232,115 range |
| wall clock | 7.0 h | **11.6 h** | +65.7% |

**The stratified yield model was the good part of the prediction (+4.1% on instruments); the
sections-per-instrument constant was the weak part.** 5.8 was assumed, 8.97 was measured
(73,467/8,187). Both errors are in the estimate's own recorded range, which is the argument for
publishing a range rather than a point.
Also written: **34,791 `unavailable` markers** — a recorded fact about an instrument, NOT yield, and
deliberately excluded from the section score. Formats: `clml` 73,454 · `html` 9 · `clml-unparsed` 4.

⚠ **One scoring bug caught before it was reported:** the first pass counted
`count(DISTINCT "sourceUrl")` as instruments and scored the yield at **+833.7%**. `sourceUrl` is per
SECTION, so it returned the row count exactly. The instrument is the R2 key prefix
(`{id}/sections/{N}`), and the script now prints a key-shape sample so the count is auditable rather
than asserted.
⚠ **Unexplained, and flagged rather than guessed at:** the DB's last completion is 10:33 UTC but the
watching monitor only reported COMPLETE at **11:26** — a ~53-minute detection lag with no
`PROBE-FAILED` events in its log. The queue state is authoritative; the monitor's timing is not, and
I have not established why.

✅ **The repeal census COMPLETED at 02:16 UTC** — `cursor exhausted`, 1,563,090 sections read. The
checkpoint sitting seven hours cold is a **finished** run, not a dead one.
⚠⚠ **AND ITS OWN MID-RUN FIGURE WAS THE WRONG ONE. The final rate is 11.44% (178,826), not 17.49%.**
The census walks in corpus order, and at 305,000 sections it was still inside the two heaviest
strata (`primary-acts-pre-2000` 21.48%, `regional` 16.84%) before reaching `si-pre-2010` 7.60% and
`retained-eu` 0.01% — together 41% of the corpus. **A progress reading over a non-randomly-ordered
cursor is the leading stratum's rate wearing the whole corpus's label.** The 400-sample 9.75% was
the closer guess, and closer *by accident*: it was random, which the mid-run reading was not.
**25,138 of the 178,826 carry a known repealing instrument.** The capability stands: the platform
can now say a section is no longer in force.

⚠ **A FOURTH DEFECT, same family as the other three: HTTP 300 was being retried as a rate limit.**
Both failed rows (`ukpga/Geo5Sess2/13/3` and `/4`) burned all five attempts under
`RetryableSourceError … (429/503/5xx/network)`. Neither was any of those: the source answers
`data.xml` with **300 Multiple Choices** and a disambiguation list, because the regnal id is
ambiguous between `Geo5/13/3` and `Geo5Sess2/13/3`. `if (!res.ok) retryable = true` swept 300 in
with 5xx. **An ambiguity does not resolve by asking again.** Fixed in both fetch helpers, scenario
added to `v36-check-retryable-guard.ts` and **watched failing first** (`expected=unavailable
got=throw` with the fix reverted — the production symptom exactly), 5/5 restored.
✅ **Blast radius measured, not assumed: exactly 2 rows.** All 5,779 regnal rows are done, 0 pending,
and 134 of 136 `Sess` ids resolved on attempt 1. Not worth chasing the two Appropriation Acts
themselves; worth the fix for the next run.

▶ **NEXT, AND IT IS THE THING THAT MAKES THIS RUN REACH USERS:** the 93,014+ new sections are
written but **not indexed**. Per root `CLAUDE.md` §17 and `INGEST_PLAYBOOK.md` §20, a large append
must be chunked, embedded, keyword- and semantic-indexed, and **both serves restarted**, or the rows
are searchable only by brute-force scan and every later query pays for them forever. That is the
next task once the drain lands.

2026-08-12 23:45 UTC — ▼ **V36 §2 IS RUNNING — SEEDED, DRAINING, AND TWICE REPAIRED IN THE FIRST
QUARTER-HOUR.** Executes `ADDENDUM_V36_SEED_ORDER.md`. Ten commits pushed
(`fd00fef..16484bd`). ⚠ **`commit-all.sh` was DELETED mid-session by the concurrent LEX/CENTRAL
thread**, which ran its own file of the same name and removed it per protocol; verified none of its
9 commits touched `scripts/ingest`, and rebuilt. **A shared filename in a shared tree — run it
promptly, don't leave it lying about.**

✅ **SEEDED: 41,913 rows, all pending, in DESCENDING citation order.** ⚠ **The file's sort order is
not the claim order** — `claimRow` is `ORDER BY priority ASC, id ASC`, so sorting the work list and
seeding it flat would have produced exactly the arbitrary tenth the ordering exists to prevent,
while looking right in the log. Citation rank is encoded INTO `priority`, bands of 50. Head of
queue: `ukpga/2006/46` (7,354 refs) → `uksi/1996/207` → `uksi/1987/1971` → `uksi/1981/238`.
**22,644 carry ≥1 reference; 19,269 uncited, seeded LAST not never.**
✅ **Gate enforced before seeding**: `v36-verify-deploy.ts` refuses unless `Ingest`'s latest
deployment SHA equals local HEAD **and** is SUCCESS — a SUCCESS deploy of the PREVIOUS commit is
exactly the failure it guards and looks healthy from every other angle.

⚠⚠ **TWO DEFECTS, BOTH FOUND BY WATCHING THE FIRST MINUTES RATHER THAN TRUSTING THE RUN:**
1. **`ROW_TIMEOUT_MS` was 5 minutes and it threw away the Companies Act — the first row of the
   run.** 15 MB of CLML, ~2,000 sections, ~4,000 R2 puts cannot finish in 300s. Both initial
   failures were the two largest instruments. **Citation order surfaced this in the first minute; a
   flat order would have buried it under thousands of small successes.** Raised to 30 min, well
   inside the 90-minute stale-claim reclaim that is the real backstop — the old ceiling was 18×
   tighter than the mechanism already guarding the same failure.
2. **The legislation processor short-circuited on `r2Exists` ALONE** — V34's exact defect, fixed
   then in the consultations and IA processors and never in this one, which is the processor now
   running a 41,913-row recovery that any deploy restarts. Now requires object AND row, via V34's
   own `sectionExists` helper.

⚠⚠⚠ **AND THE THIRD WAS MINE: THE V36 FIX TRIPPED THE BREAKER AND PARKED ALL 39,964 PENDING ROWS.**
`RetryableSourceError` was caught by the worker and marked `failed`; ops' breaker trips on **five
consecutive failures**, so a short burst of TNA throttling blocked the entire source eleven minutes
into the run, with 1,901 done. **The breaker was right** — it exists for DETERMINISTIC failures,
which must never be retried; a retryable failure is the opposite kind and must not be counted as
one. `markRetryable()` now returns the row to `pending`, records the reason and backs the source off
60s, capped at 5 attempts before becoming a real `failed`. Breaker cleared, 39,964 rows un-parked,
`source_status` back to `ok`.

⚠ **IF THE RUN IS DEAD IN THE MORNING, CHECK THIS FIRST:**
`SELECT state, trip_reason FROM source_status WHERE source_key='tna-legislation'` — if `tripped`,
clear with `UPDATE source_status SET state='ok', trip_reason=NULL WHERE source_key='tna-legislation'`
then `UPDATE ingest_queue SET status='pending', "lastError"=NULL, "claimedBy"=NULL, "claimedAt"=NULL
WHERE "sourceType"='tna-legislation' AND status IN ('blocked','failed')`. Status at a glance:
**`tsx v36-drain-status.ts`** (it withholds an ETA until the hour holds 500+ completions, because
the first reading after seeding said "837 h remaining" off a minute-old window).

▼ **RUNNING IN PARALLEL: the repeal census** (`v37-repeal-census.ts`, checkpointed and resumable).
Reads every compiled legislation object out of R2 and counts dot-leader placeholders properly
instead of extrapolating from 400 samples — **and writes each one to `section_repeals` as structured
data**, joined against the `repeals` edges so the dots say THAT a provision was repealed and the
edges say BY WHAT. At 305,000 read it stands at **17.49%**, well above the 9.75% the sample
suggested, with **15,100 of 46,949 carrying a known repealing instrument**. That is the addendum's
extension: the platform could not previously tell a user a section is no longer in force.

2026-08-12 22:55 UTC — ▼ **INGEST V37: the corpus now audits itself, and the check
puts the Companies Act at RANK 1 — it would have found V36's gap months ago from data we already
had.** V36 §1 is complete below it.

2026-08-12 22:55 UTC — ▼ **INGEST V37 §1 + §2 — THE CORPUS AUDITS ITSELF.** Executes
`BRIEF_INGEST_V37_CORPUS_INTEGRITY.md` §1 and §2 in full, §4 partially, **§3 not started**. Full
detail **`docs/V37_CORPUS_INTEGRITY_REPORT.md`**. `tsc` clean bar the documented pre-existing error.

⚠ **THE BRIEF'S PRECONDITION WAS NOT MET AND RUNNING ANYWAY WAS RIGHT.** V37 says do not start
until V36's recovery has landed. It has not. But §1 asks to *"run it once against the pre-V36
corpus… if this check would have surfaced the Companies Act, that is the proof it works"* — and
**right now IS the pre-V36 corpus.** Once the recovery lands that proof is gone forever.

✅✅ **THE VALIDATION LANDS:** `ukpga/2006/46` Companies Act 2006 → **RANK 1, 7,354 references**
(547 from our own documents) · `eur/2016/679` UK GDPR → rank 29 · **NEGATIVE CONTROL**
`ukpga/2010/4` (2,817 sections held) → **correctly absent**. **This check would have found the
Companies Act months ago, at the top of a self-prioritising queue, from the 2.36M-edge citation
graph we already had.** It is a query, not a build. `--self-test` empties the held set so the
negative control MUST fire, and exits 0 only when the validation FAILS.
**80,805 of 151,612 referred-to instruments are held nowhere.** Classified: `never-seen` 38,316 ·
`no-ingest-route` 29,359 · `known-no-text` 11,621 · **`needs-a-decision` 1,509**.
⚠ **`needs-a-decision` is Charlie's, and it exists because the alternative was guessing** — a first
draft asserted `mwa` was "superseded by anaw" when the corpus holds 22 `mwa` instruments and 1,446
sections. Flagged: **`apni`** (1,264 instruments, 2,602 refs — **fifty years of NI primary
legislation, 1921–1972**; we hold `nia` 2000+ and `nisi` and nothing between) and **`ukcm`** (245,
6,803 refs — **Church Measures are primary legislation**; `ukcm/1969/2` alone carries 1,108 refs).
⚠ **1,227 FALSE gaps resolved by two alias classes** — regnal/calendar, and prefix/zero-padding
(`eud/1999/468` **404s at source** while `eudn/1999/468` is a live document we hold).
✅ **Citation ranking beats completeness sweeping, measured:** the citation queue surfaces the
Companies Act; V36's completeness work list is 95% Georgian local Acts that yield no text. Same
corpus, opposite ends of the queue.

✅ **§4 filler: detect → size → price → gate.** **The six highest-value gaps cost 5.6 pence to
embed** (3,129 sections, 955,542 tokens, $0.0717). Sizing is EXACT — the fetch is free (OGL) so the
price comes from real tokens, nothing extrapolated. The £15 gate tests **this batch PLUS
month-to-date** from a `gap_filler_spend` ledger, because a threshold checked only against the
current job is one a loop defeats. Dot leaders excluded from the price, so the Companies Act sizes
at 1,968 storable sections not 2,093 — V36's fix visible in the invoice.
⚠ **The gate PASSES and the filler still refuses to run, at exit 3**, printing the six steps it has
not wired (fetch→store · chunk+embed · keyword index · semantic index · **RESTART BOTH SERVES** ·
verify through the product). **A gap half-filled is worse than a gap.** ✅ One thing checked rather
than assumed: I suspected the batch cap could not reach the embed since the catch-ups are
corpus-wide — **wrong**, `v33-vec-catchup.ts` reads a per-`--run <tag>` work list, so the cap is
real.
❌ **NOT DONE: §3 (live miss logging) entirely; monthly scheduling of §2; the filler's full-scope
run.** Scored honestly in the report: two of six §5 criteria not done, one partial.

2026-08-12 22:37 UTC — ▼ **CENTRAL: THE PILOT SEED SET IS LOADED — 36 QUESTIONS, 27 ANSWERS, LIVE
IN THE QUESTION LIBRARY.** `docs/central_seed_set.json` imported into **Reform Branch Community**
(`28c84ed1…`) on Neon production by a new re-runnable
`scrutinise-web/scripts/import-central-seed.ts` (**dry run by default, `--apply` to write**, as the
file's own rules ask). CHANGE_LOG (2026-08-12 22:37 UTC). `whichdb` checked first; library was empty
before; `tsc` clean. Nine questions are deliberately unanswered — that is the file's design, not a
gap. Read back field by field from the database (36/36, 27/27, 10 topics × 4 nodes) and verified
through the app's own `listQuestions` / `getRankedAnswers` / `buildPack`, not a bespoke query. A
second `--apply` writes **0 rows**.
⚠ **`authorType` / `aiModel` HAVE NOWHERE TO LIVE.** The seed file marks every answer authorType AI,
aiModel Claude; `Answer` has neither column at Stage 2b. Provenance is carried by a seed author
account **`lex`** (`clerkId: seed_central_lex`, `isHistoricalAccount`, **not a Community member**) —
attributing them to Charlie would have barred the owner from voting on all 27, since self-voting is
refused. **The answer card renders no author name at all**, so an AI answer currently looks exactly
like a member's on screen. A Stage 2c decision, reported not taken.
⚠ **THE CHIP ROW NOW READS ODDLY, DELIBERATELY.** The five new topics (Economy, Law & rights, Media
skills, Party conduct, Social issues) were created on all 4 nodes **unpromoted**, per
`central_stage2b.sql`'s rule for later additions — so the promoted chips still offer **Housing (0
questions)** while **Party conduct (11)** sits in the dropdown. A 20-row `UPDATE` to flip;
**Charlie's call.**
⚠ The one `trainingSessions` record is **HELD, not imported** — no `TrainingSession` model exists,
`ActivityClaim` pays points on approval, and the file itself says hold until both participants have
accounts. **Richard Ross has no account.**
✅ The importer's unknown-context guard was **watched failing** before being trusted: run with
`--apply` on a doctored copy it refused and wrote nothing. ⚠ Minor, before any demo: with no votes
cast, pack ranking falls back to newest, so a pack built today leads with the *unanswered*
questions.

▼ **INGEST V36 §1 — COMPLETE. THE WALK FINISHED: 804 year-feeds, 0 throttled, 324,622 instruments.**

2026-08-12 18:03 UTC — ▼ **INGEST V36 §1 — REPORTED BEFORE INGESTING, AS THE BRIEF REQUIRED, AND
§1 CHANGED §2.** Executes `BRIEF_INGEST_V36_MISSING_INSTRUMENTS.md` §1 in full and §5; §2/§3 not
started, and the reason is below. Full detail **`docs/V36_INGEST_REPORT.md`**. `tsc` clean in
`scripts/` bar the documented pre-existing `download-graph-sources.ts` error.

⚠⚠ **THE CORPUS HOLDS 44.1% OF WHAT ITS OWN SOURCE PUBLISHES — 143,269 of 324,622 instruments**,
measured by walking legislation.gov.uk's year feeds, not by counting `LegislationItem`. By type:
`eur` **18.4%** · `ukpga` **25.6%** · `eudn` 43.8% · `nisr` 62.5% · `eudr` 62.6% · `uksi` 67.4% ·
`wsi` 69.4% · `ssi` 74.5% · `nisi` 97.4% · `nia` 98.7% · `asp` 99.8% · `anaw`/`asc` **100%**.
By collection: `primary-acts-2000plus` **99.5%** · `regional` 68.6% · `si-2010plus` 68.6% ·
`si-pre-2010` 66.9% · `retained-eu` **24.5%** · `primary-acts-pre-2000` **21.4%**.
⚠ **Read the columns before the headline: 139,440 of the 181,353 absences are class (a)** — the
CLML WAS fetched and declares `NumberOfProvisions="0"`, overwhelmingly `eur` (95,842) and `eudn`
(16,303). Not a fetch failure. **The recoverable work list is 41,913** (33,989 never seen + 7,924
class-b fetch outcomes).

**The 17,261 is wrong in both directions, and the two errors do not cancel.**
- **Overstates by ≥1,610.** Pre-1963 Acts are cited by REGNAL session and legislation.gov.uk's
  canonical id follows (`ukpga/Geo5/15-16/20`); `LegislationItem` uses the CALENDAR id
  (`ukpga/1925/20`). The corpus holds **1,610 instruments / 33,231 sections under regnal ids, none
  with a `LegislationItem` row**. ⚠ **The Law of Property Act 1925 and the Merchant Shipping Act
  1894 are named in the brief as missing and are both IN the corpus.**
- **Understates by thousands.** 5,536 published `ukpga` were never seen by anything, most with no
  legacy row at all, so no `LegislationItem`-keyed audit could ever have counted them.

⚠ **"77,000 sections" belongs to 9,859 of the 17,261, not to all of them.** The other **7,402 have
no legacy text at all** (7,276 `ukpga`) — migration could never have recovered them.

⚠ **A LIVE DEFECT PRODUCED PART OF THE GAP AND WOULD HAVE REPRODUCED IT.** `enumerateSections`
fetched through a helper that discards the retryable/deterministic split, so a 429, a 503 or a
timeout looked exactly like a 404 and the instrument was stamped `No CLML/HTML/PDF found on TNA`
with `availability_status='no-provisions'` — **a permanent claim about a document made out of one
minute's fetch outcome**, then skipped forever by the reseed dedup. **8,583 instruments carry it**,
all written in June 2026, spread evenly at 1–2.5% of every SI year (2,027 distinct minutes — not
one outage). **27.5% of a random n=40 sample return real CLML on a plain re-fetch today**; the
other 72.5% come back correctly classified, which is a repair to the record. **Fixed**: it now
throws `RetryableSourceError`, the worker marks the row `failed` with its reason, and a re-run that
recovers text retracts the stale marker. Guard watched failing first: **2/4 before, 4/4 after.**

⚠⚠ **BIGGER THAN THE BRIEF, AND NOT FIXED: 117,667 instruments carry a promise nobody can keep.**
`specialist_queue` is 117,667 `pdf-only` rows, all `pending` since June 2026, with one writer and
**no consumer**. The classification comes from a HEAD request, and **TNA answers HEAD on
`data.pdf` with 405** — so the probe cannot say yes. **0 of 52 randomly sampled `pdf-only`
instruments have a PDF** (`/data.pdf` 301s to `/made/data.pdf`, which 404s). The note Lex showed
users — *"The text of this instrument exists as a PDF… It is queued for PDF processing"* — was
false in both halves. **Probe and note both fixed** (ranged GET + `%PDF-` magic; check 3/5 before,
5/5 after). **The 117,667 existing rows still carry the false classification** — re-verifying them
is ~6.5 h of ranged GETs on the fleet, no LLM cost, and it should be the next sprint.

✅ **§1.4 settles the route: RE-FETCH, DO NOT MIGRATE.** n=25 random gap instruments with legacy
text: **25/25 fetch from the source today**, source **richer in 11**, legacy richer in **0**,
source empty in **0**. Companies Act 2006 is **2,093 sections at source against 1,665 legacy**;
UK GDPR **140 against 61**. `LegislationSection` is a stale snapshot — so the V26 §6 DROP is still
blocked, but as a *fallback during the repair*, not because it is the only good copy.

✅✅ **THE SHARPEST RESULT OF THE SPRINT: THE RECOVERABLE POPULATION IS INSTRUMENTS FROM 1987
ONWARDS THAT WERE NEVER ENUMERATED. NOTHING ELSE IN THE WORK LIST YIELDS TEXT.** 1987 is
legislation.gov.uk's digitisation boundary and it was **measured, not read off a docs page** —
`unseen` uksi **1980–1986: 0/14** · **1987+: 12/12, mean 16.9 sections**. Everything earlier returns
CLML declaring `NumberOfProvisions="0"`. Full strata, each with its denominator:
`unseen:1987+` **91.7% (n=12), mean 5.8 REAL sections** · `unseen:pre-1987` **0% (n=26)** ·
`unseen:ukpga:pre-1850` **0% (n=12)** · `classb:ukpga` **16.7% (n=12)** · `classb:*` **27.5%
(n=40)**. ⚠ **The 1987+ row first read 100% at a mean of 16.9 and BOTH halves were wrong** — both
were carried by `uksi/1999/303`, whose 137 sections were all dot leaders (below). Re-derived from
`corpus_sections` over all 51 instruments the pilots touched: **13 with real text, 71 real
sections, mean 5.5 overall**. The first figure came from a counter, and a counter cannot know that
what it counted was dots.

⚠⚠ **§2's PILOT CORRECTED MY OWN PREDICTION, AND THIS IS THE TRAP TO REMEMBER.** The first version
used an `unseen` rate of **1.0**, taken from the n=25 freshness sample — but that sample was drawn
from gap instruments *that have legacy text*, a population **selected for having text**. Against
the real work list the yield is **0 of 12**, because 5,546 of the 5,808 ukpga items are 1800–1849
local and personal Acts. A uniform draw over a work list measures whichever stratum dominates it
and reports that as the whole. `v36-seed-recovery.ts` now carries strata and **prints UNMEASURED
rather than folding an unpiloted one in at an assumed rate**.

**PREDICTION on the work list as it stands (PARTIAL — walk incomplete), to be scored after:**
**31,057 instruments · 2,618 expected to yield text · ~15,183 sections at 5.8/instrument (range
9,162–77,223) · 5.2 h wall clock · £0 fetch** (OGL v3.0; the spend is R2 writes and the later
embed). ⚠ **For scale: the brief anticipated ~77,000 sections and a $12–15 embed.** The sections
were never where the instrument count suggested; predict the embed against the final list, not
against either figure. ⚠ **The ukpga half contributes almost nothing to recall** — its value is that ~28,000
silent absences become classified known unknowns. **The recall win is the 2,718 modern
instruments**, and that number grows when the walk reaches `uksi` 2008–2026 and the `eur` family.

⚠ **`uksi` is a different gap from `ukpga`.** Source publishes 69,483 for 1948–2002, corpus holds
**44,208 (63.6%)**, **24,967 never seen** — and class (a) is **6**. The uksi absence is almost
purely un-enumerated, not fetched-and-empty.
✅ **The two new code paths are proven live**: the retraction logged `cleared stale unavailable
marker` on exactly the two instruments that recovered and no others, verified by reading
`corpus_sections` back rather than trusting the return value.

⚠⚠ **THE PILOT'S BEST-LOOKING INSTRUMENT WAS 137 SECTIONS OF NOTHING.** `uksi/1999/303` recovered
**137 sections / 4,521 words** — the largest yield in the sample and the reason the mean was 16.9.
Reading the R2 objects back rather than the row count, every one is `1 . . . . . . . .`: that is how
legislation.gov.uk renders a **repealed** provision in the revised CLML. Across everything the
pilots wrote, **139 of 210 sections (66.2%) were dot leaders**. Each would have been chunked,
**embedded at full price** and retrievable as a document that says nothing. **Fixed**
(`isRepealedPlaceholder`): recorded as `unavailable`/`revoked` with a note, out of the chunker, FTS
and embed, R2 writes skipped. Watched failing first — **12/14 under a naive "any letter" rule,
14/14 with the two-letter rule**; the discriminating cases are lettered section numbers
(`5A . . . .`). ⚠ One test case had to be **corrected rather than the rule**. **Retro-fixed** with
`v36-retract-placeholders.ts` (needed because `processTnaLegislation` short-circuits on
`r2Exists(compiledKey)` before the check, so a re-run skips the instrument): **139 rows flipped,
verified by reading back — 139 revoked, 0 still compiled.**
⚠⚠⚠ **AND IT IS NOT CONFINED TO THE RECOVERY — THIS MAY BE THE LARGEST FINDING OF THE SPRINT.**
400 random ALREADY-COMPILED legislation sections read out of R2 and run through the detector:
**39/400 = 9.75% are dot leaders**, by corpus `primary-acts-pre-2000` **22.5%** · `regional`
**18.6%** · `si-2010plus` 7.9% · `si-pre-2010` 4.0% · `primary-acts-2000plus` 5.9% · `retained-eu`
0%. **Extrapolated over 1,760,981 compiled legislation sections: ~171,700 already chunked, already
embedded at full price, already retrievable as documents that say nothing** — nearly a quarter of
the pre-2000 primary Acts corpus. It bears directly on search, because those sections occupy
candidate slots against real provisions, and **a share of the ABSENT/RANKING counts in
`diagnose-recall.ts` may be real provisions displaced by empty ones — a HYPOTHESIS, testable by
re-running it after a corpus-wide retraction.** **NOT fixed deliberately:** the pass means reading
1.76M R2 objects (Railway-scale) and **an extrapolation from 400 samples is not grounds for
flipping 171,700 rows**. Tool ready (`v36-retract-placeholders.ts --sample N` reports,
`--apply` acts); scoped next sprint.

⚠ **Found, measured, NOT fixed — a lead for the next sprint:** `ukpga/Vict/1-2/118` holds two
sections whose entire body is a number (`"1"`, `"28"`) with malformed `sectionRef`s (`126.`,
`2835.`), pointing at `CLML_SECTION_RX`'s nested-element boundary problem rather than at the
source. Two rows inspected is a lead, not a root cause (§13).

⚠ **NEXT SESSION STARTS HERE.** The source walk is **COMPLETE** (804 feeds, 0 throttled, 324,622
instruments; checkpoint `scripts/ingest/v36/source-entries.json`, gitignored, ~30 MB, regenerable).
`v36-reconcile.ts` has been re-run against the whole of it and the work list is **41,913**
instruments. Remaining sequence, in this order and no other:
**1. Run `commit-all.sh`** (7 commits, `bash -n` clean) — **the push MUST precede the seed**,
because `Ops` wakes `Ingest` within ~25 min of work appearing and `Ingest` runs PUSHED code; seeding
first hands the whole list to the version of `enumerateSections` that writes a 429 down as a
permanent "no text" marker (playbook §8, V19 recurrence).
**2. `v36-seed-recovery.ts`** — dry-run prints the stratified prediction; record it in CHANGE_LOG
before the run, score it after.
**3. Drain, then §3's index work**, predicting the embed against the real section count.
⚠ `--totals` is NOT the instrument: legislation.gov.uk omits `<openSearch:totalResults>` on
bucketed year feeds — `ukpga/1925` has it, `uksi/2010`/`ssi/2010`/`eur/2016` do not. A first pass
recorded 226 `ukpga` years and **zero** `uksi` years. Reconcile off the entry walk.
✅ **§5 shipped: `docs/CORPUS_COMPLETENESS.md`** — reachability is not completeness. 74
collections: **2 reconciled, 56 confirmed-target-only, 16 NOT RECONCILED**. NOT RECONCILED means
unmeasured, not incomplete, and the file says so.

▼ Earlier (LEX thread, same day):
2026-08-12 17:36 UTC — ▼ **LEX: SPRINT 3-D IS WALKED (7 PASS, 2 FAIL, BOTH FIXED) AND THE DEEPENING
(§22 PILOT A) IS BUILT.** Executes `BRIEF_DEEPENING_RESTART.md` §1/§2/§3 in full. CHANGE_LOG
(2026-08-12 17:36 UTC). `tsc` clean, `next build` passes.

✅ **BROWSER-VERIFIED END TO END** after Charlie deployed. 2a and 9a both re-walked and fixed; the
kernel driven to 4/4 to unlock the Deepening; **one pass run live — RUN, 8 findings, 4 issues, 4
known unknowns, 32 references**, with a **CONTRADICTS finding first**, impact assessments among the
sources, and the missing PIR **declared as a known unknown rather than invented**. Accept, dismiss
(reason enforced, dismissed stays visible) and **re-run all verified — the last one in the database:
runVersion 1→2, 7 PROPOSED superseded with a note, the ACCEPTED item untouched.**

⚠ **THE DEPLOY DID NOT HAPPEN ON THE PUSH — TWICE IN ONE DAY.** Both times it took Charlie
triggering it by hand. **Treat GitHub auto-deploy for this project as not working until proven
otherwise**, and prove a deploy only by reading a string back off the running site.

⚠ **Running it found a defect no check could have.** `Idea.guidingPolicy` is **null on every rebuild
idea** (the chosen approach is a `PolicyOption` row with status `CHOSEN`), so the gather's context had
no guiding policy in it. The pass completed and produced good findings anyway — which is precisely
why it would never have surfaced: it degrades quality silently and fails nothing. Fixed.

⚠ **AND RE-READING §24 AGAINST WHAT SHIPPED FOUND TWO MORE — both named in the brief's §2.5 and both
simply not done** (a thing that was never built fails nothing, so no check could have caught either):
the **§24.1 progress label did not exist**, and the **§24.2 facts strip was in the create flow rather
than on the idea header**, i.e. visible only to whoever was already deepening the idea. Both now sit
on the idea header, quieter than the five-stage badge because Skeleton → Deepened is a *parallel*
track. **DEEPENED requires a pass RUN *and* its issues triaged** — one run with ten open issues is a
to-do list, not depth, and collapsing work-started into work-done is the exact failure the thermometer
§24 removed used to have. Team-reviewed / Published are deliberately absent until §22.4 and §20.3
exist. Owner-visible only until §20-D and the review instrument make §24.7's public panel honest.
**Nothing else in §24 is outstanding** — the rest is sequenced by §24.9 after §20-B/C/D, and its one
hook (`DeepeningIssue.reviewFindingId`) is already in the schema, unused.

⚠ **§1's blocker was real and is worth remembering: production had not deployed since 6–9 August.**
Measured off the running product by three probes, not inferred (Vercel is SAML-blocked here). Charlie
cleared it; both probes were re-read before the walk began. **Every "Charlie's browser re-test is the
remaining gate" note since 9 Aug had been untestable** — Central Stage 2, Central 2b, Lex 3-C, 3-D.
**A push is not a deploy, and the only honest proof of a deploy is a string read back off the site.**

**§1 — 7 of 9 pass.** Task 1's problem gate holds **in two presses** (a solution entered as the
problem is never accepted as one); 9e, 9f, 9g, 9h and Task 3 all pass; legislation links **5/5 →
200**. Also seen working: Lex **refused to seed causes** rather than dressing a document title up as
one, and `generatePolicyOptions` produced **3 LEX options** where the database held zero.

⚠ **THE TWO FAILURES WERE SECOND INSTANCES OF THE DEFECTS 3-D HAD JUST FIXED.** **2a:** `keywords` is
`type:'structured'` with **no slots**, so `FieldsPanel` sent it to the slot renderer and drew
"PROPOSED BY LEX — REFINE" over an empty card — whose Save would have written `{}` **over Lex's
proposed keywords**. **9a:** "Save & exit" POSTed `accept` to `/fields`, which **422s child-entity
fields by design**, so it could not save on any page from Diagnosis onwards; the two copies of
`CHILD_ENTITY_FIELDS` had drifted and the dialog was calling already-persisted `PolicyOption` rows an
unsaved draft. Both fixed; `check:panel-claims` guards them and **every assertion was watched failing
first**.

**§2 — the Deepening.** Three additive tables on Neon (`whichdb` first, then re-applied to prove
idempotence). Four passes as **pure configuration** — the check asserts **no pass key appears outside
`deepening-config.ts`**, so a fifth pass is one array entry. Background runs persist incrementally, a
re-run supersedes older PROPOSED items and **provably cannot touch an ACCEPTED one**, and a run
killed by the platform is settled by **writing** the row to FAILED rather than displaying something
different. Never-claim in full: a finding whose source is not in what the run retrieved is dropped
before it can be stored; zero retrieved means **no model call at all**.

⚠ **§3's premise expired mid-sprint.** The brief said to declare the Impact Assessment gap on every
`EVIDENCE_PRECEDENT` run; **Search closed it the same afternoon** (`db49b3f`), and the walk confirmed
it *behaviourally* — the briefing panel rendered "WHAT IT WAS EXPECTED TO COST" with a real DEFRA
Impact Assessment and a post-implementation review. So known unknowns are **computed per run** and a
hardcoded gap string is **forbidden by the check**. §3's other answer: `explanatory-notes` (18,801
sections / 560 docs) and `explanatory-memoranda` (27,428 / 10,864) both exist; there is **no separate
PIR corpus** — the "what actually happened" leg is 1,235 sections *inside* `impact-assessments`.

⚠ **§24 supersedes §22.3:** no thermometer, no star rating, counts only — and the check greps for the
vocabulary so a later total fails.

⚠ **`check:score-scope` FAILS on `lib/question-library.ts` (Central's `3444f3d`), not on this
sprint's code.** Its `score` is a vote tally, not a retrieval score, so it looks like a false positive
from the check's file scope — but that is the Central thread's call. **Reported, not edited.**

⚠ **Two environment facts that cost real time and will recur:** Node cannot reach Neon by hostname on
this machine (happy-eyeballs + a cold compute) — every DB command needs
`NODE_OPTIONS=--no-network-family-autoselection`, and without it `next build` fails locally for a
network reason while being fine on Vercel. And `scripts/whichdb.ts`, the check §16 makes MANDATORY,
**could not run at all** (no root `node_modules`); a runnable one is now `npm run whichdb`.

▼ Earlier:
*2026-08-12 17:12 UTC — ▼ **SEARCH S2C-6 + INGEST V35 ARE BOTH COMPLETE: the four
corpora are typed, titled, keyword-indexed and vector-indexed, nothing is left running — and the
recall constraint turns out to be 17,261 instruments that were never ingested.** Earlier threads
follow.*

2026-08-12 17:12 UTC — ▼ **SEARCH S2C-6 + INGEST V35.** Executes `BRIEF_SEARCH_S2C6.md` §1 and §2
in full, §3 **STOPPED on evidence**; `BRIEF_INGEST_V35_SEARCHABILITY.md` §0–§2, §3 blocked on §1.
CHANGE_LOG (2026-08-12 12:39 UTC); full detail **`docs/SEARCH_S2C6_REPORT.md`** and
**`docs/V35_SEARCHABILITY_REPORT.md`**. `tsc` clean in both projects bar the one documented
pre-existing `download-graph-sources.ts` error.

✅ **V35 IS COMPLETE ON BOTH HALVES — nothing is left running.**
- **Embed: 95,044 vectors, 0 misses, $4.87 against $4.50 predicted (+8.2%)**, inside the CPW band
  (top $4.94). `corpus_vec` 22,613,652 = `corpus_chunks` 22,613,652, exactly +95,044; checkpoint
  `phase: "done"`. ⚠ Shard 2 failed at *job creation* on the first pass (no spend lost) and the
  re-run did only the missing shard — which is exactly what the `--run <tag>` checkpoint
  separation was added for.
- **FTS: 31,849 rows, 0 body misses**, all four corpora from `fts=0`.
- **ANN: `unindexed=0`**, and the verify was watched **failing first** at
  `unindexed=95,044 (0.42% brute-force per query)`. Rebuild 1,130s, **€0.101**, peak RSS 5.8 GB,
  box destroyed. `expectedPeakGb` 5.6 → 5.8 in `jobs.ts`; size deliberately not reduced.
- **`vector-serve` redeployed**: `started_at` 2026-08-11T22:46:25.910Z → **2026-08-12T17:08:24.979Z**,
  `nprobes` 64 both sides. It still does not auto-deploy from GitHub.
- ⚠ **After-latency is deliberately blank, not zero** — `served: 0` on a fresh boot means the
  since-boot counters are empty, and a p50 off an empty sample is not a measurement. Needs traffic.

⚠⚠ **`v33-vec-catchup.ts` was telling the next reader to run the WRONG heavy job** — `vector-index`,
whose scripts are both checkpointed `phase:"done"`, so it reports success, builds nothing and
destroys the box. `vector-reindex` is the one (it passes `--index-only`). Fixed, but worth knowing
the class exists: `jobs.ts` documented the trap correctly and the hint pointed away from it.
⚠ **The after-measurement needed an `fts-serve` restart to mean anything** — the first `after` run
came back BYTE-IDENTICAL to `before` (0/620 slots, 6/6 on-target ABSENT) because `fts-serve` calls
`openTable()` once at boot and was serving the 2026-08-11T22:37 snapshot. Exactly the trap
`docs/CLAUDE.md` §17 records. Redeploy triggered; **re-run
`scripts/measure-political-corpora.ts --label after` once `started_at` has moved.**

**§1 — THE TYPING IS COMMITTED: three new display types, union 10 → 13.**
`impact-assessments` → **IMPACT_ASSESSMENT** (tier legislation, legislation stream) ·
`consultations` → **CONSULTATION** (tier guidance, guidance stream) · `commons-`/
`lords-divisions-votes` → **DIVISION** (tier parliamentary, debates stream, which now admits the
type). `check:corpus-types` **153/153**, every new assertion **watched failing first** against
three deliberate breaks. **The evidence that made it four decisions not one sweep:** IAs carry a
`parentDocId` naming the instrument they assess on **94.7%** of rows; consultations on **0%**.
⚠ **V35 §0's sequencing note is WRONG — the typing gates the EMBED too**, because
`v33-vec-catchup.ts` bakes `tier: tierFor(corpus)` into every chunk and `vector-search.ts`
prefilters on it server-side. Embedding first would have written `other` into 95,044 paid-for,
unreachable chunks. Tiers verified in `corpus_chunks` before any spend, with a negative control.
⚠ **All four collections failed the brief's correctness requirement.** A Lords roll-call's stored
title is the bare bill name (`Employment Rights Bill`); **1,024 IA rows are titled the single word
"Summary"**. `lib/lex/political-title.ts` fixes it at display, one file, both adapters.
⚠ **`lda-commonsdivisions` (5,553) / `lda-lordsdivisions` (2,089) are a live finding, reported not
fixed** — a different, near-empty division collection (mean 16 and 8 words, no title, no date)
already typed DEBATE and already in the debates stream, rendering as the raw corpus key.

**§2 — THE BINDING RECALL CONSTRAINT IS INGEST, AND IT HAS A NUMBER.** A diagnosis separating the
five loss modes (`scripts/diagnose-recall.ts`) over the 15 within-stream pairs: **IN_TOP_K 13 ·
ABSENT 9 · RANKING 5 · CANDIDATES 3 · ROUTING 0 · TYPING 0.** The brief's own lever (candidate
count) fixes **3 of 17**. ⚠⚠ **17,261 instruments known to the legacy `LegislationItem` table are
ABSENT from `corpus_sections`** — ukpga 8,896 · uksi 4,668 · eur 2,268 · ssi 732 — carrying
**77,000 sections / 61.2 M characters**, including the **Companies Act 2006** (1,665 sections) and
**UK GDPR** (61). That is why UK GDPR cannot be retrieved at any probe count. **Ingesting them is
the next INGEST task and it closes the SEARCH problem too.**
✅ **`caselaw` 36/36 → 22/36 is RETIRED after five sprints, and the premise was wrong.** There is
no 36-query set — it was the count of forward-decided routing CALLS in S2B §2.3 — and
`gold-queries.ts` has **no caselaw archetype at all**, so the gold set could never have answered
it. Measured directly: caselaw selected **8/8 when right, 1/8 when wrong, 0/16 unstable, 0/48
fail-opens**. The fall was the router discriminating. **Do not carry it again.**

**§3 — STOPPED, AND THIS IS THE ONE TO READ FIRST: THE V26 §6 DROP MUST NOT PROCEED.**
`LegislationSection` holds the only copy of those 77,000 sections / 61.2 M characters.
`corpus_acts` is a verified superset for METADATA; `corpus_sections` is **not** a superset for
TEXT. And the legacy path is live coverage, not dead weight: the exact query shape `lib/search.ts`
uses returns **Companies Act 2006 s.656 at RANK 1** and **UK GDPR Articles 9 and 6 at RANKS 2 and
7** — the very documents the corpus path reports absent. **No repoints made** (paths A/D/G/H would
silently narrow coverage by 77,000 sections). The four metadata-only paths (B/C/E/F) stay safe but
buy nothing until the DROP is possible. Charlie's `title IS NOT NULL` answer is recorded and still
right for when it happens.
⚠ **§5's own rule now points at reverting `VECTOR_NPROBES` to 24** — it says revert if §2 finds no
recall gain traceable to candidate quality, and candidate quality accounts for 3 of 17. Charlie's
call, with the number the rule asks for.

⚠⚠ **A NETWORK FAULT THAT IS NOT ONE, AND IT WILL RECUR.** Mid-sprint, every Neon connection and
every Gemini `fetch` failed on all six resolved addresses while PowerShell `Test-NetConnection` to
the same IP returned True. **Cause: Node ≥20 happy-eyeballs (`autoSelectFamily`) racing an
unroutable IPv6 against an IPv4 connect that takes ~10 s because Neon's compute auto-suspended.**
Fix, verified three times: `NODE_OPTIONS="--no-network-family-autoselection
--dns-result-order=ipv4first"`. It is intermittent by construction and looks exactly like an
expired credential.
⚠ **Two `v33-vec-*` tooling traps closed before the run:** `--run <tag>` now names the delta report
AND the catch-up checkpoint (the V33 checkpoint is `phase:"done"` with `doneShards` as INDICES —
re-used against a different work list it would have silently skipped shards), and a hardcoded log
line that printed `docs/v33_vec_delta.json` for a file written to v35 is fixed. Phase 1 also had
**no retry** and died at section 10,000 on a transient R2 multipart PUT; now retried.
⚠ **This tree is shared with a concurrent session** (a LEX thread updated CHANGE_LOG at 12:21 UTC).
`commit-all.sh` stages only the files listed in it.

▼ Earlier:
2026-08-12 07:50 UTC — ▼ **INGEST V34: THE POLITICAL-EVIDENCE LAYER IS INGESTED. 14,274/14,274
ROWS, 0 FAILED, 31,852 SECTIONS, 34.5M WORDS.** Executes `BRIEF_INGEST_POLITICAL_SOURCES.md`
§A/§B/§C in full. CHANGE_LOG (2026-08-11 18:30 UTC); full detail
**`docs/V34_POLITICAL_SOURCES_REPORT.md`**. `tsc` clean bar the documented pre-existing errors.
**Nothing is left running** — the queue is empty and `Ingest` has exited on empty as designed.
`commons-divisions-votes` **2,361** · `lords-divisions-votes` **3,284** · `impact-assessments`
**18,759** sections from 1,181 documents · `consultations` **7,448**. `division_votes`
**2,528,032 rows** (1,061,541 aye / 1,067,572 no / **398,919 absent**) — predicted 2,556,897,
**within 1.1%**. All four `--verify` reconciliations pass exactly.
⚠ **NEXT: THESE FOUR CORPORA ARE NOT SEARCHABLE YET.** They are in `corpus_sections` but not in the
FTS or vector indexes, and `corpus-map.ts` has no entry for them — so `corpusToType` returns null
and the adapter would drop every row (the exact UNREACHABLE condition Stage 2C spent a sprint
clearing). **Typing them + an index build is the follow-on**, and it is a Search-thread decision:
divisions are arguably DEBATE, impact assessments and consultations arguably GUIDANCE, and a
tenth type may be the honest answer. Do not seed a type without a before-and-after measurement.
⚠ **THREE BUGS THAT A CLEAN `tsc` AND PASSING PILOTS ALL HID**, each found by a check rather than a
failure: **(1) the Commons list endpoint caps `take` at 25** and V28's enumerator broke on a short
page — it would have ingested **25 of 2,361** and reported success; **(2) the Lords lists every
teller twice**, a duplicate `member_id` that would have failed **all 3,284** Lords divisions;
**(3) an R2 object does not prove a section row exists** — 2 consultations were SIGTERM'd between
`r2Put` and `upsertSection` by my own mid-drain redeploy, and the bare `r2Exists` short-circuit
then marked them `done` with no section. Caught only because `done=7448` read against 7,446
sections. **Both processors now require the object AND the row.** ⚠ **Do not push mid-drain.**
⚠ **`impact-assessments.est_sections` re-baselined 9,448 → 18,759 (`est_is_confirmed=true`).**
Predicted 8 sections/IA, actual 15.9 — and my mid-drain revision to 23.1 was **also wrong**,
because IAs drain in feed order, not size order. Both discarded figures are in the `corpus_targets`
note so neither is mistaken for a measurement later. Costs: ~250 MB R2, ~31,900 Class A writes,
**~46 M tokens to embed** (predicted 64 M).
⚠ **STILL CHARLIE'S CALL, BLOCKING NOTHING:** Public Whip's bulk vote matrices are **ODbL
share-alike** — the first licence that would attach an obligation to our *derived* database;
flagged in `licence-map.ts`, not ingested. And ONSPD is OGL v3.0 but **NI "BT" postcodes need a
separate Land & Property Services licence** for the constituency feature.
⚠ `stage_outcomes` exists and is **deliberately EMPTY** — populating "passed without a division"
needs a 30s/call Bills API stage crawl and a fuzzy title match, and a fuzzy row there is the false
certainty the table exists to prevent. Lords absence stays a known unknown (`absence_known=false`
on all 3,284) until the Members API eligible-peer roll is built.
⚠ Parliament's own tally disagrees with its own roll-call by ±1 on 10 historic Lords divisions —
which is why both `aye_count`/`no_count` and the `division_votes` rows are stored.

*Earlier: 2026-08-11 23:25 UTC — ▼ SEARCH Stage 2C-5 (below). Earlier threads follow.*

2026-08-11 23:25 UTC — ▼ **SEARCH STAGE 2C-5: PROBES UP, METRIC HONEST, AND THE RERANKER IS NOT
AUTHORISED — BECAUSE THE DENOMINATOR SAYS THE PROBLEM IS RECALL.** Executes `BRIEF_SEARCH_S2C5.md`
§1/§2/§3 in full; §4's two unknowns settled but its eight repoints deliberately NOT done; §5 untouched.
CHANGE_LOG (2026-08-11 23:15 UTC); full detail **`docs/SEARCH_S2C5_REPORT.md`**. Spend **€0.030**.
`tsc` clean in both projects.

**§1 — `VECTOR_NPROBES` IS 64 IN PRODUCTION**, and engagement was verified POSITIVELY: `/stats` now
serves `retrievalConfig()`, it read **nprobes 24** before the change and **64** after. Latency, same 20
queries same order `noCache`: p50 **2,763 → 3,148 ms (+13.9%)**, p95 5,615 → 3,874 (−31.0%, ⚠ do not
bank it — one outlier moves a 20-sample p95), 0 failures. Inside the revert criterion, fixed at 8,423 ms
BEFORE the change. ⚠ **The brief's baseline was stale** (p50 3,647→2,957, p95 4,355→5,447 at the 22:31
re-read), which is why it said to re-read.

⚠⚠ **THE RECALL JUSTIFICATION DID NOT MATERIALISE, and two metrics were conflated — one of them mine to
keep straight.** Gold, same harness twice, only nprobes differing: BM25-alone **62.2% → 62.2%** (a clean
negative control proving the harness deterministic), **vector-alone 69.2% → 68.6%**, fused 67.3% → 68.6%.
S2C4 measured **overlap with an exhaustive probe** (70.4% → ~85%), which is candidate-set fidelity, **not
gold recall** — and they did not move together, because more probes surface more near-neighbours and a
larger candidate set can push a gold document out of a fixed top-20 as easily as pull one in. **So we now
pay ~14% p50 for a better candidate set whose benefit at gold is undemonstrated.** NOT reverted — the
brief decided to run it and its explicit trigger was unmet; it is one variable and one restart to undo.

⚠ **`vector-serve` DOES NOT AUTO-DEPLOY FROM GITHUB**, and that had been silently true for days: the same
push deployed fts-serve (SUCCESS) and produced **no vector-serve deployment at all**, which is why it had
been serving **7 August** code. It needs an explicit `vector-serve-run.ts redeploy`. ✅ A rebuild could
not have confounded the A/B — all five runtime files were byte-identical between its running build and
HEAD, checked not assumed.

**§2 — the ordering metric now scores only where an ordering decision exists.** 20 pairs → **15
scoreable, 5 cross-stream EXCLUDED** (no product surface orders two streams by relevance: `results` is
round-robin, `grouped` is a stable filter over it). ⚠ A **stale comment** in `interleave.ts` claimed
`groupForPanel` still did a cross-stream score sort — deleted 9 Aug — and on its strength I nearly scored
all five against a surface that does not exist. Corrected in place.

**§3 — THE PECR REGRESSION DOES NOT REPRODUCE**: DPA 2018 **rank 2**, PECR **absent from the top 20**.
Both predictions confirmed. ⚠ UK GDPR is also absent — its own retrieval finding, since the amending SI
`uksi/2019/419` is at 16 while the instrument it amends never arrives.

⚠⚠ **AND THE HARNESS WOULD HAVE SAID THE OPPOSITE FROM NO DATA.** Its first run printed *"PECR still
leads — the ordering problem is REAL"* from **ZERO retrieved documents** (`DATABASE_URL` absent → prisma
threw → `fts-search` returned empty as designed → with nothing retrieved, neither principal instrument
outranks PECR). Reported, that would have been evidence for building a reranker manufactured from a
missing env var. Now refuses to conclude on an empty ranking and exits non-zero.

**BASELINE: preference accuracy 66.7% (6/9) — and the DENOMINATOR is the finding.** Only **4 of 15**
scoreable pairs compared two documents the system actually returned (**2 right, 2 wrong**); **11 turned on
whether a document was retrieved at all**, including 6 vacuous. **THE RERANKER IS NOT AUTHORISED:** the
regression motivating it does not reproduce, the genuine-ordering evidence is four pairs, and a reranker
cannot promote a document that never arrived. **The binding constraint is recall.** Recommended next:
raise the candidate count reaching the scorer (the vacuous six are the target) and re-measure on this
same harness.

⚠ **Not fudged:** "recall lost to scoping = 10 questions" is **carried, NOT re-measured** (needs a
routed-vs-unrouted run). **`caselaw` 36/36 → 22/36 is STILL OPEN** — neither harness measures router
stream selection over that 36-query set. The archetype-D exclusion does not bite (no D query in the
preference set).

**§4 — both unknowns settled, the eight repoints deliberately NOT done.** All eight legacy readers are
still live (re-audited). **The `IdeaLegislation` row → MIGRATE:** "Abolish the Supreme Court" → CRA 2005,
added by the idea's own creator — the Act that created the Supreme Court, so a considered legal link, not
a fixture; `corpus_acts` carries the gid. **The filters → `corpus_acts` needs NO new indexes** (250,808
rows, `leg_type` 100%, six indexes including a browse composite and a title trigram). ⚠ **But `title` is
populated on only 135,531 of 250,808 (54%) — exactly the legacy count** — so the +85% coverage is
precisely the untitled EU material (`celex` 90,260, `eur` 25,248). A type/year filter moved across as-is
returns up to 46% untitled rows. **Charlie's call before the repoint, not inside it.**

▼ Earlier:
2026-08-11 20:25 UTC — ▼ **LEX SPRINT 3-D (§19-D) IS BUILT: THE PROBLEM GATE, AND
FOUR "SEPARATE" BUGS THAT WERE ONE MISSING CONFIG LINE.** Executes `docs/SPRINT_3D_BRIEF.md` in
full. CHANGE_LOG (2026-08-11 20:25 UTC); full detail in **`docs/LEX_PLAYBOOK.md` §16**.
`tsc --noEmit` clean and **`next build` passes**.
⚠⚠ **NOT BROWSER-VERIFIED, AND THE BRIEF REQUIRES IT.** The Claude-in-Chrome extension reports no
connected browser (`list_connected_browsers` → `[]`) and the create flow is behind Clerk, so it
cannot be checked over plain HTTP either. **First thing next session: walk the UI.** Specifically
9a (Save & exit now saves, waits, then leaves, with a spinner), 9e (material/contributory reads as a
choice), 9f (option cards collapse to title + status + chevron), 9g (a cause named in chat appears on
the loop), 9h (the quiet retry link under the briefing), the new **"Work on this"** control on a
completed stage (Task 3), and that no "proposed by Lex" badge appears over empty boxes (2a).
**⚠ Task 1a REVERSES `docs/CLAUDE.md` §4** — the user now reads **"The problem"**, never
"Challenge". That old rule is what let a solution be entered as the diagnosis and accepted. The
stored key `challenge` is unchanged everywhere; this is a label change, not a migration.
**⚠ The single most useful finding: Tasks 2b and 8 were the same bug.** `generateCauseCandidates`,
`generatePolicyOptions` and `generateCoherenceReview` all ran gemini-2.5-flash **with thinking on**
and budgets of 1024/1400/2048 — CLAUDE.md §18's 29 Jul failure exactly. The database proved it:
**0 `PolicyOption` rows with `source='LEX'`** and two causes reading *"A factor examined in …"*
(the deterministic fallback, which only fires when the generator returns nothing). All three now set
`thinkingConfig: { thinkingBudget: 0 }`, and the retry is deliberately DIFFERENT from the first
attempt rather than the same call into the same wall.
**⚠ Legislation links: measured 3/40 opening before, 40/40 after.** `corpus_sections.sourceUrl`
pastes the hyphenated ref token onto the act URL (`/ukpga/1995/46/section-288AB`) where
legislation.gov.uk wants `/section/288AB`. The correct derivation already existed but sat behind
`sourceUrl ?? …`, and sourceUrl is non-null on 100% of 1.32M rows, so it was unreachable.
**The stored `sourceUrl` is still wrong at rest — an INGEST-side defect, for that thread.**
**⚠ "£57/year" was faithful arithmetic in a dishonest sentence** — the line was `low=57, high=NULL,
basis=NULL, priceYear=NULL` and the summary called it a range with a stated basis uprated to 2025
prices. `basis` was not even selected in the query. Fixed, plus a units selector so a user meaning
£57m can say so.
**Four new checks, each watched failing before being trusted:** `check:problem-gate`,
`check:never-claim`, `check:legislation-urls` (`--live` actually fetches), `check:cost-summary`
(which caught the unselected `basis` on its first run). All pre-existing checks still pass.
⚠ **This tree is shared with a concurrent session** (communities/*, `lib/email.ts`, `globals.css`,
`scripts/check-central-stage1.ts` are theirs, not this sprint's) — `commit-all.sh` stages only the
files listed in it.
▼ Earlier: 2026-08-11 20:24 UTC — ▼ **CENTRAL STAGE 2b: THE QUESTION LIBRARY IS BUILT.** Executes
the "Central Stage 2b" brief (11 Aug), built to the CD handoff in
`docs/design_handoff_central_question_library/`. `tsc --noEmit` and `next build` clean;
**189/189 checks against the live app DB** (`npm run check:central`, up from 140). Design written up
in `SCRUTINISE_CENTRAL_SPEC.md` §5–§6, decision log §12. **The thing to preserve: three vote-ish
mechanisms that must not collapse into one.** A QUESTION vote is up-only and **self-voting is
allowed** — it records *frequency*, not quality, so the asker voting for their own question is right,
not a bug. An ANSWER vote is up/down, mutually exclusive, self-voting refused; switching **withdraws**
rather than stacks, so the count moves by two. A FAVOURITE is **private** — never counted, ranked,
aggregated or visible to anyone including admins and the across-branches view; the check asserts that
*absence* (a second admin cannot see it, and no count-shaped key exists on the payload) rather than
trusting the UI not to render one. ⚠ **One deliberate correction to the design pack, per the brief:
favourites in packs are ADDITIVE, not substitutive** — the CD copy said "instead of", the brief
reverses it, and the pack now carries the community's top answer AND the member's. Silently swapping
in a private pick would make two members' packs differ with neither knowing why. **Flags need a
reason** (a flag without one is an unaccountable veto); `DO_NOT_USE` is excluded from packs,
`USE_WITH_CARE` stays packable and its reason travels into every output. **Edit suggestions have no
admin path** — the answer's author decides and a Community admin is refused (tested). All four pack
outputs carry "Community-rated answers, not official positions." from one exported constant, so no
format can quietly omit it. **Across-branches is participation only** — no per-member activity is
computed, favourites are not read at all — and the broadcast reports notification and email outcomes
separately, because a mail failure must not read as delivery. `AnswerVote.voteWeight` ships at 1.0 and
**is applied in the sort** with no weighting logic, so credibility weighting is a later switch rather
than a migration. **Schema:** `prisma/central_stage2b.sql`, eight tables, hand-written, types read off
production first, re-run once — and unlike Stage 1.2 and Stage 2, **nothing in it is invisible to
`schema.prisma`**; every uniqueness rule is a plain composite. **Visual:** the CD upgrade (12px cards,
one hairline border and no nested boxes, teal promoted to the live-state accent, tabular counts)
adopted across all of Central, as Central-scoped utilities rather than a global `--radius` change,
which would have restyled Ideas and Lex. **Board tab hidden for the pilot** — code untouched, one
`hidden` flag to restore. Stages renumbered: question library **2b**, Events **2c**, training
marketplace **2d**. **REMAINING GATE: Charlie's browser re-test.** ▼ Earlier:
2026-08-11 19:05 UTC — ▼ **INGEST V34: THE POLITICAL-EVIDENCE LAYER IS PUSHED
AND SEEDED — 14,274 ROWS PENDING — AND THE SMOKE TEST CAUGHT A BUG THAT WOULD HAVE FAILED
EVERY LORDS DIVISION.** Executes `BRIEF_INGEST_POLITICAL_SOURCES.md` §A/§B/§C in full.
CHANGE_LOG (2026-08-11 18:30 UTC); full detail in **`docs/V34_POLITICAL_SOURCES_REPORT.md`**.
`tsc` clean bar the documented pre-existing errors. Pushed `6759dea..deddb38` then `0ee4158`;
`Ingest` + `Ops` redeployed 18:36 UTC; seeds run only after that.
⚠ **THE DRAIN IS THE OPEN ITEM — IT IS RUNNING AND HEALTHY, NOT FINISHED.** Started 19:00 UTC,
**0 failures**, all three sources in parallel at ~108 divisions/min. Next session: confirm it
drained, then run the three `--verify` modes and score actual against prediction —
`v34-seed-division-votes.ts --verify`, `v34-seed-impact-assessments.ts --verify`,
`v34-seed-consultations.ts --verify`. Nothing else on the brief is outstanding.
⚠ **RE-BASELINE `impact-assessments.est_sections` AFTER THE DRAIN.** Predicted 8 sections per IA,
**measured 23.1** — out by 2.9×, so the corpus is **~27,300 sections not the ~9,400 seeded**. The
row is deliberately `est_is_confirmed=false`; fix it from the real count before that number starts
reading as confirmed. Costs revised on measured rates: **~335 MB R2, ~40,400 Class A writes,
~73 M tokens to embed** (§B is two-thirds of the embedding on its own). Consultations went the
other way — 307 words each, not ~1,200.
⚠ **NEW SOURCE-QUALITY FACT: the `ukia` feed advertises PDFs legislation.gov.uk does not serve.**
`ukia/2018/42` (uksi/2018/237, DWP) 404s deterministically — 3 attempts, same answer. It was
sitting as a `failed` queue row, i.e. invisible to every corpus-level gap report, which is the
silent absence the brief forbids. 404/410 now writes a classified `no-pdf` section carrying the
advertised URL and closes the row; only network faults and 5xx retry. 1 in the first 470. Two
scanned IAs are already stored as `pdf-only`, so the classified-gap path was otherwise working.
✅ **LORDS CONFIRMED LIVE — the teller fix holds in production.** 0 failures, and the decisive
measurement is the stored roll-call against the House's own count: **Lords 132 of 136 exact, 0 at
+2**; **Commons 704 at +2/+2, as it should be** (Commons tellers are excluded from the lobby
totals, Lords tellers are included). Had the duplication survived, every Lords division would have
failed outright rather than matching.
⚠ **NEW: PARLIAMENT'S OWN TALLY DISAGREES WITH ITS OWN ROLL-CALL ON 10 HISTORIC LORDS DIVISIONS**,
by ±1 in both directions — never ±2, which is what makes it clearly not the teller bug. Div 1068
reports `authoritativeNotContentCount: 227` against a `notContents` array of **226**; div 1092
reports 409 against **410**. I assumed a peer listed in both lobbies and checked instead of
asserting — **wrong: 0 duplicates, 0 cross-lobby members.** The source is internally inconsistent.
**This is the argument for keeping BOTH numbers**: `aye_count`/`no_count` is the official result to
quote, `division_votes` is the roll-call to count over. Store one and the disagreement is invisible,
and any "78% of their party voted for" silently inherits whichever is wrong.
**SEEDED AND RECONCILED:** `commons-divisions-votes` **2,361** ✓ exact · `lords-divisions-votes`
**3,284** ✓ exact · `impact-assessments` **1,181** ✓ exact · `consultations` **7,448** (+1 on the
measured 7,447 — published between measure and seed; that is the 2% tolerance working, not a
fault). Breakers clean on all three new sources.
⚠ **THE SMOKE TEST EARNED ITS KEEP: two write-path bugs survived a clean `tsc` and four passing
pilots.** (1) **The Lords lists every teller TWICE** — division 3698 gives 64+2+95+2 = 163 rows
for 159 actual peers; **Commons does it 0 times**. That duplicate `member_id` made Postgres
reject the entire roll-call, so **one duplicate would have failed all 3,284 Lords divisions**.
Deduped at the source; the member list now matches the API's authoritative counts exactly.
⚠ Commons tellers are EXCLUDED from the lobby totals, Lords tellers are INCLUDED — a real
difference between the Houses, and my own §A pilot's Lords figures were the double-counted ones.
(2) `division_date` interpolated to a bare `''::date` on a dateless division, which Postgres
rejects. Corrected prediction **~2.55M** `division_votes`.
⚠ **Ops declining to restart `Ingest` on its 18:45:32 cycle was CORRECT** — the heartbeat was 7
min stale against a 10-min threshold. If the queue looks stalled, read the threshold before
reaching for a manual `serviceInstanceRedeploy`.
⚠ **Stamp correction: commit `0ee4158` says `Date: 2026-08-11 18:47 UTC`; the real clock was
18:36.** Not amended — `Main` is shared with concurrent sessions and force-pushing risks their
work. Noted so history still lines up.
**§A — V28 BUILT THE DIVISION PIPELINE, NEVER RAN IT, AND IT WOULD HAVE INGESTED 25 OF 2,361.**
The Commons list endpoint hard-caps `take` at 25 (Lords honours any value) and V28 broke out of
the walk on a short page — a 99% shortfall that reads as success. Also recovered
`NoVoteRecorded`, which V28 discarded: absence, supplied by the API, present back to 2016-03-09.
⚠ Lords has NO equivalent, so absence there is `absence_known=false` — a known unknown, said in
words. ⚠ **The brief's premise that party is not in the division lists is wrong** — it is there,
and it is AT THE DATE (verified against member 172's two party changes), which takes the Members
API off the critical path. Both houses enumerated and RECONCILED: **5,645 divisions (Commons
2,361 from 2016-03-09; Lords 3,284 from 1999-11-24), predicted 2,556,897 `division_votes`.**
Three new ingest tables created and empty, incl. `stage_outcomes` where "passed without a
division" is a first-class finding rather than four different things wearing one null.
**§B — a bulk route nobody had looked for:** legislation.gov.uk `ukia`, **1,181 IAs**, and the
feed carries the IA→instrument join free. ⚠ Years NOT continuous (none 2008–2016, none
2024–2025), recorded as known unknowns. Extraction measured on 21 real IAs BEFORE committing
(20/21 good, mean 120k chars, max 542k over 233p) and sectioned, so it is not the V33
whole-document-in-one-row trap.
**§C — 7,447 consultations** (86 open + 1,059 closed + 6,302 outcomes); no bulk route, checked
first. ⚠ `document_type=consultation` returns 0 — filtering on it is a silent empty ingest.
Attachments classified so a departmental summary never reads as a quotation.
⚠ **Charlie's call, blocking nothing today: Public Whip's bulk vote matrices are ODbL
SHARE-ALIKE** — the first licence that would attach an obligation to our DERIVED database.
Flagged in `licence-map.ts`, not ingested; Parliament's own APIs already cover the range.
⚠ ONSPD is OGL v3.0 but **NI "BT" postcodes need a separate Land & Property Services licence**.
⚠ `stage_outcomes` is deliberately EMPTY: populating it needs a 30s/call Bills API stage crawl
and a fuzzy title match, and a fuzzy `without-division` row is the false certainty the table
exists to prevent. ⚠ The brief cites `docs/POSITION_GRAPH_DESIGN.md`, which is not in the repo —
storage decisions were made from the brief's text. **2D-1 below says the position graph is now
built; the two should be reconciled before the seeds drain.**
▼ Earlier:
2026-08-11 04:19 UTC — ▼ **S2C4: THE ANN RETRIEVES 70.4% OF WHAT IT HOLDS, SO §2 DID
NOT RUN. 2D-1: THE POSITION GRAPH IS BUILT AND NEEDED NO LLM.** CHANGE_LOG (2026-08-11 04:19 UTC).
Reports: `docs/SEARCH_S2C4_REPORT.md`, `docs/POSITION_GRAPH_2D1_REPORT.md` + `_TABLES.md`.



**BOTH SPRINTS ARE NOW COMPLETE.** Nothing is running, nothing is billing (verified against the
Hetzner API and the process table).

**⚠ WHAT IS OPEN, AND WHOSE IT IS:**
1. **S2C4 §2/§3 remain closed by §1's gate, and that is the brief's instruction, not an omission.** No
   ordering baseline and no reranker number exist. `caselaw` 36/36 → 22/36 stays open with them,
   because the brief puts its answer in §2's gold run.
2. **The nprobes decision is Charlie's, and the price list is now measured.** Against the 256 rung:
   **24 → 72.8%, 64 → 85.5%, 128 → 94.1%**, at 736 / 675 / 904 ms on a rented box. ⚠ **24 → 64 gains
   ~13pp and costs nothing measurable** (64 came out *faster* than 24 — noise, which is the point).
   `VECTOR_NPROBES` is a query-time env var: no rebuild, one Railway variable and a restart. The
   restart resets `/stats`, so the pre-change baseline of record is **p50 3,647 ms / p95 4,355 ms,
   read 02:31 UTC**. Run it as a measured A/B, not as a settings change.
3. **⚠ FOR CC-INGEST: all 15,806 oral-evidence sections have NO `sectionTitle` (0.0%).**
   `processCommitteesApi` builds the title from `committeeBusiness?.title` + `internalReference`, and
   oral evidence has neither — its inquiry is `committeeBusinesses` (an **array**). Both undefined →
   empty join → NULL. Those sections are findable but render with no heading. **Not fixed here on
   purpose**: `workers/process-row.ts` is in CC-Ingest's lane and being modified by that thread. Fix
   is a fallback to `committeeBusinesses[0]?.title` plus a backfill.
4. **Next for the graph, in the design's own order:** `spoke-in` needs a `person_id` sweep of the
   pwdata XML (present on 98.5% of speeches at source, never parsed) — bounded by file count, not by
   speech count, and scoped to the current Parliament first. Witness `personId` would do the same for
   the 45,860 person entities still resting on a name match at 0.7 confidence.

**SEARCH S2C4 — measured, 58 queries:** production probes **24 of 4,096 partitions (0.59%)** and
retrieves **70.4%** of the exhaustive result (section-level 70.6%). At 256 probes it is **96.3%**. The
brief's gate is 0.9 and its instruction on a miss is stop-and-report, so **no ordering baseline and no
reranker number is published** — §2 and §3 remain open, and `caselaw` 36/36 → 22/36 stays open with
them. ⚠ **This is NOT the KMeans mis-partitioning the ingest thread flagged**: 0.59% against a 1–5%
norm is simply under-probed. Controls: shuffle 0.0%, sensitivity 20.6% vs 70.4%, **live-service
agreement 100.0%** (the box measures what production serves), true exact KNN puts all-partitions at
97.5% of the true top-20 so **PQ costs ~2.5pp**, mirror guard 5/5. Nothing was retuned.

**GRAPH 2D-1 — COMPLETE, in Neon:** `graph_entity` / `graph_alias` / `graph_edge` / `graph_evidence` /
`graph_merge_log`. **86,816 entities** (40,518 orgs · 46,298 people), **164,135 edges** (162,630 gave-evidence-to +
1,505 declared-interest), **179,916 evidence rows**, **100% evidence coverage on both predicates**,
all 8 integrity checks passing, 30.6% on a stable key. Interests re-run covered 3,415 of 3,415 (100%). Committees sweep 48.3 min,
**0 gaps**, 99.8% of held items attached. **Zero LLM spend**: every identity was already structured at
source and merely absent from our columns, so this was a metadata sweep. ⚠ **`spoke-in` is NOT built**
— Hansard speakers are name strings here and `person_id` (on 98.5% of speeches at source) was never
parsed; name-matching 8.8M speeches would merge distinct people. ⚠ **99.6% of person entities rest on
a name match at 0.7 confidence — treat them as name clusters, not people.** ⚠ Two Prisma models
groups were added to `schema.prisma` purely so `migrate diff` cannot propose dropping the new tables;
**no migration was generated and none should be.**

▼ Earlier: 2026-08-11 01:02 UTC — ▼ **INGEST V33 §2 IS CLOSED: THE VECTOR INDEX IS CURRENT AND
SERVING IT. SEARCH'S GATE 2 IS OPEN.** CHANGE_LOG (2026-08-11 01:02 UTC).
**The embed finished 2026-08-10 15:33 UTC** — 129/129 shards, **768,085 vectors, 0 misses,
$36.51** against $35.73 predicted (+2.2%), 25.0h against a predicted 15–30h.
⚠ **Stage 2C-3 records that finish as "16:33 UTC"; the checkpoint says `15:33:23.243Z`. 16:33 is
BST.** Root CLAUDE.md bans exactly this mixup — corrected here so one event does not circulate
with two times.
**Then the three steps that actually deliver it:** 89,377 orphan chunks exported (611 MB, verified)
and deleted — `corpus_vec` and `corpus_chunks` both reconcile at **22,518,608**; the ANN rebuilt on
Hetzner (**29.5 min, €0.145, peak 5.6 GB**) to **`indexed=22,518,608 unindexed=0`**, from 768,085 /
3.41% brute-forced per query; and **`vector-serve` restarted and PROVEN** (`started_at` 07 Aug
12:59 → 11 Aug 00:44). ⚠ **It had been up 3.4 days on a 7 August snapshot containing NONE of the
new vectors — the restart is the moment this work reached production.**
**ACCEPTANCE: 18,166,684 of 18,166,911 compiled sections have a vector. The 227 that do not all
have `wordCount = 0`** — nothing to embed, matching the chunk phase's 227 body misses exactly.
Latency moved 5,936→3,529ms p50 and 21,383→3,750ms p95, ⚠ **indicative only** — the baseline is
187 samples of real concurrent production traffic, the after is 11 sequential synthetic queries.
The clean fact is `unindexed 0`.
⚠ **THREE CHECKS THAT COULD NOT FAIL, ALL NOW FIXED — this is the part worth reading.**
(1) `delete-orphans --apply` was guarded by `fs.existsSync('export.json')` alone; that marker is not
stamped per run, and a **6 Aug file for 6,464 unrelated rows** was on disk while this run's
89,377-row export was four parts from finishing. It would have authorised the irreversible delete.
`assertSafetyExport()` now checks stamp + row count + object presence; **5/5 negative control**.
(2) `vector-reindex`'s verify was a pure-logic unit test with no Lance — it would have passed on the
attempt that aborted 84 seconds in. `search/verify-vector-index.ts` replaces it and was **proven
able to fail before being trusted**. (3) My own negative control reported **0/5 against a guard that
was refusing correctly** — `execFileSync` cannot run a Windows `.cmd` without `shell: true`.
⚠ **Two failed rebuild attempts (€0.007) taught three things now in `jobs.ts`:** all dedicated
placements were refused (the dedicated-core quota, second time it has blocked a vector rebuild);
`build-vector-index.ts` asserts the checkpoint shard size BEFORE branching on `--index-only`, so
`VECTOR_SHARD_SIZE=12000` must be pinned; and **the runner executes the GITHUB CLONE, not the local
tree** — a script a job names must be pushed first.
⚠ **A delete costs per PREDICATE, not per row.** No scalar index on `chunkId`, so each
`delete(… IN (…))` scans all 22.5M rows — ~22.5s per batch whatever it holds. 400 → 17.8 rows/s
(138 min); 2,000 → 100 rows/s (25 min). Now `VEC_HYGIENE_ID_CHUNK`-tunable. `export` has the same
constant and the same easy win, untouched.
⚠ **`expectedPeakGb` for `vector-reindex`: 32 (inherited) → 5.6 (MEASURED).** The 64 GB belonged to
compaction, which this job skips. Not dropped further on one run.
⚠ **Lead for the search thread, NOT a diagnosis:** the ANN build logged repeated `KMeans: more than
10% of clusters are empty` / `too small to have a meaningful index (1529 < 4096)`. July's
unexplained recall regression (71.2%→70.5%) may be unrelated, but the 4,096-partition setting has
never been re-tuned against a corpus that has grown. ▼ Earlier:
2026-08-10 20:42 UTC — ▼ **SEARCH STAGE 2C-3: BILLS ARE FINDABLE AND LEGIBLE, AND
THE LAST 0.92% IS DISPOSED OF BY NAME.** Executes `BRIEF_SEARCH_S2C3.md` §1/§2/§3 in full;
**§4 STILL NOT RUN — read the gate note below, it has changed.** CHANGE_LOG (2026-08-10 20:42 UTC).
`tsc` + `next build` clean; **`check:corpus-types` 69/69 → 111/111**, mutation-tested (4 planted
defects, 4 caught); `check:annotation-titles` 15/15, `check:stream-coverage` 3/3 live,
`check:score-scope` 36/36, `check:flags` 50/50, `check:llm-guards` 9/9.
⚠⚠ **SUPERSEDED — GATE 2 IS OPEN. Do not act on the gate paragraph below; the top section of this
file is authoritative and INGEST V33 §2 (11 Aug 01:02 UTC) did both missing steps.** The ANN index
was rebuilt to `unindexed=0` and `vector-serve` restarted (`started_at` 11 Aug 00:44, confirmed
live). **`vector-reindex` is DONE — do not re-run it.** ⚠ The finish time below is also wrong and
the error is mine: the checkpoint says **15:33 UTC**; I wrote 16:33, which is that instant in BST
labelled UTC. Corrected totals of record are ingest's: 25.0h elapsed, and `corpus_vec` reconciles
at **22,518,608** after orphan hygiene, not the 22,607,985 below. Kept unedited beneath this marker
because the CHANGE_LOG is an audit trail, not a draft.
⚠⚠ **THE EMBED FINISHED — AND §4 IS STILL BLOCKED. THIS IS THE FIRST THING TO ACT ON.**
`v33-vec-catchup.ts --embed` **completed 2026-08-10 16:33 UTC: 129/129 shards, 768,085 vectors, 0
misses, $36.51**, `corpus_vec` 22,607,985 rows. **But Gate 2 protects "do not measure across an
index change", and the change is HALF DONE:** (1) the **ANN index has not been rebuilt** (the
embed's own closing line, INGEST_PLAYBOOK §20 — without it every query brute-force scans the new
fragments forever); (2) **`vector-serve` has been up since 2026-08-07T12:59:32Z** (`/stats`
`started_at`) and calls `openTable()` once at boot, so it is serving a **three-day-old snapshot
containing NONE of the 768,085 new vectors.** A benchmark now would measure the OLD index while
looking perfectly stable — worse than measuring across a running embed, because nothing would look
wrong. **UNBLOCK = `tsx scripts/ops/heavy-job/run.ts run vector-reindex` (already registered, 32 GB
class, never Railway) THEN restart `vector-serve`.** Not run here: production index surgery on
rented infrastructure, and V33 is the ingest thread's lane.
**REACHABLE 99.08% → 99.12%.** Outside retrieval is now **0.88%, none of it unexplained**: 110,266
deferred-to-graph, 48,883 deferred pending the reranker, 3,448 excluded-by-design. keyword-only
12 → **9 collections**.
**§1 — `bills-api` (6,574) is in the LEGISLATION stream** via `extraCorpora` — a Bill answers "what
does the law say about X" better than anything else when one already exists. ⚠ It STAYS in
`NON_DEBATE_PARLIAMENTARY` (that excludes it from *debates*, still right, and belt-and-braces since
debates filters `types:['DEBATE']`).
⚠⚠ **THE COLLECTION WAS UNUSABLE AS STORED and the brief's own stage requirement could not be met
without fixing ingest.** Titles were `Bill 2518 — publication 17`; **`itemDate` was null on all
6,574 rows**; stage absent entirely. All of it was on the wire and none kept (`listBillsPage` read
`shortTitle` and dropped it; `processBills` wrote the ordinal). **The corpus is fine — the bodies
are the real bill PDFs — only the identifying metadata was lost.** New `v34-bills-metadata.ts`
sweeps 4,035 bills from the API and joins on `parentDocId`: **predicted 6,574 rows/0 unmatched,
actual 6,574/0**, and 0 still ordinal, 0 still undated. Dry-run default, idempotent, Neon confirmed
before writing.
⚠ **The FTS index still carries the OLD titles** (`fts-search.ts` reads the title off the FTS hit;
the dense path hydrates from Neon) — so new `dbTitleSupersedesIndex()` names the collections whose
DB title wins. **An explicit list, never "always prefer the DB"**, which would break the S2C2
byte-identity guarantee. Remove the entry after the next full FTS rebuild.
⚠⚠ **A DEFECT MEASUREMENT FOUND AND REASONING MISSED: only 2/15 Bill titles contained the word
"Bill"** — after Royal Assent the API's `shortTitle` becomes the ACT's name, so a bill publication
PDF rendered as `Leasehold Reform (Ground Rent) Act 2022 — became an Act`, typed BILL. The brief's
requirement failing in the direction nobody was watching. A `Bill papers, ` marker is added when the
name lacks the word; **15/15 after the fix**, asserted for every status shape.
**Measured**: gold **16/46 → 16/46, no key lost**; contamination **0/120 (0.0%)**, 0 displaced;
latency **p50 +23ms, p95 −149ms** (noise). Bills appear on 1 of 16 gold questions (B3, 9/20) — a
Bill-shaped question, i.e. intended. ⚠ Gold figures use the adapter haystack, **not comparable with
the gold reports**.
**§2 — new third verdict `deferred-to-graph`** for `early-day-motions` (60,737) + `petitions`
(49,529). ⚠ **DOCUMENTATION, NOT ENFORCEMENT** — unlike `EXCLUDED_BY_DESIGN` it changes nothing at
runtime, so each `note` states what retrieval still does with them ("still returned by the
unrouted/fail-open path"). ⚠ The brief cites `POSITION_GRAPH_DESIGN.md §3`, which was not in the
tree at the time — **it has since arrived**, §3 is "Nodes and edges", so the citation was right and
the file simply had not reached here. ⚠ **But its §3 edge list does not yet name an EDM-derived
edge** (`declared-interest`, `voted`, `gave-evidence-to`, …), so the destination is real while the
specific edge these two collections are held for is unwritten. **Seam to resolve at Stage 2D.**
**§3 — the remaining nine deferred WITH A DATE**, in a new matrix section computed from the live
table: `cma-cases` 22,898, `ofgem` 17,161, `ofcom` 4,169, `uk-treaties` 3,264, `independent-reviews`
667, `tax-treaties-dta` 324, `cps-guidance` 270, `inquiry-evidence` 90, `lgsco` 40 = **48,883**.
⚠ **Reported not fixed:** Bill URLs are API *download* endpoints; `bills.parliament.uk/bills/{id}`
would be the human page but **403s every probe from here** (likely a bot block, not a wrong URL —
not changed on an unverified premise). `scripts/tsconfig.json` has **2 pre-existing type errors**,
confirmed present at HEAD with this sprint stashed; `scrutinise-web` is clean.
▼ Earlier:
2026-08-10 09:09 UTC — ▼ **SEARCH STAGE 2C-2: THE CORPUS REACHES 99.08%, AND THE
THREE DECISIONS 2C SURFACED ARE BUILT.** Executes `BRIEF_SEARCH_S2C2.md` §1/§2/§3 in full;
**§4 NOT RUN — Gate 2 STILL closed**, §5 carried. CHANGE_LOG (2026-08-10 09:09 UTC). `tsc` +
`next build` clean; **`check:corpus-types` 69/69** (was 30/30), new **`check:annotation-titles`
15/15**, both mutation-tested against a broken tree (4 planted defects, 4 caught);
`check:stream-coverage` 3/3 live, `check:score-scope` 36/36, `check:flags` 50/50,
`check:llm-guards` 9/9.
⚠ **GATE 2 IS STILL THE FIRST THING TO CHECK NEXT SESSION.** No completion marker; checked at the
machine too — **`v33-vec-catchup.ts --embed` still running at 09:09 UTC, PID 77936, 17h 45m
elapsed** (started 2026-08-09 15:23:39 UTC). Ingest's spread was 15–30h, so it is inside its window,
not stalled. **Ingest thread: stamp the completion here and §4 can run.**
**REACHABLE 93.40% → 99.08%** (+1,044,188 sections; 56 → 57 collections; UNREACHABLE stays 0).
**Everything still outside is 0.92% — 169,171 sections:** `early-day-motions` 60,737, `petitions`
49,529, `cma-cases` 22,898, `ofgem` 17,161, `bills-api` 6,574, `ofcom` 4,169, `members-interests`
3,448 *(by design)*, `uk-treaties` 3,264, `independent-reviews` 667, `tax-treaties-dta` 324,
`cps-guidance` 270, `inquiry-evidence` 90, `lgsco` 40.
**§1 — `EXPLANATORY_NOTE` is the tenth display type.** Panel label **"What the law was for"**, not
"Explanatory notes": the heading must work for a reader with no legal training, and the term of art
does not tell them whether they are reading the law or something about it. Badge stays "Explanatory
note". ⚠ **The `isLeg` exclusion is now ASSERTED in both adapters** (it would rewrite an
annotation's title to the Act's and its URL to a provision link — commentary rendered as enacted
text). ⚠ **Trap found and fixed as a class: `TYPE_ORDER` is a plain array and `BackgroundPanel`
renders `TYPE_ORDER.map(...)`, so a type missing from it renders NOWHERE** and tsc cannot see it;
the check now parses the live union and asserts all three display files cover it.
⚠ **The single-stream panel mix does not move, and that number is misleading** — the legislation
stream has no real GUIDANCE in it, so nothing could be crowded out. In the ROUTED panel
(legislation + guidance) it is **strictly additive, +3 slots on all five measured queries**:
annotations 0/2/2/0/0 → 3 and real regulator guidance 3/1/1/3/3 → 3. Both directions of crowding
were live.
**New draft gold EN1/EN2 pins the WHY/WHAT behaviour** (EN1 2/2 keys, 20/20 annotations at ranks
1–20; EN2 1/2 keys, 0/20 annotations). ⚠ EN2's first key asserted "no annotation appears", which
this harness cannot express — it asks "did any top-20 hit match", so a negative pattern passes on
any one non-matching hit. Rewritten to name instruments **verified present in the corpus first**.
**§2 — annotations name the Act.** `Explanatory Notes: ukpga/2022/30 — Article 50 (30)` →
**`Explanatory Notes — Building Safety Act 2022`**. **94.90% resolve** (notes 99.95%, memoranda
91.43%; remainder = 2,350 `uksi` gids + 9 `ukpga` with no `corpus_acts` title, which keep their old
string). ⚠ Done once in `annotation-title.ts` and called from **both** adapters — the dense path is
LIVE on legislation, so fixing only FTS would make a title depend on which retriever found the row.
⚠ **Byte-identity proven over 356 non-annotation hits, 0 drifted — and the "before" was RECOMPUTED
from primary data, not diffed against a second code path** (two paths can be wrong together). The
same comparison reports 244/244 annotations as changed, which is what stops it being vacuous.
**§3 — `scottish-parliament-or` (1,044,188 sections) is in the debates stream, with its numbers.**
Gold **14/20 keys → 14/20, no answer key lost**; contamination **3/120 top-20 slots (2.5%)**, all on
one query (universal credit, which Holyrood genuinely debates), 0/20 on the other five; latency
**p50 −26ms, p95 −146ms — no measurable cost**, the extra leg runs in parallel. ⚠ Those gold figures
use the adapter's SNIPPET haystack, not the body — **not comparable with the gold reports, only with
each other**. **No degradation → the devolution-gate fallback is not triggered**, and stays
available.
⚠ **Jurisdiction is visible: 14/14 sampled Scottish rows read "Scottish Parliament: …"** in the
title; 99.91% carry that prefix in the data, and new `corpusDisplayName()` closes the 924 untitled
rows that would have rendered as the raw corpus key.
**Recall a ROUTED query cannot reach went 12 → 10 questions** (CM2, CM3 now routable) — that is the
"recall lost to scoping" figure §4 must report separately from ordering. **The ordering baseline
still excludes 4 questions (D2, D3, D4, D5).**
▼ Earlier:
2026-08-10 00:16 UTC — ▼ **SEARCH STAGE 2C: NO COLLECTION IS UNREACHABLE BY
ACCIDENT ANY MORE, AND THE ONE THAT IS UNREACHABLE ON PURPOSE NOW SAYS SO.** Executes
`BRIEF_SEARCH_S2C.md` §0 and §1 in full; **§2 NOT RUN — Gate 2 closed**, §3 carried.
CHANGE_LOG (2026-08-10 00:16 UTC). `tsc` + `next build` clean; new **`check:corpus-types` 30/30,
mutation-tested against a deliberately broken tree (5 failures, the right 5)**;
`check:score-scope` 36/36, `check:stream-coverage` **3/3 live**, `check:flags` 50/50,
`check:llm-guards` 9/9.
⚠ **GATE 2 IS STILL CLOSED AND THIS IS THE FIRST THING TO CHECK NEXT SESSION.** No `corpus_vec`
delta-embed completion marker exists; checked directly too — **`v33-vec-catchup.ts --embed
--max-cost 45` was still running at 00:16 UTC** (PID 77936, started 2026-08-09 15:23:39 UTC).
**Ingest thread: stamp the completion here and §2 (the benchmark + ordering baseline) can run.**
**§0 — `RAILWAY_ROLE.md` WAS WRONG AND IS CORRECTED.** Charlie read Vercel: `VECTOR_SEARCH_URL`
**is set**, `LEX_VECTOR_STREAMS=legislation`, `LEX_SEARCH_VECTOR` absent. **So the S2B
cross-stream score defect was LIVE, not latent** — the conservative reading was right on the facts.
The old line was an inference in the grammar of a measurement. New **`docs/CLAUDE.md` §19**: a fact
that cannot be read from here must be asked for, and where inferred must be labelled as one; the
`VERCEL_TOKEN` trap (200 on `/v2/user`, then 403 `"saml": true` on every project scope) is named so
nobody rotates a working token again.
**§1 — UNREACHABLE 4 → 0. Reachable 93.14% → 93.40% (+48,267 sections), 53 → 56 collections.**
`explanatory-notes` (18,801) + `explanatory-memoranda` (27,428) → **GUIDANCE**, reachable from the
**legislation** stream; `erskine-may` (2,038) → GUIDANCE, into **guidance**; `members-interests`
(3,448) → new verdict **`excluded-by-design`**, the decision recorded in a new `EXCLUDED_BY_DESIGN`
registry with its reason, checked ahead of everything so a re-tier cannot undo it.
⚠ **GUIDANCE for the explanatory corpora is an INTERIM and is recorded as one** — a tenth type
`EXPLANATORY_NOTE` is **proposed for Charlie, not added**. They are deliberately not typed as
legislation: `isLeg` would rewrite the title to the Act's and the URL to a provision link,
presenting the annotation as enacted text.
⚠ **Typing `erskine-may` was NOT sufficient** — it carries tier `other` in the BUILT index and the
prefilter matches the index, not `tierFor()`. New `StreamScope.extraCorpora` = a second,
corpus-only retrieval leg. It re-checks the corpus off the id client-side (the adapters *degrade*
on an unhonoured `corpora`, and this leg has no tier and no `types` backstop), and legs are
**merged before fusion, never after** — fusing per-leg then merging rebuilds the S2B RRF-vs-BM25
landmine one function lower.
**Measured live, not built inert**: 181 explanatory hits over 5 legislation queries, **0 untitled,
0 without a URL**; they rank 1–9 on "why was this Act introduced" and sit below the first six
operative-law hits on "speed limit enforcement". Erskine May takes 57/60 of the guidance stream on
a procedural query, 12/60 **all at rank 48+** on a policy query, 2/60 on an FCA query, **0** on an
unrelated control — BM25 tails it out on its own, no cap needed.
⚠ **`scottish-parliament-or` (1,044,188 sections = 86% of the whole remaining 6.60% gap) is the
same shape as erskine-may and was NOT wired in.** It is typed DEBATE, so `extraCorpora` would put
it in the **debates** stream, and changing what a million sections do to that stream is a
measurement and a decision, not a line in a list. **Charlie's call; the mechanism now exists.**
⚠ **This changes §2's instruction**: gold questions satisfied in part by an undeliverable
collection went **4 → 0**, so the ordering baseline now excludes **4** questions (D2, D3, D4, D5 —
archetype D, "citation graph", a stream the router does not have), **not 6**.
▼ Earlier:
2026-08-09 21:55 UTC — ▼ **SEARCH STAGE 2B: THE SCORE LANDMINE IS DEFUSED, AND THE
CORPUS NOW HAS AN INSTRUMENT SAYING WHAT ANY QUERY CAN REACH.** Executes `BRIEF_SEARCH_S2B.md`
§0 and §1 in full; §2 carried by design. CHANGE_LOG (2026-08-09 21:55 UTC). `tsc` + `next build`
clean; new **`check:score-scope` 36/36 with every assertion seen to FAIL first**,
`check:stream-coverage` 3/3, `check:lex-general` 30/30, `check:flags` 50/50, `check:llm-guards`
9/9. New: `docs/CORPUS_REACHABILITY.md` + `docs/corpus_reachability.json`.
⚠ **§0's "report before changing anything" DID NOT COME OUT CLEAN, and the answer is Charlie's to
finish.** The Vercel token authenticates (`/v2/user` 200) and then **403s on the project scope with
`"saml": true`** — env, deployments and runtime logs are all unreadable from here. `fts-serve` has
**served 0 since its 15:08 UTC restart**, so there is no live traffic to observe passively, and
every production search surface needs auth. **The record's own resolved reading (CHANGE_LOG 8 Aug
22:09, from `capabilityFlags()`): `flags: expansion router` — so `LEX_SEARCH_VECTOR` is OFF — but
`vector-serve` served moved +1 on every one of three routed production queries whatever the stream
count. A +1 that does not scale with streams is per-stream fusion on exactly ONE stream, which
needs `VECTOR_SEARCH_URL` SET and `LEX_VECTOR_STREAMS` SET.** ⚠ **That contradicts
`docs/RAILWAY_ROLE.md`, written today** ("`VECTOR_SEARCH_URL` is unset in Vercel"). The 8 Aug claim
is a measurement (a counter moved); the 9 Aug one is an inference from `vector-search.ts:111`.
`vector-serve` reads **served 185** today against the 182 recorded on 8 Aug. **I took the
conservative reading — LIVE defect, pilot blocker — which produces the same fix either way.**
**One command settles it and nothing else can: `vercel env ls` for `LEX_VECTOR_STREAMS`,
`LEX_SEARCH_VECTOR`, `VECTOR_SEARCH_URL`. If set, `RAILWAY_ROLE.md` needs correcting.**
**§0 THE FIX IS THE DELETION THE BRIEF ASKED FOR.** `groupForPanel` no longer sorts by score at
all; nothing replaces it, because the routed list already arrives stream-balanced and the unrouted
one already arrives in BM25 rank order. **For every single-scorer input the output is unchanged**,
asserted not argued. Output is no longer TYPE-BLOCKED either — blocks made the 20-cap clip whole
types off the tail — and nothing wanted blocks (`groupLandscape` re-partitions, `facts.ts`
re-buckets). Measured on both functions, same input, with the deleted code kept runnable as
`groupForPanelPreFix`: today's shape (1 fused + 4 unfused) **first fused hit at position 13 and 0
in the top 10 → position 1**; and with the unfused side spanning 7 display types, **0 of 6 fused
hits reach the panel → 3**. That second one is the brief's "clipped out entirely" as a number: it
needs seven unfused display types, which is **one new stream away**, and Stage 2C walks through it.
**Every `SearchResult` now carries `scorer: 'bm25'|'vector'|'rrf'|'stub'`, REQUIRED — so tsc is the
enforcement** for any new retrieval path. `lib/lex/score-scope.ts` owns `assertSingleScorer`
(throws) and the one sanctioned `sortByScore`; `check:score-scope` asserts no other file sorts by
`.score` **and proves its detector matches the exact deleted line**. ⚠ Not a boolean `fused`: a
cosine 0.83 and a BM25 12.4 are as incomparable as either is to an RRF 0.011.
**§1 — 17,121,546 of 18,383,172 sections (93.1%) are in a collection some stream can select. 70
collections: 53 reachable, 13 keyword-only, 4 UNREACHABLE, 0 tier-only.**
⚠ **Tier is READ OUT OF THE LIVE INDEX, never computed from `tierFor()`** — it is baked in at build
time and the router filters on the index. Computing it would have called `scottish-parliament-or`
reachable; it sits under `other` where no stream can see it — **1,044,188 sections, 83% of the
entire gap on its own.** ⚠ **4 collections are UNREACHABLE BY EVERY PATH because `corpusToType`
returns null** — indexed, retrieved, then dropped by the adapter: `explanatory-notes` (18,801),
`explanatory-memoranda` (27,428), `erskine-may`, `members-interests`. **Those two explanatory
corpora are the ones V33 took to 100% embeddable six hours earlier — 24,987 vectors built for
content no caller can receive.** ⚠ `tier-only` is structurally empty because the only scoped tier
is `legislation` and that stream owns the whole tier; a second tier-scoped caller changes it.
Named suspects: treaties `uk-treaties`/`tax-treaties-dta` **keyword-only** (excluded from BOTH
parliamentary streams by `NON_DEBATE_PARLIAMENTARY`), `uk-treaties-fcdo`/`parliament-treaties`
reachable; written answers (1.44M) + ministerial statements reachable; HMRC/FCA/quangos/codes/NAO
reachable, `independent-reviews` + `inquiry-evidence` keyword-only; **impact assessments and
consultations DO NOT EXIST** (no collection, no `corpus_targets` row); ⚠ **the statistics catalogue
is not in the searchable corpus at all** — separate DB (`STATS_DATABASE_URL`), so no stream change
could reach it.
**§1.2 — 11 of 43 gold questions are satisfied ENTIRELY from outside their declared stream**
(B2–B5, C1–C4 among them); **4 declare a stream the router does not have** (archetype D, "citation
graph") — kept separate because it is a missing capability, not a drafting error; **4 are satisfied
in part by an UNREACHABLE collection** (D2/D3/E3/F3, all `explanatory-notes`), so to that extent the
recall numbers measure the index rather than the product; **12 in part by a keyword-only
collection — meaning turning routing ON costs recall on those questions.**
⚠ **THE COMMITTEES DEFECT NO LONGER REPRODUCES.** GOLD_TEST_09 (6 Aug) had CM1 at 100% with **0/20
committee documents** against a `committees-reports` of 24,876 rows; it holds **323,922** now.
Re-measured: **CM1 11/20, CM2 8/20, CM3 4/20, CM4 20/20**, all four now satisfied in part from a
committee collection. One pass, one retrieval config (deterministic BM25) — it does not say the
stream is good, and does not touch GOLD_TEST_09's finding that committee CONCLUSIONS are not
ingested.
**Refactor this needed: `lib/lex/stream-scopes.ts`** now owns the stream scopes (and
`RouterStreamName`), so the matrix is computed from the table the router dispatches on rather than
a copy — a copy is how the matrix keeps saying "reachable" a month after someone narrows a filter.
▼ Earlier:
2026-08-09 15:05 UTC — ▼ **INGEST V33: THE LEGISLATION TIER STOPPED HIDING WHOLE
DOCUMENTS IN SINGLE ROWS.** Executes `BRIEF_CC_V33_ingest_wrapup.md` §1/§3/§4/§5 in full, §2 to a
running job with a hard ceiling. CHANGE_LOG (2026-08-09 15:05 UTC). `tsc` clean; new
**`v33-check-legislation-sections` 42/42**. New: `docs/RAILWAY_ROLE.md`.
**§1 — 7,769 rows that each held an ENTIRE document became 193,667 sections. The legislation tier
went 79.2% → 99.6% of its words embeddable**, measured with the same script that produced the 79.2%
baseline: `eur-lex` 57.3%→**100%** (6,630 truncated→0), `explanatory-notes` 14.3%→**100%**,
`explanatory-memoranda` 65.8%→**100%**; 8,167 truncated sections → **381**; 82.1M words never
embedded → **1.58M**. The worst case was `eur-lex:32007B0143:1` — 760,509 words in one row, 0.5%
embedded — and no chunk cap could ever have fixed it. Predicted 8,850 docs/200,786 sections; actual
**7,769/193,667** (−12.2%/−3.5%). Words in/out **99.99%**; 0 lossy splits, 0 un-retired blobs,
0 orphans. ⚠ **The hard part was telling an article HEADING from an article REFERENCE**: eur-lex
bodies are ONE line (4.25M chars, no whitespace structure) and `32001L0108` has 57 "Article N" of
which only 12 open a provision — the rule was tuned against all 57 and gets all 57 right.
⚠ **385 UK-CLML rows were left out ON PURPOSE and are exactly the 381 that remain truncated**: their
ids carry a real provision reference that `gateway-legacy.ts` turns into "s.21" and a
legislation.gov.uk deep link, so a `-0001` suffix would make the citation link to a provision that
does not exist. Fixing it is two lines in `gateway-legacy.ts` — under `scrutinise-web/`, outside this
sprint's commit scope. `--include-uk` exists for the follow-on.
**FTS chain run in full because `fts-serve` is LIVE**: 7,786 orphans exported (653.5 MB) and deleted
→ catch-up appended **195,968** → `corpus_fts` **18,166,926** → Hetzner merge **552s, unindexed 0,
query 5,573ms→1,508ms, €0.053, 19.3 GB peak** → **restart PROVEN** (`started_at` 02:01:30→13:41:45).
Verified live: `"UCITS management company transferable securities"` now returns
`eur-lex:32009L0065:1-0011 — CELEX 32009L0065 — Article 2`.
⚠ **§2 IS RUNNING AND IS THE ONE THING TO CHECK FIRST NEXT SESSION.** Delta measured by full scan:
**544,198 unvectored sections (3.00%)**, priced at **$35.73** (band $32.15–$39.30, CPW measured on 300
real bodies). Phase 1 done: **768,085 chunks** (+3.7% on prediction), 227 body misses. Phase 2
embedding under **`--max-cost 45`**, 129 shards, resumable from `_search/v33_vec_catchup.checkpoint.json`
— **re-run `v33-vec-catchup.ts --embed --max-cost 45` with `VECTOR_SHARD_SIZE=6000 VECTOR_MAX_INFLIGHT=1`
to continue; the checkpoint refuses a different shard size.** ⚠ **`build-vector-index.ts` must NOT be
re-planned**: it records DONE SHARD INDICES over the whole sorted chunkId list and its header assumes
`corpus_chunks` is immutable — appending 768,085 chunks moves every boundary, and a `--reset` re-embeds
all 21.8M chunks. That is why `v33-vec-catchup.ts` exists. ⚠ Tier PROBED, not assumed: **Tier 2** (4M
accepted, 8M rejected), and the delta averages **~633 tokens/chunk, double the 310 the July build
assumed**, so 40,000×8 would have been 99M enqueued and rejected outright.
**HOW TO SEE ITS REAL STATE** — do not infer it from the log, which is silent between 30s polls, or
from the process, which survives a harness kill. Ask Google:
`ai.batches.list()` → the shard's job is `JOB_STATE_RUNNING` / `SUCCEEDED` / `FAILED`. At 15:12 UTC
the shard-0 job (created 14:33:46 UTC) was **RUNNING** — queued, not stuck.
⚠ **Two tier-probe jobs report `JOB_STATE_SUCCEEDED` despite being cancelled** (created 14:21:21 and
14:21:55). `gemini-tier-probe.ts` claims cancelling "keeps spend ≈ $0"; these completed anyway, so at
~300k and ~4M tokens that is more like **~$0.32, not ~$0**. Do not assume the probe is free.
⚠ **NOTHING IS WATCHING THIS RUN.** `ops.ts` fires `embed-observer.ts` every 15 minutes, but it
watches `_search/corpus_vec.checkpoint.json` (`VEC_CHECKPOINT_KEY`) — the MAIN build's checkpoint,
which the catch-up deliberately does not touch. So a stalled catch-up sends no email. Check the
checkpoint's `updatedAt` by hand, or teach the observer a second key.
⚠ **THROUGHPUT, observed rather than promised:** the Batch API polls every 30s with a 24h SLA
ceiling, and the first 6,000-chunk shard had not returned after 45 minutes. 129 sequential shards at
that rate is not a session's work. If it needs to go faster the lever is MORE, SMALLER, CONCURRENT
jobs within the same 5M enqueued-token budget (e.g. `VECTOR_SHARD_SIZE=2000 VECTOR_MAX_INFLIGHT=3`
≈ 3.8M) — batch latency looks queue-dominated, not size-dominated. Changing it means re-planning the
checkpoint, which the script refuses to do silently.
**STILL TO DO for §2:** `vec-hygiene delete-orphans` (**89,377 orphan chunks**) then the new heavy job
**`vector-reindex`**. ⚠ Re-running the existing `vector-index` job would do **NOTHING** — both its
scripts are checkpointed `phase:"done"`, so it prints "already done", creates nothing, destroys the box
and reports success; `--index-only` is the flag that enters the ANN block. **No vector flag was
touched — the flip is still the search thread's.**
**§3 — Neon 96.2% → 90.2%** (1.053 GB reclaimed vs 1.059 predicted). ⚠ The alert was WORSE than the
7 Aug audit said: 91.0% then, **95.8% before any V33 work**. ⚠ **`idx_corpus_sections_parent` was 6
scans in the audit and is 26,957 now** — graded "review/medium risk" there, which reads as droppable;
**KEPT**, and re-verifying is the only reason a live index survived. Dropped `corpus_sections_fts`,
`_format_idx`, `_status_idx`; `_notes_idx` replaced by a partial, **0.170 GB → 0.006 GB**. Column drops
deliberately NOT taken (they need a rewrite wanting a second copy of a 12.5 GB table — at 96% that is
the move most likely to hit the ceiling while relieving it).
⚠ **§3b legacy DROP is BLOCKED and the previous audit's reader list was short by two**:
`app/api/ideas/[id]/legislation-search/route.ts:75` (the gateway-failure FALLBACK) and
`app/legislation/[itemId]/page.tsx` are live readers nobody had listed. **Seven live readers, all under
`scrutinise-web/`**, plus the one `IdeaLegislation` row. What WAS in scope is done:
**`backfill-citations.ts` repointed to `corpus_acts`** (135,531 = 135,531, 0 missing, 0 differing) —
the last `LegislationItem` reference outside the web app.
**§4 — `docs/RAILWAY_ROLE.md` written.** Live: `fts-serve`, `Ops`. Live-but-serving-nobody:
`vector-serve` (`VECTOR_SEARCH_URL` unset). Dormant: `Ingest` — ⚠ **its last deploy FAILED on 30 Jun
and nobody noticed** because the queue drained. Stale: `fts-build`, `fts-pilot` (start command `true`).
Old `scrutinise-db` **archived** to R2 (31 tables, 1,244,339 rows, 611.7 MB gz, **all 54 objects read
back byte-for-byte**) — ⚠ a DATA archive, not a restorable dump (no `pg_dump` on this machine).
**NOT cleared, and the blocker is named:** `Ops` and `Ingest` still carry a `DATABASE_URL` pointing at
it. 64.8 minutes of counter-diffing across the hourly tick shows **no user table scanned by anyone**.
⚠ **`RAILWAY_API_TOKEN` is a PROJECT token — every existing Railway script sends `Authorization:
Bearer` and gets `Not Authorized` on every query, including `me`.** It needs `Project-Access-Token`.
That is why it reads as an expired credential. The two new scripts use the right header; the rest are
dead until changed.
**§5 — the 82-publication API backlog is closed, 82/82 accounted:** 81 ingested (**1,805 sections**,
split per finding), 1 recorded as a known-unknown with its reason. ▼ Earlier:
2026-08-09 12:10 UTC — ▼ **SEARCH STAGE 2A: LEX WAS ANSWERING FROM ONE STREAM IN
FIVE. IT NOW ANSWERS FROM ALL OF THEM.** Executes `BRIEF_SEARCH_S2A.md` §1+§2; CHANGE_LOG
(2026-08-09 12:10 UTC). `tsc` + `next build` clean; new **`check:stream-coverage` 3/3 with its
FAILING mode proven first**, `check:flags` **50/50**, `check:llm-guards` 9/9, `check:lex-general`
30/30.
⚠ **THE BUG, MEASURED NOT ARGUED.** `--pre-fix` mode re-creates the old `perStream.flat()` and
reports what shipped: **1 of 5 streams reached the answer context, 4 times out of 4** — 240
documents retrieved, 16 shown to Lex, all legislation. That is why Lex said *"the sources do not
contain information on what select committees have said"* while committees had returned 48 hits.
After the fix: **16 documents split 4/3/3/3/3 across five streams.**
**The fix is at the SEAM**: `lib/lex/interleave.ts` round-robins (floor ≤2/stream), and
`runRoutedSearch` calls it with a budget equal to the TOTAL hit count — a pure REORDERING that
drops nothing, so all EIGHT audited consumers are fixed by one change and any prefix a caller takes
is stream-balanced. ⚠ **A SECOND flat-concatenation slice the brief did not predict: `facts.ts`
sliced 8 off a TYPE-BLOCKED grouped list**, inside the block that tells Lex "these titles are the
ONLY things you may say were found" — so a missing type was a type Lex had to deny finding. Same
helper, floor 1.
⚠ **NOT FIXED, ON RECORD FOR THE RERANKER DECISION: `groupForPanel` already does the global
cross-stream score sort the brief argues against, and `fuseWeightedRrf` OVERWRITES `score` with an
RRF value (~0.01) while unfused streams carry raw BM25 (~5–25).** The moment `LEX_VECTOR_STREAMS`
is set, legislation sorts below every other stream and can be clipped out of the panel's 20-cap
entirely. It is a ranking-policy change, not a truncation bug.
**BUDGET PRICED, NOT DECIDED — unchanged at 16. Charlie's call.** Tokens from the API's own
usageMetadata: **16 → 2,947 in / 5,438ms · 24 → 4,198 (+42%) / 5,345ms · 32 → 5,317 (+80%) /
5,587ms.** **Latency is NOT the constraint — cost is**; retrieval (~3.5s) swamps the answer call, so
the three are indistinguishable to a user.
⚠ **§2 — REPEATS ARE NOT OPTIONAL, and the first run proved it: one pass returned 12/12 on the same
queries that had failed open minutes earlier.** The runaway is genuinely intermittent (**baseline
35/36, one 14.7s failure = 2.8%**), so `QUERY_ROUTER_MAX_TOKENS` now makes truncation reproducible
on demand. At a forced 60-token ceiling, one variable at a time: **salvage OFF 1/12 decided →
salvage ON 12/12.**
⚠ **THE BRIEF'S PROPERTY-ORDER PREMISE IS WRONG. Gemini emits ALPHABETICALLY, not in schema order** —
every salvaged payload held `caselaw,committees,debates` and **never `legislation`**, the stream
carrying dense retrieval and the one the PECR regression sits on. Adding `propertyOrdering` took
legislation from **0/12 to 12/12** in truncated payloads.
**Exit criterion met: 36/36 decided forward, 24/24 reversed, zero silent fail-opens**;
`route_outcome=full|partial|failed` now logs on every call with running totals. The word cap fired
**0 times in 60 production-budget calls** (prompt alone holds 6–8 words) and is proven able to fire.
⚠ **`check:flags` HAD BEEN FAILING SINCE 8 AUG AGAINST CORRECT CODE** — it looked for
`reason: 'truncated'` in `query-expansion.ts` after the refactor moved it to `gemini-finish.ts`. It
was 48/49, not the 49/49 recorded. Fixed, 50/50.
⚠ **§3 AND §4 ARE NOT RUN. Gate 1 open, GATE 2 CLOSED — there is no `corpus_vec` delta-embed
completion marker anywhere in the docs.** A baseline gathered across an index change is void, and
the delta embed is an index change on exactly the stream the regression sits on. **Ingest thread:
stamp the completion here and the benchmark can run.** Prediction recorded before measuring: the
interleaving fix substantially changes the answer text on multi-stream queries and may dissolve the
PECR regression entirely, because the old answer was written from legislation-only context.
▼ Earlier:
2026-08-09 08:45 UTC — ▼ **PUBLIC: "READING LEGISLATION: A WORKING GUIDE" IS
PUBLISHED — AS A DRAFT ASKING TO BE CORRECTED.** CHANGE_LOG (2026-08-09 08:45 UTC). `tsc` +
`next build` clean, new **`check:legislation-guide` 36/36**, and **driven in a browser end to
end** — page rendered, form submitted, row inspected, row deleted.
Live at **`/support?tab=reading-legislation`**. Draft status stated three times (banner, invitation,
closing questions), because the one harm this page can do is read as settled professional guidance.
The button says exactly what the brief asked — *"Are you a legislation expert? Suggest an
improvement"* — at the top and at the end, and **every section carries its own link that opens the
form with that section already chosen**. No login (a sign-up wall would cost us exactly the
corrections we want); an email address required instead, and the form says why. Two rate limits,
12/hr per IP and 12/hr per email. New table `LegislationGuideSuggestion`, applied to Neon **after a
whichdb check** (`ep-old-dust-aboxi69a` / `neondb`) and re-run to prove idempotence.
⚠ **THE EMAIL PATH IS NOT VERIFIED, AND CANNOT BE FROM HERE — `RESEND_API_KEY` is in NO local
`.env`.** It exists only in Vercel, so no email path in this codebase is testable on a developer
machine — that is true of every email feature already shipped, not just this one. The check prints
**NOT VERIFIED** rather than passing. **The first real submission in production is the test**; the
`sendError` column on the row is where the answer will be. Persist-then-send already proved itself:
the browser test stored `sendError: "RESEND_API_KEY not set…"` and the submitter still saw a
confirmation — correct, because their correction *was* received.
⚠ **The `<cite index="45-1">` research markers are STRIPPED** — the FAQ renderer uses
`dangerouslySetInnerHTML`, so publishing them would have put stray markup on a public page. The
check fails on any HTML tag in the content. ⚠ **Section keys are pinned by the check** because every
suggestion is stored against one; renaming §5's key in place would orphan its corrections.
⚠ **Found by LOOKING, not by reading code: `*italic*` rendered as literal asterisks** — the FAQ's
`renderMdText` only ever handled `**bold**`. Fixed in one place and applied at all four call sites;
existing FAQ content has no single-asterisk runs, so nothing there changes.
Not built, offered: an admin view of stored suggestions — today they arrive by email and nothing in
the app reads the table back.
Note for the search thread: `general-chat.ts` keeps its own inline `finishReason` check rather than
`gemini-finish.ts`; `check:llm-guards` passes it (9/9) since it allows the direct form, and I left
another thread's active refactor alone.
▼ Earlier:
2026-08-09 08:28 UTC — ▼ **SEARCH: THE TRUNCATION CLASS IS DEAD AT SOURCE; AND THE
ORDERING BASELINE IS BLOCKED — WHICH IS ITSELF THE FINDING.** Report:
`docs/ORDERING_METRIC_PROPOSAL.md` §A–C; CHANGE_LOG (2026-08-09 08:28 UTC). `tsc` + `next build`
clean; new **`check:llm-guards` 9/9**, `check:flags` 49/49, `check:lex-general` 19/19.
⚠ **THE AUDIT FOUND THE CLASS WAS NEVER CONFINED TO THE ROUTER — SEVEN JSON call sites had no
`finishReason` check** (four in `lex-client` incl. the main Lex turn, plus `feedback` and the tool
decider). `lib/lex/gemini-finish.ts` is the single guard now. ⚠ **Sharpest find: the tool decider at
256 tokens — a truncation there does not throw, the `functionCall` part is just absent, so it
silently returns "no tool wanted" and Lex answers without the figures it should have had. A failure
wearing the face of a decision.** `check:llm-guards` enforces it as a SOURCE invariant and **caught
`tool-runner`, which I had misclassified by eye.** **CLAUDE.md §18** is the standing rule.
⚠ **§3 THE BENCHMARK CANNOT YET BE RE-ESTABLISHED — routing is still intermittent.** Measured on
`routeQuery`, one variable at a time: after the bad-json fix **8/10, all failures `timeout` at
10s** (so that fix held); timeout→25s **10/12**; adding `maxLength:200` **3/12 — far WORSE**, model
degenerating into repetition, **reverted after one measured pass** (Gemini's responseSchema does not
honour it); current on a harder 3-query mix **7/12**. ⚠ **What remains is a RUNAWAY, not a ceiling**
— raising 4,096 again would buy a 3,000-char "query" per stream. **Recommended next, NOT built:
salvage a PARTIAL routing decision** (JSON is emitted in property order, `legislation` first, so a
truncated payload usually still holds it) — a `parseRoute` change that beats losing scoping AND
dense for the whole query.
⚠ **§4 THE 20 PAIRS ARE COMMITTED; THE BASELINE IS DELIBERATELY NOT PUBLISHED.** 20 pairs / 16
queries, authored **before any reranker**, three **deliberately inverted**. `score-ordering.ts`
imports the **real `runSearch`**. **With ~40% of queries failing open a baseline would average
routed and unrouted rankings — a different system, not a worse ordering of the same one.** Proof:
the fail-open run returned 48 untiered hits with **UK GDPR, DPA 2018 and PECR 2003 ALL ABSENT from
the top 20.**
⚠ **TWO ERRORS IN MY OWN PROPOSAL, found by implementing it.** (1) "measure before grouping" is
wrong for the routed path — `runRoutedSearch` ends `perStream.flat()`, a concatenation with **no
cross-stream sort**. (2) ⚠ **A REAL BUG: `general-chat` takes `results.slice(0,16)` off that
concatenation, so Lex sees the front of the FIRST stream (legislation) and the other four streams'
hits are retrieved, counted, panel-displayed and DROPPED before the answer.** That is exactly why
Lex said *"the sources do not contain information on what select committees have said"* while the
committees stream had been routed and had returned hits.
**IS THE RERANKER STILL THE RIGHT NEXT BUILD? NOT YET.** Order: salvage partial routing → decide
stream interleaving into the answer context → baseline → then reranker. **The PECR-leading
regression is still unattributed and the interleaving bug is now the likelier explanation than any
ranking defect** — and much cheaper to fix.
▼ Earlier:
2026-08-09 07:43 UTC — ▼ **CENTRAL STAGE 2: POINTS & LEADERBOARDS ARE BUILT, ON AN
EVENT LEDGER.** Executes the "Central Stage 2" brief (6 Aug 2026), all design settled by Charlie
beforehand. `tsc --noEmit` and `next build` clean; **140/140 checks against the live app DB**
(`npm run check:central`, up from 83). Full account: CHANGE_LOG "CENTRAL Stage 2"
(2026-08-09 07:43 UTC); the design is written up in `SCRUTINISE_CENTRAL_SPEC.md` §4 with the eight
decisions and the open items. **Architecture: `PointsEvent` is a signed, source-tagged row per
earning; every balance and leaderboard is COMPUTED and no running total is ever the source of truth.
The ledger only appends** — a withdrawn mark adds a negative row, and a reversal reverses at the
value the ORIGINAL award used, not today's tariff, so a retune cannot be banked by re-marking. Each
event stamps its tariff at write time, which makes "editing a tariff changes only subsequent events"
true by construction. **Mark values were MIRRORED, not invented, as the brief required:**
`lib/points.ts` prices a contribution rating at **+4** (3★, base positive) and **−4** (1–2★); a
Central mark is binary, so it maps to exactly those two, and the check script asserts the equality
against `POINTS_SCHEDULE` so they cannot drift. ⚠ **A consequence of two settled numbers meeting, and
Charlie's call: 10% of a 4-point mark floors to zero, so a MARK never pays the referral chain
anything** — bonuses only materialise on claim-sized events (24/40/60), where L1/L2/L3 land at 6/3/1
on a 60. Flooring is the conservative choice; raising the mark value (+8 is the main system's next
rung) or the L1 rate are both row edits. It is asserted in the tests rather than left to be
discovered. ⚠ **The admin cascade REVERSES the Stage 1.1 join-first gate** for reading and moderating
descendant boards — you cannot moderate what you cannot see — while **posting and marking still
require membership**; new `canReadBoard()` and a `DELETE` on the post route. **Moderation does not
rewrite the ledger:** removing a post leaves the events its marks produced, because a moderator's
judgement is not evidence the marks were never cast. **The daily marking budget counts from the
ledger, not from live vote rows** — withdrawing a mark deletes its vote, so counting votes would let
anyone refund their own budget — and counts distinct items, so changing your mind costs nothing.
**Branch leaderboards attribute by `sourceCommunityId`, the node the activity happened on**, not by
current membership, which would double-count anyone in two branches and rewrite a branch's history
whenever someone moved; that field is an addition to the brief's list for exactly that reason. **The
Community activity log at `/communities/[id]/activity` is visible to every member, not just admins** —
that is the anti-abuse mechanism, and what makes tariff-paying approval safe to delegate. ⚠ **A second
index Prisma cannot declare** (after Stage 1.2's): `ActivityClaim_one_per_day`, an EXPRESSION partial
unique on (userId, activityType, occurredAt::date) WHERE status <> 'DECLINED' — a `migrate diff` will
want to drop it. **Nothing was backfilled into the ledger:** the single bulletin vote on production is
a self-mark predating the guardrails, so paying it out would have opened the ledger with the exact row
the rules now forbid — flagged, not deleted, since it is Charlie's test data. Central points are
displayed beside the credibility score on the dashboard and profile and **never summed with it**;
nothing here writes to `Reputation`, `PointsLedger` or `CredibilityScore`. **Open items recorded, not
built:** negativity penalties (TBC), collusion analytics, knowledge tests, cross-Community boards.
**REMAINING GATE: Charlie's browser re-test.** ▼ Earlier:
2026-08-09 02:05 UTC — ▼ **INGEST V32 §2: THE BACKFILL IS DONE AND THE ENTIRE
POST-BACKFILL CHAIN IS RUN — MERGED, REDEPLOYED, RECONCILED.** CHANGE_LOG (2026-08-09 02:05 UTC);
new scripts under `scripts/ingest/v32-*`.
**The backfill drained 12:11 UTC 8 Aug** (batch 400, final batch considered 0 = genuine drain).
**7,636 archive-only publications: 5,390 fetched · 2,246 settled misses · 0 retryable** — the
buckets reconcile exactly. **222,315 `arc-` sections / 124.86M words.** Neon 322,117 =
Lance 322,117, **0 missing · 0 orphans · 0 stale · unindexed 0**.
⚠ **THE RETRY SWEEP RECOVERED 163 REAL PUBLICATIONS from 218 `[retryable]` misses** (+8,353
sections). Those were socket drops, not absences — without the settled/retryable split built on
7 Aug they would all have been written off as permanent corpus gaps.
⚠ **NEW DEFECT, caught by the metadata pass's own re-run assertion: the title enrichment truncated
away the name it was adding.** `${title} — ${name}`.slice(0,500) cuts the NAME on overflow, so the
`includes` guard failed and it re-appended every run. **3,101 rows sat at exactly 500 chars with the
committee name cut mid-word** — and the name is the only §B join key the FTS layer carries, so all
3,101 were ingested-but-unfindable (the §D failure). Fixed (reserve room for the name, strip the
partial tail); 10/10 unit checks; **a re-run now enriches 0**. The OLD assertion was wrong both
ways — false-positive on 136 natural repetitions, blind to the 3,101 real ones.
**77,163 index titles refreshed — the §1 entry's recorded pending item, now executed.** No existing
tool covers this: catch-up only APPENDS, hygiene removes only duplicates/orphans, and the merge
never re-reads Neon — **a stale title survives all three silently.** 77,163 rewritten, row count
conserved, 400 re-read all matching, follow-up audit 0 duplicates.
**Merge + redeploy:** catch-up appended **222,315/222,315** → `corpus_fts` **17,978,744**, leaving
299,478 unindexed (1.67%); merge cleared it — **unindexed 0, 533s, query 9,850ms → 1,364ms,
€0.053**, peak RSS 18.0 GB, box auto-destroyed. **`fts-serve` restart PROVEN** (`started_at`
02:01:30, `served` reset to 0). ⚠ `jobs.ts` `expectedPeakGb` deliberately NOT lowered to 18.0 —
three runs bracket 18.0–19.8 GB and this one was on a *larger* table; one run under the record is
noise, not headroom.
⚠ **ACCEPTANCE 2/5 = EXACTLY the recorded §1 baseline, same three phrases — NOT a regression.**
Cause unchanged and already documented: the index is `withPosition:false`, so BM25 cannot reward
adjacency. **What did change is rank — `"gradual and incremental"` 1→6, `"eye-watering"` 4→11** —
the expected cost of 222,315 new competing sections. Depth 200 returns no more than depth 60, so
it is ranking, not reach. **Search thread's call; `corpus_fts_positions` (16.5M rows, unused by
`fts-serve`) remains the obvious lead.** §E loop test **5/5** (Carillion: report, verdict, evidence,
government response, 2 inquiries with both halves under one id).
**PREDICTIONS SCORED, both wrong:** completion predicted ~14:30 UTC (range 13:30–15:30), **actual
12:11 — outside the range** (fetch-attempted count was right at ~2,425 vs 2,431 predicted; the
rate assumption was the error). Sections predicted 250k–290k, **actual 222,315 — 12–30% over**.
**OPEN:** (a) **82 publications with no rows at all — all `downloadable`, an API-path backlog for
the ingest thread, NOT a §2 gap**; zero archive-only-with-URL are unaccounted for. (b) evidence rows
still lack the inquiry id (§3 covered committees-reports only) — a follow-on pass. (c) 6
`Correspondence:` titles over the 500-char convention, from the §1 API path, left alone (they carry
their committee name) and now reported as informational.
⚠ **`TaskStop` again reported "killed" while the process kept running** — verified by process tree,
not by the tool's message. Letting it finish was correct.
▼ Earlier:
2026-08-08 23:00 UTC — ▼ **LEX: CITATIONS ARE MARKERS NOW, THE CONTEXT BLEED IS
CONFIRMED AND FIXED, AND THERE IS AN ORDERING-METRIC PROPOSAL FOR THE RERANKER.** Commits through
`336ff52`; proposal `docs/ORDERING_METRIC_PROPOSAL.md`; CHANGE_LOG (2026-08-08 23:00 UTC).
`tsc` clean, `next build` clean, `check:lex-general` 19/19, `check:flags` 49/49.
**§1 `citedIds` → `citedMarkers: number[]`, range-checked.** The old field made the model echo a
long opaque id verbatim — transcription over an opaque string, where a near miss looks plausible
and matches nothing. Both the structured field and the inline `[n]` markers now go through **the
same range check**, so no weaker half can drift. **After this there is exactly ONE way to drop a
citation — pointing at a source number never shown — which is a real grounding failure.** ⚠ The
historical mix (mangling vs out-of-range vs invention) can only come from **Charlie's Vercel log
entries**; I still cannot read them. The fix makes it moot going forward.
⚠ **§2 CONTEXT BLEED CONFIRMED BY CONTROL, then fixed.** `scripts/probe-context-bleed.ts` calls
`routeQuery` twice with ONE variable changed: cold, the legislation query is
**"Enterprise Act 2002 regulatory powers compel information disclosure"**; with two data-protection
turns as history it becomes **"Data Protection Act 2018 investigatory powers disclosure of
information"**. **The anchor Act was swapped for the previous topic's statute — on the legislation
stream, the one carrying dense retrieval.** `ideaContext` is now empty on general chat; the answer
call still gets `history`, so only what we FETCH is decoupled. `conversationContext()` deleted, not
left unused. **Known cost, accepted:** anaphoric follow-ups now retrieve against the pronoun — the
real fix is resolving to a standalone query pre-retrieval, recorded not built. *(The browser control
could not be run: the admin textarea intermittently drops programmatic input and `form_input` sets
the DOM value without updating React state. The probe is a better control — one variable, not two.)*
**§3 ORDERING METRIC — PROPOSAL ONLY, NOTHING BUILT.** ⚠ **MRR is the wrong primary and our own
failure proves it: PECR 2003 IS relevant, so the regression scores MRR = 1.0.** Recall@k and
precision@k are equally blind. **Recommended: pairwise preferences** (`prefer?: {above, below, why}`
on `GoldQuery`, reusing the existing pattern matcher) over nDCG, because **our key is admittedly
incomplete and nDCG grades every unlisted document 0** — penalising a reranker for promoting
something relevant we never enumerated. ⚠ **Vacuous pairs excluded from the denominator** or the
metric is gameable by retrieving nothing. ⚠ **recall@20 stays as a GUARD: a reranker only reorders,
so recall must be INVARIANT** — accuracy up with recall down means it is discarding. Measure on the
fused list **before `groupForPanel`** (it caps ~3/type and would hide the very error being measured).
⚠ **Baseline BEFORE the build:** seed 15–20 pairs from observed failures, authored before any
reranker exists, then score today's ranking. **One observed regression motivates a metric; it does
not justify a build** — if today's accuracy is already high we want to know first.
▼ Earlier:
2026-08-08 22:09 UTC — ▼ **SEARCH: THE FLIP IS LIVE — ROUTING AND DENSE RETRIEVAL
ARE BOTH RUNNING IN PRODUCTION.** Report: `docs/VECTOR_FLIP_LOADTEST.md` §21–27; CHANGE_LOG
(2026-08-08 22:09 UTC).
**Root cause, found by Charlie: `LEX_QUERY_ROUTER` existed as TWO Vercel variables (Production and
Preview), both sensitive and unreadable, so only the Preview copy had been corrected.** That
explains the whole pattern — expansion worked, the router stayed dark. Now one non-sensitive
variable across both environments.
✅ **`vector-serve` served has MOVED PAST 178 — now 182.** Three controlled trials via
`/admin/lex-general` (untiered, so it exercises the routed path): 3-stream question → **fts +3,
vector +1**; the **4 Aug benchmark** → **all five streams, fts +5, vector +1**, 235 retrieved /
10 cited; the previously-`bad-json` regulator question → **all five, fts +5, vector +1**.
**The `fts-serve` delta equals the stream count every time** — dispatch observed, not inferred.
Resolved flags (gateway snapshot; Vercel logs still unreadable from here): **`expansion router`**.
✅ **My truncation fix is confirmed live** (`b5319bf`) — the `bad-json` question now dispatches to 5.
⚠ **The 4 Aug benchmark is NOT a clean win and should not be written up as one.** Retrieval is
transformed, but the old answer led with UK GDPR + DPA 2018 and the new one leads with PECR 2003,
reaching UK GDPR at citation [9] — SI detail crowding out the headline statutes. A ranking/synthesis
question, not a retrieval failure; wants a gold-set look before claiming the *answer* improved.
⚠ **FUSION IS A CAP, and the log line could never have shown otherwise.** `fuseWeightedRrf` returns
the **full union, uncapped**; the cap is `query-router.ts:131` `.slice(0, Math.max(limit,
bm25.length))` = 47. **`fused 47` is guaranteed whenever the union ≥47, whatever the overlap** — zero
overlap would log the same. **The measured benefit is NOT lost**: the gain is recall@20, the slice
keeps the top 47 by fused score, every consumer takes ≤20. Leave it, document it.
⚠ **DROPPED CITATIONS: zero in all three of my trials.** Mechanism is clear though: `[n]` markers are
**ours** and positional (low risk); `citedIds` makes the model **echo a long opaque id verbatim** —
**mangled ids, not invented sources, is the likely dominant cause**. And because resolution is a
**union**, a dropped id whose marker resolved means the claim IS grounded. **Recommendation (not
widening the guard): replace `citedIds: string[]` with `citedMarkers: number[]`, range-checked** —
kills the class, makes survivors meaningful. **Need 2–3 real log entries to close it.**
⚠ **NEW FINDING: conversation history steers retrieval.** `general-chat.ts:266` passes
`ideaContext: conversationContext(history)`. Trial 3 asked about regulator powers after two
data-protection turns and retrieved 233 **data-protection** sources. Right for an idea-bound chat,
wrong for a general one — **and plausibly a cause of the citation problem**, since off-topic
retrieval is when a model reaches past its sources. Control not run (browser stopped submitting);
one minute of work: fresh page, ask it first, compare.
**§4 WATCH NOW MEANINGFUL.** Baseline: `fts-serve` 32 / 0 errors / cap 16 / **queue p95 0 ms at real
traffic**; `vector-serve` 182 / 0 errors / 0 rejections / **embed p50 228 ms, one Gemini call per
uncached dense query** — the new cost line. Watch served for liveness, embeds for cost, 3.4–3.8 s
search latency for drift.
▼ Earlier:
2026-08-08 21:30 UTC — ▼ **LEX: A GENERAL CORPUS CHAT — `/admin/lex-general`.
ASK THE CORPUS ANYTHING, AND SEE WHAT IT RETRIEVED.** CHANGE_LOG (2026-08-08 21:30 UTC).
`tsc` clean, `next build` clean, `check:flags` 44/44, new **`npm run check:lex-general` 29/29**
(19 source invariants + 10 live assertions against the real index and the real model).
A plain chat window, admin-only, with **no open idea, no on-topic requirement and no field-machine
state** — which is the point: verifying retrieval no longer means hunting for an idea the question
happens to be on-topic for (that is how vector-flip trial 1 was lost). It goes through `runSearch()`
like every other caller — no second retrieval path — and is **UNTIERED by construction**, so it takes
the routed branch rather than the tier-scoped one that skips `fusedStream` entirely. Every answer
shows its sources with type, citation, score, id and rank, which streams routed, which flags were on,
and **how many of the retrieved results were actually put in front of Lex** (16 of 47 on the live
run). No writes: no `Idea` read, nothing persisted, transcript dies with the tab — asserted by grep,
not by intention.
⚠ **IT FOUND A PRODUCTION BUG IN THE ROUTER IN ITS FIRST HOUR — REPORTED, NOT FIXED, FOR THE SEARCH
THREAD.** With `LEX_QUERY_ROUTER=true`, **two of four real questions failed open with `bad-json`**,
and the logged payload is **truncated mid-word**. `query-expansion.ts:101` caps the shared Gemini
JSON call at **`maxOutputTokens: 512`**, and five tailored per-stream queries do not fit; it is NOT
the thinking-budget bug (already zeroed, line 108), and `callGeminiJson` **never checks
`finishReason`**, so truncation arrives disguised as a parse failure. `expandQuery` shares the helper
and the exposure. Reproduction: "data protection" → 1 stream; "select committees / water pollution"
→ **4 streams**; "regulators compelling disclosure" → **FAIL-OPEN**; "leasehold reform" →
**FAIL-OPEN**. ⚠ **This does NOT fully explain the production observation** — the router
demonstrably routes when it parses. But it is a live, reproducible instance of candidate 2. Not
changed here: it moves ranking and latency on every routed query and belongs in the search thread's
evidence trail.
⚠ **`fts-serve` `served` 4 → 14 during this work — ten calls are mine, not users.** That counter is
the evidence of record; do not read the delta as production traffic. Incidentally it **confirms the
per-stream detector**: the 4-stream question moved it by exactly 4.
Incidental, same class in the new file and fixed at source: the answer call died first time on
`Unterminated string in JSON` (16 sources at 2,048 tokens) — now 8,192, `thinkingBudget: 0`, and
`finishReason` checked so a truncation names itself. **Third recorded instance** of this failure
(query-expansion 29 Jul, web-orientation 6 Aug). Also fixed after the live run: `citedIds` came back
EMPTY under a fully-cited answer, so citations now resolve positionally from the `[n]` markers as
well, with anything unresolvable shown rather than dropped.
**Not run: `check:orientation`** — untouched by this work and it costs a real web/X round trip.
⚠ **OUTSTANDING — `/admin/lex-general` HAS NEVER BEEN OPENED IN A BROWSER** (recorded 2026-08-10;
said in chat at the time, never written down, which is how it survived to now). The server path is
tested end to end by `check:lex-general`; the React rendering is not, under a Clerk admin session or
any other. Nothing asserts the page renders, that the retrieval block expands, or that the source
list is readable. **The scepticism is earned:** the very next page built in that session WAS driven
in a browser, and that is the only reason a `*italic*`-renders-as-literal-asterisks defect was
caught before it went public. One authenticated pass at `/admin/lex-general` closes this.
⚠ **SUPERSEDED — the router `bad-json` fail-open above is FIXED**, by the search thread, not here:
`DEFAULT_MAX_OUTPUT_TOKENS` is now **4096** (was 512), `gemini-finish.ts` is the shared truncation
guard (`414b6fb`), and `b379ce8` added partial-route salvage plus outcome counting. The paragraph
above is left standing as the finding-as-made; this line is its disposal.
▼ Earlier:
2026-08-08 21:00 UTC — ▼ **LEX: THE SILENT-FLAG CLASS IS DEAD — parseBool
EVERYWHERE, A LOUD FAIL-OPEN, AND A BOOT LINE.** Commit `bce7818`; CHANGE_LOG
(2026-08-08 21:00 UTC). `tsc` clean, `next build` clean, `check:orientation` 15/15, new
**`npm run check:flags` 44/44**.
⚠ **Correction: `bce7818`'s `Date:` trailer says 15:41 UTC; the real time was 21:00 UTC** — a
stale stamp carried forward instead of reading the clock (CLAUDE.md §Git forbids exactly this).
Not amended: a force-push to a branch another thread is using is the worse trade. **21:00 UTC is
the stamp of record.**
**Four things had to be true for the capitalised-`TRUE` bug to stay invisible; all four are now
fixed.** (1) **`parseBool`/`flagEnabled`** in `lib/env-flags.ts` — trims, lower-cases, accepts
`true/1/yes/on`; ⚠ **a value that is SET but unrecognised returns false AND warns once, naming the
variable and value.** All **ten reads across eight flags** route through it, **including the second
gate inside `routeQuery`**, which was a separate copy of the same bug and would have kept the
router dark on its own. (2) **The fail-open is LOUD** — `routeQuery` logs at error level with the
reason (`missing-key` / `http-error` / `timeout` / `network-error` / `empty-response` / `bad-json` /
**`no-streams-named`**, the last previously indistinguishable from success); the gateway's line is
`console.error` too; `expandQuery` likewise. (3) **Boot line** (`instrumentation.ts`) — one line per
instance with every flag's resolved state **plus `VECTOR_SEARCH_URL` / `LEX_VECTOR_STREAMS` /
`GEMINI_API_KEY`** (keys set/unset, never printed). **"Is X live?" is now read, not inferred.**
(4) **`check:flags`, 44 assertions** — the load-bearing one is the **SOURCE invariant**: 340 files
scanned, fails if any bare `process.env.<FLAG> ===` returns. **Verified it can fail.**
⚠ **RE-VERIFIED AFTER THE DEPLOY — TRIAL 4, STILL NEGATIVE.** Against the fresh `bce7818` build:
**`fts-serve` 3 → 4, `vector-serve` 178 → 178.** Same signature, one untiered call and no dense;
that is **four trials**. Two queries Charlie ran in the same window behave identically (each moved
`fts-serve` by exactly one), so it is not an artefact of how I drive the browser. **Candidate 1 (a
stale deployment) is much weaker now** — a fresh build exists since the values were corrected —
leaving **candidate 2: `routeQuery` failing open**, or the values not applied to the Production
environment of the deployment actually serving. ⚠ I could NOT confirm from outside which
deployment is serving (homepage came from CDN cache, `Age: 18029`; Vercel's API is closed to this
session) — **check the dashboard for which deployment is Current and whether its commit is
`bce7818` or later.**
⚠ **CHARLIE — TWO LOG LINES NOW SETTLE IT, both new in `bce7818`, both in Vercel Runtime Logs:**
(1) **`[capabilities] …`** at boot — states after parsing exactly what is on, plus
`VECTOR_SEARCH_URL` / `LEX_VECTOR_STREAMS` / `GEMINI_API_KEY`. If it says `QUERY_ROUTER=off` or
`VECTOR_SEARCH_URL=UNSET`, it is the environment and there is nothing to debug in code.
(2) **`[query-router] FAIL-OPEN — … (<reason>)`** at error level, `<reason>` ∈ missing-key /
http-error / timeout / network-error / empty-response / bad-json / no-streams-named.
**There is no longer an ambiguous state between them.**
**RE-VERIFICATION when unblocked** (one minute): cross-cutting query on the briefing path →
**`fts-serve` must jump by ≥2** (per-stream dispatch) **and `vector-serve` must move past 178**
(dense actually running). 178 remains the clean detector.
▼ Earlier:
2026-08-08 15:04 UTC — ▼ **SEARCH: THE ROUTER HAS NEVER RUN IN PRODUCTION — AND
DENSE STILL IS NOT ENGAGING AFTER THE `TRUE`→`true` FIX.** Report:
`docs/VECTOR_FLIP_LOADTEST.md` §12–17; CHANGE_LOG (2026-08-08 15:04 UTC). Read-only.
⚠ **THREE CONTROLLED AUTHENTICATED TRIALS, ALL NEGATIVE. `vector-serve` served 178 → 178 → 178** —
still exactly and only my own load-test traffic, so **no dense query has ever been issued from
Vercel.** Trials 2 and 3 reached the gateway and returned results, each making **exactly ONE
`fts-serve` call and ZERO dense**. **Trial 3 is decisive** — it named legislation, committees AND
case law, so a live router would have dispatched to 2+ streams with legislation among them.
(Trial 1 never reached the gateway: **Lex refuses an off-topic corpus search for the open idea**,
so an off-topic benchmark cannot exercise retrieval.)
⚠ **THE BIG ONE — THE ROUTER AND QUERY EXPANSION HAVE NEVER REACHED A USER.** The flag is tested
`=== 'true'` (case-sensitive) in **TWO independent places**: `search-gateway.ts:57` and
**`query-expansion.ts:214`, the first line of `routeQuery` itself** — so `TRUE` disabled it twice.
`LEX_QUERY_EXPANSION` was capitalised the same way. **The router's +15.3pp / +10.0pp gold-set
gains and the expansion gains before them were measured offline and never shipped. The 4 Aug
production improvement must be attributed to the FTS index rebuild and the legacy repoint
instead.** ⚠ Not establishable from here: the DATE — **check Vercel's env-var history** to fix how
long both have been dark.
⚠ **WHY IT STILL ISN'T ROUTING — two candidates, identical symptom:** (1) the running deployment
doesn't carry the corrected values (env needs a build/boot after saving; `vector-search.ts:21`
reads `VECTOR_SEARCH_URL` at module load); (2) **`routeQuery` returns null so the gateway FAILS
OPEN** to one unfiltered `runFtsSearch` (`search-gateway.ts:176–181`) — null on missing
`GEMINI_API_KEY`, HTTP error, bad JSON, or the 10 s `QUERY_ROUTER_TIMEOUT_MS`. Deliberate and
correct, but **silent**, and from outside identical to the flag being off. **CHARLIE — one Vercel
Runtime Log line settles it:** `router fail-open …` → cause 2; `router dispatched` → routing works
and the problem is dense-side; neither → cause 1.
⚠ **EIGHT BOOLEAN FLAGS SHARE THIS FRAGILITY and nothing normalises env booleans anywhere:**
`LEX_QUERY_EXPANSION`, `LEX_QUERY_ROUTER`, `LEX_WEB_ORIENTATION` (2 sites), `LEX_SEARCH_VECTOR`,
`LEX_SEARCH_RERANKER`, `LEX_SEARCH_GRAPH`, `LEX_COHERENCE_CORPUS`, `LEX_SEARCH_STUB`. **Audit all
eight in Vercel** — `LEX_WEB_ORIENTATION` especially (Web/X shipped 6 Aug behind this pattern and
would be equally dark). A `parseBool` helper would kill the class; not changed.
**§3 benchmark re-run but NOT yet a comparison** — same core answer (UK GDPR + DPA 2018) plus two
corpus hits, but produced by a single untiered BM25 call with no dense and no routing, so nothing
is attributable to the flip. Re-run after §14. Also: half that answer comes from the idea's stored
*Legal landscape* field, not retrieval — a sharper benchmark needs an idea with none.
**§4 WATCH STILL NOT STARTED** — it would report a healthy system not doing the watched thing.
State: `fts-serve` 2 served / 0 errors / warm p50 2,550 ms / **queue p95 0 ms at real traffic**
(cap 16 nowhere near approached — the queueing was only ever synthetic) / RSS 1,243 MB;
`vector-serve` 178 / 0 errors / 0 rejections / RSS 1,079 MB. **Gemini embed volume — the new cost
line — is still ZERO: the flip has cost nothing because it has done nothing.**
▼ Earlier:
2026-08-08 10:02 UTC — ▼ **SEARCH: p95 DEFECT FIXED, CONCURRENCY 4→16 (−57% p95),
BUT THE FLIP IS DEPLOYED AND INERT — DENSE IS NOT ENGAGING.** Report:
`docs/VECTOR_FLIP_LOADTEST.md` §8–11; CHANGE_LOG (2026-08-08 10:02 UTC).
⚠ **CHARLIE — ONE ACTION NEEDED: check Vercel Runtime Logs for `[search-gateway]` /
`[query-router]`.** One real authenticated search on the live briefing path moved **`fts-serve`
served 0→1 and `vector-serve` served 178→178**. 178 is exactly and only my own load-test traffic,
so **`vector-serve` has still never served a request originating from Vercel** — and no error was
raised anywhere. This is the "silently inert" failure we set out to rule out. **Three causes give
this identical symptom:** (1) `LEX_QUERY_ROUTER` not the literal string `true` (`=== 'true'`) —
retrieval then takes the non-router branch making **one untiered `runFtsSearch`, exactly the one
call seen**, while step 4b also stands down because `perStreamVectorActive()` is true — **best
fit**; (2) `VECTOR_SEARCH_URL` not reaching the running function (`vector-search.ts:21` reads it
at **module load**, so it needs a deploy made AFTER the variable was saved); (3)
`LEX_VECTOR_STREAMS` not matching `legislation` case-sensitively. Log line settles it:
`router dispatched` → cause 2 or 3; nothing → cause 1.
✅ **§2 p95 DEFECT FIXED, DEPLOYED, VALIDATED.** `fts-query-service.ts` now clocks from before
`acquireSlot()` (matching `vector-query-service.ts:205`) and reports `queue_p50/p95_ms`; observer
digest prints the split. Same 10-user load: reported warm_p95 **1,523 ms → 13,101 ms** vs client
13,325 ms, **queue p95 12,368 ms = 94%**. 28/28 observer checks.
✅ **§3 SWEEP — 4 WAS FAR TOO TIGHT AND NOTHING CRASHED. `FTS_MAX_CONCURRENT` is now 16.**
User p95 at 10 users: cap 4 **14,213 ms** → 8 **8,241** → 16 **6,161** → 24 **6,031**. **57% cut**
for 230 MB more peak RSS (24.1% of cap), 0 errors anywhere. **16 not 24 because of the contention
knee** — internal per-call service time is flat at 1,195/1,106/1,146 ms for caps 4/8/16 then jumps
to **1,697 ms at 24**. Floor note: at cap 24 / 5 users queue p95 is **1 ms** yet user p95 is still
5,323 ms, so ~5 s is genuine parallel service time, not queueing.
⚠ **THE CRASH QUESTION IS ANSWERED: the old signature did not reproduce.** Caps 16 and 24 at 50
simultaneous in-flight requests → 0 crashes, 0 errors, 0 restarts across eight levels, well past
the 15-concurrent level that used to be fatal. Memory-pool is now the better explanation for the
original crash. **NOT shown: that no cap is needed** — this was a seconds-long burst, not a soak;
`concurrency-stress-test.ts` stays the regression check before raising further.
**§4 THE 24h WATCH HAS NOT STARTED, deliberately** — meaningless until dense engages; a clean
digest would report success at doing nothing.
Incidental: **`RAILWAY_PROJECT_ID` is not in `.env`** and `variableUpsert` with an undefined
projectId fails as an opaque "Problem processing request"; both ids now come from the project
token. A Chrome tab is left open on the Lex workspace for idea `f534c43d` — another extension
seized it mid-test, which is why the on-screen response could not be read.
▼ Earlier:
2026-08-08 01:09 UTC — ▼ **SEARCH: THE FLIP IS FREE; THE BM25 FAN-OUT IS THE
LATENCY PROBLEM — AND THE FLIP ITSELF IS BLOCKED ON VERCEL ACCESS.** Report:
`docs/VECTOR_FLIP_LOADTEST.md`; script `scripts/ingest/search/simulate-router-load.ts`;
CHANGE_LOG (2026-08-08 01:09 UTC). **Read-only — no flag set, no env changed, NOTHING FLIPPED.**
**§1 COMMITTED AND PUSHED** — four commits `f28f5a8`…`ba2232c`, verified against the real remote
ref; the ingest thread's V32 §2 entry is preserved above ours.
⚠ **§2 headline: dense retrieval is NOT the latency risk — the BM25 fan-out already is.**
User-visible p95 at 3/5/10 concurrent users: today `bm25` **4,946 / 7,632 / 12,798 ms**; with the
proposed flip (`legislation` dense) **4,340 / 6,487 / 12,566 ms** — i.e. **no measurable cost**, the
dense half returns in 4.3–4.9 s and never becomes the critical path. ⚠ **But BM25 alone, with no
flag set, is ALREADY past the observer's 5 s p95 threshold at 5 concurrent users.**
`FTS_MAX_CONCURRENT=4` + unbounded queue is the constraint — queue high-water 46 of 50 in-flight;
the service is serialised, not slow (960 ms p50 internally). **All-five-streams-dense doubles user
p95 to 25,119 ms** — the evidence for flipping one stream at a time. **0 errors, 0 rejections at
every level**; memory a non-issue (`fts-serve` peak 20.9% of cap, `vector-serve` 14.3%).
⚠ **OBSERVABILITY DEFECT FOUND BY THE RUN: `fts-serve` cannot see any of this.**
`fts-query-service.ts:168–169` sets `t0` AFTER `acquireSlot()`, so its p95 **excludes the queue
wait**; `vector-query-service.ts:205` sets it BEFORE. Measured: **client p95 12,176 ms vs
`fts-serve` /stats warm_p95 1,523 ms.** `queueMs` is computed and echoed but never enters a
percentile. **So "watch the observer for 24h — p95" would give FALSE ASSURANCE on the FTS side.**
Reported, not fixed. ⚠ The load test will fire a real observer alert next tick (`vector-serve`
warm_p95 22,354 ms) — synthetic traffic, not users.
⚠ **§2 could NOT be completed through Vercel and §3 CANNOT BE PERFORMED — both blocked on the
same thing: `VERCEL_TOKEN` authenticates but every project-scoped call returns 403 `saml:true`,
scope `charlie-leachs-projects`** (`/v2/teams` empty; the account's own `defaultTeamId` refused
too). So `VECTOR_SEARCH_URL` cannot be set, the production flag state cannot be read, and the flip
cannot be made. Separately, **the untiered gateway routes are not load-testable through Vercel
without Charlie anyway** — all are `/api/ideas/[id]/…` behind Clerk, rate-limited 40/hr, writing to
real idea data. Missing hop is bounded not measured: ~120 ms fixed round trip vs 4–12 s service
time = 1–3%. **CHARLIE: re-authenticate the Vercel token to the SAML scope, or set
`VECTOR_SEARCH_URL` in the dashboard and confirm `LEX_QUERY_ROUTER`.**
✅ **Verified in passing: tonight's push redeployed `fts-serve` (01:03:33Z) and THE REPOINTED BOOT
PATH WORKS IN PRODUCTION** — a citation query returns `ukpga/1988/50:section-21` with
`resolved=true`, only reachable if the `corpus_acts` ActIndex loaded at boot. Incidental: Companies
Act 2006 s.172 doesn't resolve because **that section is not in `corpus_sections` at all** — a
corpus gap, not a regression.
**§3 CHECKLIST, NOTHING SET:** (1) `VECTOR_SEARCH_URL` (real master switch — both flags inert
without it); (2) `LEX_QUERY_ROUTER=true` (`fusedStream` only reachable via `runRoutedSearch`);
(3) `LEX_VECTOR_STREAMS=legislation`; (4) **leave `LEX_SEARCH_VECTOR` unset**. Awaiting the token
fix and Charlie's word.
▼ Earlier:
2026-08-07 23:43 UTC — ▼ **SEARCH: THE VECTOR FLIP IS NOT BLOCKED BY TRUNCATION,
AND THE LOAD-BEARING FLAG IS `LEX_VECTOR_STREAMS`.** Report:
`docs/LEGISLATION_TRUNCATION_AND_FLAG.md`; script
`scripts/ingest/search/measure-legislation-truncation.ts`; CHANGE_LOG (2026-08-07 23:43 UTC).
**Read-only — nothing written, no flag set.**
**The legislation tier embeds 79.2% of its body words against corpus-wide 59.4% — materially ABOVE,
not below** — and the brief's own framing (primary + SI + retained EU) embeds **99.3%**, 256
truncated of 1,188,286 rows. Tier-wide **8,167 truncated of 1,615,500 (0.51%)** vs 242,957
corpus-wide. **Decision rule resolves: proceed with the flip, chunking fix follows.**
⚠ **The premise behind the worry does not hold — long-form UK instruments are not gutted. Every
Finance Act section embeds whole (0 truncated of 24)**; tax family 89.3% of words, Companies/
Insolvency 96.3%, schedules 84.7%. UK legislation is drafted in sections and a section is a natural
chunk (median legislation row 34–78 words); the cap only bites where one row holds a whole document.
**Measured, not modelled:** all **21,033** sections that could possibly be truncated had their real
R2 body read and run through the **real exported `chunkBody`**; the model (same method as the 59.4%,
CPW **measured at 6.066** on 400 real bodies) agrees to **0.2pp**. Harness fidelity asserted against
`chunk.ts` on all 21,033 bodies; 1,322 bodies re-read in full so a ranged read could never
manufacture a truncation; smallest truncated section 2,470 words = 1.65× the candidate floor.
⚠ **The tier average hides a hard split: `eur-lex` 57.3%, `explanatory-memoranda` 65.8%,
`explanatory-notes` 14.3% carry nearly all the loss, and all three are INSIDE the `legislation`
tier** that the flag scopes to. ⚠ **Their damage is a SECTIONING problem, not a chunk-cap one** —
the worst 15 sections in the tier are all `eur-lex` single-section rows holding an entire document
(`eur-lex:32007B0143:1` = **760,509 words, 0.5% embedded**); cap 64 would not fix them. For the
ingest thread; not acted on.
⚠ **FLAG ANSWER, traced in code: `LEX_VECTOR_STREAMS` is load-bearing. `LEX_SEARCH_VECTOR` is the
superseded whole-query switch and stands DOWN automatically once the stream list is non-empty**
(`search-gateway.ts:245`). Setting only `LEX_SEARCH_VECTOR` would switch dense on for every stream
at once, unscoped. **`VECTOR_SEARCH_URL` is the real master switch** (both flags inert without it),
and **`LEX_VECTOR_STREAMS` needs `LEX_QUERY_ROUTER=true`** to have any effect at all.
⚠ **GAP NEITHER THREAD HAD STATED: the three legacy legislation surfaces will NOT get dense from
`LEX_VECTOR_STREAMS=legislation`.** `gateway-legacy.ts:162` passes `tier: 'legislation'` → the
tier-scoped branch at `search-gateway.ts:140` calls `runFtsSearch` **directly**, bypassing
`fusedStream`. Those are `app/api/ai/[ideaId]` (**Lex chat**), `app/api/search`,
`app/api/ideas/[id]/legislation-search` — and adding `LEX_SEARCH_VECTOR=true` would not cover them
either, since it stands itself down. Dense would reach only the untiered callers (Page-1 briefing,
cause-seeding, ad-hoc research). **Reported, not changed — Charlie's call whether that is the
intended blast radius.**
**§3 repoint-confirm: all three Act-title reads are on `corpus_acts` and verified.** ⚠ **Not the
same as "safe to DROP"** — `backfill-citations.ts:48` still reads `LegislationItem`, and the six
web-app paths in `V26_LEGACY_DROP_RECHECK.md` §(a) plus the one `IdeaLegislation` row remain.
▼ Earlier:
2026-08-07 23:25 UTC — ▼ **INGEST V32 §2 FIX: THE BACKFILL WAS REPORTING PROGRESS
AND MAKING NONE.** Found by watching row counts rather than the log. **As committed an hour
earlier, §2 would have stalled permanently at 166 of 7,636 while looking completely healthy** —
batches ticking over, log live, throttle chattering. **The resume filter skipped publications with
`arc-` sections and nothing else, so every already-MISSED publication was reconsidered on every
batch, forever.** "considered" was truthful and simply never meant "new".
**The fix is not just "skip misses":** a miss is either **settled** (no snapshot, no URL,
unparseable — a retry cannot help) or **retryable** (a socket drop, which says nothing about
whether a snapshot exists), and the old code conflated them under one message, so writing all
misses off would have discarded documents that are actually there. `fetchArchivedDocument` now
returns `{got, settled}`, the note carries a `[settled]`/`[retryable]` prefix, the filter skips
only settled, and `--retry-misses` sweeps the rest. The 52 existing miss rows were reclassified
from their wording: **11 retryable, 41 settled.**
**Second fix, same root cause — the recycle trigger was a guess.** `--max 40` is 40–80 requests but
socket degradation starts at ~30–50, so batches died mid-flight and sat at the 30s ceiling. The
bail now fires on the SIGNAL — five consecutive transient failures, reset by any success or clean
404 — not a document count. Batch 40 → 25.
⚠ **Also found and making it worse:** the bash driver loops the harness had "reaped" were **still
alive at OS level and still spawning batches** — three concurrent backfills competing for the
archive, which is the very load that triggers the degradation. The `TaskStop`-doesn't-kill pattern
again; killed and verified by process tree, not by the tool's success message.
**Before → after, same script:** queue stuck at 166 → 7,426 remaining and falling; a 25-doc batch
~5s/0 new → 3.8 min/**23 fetched, 384 sections**; archive reach → **100%** on that batch.
Now at **335 publications, 16,901 sections**, `committees-reports` **116,703** compiled rows.
Driver relaunched detached (see the run instructions below); ETA ~19 hours. ▼ Earlier:
2026-08-07 19:50 UTC — ▼ **INGEST V32 §1 DONE: COMMITTEE REPORTS ARE NOW
PER-FINDING, INDEXED AND SERVED. §2 (Wayback backfill) IS RUNNING.** Executes
`BRIEF_CC_V32_committees_completion.md` §1 and §3; full account in CHANGE_LOG "INGEST V32 §1"
(2026-08-07 19:50 UTC). Nothing committed to git.
**The prediction was SCORED: predicted 78,776 sections, actual 78,768 — 0.01% out.**
Run as one operation: rechunk → metadata → hygiene → catch-up → heavy-job merge → fts-serve
restart. **0 lossy splits, 0 R2 misses, 0 un-retired blobs, 0 body misses**; the merge left
**unindexed 0**, sample query **5,671ms → 1,661ms**, €0.064, peak RSS 17.9 GB on cpx62.
⚠ **THREE REAL BUGS CAUGHT BY THE SAFETY MACHINERY, NOT BY INSPECTION:** (1) `deleteStaleSections`
is scoped by `parentDocId` and **14 publications hold >1 document** — per-document processing
would have silently deleted sibling documents' rows; the unit of work is now the publication.
(2) `itemDate` arrives from node-pg as a JS `Date` and `String(date)`='Fri May 08', which Postgres
rejects (22007) — it killed the first commit run, and **R2-before-Neon meant nothing was
half-written**. (3) **A NUL byte in PDF text reached a `sectionTitle`** (22021, `CLAUDE.md` §13's
documented class), killing the full pass at publication 275/3,802; `unwrap()` now strips C0
controls first, which also closes a latent collision with the splitter's own U+0001 sentinel.
Also: the stats counters used `x += await f()` — read-await-write, which **loses increments under
concurrency** (reported 441 upserts for 519 rows); the DB reconciliation was right and the
counters were lying. And the check script's live sample was picking up **its own already-split
output**, which looked exactly like a splitter regression until the sample was scoped.
⚠ **ACCEPTANCE IS 2/5, AND THE REASON FOR THE OTHER 3 IS NOT INGESTION.** Committee report
sections now dominate live results (19–41 of every 60, where the stream returned none before);
`"gradual and incremental"` returns a confirmed section at **rank 1**, `"eye-watering"` at rank 4 —
both previously unreachable. The other three ARE split and indexed (verified by direct id lookup
in `corpus_fts`) but **do not enter the top 100 for their own phrase**: the live index is built
`withPosition: false`, so BM25 cannot reward adjacency. **That is a ranking question and belongs
to the search thread** — and note **`corpus_fts_positions` already exists on R2 with 16,509,051
rows**, unused by `fts-serve`.
⚠ **§3 metadata is in Neon but NOT yet in Lance** — `fts-catchup` had already appended those rows
and it only appends, never updates; the refresh rides along with the §2 merge. Inquiry id present
on 6,224 publications, **null on 5,348 and recorded as null, not invented**.
⚠ **§2 IN FLIGHT, with a real external constraint.** 11,572 publications enumerated (a `--repair`
mode re-walked the one partial year-slice rather than leave a silent undercount); **7,636
archive-only**. A first 12-item pilot said 41.7% reach and **was wrong because it took the FIRST
12** — the oldest items are disproportionately `www.parliament.uk/globalassets`, a host Wayback
never crawled; an evenly-spaced 40-item pilot measured **85.0%**, matching the measured host split
(84% `publications.parliament.uk`). Pilots now sample evenly. **Wayback NEVER returns 429 for this
workload — it DROPS CONNECTIONS**, and the throttle counted those as rate limiting and doubled to
a 120s ceiling: 40 documents in 20 minutes. Ceiling now 30s, floor 3s, and never-archived hosts
are skipped without a request.
⚠ **AND THE REAL §2 CONSTRAINT, which was NOT what the log said.** The run kept dying under
`[throttle] rate limited`. **Wayback never returned 429 or 503 — not once, across three runs.**
After ~30–50 requests a PROCESS starts getting `TypeError: fetch failed` and never recovers; a
FRESH process fetching the same URLs scores 10/10 at ~1.5s with no pacing. It is a stale
keep-alive pool on our side, so **the cure is a new process, not a longer wait** — backing off
cannot reopen a dead socket. The backfill now takes `--max N` and exits cleanly;
`v32-finish-backfill.sh` (`npm run backfill:committees`) recycles it and prints the hand-off
runbook. Also: the availability-API fallback now runs only after a *transient* failure, never a
clean 404 (over a 12-URL probe it rescued nothing 12/12 while doubling the cost of every miss).
**ETA ~12 hours, resumable and idempotent — killing it loses nothing.**
▶▶ **IT IS ALREADY RUNNING, DETACHED — you do not need to start it.** A ~13-hour loop does not
survive CC's background-command lifetime (it was reaped three times, each time losing only the
in-flight batch), so it was relaunched as a detached PowerShell driver that outlives the session:
`scripts/ingest/v32-finish-backfill.ps1`, writing to `scripts/ingest/v32-backfill.log`.
- **watch:** `Get-Content .\v32-backfill.log -Tail 20 -Wait`
- **stop:**  `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*v32-backfill*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`
  (also stop the `powershell.exe` running `v32-finish-backfill.ps1`, or it starts another batch)
- **restart:** `powershell -ExecutionPolicy Bypass -File v32-finish-backfill.ps1` — resumable and
  idempotent, so stopping and restarting costs only the in-flight batch.
The log ends with the full hand-off runbook. ⚠ `v32-backfill.log` is a run artefact — do not commit it.
**Progress at hand-off: 166 of ~6,400 archivable publications → 8,090 sections, 52 misses recorded.**
✅ **§4 IS ALREADY PROVEN — `npm run check:loop` is 5/5.** Rather than wait for the queue to reach
2018, `--only=<ids>` pulled the eleven Carillion publications ahead (8 of 9 attempted retrieved,
307 sections). **`"recklessness, hubris and greed"` is now in the corpus** at
`committees-reports:publication:16614:arc-0002` — the exact phrase `GOLD_TEST_09` used to prove
committee conclusions were unreachable. Evidence (34 rows), report conclusions (307 sections) and
the government response (74 sections) are all retrievable, with **two complete inquiry loops**
joined by shared inquiry ids **5425** and **5916**. ⚠ The first version of that §B assertion was
**wrong and passed 4/5 for the wrong reason** — it demanded one inquiry id across the SUBJECT
"Carillion", which spans two genuinely separate inquiries; it now groups by inquiry. ⚠ **Evidence
rows do not yet carry an inquiry id** — the §3 pass covered `committees-reports` only; evidence↔
inquiry needs the API's `committeeBusiness` and is a recorded follow-on.
⚠ **REVISED PREDICTION before the run lands:** ~45–56 sections/document (not §1's 20.5 — these are
older and longer), so ~5,700 documents → **~256,000+ sections**, embed ≈ **$15** not $9.31.
**The embed step is deferred to AFTER §2 deliberately** — doing it now and again pays
chunk+embed+index twice, and `LEX_SEARCH_VECTOR` is OFF. **STILL TO RUN when §2 lands:**
`v32-metadata-pass --commit` → `fts-hygiene` → `fts-catchup` (this is also what carries the §3
title enrichment into Lance) → heavy-job `fts-index` → redeploy `fts-serve` → `state:committees`
→ `check:loop` → `check:acceptance`. ▼ Earlier:
2026-08-07 17:52 UTC — ▼ **ALL THREE SEARCH-SIDE ACT-TITLE READS NOW USE
`corpus_acts`, AND THE 12.6 GB IN `corpus_sections` HAS BEEN TAKEN APART COLUMN BY COLUMN.**
Report: `docs/CORPUS_SECTIONS_STORAGE_AUDIT.md`; CHANGE_LOG (2026-08-07 17:52 UTC).
**Code changed but NOT committed** (§12 — end-of-sprint `commit-all.sh`); the storage half is
**read-only: no schema changes, no rows written, nothing dropped.**
`vector-search.ts:128` was repointed **first and alone** (it is on the path step 7 switches on),
then `fts-search.ts:195` and `citation-resolver.ts:29` (the ActIndex loaded at **`fts-serve`
boot**). Verified at three levels: whole-table **135,531 = 135,531, 0 missing, 0 differing**;
12,520 real hit gids → **8,569 titled under both, 0 missing, 0 differing, same 3,951 fall-throughs**;
and the REAL exported `loadActIndex` run against Neon → **135,236 byTitle entries**, "Section 21
Housing Act 1988" → `ukpga/1988/50 section-21`. `tsc` clean both sides.
⚠ **The "mechanical swap, no behaviour change" premise was 99.93% right, not 100%: 95 of 135,236
titles (0.070%) now resolve to a different gid** — all inside the **173 normalised titles that carry
more than one gid**, i.e. devolved/EU twins and identically-titled 19th-century Acts. The old code
took whatever the plan returned first (arbitrary *and* not reproducible across boots); `ORDER BY gid`
now makes it deterministic. No principal Act moves. **Flagged for Charlie, not fixed** — which twin
should win is a policy question. Boot cost 384 ms → 743 ms, once per boot.
⚠ **STORAGE — the brief's question is answered: NO BODY TEXT IS STORED IN NEON.** There is no body
column; `compiledText` is already dropped (its slot still shows as `...pg.dropped.13...`). The
12,915 MB is 7,868 heap + 3,123 indexes + 1,922 TOAST over 17,903,304 rows.
⚠ **THE BIGGEST ITEM IS AN ABANDONED ARTEFACT NOTHING READS — `ftsVector`: 1,168 MB of column plus a
545 MB GIN index = 1.71 GB, about what the ENTIRE legacy DROP reclaims (1.73 GB), but with no live
callers, no FK constraints and no user data to migrate first.** No code reads
`corpus_sections."ftsVector"`; the maintaining trigger is a live `BEGIN RETURN NEW; END;` no-op that
still fires on every insert to a 17.9M-row table; only **684,359 rows (3.8%)** carry one, newest
2026-06-05 while rows arrived to 2026-08-07; `idx_scan = 0`. Also: **`r2Key` is 99.58% derivable from
`id`** (1,018 MB; all 74,896 exceptions are `tna-caselaw`), **`r2RawKey` (97 MB) is written and never
read**, and **866 MB of index serves ~nothing** (`fts` 545 + `format` 164 at 0 scans).
⚠ **Two tempting leads killed by measurement:** the table is **not bloated** (7,819 MB live vs
7,868 MB heap, ~99% fill — `VACUUM FULL` alone buys nothing), and **`sourceUrl`, the largest column at
1,695 MB, is neither derivable nor constant per document** (6.74M distinct URLs), so normalising nets
~900 MB for a join on every hydrate.
⚠ **`DROP INDEX` returns space immediately; `DROP COLUMN` does not** — the bytes need a
`VACUUM FULL`/`pg_repack` rewrite that wants room for a second copy of a 12.9 GB table, which at 91%
full could hit the ceiling rather than relieve it. **Drop the unused indexes first (709 MB,
immediate), then the columns, then rewrite.** Arithmetic: the four no-reader candidates are
**1,974 MB → 80.0%**; add the `status`/`notes` indexes → **78.2%**, clearing the alert; with the
legacy DROP too → **68.3%**. **Recommendation: do the four no-reader candidates BEFORE the legacy
DROP.** Still on `LegislationItem`: `backfill-citations.ts:48` (build-time) and the six web-app paths.
▼ Earlier:
2026-08-07 13:35 UTC — ▼ **V26 §6 LEGACY DROP RE-AUDITED: STILL BLOCKED, BUT THE
BLOCKERS ARE NOW THREE SMALL NAMED PIECES OF WORK.** Report: `docs/V26_LEGACY_DROP_RECHECK.md`;
CHANGE_LOG (2026-08-07 13:35 UTC). **Report only — nothing dropped.** Triggered by the new
serve-observer firing a real alert on its first live run: **Neon 15.93 GB / 17.5 GB = 91%.**
`corpus_acts` was built to replace `LegislationItem`'s Act-title role and the 4 Aug repoint moved
three call sites — **but nothing was actually switched over.** (a) **Six live web-app read paths
remain**, the sharpest being `gateway-legacy.ts:287`, which reads `LegislationSection`, is **not
flag-gated**, and sits on the **Lex chat** route. (b) **All three search paths still read
`LegislationItem`** — `fts-search.ts:195`, `vector-search.ts:128`, and `citation-resolver.ts:29`
(the 135,531-row ActIndex loaded at **`fts-serve` boot**); none uses `corpus_acts`. (c) Seven FK
constraints point at the two tables; six are on empty tables but **`IdeaLegislation` holds ONE row
of real user data**, so no casual `DROP … CASCADE`, and the *write* paths need repointing too.
**`corpus_acts` is a verified ZERO-GAP drop-in** — 135,531 vs 135,531, **0 gids missing, 0 titles
differing** — so the remaining work is mechanical. ⚠ **THE DROP WOULD NOT CLEAR THE ALERT:** 1.73
GB reclaimable takes Neon **91.0% → 81.1%**, still over the 80% threshold; `corpus_sections`
(17.9M rows, **12.6 GB of the 15.93**) is where the storage question actually lives.
⚠ **RECOMMENDED BEFORE STEP 7: repoint `vector-search.ts` to `corpus_acts` first** — it is on the
path about to be switched on, so leaving it adds a NEW live caller to a table we intend to drop.
▼ Earlier:
2026-08-07 13:20 UTC — ▼ **SEARCH: `vector-serve` IS DEPLOYED AND INERT, THE
`corpus_chunks` INDEX IS BUILT, AND BOTH SERVE SERVICES ARE MONITORED.** Executes the "CC — vector
serving" brief steps 1–6 plus the MAX_CHUNKS cost addendum. Reports:
`docs/VECTOR_SERVING_STEPS_1_3.md`; CHANGE_LOG entries at 12:49 and 13:20 UTC.
**BOTH GATES STAY SHUT — `VECTOR_SEARCH_URL` is unset locally and in Vercel, `LEX_VECTOR_STREAMS`
is unset; nothing routes to the new service.** `vector-serve-production.up.railway.app` is live,
warm and unreferenced. ⚠ **THE BIGGEST FINDING WAS NOT IN THE BRIEF: `corpus_chunks` (21.8M rows)
had NO INDEX**, so snippet hydration was a full scan costing **76% of every query** against 21% for
the ANN search — proven by an IN-list of 1 id costing the same as 20 (~6s) while the same table
with no predicate returned in 132ms. Index now built via the Heavy Job Runner (**39.1s, 1.72 GB
peak, €0.010**); snippets fell **74%** (7,825→2,036ms) and total query time ~61% (10.4s→4.0s
local). ⚠ **Charlie's prediction was half right** — snippets are still the largest phase (51%), ANN
did not become dominant (40%); the residual is random-access R2 reads an index cannot remove.
⚠ **The index build's FIRST attempt failed on a 32 GB box whose peak RSS was 42 MB** — DataFusion's
internal memory pool, not machine memory, so a bigger box would have failed identically; fixed with
`LANCE_MEM_POOL_SIZE`, diagnosed for €0.005. **B3 answered on Railway under real load: peak RSS
809 MB = 10.6% of the 8 GB cap** at 25 concurrent, 0 errors, 0 sheds (the brief's "21.8M vectors
opened at boot" premise was wrong — `openTable` is metadata, not a load); `fts-serve` 13.5%.
⚠ **THE HANDLE-POOL ANSWER IS NO, AND THE FIRST ANSWER WAS AN ARTEFACT**: a 1.29× "gain" inverted
to 0.82× when the cell order was reversed — it was cache warming, and one handle already scales ~4×
with concurrency. ⚠ **The result cache was NOT built to the specified `{query, tier, limit}` key**:
debates and committees share `tier='parliamentary'` and differ only by corpus scope, so that key
would serve one stream's results to the other. Hit rate is a **model, not a measurement** (no query
log exists): 0%/45%/62.5%/87.5% across four stated profiles; the model-independent result is that
25 simultaneous identical requests became 3 units of database work. **MAX_CHUNKS addendum: the
"~$600 full re-embed" is refuted** — raising the cap moves no boundary (1,321 stored chunks
re-derived byte-identical, 0 mismatches), so it is a **$284 incremental top-up**, $157 for cap 32,
vs $785 for a real re-embed of which $501 re-pays valid vectors; **the FTS side needs nothing at
all** (it stores whole bodies, never chunks). Top-up **deferred until after the committees
per-finding re-chunk** so it does not embed chunks about to be superseded. **Monitoring live**:
`serve-observer.ts` on the ops hourly tick, both services, immediate email on memory >70% / p95 >5s
/ crash / Neon >80% / rejections >0, daily digest to cl@scrutinise.org; 28 checks pass.
⚠ **A REAL ALERT IS ALREADY FIRING: Neon is at 15.93 GB of its 17.5 GB ceiling — 91%.**
⚠ **Two Railway calls report success while doing nothing**: `serviceCreate({branch})` no longer
creates a repo trigger (the first deploy created a service with no deployment and a 404 domain),
and `serviceInstanceRedeploy` is a no-op when there is no deployment to re-run —
`fts-serve-run.ts` makes the same call and would fail the same way. **Standing decision recorded**
(`SEARCH_STRATEGY.md` §6b.2): chunk SIZE and OVERLAP are permanently fixed, only `MAX_CHUNKS` is
raised; the geometry is env-overridable and **not recorded in the checkpoint**, so it must be
pinned on any future chunk run. **REMAINING: step 7** — set `VECTOR_SEARCH_URL` in Vercel, load-test
at the router's real fan-out, then flip `LEX_VECTOR_STREAMS` one stream at a time, legislation
first, committees last. ▼ Earlier:
2026-08-07 10:46 UTC — ▼ **INGEST V32: THE COMMITTEES BRIEF'S PREMISE IS WRONG —
THE REPORT BODIES WERE NEVER STUBS.** Executes the audit half of
`BRIEF_INGEST_committees-content-gap.md` §1–2 and the `_ADDENDUM` §A2/§A3/§C. Full account:
`docs/V32_COMMITTEES_AUDIT.md`; CHANGE_LOG "INGEST V32" (2026-08-07 10:46 UTC).
**Read-only against the corpus — no rows written, no index touched, nothing committed.**
`GOLD_TEST_09` inferred "stubs" from row COUNTS (2,575 rows / 2,511 titles); the count is right
and the inference is wrong, because this ingest writes **one section per document**. The bytes:
`Report:` rows run to a **7,524-word median, 125,347 max**, 9 of 2,575 under 500 words.
⚠ **THREE DEFECTS, each enough alone:** (1) report bodies effectively **start in 2020** — pre-2020
the API lists the publication and serves no document, which is why Carillion (2018) is missing;
(2) **one report is one search document**, up to 455,137 chars, so BM25 length normalisation
buries it before a depth-200 probe can test it; (3) **PDF extraction keeps the PDF's line breaks**,
so `"…public \nhealth failures…"` does not contain `"public health failures"`.
**So GOLD_TEST_09's "all 10 phrases absent" was partly a MEASUREMENT ARTEFACT — re-measured, 5 of
10 are already in the corpus**, two invisible to a literal scan; and `"unimaginable cost"` **was
never in the report at all** (the PAC report is held and says "£37 billion" — the phrase looks
like the Chair's press wording). Honest denominator **9: five present, four blocked on the
historical gap**. **THE SOURCE HAS EVERYTHING:** 7,651 report/response bodies exist at source but
are not API-downloadable, and **every one carries an `additionalContentUrl`**. Both archive hosts
are behind a Cloudflare bot challenge (403 to `fetch` on any UA *and* to headless Chromium; a real
Chrome passes — fingerprinting, not an IP ban). **Wayback works programmatically and was proven on
the Carillion report**, "recklessness, hubris and greed" included — Charlie's call, that is the
route. ⚠ **MEASUREMENT TRAP:** an unfiltered `/api/Publications` year walk 500s partway through
most years and **returns a truncated year rather than an error** (2018 died at skip=3700 of 4,191)
— the first audit pass understated the gap that way; `listCommitteesApiPage` now takes a
`publicationTypeId`. **§A3 CAN BE CLOSED** — oral evidence is already full transcripts (15,264
rows, median 14,511 words, 5 under 500). §A2 responses are already full bodies with the same
historical gap. §C: Commons, Lords and Joint all present every year. §B/§D join keys all exist on
the listing item (inquiry id on 46.1%; the rest genuinely are not inquiries).
⚠ **REPORTED NOT FIXED, and it is corpus-wide rather than committees:** `chunk.ts` caps at
`MAX_CHUNKS=8` ≈ 3,370 words, silently — **242,957 sections exceed it and only 59.4% of the
corpus's body words ever reach the vector index** (24.4% for committee reports, 13.4% for
`uk-treaties`). `LEX_SEARCH_VECTOR` is OFF so it serves nobody today, but it is baked into the
index a flag flip would switch on. Charlie's call: record, don't act.
**BUILT AND VERIFIED:** `shared/report-sections.ts`, the per-finding splitter, with
**losslessness as an enforced invariant** — `npm run check:report-sections` is **19/19**,
including four negative controls that exercise the REAL exported assertion, not a copy, plus a
live pass over 120 real bodies. The fixtures caught a genuine bug: an unpunctuated body collapsed
to one indivisible 15,830-char section, the exact blob this work exists to break up.
`v32-rechunk-reports.ts` is built with an attempted-vs-stored reconciliation that exits non-zero
on mismatch. **PREDICTION RECORDED BEFORE THE PASS:** 3,842 held bodies → **78,776 sections
(×20.5), $4.68**; 7,651-document backfill → ~156,875 sections, **$9.31**; **combined ~235,651
sections, $13.99**.
⚠ **`--commit` DELIBERATELY NOT RUN.** Base brief §6 requires the FTS catch-up AND the index merge
to follow the rows, and the merge is a heavy job (19.8 GB, never Railway, §17) that could not
follow in the same session; landing 74,934 rows while Lance still held the superseded blobs would
put corpus and index out of step — the July mistake the brief names. **The mutation and the index
work should run as one operation.** REMAINING: the Wayback backfill source, the §B/§D metadata
pass, the embed run, and the §E Carillion loop test (blocked on the backfill). ▼ Earlier:
2026-08-06 20:57 UTC — ▼ **LEX: WEB/X ORIENTATION IS BUILT, MEASURED AND OFF BY
DEFAULT.** Executes the "CC — Web/X orientation, Stage 0" brief (6 Aug 2026), building
`SEARCH_STRATEGY` §6d. Full account: CHANGE_LOG "LEX — Web/X orientation, Stage 0"
(2026-08-06 20:57 UTC); the gold set and the open decisions are
`docs/GOLD_TEST_10_web_x_orientation.md`. **Scope kept deliberately narrow: the Page-1 initial
background briefing ONLY**, the same caller Stage-3 expansion targeted first — not idea-chat, not
every Lex turn. Ran alongside the Central thread and stayed in its lane (`lib/lex/**`, one Prisma
column, one check script, the shared docs). `tsc --noEmit` and `next build` both clean; **30/30
checks pass** (`npm run check:orientation`). **`LEX_WEB_ORIENTATION` REMAINS OFF; no flag was
flipped.** Three passes run **concurrently with the corpus search** and the briefing is written
once, complete (Charlie's call): Gemini web grounding (Tier B — dated, cited background +
comparative practice) and two Grok `x_search` calls (Tier C — a 90-day recency scan and an
explicitly unbounded argument-mining pass, §6d.1's two windows). **Coverage 10/12 signals (83%)
against a corpus-only control of 1/12 (8%)** on a new five-question gold set **whose answer key
was written from an independent ordinary web search BEFORE the layer was run against it** —
scoring a layer against its own output only proves self-agreement. The sharpest case: on
"enforcement against water companies" the corpus confidently names Ofwat as the regulator and the
orientation pass reports **Ofwat is being abolished and replaced** — a white paper cannot be in a
corpus of enacted law, and that is exactly the miss this layer exists to remove. ⚠ **83% is one
run, not a constant** — an earlier identical run scored WX4 2/3 and WX3 1/2; whether Gemini's
grounded pass searches deeply enough is non-deterministic on identical input, recorded rather
than smoothed. ⚠ **TWO PROVIDER PREMISES IN THE DESIGN DOC WERE FALSE, both found by probing:**
Gemini returns a **hard 400** for grounding + JSON mode (so the web pass is ground-then-structure,
and the structuring call may cite **only by index into the chunks Google actually returned**, so
a model-invented URL cannot survive), and **xAI Live Search is DEAD — HTTP 410**, superseded by
the Agent Tools API (`POST /v1/responses`, `tools:[{type:'x_search'}]`, which unlike Gemini *does*
combine tools with structured output, and carries the per-tool date bounds §6d.1 needs). ⚠ **The
grounded call was silently truncating** — `finishReason: MAX_TOKENS` on every call at 4096 tokens,
and a truncated grounded response sometimes returns **no grounding metadata at all**, which was
discarding the whole Tier B half and leaving an **all-Tier-C briefing**, the precise state the
tier design exists to prevent; fixed with caps + an 8192 budget (`STOP` and 28–37 chunks on every
repeat) plus one logged retry. ⚠ **grok-4.3, not grok-4.5, on measurement:** 21.2s/$0.0344 vs
57.1s/$0.2322 for comparable output, and **`max_tool_calls` is not honoured** so it is no cost
control. **QUARANTINE (§6d.3) IS MECHANICAL AND PROVEN ABLE TO FAIL:** Tier C cannot be rendered
without its marker, attribution and date; a sweep re-reads the **finished** briefing; a planted
violation is detected (and a separate summary-leak case); a failed sweep **drops the block** rather
than shipping it. The marker is inline bold, not a blockquote, **because the docx/PDF renderer has
no blockquote support** and a `>` would look right on screen and export as a stray character.
⚠ **THE COST OF THE SHAPE CHARLIE CHOSE: 30.8s and $0.0763 per briefing, measured** — the
"wait for one complete briefing" decision was taken against an estimate of **4–9s**, and §10.4
records a 1–3s tolerance for this moment. **This is decision D1 and needs his eye**; the two-phase
alternative is a contained follow-up, not a rebuild. ⚠ **A stage budget was needed and is
load-bearing:** per-call timeouts do not bound the stage (the web pass is two sequential calls), so
this could have run to ~120s against `maxDuration: 60` and 504'd the briefing mid-write — the exact
§19-C failure already paid for once; `ORIENTATION_TOTAL_BUDGET_MS` (45s) bounds it and an overrun is
reported as an abandonment, not as a provider failure. **Flag-off is proven byte-identical** on the
real briefing builder every run — which caught a real bug: the render gate keyed off `failed`, and
with the flag off `runOrientation` returns `failed:false` with no calls, so an empty "current
context" section would have been rendered into **every** briefing while the flag was off (gate is
now `calls.length > 0`). Additive `Idea.orientation JSONB` applied to Neon after a whichdb check and
re-run once to prove idempotence; the record is stored even when the corpus search fails but is
**not rendered** then — a briefing whose corpus half failed shows the failure and a Retry, never
Tier B/C standing in for the law. ⚠ **ALSO FOUND, REPORTED NOT FIXED: `grok-3-fast-beta` — Lex's
hardcoded fallback model in `app/api/ai/[ideaId]/route.ts:561` and `app/api/ai/public/route.ts:148`
— is no longer in xAI's `/v1/models`**, so that fallback path is presumably dead in production.
**REMAINING GATES: Charlie's decisions D1–D4 in GOLD_TEST_10**, and `GROK_API_KEY` +
`LEX_WEB_ORIENTATION` are **not in Vercel** (inert without the flag; the key is needed before it is
ever turned on there). ▼ Earlier:
2026-08-06 20:41 UTC — ▼ **CENTRAL STAGE 1.2: THE BRANCH-MEMBERSHIP MODEL IS
BUILT — JOIN REQUESTS, ROLES, MULTI-BRANCH MEMBERSHIP AND THE INVITE EMAIL.** Executes the
"Central Stage 1.2 — membership, join requests & roles" brief (6 Aug 2026), carrying Charlie's
settled decisions. Central + email only. `tsc --noEmit` and `next build` both clean; **83/83 checks
pass against the live app DB** (`npm run check:central`, up from 38). Full account: CHANGE_LOG
"CENTRAL Stage 1.2" (2026-08-06 20:41 UTC); the model is written up in
`SCRUTINISE_CENTRAL_SPEC.md` §3.3 with the decision log corrected to chronological order.
**Schema:** `prisma/central_stage1_2.sql` — `CommunityJoinRequest` + backfill, **hand-written, not
from `migrate diff`** (that still wants to drop the 914k-row `LegislationSection_DEPRECATED` table
and `specialist_queue`); column types read off production first and matched; applied after
`whichdb`, re-run once. ⚠ **The duplicate-pending guard is a PARTIAL unique index Prisma cannot
declare** — `(communityId, userId) WHERE status='PENDING'` — so it lives only in the SQL and is
flagged in the model comment: **a future `migrate diff` will want to drop it, don't let it.** Partial
is the point: a plain `@@unique` would make a declined request permanently un-repeatable, and
re-requesting after a decline is deliberately allowed. **The invariant this sprint establishes:**
belonging to a branch means belonging to its root Community — `joinCommunityAndRoot()` is the only
way in, idempotent, root always at MEMBER (owning a branch ≠ owning the Community). The backfill's
effect was **predicted before it ran and matched exactly**: one row. **Requests** reach everyone who
can act on them — the node's own admins *and every ancestor admin* — in a Requests panel and in
their Feed; a decision is authorised against **the request's own node, not the `[id]` in the URL**,
so a request from one branch can't be decided by aiming the route at another node the caller
manages. **The visibility carve-out, precisely:** manage rights open a node's member list, its join
requests and its page — **not its board** ("you manage it from {Community}, which lets you run it,
not read it"); and a Community member can now reach a branch page they're not in, because the brief
requires the request affordance on the tree AND the branch page — they get the front door, not the
board. Everyone else still 404s. **OWNER is fixed in both directions** (not demotable, not
removable): a co-admin who could demote the owner could take the node. **Founding:** a top-level
branch is open to any Community member (the growth mechanic — you become its OWNER); a sub-branch
under an existing branch stays manage-gated. **Leaving** is self-serve, with two refusals that both
exist to stop something being orphaned — an OWNER hands over first, and leaving the root is refused
while you still own a branch in it. **Switch-or-add** is raised by a `?joined=1` flag on the link
rather than by guessing at "first visit"; nothing is ticked by default, and the branches offered are
scoped to this Community's tree. ⚠ **Invite email returns a RESULT, never silence:** `sendEmail`
goes quiet with no API key and on a suppressed address, which for an invite would tell an admin
their invitation was emailed when nothing left the building — the panel now says "Emailed to them as
well" or "The email did not go out — {reason}" and keeps the copy-link either way. **Verification**
now covers the partial index by inserting a duplicate raw (bypassing the friendly app check),
ancestor approval by a non-member, decline-then-re-request, who may found which branch,
promote→approve→demote, and every leaving rule; the email is exercised **against a suppressed
address**, proving the honest-reporting contract without putting real mail on the wire — a genuine
delivery is Charlie's browser check. Teardown deletes the notifications these flows send to real
accounts; residue verified at zero. **REMAINING GATE: Charlie's browser re-test.** Note: two type
errors appeared mid-sprint in `lib/lex/orientation/*`, another thread's untracked work in the same
tree — not touched, and cleared by the end. ▼ Earlier:
2026-08-06 14:26 UTC — ▼ **CENTRAL STAGE 1.1: THE FOUR USER-TEST FAILURES ARE
FIXED AND THE UX CORRECTIONS APPLIED.** Executes the "Central Stage 1.1 — user-test fixes" brief
(6 Aug 2026). Central + dashboard only; nothing in search/ingest/stats/Lex touched, and the
board-scoped keyword search deliberately does not reach for the corpus-search stack. `tsc --noEmit`
clean **and** `next build` clean; **38/38 checks pass against the live app DB**
(`npm run check:central`). Full account: CHANGE_LOG "CENTRAL Stage 1.1" (2026-08-06 14:26 UTC).
⚠ **Two of the four "failures" were discoverability, not absence — the audit changed the work.**
Voting and keyword search were both fully built in Stage 1; neither could be found. **0 BulletinVote
rows exist in the database**, which is the strongest available evidence that nobody ever located the
two bare ▲/▼ glyphs. Both now have prominent labelled controls — and a real bug surfaced beside
them: **the thread-list endpoint never returned the caller's own vote**, so the list showed
`myVote: 0` for everyone until a thread was expanded, i.e. your own vote looked as though it had not
registered. **The invite lookup failure was real:** `/api/users/search` matched name/username and
**not email at all**, despite its own comment claiming otherwise. Email now matches **exactly and
case-insensitively** — substring matching on an address is deliberately refused because it would let
anyone enumerate accounts from a domain fragment — and an address with no account behind it now
creates a real `CommunityInvite` against it rather than failing silently (**no email is sent**;
Central has no mail path, and "invited" with nothing delivered is the exact failure the item
exists to remove, so the link is always surfaced to pass on). **Idea teams were missing because
there was nothing to show:** `POST /api/ideas/[id]/groups` created the `Group` but never wrote a
`GroupMember` row for the creator, so **all 6 teams on the platform had 0 members** and a
membership-keyed dashboard query returned nothing; fixed at creation, backfilled, and the query
widened to `ownerId OR members.some`. **UX corrections:** hierarchy tree now genuinely nests
(indent + rail + `Branch · level N`) with **explicit Add branch / Rename / Assign manager buttons on
every node** — which required a permission change to work at all, since the admin routes demanded
OWNER/ADMIN *of the exact node* and the buttons were dead on any branch the caller had not created
(new `canManageCommunity()` treats ancestor admin as admin; **management only** — board and member
visibility still need a membership row on the node); 3-item/4-item dashboard collapse with
`Show all (N)`; nav renamed **"Central"**; the six-category set (Canvassing, Building Members,
Public Debates, Training, Running Councils, Questions) seeded on new Communities and migrated onto
all 4 existing ones, "Announcements" gone, `Training` carrying "Offer or request interview/media
training here" so the Stage 2c behaviour starts unprompted (**no admin category UI**, per brief);
and a **"Post to" branch/whole-Community selector**. A Community-wide post **stays owned by the node
it was written on** and only widens its visibility, tagged "Community-wide" on every board in the
tree. ⚠ **The display rule alone would have been a half-fix** — the detail, vote and reply routes
all resolved posts by `id + communityId`, so a Community-wide thread would have *rendered* on a
branch board and then 404'd on every interaction; `findBoardPost()` is the single reachability rule
all three now share. Additive schema (`prisma/central_stage1_1.sql` — `BulletinPost.scope`,
`Community.bulletinCategories`) applied to Neon after a `whichdb` check and re-run once to prove
idempotence. Category migration touched **0 post rows** (the only categorised post was already
`Questions`); the `Announcements`/`General` → `Questions` mapping is a judgement call and is
recorded as one. Verification is `scripts/check-central-stage1.ts`: standing assertions over real
data, then a disposable root→branch→sub-branch tree with two real accounts driven through **the same
`lib/community.ts` functions the routes call** — the vote transaction and invite lookup were moved
into that shared layer precisely so the test exercises production code rather than a copy of it.
**REMAINING GATE: Charlie's browser re-test** — the two new panels (Invite people, "Post to") get
their first click-test from him. ▼ Earlier:
2026-08-06 11:11 UTC — ▼ **SEARCH: THE FUSION WEIGHT IS 0.5 (MEASURED, NOT CARRIED), AND THE
COMMITTEES STREAM IS NOW SCOPED AT THE QUERY.** Search thread only; ran alongside CENTRAL and
LEX and touched nothing outside `scripts/ingest/search/**`, `scrutinise-web/lib/lex/*search*`,
`query-router.ts` and the shared docs. `tsc --noEmit` clean in **both** workspaces. Full account:
CHANGE_LOG entries at 09:57 and 11:11 UTC. **Both flags remain OFF; no flag was flipped.**
**(1) The weight.** Charlie's answer-key validation pass landed 6 Aug, so PROVISIONAL is cleared
from GOLD_TEST_03–07 — cleared **in `score-stream-fusion.ts`**, not just the five `.md` files, so a
re-run cannot regenerate it. ⚠ **The drafted-questions caveat is deliberately KEPT on 05/06/07**:
the pass reviewed the gold set, and the gold set has no questions for committees/caselaw/guidance.
The first sweep peaked at 0.5 — the *lowest* non-zero weight tested — so the grid was widened to
`[0,.3,.4,.5,.6,.7,.8,1]` and all five streams re-run; 0.5 survived as an **interior** maximum.
**0.5 is best-or-joint-best in EVERY one of the five streams** and wins outright on both the
per-stream and per-query averages, so it is not a compromise and no per-stream table is warranted
(`GOLD_TEST_08`, regenerable from sidecars by `weight-decision.ts`). legislation 55.7→63.0%,
debates 80.0→95.0%, macro 87.1→91.6%, micro 76.1→83.1%; **no stream regresses.** ⚠ **On debates,
the old 0.7 was the WORST fusion weight tested** — 10pp *below* BM25 alone. `VECTOR_WEIGHT`
default changed in `lib/lex/fusion.ts`; FUSION_REPORT and VECTOR_FULL_RECONFIRM banner-marked
SUPERSEDED on the weight. ⚠ **Scope the evidence honestly:** committees is flat at every weight and
contributes nothing; caselaw/guidance only separate BM25 from everything else. The decision rests
on legislation + debates — the two validated streams, 26 of 38 questions.
**(2) Committees — better questions will NOT fix it (`GOLD_TEST_09`).** ⚠ **CM1 scores 100% while
returning zero committee documents.** `committees-reports` is **71.6% correspondence**, and its
2,575 "Report:" rows span 2,511 distinct titles (~1 row each — stubs, not report bodies), so
**committee CONCLUSIONS are essentially not ingested**: a "what did the committee conclude"
question is unanswerable here however worded. Every committee subject is also a Chamber subject and
Hansard is 85× larger, so subject-vocabulary answer keys are Hansard-dominated; only inquiry jargon
("breed specific legislation" 184 vs 5) and the written-evidence register (148 vs 5) discriminate.
**One verified candidate question (CQ1) presented, two with their weakness stated rather than padded
to three. NOTHING RE-SCORED — awaiting Charlie's yes/no**, plus decisions D1/D2/D3 in GOLD_TEST_09.
**(3) The committees filtering bug — FIXED AND DEPLOYED (`COMMITTEES_PREFILTER_FIX.md`).** debates
and committees shared the `parliamentary` tier and were separated *after* retrieval, client-side —
but retrieval truncates to `limit` first, and committee content is 1.17% of that tier. ⚠ **Ruled IN
as a SECOND, INDEPENDENT defect:** measured at the real live depth of 60, CM1 got **1** committee
row of 60 vs **60** prefiltered (59 dropped); totals 87 → 240. **This partly corrects GOLD_TEST_09**,
which said CM1's 100% was purely Hansard — incomplete; real Carillion committee evidence exists and
the post-filter was hiding it. Fix is a server-side `SearchScope` (tier/corpora/excludeCorpora)
through both query services and both adapters, declared per stream; the dense half takes the **same**
scope (scoping only BM25 would be worse than scoping neither). ⚠ **Also fixed:** `resolveInjections`
fetched by `id LIKE` with **no scope predicate**, and injections score *above* the BM25 list, so an
out-of-scope legislation row would have appeared **first**. ⚠ **Deliberate asymmetry:** an unhonoured
*corpus* scope warns and degrades to the client-side filter (failing closed would have taken both
parliamentary streams to zero during the independent `fts-serve` deploy window); the *tier* check
stays fail-closed, since legislation has no `types` backstop. **DEPLOYED AND RE-VERIFIED** — the push
auto-deployed `fts-serve` (confirmed by polling the live endpoint until it echoed the new parameter,
not assumed); a live `Carillion` query now returns committee evidence where it returned Hansard;
all three streams re-verified SCOPING CONFIRMED with no warnings. **Committees returned 0–1 results
on the probe queries before and returns a full 24 after.**
**CARRIED FORWARD:** ⚠ **the `vector-query-service.ts` concurrency guard has NOT landed** — checked,
not assumed (zero matches, no commit touching it). It was a recommendation in
`VECTOR_DEPLOY_READINESS.md` that was never authorised; nothing is at risk while the vector service
is undeployed, but it is a prerequisite for deploying it (`fts-query-service` was killed outright at
15 concurrent requests, and the router fans out to 5). Also carried: a **GOLD_TEST_05 re-score** is
now worth doing since the stream retrieves very differently — but it needs the answer-key decision
first, so it was deliberately not done. ▼ Earlier:
2026-08-05 17:30 UTC — ▼ **LEX SPRINT 2.5: FEEDBACK CAPTURE AND DOCUMENT EXPORT
ARE BUILT AND VERIFIED LIVE.** Executes `docs/BRIEF_SPRINT_2_5.md`; both tasks done, all acceptance
criteria met. `tsc --noEmit` clean **and** `next build` clean, plus four check scripts run against
the live app DB and live R2: `check:sprint2.5-schema` 4/4, `check:documents` 31/31,
`check:feedback` 40/40, `check:export` 25/25. Ran alongside the Search and Ingest threads and
stayed in its lane: **nothing outside `scrutinise-web/**` and the three shared docs was touched**,
and nothing in the field machine, the conductor, the canonical-state contract or the panels' state
handling was modified. **Preview only, NOT promoted** — Charlie's Lex walk-through is unaffected.
**§20.5 feedback:** a critique of Lex can be passed back, and **nothing is stored or sent until the
user has seen the exact text and pressed Yes** — the API's `summarise` action writes nothing at all
and `submit` is only reachable after consent. `FeedbackItem` is on the app Neon DB
(`ep-old-dust-aboxi69a`/`neondb`, whichdb run first) via additive idempotent SQL
(`prisma/lex_sprint2_5.sql`, re-run once to prove it) — plus `sentAt`/`sendError`, which the brief's
field list lacked and "a mail failure must not lose the record" requires. **Personal content is
stripped three times by two mechanisms**: a deterministic scrub (email, phone, postcode, NI number,
card digits, DOB, address, handle, and the user's own name from their User row), then the model for
what regex cannot do (third-party names, employer, location, circumstance), then **the model's own
output scrubbed again** — it is instructed to strip personal content and not trusted to have done
it. Because an editable box sits between the summary and the send, `submit` scrubs a **third** time
server-side and a difference is a **409, not a silent correction** — otherwise we would send text
the user never saw. ⚠ **A real bug this found:** `sendEmail` returns *quietly* when
`RESEND_API_KEY` is unset or the address is suppressed, so a naive wiring would have set `sentAt`
and had Lex tell the user their feedback had been passed on — the exact §19-C 1b failure the brief
forbids. `sendLexFeedbackEmail` now throws in both cases, and the test **forces** the failure rather
than trusting the catch block. UI: the disabled "Give feedback" placeholder is live, the same action
sits permanently above the chat input, and Lex offers it inline on a detected critique. **§8.2
export:** docx + PDF of the Initial Background, **rendered from stored state only** — no briefing
means the export is refused with the reason, never invented. Built as a **block model with two
renderers** (`lib/documents/`), so §20-B's full proposal document is a new *builder*, not a new
renderer. **Never serves a stale file silently:** each pair carries a sha-256 `sourceFingerprint`
over exactly what was rendered, so re-running a search marks it out of date, replaces the download
buttons with "Generate the current version", and only hands over the old file through an explicit
`allowStale=1`; **an unknown fingerprint counts as stale.** `docxUrl`/`pdfUrl` hold the app download
path and `docxKey`/`pdfKey` the R2 key — a fresh 24h signed URL is minted per download behind the
same authorisation (security rule 10), because a stored signed URL is a stored expiry. Downloads
appear in the legislation panel and in a new **Documents** tab on the idea page, both showing what
the file was made from and when. Chose **pdf-lib over pdfkit** (pdfkit reads `.afm` metrics off
disk — fine locally, broken in a serverless bundle); the WinAnsi tax is handled by `toWinAnsi()`,
which keeps curly quotes, dashes, £, €, § and drops an emoji rather than throwing. ⚠ **Three traps
recorded in `LEX_PLAYBOOK.md` §15:** `tsc --noEmit` and `next build` do **not** cover the same files
(the build caught an error tsc passed — run both); a byte scan for `/Type /Page` **fails on a valid
PDF** because pdf-lib writes object streams, so reload with the parser; and a wrapped bullet was
silently splitting a list in two, found only by extracting the text back out of the finished files.
⚠ **The one layer not exercised end-to-end is the HTTP route surface** — Clerk needs a real session,
so the routes are typechecked and confirmed to load and authorise on a dev server, but the two
dialogs get their first true test in Charlie's walk-through. ▼ Earlier:
2026-08-05 16:55 UTC — ▼ **SEARCH: `corpus_fts` INDEX HYGIENE DONE — 19,161 ROWS
REMOVED, REBUILT, LIVE.** The carried-forward item #1 from the 4 Aug search sprint is CLOSED.
`corpus_fts` **17,700,664 → 17,681,503**: −13,575 duplicates (every one exactly 2 copies,
byte-identical across all 11 columns on an 80-id sample, so removal was lossless) and −5,586
orphans. **The brief's orphan estimate was 5.4× under — it said ~1,030, the exhaustive audit found
5,586**; re-confirming before deleting is what caught it. Both deletions matched the audit exactly;
post-deletion re-audit of all four affected corpora shows **0 duplicates, 0 orphans**. New tool
`scripts/ingest/search/fts-hygiene.ts` (`audit`/`export`/`delete-duplicates`/`delete-orphans`/
`verify`, dry-run by default, refuses to delete without the R2 export). The audit **proves its own
completeness** by reconciling rows-scanned against `countRows()` (`rows NOT reached = 0`), so rows
under a corpus the source no longer knows about cannot hide. **Root cause:** TheyWorkForYou
republishes a day's debates under an incrementing scrapeversion letter; ingest marks the old one
`unavailable` and collapses it to a `:1` placeholder, but `corpus_fts` kept the old version entire
AND took the new one twice. All 5,586 orphans came from just **15 day-files, every one with a
compiled successor of matching section count**, so no unique content was lost. Full rows (not ids —
the orphan source data is already gone) backed up to
`s3://scrutinise-legislation/_search/hygiene-backup/2026-08-04T23-54-06-437Z/`, **read back and
verified** before deleting. Index rebuilt via the Heavy Job Runner (cpx62, 509s, peak **19.4 GB**,
€0.049, self-destroyed) → `indexed=17,681,503 unindexed=0`; `fts-serve` redeployed and verified **by
data, not counters** (`/stats` read `served:0` beforehand, so a counter reset would have proved
nothing). Live warm p50 **859 ms**. ⚠ **RANKING HAS SHIFTED BY DESIGN** — removing 13,575 duplicate
documents changes BM25 document frequencies, so **any answer-key baseline taken before 5 Aug is no
longer comparable**; this directly affects SPRINT §2. ⚠ **15 `stale` rows deliberately NOT deleted**
(source row exists but is `unavailable`) — index sits at 17,681,503 vs 17,681,488 compiled sections;
removing them makes the two exactly equal, **Charlie's call, still open**. ⚠ **`corpus_vec` HAS THE
SAME DRIFT, UNFIXED** — it still holds chunks for sections deleted from `corpus_fts` (confirmed by
sampling), so vector search can surface superseded content keyword search no longer can; it was
built 22 Jul and never reconciled. Also fixed: **`fts-serve-run.ts` could never authenticate** — it
hardcoded `Authorization: Bearer` against what is a *project* token needing `Project-Access-Token`,
so every command in it, including the post-rebuild `redeploy`, failed with a bare "Not Authorized".
**Trap re-learned:** the harness reported the delete task "killed" while the OS process was still
running and writing — re-issuing would have raced two delete-and-re-add loops over the same ids;
check the process list before believing a stopped task stopped. ▼ Earlier:
2026-08-05 00:20 UTC — ▼ **STATS: STABLE SERIES IDENTITY, A BULK WRITE PATH, AND
PHASE B COMPLETED WITH IMF.** Executes `BRIEF_CC_stats-fixes_phaseB_resume.md`; all six sections
addressed. `tsc` clean both packages; **22/22 end-to-end checks pass against the live DB**
(`scrutinise-web/scripts/check-stats-layer.ts`, new) and the £1,157,828m / 33.2% / 20.9%
headline still reconciles exactly. **§1 (time-critical) DONE — the Search thread is UNBLOCKED:**
`stat_series.seriesKey` is `TEXT NOT NULL UNIQUE`, a sha-256 over (datasetId, measure, geography,
cofogFunctionCode, forecastVintage, seriesLabel), backfilled across all 3,404 series and now the
upsert target; index the stats catalogue against it and retrieve via the new `getSeriesByKey()`.
`unit`/`sourceSeriesId` are deliberately OUT of the key so a metadata repair lands on the
existing row instead of forking a duplicate. Acceptance test: every handler re-run, every series
count unchanged, **zero new duplicates**; `npm run check:series-key` is the standing guard.
**⚠ The write path was the real blocker and the docs understated it** — the per-row upsert
measured **~10 series/min (3.5h for one OBR dataset)**, and IMF's 66k rows would have been an
overnight job; `ingestRows()` now bulk-upserts ~500 rows per statement: **OBR 3.5h → 12.7s, IMF
→ 28.8s.** **§4 Phase B: IMF GFS COFOG is IN — 2,329 series / 40,351 obs, 22 countries,
2007–2025**, on the same COFOG axis as PESA/OECD; Eurostat optional-and-skipped, Phase C
confirmed **parked**. **Stats DB now 10 datasets / 5,733 series / 80,443 observations / 53 MB**;
`verify.ts` reconciles clean everywhere bar the known 24-row OBR residual (duplicate keys in
OBR's own workbook). **OECD COFOG is STILL 0 rows** — retried from a genuinely cold quota, all
7 windows HTTP 500. Two things closed there, though: **the untested server-side unit filter is
now TESTED and ruled out** (payload size is not the binding constraint), and **the `/all`
fallback was found to have never actually run** — `politeFetch` throws on 5xx, so `if (!res.ok)`
was unreachable for the only status that endpoint returns, meaning every earlier "we also tried
/all" reading was unverified. Fixed. Next step is one single-year request from a cold quota: if
that 500s too, the flow has moved rather than being throttled. **§2:** per-series `commercialUseExcluded` (restricted if ANY contributor
is); **OBR `unit='UNKNOWN'` 2,807 → 0**, so all those forecast series now reach catalogue search,
and `forecastVintage` now travels loudly into Lex's block. **§5:** `fts-catchup` already was the
append-safe mechanism — the missing half was that nothing ANNOUNCED the index debt; it now
reports coverage + an `INDEX RE-MERGE REQUIRED` banner + `.fts-index-debt.json`. Measured now:
**0 gaps, 0 rows missing, `unindexed=0` — nothing for Search to merge.** Also fixed there:
`--reindex` was rebuilding with `withPosition:true` against a no-positions live index.
**⚠ TWO BRIEF INSTRUCTIONS DECLINED ON VERIFIED EVIDENCE, both need Charlie's eye: (a) OECD
`commercialUseExcluded` stays FALSE** — terms §3 (Data) permits reuse "even for commercial use"
and has no 2024 date split at all (that is §1, Written Content, which also permits it); second
time this premise has failed. **(b) geography stays `GB`, NOT `UK`** — `GB` *is* the ISO-3166-1
alpha-2 code for the United Kingdom, and relabelling would have put UK spending in a different
geography from its own comparators; the *display* label was the real defect and is fixed
("United Kingdom"). **IMF is the first `commercialUseExcluded=true` source in the store** —
verified at source in a browser, reversing the 3 Aug "not ingestible" call. **Open gap recorded,
not guessed: price base travels nowhere** (no source exposes one; no column). ▼ Earlier:
2026-08-04 18:34 UTC — ▼ **SEARCH: THE FAST INDEX NOW REACHES USERS.** SPRINT §0
and §1 done; §2 not started (**blocks on Charlie's answer-key validation pass**), §3/§4 behind it.
**§0:** the `thinkingBudget:0` fix is in `origin/Main` HEAD *and* still load-bearing — probed live,
the control without it returns `MAX_TOKENS` with 469 thought tokens burned and truncated JSON.
**§1 freshness — the brief's premise was stale:** Scottish Parliament and CPS guidance are already
complete; the real gap was **268 rows in 2 pwdata corpora**, all dated 29 Jul. **A count-based audit
would have missed it** — five pwdata corpora have MORE rows in the index than in `corpus_sections`,
so counts show a *negative* gap; id-level reconciliation reveals three drift modes the counts
cancelled out: **~13,575 duplicates, ~1,030 orphans, 268 missing**. Only the last is fixed
(`fts-catchup` handles nothing else) — **duplicates + orphans are OPEN and matter before §2's
baseline: superseded Hansard versions are still searchable.** **§1a:** rebuilt via the Heavy Job
Runner (11.4 min, €0.056, peak **18.8 GB** — Railway's 8 GB cap could never), `unindexed=0`,
**`fts-serve` redeployed and it needed it** (`/stats` proved it had not restarted since 02:36 and
was serving the old snapshot); warm p50 **1,196 ms**, no regression. `served: 8` in a day is the
sprint's thesis in one number. **§1 act metadata:** new `corpus_acts` — 250,808 instruments,
1,609,670 sections attributed, **delta 0**, self-reconciling (`docs/ACT_METADATA.md`). Two traps
caught: `corpus_sections.jurisdiction` is the literal `'uk'` on all 1.6M legislation rows, and the
first build omitted the `regional` corpus and so reported **zero** searchable instruments for
Scotland/Wales/NI. **§1 repoint DONE** — idea-chat, LegislationPanel and `/api/search` now go
through `search-gateway.ts` via new `lib/lex/gateway-legacy.ts`, each keeping its exact existing
response shape. On the sprint's own worked example ("what is the law on data protection
currently?") the **old path returns NOTHING**, new+router-OFF returns 4 unrelated CELEX docs, and
**new+router-ON returns the Data Protection Act 2018** — the strongest case yet for flipping
`LEX_QUERY_ROUTER` (**not flipped — Charlie's call**). Honest caveat: with the router OFF the new
path is **not** uniformly better (legacy wins on "landlord repairs obligations") — unscoped BM25 is
noisy, which is what §2/§3 exist to fix. Browse repointed to `corpus_acts` at exact parity (10
filter combinations, same rendered page every time) **plus a pre-existing pagination bug fixed** —
`(year,title)` is not unique, so tied rows straddling a page boundary duplicated one instrument and
dropped another. Also: **`RAILWAY_API_TOKEN` is a PROJECT token — it needs the
`Project-Access-Token` header, not `Authorization: Bearer`** (every query returns `Not Authorized`
otherwise). **Still blocked on Charlie:** Vercel env unreadable (SAML 403) so production's
`LEX_QUERY_*` values and `FTS_SEARCH_URL` are unconfirmed. Earlier: 2026-08-04 16:53 UTC — ▼ **SEARCH LATENCY RESOLVED AND INDEPENDENTLY VERIFIED.**
`corpus_fts` `unindexed=0` (was 1,191,345 brute-force-scanned per query); `fts-serve-production`
warm p50 **1,250 ms** (was 25,520 ms), live query **0.62 s**. `/stats` counters had reset, confirming
`fts-serve` was redeployed after the rebuild — without that, any after-measurement is meaningless.
**A duplicate rebuild was avoided**: `jobs.ts` recorded the 4 Aug run and `fts-optimize.ts
--verify-only` (free metadata read) reported `unindexed=0`, so `run fts-index` was never invoked.
The semaphore/router-fan-out hypothesis was **refuted** by measurement (`queueMs:0` alongside
`ms:25344`; `queueHighWaterMark` 0 for the service's lifetime). **New: `docs/CLAUDE.md` §17 — heavy
jobs never run on Railway**, cross-referenced from `INGEST_PLAYBOOK.md` §20 and `docs/HEAVY_JOBS.md`.
**NEXT SPRINT IS WRITTEN → `docs/SPRINT.md`** (search thread: freshness → gold baseline → streams one
at a time → vector fusion last). **That sprint's §1 backfill REQUIRES a follow-up index rebuild
(§1a) — appended rows land un-indexed and are brute-force scanned on every query until merged; this
is how the 26-second p50 happened. The gold baseline in §2 must not be taken until `unindexed=0`.** **Still open and unchanged:** idea-chat, LegislationPanel and the
browse page all still call legacy `searchLegislation()` directly, not `search-gateway.ts` — the fast
index is not reaching users. §2 of that sprint **blocks on Charlie's human answer-key validation
pass**. Earlier: 2026-08-03 08:30 UTC — ▼ CORPUS REPORT + CDN + STATS PHASE B: corpus status
workbook shipped (`scripts/reports/`, 8 tabs, 70 corpora / 1,255 quangos / 17.87M sections —
**the spec the brief referenced did not exist**, so it was built to the brief's own tab list and
the spec written up); `xlsx` moved to the SheetJS CDN build, clearing the advisory in both
packages (**and `scrutinise-web` now typechecks clean**); **Stats Phase B World Bank live**
(257 series / 11,235 obs, comparative queries proven — UK vs FR/DE/US on health spend, tax and
life expectancy). **Two things need Charlie: the OECD `commercialUseExcluded` call (the brief's
CC-BY-NC premise is wrong — OECD T&C §3 permits commercial use, so the verified position was
taken), and IMF (NOT ingested — terms 403 everywhere, data says "All Rights Reserved").** **OECD
COFOG NOT loaded — 0 rows, a source-side blocker**: every window size 500s while a single year in
isolation returns 200, and the endpoint reports both quota exhaustion AND over-size as HTTP 500.
Diagnosed and instrumented; a partial 2022-only slice was deleted rather than left queryable. See its own CURRENT STATE section. ▼
2026-08-02 18:47 UTC — ▼ LEX REBUILD **Sprint 3-C** (§19-C) shipped to the preview
(NOT promoted): the stub fallback is out of production and a failed search now says so with a Retry;
a FACTS OF THIS TURN block stops Lex claiming things that don't exist; every stage entry runs its own
focused corpus search rendered in five groups with earlier stages folded; cost engine v0 (CostLine +
ASHE staffing suggestions + EANDCB flag). **Tasks 4/5 diagnosed differently from the brief** — the
generators all work; the FAILURE path was writing placeholder text into real fields, and the Lex API
had no `maxDuration`. Additive schema applied to Neon. See its own CURRENT STATE section. ▼
2026-08-02 00:36 UTC — ▼ LEX: **`query_stats` — Lex is wired to the statistics
database** and now answers "What does the UK spend most on?" from real PESA observations with
source and status attached, instead of parametric guesswork. Audit finding: Lex had no tool-calling
at all, and it cannot be added to the main turn (Gemini rejects `tools` + `responseSchema`), so the
tool is its own tools-enabled call. **Outstanding: `STATS_DATABASE_URL` must be added to Vercel by
Charlie** (the stored token can't authenticate to the team scope) — until then the tool
short-circuits and Lex behaves exactly as today. See its own CURRENT STATE section. ▼
2026-08-01 23:30 UTC — ▼ STATS: **the statistics DB is PROVISIONED and LIVE** —
separate Neon project `scrutinise-stats` (`winter-frost-26605722`, `aws-eu-west-2`, PG 17), both
migrations applied, all 7 Phase A datasets ingested, 17 MB. The first live run found **six real
bugs the offline build could not see, three of them reporting `SUCCESS` while producing wrong or
missing data** — ONS Beta ingested 0 of 1,960 rows, ALL UK health spending was being dropped from
PESA, 533 CDID rows were destroyed by a unique key that couldn't tell an annual observation from
Q1. All fixed and re-ingested; two new guards (zero-observation = FAILURE, and an
attempted-vs-stored reconciliation in the new `verify.ts`) make that class of failure visible from
now on. **Railway cron still NOT wired — paid resource, Charlie's money gate.** See its own
CURRENT STATE section. ▼ 2026-08-01 11:05 UTC — ▼ LEX REBUILD Sprint 3-B (§19-B): the three defects from
Charlie's 1 Aug pass-1 test are fixed, preview only, **NOT promoted**. Cause of the headline
breakdown found in the idea row itself, not guessed — see its own CURRENT STATE section. ▼
2026-07-31 00:03 UTC — ▼ STATS: Phase A (UK spine) sprint built end-to-end
(schema, ONS/OBR/PESA/HMRC sources, scheduler, Lex query layer) — all sources live-probed and
licence-verified (OGL v3.0), pilot measured with zero DB writes (4,081 series / 28,866 obs on
the ingested slice). **No database provisioned — Charlie's DB-choice call still open**, see its
own CURRENT STATE section. ▼ 2026-07-30 04:32 UTC — ▼ SEARCH: query router — guidance added as 5th stream (B
+15.3pp, A holds +10.0pp, C partially recovers -20.0→-13.3pp), the flagged fts-query-service.ts
concurrency risk CONFIRMED real (crashed the live service at 15 concurrent requests — the exact
load the router's 5-stream fan-out produces) and FIXED (global semaphore, re-tested clean).
**Recommend flipping `LEX_QUERY_ROUTER=true` — not flipped this session, Charlie's call.** See its
own CURRENT STATE section. ▼ 2026-07-29 20:14 UTC — ▼ SEARCH: FTS rebuild + cursor fix COMPLETE — `corpus_fts` fully
reconciled (0 gap across all 70 corpora, 1,172,169+ rows backfilled incl. all of scottish-parliament-or,
uk-treaties-fcdo, parliament-treaties, cma-cases, the Hansard partial gaps); new append-safe
`fts-catchup.ts` ships for future drift. Hit + resolved a real operational incident along the way
(harness "kill" doesn't actually kill the OS process here — caused a duplicate-write mess, cleanly
fixed) — see its own CURRENT STATE section for the full story. ▼ 2026-07-29 19:25 UTC — ▼ SEARCH:
query router built + measured (`LEX_QUERY_ROUTER`,
default OFF) — one LLM call routes per-stream (legislation/debates/committees/caselaw), generalising
Stage-3 expansion; gold-set B +12.5pp, A +10.0pp (not diluted — citation-exact special case confirmed
working), C -20.0pp (guidance stream not yet routed, an honest expected cost, not a bug) — see its own
CURRENT STATE section. ▼ 2026-07-29 16:12 UTC — ▼ FTS rebuild + cursor fix PULLED OUT of the queued Act-metadata
sprint and run separately (ready-now, independent) — see its own CURRENT STATE section. ▼ 2026-07-29
13:04 UTC — ▼ shipped the Stage-3 query-expansion fix (`thinkingConfig:{thinkingBudget:0}`, commit
`eb8641f`) — see below. ▼ 2026-07-29 12:10 UTC — ▼ ADDENDUM to the queued sprint's item-4 number: **the headline combined legacy total is
1,049,805 rows, not 914,274** — 914,274 is `LegislationSection` alone; `LegislationItem`'s 135,531 rows
are separate/additional and gated on item 2 (Act-metadata table), not item 1 (route swap). Use
1,049,805 for Neon space-planning when this sprint is scheduled — no other change to the still-queued
Act-metadata sprint. ▼ QUEUED (not started): Act-metadata sprint scoped (now 3 items — FTS-freshness
pulled out, see above) — the one pre-scheduling number Charlie asked for is answered: see the addendum
above for the corrected total. ▼ 2026-07-29 08:10 UTC — ▼ SEARCH: stale-vector mechanism IDENTIFIED (not deletion — `corpus_fts` is stale) + scoped legislation-tier recall test on B1–B3 (see CURRENT STATE below). ▼ 2026-07-22 — ▼ SEARCH VECTOR REBUILD on a 128GB Vultr box **did NOT recover recall** (vector-alone 70.5% post-rebuild vs 71.2% pre-, reproduced twice) — the compaction-skip diagnosis from earlier the same day is REVERSED; the true cause is an open search-quality question (see CURRENT STATE). Positions-rider bonus ABANDONED (hard R2 10,000-part multipart-upload limit, non-retryable). `LEX_SEARCH_VECTOR` stays OFF. ▼ 2026-07-21 — ▼ SEARCH VECTOR EMBED **COMPLETE**: full-corpus batch drain finished (1,821/1,821 shards), ANN index build OOM'd at fragment compaction on the 32GB box (CCX43 fallback blocked by Hetzner account quota) — fixed via `VECTOR_SKIP_COMPACT=true` (skips compaction, indexes the fragments directly), index built in 711.7s. **21,846,364 vectors, 0 misses, `phase: "done"`.** Caveat: un-compacted build logged Lance kmeans "empty cluster" warnings — quality not yet independently confirmed, rides on the already-planned gold-set/fusion re-confirm before the flag flip. See CURRENT STATE below. ▼ 2026-07-11 (laptop diagnosis) — ▼ INGEST TREATY COVERAGE EXTENSION (executes `TREATY_INGEST_BRIEF.md`, 8 Jul): `uk-treaties-fcdo` NEW corpus — FCDO UK Treaties Online reverse-engineered anonymous JSON API (treaties.fcdo.gov.uk, legacy JBoss/Knowvation, no bulk export, JS-only SPA); **honest-denominator correction: measured universe = 21,970 records, not the ~15,000 brief/gov.uk estimate**; 33% carry a PDF (full text), 67% metadata-only (surfaced honestly, not dropped); 127 dedup skips vs existing `uk-treaties`/`tax-treaties-dta`; pilot passed clean; **21,840-row backlog SEEDED, DRAINING in the background (not complete this sprint)** — live `ops`/`Ingest` Railway service picks it up automatically, no action needed. `parliament-treaties` NEW corpus — CRaG-2010 scrutiny register via the documented `treaties-api.parliament.uk` API (laid dates, scrutiny status, committee/debate timeline); kept separate from `uk-treaties-fcdo` (different id space + content kind, CC's call per the brief); **328/328 SEEDED + DRAINED this sprint, 0 failures.** Both licence-verified OGL3/OPL3, rate-limited, corpus-mapped. CHANGE_LOG "INGEST — Treaty coverage extension" (2026-07-08 16:33 UTC). ▼ SEARCH VECTOR EMBED — **TIER 2 FLIPPED; batch embed LIVE & progressing, 851/1,821 shards (~46.7%), 10.21M vectors, 0 misses at 21:32 UTC — NOT stalled** (the prior "paused/blocked" read was a ~24.5h-behind laptop clock + a sync-only £46.55 console snapshot; see CURRENT STATE). **Shipped the missing email observer** (`search/embed-observer.ts` → `ops`: stall/crash/ANN-stuck/daily-heartbeat alerts; deploys on next push). Historical tier-wall note follows. ▼ SEARCH VECTOR EMBED — TIER WALL + SYNC MODE (7 Jul, now superseded): full-run STEP 1 **DONE** (17,640,560 sections → **21,846,364 chunks** in `corpus_chunks`, 230 misses, ~32h cpx62); STEP 2 blocked — **account is Batch Tier 1 (500k enqueued-token queue; probed + docs-verified T1 500k/T2 5M/T3 10M)**, 40k shards ≈ 12.4M tok fit NO tier; also fixed en route: node default-heap OOM on the 21.8M id load (`NODE_OPTIONS=--max-old-space-size=28672`) and GEMINI_API_KEY missing from cloud-init (carve-out commit `c715e00`). Zero Gemini spend lost. **BUILT INERT this sprint:** `VECTOR_EMBED_MODE=sync|batch` (NEW `gemini-sync.ts` — standard-rate embedContent, global 950k-TPM pacer, same shard plan/checkpoint), checkpoint-pinned shardSize, batch sub-job token splitting (`VECTOR_BATCH_JOB_TOKENS` 4.5M — dense caselaw regions ~800 tok/chunk), `gemini-tier-probe.ts` tier detector. **Gated plan:** sync slice ~667M tok ≈ $100 (~11.7h) → auto Tier-2 flip → batch remainder ~$370–460 with SHARD_SIZE=12000/INFLIGHT=1 → revised total **~$470–560** (under the ~$600 gate; Tier-1 monthly cap £189≈$250 accommodates the slice). Report `docs/VECTOR_EMBED_REPORT.md` §5. ▼ GRAPH TIER 1 (COMPLETE): explicit-edge legislation graph — Neon `legislation_edges` **2,348,993 edges / ~0.94 GB** (amends 1.02M · commences 478k · repeals 322k · made-under 231k · modifies 181k · cites 121k), all from bulk TNA sources (bulk-before-API held; no LLM extraction); rescission traversal `impactSet()` + `/impact` service (fts-serve pattern, smoke-tested 224ms); **gold archetype D un-floored 0% → 80%** (D1–D4 = 8/8; D5 needs case-law edges, out of sprint scope). Audit refuted the fragments-have-Citation-markup premise — whole-doc bulk CLML + bulk amendments XML are the real sources. Report `docs/GRAPH_TIER1_REPORT.md`. **⚠ Neon now ~16 GB of the 17.5 GB line.** ▼ Earlier: SEARCH VECTOR EMBED (BUILT INERT): full-corpus gemini-embedding-001 @768-d batch-embed pipeline + IVF_PQ ANN + OFF-by-default gateway wiring (tuned 70/30 fusion). Actual corpus **17.64M sections / 6.12B words → ~22.25M chunks / ~5.7–6.9B tokens → ~$430–520** at the batch rate ($0.075/1M) — **within the ~$600 gate, no flag raised**. **CANARY RUN + PASSED (4 Jul, ~$0.01):** live Batch API contract confirmed — 200/200 vectors @768-d, order/keys clean. Remaining spend = the full Hetzner+Batch run (~$430–520), Charlie-triggered. `@google/genai` added. Report `docs/VECTOR_EMBED_REPORT.md`. ▼ SEARCH FUSION TUNING (pilot subset, no new embed cost): **weighted RRF fixed 70/30 vector/BM25 ships** — gemini 87.8% recall@20 vs naive RRF 84.3% / vector-alone 85.9% / BM25 68.3%; the pilot's naive-RRF regression is RESOLVED (fusion now beats vector-alone). **Kind-based routing NOT needed** — the full (wCit,wCon) grid over the `parseCitation` router only TIES fixed 70/30 (87.8%); at 70/30 the citation-resolver pin survives fusion (A=100%), ≥80/20 breaks A1. voyage confirms vector-heavy (80/20=86.9%, B6 naive-collapse FIXED 0→33.3%); e5 optimum stays 50/50 → the right weight tracks vector-arm strength. Ship spec: w=0.7 RRF_K=60 as env config, no router. `docs/FUSION_REPORT.md`. ▼ SEARCH type-taxonomy fix (§10.2): 13 hidden corpora → 4 (all intentional); scottish-parliament-or (1.04M)→DEBATE, regulators/reviews→GUIDANCE (`corpus-type-map.ts` display override). retained-EU/SI already mapped correctly; MiFID miss is RANKING (B6), not display → vector layer. ▼ SEARCH VECTOR PILOT: embedding-model bake-off on the gold set. **Winner gemini-embedding-001** (vector 85.9% / hybrid 84.3%, +16pp over BM25); voyage-4 TIES on vector (85.9%) but no legal-specialist premium; e5 open-weight 70.5%. Vector layer's big win = archetype B +45.8pp (lay-concept); B6 burial 0→50%. Equal-weight RRF hurts strong models → route/vector-weight the fusion. Full embed with gemini gated on Charlie (test @768-d). ▼ 1 Jul 2026 — SEARCH: Stage 3 PAYOFF MEASURED (recall@20 A/B, OFF vs ON). **B +15.3pp (33.3→48.6)** — expansion bridges lay vocab to anchor Acts. **A NOT flat (+10pp, bidirectional)** — helps concept queries (A5 +100) but HURTS precise citations (A1 −50, dilution); keep expansion scoped to concept queries. B6 answer-key filled+verified (all 6 sources in corpus, incl. fca-handbook — no coverage gaps) & now scoreable; B6 itself only +16.7pp = a RANKING problem (legislation buried under parliamentary/HMRC noise even when named) → the vector-layer flag. ▼ LEX REBUILD Sprint 2 (Diagnosis / Page 2 + search gateway + Page 1→2 transition), preview only, NOT promoted; `tsc` clean (pre-existing react-markdown only); Page 1→Diagnosis chain smoke-tested end-to-end on Neon (fallback path). ▼ SEARCH: Stage 3 SMOKE-TESTED (verified — MiFID/data-protection/seatbelt all name real anchors + surface new legislation; Gemini 503s degrade gracefully as designed) + v2 GOLD structure encoded in the scoring harness (`gold-queries.ts`/`score-fts.ts`; headline byte-identical to v1 at 69.4%/68.0%; new B6·G–I·J1·K1–K2 present, principle+pending cleanly excluded). ▼ 30 Jun — SEARCH Stage 3: LLM query expansion built + flag-gated (`LEX_QUERY_EXPANSION=true`, default off). `lib/lex/query-expansion.ts` (new) + `field-machine.ts` modified. `tsc --noEmit` clean (pre-existing react-markdown only). ▼ Earlier 25 Jun LEX REBUILD Sprint 1.3 (preview, NOT promoted): save-before-advance enforced, "How this works" tour + FAQ modal restored, `preferredName ?? firstName` (+ Neon data fix Charles→Charlie). ▼ V30 POST-PUSH EXECUTED: cma-cases SEEDED+DRAINED (22,890 sections); scottish-parliament-or SEEDED 7,452 rows (2016+ ∪ pre-2016) + DRAINING, canary PASS; inquiry-evidence POH bounded tranche (90 rows) SEEDED+DRAINED, §0 canary PASS → full POH seed awaiting go. ▼ V26 soak continues (DROP gated; legacy `Legislation*` STILL PRESENT).*

---

## CURRENT STATE — LEX REBUILD Sprint 3-B: conversation/state divergence FIXED (2026-08-01 11:05 UTC)

**Executes `docs/SPRINT_3B_BRIEF.md` (§19-B).** Preview only — **NOT promoted**. Full account:
CHANGE_LOG "LEX REBUILD — Sprint 3-B" (2026-08-01 11:05 UTC); the rules that hold the invariant are
`LEX_PLAYBOOK.md` **§12** (read that before touching `/lex`, the conductor, or any transition).
`tsc --noEmit` clean apart from 5 pre-existing `xlsx` module-not-found errors in `scripts/costing/*`
(declared in package.json, not installed locally, installs on Vercel). **No schema change.**

- **Cause of the Page-2 breakdown, from the data not from a hypothesis** (idea `f534c43d-…`, read
  only): `Idea.lexPage` was **still `ORIENTATION`** — the stage never advanced. All 7 Page-2 field
  rows `EMPTY` with null value AND null proposal, while the transcript shows Lex asking Diagnosis
  questions and twice claiming "I've put it into the box". Mechanism: page complete ⇒
  `currentField: null` ⇒ `/lex` built a prompt with **no field block** ("tell the user what comes
  next") plus the **M-GENERAL method block that describes the whole kernel**, which is enough for
  the model to start Diagnosis; and `/lex` persists a proposal only `if (current && fieldKey ===
  current.key)`, so **every proposal it emitted was discarded silently**. The missing Save buttons
  were two separate things: a locked page renders no field cards at all, and — independently —
  proposed scalars rendered through `OutputField`, which had **no buttons in any non-terminal
  status**. Both fixed.
- **Task 1 — one advance path.** New `lib/lex/stage.ts`: `performStageAdvance(…, via)` is the only
  thing that moves `lexPage`; panel CTA, the new inline chat action, and typed assent all call it.
  Typed assent is handled **before** the model (the user's turn never reaches Gemini). The prompt's
  method block + a new **transition-guard block** now key off `Idea.lexPage`, not off the field's
  page. `assertWritableField` refuses writes to un-entered pages in `/fields`, `/causes`,
  `/policy-options`, `/actions`. Every non-terminal card now has Save / Save & accept / Skip.
- **Task 2 — the end of Page 1 no longer dead-ends.** The conductor posts the two verbatim wrap
  bubbles (briefing explanation + what the next three sections do + "Ready to start the
  diagnosis?"), once; `ContinueCard` renders the inline Continue in chat whenever `nextPage` is
  set, alongside the existing right-panel CTA.
- **Task 3 — the shift is visible.** Per-stage accents (ORIENTATION blue · DIAGNOSIS amber ·
  GUIDING_POLICY violet · COHERENT_ACTIONS emerald) on the stage header + active-section border,
  a slim "— Diagnosis —" divider in chat, greyed "next up" fields for the rest of the active stage,
  and chat messages now **persist their stage tag** so dividers survive a reload.
- **Verified:** 34/34 deterministic assertions on Neon (fallback path, test idea created + deleted)
  covering the whole replay — Page 1 → wrap bubbles → assent advances → Page-2 proposals land and
  mirror → un-entered page unwritable → guard block present / M-DIAGNOSIS absent until entry. Plus
  a **live-model check of the exact 1 Aug failure**: a Page-2 chat answer came back as a
  `valueObject` proposal for `whoAffectedImpactCost`, passed the schema, box rendered "proposed by
  Lex".
- **REMAINING GATE:** Charlie replays the same test on the preview (end of Page 1 → inline Continue
  / typed assent / panel CTA → Diagnosis), then promote. Out of scope and untouched: search-result
  relevance (pass-2 / search workstream).

---

## CURRENT STATE — LEX REBUILD Sprint 3-C: truth, stage search, cost engine (2026-08-02 18:47 UTC)

**Executes `docs/SPRINT_3C_BRIEF.md` (§19-C).** Preview only, **NOT promoted**. Full account:
CHANGE_LOG "LEX REBUILD — Sprint 3-C" (2026-08-02 18:47 UTC); rules in `LEX_PLAYBOOK.md` **§14**.
`tsc` clean (bar the pre-existing `xlsx` errors). Smoke 30/30 on the deterministic path.

- **Schema (additive, applied to Neon after a whichdb check):** `prisma/lex_sprint3c.sql` —
  `Idea.stageSearches` (JSONB, references only) + `CostLine` table + three enums.
- **Task 0 done:** idea `06ca807a` cleared of all stub contamination (refs, briefing doc, 3 causes);
  the user's own root cause untouched. **Briefing NOT re-run** — needs the parked FTS latency work.
- **⚠ Tasks 4/5: the brief's premise did not reproduce.** All five crystallise fields fired and were
  ACCEPTED with real content on 2 Aug, and every generator works when probed (2.8–9.1s, valid
  proposals). **The real defect is the failure path**: `coherenceCheck` held the literal fallback
  `"Please refine this."` announced as a draft — a failed generation was indistinguishable from a
  successful one. Now only user-derived fields (title/keywords/challenge) fall back; everything else
  reports the failure honestly and leaves the field EMPTY for a retry. **Also found: the entire Lex
  rebuild API surface had no `maxDuration` in `vercel.json`** (only the legacy `/api/ai/[ideaId]`
  did), so any conductor step over the platform default 504s mid-write — the likely reason it looked
  like "nothing was proposed". All seven Lex routes now set 60s.
- **Task 1:** stub out of production (`LEX_SEARCH_STUB` dev-only, refuses in production); failed
  searches store an honest empty state + Retry via the new `POST /api/ideas/[id]/search`; a FACTS OF
  THIS TURN block (`lib/lex/facts.ts`) is injected into every turn; mid-chat research requests are
  detected and run for real, or declined honestly (verified live against the exact 2 Aug message).
- **Task 2:** `LEGAL_LANDSCAPE` on Diagnosis entry (refreshed on `challenge` accept),
  `POLICY_ALTERNATIVES` on Guiding Policy, Actions reuses the landscape; five grouped sections;
  prior stages fold. **Known limitation:** the "principles elsewhere" group is a labelled display
  split, not a classifier — the search workstream owns the real principle stream.
- **Tasks 3/6/7:** P3 cards collapse to Title with Detail/For/Against on click and the chosen
  approach is bold in the stage accent; GP orientation names the user's actual causes/obstacle and
  speaks only after rows persist; cost engine v0 (per-action CostLine, ASHE staffing suggestions,
  rollup to the three categories, EANDCB flag over ±£5m/yr); Save greys until dirty; Exit with
  Save/Discard/Stay; **Lex-seeded cause cards are now editable and deletable after confirmation**
  (they rendered read-only, which is why the road-traffic causes were stuck).
- **NEXT:** Charlie replays the walk-through on the preview. The FTS compaction/latency work stays
  parked in the search workstream and is the prerequisite for re-running any real briefing.

---

## CURRENT STATE — LEX: stats tool gaps closed + THE RETRIEVAL CONTRACT (2026-08-04 09:40 UTC)

Full detail: CHANGE_LOG "LEX — stats tool: read-only role, licence provenance, comparative
geography, retrieval contract" (2026-08-04 09:40 UTC). Code `79da5dc`, `66e19e4`.

- **Lex now connects to the stats DB read-only.** `lex_readonly` (SELECT on the five stat
  tables only; INSERT/UPDATE/DELETE/CREATE all verified refused). It was `neondb_owner`.
  Credential: the **`STATS_DATABASE_URL_READONLY=`** line in `scrutinise-web/.env` /
  `scripts/stats/.env` (gitignored) — that is the Vercel value. **LIVE and confirmed:**
  `/api/admin/stats-health` returns ok, 9 datasets / 3,404 series / 40,092 observations,
  top function Social protection £383,934m 2024-25. It also reports `role`/`canWrite` now,
  so the read-only guarantee is checkable rather than assumed.
- **Licence + commercial terms** ride on every figure and appear in Lex's prompt block.
  Caveat: `commercialUseExcluded` is per-DATASET, so it cannot express "pre-2024 vintages
  are non-commercial" if that ever matters.
- **Comparative geography is live** across 21 countries (World Bank WDI). Cross-country
  means are computed here and explicitly labelled as not published; the prompt forbids
  calling them "the OECD average".
- **FOR THE SEARCH THREAD (stats discoverability):** the retrieval contract is in the
  CHANGE_LOG entry above, implemented as `getSeriesById` / `resolveSeries`. Short version:
  **`stat_series.id` is unique but NOT stable across re-ingests, and the natural key is NOT
  unique** (3,404 series → 3,244 distinct natural keys). The catalogue must store BOTH the
  cuid and the natural key + `seriesLabel`. **Recommended before the catalogue index is
  built:** add a deterministic `seriesKey` to `StatSeries` that survives re-ingest —
  retrofitting a join key later is the expensive version.

---

## CURRENT STATE — LEX: `query_stats` tool — Lex wired to the stats DB (2026-08-02 00:36 UTC)

**Executes the Lex-thread brief "wire Lex to the stats database" (STATS_PHASE_A_BRIEF §7).**
Lex-side only. Full detail: CHANGE_LOG "LEX — `query_stats`" (2026-08-02 00:36 UTC);
`LEX_PLAYBOOK.md` §13 has the rules. `tsc` clean (bar the pre-existing `xlsx` errors). No schema
change. **Prerequisite for the cost engine (testing-notes item 12).**

- **⚠ ONE STEP OUTSTANDING, CHARLIE'S:** add **`STATS_DATABASE_URL`** to Vercel **Production +
  Preview** — the **pooled** value in `scripts/stats/.env` (host
  `ep-gentle-waterfall-zab5zcwv-pooler…`). CC could not: the stored `VERCEL_TOKEN` gets `403 …
  must re-authenticate to this scope` (SAML). Then redeploy and hit **`GET
  /api/admin/stats-health`** signed in as admin — expect `ok:true`, 7 datasets / 3,147 series /
  28,857 observations, `topFunction: Social protection`. Until it is set the tool short-circuits
  and Lex behaves exactly as today.
- **The audit came back empty, which shaped the design: Lex had NO tool-calling anywhere** — both
  chat routes use `responseSchema` structured output and platform-owned pre-fetched retrieval.
  And `tools` + `responseMimeType:'application/json'` is a **hard 400** from Gemini (probed, not
  assumed), so function calling cannot go in the main turn while the proposal contract depends on
  structured output. **Shape adopted:** a separate tools-enabled model call makes the real
  function call (mode AUTO — the model decides), the platform executes it, and the observations go
  into the main turn as grounded context. A regex pre-filter keeps ordinary turns at 0 ms.
- **Built:** `lib/stats/{stats-db,stats-query}.ts` (web-side read layer over `pg` —
  `scripts/stats/query/stats-query.ts` is **not importable** from the app: its generated Prisma
  client is gitignored and outside the Vercel root), `lib/lex/tools/{query-stats,tool-runner}.ts`,
  a `statsBlock` in the Lex prompt with a hard no-figures-from-memory rule, and
  `/api/admin/stats-health`.
- **Two bugs found by running it, both invisible to `tsc`:** (1) **the script-side stats read layer
  is broken against its own live DB** — `getCofogRollup` queries measure `exp_by_subfunction` and
  geography `UK`; the live data has `public_expenditure_by_function` and labels everything `GB`,
  so it returns nothing (**flagged to the stats thread, not changed from here** — and the `GB`
  label on UK figures looks like a mislabel worth its own look); (2) Lex described PESA **outturn**
  figures as "projected" until the block carried `StatObservation.status`.
- **Verified end-to-end on the live DB:** "What does the UK spend most on?" → Social protection
  £383,934m, 33.2%, outturn, cited to PESA — **reconciles exactly** with the stats thread's own
  verified totals. "How much on health?" → £241,835m. "How many hospital beds in England?" →
  declines honestly, invents nothing. Ordinary conversation is untouched.
- **NEXT:** the env var above; then this is the retrieval half of the cost engine — the costing
  work in item 12 can call `runQueryStats` directly rather than re-inventing a lookup.

---

## CURRENT STATE — CORPUS REPORT + CDN FIX + STATS PHASE B (2026-08-03 08:30 UTC)

**Executes `docs/BRIEF_CC_corpus-report_CDN_statsPhaseB.md`.** Full detail: CHANGE_LOG
"CORPUS REPORT + CDN FIX + STATS PHASE B" (2026-08-03 08:30 UTC), plus
`docs/reports/corpus-status-report.md` (new spec), `STATS_SCHEMA.md` §Phase B and
`STATS_REFRESH.md` (OECD throttling section — read that before touching `sources/oecd.ts`).

- **Part 1.1 — corpus status workbook DONE.** `scripts/reports/` (new, own npm project so the
  report-only `xlsx` dep never ships in the Railway ingest image) →
  `docs/reports/output/corpus-status-2026-08-03.xlsx`: 8 tabs, **70 corpora, exactly 1,255
  quangos, 17,874,322 sections, 6.20bn words, 98.8% compiled**. Grain rule held (org/collection,
  never section). **The spec the brief referenced did not exist** — built to the brief's own tab
  list and written up as `docs/reports/corpus-status-report.md`; **the column choices are CC's**
  and are the most likely thing to need correcting.
- **⚠ UNOWNED DATA-QUALITY FINDING the workbook's Gaps tab surfaced — not fixed, not assigned.**
  The **`pwdata-*` family carries MIXED licence values**: `(none) | opl-3.0` within a single
  corpus, i.e. some rows licensed and some null, across **~8.8M sections** (`pwdata-debates`
  6.39M, `pwdata-wrans` 1.24M, `pwdata-lords` 754k, `pwdata-westminster` 241k, plus the smaller
  siblings). Also still at `pending-verification`: `ni-judgments` (7,927), `tax-tribunals`
  (13,099), `nilawcom` (17). Out of scope for that sprint, but this is a licence-provenance hole
  in the largest corpora we hold — re-run `cd scripts/reports && npm run corpus-status` and read
  the Gaps tab to see the current position.
- **Part 1.2 — xlsx → SheetJS CDN DONE.** `scripts/stats` 1 high → **0 vulnerabilities**;
  `scrutinise-web` **xlsx gone from `npm audit`** (36 unrelated pre-existing remain). All five
  stats parsers re-verified against live spreadsheets, identical counts. **Bonus:
  `scrutinise-web` `tsc --noEmit` is now clean** — the 5 long-standing `scripts/costing/*`
  "xlsx module not found" errors are gone. **New risk: Vercel must reach `cdn.sheetjs.com` at
  install time — watch the next deploy.**
- **Part 2 — Phase B: World Bank DONE (257 series / 11,235 obs, 1960–2025, CC BY 4.0 verified).**
  Comparative query layer built and **proven live** — UK vs FR/DE/US on health spend %GDP, tax
  revenue %GDP and life expectancy all return correctly (`npm run compare`).
- **The decision that makes Phase B work: alpha-2 geography.** Phase A wrote the UK as `GB`;
  every international source says `GBR`. Storing `GBR` would have put UK spending in a different
  geography from its own comparators and nothing would ever have lined up. `lib/iso.ts`
  normalises on the way in.
- **⚠ TWO THINGS NEED CHARLIE:**
  1. **OECD `commercialUseExcluded` — the brief's premise was wrong and I took the verified
     position (`false`).** OECD T&C **§3 "Data"** says data may be reused "for any purpose, even
     for commercial use"; the CC-BY-NC point concerns *written content*, and even that clause
     permits commercial use. One boolean in `seed-catalogue.ts` to flip if you disagree.
  2. **IMF NOT ingested — licence unverifiable.** All three terms URLs 403 from this
     environment and the data's own `LICENSE` column says *"All Rights Reserved"*. Needs you to
     open the terms page in a browser. Eurostat skipped (brief marks it optional).
- **OECD COFOG NOT LOADED — 0 rows. Source-side blocker, diagnosed and instrumented.** Four
  attempts: 20 per-year requests (19 failed), then whole-window / 10-year / 5-year after a
  12-minute cooldown — **all HTTP 500** — while a **single year in isolation returns 200 with
  426 KB** (proven twice). Two failure modes both surface as 500: **quota** (intermittent, 500 as
  often as 429, waiting helps) and **size** (deterministic, waiting does not — the whole-window
  request 500'd as the first request after a cold start). Only that first-after-cooldown request
  cleanly separates them; later failures follow ~15 real requests and can't be attributed.
  Shipped: adaptive largest-window-first fetch (never revert to per-year — it maximises the quota
  problem to solve a size problem), a **server-side unit filter that is UNTESTED and the best
  next thing to try** (~25% of every payload is currently fetched and discarded; key order
  derived from data in hand, with fallback to `/all`), and the guard that made this end as an
  honest FAILURE. **The partial 2022-only slice a killed run wrote was DELETED** — the guard
  refuses to write a partial window, so leaving one queryable would contradict it and "UK vs OECD
  over time" would have returned a single 2022 point looking like an answer. Resume with
  `npm run refresh -- --force oecd-cofog-expenditure` from a cold quota, no concurrent probing.
- **Stats DB after this sprint: 9 datasets, 3,404 series, 40,092 observations, 21 MB.**
- Also fixed en route: **`--force <id>` was not exclusive** (it started a second concurrent
  writer on World Bank — 0 duplicates confirmed, not assumed), and **`verify.ts` reported
  `lastRefresh=never` for a dataset that had succeeded** (an orphaned null-status log row
  outranked the good one; now reconciles against the latest *completed* run and surfaces
  unfinished ones).

---

## CURRENT STATE — STATS: DB PROVISIONED + LIVE, six bugs found and fixed (2026-08-01 23:30 UTC)

**Completes the provisioning step the entry below left open.** Full detail: CHANGE_LOG "STATS —
Database provisioned, first live ingest, six bugs the offline build could not see"
(2026-08-01 23:30 UTC), plus `docs/STATS_SCHEMA.md` (now carries the live connection details and
a correction) and `docs/STATS_REFRESH.md`. Not repeated here.

- **The DB exists and holds real data.** Neon project `scrutinise-stats`
  (`winter-frost-26605722`), `aws-eu-west-2`, PG 17 — **a separate project** from the corpus Neon
  (`dry-wildflower-60883981`), as brief §0 requires. Both migrations applied, catalogue seeded,
  all 7 Phase A datasets ingested. Credentials in **`scripts/stats/.env`** (gitignored) — that
  path, not `scrutinise-web/.env`, because the scripts run with `scripts/stats` as cwd.
  Compute capped 0.25–2 CU with a 5-min suspend; measured footprint 17 MB (3,147 series / 28,857 observations).
- **Charlie's first API key was project-scoped and could not create projects** — an
  **Organization**-scoped Neon key is required. Cost one round trip; noting so it isn't repeated.
- **Six real bugs, none of which the offline build could have surfaced; three reported
  `SUCCESS` while producing wrong or missing data.** Headlines: ONS Beta ingested **0 of 1,960
  rows** (hardcoded `v4_0` CSV header shape — that dataset is `v4_2`); **all UK health spending
  was silently dropped** from PESA's function series (PESA doesn't COFOG-number its health
  rows); the observation unique key couldn't tell an annual observation from Q1 of the same
  year, **destroying 533 CDID rows**; HMRC tax-gap collapsed every tax's identically-named
  component into one series, **overwriting 60 rows**. Plus a PESA foreign-key failure from a
  schema/doc contradiction, and a dimension-order assumption. All fixed, all re-ingested.
- **Two guards now make that class of failure visible**, which matters more than the individual
  fixes: `refresh-scheduler.ts` treats a zero-observation run as `FAILURE` (never a no-op), and
  the new `verify.ts` **reconciles attempted-vs-stored observation counts** per dataset, printing
  `** N ROWS LOST **` on any gap. That reconciliation is what caught two of the six — and then
  caught a seventh thing in the opposite direction: **fixing a series key strands the series
  created under the old key** (the upsert matches by key, so a changed key writes a new row
  beside the old). 27 stale tax-gap series were double-counting 540 observations; deleted behind
  an exact-match guard. **If you ever change a series key, delete the old series — re-ingesting
  alone will not.**
- **Verified end-to-end, not just counted:** PESA parses reconcile against PESA's own totals
  (all 50 section-year totals within ±2 £m on values up to £384bn), and the brief's headline
  question now answers cleanly across all 10 COFOG functions (£1,157,828m for 2024-25;
  Social protection 33.2%, Health 20.9% — Health having been absent entirely before the fix).
- **One known, quantified residual, deliberately not fixed:** `obr-historical-forecasts` loses
  24 of 20,506 rows (0.12%) to duplicate keys **in OBR's own workbook** — a sheet with two
  columns both labelled `2023-24`, and a row label `July 1996` appearing twice. No principled
  way to choose a value or name a vintage that doesn't exist; surfaced by `verify.ts` every run.
- **NEXT / still open:** the **Railway cron is NOT wired** — held because it is a paid resource
  (brief §9's money gate); exact wiring is in `STATS_REFRESH.md`, and a full cold run measures
  ~34 min so give it a timeout above an hour. Then refresh-failure alerting, then full Lex
  tool-calling integration (brief scopes it as a follow-on, not Phase A blocking).

---

## CURRENT STATE — STATS: Phase A (UK spine) built, DB choice pending Charlie (2026-07-31 00:03 UTC)

> **SUPERSEDED by the entry above (2026-08-01 23:30 UTC)** — the DB is now provisioned and
> loaded, and the "built inert / never run" statements below no longer hold. Kept for the build
> history and the pilot numbers (two of which the live run corrected — see the CHANGE_LOG).

**Executes `docs/STATS_PHASE_A_BRIEF.md`.** New parallel workstream, separate from the corpus/
search/Central work above — a standalone statistics store. Full detail: `docs/STATS_SCHEMA.md`,
`docs/STATS_REFRESH.md`, and the CHANGE_LOG entry "STATS — Statistics layer, Phase A (UK
spine)" (2026-07-31 00:03 UTC) — not repeated here.

- **Built:** `scripts/stats/` (own npm project) — SDMX Prisma schema (dataset/dimension/series/
  observation + COFOG reference table), source modules for ONS (Beta API + CDID), OBR, PESA,
  HMRC (all verified against real live endpoints, all OGL v3.0), a cadence-aware refresh
  scheduler, and a Lex/analysis query layer. `tsc --noEmit` clean.
- **NOT built / NOT run:** no database exists yet. Schema was validated + client generated +
  initial migration produced entirely offline (no DB connection needed for any of that).
  `seed-catalogue.ts`/`ingest-handlers.ts`/`refresh-scheduler.ts` are real code, never executed
  against a live target — same posture as the vector-embed pipeline's "built inert" ships.
- **Sizing measured, not guessed:** `measure-pilot.ts` fetches+parses real data from every
  source (no DB writes) and counts — 4,081 series / 28,866 observations on the ingested slice
  (1 of 337 ONS Beta datasets, 1 of 10 PESA chapters, 1 of 15 HMRC tax-gap tables — deliberately
  partial, see CHANGE_LOG for the extrapolation). Honest read: full Phase A UK spine likely
  lands in the tens-to-low-hundreds of MB, not the brief's "single-digit to low-tens of GB"
  expectation — that ceiling looks more like Phase B/C (OECD/IMF/World Bank) scale.
- **DB choice DECIDED (Neon, new separate project) — provisioning still blocked.** Charlie
  confirmed CC's recommendation. CC cannot create the project itself in this environment (no
  stored Neon API key, and `neonctl` login needs a browser that isn't available here) — it
  needs Charlie to either create the project in the Neon console and paste back the pooled +
  direct connection strings, or hand over a Neon API key. **Charlie chose to hold off this
  session** — nothing costing money has been touched, `STATS_DATABASE_URL` is unset everywhere.
- **NEXT (whenever Charlie is ready to unblock provisioning):** get the Neon project created
  (either path above), wire `STATS_DATABASE_URL`/`STATS_DIRECT_URL`, run the offline-generated
  migration, `seed-catalogue.ts`, then `refresh-scheduler.ts` for real, wire the Railway cron,
  then full Lex tool-calling integration (brief scopes this as a follow-on, not Phase A
  blocking).

---

## CURRENT STATE — SEARCH: query router — guidance stream, concurrency fix, flip recommendation (2026-07-30 04:32 UTC)

**Executes the CC brief "add guidance as a fifth routed stream, then re-measure."** Direct
continuation of the entry below (2026-07-29 19:25 UTC) — read together.

- **Guidance stream added, purely additive as the design predicted** — one config-list entry in
  `query-router.ts` (`{name:'guidance', tier:'guidance', search: ftsStream('guidance')}`), one
  schema/prompt addition in `query-expansion.ts`. `tsc --noEmit` clean both packages, zero changes
  to routing logic.
- **The flagged concurrency risk was CONFIRMED real, not a false alarm.** The prior entry hedged
  that production's HTTP-based stream dispatch might not share the harness's in-process
  `Promise.all` crash risk. Directly tested (new `scripts/ingest/search/concurrency-stress-test.ts`
  — boots the real `fts-query-service.ts` and fires concurrent requests shaped exactly like
  `runRoutedSearch()`'s 5-stream fan-out): **the unpatched service crashed outright at 15
  concurrent requests** — 3 users searching within the same few hundred ms, once the router is
  ON, produces exactly this load. The "different execution model" reasoning was wrong: the danger
  is concurrent native Lance calls against ONE shared table handle in one process, regardless of
  what triggers them.
- **Fixed:** `fts-query-service.ts` gates every request through a global semaphore
  (`FTS_MAX_CONCURRENT=4` default), excess requests queue FIFO. Re-tested: the exact 15-request
  load that crashed it now completes with 0 errors, service stays alive. At much heavier synthetic
  load (20–25 concurrent, beyond realistic traffic) some individual requests failed client-side
  with no server crash — flagged as an unconfirmed residual, not blocking.
- **Gold-set re-measured, full 43 queries:** A holds +10.0pp (unchanged). **B improved further,
  +12.5pp → +15.3pp.** **C partially recovered, -20.0pp → -13.3pp** — investigated why it didn't
  fully close: the two still-regressing C queries (C1, C3) route correctly to `legislation`-only
  because their true expected sources genuinely are legislation, not guidance — so "guidance
  missing" was only part of the original diagnosis. The residual is a smaller, more fundamental
  cost of any tier-scoping (losing the unscoped baseline's incidental cross-tier text matches),
  not something more streams fix. D/F improved (likely LLM stream-choice run-to-run variance, not
  a guidance effect). Full detail: `docs/FTS_ROUTER_AB.md` (overwritten with this run's numbers).
- **RECOMMENDATION: flip `LEX_QUERY_ROUTER=true` in production.** The one genuinely blocking risk
  (the crash) is fixed and validated at the load that broke it; every archetype is net
  flat-or-positive except C's small, understood, bounded residual. Ships independently of the
  vector-layer question. **Not flipped this session** — Charlie's call.
- **NEXT:** flip the flag when ready; watch `/stats`'s new `concurrency.queueHighWaterMark` after
  flip for real-world load; C's residual scoping tradeoff is a known cost, not queued as a fix.

---

## CURRENT STATE — SEARCH: query router built + measured, flag OFF (2026-07-29 19:25 UTC)

**Executes the CC brief "build the query router" (generalises Stage-3 expansion into per-stream
routing).** One new Gemini call (`routeQuery()`, `scrutinise-web/lib/lex/query-expansion.ts`)
decides which of four streams — legislation / debates / committees / caselaw — a query belongs
to and writes a tailored search string for each; everything after is deterministic dispatch
(`query-router.ts`, a config list of `{name, tier, types?, search}`). Flag `LEX_QUERY_ROUTER`
(default OFF), independent of `LEX_QUERY_EXPANSION` — router ON supersedes expansion for that
call. Fail-open: a null/unparseable/empty router decision degrades to searching all streams
unfiltered with the bare query (today's default) — never an empty result.

- **Audit finding — contradicts the brief's premise:** `query-expansion.ts` had no existing
  citation-vs-concept logic; `expandQuery()` called the LLM unconditionally for every query,
  always. Citation-pinning lives entirely server-side (`citation-resolver.ts`/`fts-core.ts`'s
  `resolveInjections`), unrelated to `query-expansion.ts`. The router's own prompt now makes
  this decision for the first time — verified live: A1–A4 (exact citations) all route to
  `legislation` alone, scoring identically to baseline (zero dilution).
- **Tier filter confirmed real, not throwaway:** `fts-query-service.ts`'s `POST /fts-search`
  already accepts `tier`, wired to `rankedSearch`'s existing filter — the platform-side gap was
  `fts-search.ts` never threading a `tier` param through; fixed. debates/committees share
  `tier='parliamentary'`, split via the existing `corpusToType()` display mapping rather than a
  new filter axis.
- **Gold-set result (43-query set, 0/34 fail-opens):**

  | archetype | OFF | ON | delta |
  |---|---|---|---|
  | A (citation) | 60.0% | 70.0% | +10.0pp |
  | B (concept, payoff target) | 33.3% | 45.8% | +12.5pp |
  | C (legislation+guidance) | 60.0% | 40.0% | **-20.0pp** |
  | D (graph, floor) | 76.7% | 76.7% | 0.0pp |
  | E (Hansard intent) | 90.0% | 90.0% | 0.0pp |
  | F (bills/precedent) | 90.0% | 80.0% | -10.0pp |

  Both brief predictions confirmed (B rises, A improves not dilutes). **C regresses -20.0pp — an
  honest expected cost**, not a bug: `guidance` is a deferred stream (brief scope: 4 streams
  only), so any C-archetype guidance-tier expected source (FCA/HMRC/etc.) is now unreachable by
  ANY routed stream, where the unscoped baseline could stumble onto it via the shared candidate
  pool. Full detail: `docs/FTS_ROUTER_AB.md` / `docs/fts_router_ab.json`.
- **Bug found + fixed during measurement:** the harness crashed twice (bare exit 255, no JS
  stack trace) from concurrent `rankedSearch` calls via `Promise.all` against the same in-process
  Lance table handle — fixed by making the harness's per-stream dispatch sequential. **Flagged,
  not fixed:** production's `query-router.ts` also uses `Promise.all`, but through independent
  HTTP calls to `fts-query-service` rather than a shared in-process handle — a different
  execution model, not confirmed to share the risk, but not confirmed safe either.
- **NEXT:** `LEX_QUERY_ROUTER` stays OFF pending Charlie's read of the C regression — accept it
  as the current 4-stream scope's known cost, or add a `guidance` stream (one config-list entry)
  before flipping. Both `tsc --noEmit` clean.

---

## CURRENT STATE — CENTRAL Stage 2e: pilot polish + the AI-attribution blocker (2026-08-24 15:36 UTC)

**Executes the "Central Stage 2e" brief and addendum (24 Aug 2026), after Charlie's 2d browser walk.**
Account: CHANGE_LOG "CENTRAL Stage 2e"; design in `SCRUTINISE_CENTRAL_SPEC.md` §9, decisions §13.

- ✅ **STAGE 2c's AI-ATTRIBUTION ITEM IS BUILT** — `Answer.authorType`/`aiModel`, 27 answers labelled,
  visible in the library list, the question detail and the pack. **This was the pilot launch
  blocker; it no longer is.** Events — the rest of the old 2c scope — stays deferred per the brief.
- **The diagnosis, before the fix:** an answer vote was **never wired to the ledger**; `PointsEvent`
  held **zero rows** database-wide; and "Log this session" worked correctly — its claims were simply
  waiting for an approval step that has now been removed.
- **Scope:** `scrutinise-web/**` plus `docs/CLAUDE.md`, the Central spec, CHANGE_LOG and handoff.
- **Schema:** `prisma/central_stage2e.sql` — `Answer.authorType`/`aiModel` + backfill,
  `ActivityClaim` reversal columns, `CommunityReferral.bonusBalance`, `TrainingMatch.authorMessage`,
  the department topics, the pending-claim award, and a **DROP/CREATE of `ActivityClaim_one_per_day`**
  to widen its predicate. Hand-written, applied to Neon, read back.
- **Where the rules live:** `lib/central-points.ts` — `applyAnswerVote`, `awardClaimPoints`,
  `reverseActivityClaim`, and the fractional `mintReferralBonuses`.
  `components/central/AnswerByline.tsx` is the single answer to "who wrote this".
- ⚠ **`docs/CLAUDE.md` §21 is new and standing**: the "indexes Prisma can't see" register, and the
  rule that `prisma format` must never be run on the schema.
- **Two one-off scripts, both idempotent and dry-run by default:**
  `scripts/patch-question-template.ts` (rebuilds the shipped template from Charlie's source — rerun
  after replacing it) and `scripts/backfill-answer-vote-points.ts` (already applied; one vote paid).
- **Live totals after this sprint:** charlie **44**, chas_mn6bxqqn **20**. 2 claims AWARDED,
  3 points events, 27 AI answers, 0 test fixtures left behind.
- ⚠ **Charlie-visible consequence:** the "All topics" dropdown is now **35 entries per node**, up
  from 11, because the 24 ministerial departments were seeded to match the template.
- **Verified:** `npm run check:central` — **344/344**, self-cleaning; `tsc --noEmit` and
  `next build` clean; delivery check 0 `--fast` passes. **Four planted-break runs** — and two of them
  found real defects rather than confirming a guard.
- **Not done, named:** the browser walk — open the template in Excel (no repair prompt, drop-down
  present), upload a filled copy, and confirm an upvote moves the other account's total.


## CURRENT STATE — CENTRAL Stage 2d: training exchange, bulk upload, navigation (2026-08-24 02:07 UTC)

**Executes the "Central Stage 2d" brief (24 Aug 2026) in full.** Account: CHANGE_LOG
"CENTRAL Stage 2d"; design in `SCRUTINISE_CENTRAL_SPEC.md` §8, decisions in §12.

- ⚠⚠ **STAGE 2c WAS NEVER BUILT** — audited first, because 2d's part D depends on it. No
  `central_stage2c.sql`, no Events model, no `TrainingSession`, **no `authorType` column**. The
  brief's flag stands: **27 Claude-written answers render as members' work, and that is still the
  pilot launch blocker.** 2d did not absorb it.
- **Scope:** `scrutinise-web/**` plus three shared docs. Nothing in search/ingest/stats/Lex touched.
- **Schema:** `prisma/central_stage2d.sql` — `TrainingListing`, `TrainingMatch`, `TrainingSession`,
  `User.phone`, a `PointsConfig` row and the tag-promotion update. Hand-written, applied to Neon,
  read back column by column. ⚠ **No partial or expression indexes** — unlike Stage 1.2 and Stage 2,
  nothing in 2d is invisible to `schema.prisma`.
- **Where the rules live:** `lib/training.ts` (listings, matches, contact disclosure, log-a-session)
  and `lib/question-import.ts` (parse, plan, apply). `contactFor()` is **the only function that
  reads a member's email or phone to show it to another member** — four conditions, and `null` for
  everyone else.
- **The switch Charlie owns:** `PointsConfig.TRAINING_PHONE_SHARING` = 1. Set it to 0 for email-only;
  it is read at display time, so it applies retroactively to matches that already ticked phone.
- **The template is a stand-in** at `public/central-question-upload-template.xlsx`. Drop Charlie's
  file in at the same path when it arrives; `scripts/make-question-template.ts` regenerates the
  stand-in. The importer keys off column *names*, not positions.
- **Dependency change:** `xlsx` moved devDependencies → dependencies (a server route imports it).
  Pure JS, no native module in the serverless bundle.
- **Verified:** `npm run check:central` — **295/295** against the live app DB, self-cleaning
  (including the borrowed phone numbers and the config row); `tsc --noEmit` and `next build` clean;
  delivery check 0 `--fast` passes at 0 cross-package files. Every new guard watched failing first
  in three planted-break runs (2, 5 and 9 failures) — **which is how two unfailable checks of my own
  were found and rebuilt.**
- **Not done, named:** the browser walk. No Clerk session exists from a CC session and local Clerk is
  a dev instance, so the five acceptance walks are Charlie's.

## CURRENT STATE — CENTRAL Stage 2b: question library (2026-08-11 20:24 UTC)

**Executes the "Central Stage 2b" brief (11 Aug 2026), built to the CD handoff.** Full account:
CHANGE_LOG "CENTRAL Stage 2b"; design in `SCRUTINISE_CENTRAL_SPEC.md` §5–§6, decisions in §12.

- **Scope:** `scrutinise-web/**` plus the three shared docs. `lib/email.ts` gained one function; no
  existing one was changed.
- **Where the rules live:** `lib/question-library.ts` — visibility, near matches, ranking, the three
  vote mechanisms, flags, suggestions, packs, across-branches. Routes are thin wrappers, so the check
  script exercises production code.
- **Four invariants a future change must not quietly break:**
  1. a question vote is frequency (up-only, self-vote allowed); an answer vote is quality (no
     self-vote); they are not the same mechanism;
  2. favourites are private — never counted, ranked, aggregated or exposed;
  3. favourites in packs are additive, never substitutive;
  4. every pack output carries the "not official positions" line, from one constant.
- **Verified:** `npm run check:central` — **189/189** against the live app DB, self-cleaning
  (including the notifications these flows send to real accounts).
- **REMAINING GATE:** Charlie's browser re-test. Untested from here (no Clerk session): the HTTP route
  surface, all five screens, and the print sheet's actual A4 output.
- **Not built, per the brief:** vote weighting (the column exists, the logic does not), an admin tag
  editor beyond the promoted flag, and the Board tab's return.

---

## CURRENT STATE — CENTRAL Stage 2: points & leaderboards (2026-08-09 07:43 UTC)

**Executes the "Central Stage 2" brief (6 Aug 2026).** Full account: CHANGE_LOG "CENTRAL Stage 2"
(2026-08-09 07:43 UTC); design and open items in `SCRUTINISE_CENTRAL_SPEC.md` §4.

- **Scope:** `scrutinise-web/**` plus the three shared docs. Outside Central, only two display
  surfaces were touched — the dashboard stat row and the profile chip — and `lib/points.ts` was
  **read, never modified**.
- **The one number that needs Charlie:** a 4-point mark cannot pay a referral chain (10% floors to
  zero). Everything works; bonuses simply only appear on claim-sized events. Raising the mark to +8
  (the main system's next rung) or lifting L1 are both single row edits in `PointsTariff` /
  `PointsConfig`.
- **Where the rules live:** `lib/central-points.ts` — tariff resolution, event writing, marks,
  claims, referrals, leaderboards. Routes are thin wrappers, so the check script exercises production
  code. `applyBulletinMark()` composes guardrails + vote + ledger and lives here rather than in
  `lib/community.ts` to avoid a cycle, since the engine already depends on that module.
- **Two things a future reader must not undo:** the ledger appends only (never update a row to
  "correct" a score), and Central never writes to `Reputation`/`CredibilityScore`.
- **Carry forward:** `prisma/central_stage2.sql` holds an expression partial unique index invisible
  to `schema.prisma`. That is now **two** such indexes in Central; both are flagged in their model
  comments.
- **Verified:** `npm run check:central` — **140/140** against the live app DB, self-cleaning
  (including notifications sent to real accounts during the run).
- **REMAINING GATE:** Charlie's browser re-test against his acceptance list. Untested from here (no
  Clerk session): the HTTP route surface and every new panel.

---

## CURRENT STATE — CENTRAL Stage 1.2: membership, join requests & roles (2026-08-06 20:41 UTC)

**Executes the "Central Stage 1.2" brief (6 Aug 2026) — Charlie's settled branch-membership model.**
Full account: CHANGE_LOG "CENTRAL Stage 1.2" (2026-08-06 20:41 UTC); the model itself is documented
in `SCRUTINISE_CENTRAL_SPEC.md` §3.3, and its decisions in §10 under "6 Aug (afternoon)".

- **Scope discipline held:** `scrutinise-web/**` plus the three shared docs. The only file touched
  outside Central is `lib/email.ts`, which gained one new function and no changes to existing ones.
- **Schema:** `prisma/central_stage1_2.sql` — `CommunityJoinRequest`, its indexes, the partial
  pending-unique index, and the root-membership backfill. Hand-written; production column types read
  first; applied after `whichdb`; re-run once to prove idempotence.
- **⚠ Carry this forward:** the partial unique index is invisible to `schema.prisma`. Anyone running
  `prisma migrate diff` will see it as drift to drop. The model comment says so; this is the second
  place it is recorded.
- **Where the rules live:** `lib/community.ts`. `joinCommunityAndRoot`, `leaveCommunity`,
  `createJoinRequest`, `decideJoinRequest`, `setMemberRole`, `removeMember`, `canCreateBranchUnder`,
  `getNodeManagerIds`. Routes are thin wrappers, which is what lets the check script exercise
  production code rather than a copy of it.
- **`getCommunityTree` was rewritten** to load level-by-level and merge the viewer's context in bulk
  (role, pending request, manage rights, pending count per node). The per-node recursion it replaced
  would have been a query storm now that the tree answers "am I in this one, can I manage it, have I
  already asked" for every node it draws.
- **Verified:** `npm run check:central` — **83/83** against the live app DB, self-cleaning,
  including the notifications these flows create for real accounts.
- **REMAINING GATE:** Charlie's browser re-test against his acceptance list. Untested from here (no
  Clerk session): the HTTP route surface, and **a real invite email leaving the building** — the
  check proves the honest-reporting contract against a suppressed address, not delivery.
- **Not built, per the brief:** a permanent block after decline, ownership transfer, and a root-admin
  approval gate on branch creation (to be added only if sprawl appears).

---

## CURRENT STATE — CENTRAL Stage 1.1: user-test fixes (2026-08-06 14:26 UTC)

**Executes the "Central Stage 1.1 — user-test fixes" brief (6 Aug 2026), after Charlie's Stage 1
user test passed 10/13.** Full account: CHANGE_LOG "CENTRAL Stage 1.1" (2026-08-06 14:26 UTC).
Supersedes the Stage 1 section below for everything it touches.

- **Scope discipline held:** `scrutinise-web/**` plus the three shared docs. Nothing in the search,
  ingest, stats or Lex stacks; the board search is a plain ILIKE and deliberately does not touch the
  corpus-search stack.
- **Schema:** `prisma/central_stage1_1.sql` — `BulletinPost.scope`, `Community.bulletinCategories`,
  plus the `GroupMember` owner backfill. Applied to Neon (`ep-old-dust-aboxi69a`) after `whichdb`,
  re-run once to prove idempotence. Plain TEXT/TEXT[], no `CREATE TYPE` against a live DB; value sets
  enforced by Zod at every write boundary.
- **Audit-first result that changed the work:** A1 (voting) and A2 (search) were **already built** —
  0 `BulletinVote` rows in the DB is what proves the vote control was never found. They were fixed as
  discoverability problems, and a genuine bug turned up beside A1 (the thread list never returned the
  caller's own vote).
- **A3 and A4 were real defects**, both with causes the brief did not name: `/api/users/search` never
  matched email despite a comment saying it did, and `POST /api/ideas/[id]/groups` never wrote an
  owner `GroupMember` row, leaving all 6 teams at 0 members.
- **One permission change, deliberate and narrow:** `canManageCommunity()` — admin of any ancestor is
  admin of a node. Without it the per-node tree buttons are dead on every branch the caller did not
  personally create. **Management only**; viewing a board or its members still requires a membership
  row on that node.
- **Verified:** `npm run check:central` — **38/38** against the live app DB, self-cleaning. The vote
  transaction and invite lookup were moved into `lib/community.ts` so the script exercises the same
  code the routes run, not a re-implementation.
- **REMAINING GATE:** Charlie's browser re-test against his acceptance list. Untested from here (no
  Clerk session available): the HTTP route surface and the two new panels.
- **Not built, per the brief:** an admin category-management UI. Categories are seeded defaults only,
  stored per-Community so that UI is a later addition rather than a second migration.

---

## CURRENT STATE — Community feature: Stage 1 build complete, not click-tested (2026-07-29 17:43 UTC)

**Full Stage 1 build shipped this session** (schema → API routes → UI), executing the brief Charlie
dictated and the scope now formalised in `docs/SCRUTINISE_CENTRAL_SPEC.md` (new master spec for the
whole Central module — read this, not just this handoff section, for the full roadmap through Stage 4).
Full account: `docs/CHANGE_LOG.md` "CENTRAL — Stage 1 Community build" (2026-07-29 17:43 UTC) and the
schema-migration entry just above it (17:24 UTC).

- **Two migrations applied to production this session:** `20260729141507_add_community_hierarchy`
  (Community/CommunityMember/CommunityInvite/Idea.communityId) and `20260729173128_add_bulletin_board`
  (BulletinPost/BulletinVote/Community.managerId/CommunityMember.lastReadAt). Both hand-scoped from the
  raw `prisma migrate diff` output rather than applied as-is — the raw diff also wants to drop the
  914,274-row `LegislationSection_DEPRECATED_2026-06-19` table and `specialist_queue`, fallout from
  `schema.prisma` having drifted ahead of production on the unrelated, deliberately-still-unmigrated LEX
  Rebuild Sprint 2 set. **That wider drift is still there and will resurface on every future migration
  attempt** until someone either migrates the Sprint 2 tables for real or reconciles
  `LegislationSection`'s physical rename back into a proper migration — not this session's job, flagging
  for whoever touches `schema.prisma` next.
- **Built:** API routes (create/join Communities, branches, manager assignment, invites, bulletin
  CRUD+vote+search), `/communities` + `/communities/[id]` + `/community-invite/[code]` pages, dashboard
  reorg ("My Communities and teams" section, Feed/Upcoming tabs). Detail in CHANGE_LOG — not repeated
  here.
- **Real bug caught by testing against a live dev server (not just `tsc`):** `middleware.ts` was missing
  `/communities` from its protected-route list, so the page-level redirect for signed-out visitors only
  worked via React's streaming protocol (real browsers were fine; a non-JS client would hang on a 200 +
  loading shell). Fixed — see CHANGE_LOG for exact detail.
- **NOT tested:** the actual signed-in interactive paths (create/join a Community, post/reply/vote,
  assign a manager). No way to authenticate as a real user from this environment — only auth-boundary
  and error-path smoke tests were run. **The Stage 1 test checklist in
  `SCRUTINISE_CENTRAL_SPEC.md` §3 still needs running by a signed-in human in a browser** before this
  is considered done, not just shipped.
- **Deliberately not touched:** `entity_list_v5.md` (CCh-only, never edited by CC without instruction —
  the new entities are documented in `SCRUTINISE_CENTRAL_SPEC.md` §2 instead). DOMPurify gap (referenced
  only in a schema comment codebase-wide, never implemented) — sidestepped for bulletin posts via
  plain-text/default-JSX-escaping rendering rather than closed.
- **NEXT:** click-test the Stage 1 checklist; Stage 2 (points/leaderboards) is "under discussion," not
  yet briefed — see `SCRUTINISE_CENTRAL_SPEC.md` §4 for what's agreed so far.

---

## QUEUED (not started) — Act-metadata sprint (scoped 2026-07-29 11:52 UTC; FTS item pulled out 16:12 UTC)

**Not started. Scoped and recorded for when Charlie schedules it.** Three items (item 3, the
`corpus_fts` cursor/rebuild, was PULLED OUT 2026-07-29 16:12 UTC into its own ready-now, independently
scheduled piece of work — see its own CURRENT STATE section below; no change to items 1/2 here):
1. Low-effort: repoint `searchLegislation()`/idea-chat onto the current (once-rebuilt) FTS path.
2. **Gating item — scope as ONE sub-project, not three small fixes:** a proper Act-level metadata
   table (title/year/jurisdiction/number/section-counts + whatever `LegislationPanel` needs), fed from
   ingest, independent of `corpus_sections`' section granularity and of `LegislationItem`. Unblocks the
   panel route + browse-page route AND makes `LegislationItem` itself droppable.
3. **Answered below** — the one number needed before scheduling.

**ADDENDUM (2026-07-29 16:12 UTC) — correction to the item-3 (orig. item-4) number, per Charlie:**
**the headline combined legacy total to use for Neon space-planning is 1,049,805 rows, not 914,274.**
The table below already had this right, but the top-line framing undersold it — flagging explicitly so
a skim doesn't anchor on 914,274 alone. 914,274 is `LegislationSection` (gated on items 1+2 above);
`LegislationItem`'s 135,531 rows are separate/additional and gated on item 2 only. No other change to
this queued sprint's scope.

**Original answer — the row split, with a correction to the framing:** queried Railway (`DATABASE_URL`,
the main app's Prisma DB) directly. **The "914,274 legacy rows" figure is not a combined total that
needs splitting — it already equals the entire `LegislationSection` row count, exactly.**
`LegislationItem` (135,531 rows) is separate and additional, not part of that number.

| Table | Rows | Droppable when |
|---|---|---|
| `LegislationSection` (physically renamed `LegislationSection_DEPRECATED_2026-06-19`) | **914,274** | #1 + #2 land |
| `LegislationItem` | **135,531** | #2 lands (Act-metadata table) |
| **Combined legacy footprint — USE THIS FOR SPACE-PLANNING** | **1,049,805** | — |

**Two things this surfaced (flagged, not touched):**
- **Schema/DB drift, live now, not a future-state description:** `schema.prisma` still declares
  `model LegislationSection` mapped to the un-suffixed table name, but the physical Railway table was
  already renamed to `LegislationSection_DEPRECATED_2026-06-19` (date suggests this happened the day
  before `corpus_fts`'s last successful build, 2026-06-20 — likely the same cutover). Schema and DB are
  out of sync right now.
- **One live-broken route from that drift:** `app/api/legislation/test-sections/route.ts` (public,
  no-auth "research tool") is the ONLY code path still calling `prisma.legislationSection.findMany(...)`
  — it would 500 if hit today, since that table name no longer exists. Given it's the sole remaining
  reference, `LegislationSection` may already be closer to actually droppable than item #1+#2 assumed —
  worth weighing whether removing/fixing this one route unblocks dropping it sooner, ahead of the full
  Act-metadata sub-project, rather than only as part of it. Not removed this session (out of scope of
  what was asked). Script (throwaway): `scripts/ingest/search/_legacy-row-split-tmp.ts`.

---

## CURRENT STATE — SEARCH: FTS rebuild + cursor fix COMPLETE, `corpus_fts` fully reconciled (2026-07-29 20:14 UTC)

**Executes the "FTS rebuild + cursor fix" brief pulled out of the queued Act-metadata sprint (16:12
UTC) to run separately, ready-now.** All four asks done: (1) append-safe catch-up mechanism built,
(2) the backfill run to completion, (3) completeness confirmed across scottish-parliament-or/treaty
corpora/cma-cases/Hansard, (4) this write-up.

**1. Fix shipped — `scripts/ingest/search/fts-catchup.ts` (new, committed).** Rather than rework
`build-fts-index.ts`'s id-cursor (higher-risk change to a script that already correctly completed a
16.5M-row build once), this does a full per-corpus RECONCILIATION every run: count `corpus_sections`
(status='compiled') vs `corpus_fts` per corpus, diff the exact id sets for any corpus with a gap, and
APPEND the missing rows. Self-healing against any future drift, not just id-sort position — run on a
schedule (e.g. daily via `ops.ts`) to stop the gap regrowing. **Correctness does not require a
`createIndex()` rebuild after appending**: confirmed LanceDB's default query behaviour (no
`.fastSearch()` call anywhere in `rankedSearch()`/`fts-core.ts`) scans un-indexed fragments alongside
the FTS index, so newly-appended rows are searchable immediately — verified directly against the live
production module, not just a throwaway repro (a freshly-backfilled `cps-guidance` row ranked #2 via
`rankedSearch()` with zero reindex). `createIndex()` stays available via `--reindex` as a pure
performance step for later.

**2. Full audit before backfilling — the gap was much bigger than the two corpora first sampled.**
Per-corpus reconciliation (`corpus_sections` compiled count vs `corpus_fts` count, every corpus) found
**21 corpora with a gap, 1,172,169+ rows missing** (grew to ~1,177,770 by the time of the dry-run,
live proof the gap was actively widening under the old cursor, exactly as flagged): `scottish-
parliament-or` entirely absent (1,043,264, ~89% of the total gap), `early-day-motions` (50,437 of
60,737 — 83% missing, a new finding), `uk-treaties-fcdo` (23,372, entirely absent), `cma-cases`
(21,525, entirely absent), `pwdata-wrans`/`pwdata-debates`/`pwdata-lords`/`pwdata-westminster`/
`pwdata-lordswrans`/`pwdata-lordswms`/`pwdata-wms` (partial — the "Hansard gap", ~24k combined),
`erskine-may` (1,319 of 1,873 — 70% missing), `members-interests` (2,768 of 3,448 — 80% missing),
`ofgem` (4,272), `parliament-treaties` (328, entirely absent), `inquiry-evidence` (89, entirely
absent), `lgsco` (20 of 40 — 50% missing), `petitions`/`quangos-govuk`/`ico`/`cps-guidance`/
`pwdata-lordswms` (small tails). The prior "264k unexplained gap" figure referenced going into this
work is **superseded by this exact, itemised audit** — not reconciled against that number since this
one is the ground truth (full per-corpus count, not an estimate).

**3. Backfill executed — all 1,172,169+ rows written, verified complete.** Final full-corpus
`--dry-run` reconciliation: **0 corpora with gaps, 0 rows missing.** `corpus_fts` total
16,509,051 → **17,700,396**. Spot-verified: `scottish-parliament-or` count (1,043,264) exactly matches
`corpus_sections`, 0 duplicates (distinct ids == total rows); `cma-cases` and `early-day-motions` also
clean (0 duplicates). Searchability confirmed live via `rankedSearch()`: a freshly-backfilled
`cma-cases` row and `early-day-motions` row both rank in the top 10 for a phrase pulled from their own
body; a `scottish-parliament-or` row scores **rank 1 of 500** in a raw unboosted FTS scan on its own
distinctive terms (fully indexed and matchable) — it just doesn't win `rankedSearch`'s TITLE_BOOST/
tier-boost ranking for a generic query, because `corpus-map.ts`'s `tierFor()` has no entry for
`scottish-parliament-or` (falls through to `tier: 'other'`, no boost) — a **pre-existing corpus-map.ts
gap, not introduced by this backfill**, and consistent with the noise-burial pattern already diagnosed
in the 08:10 UTC entry below. Not fixed this session (a labelling/taxonomy question, out of scope of
what was asked) — flagging for whoever next touches `corpus-map.ts`'s tier map.

**4. Operational incident + clean resolution, worth remembering for future long-running sessions:**
attempting to chunk the ~1M-row `scottish-parliament-or` backfill across repeated harness-tracked
`Bash(run_in_background: true)` calls (needed because the tool caps a single invocation's actual
runtime at 600s, whether foreground or background) ran into the tool's timeout repeatedly; using
`TaskStop` / letting the timeout fire to "kill" a chunk **did not actually terminate the underlying
Windows node process** — it kept running, unsupervised, writing to `corpus_fts` in the background,
invisible to the harness. Multiple such zombies accumulated (one, an attempted `tbl.optimize()`
compaction, alone burned 3,939 CPU-seconds before being found) and wrote **overlapping/duplicate
batches concurrently** — `scottish-parliament-or` ended up with 274,000 rows for only 88,390 distinct
ids (up to 4× duplicates) before this was caught. **Root cause of the confusion, now resolved:** the
apparent "fragmentation slowdown" that made repeated diff-fetches progressively slower was actually
resource contention from these accumulating zombie processes, not Lance table fragmentation — killing
them (`Stop-Process -Force` on all `node` processes, verified via `Get-Process`, not just the harness's
own tracking) restored normal query latency immediately (a full-row fetch that had been hanging past
600s completed in 3.3s once the zombies were gone). **Fix:** deleted the corrupted
`scottish-parliament-or` slice (`tbl.delete(...)`, cheap — 3.3–8.1s regardless of row count, since it's
predicate-based, not a full fetch) and re-ran the backfill ONE more time as a genuinely OS-level
detached process (`nohup ... > logfile 2>&1 & disown`, absolute paths, polling the log file — not the
harness's `run_in_background`/`TaskStop`, which is a leaky abstraction here) — completed cleanly,
verified 0 duplicates. **General lesson for this environment:** the harness's "killed" status on a
background task means "the harness stopped watching it," not "the process is dead" — for anything that
mutates shared state (a Lance table, a DB), verify with `Get-Process`/OS tools before trusting it, and
prefer real OS-level detachment for genuinely long operations rather than fighting the tool's ~10-minute
per-call ceiling.

**5. Outstanding, not blocking:** `corpus_fts` has accumulated many small fragments from all the
`tbl.add()` batches across this backfill (and the historical incremental builds) — a `tbl.optimize()`
compaction pass is recommended for live query latency, but was not completed cleanly this session (the
attempt became one of the zombie processes above, uncertain whether it partially compacted before being
killed — Lance's atomic-commit design means this is safe, not corrupting, just incomplete). Flagging as
a follow-up, not correctness-blocking (confirmed rows are searchable regardless of compaction state).

**Scripts:** `scripts/ingest/search/fts-catchup.ts` (real, committed). Throwaway diagnostics (not
committed, left untracked per repo convention): `_fts-gap-audit-tmp.ts`, `_stale-vector-diag-tmp.ts`,
`_stale-vector-diag2-tmp.ts`, `_dedup-check-tmp.ts`, `_dedup-check2-tmp.ts`, `_dedup-spotcheck-tmp.ts`,
`_dedup-fix-tmp.ts`, `_quick-count-tmp.ts`, `_optimize-fts-tmp.ts`, `_final-search-verify-tmp.ts`,
`_final-search-verify2-tmp.ts`, `_sp-search-deep-tmp.ts`.

---

## CURRENT STATE — SEARCH: stale-vector mechanism identified + scoped legislation-tier recall test (2026-07-29 08:10 UTC)

**Part 1 — "removed since indexing" ghosts are `corpus_fts` staleness, NOT deletion.** Sampled 17 of the
`(metadata unavailable — section may have been removed since indexing)` ids from `VECTOR_DOSSIER.md`
(16 `scottish-parliament-or` + 1 `cps-guidance`). **17/17 exist in `corpus_sections` (Neon, the
keyword source of truth) AND in `corpus_chunks` (Lance, the vector pipeline's own body manifest —
full text retrieved, content confirmed intact). 0/17 exist in `corpus_fts`** (the Lance keyword table
the dossier script queries for display metadata, and the live BM25 arm's index).

**Root cause confirmed:** `corpus_fts`'s checkpoint (`_search/corpus_fts.checkpoint.json`) shows
`phase: "done"`, `updatedAt: 2026-06-20T17:34:13Z`, `lastId: "written-statements:2026-06-01:..."`.
The build resumes via a plain **lexicographic string cursor** (`WHERE id > lastId ORDER BY id`), which
only ever moves forward. All 1,043,743 `scottish-parliament-or` rows were created **2026-06-25 —
five days after that build completed** — no rebuild has run since, so the entire corpus (0/1,043,743
rows) has never been in `corpus_fts`, and a plain resume can never pick it up either (`s` sorts before
the cursor's final `w...` value, so `id > lastId` permanently excludes it without a `--reset`).
`cps-guidance` (created 2026-06-20, same day, 224/270 present) shows the same mechanism on a smaller
scale: rows compiled by the concurrent ingest worker after that single run's cursor had already swept
past the `cps-guidance:` id range are invisible to a forward-only cursor. **Not a reprocessing decision,
not a join-key mismatch between the vector's stored id and the current DB — both point at the same row,
which genuinely exists — `corpus_fts` is simply missing everything ingested after its last build that
sorts before the final cursor position.** The vector arm's ANN search correctly finds these sections
(they're properly embedded); it's the metadata/snippet lookup (which reads `corpus_fts`) that comes up
empty and prints the misleading "removed" placeholder.
**Blast radius:** at minimum the full 1.04M-row `scottish-parliament-or` corpus is currently
unsearchable via BM25/keyword at all, plus a partial `cps-guidance` gap — likely more corpora are
affected (anything seeded/re-ingested after 2026-06-20 whose id sorts before `written-statements`, i.e.
most of the alphabet). **Not exhaustively audited this session** (only the 17 sampled ids + the two
corpora's row counts were checked) — a full completeness sweep (`corpus_sections.createdAt` vs the
checkpoint's `updatedAt`, per corpus) is the natural next step. **Fix needs a `corpus_fts` rebuild**
(full `--reset`, or a targeted backfill of rows created after 2026-06-20) — Charlie's call on which,
not executed this session (multi-hour class of operation). Diagnostic scripts (throwaway):
`scripts/ingest/search/_stale-vector-diag-tmp.ts`, `_stale-vector-diag2-tmp.ts`.

**Part 2 — scoped (tier=legislation) recall test, B1–B3.** Filter-only, no rebuild (both `corpus_fts`
and `corpus_vec` already carry `tier` per row via `corpus-map.ts`). Full report:
`docs/VECTOR_DOSSIER_SCOPED.md` (full section text, not snippets, top 3 per arm).

- **B1 (landlord eviction) — CONFIRMS the noise-drowning diagnosis on the vector arm:** vector-alone
  unscoped does not surface HA 1988 s.21 in the top 10 at all; **scoped to legislation, it appears at
  rank 8.** BM25 fails both scoped and unscoped (never retrieves it regardless of tier — a genuine
  BM25 vocabulary gap, not a noise problem).
- **B3 (photographing people in public) — CONFIRMS the same pattern:** vector-alone unscoped misses
  Sexual Offences Act 2003 entirely (top 10 is petitions + Scottish-Parliament-OR ghosts + a 2026 Act);
  **scoped to legislation, SOA 2003 s.67A appears at rank 6.** BM25 fails both scoped and unscoped.
- **B2 (Airbnb whole-house lets) — DOES NOT confirm the diagnosis; a distinct failure mode.** Neither
  arm recovers the anchor Acts (Levelling-up and Regeneration Act 2023 / Deregulation Act 2015 s.44 /
  Use Classes Order) even scoped to legislation-only — the vector-alone top 10 stays dominated by
  unrelated pre-2000 housing-benefit-SI and redevelopment provisions regardless of scoping. BM25
  unscoped had a loose phrase-match at rank 9 (a parliamentary debate that happens to say "Use Classes
  Order," not the Act itself) — **scoping to legislation actually loses that hit** and surfaces nothing
  better. B2 looks like a genuine embedding/vocabulary miss where the anchor never enters the candidate
  set at all, scoped or not — not a case of the right answer being buried in noise. Worth its own look
  rather than folding into the noise-drowning story.

**Net read: 2 of 3 archetype-B queries tested show sharp vector-alone recall recovery when scoped to
legislation, supporting the "drowning in noise, not failing to find the law" diagnosis — but it is not
universal (B2 contradicts it), so scoping is not a substitute for fixing retrieval quality, only a
partial mitigation.** `LEX_SEARCH_VECTOR` stays OFF; this doesn't change that gate on its own. Script:
`scripts/ingest/search/_dossier-scoped-tmp.ts`.

**Part 3 — B2 follow-up: the Part 2 test above was RAW query, no Stage-3 expansion.** Re-ran BM25
B2 scoped WITH expandQuery's enrichment (mirroring score-fts.ts's exact merge mechanism). **Result:
B2 recovers under expansion+scoping — it is NOT a new/distinct vocabulary gap, it's the July A/B
finding (expansion already recovers B2 unscoped) and legislation-tier scoping, just never tried
together.** Levelling-up and Regeneration Act 2023: unscoped+expansion rank 12 → **scoped+expansion
rank 7** (scoping helps further). Use Classes Order: raw rank 9 → expansion rank 1 (scoped or
unscoped, tied). **One sub-source still never recovers in any of the 4 arms: Deregulation Act 2015
s.44 (the London 90-night provision)** — a standalone gap, not explained by either fix.
**⚠ Side-discovery, unrelated to B2, flagging separately: the production `expandQuery()`
(`scrutinise-web/lib/lex/query-expansion.ts`, `LEX_QUERY_EXPANSION` flag) is currently NON-FUNCTIONAL
against live `gemini-2.5-flash`** — the model's default "thinking" mode consumes the entire
`maxOutputTokens: 512` budget before writing any output (`finishReason: MAX_TOKENS`, ~488
`thoughtsTokenCount`, output truncated mid-JSON), so `JSON.parse` always fails and the function
silently degrades to EMPTY (by design — fail-open, no user-facing harm since BM25 falls back to the
bare query — but the feature does nothing if the flag is ever turned on). **Verified fix:** add
`thinkingConfig: { thinkingBudget: 0 }` to `generationConfig` — confirmed via direct API round-trip
(same prompt: `MAX_TOKENS`/empty parts → `STOP`/full valid JSON). **Not patched this session** — this
is a live-file change outside what was asked; Charlie's call whether to ship it. This was NOT
happening back on 1 Jul when the Stage-3 A/B was measured (it produced real anchors then) — something
changed in the model's default behaviour or the call site between then and now, unconfirmed which.
Scripts (throwaway): `scripts/ingest/search/_b2-scoped-expansion-tmp.ts`,
`_expansion-raw-debug-tmp.ts`.

**Note for the ingest/index-check thread (flag only, no action taken):** the `corpus_fts` rebuild
(Part 1 above) is now a **precondition** for any legacy-route migration work, not a parallel/independent
task — repointing those routes today, before the rebuild, would silently drop the entire
`scottish-parliament-or` corpus (1.04M rows) from production keyword results.

**One-line thought on preventing a repeat (no action taken):** the same "silent staleness" pattern
that bit the embed observer now confirmed to have bitten `corpus_fts` too — a cheap fix would be the
same `embed-observer.ts` pattern (already shipped for `corpus_vec`) applied to `corpus_fts`: a daily
Railway `ops` check comparing `MAX(corpus_sections."createdAt")` against the `corpus_fts` checkpoint's
`updatedAt`, alerting if the gap exceeds some threshold (e.g. 24h) — one query + one checkpoint read,
no new infra.

---

## CURRENT STATE — INGEST: Treaty coverage extension (8 Jul 2026, drain confirmed + re-baselined 21 Jul)

**`TREATY_INGEST_BRIEF.md` executed end-to-end** (ingest thread). CHANGE_LOG "INGEST — Treaty
coverage extension" (2026-07-08 16:33 UTC). `scripts/ingest` `tsc --noEmit` = only the 4 documented
pre-existing errors, unrelated. **Code committed to `Main` 2026-07-21** (`7deffbf`) — it had been
built and documented on 8 Jul but never pushed until this session.

- **STEP 0:** confirmed `uk-treaties` (3,264 sections/1,519 docs) + `tax-treaties-dta` (324/172) are
  entirely gov.uk-sourced (`filter_format=international_treaty`, V19) — not FCDO's own archive, not
  Parliament's. Extending, not duplicating.
- **STEP 1 `uk-treaties-fcdo` (new corpus) — ✅ SEEDED + DRAINED, re-baselined:** treaties.fcdo.gov.uk
  has no bulk export and no server-rendered HTML (legacy JBoss/Knowvation Backbone SPA) — the
  underlying anonymous JSON REST API was reverse-engineered from the SPA's own JS
  (`sources/fcdo-treaties.ts`: anonymous session login + `POST /awweb/awfp/search/1`). **Measured
  universe = 21,970 records — an honest-denominator correction against the brief's/gov.uk's ~15,000
  estimate.** 33% (7,184) carry a full-text PDF; 67% (14,786) are metadata-only records with no full
  text anywhere on the site — these get a compiled, searchable section built from the API's
  structured metadata (`availabilityStatus: 'metadata-only'`), not silently dropped. Dedup vs
  existing gov.uk-sourced corpora is best-effort exact-title-match (different id namespace, no shared
  key) — 127 skipped. Licence OGL v3.0, verified via the FCDO's own data.gov.uk catalogue entry (the
  site itself has no terms page). Pilot (3 diverse rows incl. a genuinely-scanned 1976 PDF) passed
  clean. **Drain confirmed complete 21 Jul: 0 open `ingest_queue` rows (pending/claimed/blocked/
  failed), 23,372/23,372 `corpus_sections` compiled, 0 residue** — the queue's completed rows have
  since been auto-purged by the 7-day cleanup job (`run-cleanup.ts`), which is why the queue itself
  now shows empty rather than "done". Section count (23,372) exceeds the 21,843 queued-row estimate
  because multi-PDF records produce more than one section each. **Re-baselined:**
  `corpus_targets.est_sections` 21,843 → **23,372**, `est_is_confirmed` false → **true**.
- **STEP 2 `parliament-treaties` (new corpus) — COMPLETE, 328/328, 0 failures:** the documented
  `treaties-api.parliament.uk` OpenAPI (same family as bills-api/committees-api) covers the CRaG 2010
  scrutiny register — laid dates, parliamentary conclusion, sponsoring department, and a
  BusinessItems timeline (debates, committee evidence, objection-period tracking). Kept as its own
  corpus rather than an enrichment on `uk-treaties-fcdo` (CC's call, brief left it open): different id
  space, different content kind (procedure vs treaty text), matches the codebase's existing
  parliamentary-procedure-APIs-stay-separate convention. Licence OPL v3.0 (verified family). Fully
  seeded and drained this session.
- **Wiring:** `licence-map.ts`, `seed-rate-limits.ts`, `search/corpus-map.ts` all updated for both new
  corpora.
- **NEXT:** nothing outstanding — both corpora fully drained, code pushed, targets re-baselined.

---

## CURRENT STATE — SEARCH: VECTOR rebuild COMPLETE — regression did NOT recover; positions rider abandoned (2026-07-22)

**Rebuild executed end to end on a Vultr box (128GB, `voc-g-32c-128gb-640s-amd`, lhr). Compaction
succeeded this time (1,821 fragments → 40, no OOM) — but recall did NOT recover.** Vector-alone
70.5% post-rebuild vs 71.2% pre-rebuild (statistically flat, reproduced twice bit-for-bit across
independent runs). **This overturns the original diagnosis:** compaction-skip was NOT the actual
cause of the regression. `LEX_SEARCH_VECTOR` stays OFF. This is now a search-quality question, not
an infrastructure one — see "what this means" below. Reports: `docs/VECTOR_FULL_RECONFIRM.md`,
`docs/VECTOR_NPROBES_DIAG.md`.

- **Positions rider (bonus, step 4): ABANDONED per the "abandon, don't debug" rule.** The prepped
  single-shot `withPosition:true` build on `corpus_fts_positions` hit a **hard R2/S3 multipart-upload
  limit (10,000 parts)** writing the inverted-index file — a platform ceiling, not a transient fault,
  so retrying would fail identically every time. Stopped immediately per spec rather than let the
  retry wrapper burn paid box-time. `corpus_fts_positions` is left in a partial, isolated state (zero
  risk to live `corpus_fts`) for a future attempt that rethinks the upload chunking — not investigated
  further this session, as directed.
- **Process note:** the vector-rebuild box was torn down before the positions rider ran (ordering
  mistake — the plan was rebuild → reconfirm → positions rider → teardown), requiring a second
  short-lived box for the positions attempt. Minor extra Vultr spend (~20 min), no data risk.

- **Diagnostic trail (22 Jul, before the rebuild):** full-index recall was measured at BM25-alone
  62.2% (pilot 68.3%, −6.1pp — expected corpus-scale control), vector-alone 71.2% (pilot 85.9%,
  −14.7pp), fused 70/30 71.2% (pilot 87.8%). Archetype B (lay-concept) at 30.6%. Harness self-tested
  clean (pure `fuseWeighted` unit tests + live-wiring re-check, both PASS — the regression was real,
  not a scoring bug). An nprobes[24..512]/refineFactor[2,4] query-time sweep found no recovery (flat
  ~70–71%), which correctly ruled out under-probing — but the working hypothesis at the time (the
  un-compacted index's degenerate IVF partitions) has now ALSO been ruled out by the rebuild result
  above. Also found: ~9s/ANN-call latency at the nprobes=24 production default — independently
  unshippable regardless of the recall question, unexplained, needs its own look before any flag work.
- **DO preflight (22 Jul): account active but size-gated** — `/v2/sizes` exposes only `m-2vcpu-16gb`,
  none of the larger Memory-Optimized tiers (new-account premium-class gate; the droplet_limit=10
  count cap is separately fine). Ask for Charlie if DO is wanted later: a support ticket for
  Memory-Optimized access, not a droplet-count increase. **Vultr had no such gate** — full range of
  64GB–2TB+ memory-optimized plans available immediately; used for both boxes this session.
- **What this means / NEXT:** the vector regression is now an **open search-quality question**, not
  an infrastructure one — ruling out compaction removes the only concrete lead so far. Candidate
  directions for a future session: (a) compare the pilot's and the full build's chunking/collapse
  logic for a subtle difference; (b) embed a larger (e.g. 500k–1M row) curated validation slice to see
  whether recall degrades gradually with scale or drops off a cliff, which would distinguish "ANN
  inherently loses recall at 21.8M scale" from "something is wrong with the full corpus specifically";
  (c) separately investigate the ~9s query latency, which blocks shipping regardless of the recall
  outcome. `LEX_SEARCH_VECTOR` stays OFF pending this. The positions build can be retried another day
  with a rethought upload-chunking approach (`corpus_fts_positions` left in place, isolated, harmless).

---

## CURRENT STATE — SEARCH: VECTOR EMBED full run — ANN INDEX BUILT, embed COMPLETE (2026-07-21)

**The full-corpus embed is DONE end to end.** `corpus_vec` checkpoint: `phase: "done"`, **1,821/1,821
shards, 21,846,364 vectors, 0 misses** (matches `corpus_chunks` exactly — zero loss across the whole
run). Superseded everything below in this section (kept for the incident trail). CHANGE_LOG entry
pending same session.

- **What happened between the 11 Jul "batch run LIVE" state and now:** the batch drain finished
  unattended (as expected) reaching 1,821/1,821 shards, phase→`indexing`. The indexing step
  (`vecTbl.optimize()` fragment compaction ahead of `createIndex()`) then **OOM-killed twice (exit
  137)** on the running cpx62 (32 GB) box — genuine OS SIGKILL, not a JS exception the code's
  try/catch could ever see. **CCX43 (64 GB), the documented fallback, is unavailable on this Hetzner
  account** (`dedicated_core_limit exceeded` — the same wall STEP 1's box selection hit; confirmed
  again live). No shared-core Hetzner type goes above 32 GB, so a bigger box wasn't an option.
- **Fix shipped (commit `fe518eb`):** `VECTOR_SKIP_COMPACT=true` on `build-vector-index.ts` skips
  `vecTbl.optimize()` and runs `createIndex()` directly over the un-compacted fragments — compaction
  is a read-efficiency step, not required for index correctness. Relaunched cpx62, index built
  **in 711.7s (~12 min)**, exit 0. Also bundled the 16 Jul `uncaughtException` crash-recovery handler
  (same file, already resilient to the stale-keep-alive-socket class of fault) — this is what let the
  *first* cpx62 box's retry loop survive the initial 25-min stall alert before the OOM was even found.
- **⚠ Quality caveat, NOT yet validated:** skipping compaction means the IVF_PQ index was built over
  ~1,821 un-merged shard fragments rather than one compacted table. The build log showed repeated
  `lance_index::vector::kmeans` warnings ("more than 10% of clusters are empty… dataset too small to
  have a meaningful index") during training, and many `partition N is empty, skipping` lines during
  the build proper. This MAY just be normal large-scale IVF_PQ chatter, or may mean partition
  assignment is less globally optimal than a compacted build would give — **not established either
  way**. This is exactly what the existing NEXT step (fusion + recall re-confirm on the full ANN
  index, gold-key validation) is for — treat that re-confirm as also validating this build, don't
  skip it. If recall comes back visibly worse than the pilot's 85.9% vector-alone number, the
  follow-up is a compact-then-reindex pass (needs the CCX43-quota problem solved first — a Hetzner
  support request to raise the dedicated-core limit, or process compaction in smaller batches).
- **Spend:** box torn down (`teardown`, confirmed). No further Hetzner billing. Total run cost is
  whatever the sync+batch embed phases already cost (§5.3/§6 estimate ~$470–560) — the index-build
  retries were compute-only on an already-running/short-lived box, not additional Gemini spend.
- **NEXT (unchanged from the existing plan, all still Charlie-gated):** (1) fusion re-confirm on the
  full ANN index (pilot's 70/30 weighting was tuned on the 60k exact-cosine subset, not ANN) —
  **this run doubles as the quality caveat's validation**; (2) gold-key validation; (3) flag flip
  (`LEX_SEARCH_VECTOR`) once both pass; (4) reranker (layer 5); (5) if recall regresses, plan a
  compact-then-reindex pass (blocked on Hetzner dedicated-core quota — flag to Charlie if needed).

---

## CURRENT STATE — SEARCH: VECTOR EMBED full run — TIER 2 FLIPPED, batch run LIVE (2026-07-11)

**Status corrected 2026-07-11 21:35 UTC (laptop diagnosis).** The prior "Tier 1 blocked / spend
PAUSED / awaiting Charlie's go" text below was STALE — the tier flip and batch relaunch already
happened on the desktop (7 Jul). Verified live from this laptop: **the batch embed is RUNNING and
actively progressing** (watched shards 849→850→851 complete in real time, checkpoint advancing).

- **THE RUN IS NOT STALLED — it is live.** At 2026-07-11 21:32 UTC: **851 / 1,821 shards done
  (~46.7%), 10,212,000 vectors banked, 0 misses**, phase=`embedding`, `corpus_vec` checkpoint
  advancing every ~2–3 min. Gemini batch jobs all `JOB_STATE_SUCCEEDED`; the newest is the shard
  currently RUNNING. The `create 429 (quota bucket)` waits in the tail log are **normal Tier-2
  pacing** (f6022df: 429 is a signal, not an error), NOT a failure. Correlation fix (84eba61) +
  create-429 pacing are working — 0 misses across 851 shards.
- **Why it looked "stalled":** (a) this laptop's clock is ~24.5h BEHIND (read 07-10 21:00 UTC when
  true time — 3 independent network sources — was 07-11 21:26 UTC); every timestamp looked "in the
  future / negative age". (b) The £46.55 July console figure = the **sync slice only** (~$47, 34
  shards / 408k vec); batch charges hadn't posted to the reading Charlie saw. **Fix the laptop clock
  (`w32tm /resync`) before any commit — CLAUDE.md §12 UTC stamps depend on it.**
- **Spend reconciliation (est):** sync slice ~$47 (£46.55, matches console) + batch-to-date ~$200–260
  (≈9.8M vec at $0.075/1M, token density varies by region) ≈ **~$250–310 so far**; on track for the
  report's **~$470–560** total projection. Read the LIVE billing console (now 07-11) for the true
  batch figure — the £46.55 is a stale sync-only snapshot.
- **Tooling gap — CLOSED 2026-07-11.** The email observer that was never built now ships:
  **`scripts/ingest/search/embed-observer.ts`**, wired into `ops.ts`'s 15-min cycle (R2-only,
  edge-triggered, no-op when idle). Emails `cl@scrutinise.org` on transitions: 🔴 STALL (>25m idle
  while embedding) · 🟢 RECOVERED · ✅ COMPLETE · 💚 daily HEARTBEAT (silence = healthy) · 💥 CRASH
  (tail-log `build exited code≠0`/`FATAL`/shard-`FAILED`, **any phase**) · ⏳ ANN-STUCK (indexing
  frozen >8h). The CRASH scan + ANN-STUCK ceiling close the phase=indexing blind spot (an ANN OOM
  would otherwise be silent). 23/23 offline tests pass; one confirmation heartbeat email sent.
  **Deploys with `ops` on the next push** (auto-deploy). Detail: `VECTOR_EMBED_REPORT.md` §6.2.
- **Resolved:** laptop clock fixed (`w32tm /resync`); `HETZNER_API_TOKEN` refreshed → box confirmed
  live via API (`scrutinise-build`, id 148701597, cpx62, running since 2026-07-07 08:08 UTC).
- **NEXT (no relaunch needed — it's running):** (1) push so `ops` deploys the observer; (2) let the
  batch drain to 1,821/1,821 (at the observed cadence, on the order of a few days) — the observer now
  emails if it stalls; (3) the ANN IVF_PQ index then builds automatically (phase→indexing; 32 GB OOM
  risk → `--index-only` on a CCX43 fallback; observer's ⏳/💥 alerts cover a failure here); (4) when
  done, `hetzner-build-run.ts teardown` (this laptop has no state file — tear down by id 148701597 or
  recreate `.hetzner-build-server-id`). Report: **`docs/VECTOR_EMBED_REPORT.md` §5–§6**.

<details><summary>STALE (7 Jul, superseded) — tier-wall / sync-mode / "spend PAUSED, awaiting go"</summary>

- **STEP 1 DONE (durable):** `corpus_chunks` on R2 = **21,846,364 chunks** from 17,640,560 sections
  (1.24/section, 230 body misses, ~32h on a cpx62 — CCX43 still quota-blocked). Never re-run.
- **STEP 2 WAS BLOCKED at the Batch tier:** account = paid Tier 1 → **500k enqueued-token queue**
  (probed: 182k ACCEPTED / 2.56M REJECTED; docs T1 500k / T2 5M / T3 10M). Original 40k shards
  (~12.4M tok) fit no tier. Learned en route: id-list load needs
  `NODE_OPTIONS=--max-old-space-size=28672` (V8 default-heap OOM, exit 134); cloud-init now injects
  GEMINI_API_KEY (`c715e00`, §12 carve-out). Zero Gemini spend lost across all failures.
- **Billing decode (Charlie):** £150 payment = CREDIT not spend; usage ≈ $36; Tier 2 = ≥$100 ACTUAL
  usage + 3 days (met) → AUTOMATIC flip. "£189.01 tier cap" = Tier 1's $250/month account ceiling —
  the slice fits. Tier-2 monthly cap $2,000 → remainder fits same month. **[CONFIRMED: flip happened.]**
- **THE GATED PLAN (now EXECUTED):** (0) sync `--canary` → (1) sync slice ~$47 (34 shards) →
  (2) probe confirmed Tier 2 → (3) batch relaunch `VECTOR_SHARD_SIZE=12000 VECTOR_MAX_INFLIGHT=1` —
  **this is the run now live at 851/1,821 shards.**

</details>

---

## CURRENT STATE — GRAPH: Tier 1 legislation graph + rescission traversal (5 Jul 2026)

**Sprint complete** (ingest thread; executes the Tier-1 graph brief). Report:
**`docs/GRAPH_TIER1_REPORT.md`**; CHANGE_LOG "GRAPH — Tier 1" (2026-07-05 16:57 UTC). All code in
`scripts/ingest/graph/`; `scripts/ingest` `tsc` = only the 4 documented pre-existing errors.

- **Store:** Neon `legislation_edges` — **2,348,993 edges, ~0.94 GB** incl. indexes. Columns per the
  brief (from_id, to_id, edge_type, sub_type, source, granularity, detail, extracted_at); ids in the
  corpus_sections `{corpus}:{gid}[:{sectionRef}]` scheme; PK-idempotent; gid expression indexes both
  directions. **⚠ Neon ~16 GB of 17.5 — check `graph/setup-edges-table.ts --status` before adding volume.**
- **Sources (all explicit/structured, bulk-before-API held, no LLM):** TNA bulk amendments XML
  (research.legislation.gov.uk; 2.6M effects → amends/repeals/commences/modifies; secondary types daily,
  primary/EU vintage 2025-10-30); whole-doc CLML `best-collection-xml.zip` already on disk (SI preambles →
  230,681 made-under edges incl. section-level enabling powers; body Citations → 121,279 cites edges);
  In-Force dataset CSVs (~107k act-level historical repeals back to 1235).
- **Audit headline:** per-section raw.xml in R2 has NO `<Citation>` markup (brief premise refuted —
  verified on amending provisions); effects only ever captured for 3,590 legacy UKPGA acts; SI preambles
  never stored per-section. The bulk sources supply all three gaps.
- **Traversal + service:** `graph/traverse-edges.ts` `impactSet(gid, sectionRef?)` → grouped
  madeUnder/citedBy/amendedBy/repealedBy/commencedBy/targetTouches + one-hop over dependent SIs;
  section queries prefix-match subsection grain + inserted siblings. `graph/edges-query-service.ts`
  (POST /impact, :8091) mirrors fts-query-service; smoke-tested live then shut down (no Railway home yet).
- **Gold archetype D through the traversal: 0% floor → 80% (8/10).** D1 2/2 · D2 2/2 · D3 1/1 · D4 3/3 ·
  D5 0/2 (case-interprets-section edges = future sprint, as briefed). Scorer `graph/score-gold-d.ts`.
- **NEXT / follow-ups (report §5):** primary/EU effects vintage top-up; elided revised-SI preambles
  (6,108) via made-version fetch; case-law edges (D5); fold the scorer's Title-Case citation-resolver
  fallback into production; Page-4 rescission-impact report wiring = Lex-side brief once wanted.

---

## CURRENT STATE — SEARCH: VECTOR EMBED (full-corpus pipeline + ANN + flag wiring, 3 Jul 2026)

**Sprint complete — BUILT INERT; the embed RUN is the Charlie-triggered spend** (search thread;
executes the post-pilot/post-fusion embed brief). Report + runbook: **`docs/VECTOR_EMBED_REPORT.md`**.
CHANGE_LOG "SEARCH — VECTOR EMBED" (2026-07-04 13:37 UTC). `scripts/ingest` `tsc` = only the 4
documented pre-existing errors; `scrutinise-web` = only the 2 pre-existing `react-markdown` errors.
New dep `@google/genai@^1.52` (isolates the Batch API's Files-upload + LRO polling).

- **Cost CONFIRMED within the ~$600 gate — no flag raised.** Measured on Neon (`search/measure-corpus.ts`):
  **17,640,217 compiled sections / 6.12 B words → ~22.25 M chunks (1.26/section) → ~6.90 B tokens (chars/4)
  / ~5.69 B (words×1.3)**. Batch rate $0.075/1M (verified ai.google.dev) → **~$430–520**. 768-d halves the
  vector store (~68 GB vs ~137 GB @1536-d), not the embed bill (Gemini meters input tokens).
- **Pipeline (`scripts/ingest/search/`, resumable/idempotent, mirror build-fts-index.ts):** `chunk.ts`
  (validated pilot chunker, pure) → `build-corpus-chunks.ts` (Neon→R2→`corpus_chunks` Lance + citation
  backfill) → `gemini-batch.ts` (ONLY Batch-API module: `:asyncBatchEmbedContent`, 50% discount; pure
  build/parse offline-selftested) → `build-vector-index.ts` (≤40k-req shards, ≤8 inflight, `corpus_vec` +
  IVF_PQ cosine ANN; `--canary`) → `vector-core.ts`/`vector-query-service.ts` (query-embed + ANN serve, INERT).
- **Wiring behind `LEX_SEARCH_VECTOR` (OFF):** `scrutinise-web/lib/lex/vector-search.ts` adapter +
  `search-gateway.ts` fuses via the **tuned 70/30 weighted RRF** (`LEX_FUSION_VECTOR_WEIGHT` 0.7, per
  FUSION_REPORT). Doubly inert (flag OFF + `VECTOR_SEARCH_URL` unset).
- **✅ CANARY RUN + PASSED (2026-07-04 11:51 UTC, ~$0.01, Charlie-approved).** Bounded STEP-1
  (5,000 sections → 23,130 chunks, 0 body misses; full build resumes from this checkpoint) + one live
  200-chunk batch job to `corpus_vec_canary`: job SUCCEEDED, 200/200 vectors all exactly 768-d, order/key
  assertions clean, norms 0.572–0.584, cos(adjacent windows) 0.932 > 0.854 (different sections). **The live
  Batch API JSONL/response contract is CONFIRMED** — the full spend is de-risked. (SDK flags
  `createEmbeddings()` experimental — pin `@google/genai` if re-installing.)
- **REMAINING RUN ORDER (Charlie-triggered):** `hetzner-build-run setup` →
  `run "…build-corpus-chunks && …build-vector-index"` (~$430–520 Batch spend) → `logs` (fts-watch
  checkpoints) → `teardown`.
- **Left OFF deliberately:** 70/30 fusion needs full-corpus re-confirm through the ANN path (pilot tuned on
  the 60k exact-cosine subset); ANN recall vs exact is a separate measurement; gold key still draft. The
  flag-flip is the next sprint.

---

## CURRENT STATE — SEARCH: FUSION TUNING (weighted RRF vs routing, 3 Jul 2026)

**Sprint complete** (search thread; the pilot's flag-flip follow-up — ran on the already-embedded
pilot subset, zero new embedding cost). Decision: **`docs/FUSION_REPORT.md`**; numbers
`docs/FUSION_RESULTS.md`/`fusion_tuning.json`; harness `scripts/ingest/search/pilot-fusion.ts` (new).
CHANGE_LOG "SEARCH — FUSION TUNING" (2026-07-03 22:54 UTC). `scripts/ingest` `tsc --noEmit` = only
the 4 documented pre-existing errors. Self-check: w=0.5 reproduces the pilot naive-RRF hybrid
byte-identically for all 3 models.

- **DECISION: ship weighted RRF at a single fixed 70/30 (vector/BM25), RRF_K=60 — no query-kind
  router.** gemini: **87.8%** recall@20 excl-floor vs naive RRF 84.3% / vector-alone 85.9% / BM25
  68.3%. The pilot's blocker (naive fusion < vector-alone) is resolved — weighted fusion is now
  strictly the best arm. At 70/30: A 100% · B 69.4% · B6 50% · C 93.3% · E 100% · F 80%.
- **A single fixed weight is competitive with kind-based routing — routing adds exactly nothing.**
  Full (wCit,wCon) grid over the production-detectable `parseCitation()` router tops out at 87.8%
  (ties fixed; none beat it). Why: at 70/30 the BM25 citation-resolver pin survives fusion, so
  citation queries keep 100% without routing; only ≥80/20 breaks A1 (100→50, dilution). Router
  also over-triggers on E-debate queries naming Acts (harmless here, but blunt) → prefer no-router.
- **Robust, not a spike:** 60/40=85.3 / 70/30=87.8 / 80/20=85.9 (plateau). voyage's optimum is
  also vector-heavy (80/20=86.9%) and weighting **fixes its B6 collapse** (naive 0% → 33.3%);
  e5 (weak model) stays best at 50/50 → the right weight tracks vector-arm strength (re-tune on a
  model swap = one cheap `pilot-fusion.ts` re-run). Watch-item: F5 (BILLS) 100→50 at w≥0.7.
- **Ship spec (§ of FUSION_REPORT):** fused score `0.7/(60+rank_vec) + 0.3/(60+rank_bm25)` over the
  BM25-with-resolver-pin arm; weight as env config (`LEX_FUSION_VECTOR_WEIGHT`, default 0.7).
- **NEXT (unchanged gates):** full-corpus gemini embed (test @768-d first) → ANN index → wire the
  `vector` capability flag with THIS fusion; re-confirm 70/30 on the full corpus (plateau means the
  flag-flip doesn't hang on it). Gold key still the unvalidated draft.

---

## CURRENT STATE — SEARCH: type-taxonomy display fix (§10.2, 3 Jul 2026)

**Fix shipped in code (search thread).** Report: **`docs/TYPE_TAXONOMY_AUDIT.md`**; CHANGE_LOG
"SEARCH — type-taxonomy display fix" (2026-07-03 22:14 UTC). `scrutinise-web` `tsc` = only the two
pre-existing `react-markdown` errors. Changed: `scrutinise-web/lib/lex/corpus-type-map.ts`.

- **Brief's premise refuted for MiFID (verified empirically).** retained-EU (→EU_LEGISLATION) and
  SI (`uksi`→STATUTORY_INSTRUMENT) ALREADY map correctly + render. "Revoke MiFID II" is empty because
  BM25 doesn't RANK the validated answers (MiFIR/SI-701/FSMA-2023) into the results at all — the B6
  ranking problem, not display. A type-map change can't surface them → that's the vector layer
  (`docs/PILOT_REPORT.md`). Reported honestly, not faked.
- **Real bug fixed: 13 hidden corpora → 4.** FTS `tier` is baked into the index; corpora seeded after
  `corpus-map.ts` last covered them carry `tier:'other'` → fell through to `null` → panel hid them.
  Biggest: **`scottish-parliament-or` = 1.04M sections**. Fixed in the DISPLAY layer
  (`CORPUS_DISPLAY_OVERRIDE`, by corpus name → works on the live baked-tier index, no reindex):
  scottish-parliament-or/EDMs/petitions → DEBATE; cma-cases/ofgem/ofcom/independent-reviews/
  cps-guidance/inquiry-evidence/lgsco → GUIDANCE. Remaining null (INTENTIONAL): explanatory-notes/
  -memoranda (annotations), erskine-may, members-interests.
- **Follow-ups:** `corpus-map.ts` `tierFor` for reindex consistency; `buildInitialBackground` prose
  narrates only 4/9 types (cards render all); MiFID answer surfacing = vector layer.

---

## CURRENT STATE — SEARCH: VECTOR PILOT (embedding-model bake-off, 3 Jul 2026)

**Sprint complete** (search thread; separate from the LEX thread below). Decision doc:
**`docs/PILOT_REPORT.md`**; numbers `docs/PILOT_RESULTS.md`/`pilot_results.json`; subset
`docs/PILOT_SUBSET.md`. CHANGE_LOG "SEARCH — VECTOR PILOT" (2026-07-03 15:50 UTC). `scripts/ingest`
`tsc --noEmit` = only the 4 documented pre-existing errors. New: `scripts/ingest/search/pilot-*.ts`
(common/providers/subset/chunk/embed/score). Lance pilot tables live on R2 (throwaway, not committed).

- **DECISION: gemini-embedding-001** for the full-corpus embed — NOT the legal-specialist voyage-4.
  On the 60k subset (all gold answers + stratified distractors, 0 MISS; 79,908 chunks), recall@20
  excl-floor: **gemini vector 85.9% / hybrid 84.3% (+16.0pp over BM25 68.3%)**; **voyage-4 vector
  85.9% (TIE) / hybrid 81.1%**; e5-open-weight 70.5%/77.2%. **No legal-specialist premium** — the
  brief's central question answers *no*; gemini is already integrated + wins hybrid + more robust on B6.
- **Vector layer helps where predicted:** archetype B (lay concept) BM25 23.6% → gemini vector
  **69.4% (+45.8pp)**; **B6 (MiFID burial) 0% → 50%** (3/6 sources unburied, all models). Citations
  NOT hurt (gemini hybrid A = 100%).
- **Nuance:** equal-weight RRF *underperforms* vector-alone for strong models (drags them toward the
  weaker BM25; voyage B6 collapses 50%→0%). End-state should route by query kind / vector-weight the
  fusion — NOT naive RRF. Open-weight slot = e5-large-instruct (Together delisted BGE-M3; BGE-* non-serverless).
- **NEXT (gated on Charlie):** full-corpus embed with gemini (test @768-d first — Matryoshka halves
  the ~$0.8–1.2k sticky cost / 1.5× storage of 1536-d) → ANN index → wire the `vector` capability flag
  already reserved in `lib/lex/search-gateway.ts`; then tune fusion + chunking. Provisional (gold key
  still the unvalidated draft). Voyage needs a payment method on the account for standard rate limits
  (done this session; still within free token credits).

---

## CURRENT STATE — LEX REBUILD Sprint 3 + 3-A (full kernel + preview-validation amendments) + Sprint 1.4 (3 Jul 2026)

**Preview only — NOT promoted.** Frontend Sprint 1.4 + the full-kernel Sprint 3 + the **§19-A amendments
(Sprint 3-A)** from Sprint 2 preview validation all shipped to the preview this session (separate from the
SEARCH thread below). Full account: CHANGE_LOG "Sprint 3-A" / "Sprint 3" / "Sprint 1.4"
(2026-07-03 17:27 / 02:02 / 01:58 UTC); as-built in `LEX_PLAYBOOK.md` §11 + §11a.

**Sprint 3-A amendments (§19-A, take precedence over §19):** **A1 (fix-first)** structured fields are now
proposable — Lex synthesises chat into slot JSON (`proposal.valueObject`), box shows "proposed by Lex", user
edits/Saves; new anti-transcribe rule (no more "pop it in the box"). **A2** completed stages collapse in all
three panels (accordions / chat dividers / legislation stage groups). **A3** middle panel auto-scrolls the
next box to top on Save. **A4** cause-seeding diagnosed (likely transient Gemini empty/error, swallowed) +
hardened (stage logging + retry + corpus-grounded fallback). **A5** single-cause root = one-click confirm,
not "which driver"; duplicate bubbles suppressed. **A6** "The Basic Idea" everywhere. **A7** empty legal-tier
copy reworded for retained-EU law (+ retrieval question flagged to the search workstream). `scrutinise-web`
`tsc --noEmit` clean (only the two pre-existing `react-markdown` errors — install on Vercel). Additive schema
**applied to Neon** (`prisma/lex_rebuild_page3_4.sql`, idempotent; 10 placeholder `CostBenchmark` rows).
**Full kernel smoke-tested end-to-end on Neon on the deterministic no-Lex fallback path
(Orientation→Diagnosis→Guiding Policy→Coherent Actions, 16/16 assertions pass; throwaway deleted).**

**COSTING_SCOPE §9 (schema brief) also executed** (extends Sprint 3 Task 5): `CostBenchmark` gains
`priceYear`/`category`/`region`/`uprateMethod`/`confidence`; new `DeflatorSeries { year, index }` table (seeded
illustrative 2015–2026 placeholder); the estimator now UPRATES each cost to the latest deflator year before
aggregating (verified: £1m@2016 → £1.33m@2026). Additive SQL applied to Neon (`prisma/lex_costing_deltas.sql`).
Phase-2 (per COSTING_SCOPE §7) — real ONS deflator + GDP-per-head series, ~50 Tier-1 benchmarks, optimism-bias
uplift, EANDCB RPC-scrutiny flag — is scaffolded and ready. See CHANGE_LOG "COSTING_SCOPE §9".

**COSTING Phase 2a s1 — verified benchmark seed LOADED (placeholders OUT).** `docs/cost-benchmarks-seed-v1.json`
integrated per its loader_note: 5 verified rows in (`v1-qaly` £70k, `v1-wellby` £10–16k, `v1-vpf` £2.0m
GDP_PER_HEAD + contested note, `v1-homicide` £3.2m, `v1-crime-total` £59bn context anchor), all 10 `seed-*`
placeholders deleted (the un-replaced ones are in `_pending` — no unverified numbers in the DB). Loader
`scrutinise-web/scripts/load-cost-benchmarks.ts` (idempotent, `--apply` run on Neon + verified); appraisal
parameters in `lib/lex/costing-params.ts` (STPR/EANDCB VERIFIED; health rate + optimism-bias TRAINING_RECALL,
gated `verified:false`). `_pending` in the JSON = the Phase-2b extraction backlog. See CHANGE_LOG
"COSTING Phase 2a s1".

**COSTING Phase 2a s2 — v2 additions loaded + extraction manifest M1–M11 WORKED (4 Jul 2026).**
**CostBenchmark = 53 verified rows, zero unverified.** v2 (20 HO crime 2019/20 rows) loaded; homicide +
context anchor replaced. Manifest via `scrutinise-web/scripts/costing/` (per-target scripts, verify-against-
bytes, refresh = new SOURCE_URL + re-run): **M3 ✓** real ONS L8GG deflator 1955–2025 (placeholder series
gone; uprating targets 2025); **M1/M2 ✓** TAG May-2026 — live VPF £2,652,796 (replaced provisional £2m) +
casualty/accident + travel-time rows; **M5 ✓** PSSRU 2025 (9 rows); **M6 ✓** ASHE 2025 wages; **M7 ✓** DESNZ
carbon 2026/2030; **M8 ✓** BPE 2025 business counts; **M10 ✓** fraud 2023-24 £2,884/£2,170 + £14.4bn
(v2 fraud row superseded+deleted); **M11 ✓** optimism-bias + 1.5% health rate VERIFIED against the primary
PDFs → `costing-params.ts` fully verified. **⚠ DECISIONS WAITING ON CHARLIE:** (1) **M4 GMCA ingest go** —
licence read from the workbook itself = **CC BY 4.0 (© GMCA 2026)**, attribution satisfied per-row;
`m4-gmca.ts` dry-run-verified with 30 selected entries, `--apply` held per the report-back gate. (2) M9
(HO amendments to unit costs) BLOCKED — gov.uk link 404s; re-check next pass. See CHANGE_LOG
"COSTING Phase 2a s2".

- **Sprint 1.4 (UX polish, frontend).** Prominent coloured **pill** "How this works" centred above the chat
  column (was a tiny link); **auto-opens on a user's first idea**; Lex's first-message aside → "For a quick
  introduction if you don't know what to do, click 'How this works' above."; modal copy rewritten (Welcome +
  three panel boxes + four-stages closing, repetition dropped); first stage / sidebar renamed **"The Basic Idea"**.
- **Sprint 3 (design §16–§19).** (1) **Method layer** `lib/lex/method.ts` — the four Rumelt blocks verbatim,
  injected per stage (M-GENERAL + active block), visible in `[lex-diag]`. (2) **Page 2 refinements** —
  `classification` (material/contributory) chips + root-cause-among-material; who's-affected reframed; cui bono
  captured. (3) **Causal tree** — `parentCauseId` self-FK; List|Map toggle; dependency-free nested tree render
  (**Mermaid deferred** to keep the tsc gate clean — no diagram dep existed); soft depth cap 4. (4) **Page 3
  Guiding Policy** — `PolicyOption` table + `/policy-options`; Lex seeds candidate approaches per material cause
  with for/against; choose→CHOSEN + rest RULED_OUT; whatItRulesOut composed; leverage/responses/conditions/summary.
  (5) **Page 4 Coherent Actions + costing** — `LexCoherentAction` (isolated from legacy `CoherentAction`) with the
  §18.2 three-way cost ranges; `CostBenchmark` + `IdeaAssumption` + 10 placeholder benchmarks; `/actions`; estimator
  with benchmark picker + override; `computeCostSummary` vs the Page 2 problem cost; coherence check + summaries.
- **REMAINING GATE:** Charlie validates `/ideas/create` end-to-end through Coherent Actions on the preview, then
  promote. Real FTS is still stubbed behind the gateway; the benchmark set is hand-seeded placeholders (Phase-2
  research pending). `commit-all.sh` produced for the single end-of-sprint push (do NOT promote).

---

## CURRENT STATE — SEARCH: Stage 3 payoff A/B (recall@20 OFF vs ON, 1 Jul 2026)

**Sprint complete** (search thread; separate from the LEX REBUILD thread below). Full account: CHANGE_LOG "SEARCH — Stage 3 payoff A/B" (2026-07-01 16:03 UTC). Reports: **`docs/FTS_STAGE3_AB.md`** + `docs/fts_stage3_ab.json`. `scripts/ingest` `tsc --noEmit` = only the 4 documented pre-existing errors.

- **B6 answer-key filled + VERIFIED (no coverage gaps).** All 6 MiFID sources present in `corpus_sections`: FSMA 2023 (`ukpga/2023/29`, `pNNNNN` refs), MiFI Regs 2017 (`uksi/2017/701`), retained MiFIR (`retained-eu:eur/2014/600`), **FCA Handbook COBS+SYSC (`fca-handbook:cobs`/`:sysc` — IS ingested)**, FSMA 2000 (`ukpga/2000/8`), onshoring SIs (`uksi/2019/1390`,`uksi/2021/1388`). B6 `scoreable:true`.
- **A/B mode** in `score-fts.ts` (`--ab`): per recall@20 query, bare vs `expandQuery`-enriched recall@20. Without `--ab` = byte-identical baseline. `expandQuery` loaded via runtime require (keeps tsc clean across rootDir).
- **Result:** **B OFF 33.3% → ON 48.6% (+15.3pp)** ✅ payoff confirmed (B3 0→66.7, B1 0→25, B2 33.3→66.7). **A OFF 60% → ON 70% (+10pp), NOT flat & bidirectional** — A5 0→100 (concept) but A1 100→50 (precise citation displaced by dilution; exact-pin held). Dilution regressions: B4 −50 (bill crowded out), D1 −50, D3 −100 → **keep expansion scoped to concept queries (prod already does — Page-1 keywords, not citation lookups).**
- **B6 only +16.7pp** — expansion named plausible anchors (FSMA 2000, MiFID Directive, Investment Firms Reg/Dir) but not the exact key (FSMA 2023/MiFIR/MiFI Regs/FCA Handbook); only an onshoring SI matched. Probed: key sources ARE indexed in Lance (targeted "FCA COBS" query → 15/20 fca-handbook rows), but even a near-exact "FSMA 2023" query surfaces committee/HMRC/parliamentary chatter above the Act. **B6 is a RANKING problem, not coverage** → the flagship case for the vector layer / stronger legislation-tier ranking.
- **Caveat:** transient Gemini 503s left C1/C2/F2/F4/K2/J1 with no expansion (ON=OFF) — C's +6.7pp understates; **A and B measurements are clean** (every A/B query got a full expansion). Baseline headline shifted 69.4%→67.2% (n 30→31) solely because B6 (OFF 0%) joined the scored set; the 30 v1 per-query numbers are unchanged.
- **NEXT:** tune the legislation-tier ranking (B6/Finding-B class) and/or bring in the vector layer; the Stage 3 staging GATE still stands. K1/K2/J1 expected-sources still TODO. G–I 0–2 rubric still to be calibrated by example.

---

## CURRENT STATE — LEX REBUILD Sprint 2 (Diagnosis / Page 2, 1 Jul 2026)

**Preview only — NOT promoted.** Built `LEX_DESIGN_ADDENDUM_14-15.md §15` (design §7, §14). Full account:
CHANGE_LOG "LEX REBUILD — Sprint 2" (2026-07-01 15:26 UTC); as-built rules in `LEX_PLAYBOOK.md` §10.
`scrutinise-web` `tsc --noEmit` clean (only the two pre-existing `react-markdown` module-not-found errors —
installs on Vercel). Page 1→Diagnosis chain smoke-tested end-to-end on Neon on the deterministic no-Lex
fallback path (22 assertions pass; throwaway script deleted).

- **Task 1 — search gateway.** New `lib/lex/search-gateway.ts` = the ONE search seam. `runSearch({keywords,
  intent, ideaContext?, limit?})`; intents `BACKGROUND_BRIEFING`/`CAUSE_SEEDING`; capability flags
  (`expansion`/`webOrientation`/`vector`/`reranker`/`graph`) env-gated, **default OFF**. `fireSearchTrigger`
  routes through it — no behaviour change.
- **Tasks 2/3 — Diagnosis fields + causes loop.** `lib/lex/page2-config.ts` (challenge, whoAffectedImpactCost,
  causes, rootCause, legalLandscape, pivotalObstacle, summaryDiagnosis). New `DiagnosisCause` table + enum +
  additive Idea columns (`lexPage`, `challenge`, `whoAffectedImpactCost` Json, `legalLandscape` Json,
  `pivotalObstacle`), **applied to Neon** via `prisma/lex_rebuild_page2.sql` (`prisma db execute` + generate).
  Causes CRUD + `POST /api/ideas/[id]/causes`; Lex pre-seeds candidates via gateway `CAUSE_SEEDING`. The
  field machine + conductor + panels were **generalised from Page-1-only to multi-page**.
- **Task 4 — transition.** `Idea.lexPage` pointer; `POST /api/ideas/[id]/page` advance (guarded); Background
  panel CTA row (**Continue to Diagnosis** + **Ask Lex about this** + disabled Give-feedback placeholder).
- **Task 5/6 — conductor + panels.** `orchestrateAfterWrite` dispatches by field kind (propose / seed
  structured / seed causes / ask reference / generate summary), same save-before-advance rule. `FieldsPanel`
  renders the new kinds; `BackgroundPanel` CTA; `ChatPanel` `focusNonce`.
- **REMAINING GATE:** Charlie validates `/ideas/create` through Diagnosis on the preview, then promote.
  The Page-1-Box-1 carry-forward into `whoAffectedImpactCost` is thin today (only legacy `whoAffected` — see
  playbook §10); widen when a structured Page-1 impact/cost source exists.

---

## CURRENT STATE — SEARCH: Stage 3 smoke-test + v2 gold harness (1 Jul 2026)

**Sprint complete.** Two independent tasks (neither blocked on the archetype-B answer-key). Full account: CHANGE_LOG "SEARCH — Stage 3 smoke-test + v2 gold harness" (2026-07-01 13:57 UTC). `scripts/ingest` `tsc --noEmit` = only the 4 documented pre-existing errors.

- **Task 1 — Stage 3 VERIFIED.** Throwaway smoke test (written, run, deleted) drove `expandQuery` + the real BM25 `rankedSearch` against the live 16.5M `corpus_fts` index for the 3 lay queries. **Acceptance MET:** "Revoke MiFID II" → anchors FSMA 2000/2023, MiFID Directive, **retained MiFIR**, UK MiFID; expansion surfaced **6 new legislation rows** (2006 MiFID SIs + 2019/2021 onshoring SIs), top-leg score 44→378. "data protection" → DPA 2018/UK GDPR (leg@20 0→1). "seatbelt law" → RTA 1988 + Seat Belts Regs, surfaced RTA 1988 s.15 (0→5). Gemini threw transient **503s** → `expandQuery` degraded to EMPTY as designed (a harness retry rode over it). **Plumbing note:** `runFtsSearch` is dormant locally (`FTS_SEARCH_URL` unset → stub); it wraps the same `rankedSearch` the test used.
- **Task 2 — v2 GOLD encoded.** `gold-queries.ts` gained `ARCHETYPE_META` (stream/kind/metric per §A) + per-query `stream`/`kind`/`metric`/`scoreable`/`lessonTarget`/`todo`; new entries **B6, G1–G3, H1–H3, I1–I3, J1, K1–K2**. B6/K1/K2/J1 carry **TODO expected-sources** (`scoreable:false`) → present but excluded from the headline until the validated answer-key lands. `score-fts.ts` headline now aggregates over the **scoreable recall@20 set only (== v1)**, added the **0–2 lesson scaffold** (G–I = NOT CALIBRATED) + a pending-validation section. **Verified:** headline **69.4% / 68.0% excl-floor (n=25)** — byte-identical to the 27 Jun v1 baseline; 9 principle + 4 pending cleanly excluded. Regenerated `docs/FTS_S1b_SCORING.md` + `docs/fts_s1b_scores.json`.
- **NEXT (unchanged gates):** fill B6/K1/K2 expected-sources from the validated answer-key (then flip `scoreable:true`); calibrate the G–I 0–2 rubric by example once a principle-stream result exists (§C.3); the Stage 3 staging GATE below still stands (`LEX_QUERY_EXPANSION=true` in Vercel staging → re-score).
- **Local-dev note:** to run the harness I `npm install`-ed `scripts/ingest` (node_modules is gitignored; deps were absent since the 27 Jun run). Not part of the commit.

---

## CURRENT STATE — SEARCH Stage 3: LLM query expansion (30 Jun 2026)

**Sprint complete.** CHANGE_LOG "SEARCH — Stage 3" (2026-06-30 10:32 UTC). `scrutinise-web` `tsc --noEmit` clean (pre-existing `react-markdown` module-not-found only — not installed locally, installs on Vercel).

- **Built:** `lib/lex/query-expansion.ts` (new) — `expandQuery(keywords, ideaContext)` → `{ anchors, termsOfArt, rephrasings }`. Gemini 2.5 Flash structured JSON, temperature 0.2, 10s timeout, resilient (returns EMPTY on any failure).
- **Wired:** `lib/lex/field-machine.ts` `fireSearchTrigger` now fetches `ideaNarrative + youAndIdeaNarrative`, calls `expandQuery`, merges expanded terms via `Set`, passes enriched keyword set to `runFtsSearch`. Briefing prose (`buildInitialBackground`) still receives original keywords only — grounding guardrail enforced.
- **Flag:** `LEX_QUERY_EXPANSION=true` in Vercel env enables it (default off). `QUERY_EXPANSION_MODEL` overrides model (default `gemini-2.5-flash`).
- **Observability:** `[query-expansion] terms added` log per trigger — original/added/anchors/termsOfArt/rephrasings breakdown.
- **GATE:** Set `LEX_QUERY_EXPANSION=true` in Vercel env (staging first) → run gold-set queries → verify lay-concept archetypes (data protection, road safety, Revoke MiFID II) now surface anchor Acts. Citation queries (archetype A) should be unaffected.

---

## CURRENT STATE — V30 (UK DEPTH COMPLETION: financial corpus · own-domain reviews · inquiry evidence · pre-2016 Scottish OR, 24 Jun 2026)

**Sprint:** V30 (`SPRINT_V30_BRIEF.md`). Full account + per-source scorecards + category-completeness table: **`docs/SPRINT_V30_REPORT.md`**. CHANGE_LOG "V30". Governance: **`docs/SENSITIVE_EVIDENCE_POLICY.md`**. Build-only; `scripts/ingest` `tsc --noEmit` **clean (0 errors)**. Baseline at open: 16,785,723 sections / 5.84B words / Neon 14 GB (3.5 GB headroom to 17.5 GB — V30 adds <1 GB).

**Category-completeness (read the report's table for detail):**
- **§1.1 CMA/OIM/SAU — SEEDED + DRAINED ✓** (`cma-cases`, OGL v3.0 ✓; **22,890 sections live** / 8 transient PDF-fetch fails; seeded+drained 24 Jun 12:15–14:18 UTC by the interrupted session). Measure undershot (sample 4.1 PDFs/case → full 20,336 decision PDFs + 2,562 overviews).
- **§1.2 CAT — PROBED-V31** (route clean ~1,100 judgments; own copyright/private-study-only; not in Find Case Law → email Competition Service). `cat-restricted`.
- **§1.3 FCA enforcement — PROBED-V31** (FCA own copyright; email with BoE/PRA). `fca-restricted`.
- **§2 Own-domain reviews — BUILT, PDF-ROUTE-BLOCKED** (Cass/Children's-Social-Care/IMMDS = SPA shells, 0 archive-enumerable PDFs; adapter+registry+seeder ready for pinned PDFs; listed for Charlie).
- **§3 Inquiry evidence — BOUNDED TRANCHE SEEDED ✓, full seed AWAITING GO** (`inquiry-evidence` + §0; POH `--max-pages 5` = 90 rows → **90 sections** (89 `av=full`, real text 132–218,448 w; 1 `av=pdf-only` graceful marker), **§0 keep-path + extraction canary PASS**, 0 skipped/failed. POH §0 sample all-keep so no `sensitive-excluded` observed — exclude path stays unit-tested-only until IB/Grenfell). Charlie chose bounded-first → **full ~19,425-item POH seed is the live ask.** Then IB(kept-only)→Grenfell.
- **§4 Pre-2016 Scottish OR — SEEDED + DRAINING ✓** (`scottish-parliament-or` extended to 1999 via Wayback; 2,322 rows seeded; `arch:` branch canary PASS — producing ~83–130 sections/report; sparse captures → `archive-miss` markers).

**✅ CARRIED CATCH RESOLVED:** `scottish-parliament-or` now seeded BOTH 2016+ (V28, **5,130 rows**) and pre-2016 (V30, **2,322 rows**) = **7,452 rows, canary PASS (skipped=0, failed=0), DRAINING** (modern 5,130 still queued behind pre-2016 — full drain is hours; re-baseline at drain per step 7).

**POST-PUSH RUN ORDER:** (1) `seed-rate-limits.ts` (+`cma-cases`,`inquiry-evidence`); (2) confirm Ingest deploy SUCCESS (commit hash) before seeding new sourceTypes; (3) `v30-seed-cma-cases.ts --seed`; (4) `v28-seed-scottish-parliament-or.ts --seed` THEN `v30-seed-scottish-or-pre2016.ts --seed`; (5) `v30-seed-inquiry-evidence.ts --seed` (Post Office Horizon; `--max-pages` to tranche); (6) if own-domain PDFs pinned, `v30-seed-own-domain-reviews.ts --seed`; (7) at drain re-baseline + `v20-licence-backfill.ts`.

**▶ POST-PUSH STATUS (executed 24–25 Jun; the interrupted session got through 1–3, this session resumed 4–5):**
- **(1) rate-limits ✓** (`cma-cases` 300/5, `inquiry-evidence` 1000/2 live). **(2) Ingest deploy SUCCESS** confirmed (Railway 24 Jun 12:15 UTC; canary = worker produces sections not markSkipped → processors deployed).
- **(3) cma-cases ✓ SEEDED + DRAINED** — 22,890 sections (see §1.1).
- **(4) scottish-parliament-or ✓ SEEDED (7,452 rows) + DRAINING** — both branches canary PASS, skipped=0 failed=0 (see §4 / catch-resolved).
- **(5) inquiry-evidence ✓ BOUNDED TRANCHE (90 rows) SEEDED + DRAINED, canary PASS** — full POH seed awaiting Charlie go (see §3).
- **(6) own-domain reviews — SKIPPED** (no pinned PDFs; still gated on Charlie capturing Cass/CSC/IMMDS report PDFs).
- **(7) re-baseline + licence-backfill — PENDING at drain** (scottish modern 5,130 still draining; run `v30-corpus-status-table.ts` + re-baseline + `v20-licence-backfill.ts` once scottish drains).

**DECISIONS WAITING ON CHARLIE (V30):** **GO on the full ~19,425-item POH inquiry-evidence seed** (bounded tranche canary PASSED — drop `--max-pages` to run it all) · V31 emails — Competition Appeal Tribunal (Competition Service) · FCA enforcement (+BoE/PRA) · capture/pin own-domain review PDFs (Cass et al.) · IB(kept-only)→Grenfell evidence sequence after POH · plus the full carried V29/V26 list below. *(RESOLVED this session: scottish-parliament-or 2016+ seed — now run; cma-cases post-push seed — now drained.)*

---

## CURRENT STATE — SEARCH S1b: archetype-A fix (citation resolver + backfill), positions pilot stood down (23 Jun 2026)

**Search workstream.** v1's one serious hole — archetype A (citation lookup) at **0%** — is fixed. Full account: CHANGE_LOG "SEARCH S1b — archetype-A fix" (2026-06-23 11:24 UTC); diagnosis + deltas in `docs/FTS_ARCHETYPE_A_DIAG.md`. `scripts/ingest` `tsc --noEmit` clean (only the 4 documented pre-existing unrelated errors).

- **Diagnosis:** legislation section rows never carry the parent act's title ("Housing Act 1988") — it lives only in legacy `LegislationItem.title` (gid-keyed), never carried onto `corpus_sections`. So citation queries surface parliamentary chatter, not the section (A1/A5 absent from retrieval; A2/A3/A4 present but out-ranked).
- **Fix (applied):** (1) **query-time citation resolver** (`search/citation-resolver.ts` + `fts-core.ts`) — parse citation → resolve act→gid → fetch exact section by id → inject at #1; legislation-tier favour on the BM25 remainder; **no reindex**. Wired into `fts-query-service.ts` + `score-fts.ts`. (2) **body/title citation backfill** (`citation.ts` + `build-fts-index.ts` + `backfill-citations.ts`) — complementary BM25 retrieval gain, **lands on the gated Railway rebuild** (local 16GB can't reindex 16.5M).
- **Re-score (resolver, full 16.5M):** A **0%→60%** (MRR 0.800; exact section #1 for A1–A4), overall **57.8%→69.4%**, D 67%→77%, no regressions. A5 stays 0% (concept query, no citation — out of scope). v1 baseline preserved at `docs/FTS_S1b_SCORING_v1_baseline.md`.
- **Positions parked; pilot stood down:** dropped `corpus_fts_pilot` table + checkpoint + `build-fts-pilot.ts` + wiring. `corpus_fts` restored to pristine (exploratory in-place mutations rolled back via Lance version restore).
- **GATED ON CHARLIE:** (1) Railway full rebuild to land the body backfill in production (`build-fts-index.ts` bakes it); (2) delete the empty `fts-pilot` Railway shell (`serviceDelete fdd32248-1bd5-4264-8ab0-54de78545151`).

---

## CURRENT STATE — LEX REBUILD Sprint 1.3 (web app, 25 Jun 2026)

**Preview only — NOT promoted.** Full account: CHANGE_LOG "LEX REBUILD — Sprint 1.3" (2026-06-25 01:12 UTC); rules in `LEX_PLAYBOOK.md` §3a/§3b. `scrutinise-web` `tsc --noEmit` clean.
- **Task 1 save-before-advance.** Diagnosed: the state machine already keeps a box current until Saved/Skipped (`currentField` = first non-terminal); the regression was the **prompt** reading as advancing. Enforced: `/lex` builds the prompt with **`awaiting`** so while a box is `AWAITING_CONFIRMATION` Lex refines THAT box only + points to **Save** (no next-field ask/propose); fresh proposals tell the user to review & Save in the panel; tightened RULES. Added `[lex-diag]` logging across `/lex` + orchestrator + `fields` route (the brief's "log/inspect").
- **Task 2 tour.** New `components/lex/HowItWorksModal.tsx` — **persistent "How this works"** button in the create view → tour (3 panels, verbatim copy) → **Read the FAQs** (wired to `lib/faq-content.ts`, incl. Guiding-Policy/Strategic-Kernel). Intro "say the word" opens it via a conservative `HELP_INTENT` regex.
- **Task 3 name.** `preferredName ?? firstName` in intro + orchestrator prompt; **Neon data fix** — `cl@scrutinise.org` + `scalablefinance@gmail.com` `preferredName` `Charles`→`Charlie` (applied; the deliberate "Boss" account untouched).
- **REMAINING GATE:** Charlie validates `/ideas/create` on the preview, then promote. **Note:** the FTS "Finding B" search changes (`scripts/ingest/search/fts-core.ts`, `fts-query-service.ts`, `scrutinise-web/lib/lex/fts-search.ts`; CHANGE_LOG "Finding B", 2026-06-25 01:08 UTC) landed as their own commit `d55e118` (separate search workstream) and sit *below* the Sprint 1.3 commits — they were NOT bundled into them.

## CURRENT STATE — LEX REBUILD Sprint 1.2 (web app, 23 Jun 2026)

**Polish (23 Jun, preview only — NOT promoted):** (1) Background panel now renders the Initial Background **markdown** via `react-markdown@10` (no prior renderer; Tailwind v4 has no `prose` plugin → `Components` map); (2) returning-user intro reworded to drop the non-existent "guided tour button" (Sprint 1.3 restores a real one); (3) failed Lex turn now **logs cause per attempt** (kind/status/body, or raw bytes on schema-validation) and the client **retries once** before the fallback. `tsc` clean. CHANGE_LOG "LEX REBUILD — Sprint 1.2" (2026-06-23 17:42 UTC); recorded in `LEX_PLAYBOOK.md`. Below = Sprint 1.1 (still current architecture).

---

## CURRENT STATE — LEX REBUILD Sprint 1.1 (web app, 21 Jun 2026)

**Separate workstream from ingest.** Built `LEX_REBUILD_DESIGN v.1.md` §13 — the **orchestration fix** that wires Lex's conversation to the field machine (Sprint 1 built both but never connected them, so the flow stalled). Full account: CHANGE_LOG "LEX REBUILD — Sprint 1.1" (2026-06-21 01:58 UTC). `tsc --noEmit` clean; 13/13 orchestration assertions pass end-to-end on Neon (fallback path); live Gemini emits a box proposal.

- **Revised accept-surface model (§3.2/§5):** narrative boxes are now proposable from chat — Lex tidies a chat answer into a `proposal`, the **box** renders it ("proposed") and Save accepts. The box is the single accept surface for narratives; Title/Keywords keep the chat inline confirm.
- **New/changed:** `lib/lex/orchestrator.ts` (the conductor — runs after every write, makes Lex speak the next step, deterministic fallbacks so no stalls); `lex-client`/`proposal-schema`/`lex` route (narratives proposable); `fields` route returns `{state, messages}`; `state.ts` advances stage→DIAGNOSIS + unlocks Diagnosis; `FieldsPanel`/`CreateIdeaClient`/`page.tsx` (proposed-in-box, server messages, verbatim first-idea intro + separate question bubble, name→firstName). **No schema change** (Sprint-1 additive Neon schema already applied).
- **SHIPPED 21 Jun:** pushed to `Main`; `migrate-lex-fields.ts --apply` run on Neon (**42/56 ideas** migrated, idempotent); **`docs/LEX_PLAYBOOK.md`** added (as-built operational reference — read this + `LEX_REBUILD_DESIGN v.1.md` before any Lex work). **Remaining gate:** validate `/ideas/create` on the preview, then promote to production. Sprints 2–4 (Diagnosis loop, real FTS, Pages 3–4) later per §11.

---

## CURRENT STATE — V29 (UK COMPLETION WAVE, 20 Jun 2026)

**Sprint:** V29 (SPRINT_V29_BRIEF.md). Full account: CHANGE_LOG V29. Pure-additive, orthogonal to the V26 DROP. **§0: legacy `Legislation*` STILL PRESENT on Neon — DROP not fired; untouched.** `scripts/ingest` `tsc --noEmit` **clean (0 errors)**. **11 new corpora / 9 new sourceTypes — all seed POST-PUSH.**

**DONE this session (live data ops POST-PUSH):**
- **§1 ICO/Scottish-courts triage.** The V27-drain failures are transient throttling, NOT dead pages (14/14 ICO + 8/9 scottish-courts re-fetch 200; 1 genuine 404). Adapters hardened with a polite retry (`ico.ts`, `scottish-courts.ts`). Recovery = `v29-triage-fix.ts --apply` POST-PUSH (resets 3,226 ICO + 8 SC to pending; 1 SC 404 → unavailable marker). Dry-run verified.
- **§8 HMRC soft-law audit.** Coverage already ~98% (RCBs 120/120, SoP 182/184, ESC 31/35, VAT Notices 104/106) → only **8 missing leaves**; seed via `v29-hmrc-audit.ts --seed` POST-PUSH.

**BUILT + PILOTED — seed POST-PUSH:**
- **§2 Quango T3 tail** — `v29-seed-quango-t3.ts`; 968 orgs / 25,366 docs measured, 0 guard-paused; closes the org universe to 100% (`quangos-govuk`, OGL).
- **§3 Parliament remainder (4, all OPL3):** `erskine-may` (2,038 sections) · `early-day-motions` (60,737) · `petitions` (~66,075 open+archived) · `members-interests` (3,341, one section/interest). `v29-seed-parliament.ts`.
- **§4 CPS guidance** — `cps-guidance` (270 docs, OGL VERIFIED at /crown-copyright-and-disclaimer). `v29-seed-cps.ts`.
- **§5 Independent reviews** — `independent-reviews` (345 reviews / 675 PDFs, registry ∪ gov.uk discovery, PDF-verified; reuses inquiry-reports machinery). Casey pilot 72,663 words. `v29-seed-independent-reviews.ts`.
- **§6 Exempt orgs:** `ofgem` (12,899 publications, OGL VERIFIED /copyright) · `ofcom` (4,093 pages, `ofcom-open` VERIFIED /about-ofcom/website/terms-of-use). `v29-seed-exempt-orgs.ts` (Railway egress canary first).
- **§7 LGSCO** — `lgsco` (`lgsco-open`, OGL-equivalent VERIFIED /copyright); self-propagating list rows over 10 categories. `v29-seed-lgsco.ts` (egress canary). The clean ombudsman; re-baseline at drain.

**PROBED-V30 (licence/route gated, in OMBUDSMEN_PROBE.md + EXEMPT_ORGS_PROBE.md):** Housing Ombudsman (165,524 decisions — licence unverified, biggest prize) · PHSO (route re-resolve) · Pensions Ombudsman (conditional grant — email) · FOS (restrictive) · Ofwat/BoE (email).

**GATED-ON-CAPTURE:** **§9 POSTnotes** re-probed = FULLY CF-challenged server-side (not less gated than Library). Wired into the V28 §5 seam as a 3rd host (corpus `postnotes`, OPL3) + turn-key `processLibraryBriefings` processor added. post.parliament.uk / commonslibrary / lordslibrary / researchbriefings.files are DISTINCT CF hosts → each needs its OWN `cf_clearance` + research-briefing CPT slug (cf_clearance is host-bound; the brief's "one capture unblocks both" was optimistic).

**POST-PUSH run order:** (1) `seed-rate-limits.ts`; (2) confirm Ingest deploy SUCCESS; (3) `v29-triage-fix.ts --apply`; (4) seed (canary+egress each new host): quango-t3 → parliament(×4) → cps → independent-reviews → exempt-orgs(ofgem/ofcom) → lgsco → hmrc-audit(8 missing); (5) at drain re-baseline + `v29-corpus-status-table.ts` + `v20-licence-backfill.ts` (confirm `ofcom-open`/`lgsco-open` apply).

**DECISIONS WAITING ON CHARLIE:** per-host cf_clearance + CPT-slug captures for POSTnotes/Commons/Lords Library (§9) · Housing-Ombudsman/Pensions/FOS re-use emails (§7) · Ofwat/BoE re-use emails · V26 §6 DROP go (soak; still needs search-thread Lex-grounding repoint) · Railway Hobby downgrade 28 Jun · plus the carried V28 list below.

---

## CURRENT STATE — V28 (SEARCH-RELAY · VOTING · INQUIRIES · SCOTTISH OR · LIBRARY/REVIEWS, 19 Jun 2026)

**Sprint:** V28 (SPRINT_V28_BRIEF.md). Full account: CHANGE_LOG V28. Pure-additive + the search-thread relay during the V26 soak (legacy `Legislation*` rollback path untouched). `scripts/ingest` `tsc --noEmit` clean (only the 4 documented pre-existing unrelated errors — none new).

**DONE + LIVE this session (Neon data ops, no deploy needed):**
- **§1.2 jurisdiction column** on `corpus_sections` (NOT NULL DEFAULT 'uk', metadata-only add + ~399k devolved UPDATE; labels match search `jurisdictionFor()`: ni 204,292 · wales 191,756 · scotland 3,234 · uk 16.15M). Wired into the ingest write path too. **Search thread can switch off its stopgap map.**
- **§1.3 TIME-CRITICAL title/date extraction — COMPLETE + VERIFIED.** 335,595 sectionTitles carried from legacy `LegislationSection` (18.4% of leg+caselaw — the high-signal section/article heading rows; schedule/paragraph sub-units have no legacy equivalent) + 1,708,117 itemDates (gid-year for legislation, `[YYYY]` citation-year for tna-caselaw; `enactmentDate` was 0-populated so gid-year used). **The V26 §6 DROP's title-extraction precondition is now CLEAR.**
- **§2 ops `reseedExhaustedPwdata` FIXED** (index-friendly PK existence check, not a 6.4M-row pull). Verified: pwdata-debates dedup 15.2s (was >60s timeout); 18 backlogged TWFY files recovered automatically post-deploy. Sweep: that was the ONLY broken cron query (census aggregates measured fast, 1.3–3.2s). Goes live at push.

**BUILT + PILOTED — seed POST-PUSH:**
- **§3 division votes** — `division-votes` sourceType, corpora `commons-/lords-divisions-votes` (OPL3). One section per division w/ full member roll-call. Universe 5,603 (Commons 2,333 + Lords 3,270). Both houses piloted end-to-end.
- **§4 inquiry register completed** 21→58 inquiries / 146→197 report PDFs (all PDF-verified). Re-seed = `v24-seed-inquiry-reports.ts --seed` (idempotent +51).
- **§7 Scottish Parliament OR** — `scottish-parliament-or` sourceType. Sitemap enumeration = 5,131 reports (2016–). Per-contribution parser (base + iob pages) PILOTED (337 & 218 contributions). Licence VERIFIED = **SPCB** (`spcb`), not OGL. ~300–500k sections est.
- **§1.1 written-answers split** — `hansard` processor `answers` branch rewritten to one section per Q&A (was ~306k-word date-range blobs). Pilot: 1 window → 1,046 items, max 116 w/item. Re-seed = `v28-reseed-written-answers.ts --seed`. pwdata-wrans untouched.

**SCOPED / GATED:**
- **§5 library briefings — BUILT TO THE GATE.** Commons/Lords Library are WordPress behind a Cloudflare managed-challenge (content endpoints 403; `/wp-json/` root edge-cached only); LDA API dead; no `*-api` host; no web-archive. Capture-ready seam + probe seeder. **Needs Charlie: a `cf_clearance` cookie + the research-briefing WP REST endpoint** (devtools, same as V27 Scottish Courts).
- **§6 independent reviews — SCOPED** (`INDEPENDENT_REVIEWS_UNIVERSE.md`); Casey 2025 probed CLEAN (72,663 words). Build `independent-reviews` V29.
- **§8 exempt orgs — CORRECTION:** **Ofgem = OGL (clean), Ofcom = own-open (clean)** — V27 wrongly marked them own-copyright. Build V29 (own-domain enumerator); ranked Ofgem > Ofcom > Ofwat > BoE.

**POST-PUSH run order:** (1) `seed-rate-limits.ts`; (2) confirm Ingest deploy SUCCESS; (3) `v28-reseed-written-answers.ts --seed`; (4) `v24-seed-inquiry-reports.ts --seed`; (5) `v28-seed-division-votes.ts --seed`; (6) `v28-seed-scottish-parliament-or.ts --seed`; (7) at drain re-baseline + `v28-corpus-status-table.ts` + `v20-licence-backfill.ts`.

**DECISIONS WAITING ON CHARLIE:** library-briefings cf_clearance + CPT-slug capture (unblocks §5) · V26 §6 DROP go (soak ~25 Jun; §1.3 title-gate now CLEAR; still needs search-thread Lex-grounding repoint) · Railway Hobby downgrade 28 Jun · search-thread FTS-scope · V29 builds (independent-reviews, Ofgem/Ofcom exempt-orgs, Scottish OR pre-2016 archive, eur-lex/uk-treaties/inquiry chapter-splits) · (carried) FCL computational-analysis email · FCA Handbook · pwdata licence backfill · BAILII email · Scottish-courts/ICO/quango-T2 V27 seeds still POST-PUSH.

---

## CURRENT STATE — SEARCH S1b + DOCS CONSOLIDATION + RAILWAY LEGSECTION RETIRE (19 Jun 2026)

Three separate workstreams this session, each its own commit (kept OUT of the V27 ingest changes). `tsc --noEmit` on `scripts/ingest` clean (only 4 pre-existing errors in unrelated files: `diag-db`/`run-cleanup` missing `@prisma/adapter-pg`, `test-fca-playwright` missing `playwright`, `v26-pooled-smoke` rootDir — none new).

**1. FTS BUILD (Search S1b) — BUILT, INERT. Charlie triggers the index run.** Full-corpus BM25 on R2 via LanceDB native inverted index. New `scripts/ingest/search/`: `lance.ts` (R2 connect), `corpus-map.ts` (tier + jurisdiction, pure), `build-fts-index.ts` (indexer), `fts-core.ts` (BM25 + query-time title-boost), `fts-query-service.ts` (HTTP), `score-fts.ts` + `gold-queries.ts` (30 gold queries + citation matchers). `@lancedb/lancedb@^0.30.0` + `apache-arrow@^18.1.0` added to `scripts/ingest/package.json`. Reads `NEON_DATABASE_URL` (not `DATABASE_URL`). Brief additions all in: title-boost query-side ~2.5× untuned (no pseudo-titles); jurisdiction map (senedd→wales, ni*, scottish*/scotlawcom→scotland, else uk); **resumable+idempotent indexer** (mergeInsert on PK `id` = no dupes; R2 checkpoint `_search/corpus_fts.checkpoint.json` cursor = resume not restart; phase loading→indexing→done); citation-matcher scoring + eyeball top-20 dump; archetype-D `[GRAPH]` + A/C/D `[INFORCE]` reported as engine-floor, `[BILLS]` scores for real. As-built + run order in `docs/FTS_BUILD_S1b.md` §2A. Dataset `s3://{bucket}/_search/corpus_fts.lance` does NOT exist until the run. **Execution path confirmed (post-build): runs ON RAILWAY** (datacenter→R2 bandwidth; ~124 rows/s on a home connection ≈ 36h) on a **dedicated, isolated `fts-build` service** — NOT the Ingest worker (busy draining + bounced by Ops liveness on `pending>0`) and NOT local `tsx`. Ingest is git-connected to `Main` (RAILPACK, root `scripts/ingest`), so **commit-all.sh precedes the canary**. Driver `scripts/ingest/search/fts-railway-run.ts` (`setup`/`canary`/`full`/`logs`/`teardown`; needs only Neon+R2 creds — the indexer never calls Railway). **Run order:** `commit-all.sh` → `fts-railway-run.ts setup` → `…canary` (report → Charlie decides) → `…full` (resumable; re-run to resume from R2 checkpoint) → `score-fts.ts` (reads finished dataset; local OK) → `…teardown`.

**2. DOCS CONSOLIDATION — DONE.** `scrutinise-docs/*` moved into `docs/` (git mv where tracked; plain mv for the 2 untracked: `GOLD_QUERIES_2.md`→`docs/GOLD_QUERIES.md`, `SPRINT_V27_BRIEF.md`). `scrutinise-docs/` removed. All 144 `scrutinise-docs/` refs across 43 files rewritten → `docs/` (incl. BOTH boot files: root `CLAUDE.md` + `docs/CLAUDE.md`; handoff; briefs; INGEST_PLAYBOOK; CHANGE_LOG; the corpus-status-table + quango scripts that WRITE into the folder; `.ths`; `.ps1`). Gold deduped per Charlie: canonical `docs/GOLD_QUERIES.md` (was `GOLD_QUERIES_2.md`); `GOLD_QUERIES_1.md` stays in `docs/Archive/`. Zero stray `scrutinise-docs`/`GOLD_QUERIES_2` refs remain.

**3. RAILWAY LegislationSection RETIRE — reversible canary DONE; DROP still Charlie's.** All clean (report: `docs/RAILWAY_LEGSECTION_RETIRE_REPORT.md`): S1a EXPLAIN shows the panel on Neon's `LegislationSection_ftsVector_idx` GIN (no Seq Scan); no web runtime path reads Railway (`prisma`/`prismaSearch`→`DATABASE_URL`→Neon; `getRailwayPool` dead in-app, offline scripts only); exact parity (LegislationSection 914,274 / LegislationItem 135,531 on BOTH DBs → nothing lives only on Railway). Executed `railway-legsection-retire.ts --rename` (host-guarded, Railway-only): `LegislationSection` → `LegislationSection_DEPRECATED_2026-06-19`; Neon untouched. Reverse with `--rename-back` (one command). **Rollback-during-soak note:** this mutates the V26 rollback path — a full env-flip rollback would need `--rename-back` first (rest of app DB unaffected). Charlie drops it deliberately after one clean cycle (folds into V26 §6).

**COMMIT PLAN (commit-all.sh, 3 separate commits — NOT entangled with the uncommitted V27 ingest changes, which Charlie sequences separately):** (a) FTS build [now incl. `fts-railway-run.ts` + the corrected §2A run order]; (b) docs consolidation [now sweeps in these handoff/CHANGE_LOG/playbook updates]; (c) Railway-legsection retire. **commit-all.sh APPROVED + run (19 Jun)** — pushed to `Main`; Ingest+Ops auto-redeploy (harmless; FTS code inert). FTS index run still gated: Charlie triggers `setup`→`canary`→(report)→`full` separately.

---

## CURRENT STATE — V27 (BREAKER FIX · SCOTTISH COURTS · QUANGO T2 · EXEMPT-ORG PROBES, 19 Jun 2026)

**Sprint:** V27 (SPRINT_V27_BRIEF.md). Full account: CHANGE_LOG V27. Pure additive ingest during the V26 soak — writes only to `corpus_sections` on Neon (legacy `Legislation*` rollback path untouched; §6 DROP still gated). **Everything BUILT + LOCALLY PILOTED; nothing seeded yet — the new corpora seed POST-PUSH** (new sourceTypes are markSkipped by the live worker until their processors deploy). `tsc --noEmit` clean.

**DONE this session:**
- **§1 breaker-eval FIXED + verified.** Live Ops was throwing `Query read timeout` every 15-min tick since the 18 Jun 21:44 redeploy — `querySourceCounts`'s `corpus_sections GROUP BY` over 17.2M rows exceeds the 60s client timeout (diagnosed from the **Ops deploy logs**, not the misleading `source_status`/lock timestamps). That GROUP BY fed only the unread informational `section_count` column → moved it to read the hourly `corpus_snapshots` (PK-indexed) in a try/catch so the trip evaluation always completes. `v27-breaker-verify.ts`: deliberate failure-trip→clear+recover + zero-output-trip all PASS against the live DB. **Goes live at push.** Also reported (not fixed): `reseedExhaustedPwdata` hits the same timeout class (~8.8M-id pull) → pwdata auto-reseed failing → V28 dedup rework.
- **§2 Scottish Courts BUILT + piloted.** Captured API works server-side with Origin/Referer only (no token); `POST /web/search` (1-indexed, limit 200), `documentLink` → PDF at www.scotcourts.gov.uk. **13,066 judgments**, OGL v3.0 (judiciary.scot/crown-copyright, VERIFIED). Pilot 5/5, avg 6,185 w → **≈13,066 sections / ~80.8M words**. `sources/scottish-courts.ts` + `processScottishCourts` + `v27-seed-scottish-courts.ts` (seeder clears the blocked corpus_target).
- **§3 Quango T2 BUILT + measured.** 40 ALBs (ranks 21–60, broad set) + 24 ministerial depts (narrow `{statutory_guidance,regulation,manual,manual_section}`). Measured **18,320 + 1,788 = ≈20,108 docs**; 0 orgs >5× guard. `v27-seed-quango-t2.ts` (govuk-content, OGL, URL-dedup, utaac/fatality excluded).
- **§4 Exempt-org probes → `EXEMPT_ORGS_PROBE.md`.** Sized ICO/Ofgem/Ofwat/Ofcom/BoE. **ICO the only clear open licence (OGL v3.0)** → BUILT: 26,576 action-weve-taken leaves (mostly FOI decision-notices + PDFs), pilot 5/5 avg 3,090 w → **≈26,576 sections / ~82.1M words**. `sources/ico.ts` + `processIco` + `v27-seed-ico.ts`. Others = ranked V28 list, each gated on a licence check.
- **§5 Scottish Parliament OR — built to the gate.** Recon confirms no open API in static assets; capture-ready seam + `v27-seed-scottish-parliament.ts` dry-run; **waits on Charlie's XHR capture** (~320k est).

**POST-PUSH run order:** (1) `seed-rate-limits.ts`; (2) confirm Ingest deploy SUCCESS before seeding new sourceTypes; (3) `v27-seed-scottish-courts.ts --seed` (canary + Railway PDF-egress check); (4) `v27-seed-ico.ts --seed` (canary + egress); (5) `v27-seed-quango-t2.ts --seed`; (6) at drain `v27-corpus-status-table.ts` + re-baseline + `v20-licence-backfill.ts`.

**DECISIONS WAITING ON CHARLIE:** Scottish Parliament OR XHR capture (unblocks §5) · exempt-org licence verification for Ofgem/Ofwat/Ofcom/BoE (V28) · §6 DROP go (soak, ~25 Jun) · Railway Hobby downgrade 28 Jun · search-thread FTS-scope decision · (carried) FCL computational-analysis email · FCA Handbook licence · pwdata licence backfill · BAILII email.

---

## CURRENT STATE — V26 (UNIFICATION + RAILWAY DECOMMISSION — structural, 16 Jun 2026)

**Sprint:** V26 (SPRINT_V26_BRIEF.md), build input `UNIFICATION_PLAN.md` §4. Full account: CHANGE_LOG V26 + UNIFICATION_PLAN "AS-BUILT (V26)". Operational steps: **`V26_CUTOVER_RUNBOOK.md`**. Site access is closed, so the cutover needs no user write-freeze. Everything below the V25 heading is historical.

**DONE this sprint (ran unattended; two human gates remain):**
- **§1 precondition:** V25 drained corpora rebaselined ✓ (committees-reports 24,876 · committees-evidence 140,567 · niassembly-hansard 196,348 · inquiry-reports 140 · college 332). bills-api + senedd-cofnod were still draining → proceeded per brief §1 (independent data); **both since drained + rebaselined ✓ (bills-api 6,535 · senedd-cofnod 191,730).**
- **Migration A (corpus unification) — DONE + DRAINED + REBASELINED ✓, reversible.** 38,571 non-matching legacy gids → **24,247 genuine gaps** + 14,324 docId-form diffs already covered (ukpga calendar↔regnal 8,514 · uksi regional 4,041 · eur→eudr/eudn/CELEX 1,769). Gaps verified real (99.6% hold legacy text; 25/25 live-TNA fetchable). **Gap-fill (24,246 tna-legislation rows) fully drained → rebaselined ✓:** si-pre-2010 174,552→**419,250** · primary-acts-2000plus 90,838→**145,704** · retained-eu→187,555 · si-2010plus 270,339 · regional→331,124. Licence backfill swept (85 stragglers; new sections got OGL at ingest). **Compilation layer preserved** in `legislation_compilation_enrichment` (26,126 rows, pointer-only; amendment tables were empty).
- **Migration B (app DB Railway→Neon) — PREP DONE.** All app tables already existed on Neon → B.1 = parity verify (clean) + `_prisma_migrations` baseline. **App data copied** (24 tables / 62,394 rows, exact parity; OperationalSection 61,315 the only bulk; FK-topological order — Neon forbids session_replication_role). **Search repointed in code** onto Neon's intact legacy `ftsVector` (both tables 100% populated + GIN-indexed); dual client collapsed (`prismaSearch`→alias of `prisma`); `/legislation-search` moved onto the GIN index (EXPLAIN-confirmed); `directUrl` added. `tsc --noEmit` clean.
- **§4 Railway** holds only `scrutinise-db` + `Ingest` + `Ops` (confirmed via API).

**CUTOVER — DONE + VERIFIED (18 Jun):** Charlie moved the Vercel env to Neon (`DATABASE_URL`→pooled `&pgbouncer=true&connection_limit=1`, `DIRECT_URL`→non-pooled). Verified live (`v26-cutover-verify.ts`): prod `GET /api/legislation/search` → HTTP 200 / 20 items from Neon; **Railway scrutinise-db now shows 0 app connections** (web app fully detached); Neon serves via the pgbouncer pooler. Login (Clerk auth) is Charlie's own final eyeball — DB-independent, and `prisma.user.count()` on Neon pooled already verified. Rollback (if ever needed pre-DROP) = flip env back + redeploy; Railway DB left intact through the soak.

**STILL GATED:**
1. **§6 soak ≥1 week → DROP legacy `Legislation*` (both DBs) + decommission Railway Postgres** — the one irreversible step; separate Charlie go. **Soak clock started 18 Jun → earliest DROP ~25 Jun.** Gated ALSO on the search thread delivering the new `corpus_sections` FTS + the Lex-grounding repoint onto it (so the legacy `ftsVector` can be retired first). Checklist in `V26_CUTOVER_RUNBOOK.md` §6.

**TOTAL at V26 post-drain close:** 16,302,498 compiled / 16,521,390 total sections · **5.06B words** · ~28.75 GB R2 (est) · 7.00 GB Neon heap (was V24 15.58M / 4.83B). Per-corpus table → `CORPUS_STATUS_V26.csv`.

**IN FLIGHT / NEXT SESSION:**
1. ✅ Gap-fill drained + rebaselined ✓ + licence-backfilled + workbook table emitted (17 Jun); ✅ cutover executed + verified live (18 Jun).
2. **Soak watch (→ ~25 Jun):** keep an eye on prod for any DB-move regressions; Railway DB stays intact + running as the rollback path until the DROP.
3. **§6 DROP (after soak):** needs the search thread's new `corpus_sections` FTS + Lex-grounding repoint first (retire legacy `ftsVector`), then verified Neon backup → drop legacy `Legislation*` (both DBs) + decommission Railway Postgres. Charlie's separate go.
4. Scottish XHR capture still outstanding (ingest, not migration).

**DECISIONS WAITING ON CHARLIE:** B.5 cutover go · §6 DROP go · Scottish SpOpenData XHR · Railway Hobby downgrade 28 Jun · (carried) College fresher route · FCL computational-analysis email · FCA Handbook licence · pwdata licence backfill · BAILII email · V26 search-thread FTS-scope decision.

---

## CURRENT STATE — V25 (FEED THE MACHINE: Senedd · College · Bills · inquiry expansion · licence compliance, 16 Jun 2026)

**Sprint:** V25 (SPRINT_V25_FEED_BRIEF.md). Full account: CHANGE_LOG V25. Pure additive ingest — zero structural-DB risk (structural unification is now V26, gated on the FTS decision + production gates). Queue ran dry ~14 Jun (0 pending at open). Everything below the V24 heading is historical.

**BUILT + LOCALLY PILOTED this session (predict-measure-commit); NEW sourceTypes seed POST-PUSH:**
- **§2 Senedd Cofnod ✓ built+piloted+licence-VERIFIED.** `record.senedd.wales/Plenary/{id}` (custom .NET, no CF), enumerated by redirect-classified meeting-id scan; one section per English speaker-turn (bilingual — prefer `translation`). Licence OGL v3.0 (Charlie verified the Senedd copyright page; supersedes the V24 "g**oogl**e" false positive). PILOT: 254–259 sections/plenary, ~847 plenaries → **PREDICTION ≈217k sections / ~30M words**. `sources/senedd-cofnod.ts` + `processSeneddCofnod` + `v25-seed-senedd-cofnod.ts`.
- **§3 College of Policing ✓ built+piloted.** UK Gov Web Archive 2022 snapshots (live site CF-blocked, fresh snapshots are JS shells). CDX enumerates `app-content*`, content via the `id_` raw-capture route. **332 distinct APP pages** (the ~8k placeholder was a rough overestimate), avg ~2,431 words/page → **PREDICTION ≈332 sections / ~0.81M words**. Licence `college-nc` → **commercial-surface excluded**. `sources/college-policing-archive.ts` + `processCollegePolicing`.
- **§4 Bills API ✓ built+piloted.** `bills-api.parliament.uk` (3,914 bills). Two-stage `list:{billId}` → per-PDF rows (bill 3774 alone = 267 PDFs); **files[] Download route only** (links[] are unreliable). Licence OPL v3.0. PILOT: avg 3.3 files-PDFs/bill, 100% extract → **PREDICTION ≈13k sections / ~9.4M words** (the ~5k placeholder undershoots — amendment papers dominate). `sources/bills-parliament.ts` + `processBills`.
- **§5 Public inquiries — register 8 → 21 inquiries / 53 → 146 report PDFs.** 13 verified concluded inquiries added to `INQUIRY_REGISTRY` (Saville 11, Al-Sweady 50, Grenfell P2 12, Mid Staffs, IICSA, Litvinenko, Baha Mousa, Zahid Mubarek, Hillsborough, Victoria Climbié, Azelle Rodney, Rosemary Nelson, Equitable Life). Re-run `v24-seed-inquiry-reports.ts --seed` POST-PUSH (idempotent, +93 rows).
- **§6 Scottish — built to the gate, SEEDS NOTHING.** HTML route live; SpOpenData API key still not captured (none in session prompt). `sources/scottish-parliament.ts` + `v25-seed-scottish.ts` report the blocker. Did NOT guess the key.
- **§7 LICENCE_COMPLIANCE.md created** — Find Case Law serving-layer hard requirements (auth-only judgment text, noindex/robots, no open/3rd-party API over judgment text or extracts, no open-web publication of derived extracts) + the NC commercial-exclusion set + fca-restricted. Recorded, not enforced (ingest only).
- **§1 carry-over:** divergence fix (§1.1) + CSV TOTAL-row drop (§1.3) were already in HEAD `96d150f`; §1.2 rebaseline is POST-PUSH (`v25-rebaseline.ts --classify-failed --confirm`).

**POST-PUSH — DONE this session (deploy confirmed; Ops auto-started the worker):**
- rate-limits upserted (4 new sourceTypes).
- **inquiry-reports ✓ drained:** 146 rows → 140 compiled / 14.56M words (6 markers).
- **college-of-policing ✓ via LOCAL ingest:** the worker hit a Railway-egress BLOCK on `webarchive.nationalarchives.gov.uk` (257/332 "archive fetch failed"; 200 from a residential IP). `v25-ingest-college-local.ts` ingested all **332 / 840,308 words** locally. Future re-seeds use the local path. **NEW Railway-blocked host recorded.**
- **senedd-cofnod ✓ seeded + processing on the worker:** enumeration bug fixed (conc-6 throttling → false gaps + a Neon DNS blip; first run found only 396). Re-run at conc 3 with retries + insert-retry found **713 plenaries**, all seeded. record.senedd.wales IS Railway-reachable (no CF) — worker grinding (27 meetings → 6,849 sections at check, ~254/meeting, 0 fails).
- **bills-api seeded + grinding:** 3,919 `list:{billId}` rows; per-PDF child rows + sections appear as the worker reaches modern (high-billId) file-rich bills (early low-billId bills are legacy links[]-only → 0 files).
- **scottish:** gated, seeds nothing.

**IN FLIGHT / NEXT SESSION:**
1. bills-api + senedd-cofnod finish draining → `v25-rebaseline.ts --classify-failed --confirm` (the §1.2 four + new corpora; senedd ~713 plenaries × ~254 ≈ ~180k, bills TBD, college 332); re-run `v20-licence-backfill.ts`; regenerate `v25-corpus-status-table.ts`.
2. Scottish (parliament + courts) waits on Charlie's SpOpenData XHR capture; College follow-up = a rendered/API content route fresher than 2022; inquiry dark-site report-PDF Web Archive adapter (Manchester Arena/Undercover/Shipman own domains).
3. V26 = structural unification + Railway decommission (gated on the FTS-scope decision + the two production gates).

**DECISIONS WAITING ON CHARLIE:** Scottish-parliament + Scottish-courts SpOpenData devtools XHR (same technique unblocks both) · College of Policing fresher content route · FCL computational-analysis email · FCA Handbook licence · pwdata licence backfill · BAILII email · written-answers month-blob deletion · V26 FTS-scope decision.

---

## CURRENT STATE — V24 (REBASELINE + BREAKER FIX + EMAIL HONESTY + NI ASSEMBLY + INQUIRIES + UNIFICATION SPEC, 14–15 Jun 2026)

**Sprint:** V24 (SPRINT_V24_BRIEF.md). Full account: CHANGE_LOG V24. Everything below the V23 heading is historical.

**TOTAL at close:** 15,577,221 compiled sections / **4.82B words** (15,770,435 incl. classified residue; V23: 12.56M / 4.05B). Per-corpus table → `CORPUS_STATUS_V24.csv` (R2 ~27.4 GB est, Neon heap 6.76 GB). **The email no longer shows a % (Charlie-directed §3)** — two hard numbers + a completion count + a labelled projection.

**DONE this sprint:**
- **§1 — 7 corpora ✓ re-baselined** (`v24-rebaseline.ts --confirm`): retained-eu 186,371 · si-2010plus 270,339 · explanatory-notes 410 · explanatory-memoranda 5,420 · historic-hansard 4,641,085 · ni-judgments 7,772 · quangos-govuk 86,547. Transient failures reset+drained; 2 deterministic historic-hansard gapday misses classified `skipped`. **committees-reports (47.6k pending) + committees-evidence (~4.9k pending + 83 failed) still draining → ✓ next session.**
- **§2 — zero-output breaker FIXED at the worker.** New `ingest_queue.produced_output` (per-row verdict via `AsyncLocalStorage` in `process-row.ts`; counts compiled writes, r2Exists confirmations, and markers — so idempotent reseeds no longer read as empty). `ops.evaluateBreakers` trips on the trailing all-empty run (24h window, threshold 25), not cross-sweep deltas. Verified against tna-legislation + committees reseeds (no false trip) and the curl-broken case (still trips) — `v24-verify-breaker.ts`, production untouched. Column migrated live (`v24-migrate-produced-output.ts`).
- **§3 — email >100% headline retired** (`progress-reporter.ts`): subject + TOTAL block now exact sections + words + completion counts + labelled projection.
- **§4.1 NI Assembly Hansard — BUILT + piloted + SEEDED + verified live.** Licence VERIFIED OGL v3.0; IIS host (no CF, Railway-safe). Pilot: 646 reports, ~482 sections/report → **PREDICTION ≈311,157 sections / ≈48.4M words**; canary CONFIRMED post-deploy (3 reports → 1,445 sections / 224,732 words). `sources/niassembly-hansard.ts` + `processNiAssemblyHansard` + seeder; all 646 rows seeded post-deploy, grinding. (A premature mid-sprint seed had the OLD worker markSkipped 95 rows in ~2 min → deleted all 646, re-seeded only after the new deployment was confirmed SUCCESS; lesson logged in playbook.)
- **§4b College of Policing:** licence RESOLVED = **Non-Commercial College Licence** (`college-nc`, verified via 2026-02-03 web-archive snapshot). Content route BLOCKED — fresh archive snapshots are Drupal JS-SPA shells; only 2022 snapshots have static text (~4yr stale). **No seed; recommend Playwright/JSON-API or a direct permission email.**
- **§4.2 Senedd/Scottish:** neither meets the seed condition — Senedd route confirmed but **licence unverified** (the "ogl" footer match was "g**oogl**e"); Scottish API still needs Charlie's XHR. No seed.
- **§5 Public inquiries — `inquiry-reports` sourceType BUILT + SEEDED + verified live.** Per-PDF rows (timeout-safe). **8 concluded inquiries → 53 report-volume PDFs seeded → 51 compiled sections / 6.55M words** (2 markers; Iraq/Chilcot vols huge), OGL v3.0 via gov.uk attachments. Grenfell/dark-site adapter = follow-up.
- **§6 `UNIFICATION_PLAN.md` DELIVERED** (spec only): legacy LegislationSection inventory, 71.5% measured overlap with corpus_sections, conversion (A) + app-DB Railway→Neon (B), <15 min downtime, minutes rollback.

**POST-PUSH — DONE this session** (commit `fe4d15f`+`623d386` pushed; Railway Ingest deployment `623d386` confirmed SUCCESS via the deployments API before seeding, so no skip-race):
1. ✅ `seed-rate-limits.ts` — niassembly-hansard 1000ms/2, inquiry-reports 500ms/3 added (30 entries).
2. ✅ `v24-seed-niassembly-hansard.ts --canary 3` then `--seed` — **canary verified live: 3 reports → 1,445 compiled sections / 224,732 words** (≈482/report, matches the pilot exactly; Railway egress on the IIS host confirmed). Full 646 rows seeded — grinding toward ~311k.
3. ✅ `v24-seed-inquiry-reports.ts --seed` — 53 report PDFs seeded → **51 compiled sections / 6.55M words** (2 markers; Iraq/Chilcot volumes are huge), inquiry-reports corpus_target upserted est=53.
4. ✅ Verified: 0 tripped breakers; the new per-row breaker is live and recording `produced_output` verdicts. Re-baseline niassembly/inquiry when drained (next session).

**IN FLIGHT / NEXT SESSION:**
1. committees-reports + committees-evidence drain → ✓ (clear the 83 committees-api AggregateError failures first); then re-run `v24-rebaseline.ts --confirm`.
2. Post-push NI Assembly + inquiry seeds drain → ✓ re-baseline (niassembly-hansard est currently the V23 placeholder 270k; pilot says ~311k).
3. Devolved follow-ups: Senedd licence verification (Welsh Parliament licence page, not the homepage footer) → build; Scottish needs Charlie's SpOpenData XHR; College needs a rendered/API content route.
4. Re-run `v20-licence-backfill.ts` after drains (NULL stragglers; new corpora niassembly/inquiry licences applied at ingest via the map).

**DECISIONS WAITING ON CHARLIE:** Scottish-courts + Scottish-parliament SpOpenData devtools XHR (same technique unblocks both) · Senedd licence (verify the Welsh Parliament licence page) · College of Policing content route (Playwright/API or direct permission email) · FCL computational-analysis email · FCA Handbook · pwdata licence backfill · BAILII email · written-answers month-blob deletion.

---

## CURRENT STATE — V23 (V22 CLOSEOUT + ORAL EVIDENCE + QUANGO T1 SEED + DEVOLVED/INQUIRY SCOPING, 13 Jun 2026)

**Sprint:** V23 (SPRINT_V23_BRIEF.md). Full account: CHANGE_LOG V23. Everything below the V22 heading is historical. Session note: switched models mid-sprint (Fable 5 → Opus 4.8) with full transcript continuity — no state lost.

**TOTAL at close:** 12,558,897 compiled sections / **4.05B words** (V22 ~9.87M / 3.46B). Denominator 14.79M, 29/53 ✓ → headline ~84.9% (honest-lower from new placeholders).

**DONE this sprint:**
- **S5L Lords listing walk was CF-blocked → switched to ENUMERATION.** The WebForms listing path IP-penalty-boxes for minutes after any burst (undici + curl both 403 on page 1, box outlives 4-min cooloff). The zip path is CF-free (V21-proven), docIds deterministic, no `_a/_b`/`P1` splits in range → `v22-seed-lords-hansard.ts` enumerates P0 vols 1-606; worker PK-checks soft-404 gaps to markers. **Canary PASSED** (S5LV0100P0 → 2,408 sections, 1936 date proves the deployed Lords-1999 cutoff). 578 rows seeded, **tranche grinding** (754 done, S5L 110,441 sections, at 1981 → 1999). Resumable curl walk built + kept for future series.
- **Gap-fill seeded:** 113 gapvol rows (S3 40 · S4 57 · S5C 16). 1 S5L HTML gap volume absorbed as a marker (noted).
- **⚠️ tna-legislation breaker FALSE-POSITIVE cleared:** tripped on 838 idempotent re-runs (already-held sections → 0 COUNT growth ≠ 0 output), parked 108,349 rows; root cause verified, cleared per §8, unparked, did not re-trip. **Recommend breaker fix** (track empty done-rows at the worker, not aggregate count growth).
- **✓ re-baselines:** echr-hudoc 4,410 · tax-tribunals 12,089 · nao-reports 2,570 · lawcom 262 · primary-acts-pre-2000 165,438 (ukpga cleanup ran). uksi enum (7) reset + drained.
- **Oral evidence COVERED (§2):** OralEvidence is a distinct committees-api type, already ingested — 14,820 `oralevidence:*` sections (committees-evidence, opl-3.0), R2-verified clean transcripts. Not a gap.
- **Quango T1 SEEDED (§3):** 41,321 `quangos-govuk` rows (42,942 measured − URL-dedup), grinding (76,461 sections at close).
- **Devolved (§4) PROBED+SIZED, build V24:** NI Assembly AIMS API build-ready (646 reports 2012-2026, ~250-300k, cleanest); Senedd record.senedd.wales (~150-250k); Scottish parliament.scot HTML + hidden SpOpenData API (~250-400k, hardest). Placeholders + licence-map entries added.
- **Inquiries (§5):** `INQUIRIES_UNIVERSE.md` register built (~35 inquiries, ~40-70k reports-only). Infected Blood probe = 9 PDF report vols on gov.uk (CF-free OGL, route verified, NOT seeded — needs `inquiry-reports` sourceType, V24).
- **Small probes (§6) SIZED:** ONS 11,177 gov.uk docs (marginal); OBR 61 (trivial/foldable); pre-2010 committees ~10-20k (CF-blocked, depth gap named).

**IN FLIGHT / NEXT SESSION:**
1. Drains → ✓ re-baseline (`v23-rebaseline.ts --confirm`, guarded): retained-eu, si-2010plus, regional, EN/EM (now unblocked, draining), committees-reports/evidence, ni-judgments, **historic-hansard (re-baseline only when 1803-1918 + Lords tranche + gap-fill ALL drain — single corpus)**.
2. EN/EM (11,424) were never processed (blocked behind retained-eu since V20) — verify they produce content now that they're unparked.
3. Re-run `v20-licence-backfill.ts` after drains (NULL stragglers).
4. **V24 candidates:** NI Assembly Hansard build (turn-key); inquiry-reports sourceType (Infected Blood first); Senedd/Scottish builds; quango T2/T3.
5. **Breaker fix:** zero-output breaker false-trips on idempotent reseeds — track genuinely-empty done rows at the worker.

**DECISIONS WAITING ON CHARLIE:** devolved licences (3, expected OGL — verify) · FCL computational-analysis email · FCA Handbook · pwdata licence backfill · Scottish-courts + Scottish-parliament SpOpenData devtools XHR (same technique unblocks both) · written-answers month-blob deletion · BAILII email.

---

## PREVIOUS STATE — V22 (REPAIRS + SECOND HANSARD CENTURY + WORD COUNTS + QUANGO DRY-RUN, 13 Jun 2026)

**Sprint:** V22 (SPRINT_V22_BRIEF.md). Full account: CHANGE_LOG V22. Everything below the V21 heading is historical.

**DONE this sprint:**
- **committees-api repaired:** deep-offset server 500s (~31s timeout, load-dependent) killed the WrittenEvidence walk — replaced with date-windowed `list:…:win:{YYYY-MM}` rows. Breaker cleared, **56,518 item rows unparked + draining**, 1,239 offset list rows retired. Windows seeded post-push (`v22-seed-writtenevidence-windows.ts`).
- **judiciaryni repaired:** transient IP-cut + the AdaptiveThrottle suspend path was DEAD CODE everywhere (ceiling 30s < threshold 60s — fixed, plus 403/socket backoff) — rate halved 2000ms/1; listing got the list-row treatment (`list:page:{N}`, pages 96–396). Breaker cleared + 332 failed reset POST-PUSH (`v22-seed-judiciaryni-list.ts` then the SQL).
- **Enum repairs found real universe:** si-2010plus enum seeded **11,852 missing instruments** (the V12 never-run reseed); regional enum seeded 6,435 (incl. asc/mwa). 7 dense uksi years re-throttled — reset at close, verify drained next session.
- **HUDOC revived:** working grammar (`contentsitename:ECHR AND respondent:"GBR" AND languageisocode:"ENG"` = ✓4,471, browser UA + Referer, kpdate sort), PDF-conversion text route, one-judgment probe PASSED end-to-end (19,283 words, licence `echr-nc` VERIFIED live). Seed post-push: `v22-seed-echr-queue.ts --canary 5` (Railway egress unverified!) → full.
- **Lords Hansard 1919–1999:** per-house cutoffs — Lords cuts at **1999-11-17** (first pwdata-lords file; S5L vol 607 starts that exact day). S5L cap 32 → 606. Pilot scored: 1936 vol 2,408 items/462k words; 1999 vol 7,076/806k, 0 ≥ cutoff. R2 batch 16 (timeout headroom for fat volumes). Seed post-push: `v22-seed-lords-hansard.ts` (~574 vols ≈ +2.3M sections est).
- **Hansard gap-fill:** V21's "169 exist on the HTML site" was WRONG — measured **114 fillable of 170 missing** (56 genuinely lost; S1/S2 wholly unfillable). Two-stage crawl built (`gapvol:`/`gapday:` rows, sourceType `historic-hansard-html` 500ms/2). Seed post-push AFTER the Lords seeder: `v22-seed-hansard-gapfill.ts`.
- **Word counts:** already exact at ingest for every compiled section (the brief's backfill was unnecessary — NULLs are only unavailable markers). **Total 3.456B words.** Email TOTAL block now prints the words line.
- **Quango T1:** tiers unconfirmed → seeder built (`v22-seed-quango-t1.ts`, --seed gated), live dry-run done: **T1 = 42,942 docs**. ⚠️ HMCTS (515) and UTAAC (0) are gutted by the utaac_decision/fatality_notice exclusions — Charlie to confirm slot replacement.

**POST-PUSH RUN ORDER (this session if push lands, else next):**
1. `seed-rate-limits.ts` (judiciaryni 2000/1, historic-hansard-html new).
2. NI: clear breaker + reset 332 failed (playbook §8 SQL) → `v22-seed-judiciaryni-list.ts`.
3. `v22-seed-echr-queue.ts --canary 5` → verify sections + Railway egress → full seed (unblocks echr-hudoc, est 4,471).
4. `v22-seed-lords-hansard.ts` (S5L re-list + seed) → THEN `v22-seed-hansard-gapfill.ts` (asserts the lifted-cap checkpoint).
5. `v22-seed-writtenevidence-windows.ts` (~163 window rows).
6. Reset the 7 throttled uksi enum rows after cooloff.

**IN FLIGHT / NEXT SESSION:**
1. Drains → ✓ re-baseline per §1c: retained-eu (~74k), historic-hansard (1803–1918 tail + Lords tranche + gap-fill — single corpus, re-baseline when ALL drain), committees-reports/evidence (56k + windows), si-2010plus (11,852 + 7 enum years), regional (6,435), EN/EMs, tax-tribunals, nao, ni-judgments, echr-hudoc.
2. ukpga enum drained → run `v19-cleanup-ukpga-calendar.ts` → primary-acts-pre-2000 ✓.
3. si-2010plus enum drain → re-run `seed-explanatory-queue.ts` (idempotent; new SIs need EM rows).
4. Re-run `v20-licence-backfill.ts` after drains (NULL stragglers).
5. Quango T1 seed once Charlie confirms tiers (`v22-seed-quango-t1.ts --seed`).
6. Corpus unification + Railway-DB migration: structural-sprint readiness — no blocker found this sprint; the queue patterns (list:/enum:/win:/gap*) are stable and documented.

**DECISIONS WAITING ON CHARLIE:** quango tier confirmation (incl. HMCTS/UTAAC slot question) · FCL computational-analysis licence email · FCA Handbook licence · pwdata licence backfill · Scottish-courts devtools XHR · written-answers month-blob deletion.

---

## PREVIOUS STATE — V21 (QUANGOS MEASURED + HISTORIC HANSARD + HONEST DENOMINATOR, 12 Jun 2026 evening)

**Sprint:** V21 (SPRINT_V21_BRIEF.md). Full account: CHANGE_LOG V21. Everything below the V20 heading is historical.

**DONE this sprint:**
- **Quango universe MEASURED:** `docs/QUANGO_UNIVERSE.md` + `.csv` — 1,255 orgs, 904,989 total docs, **162,004 relevant-format docs** (AAIB 11,732 · HMRC 8,487 · EA 7,639 top the table). `quangos-govuk` placeholder in corpus_targets. **No content seeded — Charlie triages the table for V22.**
- **Historic Hansard 1803–1918 BUILT + PROBED:** `sources/historic-hansard.ts` (bulk volume zips, hansard_v12 parser, per-speech pwdata-shaped items, exact 1919-02-04 cutoff = pwdata handoff), `processHistoricHansard`, `seed-historic-hansard-queue.ts` (--canary). Pilot S1V0001P0: 1,597 sections end-to-end in Neon+R2, OPL verified, 49s/volume. Universe ~763 volumes ≈ ~1.1M sections. Host soft-404s (listing = universe; PK magic checked). Rate 5000ms/2.
- **Honest denominator (playbook §1d):** blocked targets now count, retired never (the retired LDA rows were double-counting 722k). Placeholders: scottish-courts ~20k, college-of-policing ~8k, echr-hudoc 4,471 (V20 measured, was 30,050), bills-api ~5k, financial-corpus NULL/unsized. **Headline 91.3% → 88.0% (denominator 12.61M).**
- **SSRN re-classified:** api.ssrn.com serves 200 JSON unauthenticated now (V20 hard-403 was transient WAF state) — **stays PARKED on licence grounds** (author copyright).

**POST-PUSH (done this session):** canary PASSED from Railway (CF serves Railway IPs on hansard-archive); **universe MEASURED 595 zips / 594 distinct vols** (not the nominal 763 — real digitisation gaps; HTML-crawl gap-fill of the 169 missing vols is a V22+ candidate); est re-baselined **~850k**; **full seed done, grinding** (4 done / 589 pending at close, ~10–20h). One incident: CF 403 on the S5C listing walk at page 24 → seeder fixed (60s-cooling retries + stop-at-volume-cap, committed post-push).

**IN FLIGHT / NEXT SESSION (V20 carry-overs unchanged):**
1. retained-eu ✓ at drain; committees WrittenEvidence `list:` rows draining; NI seeder resume from checkpoint (page 66 hard-cut); si-2010plus ✓ at enum drain → re-run `seed-explanatory-queue.ts`.
2. ukpga regnal enum drain → `v19-cleanup-ukpga-calendar.ts` → primary-acts-pre-2000 ✓; regional enum drain → ✓.
3. New V20 corpora ✓ at drain; re-run `v20-licence-backfill.ts` after drains.
4. **historic-hansard ✓ re-baseline at drain** (~10–20h grind from full seed).
5. V22 candidates: quango triage (Charlie) · HUDOC revival (routes in V20 §3.6, measured universe 4,471) · **Lords Hansard 1919–1999** (bulk archive holds it; new named hole) · regional-act EN/EMs.

**DECISIONS WAITING ON CHARLIE:** unchanged from V20 (FCL computational-analysis licence email; FCA Handbook licence; pwdata licence backfill; Scottish courts devtools XHR; written-answers month-blob deletion) **plus:** quango triage of QUANGO_UNIVERSE.md.

---

---

## SEARCH PROJECT — S0 AUDIT COMPLETE (12 Jun 2026)

Read-only audit done; all measured numbers + extrapolation arithmetic in **`docs/SEARCH_AUDIT.md`**. CHANGE_LOG "SEARCH S0" entry has the digest. The headline facts the design doc must reckon with:

- **Full-corpus FTS-in-Neon (10.5M tsvectors + GIN) ≈ 15.2–15.8 GB vs ~10.5 GB free headroom — over budget by ~5 GB** (pwdata ≈ 11 GB of it). The **legislation+caselaw scope (~1.05M rows) ≈ 3.8 GB — fits.**
- corpus_sections has NO functioning FTS (no-op trigger since V3; 266 MB GIN over 6.8% relic vectors; no web code reads the table). Legacy `LegislationSection` (914k) carries the live search: Lex grounding via `/api/search` (Neon GIN) + LegislationPanel via an **un-indexed seq-scan path on Railway**; the legacy table is duplicated in full on both DBs; its embedding vector(768) column exists with 0 rows.
- Corpus text ≈ 17.4 GB (debates 6.2 + caselaw 5.6 dominate). pgvector 0.8.0 installed (halfvec OK); pg_search BM25 available-not-installed. Full-corpus embeddings don't fit in Neon in any §5 configuration; the 1.2M scope mostly fits.
- 100k-row latency is network-floor (server 0–18 ms warm) — a 1M+ sample is needed before trusting FTS-in-Neon latency at scale.
- Needs Charlie: Neon compute CU/autoscale range from the console (no API key locally).

**Next: search design doc — architecture decided WITH Charlie (S0 made no recommendations).** Scratch table dropped (0 remain); production untouched (evidence in SEARCH_AUDIT §8). INGEST_PLAYBOOK unchanged — no ingest doctrine touched.

---

## CURRENT STATE — V20 (THE PROBE WAVE, 12 Jun 2026)

**Sprint:** V20 (SPRINT_V20_BRIEF.md). Full account + per-probe scorecards: CHANGE_LOG V20. Everything below the V19 heading is historical.

**DONE this sprint:**
- **Licence metadata live:** `corpus_sections.licence`/`attribution` columns; map in `shared/licence-map.ts` + INGEST_PLAYBOOK §18; applied at ingest; 1.07M rows backfilled. **pwdata backfill deferred (Charlie: ~4–5GB MVCC churn for uniform OPL).**
- **Five sources built + auto-upgraded** (seed post-push): committees-api (193,238 docs — CF-free API; Railway-egress canary first), tax-tribunals (13,037, continuously updated, .doc via word-extractor), explanatory-notes/-memoranda (EN/EM "intention layer", rides the tna-legislation budget), lawcom (240), nao-reports (2,755, nao-nc licence), ni-judgments (~5,900).
- **Classified:** HUDOC alive again (routes in CHANGE_LOG V20 §3.6 — revival V21); historic Hansard 1803–1918 = 763 bulk XML volumes ≈ ~1.1M sections (v12 parser is V21); Scottish courts BLOCKED (authed Azure API — Charlie: 5-min browser devtools XHR inspection would unblock); SSRN parked (hard WAF 403).
- **Partials audit:** building-regs/planning-policy were 791-doc duplicates of hmrc-tiins (V2 seed-before-push default-branch bug) — deleted + reseeded correctly; college-of-policing was 1,944 unfiltered-search junk — deleted + blocked; sentencing-council ✓ 253 (was complete; V13 ~381 was pre-dedup); nilawcom ✓ 17 (site dead); written-statements retired.
- **V19 closeout:** et-decisions ✓ 293,399 (+4 residue) — prediction 140–200k overshot 1.5–2.1×; uk-treaties ✓ 3,250 (+14); regnal + regional enumeration moved into the QUEUE (`enum:{type}:{year}` rows → Railway IPs; TNA penalty-boxes the local IP for any sustained enumeration — incident in CHANGE_LOG V20 §4); **asc + mwa were missing from the regional type list since forever** (now seeded).
- **Email honesty:** TOTAL % labelled "of ENUMERATED universe" + unenumerated-sources list.

**POST-PUSH (done same session):** canaries PASSED from Railway (committees-api CF-free — blocker dead); breaker cleared + 2,538 portal rows retired; seeded tax-tribunals 13,037 / lawcom 240 / nao 2,755 / EN 560 + EM 10,864 / tna-enum 1,246 (+ si-2010plus enum 17 — **NEW finding: si-2010plus holds only 5,899 distinct instruments; the V12 "2015–2026 reseed" never ran**); licence sweep re-run. Committees (~59k of 193k) + NI (~1.3k) seeders are checkpointed — rerun their seed scripts to resume if they stopped short.

**IN FLIGHT / NEXT SESSION:**
1. **retained-eu** still draining (~93k pending at close) → ✓ re-baseline at drain (playbook §1c).
1b. **Committees fully seeded queue-driven** (Publications + Oral complete; WrittenEvidence via `list:` rows from Railway — commit `6e30c54`). **NI seeder resume** from checkpoint (judiciaryni hard-cut the local IP at page 66; 1,279 of ~5,900 seeded — give it the list-row treatment if it keeps failing). **si-2010plus ✓ at enum drain, then re-run `seed-explanatory-queue.ts`** (idempotent — newly-found SIs need EM rows).
2. **ukpga regnal enum drain** → run `v19-cleanup-ukpga-calendar.ts` (5,840 chrome + 1,057 dead markers) → primary-acts-pre-2000 ✓.
3. **regional enum drain** → ✓ re-baseline.
4. New corpora ✓ at drain: committees-reports/evidence, tax-tribunals, lawcom, nao-reports, ni-judgments, explanatory-notes/-memoranda, building-regs (21), planning-policy (64).
5. Re-run `v20-licence-backfill.ts` after the drains (sweeps any NULL stragglers).

**DECISIONS WAITING ON CHARLIE (V20 additions):**
- **FCL Open Justice Licence v2.0 EXCLUDES computational analysis** (indexing/bulk/ML). Apply for TNA's computational-analysis licence: caselawlicence@nationalarchives.gov.uk (pairs with the BAILII email errand).
- **FCA Handbook**: reproduction requires an FCA licence agreement (fca.org.uk/legal) — 3,661 sections flagged `fca-restricted`.
- **pwdata licence backfill** (8.8M rows ≈ 4–5GB churn) — run or leave to the map?
- **Scottish courts**: open scotcourts.gov.uk/judgments/ with browser devtools → Network tab → copy one `api.pa.web.scotcourts.gov.uk` request's headers (the auth key) → unblocks the build.
- **written-answers/-statements legacy month-blobs** (272 rows, the tsvector-1MB offenders): delete?
- Carried from V19: OECD (position now logged in CHANGE_LOG V20 §2 — confirm), historic tax tribunals (now BUILT), committees local-fetch (MOOT if the API canary passes).

---

## PREVIOUS STATE — V19 (P1 TO 100% + PARLIAMENTARY RECORD + TAX COMPLETENESS)

**Active branch:** Main. **Sprint:** V19 (SPRINT_V19_BRIEF.md, archived at sprint close). Politeness doctrine now governs all rates: **a 5xx storm is a rate signal — halve and document** (playbook §1b). Three sources were halved this sprint: twfy-pwdata 1000ms/5, govuk-content 300ms/5, local TNA enumeration floor 500ms.

**DONE + ✓ (measured denominators):**
- **Parliamentary record COMPLETE** — 297 failed pwdata rows retried clean at halved rate; all 7 denominators ✓ at measured: **8,800,253 compiled sections** (V18 prediction ~9.8M, range 8–11M: within range). wrans "60.9%" was estimate error.
- **hmrc-manuals ✓** 69,136 + 16,061 classified residue (contents/index nodes — NOT missing content; brief's "zero-section rows" classified).
- **hmrc-ancillary ✓ 457** (RCBs/SoPs/ESCs/VAT+excise notices, NEW P1) · **tax-treaties-dta ✓ 324** (NEW P1) · **uk-treaties unblocked** → gov.uk international_treaty (1,519 seeded P3; FCO client in attic).
- **bailii-eat / bailii-tribunals / bailii-privy-ni retired** → FCL court feeds + et-decisions. NI stays parked.
- **tna-caselaw ✓ 74,896** — all 180 FCL court pages processed under V19 code; per-court tribunal coverage proven (+22 sections; the global feed already had ~everything FCL holds).
- **lda-commonsoralquestions ✓ 69,529** — closed; ~500 delta vs LDA totalResults is source-side phantom (deprecated API; full text in pwdata).
- **si-pre-2010 ✓ 174,552 + 1 classified residue** — AI-era failed relics fixed/removed; 1958 SI classified metadata-only.
- **et-decisions (NEW P3):** 131,668 gov.uk ET decisions seeded; resumed post-cooloff with zero new 429s (~125k pending, ~11h).

**IN FLIGHT / POST-PUSH CHECKLIST:**
1. ✅ V19 code deployed (pushed 16:48; the 18:46 Ops-liveness `serviceInstanceRedeploy` built from post-push Main — running since ~18:48 with the rate-limiter fix + 429/503 suspend).
2. ✅ gov.uk cooloff observed (4.4h quiet); breaker cleared, 117,781 blocked unparked + 8,554 429-failed reset (et-decisions + uk-treaties) — 11 Jun ~20:55.
3. ✅ 180 court-page rows reset to pending; `si-pre-2010:uksi/1958/1156` requeued.
4. ⏸ **`v19-seed-ukpga-regnal.ts` DEFERRED to next session** — TNA has penalty-boxed the LOCAL IP after three enumeration runs today (instant 429 backoff to 16s even at a 1000ms floor; process killed by PID, verified dead). Run tomorrow with `TNA_THROTTLE_FLOOR_MS=1000`; sanity-check the enumerated universe (~10k+ acts expected — a visibly small count means TNA was still throttling; the script is single-shot, rerun it). Also note the seeder requeued `si-pre-2010:uksi/1958/1156` already (done).
5. **retained-eu: SEEDED + RUNNING** — true universe **~153k instruments** (not V18's ~33k; playbook §8). ~154k rows seeded (idempotent union of two enumeration runs — incl. an orphaned first run, see playbook's Windows pipeline-kill pattern); ~36h of TNA fetching at 200ms/10. ✓ re-baseline at drain (the 140k "phantom" may land close — 93% shells).
6. **At each remaining drain:** re-baseline ✓ (playbook §1c) — **retained-eu** (~36h; re-measure, the 140k may land close), **et-decisions + uk-treaties** (~11h gov.uk), and after the deferred regnal pass: **primary-acts-pre-2000** (`v19-cleanup-ukpga-calendar.ts` deletes the 5,840 chrome-boilerplate rows + 1,057 dead calendar markers, then ✓). si-pre-2010 / lda-oral / tna-caselaw already ✓ (11 Jun evening).
7. **regional:** enumerate the 7-type universe with `listActEntries` (politeness backlog deferred it); re-baseline the ~160k estimate with evidence.

**INCIDENT LOG (this sprint):** gov.uk 429 storm exposed a latent V17 race — idle loops raced un-consumed tokens; instant failures ran govuk-content at 24 fails/s against a configured 3.3/s, keeping the penalty box alive. Fixed (reserve-then-claim + suspend-on-429/503). The breaker contained it. Full account: CHANGE_LOG V19 + playbook §8.

**DECISIONS WAITING ON CHARLIE:**
- **OECD MTC/TPG:** pre-Jul-2024 content is CC non-commercial — plausibly fine for us, but seeding needs sign-off (CHANGE_LOG §3.4).
- **Historic tax tribunals** (financeandtax.decisions.tribunals.gov.uk): alive, April 2003+, ASP.NET postback scraping — build go/no-go.
- **Committees** (carried from V18): Railway IP CF-blocked; local fetch / proxy / retire.

### The three layers (V17 doctrine)
- **R2** = corpus text, permanent, zero egress.
- **Neon** = metadata + search index + queue (`ingest_queue`, `corpus_sections`, `source_status` NEW, `ingest_service_state` NEW, etc).
- **Railway** = transient compute only: `Ingest` + `Ops` (+ `scrutinise-db` for the web app — ingest never touches it).

### Services (the fleet is gone — 23 containers deleted by Charlie 10 Jun)
- **`Ingest`** (`a7f4d75f…`, start: `npm run worker` → `workers/ingest-pool.ts`): single process, `WORKER_CONCURRENCY` (default 20) claim loops, shared pg.Pool (max 10), in-process token-bucket rate limiting, per-loop error isolation, 5-min row timeout. **Exit-on-empty:** 3 empty sweeps × 30s → exit(0), service stays stopped, bills nothing. Heartbeat → `ingest_service_state.last_beat` every 30s. No DATABASE_URL anywhere in its import graph (grep-proven).
- **`Ops`** (`f3397bee…`, start: `npm run scheduler` → `ops.ts`): merged scheduler+monitor, Neon only. Hourly: reaper, census, snapshots, cleanup, pwdata daily reseed, progress email (now with INGEST SERVICE state, sections-vs-rows divergence warning, persistent 🔴 breaker ISSUES). Every 15 min: circuit breakers + liveness (starts `Ingest` via `serviceInstanceRedeploy` when pending > 0 and heartbeat stale; 15-min cooldown).

### Circuit breakers (the V17 renewal — deterministic, no auto-retry ever)
- Failure breaker: 5 consecutive failures → trip. Zero-output breaker: ≥25 done rows with 0 section growth → trip.
- On trip: pending rows parked as `status='blocked'`, persistent email ISSUES line. Manual clear SQL in INGEST_PLAYBOOK §8.
- `committees-portal` is already tripped (correctly — CF 403, known since V15/V16).

### Queue state (10 Jun 2026, morning)
- 0 pending | 80,499 done | 2,538 failed (all committees-portal, parked behind breaker) | 275 skipped
- corpus_sections: 884,982. si-2010plus tail finished overnight 9–10 Jun before the fleet was deleted.
- pwdata current through 2026-06-08/09 (latest TWFY files); ops reseeds new files hourly → liveness starts ingest automatically.

### V17 code changes (key files)
- NEW: `workers/ingest-pool.ts`, `workers/process-row.ts` (processors extracted verbatim from worker-queue), `ops.ts`, `shared/neon-pool.ts`, `shared/rate-limiter.ts`
- REWRITTEN: `shared/queue-client.ts` (claim SQL without rate-limit writes), `shared/db-metadata.ts` (Prisma removed), `shared/progress-reporter.ts` (fleet relics removed), `census/live-census.ts` (Neon-only — its queue query had silently pointed at the stale Railway copy since V16)
- FIXED (latent): pwdata reseed now dedupes against `corpus_sections`, not the queue — the monitor-era version would re-seed the whole archive once cleanup deleted done rows, which under V17 would have kept `Ingest` alive forever.
- RETIRED to `scripts/attic/v17-fleet/`: worker-queue.ts, worker-main.ts, phase-router.ts, scheduler.ts, monitor.ts, restart-workers-staggered.ts, checkpoint.ts, check-status.ts, cc-monitor.ts, retry-failed.ts, prisma/ (ingest copy), DEPLOY.md
- `scripts/ingest/package.json`: prisma deps + postinstall removed; `worker`→ingest-pool, `scheduler`→ops.

### Still true / carry-overs
- Railway curl absent → committees-document rows produce 0 sections until nixpacks curl (V18+ scope).
- Blocked sources (HUDOC, NAO, uk-treaties, SSRN, BAILII) — out of V17 scope.
- Railway-DB → Neon web-app migration — future scope.

---

## ⚠️ CRASH DIAGNOSIS — What CC did and why it matters

### Timeline of CC's session (9 Jun 2026, ~17:00–18:00 BST)

CC ran a diagnostic to test whether Railway workers have curl. During this session CC:

1. **~17:23 BST** — Called `deploymentRedeploy(id: "63e9dbbf")` — accidentally redeployed a REMOVED June-4 deployment of worker-1. That old code (pre-Neon) tried to connect to Railway DB directly for queue operations, crash-looped repeatedly with ECONNRESET. This created sustained failed-connection activity against Railway DB.

2. **~17:28–17:47 BST** — Called `serviceInstanceRedeploy` on worker-1 multiple times for the CF test. Each fresh build started a new process.

3. **~17:40 BST** — Ran `restart-workers-staggered.ts` which triggered `serviceInstanceRedeploy` on **all 21 services** (20 workers + scheduler) in batches of 5. This created 21 fresh builds in ~3 minutes. On startup each worker process opens Neon connections. The scheduler additionally opens a Railway DB connection pool via `getPrisma()`.

4. **~17:40–17:46 BST** — Syntax error in test-committees-fetch.ts caused worker-1 to crash-loop on esbuild parse failure (all other workers unaffected — tsx dynamic import not eagerly resolved for them). Cleaned up.

### Root cause of Railway DB crash

**`scheduler.ts` line 82–84 calls `queryFormatBreakdown()` and `queryUnrecognisedFormats()`** — both defined in `db-metadata.ts`, both call `getPrisma()` which creates `new PrismaClient()` using `DATABASE_URL` (Railway PostgreSQL). PrismaClient maintains a persistent connection pool (default: up to 10 connections). This pool stays open for the scheduler's entire lifetime.

After the staggered restart at 17:40, a fresh scheduler instance started, opened a new PrismaClient pool to Railway DB. If the old scheduler instance did not disconnect cleanly, both pools would be open simultaneously. Combined with connection pressure from the June-4 worker-1 crash loop, Railway DB likely hit its connection or memory limit.

**This is the most probable cause.** It cannot be confirmed until Railway DB is back up and `pg_stat_activity` can be queried.

### What CC reported incorrectly

CC said "Workers are running normally" and "19/21 workers SUCCESS" at ~17:46 BST. Both statements were true for Railway deployment status and Neon queue health. CC did NOT check Railway DB health before reporting. Given Railway DB's history of OOM crashes, this was a serious oversight.

### What was discovered during the session (useful for next sprint)

1. **Curl is NOT available on Railway worker containers.** The Railway container (mise + Node.js 22.22.3, Railpack build) has no curl at `/usr/bin/curl`, `/usr/local/bin/curl`, `/bin/curl`, or via PATH. The CLAUDE.md claim "Railway Linux containers have curl by default" is WRONG.

2. **V16.1 committees-document approach has never worked.** All 2,422+ committees-document done rows produced 0 corpus_sections. `fetchPublicationHtml()` silently returns null when curl is absent; `processCommitteeDocument()` marks the row done without error. 2,896 rows tagged with `lastError = 'empty — curl not available in Railway container (V16.1)'`.

3. **`reports-responses` accessible with curl from Charlie's machine, no CF challenge.** Seeder correctly found 1,132 rows (not 9,959 — the ~80-page real extent of the listing). `other-publications` returns CF JS challenge from Charlie's machine; unknown from Railway (test could not run without curl).

4. **Queue nearly exhausted.** At end of session: 1,622 pending (si-2010plus only), 112,600 done. Workers should have finished si-2010plus overnight and be in discovery/idle mode.

---

## IMMEDIATE ACTIONS REQUIRED — V16

---

## IMMEDIATE ACTIONS REQUIRED — V16

| Action | Status | Who |
|--------|--------|-----|
| Execute commit-all.sh | ✅ done — `c0c9844`, `6cbf568` | CC |
| Stop workers (Railway OOM crash did this) | ✅ done — all offline at migration time | — |
| Run `migrate-queue-to-neon.ts` | ✅ done — 127,380 rows Railway = 127,380 Neon | CC |
| LDA retirement SQL (Railway + Neon + corpus_targets) | ✅ done — 168 rows each + 2 targets retired | CC |
| Staggered redeploy 20 workers + scheduler + monitor | ✅ done — 20/21 SUCCESS | CC |
| Railway DB zero ingest connections verified | ✅ done — 0 pg_node, 9 total (web app only) | CC |
| **Fix worker-18** — Railway dashboard → ingest-worker-18 → Deploy from Main | ⬜ pending | Charlie |
| **Resume committees seeder** — see instructions below | ⬜ next session | CC |
| **Retire old committees-portal rows** — SQL below, run AFTER seeder completes | ⬜ after seeder | CC |

### V16.1 — committees-document approach (9 Jun 2026)

**Root cause diagnosis:** committees.parliament.uk and publications.parliament.uk both block Node.js
Undici via Cloudflare TLS fingerprinting (JA3), regardless of headers or IP. curl's TLS fingerprint
IS accepted. Fix: `fetchPublicationHtml()` in committees-portal.ts now uses `spawnSync(curl)`.
Railway Linux containers have curl by default — workers can fetch from publications.parliament.uk.

**Seeder approach:** `seed-committees-publications.ts` uses curl with a cookie jar (`-c/-b` flags).
CF tracks session continuity via parliament.uk session cookies. Without a cookie jar, CF challenges
after 1-2 pages. With cookie jar, sessions stay valid for 100+ pages at 1.5s pace.

**Seeder state (9 Jun 2026 end of session):**
- committees-reports document rows seeded: **~1,176** (pages 1–~80 of 498)
- committees-evidence document rows seeded: **0** (not yet started)
- All 1,176 seeded rows: **done** (workers processed them immediately)
- Seeder checkpoint: `scripts/ingest/seed-committees-checkpoint.json` — survives session clear
- Old committees-portal rows: still `failed` — DO NOT retire until seeder completes all pages

**Resume seeder in next session:**
```
NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx \
  --tsconfig scripts/tsconfig.json \
  scripts/ingest/seed-committees-publications.ts
```
The checkpoint resumes automatically. Expect ~25–30 min for remaining reports + ~50 min for evidence.
Total expected: ~9,959 reports + ~40,794 evidence = ~50,753 per-document rows.

**Retire old committees-portal rows AFTER seeder completes (run on Neon):**
```sql
UPDATE ingest_queue
SET status = 'done', "lastError" = 'retired V16 — replaced by committees-document rows'
WHERE "sourceType" = 'committees-portal'
  AND corpus IN ('committees-reports', 'committees-evidence');
```

### V16 cutover — all done

- Queue migration: 127,380 rows Railway → Neon (exact match)
- LDA retirement: 168 rows done each DB, 2 corpus_targets retired
- Workers: 20/21 SUCCESS on Neon queue
- Railway DB: 0 ingest connections (web app only)
- Worker-18: stale Railway deploy issue — Charlie: Railway dashboard → ingest-worker-18 → Deploy from Main

### V16 pwdata-wrans coverage confirmed
- TWFY wrans: **2001-06-21 → 2026-06-08** (current, adds files daily)
- TWFY lordswrans: **1999-11-18 → 2026-06-08** (current)
- LDA written questions covers only from ~2009 (API launch) → TWFY has MORE coverage. Clean switch.

---

## IMMEDIATE ACTIONS REQUIRED — V15

| Action | Status | Who |
|--------|--------|-----|
| Commit and push V15 code | ✅ done — `a0137b6`, `72da2d7`, `3019b0e` | CC |
| Redeploy all 20 workers + scheduler on V15 | ✅ done — 20/21 SUCCESS (worker-18 retriggered) | CC |
| Rate limits updated (eurlex→8, lda→2, committees-portal→3) | ✅ done via script | CC |
| Neon corpus_targets: committees-reports + committees-evidence added | ✅ done; committees-a/b retired | CC |
| Seed committees queue | ✅ 498 reports rows + 2,040 evidence rows inserted | CC |
| Reset LDA 524 failed rows | ✅ done (0 rows matched — none outstanding) | CC |
| Kill reseed-deep.ts local process | ✅ killed PIDs 58060 + 18264 | CC |
| Verify reseed-deep.ts log | retained-eu: 0 new rows; regional: interrupted mid-nia | CC |

**V15 Railway DB findings:**
- `max_connections = 100` (not 25 — Starter plan has room)
- Peak connections with 20 workers: ~46 (well under 100)
- **Crash cause: OOM, not connection exhaustion.** Railway Postgres container memory-killed under peak concurrent write load.
- Fix applied: monitor.ts Railway pool cap reduced `max: 3 → 2`
- Longer-term: upgrade Railway Postgres plan (more RAM) OR migrate ingest queue to Neon
- **Do NOT run reseed-deep.ts locally again.** Move it to Railway as a one-off service job.

**V14 actions still pending:**

**V13 carry-over (still needed):**
| Run priority SQL in Railway dashboard Query tab (de-prioritize completed legislation corpora) | ⬜ pending | Charlie |
| Update sentencing-council corpus_targets: `UPDATE corpus_targets SET blocked=false, blocked_reason=NULL WHERE corpus_key='sentencing-council'` | ⬜ pending | Charlie |

**V12 carry-over (still needed):**
| Kill local scheduler.ts process: `Stop-Process -Id 22916` (and child 47892) | ⬜ URGENT (if not done) | Charlie |
| Redeploy `Ingest-scheduler` on Railway (stopped 7 Jun 23:01 UTC) | ⬜ after commit | Charlie |
| Add `RESEND_API_KEY` to `ingest-monitor` Railway service env | ⬜ pending | Charlie |

**Run classify-no-provisions.ts:**
```
NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx --tsconfig scripts/tsconfig.json scripts/ingest/classify-no-provisions.ts
```
Runs overnight. Checkpoint at `scripts/ingest/classify-no-provisions-checkpoint.json`. Resume by re-running same command.

**Priority SQL (run in Railway dashboard → scrutinise-db → Query tab):**
```sql
UPDATE ingest_queue
SET priority = 5
WHERE corpus IN ('si-pre-2010', 'si-2010plus', 'primary-acts-pre-2000', 'primary-acts-2000plus')
  AND status = 'pending';
```

**No other pending actions from V11 (except RESEND_API_KEY).**
('fca-handbook:serv', 'fca-handbook', 'serv', 'fca-handbook', 2),
('fca-handbook:bench', 'fca-handbook', 'bench', 'fca-handbook', 2),
('fca-handbook:bfsag', 'fca-handbook', 'bfsag', 'fca-handbook', 2),
('fca-handbook:collg', 'fca-handbook', 'collg', 'fca-handbook', 2),
('fca-handbook:enfg', 'fca-handbook', 'enfg', 'fca-handbook', 2),
('fca-handbook:fcg', 'fca-handbook', 'fcg', 'fca-handbook', 2),
('fca-handbook:fctr', 'fca-handbook', 'fctr', 'fca-handbook', 2),
('fca-handbook:perg', 'fca-handbook', 'perg', 'fca-handbook', 2),
('fca-handbook:rfccbs', 'fca-handbook', 'rfccbs', 'fca-handbook', 2),
('fca-handbook:rppd', 'fca-handbook', 'rppd', 'fca-handbook', 2),
('fca-handbook:unfcog', 'fca-handbook', 'unfcog', 'fca-handbook', 2),
('fca-handbook:wdpg', 'fca-handbook', 'wdpg', 'fca-handbook', 2),
('fca-handbook:m2g', 'fca-handbook', 'm2g', 'fca-handbook', 2)
ON CONFLICT (id) DO NOTHING;
```

**V9 carry-over:**

**V9 carry-over — Monitor service details:**
- Service name: `ingest-monitor`
- Service ID: `d4945e0c-207a-46ca-aceb-bdc010183cc5`
- Start command: `npm run monitor`
- DATABASE_URL + NEON_DATABASE_URL already set via API
- Repo: Scrutinise/scrutinise-prototype, branch: Main
- Steps: Railway dashboard → Projects → scrutinise-prototype → ingest-monitor → Settings → Source → connect GitHub → Deploy

**V9 SQL already applied to Neon:**
- `retired` column added to corpus_targets
- 4 hansard API corpora marked retired (won't appear in emails)
- 42 corpus_targets display_labels updated to match Excel

**V9 partial reseeding:**
- 6,038 primary-acts-pre-2000 items detected with < 3 sections (covers the 1,084 section gap)
- Monitor will auto-reseed these on first cycle once deployed

---

## KEY ARCHITECTURE STATE (as of V16 + V16.1)

- **Queue on Neon (V16):** `ingest_queue`, `source_rate_limits`, `specialist_queue`, `scheduler_lock`, `ingest_progress_snapshots` all on Neon. Railway Postgres holds only Prisma app tables.
- **Connection-per-transaction (V16):** ECONNRESET retry loop removed. Clean exit on DB error → Railway restarts with jitter.
- **LDA written questions retired (V16):** covered by `pwdata-wrans` (2001–present) and `pwdata-lordswrans` (1999–present).
- **committees-document (V16.1) — BROKEN on Railway:** All 2,896 done rows from first seeder run produced 0 corpus_sections. Root cause: curl NOT installed on Railway containers. `fetchPublicationHtml()` returns null silently; rows marked done with no content. All tagged `lastError = 'empty — curl not available in Railway container (V16.1)'`. Needs Nixpacks curl installation before workers can produce content.
- **Seeder completed (10 Jun 2026 — multiple runs):** Best run (with retry-on-timeout): **~1,633 reports + ~55 evidence total rows in Neon** (idempotent; subsequent runs added 0 new). The retry path is essential — ~30% of pages fail first attempt but succeed after 8s retry; without retries only ~89 rows found. `other-publications` listing ends consistently at p1175; ~55 rows is the real accessible extent from residential IP. All rows will produce 0 corpus_sections until curl installed on Railway.
- **Retirement SQL** (run on Neon AFTER curl installed and workers processing): `UPDATE ingest_queue SET status='done', "lastError"='retired V16 — replaced by committees-document rows' WHERE "sourceType"='committees-portal' AND corpus IN ('committees-reports','committees-evidence');`
- **committees-portal rows:** 498 reports + 2,040 evidence still `failed`. DO NOT retire until curl installed.
- **Cloudflare diagnosis (confirmed 9/10 Jun 2026):** `reports-responses` accessible with curl, no CF challenge. `other-publications` mostly exit 28 timeouts from Charlie's residential IP (CF rate-limiting, not JS challenge). Railway IPs unknown. CLAUDE.md claim "Railway Linux containers have curl by default" is incorrect.

## KEY ARCHITECTURE STATE (as of V15)

- **committees portal (V15):** `committees-portal.ts` scrapes `committees.parliament.uk/publications/` with browser User-Agent (Cloudflare bypass). 498 pages × ~20 pubs = 9,959 committee reports. 40,794 other-publications (evidence sessions, oral/written evidence). sourceType: `committees-portal`, max 3 concurrent, 500ms interval.
- **LDA pageSize fix (V15):** `processLda()` in worker-queue.ts now passes `pageSize=100` for `writtenquestions` corpora at all times (not just 524 fallback). After 3 524 failures (MAX_524_RETRIES), row is marked `specialist-queue: LDA 524 after N attempts — archived`. Monitor no longer resets these rows.
- **SOURCES email section (V15):** `sendProgressEmail()` now includes SOURCES section showing pending/active/cap per sourceKey. Flags `⚡cap-full` when active == cap with pending work.
- **INGEST_PLAYBOOK §8 (V15):** Three new patterns: committees portal alternative, LDA 524 fix approach, connection pool exhaustion signature.

## KEY ARCHITECTURE STATE (as of V14)

- **hasNoProvisions classification (V14):** `classifyNoProvisionsItem()` in `tna-legislation.ts` classifies into: commencement | metadata-only | pdf-only | no-provisions. Uses title regex + year < 1980 heuristic + PDF HEAD check. Workers write classified rows to Neon `corpus_sections.availability_status` + `availability_note`.
- **specialist_queue (V14):** New Railway DB table. Workers insert commencement + pdf-only items for future specialist worker processing. Indexed on `(specialist_type, status)` and `(corpus, status)`.
- **corpus_sections new columns (V14):** `availability_status TEXT NOT NULL DEFAULT 'full'` and `availability_note TEXT`. Existing rows default to 'full'. Index on availability_status WHERE != 'full'.
- **fetch() timeout fix (V14):** `withTimeout(ms)` helper added to `tna-legislation.ts`. All fetch calls use AbortController: 30s for text/binary, 10s for HEAD. Workers were hanging indefinitely on old NISR items with no timeout.
- **Monitor reseed loop fix (V14):** `CORPUS_THRESHOLDS` now has `regional: 1` and `retained-eu: 1`. `reseedPartialItems()` excludes items with `availability_status != 'full'` via second Neon query. Root cause of 36,983 items stuck in false-positive pending state all day.
- **Queue state after V14 fixes:** 162 pending (lda-lordswrittenquestions only). Workers in discovery mode after these complete.

## KEY ARCHITECTURE STATE (as of V13)

- **Startup jitter (V13):** Random 0–20s delay added as first `await` in `worker-queue.ts main()` before any DB call. Prevents connection storm on simultaneous Railway redeploy. Jitter line: `scripts/ingest/workers/worker-queue.ts` line 65.
- **sentencing-council (V13):** `listSentencingCouncilGuidelines()` now scrapes `sentencingcouncil.org.uk` directly (embedded JSON, ~381 guidelines across crown-court + magistrates pages). Was returning 0 results via GOV.UK search API.
- **nilawcom (V13):** `listNiLawComReports()` now uses BFS crawl (homepage + completed_projects → individual report pages → PDFs). Was returning 0 PDFs from homepage (no direct PDF links there).
- **Priority SQL pending (V13):** SQL to set si-pre-2010/si-2010plus/primary-acts rows to priority 5 pending Charlie running it in Railway dashboard.
- **CLAUDE.md + INGEST_PLAYBOOK.md (V13):** Railway Operations section added to CLAUDE.md; 3 new failure patterns added to INGEST_PLAYBOOK §8.
- **Duplicate email root cause (V12):** LOCAL scheduler.ts process (PIDs 22916/47892 on Charlie's machine) — kill before restarting Railway scheduler. See §IMMEDIATE ACTIONS.
- **Railway scheduler:** DOWN since 2026-06-07T23:01 UTC (scheduler_lock confirms). Needs redeploy after commit.
- **CORPUS_THRESHOLDS (V12):** Per-corpus partial-item reseed thresholds in `monitor.ts` — replaces single global threshold of 3. Prevents false-positive reseeding of short pre-2000 Acts.
- **primary-acts-pre-2000 (V12):** 6,038 false-positive pending rows reset to done. 0 genuine gaps. Queue now: 0 pending.
- **hmrc-tiins (V12):** COMPLETE — 791 sections; est_is_confirmed=true in corpus_targets.
- **hmrc-codes-guidance (V12):** COMPLETE — 14,067 sections; est confirmed (was 640,000). GOV.UK search API returns document pages not sub-pages.
- **LDA timeout (V12):** `LDA_FETCH_TIMEOUT_MS` 45s → 90s in `lda-parliament.ts`. 1,402 failed/timed-out rows reset to pending. lda-commonswrittenquestions: 1,232 pending; lda-lordswrittenquestions: 132 pending.
- **Monitor auto-reseed (V12):** `reseedExhaustedCorpora()` + `seedPwdataCorpus()` added to monitor.ts — auto-seeds new TWFY pwdata files daily when corpus exhausts. No more manual weekly re-run needed for pwdata.
- **hasNoProvisions skip:** ADDED (V11) — workers need redeploy to pick up.
- **tna-legislation rate limit:** 10 concurrent workers (V11).
- **Monitor alerts:** ADDED (V11) — requires `RESEND_API_KEY` on `ingest-monitor` service.
- **pwdata corpora:** ALL COMPLETE (V11) — monitor auto-reseeds daily files now.
- **Queue state (8 Jun 2026):** ~31,110 pending | 11 claimed | 92,111 done | 0 failed | 237 skipped
- **Pending by corpus:** si-pre-2010: 20,533 | regional: 4,859 | retained-eu: 2,452 | si-2010plus: 3,228 | lda-commonswrittenquestions: 1,232 | lda-lordswrittenquestions: 132 | (primary-acts-pre-2000: 0)
- **FCA Handbook:** COMPLETE (V10) — 3,661 sections; est_is_confirmed=true
- **Monitor:** RUNNING — loops every 15 min; alert + auto-reseed functionality added V11/V12
- **Restart policy:** ON_FAILURE / max 3 retries on all 22 services (V10)
- **Retired corpora (Neon):** `fca-publications`, `fca-regulators` retired+blocked (V10); `hansard-*-a/b` retired (V8)
- **source_rate_limits actual columns:** `sourceKey`, `intervalMs`, `lastIssuedAt`, `suspended`, `suspendedUntil`, `updatedAt`, `isComplete`, `maxConcurrentWorkers`
- **Neon corpus_sections:** ~785,099+ rows — growing as SI/regional/LDA process
- **Railway DB:** ~2.0GB of 20GB

---

## KEY ARCHITECTURE STATE (as of V3)

- **Neon corpus_sections:** 751,949 rows — no compiledText column (dropped V3)
- **Neon corpus_targets:** 39 rows — email denominators; edit via SQL to update estimates
- **Railway corpus_sections:** 0 rows (TRUNCATEd V3)
- **Railway DB:** ~0.8GB of 20GB — target maintained
- **R2 compiled text:** 100% coverage verified — all compiledText is in R2 at r2Key paths
- **Workers:** 20 active, on pwdata-* (priority 3) — priorities 1/2 fully done
- **Neon DB limit:** `DB_LIMIT_GB = 10` in progress-reporter.ts — update if on Scale plan (50GB)

---

## DIAGNOSTIC SNAPSHOT — 5 Jun 2026 (run ~01:00 UTC)

### DB state (Railway corpus_sections)

**Total rows: 732,942 — DB: 4,824 MB (4.7 GB of 20 GB) — table: 581 MB**

compiledText column: 665,707 rows populated, ~1,617 MB raw text. This is the primary volume driver — by design for FTS (schema: "First 10,000 chars; full text in R2"), but at 732k rows it dominates the DB.

| corpus | rows |
|--------|-----:|
| si-pre-2010 | 174,507 |
| regional | 109,695 |
| primary-acts-2000plus | 90,860 |
| tna-caselaw | 74,730 |
| primary-acts-pre-2000 | 69,501 |
| lda-commonsoralquestions | 65,806 |
| si-2010plus | 60,485 |
| eur-lex | 18,973 |
| pwdata-debates | 18,937 |
| retained-eu | 14,390 |
| hmrc-codes-guidance | 13,425 |
| pwdata-wrans | 6,429 |
| pwdata-lords | 5,448 |
| pwdata-westminster | 3,860 |
| college-of-policing | 1,944 |
| building-regs / hmrc-tiins / planning-policy | 791 each |
| ots-reports | 497 |
| oecd | 462 |
| scotlawcom | 350 |
| written-answers | 142 |
| written-statements | 128 |

**Zero rows for:** lda-lordswrittenquestions, lda-commonswrittenquestions, lda-commonsdivisions, lda-lordsdivisions, uk-treaties, echr-hudoc, fca-regulators, sentencing-council, nao-reports.

### Queue state (ingest_queue)

**pending: 0 — claimed: 409 (stale from crash) — done: 106,945**

Queue is **fully exhausted**. Workers processed all remaining pending rows in the ~1.5h they ran after recovery (20:43–21:11 UTC on 4 Jun). 409 claimed rows are stale locks — will expire. No new ingest can happen until the queue is reseeded.

**Open question:** `lda-commonswrittenquestions` (expected ~619k records across 1,238 queue pages) shows 0 DB rows and 0 R2 keys. Was it processed when DB was full (inserts silently failed)? Or was it never seeded? Needs investigation before next seed run.

### R2 state (scrutinise-legislation bucket — 41 top-level prefixes)

Legislation corpora (CLML) store 2 keys per section (raw.xml + compiled.txt), hence ~2× ratio. Text-only corpora (pwdata, LDA, etc.) store 1 key per section.

| prefix | R2 keys | DB rows | ratio |
|--------|--------:|--------:|------:|
| si-pre-2010/ | 331,925 | 174,507 | ~1.9× |
| regional/ | 216,179 | 109,695 | ~2.0× |
| primary-acts-2000plus/ | 174,079 | 90,860 | ~1.9× |
| caselaw/ | 149,702 | 74,730 | ~2.0× |
| si-2010plus/ | 118,782 | 60,485 | ~2.0× |
| lda-commonsoralquestions/ | 65,813 | 65,806 | 1.0× |
| retained-eu/ | 26,704 | 14,390 | ~1.9× |
| hmrc-codes-guidance/ | 26,659 | 13,425 | ~2.0× |
| eur-lex/ | 18,973 | 18,973 | 1.0× |
| pwdata-debates/ | 18,945 | 18,937 | 1.0× |
| pwdata-wrans/ | 6,429 | 6,429 | 1.0× |
| pwdata-lords/ | 5,448 | 5,448 | 1.0× |
| pwdata-westminster/ | 3,860 | 3,860 | 1.0× |

Key naming: caselaw is stored under `caselaw/` (not `tna-caselaw/`). LDA, pwdata, eur-lex: compiled.txt only. Legislation: raw.xml + compiled.txt per section.

Legacy R2 prefixes from old Neon pipeline (not in Railway DB): `ukpga/`, `uksi/`, `eudn/`, `eudr/`, `eur/`, `anaw/`, `asp/`, `asc/`, `nia/`, `nisi/`, `nisr/`, `ssi/`, `wsi/`, `operational/` — these correspond to the 914,274 Neon legacy sections.

### Root cause of volume fill (confirmed)

`processPwdata` (and all other source clients) calls both `r2Put()` AND `upsertSection({ compiledText: compiled.slice(0, 10_000) })`. The `compiledText` field stores up to 10KB per row in Railway DB by design — intentional for FTS. At ~730k rows this is 1.6GB of text in Postgres.

**This is an architectural decision to discuss with CCh.** Options:
1. Remove compiledText from corpus_sections entirely — rely on R2 for full text, FTS via tsvector trigger only (already maintained)
2. Reduce slice to 2,000 chars (enough for FTS lexemes, less storage)
3. Accept it and plan for larger Railway volume as corpus grows

Hourly cleanup (added V3) handles snapshot + done-row accumulation but does NOT address compiledText growth. That requires a schema/code decision.

---

## IMMEDIATE ACTIONS REQUIRED (for Charlie)

### V2 Part 1 — TWFY pwdata client (4 Jun 2026)

**Directory probe verified before building.** Three mismatches from brief:
- `lords/` → actual path `lordspages/`, prefix `daylord{date}{a/b}.xml`
- `westminster/` → actual path `westminhall/`, prefix `westminster{date}{a/b}.xml`
- `wrans/` → filename prefix is `answers` not `wrans`

| Corpus | Dir | Files | Coverage |
|--------|-----|-------|----------|
| pwdata-debates | `debates/` | 19,999 | 1919–present |
| pwdata-lords | `lordspages/` | 5,663 | 1999–present |
| pwdata-wrans | `wrans/` | 6,857 | 2001–present |
| pwdata-westminster | `westminhall/` | 3,932 | 2000–present |

All directories return HTTP 200. Files current through 2026-06-03. XML parseable — speech format for debates, ques/reply format for written answers.

**Files created/modified:**
- `scripts/ingest/sources/twfy-pwdata.ts` (new — source client)
- `scripts/ingest/seed-pwdata-queue.ts` (new — seeder, ~36k rows)
- `scripts/ingest/workers/worker-queue.ts` (processPwdata added)
- `scripts/ingest/shared/progress-reporter.ts` (CORPUS_MANIFEST updated — Hansard/WA entries now point to pwdata corpora)
- `scripts/ingest/seed-rate-limits.ts` (twfy-pwdata 500ms added)
- `scripts/ingest/shared/discovery.ts` (pwdata corpora added to SINGLE_PASS_CORPORA + ORDER)

**Post-deploy actions needed:** ~~Run `seed-pwdata-queue.ts`~~ ✅ done | ~~Run `seed-rate-limits.ts`~~ ✅ done | Redeploy workers (Charlie).

---

### V2 Part 2 — LDA 524 fallback + UK Treaties fix (4 Jun 2026)

**LDA 524 fallback:** `fetchLdaPage` now retries with `pageSize 100` on HTTP 524 when original size > 100. Prevents permanent failure; accepts partial page coverage over zero. 1,416 LDA failed rows reset to pending.

**UK Treaties silent failure:** Root cause was `filter_organisations[]=` sent as literal `[]` in URL — gov.uk API returns 422. Fix: `URLSearchParams` encodes as `%5B%5D`. Query now returns 1,104 FCDO treaty results. 2 done rows reset to pending.

**LDA Divisions content:** Each record = title + date + UIN only (no narrative). Low text volume but descriptive titles retained; already priority 3.

**Queue state after all V2 post-deploy actions:** 37,869 pending | 270 claimed | 70,730 done | 0 failed

**V2 Part 3 — NPPF/PPG + Building Regs (4 Jun 2026)**
- `listPlanningPolicyNppf()`: enumerates PPG collection 63 HTML chapters (~60KB text each) + NPPF page
- `listBuildingRegs()`: enumerates 21 Approved Documents (description text; PDFs future work)
- V1 blocked: Erskine May, Bill Pages, HoC Library all CF 403 — not built
- Seed rows inserted: `planning-policy:__index`, `building-regs:__index`

**All post-deploy actions complete:**
- ~~`commit-all.sh`~~ ✅ pushed (commits `a526de9..3b0b676`)
- ~~Redeploy workers~~ ✅ all 20 redeployed via Railway API
- **Redeploy scheduler** — Charlie to do manually (or CC can trigger via API if needed)

---

### Post-sprint monitoring (4 Jun 2026 ~02:00 BST)

Queried Railway DB directly after push. **All V1 post-deploy actions still pending** — Charlie has not yet run migration or redeployed.

| Check | Result |
|-------|--------|
| `scheduler_lock` table | Does not exist — `prisma migrate deploy` not yet run |
| Per-worker snapshots | 0 rows — workers not yet redeployed (still running pre-V7 code) |
| Last scheduler run | 2026-06-03T23:56 UTC (corpus-level snapshots only, no per-worker breakdown) |
| Queue state | 955 pending / 257 claimed / 70,709 done / **491 failed** (LDA 524s accumulating — reset SQL still needed) |
| `acquireSchedulerLock()` fallback | Working correctly — returns `true` (proceeds without lock) when table missing |

Next hourly email will still show the old per-corpus format (no per-worker rows) until Charlie redeployes.

---

### What just happened (4 Jun 2026 V1)

1. **Scheduler email deduplication (PART 2)** — Added `scheduler_lock` table + `acquireSchedulerLock()`. Scheduler acquires a DB-based mutex at the start of each `run()`. If another instance holds the lock (set within last 50 minutes), the run is skipped. Uses random per-startup ID (not process.pid — all Railway containers are PID 1). Migration: `20260604010000_scheduler_lock`.

2. **Source audit (PART 3)** — 50 sources tested live. Full results in CHANGE_LOG. Key: **FCA Publications accessible** (162KB HTML), Sentencing Council, College of Policing, Ofcom/Ofgem/Ofsted all accessible. FCA Handbook (JS SPA), ECHR, SSRN, HoC Library, Erskine May all blocked.

3. **Stalled source diagnoses (PART 4)**:
   - *HMRC*: Single `__index` row stuck claimed for 26h (worker 8). Root cause: `processHmrc` runs 6 generators (~17k items) in one claim — killed by Railway SIGTERM. **Reset SQL in post-deploy actions.**
   - *LDA commonswrittenquestions*: 388 failures with HTTP 524 (Cloudflare timeout). Fix applied: retry logic added to `fetchLdaPage`. **Reset SQL in post-deploy actions.**
   - *SI 2010+*: Queue exhausted (5,813/5,824 done). Not stalling — needs reseeding for 2015–2026 gap.

4. **Worker-2 build failure (PART 1)** — Root cause: Railway retrying an old deployment (commit `4f9cc389`) with Nixpacks + old postinstall path. Worker-2 IS running (SUCCESS at 22:47). Fix: Charlie triggers fresh "Deploy" from Main in Railway (NOT "Redeploy"). Stops hourly spam.

5. **New source clients (PART 5)** — Added `listFcaPublications()`, `listSentencingCouncilGuidelines()`, `listCollegeOfPolicing()` to gov-scraper.ts (GOV.UK search API by org). Wired into processGovUk switch + processRow dispatcher. Queue seeds added to queue-populator.ts.

6. **LDA retry fix (PART 4 fix)** — `fetchLdaPage` now retries on HTTP 524/502/503/504 (up to 3 retries, 3s×attempt backoff). 388 failed rows need reset to pending (SQL in post-deploy actions).

7. **TWFY pwdata discovery (PART 6)** — `theyworkforyou.com/pwdata/scrapedxml/` is freely accessible. `debates/` has Commons Hansard XML from 1919 to present (~431KB/day, daily files). `wrans/` has Written Answers from 2001+ (3,259 files). This supersedes all other Hansard ingest approaches. **Do not build yet — awaiting CCh review.** See CHANGE_LOG for full findings.

---

## IMMEDIATE ACTIONS REQUIRED (for Charlie)

### V3 — all complete ✅

| Action | Status |
|--------|--------|
| Railway PostgreSQL restarted | ✅ CC via Railway API |
| All 20 workers redeployed | ✅ all SUCCESS by ~20:43 UTC 4 Jun |
| Scheduler redeployed with DB size + hourly cleanup | ✅ commit b0a7a7d live |
| Hourly cleanup running | ✅ scheduler deletes old snapshots + done rows every cycle |
| DB size in email | ✅ every hourly email now shows %, warns at 80%/90% |

**Remaining decision for CCh:** What to do about `compiledText` (see diagnostic snapshot above). This is the root cause of volume fill — not a code bug, an architectural choice.

**Open investigation:** `lda-commonswrittenquestions` — 0 rows in DB and R2 despite being seeded. Determine if queue rows exist (check failed count), and whether inserts failed silently when DB was at capacity.

### V1 post-deploy (all required before workers pick up new sources)

1. **`npx prisma migrate deploy`** — Apply `20260604010000_scheduler_lock` migration
2. **Reset stuck HMRC row:**
   ```sql
   UPDATE ingest_queue SET status='pending', "claimedBy"=NULL, "claimedAt"=NULL 
   WHERE corpus='hmrc-codes-guidance' AND status='claimed';
   ```
3. **Reset LDA 524 failures:**
   ```sql
   UPDATE ingest_queue SET status='pending', "lastError"=NULL, "claimedBy"=NULL 
   WHERE corpus='lda-commonswrittenquestions' AND status='failed';
   ```
4. **Fix worker-2 build loop** — Railway dashboard → ingest-worker-2 → Settings → trigger a new "Deploy" from Main branch (not "Redeploy" of existing deployment). This uses fresh commit + empty railway.json → RAILPACK builder → succeeds.
5. **Redeploy workers + scheduler** — So LDA retry fix and scheduler lock go live.
6. **Seed new source rows** — Run `tsx scripts/ingest/queue-populator.ts` (adds nao-reports, fca-publications, sentencing-council, college-of-policing seed rows — safe to re-run, ON CONFLICT DO NOTHING).

### V7 (still pending)
- **Manually redeploy workers + scheduler** in Railway dashboard — so containers pick up `writeWorkerSnapshot()` call.

### V5 (still pending)
- **Register TWFY API key** at theyworkforyou.com/api/key. Add `TWFY_API_KEY` to Railway env.
- **Run `seed-twfy-queue.ts`** after key is added.
- **Review data access request drafts** in `docs/data-access-requests/`.

---

## ARCHITECTURE SNAPSHOT (4 Jun 2026 — post V1)

### What just happened (3 Jun 2026 V7 post-deploy — all seeding and SQL actions complete)

All V6/V7 pending actions now done:
- **`prisma migrate deploy`** ✅ — `workerId` column live on Railway DB
- **`seed-rate-limits.ts`** ✅ — 16 entries, including `lda-parliament` (200ms) and `fca-publications` (300ms)
- **`seed-lda-queue.ts`** ✅ — 1,602 LDA queue rows inserted (5 datasets seeded)
- **EUR-Lex queue reset** ✅ — 50 done rows → pending (workers will retry with SPARQL API)
- **Format backfill** ✅ — 688 null `formatFound` rows fixed (echr-hudoc/eur-lex/fca → html); 695 → 7 remaining nulls
- **Queue health:** 1,652 pending / 200 claimed / 70,560 done — workers actively picking up LDA + EUR-Lex
- **ONE remaining action (Charlie):** Manually redeploy workers + scheduler in Railway dashboard so `writeWorkerSnapshot()` is active and next email shows per-worker throughput

### What just happened (3 Jun 2026 V7 — Worker-ID throughput + FCA status)

1. **Worker throughput now by worker ID** — Workers write their own snapshots to `ingest_progress_snapshots` (with `workerId` column, new migration). Every 50 rows processed, each worker records `sectionsCompiled` (actual upsertSection calls). Email now shows "Worker 1  si-2010plus  4,230 /hr  ████  87% eff" — sorted numerically. Workers with no recent activity don't appear.

2. **FCA status corrected** — `blocked: true` removed from FCA Handbook entry. Since queue rows exist (failed status), it auto-shows `⚠️ failing` rather than `⛔ blocked`. FCA Publications placeholder added (shows "not started" — V8 build scope).

3. **Duplicate scheduler confirmed resolved** — Railway API: one `Ingest-scheduler` service, one `loop()` call. All 20 workers + scheduler SUCCESS at 22:07 post-V6b.

4. **ACTION NEEDED (Charlie):** `npx prisma migrate deploy` in `scrutinise-web/` after push (adds `workerId` column). Then redeploy workers and scheduler.

5. **SQL backfill (informational):**
   ```sql
   UPDATE ingest_queue SET format = 'clml' WHERE format IS NULL AND status = 'done'
     AND (corpus LIKE '%primary-acts%' OR corpus LIKE '%si-%' OR corpus LIKE '%regional%');
   UPDATE ingest_queue SET format = 'html' WHERE format IS NULL AND status = 'done' AND corpus = 'tna-caselaw';
   ```

### What just happened (3 Jun 2026 V6b — Worker crash-loop fix)

Workers 6, 9 (and others) were crash-looping via self-discovery: when their primary corpus was exhausted, they walked `DISCOVERY_CORPUS_ORDER` and hit TNA legislation corpora. `discoverTnaLegislation` triggered a full historical scan (`listActIds('ukpga', 1267, 1999)` = 733 sequential TNA HTTP calls). Railway SIGTERM'd the container at ~10 min. Worker restarted. Loop repeated.

**Fix:** `discoverTnaLegislation` now:
- Returns [] immediately for historical-only corpora (`yearMax < currentYear - 1`)
- For ongoing corpora, checks only the last 2 years inline (`checkFrom = max(yearMin, currentYear - 1)`)
- Warns in logs if queue is genuinely empty (don't trigger full scan inline — use `reseed-si-gaps.ts`)

`UNDER_SEEDED_THRESHOLD` logic and `needsFullScan` path removed entirely.

### What just happened (3 Jun 2026 V6 — EUR-Lex SPARQL fix + LDA Parliament)

1. **EUR-Lex unblocked via CELLAR SPARQL** — `search.html?format=json` now returns HTML (SPA redesign). Fixed: use `publications.europa.eu/webapi/rdf/sparql` (no auth). Confirmed: 232,988 series-3 CELEX IDs enumerable; `fetchDocumentText` returns full text (GDPR: 350KB). EstSections updated 80k→232k.
   - **ACTION NEEDED (Charlie):** Reset existing EUR-Lex done rows: `UPDATE ingest_queue SET status='pending', "lastError"=NULL, claimed_by=NULL, claimed_at=NULL WHERE corpus='eur-lex' AND status='done';`

2. **FCA Handbook confirmed truly blocked** — Every URL (including /sitemap.xml) returns same JS SPA shell. Explicit "JavaScript disabled" message. No rule text in initial HTML. FCA Publications (fca.org.uk/publications) is a viable V7 corpus but requires scraper build.

3. **LDA Parliament integrated** — 5 datasets confirmed, 799K records across 1,602 queue pages:
   - Commons Oral Questions: 69,852 records (140 pages)
   - Lords Written Questions: 103,137 records (207 pages)
   - Commons Written Questions: 618,599 records (1,238 pages)
   - Commons Divisions: 5,553 records (12 pages)
   - Lords Divisions: 2,089 records (5 pages)
   - `lda-parliament.ts` source client built; `processLda()` added to worker-queue.ts; seeder written.
   - **ACTION NEEDED (Charlie):** Run `seed-lda-queue.ts` after deploy to seed 1,602 queue rows.
   - **ACTION NEEDED (Charlie):** Run `seed-rate-limits.ts` to register `lda-parliament` rate limit (200ms).

4. **CORPUS_MANIFEST updated** — EUR-Lex unblocked (blocked→not blocked), estSections 80k→232k. 5 new LDA entries added at correct priorities. FCA comment updated with V6 confirmation.

### What just happened (3 Jun 2026 V5 — Hansard alternative + blocked sources)

1. **TWFY client built** (`theyworkforyou.ts`): TheyWorkForYou API confirmed accessible from Railway (status 200, needs API key only). Source client + worker route + queue seeder all built. **ACTION NEEDED:** Register for TWFY API key at theyworkforyou.com/api/key, add `TWFY_API_KEY` to Railway env, then run `seed-twfy-queue.ts` (~4,700 monthly rows for Commons+Lords+Westminster Hall).

2. **FCA, ECHR, EUR-Lex blocked in manifest**: All APIs confirmed non-functional from Railway environment. Marked `blocked: true` — will show ⛔ blocked in email instead of ⚠️ failing.

3. **⚠️ failing state added to email**: Sources with queue rows but 0 corpus_sections now show `⚠️ failing` — visible signal that something is broken rather than appearing at 0%.

4. **Scheduler duplicate**: Not a code bug — two Railway deployments running simultaneously. Fix: manually redeploy `ingest-scheduler` in Railway dashboard to kill old instance.

5. **Data access request drafts**: `docs/data-access-requests/bailii-request.md` and `parliament-hansard-request.md` ready to send.

6. **corpus-census.md §8**: 19 sources with "client needed" added, with URLs for future build sprints.

### What just happened (3 Jun 2026 V4 — caselaw diagnosis + silent failure fixes)

1. **Caselaw `getTotalJudgments()` fixed** — TNA feed reports 7,489 pages but pages 1,500+ are empty. Binary-search now finds true last non-empty page (~1,499). We've ingested all ~74,950 available TNA caselaw judgments. `estSections` updated to 75,000.

2. **Silent failures now surfaced** — `processHansard`, `processFca`, `processEchr` now mark 'failed' (not 'done') when 0 items are yielded. Root causes confirmed:
   - FCA: `handbook.fca.org.uk` is a JS SPA — HTML scraping never works. Needs Playwright.
   - ECHR: `/app/query/results` returns 404 — API endpoint changed Jun 2026. Needs new endpoint.
   - Hansard: `api.parliament.uk/v1/hansard` returns 403 from Railway IPs. Written Answers/Statements use a different API that works fine.

3. **Reseed running:** UKPGA pre-1963 (6,897 rows) inserted; UKSI 2010-2026 completed; SSI/WSI enumeration rate-limited at 30s/request — still running.

4. **Queue state:** 5,307 primary-acts-pre-2000 pending rows, workers actively processing. Grand total corpus_sections: 587,128.

### What just happened (3 Jun 2026 Sprint 2 — queue gap seeding)

1. **Queue reset (Part 2):** 6,185 rows reset to pending for corpora with 0 corpus_sections (Hansard, FCA, ECHR, Treaties). Root cause: `api.parliament.uk/v1/hansard` returns 403 from Railway IPs — workers looped over 0 debates and marked rows done. FCA/ECHR similar pattern. Workers will retry on next claim cycle; Hansard API access needs Railway investigation.

2. **Queue reseed (Part 1):** `reseed-si-gaps.ts` run: (A) UKSI 2010–2026 enumeration from TNA (adds ~5k–8k new rows for 2015–2026 gap); (B) UKPGA pre-1963: 6,897 new rows inserted from Neon items with 0 sections; (C) SSI+WSI added to regional corpus. Workers now have 13,082+ pending rows — queue is no longer empty.

3. **Worker efficiency email (Part 3):** `queryWorkerThroughput` extended with sourceKey, efficiency %, and ⚡low/🔴critical flags. Each source has theoretical max adjusted by number of workers sharing the token bucket.

4. **Discovery fix (Part 4):** `TNA_CORPUS_META.regional` now includes ssi+wsi. `discoverTnaLegislation` detects under-seeded corpora dynamically (threshold 400 rows/yr) and triggers full historical scan when needed.

### What just happened (3 Jun 2026 late evening — corpus census sprint)

1. **Census scripts created** (`scripts/ingest/census/`): neon-counts.ts, railway-counts.ts, tna-counts.ts, source-counts.ts. Reusable — re-run quarterly.

2. **Census report written** (`docs/corpus-census.md`): Full findings with Neon vs. new pipeline comparison, gap analysis, source API counts.

3. **CORPUS_MANIFEST estSections updated** (`progress-reporter.ts`): Revised 8 estimates based on confirmed data. Most significant: SI-2010+ 300k→120k, Written Statements 50k→17,487. Total corpus estimate revised from ~7M to ~5.3M sections.

4. **Key action items (status):**
   - ~~SI-2010plus reseed~~ — Done V3 (TNA feed confirms counts were accurate, not a gap).
   - ~~Hansard/ECHR/FCA R2 backfill~~ — V2–V5: confirmed no R2 content. Workers marked done due to API failures (403/404). Hansard addressed via TWFY (V5). FCA/ECHR blocked.

### What just happened (3 Jun 2026 evening sprint)

1. **RangeError fix (Part 1):** `progressBar()` in `progress-reporter.ts` now clamps `pct` to `[0,100]` and `filled` to `[0,barWidth]`. Email sends were crashing every hour since compiled > estSections for some corpora.

2. **Worker throughput in email (Part 2):** Added `queryWorkerThroughput()` and a new "WORKER THROUGHPUT" section in `sendProgressEmail()`. Shows per-corpus sections/hr rate with mini bar, ⚠️ stalled / ℹ️ idle flags, total rate, stalled list. Uses 3-snapshot pivot to distinguish stalled vs idle.

3. **Diagnostics (Part 3):** Queue is exhausted (0 pending, 120 claimed, 61,829 done). Self-discovery is working — just trickle-rate new items now. Snapshot doubling bug (×2 SUM at 11:54 BST) is a one-time Railway restart overlap, not a systematic code bug.

4. **Sprint workflow (Part 4):** Created `docs/SPRINT.md` as the canonical home for CCh sprint briefs. Added sprint brief protocol to `CLAUDE.md` §12.

5. **Part 5 (read-only):** Confirmed Hansard/ECHR/FCA/Treaties have the R2 backfill gap. See CHANGE_LOG for exact counts and key patterns.

---

## IMMEDIATE ACTIONS REQUIRED (for Charlie)

### ONE REMAINING ACTION (Charlie)
- **Manually redeploy workers + scheduler** in Railway dashboard — so running containers pick up the `writeWorkerSnapshot()` call added to worker-queue.ts. Auto-redeploy only fires on new pushes; current containers are still running pre-V7 code. After redeploy, next hourly email will show per-worker throughput.

### V7 (all done ✅)
1. ~~Run `commit-all.sh`~~ — Done (`f912b3a`)
2. ~~`npx prisma migrate deploy`~~ — Done (workerId column applied)
3. Redeploy workers + scheduler — **Charlie to do** (see above)
4. ~~`seed-rate-limits.ts`~~ — Done (16 entries including fca-publications)
5. ~~Format backfill SQL~~ — Done (688 rows fixed)
6. ~~Verification SQL~~ — Done (1,652 pending, 200 claimed, workers active)

### V6b (resolved)
1. ~~Run `commit-all.sh`~~ — Done (`8cc89d9`). Workers stable since 22:07.
2. **Confirm workers stable** — check Railway logs after redeploy. Workers should no longer SIGTERM. Look for `[worker-N] all sources exhausted — sleeping 5min` instead of crash.
3. **Reset EUR-Lex queue rows** after redeploy: `UPDATE ingest_queue SET status='pending', "lastError"=NULL, claimed_by=NULL, claimed_at=NULL WHERE corpus='eur-lex' AND status='done';`
4. **Run `seed-lda-queue.ts`** — seeds 1,602 LDA Parliament queue rows: `NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx --tsconfig scripts/tsconfig.json scripts/ingest/seed-lda-queue.ts`
5. **Run `seed-rate-limits.ts`** — adds `lda-parliament` rate limit: same tsx command, `scripts/ingest/seed-rate-limits.ts`

### V5 (still pending)
5. **Redeploy `ingest-scheduler` on Railway** — kills duplicate deployment causing alternating email formats. Settings → Deployments → Redeploy.
6. **Register TWFY API key** at theyworkforyou.com/api/key (free for civic use). Add `TWFY_API_KEY` to Railway env vars for all workers + scheduler.
7. **Run `seed-twfy-queue.ts`** after key is added — seeds ~4,700 monthly Hansard rows for Commons (1988–), Lords (1988–), Westminster Hall (1999–).
8. **Review data access request drafts** in `docs/data-access-requests/` — BAILII and Parliament Hansard bulk data.

---

## ARCHITECTURE SNAPSHOT (4 Jun 2026 — post V1)

- **20 Railway workers** ingesting via `worker-queue.ts` — queue-claim model with `FOR UPDATE SKIP LOCKED`
- **Scheduler** (`scheduler.ts`) — hourly loop, sends progress email, saves snapshots. **DB-based mutex added (V1)** — duplicate email sends now prevented without needing Railway redeploy.
- **Self-discovery** working — detects under-seeded corpora and triggers full historical scan
- **Corpus coverage:** ~587,128 Railway sections + 914,274 Neon legacy = ~1.5M total (approximately)
- **Hansard:** TWFY client built (needs API key). **MAJOR FIND: `theyworkforyou.com/pwdata/scrapedxml/` has free bulk Hansard XML from 1919 — awaiting CCh review before building client.**
- **LDA Parliament:** 5 datasets integrated, workers processing. `lda-commonswrittenquestions` had 388 HTTP 524 failures — retry fix applied (V1), rows need reset to pending.
- **EUR-Lex:** UNBLOCKED — SPARQL-based enumeration. Workers processing.
- **FCA Handbook:** Confirmed blocked (pure JS SPA). **FCA Publications confirmed accessible (V1 audit)** — source client added (GOV.UK search approach), seed row added.
- **ECHR:** Both APIs dead (api.echr.coe.int connect error, /app/query path 404). No accessible alternative found.
- **TNA Caselaw:** Complete (~74,950 available judgments all ingested).
- **New V1 sources:** nao-reports, fca-publications, sentencing-council, college-of-policing added — seeded and ready.
- **HMRC:** Stuck claimed row (26h) — reset needed (SQL above). Long-term: needs per-source queue split.

## DEPLOYMENT

- Ingest workers: Railway (20 services)
- Scheduler: Railway (1 always-on service — currently 2 running, needs redeploy)
- DB: Railway PostgreSQL (`switchback.proxy.rlwy.net:16156`)
- R2: Cloudflare `scrutinise-legislation` bucket
- Web app: Vercel (scrutinise.org)
