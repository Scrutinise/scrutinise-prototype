/**
 * vector-handle-pool-probe.ts — does opening N Lance table handles buy real
 * parallelism, or is the semaphore in vector-query-service.ts the whole story?
 *
 * WHY THIS EXISTS. The concurrency guard (B1) caps concurrent native work at
 * VECTOR_MAX_CONCURRENT. That is a crash guard, not a capacity plan: if the cap is
 * the only thing standing between us and the failure, then throughput is hard-capped
 * too. The brief's question is whether a POOL of handles — N opens of the same table,
 * each request checking one out — lets genuine parallelism happen instead.
 *
 * WHAT IT MEASURES. Query vectors are embedded ONCE up front and replayed, so this
 * measures Lance and only Lance: no Gemini latency, no Gemini cost, no per-run
 * variance from the embedding call. For each (handles, concurrency) cell it reports
 * wall-clock, per-query p50/p95, achieved throughput (queries/sec) and peak RSS.
 *
 * READ THE THROUGHPUT COLUMN, NOT THE LATENCY COLUMN. Latency always rises with
 * concurrency; that alone says nothing. The question a pool has to answer is whether
 * TOTAL THROUGHPUT rises with it. If q/s is flat from concurrency 1 to 8, the work is
 * already serialised somewhere below us and more handles cannot help — the bottleneck
 * is elsewhere (R2 round-trips, the shared Tokio runtime, or memory), and the honest
 * answer to the brief is "it does not support what we hoped; keep the semaphore".
 *
 * Usage:
 *   tsx search/vector-handle-pool-probe.ts
 *   PROBE_HANDLES=1,4 PROBE_CONCURRENCY=1,2,4,8 tsx search/vector-handle-pool-probe.ts
 *
 * NOTE ON WHERE IT IS RUN. Run locally, every R2 round-trip crosses the public
 * internet from a UK domestic connection; on Railway it is datacentre-to-datacentre.
 * Absolute numbers from a local run are NOT the production numbers and must not be
 * quoted as such. The SHAPE — whether throughput scales — is what transfers.
 */
import { connectLance, lancedb } from './lance'
import { VEC_TABLE } from './vector-common'
import { embedQuery, vectorSearchSections } from './vector-core'

const HANDLE_COUNTS = (process.env.PROBE_HANDLES ?? '1,4').split(',').map((s) => parseInt(s.trim(), 10))
const CONCURRENCIES = (process.env.PROBE_CONCURRENCY ?? '1,2,4,8').split(',').map((s) => parseInt(s.trim(), 10))
const QUERIES_PER_CELL = parseInt(process.env.PROBE_QUERIES ?? '16', 10)

// The five streams query-router.ts fans out to, so the mix matches production shape
// (different tiers = different prefilter selectivity = different amounts of work).
const PROBE_QUERIES: Array<{ q: string; tier?: string }> = [
  { q: 'landlord eviction no fault', tier: 'legislation' },
  { q: 'photographing people in public places privacy', tier: 'legislation' },
  { q: 'short term holiday lets licensing', tier: 'parliamentary' },
  { q: 'noise nuisance neighbours enforcement', tier: 'caselaw' },
  { q: 'sugar tax soft drinks levy', tier: 'guidance' },
  { q: 'e-scooter regulation pavement', tier: 'legislation' },
  { q: 'water company pollution enforcement', tier: 'parliamentary' },
  { q: 'data protection subject access request', tier: 'legislation' },
]

let peakRssMb = 0
function sampleRss() { peakRssMb = Math.max(peakRssMb, process.memoryUsage().rss / 1024 / 1024) }

function pct(arr: number[], p: number): number {
  const s = [...arr].sort((a, b) => a - b)
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))])
}

/** Run `total` queries against `handles`, at most `concurrency` in flight at once. */
async function runCell(handles: lancedb.Table[], concurrency: number, total: number, vecs: Array<{ v: number[]; tier?: string }>) {
  const latencies: number[] = []
  let issued = 0
  let rr = 0
  const t0 = Date.now()

  async function worker() {
    for (;;) {
      const i = issued++
      if (i >= total) return
      const { v, tier } = vecs[i % vecs.length]
      // Round-robin the handle pool: with handles.length === 1 this is the current
      // production shape (one shared handle); with N it is the pool being tested.
      const tbl = handles[rr++ % handles.length]
      const s = Date.now()
      await vectorSearchSections(tbl, v, 20, tier)
      latencies.push(Date.now() - s)
      sampleRss()
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  const wallMs = Date.now() - t0
  return {
    wallMs,
    p50: pct(latencies, 50),
    p95: pct(latencies, 95),
    qps: Math.round((total / (wallMs / 1000)) * 100) / 100,
  }
}

async function main() {
  console.log('[probe] embedding the query set once (so the measurement is Lance-only)…')
  const conn = await connectLance()
  const vecs: Array<{ v: number[]; tier?: string }> = []
  for (const p of PROBE_QUERIES) vecs.push({ v: await embedQuery(p.q), tier: p.tier })
  console.log(`[probe] ${vecs.length} query vectors ready.`)

  const maxHandles = Math.max(...HANDLE_COUNTS)
  console.log(`[probe] opening ${maxHandles} handle(s) on ${VEC_TABLE}…`)
  const tOpen = Date.now()
  const allHandles: lancedb.Table[] = []
  for (let i = 0; i < maxHandles; i++) allHandles.push(await conn.openTable(VEC_TABLE))
  sampleRss()
  console.log(`[probe] ${maxHandles} handle(s) open in ${Date.now() - tOpen}ms. RSS now ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`)

  // Warm-up: the first ANN query pulls index files from R2. Excluded from every cell
  // so a cold R2 fetch is not attributed to whichever cell happened to run first.
  console.log('[probe] warm-up…')
  await vectorSearchSections(allHandles[0], vecs[0].v, 20, vecs[0].tier)
  console.log('[probe] warm. Starting grid.\n')

  console.log('handles  concurrency  queries  wall_ms   p50_ms   p95_ms    q/s   peakRSS_MB')
  const rows: Array<Record<string, number>> = []
  for (const h of HANDLE_COUNTS) {
    for (const c of CONCURRENCIES) {
      const handles = allHandles.slice(0, h)
      const r = await runCell(handles, c, QUERIES_PER_CELL, vecs)
      rows.push({ handles: h, concurrency: c, ...r, peakRssMb: Math.round(peakRssMb) })
      console.log(
        `${String(h).padStart(7)}  ${String(c).padStart(11)}  ${String(QUERIES_PER_CELL).padStart(7)}  ` +
        `${String(r.wallMs).padStart(7)}  ${String(r.p50).padStart(7)}  ${String(r.p95).padStart(7)}  ` +
        `${String(r.qps).padStart(5)}  ${String(Math.round(peakRssMb)).padStart(11)}`,
      )
    }
  }

  // The verdict is a throughput comparison, so state it as one rather than leaving it
  // to be eyeballed off the table.
  console.log('')
  for (const h of HANDLE_COUNTS) {
    const cells = rows.filter((r) => r.handles === h)
    const base = cells.find((r) => r.concurrency === Math.min(...CONCURRENCIES))!
    const best = cells.reduce((a, b) => (b.qps > a.qps ? b : a))
    console.log(`[probe] ${h} handle(s): throughput ${base.qps} q/s at concurrency ${base.concurrency} → best ${best.qps} q/s at concurrency ${best.concurrency} (${Math.round((best.qps / base.qps) * 100) / 100}×)`)
  }
  if (HANDLE_COUNTS.length > 1) {
    const one = rows.filter((r) => r.handles === 1).reduce((a, b) => (b.qps > a.qps ? b : a))
    const many = rows.filter((r) => r.handles === Math.max(...HANDLE_COUNTS)).reduce((a, b) => (b.qps > a.qps ? b : a))
    console.log(`[probe] BEST 1-handle ${one.qps} q/s vs BEST ${Math.max(...HANDLE_COUNTS)}-handle ${many.qps} q/s → pool gain ${Math.round((many.qps / one.qps) * 100) / 100}×`)
  }
  console.log(`[probe] peak RSS across the whole grid: ${Math.round(peakRssMb)} MB`)
  console.log(JSON.stringify({ rows, peakRssMb: Math.round(peakRssMb) }))
}

main().catch((e) => { console.error('[probe] FATAL', e); process.exit(1) })
