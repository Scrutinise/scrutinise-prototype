/**
 * probe-edm-rate-limit.ts — find the sustainable request rate for
 * oralquestionsandmotions-api.parliament.uk, because §1's cost estimate was measured on 150 calls
 * and 150 calls is not enough to see a rate limit.
 *
 * ⚠⚠ WHY THIS EXISTS. §1 reported "0 × 429 in 150 calls at concurrency 4 → 32 min for the sweep".
 * The first --apply run at that setting got **429 on 101 of its first 119 motions** and then hung on
 * an un-timed-out `fetch()`. The audit's rate check was a check that could not fail: at 150 calls it
 * finished before the limiter noticed. So the rate is MEASURED here, at each setting, and the number
 * the sweep uses is the one that came back clean — not the one that came back fast.
 *
 * ⚠ READ-ONLY. No database, no writes. It spends requests and reports what they cost.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/probe-edm-rate-limit.ts
 */
export {}

const BASE = 'https://oralquestionsandmotions-api.parliament.uk'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'
const head = (s: string) => console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 78 - s.length))}`)

/** Motion ids spread across the whole range, so nothing is served from one warm page. */
function ids(count: number, seed: number): number[] {
  const out: number[] = []
  for (let i = 0; i < count; i++) out.push(200 + ((seed * 7919 + i * 1013) % 66000))
  return out
}

interface Res { status: number; ms: number; retryAfter: string | null }

async function fetchOne(id: number, timeoutMs: number): Promise<Res> {
  const t0 = Date.now()
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetch(`${BASE}/EarlyDayMotion/${id}`, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      signal: ac.signal,
    })
    // Drain the body: leaving it unread keeps the socket busy and distorts the next measurement.
    await res.text()
    return { status: res.status, ms: Date.now() - t0, retryAfter: res.headers.get('retry-after') }
  } catch (e) {
    return { status: (e as Error).name === 'AbortError' ? -2 : -1, ms: Date.now() - t0, retryAfter: null }
  } finally { clearTimeout(timer) }
}

/** Run `n` requests at `conc` concurrency with `gapMs` between each worker's requests. */
async function burst(n: number, conc: number, gapMs: number, seed: number) {
  const list = ids(n, seed)
  const out: Res[] = new Array(n)
  let idx = 0
  const t0 = Date.now()
  await Promise.all(Array.from({ length: conc }, async () => {
    for (;;) {
      const i = idx++
      if (i >= n) return
      out[i] = await fetchOne(list[i], 20_000)
      if (gapMs) await new Promise((r) => setTimeout(r, gapMs))
    }
  }))
  const elapsed = Date.now() - t0
  const by = new Map<number, number>()
  for (const r of out) by.set(r.status, (by.get(r.status) ?? 0) + 1)
  const ok = by.get(200) ?? 0
  const rl = by.get(429) ?? 0
  const ra = out.find((r) => r.retryAfter)?.retryAfter ?? null
  const lat = out.filter((r) => r.status === 200).map((r) => r.ms).sort((a, b) => a - b)
  console.log(
    `   conc ${String(conc).padStart(2)}  gap ${String(gapMs).padStart(4)}ms  →  ` +
    `${(n / (elapsed / 1000)).toFixed(1).padStart(5)} req/s   ` +
    `200×${String(ok).padStart(3)}  429×${String(rl).padStart(3)}  other ${[...by].filter(([s]) => s !== 200 && s !== 429).map(([s, c]) => `${s}×${c}`).join(' ') || '—'}   ` +
    `p50 ${lat.length ? lat[Math.floor(lat.length / 2)] : '—'}ms` +
    (ra ? `   Retry-After: ${ra}` : '   Retry-After: none sent'),
  )
  return { ok, rl, reqPerSec: n / (elapsed / 1000), retryAfter: ra }
}

async function main() {
  head('DOES IT RATE-LIMIT, AND AT WHAT RATE?')
  console.log(`   Each setting is 120 requests over motion ids spread across the whole range.`)
  console.log(`   A 30s pause between settings, so one setting's limiter state does not fail the next.`)
  console.log(`   ⚠ A clean result here is only clean AT THIS VOLUME — that is exactly the mistake`)
  console.log(`     §1 made — so the winner is re-tested at 600 requests below.\n`)

  const settings: Array<[number, number]> = [
    [4, 0],      // what §1 recommended and what failed
    [2, 0],
    [2, 250],
    [1, 0],
    [1, 150],
  ]
  const results: Array<{ conc: number; gap: number; ok: number; rl: number; reqPerSec: number }> = []
  for (const [conc, gap] of settings) {
    const r = await burst(120, conc, gap, conc * 31 + gap)
    results.push({ conc, gap, ...r })
    await new Promise((res) => setTimeout(res, 30_000))
  }

  head('AND THE CLEANEST SETTING, RE-TESTED AT 5× THE VOLUME')
  const clean = results.filter((r) => r.rl === 0).sort((a, b) => b.reqPerSec - a.reqPerSec)[0]
  if (!clean) {
    console.log(`   ❌ every setting drew a 429. The sweep needs a 429-aware backoff, not a rate.`)
    return
  }
  console.log(`   fastest setting with no 429: conc ${clean.conc}, gap ${clean.gap}ms (${clean.reqPerSec.toFixed(1)} req/s)`)
  const big = await burst(600, clean.conc, clean.gap, 999)
  console.log(`\n   ${big.rl === 0 ? '✓ still clean at 600' : `⚠ 429 appeared at 600 requests (${big.rl}) — the 120-request result was the check that could not fail`}`)
  const total = 60995
  console.log(`\n   projected sweep of ${total.toLocaleString()} motions at ${big.reqPerSec.toFixed(1)} req/s: ${(total / big.reqPerSec / 60).toFixed(0)} min`)
}

main().catch((e) => { console.error('[probe-edm-rate-limit] FATAL', e instanceof Error ? e.stack : e); process.exit(1) })
