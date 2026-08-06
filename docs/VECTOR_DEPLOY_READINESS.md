# Deploying `vector-query-service` — what it involves, and what blocks it

*6 Aug 2026. **Report only.** No flag has been flipped, no service created, no env var set.
Every action below is described, not taken.*

## Where things stand

Legislation and debates now have a validated, measured win at the new 0.5 weight
(`GOLD_TEST_08`). All of it was measured **offline, straight against the Lance tables**. The
serving path that would put it in front of a user does not exist yet: `VECTOR_SEARCH_URL` is
unset, and there is no `.vector-serve-service-id` — the service has never been deployed once.

The good news is that the shape of the work is known, because `fts-serve` is the same thing and
is already live. `fts-serve-run.ts` is a working template: create a Railway service from
`Main`/RAILPACK with `rootDirectory=scripts/ingest`, `restartPolicyType=ALWAYS`, a public domain
on the target port, and the credentials injected as service variables.

## What deploying it involves

**1. Write `vector-serve-run.ts`** (~200 lines, a near-copy of `fts-serve-run.ts`). Differences:
- start command `VECTOR_PORT=8081 npx tsx search/vector-query-service.ts`
- **`GEMINI_API_KEY` must be injected**, which `fts-serve` does not need — see blocker B2
- `watchPatterns: ['scripts/ingest/search/**']` as before

**2. Set `VECTOR_SEARCH_URL` in two places** — local `.env` for harness use, and **Vercel** for
the app. Only the Vercel one affects users. (There is precedent for this being the step that
gets missed: `STATS_DATABASE_URL` is still not in Vercel, per the CHANGE_LOG.)

**3. Leave both flags off.** `LEX_SEARCH_VECTOR` and `LEX_VECTOR_STREAMS` stay unset. Deploying
the service changes nothing user-visible on its own — `runVectorSearch` returns `[]` unless
`VECTOR_SEARCH_URL` is set, and `fusedStream` delegates to BM25 unless `LEX_VECTOR_STREAMS`
names the stream. Those are two independent gates and both stay shut.

**4. Verify before anything else changes:** `/health`, `/stats`, and a scoped `/vector-search`
call checking the `tier` echo. `vector-search.ts` fails closed if the echo doesn't match, so a
service too old to honour `tier` returns nothing rather than silently unscoped results.

## Blockers

### B1 — no concurrency guard. *This is the one that would take the service down.*

`fts-query-service.ts` carries a semaphore added after direct load-testing: **10 concurrent
requests survived but took 226s; 15 concurrent killed the process outright, with no JS-catchable
error.** The cause is concurrent native calls against a single Lance table handle — and the
query router fans one user's search out to **up to 5 concurrent stream calls**.

`vector-query-service.ts` has **no such guard** — zero matches for any semaphore. It opens
`corpus_vec` and `corpus_chunks` once at boot and runs every request against those handles, which
is the exact pattern that crashed the FTS service. It would need the same `MAX_CONCURRENT`
treatment before it takes real traffic. This is a known-cause, known-fix item, not a risk.

### B2 — a live Gemini call on every query. New dependency class.

`embedQuery` calls Gemini `embedContent` synchronously per request. BM25 has no external
dependency on the serving path; this adds latency, per-query cost, a rate limit, and an outage
mode. Worth deciding deliberately rather than discovering under load.

### B3 — memory is unmeasured against Railway's 8 GB per-replica cap.

`corpus_vec` is 21,846,364 vectors and `corpus_chunks` the same count with bodies. `fts-serve` is
documented as "well inside the 8GB Hobby cap", but that is the FTS table, not these two.
Per `docs/CLAUDE.md` §17 the cap is real and measured, and a silent SIGKILL is what exceeding it
looks like. **This needs measuring, not estimating** — and §17's rule is that if it doesn't fit,
it goes to the Heavy Job Runner rather than being shrunk to fit or having a limit raised.

### B4 — not a blocker, but decide it explicitly: the index was not rebuilt after the 5 Aug deletion.

`vec-hygiene` removed 6,464 orphan chunks. Its own note is that LanceDB filters deleted rows at
query time, so **results stay correct without a rebuild** — the cost is recall/latency drift, not
wrong answers, and the vector rebuild is the 64 GB-class heavy job, an order of magnitude dearer
than the FTS one. 6,464 of 21.8M is 0.03%, so the honest recommendation is **do not rebuild**;
just don't let it be assumed the index is pristine.

## What I would not do

Flip either flag. That stays yours, unchanged. Worth noting for when you do: `GOLD_TEST_09` found
the **committees** stream's live path post-filters rather than prefilters and can return nothing
at all for a valid query — so if streams are ever enabled one at a time, legislation is the one
with the evidence behind it, and committees is the one that should wait.

## Suggested order

1. Add the concurrency guard to `vector-query-service.ts` (B1) — code only, deployable later.
2. Write `vector-serve-run.ts`.
3. Deploy and **measure memory** (B3) with both flags off and no `VECTOR_SEARCH_URL` anywhere.
4. Only then set `VECTOR_SEARCH_URL`, still with `LEX_VECTOR_STREAMS` unset — the service is
   reachable and warm but nothing routes to it.
5. Load-test at the router's real fan-out before any flag moves.

Steps 1–2 are ordinary build work I can do on your word. Steps 3–5 spend money and touch
production surface, so they are yours to call.
