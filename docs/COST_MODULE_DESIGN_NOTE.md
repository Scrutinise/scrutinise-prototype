# The cost module — what it is, what it is not, and what it must not be called yet

**CCW-B22 §6. Written 10 September 2026 by CC.**

> ⚠⚠ **UPDATED THE SAME DAY: THE ROUTE IS NOW BUILT.** This note was written when it was not, and
> the sentence that stood here — *"the cost route is NOT BUILT"* — is exactly the kind of claim this
> project has spent three sprints finding stale in other people's files. `lib/lex/cost-route.ts`
> exists, has run across all twelve measures, and its output is `appendices/COSTS.md`.
>
> **What has NOT changed is everything below about the heading.** The route is financial only, so
> the constraint stands untouched and is now enforced in code: `costKindOf()` returns
> `FINANCIAL_ONLY` and the appendix prints `COST_KIND_CAVEAT` above its first table.

---

## Charlie's decision, in his words

> **"Cost and benefit for now, but upgrade to include human cost and benefit going forward."**

Two parts, and only the second is code:

- **Now:** the printed heading is **"Cost and benefit"**. Duration stays, but as one of the workings
  inside the section rather than in the heading. CCW has already changed it in the report.
- **Going forward:** the module itself is widened so it covers the **human** costs and benefits and
  not only the financial ones.

## ⚠⚠ The constraint, and it is the important half

**Do not rename the module in the product to anything promising a cost-benefit analysis until it
actually attempts the human side.**

Its own definition currently says it gives *"a purely financial view, which leaves out the human
costs and benefits entirely"*. A heading claiming more than the module delivers is the same defect
as a count presented as complete — and this project has now recorded that defect in seven other
places. **When the module is widened, the heading widens with it. Not before.**

## What is actually there today — measured, 10 September 2026

| | |
|---|---|
| `LexCoherentAction` rows | **135** |
| …carrying at least one cost line | **1** |
| `CostLine` rows in total | **1** |
| `CostBenchmark` rows | **53** |
| Ideas with a `costSummary` | **4** of 116 |
| `EvidenceItem` under `COST_DURATION` | **0** |

⚠ **This corrects the brief's figure in two ways, both small and both worth having right.** It says
*"0 of 119 coherent actions carry a cost range"*; measured it is **1 of 135**. The one is not a
rounding error to ignore — it means the write path has executed at least once and is therefore
demonstrably reachable, which is a different starting point from a path that has never run.

⚠⚠ **And 53 `CostBenchmark` rows already exist.** The reference data a costing would be built
against is in the database and unused. Whoever builds this should start by reading those rather
than by gathering new ones.

## Why the report prints "This module has not yet been run for this proposal" twelve times

Because it has not been, and that sentence is honest. **It is not a substitute for the route**, and
it should not be softened into something that implies a costing was attempted and found nothing.

`COST_DURATION` is also deliberately absent from `HEADINGS_WITH_NO_PRODUCER` in `heading-map.ts`,
and the note there explains why: it renders as `no-producer` — our gap, in amber, saying we owe the
user something — rather than as *"we looked and found nothing"*, which would be a false statement
about the world made to cover a hole in our tooling.

## ⚠ What the first real run showed, which the design did not anticipate

**Two things, both worth having before anyone reads the numbers.**

1. **`FRICTION` is used, but rarely — and I nearly published that it was never used.**

   ⚠⚠ **That claim came from a one-measure pilot and was wrong.** Across all twelve the category
   split is `IMPLEMENTATION` **58**, `FRICTION` **6**, `ENFORCEMENT` **4** of 68 lines. So the prompt
   does reach it; it reaches it about one line in eleven.

   Generalising a pass's behaviour from a single measure is the same error as quoting one
   `LOGIC_CHECK` verdict, and I made it in the document warning about exactly that. **The real
   finding is the imbalance, not an absence:** 85% of costed lines are the cost of *doing* the thing,
   and compliance cost — what a duty on four hundred bodies costs those bodies — is six lines across
   the whole programme. If that matters to the report it needs its own question, not a warning inside
   a general one.
2. **The actions list carries duplicates across build versions.** M-01 has 16 coherent actions, and
   on the pilot the pass identified twelve as duplicates of four — *"draft and introduce a Bill"*
   appears under three near-identical wordings from three builds. **Any count of "actions" in the
   report is counting build revisions, not distinct work**, and that is a defect one layer above the
   costing.

3. ⚠⚠ **AND THE PASS IS NOT DETERMINISTIC, VISIBLY SO.** The same twelve actions on M-01 produced
   **4 cost lines with 12 declined** on the pilot and **13 lines with 3 declined** on the full run.
   Same input, same prompt, same model. It is not that one run is wrong — it is that *how much of a
   proposal is judged costable* moves between runs, which is a far less comfortable instability than
   a number moving inside a range. **A costing quoted from one run states an arbitrary fraction of
   the work.** Run it more than once and report the spread, exactly as with `LOGIC_CHECK`.

## What building it required

1. **A producer.** Something has to write `CostLine` rows against a `LexCoherentAction`. Today one
   row exists across 135 actions, so the schema and the write path are proven and nothing drives
   them.
2. **A basis on every line.** `CostLine` already carries `basis`, and the existing renderer prints
   `(basis: NOT STATED)` when it is null — a cost with no basis is a number somebody will quote.
3. ~~**`COST_DURATION` joins the producer set** at the moment a producer exists.~~
   ⚠⚠ **THIS WAS WRONG WHEN I WROTE IT, AND BUILDING THE ROUTE IS WHAT SHOWED IT.**

   `headingsWithProducers()` asserts *a producer exists for that heading*, and the panel feeds
   `COST_DURATION` from `EvidenceItem` rows carrying `headingKey = 'COST_DURATION'` — of which there
   are still **0**. The route built here writes `CostLine` rows attached to a `LexCoherentAction`,
   which is **a different surface**: the proposal document, not the question panel.

   So adding `COST_DURATION` to that set would tell the panel a producer exists where none does, and
   the heading would flip from *"our gap, in amber"* to *"we asked and found nothing"* — **a false
   statement about the world, made to cover a hole in our tooling, which is the exact failure the
   note in `heading-map.ts` exists to prevent.** It stays out.

   ⚠ The real question this exposes: **should the costing appear in the panel at all?** If it should,
   something has to write evidence rows under that heading, and the route above does not. That is a
   second decision, and it has not been made.
4. **Then, and only then, the heading question.** Widening to human costs and benefits is a change
   to what the module attempts, and the heading may follow it.

## The trap to avoid

A financial-only module under a "cost and benefit" heading will be read as a cost-benefit analysis
by every reader who does not open the definition. **The heading is a claim. Keep it behind the
capability, not ahead of it.**
