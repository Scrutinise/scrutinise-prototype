/**
 * measure-vector-load.ts — S15 §6.1. DO ALL FOUR DENSE STREAMS RUN WITHOUT SATURATION UNDER A
 * TWO-USER LOAD?
 *
 * The brief is precise about the shape: "a TWO-user load, not a one-user load", and "report p50
 * and p95 per stream". One user is the load every earlier measurement in this project used, and
 * it is the load under which the fault does not appear.
 *
 * ⚠ THE UNIT IS A SEARCH, NOT A REQUEST. `fusedStream` issues one dense request PER ROUTED
 * STREAM, concurrently, so one user's search is four simultaneous requests against a service
 * that is N wide IN TOTAL, FOR EVERYBODY. Two users is eight. That multiplication is the whole
 * of S14 §0 and it is what this reproduces.
 *
 * ⚠ PER-STREAM TIMINGS ARE THE DIAGNOSTIC, NOT THE AGGREGATE. S14's tell was that the four
 * dense-enabled streams all returned at the 25 s client timeout within 36 ms of each other while
 * `debates` — the one stream with no dense leg — returned in 4.0–6.1 s. An aggregate p95 would
 * have hidden that; four per-stream columns could not.
 *
 * ⚠ THE CLIENT TIMEOUT IS REAL HERE. `VECTOR_TIMEOUT_MS` defaults to 25,000 and a leg that
 * exceeds it is what production would discard, so it is counted as a timeout rather than waited
 * out. A harness with no deadline would report a latency no user would ever have received.
 *
 * Usage:
 *   tsx search/measure-vector-load.ts [--users=2] [--rounds=5] [--timeout-ms=25000]
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

const BASE = (process.env.VECTOR_SEARCH_URL ?? 'https://vector-serve-production.up.railway.app').replace(/\/$/, '')
const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d
const USERS = parseInt(arg('users', '2'), 10)
const ROUNDS = parseInt(arg('rounds', '5'), 10)
const TIMEOUT_MS = parseInt(arg('timeout-ms', '25000'), 10)

/** The four dense-enabled streams, scoped as stream-scopes.ts scopes them. */
const STREAMS = [
  { name: 'legislation', tier: 'legislation' as string, corpora: undefined as string[] | undefined },
  { name: 'caselaw', tier: 'caselaw', corpora: undefined },
  { name: 'guidance', tier: 'guidance', corpora: undefined },
  { name: 'committees', tier: 'parliamentary', corpora: ['committees-evidence', 'committees-reports'] },
]

const QUESTIONS = [
  'what can a landlord do to evict a tenant',
  'who is responsible when a water company discharges sewage',
  'when is an employer liable for an assault by an employee',
  'how are unexplained wealth orders used',
  'what duty of candour applies to a public inquiry',
  'how are homelessness applications assessed by councils',
  'what are the rules on overseas entities owning property',
  'how is prison overcrowding being addressed',
]

interface Sample { stream: string; ms: number; status: number; count: number; timedOut: boolean }

async function oneLeg(stream: typeof STREAMS[number], q: string, uid: number): Promise<Sample> {
  const ctrl = new AbortController()
  let timedOut = false
  const t = setTimeout(() => { timedOut = true; ctrl.abort() }, TIMEOUT_MS)
  const t0 = Date.now()
  try {
    const res = await fetch(`${BASE}/vector-search`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      // Per-user query suffix so two users never coalesce onto one computation — coalescing is
      // a real and good behaviour, but it would make a two-user load cost the same as one user
      // and the measurement would be of the cache rather than of the service.
      body: JSON.stringify({ query: `${q} [u${uid}]`, tier: stream.tier, ...(stream.corpora ? { corpora: stream.corpora } : {}), limit: 60, noCache: true }),
      signal: ctrl.signal,
    })
    const j = res.ok ? await res.json() as any : null
    if (!res.ok) await res.text()
    return { stream: stream.name, ms: Date.now() - t0, status: res.status, count: j?.count ?? 0, timedOut: false }
  } catch {
    return { stream: stream.name, ms: Date.now() - t0, status: timedOut ? -1 : 0, count: 0, timedOut }
  } finally { clearTimeout(t) }
}

/** One user's search: all four stream legs at once, exactly as fusedStream issues them. */
async function oneSearch(q: string, uid: number): Promise<Sample[]> {
  return await Promise.all(STREAMS.map((s) => oneLeg(s, q, uid)))
}

const pct = (a: number[], p: number) => {
  if (!a.length) return NaN
  const s = [...a].sort((x, y) => x - y)
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
}

async function main() {
  const s0 = await (await fetch(`${BASE}/stats`)).json() as any
  console.log(`── measure-vector-load ── ${BASE}`)
  console.log(`  build ${s0.build ?? '(no marker)'} · started_at ${s0.started_at}`)
  console.log(`  width ${s0.concurrency.max} · queue cap ${s0.concurrency.maxQueue} (read off the running process)`)
  console.log(`  ${USERS} concurrent user(s) × ${STREAMS.length} dense streams = ${USERS * STREAMS.length} simultaneous requests per round, ${ROUNDS} rounds`)
  console.log(`  client timeout ${TIMEOUT_MS} ms (production's VECTOR_TIMEOUT_MS)\n`)

  const all: Sample[] = []
  const searchMs: number[] = []
  for (let r = 0; r < ROUNDS; r++) {
    const t0 = Date.now()
    const batches = await Promise.all(
      Array.from({ length: USERS }, (_, u) => oneSearch(QUESTIONS[(r * USERS + u) % QUESTIONS.length], u)))
    const wall = Date.now() - t0
    searchMs.push(wall)
    for (const b of batches) all.push(...b)
    const flat = batches.flat()
    console.log(`  round ${r + 1}: wall ${String(wall).padStart(6)} ms · ` +
      flat.filter((s) => s.status === 200).length + `/${flat.length} ok · ` +
      `${flat.filter((s) => s.status === 503).length} shed · ${flat.filter((s) => s.timedOut).length} timed out`)
  }

  console.log('\n  PER STREAM (this is the diagnostic — an aggregate would hide the S14 signature):')
  console.log('  stream         n    ok  shed  timeout      p50      p95      max   results')
  for (const s of STREAMS) {
    const rows = all.filter((x) => x.stream === s.name)
    const okRows = rows.filter((x) => x.status === 200)
    const lat = okRows.map((x) => x.ms)
    console.log(
      `  ${s.name.padEnd(13)} ${String(rows.length).padStart(2)}  ${String(okRows.length).padStart(4)}  ` +
      `${String(rows.filter((x) => x.status === 503).length).padStart(4)}  ${String(rows.filter((x) => x.timedOut).length).padStart(7)}  ` +
      `${String(pct(lat, 50)).padStart(7)}  ${String(pct(lat, 95)).padStart(7)}  ${String(lat.length ? Math.max(...lat) : NaN).padStart(7)}   ` +
      `${okRows.length ? Math.round(okRows.reduce((a, b) => a + b.count, 0) / okRows.length) : 0}`)
  }

  const okAll = all.filter((x) => x.status === 200).map((x) => x.ms)
  console.log(`\n  whole search (all 4 legs): p50 ${pct(searchMs, 50)} ms · p95 ${pct(searchMs, 95)} ms · max ${Math.max(...searchMs)} ms`)
  console.log(`  every leg:                 p50 ${pct(okAll, 50)} ms · p95 ${pct(okAll, 95)} ms`)
  const timeouts = all.filter((x) => x.timedOut).length
  const sheds = all.filter((x) => x.status === 503).length
  console.log(`  ${all.length} legs · ${all.filter((x) => x.status === 200).length} ok · ${sheds} shed · ${timeouts} timed out`)

  const s1 = await (await fetch(`${BASE}/stats`)).json() as any
  console.log('\n  /stats after:')
  console.log(`    queueHighWaterMark ${s1.concurrency.queueHighWaterMark} of ${s1.concurrency.maxQueue} · rejections ${s1.concurrency.rejections} · abandoned ${s1.concurrency.abandoned}`)
  console.log(`    stages p50: queue ${s1.stages.queue_p50_ms} · ann ${s1.stages.ann_p50_ms} · snippet ${s1.stages.snippet_p50_ms}`)
  console.log(`    warm p50 ${s1.warm_p50_ms} · warm p95 ${s1.warm_p95_ms} · n ${s1.warm_n}`)
  console.log(`    peak rss ${s1.memory.peak_rss_mb} MB (${s1.memory.peak_pct_of_cap}% of cap)`)

  // ⚠ THE S14 SIGNATURE, ASSERTED RATHER THAN EYEBALLED: four dense streams all landing at the
  // client timeout within a few ms of each other is what saturation looked like. If it recurs,
  // say so loudly rather than leaving it in a table for someone to notice.
  const atCeiling = all.filter((x) => x.timedOut).length
  console.log('')
  if (atCeiling === 0 && sheds === 0) {
    console.log(`  ✅ ${USERS}-user load: no leg timed out and nothing was shed. All four dense streams ran.`)
  } else {
    console.log(`  ⚠⚠ ${atCeiling} leg(s) hit the ${TIMEOUT_MS} ms client ceiling and ${sheds} were shed — the service does NOT carry this load.`)
  }
}
main().catch((e) => { console.error('FAILED', e instanceof Error ? e.message : e); process.exit(1) })
