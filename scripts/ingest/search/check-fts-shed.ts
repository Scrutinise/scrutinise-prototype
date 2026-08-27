/**
 * check-fts-shed.ts — S16 §1. DOES `fts-serve`'s NEW BOUNDED QUEUE REFUSE HONESTLY, AND ONLY WHEN
 * IT MUST?
 *
 * ⚠⚠ THIS MATTERS MORE THAN THE DENSE EQUIVALENT. `vector-serve` runs on four streams of some
 * queries; `fts-serve` runs on EVERY query. A shed here does not degrade one leg — it empties the
 * whole result set. So a queue bound that fires too eagerly would be worse than the unbounded
 * queue it replaces, and this asserts both directions:
 *
 *   §A  filled EXACTLY to capacity (width + queue) → NOTHING may be shed.   ← the negative control
 *   §B  filled beyond capacity                     → the excess is shed, FAST, and countably.
 *
 * ⚠ THE ASSERTION IS THE SPEED AND SHAPE OF THE REFUSAL, NOT THAT ONE HAPPENS. A 503 that arrives
 * after twenty seconds is the failure this replaces wearing a better status code.
 *
 * ⚠ EVERY LINE STATES WHAT IT COUNTED (the sprint's standing rule): how many were fired, how many
 * were shed, out of what capacity, and the slowest refusal in milliseconds.
 *
 * Usage:
 *   tsx search/check-fts-shed.ts [--excess=8] [--shed-max-ms=1500]
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

const BASE = (process.env.FTS_SEARCH_URL ?? 'https://fts-serve-production-4cea.up.railway.app').replace(/\/$/, '')
const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d
const EXCESS = parseInt(arg('excess', '8'), 10)
const SHED_MAX_MS = parseInt(arg('shed-max-ms', '1500'), 10)

let passed = 0; let failed = 0
function ok(label: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✅ ${label}${detail ? `  — ${detail}` : ''}`) }
  else { failed++; console.log(`  ❌ ${label}${detail ? `  — ${detail}` : ''}`) }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const stats = async () => await (await fetch(`${BASE}/stats`)).json() as any

async function fire(query: string) {
  const t0 = Date.now()
  try {
    const res = await fetch(`${BASE}/fts-search`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, tier: 'legislation', limit: 60 }),
    })
    const text = await res.text()
    let body: any = null
    try { body = JSON.parse(text) } catch { body = text.slice(0, 120) }
    return { status: res.status, ms: Date.now() - t0, body }
  } catch (e) { return { status: 0, ms: Date.now() - t0, body: (e as Error).message } }
}

async function drain() {
  for (let i = 0; i < 90; i++) {
    const s = await stats()
    if (!s.concurrency.inFlight && !s.concurrency.queued) return
    await sleep(2_000)
  }
}

async function main() {
  console.log(`── check-fts-shed ── ${BASE}`)
  const s0 = await stats()
  console.log(`  build ${s0.build ?? '(no marker — this service predates S16)'}`)
  if (s0.build !== 'S16-fts-cancel-bounded') {
    console.error('  ⛔ the running service does not carry the S16 build. Nothing below would mean anything.')
    process.exit(1)
  }
  const W = s0.concurrency.max
  const Q = s0.concurrency.maxQueue
  if (typeof Q !== 'number') {
    console.error(`  ⛔ maxQueue is ${JSON.stringify(Q)} — the queue is still UNBOUNDED. That is the defect, not a config.`)
    process.exit(1)
  }
  const capacity = W + Q
  console.log(`  ${W} wide · queue cap ${Q} → holds ${capacity} · rejections so far ${s0.concurrency.rejections}`)

  ok(`the queue cap is a small multiple of the width (${Q} vs ${W})`, Q <= W * 4, `${(Q / W).toFixed(1)}x`)

  console.log(`\n  §A — firing exactly ${capacity}: NONE may be shed (the negative control).\n`)
  await drain()
  const under = await Promise.all(Array.from({ length: capacity }, (_, i) => fire(`bounded queue control probe ${i} statutory duty`)))
  const shedUnder = under.filter((o) => o.status === 503).length
  ok('a service filled exactly to capacity refuses nothing', shedUnder === 0,
    `${shedUnder} of ${capacity} shed · statuses ${Array.from(new Set(under.map((o) => o.status))).join(',')}`)
  ok('and it actually answered them', under.filter((o) => o.status === 200).length === capacity,
    `${under.filter((o) => o.status === 200).length}/${capacity} returned 200`)

  console.log('\n  draining…')
  await drain()

  console.log(`\n  §B — firing ${capacity + EXCESS}: about ${EXCESS} should be shed, fast.\n`)
  const over = await Promise.all(Array.from({ length: capacity + EXCESS }, (_, i) => fire(`bounded queue overflow probe ${i} statutory duty`)))
  const shed = over.filter((o) => o.status === 503)
  ok('the full queue sheds', shed.length > 0,
    `${shed.length} shed, ${over.filter((o) => o.status === 200).length} served, of ${over.length}`)
  ok('it sheds roughly the excess, not everything', shed.length >= 1 && shed.length <= EXCESS + W,
    `${shed.length} shed against ${EXCESS} excess`)
  const slowest = shed.length ? Math.max(...shed.map((o) => o.ms)) : 0
  ok(`every refusal is FAST (<${SHED_MAX_MS} ms)`, shed.length > 0 && slowest < SHED_MAX_MS,
    `slowest refusal ${slowest} ms`)
  ok('every refusal is machine-readable as "overloaded"', shed.length > 0 && shed.every((o) => o.body?.reason === 'overloaded'),
    `body: ${JSON.stringify(shed[0]?.body)}`)
  ok('a shed is a 503, never a 500', over.every((o) => o.status !== 500),
    `statuses ${Array.from(new Set(over.map((o) => o.status))).join(',')}`)

  const s1 = await stats()
  ok('rejections are COUNTED on /stats, not just returned',
    s1.concurrency.rejections - s0.concurrency.rejections >= shed.length,
    `rejections +${s1.concurrency.rejections - s0.concurrency.rejections} for ${shed.length} observed sheds`)

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed) process.exit(1)
}
main().catch((e) => { console.error('FAILED', e instanceof Error ? e.message : e); process.exit(1) })
