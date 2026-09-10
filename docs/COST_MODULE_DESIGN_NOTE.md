# The cost module — what it is, what it is not, and what it must not be called yet

**CCW-B22 §6. Written 10 September 2026 by CC. This is a design note for whoever builds the
route, not a record of work done: ⚠ the cost route is NOT BUILT.**

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

## What building it requires

1. **A producer.** Something has to write `CostLine` rows against a `LexCoherentAction`. Today one
   row exists across 135 actions, so the schema and the write path are proven and nothing drives
   them.
2. **A basis on every line.** `CostLine` already carries `basis`, and the existing renderer prints
   `(basis: NOT STATED)` when it is null — a cost with no basis is a number somebody will quote.
3. **`COST_DURATION` joins `HEADINGS_WITH_NO_PRODUCER`** at the moment a producer exists, and not
   before. The check that went red when `POSITIONS` left that set is the model: the red was the
   honest signal.
4. **Then, and only then, the heading question.** Widening to human costs and benefits is a change
   to what the module attempts, and the heading may follow it.

## The trap to avoid

A financial-only module under a "cost and benefit" heading will be read as a cost-benefit analysis
by every reader who does not open the definition. **The heading is a claim. Keep it behind the
capability, not ahead of it.**
