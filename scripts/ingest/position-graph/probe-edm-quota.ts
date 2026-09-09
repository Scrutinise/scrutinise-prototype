/**
 * probe-edm-quota.ts — what KIND of limit is this, when does it reset, and is there a bulk route
 * that avoids 60,995 requests altogether?
 *
 * ⚠⚠ WHAT probe-edm-rate-limit.ts COULD NOT TELL US, AND WHY ITS CONCLUSION MUST NOT BE REPORTED AS
 * IT STANDS. It reported "every setting drew a 429, so the sweep needs a backoff rather than a rate"
 * — but every setting also came back with `Retry-After` counting DOWN toward one fixed instant
 * (3146 → 3115 → 3083 → 3037 → 3005 across five settings). That is not five settings each hitting a
 * rate limit. That is one lockout already in force before the first of them ran, which means the
 * probe measured nothing about concurrency at all. A limit that is already tripped makes every
 * subsequent measurement of it come back the same, whatever you change.
 *
 * So this script answers three separate questions and keeps them separate:
 *   A. is the LIST endpoint under the same budget as the DETAIL endpoint?
 *   B. is there a parameter or route that returns signatories in bulk?
 *   C. when does the lockout clear, and how many requests does a fresh budget actually buy?
 *
 * ⚠ It is deliberately frugal: (C) spends one request every 60s until the lockout clears, so it
 * costs almost nothing against whatever the budget turns out to be.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/probe-edm-quota.ts               # A and B, ~8 requests
 *   npx tsx position-graph/probe-edm-quota.ts --wait        # then C: watch for the reset
 *   npx tsx position-graph/probe-edm-quota.ts --budget      # after a reset: spend until 429, count
 */
export {}

const argv = process.argv.slice(2)
const WAIT = argv.includes('--wait')
const BUDGET = argv.includes('--budget')

const BASE = 'https://oralquestionsandmotions-api.parliament.uk'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'
const head = (s: string) => console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 78 - s.length))}`)

interface R { status: number; ms: number; retryAfter: string | null; bytes: number; body: any }
async function get(url: string, timeoutMs = 25_000): Promise<R> {
  const t0 = Date.now()
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA }, signal: ac.signal })
    const text = await res.text()
    let body: any = null
    try { body = JSON.parse(text) } catch { /* not json */ }
    return { status: res.status, ms: Date.now() - t0, retryAfter: res.headers.get('retry-after'), bytes: text.length, body }
  } catch (e) {
    return { status: (e as Error).name === 'AbortError' ? -2 : -1, ms: Date.now() - t0, retryAfter: null, bytes: 0, body: null }
  } finally { clearTimeout(timer) }
}

async function main() {
  if (BUDGET) {
    head('C2 · HOW MANY REQUESTS DOES A FRESH BUDGET BUY?')
    console.log(`   One request at a time, 700ms apart, stopping at the first 429. The number that`)
    console.log(`   comes out is the budget AT THIS PACE — not a universal quota — and that`)
    console.log(`   qualification is the whole finding.`)
    let spent = 0
    const t0 = Date.now()
    for (;;) {
      const id = 200 + ((spent * 1013) % 66000)
      const r = await get(`${BASE}/EarlyDayMotion/${id}`)
      spent++
      if (r.status === 429) {
        const mins = (Date.now() - t0) / 60000
        console.log(`\n   ⚠ 429 after ${spent} requests in ${mins.toFixed(1)} min (${""}${(spent / mins).toFixed(1)}/min)`)
        console.log(`     Retry-After: ${r.retryAfter ?? 'not sent'}`)
        console.log(`\n   projected sweep of 60,995 motions at ${(spent / mins).toFixed(1)}/min, with a`)
        console.log(`   ${r.retryAfter}s wait every ${spent}: ${((60995 / spent) * (mins + Number(r.retryAfter ?? 0) / 60) / 60).toFixed(1)} hours`)
        return
      }
      if (spent % 100 === 0) console.log(`   ${spent} requests, ${((Date.now() - t0) / 60000).toFixed(1)} min, still 200`)
      if (spent >= 4000) { console.log(`\n   ✓ 4,000 requests at this pace with no 429. Stopping; the pace is sustainable.`); return }
      await new Promise((r2) => setTimeout(r2, 700))
    }
  }

  if (!WAIT) {
    head('A · IS THE LIST ENDPOINT UNDER THE SAME BUDGET AS THE DETAIL ENDPOINT?')
    const list = await get(`${BASE}/EarlyDayMotions/list?parameters.take=1&parameters.skip=0`)
    const detail = await get(`${BASE}/EarlyDayMotion/66501`)
    console.log(`   /EarlyDayMotions/list   ${list.status}  ${list.bytes} bytes  ${list.ms}ms  Retry-After ${list.retryAfter ?? '—'}`)
    console.log(`   /EarlyDayMotion/{id}    ${detail.status}  ${detail.bytes} bytes  ${detail.ms}ms  Retry-After ${detail.retryAfter ?? '—'}`)
    console.log(`   → ${list.status === 200 && detail.status === 429 ? '⚠ SEPARATE budgets: the list is open while the detail route is locked out' : list.status === detail.status ? 'the same, on this evidence' : 'they differ — see the statuses above'}`)

    head('B · IS THERE A BULK ROUTE? (a 60,995-request sweep is a choice, not a given)')
    // Every one of these is a guess and each is REPORTED with its status, because "there is no bulk
    // route" is a claim about what was tried.
    const tries = [
      // Does the list item carry the sponsors if asked?
      '/EarlyDayMotions/list?parameters.take=1&parameters.skip=0&parameters.includeSponsors=true',
      '/EarlyDayMotions/list?parameters.take=1&parameters.skip=0&parameters.expand=Sponsors',
      // Is there a sponsor-oriented collection?
      '/Sponsors/list?parameters.take=2&parameters.skip=0',
      '/EarlyDayMotionSponsors/list?parameters.take=2&parameters.skip=0',
      '/EarlyDayMotions/sponsors/list?parameters.take=2&parameters.skip=0',
      // Signatures by member — would still be ~1,500 requests rather than 61,000.
      '/EarlyDayMotions/list?parameters.take=2&parameters.skip=0&parameters.sponsorId=5313',
      '/EarlyDayMotions/list?parameters.take=2&parameters.skip=0&parameters.memberId=5313',
    ]
    for (const t of tries) {
      const r = await get(BASE + t)
      const hasSponsors = JSON.stringify(r.body ?? '').includes('"Sponsors"')
      console.log(`   ${String(r.status).padStart(4)}  ${String(r.bytes).padStart(7)}b  sponsors in payload: ${hasSponsors ? '✅ YES' : 'no'}   ${t.replace(BASE, '')}`)
      await new Promise((res) => setTimeout(res, 1500))
    }
    console.log(`\n   ⚠ "sponsors in payload: no" on a 200 is a real answer. On a 429 it means nothing —`)
    console.log(`     the route was never evaluated, and it must be re-tried after the reset.`)
    return
  }

  head('C1 · WHEN DOES THE LOCKOUT CLEAR?')
  console.log(`   One request a minute. Retry-After should fall by ~60 each time; if it does not, the`)
  console.log(`   window is being EXTENDED by the request, which is a different and worse fact.`)
  let last: number | null = null
  for (let i = 0; i < 75; i++) {
    const r = await get(`${BASE}/EarlyDayMotion/66501`)
    const ra = r.retryAfter && /^\d+$/.test(r.retryAfter) ? parseInt(r.retryAfter, 10) : null
    const delta = last != null && ra != null ? ra - last : null
    console.log(`   ${new Date().toISOString().slice(11, 19)}  status ${r.status}  Retry-After ${ra ?? '—'}` +
      (delta != null ? `  (${delta > 0 ? '+' : ''}${delta} vs last minute — ${delta > -30 ? '⚠ NOT counting down at 60/min' : 'counting down'})` : ''))
    if (r.status === 200) {
      console.log(`\n   ✓ CLEARED at ${new Date().toISOString()} after ${i} minutes of waiting.`)
      console.log(`     Next: --budget, to find how many requests a fresh window buys.`)
      return
    }
    last = ra
    await new Promise((res) => setTimeout(res, 60_000))
  }
  console.log(`\n   ⚠ still locked out after 75 minutes.`)
}

main().catch((e) => { console.error('[probe-edm-quota] FATAL', e instanceof Error ? e.stack : e); process.exit(1) })
