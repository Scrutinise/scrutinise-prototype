# Vector serving — steps 1–3 built and measured, step 4 written and NOT deployed

*7 Aug 2026. Executes steps 1–3 of the "CC — vector serving" brief in full, plus the
build half of step 4. **Nothing has been deployed. No Railway service exists. No flag has
been flipped. `VECTOR_SEARCH_URL` is still unset locally and in Vercel.***

All latency numbers below were measured **locally**, where every R2 round-trip crosses the
public internet from a UK domestic connection. On Railway it is datacentre-to-datacentre.
**Absolute latencies here are not the production latencies** and must not be quoted as
such — the *shapes* and the *ratios* are what transfer. This is called out again wherever
a number appears.

---

## 1. Concurrency guard (B1) — landed and verified

`vector-query-service.ts` now carries the same global semaphore as `fts-query-service.ts`
(`VECTOR_MAX_CONCURRENT`, default 4). Verified with the same script that killed FTS,
extended to target either service (`SEARCH_TEST_TARGET=vector`).

| concurrent calls | outcome | errors | p50 | p95 |
|---|---|---|---|---|
| 10 | **survived** | 0 | 51.8 s | 62.1 s |
| 15 | **survived** | 0 | 58.6 s | 99.7 s |
| 20 | **survived** | 0 | 78.0 s | 132.2 s |
| 25 | **survived** | 0 | 108.0 s | 163.1 s |

Queue high-water mark reached 21, so the guard was genuinely exercised rather than never
reached. The regression test now **bypasses the result cache on the vector target** — with
the cache live every round after the first would be served from memory and the test would
pass while proving nothing.

**Two deliberate differences from the FTS guard**, both documented in the file:

1. **The slot is taken *after* the Gemini embed, not before.** The hazard is concurrent
   native calls against a Lance handle; `embedQuery` is an outbound HTTPS call and touches
   no handle. Holding a slot across it would serialise ~4 requests' worth of pure network
   wait for no safety gain.
2. **The queue is bounded** (`VECTOR_MAX_QUEUE`, default 64) and overflow is refused with
   `503 + Retry-After`, counted as `rejections` on `/stats`. FTS's queue is unbounded,
   which converts overload into unbounded latency — the 226 s result is what that looks
   like from outside, and a caller behind Vercel's `maxDuration` gave up long before.

---

## 2. Handle pool — **no. Keep the semaphore.**

The brief asked whether N table handles allow genuine parallelism instead of a hard serial
limit. Measured on a (handles × concurrency) grid, 16 queries per cell, query vectors
embedded once up front so the measurement is Lance-only.

**First run suggested a 1.29× pool gain. That was an artefact and it did not survive the
control.** All 4-handle cells had run *after* the 1-handle cells and were therefore
warmer. Re-running in a fresh process with the order reversed inverted the result to
**0.82×** — whichever handle count runs *second* wins. The handle count is doing nothing;
cache warming was doing all of it.

| | best throughput, 1 handle | best throughput, 4 handles | apparent "gain" |
|---|---|---|---|
| 1-handle cells first | 2.64 q/s | 3.40 q/s | 1.29× |
| 4-handle cells first | **3.82 q/s** | 3.13 q/s | **0.82×** |

**A single handle is not a serial bottleneck in the first place.** On one handle,
throughput scales ~4× from concurrency 1 to 8 (0.96 → 3.82 q/s). Pushed further on one
handle: 64 concurrent ANN queries **did not crash**, peak RSS 707 MB; throughput peaks at
concurrency 16 (4.12 q/s) and degrades beyond it (3.65 at 32, 1.33 at 64).

**Consequence worth flagging:** the premise recorded in `fts-query-service.ts` — that
"concurrent native calls against one handle are unsafe" — does **not** reproduce on the
vector path. I have not reproduced the original FTS crash and am not claiming the FTS
diagnosis is wrong; but a silent death with no JS-catchable error is, per `docs/CLAUDE.md`
§17, the signature of an OOM SIGKILL rather than of handle contention. If that is what it
was, the semaphore is a **memory** guard, and a handle pool would have made it worse.
Either way the semaphore stays — but `VECTOR_MAX_CONCURRENT=4` is a **throughput choice**,
not a safety floor, and the local optimum is nearer 8–16. **Do not re-tune it off these
local numbers** — re-measure on Railway once deployed.

---

## 3. Result cache — built, with a correction to the specified key

`query-cache.ts` (shared, wired into vector only) gives a short-TTL LRU cache
(`VECTOR_CACHE_TTL_MS`, default 5 min; `VECTOR_CACHE_MAX`, default 500) **plus
single-flight coalescing**.

⚠ **The brief specified a key of `{query, tier, limit}`. That key has a bug and I did not
build it.** The debates and committees streams both run on `tier='parliamentary'` and are
separated *only* by corpus scope. Keyed on `{query, tier, limit}`, a committees search
would be served the debates stream's cached results — exactly the "a stream quietly
serving another stream's content" failure the tier echo in both services exists to
prevent, reintroduced *behind* the check instead of in front of it. The key includes
`corpora` and `excludeCorpora`, sorted. There is a check for this.

**The cache sits in front of the embed, not just in front of Lance**, so a hit also skips
the Gemini call — that is B2's per-query cost and outage mode avoided, not just database
work.

### Hit rate — a sensitivity curve, not a measurement

**There is no search query log in this project.** Nothing records what users actually
searched (the stats DB is public-statistics data, not telemetry). A hit rate therefore
cannot be measured against real traffic today, only against a *model* of it — so the
harness reports several explicitly-stated profiles rather than one number pretending to be
a measurement. 40 requests per profile:

| profile | what it models | hit rate |
|---|---|---|
| `unique` | every query distinct — the floor | **0%** |
| `zipf` | many users, Zipf-distributed topic popularity | **45%** |
| `refine` | one user iterating on one idea across the 5 streams | **62.5%** |
| `router` | a topical day: small hot topic pool × 5-stream fan-out | **87.5%** |

Median latency on a hit: **1–2 ms**, against **7.8–8.1 s** uncached (local numbers).

**The part that does *not* depend on the traffic model** is coalescing. Under the router's
real concurrent shape — 5 users searching the same topic, 25 simultaneous requests, only 5
distinct `{query, scope}` keys — the service did **3 units of database work instead of 25**
(10 hits, 12 coalesced, 3 misses). A plain TTL cache would have done 25: N simultaneous
identical queries are N misses. A coalesced request also **never takes a semaphore slot**,
so this is a concurrency-guard saving as much as a latency one.

The real hit rate arrives on its own once deployed: it is reported on `/stats` and will be
carried by the step-6 digest. **That is the number to trust.**

---

## ⚠ 4. Found while measuring: `corpus_chunks` has no indices, and it costs 76% of every query

This is not in the brief and is the largest finding of the sprint.

`corpus_chunks` — **21,839,900 rows — carries no index of any kind** (`corpus_vec` has its
`IvfPq` vector index; chunks has nothing). Snippet hydration in `vector-query-service.ts`
runs `where("sectionId IN (…)")` against it on **every** query, which is a full scan.

Phase breakdown of a real `/vector-search`, local:

| phase | mean | share |
|---|---|---|
| Gemini embed | 348 ms | **3%** |
| ANN over `corpus_vec` | 2,178 ms | **21%** |
| **snippet lookup over `corpus_chunks`** | **7,825 ms** | **76%** |

Confirmed as a scan, not a lookup:

- IN-list of **1** id → 8,965 ms · **5** ids → 5,743 ms · **20** ids → 6,348 ms
  — **cost is independent of how many ids are asked for.**
- Same table, **no predicate**, limit 80 → **132 ms.**

So the vector service's latency is dominated not by vector search but by an unindexed
scan, and the cache's real saving is mostly this. The fix is a scalar (BTREE) index on
`corpus_chunks.sectionId`.

**I have not built it, deliberately.** Creating an index across 21.8 M rows is corpus-wide
index work, which per `docs/CLAUDE.md` §17 is Heavy Job Runner territory and not something
to start without your word. There is no free alternative source for the snippet:
`corpus_sections` holds no body text (only an `r2Key` pointer).

**Recommendation:** treat this as the next piece of work after the deploy, ahead of any
re-tuning of `VECTOR_MAX_CONCURRENT`. It is worth more than the semaphore, the pool and
the cache combined on cache-miss traffic — which is all traffic the first time.

---

## 5. Step 4 — `vector-serve-run.ts` is written. It has NOT been run.

A near-copy of `fts-serve-run.ts`, with the differences documented in the file:

- start command `VECTOR_PORT=8081 npx tsx search/vector-query-service.ts`
- **`GEMINI_API_KEY` injected** (B2) — required, unlike `fts-serve`
- **`NEON_DATABASE_URL` deliberately *not* injected** — this service opens no Postgres
  connection, and injecting an unused production credential widens where that secret lives
  for no benefit
- a **`plan`** command that prints exactly what `up` would do and creates nothing
- a **`restart`** command (`deploymentRedeploy`, restart the same build) distinct from
  `redeploy` (`serviceInstanceRedeploy`, rebuild from source). The distinction is
  load-bearing: the service calls `openTable()` once at boot with no
  `readConsistencyInterval`, so after any index work it keeps serving the old snapshot and
  any measurement taken before a restart is meaningless (§17 records this as already paid
  for on `fts-serve`).

**One prerequisite found:** `RAILWAY_PROJECT_ID` is **not in `scrutinise-web/.env`** —
only in `INGEST_PLAYBOOK.md`. `fts-serve-run.ts` would send `undefined` to the API and
fail opaquely. I verified the value read-only against the live API (project
`68707c61-5c68-4f37-88fc-c301fd6b90e7`, "miraculous-nature"; production env
`991f733c-…` matches the hardcoded `ENV_ID`; `fts-serve` id matches the state file) and
defaulted to it, still env-overridable. **There is no `vector-serve` service in the
project** — confirming it has never been deployed.

`plan` output confirms: would CREATE, 5 variables injected, public domain on 8081,
`restartPolicyType: ALWAYS`, `watchPatterns: scripts/ingest/search/**`.

---

## 6. Early read on B3 (memory) — the brief's premise looks wrong, but this still needs the real measurement

The brief says "21.8M vectors + 21.8M chunk bodies, both opened at boot". **`openTable()`
is a metadata operation, not a load** — LanceDB streams from object storage. Measured
locally:

- both tables open, service idle at boot: **201 MB RSS = 2.6% of the 8 GB cap**
- after 70 concurrent-load queries: **282 MB**
- in-process probe, 64 concurrent ANN queries: **peak 707 MB**

That is a strong prior that this fits comfortably. **It is not the measurement §17 asks
for**, which must be taken on Railway against the real per-replica cap. The instrument is
built and ready: `/stats` now reports `memory` with a continuously-sampled **peak** (a peak
sampled only when someone calls `/stats` would miss the spike that kills the process), and
`vector-serve-run.ts stats` prints it against the cap with a ⚠ at 70%.

---

## Verification

- `tsc --noEmit` clean across `search/` (four pre-existing errors elsewhere in
  `scripts/ingest` are unrelated and untouched).
- `check-vector-serving.ts` — **22/22 pass**: cache-key scope separation (incl. the
  debates/committees case), TTL expiry, coalescing, failures-not-cached, bounded LRU
  eviction, disabled-cache bypass.
- Guard regression: `SEARCH_TEST_TARGET=vector` stress test, 4 rounds to 25 concurrent, 0
  errors, 0 sheds, service alive throughout.

Also fixed: `concurrency-stress-test.ts` had no import/export, so its `main()` sat in the
global TypeScript namespace and collided with other import-free scripts in
`scripts/ingest`. It is now a module. (The `probe*.ts` files it was colliding with are
another session's untracked scratch and were left alone.)

## New/changed files

| file | what |
|---|---|
| `search/vector-query-service.ts` | semaphore + bounded queue, cache, memory + latency instrumentation |
| `search/query-cache.ts` | **new** — TTL LRU + single-flight, shared |
| `search/vector-serve-run.ts` | **new** — Railway serve runner, incl. `plan` and `restart` |
| `search/check-vector-serving.ts` | **new** — 22 checks |
| `search/vector-handle-pool-probe.ts` | **new** — the handle-pool grid |
| `search/vector-snippet-probe.ts` | **new** — phase breakdown; found the chunks scan |
| `search/vector-cache-replay.ts` | **new** — hit-rate profiles + coalescing |
| `search/concurrency-stress-test.ts` | targets either service; module scope |

## Open decisions for Charlie

1. **Deploy `vector-serve`?** (step 4) — costs one always-on Railway container; no user
   impact, both gates stay shut.
2. **The `corpus_chunks` index.** Recommend doing it, via the Heavy Job Runner, before
   step 7's load test — otherwise that test measures an unindexed scan.
3. **`VECTOR_MAX_CONCURRENT`** stays at 4 for now; re-tune only from Railway measurements.
