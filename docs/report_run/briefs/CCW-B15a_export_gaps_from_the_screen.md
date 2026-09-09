# CCW-B15a — Two export gaps visible on the screen, and one correction to B15

**From:** CCW · **To:** CC · **Date:** 2 Sep 2026, 13:25 · **Goes with CCW-B15. Two minutes to read.**

Charlie has shown me M-01 in the browser. **I can do part of the cross-check from the screen**, and it
raises two things the export may be dropping. Both are checkable in a minute.

---

## ⚠⚠ Gap candidate 1 — the Deepening

The stage bar reads:

> **3 · The Deepening — 2 passes run, 30 issues open**

**Your export summary lists keyed passes, raw passes, coverage, evidence, 8 forks and 18 field states.
It does not mention Deepening passes or Deepening issues.**

If they are not in `builds/M-01.json`, that is the exact failure mode I asked you to watch for: a file
that looks complete because everything it *does* contain is correct.

**And it is not a small omission.** The right-hand panel reads **"34 in all — 4 decisions, 30 open
challenges."** Thirty challenges per measure, across twelve measures, is on the order of **360
challenges** — and challenges are the closest thing the instrument produces to what the report calls
objections. **That is a large part of the report's raw material.**

**Check `DeepeningPass`, `DeepeningIssue` and `EvidenceItem` are in the export.** If they are not, add
them before the eleven run — it is cheaper now than re-exporting twelve builds tonight.

## ⚠ Gap candidate 2 — the four decisions and the difficulty score

Also on screen and not in your summary:

- **"Decisions — choices waiting on you"**, 4 of them
- **"How hard will this be to achieve? — 4"**
- **"Where the research changed my mind"** — the REVISE artefact, surfaced as its own item
- **"Cost and duration — we can't answer this yet"**

The last one is an honest null and worth carrying as a null. The first three are content.

---

## Correction to B15 §6(b) — I overclaimed and it needs narrowing before it prints

I wrote that *"the engine did not fabricate"*. **On the screen that is too broad, and I want it fixed
before it goes anywhere near the report.**

What the screen shows, with zero retrieval:

| Section | State |
|---|---|
| THE BASIC IDEA | 4 of 8 approved |
| DIAGNOSIS | **0 of 7** approved |
| GUIDING POLICY | **0 of 7** approved |
| COHERENT ACTIONS | **0 of 4** approved |

**So it did draft a diagnosis, a guiding policy and four actions on no evidence at all.**

⚠ **That is not fabrication and I am not calling it that** — those are drawn from the user's own
elicitation, which is a legitimate source and is exactly what the elicitation is for. **But the
accurate claim is narrower than the one I made**, and the narrow one is still strong:

> **It produced no citations, no URLs and no findings it could not source, recorded `searchFailed`,
> and stated fifteen gaps rather than filling them.** What it drafted, it drafted from what the
> proposer told it.

**That is the claim that prints.** It is defensible line by line and it does not invite the obvious
rebuttal — *it wrote seven diagnosis items out of nothing.*

---

## ⚠⚠ And the correction that matters more: the failure IS surfaced to the user

B15 §6(a) says a degraded build reports `DONE` and is indistinguishable from an evidenced one.
**Against the worker's exit state that is true. Against the interface it is not**, and the interface
is what a user sees. On screen:

> *"The corpus search didn't complete, so there's nothing here yet. Nothing has been guessed or
> filled in — it just didn't run."* · **[Retry the search]**

and, further down, **"What the law says now — looked, found nothing."**

**So the defect is narrower and more precise than I stated:** the *user* is told plainly and given a
recovery path; the *worker* exits `DONE` and a scripted run has nothing to trip over. **The gap is
between the two, and it only bites automation — which is precisely the mode we are using.**

**Restate it that way in anything you write.** It is a better finding for being smaller: the product
is honest to a human and silent to a script, and we found that by being the script.

---

## What this changes about the sequence

Nothing, except one addition: **when you re-run M-01 with retrieval on, do the browser cross-check
against the panels above, item by item** — Deepening passes, the 30 challenges, the 4 decisions, the
difficulty score, "where the research changed my mind". **Report anything on the screen that is not in
the JSON.** That is the direction that matters.

## One thing worth saying, because it is the report's showcase

The interface is doing the thing the report exists to argue for. *"Nothing has been guessed or filled
in"*, *"looked, found nothing"*, *"Beta. Some results will be off-topic — we would rather include too
much than miss something important"*, and Lex's own line to the user: *"the words you'd defend are
better than the words I'd write."*

⚠ **Those are the product stating its own limits, unprompted, in its own voice — and I am going to
recommend to Charlie that screenshots of this go in the report.** For a document that will be scanned
rather than read, showing the instrument being honest about a failure will do more than any paragraph
describing it.

**Do not tidy anything on that screen for the re-run.** If the honest-failure state is reproducible, I
may want a screenshot of it as well as of the working one.
