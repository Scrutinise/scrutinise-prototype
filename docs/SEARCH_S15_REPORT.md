# SEARCH S15 — MAKE THE DENSE SERVICE SURVIVE ITS OWN LOAD

**From:** CC-Search · **Executes:** `docs/BRIEF_SEARCH_S15.md`
**Report opened** 2026-08-27 03:31 UTC · every timestamp in this file is UTC.
**Service of record:** `vector-serve-production.up.railway.app`, Railway project `miraculous-nature`,
region `europe-west4-drams3a`, plan `hobby`, `numReplicas: 1`.
**Datasets of record:** `corpus_vec` and `corpus_chunks`, **22,670,808 rows each**
(the figure in circulation is 21,846,364 — that is superseded; **824,444 rows have been appended
since**, and §1.2 is about what that append did).

---

## §0 — THE ONE-LINE ANSWER, BECAUSE IT CHANGES THE ORDER OF THE BRIEF

⚠⚠ **THE SERVICE IS NOT SLOW BECAUSE IT IS FOUR WIDE. IT IS SLOW BECAUSE 1,478,964 ROWS OF
`corpus_chunks` (6.5%) ARE OUTSIDE ITS `sectionId` INDEX, AND EVERY SINGLE SNIPPET LOOKUP
BRUTE-FORCE SCANS THEM.**

Measured against the live dataset, an equality lookup on the *indexed* column takes **133,401 ms**,
while the same table's *unindexed* `chunkId` column answers in **21,470 ms** — the "indexed" column
is six times slower than the unindexed one. The ANN search it exists to decorate takes **1,301 ms**.

**The fix cost €0.008 and 45 seconds.** Sizing capacity against a stale index would have bought
permanent monthly compute to carry a cost that one maintenance job removes.

⚠ **The repository predicted this in writing and the check that should have caught it could not
fail.** `build-chunks-scalar-index.ts` carries the warning in its own header — *"THIS INDEX WILL
NEED REBUILDING IF THE MAX_CHUNKS TOP-UP HAPPENS … an append leaves new rows outside the index"* —
and its `--verify-only` asked *"is there an index on this column?"*, which an index missing 6.5% of
the table answers **yes**. It printed **"an index on sectionId EXISTS. Nothing to do."** Fixed, and
watched failing against the real state first.

### And then the sprint's second answer, which is bigger

⚠⚠ **THE SERVICE WAS ALSO SERVING A SEARCH THAT HAD NEVER ACTUALLY RUN.** With capacity fixed, the
64-question baseline was retaken with the four dense streams **arriving** — `degraded: []`,
`vector+209` engagement — for the first time in this project's history. S13 measured **one** dense
stream; S14's surviving artefact is named `s14-arms-bm25.json` and records
`streams=NONE … DEGRADED(1)`.

| | S13 (1 dense stream) | S14 (dense OFF) | **S15 (4 streams, arriving)** |
|---|---|---|---|
| what retrieval finds (in-stream@20) | 27/64 | 19/64 | **32/64** |
| what a user sees today (round-robin) | 15/64 | 14/64 | **19/64** |
| what a user could see (judged + reranker) | — | 19/64 | **30/64** |

▶ **Dense retrieval is worth THIRTEEN points of in-stream recall** — S14 predicted "roughly twelve".

⚠⚠ **And the sentence that should be read before any of the good news: with today's production
configuration, 45 of 64 questions return nothing correct. The merge is no longer the constraint;
retrieval is.** §6.4.

---

## §1 — THE DIAGNOSIS: FOUR HYPOTHESES, FOUR TESTS

*Taken 2026-08-27 02:48–03:30 and 10:30–11:05 UTC against the running service and the live
datasets. Nothing was changed on the service before any of it. Every figure below is measured;
where a number is derived, the arithmetic is shown.*

**Predictions for H2, H3 and H4 were logged in `CHANGE_LOG.md` at 10:30 UTC before any of them was
tested**, and are scored honestly below — **two of the three were wrong**, and the wrong ones were
more useful than the right one.

| | hypothesis | verdict | the number that settles it |
|---|---|---|---|
| **H1** | an arbitrary constant | ✅ **TRUE** | `VECTOR_MAX_CONCURRENT ?? '4'` — copied from another service |
| **H2** | processor-bound | ⚠ **PARTLY, AND MORE THAN EXPECTED** | the container has **8 vCPU**, not the 48 `os.cpus()` reports; at width 16 it burns **4.1–4.6** of them |
| **H3** | memory-bound | ❌ **FALSE** | 1.95 GB of an 8 GB limit; but the index is **147.58 GB**, not the 2–8 GB I predicted |
| **H4** | storage / network-bound | ✅ **TRUE, AND DOMINANT** | 147.58 GB in object storage, **no local cache**, `cpu/wall 0.53` on a quiet query |

▶ **The brief called H4 "most likely to be true and least likely to be looked for". It was right.**

### 1.1 H1 — Why 4? — **a constant, copied from another service's evidence**

`vector-query-service.ts:86`:

```ts
const MAX_CONCURRENT = parseInt(process.env.VECTOR_MAX_CONCURRENT ?? '4', 10)
```

Read off the running service, not off the code: `/stats` reports `concurrency.max: 4`, so
`VECTOR_MAX_CONCURRENT` is **unset on Railway** and the value in force is the hard-coded default.

**It is not derived from CPU count and not derived from memory.** It was copied from
`fts-query-service.ts`'s `FTS_MAX_CONCURRENT` when the guard was added here as blocker B1
(`VECTOR_DEPLOY_READINESS.md`), and the measurement behind that number — *"10 concurrent requests
survived but took 226 s; 15 concurrent killed the process outright"* — **was taken on the FTS
service, against the FTS table.**

⚠⚠ **And it is already on the record that it did not reproduce here.** `fts-query-service.ts`
lines 33–48, dated 7 Aug 2026:

> *"The diagnosis above — 'concurrent native calls against one handle are unsafe' — did NOT
> reproduce on the vector path, which has the identical one-handle-per-table shape. Measured on
> vector-query-service.ts: **64 concurrent ANN queries against a single handle survived, and
> throughput SCALED ~4× from concurrency 1→8**, so a single handle is not a serial bottleneck and
> concurrency alone did not kill it."*

So this service has been rationed to 4 on evidence gathered from a different service, while its own
evidence says it survives 64. **§5's "vertical first" is not a hypothesis — it has been measured
once already and never acted on.** It still needs re-taking (§5), because that note is three weeks
and one large append old.

▶ **Consequence for the brief:** §1's warning *"if it is memory-derived, width costs RAM per replica
and §5 changes shape entirely"* does not apply. Width here is neither RAM-bound nor core-bound;
see 1.3.

### 1.2 What is one request actually made of? — **the snippet scan, by two orders of magnitude**

**⚠ This had been measured once before, on 7 Aug 2026, and written into
`build-chunks-scalar-index.ts`. It is not new; it is a regression.** That file records:

| stage | 7 Aug 2026 | share |
|---|---|---|
| embed (Gemini) | 348 ms | 3% |
| ANN (`corpus_vec`) | 2,178 ms | 21% |
| **snippets (`corpus_chunks`)** | **7,825 ms** | **76%** |

**Re-measured 27 Aug 2026, running the service's own query code against the same R2-backed
datasets** (`_s15-probe-local.ts`). Absolute milliseconds on this host are not the service's — this
machine is not in `europe-west4` and its route to R2 is a domestic connection — but the *shape*,
the *ratios* and the *cost model* transfer, and the service's own instrumentation confirms them
after the deploy (§6):

| stage | wall | cpu | cpu/wall | what it is |
|---|---|---|---|---|
| `embedQuery` | **395 ms** | 94 ms | 0.24 | one Gemini HTTPS call |
| ANN, `vectorSearchSections` (tier=legislation, limit=60) | **1,301 / 1,419 / 1,350 ms** | ~1,500 ms | **1.10** | CPU-bound, and fast |
| **snippet scan, `sectionId IN (…)`** | **130,229 ms** | 40,578 ms | 0.31 | **I/O-bound, and 100× the ANN** |

⚠⚠ **AND ITS COST DOES NOT DEPEND ON HOW MANY SECTIONS YOU ASK FOR.** That is the signature of a
scan rather than a lookup, and it is unambiguous:

| ids in the predicate | rows returned | wall |
|---|---|---|
| 1 | 1 | **130,229 ms** |
| 1 | 1 | **121,867 ms** |
| 12 | 13 | **132,077 ms** |
| 60 | 71 | **130,131 ms** |
| 60 | 71 | **131,603 ms** |

The same experiment run *from outside* against the live service agrees: a `limit=1` request (ANN
budget 60 chunks, snippet budget 8 rows) and a `limit=12` request (ANN budget 60 chunks, snippet
budget 96 rows) cost **3,802 ms and 3,171 ms** — the eightfold difference in snippet work is
invisible, because the snippet work is not proportional to it.

#### Why — and this is the finding

`corpus_chunks` **does** carry a BTree index on `sectionId` (`sectionId_idx`, built 7 Aug 2026,
€0.010, 39.1 s). Reading the index's own statistics rather than its existence:

```
corpus_chunks — 22,670,808 rows
  index sectionId_idx (BTree on sectionId)
    numIndexedRows   21,191,844
    numUnindexedRows  1,478,964     ⚠⚠ 6.5%
corpus_vec — 22,670,808 rows
  index vector_idx (IvfPq on vector)
    numIndexedRows   22,670,808
    numUnindexedRows          0     ← the vector side is fine
```

A LanceDB scalar index covers only the rows that existed when it was built. **The 824,444-row
append since the docs were written, plus earlier appends, left 1,478,964 rows outside it**, and
every predicate evaluation must brute-force scan those rows — with their full `body` text — before
it can answer. At roughly 1.5 KB a row that is **~2.2 GB read from R2 on every snippet lookup**,
which is the whole 130 s here and the 3–25 s on the service.

**The independent confirmation is on the bill.** Railway reports `vector-serve` at
**NETWORK_RX_GB 3,168.5** month-to-date — 3.17 TB of ingress into a service that has served on the
order of a thousand real queries. At ~2.2 GB a scan the arithmetic closes.

⚠ **This is `docs/CLAUDE.md` §17's standing rule and `INGEST_PLAYBOOK.md` §20, verbatim:** *"after
any backfill or large append, rebuild/merge the index before it serves users. A LanceDB append
leaves the new rows searchable by brute-force scan — correct, but every subsequent query pays for
them forever. That is what made warm p50 26 seconds while everything still 'worked'."*

▶ **Which stage dominates: the snippet hydration, and only because the index is stale.** Not the
embed (3%), not the ANN (which is correctly indexed and takes ~1.3 s), and not the queue — the
queue wait is a *consequence* of a service time this large, not a cause.

### 1.3 H2 — Is the box actually busy? — **⚠ THE CONTAINER HAS 8 vCPU, NOT 48**

**I predicted the vCPU limit would be "8 or fewer". It is exactly 8** — and the more useful half is
where the 48 came from.

| read from | value | what it is |
|---|---|---|
| `os.cpus().length` inside the container | **48** | ⚠ **the HOST's cores, not our quota** |
| `os.loadavg()` inside the container | **[20.0, 21.8, 23.1]** | ⚠ also the host's — other tenants' work |
| Railway `CPU_LIMIT` | **8.000** | **the actual cgroup quota** |
| Railway `MEMORY_LIMIT_GB` | 8.000 | matches `MEM_CAP_BYTES` |
| in-process `cpu_over_wall`, quiet, one query at a time | **0.53** | half the wall time is not CPU at all |
| in-process `cpu_over_wall`, at width 16 under load | **4.11 – 4.56** | **51–57% of the 8-vCPU quota** |

⚠⚠ **`os.cpus()` on Railway reports the host and is worthless as a capacity number.** The previous
draft of this report printed "a host reporting 48 cores" as evidence of headroom. That was an
inference dressed as a measurement (`CLAUDE.md` §19) and it is corrected here: **the real quota is
8, and at width 16 we are already using more than half of it.**

▶ **This retro-explains the width-32 result that §5 could only call "confounded by drift".** At
width 16 the service burns 4.1–4.6 of 8 vCPU; doubling the width would push past the quota and into
CPU throttling. **There is now a mechanism, not just a noisy observation, and it says 16 is close to
the right number rather than accidentally so.**

⚠ My prediction that one isolated query would use "under 3 cores' worth" holds (0.53) — but I did
not predict the load figure, and 4.1–4.6 of 8 is the number that matters for §5.

### 1.4 H3 — Memory-bound? — **NO. But the index is 147.58 GB, and I predicted 2–8**

**Verdict: FALSE.** `MEMORY_USAGE_GB` sits at **1.95 of an 8 GB limit** (24%), peak RSS 2,136 MB
(28%). Nothing is paging; **adding RAM buys nothing.** That part of the prediction was right.

⚠⚠ **The size prediction was wrong by more than twenty times, and the reason is the finding.** I
predicted 2–8 GB on the reasoning that IVF_PQ compresses a 768-dim float32 vector from 3,072 bytes
to ~96–192. Measured, by listing the dataset's own objects in R2:

| | objects | size |
|---|---|---|
| **`_search/corpus_vec.lance` TOTAL** | 4,123 | **147.58 GB** |
| ├ `data` — the table itself | 2,015 | **130.55 GB** |
| ├ `_indices` — the ANN index | 16 | **16.92 GB** |
| ├ `_versions` | 974 | 0.10 GB |
| └ `_transactions` / `_deletions` | 1,118 | 0.01 GB |
| **`_search/corpus_chunks.lance` TOTAL** | 55,052 | **45.69 GB** |
| ├ `data` | 18,086 | 31.37 GB |
| ├ **`_versions`** | 18,448 | ⚠ **13.39 GB** |
| └ `_indices` | 4 | 0.90 GB |

**Raw arithmetic:** 22,670,808 × 768 × 4 bytes = **64.86 GB** (the brief said "roughly 70 GB" —
close). **Stored: 147.58 GB, or 6,990 bytes per vector against 3,072 raw — 2.3× LARGER, not
smaller.**

⚠ **Both halves of my reasoning were true and I combined them wrongly.** The PQ compression is real
but it lives **only in `_indices`**: 16.92 GB / 22.67M = **746 bytes per vector, a genuine 4.1×
compression**. The `data` directory keeps the **original f32 vectors** alongside `chunkId`,
`sectionId`, `corpus` and `tier` as Utf8 strings — so the dataset is index *plus* full table, not
index instead of table.

⚠⚠ **AND THAT MATTERS FOR EVERY QUERY, BECAUSE `refineFactor: 2` READS THE RAW VECTORS.**
`vector-core.ts` asks for `limit × CHUNK_OVERSCAN` = 300 candidates and then re-ranks `× REFINE`
of them with **exact** cosine distance — which cannot be done from the quantised index and must
fetch original vectors out of the 130.55 GB `data` directory. At 600 × 3,072 bytes that is ~1.8 MB
of raw vectors per query **on top of** the `nprobes: 64` partition reads. **This is the mechanism
behind H4, and it is a dial we control** — see 1.5.

⚠ **Named in passing: `corpus_chunks/_versions` is 13.39 GB across 18,448 objects** — accumulated
manifests, 29% of that dataset's size, serving no query. Not this sprint's job; worth an ingest
ticket.

### 1.5 H4 — Where does a query read from? — **R2, per query, with no cache. TRUE and dominant**

`lance.ts` opens both tables straight off R2 over the S3 object-store backend, with **no local
cache directory and no mounted volume**:

```ts
lancedb.connect(`s3://${bucket()}/_search`, { storageOptions: r2StorageOptions() })
```

So **there is no resident index and no local copy.** 193 GB of Lance dataset lives in Cloudflare R2
and the service in Railway `europe-west4` reads what it needs over HTTPS, per query, every time.
One process, one `openTable` per table at boot, every request against those same two handles.

**The evidence, four independent lines:**

1. **The code.** No `cache_dir`, no volume in the service manifest (`volumeMounts: []`).
2. **`cpu_over_wall` = 0.53** on a quiet, one-at-a-time query: **47% of the wall clock is not CPU
   at all.** The process is waiting.
3. **The warm-up curve.** Across ten sequential queries after a restart the snippet stage ran
   3,866 → 1,172 → 368 ms and the first request took 6,003 ms against a later 2,227. Local storage
   does not produce a ten-fold warm-up curve; a remote object store filling a page cache does.
4. **Position dominates.** The *same code* against the *same dataset* took **130 s** from this
   laptop for a scan the Railway container does in ~1–3 s. Nothing differs but the network path.

⚠ **What I could NOT measure, stated rather than glossed:** bytes read per query, directly.
The test used Railway's own `NETWORK_RX_GB` counter across a controlled window of 20 queries and
**it did not move** (0.9480 → 0.9480 over the window, after a 180-second settle). Either the metric
lags further than that, or it counts only public ingress to the container and not the service's own
outbound fetches to R2. **Reported as UNMEASURED, not as "no traffic"** — and it means the one
number the brief asked for in H4's test is the one number I do not have.

⚠ A proxy-based byte count was considered and rejected: SigV4 signs the endpoint host, so
interposing a counting proxy invalidates every request's signature, and re-signing means
reimplementing SigV4 to measure something the four lines above already establish qualitatively.

▶ **The consequence, and it is the expensive one.** If the block is the object store then **more
CPU buys nothing, more RAM buys nothing, and replicas MULTIPLY the dominant cost** — each replica
opens its own handles and re-reads R2 independently rather than sharing a cache. **That is the
strongest argument in this report against horizontal scaling**, and it is why §5 bought vertical
width only.

### 1.6 The width arithmetic — **stated, and then stated again as void**

The measured inputs, taken on a **quiet** service one request at a time, `noCache`, `limit=60`
(production's shape: the router asks for 20, `runVectorSearch` requests `max(20×3, 30)` = 60):

| | |
|---|---|
| mean service time, 10 queries, mixed tiers | **8,306 ms** |
| of which embed (outside the semaphore) | **247 ms — 3%** |
| **mean time holding a semaphore slot** | **8,058 ms** |
| independent cross-check: 12 requests, 4 wide, drained in 19 s | **6,333 ms** mean |

With width **W** and mean slot-holding service time **S**, capacity is `W / S` requests per second.
One search with four dense-enabled streams issues **four** requests.

```
searches per second sustainable  =  W / (4 × S)
at W = 4, S = 8.06 s             =  4 / 32.2  =  0.124  →  one search every 8.1 seconds
```

**For the queue to stop growing at a given arrival rate λ (searches/sec):  W ≥ 4 × S × λ.**

| target | width required at S = 8.06 s |
|---|---|
| 1 search every 8 s (today's ceiling) | 4 |
| 1 search every 2 s | **16** |
| 1 search/sec | **32** |
| the brief's §6.1 two-user test (2 searches arriving together) | 8 to clear in one round |

⚠⚠ **AND THAT WHOLE TABLE IS VOID, WHICH IS WHY IT IS SHOWN RATHER THAN OMITTED.** Every number in
it is a function of **S = 8.06 s**, and S is ~90% stale-index scan. Provision width against this
table and Scrutinise buys, permanently and monthly, capacity whose only purpose is to absorb a cost
that €0.01 removes. **The honest answer to "state the width at which the queue stops growing" is:
not until S is re-measured against a complete index.** That re-measurement is one command and 39
seconds, and it is D-1.

▶ **What the arithmetic does say, independent of S:** the `4 ×` term is a choice, not a law — which
is §4, and it divides the required width by four at any S.

### 1.7 What does width cost? — Railway's published rates, read today

From `railway.com/pricing`, 2026-08-27:

| | rate | per month (30 d) |
|---|---|---|
| CPU | $0.00000772 / vCPU / second | **~$20 / vCPU** |
| Memory | $0.00000386 / GB / second | **~$10 / GB** |
| Volumes | $0.00000006 / GB / second | ~$0.16 / GB |

Hobby plan: $5/month including $5 of usage credit, **up to 48 vCPU / 48 GB per service** — noting
`docs/CLAUDE.md` §17's correction that this is an **aggregate across replicas**, and the measured
**per-replica** ceiling is 8 GB.

Month-to-date usage, from Railway's own usage API (`_s15-cost.ts`), 1–27 Aug:

| service | CPU | Memory | NETWORK_RX_GB |
|---|---|---|---|
| **vector-serve** | 210.8 | 73,032 | **3,168.5** |
| fts-serve | 673.9 | 67,802 | 1,273.4 |
| scrutinise-db | 13.5 | 8,408 | 0.05 |
| Ops | 43.2 | 6,489 | 2.3 |

⚠ **The unit of the CPU and Memory columns is inferred, not documented, and is labelled as such.**
The only column that can be pinned is `DISK_USAGE_GB` on `scrutinise-db` (99,151.58): read as
GB-**minutes** that is 2.63 GB average against a 20 GB volume, which is plausible; as GB-hours it
would be 158 GB, which is impossible. On that reading vector-serve is **~1.94 GB average memory**
and **~0.006 vCPU average**, costing roughly **$17/month**, essentially all of it memory. The gap
between 1.94 GB billed and 291 MB RSS is consistent with Railway charging container memory
including page cache — which a service streaming gigabytes off R2 would fill.

▶ **The marginal cost of a replica**, at the measured 291 MB peak and near-zero CPU, is about
**$3/month** if billed on RSS and about **$20/month** if billed as vector-serve currently is.
Against a current Railway spend of roughly $36/month across the project, adding four replicas is a
**$12–80/month** decision. R2 egress is $0 (Cloudflare charges none), so the 3.17 TB does not
appear on a bill — it appears as latency instead.

⚠ The brief's *"compute already costs roughly eight times storage"* does not reconcile against
Railway alone, where compute is ~100× Railway storage ($36 vs $0.36). The 8× is presumably across
the whole bill including R2 object storage, which is not visible from here. **Flagged rather than
adopted** (`CLAUDE.md` §19: a fact that was measured and a fact that was inferred must not look
identical on the page).

### 1.8 Does a client disconnect leave the work running? — **yes. Proven, from outside, 12 of 12**

`check-vector-cancel.ts`, against the build that was running before anything in this sprint
shipped. Twelve distinct queries, `noCache`, fired together; every client aborted at t+2,027 ms —
and it is checked, not assumed, that none of them had completed first.

**Prediction logged before the run:** `served` will climb to +12 after every client is dead.

```
baseline   served=10 inFlight=0 queued=0 rejections=0
every client killed at t+2027 ms — 12 aborted, 0 completed first, 0 shed, 0 errored
  t+   4s after the last client died · served  +0 · inFlight 4 · queued 8
  t+   7s                                served  +4 · inFlight 4 · queued 4
  t+  10s                                served  +5 · inFlight 4 · queued 3
  t+  13s                                served  +8 · inFlight 4 · queued 0
  t+  16s                                served  +9 · inFlight 3 · queued 0
  t+  19s                                served +12 · inFlight 0 · queued 0
```

▶ **The service executed 12 of 12 requests whose callers were already gone**, and took 19 seconds
after the last client died to finish doing so. The measurement is the service's own `served`
counter, which increments whether or not anyone is still on the socket — a latency could not have
distinguished *"the queue drained"* from *"the queue was thrown away"*, which is the entire
question.

⚠ **This is the two-sided check the brief asks for, watched failing first.** The same script run
after §2 must return `cancels-abandoned`; it is `--expect=` driven precisely so it cannot pass
vacuously.

---

## §2 — CANCEL WORK NOBODY IS WAITING FOR

**Built, deployed, and watched failing before it was watched passing.** The same script, the same
twelve requests, the same abort at t+2s:

| | before (build of 24 Aug) | after (`S15-cancel-bounded-batch`) |
|---|---|---|
| requests abandoned | 12 | 12 |
| **`served` AFTER every client was dead** | **+12** | **+0** |
| counted as `abandoned` | *(not reported)* | **+12** |
| **recovery to idle** | **19 s** | **3 s** |

Repeated at the final configuration with **48** abandoned requests: `served +0`, `abandoned +48`,
recovery **6 s**.

**Three checks, and the third earned its place immediately.** The flag is tested before the embed
(the one part that costs money), after the slot is granted (the check that makes the queue drain),
and *between the ANN and the snippet scan*. In the after-run **not even the four already running
completed** — they finished their ANN, met the third check, and were dropped before the expensive
stage. The brief allows a running job to finish; this does better than it had to.

⚠ **Abandonment is counted per CACHE KEY, not per socket, and that is load-bearing.** `QueryCache`
coalesces concurrent identical requests onto one `compute()`. Cancelling on the owning socket's
disconnect alone would strand every request coalesced behind it — a correctness bug introduced by
a performance fix. Work stops only when the last client waiting on that key has gone, and
`liveKeys` is on `/stats` so the bookkeeping is observable rather than trusted.

⚠ **`pump()` is where the queue actually drains.** It was `waiters.shift()` and an unconditional
grant, so a queue of sixty abandoned requests was sixty pieces of real work still to be done for
nobody. It now skips abandoned waiters instead of granting them a slot, and `pruneWaiters()` drops
them from the queue so a dead request cannot occupy a place a live one is being refused for.

## §3 — A BOUNDED QUEUE THAT SAYS SO

**Queue cap is now `2 × width`, derived and not asserted** — it tracks the width, so widening the
service widens the queue in the same proportion rather than leaving behind a number that meant
something at a width nobody runs. At the shipped width of 16 that is **32**, read off `/stats`.

`check-vector-shed.ts`, run at both widths, **8 assertions, 0 failures**:

| assertion | observed |
|---|---|
| the cap is a small multiple of the width | 2.0× (it was 16× — 64 deep on 4 wide) |
| **a service filled exactly to capacity refuses nothing** *(the negative control)* | **0 of 48 shed** |
| a full queue sheds | **6 shed for 6 excess**, 48 served |
| **every refusal is FAST** | **slowest 420 ms**, against the 25,000 ms timeout it replaces |
| every refusal is machine-readable | `{"reason":"overloaded", ...}` on all of them |
| a shed is a 503, never a 500 | statuses observed: 200, 503 |
| rejections are counted on `/stats` | +6 for 6 observed sheds |

### The refusal reaches the user as a stated gap

`runVectorSearch` now carries its reason out — `overloaded` / `timeout` / `unreachable` / `error` /
`unscoped` — instead of returning a bare `[]`. `overloaded` is separated from `error` deliberately:
a saturated service is a gap the user should hear about, a broken one is not the same sentence.
The router collects them per search (`AsyncLocalStorage`, because a module-level array would report
one user's degradation inside another user's search) and the gateway surfaces
`meta.denseDegraded`.

⚠⚠ **This closes S14 §0's finding at its source.** A stream whose dense leg was refused used to
return a BM25-only ranking *byte-for-byte identical* to a stream that never had a dense leg. Those
are now different objects.

`npm run check:dense-degraded` — **14 assertions, 0 failures**, every positive paired with the
arrangement that must NOT trigger it (a healthy service must set no failure; a plain 500 must not
say "overloaded"; a 404 on the batch route is a version skew and must not make Lex announce an
outage). **It caught a real defect on the way:** one entry's hydration throwing rejected the whole
`Promise.all` and turned a single stream's fault into a total batch failure — precisely what the
brief warned batching would do if written the obvious way.

### ⚠⚠ 3.1 THE REJECTION RATE — THE BRIEF'S ACCEPTANCE MEASURE FOR THE WHOLE SPRINT

The brief is explicit: *"'I could not search' is a last-resort safety net that should essentially
never fire once §1's fix lands… If the rejection rate is not approximately zero after §1 and §5, the
capacity fix has not worked and that is the finding."*

| workload | dense requests | **rejections** | timeouts |
|---|---|---|---|
| 2 concurrent users × 4 streams, 5 rounds | 40 | **0** | 0 |
| 4 concurrent users × 4 streams, 4 rounds | 64 | **0** | 0 |
| 8 concurrent users × 4 streams, 3 rounds | 96 | **0** | 0 |
| **the full 64-question gold sweep at production settings** | **209** | **0** | **0** |
| `check-vector-shed` — deliberate overload, 54 fired at a 48-capacity service | 54 | **6, by design** | 0 |

▶ **The rejection rate is zero on every real workload, and non-zero only when the queue is
deliberately overfilled to prove the shed path still works.** That is the acceptance measure met in
both directions: it never fires when it should not, and it does fire when it must.

## §4 — FOUR REQUESTS PER SEARCH: SCOPED, COSTED, AND **NOT RECOMMENDED**

**Built and live** (`POST /vector-search-batch`), **measured**, and **the premise does not hold.**

`measure-vector-batch.ts`, 5 rounds, arms alternated against the same warm service:

| | p50 |
|---|---|
| solo — 4 concurrent requests, what `fusedStream` does today | **2,873 ms** |
| batch — 1 request carrying all four | **6,495 ms** |

**The batch is 126% SLOWER**, and the response breakdown says exactly why: it runs the four ANNs
**sequentially** inside one semaphore slot (`ann` 4,987–7,116 ms), while four solo requests run
their ANNs **in parallel across four slots**.

⚠ **The design worked; the premise was wrong.** The one-scan consolidation did what it was built
to do — `snippetMs` 419–1,440 ms for all four streams together, against four separate scans — but
after §1.2's index rebuild the snippet scan is no longer the dominant stage (36% at rest, ~350 ms
under load), so consolidating it saves far less than serialising four 1.5 s ANNs costs.

✅ **The correctness half passed: 20/20 stream-rounds returned an identical id list.** The batch is
a pure transport change, so if it is ever wanted it can be wired in without a retrieval regression.

▶ **Recommendation: do not wire it into the router.** It is kept as a live, measured endpoint. The
one condition that would make it worth revisiting is the queue becoming the constraint again — and
at width 16 it is not: `queueHighWaterMark` was **0** under a four-user load and **16 of 32** under
eight users.

⚠⚠ **`LEX_STREAM_CONCURRENCY=3` IS NOW UNJUSTIFIED — BUT THAT IS NOT THE SAME AS WRONG.**

The brief asks whether batching makes it obsolete. Batching is not being wired in, so the question
resolves the other way: **the cap's stated reason has gone regardless.** Its comment reads *"Default
3, under the service's 4, so one query never fills the pool on its own"* — and the service is now
**16** wide. S8's finding that raising it to 4 made everything worse was explicitly *because 4 was
exactly this service's width*; that arithmetic no longer describes anything.

**What is measured:** `s15-run.sh` ran the full 64-question sweep at concurrency **3** with
**0 rejections and 0 timeouts** (§3.1), where `s14-run.sh` had to throttle to **1**. So 3 is
comfortable and 1 is unnecessary.

**What is NOT measured:** whether 4, 5 or 6 is better. *"The old reason for 3 is void"* is not
evidence for a new number, and this is the platform's fan-out for every user rather than a dial on
one service. **D-7 — measure it, do not raise it blind.**

## §5 — WIDTH: **VERTICAL ONLY, AND IT COST NOTHING**

⚠ **The audit's §1.1 finding is what made this cheap: the 4 was a constant copied from the FTS
service, and this service's own evidence (7 Aug) already said 64 concurrent survived here.**

`measure-vector-width.ts` ramps offered load and samples the service's own peak RSS. At width 4 the
cap binds hard — offering 8 bought only 12% over offering 4, because the extra four merely queued:

| offered | width 4 | width 16 |
|---|---|---|
| 1 | 0.531/s | — |
| 2 | 1.220/s | — |
| 4 | **2.201/s** | 2.130/s |
| 8 | 2.475/s | 3.674/s |
| 16 | — | **4.433/s** |
| 24 | — | 4.508/s |

▶ **Width 16 roughly doubles throughput (2.20 → 4.43 req/s) and the queue stops being the
binding constraint.** At offered 4 the two widths agree (2.20 vs 2.13), which is the control: below
the cap, the cap does not matter.

**Memory is not the constraint, and this is the part that had never been checked.** Peak RSS across
the whole ramp levelled off — 842 → 933 → 957 → 977 → 999 → 1,029 → 1,040 → 1,052 → 1,059 MB, the
deltas shrinking to +7 — which is an index-page cache converging, not concurrency-driven growth. At
width 16 under an eight-user load the peak was **1,253 MB, 16.4% of the 7,629 MB cap.**

⚠⚠ **And the memory question resolved the other way round from what anyone expected.** Before the
index rebuild the service reached **5,586 MB — 73.2% of the cap** — under the 18-request shed test,
because each request was pulling ~2.2 GB of chunk bodies through a brute-force scan. **The index
rebuild cut peak memory by roughly 4.4 GB as well as cutting latency.** `fts-query-service.ts`'s
open question — *"this semaphore may be guarding the wrong variable… the binding constraint is
memory"* — was right that memory was the real variable, and the answer is that the memory was being
spent on a stale index rather than on concurrency.

▶ **Cost of the change: £0.00.** It is one environment variable on the existing single replica.
No replicas were added, memory did not rise, and CPU is nowhere near a limit (`cpu_over_wall` 4–5
— see §1.3 for the corrected CPU figure). **Horizontal width was not needed and is not
recommended** — and §1.5's warning stands if it is ever revisited: each replica opens its own
handles and re-reads R2 independently, so replicas multiply the dominant I/O rather than dividing
it.

⚠ **Width 32 was tried and is NOT recommended. The measurement alone was weak; H2 supplies the
mechanism that makes it convincing.**

Within one run, width 32 showed a throughput *decline* from offered 16 to offered 24
(2.82 → 2.71/s) and a p50 of 8.6–9.1 s where width 16 gave 3.9 s. But the absolute levels between
the two runs are confounded: at offered 4, where the cap binds in neither, width 16 measured 2.13/s
and width 32 measured 1.54/s — a difference the semaphore cannot explain, and which the service's
known minute-to-minute drift (§1.2: the same request varied 3.4–13 s) can. **Two widths cannot be
alternated inside one process, so that comparison cannot be made clean.**

▶ **What settles it is §1.3: the container has 8 vCPU, and at width 16 the process already burns
4.11–4.56 of them — 51–57% of the quota.** Doubling the width would take the service past its CPU
allowance and into throttling, which is exactly the shape the width-32 run showed. **16 is close to
the right number for a mechanical reason, not by luck**, and the honest ceiling estimate is
"somewhere under 32", not "as high as you like".

⚠ **The earlier draft of this report said CPU was "nowhere near a limit… against a host reporting
48 cores". That was wrong** — `os.cpus()` reports the Railway HOST, not the container's cgroup
quota, and reading it as our capacity was an inference in the grammar of a measurement
(`CLAUDE.md` §19). Corrected in §1.3, and it is the single most consequential correction in this
report because it is the number any future width decision rests on.

`vector-serve-run.ts width <n>` sets the variable, restarts, and **reads the concurrency back off
the running process**, refusing to report success if the two disagree — the brief's requirement,
and the guard fired for real on its first use before being made robust to the 502s a container swap
produces.

### 5.1 ⚠ H4's ACTUAL FIX — CO-LOCATION — COSTED, AND DELIBERATELY NOT DONE

The brief says *"co-location first if H4"*, and *"if any hypothesis has a fix that is free or under
about $50 a month, apply it in this sprint"*. H4 is true, so this has to be costed rather than
waved at.

**What co-location means here:** put the Lance datasets on a Railway volume attached to the service
instead of reading them from R2 per query, so `lance.ts` opens a local path.

| | |
|---|---|
| `corpus_vec.lance` | 147.58 GB |
| `corpus_chunks.lance` | 45.69 GB |
| **total to co-locate** | **193.27 GB** |
| Railway volume rate (read from `railway.com/pricing`, 27 Aug) | $0.00000006 / GB / second ≈ **$0.16 / GB / month** |
| **monthly cost** | **≈ $31** |

**So it is inside the brief's threshold.** It is still **not done this sprint**, and the reasons are
specific rather than cautious:

1. ⚠ **The decisive measurement for H4 — bytes per query — is the one I could not get** (§1.5). Four
   converging indirect lines make H4 the best-supported hypothesis; they do not make it measured.
   Migrating 193 GB of storage on indirect evidence is the shape of mistake this brief opens by
   criticising.
2. **The service already meets every acceptance criterion in §6 without it** — eight concurrent
   users, 0 rejections, 0 timeouts. Co-location is an optimisation now, not a fix.
3. **It changes where the corpus lives for more than this service.** `fts-serve`, every heavy job
   and every ingest script open the same datasets through the same `lance.ts`. That is a
   cross-workstream change and §8 forbids editing what ingest owns without reporting first.
4. ⚠ **The 13.39 GB of stale `_versions` manifests (§1.4) would be migrated too** unless the dataset
   is compacted first — paying to co-locate 29% of `corpus_chunks` that serves no query.

▶ **Recommended as D-8**, with the byte measurement as its precondition.

⚠ **And a cheaper diagnostic exists that was built but not run**: `vector-serve-run.ts tune
<nprobes|refine|overscan> <n>` sets a retrieval dial and reads it back off `/stats`. Both dials
change ONLY how many bytes a query pulls from R2 — `nprobes` how many IVF partitions are read,
`refineFactor` how many original f32 vectors are fetched from the 130 GB `data` directory for exact
re-ranking. **If latency moves sharply with them while CPU does not, H4 is measured rather than
inferred.** It is not run here because both dials also trade **recall**, and turning them without
re-scoring the gold set would buy latency with answers — so the A/B belongs with D-3's retrieval
sprint, where the gold set is being run anyway.

## §6 — RESTORE, THEN MEASURE

### 6.1 Two users, four dense streams — **passes, with room**

`measure-vector-load.ts`. One user's search is four simultaneous stream-scoped requests, exactly as
`fusedStream` issues them. Per stream, because an aggregate would hide the S14 signature:

**Two users (8 simultaneous requests), 5 rounds, 40 legs:**

| stream | ok | shed | timeout | p50 | p95 |
|---|---|---|---|---|---|
| legislation | 10/10 | 0 | 0 | 3,364 | 8,991 |
| caselaw | 10/10 | 0 | 0 | 3,537 | 9,216 |
| guidance | 10/10 | 0 | 0 | 3,276 | 9,626 |
| committees | 10/10 | 0 | 0 | 3,728 | 8,278 |

**Four users (16 simultaneous), 64 legs: 64 ok, 0 shed, 0 timed out**, per-stream p50 3,169–3,646,
p95 3,937–4,741. `queueHighWaterMark` **0**.

**Eight users (32 simultaneous), 96 legs: 96 ok, 0 shed, 0 timed out**, per-stream p50 4,307–5,881,
p95 7,260–7,398. `queueHighWaterMark` **16 of 32**. Peak RSS 1,253 MB.

⚠⚠ **Compare with S14, where ONE user saturated the service:** all four dense-enabled streams
returned at the 25 s client ceiling within 36 ms of each other, and `warm_p95` reached 706,954 ms
and was still climbing forty minutes after every client had been killed. **The service now carries
eight concurrent users with nothing shed and nothing timed out.**

### 6.2 ⚠ WHAT THIS SUPERSEDES — AND THE HARNESS THAT NO LONGER NEEDS ITS THROTTLE

⚠⚠ **The clearest single proof that the capacity work landed is that the gold harness can now run
at production settings.** `s14-run.sh` had to set `LEX_STREAM_CONCURRENCY=1` and
`VECTOR_TIMEOUT_MS=90000`, and its own comment says why in terms:

> *"IT IS NOT A CONVENIENCE — IT IS WHAT MAKES THE MEASUREMENT POSSIBLE AT ALL. `vector-serve` runs
> 4 requests wide behind a 64-deep queue, and a client abort does not cancel work already queued…
> the default configuration FEEDS the queue faster than the service drains it."*

So **every S14 figure was taken through a client deliberately crippled to protect the service.**
`s15-run.sh` uses the platform's real defaults — `LEX_STREAM_CONCURRENCY=3`,
`VECTOR_TIMEOUT_MS=25000` — and the 64-question sweep completed with **0 rejections and 0 timeouts**.
The throttle is no longer needed, and that is a measurement rather than an opinion.

**Superseded, and void for latency purposes:**

| figure | where | why void |
|---|---|---|
| `warm_p50` 4,998 ms · `warm_p95` 7,698 ms (quiet) | S14 §0 | taken against a **stale chunks index**; the snippet stage has since fallen 63% |
| `warm_p95` 205,754 / 351,301 / **706,954** ms | S14 §0 | taken with **no cancellation and a 64-deep queue**; both are gone |
| `inFlight 4 · queued 64/64 · rejections 101` | S14 §0 | the service is 16 wide with a 32-deep queue |
| service concurrency **4** | S14 §0, `VECTOR_DEPLOY_READINESS` B1, `stream-scopes.ts` §V2 note | now **16**, read off `/stats` |
| snippets = **76%** of query latency | `build-chunks-scalar-index.ts` header (7 Aug) | **36%** at rest, ~10% under load, after the index refresh |
| `corpus_vec` / `corpus_chunks` = 21,846,364 rows | several docs | **22,670,808** |

### 6.3 ⚠⚠ THE BASELINE, RETAKEN — AND IT IS THE FIRST NON-DEGRADED FOUR-STREAM MEASUREMENT THIS PROJECT HAS EVER HAD

`bash scripts/s15-run.sh measure --json ../docs/census/s15-arms.json`, 2026-08-27 10:40 UTC, n = 64.

⚠ **The run's own preflight is the thing to read first**, because the previous two baselines failed
exactly here:

```
[config] fts=fts-serve-production-4cea vector=vector-serve-production
         streams=legislation,caselaw,guidance,committees router=ON fully-configured
degraded: []          ← S14's artefact says: ["LEX_VECTOR_STREAMS empty — dense retrieval is OFF
                        on every stream, silently"]
service engagement: fts+313  vector+209      ← the dense legs ARRIVED, counted on the service
index stamps match either side of the run — the corpus did not move
```

**S14's surviving arms artefact is literally named `s14-arms-bm25.json`** and records
`streams=NONE router=ON DEGRADED(1)`. Its published recall figures describe a **keyword-only**
system. That is not a criticism of S14 — its §0 says so — but it means every "four-stream" number
in circulation until today was nothing of the kind.

#### The three baselines, and what happens to each

| | **S13** | **S14** | **S15 (this run)** |
|---|---|---|---|
| dense configuration | `legislation` only | **OFF on every stream** | **all four, arriving** |
| **in-stream@20** — what retrieval finds | 27/64 (42%) | 19/64 (30%) | **32/64 (50%)** |
| **merged@20, round-robin** — production today | 15/64 (23%) | 14/64 (22%) | **19/64 (30%)** |
| **merged@20, judged + reranker (flash)** | — | 19/64 (30%) | **30/64 (47%)** |
| **@5, round-robin** | — | 6/64 (9%) | **8/64 (13%)** |
| **@5, judged + reranker (flash)** | — | 15/64 (23%) | **26/64 (41%)** |

▶ **S13 and S14 are both VOID as statements about production retrieval**, for opposite reasons:
S13 measured one dense stream where production reads four; S14 measured none at all. **The S15
column supersedes both.** *(S13's published figures are over n = 65; Q15 is removed here so the
denominators match — the same adjustment S14 made.)*

#### Predictions, scored

Logged in `CHANGE_LOG.md` at 10:47 UTC with the run already in flight and its output unread:

| predicted | actual | |
|---|---|---|
| in-stream@20 between **24 and 32** | **32** | ✅ at the top of the band |
| merged@20 arm A between **18 and 24** | **19** | ✅ |
| dense legs observed to arrive, not assumed | `degraded: []`, `vector+209` | ✅ |
| rejection rate **0** | **0 new rejections** across all 64 questions | ✅ |

⚠ **And S14's own prediction is scored too: it sized dense retrieval at "roughly twelve points" of
in-stream recall. Measured: 19 → 32 of 64, THIRTEEN points.** Against S13's single dense stream
(27/64), the three additional streams are worth a further **five**.

#### Per collection, because the total hides where the platform actually stands

| collection | n | in-stream@20 | round-robin (today) | judged + reranker |
|---|---|---|---|---|
| consultations | 9 | **9 (100%)** | 7 (78%) | **9 (100%)** |
| caselaw | 6 | 5 (83%) | 5 (83%) | 5 (83%) |
| legislation | 9 | 7 (78%) | 3 (33%) | 6 (67%) |
| guidance | 10 | 5 (50%) | 2 (20%) | 5 (50%) |
| impact-assessments | 9 | 4 (44%) | **0 (0%)** | 3 (33%) |
| committees | 10 | 2 (20%) | 2 (20%) | 2 (20%) |
| **debates** | 11 | **0 (0%)** | **0 (0%)** | **0 (0%)** |
| **ALL** | **64** | **32 (50%)** | **19 (30%)** | **30 (47%)** |

⚠ **`debates` is 0 of 11 on every arm — retrieval finds nothing at all**, so no merge, reranker or
capacity change can reach it. The re-key (`GOLD_V2_DEBATES_REKEY.md`) is with Charlie and nine of
the eleven were already NOT-RETRIEVED in S13. **`impact-assessments` is the opposite shape**:
retrieval finds 4 of 9 and the round-robin displays **none** of them — a pure merge failure, and the
reranker recovers 3.

### 6.4 ⚠⚠ THE SENTENCE THE BRIEF ASKS FOR, AND IT IS THE ONE THAT MATTERS

**With today's production configuration — round-robin merge, reranker off — 45 of 64 questions
return nothing correct in the top 20.**

Switching on the judged merge and the reranker takes that to **34 of 64 returning nothing correct**.
And even a *perfect* merge could only reach **32 of 64**, because that is all retrieval finds:
**for 32 of the 64 questions the answer is not in any stream's list at all.**

▶ **The merge is no longer the constraint. Retrieval is.** This report should not be read as the
platform being fixed. It is a report about a service that can now do its job at all — and about a
corpus and a retriever that, on this evidence, answer half the questions put to them.

### 6.5 The judged merge and reranker (S14 D-2/D-4) — **recommended ON, now with its own evidence**

The brief's order was capacity, then measure, then switch on. **All three are now done in that
order**, and the retake measured the merge under real dense retrieval for the first time:

| | round-robin | judged + reranker | change |
|---|---|---|---|
| @20 | 19/64 | **30/64** | **+11 questions, and ZERO lost** |
| @5 | 8/64 | **26/64** | **3.25×** |

⚠ **Both reranker arms gained 11 and lost 0.** S14's flash arm lost one question; under real dense
retrieval neither model loses any. `gemini-2.5-flash` matches `gemini-2.5-pro` exactly on both
figures at **0.214p per query and 1.5 s mean latency**, total **13.68p for all 64** — which
re-confirms S14's model reversal rather than resting on it.

⚠ **The cost to the service is now affordable *because* of §1–§5.** The reranker adds a model call
per query, not retrieval load, and the service carried the whole 64-question sweep at production
stream-concurrency with **0 rejections**. **D-5.**

## §7 — THE DEPLOY TRAP

⚠ **The trap is real and was hit twice during this sprint, and the marker is what caught it.**

`vector-serve` has **no repo trigger** — the project token cannot create one — so it does **not**
auto-deploy on a push to Main, and `restart` re-runs the *same artefact*. Found at the start of this
sprint: the running service was pinned to commit `777599a6` (**24 August**) while its metadata said
`branch: Main`, and 84 commits had landed since. *(Benign in this instance — none of the 84 touched
`scripts/ingest/search/` — but that was luck, not a property.)*

**`BUILD = 'S15-cancel-bounded-batch'` is on `/health` and `/stats`.** It is false on every earlier
build and true on this one, readable in one request:

```
$ curl https://vector-serve-production.up.railway.app/health
{"ok":true,"vec":"corpus_vec","build":"S15-cancel-bounded-batch"}
```

`measure-vector-batch.ts` refuses to run at all if the marker is absent, because nothing it measured
would mean anything.

▶ **No Charlie action is needed on the source ref.** `serviceInstanceDeploy(latestCommit: true)`
does build from the branch head and did so at 03:42 UTC. What is missing is only *automatic* deploy
on push. **Recommendation D-4.**

## §8 — WHAT IS NOT DONE, NAMED

1. ⚠⚠ **BYTES PER QUERY WAS NOT MEASURED — the one number H4's test asked for.** Railway's
   `NETWORK_RX_GB` did not move across a controlled 20-query window (§1.5). H4's verdict rests on
   four converging indirect lines instead, and is stated as such. **The clean way to get it is a
   local SigV4-capable counting proxy, which is a half-day of work, not an afternoon's.**
2. **`fts-serve` is untouched, and it is the other half of every search.** Its queue is still
   **unbounded** (`maxQueue: null`, `rejections: null` on its own `/stats`), it has the same
   client-abandonment behaviour this sprint removed from `vector-serve`, and the same copied
   constant width of 4. It runs on **every** query, not four streams. **D-6.**
3. **The batch endpoint is not wired into the router.** Built, live, measured, and refuted (§4).
   Wiring it would need a request-scoped seam through `StreamConfig.search(query, limit)`, which is
   a two-argument signature shared by every stream.
4. **The batch path has no result cache.** `QueryCache` sits on the solo path only. Irrelevant while
   the endpoint is unwired; a prerequisite if it ever is.
5. **`LEX_STREAM_CONCURRENCY` is unchanged at 3.** Its justification is now void — the comment says
   *"under the service's 4"* and the service is 16 — and `s15-run.sh` demonstrated 3 works without a
   single rejection. **Raising it further is untested and is a change to the platform's fan-out
   under load, not to this service. D-7.**
6. **Co-location of the index (H4's actual fix) is costed but NOT done** — §5.1. Doing a 193 GB
   storage migration in the last hour of a sprint, on a hypothesis whose decisive byte measurement I
   do not have, is the mistake this brief opens by criticising.
7. **Width 32 vs 16 could not be measured cleanly** (§5) — though §1.3's 8-vCPU quota now supplies
   the mechanism the measurement lacked.
8. **The Railway usage UNITS are inferred, not documented** (§1.7), and labelled as such.
9. **`corpus_chunks/_versions` is 13.39 GB of accumulated manifests** across 18,448 objects — 29% of
   that dataset — serving no query. Named for an ingest ticket, not touched.
10. **The `debates` re-key is not resolved** and `debates` is 0/11 on every arm (§6.3). It is with
    Charlie and predates this sprint.

---

## DECISIONS FOR CHARLIE

**D-1 — Keep the width at 16?** *(Recommended: yes.)*
It doubles throughput (2.20 → 4.43 req/s), carries eight concurrent users with nothing shed, costs
**nothing** (one environment variable on the existing replica; peak memory 16.4% of cap), and
horizontal replicas are not needed. *Consequence of no:* back to 4, where one user's four-stream
search occupies the entire service and the S14 failure returns the moment two people search at once.

**D-2 — Should a shed dense leg set `GatewayResult.failed` even when BM25 returned results?**
*(Recommended: no — the current behaviour.)*
Today `failed` is set only when the search returned **nothing** while a leg was refused; a partial
gap is recorded in `meta.denseDegraded` instead. *Consequence of yes:* strictly closer to the
brief's wording, but Lex would say *"I could not search the corpus for this"* while displaying
twenty real documents it did find — a false negative about its own evidence. *Consequence of no
(what I have built):* the never-claim rule is honoured where it matters — we never say "I found
nothing" about a search that did not run — and a caller that wants to mention the partial gap has
the data to. **This is the one place I have read the brief against its literal wording, and this is
me saying so.**

**D-3 — Given the retake, is the next sprint about RETRIEVAL rather than ranking?**
*(Recommended: yes, and it is the most important decision here.)*
The baseline is retaken (§6.3) and it says retrieval finds nothing for **32 of 64** questions, so
**even a perfect merge leaves half the set unanswered**. Every remaining lever on the ranking side
is bounded by that number. The three concrete targets the data names: `debates` **0/11** (retrieval,
not merge — the re-key is with you), `committees` **2/10**, and `impact-assessments` finding 4/9 but
displaying 0/9. *Consequence of no:* further merge work competes for the 32 questions already
findable and cannot touch the other 32.

**D-4 — Connect the GitHub repo trigger for `vector-serve` in the Railway UI?** *(Recommended: yes.)*
One action, once, in the dashboard — the project token cannot do it. *Consequence of no:* the
service keeps deploying only when someone runs the script, which is how it sat on 12 August code for
two weeks. **The one-request signal that confirms it worked:** push any change to
`scripts/ingest/search/`, wait, then `curl .../health` and see the `build` string change without
anyone having run `redeploy`.

**D-5 — Turn `LEX_SEARCH_JUDGED_MERGE` and the reranker ON now?** *(Recommended: yes.)*
Measured this sprint under real dense retrieval, not inherited from S14: **@20 19/64 → 30/64, +11
questions with ZERO lost; @5 8/64 → 26/64, three and a quarter times.** `gemini-2.5-flash` matches
`gemini-2.5-pro` exactly at **0.214p per query, 1.5 s**, and the service carried the whole sweep at
production settings with 0 rejections. The capacity precondition the brief set is met.
*Consequence of no:* the platform keeps displaying 19 of the 32 answers it finds, and the 11
questions the reranker recovers stay invisible to users while sitting in the retrieved set.

**D-6 — Do the same three fixes to `fts-serve` next?** *(Recommended: yes.)*
It has an unbounded queue, no cancellation, and the same copied width of 4. It is the other half of
every search and runs on **every** query rather than on four streams. *Consequence of no:* the
sparse half keeps the exact failure mode the dense half just had removed.

**D-7 — Raise `LEX_STREAM_CONCURRENCY` above 3?** *(Recommended: not yet — measure it first.)*
Its justification is void (the comment says "under the service's 4"; the service is 16), and S8's
finding that raising it made things worse was explicitly *because* 4 was the service's width. So the
reason to keep it at 3 has gone — but "the old reason is void" is not evidence for a new value.
*Consequence of raising it blind:* a change to every user's fan-out under load, justified by an
argument rather than a number. **The measurement is cheap and belongs with D-3.**

**D-8 — Co-locate the index onto a Railway volume (H4's actual fix)?** *(Recommended: not this
sprint — decide it with the byte measurement in hand.)*
§5.1 costs it at roughly **$31/month** for 193 GB, inside the brief's $50 threshold. But H4's
decisive byte-per-query measurement is the one I could not get (§8.1), the service already meets
every acceptance criterion in §6 without it, and a 193 GB storage migration changes where the
corpus lives for both serve services and every heavy job. *Consequence of yes now:* a large
irreversible-feeling change on four converging indirect measurements. *Consequence of no:* latency
stays at ~3.4 s per dense leg when co-location might make it a fraction of that — a real
opportunity, deferred deliberately rather than missed.

---

## STANDING-RULE NOTES

- **Every check was watched failing first.** `check-vector-cancel` passed `--expect=executes-abandoned`
  against the real broken build before it passed `--expect=cancels-abandoned`. `check-vector-shed`
  carries a negative control that fires at exactly-capacity. `build-chunks-scalar-index --verify-only`
  was watched exiting 4 against the real stale index. `check:dense-degraded` pairs every positive
  with the arrangement that must not trigger it.
- **A guard of mine failed its own first use and was fixed, not weakened.** `vector-serve-run.ts
  width` reported ⛔ against a service that had in fact restarted and was already reporting the new
  value — it had been 502ing through the poll window. A guard that cries wolf gets ignored, which is
  the same end state as no guard.
- **`readStats()` was rewritten not to call `ensureDomain`.** That helper's existence-query is
  wrapped in `.catch(() => null)` and falls through to *creating* a domain, so a transient GraphQL
  blip turned a read of `/stats` into *"You have reached the limit for service domains per service on
  your plan"*. A function whose job is to observe must not be able to mutate.
- **Git:** three code commits mid-sprint, deliberately and against §12's usual rule, because §7 makes
  a push the only way to get code onto the service and nothing in this sprint could be verified
  without it. Scoped by explicit path. `commit-search-s15.sh` carries them.
- **Cost of the sprint: €0.008** (one cpx62 for 1.7 minutes, destroyed in a `finally`). No Railway
  capacity was purchased.

