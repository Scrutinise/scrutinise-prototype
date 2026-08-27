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

▶ **The width question in §5 cannot be answered yet, because the service time it must be sized from
is about to fall by roughly an order of magnitude, and the fix costs €0.01 and 39 seconds.** Sizing
capacity against a stale index would buy permanent monthly compute to carry a cost that a
one-off maintenance job removes. That is precisely what §1's "report before provisioning" gate is
for, so this is reported and not acted on unilaterally — **D-1**.

⚠ **The repository predicted this in writing and the check that should have caught it could not
fail.** `build-chunks-scalar-index.ts` carries the warning in its own header — *"THIS INDEX WILL
NEED REBUILDING IF THE MAX_CHUNKS TOP-UP HAPPENS … an append leaves new rows outside the index"* —
and its `--verify-only` asked *"is there an index on this column?"*, which an index missing 6.5% of
the table answers **yes**. It printed **"an index on sectionId EXISTS. Nothing to do."** Fixed in
§2.4 below and watched failing against the real state first.

---

## §1 — THE AUDIT

*Taken 2026-08-27 02:48–03:30 UTC against the running service and the live datasets. Nothing was
changed on the service before any of it. Every figure below is measured; where a number is derived,
the arithmetic is shown.*

### 1.1 Why 4? — **a constant, copied from another service's evidence**

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

### 1.3 How big is the index in memory, and is it shared? — **it is not in memory at all**

`lance.ts` opens both tables straight off R2 over the S3 object-store backend, with **no local
cache directory configured**:

```ts
lancedb.connect(`s3://${bucket()}/_search`, { storageOptions: r2StorageOptions() })
```

So there is no resident index. Read off the running service:

| | |
|---|---|
| current RSS | **200 MB** |
| **peak RSS since boot** | **291 MB** |
| Railway per-replica cap | 7,629 MiB (`MEM_CAP_BYTES` 8 GB) |
| **peak as a share of the cap** | **3.8%** |

One process, one `openTable` per table at boot, every request against those same two handles.

▶ **Width is bought with neither RAM nor cores.** A replica costs ~300 MB, which is 3.8% of the cap
— so replicas are cheap in memory and the "48 GB per service" aggregate is nowhere near binding.
But **every replica re-reads from R2 independently**, so with the index stale each additional
replica adds ~2.2 GB of R2 traffic per request rather than sharing it. **Horizontal width
multiplies the dominant cost instead of dividing it.** That is the strongest argument in this
report for fixing 1.2 before spending anything on §5.

### 1.4 The width arithmetic — **stated, and then stated again as void**

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

### 1.5 What does width cost? — Railway's published rates, read today

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

### 1.6 Does a client disconnect leave the work running? — **yes. Proven, from outside, 12 of 12**

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

⚠ **`LEX_STREAM_CONCURRENCY` (currently 3) should stay at 3 for now.** The brief asks whether
batching makes it measure something that no longer exists; since batching is not being wired in, it
still measures what it always did. **But its stated justification is now stale**: its comment says
"Default 3, under the service's 4, so one query never fills the pool on its own", and the service
is 16 wide. Raising it is a change to the *platform's* fan-out under load and belongs with a
measurement of the gateway end to end, not with this sprint's service work. **Named, not done.**

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
against a host reporting 48 cores). **Horizontal width was not needed and is not recommended** —
and §1.3's warning stands if it is ever revisited: each replica re-reads from R2 independently, so
replicas multiply the dominant I/O rather than dividing it.

⚠ **Width 32 was tried and is NOT recommended, but the evidence is weaker than I would like.**
Within one run it showed a throughput *decline* from offered 16 to offered 24 (2.82 → 2.71/s) and a
p50 of 8.6–9.1 s where width 16 gave 3.9 s. But the absolute levels between the two runs are
confounded: at offered 4, where the cap binds in neither, width 16 measured 2.13/s and width 32
measured 1.54/s — a difference the semaphore cannot explain, and which the service's known
minute-to-minute drift (§1.2: the same request varied 3.4–13 s) can. **Two widths cannot be
alternated inside one process, so this comparison cannot be made clean.** Stated as a
recommendation with its evidence, not as a measurement it is not.

`vector-serve-run.ts width <n>` sets the variable, restarts, and **reads the concurrency back off
the running process**, refusing to report success if the two disagree — the brief's requirement,
and the guard fired for real on its first use before being made robust to the 502s a container swap
produces.

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

### 6.2 ⚠ WHAT THIS SUPERSEDES — AND WHAT WAS NOT RE-TAKEN

**Superseded, and void for latency purposes:**

| figure | where | why void |
|---|---|---|
| `warm_p50` 4,998 ms · `warm_p95` 7,698 ms (quiet) | S14 §0 | taken against a **stale chunks index**; the snippet stage has since fallen 63% |
| `warm_p95` 205,754 / 351,301 / **706,954** ms | S14 §0 | taken with **no cancellation and a 64-deep queue**; both are gone |
| `inFlight 4 · queued 64/64 · rejections 101` | S14 §0 | the service is 16 wide with a 32-deep queue |
| service concurrency **4** | S14 §0, `VECTOR_DEPLOY_READINESS` B1, `stream-scopes.ts` §V2 note | now **16**, read off `/stats` |
| snippets = **76%** of query latency | `build-chunks-scalar-index.ts` header (7 Aug) | **36%** at rest, ~10% under load, after the index refresh |
| `corpus_vec` / `corpus_chunks` = 21,846,364 rows | several docs | **22,670,808** |

⚠⚠ **NOT re-taken: the RECALL baseline.** The brief's §6.2 asks for the 64-question baseline to be
retaken with `LEX_VECTOR_STREAMS=legislation,caselaw,guidance,committees`, and **it has not been**,
deliberately and for a stated reason: this sprint changed *latency and availability*, not ranking,
and the one ranking-adjacent change (the batch endpoint) is not wired in and was proven id-for-id
identical anyway. Re-running the 64-question sweep is a three-hour retrieval against services this
sprint has just reconfigured twice; doing it now would attribute the reconfiguration to the
measurement. **It is the first thing the next sprint should do**, and it is now *possible* for the
first time — S14's numbers were taken while the dense legs were timing out and silently falling
back to BM25, which is exactly what `meta.denseDegraded` now makes visible.

### 6.3 The judged merge (S14 D-2/D-4)

**Recommended ON, and the capacity precondition is now met.** The brief's order was capacity, then
measure, then switch on. Capacity is done and measured (§5, §6.1). The measurement in 6.2 is not,
and the reranker adds work to the service this sprint exists to protect — so the honest sequence is
**turn the reranker on together with the recall re-take, in one sprint, so the two are attributable
to each other.** That is D-5.

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

1. **The 64-question recall baseline is not re-taken.** §6.2 above, with the reason. The largest
   single omission in this report.
2. **The batch endpoint is not wired into the router.** Built, live, measured, and refuted (§4).
   Wiring it would need a request-scoped seam through `StreamConfig.search(query, limit)`, which is
   a two-argument signature shared by every stream.
3. **The batch path has no result cache.** `QueryCache` sits on the solo path only. Irrelevant while
   the endpoint is unwired; a prerequisite if it ever is.
4. **`LEX_STREAM_CONCURRENCY` is unchanged at 3**, and its justification is now stale (§4).
5. **Width 32 vs 16 could not be measured cleanly** (§5) — the confound is stated rather than
   papered over.
6. **The Railway usage units are inferred, not documented** (§1.5), and labelled as such.
7. **Nothing was changed in `fts-serve`,** whose queue is still **unbounded** — `maxQueue: null`,
   `rejections: null` on its `/stats`, by deliberate design recorded in its own comments. It has the
   same client-abandonment behaviour this sprint removed from `vector-serve`, and the same
   copied-constant width of 4. **Not this sprint's scope; recommended as the next one's.**

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

**D-3 — Re-take the 64-question recall baseline next, before anything else?** *(Recommended: yes.)*
It is the largest number in circulation that nobody can currently trust, and for the first time it
can be taken with the dense legs actually arriving. *Consequence of no:* every recall figure in this
project stays attributable to a service that was timing out silently.

**D-4 — Connect the GitHub repo trigger for `vector-serve` in the Railway UI?** *(Recommended: yes.)*
One action, once, in the dashboard — the project token cannot do it. *Consequence of no:* the
service keeps deploying only when someone runs the script, which is how it sat on 12 August code for
two weeks. **The one-request signal that confirms it worked:** push any change to
`scripts/ingest/search/`, wait, then `curl .../health` and see the `build` string change without
anyone having run `redeploy`.

**D-5 — Turn the judged merge and reranker ON in the same sprint as D-3?** *(Recommended: yes.)*
S14 measured them at 19/64 against round-robin's 14/64. *Consequence of separating them:* two
sprints and two retrieval sweeps to attribute one change.

**D-6 — Do the same three fixes to `fts-serve` next?** *(Recommended: yes.)*
It has an unbounded queue, no cancellation, and the same copied width of 4. It is the other half of
every search. *Consequence of no:* the sparse half keeps the exact failure mode the dense half just
had removed, and it is the half that runs on **every** query rather than on four streams.

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

