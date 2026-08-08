# Load test at the router's real fan-out, and the flip checklist

*2026-08-08 01:09 UTC. Script of record: `scripts/ingest/search/simulate-router-load.ts`.
Read-only against the deployed serve services — no flag set, no env changed, nothing flipped.*

---

## Headline

**The vector flip is not the latency risk. The BM25 fan-out already is.**

Adding dense retrieval for the legislation stream moves user-visible p95 at 10 concurrent
users from **12,798 ms to 12,566 ms** — i.e. not at all, within run-to-run noise. Meanwhile
BM25 alone, today, with no flag set, is already at **7.4 s p95 at 5 users and 12.8 s at 10**.

⚠ **And a second finding that changes how §4's "watch the observer" should be read:
`fts-serve` cannot see this in its own numbers.** Its `/stats` p95 excludes the queue wait, so
during the run above it reported **warm_p95 = 1,523 ms** while the client measured
**12,176 ms**. The observer's `p95 > 5s` alert is watching a number that structurally cannot
see fan-out queueing. Details in §4 below.

⚠ **Two parts of this brief could not be executed and need Charlie: the Vercel-side test, and
the flip itself.** Both are blocked on the same thing — the `VERCEL_TOKEN` in `.env` is
SAML-scope-blocked. See §5.

---

## 1. What was generated

`query-router.ts` turns one user search into up to 5 parallel stream calls, and after the flip
each *named* stream also issues a parallel dense call. So the load was generated at that shape,
using the stream scopes copied from `query-router.ts::STREAMS` (same tiers, same
`corpora`/`excludeCorpora` filters) rather than an approximation:

| mode | per user | meaning |
|---|---|---|
| `bm25` | 5 FTS | today — no stream named |
| `legislation` | 5 FTS + 1 vector | **the proposed flip** |
| `all` | 5 FTS + 5 vector | headroom for later streams |

**Every query is distinct.** `vector-query-service.ts` caches results for 300 s; repeating one
query across a level would have measured the cache, produced a flattering p95, and hidden the
queue behaviour completely.

Live traffic at the time was zero (`served = 4` after 149 s of uptime, all four of them mine),
so nothing here is contaminated by, or contaminating, real users.

## 2. Results

**`bm25` — today, no flag set**

| users | in-flight BM25 | BM25 call p50 | BM25 call p95 | **user-visible p50** | **user-visible p95** |
|---:|---:|---:|---:|---:|---:|
| 3 | 15 | 2,636 ms | 4,944 ms | 4,471 ms | **4,946 ms** |
| 5 | 25 | 4,519 ms | 7,449 ms | 4,851 ms | **7,632 ms** |
| 10 | 50 | 6,819 ms | 12,176 ms | 8,950 ms | **12,798 ms** |

**`legislation` — the proposed flip**

| users | BM25 p95 | dense p95 | **user-visible p95** | vs `bm25` |
|---:|---:|---:|---:|---:|
| 3 | 4,141 ms | 4,339 ms | **4,340 ms** | −606 ms |
| 5 | 6,367 ms | 4,845 ms | **6,487 ms** | −1,145 ms |
| 10 | 11,929 ms | 4,899 ms | **12,566 ms** | −232 ms |

The dense half returns in 4.3–4.9 s at every level and **never becomes the critical path** —
the user waits on the slowest of five BM25 calls either way. The negative deltas are noise, not
an improvement; the honest reading is *no measurable cost*.

**`all` — headroom, all five streams dense (not proposed)**

| users | BM25 p95 | dense p95 | **user-visible p95** |
|---:|---:|---:|---:|
| 3 | 4,427 ms | 10,744 ms | **10,745 ms** |
| 5 | 6,465 ms | 14,409 ms | **14,721 ms** |
| 10 | 12,643 ms | 24,888 ms | **25,119 ms** |

**This is the evidence for flipping one stream at a time.** With all five dense the vector half
becomes the critical path and doubles user-visible p95. Legislation-only is comfortably
absorbed; five-at-once is not.

**Errors, rejections, queue, memory — all clean**

| | `fts-serve` | `vector-serve` |
|---|---|---|
| errors across all 274 / 178 calls | **0** | **0** |
| rejections | n/a — **unbounded queue, cannot refuse** | **0** (bounded at 64) |
| queue high-water | **46** (of 50 in-flight) | **46** (of 50 in-flight) |
| peak RSS | **1,592 MB = 20.9%** of the 7,629 MB cap | **1,088 MB = 14.3%** |

**Memory is a non-issue** — both services stay under a quarter of the cap at ten times the
concurrency they see today, and neither is near the observer's 70% threshold. This is
consistent with the earlier direct-service finding (809 MB at 25 concurrent).

## 3. Where the time actually goes

`FTS_MAX_CONCURRENT = 4` with an **unbounded** queue is the binding constraint. At 10 users the
queue high-water is 46 of 50 in-flight calls — meaning almost every call waits behind the
4-wide semaphore. The service is not slow; it is *serialised*. Per-call service time barely
moves (960 ms p50 internally); what grows is the wait.

That is the design working as intended — the semaphore exists because concurrent native calls
against one Lance handle used to crash the process at 15 concurrent — but it means **fan-out
concurrency converts directly into user-visible latency**, and the router multiplies every user
by five.

## 4. ⚠ The observability defect this exposed

The two services time a request differently, and only one of them is telling the truth about
fan-out:

| | where `t0` is set | so the reported p95… |
|---|---|---|
| `fts-query-service.ts:168–169` | **after** `acquireSlot()` | **excludes** the queue wait |
| `vector-query-service.ts:205` | **before** `acquireSlot()` | **includes** the queue wait |

`fts-query-service.ts` does compute `queueMs` — and echoes it in the response body — but it is
**never recorded into any percentile**. The consequence, measured during this run:

> client-measured p95 **12,176 ms** · `fts-serve` `/stats` warm_p95 **1,523 ms**

So at the load where a user waits twelve seconds, `fts-serve` reports one and a half, and the
observer's `p95 > 5s` alert stays silent. It is also why the two services' p95s in the same
digest are not comparable with each other.

**This matters directly for §4 of the brief.** "Watch the observer for 24 h — p95" would give
false assurance on the FTS side. Reported, not fixed — it is a change to the serve service's
metrics and belongs in its own piece of work.

⚠ **Also: this load test will fire a real observer alert on the next hourly tick.**
`vector-serve` now reports `warm_p95 = 22,354 ms` against a 5,000 ms threshold — that is my
synthetic `all`-mode traffic, not users. Expect one critical email to cl@scrutinise.org; it
clears once the counters roll or the service restarts (`/stats` is since-boot).

## 5. What could not be run, and why

**The `VERCEL_TOKEN` in `.env` cannot reach the project.** It authenticates
(`/v2/user` returns `charles@scalablefinance.com`) but every project-scoped call is refused:

```
{"error":{"code":"forbidden","message":"Not authorized: Trying to access resource under scope
\"charlie-leachs-projects\". You must re-authenticate to this scope...","saml":true}}
```

`/v2/teams` returns an empty list, and the same 403 comes back with the account's
`defaultTeamId` attached. The token is marked `limited: true`. Consequences:

1. **The Vercel-side load test could not be run.** It needs `VECTOR_SEARCH_URL` set in Vercel
   (otherwise `runVectorSearch` returns `[]` and there is no dense path through Vercel to test)
   — and setting it needs project access.
2. **I cannot read the production flag state.** Whether `LEX_QUERY_ROUTER=true` is set in Vercel
   today is unknown from here; locally none of the five variables is set.
3. **The flip itself cannot be performed from this session.**

**Separately, the untiered gateway routes are not load-testable through Vercel anyway without
Charlie's involvement.** Every caller that reaches the router fan-out is
`/api/ideas/[id]/…`, behind Clerk `authorizeIdea` and rate-limited to 40/hr per user; a
10-user × 5-stream test would need a real session and a throwaway idea, would exceed that limit
within one level, and would write briefing/stage-search records into real idea data.

**How much is the missing Vercel hop likely to matter?** Bounded, not measured: fixed
round-trip overhead from this client to each service is **~120 ms** including DNS, TCP and TLS
on a cold connection (`dns 16 / tcp 38 / tls 80`), and less on a keep-alive reuse. Against
service times of 4–12 s that is 1–3%. So the hop is very unlikely to change any conclusion here
— but that is an argument from magnitude, not a measurement, and it should be closed properly
once the token is fixed.

**To close it, Charlie needs to:** re-authenticate the Vercel token to the
`charlie-leachs-projects` scope (SAML), or set `VECTOR_SEARCH_URL` in the Vercel dashboard
directly and confirm `LEX_QUERY_ROUTER`'s state.

---

## 6. The flip checklist

Preconditions, in order. **None of these has been set — this is the checklist, not a record of
having done it.**

| # | precondition | why it is load-bearing | state |
|---|---|---|---|
| 1 | `VECTOR_SEARCH_URL` = `https://vector-serve-production.up.railway.app` | The real master switch. `vector-search.ts:111` returns `[]` without it, so **both** flags are inert. | ❌ unset (and unsettable from here) |
| 2 | `LEX_QUERY_ROUTER=true` | `fusedStream` is reachable only via `runRoutedSearch`, called only from the router branch (`search-gateway.ts:169`). Without it the stream list is never consulted. | ❓ unknown in Vercel |
| 3 | `LEX_VECTOR_STREAMS=legislation` | The flip itself. Names exactly one stream. | ❌ unset |
| 4 | **`LEX_SEARCH_VECTOR` — leave unset** | Legacy unscoped whole-query path. It stands itself down when the stream list is non-empty (`search-gateway.ts:245`), so setting it is at best a no-op and at worst switches every stream on unscoped if the list is ever cleared. | ✅ unset — keep it that way |

Verified independently and unaffected by the above:

- ✅ **`vector-serve` is live, warm and correct** — 178 calls in this session, 0 errors, results
  non-empty on every scoped call, tier/corpora echoes honoured.
- ✅ **`fts-serve` redeployed cleanly on tonight's push and the repointed boot path works in
  production** — a citation query returns `primary-acts-pre-2000:ukpga/1988/50:section-21` with
  `resolved = true`, which is only reachable if the `corpus_acts` ActIndex loaded at boot.
- ✅ **Truncation is not a blocker** (`docs/LEGISLATION_TRUNCATION_AND_FLAG.md`): legislation
  embeds 79.2% of body words vs 59.4% corpus-wide.

**Accepted blast radius, restated so it is on the record at flip time:** dense reaches the
Page-1 briefing (`field-machine.ts:318`), cause-seeding (`orchestrator.ts:326`, `:478`) and
ad-hoc research (`stage-search.ts:130`, `:158`). The three tier-scoped legacy surfaces —
`/api/ai/[ideaId]` (Lex chat), `/api/search`, `/api/ideas/[id]/legislation-search` — stay
BM25-only until the legacy migration. Deliberate.

## 7. What to watch after the flip (§4), amended

- **p95 — but not `fts-serve`'s.** Per §4 above it cannot see the queue. Use the client-side
  number, or fix the metric first. `vector-serve`'s p95 *is* honest.
- **Rejections on `vector-serve`.** Its queue is bounded at 64; it shed nothing at 50 in-flight,
  but legislation-only should never approach that — one dense call per user, not five.
- **Memory** — expect no movement; both services sat under 21% at ten times today's load.
- **Gemini embed volume — the new per-query cost FTS does not have.** `embed_p50 = 228–242 ms`
  per uncached dense query, one Gemini call each. The 300 s result cache absorbs repeats, but
  its hit rate is a model and not yet a measurement (no query log exists). Cache hits cost
  neither an embed nor a semaphore slot (`vector-query-service.ts:208–211`), so hit rate is the
  variable that decides the bill.

---

**Nothing has been flipped. §2 is complete on the Railway side and blocked on the Vercel side;
§3 awaits both the token fix and Charlie's explicit word.**

---
---

# Post-flip follow-up — 2026-08-08 10:02 UTC

*Charlie set `VECTOR_SEARCH_URL`, `LEX_QUERY_ROUTER` and `LEX_VECTOR_STREAMS=legislation` in
Vercel and redeployed. This section records what happened next.*

## 8. ⚠ The flip is deployed but dense is NOT engaging

**A real search on the live briefing path fired exactly one BM25 call and zero dense calls.**

Method — counters read immediately either side of one authenticated request through
www.scrutinise.org (Charlie's own logged-in Chrome, his idea
`f534c43d` "Reforming VAT on Care Home Renovations", Lex workspace):

| | before | after |
|---|---:|---:|
| `fts-serve` served | 0 | **1** |
| `vector-serve` served | 178 | **178** |

`vector-serve`'s 178 is exactly and only my own load-test traffic (70 pre-existing + 18
`legislation`-mode + 90 `all`-mode), so the counter is a clean detector: **it has still never
served a single request originating from Vercel.** No errors were raised anywhere — this is the
"silently inert" failure the brief asked to rule out, and it is not ruled out.

### Three causes produce this exact symptom, and they cannot be told apart from outside

1. **`LEX_QUERY_ROUTER` is not the literal string `true`.** `capabilityFlags()` tests
   `=== 'true'`, so `TRUE`, `1`, or a trailing space all read as false. Retrieval then takes the
   non-router branch (`search-gateway.ts:183+`) — **one untiered `runFtsSearch`, which is exactly
   the one call observed** — and `fusedStream` is never reached. Worse, step 4b then *also* does
   nothing, because `perStreamVectorActive()` is true (the stream list is set), so the legacy
   whole-query path stands itself down. Net: no dense, no error. **This is the best fit for
   one FTS call.**
2. **`VECTOR_SEARCH_URL` is not reaching the running function** — wrong environment (Production
   vs Preview), or set after the build that is actually serving. `vector-search.ts:21` reads it
   at *module load*, so it needs a fresh deployment, not just a saved variable.
   `runVectorSearch` then returns `[]` on line 111 and the stream silently serves BM25 alone.
3. **`LEX_VECTOR_STREAMS` does not match the stream name exactly.** `vectorStreams()` splits on
   commas and trims, but the comparison is case-sensitive: `Legislation` ≠ `legislation`.

All three are silent by design — the fusion is written to degrade to BM25 rather than fail — so
none of them will ever surface in an alert.

### The two checks that separate them, in order

1. **Vercel → the deployment's Runtime Logs**, filtered for `[search-gateway]` /
   `[query-router]`. The gateway logs its own branch, so one line settles it:
   - `router dispatched` → router IS on; the problem is cause 2 or 3.
   - `no tailored query for tier` / nothing at all → router is off; **cause 1**.
   - `per-stream fusion` → dense fired and the problem is elsewhere entirely.
2. **Read the three variable values back** and confirm: `LEX_QUERY_ROUTER` is exactly `true`,
   `LEX_VECTOR_STREAMS` is exactly `legislation`, `VECTOR_SEARCH_URL` is
   `https://vector-serve-production.up.railway.app`, all three on **Production**, and that a
   deployment has been made *since* they were saved.

⚠ **One further caveat on the observation itself:** the click that submitted the query landed
just before another Chrome extension took over the tab, so I could not read the on-screen
response to confirm which caller ran. The counters are unambiguous about *dense not firing*;
they cannot prove *which* caller produced the single BM25 call. A clean re-run — one query, then
read both counters — settles that too.

## 9. §2 — the p95 metric defect is fixed, deployed and validated

`fts-query-service.ts` now starts its clock before `acquireSlot()`, matching
`vector-query-service.ts:205`, and reports `queue_p50_ms` / `queue_p95_ms` alongside. The
observer digest prints the split.

**Validated against the same 10-user load that exposed the defect:**

| | before the fix | after the fix |
|---|---:|---:|
| client-measured p95 | 12,176 ms | 13,325 ms |
| `fts-serve` reported warm_p95 | **1,523 ms** | **13,101 ms** |
| of which queue p95 | not measured | **12,368 ms (94%)** |

The remaining ~220 ms gap between client and service is the network hop, consistent with the
~120 ms round trip measured in §5. The observer can now see the thing it exists to catch, and
the split tells you *which* remedy applies: queue-dominated means raise the cap, service-dominated
means the index got slower. `check-serve-observer`: 28 passed, 0 failed.

## 10. §3 — the concurrency sweep: 4 was far too tight, and nothing crashed

`scripts/ingest/search/sweep-fts-concurrency.ts` sets the Railway variable, redeploys, waits for
a boot that *reports the cap it asked for* (so a redeploy that silently kept the old value cannot
be measured as if it were the new one), then drives the router's real fan-out.

**User-visible p95 (ms), 5 parallel stream calls per user:**

| cap | 5 users | 10 users | queue p95 @10u | peak RSS @10u | errors | verdict |
|---:|---:|---:|---:|---:|---:|---|
| **4** (old) | 8,121 | **14,213** | 12,219 | 1,611 MB | 0 | stable |
| **8** | 5,143 | 8,241 | 6,307 | 1,594 MB | 0 | stable |
| **16** | 5,191 | **6,161** | 4,096 | 1,841 MB | 0 | stable |
| **24** | 5,323 | 6,031 | 4,111 | 1,860 MB | 0 | stable |

**Set to 16.** That is a **57% cut in user-visible p95 at 10 users** (14,213 → 6,161 ms) for
230 MB of extra peak memory — 24.1% of the 7,629 MB cap.

**Why 16 and not 24.** Subtract queue from the service's own internal p95 to get service time per
call: 1,195 ms at cap 4, 1,106 at 8, 1,146 at 16 — flat — then **1,697 ms at 24**. That is the
contention knee: past 16, extra concurrency starts making each call slower, and the extra 130 ms
of p95 it buys at 10 users is inside the noise. 24 remains available if a later measurement wants
it.

**Note the floor.** At cap 24 / 5 users the queue p95 is **1 ms** — nothing waits at all — yet
user-visible p95 is still 5,323 ms. So ~5 s is genuine parallel service time at that width, not
queueing. Below about 8, the cap is the problem; above it, the index is.

### ⚠ The crash question is answered, and the answer changes the standing rule

The cap of 4 exists because concurrent native calls against one shared Lance handle killed the
process at 15 concurrent — no JS-catchable error, the process simply died.

**That signature did not reproduce.** Caps of 16 and 24, driven at 50 simultaneous in-flight
requests, produced **0 crashes, 0 errors, 0 restarts** across eight measured levels. The service
survived load well past the level that used to be fatal.

So the guard's stated justification no longer describes the current build, and the memory-pool
hypothesis (raised when the index-build OOM turned out to be DataFusion's internal pool rather
than machine memory) is the better remaining explanation for the original crash. **What has NOT
been shown** is that no cap is needed: this was a burst test, seconds long, not a soak, and
`concurrency-stress-test.ts` remains the regression check before anyone raises it further. The
honest conclusion is narrower than "the guard was wrong" — it is that **4 was not justified by
anything observable today, and 16 is.**

## 11. §4 — the 24 h watch has not started, and should not yet

Watching for 24 h is only meaningful once dense is actually engaging; today it is not (§8), so a
clean digest would report success at doing nothing. The watch should start after the flip is
confirmed live. What to watch is unchanged from §7, with one addition now that the metric is
honest:

- **`fts-serve` warm_p95 is now trustworthy** — and with the cap at 16 the expected steady-state
  is well under the 5 s alert threshold at realistic concurrency. A breach now means something
  real.
- **`queue_p95` vs `warm_p95`** — if queue is the bulk again, concurrency is the constraint and
  24 is the next step. If service time is the bulk, it is the index.
- **`vector-serve` served** — the single clearest signal that dense is alive at all. It should
  climb roughly one per uncached briefing/research query.

---
---

# Second follow-up — 2026-08-08 15:04 UTC, after the literal-value correction

*Charlie corrected `LEX_QUERY_EXPANSION` and `LEX_QUERY_ROUTER` from `TRUE` to `true`, confirmed
`LEX_VECTOR_STREAMS=legislation` and `VECTOR_SEARCH_URL` with no trailing slash, and redeployed.*

## 12. Still not engaging — three controlled trials, all negative

Three authenticated searches through www.scrutinise.org, counters read immediately either side:

| # | query | idea | `fts-serve` | `vector-serve` |
|---|---|---|---:|---:|
| 1 | "what is the law on data protection currently?" | VAT (`f534c43d`) | 0 → 0 | 178 → 178 |
| 2 | "Please research the corpus: what is the law on data protection currently?" | Data (`06ca807a`) | 0 → **1** | 178 → **178** |
| 3 | "…which Acts and statutory instruments govern data protection, what have select committees said…, and is there relevant case law?" | Data (`06ca807a`) | 1 → **2** | 178 → **178** |

Trial 1 never reached the gateway — Lex declined it as off-topic for that idea ("I can't run a
corpus search on general legal topics like data protection from here"), which is a useful
finding in itself: **the chat route will not run a corpus search unless the query is on-topic for
the open idea**, so an off-topic benchmark cannot be used to exercise retrieval.

Trials 2 and 3 did run — Lex confirmed it: *"The corpus search has indeed returned several
references, including 'Data protection (guidance)' and the 'Data Protection, Privacy and
Electronic Communications (Amendments etc) (EU Exit) Regulations 2019'."*

**Each produced exactly ONE `fts-serve` call and ZERO `vector-serve` calls.**

**Trial 3 is the decisive one.** It names legislation, committees and case law explicitly — three
different streams. A live router would have dispatched to at least two, and legislation among
them would have fired a dense call. It produced one untiered call and no dense.

**`vector-serve` served is still 178** — still exactly and only my own load-test traffic. Dense
has never run in production.

## 13. Was the router ever live? No — and it was double-gated off

**Provably inert for as long as the value was `TRUE`.** The flag is tested with a strict,
case-sensitive `=== 'true'` in **two independent places**, so capitalisation disabled it twice
over:

- `search-gateway.ts:57` — `router: process.env.LEX_QUERY_ROUTER === 'true'`, which decides
  whether `runRoutedSearch` is called at all;
- `query-expansion.ts:214` — `if (process.env.LEX_QUERY_ROUTER !== 'true') return null`, the
  first line of `routeQuery` itself.

**The same applies to `LEX_QUERY_EXPANSION`** (`search-gateway.ts:56`), which was also `TRUE`.
So Stage-3 query expansion has been inert too.

**What this means for the recorded gains, stated plainly:** the router's gold-set results
(+15.3pp on B, +10.0pp on A) and the expansion results before them **have never reached a user**.
They were measured offline against the gold set, and the production flag that would have switched
them on has been reading false. The 4 August improvement in production must therefore be
attributed to what actually shipped — **the FTS index rebuild and the legacy repoint** — not to
routing or expansion.

⚠ **The one thing I cannot establish from here is the date.** I can prove the values were
disabling as observed today, and Charlie reports they were capitalised; **Vercel's environment
variable history will date it** and that is worth checking, because it fixes how long the two
capabilities have been dark.

## 14. Why is it STILL not routing after the correction? Two candidates

Both produce the identical symptom — one untiered `runFtsSearch`, no dense, no error:

1. **The running deployment does not carry the corrected values.** Env changes need a build/boot
   after saving; `vector-search.ts:21` reads `VECTOR_SEARCH_URL` at *module load*.
2. **`routeQuery` is returning `null`, so the gateway fails open** to a single unfiltered
   `runFtsSearch` (`search-gateway.ts:176–181`). `routeQuery` returns null on missing
   `GEMINI_API_KEY`, HTTP error, unparseable JSON, or its 10 s `QUERY_ROUTER_TIMEOUT_MS`. The
   fail-open is deliberate — a router failure must never mean an empty result — but it is
   **silent**, and from outside it is indistinguishable from the flag being off.

**One log line separates them.** Vercel → the deployment's Runtime Logs, filter `[search-gateway]`:

- `router fail-open — searching all streams unfiltered` → **candidate 2**; check
  `GEMINI_API_KEY` in that environment and the router's latency.
- `router dispatched` → the router IS working and the problem is dense-side only.
- neither line → **candidate 1**, the deployment predates the corrected values.

## 15. ⚠ Every other boolean flag has the same fragility

Nothing in the codebase normalises env booleans — there is no `.toLowerCase()` anywhere near
these comparisons. Every one of these is case-sensitive and fails **silently**:

| flag | read at |
|---|---|
| `LEX_QUERY_EXPANSION` | `search-gateway.ts:56` (+ `query-expansion.ts`) |
| `LEX_QUERY_ROUTER` | `search-gateway.ts:57` (+ `query-expansion.ts:214`) |
| `LEX_WEB_ORIENTATION` | `search-gateway.ts:58`, `orientation/index.ts:55` |
| `LEX_SEARCH_VECTOR` | `search-gateway.ts:59` |
| `LEX_SEARCH_RERANKER` | `search-gateway.ts:60` |
| `LEX_SEARCH_GRAPH` | `search-gateway.ts:61` |
| `LEX_COHERENCE_CORPUS` | `orchestrator.ts:476` |
| `LEX_SEARCH_STUB` | `fts-search.ts:155` |

**Worth auditing all eight in Vercel now**, not just the two already found — `LEX_WEB_ORIENTATION`
in particular, since the Web/X orientation layer shipped on 6 Aug behind exactly this pattern and
would be equally dark if it were set to `TRUE`. A one-line `parseBool` helper would remove the
whole class, but that is a code change and is not made here.

## 16. §3 — the 4 August benchmark, re-run

The 4 Aug exchange is still in the `06ca807a` transcript verbatim: *"the current law on data
protection … is the United Kingdom Legislation UK GDPR and Data Protection Act 2018."*

Re-run today, the answer is the same core content plus two corpus hits — `Data protection
(guidance)` and the `Data Protection, Privacy and Electronic Communications (Amendments etc) (EU
Exit) Regulations 2019`. **But this comparison cannot yet tell us anything about the flip**,
because the retrieval that produced it was a single untiered BM25 call with no dense half and no
routing. There is nothing here to attribute to vector search. **The benchmark should be re-run
once §14 is resolved** — that is the point at which it becomes a real before/after.

Note also that the older half of the answer comes from the idea's stored *Legal landscape* field,
not from retrieval at all, so the benchmark partly measures stored state rather than search. A
sharper benchmark would use an idea with no Legal landscape recorded.

## 17. §4 — the 24 h watch, still not started

Same reasoning as §11: with dense not engaging, a 24 h digest would report a healthy system that
is not doing the thing being watched for. Current state, for the record:

| | `fts-serve` | `vector-serve` |
|---|---|---|
| served / errors | 2 / 0 | 178 / 0 |
| warm p50 / p95 | 2,550 / 2,550 ms | 6,292 / 22,354 ms *(my load test)* |
| queue p95 | **0 ms** | n/a |
| concurrency cap | **16** | 4 |
| rejections | n/a (unbounded) | 0 |
| RSS / peak | 1,243 / 1,243 MB | 1,079 / 1,088 MB |
| Gemini embed p50 | — | 228 ms |

`fts-serve`'s queue p95 of 0 ms at real traffic confirms the cap of 16 is not being approached by
production load — the queueing only ever appeared under synthetic fan-out. **Gemini embed volume,
the new cost line, is still zero**: no dense query has been issued from Vercel, so the flip has
cost nothing yet.
