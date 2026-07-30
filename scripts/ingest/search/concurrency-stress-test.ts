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
const BASE = process.env.FTS_TEST_URL ?? 'http://localhost:8080'

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

async function callOnce(query: string, tier: string): Promise<{ ok: boolean; ms: number; count?: number; err?: string }> {
  const t0 = Date.now()
  try {
    const res = await fetch(`${BASE}/fts-search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, tier, limit: 20 }),
    })
    const ms = Date.now() - t0
    if (!res.ok) return { ok: false, ms, err: `HTTP ${res.status}: ${await res.text()}` }
    const json = await res.json() as { results?: unknown[] }
    return { ok: true, ms, count: json.results?.length ?? 0 }
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, err: e instanceof Error ? e.message : String(e) }
  }
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
  console.log(`[stress] target ${BASE}`)
  console.log(`[stress] pre-flight health check…`)
  if (!(await health())) { console.error('[stress] FATAL — service not reachable before test even started'); process.exit(1) }
  console.log('[stress] healthy. Starting concurrency rounds.')

  const ROUNDS = 4
  let totalCalls = 0
  let totalErrors = 0
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
    const errors = flat.filter((r) => !r.ok)
    totalErrors += errors.length
    console.log(`[stress] round ${round} done in ${ms}ms — ${flat.length} calls, ${errors.length} errors`)
    for (const e of errors) console.log(`[stress]   ERROR: ${e.err}`)

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
  console.log(`[stress] ALL ${ROUNDS} ROUNDS COMPLETE. Total calls: ${totalCalls}, total errors: ${totalErrors}. Service still alive.`)
  console.log(totalErrors === 0
    ? '[stress] RESULT: no crash, no errors — concurrent same-handle access appears SAFE at this scale.'
    : '[stress] RESULT: no crash (the confirmed-fixed failure mode) — some individual calls errored under extreme synthetic load, see above and the file header note.')
}

main().catch((e) => { console.error('[stress] FATAL', e); process.exit(1) })
