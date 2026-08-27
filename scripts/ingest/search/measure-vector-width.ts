/**
 * measure-vector-width.ts — S15 §5. DOES WIDTH ACTUALLY BUY THROUGHPUT, AND WHAT DOES IT COST
 * IN MEMORY?
 *
 * The brief allows width only after §2 and §3, sized from a measured service time, and insists
 * the new width be PROVEN rather than configured: "A limiter that silently failed open would look
 * identical to one that worked."
 *
 * ⚠⚠ AND MEMORY IS THE VARIABLE THAT MATTERS, NOT LATENCY. `fts-query-service.ts` records an open
 * question from 7 Aug 2026: the FTS symptom that justified the concurrency cap — the process
 * simply dying with no JS-catchable error — is the signature docs/CLAUDE.md §17 attributes to an
 * OOM SIGKILL, not to handle contention. *"If that is what it was, this semaphore is guarding the
 * wrong variable."* This harness settles it, because it samples PEAK RSS across the ramp instead
 * of counting requests.
 *
 * ⚠ RSS IS SAMPLED THROUGHOUT, NOT JUST AT THE END. A peak reached mid-run and released before
 * the last request finishes is exactly the peak that kills the process, and an end-of-run reading
 * cannot see it. `/stats` reports `peak_rss_mb` since boot, sampled by the service's own 5-second
 * timer, so the peak is the service's, not this script's inference.
 *
 * ⚠ THE CONFOUND THIS IS BUILT TO SEPARATE: memory may grow with CONCURRENCY (N requests in
 * flight each holding a working set) or with CUMULATIVE DISTINCT QUERIES (LanceDB caching index
 * pages as more of the IVF index is touched). Those have opposite consequences — the first caps
 * the width, the second is a warm-up that levels off — and they are indistinguishable from a
 * single number. So the ramp runs each level TWICE and reports the growth between the repeats:
 * concurrency-driven memory returns to the same peak, cache-driven memory does not grow the
 * second time.
 *
 * Usage:
 *   tsx search/measure-vector-width.ts [--levels=1,2,4,8] [--reps=2] [--per-level=12]
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

const BASE = (process.env.VECTOR_SEARCH_URL ?? 'https://vector-serve-production.up.railway.app').replace(/\/$/, '')
const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d
const LEVELS = arg('levels', '1,2,4,8').split(',').map((s) => parseInt(s, 10))
const REPS = parseInt(arg('reps', '2'), 10)
const PER_LEVEL = parseInt(arg('per-level', '12'), 10)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const stats = async () => await (await fetch(`${BASE}/stats`)).json() as any

const TIERS = ['legislation', 'caselaw', 'guidance']
let seq = 0
async function one(): Promise<{ ok: boolean; ms: number; status: number }> {
  const i = seq++
  const t0 = Date.now()
  try {
    const res = await fetch(`${BASE}/vector-search`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      // Distinct every time: a repeat would coalesce or hit the cache and never reach the index,
      // which would flatter both throughput and memory.
      body: JSON.stringify({ query: `width probe ${i} statutory duty compensation notice appeal`, tier: TIERS[i % 3], limit: 60, noCache: true }),
    })
    await res.text()
    return { ok: res.status === 200, ms: Date.now() - t0, status: res.status }
  } catch (e) { return { ok: false, ms: Date.now() - t0, status: 0 } }
}

/** Run `total` requests keeping exactly `conc` in flight. */
async function atConcurrency(conc: number, total: number) {
  const results: Array<{ ok: boolean; ms: number; status: number }> = []
  let launched = 0
  const t0 = Date.now()
  const worker = async () => {
    while (launched < total) { launched++; results.push(await one()) }
  }
  await Promise.all(Array.from({ length: conc }, worker))
  const wall = Date.now() - t0
  const okr = results.filter((r) => r.ok)
  const lat = okr.map((r) => r.ms).sort((a, b) => a - b)
  return {
    wall, completed: okr.length, shed: results.filter((r) => r.status === 503).length,
    failed: results.filter((r) => !r.ok && r.status !== 503).length,
    throughput: okr.length / (wall / 1000),
    p50: lat.length ? lat[Math.floor(lat.length / 2)] : NaN,
    p95: lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * 0.95))] : NaN,
  }
}

async function drain() {
  for (let i = 0; i < 90; i++) {
    const s = await stats()
    if (!s.concurrency.inFlight && !s.concurrency.queued) return
    await sleep(2_000)
  }
}

async function main() {
  const s0 = await stats()
  console.log(`── measure-vector-width ── ${BASE}`)
  console.log(`  build ${s0.build ?? '(no marker)'} · started_at ${s0.started_at}`)
  console.log(`  ⚠ SERVICE WIDTH (read off the running process, not configured here): ${s0.concurrency.max}, queue cap ${s0.concurrency.maxQueue}`)
  console.log(`  host ${s0.host?.cpus} cpus · rss ${s0.memory.rss_mb} MB · peak ${s0.memory.peak_rss_mb} MB · cap ${s0.memory.cap_mb} MB`)
  console.log(`  ⚠ offered concurrency above ${s0.concurrency.max} is QUEUED, not run — this ramp measures what the`)
  console.log(`     SERVICE does with the load, which is the honest question, not what the client offered.\n`)

  console.log('  offered  rep  requests   wall    completed  shed   p50    p95   throughput/s   rss_mb  PEAK_mb  peak%')
  const rows: Array<{ conc: number; rep: number; tput: number; peak: number; rss: number }> = []
  for (const conc of LEVELS) {
    for (let rep = 1; rep <= REPS; rep++) {
      await drain()
      const r = await atConcurrency(conc, PER_LEVEL)
      const s = await stats()
      rows.push({ conc, rep, tput: r.throughput, peak: s.memory.peak_rss_mb, rss: s.memory.rss_mb })
      console.log(
        `  ${String(conc).padStart(7)}  ${String(rep).padStart(3)}  ${String(PER_LEVEL).padStart(8)}  ` +
        `${String(r.wall).padStart(6)}  ${String(r.completed).padStart(9)}  ${String(r.shed).padStart(4)}  ` +
        `${String(r.p50).padStart(5)}  ${String(r.p95).padStart(5)}  ${r.throughput.toFixed(3).padStart(12)}   ` +
        `${String(s.memory.rss_mb).padStart(6)}  ${String(s.memory.peak_rss_mb).padStart(7)}  ${String(s.memory.peak_pct_of_cap).padStart(5)}`)
      if (s.memory.peak_pct_of_cap >= 70) {
        console.log('  ⚠⚠ peak is at/above 70% of the per-replica cap — docs/CLAUDE.md §17. STOPPING the ramp.')
        break
      }
    }
  }

  console.log('')
  const base = rows.find((r) => r.conc === LEVELS[0])
  if (base) {
    console.log('  THROUGHPUT SCALING (against the lowest level, which is the control):')
    for (const c of LEVELS) {
      const best = rows.filter((r) => r.conc === c).sort((a, b) => b.tput - a.tput)[0]
      if (best) console.log(`    offered ${String(c).padStart(2)} → ${best.tput.toFixed(3)}/s  (${(best.tput / base.tput).toFixed(2)}× the offered-${LEVELS[0]} rate)`)
    }
  }
  console.log('')
  console.log('  ⚠ MEMORY: growth BETWEEN REPETITIONS at the same level separates the two causes.')
  for (const c of LEVELS) {
    const reps = rows.filter((r) => r.conc === c)
    if (reps.length >= 2) {
      const d = reps[reps.length - 1].peak - reps[0].peak
      console.log(`    offered ${String(c).padStart(2)}: peak ${reps[0].peak} → ${reps[reps.length - 1].peak} MB (${d >= 0 ? '+' : ''}${d})` +
        `  → ${Math.abs(d) < 50 ? 'stable: memory tracks CONCURRENCY, and this level is safe' : 'still growing: memory tracks CUMULATIVE QUERIES (index-page cache), not concurrency'}`)
    }
  }
  const last = await stats()
  console.log(`\n  final: rss ${last.memory.rss_mb} MB · peak ${last.memory.peak_rss_mb} MB (${last.memory.peak_pct_of_cap}% of the ${last.memory.cap_mb} MB cap)`)
  console.log(`  cpu/wall ${last.stages?.cpu_over_wall} · rejections ${last.concurrency.rejections} · abandoned ${last.concurrency.abandoned}`)
}
main().catch((e) => { console.error('FAILED', e instanceof Error ? e.message : e); process.exit(1) })
