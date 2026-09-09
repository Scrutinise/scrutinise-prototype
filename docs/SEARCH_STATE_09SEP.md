# SEARCH — STATE OF THE STACK, 9 SEPTEMBER 2026

**Answers:** `docs/SEARCH_HANDOVER_BRIEF.md` (9 August 2026), item by item.
**Written:** 2026-09-09, 04:00–06:00 UTC. **State report only — nothing was fixed, nothing built.**
**Method:** every claim is checked against what is *deployed and running*, not against the working
tree. Where a fact could only be had from the tree, it is labelled as such and its deployment status
is stated.

---

## §0 — THE GROUND TRUTH EVERYTHING BELOW IS MEASURED AGAINST

Read at 04:05–04:20 UTC on 9 September 2026. Clock cross-checked against Cloudflare's HTTP `date`
header before any stamp in this file was written (both `2026-09-09 04:17 UTC`).

### The web app

| | |
|---|---|
| **Deployed commit** | `3f205a257573b23c14946bef8e2698b47c8c7b7d` (`3f205a2`) |
| commit message | `docs(graph): GRAPH 5 — the report, the validation sheet Charlie scores, and six decisions` |
| `env` | `production` · `build.driver` = `worker` |
| `origin/Main` | `3f205a2` — **identical** |
| local `HEAD` | `3f205a2` — **identical** |

**Production is at the tip of `Main`.** That is not the usual state of this project and it is worth
recording: the 12 August incident ("production has not deployed since 6–9 August") does not recur here.

### ⚠⚠ THE `[capabilities]` BOOT LINE, LIVE

Read from `https://www.scrutinise.org/api/health` — **the production domain** — and confirmed
byte-identical against the Vercel origin `scrutinise-prototype.vercel.app`.

```
LEX_QUERY_EXPANSION      true      LEX_SEARCH_JUDGED_MERGE  true
LEX_QUERY_ROUTER         true      LEX_TIER_FUSION          true
LEX_SEARCH_VECTOR        true      LEX_STATS_STREAM         true
LEX_SEARCH_RERANKER      true      LEX_WEB_ORIENTATION      false
LEX_SEARCH_GRAPH         false     LEX_COHERENCE_CORPUS     false
LEX_SEARCH_STUB          false     LEX_BUILD_PERSPECTIVES   false
LEX_ROUTER_STREAMS_V2    false     LEX_FUSION_WEIGHTS       false
LEX_ROUTER_CONFIDENCE    false     LEX_ROUTER_APPRAISAL     false

retrieval: vectorSearchUrl ✓  ftsSearchUrl ✓  geminiKey ✓
vectorStreams: caselaw, committees, debates, guidance, legislation   ← ALL FIVE
```

### ⚠ A SECOND DOMAIN IS DOWN — `scrutinise.co.uk`, NOT PRODUCTION

**Production is fine. `scrutinise.co.uk` is not.** Both domains, checked at the same moment, from
the same machine, with the same browser User-Agent:

| domain | result |
|---|---|
| `www.scrutinise.org/api/health` | **200** — the payload above. DNS resolves **straight to Vercel** (`216.198.79.65`, `64.29.17.65`) |
| `scrutinise.org/api/health` | 308 → `www` (correct) |
| `scrutinise.co.uk/api/health` · `www.scrutinise.co.uk/api/health` | **522 Connection timed out** |
| `scrutinise.co.uk/` and `/sign-in` | **522** |
| the same `.co.uk` URL in Chrome, two fresh tabs, twenty minutes apart | tab title **"522: Connection timed out"** |

`scrutinise.co.uk` is **Cloudflare-proxied** (`104.26.4.251`, `104.26.5.251`, `172.67.72.38`) and 522
means Cloudflare could not reach the origin behind it. `scrutinise.org` is not proxied at all.

⚠⚠ **A CORRECTION TO MY OWN WORKING, RECORDED BECAUSE IT IS THE POINT.** I reached for
`scrutinise.co.uk/api/health` first — because that is the URL `CCW-B14a_run_twelve_builds_REVISED.md`
uses — got 522, and was one edit away from opening this report with "production is down". It is not.
`docs/CLAUDE.md` §9 names `https://www.scrutinise.org` as `NEXT_PUBLIC_APP_URL`, and reading that is
what caught it. **§0's own rule — verify before asserting, and an error on one path is not a
site-wide conclusion — applied to me, on the first fact in the report.**

▶ **The finding that survives, and it is smaller but real:** `scrutinise.co.uk` is broken at the
Cloudflare edge, and at least one workstream's own documentation points health checks at it. That is
a Cloudflare/Vercel domain configuration matter for Charlie — the Vercel token here is SAML-blocked
(`docs/CLAUDE.md` §19) — and until it is fixed, **any check written against `.co.uk` will fail for a
reason that has nothing to do with what it is checking.**

### The Railway services — and they are NOT all on `3f205a2`

| service | running build | deployed | note |
|---|---|---|---|
| `Ingest` | `3f205a2` | 2026-09-08 22:23 UTC | current |
| `Ops` | `3f205a2` | 2026-09-08 22:23 UTC | current |
| **`build-worker`** | **`15bafe1f`** | **2026-09-03 10:36 UTC** | ⚠ **53 commits behind, 11 of them in `lib/lex/`** |
| `fts-serve` | build tag `S16-fts-cancel-bounded` | process up since 2026-08-28 00:03 UTC | last 25 Railway deployments all `SKIPPED` |
| `vector-serve` | build tag `S15-cancel-bounded-batch` | process up since 2026-08-28 00:03 UTC | last 25 Railway deployments all `SKIPPED` |

⚠ **The build-worker is the SHA that matters most in this report**, because the Restoration Programme
builds run through it. The eleven `lib/lex/` commits it does not have include both of September's
search fixes — `f9cda19` *"PRECEDENT told 952 instruments nobody had reviewed them"* and `58bc24b`
*"the COST AND BENEFIT block"*, both 7 September.

⚠ `fts-serve` and `vector-serve` show 25 consecutive `SKIPPED` deployments, so their Railway rows
say nothing about what code they run. Their processes report uptime of 12.17 days — continuous since
28 August, i.e. `sleepApplication` (enabled 27 Aug) has not put either to sleep. Their own `/stats`
is the evidence of record and is quoted under Gap 2.

---

## §2a — THE TRUNCATION FIX. **CLOSED, AND MORE THAN THE BRIEF ASKED FOR.**

### Is `finishReason` checked in the shared `callGeminiJson` helper?

**Yes.** `scrutinise-web/lib/lex/query-expansion.ts:157` calls `geminiFinishProblem(candidate, …)`
**before** the first `JSON.parse`, and returns `{ kind: 'fail', reason: 'truncated' | 'blocked' }`.
The guard itself is a separate shared file, `lib/lex/gemini-finish.ts`, applied at every JSON call
site rather than at this one — the audit on 9 August found **seven** JSON-mode sites with no check,
including the tool decider at a 256-token budget where truncation did not throw at all but silently
returned "no tool wanted".

`check:llm-guards` enforces it as a **source** invariant (that the check precedes the first
`JSON.parse`), because a behavioural test only catches the site it exercises and this class had
already moved four times.

### Is the `maxOutputTokens` cap on the routing call raised?

**Yes — 512 → 4,096.** `DEFAULT_MAX_OUTPUT_TOKENS = 4096`, and the router call takes it via
`QUERY_ROUTER_MAX_TOKENS ?? DEFAULT_MAX_OUTPUT_TOKENS`. Two further changes went with it, and they
are what actually made routing reliable:

- **the timeout, 10 s → 25 s.** Measured on 9 August, the truncation fix alone left 8/10 dispatched
  and *both* failures were `timeout` at exactly 10,000 ms — no bad-JSON at all.
- **partial-route salvage.** A truncated payload is the one failure with something left in it; the
  JSON emits `legislation` first, so a cut response usually still holds complete stream pairs. They
  are recovered and the outcome is logged as `partial` rather than lost.
- `maxLength` in the schema was tried and **reverted after one measured pass** — Gemini's
  `responseSchema` does not honour it and supplying it destabilised generation (3/12 dispatched).

### The commits, and the deployed SHA that contains them

| commit | date (UTC) | what |
|---|---|---|
| `b5319bf` | 2026-08-08 22:50 | the router was failing open on truncation, disguised as bad-json — **the 512 → 4,096 raise** |
| `414b6fb` | 2026-08-09 09:12 | **one shared truncation guard** (`gemini-finish.ts`), applied at every JSON call site |
| `6f61ae0` | 2026-08-09 09:30 | ordering harness + 20 preference pairs; **router timeout 10 s → 25 s**; `maxLength` reverted |
| `b379ce8` | 2026-08-09 13:11 | **salvage a partial route**, cap query length, count every outcome |

**All four are ancestors of the deployed `3f205a2`** (`git merge-base --is-ancestor`, each checked
individually). The fix is in production.

### ⚠ THE PROOF THAT ROUTING ENGAGES — THE FOUR AUGUST QUESTIONS, RE-RUN

The four real questions recorded in `CHANGE_LOG` at 2026-08-08 15:04 UTC, put through the **real**
`routeQueryDetailed` (no reimplementation), **three passes** — because the failure being tested is
intermittent and one pass measures the sample, not the system.

```
route_outcome totals: { full: 12, partial: 0, failed: 0, disabled: 0 }
```

| | question | August | today (3 passes) |
|---|---|---|---|
| Q1 | *what is the law on data protection* | dispatched — **1 stream** | **5 / 5 / 5** streams |
| Q2 | *how have select committees scrutinised water company pollution* | dispatched — 4 streams | **1 / 1 / 1** stream |
| Q3 | *what powers do regulators have to compel disclosure of information from companies* | **FAIL-OPEN `bad-json`** | **5 / 5 / 5** streams |
| Q4 | *leasehold reform* | **FAIL-OPEN `bad-json`** | **4 / 4 / 4** streams |

**12 of 12 calls produced a routing decision. None fell back. None was a salvaged partial.** The two
questions that failed open in August — including `leasehold reform`, recorded on 9 August as *"the
reliable offender"* for the runaway — now route cleanly and identically on every pass. Router log
lines, verbatim, one per question per pass, e.g.:

```
[query-router] route_outcome=full streams=legislation,debates,committees,caselaw,guidance
               totals=full:3/partial:0/failed:0/disabled:0
     · legislation  "statutory powers information disclosure regulatory enforcement"
     · debates      "regulator powers compel information disclosure companies"
     · committees   "select committee inquiry regulatory powers information disclosure"
     · caselaw      "judicial review disclosure powers regulatory enforcement"
     · guidance     "regulator information disclosure powers enforcement guidance"
```

A second, independent confirmation came free: the §2c ordering run below dispatched **17 more
questions on the production flag string and logged `full:17 / partial:0 / failed:0`.** Across both,
**29 of 29 routing calls succeeded.**

⚠ **Two honest qualifications, neither of which weakens the answer.**

1. **Q1 asked for five stream queries and got them; Q2 asked for five and got one.** Q2 has *narrowed*
   since August (4 streams → 1, stably, on all three passes). That is not a failure — the router is
   reading "*how have **select committees** scrutinised…*" as a committees question and scoping to it —
   but it means a question naming a stream now gets no legislation or case-law context at all. It is a
   routing *judgement* to review, not a routing *defect*, and it did not exist in August.
2. This ran against the local `.env` with production's flag values supplied explicitly. `GEMINI_API_KEY`,
   the model registry and the router code are the deployed ones; `LEX_ROUTER_CONFIDENCE` is off in both,
   which the absent `streamRanking=` in every log line confirms.

⚠ These 12 calls wrote 12 rows to the production `LlmSpend` ledger (`search.query-router`, ~£0.005
total). They are why that pass shows a `last_seen` of today in §Gap 8 below, and the figure there is
given with and without them.

---

## §2b — THE BENCHMARK. **NOT RE-RUN UNDER PRODUCTION'S CONFIGURATION, AND THE AUGUST FIGURES HAVE NO SUCCESSOR BY CONSTRUCTION.**

The honest answer has two halves and the second is the important one.

### The +15.3 pp and +10.0 pp cannot be restated, because the ruler was replaced

Those two numbers were archetype-level gains on **gold v1** — archetype B (concept) 33.3% → +15.3 pp,
archetype A (citation) 60.0% → 70.0% = +10.0 pp. **Gold v1 was retired.** GOLD v2 was authored 21
August, **validated by you on 22 August** (24 of 24 reviewed — 22 ACCEPT, 2 AMEND, 0 REJECT) and
baselined on 23 August. S12 states the position in terms: *"⚠⚠ **NOT a delta against S10's 34% —
those numbers are VOID, not a comparison point.**"*

So there is no "concept score now" and "citation score now" against those two figures. Reporting one
would mean quoting a v2 number as if it continued a v1 series, which is the exact error S12 refused.

### What there IS: the S15 baseline, 27 August, and it is the last figure of record

The first non-degraded multi-stream measurement this project has had (`degraded: []`,
`fully-configured`, index stamps matched either side, n = 64):

| arm | recall@20 |
|---|---|
| **in-stream@20** — what retrieval actually finds | **32 / 64 (50%)** |
| **merged@20, round-robin** — production *before* the judged merge | **19 / 64 (30%)** |
| **merged@20, judged merge + reranker** — production's configuration *today* | **30 / 64 (47%)** |
| **@5, judged + reranker** | **26 / 64 (41%)** |

Dense retrieval is worth **thirteen points** of in-stream recall (19 → 32), against S14's prediction
of "roughly twelve".

⚠⚠ **And the sentence S15 asks be read before any of it:** *with the round-robin configuration, 45 of
64 questions return nothing correct; with the judged merge and reranker on, 34 of 64; and a perfect
merge could only ever reach 32 of 64, because for half the set retrieval finds nothing at all.*
`debates` scores **0/11 on every arm**. `committees` **2/10**.

### ⚠⚠ THE GAP THAT MATTERS: THE INSTRUMENT AND THE PRODUCT ARE DIFFERENTLY CONFIGURED

This was found by S17 on 28 August, **the first hour `/api/health` existed**, and it is still open:

> *"Production runs with `LEX_SEARCH_JUDGED_MERGE` ON, `LEX_QUERY_EXPANSION` ON and
> `LEX_SEARCH_RERANKER` ON. Every gold harness run since S14 records `QUERY_EXPANSION=off`… **The
> instrument and the product are differently configured, and nobody could see it until this endpoint
> existed.**"*

S17 raised it as **D-6 — re-take the baseline under production's real flag string.** S18, on
7 September, records D-6 as *"still outstanding and this sprint does not close it"*. **It is still
outstanding today.** Two concrete divergences I confirmed:

- the harness runner `scripts/s15-run.sh` defaults to `LEX_VECTOR_STREAMS=legislation,caselaw,guidance,committees` — **four streams, no `debates`**. Production runs **five**.
- every arm in S14 was taken keyword-only (`streams=NONE … DEGRADED(1)`); S15 supersedes it, but S18's own header still records `SEARCH_VECTOR=off SEARCH_RERANKER=off TIER_FUSION=off`.

▶ **Closing D-6 is the single highest-value measurement outstanding on the search stack.** It is one
run of the existing harness under the flag string in §0 — no new instrument, no build. I did not run
it here because it is a 64-question multi-arm run and this brief is a state report; §2c below closes
the *ordering* half of it, which was the cheap half.

---

## §2c — THE ORDERING BASELINE. **PAIRS EXIST, BUT NOT WHERE THE BRIEF PUT THEM — AND TODAY'S SCORE IS 100%.**

### Do `prefer` pairs exist on `GoldQuery`?

**No — and that is a deliberate, documented relocation, not an omission.** `GoldQuery`
(`scripts/ingest/search/gold-queries.ts:50`) has **no `prefer` field**; the brief's
`prefer?: {above, below, why}` was never added there.

The pairs live instead in `scrutinise-web/scripts/gold-preferences.ts`, with the reason written at
the top of the file: *the metric measures the **production ranking**, and only the web app can produce
it — `runSearch` owns routing, per-stream fusion and the weighting. The ingest-side `gold-queries.ts`
scores the serve services directly, which is a different (and also useful) thing.*

### How many?

| | |
|---|---|
| pairs authored | **20**, across 17 distinct queries |
| **scoreable** (`within-stream`) | **15** |
| **excluded** (`cross-stream`) | **5** |
| authored | 2026-08-09, **before any reranker existed** — three deliberately inverted so the set cannot be satisfied by always preferring legislation |
| last changed | **2026-08-12** (`abff460`). Neither `gold-preferences.ts` nor `score-ordering.ts` has been touched since. |

The 5 cross-stream pairs are excluded because no product surface ordered two streams by relevance:
`results` was round-robin by construction and `grouped` a stable filter over it. S2C-5 kept them,
noting they *"become scoreable the moment a real cross-stream ordering exists — **which is what a
reranker would be** — so they are the ready-made acceptance test for one."*

### ⚠⚠ THE RERANKER SHIPPED ON 26 AUGUST AND THAT ACCEPTANCE TEST WAS NEVER RUN

Until now. The exclusion is still hard-coded in `score-ordering.ts`, so the five remain excluded in
the run below; **they should now be scoreable and re-scoping them is a genuine outstanding item.**

### What today's ranking scores — run just now, under production's real flag string

`scripts/score-ordering.ts` (which imports the **real** `runSearch`, not a copy), with
`LEX_QUERY_EXPANSION / QUERY_ROUTER / SEARCH_VECTOR / SEARCH_RERANKER / TIER_FUSION / STATS_STREAM /
SEARCH_JUDGED_MERGE = true`, all five vector streams, everything else off — i.e. §0's flag string exactly.

```
════ BASELINE ════
  preference accuracy   100.0%  (10/10)
  cross-stream excluded 5
  vacuous (excluded)    5
```

| | 11 Aug (S2C-5) | **9 Sep (today)** |
|---|---|---|
| preference accuracy | 66.7% (6/9) | **100.0% (10/10)** |
| vacuous, excluded | 6 | **5** |
| cross-stream, excluded | 5 | 5 |
| **pairs where BOTH documents were retrieved** | **4** (split 2/4) | **5** (split **5/5**) |

▶ **The decomposition is the real finding, not the headline.** Of the 10 scored pairs, **five compared
two documents the system actually returned, and all five are correct.** The other five were passes
because the *dispreferred* document was absent — a recall win scored as an ordering win, exactly the
asymmetry the metric's own design documents.

**Both of August's genuine ordering failures are fixed, and visibly so:**

| pair | 11 Aug | today |
|---|---|---|
| HSWA 1974 vs sector-specific safety SIs | **11 vs 2** — "real, and nine places wrong" | **1 vs 6** ✓ |
| Landlord & Tenant Act 1985 vs Housing Act 1988 | **2 vs 1** — "real but adjacent" | **1 vs 4** ✓ |
| UK GDPR vs DPPEC (EU Exit) Regs 2019 | absent vs 16 — "a recall miss wearing an ordering fail" | **both absent — now vacuous** |

⚠⚠ **And the caveat that must travel with the 100%.** *A shrinking denominator is a warning, not a
win* — the proposal's own words. Five pairs remain vacuous, and two of them are not trivia:

- **UK GDPR is still not retrieved** for *"what is the law on data protection currently?"* — the same
  absence S2C-5 flagged on 11 August, unmoved in a month. And DPPEC, which used to arrive at 16, has
  now dropped out too, which is why that pair moved from *scored fail* to *vacuous*.
- **Water Resources Act 1991 and Environmental Protection Act 1990 are BOTH absent** for *"what is the
  law on water pollution from sewage discharge?"* — a flagship question of this project, returning
  neither principal statute.

**100% on ten pairs where five turned on retrieval is not a claim that ordering is solved.** It is
consistent with S15's finding that retrieval, not the merge, is the binding constraint.

### recall@20, the invariant guard

**Not measured today, and the harness says why in its own header:** *"recall@20 is NOT computed here.
It is the guard, and it already has a harness on the ingest side."* The pairing to hold in mind is
that a reranker only reorders, so recall must be invariant; accuracy up with recall down means it is
discarding.

**The figure of record is therefore still S15's, 27 August (§2b above): 30/64 (47%) merged@20 with the
judged merge and reranker on; 32/64 (50%) in-stream.** Confirming that today's 100% did not come at
recall's expense requires exactly the D-6 run named in §2b. ⚠ **I am not able to state the invariant
held. I can only state that it was not tested.**

Positive engagement evidence from the same run, so the configuration is not taken on trust: every
stream returned `bm25: 60, vector: 60, fused: 60, weight: 0.5`, and the reranker logged
`model: 'gemini-2.5-flash', read: 60, ranked: 60, omitted: 0, invented: 0, 0.2074p, 1355 ms`.

---

## §2d — THE RERANKER. **NOT A CROSS-ENCODER. AND YES, 2C WAS SCORED FIRST — TWICE, WITH OPPOSITE ANSWERS.**

### What it actually is

**An LLM listwise reranker, not a cross-encoder, and not over the fused top ~100.**
`scrutinise-web/lib/lex/reranker.ts`:

| | |
|---|---|
| mechanism | one model call reads a numbered candidate list (corpus part + title + matched passage) and **returns the candidate numbers in order** |
| model | **`gemini-2.5-flash`** (registry default) |
| pool | **60 candidates** (`SEARCH_RERANK_CANDIDATES`), **420 chars each** (`SEARCH_RERANK_SNIPPET_CHARS`) |
| ⚠ how the pool is cut | **round-robin across routed streams, not by merged order** — truncating by merged order would hand the model a pool already shaped by the rationing the sprint existed to remove |
| bounds | may **reorder** only. An id not in the candidate list is **discarded and counted as `invented`**. No free-text field, so it cannot summarise. A candidate it omits **keeps its place behind the ranked ones** and is counted as `omitted` |
| cost ceiling | `SEARCH_RERANK_MAX_PENCE`, **9p**, checked against an estimate *before* the call, with the actual reported after |

⚠ Model choice was made twice, on reasoning and on measurement, and they disagreed. It shipped on
`gemini-2.5-pro` because ordering across sources is a judgement task; measured over the 64 validated
questions on identical inputs with the **echoed** model checked on every call:

| | recall@20 | recall@5 | cost/query | latency | completed |
|---|---|---|---|---|---|
| `gemini-2.5-pro` | 18/64 | 10/64 | 2.551p | 34.7 s | 44/64 |
| **`gemini-2.5-flash`** | **19/64** | **15/64** | **0.221p** | **1.6 s** | **63/64** |

Flash is 11.5× cheaper, 22× faster and better on both. The registry default is Flash.

⚠ One detail worth carrying: the ceiling first carried **1.5p**, and at the shipped defaults the
pre-call estimate was ~4.3p — *"a ceiling that would have refused every call. That is not a ceiling;
it is an off switch wearing one's name, and in a log it would have read as 'the reranker never
helped.'"* Same defect as a guard that cannot fire, arrived at from the other side.

### Was 2c scored first? Yes — and the first scoring refused the build

**11 August, S2C-5:** *"**THE RERANKER IS NOT AUTHORISED.** The regression that motivated it does not
reproduce; the genuine-ordering evidence is four pairs; and eleven of fifteen pairs turned on
retrieval. A reranker reorders the set it is given and cannot promote a document that never arrived.
**The binding constraint is recall.**"* The discipline held: the baseline was taken, and it said no.

### What changed, and it is a measurement rather than a change of mind

**S13 (24 August) reversed the finding on new evidence, and the reranker file records the reversal in
its own header:**

> *"It was declined in June because the binding constraint was recall, not ordering: 11 of 15 scored
> pairs turned on whether the document was retrieved at all. **S13 reversed that finding on
> measurement — 28 of 65 validated answers are now FOUND in some stream's own list and only 15 are
> DISPLAYED.** The system retrieves correctly and then fails to order across sources. **Ordering is
> the binding constraint now.**"*

That is the justification, and it is a different fact from the one that refused the build: the earlier
"no" rested on documents *not being retrieved*; the later "yes" rests on documents *being retrieved and
not shown*. `BRIEF_SEARCH_S14` §3 authorised it, bounded.

### What it bought, measured — and the caveat on those numbers

S14's arms, n = 64:

| arm | recall@20 |
|---|---|
| in-stream@20 (the ceiling) | 19/64 |
| round-robin (then-production) | 14/64 |
| **reranker (flash)** | **19/64 — in-stream@20 exactly: everything retrieval found is displayed** |
| @5 | **6/64 → 15/64** |

⚠⚠ **Those arms were keyword-only and S14 labels them so** — `vector-serve` could not serve four dense
streams that day (§Gap 2). The figures that matter are S15's retake (§2b): round-robin **19/64**,
judged + reranker **30/64**. Every gain is a document deeper than `floor(20/S)` in its own stream —
in-stream 14, 16, 39, 47 — exactly the ones S13's arithmetic said could never be shown. Its one loss
is the shape to watch: a document its own stream ranked **first** taken to merged 27.

**Reporting, not defending: the sequence the brief asked for was followed.** 2c was seeded before any
reranker existed, scored before anything was built, and the answer was "no". The build came from a
later, different measurement. What is *not* satisfied is the follow-through: the five cross-stream
pairs written as the reranker's acceptance test have still never been scored against it.

---

## GAP 1 — THE VECTOR INDEX. **CURRENT AS TO CHUNKS; THE JULY SNAPSHOT PROBLEM IS CLOSED.**

Read directly off the Lance table on R2 (`verify-vector-index.ts`, read-only), 04:09 UTC today:

```
[verify-vec] table=corpus_vec rows=22,670,808
[verify-vec]   vector_idx (IVF_PQ) on [vector]: indexed=22,670,808 unindexed=0
[verify-vec] ✅ ANN index present and covers all 22,670,808 rows
```

| | |
|---|---|
| **vector count now** | **22,670,808** |
| ANN coverage | **100%** — `unindexed = 0`, so nothing is brute-force scanned per query |
| **`corpus_chunks`** | **22,670,808 — reconciles exactly**, no drift between the two tables |
| index config (live, `vector-serve/stats`) | `nprobes 64` · `chunkOverscan 5` · `refineFactor 2` · cosine · `gemini-embedding-001` @ **768 d** |

### Date of the latest embedded chunk

**The last embed of record is the S12 re-embed, completed 2026-08-23 00:27 UTC**, verified then at
`unindexed=0 over 22,670,808 rows` — **the identical count I read today.** The number has not moved in
17 days, which is the strongest available evidence that no embedding has run since.

⚠ **A precise limitation, stated rather than glossed:** `corpus_vec` carries no per-row embedded-at
timestamp, so "the date of the latest embedded chunk" cannot be read off the table. The date above is
inferred from the row count matching the last recorded run exactly. That inference is sound but it is
an inference, and it is the kind this project has been caught by before.

### Has the delta embed for the committee rechunk, FTS backfill and treaties run?

**Yes — all three, well before today, and Gap 1's premise is closed:**

| the brief's three | when it was embedded |
|---|---|
| the V32 §1 committee **per-finding rechunk** (7 Aug) | V33 §2, **11 August** — *"the vector index is current"* |
| the V32 §2 **archive/FTS backfill** (9 Aug) | same run |
| the **treaties** extension | same run |
| the V34 political-evidence corpora | V35, **12 August** — 95,044 vectors, $4.87 against $4.50 predicted (+8.2%) |
| the caselaw/stylesheet re-compile | S12, **23 August** — full reindex, 31.9 min, €0.156 |

**Dense retrieval is no longer answering from a July corpus.** The brief's statement — *"Vector index
is a July snapshot… predates the committee rechunk, the FTS backfill, and the treaties ingest"* — was
true on 9 August and was overtaken two days later.

### What a further delta would cost — **MEASURED, not estimated: $0.18**

`v33-vec-delta.ts --calibrate 300 --run s09sep` — read-only, spends nothing, tagged `s09sep` so it
cannot clobber the August prediction the CHANGE_LOG scores against. **It completed during this
session.** Report at `docs/s09sep_vec_delta.json`.

```
═══ DELTA ═══════════════════════════════════════════════════════════
  compiled sections            18,110,087
  WITH a vector                18,102,184
  ⇒ UNVECTORED (the delta)     7,903  (0.04%)
  words to embed               1,503,264
  chunks to embed              8,503
  characters embedded          9,334,994   (overlap counted — paid for twice)
  estimated tokens             2,333,749   (chars/4, a deliberate over-estimate)

  ⇒ PREDICTED COST at Batch $0.075/M:  $0.18
     sensitivity to CPW: 5.54→$0.16   6.15→$0.18   6.77→$0.19
     (sync transport would be 2×: $0.35)
```

**Every chunk of it is parliamentary**, and that is the whole story:

| tier | sections | **chunks** | cost |
|---|---:|---:|---:|
| **parliamentary** | 7,674 | **8,503** | **$0.18** |
| legislation | 43 | 0 | $0.00 |
| other | 183 | 0 | $0.00 |
| caselaw | 2 | 0 | $0.00 |
| guidance | 1 | 0 | $0.00 |

Concentrated in `pwdata-debates` (3,365 chunks), `pwdata-wrans` (2,619), `pwdata-lords` (1,296) and
`pwdata-westminster` (1,021). Everything outside `pwdata` models to **0 chunks** — zero-word rows, the
V35 residual, empty rows rather than missed work. CPW measured on 300 real bodies: **6.153**, against
6.161 in August, so the corpus geometry is stable. `corpus_vec` and `corpus_chunks` reconcile exactly.

▶ **Gap 1's remaining delta is 8,503 chunks for eighteen cents, and all of it is Hansard.** Cheap
enough that the only question is whether it is worth a heavy-job run at all, not whether it is
affordable.

⚠⚠ **AND A CORRECTION TO MY OWN WORKING, KEPT BECAUSE THE REASONING WAS WRONG EVEN THOUGH THE ANSWER
CAME OUT NEARLY RIGHT.** An hour before the walk finished I had written *"the outstanding delta is near
zero"* on the strength of the **first three collections it happened to reach** — `fca-handbook`,
`primary-acts-2000plus`, `primary-acts-pre-2000`, all 0 chunks. Those three are **legislation, the tier
re-embedded most recently.** By collection eleven the walk was finding thousands of chunks in `pwdata`,
and I wrote a second passage saying the first was wrong. The finished number is **$0.18** — so "near
zero" was, in the end, about right.

**That is not a vindication and should not be read as one.** A prefix of a walk ordered by collection
name is not a sample of the corpus — the same shape as `ORDER BY id` on `tna-caselaw` ids that begin
with the citation. The collections that came first were the ones guaranteed to be clean. I got a
defensible number from an indefensible method, which is the worse of the two outcomes, because nothing
about a right-looking answer would have prompted anyone to check the reasoning behind it.

⚠ **Gap 4 in the brief — the ~$284 MAX_CHUNKS top-up — is a separate question and is NOT answered
here.** That is a deliberate *deferral*, not a delta: chunks 9+ of long sections were never embedded,
so they do not appear as unvectored sections in this walk at all. The reasoning for deferring it
(the committee rechunk would supersede the chunks being paid for) has been overtaken by that rechunk
having landed, so the deferral is due a re-decision.

⚠ Two storage facts from S15-CAPACITY that belong beside the count: `corpus_vec.lance` is **147.58 GB**
(6,990 bytes per vector — *larger* than raw f32, because PQ compression lives only in `_indices` while
`data` keeps the original vectors and the string columns), and **`corpus_chunks/_versions` is 13.39 GB
of stale manifests serving no query.**

---

## GAP 2 — WHICH STREAMS CARRY DENSE RETRIEVAL TODAY. **ALL FIVE.**

`/api/health` reports `vectorStreams: ["caselaw","committees","debates","guidance","legislation"]`,
and the Railway `build-worker` carries the same list in its own environment. The brief's position —
*"Only legislation is fused today"* — is superseded.

**Verified behaviourally, not from the config**, in the §2c run an hour ago. Every routed stream
logged a real dense leg:

```
[query-router] per-stream fusion { stream: 'legislation', bm25: 60, vector: 60, fused: 60, weight: 0.5 }
[query-router] per-stream fusion { stream: 'caselaw',     bm25: 60, vector: 60, fused: 60, weight: 0.5 }
[query-router] per-stream fusion { stream: 'committees',  bm25: 60, vector: 60, fused: 60, weight: 0.5 }
[query-router] per-stream fusion { stream: 'debates',     bm25: 60, vector: 60, fused: 60, weight: 0.5 }
[query-router] per-stream fusion { stream: 'guidance',    bm25: 60, vector: 60, fused: 60, weight: 0.5 }
[search-gateway] whole-query fusion stood down — per-stream vector is active
```

The flag is keyed on the **stream name**, not the tier — `debates` and `committees` share the
`parliamentary` tier, so a tier-keyed flag could not have enabled one without the other.

### ⚠ How the "all-five-dense doubled p95 to 25 s" blocker was cleared

The brief's sequencing evidence was real and has since been diagnosed and fixed:

- **S14 §0 (26 Aug)** found `vector-serve` running **4 requests wide behind a 64-deep queue, where a
  client abort did not cancel queued work** — so every timed-out dense leg *added* load. `warm_p95`
  read **7,698 → 205,754 → 351,301 → 706,954 ms** in one afternoon and **kept climbing for forty
  minutes after every client had been killed.** ⚠ It left no mark on the result: `mergeLegs` returned
  the BM25 list with every hit still carrying `scorer: 'bm25'` — byte-for-byte what a stream with no
  dense leg produces.
- **S15 (27 Aug)** fixed the service: the width was an arbitrary constant copied from
  `fts-query-service.ts`; the container has **8 vCPU** (not the 48 `os.cpus()` reports — that is the
  host, not the cgroup quota); the dominant constraint is **storage/network**, 193 GB in R2 with no
  local cache.
- **And S15 §3 closed the invisibility**, which matters more than the width: `reportDenseDegraded()`
  now records a refused dense leg *where it is still known*, so "dense is off" and "dense was refused
  by a saturated service" can no longer become the same object.

**Live now** (`vector-serve/stats`, 04:07 UTC): `concurrency: { max: 16, maxQueue: 32, inFlight: 0,
queued: 0, queueHighWaterMark: 0, rejections: 0 }`, `warm_p50 2,406 ms`, `warm_p95 7,722 ms`,
`embed_p50 239 ms`, cache hit rate 0.287. `fts-serve`: `max 16, maxQueue 32`, `warm_p50 3,284 ms`,
`warm_p95 8,395 ms`, 0 errors on 3,287 served.

⚠ Two things to keep an eye on: `vector-serve` reports **81 errors on 2,486 served** (3.3%), and its
**cold start is 44.6 seconds** — which is only academic while the services stay awake, and
`sleepApplication` is enabled on both.

---

## GAP 8 — COST. **THE LEDGER EXISTS AND IS POPULATED. THE PER-USER / PER-IDEA VIEWS ARE NOT. NO ALERTS ARE WIRED.**

`LlmSpend` (DDL `prisma/llm_spend.sql`) is live on the app database, append-only, one row per **call**.
Written through one place (`recordSpend`) rather than per caller — deliberately, because the truncation
guard had shown what per-caller checks cost. Read at 04:12 UTC today:

| | |
|---|---|
| rows | **4,670** |
| ledger opened | **2026-08-17 12:57 UTC** |
| latest row | 2026-09-09 04:11 UTC (a build running as I read it) |

### Current month's spend — September to date

| | calls | pence | £ |
|---|---:|---:|---:|
| **all models, month to date** | **1,853** | **848.82** | **£8.49** |
| `gemini-2.5-pro` | 164 | 458.25 | £4.58 |
| `gemini-2.5-flash` | 1,689 | 390.57 | £3.91 |
| *(August, for comparison)* | *2,817* | *1,361.23* | *£13.61* |

**All of the current month's spend is Gemini** — there are no other priced models in the month, and
`unpriced_calls = 0`, so no null-cost row is hiding inside the total. By stream: `build` £6.55,
`deepening` £1.33, `lex` £0.61.

### The search passes

| pass | calls (all time) | pence | last real call |
|---|---:|---:|---|
| `search.query-router` | 2,818 | 107.66 | **2026-09-07 22:10 UTC** *(excluding my 12 probe calls today)* |
| `search.reranker` | 607 | 873.61 | ⚠ **2026-09-01 12:33 UTC** |

⚠⚠ **THE RERANKER HAS RECORDED NO SPEND IN EIGHT DAYS, WHILE `LEX_SEARCH_RERANKER` READS `true` IN
PRODUCTION.** That is not the flag failing — see Structural Finding 1: builds moved onto the Railway
worker on 3 September, and **the worker's environment does not set `LEX_SEARCH_RERANKER` at all.**
Builds ran at 04:00–04:11 *this morning* (`build.draft`, `build-research.gather`, `deepening.sift`)
and produced no reranker row. The ledger caught a configuration divergence that nothing else did.

### Does a per-request / per-idea / per-user cost view exist?

**Partly, and the weakest part is attribution.** The columns exist and are correct by design
(`userId`, `ideaId`, `groupId`, all nullable, added before the features that need them). An admin
surface exists at `app/api/admin/spend/route.ts`. But of **1,853 calls this month, 5 carry a `userId`
and 12 carry an `ideaId`.**

▶ So: **site-wide monthly is real and readable. Per-pass is real and readable — and it is what found
the reranker gap.** Per-user and per-idea are *schema without data*: the platform work (ingest, admin,
worker builds) legitimately has no user, but a build kicked off by a person should carry one and
almost none do. **A "high-usage users flagged" view cannot be built on 5 attributed rows in a month.**

### Are the $20 / $50 alerts wired?

**No.** I grepped `spend-ledger.ts`, the admin spend route, `lib/lex/` and `scripts/ingest/` for any
threshold, alert or notification on monthly spend and found none. The only budget alerting in the
project is on **Neon storage** ($15/month, currently $6.65 = 44.3%, dropped from `critical` to
`warning` on 23 August) and a **£15 per-job embed gate** on the ingest side. Neither is the $20/$50
monthly model spend alert Gap 8 asks for.

⚠ At £8.49 for September to date and £13.61 for August, **a $20 alert would not yet have fired** —
which is why this reads as low-priority and is exactly the reason it should be wired now rather than
after the first month that would have tripped it.

---

## GAP 12 — `LEX_WEB_ORIENTATION`. **OFF IN PRODUCTION. NOT A SILENT FAILURE — BUT NOT A DECISION EITHER.**

**Confirmed off** on the live `[capabilities]` line (§0), read through `flagEnabled()` — the same
resolver whose absence caused the capitalised-`TRUE` incident, so an unrecognised value would now warn
by name rather than mean false in silence. The gate is a single read
(`lib/lex/orientation/index.ts:56`), default OFF, and flag-off was proven byte-identical when the
layer shipped.

**So it is not another instance of the class that kept the router dark.** The flag is off because it
has never been switched on.

⚠⚠ **But "deliberate" overstates it, and the distinction matters.** I could find no decision record
saying the layer should stay off. What I found is a **dependency that was never closed**:

1. At Stage 0 (6 Aug): *"`GROK_API_KEY` and `LEX_WEB_ORIENTATION` are not set in Vercel. **The layer
   is inert without the key.**"*
2. ⚠ **And on 26 August the key stopped being the blocker and became a red herring**: *"`GROK_API_KEY`
   is set so `hasKeyFor('xai')` is TRUE, and `callModelJson` returns **`unroutable` for every xAI
   model because the structured client has never been written**. **A KEY IS NOT A CLIENT.**"* Still
   true in the deployed code — `model-call.ts` has a hard `unroutable` branch for `case 'xai'`.
3. Two further live findings against the layer: **xAI Live Search is dead (HTTP 410)**, superseded by
   the Agent Tools API; and `grok-3-fast-beta`, Lex's hardcoded fallback in two production routes, is
   **no longer in xAI's model list**.
4. Measured cost when it does run: **30.8 s and $0.0763 per briefing** — *"materially above the 4–9 s
   estimate the 'one complete briefing' decision was taken against, and is flagged for Charlie."*

▶ **The state to record is: off, safely off, and blocked on unbuilt work rather than on a judgement.**
Given the strategy still ranks Web/X orientation first in the post-core roadmap and calls it *"a
credibility floor, not a nice-to-have"*, the gap between that priority and an unwritten xAI client is
the thing to decide, not the flag.

---

## STRUCTURAL FINDING 1 — THE TIER-SCOPED CALLERS. **THREE OF THE FOUR NOW REACH THE ROUTER AND DENSE RETRIEVAL. THE FOURTH IS THE PROBLEM, AND IT IS NOT THE ONE THE BRIEF NAMED.**

The brief: *"`gateway-legacy.ts` passes an explicit tier… So the Lex chat route, `/api/search`, and the
legislation-search panel get **neither routing nor dense retrieval**."*

**Caller by caller, read in the deployed code:**

| caller | passes a tier? | reaches the router? | dense? |
|---|---|---|---|
| **Lex chat route** (`chat-retrieval.ts:168`) | **NO** — the source carries the line *"⚠ NO `tier`. That single line is gate 1."* | **yes**, full routed path | **yes**, all five streams |
| **Lex build worker** (`build.ts:1783`, `build-research.ts:212`, `build-smart.ts:443`) | **NO** | **yes** | **yes** — but see the configuration finding below |
| `/api/search`, `/api/ai/[ideaId]`, the legislation panel (`gateway-legacy.ts:160`) | **YES**, `tier: 'legislation'` | **yes** — the router now runs *within* the scope | **yes**, via the matching stream's own `search()` |

**The mutual exclusivity is gone.** S3 §1 fixed it: `search-gateway.ts:354` now checks
`LEX_TIER_FUSION` (**true in production**) and, when the tier maps to exactly one stream, calls that
stream's fused `search()` — BM25 + dense inside the scope. The old comment survives above the code as
the account: *"Scoping and dense were accidentally mutually exclusive."* It was measured before it
shipped: recall@20 **42.4% → 64.1%**, in both run orders.

⚠ **One narrow, deliberate exception, and it is honest about itself.** Fusion applies **only when the
tier maps to exactly one stream**. `debates` and `committees` share the `parliamentary` tier, so a
`tier: 'parliamentary'` caller keeps the BM25-only path and **logs that it did** rather than guessing:
`[search-gateway] tier maps to !=1 stream — BM25 path retained`. No production caller passes that tier
today; `gateway-legacy` passes `legislation`, which maps to one.

### ⚠⚠ AND THE REAL FINDING, WHICH IS ONE LAYER BELOW WHERE THE BRIEF PUT IT

**M-01's cause is fixed by configuration. The guard that would have caught it is written and NOT DEPLOYED. And the worker is running a different retrieval configuration from the web app.**

**(a) The M-01 cause — closed.** `FTS_SEARCH_URL` **is now set on the Railway `build-worker` service**,
along with `VECTOR_SEARCH_URL`, `LEX_QUERY_ROUTER=1` and
`LEX_VECTOR_STREAMS=caselaw,committees,debates,guidance,legislation`. A build run today retrieves.

**(b) ⚠⚠ The guard is in the working tree and is NOT in the deployed worker.** The deployed
`build-worker.ts` at `15bafe1f` imports **`resolvedConfigLine`** — the *printer* — and not
`assertRetrievalConfig`, the *guard*, and its own comment still reads *"IT WARNS, IT DOES NOT REFUSE."*

The fix exists. It is **uncommitted**, in `scrutinise-web/scripts/build-worker.ts`, and its comment is
the best statement of the problem in the repository:

> *"M-01 — the flagship Human Rights Act chapter — ran on 2 September with `FTS_SEARCH_URL` unset and
> `LEX_VECTOR_STREAMS` empty. Eighteen searches returned nothing. The build reported **DONE, 11 of 11
> passes, zero failures**… The discrepancy was caught by a human reading the finished report, five
> days later. `assertRetrievalConfig` has existed since S3 §7.2 for exactly this, and this file
> imported the PRINTER and not the GUARD."*

It adds a refusal with a named escape hatch (`LEX_BUILD_ALLOW_DEGRADED_RETRIEVAL=1`) so a deliberately
degraded run is still possible but must be asked for. ▶ **Until it is committed and the worker
redeployed, a worker started with retrieval unset will still run and still report DONE.**

**(c) ⚠⚠ The worker and the web app run different retrieval configurations, and nothing reconciles
them.** `/api/health` reports the **Vercel** app's flag resolution. The Railway worker resolves its
own environment, and it is not the same:

| flag | Vercel (`/api/health`) | Railway `build-worker` |
|---|---|---|
| `LEX_QUERY_ROUTER` | true | **`1`** ✓ (equivalent) |
| `LEX_VECTOR_STREAMS` | all five | **all five** ✓ |
| `LEX_QUERY_EXPANSION` | **true** | **not set → OFF** |
| `LEX_SEARCH_RERANKER` | **true** | **not set → OFF** |
| `LEX_SEARCH_JUDGED_MERGE` | **true** | **not set → OFF** |
| `LEX_TIER_FUSION` | **true** | **not set → OFF** |
| `LEX_STATS_STREAM` | **true** | **not set → OFF** |

**The Restoration Programme builds run through the worker.** So they run with routing and dense
retrieval on, and with expansion, the judged merge and the reranker **off** — the round-robin arm,
which S15 measures at **19/64** against **30/64** for the configuration `/api/health` advertises.

This is independently corroborated by the ledger (Gap 8): `search.reranker` has no spend since
1 September, and builds moved to the worker on 3 September.

▶ **`/api/health` is being read as "production's configuration" and it is only the web app's.** The
endpoint that ended three incidents has a blind spot the same shape as the one it was built to close.
Two candidate fixes, neither started: set the flags on the worker service, or have the worker publish
its own capability line somewhere readable.

**(d) The worker is 53 commits behind**, 11 of them in `lib/lex/`, including both September search
fixes (`f9cda19`, `58bc24b`).

### The second structural finding, for completeness

**Conversation history steering retrieval on general chat** — fixed on 8 August by emptying
`ideaContext` on that surface, and the fix is deployed. The comment recording the measurement
(`Enterprise Act 2002 …` → `Data Protection Act 2018 …` with two data-protection turns as history) is
still in `general-chat.ts:318`. The accepted cost stands: purely anaphoric follow-ups retrieve against
the pronoun. The real fix — resolving the question to a standalone query before retrieval — remains
recorded and unbuilt.

---

## EVERYTHING ELSE SHIPPED SINCE 9 AUGUST THAT TOUCHES SEARCH

One line each, with the report that describes it. Newest last.

| date (UTC) | what | report |
|---|---|---|
| 09 Aug | **Lex was answering from one stream in five; it now answers from all of them** — the answer context was a concatenation off the front of `legislation`. | CHANGE_LOG *SEARCH Stage 2A* |
| 09 Aug | **The cross-stream score landmine defused** — a fused stream's RRF ~0.008–0.016 against an unfused stream's raw BM25 ~5–25; the global sort was deleted. | `score-scope.ts`; CHANGE_LOG *Stage 2B* |
| 10 Aug | Four collections no caller could receive, made reachable; a deliberate exclusion stops looking like a defect. | CHANGE_LOG *Stage 2C* |
| 10 Aug | Corpus reachability to **99.08%**; annotations stop wearing another class's type. | CHANGE_LOG *Stage 2C-2* |
| 10 Aug | **Bills become findable and legible**; the last 0.92% disposed of by name. | CHANGE_LOG *Stage 2C-3* |
| 11 Aug | **The vector index brought current** — the committee rechunk, the archive backfill and the treaties all embedded. | CHANGE_LOG *INGEST V33 §2 CLOSED* |
| 11 Aug | ANN retrieves **70.4%** of what it holds at 24 probes, ~85% at 64. | CHANGE_LOG *Stage 2C-4* |
| 11 Aug | **`VECTOR_NPROBES` 24 → 64**, engagement verified positively off `/stats`; ⚠ candidate-set fidelity rose while gold recall moved **−0.6 pp** — the two metrics do not move together. | `SEARCH_S2C5_REPORT.md` |
| 11 Aug | **The ordering baseline: 66.7% (6/9) — and the reranker NOT authorised.** | `SEARCH_S2C5_REPORT.md` §3 |
| 12 Aug | Four V34 corpora typed and honestly titled; ⚠ **17,261 instruments known to the legacy table absent from `corpus_sections`**, incl. Companies Act 2006 and UK GDPR. | CHANGE_LOG *Stage 2C-6* |
| 12 Aug | **V35 embed** — 95,044 vectors, $4.87 against $4.50 predicted, `corpus_vec` = `corpus_chunks` exactly. | CHANGE_LOG *INGEST V35 COMPLETE* |
| 16 Aug | **S3 §1 — tier-scoped callers reach per-stream fusion** (`LEX_TIER_FUSION`), recall@20 **42.4% → 64.1%**. The DROP is **not** unblocked. | CHANGE_LOG *SEARCH S3* |
| 16 Aug | **The Lex chat route could not see committees, debates or case law — and the router already knew.** | `SEARCH_S4_REPORT.md` |
| 16 Aug | A disabled router is not a failed one (`1ccb708`). | CHANGE_LOG *S3 §7.1* |
| 17 Aug | **Lex can see the whole corpus**; the old path had been matching `"assist investi"`. | `SEARCH_S5_REPORT.md` |
| 17 Aug | **`SEARCH_CONTRACT.md` written** — what can be asked of the corpus and what comes back. | `SEARCH_CONTRACT.md` |
| 17 Aug | **The spend ledger — the platform now counts what it spends** (and the ledger was inert until the addendum fixed it). | `SEARCH_S6_REPORT.md` + addendum |
| 17 Aug | The carried backlog cleared; two measurements that refuse to answer. | `SEARCH_S7_REPORT.md` |
| 17 Aug | **Decode at render** — 38 of 321 served hits carried a literal HTML entity; 0 of 381 now do. | CHANGE_LOG *INGEST RENDER-DECODE* |
| 19 Aug | S8: the infrastructure finished; **four sections reversed their own premise**. | `SEARCH_S8_REPORT.md` |
| 19 Aug | **The statistics catalogue** — headings searchable, values callable; runs concurrently with corpus retrieval. | `SEARCH_S9_REPORT.md` |
| 19 Aug | **`SEARCH_STRATEGY_v5.md`** — the strategy of record. | `SEARCH_STRATEGY_v5.md` |
| 20 Aug | **The first trustworthy retrieval numbers**; a collection no query could ever return. | `SEARCH_S10_REPORT.md` |
| 20 Aug | Case-law judgments recovered from under the stylesheet; titles had never left the database. | CHANGE_LOG *INGEST CASELAW TEXT* |
| 21 Aug | Seven collections no query could return, re-tiered; guidance in-stream **3/10 → 8/10**. | `SEARCH_S11_REPORT.md` |
| 21–22 Aug | **GOLD v2 authored and validated by you** — 24 of 24 reviewed, 22 ACCEPT, 2 AMEND, 0 REJECT. | `GOLD_QUERIES.md`, `BRIEF_GOLD_V2.md` |
| 23 Aug | **S12: the re-embed landed; the new 65-question baseline is 20/65 (31%) — and debates scores 0/11 on its first ever measurement.** ⚠ `vector-serve`'s source ref does not track the branch it names. | `SEARCH_S12_REPORT.md` |
| 24 Aug | **S13: the merge is arithmetic** — the platform was showing 1.1% of a Spring Statement from the top; 28 of 65 answers FOUND, 15 DISPLAYED. | `SEARCH_S13_REPORT.md` |
| 26 Aug | **S14: the judged merge stops rationing slots, and the reranker is wired** — and `vector-serve` cannot serve four dense streams. | `SEARCH_S14_REPORT.md` |
| 27 Aug | **S15: the service was not slow because it was four wide** — 4 → 16, queue bounded, abandoned work cancelled. | `SEARCH_S15_REPORT.md` |
| 27 Aug | **S15-CAPACITY: the first real four-stream baseline** — in-stream 32/64, judged+reranker 30/64; dense is worth 13 points. | `SEARCH_S15_REPORT.md` §6 |
| 27 Aug | **S16: why half the questions find nothing** — NOT-MATCHED 19, RANKING 4, NOT-ROUTED 4, UNREACHABLE 4, ABSENT 1. | `SEARCH_S16_REPORT.md` |
| 27 Aug | The two search services set to sleep; ⚠ `pg_stat` reported 0 live rows for 68 tables holding 1.25M. | `OPS_SLEEP_AND_DECOMMISSION.md` |
| 28 Aug | **S17: `/api/health` reports every capability flag as the app resolves it** — and the first reading contradicted every recent measurement. ⚠ S16's `UNREACHABLE=4` was **0**, from a tier artefact one day stale plus a re-implemented predicate. | `SEARCH_S17_REPORT.md` |
| 30 Aug | ⚠ The brief's own search tool could not run its brief — two queries dissolved to nothing, two over-returned ~290×. | CHANGE_LOG *B10* |
| 02 Sep | **B17: all twelve measures built on full retrieval** — 1,100 evidence rows, 937 cited, no failed pass. | `report_run/` |
| 02 Sep | ⚠ **B14a: a build ran with no corpus access at all, completed DONE, produced zero citations** — the M-01 finding. | `report_run/B15a_EXPORT_GAPS.md` |
| 07 Sep | **S18: the brief's premise overturned** — impact assessments *are* routed to and reachable; the failure is the answer key and the unit. ⚠ **`PRECEDENT` had been telling 952 instruments nobody ever reviewed them.** | `SEARCH_S18_REPORT.md` |
| 07 Sep | The COST AND BENEFIT block — a figure with **three** states, not two (`58bc24b`). | `SEARCH_S18_REPORT.md` |
| 08 Sep | ⚠ **The strongest kind of reference in the graph was arriving wearing the weakest kind's name** — 191,258 `enabling` rows mislabelled `markup`; the pass built on it had never run. | `GRAPH_5_REPORT.md`, SURFACE 5 |

### Briefed and not executed

- **`BRIEF_SEARCH_S19.md`** (written 8 September) — *the unit* (12 of 32 failures) and *the reach*
  (8 of 32), named in `SCRUTINISE_SEARCH_STATUS_v2` §4.1 as gating everything else. **No S19 report
  exists.** ⚠ Part of §3 is **half-built in the working tree and undeployed**: `lib/lex/grain-policy.ts`
  (untracked), a new `LEX_SEARCH_GRAIN` flag (uncommitted in `env-flags.ts`, absent from the deployed
  `/api/health` list), and `parentDocId`/`wordCount` added to both the BM25 and dense hydration paths.
- **Gap 11, `SEARCH_CALL_MAP.md`** — briefed on 9 August, **the file does not exist.**

### Two documentation facts worth fixing

- **`docs/SEARCH_STRATEGY.md` is stale.** It reads *"Last revised: 2026-07-15 (v2.1)"*. The strategy of
  record is **`docs/SEARCH_STRATEGY_v5.md`** (19 August). A brief pointing at the first file — as this
  one did — points at a document two versions behind.
- **`docs/ORDERING_METRIC_PROPOSAL.md` has not changed since 9 August**, so it still describes the
  cross-stream pairs as unscoreable. The reranker made them scoreable on 26 August.

---

## WHAT THIS REPORT LEAVES OPEN

Named, so none of it goes quiet:

1. **`scrutinise.co.uk` 522s at the Cloudflare edge** while `www.scrutinise.org` — production —
   serves 200. Not an outage; a broken second domain that at least one workstream's docs point at.
   Charlie's, because the Vercel side is SAML-blocked here.
2. ⚠⚠ **The build worker and the web app run different retrieval configurations**, and the worker is
   53 commits behind. The Restoration Programme builds run on the worker.
3. ⚠⚠ **The M-01 guard is written and undeployed** — uncommitted in `scripts/build-worker.ts`.
4. **S17 D-6 — re-take the gold baseline under production's real flag string.** Open since 28 August,
   restated by S18 on 7 September. The single highest-value measurement outstanding.
5. **recall@20 was not measured today**, so I cannot say the ordering invariant held under the 100%.
6. **The five cross-stream preference pairs** — written as the reranker's acceptance test — have never
   been scored against it; the exclusion is still hard-coded in `score-ordering.ts`.
7. **UK GDPR is still unretrievable** for the data-protection question; **WRA 1991 and EPA 1990 are
   both absent** for the sewage-discharge question.
8. **No $20/$50 spend alert exists**, and per-user/per-idea attribution is 5 and 12 rows of 1,853.
9. **Gap 1 is CLOSED, not open** — the delta is **7,903 sections / 8,503 chunks / $0.18**, all
   parliamentary, measured end to end (`docs/s09sep_vec_delta.json`). Listed here only because it is
   the one item in the brief that turned out to be cheap enough to just do.
10. **`LEX_WEB_ORIENTATION` is blocked on an unwritten xAI structured client**, not on a decision.
11. **Q2 has narrowed from four routed streams to one.** A judgement to review, not a defect.

---

*Measurements taken for this report: `/api/health` (`www.scrutinise.org`, cross-checked against the
Vercel origin), Railway GraphQL (service
deployments and per-service variables), `fts-serve` and `vector-serve` `/stats`, `verify-vector-index.ts`,
`LlmSpend` on Neon, `routeQueryDetailed` × 12, `score-ordering.ts` × 17 queries. Model spend incurred:
approximately £0.30, recorded in the ledger it reports on.*
