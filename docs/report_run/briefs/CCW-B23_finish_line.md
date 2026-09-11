# CCW-B23 — the finish line

**11 September 2026. This supersedes everything outstanding in B21a and B22. Charlie wants the report finished and is watching cost.**

**Five jobs. Run them one at a time, in this order, in a single session.** Parallel sessions multiplied yesterday's cost because each one re-reads the repository. Nothing here needs a second session.

⚠ **Do not start anything not on this list.** The spawned-idea pass, the build-row lease, the cost-module widening and any further exploratory pass are all deferred until Charlie says otherwise. They are good ideas and they are not what finishing looks like.

---

## 1. Re-run the opponent pass twice more, and report the spread

**The 49-routes figure cannot be printed off one run of a pass that is not deterministic.** That is the error the report spends two pages warning about, and "49 routes, none closed" is exactly the sentence that will be quoted back.

Run it twice more across the twelve. Report, per run and combined:

- the total number of routes found
- the split across closes / partly / does not close / makes it worse
- **how much the categories moved between runs**
- how many measures had every route open, each time

**If "closes: 0" holds across three runs, that is publishable and it is the most important finding in the report.** If it moves, the report prints the range and says the measurement is unstable. Either outcome is usable. A single run is not.

Output to `docs/report_run/critique/OPPONENT_three_runs.md`.

## 2. De-duplicate every count

M-01's sixteen "actions" are twelve duplicates of four, across build versions. **That means every action count in the report is a count of build revisions rather than of actions.**

- Give a true, de-duplicated count of coherent actions per measure.
- **Check whether the same collapse applies to the evidence counts, the challenge counts and the provision counts.** If it does, say which figures in the report are wrong and by how much.

This is a correctness fix, not an improvement. Output to `docs/report_run/COUNTS_corrected.md`.

## 3. Verify four quotations against the corpus

The report quotes these from secondary sources. The case-law corpus holds the judgments; confirm each is accurate and give the paragraph number, or say it cannot be found.

| Case | Quotation to check |
|---|---|
| *R (Osborn) v Parole Board* [2013] UKSC 61 | that analysis should not "begin and end with the Strasbourg case law"; and that Convention rights are at a "very high level of generality" needing "a substantial body of much more specific domestic law" |
| *Kennedy v Charity Commission* [2014] UKSC 20 | Lord Mance: "the natural starting point in any dispute is to start with domestic law" |
| *Kennedy*, same case | Lord Toulson: "a baleful and unnecessary tendency to overlook the common law"; and that it was not the Act's purpose that "the common law should become an ossuary" |
| *R (Jackson) v Attorney General* [2005] UKHL 56 | Lord Hope: "Parliamentary sovereignty is no longer, if it ever was, absolute"; Lord Steyn on an attempt "to abolish judicial review"; Baroness Hale on treating "with particular suspicion" an attempt to remove governmental action from judicial scrutiny |

⚠ **This matters because a reputable chambers source already gave the wrong Act name once in this project.** These four quotations carry the central argument of Part 4.1.

Output to `docs/report_run/QUOTE_CHECK_B23.md`.

## 4. The legislation and judgments schedule

**The last missing section.** Per measure: every provision the measure touches, with citation and link; every judgment, with citation, court and date.

The route is the instrument-linking pass. It fires on one idea only because only one has a linked instrument — link the other eleven and run it across all twelve.

⚠ Print counts in the honest form the pass already knows: *"120 instruments identified as made under the Act; the enacting words of 60 do not name it, and one is a confirmed misattribution."* Never the bare number.

Output to `docs/report_run/appendices/LEGISLATION_AND_JUDGMENTS.md`.

## 5. Hand back and stop

One report at `docs/report_run/B23_REPORT.md` covering all four, plus the CHANGE_LOG entry. **Then stop and do not begin anything else.**

---

## What CCW does with each of these

| CC delivers | CCW places it |
|---|---|
| §1 the three-run spread | Rewrites Part 6.1's headline finding with the range |
| §2 the corrected counts | Fixes every affected figure across all three volumes |
| §3 the quote check | Corrects or removes any quotation that fails |
| §4 the schedule | Becomes Appendix F in Volume 3 — the section Charlie opened Volume 3 expecting to find |

**After that the report is finished.** Nothing else on any previous list is required for a send.

---

## Standing rules, unchanged

- Explicit file paths on every commit. No `git add -A`.
- After any deploy, read `meta.commitHash` — never the status, never the deployment id. And for `build-worker`, confirm the container prints `retrieval configuration OK`.
- Never sum the detection types. Never present a count as complete. Never say a provision or case is "no longer good law".
- Findings go to disk in `docs/report_run/`, not into chat.
- ⚠ **Cost is now a constraint Charlie is watching.** One session, sequential jobs, no speculative runs. If a job looks like it will take more than about twenty minutes of reasoning, stop and say so rather than continuing.
