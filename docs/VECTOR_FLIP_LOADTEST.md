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
