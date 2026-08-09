# How to measure ORDERING, before we build the reranker

*2026-08-08 23:00 UTC. A proposal, not a build. Nothing here is implemented yet.*

---

## The gap, stated precisely

Every headline number in this project is **recall@20** — including the fusion weight decision
(+7.3pp legislation, +15.0pp debates) and every GOLD_TEST. `gold-queries.ts` encodes each query's
answer key as `expected: GoldSource[]`, and a source "counts as RETRIEVED if ANY top-20 hit's
haystack matches ANY pattern".

**That is a set metric. It cannot see position at all.** A ranking that puts the right document
20th scores exactly the same as one that puts it 1st.

The 4 August benchmark regression is precisely an ordering failure: asked "what is the law on data
protection currently?", the answer now leads with the **Privacy and Electronic Communications (EC
Directive) Regulations 2003** and reaches **UK GDPR at citation [9]**. Nothing is missing — the
retrieval is richer than before, 235 sources and 10 cited — but a sector-specific SI is outranking
the two principal instruments a reader actually wants first.

**Recall@20 scores that as a clean pass.** So does every metric we currently run.

---

## Why MRR is the wrong primary metric — demonstrated on our own failure

MRR is the obvious candidate and it fails this exact case.

MRR rewards the rank of the **first relevant** result. For the data-protection query, PECR 2003
**is relevant** — it is genuinely a statutory instrument governing data protection, and it would
be in any sane answer key. So the ranking that produced the regression scores **MRR = 1.0**: the
first result is relevant, therefore perfect.

**Our actual failure case is invisible to MRR.** It would also be invisible to precision@k, and to
recall@k at any k. The problem is not *which* documents came back; it is *which of two relevant
documents came back first*, and only a metric that compares two relevant documents to each other
can see it.

---

## Proposal: pairwise preferences as the primary ordering metric

**Express the judgement directly, because that is what the requirement is.** "UK GDPR should
outrank PECR 2003 for this query" is a statement about two documents, so make it the unit of
measurement.

### Why this rather than nDCG

nDCG@10 with graded relevance is the textbook answer, and it is the right *secondary*. As the
primary it has two problems here, one of them serious:

1. **Our answer key is admittedly incomplete.** `gold-queries.ts` says so in its own header — the
   expected-sources are "CCh's UNVALIDATED draft", several queries carry `todo: true`, and
   `scoreable: false` exists precisely because some keys are not ready. nDCG treats every
   unlisted document as grade 0, so **it punishes a reranker for promoting a genuinely relevant
   document we never thought to enumerate.** On an incomplete key that is not a measurement, it is
   a penalty for finding something new.
2. **Grades attach to patterns, not documents.** Our expected-sources are regexes
   (`ukpga/1988/50:section-21\b`), one of which can match several hits. A single graded relevance
   value for a pattern is ambiguous the moment it matches more than one thing.

Pairwise preferences avoid both. A pair constrains exactly two things we have thought about, and
**everything else is left unconstrained rather than implicitly graded zero.**

### The scoring rule, in full

For a stated preference *A above B* and a ranking `R` (the top-k, k = 20):

- `rank(X)` = index of the first hit in `R` matching any of X's patterns, or ∞ if absent.

| case | outcome | why |
|---|---|---|
| `rank(A) < rank(B)` | **pass** | the preference is respected |
| `rank(B) < rank(A)` | **fail** | the regression we are trying to catch |
| A present, B absent | **pass** | preferred thing retrieved, dispreferred not — strictly better |
| A absent, B present | **fail** | the ranking surfaced only the worse of the two |
| both absent | **vacuous** | report the count; **exclude from the denominator** |

**Preference accuracy = passes / (passes + fails)**, with `vacuous` reported beside it.

⚠ **The vacuous case must be excluded from the denominator and reported separately, or the metric
is gameable by retrieving nothing.** A system that returns an empty list has zero fails. Reporting
the vacuous count next to the score makes a shrinking denominator visible instead of flattering.

### Recall@20 stays — as a guard, not a target

**An ordering metric alone can be improved by dropping hard documents.** Keep recall@20 running
unchanged alongside, and read it as a **regression guard**:

> A reranker only reorders a set it was given. Recall@20 should therefore be **invariant** across
> a reranker change. If preference accuracy goes up and recall@20 goes down, the reranker is not
> ordering better — it is discarding, and the gain is an artefact.

That invariance is the sharpest test available and it costs nothing: we already compute it.

---

## The gold-set extension

Minimal, and it reuses the existing pattern machinery rather than adding a second matcher.

```ts
/** One side of an ordering constraint: an existing expected-source by label, or a new
 *  source declared inline (for things that are retrieved but should NOT rank first,
 *  which by definition are often not in `expected`). */
type GoldPrefSide = string | GoldSource

/** "`above` must outrank `below` in the final ranking for this query." */
export type GoldPreference = {
  above: GoldPrefSide
  below: GoldPrefSide
  /** One line of reasoning. Not decoration: a preference is a judgement, and a judgement
   *  nobody can see is a judgement nobody can challenge. */
  why: string
}
```

added to `GoldQuery` as `prefer?: GoldPreference[]`.

### Seeded from the failure we already have

```ts
{
  id: 'B7', archetype: 'B', persona: 'H1', flags: [], floor: false,
  query: 'what is the law on data protection currently?',
  expected: [
    { label: 'UK GDPR (Reg (EU) 2016/679 as retained)', patterns: ci('eur/2016/679', 'uk gdpr') },
    { label: 'Data Protection Act 2018',                patterns: ci('ukpga/2018/12') },
    { label: 'PECR 2003 (SI 2003/2426)',                patterns: ci('uksi/2003/2426') },
  ],
  prefer: [
    { above: 'Data Protection Act 2018', below: 'PECR 2003 (SI 2003/2426)',
      why: 'a reader asking what the law IS wants the principal statute before a sector-specific SI made under it' },
    { above: 'UK GDPR (Reg (EU) 2016/679 as retained)', below: 'PECR 2003 (SI 2003/2426)',
      why: 'same: UK GDPR is the general regime; PECR is the electronic-communications overlay' },
  ],
}
```

Under today's ranking both pairs **fail**, which is the point — the metric has to be able to fail
on the case that prompted it before it is worth anything.

### How many, and authored when

- **One or two pairs per scoreable specific query** (~20 queries) is enough to detect regressions.
  Do not attempt an exhaustive ordering of the key; the cost is real and the marginal pair is weak.
- **Seed from observed failures.** Every pair should trace to a ranking somebody looked at and
  judged wrong. That keeps the set honest and small.
- ⚠ **Author the pairs BEFORE running a candidate reranker**, and record them in the CHANGE_LOG as
  a prediction the way this project already does for ingest scale. Pairs written after seeing a
  reranker's output are fitted to it, and the measurement is then worthless.

---

## Where to measure

The reranker sits **after fusion, before grouping**. So preference accuracy must be computed on the
**fused list, before `groupForPanel`**.

⚠ `groupForPanel` caps roughly 3 per display type and ~20 overall. It would mask exactly the effect
being measured: a legislation-vs-legislation ordering error can be hidden by grouping keeping only
the top three of that type. Measuring after grouping would report a problem as solved because it
became invisible.

Note also §24 of `VECTOR_FLIP_LOADTEST.md`: the fused list is capped at
`Math.max(limit, bm25.length)` (47 in the general-chat path). That is well above k = 20, so it does
not interfere.

---

## What to report, per run

| metric | role | expected under a good reranker |
|---|---|---|
| **preference accuracy** (passes / passes+fails) | **primary** — the thing being improved | up |
| vacuous pairs | honesty check on the denominator | flat |
| **recall@20** | **guard** — a reranker reorders, it must not discard | **invariant** |
| nDCG@10 | secondary aggregate, once grades exist | up, read as trend only |
| MRR@10 | reported, not steered by | may not move at all — see above |

---

## Recommended order of work

1. **Extend `gold-queries.ts`** with `prefer?: GoldPreference[]` and the scoring rule above. No
   reranker involved; this is measurement infrastructure.
2. **Seed 15–20 pairs** from failures we can already see, starting with the data-protection query.
   Record them before anything is built.
3. **Score the CURRENT ranking** and publish the baseline. If today's preference accuracy is
   already high, the reranker is not the highest-value build and we should know that before
   spending on it — which is the main reason to do this step separately and first.
4. **Only then** build the reranker, and judge it on preference accuracy with recall@20 held
   invariant.

⚠ **Step 3 is the one worth insisting on.** The reranker is currently justified by a single
observed regression. One example is enough to motivate a metric; it is not enough to justify a
build. The baseline turns "the ordering looks wrong" into a number, and that number decides whether
this is the highest-value next piece of work or a distraction from the corpus gaps the same
benchmark also exposed.

---

## What this proposal does not solve

- **Grading remains subjective.** Pairs are cheaper and more stable than 0–3 grades, but they are
  still judgements. The `why` field exists so they can be argued with.
- **It measures only what we thought to state.** A reranker could improve or wreck the ordering of
  documents no pair mentions and the metric would not notice. nDCG@10 as a secondary partially
  covers this once grades exist.
- **It says nothing about the answer**, only the ranking handed to it. The data-protection
  regression is a *synthesis* failure as much as a ranking one — Lex chose to lead with PECR from
  the sources it had. A better ranking makes that less likely; it does not make it impossible.

---
---

# BASELINE ATTEMPT — 2026-08-09 08:28 UTC. Blocked, and the blocker is the finding.

*§3 and §4 of the "fix the truncation class first" brief. The harness and the pairs are built and
committed; the baseline is deliberately NOT published, for the reason below.*

## A. Two errors in the proposal above, found by implementing it

**A1. "Measure on the fused list before grouping" is wrong for the routed path.**
`runRoutedSearch` (`query-router.ts:157`) ends `return perStream.flat()` — a **plain concatenation
in `STREAMS` order**, with no cross-stream sort. Its own comment says so: "Pure fan-out + concat —
no ranking judgement here". So before grouping there is **no cross-stream ranking to measure**:
positions 1..n are simply the legislation block, then debates, then committees, and so on.

The consequence for the metric:

- **within-stream** pairs (UK GDPR vs PECR — both legislation) *are* measurable on the ungrouped
  list, because a stream's own fused list is a real ranking;
- **cross-stream** pairs (a committee report vs a statute) are **not** — they can only be judged
  after `groupForPanel`, which is where scores are compared across streams.

The pair set in `scripts/gold-preferences.ts` deliberately contains both kinds, including three
inverted pairs. Those inverted ones cannot be scored on the ungrouped list at all. **The metric
needs to specify a surface per pair**, or score cross-stream pairs on `grouped`. Not yet fixed.

**A2. ⚠ A real bug the same reading exposed: the answer sees a concatenation, not the best hits.**
`general-chat.ts` takes `search.results.slice(0, 16)` as the context handed to Lex. Since
`results` is the concatenation, **those 16 come off the front of whichever stream `STREAMS` lists
first — legislation** — and the other four streams' hits are retrieved, counted in "235
retrieved", shown in the panel, and then **dropped before the answer**.

That exactly explains the live trial: Lex answered *"The provided sources do not contain
information on what select committees have said about these instruments or any relevant case
law"* — while the committees and caselaw streams **had both been routed and had returned hits**.
It was telling the truth about what it was shown, and what it was shown was one stream.

Reported, not fixed: how to interleave streams into a single ranked context is a design decision
(round-robin? by fused score? per-stream quotas?) and it changes what every routed answer is built
from.

## B. §3 — the benchmark cannot yet be re-established, because routing is still intermittent

Measured directly against `routeQuery`, live, one variable at a time:

| state | mix | dispatched | failed open | reason |
|---|---|---:|---:|---|
| after the `bad-json` fix (`b5319bf`) | 1 query ×10 | 8/10 | 2/10 | **`timeout` at 10,000 ms** — no bad-json at all, so that fix held |
| + timeout 10s → 25s | 1 query ×12 | 10/12 | 2/12 | `truncated` at 4,096 |
| + `maxLength: 200` in the schema | 3 queries ×12 | **3/12** | **9/12** | `truncated`, model **degenerating into repetition** |
| **reverted, current** | 3 queries ×12 | **7/12** | 5/12 | `truncated` at 4,096 |

**The timeout raise is kept** — it removed the timeout class outright and cost nothing; the
retrieval that follows already takes 3.4–3.8 s, so 10 s was never protecting the user's latency.

⚠ **`maxLength` was tried and reverted after one measured pass.** Gemini's `responseSchema`
evidently does not honour `maxLength` on a string, and supplying it *destabilised* generation:
fail-open went 2/12 → 9/12 and the truncated tails show repetition
(`…legal rules law OR data protection legal principles law`). A warning comment now sits where the
constraint would go, so the next person does not repeat it.

**What is left is not a ceiling problem — it is a runaway problem.** The tails show the model
enumerating without stopping, worst on short vague queries (`leasehold reform` is the reliable
offender). Raising 4,096 again would buy a 3,000-character "query" per stream, which is useless
for BM25 anyway — CLAUDE.md §18 rule 5 in action: a bigger number only moves the cliff.

**Recommended next, not built: salvage a PARTIAL routing decision.** The JSON is emitted in
property order and `legislation` is first, so a truncated payload usually still contains a
complete `"legislation": "…"` pair. Extracting whatever complete pairs exist beats failing open,
because a fail-open loses per-stream scoping **and** the dense half for the whole query. That
turns today's ~40% total loss into a partial one, and it is a change to `parseRoute` alone.

## C. §4 — the pairs are authored; the baseline is deliberately not published

`scripts/gold-preferences.ts` — **20 pairs across 16 queries**, authored **before any reranker
exists**, seeded from observed failures and from statements about UK law uncontroversial enough to
assert in advance. Three are **deliberately inverted** (a committee document must outrank the
statute when the question asks what committees said), so the set cannot be satisfied by a system
that always prefers legislation.

`scripts/score-ordering.ts` implements the scoring rule, imports the **real `runSearch`** so it
measures the production ranking rather than a copy, and reports vacuous pairs beside the score.

⚠ **I am not publishing a number, and that is the finding, not a shortfall.** With ~40% of queries
failing open, a baseline pass would score a *mixture* of routed and unrouted rankings — and an
unrouted ranking is a different system, not a worse ordering of the same one. The benchmark run
above shows what that looks like: the fail-open produced 48 untiered hits with **UK GDPR, DPA 2018
and PECR 2003 all absent from the top 20**, the list dominated by written answers about data
protection. Averaging that with routed runs would produce a number that means nothing and would
then be quoted.

**So the honest answer to "is the reranker still the right next build" is: not yet, and we now know
why.** In order:

1. **Salvage partial routing decisions** (§B) — removes the biggest source of variance.
2. **Decide how streams are interleaved into the answer context** (§A2) — this is the live bug, and
   it plausibly explains the PECR-leading observation better than any ranking defect does: Lex was
   shown one stream's block and wrote the best answer available from it.
3. **Then** score the baseline, on a system that behaves the same way twice.
4. **Then** decide about the reranker.

⚠ **On the original question — is the PECR-leading regression real or an artefact?** Still not
settled, and it is now clear it was never going to be settled by re-running the query while
routing was intermittent and while the answer context is a single stream's block. §A2 is the more
likely explanation and it is cheaper to fix than a reranker. **That is the strongest argument yet
for Charlie's own instruction: one observed regression motivates a metric, not a build.**
