# CCW-B10 — prediction, recorded before the search was run

**Written 2026-08-30, before `b10-candidates.ts` existed.** Per CLAUDE.md's predict-measure-commit
rule: the prediction is worth nothing unless it is on disk before the measurement.

## Pass A — how many distinct candidates from the eight thesis videos?

**Prediction: 110–140 candidates** (point estimate **120**).

Reasoning: the eight thesis videos are ~2h 57m of speech. A candidate here is a merged ±30s window
carrying at least one term from one group, so the ceiling is roughly one candidate per minute of
dense passage. B9 found 87 hits in these same videos across a narrower term list (20 terms, mostly
named measures); B10 uses 32 terms and adds the imperative and action-verb groups, which are far
more frequent in speech than statute names. I expect the action group to dominate, the imperative
group to be large but low-value, and the target group to be smallest.

## Pass B — will a target outside the twelve workstreams surface?

**Prediction: yes.** Confidence: high for "something", moderate for "something the report would
actually want".

The twelve are HRA, Supreme Court, Lord Chancellor, Equality Act, CRAG Pt 1, Climate Change Act,
quangos, judicial review, patronage, removal from office, non-crime hate incidents / Sentencing
Council, and religio-political movements. Named things I expect to find in the other ~277 videos
that are **not** in that list, in rough order of likelihood:

1. **The BBC / the licence fee** — a standing Starkey subject for a decade.
2. **The House of Lords as a chamber.** `house of lords` is a B10 search term but the workstreams
   only cover its *appellate jurisdiction* (WS-02). Composition and reform are not a workstream.
3. **The universities** — and the Office for Students.
4. **The Church of England / establishment.**
5. **Devolution and the Scotland Act 1998** — implied by "the YooKay doesn't work" but absent
   from the twelve.
6. **The Bank of England's independence.**

## What would make me wrong

- If Pass A comes in **under 60**, the term list is not matching the way he actually speaks and the
  search is the thing at fault, not the corpus.
- If Pass B surfaces **nothing** outside the twelve across 277 videos and ~125 hours, that is a
  suspiciously tidy result and I should suspect the pass-splitting or the corpus-wide totals before
  believing it.

## One thing I already expect to go wrong, recorded so the fix is not retrofitted

`scripts/starkey/search.ts` uses `plainto_tsquery('english', …)`. Nine of B10's twelve imperative
terms are built entirely from Postgres English **stopwords** — `we`, `should`, `must`, `i`, `would`,
`what`, `do`, `the`, `has`, `to`, `of`. A query of nothing but stopwords lexes to an empty tsquery
and matches **zero** rows. That is not "he never says it"; it is the query dissolving.

I predict `search.ts` returns **0 for `we should`, `we must`, `I would`, `what I would do`, and
`must go`**, and that direct matching against the cue text returns a large number for each. I will
run both and report them side by side, so the defect is evidence rather than an assertion.
