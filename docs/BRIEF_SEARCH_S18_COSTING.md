# BRIEF — SEARCH S18: THE COST AND BENEFIT BLOCK

**For:** CC-Search
**Written:** 7 September 2026, by CCh-Search
**Executes:** Charlie's decision of 7 September — a costing capability that appears as a **standard
block in every new idea**
**Pairs with:** `BRIEF_INGEST_IMPACT_NUMBERS.md`, which supplies the structured figures
**Format:** audit-then-build. No git during the sprint; one **`commit-search-s18.sh`** at the end.
Scoped commits by explicit path. `SEARCH_CONTRACT.md` updated in the same commit as any capability
change.

---

## §0 — THE TWO QUESTIONS, AND WHY THEY ARE DIFFERENT

**Charlie's requirement, verbatim:** answer *"what is this proposed legislation going to cost against
its likely benefits"* and *"what has been the cost of the Public Sector Equality Duty to date"*, and
**make it a standard block in all new ideas.**

Those are opposite directions and need different material:

- **Forward** — a proposal that does not exist yet. There is no assessment of it. The only honest
  answer is **what comparable measures were predicted to cost, whether those predictions were ever
  checked, and what the benefits side looked like.**
- **Backward** — a measure in force. The answer is a **chain of four states**: what was predicted,
  what was reviewed, what has been measured, and — usually — **that nobody has established the
  outturn.**

⚠⚠ **For the Public Sector Equality Duty the honest answer is almost certainly "nobody has ever
measured it."** That is not a gap to apologise for. **It is the most valuable sentence this platform
can produce**, and it is unavailable anywhere else. §3 exists to make sure it is said with evidence
rather than by silence.

---

## §1 — FIX THE ROUTING FIRST. IT IS NOT A SEARCH-QUALITY PROBLEM.

Impact assessments are the worst-performing collection we have: **11% on the first honest baseline**,
and on the validated set they **find 4 of 9 and display 0 of 9** — S16 classified those as
**NOT-ROUTED**. The right stream is never searched.

⚠ **`LEX_ROUTER_STREAMS_V2` is not the answer and was measured as a regression** (32 → 29): with more
streams the router became *more* selective, and 34 of 64 questions routed to a single stream against
20 before. **Do not simply enable it.**

**Audit, then fix the narrow thing:**

1. For each of the nine impact-assessment questions, print **which streams the router chose and why**.
2. Establish whether the failure is the router's stream selection, the tier the collection sits in,
   or the scope of the stream that should own it. ⚠ **These have different fixes and S11 measured that
   a tier move costs nothing while an extra retrieval leg is zero-sum inside its stream.** Say which
   this is, with numbers.
3. Fix it, flag-gated, default off, and **measure the effect on the collections already in the
   receiving stream** — not by analogy.

▶ **Nothing else in this sprint matters if the collection cannot be reached.**

---

## §2 — A COSTING RETRIEVAL JOB

`PRECEDENT` already assembles three legs around one instrument — intended, predicted, observed —
deterministically, not ranked, with an explicit sentence where no review exists. **The costing block
is a specialisation of that, not a new thing.** ⚠ **Extend it; do not build a parallel assembler that
will drift.**

**What the job returns, per measure:**

- the **predicted** figures from `BRIEF_INGEST_IMPACT_NUMBERS.md` §2 — cost and benefits, with the
  **price base year** attached;
- the **review**, if one exists, and what it found;
- the **official statistics series** that bear on the subject — the catalogue is live
  (`LEX_STATS_STREAM=true`), and ⚠ **the layer structurally cannot return a number: it says which
  measurement exists, and values are fetched by exact call.** Keep that boundary.
- **comparable measures** for the forward question. ⚠ For now, comparable **by subject and sector**.
  Comparable **by mechanism** — the same lever used elsewhere — is the mechanism graph and is not
  built. **Say which kind of comparison the block is making**; a user told "similar measures" will
  assume the second.

⚠⚠ **Three rules the block enforces, each of which would otherwise produce a confident wrong answer:**

1. **A prediction is never rendered as an outcome.** Where no review exists, the block says nobody has
   checked. `PRECEDENT` already defaults to *predicted* for exactly this reason.
2. **Figures from different years are not comparable without their price base year.** Either show the
   base year with every figure, or deflate and say you did. **Never silently mix them.**
3. **"Not monetised" is not zero.** A measure whose benefits were never quantified must not read as a
   measure with no benefits. This is the single most likely way for the block to be systematically
   unfair to good legislation.

---

## §3 — THE BLOCK ITSELF, AND WHAT IT SAYS WHEN IT HAS NOTHING

**The contract, for Lex to render — supply this shape and confirm it works:**

```
COST AND BENEFIT
  PREDICTED    what the department said it would cost, and gain      [figure · base year · source]
  CHECKED      whether anyone assessed it afterwards, and found what [review · date · source]
  MEASURED     official series that bear on it                       [series · publisher · span]
  NOT KNOWN    what nobody has established                           [stated plainly]
  COMPARABLE   measures of a similar kind, and what they cost        [by subject — say so]
```

⚠⚠ **`NOT KNOWN` is a first-class row, not an error state.** *"No post-implementation review has been
published for this measure, so nobody has assessed whether the predicted cost was right"* is a
finding with a citation. **An empty block is the failure mode this platform exists to avoid**, and a
user cannot tell "nobody measured it" from "we did not look".

⚠ **Every figure carries its source and its date.** A cost figure without the assessment it came from
is an attribution we cannot defend — and on paper there are no clicks, so it travels into the
document, not behind a link.

⚠ **The block states its own coverage**, generated from live state on every call, never hardcoded:
which of the four rows were searched, which are not built, and the collection's own boundary. The
cross-reference graph already does this and a check fails its build if a coverage string states a
figure about the corpus. **Follow that pattern.**

**Standard in every new idea:** the placement is Lex's. ⚠ **Report the exact integration needed and
coordinate — do not edit their files.**

---

## §4 — `costSummary` IS EMPTY AND NOBODY KNOWS WHY

25-F found `costSummary` among **four kernel fields never drafted at all** — EMPTY, with no proposal —
and nobody established whether they were skipped, failed, or never wired.

**Establish which, and report.** ⚠ **The fix is Lex's**; the diagnosis is cheap and can be done here.
A block that renders correctly into a field nothing ever populates is a sprint wasted.

---

## §5 — MEASURE

- **Write ~8 costing questions of both shapes** — forward and backward — and deliver them numbered,
  one verdict line each, with the keyed document's text printed underneath, in the format Charlie has
  now completed four times. ⚠ **Score nothing against them.**
- ⚠ **At least two must be questions where the correct answer is "nobody has measured this."** They
  are scored on **behaviour, not recall** — a 0% there is a pass — and reported in their own table,
  never folded into an average. The existing negative controls proved their worth and Charlie accepted
  all five.
- Re-run the baseline after §1 only, with **n stated** and the flag string recorded in the artefact
  itself. ⚠ S14's figures described a keyword-only system for a fortnight because nobody wrote down
  what ran.

---

## §6 — STANDING RULES AND THE REPORT

- Scoped commits by explicit path; `commit-search-s18.sh`; nothing owned by ingest, graph or lex
  edited — report the change needed instead.
- Every check watched failing against the real broken state; **every guard states what it counted.**
- ⚠ **This sprint depends on `BRIEF_INGEST_IMPACT_NUMBERS.md`.** If the fields are not yet extracted,
  **build §1 and the block's shape against a stub and say so** — do not wait, and do not fake the
  figures.
- ⚠ Auto-deploy is live on `vector-serve` for pushes touching `scripts/ingest/search/`; a redeploy is
  not a rebuild; `/api/health` carries the deployed commit and the flags.
- **Report `docs/SEARCH_S18_REPORT.md`:** §1's routing diagnosis first, with the per-question stream
  choices — that is the sprint's most valuable artefact. Then the block, with a **real worked example
  on the Public Sector Equality Duty**, showing exactly what a user would see including the
  `NOT KNOWN` row. Then §4's diagnosis. Then what is NOT done, named. Decisions for Charlie as
  numbered questions with a recommendation and the consequence of each option.
- Change-log, contract and handoff entries labelled **SEARCH**.
