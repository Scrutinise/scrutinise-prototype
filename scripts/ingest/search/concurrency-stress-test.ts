/**
 * concurrency-stress-test.ts — regression check for the fts-query-service.ts
 * concurrency guard (added investigating the query-router flip, CC brief "add
 * guidance stream, then re-measure" step 3).
 *
 * fts-query-service.ts opens ONE Lance table handle at boot and reuses it for
 * every request. Direct load-testing found concurrent native queries against
 * that shared handle are unsafe: 10 concurrent requests survived but took 226s
 * (severe contention), 15 concurrent crashed the process outright (no
 * JS-catchable error — the process just died). This was NOT an in-process-only
 * risk: independent concurrent HTTP requests hit the exact same failure, because
 * the danger is concurrent native calls against one handle, not how they're
 * triggered. query-router.ts fans one user's search out to up to 5 concurrent
 * stream calls (one per routed stream), so LEX_QUERY_ROUTER directly multiplies
 * real-world concurrent load against this path.
 *
 * Fix: fts-query-service.ts now gates every /fts-search call through a global
 * in-process semaphore (FTS_MAX_CONCURRENT, default 4) — excess requests queue
 * FIFO instead of running concurrently. Re-run this script after ANY change to
 * fts-query-service.ts's concurrency handling (or before raising
 * FTS_MAX_CONCURRENT) to confirm the exact load that used to crash it (round 2,
 * 15 concurrent) still survives.
 *
 * Usage: start fts-query-service.ts locally first, then:
 *   tsx search/concurrency-stress-test.ts
 * Or against a deployed instance: FTS_TEST_URL=https://... tsx search/concurrency-stress-test.ts
 *
 * VECTOR TARGET (added with the B1 guard, docs/VECTOR_DEPLOY_READINESS.md).
 * vector-query-service.ts has the identical one-handle-per-table exposure, so it needs
 * the identical regression check rather than a second, subtly different script — a
 * separate copy would drift and the two results would stop being comparable. Run it
 * against the vector service with:
 *   SEARCH_TEST_TARGET=vector tsx search/concurrency-stress-test.ts
 *   SEARCH_TEST_TARGET=vector VECTOR_TEST_URL=https://… tsx search/concurrency-stress-test.ts
 * Defaults are unchanged: with SEARCH_TEST_TARGET unset this is byte-for-byte the same
 * test against the same FTS endpoint as before.
 *
 * NOTE for the vector target: every call costs one live Gemini embed (vector-core.ts
 * embedQuery). 70 calls across the four rounds, so the spend is negligible — but it is
 * not zero, and a rate-limit error would show up here as a 500, not as a crash.
 *
 * Known residual finding (not re-tested every run, noted for awareness): at
 * synthetic loads well beyond production's expected traffic (20-25 concurrent
 * calls from a SINGLE test-client process), some individual requests failed
 * client-side ("fetch failed" — a connection-level failure, not an HTTP error
 * response; the server logged nothing and stayed alive). This may be an
 * artefact of one Node process's own connection pool rather than a genuine
 * server-side limit — unconfirmed either way, flagged for anyone raising
 * FTS_MAX_CONCURRENT or seeing unexplained client errors under real load. The
 * important, CONFIRMED result is that the full-process crash is gone.
 */
// Module scope, not global. Without this the file has no import/export and TypeScript
// puts main()/pct() in the global namespace, where they collide with every other
// import-free script in scripts/ingest (`error TS2393: Duplicate function
// implementation`). Nothing is exported — the marker is the point.
export {}

const TARGET = (process.env.SEARCH_TEST_TARGET ?? 'fts').toLowerCase()
if (TARGET !== 'fts' && TARGET !== 'vector') {
  console.error(`[stress] SEARCH_TEST_TARGET must be "fts" or "vector" (got "${TARGET}")`)
  process.exit(1)
}
const BASE = TARGET === 'vector'
  ? (process.env.VECTOR_TEST_URL ?? 'http://localhost:8081')
  : (process.env.FTS_TEST_URL ?? 'http://localhost:8080')
const SEARCH_PATH = TARGET === 'vector' ? '/vector-search' : '/fts-search'

const ROUTER_QUERIES = [
  { query: 'landlord eviction no fault', tier: 'legislation' },
  { query: 'landlord eviction debate', tier: 'parliamentary' },
  { query: 'landlord eviction committee report', tier: 'parliamentary' },
  { query: 'landlord eviction judgment', tier: 'caselaw' },
  { query: 'landlord eviction FCA ICO guidance', tier: 'guidance' },
]

const USER_QUERIES = [
  'photographing people in public',
  'Airbnb whole house lets',
  'MiFID II revoke',
  'noise nuisance neighbours',
  'sugar tax soft drinks levy',
  'e-scooter regulation',
]

interface CallResult { ok: boolean; ms: number; count?: number; err?: string; shed?: boolean }

async function callOnce(query: string, tier: string): Promise<CallResult> {
  const t0 = Date.now()
  try {
    const res = await fetch(`${BASE}${SEARCH_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // Bypass the result cache on the vector target. This is a GUARD regression check:
      // the rounds repeat queries, so with the cache live every round after the first
      // would be served from memory and the semaphore would never be exercised — the test
      // would pass while proving nothing. SEARCH_TEST_CACHE=1 re-enables it for the
      // separate question of what the cache does to load (vector-cache-replay.ts).
      body: JSON.stringify({ query, tier, limit: 20, ...(TARGET === 'vector' && process.env.SEARCH_TEST_CACHE !== '1' ? { noCache: true } : {}) }),
    })
    const ms = Date.now() - t0
    // 503 is the vector guard's BOUNDED-QUEUE shed, not a failure: the service is alive
    // and deliberately refusing rather than admitting a request whose wait would outlive
    // the caller. Counted apart from errors so a shed never reads as a crash.
    if (res.status === 503) return { ok: false, shed: true, ms, err: `HTTP 503 (load shed): ${await res.text()}` }
    if (!res.ok) return { ok: false, ms, err: `HTTP ${res.status}: ${await res.text()}` }
    const json = await res.json() as { results?: unknown[] }
    return { ok: true, ms, count: json.results?.length ?? 0 }
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, err: e instanceof Error ? e.message : String(e) }
  }
}

function pct(arr: number[], p: number): number | null {
  if (!arr.length) return null
  const s = [...arr].sort((a, b) => a - b)
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))])
}

/** One simulated user's background search trigger: N concurrent stream calls, exactly
 *  query-router.ts's runRoutedSearch() shape (Promise.all across all routed streams). */
async function simulateOneRoutedRequest(userQuery: string) {
  const calls = ROUTER_QUERIES.map((s) => callOnce(`${userQuery} ${s.query}`, s.tier))
  return Promise.all(calls)
}

async function health(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/health`)
    return res.ok
  } catch {
    return false
  }
}

async function main() {
  console.log(`[stress] target ${TARGET} → ${BASE}${SEARCH_PATH}`)
  console.log(`[stress] pre-flight health check…`)
  if (!(await health())) { console.error('[stress] FATAL — service not reachable before test even started'); process.exit(1) }
  console.log('[stress] healthy. Starting concurrency rounds.')

  const ROUNDS = 4
  let totalCalls = 0
  let totalErrors = 0
  let totalShed = 0
  for (let round = 1; round <= ROUNDS; round++) {
    // Simulate N users' background searches firing at once — each itself fanning out
    // to 5 concurrent stream calls against the SAME table handle. This is the exact
    // concurrency shape production would see if several ideas triggered a search in
    // the same few hundred ms with LEX_QUERY_ROUTER=true.
    const usersThisRound = USER_QUERIES.slice(0, round + 1) // ramp: 2,3,4,5 users
    console.log(`[stress] round ${round}: ${usersThisRound.length} simulated users × 5 streams = ${usersThisRound.length * 5} concurrent calls`)
    const t0 = Date.now()
    const results = await Promise.all(usersThisRound.map((q) => simulateOneRoutedRequest(q)))
    const ms = Date.now() - t0
    const flat = results.flat()
    totalCalls += flat.length
    const shed = flat.filter((r) => r.shed)
    const errors = flat.filter((r) => !r.ok && !r.shed)
    totalErrors += errors.length
    totalShed += shed.length
    const okMs = flat.filter((r) => r.ok).map((r) => r.ms)
    console.log(`[stress] round ${round} done in ${ms}ms — ${flat.length} calls, ${okMs.length} ok, ${errors.length} errors, ${shed.length} shed(503)`)
    console.log(`[stress]   latency of successful calls: p50 ${pct(okMs, 50)}ms  p95 ${pct(okMs, 95)}ms  max ${okMs.length ? Math.max(...okMs) : null}ms`)
    for (const e of errors) console.log(`[stress]   ERROR: ${e.err}`)
    if (shed.length) console.log(`[stress]   ${shed.length} request(s) load-shed with 503 — the bounded queue working as designed, not a failure`)

    // Check the service is STILL alive after each round (a native crash kills the
    // process outright — health() would then fail even though no individual fetch
    // necessarily returned an HTTP error, e.g. connection refused after the round).
    const alive = await health()
    console.log(`[stress] round ${round} post-check: service ${alive ? 'ALIVE' : '*** DEAD — CRASHED ***'}`)
    if (!alive) {
      console.error(`[stress] CONFIRMED: fts-query-service.ts crashed under concurrent load at round ${round} (${usersThisRound.length * 5} concurrent calls).`)
      process.exit(2)
    }
  }

  console.log('')
  console.log(`[stress] ALL ${ROUNDS} ROUNDS COMPLETE. Total calls: ${totalCalls}, errors: ${totalErrors}, load-shed: ${totalShed}. Service still alive.`)
  console.log(totalErrors === 0
    ? '[stress] RESULT: no crash, no errors — concurrent same-handle access appears SAFE at this scale.'
    : '[stress] RESULT: no crash (the confirmed-fixed failure mode) — some individual calls errored under extreme synthetic load, see above and the file header note.')
  // Print the service's own view too — the client cannot see queue depth or the
  // high-water mark, and those are what say whether the guard was actually exercised
  // or the load simply never reached it.
  try {
    const s = await fetch(`${BASE}/stats`)
    if (s.ok) console.log(`[stress] service /stats: ${JSON.stringify(await s.json())}`)
  } catch { /* advisory only */ }
}

main().catch((e) => { console.error('[stress] FATAL', e); process.exit(1) })
