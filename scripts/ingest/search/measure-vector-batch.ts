/**
 * measure-vector-batch.ts — S15 §4. WHAT DOES ONE REQUEST CARRYING EVERY STREAM ACTUALLY BUY?
 *
 * The brief asks for this to be scoped and costed rather than assumed ("four requests per search
 * is a choice"), and calls it "likely the largest single win". This measures it against the
 * running service instead of arguing about it.
 *
 * TWO ARMS, ALTERNATED, against the same warm service:
 *   A — four separate POST /vector-search, fired concurrently, which is what `fusedStream` does
 *       today: one request per routed stream.
 *   B — one POST /vector-search-batch carrying all four.
 *
 * ⚠⚠ THE EQUIVALENCE CHECK MATTERS MORE THAN THE TIMING. A transport change that also changed
 * the ranking would be a retrieval change wearing a latency change's clothes — the exact shape
 * S14 §1(b) rejected. So every stream's returned ids are compared BETWEEN the arms, in order,
 * and a mismatch is reported as a failure however fast the batch was. A faster wrong answer is
 * not a win.
 *
 * ⚠ ARMS ALTERNATE rather than running as two blocks. The service's latency drifts by a factor
 * of three or more over minutes (S15 §1.2), so two blocks would measure the drift and attribute
 * it to the arm. Alternating puts both arms across the same drift.
 *
 * Usage:
 *   tsx search/measure-vector-batch.ts [--rounds=5] [--limit=60]
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

const BASE = (process.env.VECTOR_SEARCH_URL ?? 'https://vector-serve-production.up.railway.app').replace(/\/$/, '')
const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d
const ROUNDS = parseInt(arg('rounds', '5'), 10)
const LIMIT = parseInt(arg('limit', '60'), 10)

/** The four dense-enabled streams, scoped exactly as `LEX_VECTOR_STREAMS` and stream-scopes.ts
 *  scope them — committees is the parliamentary tier narrowed by corpus, not a tier of its own. */
const STREAMS = [
  { stream: 'legislation', tier: 'legislation' as string | undefined, corpora: undefined as string[] | undefined },
  { stream: 'caselaw', tier: 'caselaw', corpora: undefined },
  { stream: 'guidance', tier: 'guidance', corpora: undefined },
  { stream: 'committees', tier: 'parliamentary', corpora: ['committees-evidence', 'committees-reports'] },
]

// One tailored query per stream, as the router writes them — deliberately DIFFERENT strings,
// because that is what makes the shared-embed shortcut unavailable and the shared SCAN the
// only real saving.
const QUERY_SETS = [
  ['landlord eviction notice grounds possession', 'possession order reasonable grounds tenant', 'guidance for landlords ending a tenancy', 'select committee evidence private rented sector'],
  ['water company sewage discharge permit', 'nuisance liability watercourse pollution', 'environment agency guidance storm overflow', 'committee evidence water industry regulation'],
  ['employer liability employee assault course of employment', 'vicarious liability close connection test', 'guidance employer duty of care staff conduct', 'committee evidence workplace safety enforcement'],
  ['unexplained wealth order high court', 'civil recovery proceeds of crime', 'guidance on suspicious wealth reporting', 'committee evidence economic crime enforcement'],
  ['duty of candour public inquiry witnesses', 'inquiry disclosure obligations state bodies', 'guidance for public authorities inquiries', 'committee evidence inquiry reform'],
]

async function soloArm(queries: string[]): Promise<{ ms: number; perStream: string[][]; errors: string[] }> {
  const t0 = Date.now()
  const errors: string[] = []
  const out = await Promise.all(STREAMS.map(async (s, i) => {
    const res = await fetch(`${BASE}/vector-search`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: queries[i], limit: LIMIT, ...(s.tier ? { tier: s.tier } : {}), ...(s.corpora ? { corpora: s.corpora } : {}), noCache: true }),
    })
    if (!res.ok) { errors.push(`${s.stream}: HTTP ${res.status}`); return [] as string[] }
    const j = await res.json() as any
    return (j.results ?? []).map((r: any) => r.id) as string[]
  }))
  return { ms: Date.now() - t0, perStream: out, errors }
}

async function batchArm(queries: string[]): Promise<{ ms: number; perStream: string[][]; errors: string[]; serverMs?: number; scans?: number; annMs?: number; snippetMs?: number }> {
  const t0 = Date.now()
  const res = await fetch(`${BASE}/vector-search-batch`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      queries: STREAMS.map((s, i) => ({ query: queries[i], limit: LIMIT, ...(s.tier ? { tier: s.tier } : {}), ...(s.corpora ? { corpora: s.corpora } : {}) })),
    }),
  })
  const ms = Date.now() - t0
  if (!res.ok) return { ms, perStream: STREAMS.map(() => []), errors: [`batch HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`] }
  const j = await res.json() as any
  const errors = (j.queries ?? []).flatMap((q: any, i: number) => (q.ok ? [] : [`${STREAMS[i].stream}: ${q.error}`]))
  return {
    ms, errors, serverMs: j.ms, scans: j.chunkScans, annMs: j.annMs, snippetMs: j.snippetMs,
    perStream: (j.queries ?? []).map((q: any) => (q.results ?? []).map((r: any) => r.id)),
  }
}

function p50(a: number[]) { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN }

async function main() {
  console.log(`── measure-vector-batch ── ${BASE}`)
  const health = await (await fetch(`${BASE}/health`)).json() as any
  console.log(`  build: ${health.build ?? '(no build marker — this service predates S15)'}`)
  if (health.build !== 'S15-cancel-bounded-batch') {
    console.error('  ⛔ the running service does not carry the S15 build. Nothing measured here would mean anything (§7).')
    process.exit(1)
  }
  console.log(`  ${ROUNDS} rounds, limit ${LIMIT}, arms ALTERNATED\n`)

  const soloMs: number[] = []; const batchMs: number[] = []
  let mismatches = 0; let compared = 0
  const errs: string[] = []

  for (let r = 0; r < ROUNDS; r++) {
    const queries = QUERY_SETS[r % QUERY_SETS.length]
    // Alternate which arm goes first as well, so neither arm systematically pays for the
    // other's cache warming of the same underlying index pages.
    const soloFirst = r % 2 === 0
    const a = soloFirst ? await soloArm(queries) : null
    const b = await batchArm(queries)
    const a2 = soloFirst ? a! : await soloArm(queries)
    soloMs.push(a2.ms); batchMs.push(b.ms)
    errs.push(...a2.errors, ...b.errors)

    // Equivalence, per stream, in rank order.
    for (let i = 0; i < STREAMS.length; i++) {
      compared++
      const x = a2.perStream[i] ?? []; const y = b.perStream[i] ?? []
      if (x.join('|') !== y.join('|')) {
        mismatches++
        const firstDiff = x.findIndex((id, k) => id !== y[k])
        console.log(`  ⚠ ${STREAMS[i].stream} round ${r + 1}: ${x.length} solo vs ${y.length} batch ids, first difference at rank ${firstDiff + 1}`)
      }
    }
    console.log(`  round ${r + 1}: solo ${String(a2.ms).padStart(6)} ms · batch ${String(b.ms).padStart(6)} ms` +
      ` (server ${b.serverMs} ms = ann ${b.annMs} + snippet ${b.snippetMs}, ${b.scans} scan)`)
  }

  console.log('')
  console.log(`  solo  (4 requests) p50  ${p50(soloMs)} ms`)
  console.log(`  batch (1 request)  p50  ${p50(batchMs)} ms`)
  const saving = p50(soloMs) ? Math.round(((p50(soloMs) - p50(batchMs)) / p50(soloMs)) * 100) : 0
  console.log(`  batch is ${saving >= 0 ? `${saving}% faster` : `${-saving}% SLOWER`} at the median`)
  console.log(`  requests into the queue per search: 4 → 1`)
  console.log('')
  console.log(`  EQUIVALENCE: ${compared - mismatches}/${compared} stream-rounds returned an identical id list.`)
  if (mismatches) console.log('  ⚠⚠ the batch is NOT a pure transport change on the rounds above — investigate before wiring it in.')
  if (errs.length) console.log(`  errors: ${errs.slice(0, 6).join(' · ')}`)
  if (mismatches) process.exit(1)
}
main().catch((e) => { console.error('FAILED', e instanceof Error ? e.message : e); process.exit(1) })
