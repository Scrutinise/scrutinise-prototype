/**
 * measure-vector-stages.ts — S15 §1.2/§6. WHAT IS ONE DENSE REQUEST MADE OF?
 *
 * The durable characterisation the brief asks for, and the first time this service has had one.
 * Until S15 the service reported a single `ms` and one component of it, `embedMs`; everything
 * else — queue wait, ANN, the snippet scan over corpus_chunks, response assembly — was one
 * undifferentiated lump, so "the service is slow" could not be turned into "WHICH PART", and
 * every proposal to fix it was a guess about a quantity nobody held.
 *
 * ⚠ ONE REQUEST AT A TIME, DELIBERATELY. This measures SERVICE time, not queue time. Firing
 * concurrently would fold the queue wait into every number and measure saturation instead of
 * cost. The concurrent behaviour is §6's load test, which is a different question.
 *
 * ⚠ `cpu_over_wall` IS THE NUMBER §5 TURNS ON. lance.ts opens both tables straight off R2 over
 * S3 with no local cache directory, so every ANN and every scan is a series of HTTP range reads.
 * Near 1 means the service is CPU-bound and width is bought with cores; near 0 means it is
 * waiting on the object store and more cores buy nothing.
 *
 * Usage:
 *   tsx search/measure-vector-stages.ts [--n=10] [--limit=60] [--label=before-index-rebuild]
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

const BASE = (process.env.VECTOR_SEARCH_URL ?? 'https://vector-serve-production.up.railway.app').replace(/\/$/, '')
const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d
const LIMIT = parseInt(arg('limit', '60'), 10)
const LABEL = arg('label', 'unlabelled')

// Spread across the four dense-enabled streams, because tier selectivity is a candidate
// explanation for the spread and a single-tier sample could not see it.
const PROBES: Array<{ q: string; tier?: string; corpora?: string[] }> = [
  { q: 'landlords evicting tenants without a reason', tier: 'legislation' },
  { q: 'sewage discharge by water companies', tier: 'legislation' },
  { q: 'unexplained wealth orders', tier: 'legislation' },
  { q: 'vicarious liability for an employee assault', tier: 'caselaw' },
  { q: 'the duty of candour in public inquiries', tier: 'caselaw' },
  { q: 'when is an employer liable for the acts of a contractor', tier: 'caselaw' },
  { q: 'guidance on the register of overseas entities', tier: 'guidance' },
  { q: 'how should councils assess homelessness applications', tier: 'guidance' },
  { q: 'committee evidence on water industry regulation', tier: 'parliamentary', corpora: ['committees-evidence', 'committees-reports'] },
  { q: 'select committee report on prison overcrowding', tier: 'parliamentary', corpora: ['committees-evidence', 'committees-reports'] },
]

const stat = (a: number[]) => {
  if (!a.length) return { p50: NaN, p95: NaN, mean: NaN, min: NaN, max: NaN }
  const s = [...a].sort((x, y) => x - y)
  return {
    p50: s[Math.floor(s.length * 0.5)],
    p95: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))],
    mean: Math.round(a.reduce((x, y) => x + y, 0) / a.length),
    min: s[0], max: s[s.length - 1],
  }
}

async function main() {
  const health = await (await fetch(`${BASE}/health`)).json() as any
  console.log(`── measure-vector-stages [${LABEL}] ── ${BASE}`)
  console.log(`  build ${health.build ?? '(no marker — predates S15; annMs/snippetMs will be absent)'}`)
  const s0 = await (await fetch(`${BASE}/stats`)).json() as any
  console.log(`  ${s0.concurrency.max} wide · queue cap ${s0.concurrency.maxQueue} · nprobes ${s0.config.nprobes} · overscan x${s0.config.chunkOverscan} · refine x${s0.config.refineFactor}`)
  console.log(`  host ${s0.host?.cpus ?? '?'} cpus · rss ${s0.memory.rss_mb} MB · peak ${s0.memory.peak_rss_mb} MB (${s0.memory.peak_pct_of_cap}% of cap)\n`)

  console.log('   #  tier            total   embed    wait     ann  snippet    n  query')
  const tot: number[] = []; const emb: number[] = []; const ann: number[] = []; const snip: number[] = []
  for (let i = 0; i < PROBES.length; i++) {
    const p = PROBES[i]
    const res = await fetch(`${BASE}/vector-search`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: p.q, limit: LIMIT, ...(p.tier ? { tier: p.tier } : {}), ...(p.corpora ? { corpora: p.corpora } : {}), noCache: true }),
    })
    if (!res.ok) { console.log(`  ${i + 1}  HTTP ${res.status} ${(await res.text()).slice(0, 80)}`); continue }
    const j = await res.json() as any
    tot.push(j.ms); emb.push(j.embedMs ?? 0)
    if (typeof j.annMs === 'number') ann.push(j.annMs)
    if (typeof j.snippetMs === 'number') snip.push(j.snippetMs)
    console.log(
      `  ${String(i + 1).padStart(2)}  ${(p.tier ?? '-').padEnd(14)} ${String(j.ms).padStart(6)}  ${String(j.embedMs).padStart(6)}  ` +
      `${String(j.waitMs ?? '-').padStart(6)}  ${String(j.annMs ?? '-').padStart(6)}  ${String(j.snippetMs ?? '-').padStart(7)}  ${String(j.count).padStart(3)}  ${p.q.slice(0, 34)}`)
  }

  const T = stat(tot); const E = stat(emb); const A = stat(ann); const S = stat(snip)
  console.log('')
  console.log(`  n = ${tot.length}, one at a time, noCache, limit ${LIMIT}`)
  console.log('  stage        mean     p50     p95     min     max    share of mean total')
  const row = (name: string, s: ReturnType<typeof stat>) =>
    console.log(`  ${name.padEnd(11)} ${String(s.mean).padStart(6)}  ${String(s.p50).padStart(6)}  ${String(s.p95).padStart(6)}  ${String(s.min).padStart(6)}  ${String(s.max).padStart(6)}   ${T.mean ? `${Math.round((s.mean / T.mean) * 100)}%` : '-'}`)
  row('total', T); row('embed', E); row('ann', A); row('snippet', S)

  const s1 = await (await fetch(`${BASE}/stats`)).json() as any
  if (s1.stages) {
    console.log('')
    console.log('  /stats since boot:')
    console.log(`    queue   p50 ${s1.stages.queue_p50_ms} · p95 ${s1.stages.queue_p95_ms}`)
    console.log(`    ann     p50 ${s1.stages.ann_p50_ms} · p95 ${s1.stages.ann_p95_ms}`)
    console.log(`    snippet p50 ${s1.stages.snippet_p50_ms} · p95 ${s1.stages.snippet_p95_ms}`)
    console.log(`    cpu     p50 ${s1.stages.cpu_p50_ms} · p95 ${s1.stages.cpu_p95_ms}`)
    console.log(`    ⚠ CPU / WALL = ${s1.stages.cpu_over_wall}  → ${
      s1.stages.cpu_over_wall === null ? 'not yet computable'
        : s1.stages.cpu_over_wall > 0.7 ? 'CPU-BOUND: width is bought with cores'
          : 'I/O-BOUND on R2: more cores buy nothing, and each replica re-reads independently'}`)
  }

  console.log('')
  console.log('  ── §1.4 arithmetic from THIS measurement ──')
  const S_SEC = (T.mean - E.mean) / 1000
  console.log(`    mean time holding a semaphore slot   ${(S_SEC * 1000).toFixed(0)} ms  (total minus embed, which runs outside it)`)
  console.log(`    dense requests per search (4 streams) 4`)
  for (const W of [4, 8, 16, 32]) {
    console.log(`    width ${String(W).padStart(2)} sustains ${(W / (4 * S_SEC)).toFixed(3)} searches/sec = one search every ${((4 * S_SEC) / W).toFixed(1)} s`)
  }
  console.log(`    width needed for 1 search/sec: ${Math.ceil(4 * S_SEC)}`)
}
main().catch((e) => { console.error('FAILED', e instanceof Error ? e.message : e); process.exit(1) })
