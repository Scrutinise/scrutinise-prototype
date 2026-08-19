# GOLD TEST 11 — QUERY FRAMING: BARE vs CALLER-ENRICHED

*Generated 2026-08-19T09:12:00.104Z. Through `runSearch()` — the real gateway. recall@20.*

## ⚠⚠ WHICH COMPARISON THIS IS

This measures **bare query** versus **query plus whatever context the CALLER holds** — here the
archetype's declared stream and its specific/principle kind.

**It is NOT the Lex-build comparison.** That one contrasts the user's problem as typed against
the problem plus their goal, their rejected options, what they already know, and their profile.
**There is no user and no profile on the gold set**, so that comparison cannot be run here and
no result below licenses a claim about user profiles.

## ⚠ THE CONFIGURATION THIS RAN UNDER

Read POSITIVELY off the running services, not inferred from the environment:

```
[config] fts=fts-serve-production.up.railway.app vector=vector-serve-production.up.railway.app streams=legislation,caselaw,guidance router=ON fully-configured
[before] fts OK served=338 width=16 since=2026-08-17T23:14:12.680Z
[before] vector OK served=1000 width=4 since=2026-08-16T02:03:34.580Z
[after ] fts OK served=704 width=16 since=2026-08-17T23:14:12.680Z
[after ] vector OK served=1217 width=4 since=2026-08-16T02:03:34.580Z
[engagement] fts+366  vector+217
```

⚠ `served` moving is what proves the retrieval this table describes actually reached the
services. A zero delta beside a full results table would mean the numbers came from somewhere
else, and that is a finding rather than a rounding error.

## Result

| | recall@20 |
|---|---:|
| bare query | **42.2%** |
| caller-enriched | **41.1%** |
| difference | **-1.1pp** |

Queries scored: **31** of 43. Enriched better on 3, worse on 3.
Excluded: 0 for a differential leak, 0 for a failed search.

## ⚠⚠ HEADROOM — THE REAL SAMPLE SIZE

**22 of the 31 scored queries had recall in at least one arm.**
The other 9 returned nothing either way and could not have shown a
difference in either direction.

**S7's harness, bare BM25 against `corpus_fts`, had headroom of 4 of 31.** This run, through
the gateway, has **22**. That comparison is the point of re-homing the harness:
it says whether the floor effect was the measurement or the corpus.

## Per query

| query | bare | enriched | note |
|---|---:|---:|---|
| A1 | 100% | 100% |  |
| A2 | 100% | 100% |  |
| A3 | 100% | 100% |  |
| A4 | 100% | 100% |  |
| A5 | 50% | 50% |  |
| B1 | 25% | 75% |  |
| B2 | 0% | 0% |  |
| B3 | 33% | 33% |  |
| B4 | 0% | 0% |  |
| B5 | 33% | 33% |  |
| C1 | 0% | 33% |  |
| C2 | 67% | 67% |  |
| C3 | 0% | 0% |  |
| C4 | 33% | 33% |  |
| C5 | 33% | 33% |  |
| D1 | 100% | 100% |  |
| D2 | 50% | 50% |  |
| D3 | 100% | 100% |  |
| D4 | 33% | 67% |  |
| D5 | 0% | 0% |  |
| E1 | 50% | 0% |  |
| E2 | 0% | 0% |  |
| E3 | 50% | 0% |  |
| E4 | 50% | 50% |  |
| E5 | 0% | 0% |  |
| F1 | 0% | 0% |  |
| F2 | 100% | 100% |  |
| F3 | 50% | 50% |  |
| F4 | 0% | 0% |  |
| F5 | 50% | 0% |  |
| B6 | 0% | 0% |  |
| G1 | — | — | not scoreable |
| G2 | — | — | not scoreable |
| G3 | — | — | not scoreable |
| H1 | — | — | not scoreable |
| H2 | — | — | not scoreable |
| H3 | — | — | not scoreable |
| I1 | — | — | not scoreable |
| I2 | — | — | not scoreable |
| I3 | — | — | not scoreable |
| J1 | — | — | not scoreable |
| K1 | — | — | not scoreable |
| K2 | — | — | not scoreable |
