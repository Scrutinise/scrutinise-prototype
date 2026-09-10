# CCW-B22 — the remaining work

**From:** CCW · **To:** CC · **10 September 2026**
**Read with CCW-B21a, whose autonomy boundaries still apply: run these without stopping, within the same limits.**

Seven items. **§1 and §2 are what the report is waiting for.** §7 is a product idea from Charlie that is worth more than the rest put together.

---

## 1. The four tests on the other nine measures

M-03, M-04, M-05, M-07, M-08, M-09, M-10, M-11, M-12. Standalone, so no allowance.

**Export per measure, in the same shape as `critique/B20_CRITIQUE_M-01.md`** — the prompt-size table across builds, the four passes, and the alternatives to `B20_ALTERNATIVES.md`'s pattern. CCW places each beside its own measure in Volume 2 rather than collecting them, so one file per measure matters.

⚠ **Include the repeated-reading figures.** The finding that the nine criteria are stable to within one test while the chain-of-reasoning verdict is not is now printed in the report, and it rests on your measurements. If the other nine behave differently, that changes what the report can say. **Read each at least twice and report the spread**, not a single verdict.

## 2. ⚠⚠ The legislation and judgments schedule — the biggest hole in the report

This was C5 in the original plan and has never been built. Charlie opened Volume 3 expecting to find it.

**Per measure: every provision the measure touches, with citation and link; every judgment, with citation, court, date and holding.**

The route is the instrument-linking pass — the one that produced 120 instruments and 840 provision references in 5.8 seconds for a twentieth of a penny on a single Act. It fires on one idea only because only one idea has a linked instrument. **Link the other eleven and run it across all twelve.**

⚠ **Print the counts honestly, as that pass already knows how to.** On the Constitutional Reform Act the enacting words of 60 of the 120 instruments do not name the Act, and `nisr/2010/381` is a confirmed misattribution. The form to use is *"120 instruments identified as made under the Act; the enacting words of 60 do not name it, and one is a confirmed misattribution"* — never 120 unqualified.

Output to `docs/report_run/appendices/LEGISLATION_AND_JUDGMENTS.md`.

## 3. Railway — Charlie's action, still outstanding

**Railway → `build-worker` → Settings → Source → connect the repo.** `repoTriggers` is 0 where every sibling has 1. CC cannot do it: the mutation returns Bad Access to a project token. Until it is done the worker is deployed by hand every time.

## 4. The seam pattern — stop fixing instances and go looking

Seven times now, correct data has been discarded at a boundary: the kernel read from empty columns, the exporter printing columns a row does not have, the position register's header contradicting its own database, the renderer premise that turned out to be measured at zero. **The eighth exists.**

**Sweep for it rather than waiting for it.** Every place where one component restates what another produced — a header written by hand over generated rows, a column list hard-coded against a shape that has changed, a count computed in two places. The test is whether the producer and the consumer would still agree if the producer changed today.

## 5. The sweep holds everything in memory

The transcript sweep held all 4,003 hits before collapsing them, and the run was killed under memory pressure while a 3.9 MB appendix and a 4.2 MB JSON were being written. Nothing was lost. **It will bite when the corpus grows.** Collapse as it goes, or write through.

## 6. The cost route — still unbuilt, and now the last structural gap

`COST_DURATION` is empty on all twelve; `costSummary` is starved; 0 of 119 coherent actions carry a cost range. The report prints *"This module has not yet been run for this proposal"* twelve times, which is honest and is not a substitute.

**Two parts, and only the first is code.** Build the route so a coherent action can carry a cost range. Then, separately, Charlie's decision: **the module is to be widened to cover human costs and benefits, not only financial ones.** Until it is, the heading stays "Cost and benefit" — ⚠ do not rename it to anything promising a cost-benefit analysis while it attempts only the money.

## 7. ⚠⚠ The idea that should change the product

Charlie's words, and they are a specification rather than a comment:

> **Identifying things that need their own idea-project is a valid output from an idea. It's not an ever-flowing hierarchy.**

Working the Human Rights Act measure produced nineteen rights, of which five cannot be resolved inside that measure: each needs its own analysis of whether the protection survives repeal elsewhere, is abandoned, or is re-enacted. At present the system has nowhere to put that. It either swallows the question, or it inflates the parent idea trying to answer it.

**What to build: a pass that can emit a spawned idea.** Given a proposal, it identifies the questions that cannot be settled within it and writes each as a new idea with a title, the question, and a link back to the parent — not analysed, just named and queued.

**Why this matters beyond this report.** It is the difference between a tool that produces a document and a tool that produces a work programme. A legislator reading "five of these need their own analysis, here they are, they are on the list" is being handed something they can staff and sequence. A legislator reading a single long document is being handed homework.

⚠ **And the constraint is Charlie's too: it terminates.** A spawned idea is named and queued, not automatically worked. Nothing recurses without a person asking for it.

---

## Still parked

**The build-row lease.** It needs a schema column on production. Now that the other sessions are quiet it can be taken, but take it alone and ship the schema and the migration together.

## What CCW has done, so nothing collides

Volume 2 now carries, inside the Human Rights Act measure: the nineteen Schedule 1 rights with a first-pass verdict on each, three illustrative clauses, and the operational actions the coherent actions omit. **CCW writes only to `docs/report_run/report_src_v2/` and the built PDFs.** Commit them by explicit path if you are committing; do not edit them.
