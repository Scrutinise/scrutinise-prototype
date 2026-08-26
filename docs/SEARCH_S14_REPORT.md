# SEARCH S14 — STOP RATIONING SLOTS, START JUDGING RESULTS

**From:** CC-Search · **Executes:** `docs/BRIEF_SEARCH_S14.md`
**Report opened** 2026-08-26 · every timestamp in this file is UTC.
**Configuration of record for every measured number below:**
`fts=fts-serve-production-4cea` · `vector=vector-serve-production` ·
`LEX_QUERY_ROUTER=true` · `LEX_VECTOR_STREAMS=legislation,caselaw,guidance,committees`
— **the four-stream string Charlie confirmed production reads**, not S13's single `legislation`.

---

## §0 — READ THIS FIRST: A LIVE OPERATIONAL FINDING THAT ARRIVED BEFORE THE SPRINT'S OWN SUBJECT

⚠⚠ **UNDER A FOUR-STREAM DENSE FAN-OUT, `vector-serve` DOES NOT KEEP UP, AND WHEN IT FALLS BEHIND
IT DOES NOT RECOVER.** This was not what the sprint set out to measure. It is reported first because
it is the only thing here that is happening on a running service today.

Measured off `/stats`, which is the readable surface (`CLAUDE.md` §19 — a behavioural measurement
from a reachable surface beats an unreachable config file):

| | |
|---|---|
| service concurrency | **4** in flight, queue cap **64** |
| `warm_p50` | 4,998 ms |
| state under a routed sweep | `inFlight 4 · queued 64/64 · queueHighWaterMark 64 · rejections 101` |
| what the client sees | `vector 502: upstream error`, then `This operation was aborted` at the 25 s `VECTOR_TIMEOUT_MS` |
| what the ranking sees | **nothing** — `fusedStream` catches the failure and returns BM25 alone |

**`warm_p95`, read off the same counter at four points in one afternoon.** It is a single number and
it is the whole story:

| when | `warm_p95_ms` |
|---|---|
| quiet, before any S14 harness ran | **7,698** |
| queue full, harness running | 205,754 |
| harness stopped, queue draining | 351,301 |
| ~40 minutes after the last client had gone | **706,954** — eleven minutes |

⚠⚠ **The p95 kept CLIMBING for forty minutes after every client had been killed.** That is the
finding in one line: the service was still working through requests whose callers had walked away
half an hour earlier.

**The mechanism, and it is self-reinforcing.** A client abort does not cancel the work: the request
is already on the server's queue and is still executed after the caller has walked away. So every
timed-out dense leg *adds* load rather than shedding it, the queue climbs to its cap, and every
subsequent query is slower than the last. It does not settle; it collapses.

⚠ **S13 could not have seen this and neither could anything before it.** Every earlier measurement
ran with `LEX_VECTOR_STREAMS=legislation` — ONE dense call per query. The confirmed production
string names FOUR. That is a 4× change in dense fan-out against a 4-wide service, and it is the
direct answer to the brief's §1.4 question about whether widening touches the concurrency ceiling.

⚠⚠ **AND IT LEAVES NO MARK ON THE RESULT.** To be exact: `runVectorSearch` does emit a
`console.warn` per failed call, so it is not literally silent. But nothing aggregates it, and — the
part that matters — **the RANKING carries no trace at all**: `mergeLegs` returns the BM25 list and
every hit keeps `scorer: 'bm25'`, which is byte-for-byte what a stream that is not in
`LEX_VECTOR_STREAMS` produces. So *"dense retrieval is off"* and *"dense retrieval timed out on
every call"* are indistinguishable from the result object, which is where a measurement reads them.
`CLAUDE.md` §18's corollary, in the one place where it costs the most. **Every score in §1.1 below
carries `scorer: 'bm25'`, and that is how this was found.**

▶ **What this means for the numbers in this report is stated at §5.1, not buried.**
▶ **Decision D-1.**

---

## §1 — THE AUDIT. WHY ROUND-ROBIN, AND WHAT COULD REPLACE IT

`scripts/audit-s14-scores.ts` · raw data `docs/census/s14-score-audit.json`. **Nothing was changed
before this was taken.**

### 1.1 What each stream's scores actually are — and no, they are not comparable

Three probe queries, all five streams, the whole returned list each time (60 rows per stream after
the ×3 over-fetch), scores exactly as the ranking sees them.

| query | legislation | debates | committees | caselaw | guidance | rank-1 spread |
|---|---|---|---|---|---|---|
| landlords evicting tenants without a reason | 254.2 · *174.7* | 126.7 · *110.9* | 100.9 · *81.4* | **53.4** · *22.7* | 89.3 · *62.3* | **4.8×** |
| sewage discharge by water companies | 196.9 · *165.8* | 151.1 · *144.5* | 100.8 · *90.0* | **64.5** · *42.5* | 131.3 · *54.7* | **3.1×** |
| vicarious liability for an employee assault | 126.5 · *99.1* | 108.3 · *53.8* | 78.9 · *53.0* | **46.9** · *32.4* | 75.4 · *60.7* | **2.7×** |

*(each cell: the stream's **rank-1** score · its *median*. Spread is the ratio of the highest
stream's rank-1 to the lowest's — legislation to caselaw on all three.)*

**No.** A caselaw rank-1 at 53.4 and a legislation rank-1 at 254.2 are the same claim — *this is the
best thing I found* — expressed on scales up to five times apart, and caselaw's BEST is well below
legislation's MEDIAN on every probe. BM25 is length- and corpus-normalised and the indexes are
different sizes, so the numbers are not measuring the same thing.
**Sorting these together produces a
confident ordering with nothing behind it**, and this repository has already shipped that defect
once: `groupForPanel` did exactly that global cross-stream sort until 2026-08-09, and
`lib/lex/score-scope.ts` exists to stop it returning.

⚠ **And the incomparability is WORSE than this table shows.** Every row above carries
`scorer: 'bm25'`, because the dense legs did not arrive (§0). When fusion does run,
`fuseWeightedRrf` **overwrites** `score` with an RRF value of ~0.008–0.016 — so a fused stream and
an unfused stream differ by three orders of magnitude for reasons that have nothing to do with
relevance. A cross-stream sort would put every fused stream last, always.

### 1.2 ⚠⚠ WHY PLAIN RANK FUSION ACROSS STREAMS CANNOT FIX THIS — SAY IT ON THE RECORD

**This is the durable half of the report. Anyone reaching for RRF here will rebuild the current
behaviour and measure no change.**

The streams return **disjoint** sets. That is structural — they are separated by the FTS tier
prefilter and, where a tier is shared, by a corpus prefilter — and it is also measured:

> **0 of 10 stream pairs shared a single document, on every one of the three probes.**
> 30 pairwise comparisons, 0 shared ids.

Over disjoint sets, unweighted RRF assigns each document `1/(k + rank)`, which depends on nothing
but its rank. Sorting by that value takes **every stream's rank 1, then every stream's rank 2, and
so on.** That is round-robin, exactly, and `check-s14-merge.ts` §A asserts it by comparing outputs
rather than by reading the code: the judged merge with **a stream floor of 2, uniform weights and no
gate** returns the same list as `interleaveStreams`, id for id, over 60 results.

**Rank fusion carries no information about whose rank 1 is better.** The only thing that can is a
per-stream WEIGHT — which is why option (b) exists and why everything else in the design space is
either a weight or a bar.

### 1.3 The four candidate designs, costed

| | what it is | cost | verdict |
|---|---|---|---|
| **(a) score normalisation** | put each stream's scores on a common scale, sort globally | free, deterministic | ❌ **REJECTED** |
| **(b) router stream confidence** | the router says how likely each stream is to hold the answer; weight the streams by it | one call we already pay for | ⚠ **BUILT, AND IT COSTS MORE THAN IT LOOKS** |
| **(c) a reranker over the pooled candidates** | a model reads the top N from every stream and orders them | money + latency | ✅ **BUILT, §3** |
| **(d) absolute relevance floors** | a result must clear a bar to occupy a slot at all | free, deterministic | ✅ **BUILT** |

**(a) is rejected, and the reason is specific rather than general.** Normalisation rescales a stream
*relative to its own candidates*, so **a stream that found nothing good is promoted to parity with a
stream that found something excellent**: its best-of-a-bad-lot becomes a 1.0 exactly as a genuinely
strong hit does. That is worse than the round-robin, because it is confidently wrong rather than
merely fair. Against `landlords evicting tenants` above, min-max normalisation hands caselaw's
**53.4** — a score below a third of legislation's *median* — exactly the same 1.0 it hands
legislation's **254.2**.

**(d) uses the one absolute quantity available**: the fraction of the query's own content terms
visible in what the result displays. It depends on no index statistic and is computed identically
for every stream. ⚠ It is used as a **GATE, not as a sort**, and that distinction is the whole of
what S13 learned: coverage-as-the-ordering moved 24 of 34 rankings to buy a net of two, and took
two documents their own stream ranked SECOND to merged ranks 117 and 149.

**▶ RECOMMENDED COMBINATION: (d) first, then (c). (b) is built and measured and I do not
recommend adopting it — see below.**

### 1.4 ⚠⚠ (b) IS THE ONE THAT SURPRISED ME, AND THE FIRST ENCODING OF IT BROKE THE ROUTER

The obvious way to ask a model for confidence is to ask for numbers. **Measured on 55 live router
calls over the validated set, that made `gemini-2.5-flash` degenerate:**

| | without the confidence question | with it |
|---|---|---|
| router calls | 55 | 55 |
| **truncated (`MAX_TOKENS`, salvaged as a PARTIAL route)** | **0** | **12 — 21.8%** |

The truncated tails are the model writing an endless decimal:
`…ends: "00000000000000000000…"`, `"9999999999…"`, `"7777777777…"`. **This is the same failure this
codebase already recorded for `maxLength` on 2026-08-09** — *"the truncated tails showed the model
degenerating into repetition"* — arriving by a different door. A signal that costs the router one
call in five is not a signal worth having, whatever it does to the ordering.

And where it *did* answer, it failed in two further ways: it commonly returned a value for **one of
four routed streams** (so three quarters fell back to the uniform weight), and where two or more
streams got a value the **spread was 0.20** — weights that close to uniform *are* round-robin.

**▶ THE FIX, AND IT IS A DESIGN LESSON RATHER THAN A TWEAK: ask for a PERMUTATION, not a scale.**
`streamRanking` is an ordered list of the corpora the router named, most likely first. A permutation
of five known strings **cannot** run away (it is finite by construction), **cannot** be partial (the
prompt asks for all of them, and coverage is measured), and **cannot** be flat (a ranking has no
flat case). The numbers the merge needs are derived from the position, by us, deterministically —
the model is never asked to invent a scale it has no basis for. Re-measured after the change:
**0 truncations in either arm.**

⚠ **The remaining cost of (b) is not the encoding, and it is not fixable by one.** Asking the
routing question at all changes what the router SELECTS — measured at §5.2. A stream that is not
routed is not retrieved, and a stream that is not retrieved cannot be recovered by any ordering.
**(b) is therefore a retrieval change wearing a ranking change's clothes**, which is why it is
reported as a decision rather than recommended.

### 1.5 How wide can retrieval go before it hurts? — **it already hurts, at four streams**

The brief asks for the latency and cost of 20–50 per stream, and whether widening touches the
`vector-serve` concurrency ceiling of 4.

**It is not orthogonal to it. It is the same problem.** See §0. `limit` is a per-stream budget and
each stream over-fetches ×3, so a "width" of 20 asks each service for **60 rows per stream**; on the
dense side the service then applies `chunkOverscan: 5` and `refineFactor: 2` — so 60 rows is 600
ANN probes over 22.6 million vectors, four times per query.

| | measured |
|---|---|
| sparse (`fts-serve`, 16-wide), single call, `limit=60` | **3.9 – 5.8 s** |
| dense (`vector-serve`, 4-wide), single call, `limit=60`, service already loaded | **> 90 s, no response** |
| dense, `limit=20` and `limit=60`, service saturated | **HTTP 503 in 0.4 s** |
| whole routed fan-out at widths 20 / 30 / 50 (5 streams) | **25.0 s at every width — the client timeout, not a width curve** |

⚠⚠ **The width sweep could not be taken, and that is the result.** Every fan-out returned in
25,0xx ms — the client timeout — so the three widths are indistinguishable and no curve exists to
report.

**But the per-stream timings contain their own control, and it is unambiguous.** Milliseconds per
stream, all three probes, at width 20:

| stream | in `LEX_VECTOR_STREAMS`? | probe 1 | probe 2 | probe 3 |
|---|---|---|---|---|
| legislation | yes | 25,018 | 25,008 | 25,030 |
| committees | yes | 25,018 | 25,009 | 25,034 |
| caselaw | yes | 25,014 | 24,998 | 25,020 |
| guidance | yes | 25,016 | 25,011 | 25,006 |
| **debates** | **no** | **6,077** | **4,092** | **4,040** |

**Four streams at the timeout, to within 36 ms, and the one stream with no dense leg answering in
four seconds — nine times out of nine.** The cost is not the width and it is not the corpus; it is
the dense leg, and it is paid by every stream that has one.

▶ **So §2's "at least 20 per routed stream, always" is affordable on the sparse side and is not
affordable on the dense side at today's `vector-serve` shape.** Decision D-1.

---

## §2 — WHAT WAS BUILT

**`LEX_SEARCH_JUDGED_MERGE`, default OFF, read through `flagEnabled()`.**

- **At least 20 retrieved per routed stream, always** — `SEARCH_MIN_PER_STREAM`, applied in
  `runRoutedSearch`. `limit` was already per-stream, so adding a source has never reduced what
  another source RETRIEVES; this puts a floor under a small caller limit so the judged pool is never
  thin because the gateway's default is 12.
- **The displayed twenty are selected by judgement over the whole pool**, not by quota.
- **A source may occupy all twenty slots.** Asserted with the brief's constructed case
  (`check-s14-merge.ts` §B): five streams, the answering stream holding every relevant document —
  round-robin gives it **4 of 20** (floor(20/5), by construction) and the judged merge gives it
  **20 of 20**. The negative control confirms the GATE is what does it: with the gate off and
  uniform weights the same input falls back to the equal share.
- **Adding a source never reduces another's contribution** (§C): adding a fifth, irrelevant source
  leaves the first source's window share unchanged at 20 of 20, where round-robin drops it 5 → 4.
- **Both arms are runnable in one session against the same index** — `measure-s14-merge.ts` computes
  every arm from ONE retrieval pass, so no arm can differ by a service warm-up or a timed-out leg.

⚠ **The judged arm has NO stream floor, and the risk is named rather than dismissed.**
`interleave.ts` exists because four of five routed streams were once silently dropped and Lex told a
user the sources contained nothing from select committees. A floor of 2 makes "one source may hold
all twenty" arithmetically impossible, so it is 0 — and the protection moves from a quota to a
MEASUREMENT: `meta.merge.windowShare` is returned on every routed search and logged on every call.

⚠⚠ **NOTHING IS EVER DROPPED.** The gate DEMOTES: a candidate that fails it sorts below every
candidate that passes and is still in the list, and the count is reported per stream. A merge that
silently discarded a document would be indistinguishable from retrieval that never found it.

### `LEX_MERGE_COVERAGE` is DELETED, not defaulted off

Per the brief. It was S13's minimal experiment: +2 of 65 while moving 24 of 34 rankings, with two
regressions taking documents their own stream ranked SECOND to merged 117 and 149. D-5 recommended
leaving it off and this sprint replaces it. **A flag that survives its own replacement is how a dead
branch gets re-enabled by somebody reading an old note** — the same reasoning that deleted
`LEX_GUIDANCE_CPS` in S11. `lib/lex/merge-coverage.ts` is gone; the SIGNAL survives in
`lib/lex/term-coverage.ts`, which has three other readers.

---

## §3 — THE RERANKER

`lib/lex/reranker.ts` · `LEX_SEARCH_RERANKER` (declared since June, wired now).

**What it may and may not do, enforced rather than instructed:**

| | |
|---|---|
| ✅ reorder | any order, including all twenty from one source |
| ❌ invent | an id not in the candidate list is discarded and counted as `invented` |
| ❌ summarise | it returns numbers; there is no free-text field a summary could travel in |
| ❌ drop silently | an omitted candidate keeps its place BEHIND the ranked ones and `omitted` counts it |

`applyOrdering` is a pure function separated from the network call **so each rule can be watched
rejecting a real violation** without needing a model willing to misbehave on demand
(`check-s14-merge.ts` §F: a deliberately malformed ordering that invents 2, duplicates 1 and omits
2 is handled correctly on all four counts, and the omitted candidates are still in the merged list).

**Bounded in three places, all config:** `SEARCH_RERANK_CANDIDATES` (60),
`SEARCH_RERANK_SNIPPET_CHARS` (420), `SEARCH_RERANK_MAX_PENCE` (6p per query, checked BEFORE the
call). ⚠ The candidate cap is taken **round-robin** across streams: a cap in merged order would let
the model see only floor(N/S) of each stream, which is the rationing defect one layer up wearing a
model's face.

### 3.1 ⚠⚠ WHICH MODEL RAN, AND WHAT IT COST — AND THE ANSWER INVERTED MY OWN CHOICE

Both models, 64 queries each, **identical inputs** (the same cached retrieval pass), with the
**echoed** model checked on every call:

| | `gemini-2.5-pro` | `gemini-2.5-flash` |
|---|---|---|
| recall@20 (§5.2) | 18 of 64 | **19 of 64** |
| **recall@5** | 10 of 64 | **15 of 64** |
| **cost per query** | 2.551p (163.26p total) | **0.221p (14.17p total)** |
| **latency per query** | 34.7 s | **1.6 s** |
| **calls that completed** | **44 of 64** | **63 of 64** |
| echoed model matched the request | 44/44 | **64/64** |
| omitted / invented / duplicated | 3 / **0** / 2 | 18 / **0** / 1 |

▶ **Flash is 11.5× cheaper, 22× faster, better on both recall figures, and finishes 63 of 64 calls
against Pro's 44.** Pro exhausts its output budget on a third of queries *even with the full
thinking headroom*, because thinking tokens come out of the same ceiling. On a task whose entire
output is a permutation of sixty integers, the reasoning model's advantage does not appear and its
cost does. **The registry default is now Flash**, and this is a measured decision rather than the
failure the brief warns about — that is a pass running on the cheapest model available *without
anyone having looked*.

⚠ **Flash is sloppier about completeness and the enforcement is what makes that safe**: it omitted
**18** candidates across the run against Pro's 3. Every one kept its place behind the ranked ones
and was counted; neither model invented a single id.

▶ **The three enforcement rules earned their place.** *"Almost always a clean permutation"* is
exactly the state in which an unenforced version looks fine and loses the right answer on the
nineteenth query.

⚠⚠ **THE FIRST COST CEILING I SHIPPED WOULD HAVE REFUSED EVERY CALL, AND THE CHECK CAUGHT IT.** At
`gemini-2.5-pro`, 60 candidates and 420 characters each, the pre-call estimate is **4.34p** — of
which **~3.5p is the thinking allowance** (`LEX_THINKING_HEADROOM` = 4,000 tokens at pro's $10/M
output rate, and thinking tokens are billed as output whether or not they are spent). The ceiling
was 1.5p. **A guard that refuses the configuration it guards is the mirror image of a guard that
cannot fire** — and in a log it would have read as "the reranker never helped". There is now an
assertion that the shipped configuration fits inside the shipped ceiling.

### 3.2 ⚠⚠ TWO DEFECTS IN MY OWN §3, BOTH FOUND BY MEASUREMENT AND BOTH FIXED

**(i) The output budget was too tight, and 29 of 64 queries truncated.** `answerBudget` allowed six
tokens per candidate; the model pretty-prints (`"order": [\n    32,\n    51,`), so an integer costs
5–8, and the thinking allowance comes out of the same ceiling. Every one of the 29 **named itself** —
`cut off at maxOutputTokens=4512` — because CLAUDE.md §18's guard lives in the shared helper, so the
arm reported 35/64 applied rather than a silent 64/64 of nonsense. Fixed to 16 tokens per candidate
with a 2,048 floor (§18 rule 5: *"a generous ceiling on a call that emits a small JSON object costs
nothing"*), and the ceiling raised to 9p to match. **Re-measured, Flash then completed 63 of 64.**
⚠ **Pro still fails 20 of 64 even at the larger budget** — that is a property of the model on this
task, not of the budget, and it is half of why the default moved.

**(ii) ⚠⚠ THE FIRST MODEL COMPARISON WAS NEVER TAKEN — BOTH ARMS RAN `gemini-2.5-pro`.** The harness
set `LEX_MODEL__SEARCH__RERANKER`; `envVarFor('search.reranker')` is `LEX_MODEL__SEARCH_RERANKER` —
**one** underscore between SEARCH and RERANKER, because only the dot is replaced. The override set
nothing, `resolveModel` fell back to the registry default, and the two arms differed only by the
model's own non-determinism.

⚠ **The evidence was in the output the whole time and I read past it**: two models priced four times
apart returning **3.622p and 3.719p** per query, and **29.1 s and 30.4 s**. This is the
`grok-3-fast-beta` family — *"a 200 is not proof you got the model you asked for"* — with the
difference that `LlmUsage.echoedModel` already carried the answer and the harness simply did not
read it. **It does now, on every call, per arm**, and prints `model echoed back: n/64 matched "…"`
with a loud line naming any other model that answered. The variable name is computed by `envVarFor`
rather than written out. **The comparison in §3.1 is the corrected one** — 44/44 and 64/64 echoed
matches — and it is what changed the registry default.

---

## §4 — TWO THINGS CHARLIE ASKED FOR THAT ARE NOT RANKING

**Reported, scoped, NOT built.**

### 4.1 "Have we got everything the other models and the web orientation found?"

**The mechanism already exists and search is not the thing serving it well.** `lib/lex/build-smart.ts`
(`testVocabulary`) takes every statute, doctrine, regime, case, office, convention, institution and
mechanism the panel names, issues **one full routed `runSearch` per entity**, and then calls a term
CONFIRMED if `corpusMentions` finds its name inside `title + citation + snippet` of a returned
result.

⚠⚠ **It is loose where it retrieves and strict where it confirms, and the strict half sees about 2%
of a long document.** Retrieval is a bag of words — the keyword index is built `withPosition: false`,
so there are no phrase queries and *"Constitutional Reform and Governance Act 2010"* is matched as
seven independent terms. Confirmation is then an exact substring test over the DISPLAYED text, which
after S13 §3 is the matched passage — a few hundred characters of a document whose median in the
debates collection is ~2,357 words. **So "unverified" today conflates three different facts:** the
corpus does not hold it; the corpus holds it but retrieval did not return it; retrieval returned it
but the term is outside the shown passage.

**What search owes it is a `confirmEntity` primitive, not a search.** Three states, never two —
`HELD` / `NOT HELD` / `NOT SEARCHABLE HERE` — with the quoted evidence attached when held.

| entity kind | can it be answered exactly TODAY? | what it takes |
|---|---|---|
| **statute / SI** (most of them) | ✅ **yes, and cheaply** | one indexed lookup against `corpus_acts.title`. Verified this sprint: 250,808 rows, **135,531 titled**; `"Constitutional Reform and Governance Act 2010"` → `ukpga/2010/25` exactly, `"Equality Act 2010"` → `ukpga/2010/15` exactly. **No search call, no LLM call, no routing.** This alone removes ~30 routed searches per build. |
| **doctrine / office / convention / mechanism** | ❌ no | `"Osmotherly Rules"` → 0 rows in `corpus_acts`, correctly: it is not an instrument. An exact multi-word test needs either **token positions in the FTS index** (a full rebuild — `CLAUDE.md` §17's 19.8 GB heavy job, not a config change) or a body-level `contains` pass outside the ranked path. |

⚠ **This is the direct defence against a user getting a better answer from their own chat window**,
and the honest position today is that the defence reports UNVERIFIED for things the corpus contains.

### 4.2 "Results relevant for unusual reasons — would the user like to know?"

**The signal the brief proposes is the right one, and all three of its components exist today.**
A candidate is *unusually relevant* when it is: **high semantic relevance · low keyword overlap ·
from a stream the router did not prioritise.**

| component | available today? | where it is |
|---|---|---|
| high semantic relevance | ⚠ **computed and then discarded** | the dense ranking exists inside `fusedStream`, but `fuseWeightedRrf` overwrites `score` with the fused value and the separate dense rank is not carried onto `SearchResult`. It IS reachable without a re-index through `captureLegs` — the S10 §3 leg-capture seam, which sits in the production path and is inert unless a sink is installed. |
| low keyword overlap | ✅ yes | `coverageOf` in `lib/lex/term-coverage.ts`, over the matched passage. Needs `snippetMatched`, which is deployed. |
| stream the router did not prioritise | ✅ yes, but only behind a flag | `streamRanking`, built this sprint (§1.4). Before it there was no per-stream priority at all. |

▶ **So: no re-index, no new retrieval, and no model call.** What is missing is one field —
`denseRank` carried out of `fusedStream` onto `SearchResult` — and a rule over the three. **Not
built**, because the rule's threshold is exactly the kind of number that would be fitted to 64
questions, and because the surface that would show it does not exist yet.

⚠ **It is also the retrieval half of the mechanism-analogue design**, which `SEARCH_CONTRACT.md` §3
records as reserved and unscheduled. Naming it in the code is not scheduling it.

---

## §5 — THE RE-MEASURE

`scripts/measure-s14-merge.ts` · raw data `docs/census/s14-arms-bm25.json`.
**Index of record: `corpus_fts` v7308 / 18,272,377 rows · `corpus_vec` v4011 · `corpus_chunks`
v18447** — stamped either side of the run, and they matched. ⚠ **That is the same index S13
measured against**, so the two are directly comparable.

### 5.1 ⚠⚠ WHAT CONFIGURATION THESE NUMBERS DESCRIBE, BEFORE ANY OF THEM

**Keyword only. `LEX_VECTOR_STREAMS` empty. The dense legs are not in these figures.**

That is a deliberate, disclosed choice and not an oversight: §0 established that under the confirmed
four-stream production string the dense legs *do not return*, so a run with that string set would
have produced **the same keyword-only rankings while claiming a dense configuration.** Taking it
with dense explicitly OFF makes the state legible instead of implied. The harness refuses to run
degraded without `--allow-degraded`, prints the degradation next to the headline, and records it in
the JSON's `degraded` field.

⚠ **What that costs, and it is not small.** Comparing like for like against S13, which ran with one
dense stream (`legislation`):

| | S13 (dense on `legislation`) | S14 (no dense) |
|---|---|---|
| **in-stream@20** — what retrieval finds in some stream's own list | 27/64 (42%) | **19/64 (30%)** |
| **merged@20** — what a caller sees | 15/64 (23%) | **14/64 (22%)** |

*(S13's published figures are over n = 65; Q15 is removed from both columns here so the denominators
match.)* **Dense retrieval was worth about twelve points of in-stream recall**, and §0 says it is
currently not arriving. ▶ **That is a bigger number than anything the merge does**, and it is why
D-1 comes before D-2.

⚠ **The ARM COMPARISON is unaffected by any of this.** Every arm is computed from ONE retrieval
pass, so they differ only in the merge. What is not comparable is the absolute percentages against
a dense run.

**What this supersedes, named explicitly:** S13's **merged@20 = 15/65 (23%)** and **in-stream@20 =
28/65 (43%)** were taken with `LEX_VECTOR_STREAMS=legislation`, which is not what production reads.
The figures below **supersede them as the baseline for the merge**, and **do not** supersede them as
a statement about dense retrieval — on that, S13's are the only measured numbers there are, and §0
is the reason there are no newer ones.

### 5.2 THE ARMS — recall@20, per collection, n on every figure

**n = 64.** V2-Q15 excluded (D-3, approved): its keyed section's stored body is 66 characters of dot
leaders, so it can never score and counting it would report a corpus gap as a ranking failure.

| collection | n | in-stream@20 | **A** round-robin | **B** confidence | **B** gate | **B** both | **C** rerank pro | **C** rerank flash |
|---|---|---|---|---|---|---|---|---|
| caselaw | 6 | 3 (50%) | 2 (33%) | 3 (50%) | 2 (33%) | 2 (33%) | 2 (33%) | **3 (50%)** |
| committees | 10 | 1 (10%) | 0 (0%) | 1 (10%) | 0 (0%) | 1 (10%) | 1 (10%) | **2 (20%)** |
| consultations | 9 | 6 (67%) | 5 (56%) | 4 (44%) | 6 (67%) | 4 (44%) | **6 (67%)** | **6 (67%)** |
| **debates** ⚠ | 11 | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) | **1 (9%)** | **1 (9%)** |
| guidance | 10 | 7 (70%) | 5 (50%) | 4 (40%) | 3 (30%) | 4 (40%) | **6 (60%)** | **6 (60%)** |
| impact-assessments | 9 | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) |
| legislation | 9 | 2 (22%) | 2 (22%) | 2 (22%) | 0 (0%) | 1 (11%) | 2 (22%) | 1 (11%) |
| **ALL** | **64** | **19 (30%)** | **14 (22%)** | **14 (22%)** | 11 (17%) | 12 (19%) | **18 (28%)** | **19 (30%)** |
| **@5** | 64 | — | 6 (9%) | 8 (13%) | 6 (9%) | 6 (9%) | 10 (16%) | **15 (23%)** |

⚠⚠ **THE HEADLINE IS THE LAST CELL OF THE `ALL` ROW: 19 of 64 — WHICH IS in-stream@20 EXACTLY.**
**The reranker displays everything retrieval found.** The gap this whole sprint exists to close —
the answer being *found* and not *shown* — is closed on this set, by this arm, to the last question.
Round-robin showed 14 of the 19; the reranker shows 19 of the 19.

▶ **And @5 is the figure a user feels: 6 → 15 of 64, two and a half times.** ⚠ Note the two
reranker arms differ far more at @5 (10 vs 15) than at @20 (18 vs 19); ordering the very top of the
window is where the models actually diverge, and it is not the reasoning model that wins it.

⚠ **debates gains a question that in-stream@20 says was not there.** Its key sits at in-stream rank
39 (V2-Q2), outside the top 20 of its own stream — so the reranker promoted it from deeper in the
pool than the "in-stream@20" column measures. That column is a ceiling on what a *rank-preserving*
merge can show, not on what a judged one can.

⚠ **The debates figures are PROVISIONAL and must be read as such.** The re-key
(`docs/GOLD_V2_DEBATES_REKEY.md`) is with Charlie and is not part of this sprint. Nine of the eleven
were NOT-RETRIEVED in S13 — a retrieval problem no merge change can reach.

⚠ **impact-assessments is 0/9 in-stream**, so every arm is 0 by arithmetic. Four of those nine were
NOT-ROUTED in S13; nothing here is evidence about them.

### 5.3 ⚠⚠ THE NET HIDES THE SHAPE, AND THE SHAPE IS THE FINDING

Against arm A, over the 29 questions where both arms found the key somewhere:

| arm | gained | lost | net | ranks moved | ⚠ the worst single loss |
|---|---|---|---|---|---|
| **B** confidence | 4 | 4 | **0** | 21/29 | S10-Q26: in-stream **2** → merged **64** |
| **B** gate | 1 | 4 | −3 | 22/29 | S10-Q26: in-stream 2 → merged **143** |
| **B** both | 3 | 5 | −2 | 24/29 | S10-Q26: in-stream 2 → merged **161** |
| **C** rerank pro | 5 | **1** | **+4** | **16/29** | S10-Q15: in-stream 6 → merged 26 |
| **C** rerank flash | **6** | **1** | **+5** | 21/29 | V2-Q12: in-stream 0 → merged 27 |

▶ **The deterministic arms are S13's coverage arm again, with the same signature**: a
high-variance re-ordering with a near-zero mean, moving three quarters of the rankings to buy
nothing, and taking documents their own stream ranked SECOND to merged rank 143 and 161. **A signal
that can do that is not ready to be the default ordering, whatever its headline says.**

▶ **The reranker arms are the only ones with a different shape — they gain five or six and lose
one.** ⚠ And the one they lose is the shape to watch: Flash took V2-Q12, a document its own stream
ranked FIRST, to merged 27. **A model that can do that once in 64 can do it to the answer**, which
is precisely why the enforcement counts every deviation and why D-4 is a decision rather than a
recommendation.

⚠ **Every gain is a document deeper than floor(20/S) in its own stream** — S10-Q3 at in-stream 16,
S10-Q4 at 47, S10-Q21 at 14, V2-Q2 at 39. Those are exactly the documents S13's arithmetic said
could never be displayed. That is the mechanism working, not a coincidence of the set.

### 5.4 §2's ACCEPTANCE CRITERION, MEASURED

Over the **40 of 64 questions routing three or more streams** — a one-stream question has no merge
at all, and 20 of the 64 route exactly one:

| arm | mean max share of the 20 | questions where ONE source took >8 of 20 | max observed |
|---|---|---|---|
| **A** round-robin | 5.5 | **0 of 40** | **7** |
| **B** confidence *(decay 0.35)* | 19.9 | 40 of 40 | 20 |
| **B** gate | 8.1 | 12 of 40 | 12 |
| **B** both | 15.2 | 40 of 40 | 20 |
| **C** rerank pro | **9.5** | 26 of 40 | 16 |
| **C** rerank flash | 12.0 | 36 of 40 | **19** |

▶ **The round-robin cannot exceed 7 of 20 and never does.** That is the arithmetic ceiling, visible
as a measurement rather than as an argument. Every judged arm can and does exceed it. **Charlie's
rule is satisfied.**

⚠⚠ **AND THE CONFIDENCE ARM OVERSHOOTS IT COMPLETELY.** 19.9 of 20, on 40 of 40 questions, is not
*"it might be that one source has all the top 20"* — it is *one source always does*. That is a
defect in the weight scale I chose, it is diagnosed in §1.4's note, and the shipped decay has been
corrected from 0.35 to 0.07 on the arithmetic. ⚠ **The arm above was measured at 0.35 and the
shipped default is therefore UNMEASURED**; `check:s14-merge` §H asserts the constant against the
policy it claims, and watches 0.35 fail that assertion.

▶ **The reranker sits where the brief wanted: a mean of 9.5–12 of 20, up to 19 when it judges that
right, and — unlike the confidence arm — arrived at per question rather than by construction.** Pro
is the more conservative of the two (26 of 40 concentrated, max 16); Flash concentrates harder
(36 of 40, max 19) and scores better, which is a real trade and is D-4's.

### 5.5 THE RELEVANCE-FLOOR SWEEP — the shape, not the winning point

| gate | 0 | 0.1 | 0.2 | 0.25 | 0.34 | 0.4 | 0.5 | 0.6 | 0.75 |
|---|---|---|---|---|---|---|---|---|---|
| hits@20 of 64 | 14 | 14 | 14 | 14 | **11** | 11 | 12 | 15 | 15 |

**It is not a curve. It is noise with a dip in the middle.** A gate that admits everything (0) and a
gate that admits almost nothing (0.75) score within one of each other, and the only clear structure
is a *loss* in the middle of the range. **There is no value here to adopt**, and adopting the 0.6
that happens to score 15 would be fitting a threshold to the two questions that separate it from 14.
`SEARCH_RELEVANCE_FLOOR` therefore ships **UNSET** — no gate. *(⚠ These sweep figures skip the
hollow-repeal suppression the arm table applies, so they are comparable with each other and not with
§5.2.)*

### 5.6 §1(b) MEASURED SEPARATELY, BECAUSE IT IS NOT A MERGE CHANGE

| | without the ranking question | with it |
|---|---|---|
| router calls | 64 | 64 |
| **mean streams routed** | **2.91** | **3.69** |
| selection unchanged | — | 37 of 64 |
| narrowed | — | **0** |
| widened | — | **27** |
| usable `streamRanking` returned | — | **64 of 64** |
| truncated (`MAX_TOKENS`) | 0 | **0** |

▶ **Asking the question makes the router route MORE streams, on 27 of 64 questions.** That is a
retrieval change, and under the round-robin it would *reduce* every stream's window share — the
exact thing Charlie's rule forbids. Under the judged merge it does not. **The two halves of this
sprint interact, and this is where.**

⚠ The 0-of-64 truncation figure is the corrected `streamRanking` encoding. The numeric encoding it
replaced truncated **12 of 55** (§1.4).

### 5.7 THE CONTROLS

| | |
|---|---|
| this harness's arm A vs `runRoutedSearch`'s own merge, on the live call's own lists | **IDENTICAL, 3 of 3** |
| retrieval reproducibility — a second independent pass, top-20 overlap | **20, 20, 20 of 20** |
| the echoed model matched the requested one | **44/44 (pro), 64/64 (flash)** |
| index stamps either side of the run | matched — the corpus did not move |
| service engagement, retrieval pass | `fts +749`, i.e. the run reached the service 749 times |
| fan-out | 1 stream × 20q · 2 × 4q · 3 × 15q · 4 × 12q · 5 × 13q |

⚠ **The arm table above was computed from a REPLAYED retrieval pass** (`--load-retrieval`), taken
14:13 UTC and replayed at 14:43 after a model-selection bug was fixed. That is disclosed on the
console, in the JSON's `retrievalReplayedFrom`, and here. The replay **refuses to run if the index
stamp has moved**, and it had not. Replaying is what makes the two model arms comparable at all:
they read byte-identical candidate lists. ⚠ It is also why this run's own engagement line reads
`fts +9 · vector +0 ⚠ NOT ENGAGED` — correct, and exactly what a replay should say.

⚠ **20 of the 64 questions route exactly ONE stream. There is no merge on those at all, so no merge
change of any kind can reach them** — which caps what any arm in §5.2 could have done.

⚠⚠ **The reproducibility control had to be rewritten mid-sprint, and the reason is worth keeping.**
Its first version compared this harness's arm A against a FRESH `runRoutedSearch` call, which
measures the merge and a second independent retrieval at once. On the dense-enabled run it reported
11 of 20 and read as *"the recomputation is not the pipeline"* — when what had actually moved was
retrieval, because the dense legs were timing out non-deterministically (§0). It is now two separate
checks: an EXACT one about the merge, on the live call's own per-stream lists, which no retrieval
noise can reach; and reproducibility reported as a NUMBER rather than as a verdict.

---

## §6 — WHAT IS NOT DONE, NAMED

1. **❌ The arm table has NOT been taken with dense retrieval arriving.** §0 is why: the dense legs
   do not return under the four-stream fan-out, and the queue does not drain while anything is
   feeding it. The keyword-only figures are labelled on every table and in the JSON's `degraded`
   field. **This is the largest gap in the report and it is an infrastructure gap, not a ranking
   one** — and §5.1 sizes it at about twelve points of in-stream recall, which is larger than
   anything the merge does.
   ▶ **It is now cheap to close once D-1 is settled:** the harness saves and replays a retrieval
   pass (`--save-retrieval` / `--load-retrieval`, refusing if the index stamp has moved), so a
   dense-enabled re-take costs one retrieval and every arm recomputes from it.
2. **❌ No parameter is tuned, deliberately.** The relevance-floor sweep's SHAPE is reported and no
   point value is adopted; `SEARCH_RELEVANCE_FLOOR` ships UNSET, i.e. no gate. The rank-weight
   decay (0.35) is chosen from arithmetic — it is the value at which the top-ranked stream's
   rank-19 result can outrank the bottom-ranked stream's rank-0 — and not from a recall curve.
   **I decline to change** the fusion weight, the RRF constant `k`, the stream floor on the
   round-robin path, the `limit` fan-out, and the reranker's candidate cap. Nothing in this sprint
   is evidence about any of them.
3. **❌ §4.1 and §4.2 are scoped and NOT built**, as the brief requires. §4.1's cheap half — exact
   statute confirmation against `corpus_acts.title` — is a genuinely small piece of work and is
   Lex-owned, not search-owned, so it is reported rather than done.
4. **❌ No client-side circuit breaker for the dense leg.** §0's collapse is made worse by the
   client: `runVectorSearch` abandons a request at 25 s and the next query issues four more. A
   breaker — stop issuing dense calls after N consecutive timeouts, for a cooldown — is squarely
   search-owned and would stop the feedback loop from this side. **It is not built because the
   brief did not ask for it**, and building an unrequested capability into the retrieval path in
   the same sprint as a merge change would make both unattributable. Recommended as the first item
   of the next sprint.
5. **❌ Nothing owned by ingest, graph or lex was edited.** `scripts/ingest/search/*` is untouched,
   so **no service redeploy is required by this sprint** — every change is in `scrutinise-web` and
   reaches production through Vercel. The two changes `vector-serve` needs are named in D-1 and are
   ingest's to make.
6. **⚠ `check:score-scope` fails on `lib/question-library.ts:250` and `:337`** — a bare
   `.sort((a, b) => b.score - a.score)`. **It is not this sprint's**: the file is committed at
   `4ffec90` (`feat(central): answer votes reach the ledger…`) and is clean in the working tree, so
   the check has been failing on Main since then. Reported to CENTRAL rather than fixed here.

---

## §7 — DECISIONS FOR CHARLIE

**D-1 · ⚠⚠ `vector-serve` CANNOT SERVE FOUR DENSE STREAMS. Which way do you want it fixed?**
This is the only decision here about something that is happening on a running service.
*Recommendation: cap the dense fan-out to two streams NOW (a one-line change to
`LEX_VECTOR_STREAMS` in Vercel), and fix the service properly in the next ingest sprint.*
The three durable fixes, cheapest first: **(i)** have `vector-serve` drop a queued request whose
client has disconnected — today a timed-out leg is still executed, so a client abort ADDS load;
**(ii)** lower `chunkOverscan` (5) or `nprobes` (64), which is what makes a 60-row request 600 ANN
probes; **(iii)** more replicas, which costs money and is the answer only if (i) and (ii) are not
enough. *Consequence of leaving it:* dense retrieval contributes nothing on any query, silently,
and every routed query pays a 25-second stall to find that out. ⚠ **I cannot confirm this is
production's behaviour** — `VERCEL_TOKEN` is SAML-blocked (`CLAUDE.md` §19) and I can read the
services but not the app's environment. **What settles it in a minute: read `warm_p95_ms` and
`concurrency.queued` off `vector-serve/stats` at a busy moment when nobody is running a harness.**

**D-2 · `LEX_SEARCH_JUDGED_MERGE` — turn it on, but only together with D-4.**
On its own, with no reranker and no gate, it is a no-op by construction (§5.2's arm A and the
degenerate-case assertion). **It is the mechanism the reranker needs**, not an improvement in
itself. *Consequence of turning it on:* one source can hold the whole window, which is what you
asked for; a stream that finds nothing relevant can also be absent from the window entirely, which
the round-robin's floor of 2 currently prevents. **The protection moves from a quota to a
measurement** (`meta.merge.windowShare`, returned and logged on every routed search). ⚠ It also
raises the per-stream retrieval budget to 20, which makes D-1 worse — so **D-1 first.**

**D-3 · `LEX_ROUTER_CONFIDENCE` — I do NOT recommend turning it on, and the reason is not its
ordering effect.** Asking the routing question changes what the router SELECTS: 27 of 64 questions
routed MORE streams, mean fan-out **2.91 → 3.69**. A stream that is not routed cannot be recovered
by any ordering, and a stream that IS routed costs a dense call. So (b) is a retrieval change
wearing a ranking change's clothes. *Consequence of turning it on anyway:* about 0.8 extra streams
per query against the service in D-1, for the ordering gain in §5.

**D-4 · ⚠⚠ `LEX_SEARCH_RERANKER` IS THE ONE THING IN THIS SPRINT THAT WORKS, AND I RECOMMEND
TURNING IT ON — AFTER D-1.**
It takes merged@20 from **14 to 19 of 64, which is in-stream@20 exactly**: everything retrieval
found is displayed. **@5 goes 6 → 15 of 64.** On `gemini-2.5-flash` that costs **0.221p and 1.6 s
per query** — the latency sits inside the noise of a routed search that already takes seconds.
*Recommendation: yes, with the judged merge (D-2), once D-1 is settled.*
⚠ **What you are accepting:** one model call on the critical path of every routed search; a model
that omitted 18 of 3,780 candidates from its ordering across the run (each counted, none dropped);
and one question in 64 where it took a document its own stream ranked FIRST down to merged 27.
⚠ **The model default moved from `gemini-2.5-pro` to `gemini-2.5-flash` on the measurement**, which
reverses the choice I made on reasoning — §3.1. Pro is one env override away if you disagree, and
its numbers are in the same table.
*Consequence of leaving it off:* the deterministic arms are what you get, and §5.3 shows those are
S13's coverage arm again — churn without a gain.

**D-5 · `SEARCH_RELEVANCE_FLOOR` ships UNSET — do you want a value?**
*Recommendation: no, not from this evidence.* The sweep's shape is in §5. A value picked off a
64-question curve is a value fitted to 64 questions, and this project has the receipts for what
that costs.

**D-6 · The `check:score-scope` failure in `lib/question-library.ts` is CENTRAL's, not search's**
(§6.6). *Recommendation: hand it to that thread.* It has been red on Main since `4ffec90`.
