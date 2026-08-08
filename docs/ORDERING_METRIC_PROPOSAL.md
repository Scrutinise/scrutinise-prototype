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
