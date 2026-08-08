/**
 * simulate-router-load.ts — load at the ROUTER'S REAL FAN-OUT, against the deployed
 * serve services.
 *
 * query-router.ts turns ONE user search into up to 5 parallel stream calls, and after the
 * vector flip each named stream also issues a parallel dense call. So "10 concurrent users"
 * is not 10 requests — it is 50 simultaneous BM25 calls, plus 10 (legislation-only flip) or
 * 50 (every stream dense) vector calls. This script generates exactly that shape, using the
 * stream scopes copied from query-router.ts::STREAMS so the load is the load the router
 * actually produces, not an approximation of it.
 *
 * MODES
 *   bm25        5 FTS calls per user               — today (no stream named)
 *   legislation 5 FTS + 1 vector per user          — the proposed flip
 *   all         5 FTS + 5 vector per user          — headroom for later streams
 *
 * WHY EVERY QUERY IS DISTINCT. vector-query-service.ts caches results for 300s. Repeating one
 * query across a level would measure the cache, report a flattering p95, and hide the queue
 * behaviour entirely. Each request therefore gets its own query string.
 *
 * COST. Every vector call is one live Gemini embed. `legislation` mode at 3/5/10 users is 18
 * embeds per pass; `all` mode is 90. Small, but not zero.
 *
 * WHAT THIS DOES NOT MEASURE: the Vercel hop. These numbers are client → Railway. See
 * docs/VECTOR_FLIP_LOADTEST.md for why the Vercel-side test could not be run.
 *
 * Usage:
 *   tsx search/simulate-router-load.ts                       # bm25 mode, levels 3,5,10
 *   tsx search/simulate-router-load.ts --mode legislation
 *   tsx search/simulate-router-load.ts --mode all --levels 3,5
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })

export {}

const FTS_URL = (process.env.FTS_TEST_URL ?? 'https://fts-serve-production.up.railway.app').replace(/\/$/, '')
const VEC_URL = (process.env.VECTOR_TEST_URL ?? 'https://vector-serve-production.up.railway.app').replace(/\/$/, '')
const arg = (name: string, dflt: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : dflt }
const MODE = arg('mode', 'bm25') as 'bm25' | 'legislation' | 'all'
const LEVELS = arg('levels', '3,5,10').split(',').map((s) => parseInt(s.trim(), 10))
const TIMEOUT_MS = parseInt(process.env.LOAD_TIMEOUT_MS ?? '120000', 10)

/** Stream scopes copied from query-router.ts::STREAMS — same tiers, same corpus filters. */
const COMMITTEE_CORPORA = ['committees-reports', 'committees-evidence']
const NON_DEBATE_PARLIAMENTARY = [...COMMITTEE_CORPORA, 'bills-api', 'uk-treaties', 'tax-treaties-dta', 'members-interests', 'erskine-may']
const STREAMS = [
  { name: 'legislation', tier: 'legislation' },
  { name: 'debates', tier: 'parliamentary', excludeCorpora: NON_DEBATE_PARLIAMENTARY },
  { name: 'committees', tier: 'parliamentary', corpora: COMMITTEE_CORPORA },
  { name: 'caselaw', tier: 'caselaw' },
  { name: 'guidance', tier: 'guidance' },
] as const

/** Realistic policy-search phrasings; combined with a nonce so nothing is cache-served. */
const STEMS = [
  'enforcement against water companies for sewage discharge',
  'duty to consult before closing a local service',
  'private rented sector possession grounds reform',
  'planning permission for onshore wind development',
  'statutory guidance on children in temporary accommodation',
  'business rates relief for retail premises',
  'data protection impact assessment obligations',
  'procurement thresholds for local authority contracts',
  'flood risk management funding responsibilities',
  'apprenticeship levy employer obligations',
]

interface Call { stream: string; kind: 'fts' | 'vector'; ms: number; ok: boolean; status: number; err?: string; count?: number }

async function post(url: string, body: unknown): Promise<{ ms: number; ok: boolean; status: number; err?: string; count?: number }> {
  const t0 = Date.now()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal })
    const txt = await res.text()
    let count: number | undefined
    try { count = (JSON.parse(txt) as { count?: number; results?: unknown[] }).count ?? (JSON.parse(txt) as { results?: unknown[] }).results?.length } catch { /* non-JSON */ }
    return { ms: Date.now() - t0, ok: res.ok, status: res.status, count, err: res.ok ? undefined : txt.slice(0, 160) }
  } catch (e) {
    return { ms: Date.now() - t0, ok: false, status: 0, err: (e as Error).message }
  } finally { clearTimeout(timer) }
}

/** One user's search = the router's fan-out, all streams in parallel (Promise.all, as runRoutedSearch does). */
async function oneUser(q: string): Promise<{ calls: Call[]; wallMs: number }> {
  const t0 = Date.now()
  const jobs: Array<Promise<Call>> = []
  for (const s of STREAMS) {
    jobs.push(post(`${FTS_URL}/fts-search`, {
      query: q, tier: s.tier, limit: 20,
      ...('corpora' in s && s.corpora ? { corpora: s.corpora } : {}),
      ...('excludeCorpora' in s && s.excludeCorpora ? { excludeCorpora: s.excludeCorpora } : {}),
    }).then((r) => ({ stream: s.name, kind: 'fts' as const, ...r })))
    const dense = MODE === 'all' || (MODE === 'legislation' && s.name === 'legislation')
    if (dense) {
      jobs.push(post(`${VEC_URL}/vector-search`, {
        query: q, limit: 20, tier: s.tier,
        ...('corpora' in s && s.corpora ? { corpora: s.corpora } : {}),
        ...('excludeCorpora' in s && s.excludeCorpora ? { excludeCorpora: s.excludeCorpora } : {}),
      }).then((r) => ({ stream: s.name, kind: 'vector' as const, ...r })))
    }
  }
  const calls = await Promise.all(jobs)
  return { calls, wallMs: Date.now() - t0 }
}

const pct = (a: number[], p: number) => a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((p / 100) * a.length))] : 0
const fmt = (v: number) => `${Math.round(v)}ms`

async function stats(url: string): Promise<any | null> {
  try { const r = await fetch(`${url}/stats`, { signal: AbortSignal.timeout(20000) }); return await r.json() } catch { return null }
}
function statLine(name: string, s: any): string {
  if (!s) return `  ${name}: /stats unreachable`
  const c = s.concurrency ?? {}, m = s.memory ?? {}
  return `  ${name.padEnd(13)} served=${String(s.served).padStart(5)} errors=${s.errors} ` +
    `queueHWM=${c.queueHighWaterMark ?? '?'} rejections=${c.rejections ?? 'n/a (unbounded queue)'} ` +
    `rss=${m.rss_mb}MB peak=${m.peak_rss_mb}MB (${m.peak_pct_of_cap}% of ${m.cap_mb}MB cap)`
}

async function main() {
  console.log(`mode=${MODE}  levels=${LEVELS.join(',')}`)
  console.log(`fts   ${FTS_URL}`)
  console.log(`vector ${VEC_URL}`)
  console.log(`per user: 5 FTS + ${MODE === 'all' ? 5 : MODE === 'legislation' ? 1 : 0} vector call(s)\n`)

  console.log('BEFORE')
  console.log(statLine('fts-serve', await stats(FTS_URL)))
  console.log(statLine('vector-serve', await stats(VEC_URL)))

  let nonce = Date.now() % 100000
  for (const users of LEVELS) {
    console.log(`\n──────── ${users} concurrent users (${users * 5} parallel BM25 calls${MODE !== 'bm25' ? ` + ${users * (MODE === 'all' ? 5 : 1)} dense` : ''}) ────────`)
    const t0 = Date.now()
    const runs = await Promise.all(Array.from({ length: users }, (_, i) =>
      oneUser(`${STEMS[(i + nonce) % STEMS.length]} ${nonce + i}`)))
    nonce += users
    const wall = Date.now() - t0
    const calls = runs.flatMap((r) => r.calls)
    const fts = calls.filter((c) => c.kind === 'fts')
    const vec = calls.filter((c) => c.kind === 'vector')
    const userWall = runs.map((r) => r.wallMs)

    const report = (label: string, set: Call[]) => {
      if (!set.length) return
      const ok = set.filter((c) => c.ok).map((c) => c.ms)
      const bad = set.filter((c) => !c.ok)
      console.log(`  ${label.padEnd(22)} n=${String(set.length).padStart(3)}  p50=${fmt(pct(ok, 50)).padStart(8)}  p95=${fmt(pct(ok, 95)).padStart(8)}  max=${fmt(Math.max(...ok, 0)).padStart(8)}  failed=${bad.length}`)
      for (const b of bad.slice(0, 3)) console.log(`      ↳ ${b.stream}/${b.kind} status=${b.status} ${b.err ?? ''}`)
    }
    report('per BM25 stream call', fts)
    report('per dense call', vec)
    console.log(`  ${'USER-VISIBLE (wall)'.padEnd(22)} n=${String(userWall.length).padStart(3)}  p50=${fmt(pct(userWall, 50)).padStart(8)}  p95=${fmt(pct(userWall, 95)).padStart(8)}  max=${fmt(Math.max(...userWall)).padStart(8)}`)
    console.log(`  level wall-clock ${fmt(wall)}; empty results: ${calls.filter((c) => c.ok && (c.count ?? 0) === 0).length}/${calls.filter((c) => c.ok).length}`)
    console.log(statLine('fts-serve', await stats(FTS_URL)))
    console.log(statLine('vector-serve', await stats(VEC_URL)))
  }

  console.log('\nAFTER')
  console.log(statLine('fts-serve', await stats(FTS_URL)))
  console.log(statLine('vector-serve', await stats(VEC_URL)))
}

main().catch((e) => { console.error(e); process.exit(1) })
