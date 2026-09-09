# CCW-B18 — CC report

**9 September 2026.** Executes `Claude outputs/CCW-B18_CC_BRIEF.md`.
Predictions recorded before the run: `docs/report_run/B18_KERNEL_PREDICTIONS.md`.

---

## ▼▼ The headline, and it changes what §2 should spend

**The four passes that criticise each proposal have never once seen the proposal.**

`kernelText(ideaId)` assembles the string that `SMART`, `KERNEL_CHECK`, `LOGIC_CHECK` and
`ADVERSARIAL` all reason over. It read the canonical `Idea` columns. **A build never writes those.**
`diagnosisPass`, `approachPass` and `actionsPass` write through `setProposal`, which puts the text in
`IdeaFieldState.proposal` at AWAITING_CONFIRMATION and leaves the column alone until a human accepts
the field. `dump-build-kernel.ts`'s own §0 note says exactly this, and warns that a reviewer reading
the columns "would conclude the build produced nothing".

Measured across every idea in the database with a completed build:

| | |
|---|---|
| ideas with a DONE build | 16 |
| with a **complete** kernel in the columns `kernelText` read | **0** |
| with **zero** of the seven kernel columns populated | **15** |
| `rootCause` / `pivotalObstacle` / `summaryDiagnosis` / `chosenApproach` / `summaryGuidingPolicy` / `summaryCoherentActions` populated | **0 of 16 each** |
| the same seven fields present in `IdeaFieldState` | **16 of 16 each** |

So the critique passes were handed a title, a list of causes and a list of actions, and they marked
exactly that — accurately. The Equality Act verdict CCW-B18 §2 quotes — *"This kernel is not a
strategy… It fails to state the problem this repeal would solve, provides no diagnosis of why that
problem exists or persists, and offers no guiding policy to frame the actions"* — is a **correct
reading of an input that was missing all three.** The build had written all three.

⚠⚠ **`SMART` does not merely judge, it rewrites.** M-02 v1 reports *"5 fields rewritten"*. The build
has been revising a drafted kernel to satisfy a critique of an absent one.

**§2 as briefed would have spent 36–48 builds — £30 to £40 and two days — iterating twelve kernels
against a critique that was an artefact of a read path.**

### The fix, and the single-variable measurement that scores it

`kernelText` now takes each field's current wording — its ACCEPTED value where the proposer has
accepted one, otherwise the standing proposal — through a new shared reader, `currentFieldValues` in
`field-machine.ts`. Nothing else changed.

Read cold, before and after, on the same twelve rows:

| | before | after |
|---|---|---|
| measures whose kernel string carries all seven sections | **0 of 12** | **12 of 12** |
| M-02's kernel string | title + 2 causes + 4 actions | **7,453 characters** |

Then the measures re-run with only that changed — same elicitation, same five-stream retrieval, no
critique fed back, so each comparison is single-variable.

**M-02, the Equality Act** — the measure whose failure CCW-B18 §2 quotes:

| | v1 (2 Sep) | v2 (9 Sep) | prediction |
|---|---|---|---|
| `KERNEL_CHECK` | **2 of 9** | **8 of 9** | P-1 said ≥6 — **confirmed** |
| `LOGIC_CHECK` | ⚠ the chain does **NOT** hold, 2 defects | **the chain holds, 0 defects** | P-2 said the two named defects would go — **confirmed, and exceeded** |
| `SMART` verdict | WEAK, 5 fields rewritten | **WEAK**, 3 fields rewritten | P-3 said better than WEAK — ❌ **REFUTED** |
| `ADVERSARIAL` | 6 issues | 6 issues | P-4 deliberately made no prediction |

**M-06, the civil service** — and ⚠⚠ **this one qualifies the result and must be read with it:**

| | v1 (2 Sep) | v2 (9 Sep) |
|---|---|---|
| `KERNEL_CHECK` | **6 of 9** | **6 of 9** — no change |
| `LOGIC_CHECK` | ⚠ does not hold, **1 defect** | ⚠ does not hold, **4 defects** — worse |
| `SMART` verdict | **NOT_A_KERNEL** | **WEAK** — better |

### ⚠⚠ What the two together actually establish, which is not what one alone would

The mechanism is not in doubt: **0 of 16 ideas had a complete kernel in the columns the critique read,
and all twelve now do.** But the effect on the verdicts is **not uniform and not uniformly
favourable.** M-02 gained six marks; M-06 gained none and its logic defects went from one to four.

**So the old verdicts were not harsh — they were arbitrary.** With only a title, some causes and some
actions in front of it, the marker had less to fail as well as less to pass, and M-06's kernel scored
6 of 9 on almost nothing. That is worse than a pessimistic bias, because a pessimistic bias can be
corrected for and an arbitrary one cannot. **The operative conclusion is unchanged and strengthened:
no kernel verdict recorded before 9 September can be fed back into anything, in either direction.**

⚠ **P-3's refutation points the same way.** The holistic critique read the *complete* kernel on both
measures and still says **WEAK**. The kernels do have real weaknesses, and the iteration CCW-B18 §2
asks for is worth doing — against verdicts produced after the fix, and not before it.

⚠ **Not yet running in production.** The Railway `build-worker` has served the same container since 3
September and Railway builds it from the repository, so this reaches production only on the next
deploy. Today's re-runs were driven from this working tree, with the worker's own five-stream
configuration forced, and the local claim verified as winning the race each time.

### ⚠⚠ A fault of mine, and it is the cost of driving builds from two places at once

**M-01 v4 is FAILED at 7 of 11 passes, and I failed it.** Its local driver died (exit 127) mid-run,
leaving the row RUNNING with `SMART` claimed. The Railway worker then picked the pass up at 04:12:06
— on the deployed 3 September code. I tried twice to resume the build locally so the verification
passes would run on the fixed code; both attempts spun on *"pass already claimed by another
request"*, and the build settled FAILED at 04:12:40 with *"stopped making progress at 'Asking whether
any of this is good'"*.

**Nothing drafted was lost** — the seven completed passes stand and the row is resumable — but M-01
has **no kernel number on the fixed path**, and the three thirds are spent. The measurement rests on
M-02 and M-06, which is enough to establish both the effect and its non-uniformity.

⚠ **The lesson is narrow and worth keeping: two drivers must not contend for one build row.**
`b18-run-build-locally.ts` was written to close exactly that race at *claim* time and it does; it has
no answer for a driver that dies *after* claiming, because the row is then visible to the worker
again. Resuming such a row locally while the worker holds a pass does not recover it — it fails it.
**The correct recovery is to let the deployed worker finish the build and discard its verification
numbers, or to enqueue a fresh build. Not to race it.**

---

## §1 — Allowance ✅

`buildAllowanceThirds` **60 → 200**, note `B18 kernel iteration — Restoration Programme second draft
— CCW-B18 §2`. Read back through `readAllowance()`, the function the page calls:
`grantedThirds 200 · grantedExplicitly true · spentThirds 58 · remainingThirds 142`.

⚠ The brief's warning was well founded — an explicit grant already existed (60 thirds, 2 September),
so `LEX_PILOT_ALLOWANCE_THIRDS` would have done nothing and the number would not have shown it.

---

## §3 — M-01 re-run, and the worker guard ✅

**M-01 v3 ran with retrieval confirmed live**, and the difference is visible in the evidence rather
than asserted:

| | v2 (2 Sep, degraded) | v3 (9 Sep) |
|---|---|---|
| evidence rows | 73 | **101** |
| ORIENT retrieved | 48 | **241** |
| RESEARCH | — | 7 questions, 600 sources reviewed, 71 findings |
| retrieval actually reached | not recorded anywhere | **fts +136 · vector +136** |

That last row is the point. A build's own status cannot see its retrieval: v2 reported **DONE, 11 of
11 passes, zero failures** on a configuration where eighteen searches returned nothing.
`scripts/_b18-watch-build.ts` now reads the `served` counters off both services before and after a run
and prints the delta beside the result, so a build that retrieved nothing says so.

**The guard is fixed.** `build-worker.ts` imported `resolvedConfigLine()` — the printer — and not
`assertRetrievalConfig()` — the guard. It now calls the assertion and **refuses to start** under
degraded retrieval. Watched failing before being believed: with `FTS_SEARCH_URL` and
`LEX_VECTOR_STREAMS` removed it exits 1 naming both degradations, which is exactly M-01 v2's
configuration.

⚠ **An escape hatch exists and must be asked for by name.** `LEX_BUILD_ALLOW_DEGRADED_RETRIEVAL=1`
still runs, loudly. A deliberately degraded run is a real thing we do —
`M-01_v2_keyword_only.json` was preserved on purpose — and a guard with no way to say "degraded IS
the measurement" would have made that build impossible rather than careless.

---

## §4 — Instrument links ✅ (five of twelve, and the seven are the finding)

Written to `IdeaLegislation` as `linkType: 'target'`, each carrying the clause of David's own stated
intention that put it there, each read back after writing:

| | |
|---|---|
| M-01 | `ukpga/1998/42` Human Rights Act 1998 |
| M-02 | `ukpga/2010/15` Equality Act 2010 |
| M-03 | `ukpga/2005/4` Constitutional Reform Act 2005 |
| M-07 | `ukpga/1998/11` Bank of England Act 1998 |
| M-11 | `ukpga/2009/25` Coroners and Justice Act 2009 |

**Seven measures have no instrument link and will not get one from this script.** M-04 (around four
hundred bodies, none named), M-05 (judicial review is a common law jurisdiction — there is no Act
conferring it to repeal), M-06 (1854 settlement vs CRAG 2010 Part 1 — a judgement about what the
measure *is*, and Charlie's), M-08 (a complaint about practice), M-09 (self-identification was never
enacted; linking the GRA 2004 would assert it provides for something it does not), M-10 (he names no
instrument), M-12 (the scope is temporal, not a list).

⚠ **This is B14's finding reached from the other end: a programme described throughout as a repeal
programme has seven of twelve measures with no enactment to repeal.**

⚠⚠ **A LINK ALONE CHANGES NOTHING, AND THIS IS WHY THE HEADING WAS STILL EMPTY AFTER WRITING THEM.**
The pass that reads `IdeaLegislation` is a **Deepening** pass, and none of the eleven build passes
touches it — so re-running a build does not fire it. `scripts/b18-run-consequences.ts` runs it
explicitly for the measures that now have a target, and re-reads the written rows rather than
trusting the counter.

**It has now run on all five, and the heading is populated for the first time:**

| | instruments made under it | provision references |
|---|---|---|
| M-01 Human Rights Act 1998 | **41** | 892 in 6 groups |
| M-02 Equality Act 2010 | **74** | |
| M-03 Constitutional Reform Act 2005 | **120** | |
| M-07 Bank of England Act 1998 | **18** | |
| M-11 Coroners and Justice Act 2009 | **64** | |

Total cost **0.09p per measure.** In the panel appendix the five went from **8 of 13 headings filled
to 9 of 13**; *"What else refers to this law"* is no longer empty on any measure that has a target.

⚠ **The two known defects travel into the output rather than being hidden**, as the brief requires:
60 of CRA 2005's 120 instruments quote enacting words that do not name the Act, and `nisr/2010/381`
is a verified misattribution. **The count is never to be printed unqualified.**

⚠⚠ **And the run surfaced a fresh instance of this codebase's recurring enum fault.** The pass
reported *"30,375 rows carry a detection value this build does not know"*. That is GRAPH 5's
`caselaw-markup`, added on 8 September; the consequences reader was written against the three values
that existed before it. It degrades honestly — it says so rather than silently miscounting — but it
is the same shape as the `enabling-power` probe that absorbed 1.29M rows the day a fourth value
appeared. **Reported, not fixed: the reader is Search-owned.**

⚠ **The build prompt half of §4 is NOT built.** The brief asks for a prompt — *"which Act would this
change?"* — writing the link from the answer. Given the distribution above, such a prompt would
resolve the same five and would be under pressure to invent an answer for the other seven, which is
the one thing the consequences pass is explicitly designed to refuse. **Recommendation: ask the
proposer, not the model** — the pass already has the right issue template for it (*"I could not work
out which enactment this proposal changes… Name the Act and I will"*). That is a decision for
Charlie rather than a line of code.

---

## §5 — The citator ✅ run, ⚠ still without an accuracy figure

`docs/report_run/appendices/CITATOR_report_judgments.md`.

| | |
|---|---|
| case-law sources cited across the twelve | **246** |
| …addressable by the citator (carry a neutral citation) | **78** |
| …**NOT CHECKED** — Northern Ireland, Scottish courts, employment tribunals | **52** |
| of the addressable, with a treatment recorded | **1** |
| treatment records in the index | 1,749 |
| of those, **validated** | **1** |

⚠⚠ **It cannot ship with an accuracy figure because the validation set is not scored. One of the
fifteen rows in `docs/GRAPH_5_VALIDATION.md` has a verdict; fourteen are blank.** Every line of the
appendix carries *"the treatment edges are unvalidated; the error rate has not been measured"* until
that changes. **This is the single cheapest high-value thing outstanding — fifteen rows, two verdicts
each, ten minutes, and it unblocks every citator statement in the report.**

⚠ **A defect found on the way, and it would have merged different cases.** `EvidenceItem.citation` on
a case-law row holds the case NAME, not a neutral citation — **0 of 2,244 stored citations contain
one.** The citator is keyed on the citation, and GRAPH 5 measured why: 22,184 case names appear
against more than one citation, mean 2.1 and max 119. A first version of this appendix matched by
name and returned zero, which was a bug rather than a fact; it now bridges through the corpus id,
which begins with the neutral citation.

⚠ **Three states, not two.** The 52 judgments from the NI, Scottish and tribunal corpora were never
put through the treatment extraction, which ran over `tna-caselaw` only. They are reported as **NOT
CHECKED** and are never added to "no treatment recorded" — *looked at and nothing found* and *not
looked at* are opposite facts wearing the same shape.

---

## §6 — The people graph ✅ produced, and it should not be published as a register

`docs/report_run/appendices/POSITION_REGISTER.md`. Built as the brief asks — a candidate list with
the position and the source beside it, never a finding — and the run's own numbers say it cannot
carry a per-measure supporter and opponent table:

| | |
|---|---|
| measures returning **more than one person** | **2 of 12** |
| measures returning **exactly one** | **8** |
| measures resolving to **no target at all** | **2** |

⚠ **The eight singletons are early day motions, and that is the corpus gap rather than a fact about
the measure.** An EDM target can only ever return one name, because we hold the member who *tabled*
each motion and none of the 2,125,547 signatories Parliament publishes. The two measures that return
254 and 189 people are divisions, where the whole voting record is held. **This is the literal cause
of Charlie's "shows up a couple".**

⚠⚠ **And several targets are the wrong subject, which the disclosure line catches.** The arm's-length
body estate resolved to *ADVERTISING STANDARDS AUTHORITY AND RELIGIOUS LIBERTY* on the two words
"advertising standards"; the civil service measure **and** the DEI measure both resolved to the same
motion — *Civil Service pensions* — on the two words "civil service"; charities campaigning resolved
to a motion about publicly funded buildings on "publicly funded". **Ten of twelve targets rest on a
two- or three-word phrase match**, which is 26-A §1's finding reproduced across the whole set.

⚠ **A measurement that sharpens the 44% rather than repeating it.** The extraction produces 37,657
rows, of which 21,461 record *no position*; the remainder is **16,196** — exactly
`SEARCH_CONTRACT.md`'s figure, reached independently here. Of those, the quotation **round-trips into
its own source 98.4% of the time** (15,937 found, 259 not). **So the 44% is an interpretation error
rate, not a fabrication rate.** The quote is nearly always genuinely there; what is unreliable is the
claim that it shows the person holding that position. That decides how to check it: the question to
put to each row is not *"is this quote real?"* but *"does this quote show what it is said to show?"*
— which is why the appendix's second column is the quotation itself rather than a summary of it.

## §8 — The Research panel appendix ✅

`docs/report_run/appendices/RESEARCH_PANEL_all.md` — 2,118 lines, all twelve measures, every heading
with its content. Nobody was sent to screenshot the UI: it calls `buildQuestionPanel`, **the function
`app/api/ideas/[id]/panel/route.ts` serves to the browser**, so if the panel changes the appendix
changes with it.

⚠ **The plan's heading list came from one screenshot and is incomplete, as the plan said.** The
panel's vocabulary is fourteen keys, thirteen live; the screenshot showed eight, three of which
(*Decisions*, *Where the research changed my mind*, *Outputs*) are not research headings at all.

**Two findings fell out of generating it:**

- **Five headings are empty on all twelve measures**: *Your material*, *Where this mechanism works
  elsewhere*, *What's devolved*, *What else refers to this law*, *Cost and duration*.
  *What else refers to this law* is empty because no instrument was linked — **§4 above fixes it for
  five measures.** *Cost and duration* is empty because it is declared as having no producer, which
  is §7. ⚠ ***What's devolved* returning nothing on all twelve is not explained**, and it matters:
  the devolution material in the report was verified by hand against the Scotland Act 1998, the
  Northern Ireland Act 1998 and GoWA 2006 for exactly the measure where this pass found nothing.
- **Between six and eleven sources per measure — roughly ninety-five in total — resolve to no
  heading**, so they are in the data and render nowhere on the panel. They are listed in the
  appendix.

---

## §9 — The limitations section ✅

`docs/report_run/LIMITATIONS_from_CC.md`, written for a Member of Parliament, in the register asked
for: third person, no process, no model names, no "we". Every limit carries the figure that
establishes it. It covers what search reaches and what it cannot, where each record begins, the two
corpus counts that have circulated in larger and wrong versions, the citator and its unmeasured error
rate, the position record and its 44% hand-read error rate, the absent costings, and — stated plainly
— that the tests applied to each proposal were until today reading an incomplete statement of it.

---

## §10 — The fabricated citations ✅ answered

**1. Which Gemini model, at what temperature — NOT ANSWERABLE FROM HERE, and reporting the
repository's configuration would be the wrong answer.** `CROSS_MODEL_SWEEP_PROMPT.md` begins *"paste
this into Grok, ChatGPT and Gemini"*. The sweep was run by hand in chat products; **no service in
this repository made those calls**, so no model id or temperature here describes them. Charlie's
"cheaper tier" hypothesis can only be settled by whoever ran the sweep.

**2. Does any model output reach a build without a verification step? — NO, and this is the
reassuring half.** On every evidence row, `citation`, `url`, `sourceId` and the date are **copied
from the corpus row the finding was drawn from** (`deepening.ts:595`, with an explicit comment that
the date never comes from the model). The model supplies its reading of a source it was shown; it
never authors the reference. The one path by which an outside model can name something the corpus
does not hold is the SMART pass's terms of art, and those are quarantined as stated gaps carrying the
words *"⚠ UNVERIFIED: this is a lead worth following, not a finding, and nothing in the proposal may
cite it."*

**So the five fabrications are a property of the hand-run research channel, not of the product.**

**3. The self-prefilter is added — to the sweep prompt, where the fabrications happened.** ⚠ And the
instructive detail: **a general request to flag uncertainty was already in that prompt when Gemini
produced all five.** A closing sentence is satisfied by a model that is not, in the moment, aware of
being unsure. The requirement is now per item and mandatory, with a stated form, and *"an item with
no certainty label will be treated as unverified"*.

---

## §11 — Backup ✅

**46 files, 12.66 MB**, uploaded to `r2://scrutinise-legislation/research/report_run/` and every key's
size read back. Control key confirmed absent, so the verification can still fail.

The set is derived from `git ls-files --others --ignored`, not listed by hand — the question is "what
is lost if this disk dies", and a hand-written list goes stale the first time somebody adds a file.
It is larger than the brief's 3.1 MB because it includes `builds/` (5.92 MB — the twelve build
exports the second draft is being written from) and both `FIRST_SCRUTINY` deliverables.

⚠⚠ **And a finding: `scripts/starkey/r2-backup.ts` cannot run from this tree at all.** It imports
`@aws-sdk/client-s3` and there is no `node_modules` above `scripts/` containing it — the repository
root holds `dotenv` and nothing else. It dies on MODULE_NOT_FOUND before its first line of work, so
*"the Starkey corpus is backed up"* has been an assumption about an August run that nobody could
re-check. **This run therefore verified those keys too: 857 of 857 present at
`research/starkey/`, correct sizes.** The new script lives in `scrutinise-web/scripts/`, where its
dependencies actually are.

⚠ **35 files under `docs/report_run` are untracked and NOT ignored** — the second draft's own source
`.md` files, including `SECOND_DRAFT_PLAN.md` and the `PART*` sections. They are unprotected by git
and are deliberately **not** in this backup, because they are meant to be committed. Backing them up
silently would remove the pressure to do that.

---

## Not done, and why

- **§7 — cost and benefit. NOT BUILT, but its premise is independently confirmed.** The panel
  appendix shows *Cost and duration* empty on all twelve measures, and `COST_DURATION` is declared in
  `HEADINGS_WITH_NO_PRODUCER` — the block exists and nothing routes into it, exactly as S18 D-4 says.
  The PSED three-absences answer is carried in the limitations section. **Building the route is the
  largest unstarted item in the brief.**
- **§2's remaining nine measures.** Deliberately not run. Every kernel verdict on record predates the
  fix, so the iteration loop should restart from re-run baselines rather than from those verdicts —
  and that is a spending decision worth taking after reading this.

---

## What Charlie is asked to decide

1. ⚠⚠ **Score the fourteen unscored rows in `docs/GRAPH_5_VALIDATION.md`.** Two verdicts each, ten
   minutes. It is the gate on every citator sentence in the report and the cheapest item here.
2. **Should the other nine measures be re-run on the fixed kernel path?** Three thirds each, so
   twenty-seven for all nine, against 130-odd remaining. The old verdicts cannot be fed back in
   either direction, so without a re-run those nine have no usable kernel assessment at all.
3. **M-06's target: the 1854 settlement or CRAG 2010 Part 1?** No link is written until this is
   answered, and the answer decides what the measure *is*. It is the only one of the seven
   unlinked measures where a link is genuinely available.
4. **§4's build prompt: ask the model or ask the proposer?** Recommended: the proposer. Seven of
   twelve measures name no enactment, and a prompt would be under pressure to invent one.
5. **Deploying the kernel fix** needs a commit and a worker redeploy. It is not a build-break, so
   under §12 it is sitting behind the end-of-sprint `commit-all.sh` — **and until it deploys, every
   build a real user runs is still marking an empty kernel.** That is the one item here with a cost
   that accrues daily.
6. **The people-graph register** — publish only the two division-backed measures, or none? It cannot
   support a per-measure table.
7. ⚠ **Unexplained and worth someone's time: *What's devolved* returns nothing on all twelve
   measures**, including the one whose devolution provisions were verified by hand for this report.
