# CCW-B23 — the finish line

**From:** CC · **To:** CCW · **11 September 2026, 16:30 UTC**

| Job | Status | Output |
|---|---|---|
| §1 Opponent pass, twice more, and the spread | ✅ **"closes: 0" holds across three runs — 143 readings, none closed** | `critique/OPPONENT_three_runs.md` |
| §2 De-duplicate every count | ✅ **Actions collapse; challenges collapse; evidence, provisions and judgments do not** | `COUNTS_corrected.md` |
| §3 Four quotations against the corpus | ✅ **All four verbatim, with paragraph numbers** — ⚠ one checked outside the corpus, which holds no UKHL at all | `QUOTE_CHECK_B23.md` |
| §4 The legislation and judgments schedule | ✅ **All twelve linked and run; the schedule prints whose naming each instrument is** | `appendices/LEGISLATION_AND_JUDGMENTS.md` |
| §5 Hand back | ✅ this report + CHANGE_LOG + handoff. **Nothing else started.** | |

⚠ Housekeeping first: the file that was at `docs/report_run/B23_REPORT.md` was yesterday's B22-continued
report (Railway, the opponent's first run, the cost route). It is now `B22_CONTINUED_REPORT.md`, and the
two references to it in the CHANGE_LOG and handoff are repointed. This file is the B23 report.

Charlie, mid-session: *"Ignore the cost constraint in the brief, just keep running till this brief is
complete."* Done in one session, sequentially, as the brief asked; no speculative runs.

---

## §1 — The opponent pass, three runs

Two more unhinted runs across the twelve (`--run 2`, `--run 3`; `gemini-2.5-pro`, same prompt, same
inputs, ~7 minutes each; 87,792 tokens in on every run — the prompts are identical — and 35.7k / 39.4k / 39.9k out). Per-measure exports at
`critique/B23_OPPONENT_M-XX_run2.md` / `_run3.md`; the 10 September run is untouched.

| Run | Routes | closes | partly | does not close | makes it worse | Measures with every route open |
|---|---|---|---|---|---|---|
| 1 (10 Sep) | 49 | **0** | 5 | 33 | 11 | 7 |
| 2 | 47 | **0** | 4 | 35 | 8 | 8 |
| 3 | 47 | **0** | 3 | 33 | 11 | 9 |

**▶▶ "closes: 0" holds across all three runs.** 143 route readings, and not one was judged fully closed
by the plan. That is the finding Part 6.1 can print, and it is the most important one in the report.

**What moves, and how much:**

- Routes found: 47–49. Partly: 3–5. Does not close: 33–35. Makes it worse: 8–11. Open routes (the last
  two together): 44 / 43 / 44 — 90–94% of what the opponent raised.
- Measures with every route open: 7 / 8 / 9 of 12. **Three are all-open in every run: M-02, M-03, M-09.**
  Every one of the twelve was all-open in at least one run.
- Route by route: pairing run-1 routes with runs 2 and 3 by mechanism and title overlap found a partner
  for 45 of 98 attempts; **35 kept their verdict, 10 moved** — and every move was between *partly*, *does
  not close* and *makes it worse*. **No paired route moved into *closes* on any later run.** The other 53
  attempts found no pair: the later run described a different attack in different words, which is itself
  the measure of how much the pass's *wording* moves even where its verdicts do not.
- The common-law migration (Osborn / Kennedy / UNISON), unhinted: named on M-01 in **all three runs**, on
  M-12 in runs 1 and 2, on M-05 in run 2 and M-03 in run 3. The finding B22 made on one run holds.

**The form for the report:** *"Across three runs of the prepared-opponent pass, 47–49 attack routes were
raised against the twelve measures and the plan fully closed none of them; 3–5 were judged partly closed
and 8–11 made worse by the proposal as drafted. Three measures (M-02, M-03, M-09) had every route open on
every run."* The range is the measurement; the zero is stable.

⚠ Every `restsOn` citation in all three runs still needs checking before it is quoted. Three runs agreeing
on a verdict says nothing about whether the authority a route rests on exists.

⚠ A defect of my own, fixed: the `--run` flag I added wrote the per-measure files correctly but my edit to
the index write did not apply, so run 3's index overwrote run 1's `B23_OPPONENT_INDEX.md`. Restored from
HEAD; the per-measure files were never at risk and the spread is computed from those. The script now
suffixes the index and writes a JSON record per run.

## §2 — De-duplicate every count

`COUNTS_corrected.md`, from `scripts/b23-counts.ts`, read off the database with the report's printed
figures copied in beside them.

**The mechanism.** `LexCoherentAction` has no `runVersion`; every build APPENDS four actions to the idea
and `b14-export.ts` exports every row. `DeepeningIssue` HAS a `runVersion` but the export ignores it and
exports every issue on the idea. `EvidenceItem` has one and the export honours it. So:

| surface | collapses across builds? | what the report prints |
|---|---|---|
| actions | **yes** | **§4.1 prints 8; the true count is 4** (v1's four then v2's four — the chapter describes v2, so steps 5–8 are its). Every other chapter prints one build's count. 67 rows across the twelve → **47 true**; the report's total is 51. |
| challenges | **yes** | **§4.1 prints 89 = v1's 30 + v2's 59.** The build the chapter describes raised 59; the build M-01 now stands on (v4) raised 49. Every other chapter's figure is one build's. |
| evidence | no | scoped by the export; every printed figure matches exactly one build's rows |
| contradicting findings | no | same |
| provisions / judgments "retrieved and read" | no | the report's rule, reverse-engineered and exact on four measures: distinct CITATIONS among that build's rows of that source type |
| causes | no — a re-run REPLACES them | M-01 and M-06 print the superseded build's count (3); the current builds hold 2 each |

**Within a single build there are no duplicates on any surface** (normalised-text check, all twelve).

⚠ **A second thing the same check found:** three chapters describe builds that have been superseded.
**§4.1 (M-01) describes v2; the measure stands on v4. §4.2 (M-02) and §4.3 (M-06) describe v1; both stand
on v2** (the 9 September kernel-fix re-runs). Every B22/B23 pass — critique, opponent, and the schedule
below — read the current build. The figures are right for the build they describe; they are not the
figures of the build the rest of the report's analysis was done on. That is CCW's call: re-draft the three
chapters from the current exports, or say in each which build it describes.

⚠ **And it reached one of my own appendices.** The B22 `LEGISLATION_AND_JUDGMENTS.md` judgments query had
no version filter: M-01 listed 22 judgments where its v4 build holds 12. Fixed in §4 below, and the count
now says *"12 (build v4; 22 across all builds, not listed)"*.

The one-line producer fix — scope `deepeningIssues` to `build.version` in `b14-export.ts` — is NOT made:
re-exporting would change the twelve files CCW drafts from, and the brief says start nothing else.

## §3 — Four quotations against the corpus

`QUOTE_CHECK_B23.md`, from `scripts/b23-quote-check.ts`. Judgment text read from R2 by neutral citation,
never by case name; every quoted fragment searched separately so each can fail on its own.

| Quotation | Result | Paragraph |
|---|---|---|
| *Osborn* [2013] UKSC 61, Lord Reed — "begin and end with the Strasbourg case law"; "very high level of generality"; "a substantial body of much more specific domestic law" | ✔ verbatim | [63]; [55]; [55] |
| *Kennedy* [2014] UKSC 20, Lord Mance — "the natural starting point in any dispute is to start with domestic law" | ✔ verbatim | [46] |
| *Kennedy* [2014] UKSC 20, Lord Toulson — "a baleful and unnecessary tendency to overlook the common law"; "the common law should become an ossuary" | ✔ verbatim | [133] |
| *Jackson* [2005] UKHL 56 — Lord Hope "no longer, if it ever was, absolute"; Lord Steyn "to abolish judicial review"; Baroness Hale "with particular suspicion" | ✔ verbatim | [104]; [102]; [159] |

All four are accurate and attributed to the right judge; the speaker column is read off the nearest
preceding judgment heading, not assumed.

⚠⚠ **The corpus holds no House of Lords judgments at all.** `tna-caselaw` is 74,896 rows across EWHC,
EWCA, UKFTT, UKUT, EWFC, UKSC, EAT, EWCOP, UKPC and others — **0 UKHL**. *Jackson* could not be checked
against the corpus; it was checked against the House of Lords' own publication on
publications.parliament.uk, read through the Internet Archive (capture of 9 Nov 2021) because the live
site is a Cloudflare challenge to a plain fetch and BAILII is the same. The route is named in the output.
**Any Lords authority before October 2009 is outside the corpus** — Part 7's limitations should carry that
wherever the report leans on one.

⚠ Small: the compiled corpus text of *Kennedy* has dropped the lead judgment's heading ("LORD MANCE (with
whom Lord Neuberger and Lord Clarke agree)"), which TNA's own XML carries before the Index. Noted in the
output; paragraphs 1–101 are Lord Mance's.

## §4 — The legislation and judgments schedule

The brief's premise was stale — five measures already had a linked instrument and the consequences pass
had run on all five (B18 §4, B22 §2). The seven B18 refused are the question. B18's rule was *"never name
an instrument David did not name"*; the brief asks for all twelve.

**The route that keeps the rule:** the seven are linked to the enactment **the build's own drafted kernel
names** — the legal landscape, chosen approach and coherent actions Lex drafted from his words — and every
link says so in capitals in its `notes`, with a grade for how far the draft *targets* the Act as against
naming it as the framework it works within. `scripts/b23-link-instruments.ts`, ten links, each read back:

| Measure | Instrument | Grade |
|---|---|---|
| M-04 | Public Bodies Act 2011 | the draft proposes to use and extend it |
| M-05 | Judicial Review and Courts Act 2022 | ⚠ named as the framework only — the draft's instrument is a new ouster Bill |
| M-06 | Constitutional Reform and Governance Act 2010 | the draft proposes to repeal Part 1 (the 1854 settlement is not an enactment, so this is the only linkable candidate — B18 left the choice to Charlie) |
| M-08 | Equality Act 2010 | the draft narrows s.149 through guidance |
| M-09 | Equality Act 2010 | the draft amends it / issues guidance under it — ⚠ the GRA 2004 is deliberately NOT linked, per B18 |
| M-10 | Charities Act 2011 | ⚠ named as the framework only — the draft's instrument is grant conditions |
| M-12 | HRA 1998 · CRA 2005 · FOIA 2000 · Scotland Act 1998 | the four the draft names; ⚠ the measure's scope is a date range, not this list |

The consequences pass then ran on the seven (0.07–0.10p each; M-12 read three of its four — the pass caps
at `MAX_INSTRUMENTS = 3`; ⚠ M-06's pass claimed runVersion 1 while its build is v2, so its rows sit under
v1). The schedule is regenerated across all twelve — 20,435 lines — and now:

- prints **whose naming** on the first line of every instrument, and in the at-a-glance table;
- carries more than one instrument per measure (M-12's four);
- scopes the judgments to the build the measure stands on (the §2 fix), saying how many exist across all
  builds;
- reads the **court** off the neutral citation in the source id — `UKSC`, `EWHC (Admin)`, `EWCA Civ`,
  `NICA`, `CSOH`, `ECtHR` — and prints `—` where there is none, never inferring it from a name;
- keeps every count in the qualified form: *"37 instruments identified as made under the Public Bodies
  Act 2011, from 51 enabling references; 49 SIs reference it in total and the enacting words of 12 of
  them do not name it"*, the misattribution still marked, the detection kinds never summed.

⚠ **Two of the seven links are weak by construction and say so** (M-05, M-10): the schedule for them is
the statute book's references to the law the measure would operate *around*, not the law it would change.
Printing them as if they were David's targets is the thing the provenance line exists to prevent.

---

## What is CCW's

1. **Part 6.1** — the three-run form above. The zero is stable; print the ranges.
2. **§4.1's two figures** — actions 8 → 4, challenges 89 → 59 (or 49 for v4).
3. **Which build §4.1, §4.2 and §4.3 describe** — say it, or re-draft from the current exports.
4. **Part 7** — the corpus holds no UKHL; any pre-2009 Lords authority is checked outside it.
5. **Appendix F** — the schedule, with the "whose naming" caveat carried into the volume's own words.

Nothing else was started. The spawned-idea pass, the build-row lease and the cost-module widening are
untouched, as instructed.
