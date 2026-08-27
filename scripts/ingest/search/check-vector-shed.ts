/**
 * check-vector-shed.ts — S15 §3. WHEN THE QUEUE IS FULL, DOES THE SERVICE REFUSE FAST AND SAY SO?
 *
 * The brief: "Cap the queue at a small multiple of the width. When it is full, reject immediately
 * and explicitly. A fast, honest refusal is worth far more than a 25-second timeout."
 *
 * ⚠ THE THING BEING ASSERTED IS THE *SPEED* AND THE *SHAPE* OF THE REFUSAL, NOT THAT ONE HAPPENS.
 * A 503 that arrives after twenty seconds is the failure this replaces wearing a better status
 * code. So the shed requests are timed, and a refusal slower than SHED_MAX_MS fails the check.
 *
 * ⚠ AND IT MUST BE WATCHED NOT FIRING. Before the queue is full, the same requests must be
 * ACCEPTED — otherwise a service that 503'd everything would pass. The run therefore has two
 * halves and both are asserted.
 *
 * Arithmetic, so the numbers are not arbitrary: the service is W wide with a queue cap of Q, so
 * it can hold W + Q requests. Firing W + Q + E requests means exactly E should be shed, and the
 * first W + Q should not be.
 *
 * Usage:
 *   tsx search/check-vector-shed.ts [--excess=6] [--shed-max-ms=1500]
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

const BASE = (process.env.VECTOR_SEARCH_URL ?? 'https://vector-serve-production.up.railway.app').replace(/\/$/, '')
const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d
const EXCESS = parseInt(arg('excess', '6'), 10)
const SHED_MAX_MS = parseInt(arg('shed-max-ms', '1500'), 10)

let passed = 0; let failed = 0
function ok(label: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✅ ${label}${detail ? `  — ${detail}` : ''}`) }
  else { failed++; console.log(`  ❌ ${label}${detail ? `  — ${detail}` : ''}`) }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Outcome { status: number; ms: number; body: any }
async function fire(query: string): Promise<Outcome> {
  const t0 = Date.now()
  try {
    const res = await fetch(`${BASE}/vector-search`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, tier: 'legislation', limit: 60, noCache: true }),
    })
    const text = await res.text()
    let body: any = null
    try { body = JSON.parse(text) } catch { body = text.slice(0, 120) }
    return { status: res.status, ms: Date.now() - t0, body }
  } catch (e) {
    return { status: 0, ms: Date.now() - t0, body: (e as Error).message }
  }
}

async function main() {
  console.log(`── check-vector-shed ── ${BASE}`)
  const s0 = await (await fetch(`${BASE}/stats`)).json() as any
  const W = s0.concurrency.max
  const Q = s0.concurrency.maxQueue
  const capacity = W + Q
  console.log(`  build ${s0.build ?? '(no marker)'}`)
  console.log(`  ${W} wide · queue cap ${Q} → holds ${capacity} · rejections so far ${s0.concurrency.rejections}`)
  if (s0.concurrency.inFlight || s0.concurrency.queued) {
    console.log('  ⚠ service is not idle; waiting 10s'); await sleep(10_000)
  }

  // ⚠ THE QUEUE CAP MUST BE A SMALL MULTIPLE OF THE WIDTH (§3). 64 on a 4-wide service is the
  // thing this sprint removed, so assert the property rather than trusting the constant.
  ok(`the queue cap is a small multiple of the width (${Q} vs ${W})`, Q <= W * 4,
    `${(Q / W).toFixed(1)}x — 64-deep on 4 wide was 16x and promised the last caller sixteen service times`)

  console.log(`\n  §A — firing exactly ${capacity} requests: NONE should be shed.\n`)
  const under = await Promise.all(Array.from({ length: capacity }, (_, i) => fire(`bounded queue control probe ${i}`)))
  const shedUnder = under.filter((o) => o.status === 503).length
  ok('a service filled exactly to capacity refuses nothing', shedUnder === 0,
    `${shedUnder} of ${capacity} shed · statuses ${Array.from(new Set(under.map((o) => o.status))).join(',')}`)

  // Let it drain, or the second half measures the first half's backlog.
  console.log('\n  draining…')
  for (let i = 0; i < 60; i++) {
    const s = await (await fetch(`${BASE}/stats`)).json() as any
    if (!s.concurrency.inFlight && !s.concurrency.queued) break
    await sleep(2_000)
  }

  console.log(`\n  §B — firing ${capacity + EXCESS}: about ${EXCESS} should be shed, FAST.\n`)
  const over = await Promise.all(Array.from({ length: capacity + EXCESS }, (_, i) => fire(`bounded queue overflow probe ${i}`)))
  const shed = over.filter((o) => o.status === 503)
  const served = over.filter((o) => o.status === 200)
  ok('the full queue sheds', shed.length > 0, `${shed.length} shed, ${served.length} served, of ${over.length}`)
  ok('it sheds roughly the excess, not everything', shed.length >= 1 && shed.length <= EXCESS + W,
    `${shed.length} shed against ${EXCESS} excess`)

  const slowest = shed.length ? Math.max(...shed.map((o) => o.ms)) : 0
  ok(`every refusal is FAST (<${SHED_MAX_MS} ms)`, shed.length > 0 && slowest < SHED_MAX_MS,
    `slowest refusal ${slowest} ms — the 25,000 ms client timeout is what this replaces`)

  const shaped = shed.every((o) => o.body?.reason === 'overloaded')
  ok('every refusal is machine-readable as "overloaded"', shed.length > 0 && shaped,
    `bodies: ${JSON.stringify(shed[0]?.body)}`)

  // ⚠ THE NEGATIVE CONTROL FOR THE WHOLE FILE. If a 503 could not be told from a 500, the
  // platform adapter could not turn one into a stated gap and the other into an error, which
  // is the entire point of §3.
  ok('a shed is a 503, never a 500', over.every((o) => o.status !== 500),
    `statuses ${Array.from(new Set(over.map((o) => o.status))).join(',')}`)

  const s1 = await (await fetch(`${BASE}/stats`)).json() as any
  const rejDelta = s1.concurrency.rejections - s0.concurrency.rejections
  ok('rejections are COUNTED on /stats, not just returned', rejDelta >= shed.length,
    `rejections +${rejDelta} for ${shed.length} observed sheds`)

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed) process.exit(1)
}
main().catch((e) => { console.error('FAILED', e instanceof Error ? e.message : e); process.exit(1) })
