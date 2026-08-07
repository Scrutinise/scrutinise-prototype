/**
 * vector-cache-replay.ts — measure the result cache's hit rate and what it saves.
 *
 * ⚠ READ THIS BEFORE QUOTING A NUMBER FROM IT. There is no search query log in this
 * project — nothing records what users actually searched for (the stats DB holds public
 * statistics, not telemetry). So a hit rate cannot be MEASURED against real traffic
 * today; it can only be measured against a MODEL of traffic, and the number you get is a
 * property of the model as much as of the cache. This harness therefore does two
 * different things and they should not be confused:
 *
 *   1. It replays several explicitly-stated traffic profiles and reports the hit rate for
 *      each, so the answer is a SENSITIVITY CURVE rather than a single number pretending
 *      to be a measurement.
 *   2. It measures the one thing that is NOT model-dependent: single-flight coalescing
 *      under the router's real concurrent fan-out shape.
 *
 * The real number arrives on its own once the service is deployed — the cache reports
 * `cache` on /stats, and the step-6 digest carries it. That is the number to trust.
 *
 * THE PROFILES, and why each is plausible:
 *   - `unique`     every query distinct. The floor: hit rate ~0. Worth reporting because
 *                  it is what a cache costs when it never helps (memory, and nothing else).
 *   - `refine`     one user iterating on one idea: the same keywords re-searched as the
 *                  briefing is retried/refreshed, with occasional drift. This is the
 *                  pattern the Page-1 briefing and Stage-3 expansion actually produce.
 *   - `zipf`       many users, topic popularity Zipf-distributed — the standard shape for
 *                  real search traffic, where a few topics dominate the tail.
 *   - `router`     the fan-out itself: N users × 5 streams, drawn from a small topic pool.
 *
 * Usage (service must be running):
 *   tsx search/vector-cache-replay.ts
 *   VECTOR_TEST_URL=https://… tsx search/vector-cache-replay.ts
 */
export {}

const BASE = process.env.VECTOR_TEST_URL ?? 'http://localhost:8081'
const LIMIT = 20

const TOPICS = [
  'landlord eviction no fault section 21',
  'short term holiday lets licensing scheme',
  'water company sewage discharge enforcement',
  'e-scooter regulation pavement riding',
  'sugar tax soft drinks industry levy',
  'data protection subject access request',
  'noise nuisance neighbours abatement notice',
  'planning permission permitted development rights',
  'agency worker rights zero hours contracts',
  'leasehold ground rent reform',
]
const STREAMS: Array<{ tier: string; corpora?: string[]; excludeCorpora?: string[] }> = [
  { tier: 'legislation' },
  { tier: 'parliamentary', excludeCorpora: ['committee-reports'] },
  { tier: 'parliamentary', corpora: ['committee-reports'] },
  { tier: 'caselaw' },
  { tier: 'guidance' },
]

interface Req { query: string; tier: string; corpora?: string[]; excludeCorpora?: string[] }

/** Deterministic PRNG so a replay is repeatable and two runs are comparable. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

function buildProfile(name: string, n: number): Req[] {
  const r = rng(42)
  const out: Req[] = []
  if (name === 'unique') {
    for (let i = 0; i < n; i++) out.push({ query: `${TOPICS[i % TOPICS.length]} variant ${i}`, ...STREAMS[i % STREAMS.length] })
  } else if (name === 'refine') {
    // One idea, searched repeatedly across the 5 streams, drifting occasionally.
    let topic = TOPICS[0]
    for (let i = 0; i < n; i++) {
      if (r() < 0.15) topic = `${TOPICS[0]} ${['tenant', 'notice period', 'court', 'reform'][Math.floor(r() * 4)]}`
      out.push({ query: topic, ...STREAMS[i % STREAMS.length] })
    }
  } else if (name === 'zipf') {
    // Topic k chosen with probability ∝ 1/(k+1) — a few topics dominate.
    const weights = TOPICS.map((_, k) => 1 / (k + 1))
    const total = weights.reduce((a, b) => a + b, 0)
    for (let i = 0; i < n; i++) {
      let x = r() * total, k = 0
      while (k < weights.length - 1 && (x -= weights[k]) > 0) k++
      out.push({ query: TOPICS[k], ...STREAMS[Math.floor(r() * STREAMS.length)] })
    }
  } else if (name === 'router') {
    // Whole-fan-out requests: each "user" issues all 5 streams for one topic.
    for (let i = 0; i < Math.ceil(n / 5); i++) {
      const topic = TOPICS[Math.floor(r() * 4)] // small hot pool, as a topical day would look
      for (const s of STREAMS) out.push({ query: topic, ...s })
    }
  }
  return out.slice(0, n)
}

async function call(req: Req): Promise<{ ok: boolean; ms: number; cached?: string }> {
  const t0 = Date.now()
  try {
    const res = await fetch(`${BASE}/vector-search`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...req, limit: LIMIT }),
    })
    if (!res.ok) return { ok: false, ms: Date.now() - t0 }
    const j = await res.json() as { cached?: string }
    return { ok: true, ms: Date.now() - t0, cached: j.cached }
  } catch { return { ok: false, ms: Date.now() - t0 } }
}

async function stats(): Promise<any> {
  try { const r = await fetch(`${BASE}/stats`); return r.ok ? await r.json() : null } catch { return null }
}

function summarise(label: string, results: Array<{ ok: boolean; ms: number; cached?: string }>) {
  const ok = results.filter((r) => r.ok)
  const hit = ok.filter((r) => r.cached === 'hit').length
  const coal = ok.filter((r) => r.cached === 'coalesced').length
  const miss = ok.filter((r) => r.cached === 'miss').length
  const saved = hit + coal
  const rate = ok.length ? Math.round((saved / ok.length) * 1000) / 10 : 0
  const msOf = (pred: (r: { cached?: string }) => boolean) => {
    const xs = ok.filter(pred).map((r) => r.ms).sort((a, b) => a - b)
    return xs.length ? xs[Math.floor(xs.length / 2)] : null
  }
  console.log(
    `${label.padEnd(9)} n=${String(ok.length).padStart(3)}  hit ${String(hit).padStart(3)}  coalesced ${String(coal).padStart(3)}  miss ${String(miss).padStart(3)}  ` +
    `→ HIT RATE ${String(rate).padStart(5)}%   median ms: miss ${msOf((r) => r.cached === 'miss') ?? '-'}  served-from-cache ${msOf((r) => r.cached !== 'miss') ?? '-'}`,
  )
  return { label, n: ok.length, hit, coalesced: coal, miss, hitRatePct: rate }
}

async function main() {
  console.log(`[replay] target ${BASE}`)
  const h = await fetch(`${BASE}/health`).then((r) => r.ok).catch(() => false)
  if (!h) { console.error('[replay] service not reachable'); process.exit(1) }

  const N = parseInt(process.env.REPLAY_N ?? '40', 10)
  console.log(`[replay] ${N} requests per profile. Profiles are MODELS, not logs — see the header.\n`)

  const rows = []
  // Sequential: isolates the TTL cache (no coalescing possible when nothing overlaps).
  console.log('── sequential (TTL cache only, no concurrency) ──')
  for (const p of ['unique', 'refine', 'zipf', 'router']) {
    const reqs = buildProfile(p, N)
    const results = []
    for (const r of reqs) results.push(await call(r))
    rows.push(summarise(p, results))
  }

  // Concurrent: the router's real shape. This is where coalescing shows up, and it is the
  // part of the result that does NOT depend on the traffic model being right.
  console.log('\n── concurrent fan-out (5 users × 5 streams at once, one hot topic) ──')
  const burst: Req[] = []
  for (let u = 0; u < 5; u++) for (const s of STREAMS) burst.push({ query: TOPICS[6], ...s })
  const burstRes = await Promise.all(burst.map((r) => call(r)))
  rows.push(summarise('burst', burstRes))
  console.log('  (5 users searching the SAME topic issue 25 requests but only 5 distinct')
  console.log('   {query,scope} keys — without coalescing that is 25 units of database work.)')

  const s = await stats()
  if (s) console.log(`\n[replay] service cache stats: ${JSON.stringify(s.cache)}`)
  console.log(`[replay] uncached p50 ${s?.warm_p50_ms}ms vs all-requests p50 ${s?.all_p50_ms}ms`)
  console.log(JSON.stringify(rows))
}

main().catch((e) => { console.error('[replay] FATAL', e); process.exit(1) })
