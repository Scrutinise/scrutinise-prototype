# GOLD TEST 11 — QUERY FRAMING: BARE vs CALLER-ENRICHED

*Generated 2026-08-17T23:09:29.298Z. Offline against `corpus_fts`. recall@20.*

## ⚠⚠ WHICH COMPARISON THIS IS

This measures **bare query** versus **query plus whatever context the CALLER holds**.

**It is NOT the Lex-build comparison.** That one contrasts the user's problem as typed against
the problem plus their goal, their rejected options, what they already know, and their profile.
**There is no user and no profile on the gold set**, so that comparison cannot be run here and
no result below licenses a claim about user profiles.

## Result

| | recall@20 |
|---|---:|
| bare query | **8.1%** |
| caller-enriched | **8.1%** |
| difference | **+0.0pp** |

Queries scored: **31** of 43.

## ⚠⚠ THIS MEASUREMENT IS UNDERPOWERED AND CANNOT ANSWER THE QUESTION

**27 of the 31 scored queries returned NOTHING in either arm.**
Only **4** had any recall at all, so only 4 could have shown a difference in
either direction. A "+0.0pp" headline from that is a floor effect, not evidence that framing
does not matter.

**Why the floor is so low:** this harness calls `rankedSearch` straight against `corpus_fts` —
bare BM25, no tier scoping, no per-stream fusion, no query expansion, no citation resolver. The
platform BM25 gold headline is around 62%. This is therefore a much weaker system than the one
anybody actually runs, and its absolute numbers are a FLOOR rather than the platform recall.

▶ **What would fix it:** run both arms through `runSearch()` — the real gateway, with routing
and fusion — from the web side. It cannot be done from `scripts/ingest`, which sets
`rootDir: "."` and cannot import anything under `scrutinise-web/`. That is a harness-location
problem, not a measurement problem, and it is the next thing to do here.
Enrichment helped **0**, hurt **0**, made no difference to **31**.

⚠ **0 queries were EXCLUDED because the enriched form contained part of the answer key.**
Including them would have measured the leak rather than the framing — the single most likely way
for this experiment to produce a flattering and worthless number.

⚠ Run order **alternates per query**, because a cache-warming artefact has misled a measurement
in this project before.

## Per query

| id | bare | enriched | |
|---|---:|---:|---|
| A1 | 50% | 50% |  |
| A2 | 0% | 0% |  |
| A3 | 0% | 0% |  |
| A4 | 0% | 0% |  |
| A5 | 0% | 0% |  |
| B1 | 0% | 0% |  |
| B2 | 0% | 0% |  |
| B3 | 0% | 0% |  |
| B4 | 0% | 0% |  |
| B5 | 0% | 0% |  |
| C1 | 0% | 0% |  |
| C2 | 0% | 0% |  |
| C3 | 0% | 0% |  |
| C4 | 0% | 0% |  |
| C5 | 0% | 0% |  |
| D1 | 0% | 0% |  |
| D2 | 50% | 50% |  |
| D3 | 100% | 100% |  |
| D4 | 0% | 0% |  |
| D5 | 0% | 0% |  |
| E1 | 0% | 0% |  |
| E2 | 0% | 0% |  |
| E3 | 50% | 50% |  |
| E4 | 0% | 0% |  |
| E5 | 0% | 0% |  |
| F1 | 0% | 0% |  |
| F2 | 0% | 0% |  |
| F3 | 0% | 0% |  |
| F4 | 0% | 0% |  |
| F5 | 0% | 0% |  |
| B6 | 0% | 0% |  |
| G1 | — | — |  |
| G2 | — | — |  |
| G3 | — | — |  |
| H1 | — | — |  |
| H2 | — | — |  |
| H3 | — | — |  |
| I1 | — | — |  |
| I2 | — | — |  |
| I3 | — | — |  |
| J1 | — | — |  |
| K1 | — | — |  |
| K2 | — | — |  |