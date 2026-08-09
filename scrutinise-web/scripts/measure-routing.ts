/**
 * measure-routing.ts — the §2 measurement. How often does routing actually produce a decision?
 *
 * Calls the REAL `routeQuery` (no reimplementation — a benchmark that measures a copy measures
 * nothing) over a FIXED 12-query mix, and reports the `route_outcome` distribution.
 *
 * THE MIX IS NEW AND FIXED HERE, and that matters for reading the numbers. The 9 Aug figure of
 * "7/12" was 12 calls over a harder 3-query mix; it is not in version control, so it cannot be
 * re-run. Rather than guess at it, this file pins twelve distinct hard queries — long, natural,
 * multi-topic, the shape that provoked the runaway — so every variant below is measured on the
 * same thing. My numbers are comparable to EACH OTHER. They are not comparable to 7/12.
 *
 * ONE VARIABLE AT A TIME. Run these four, in this order:
 *   QUERY_ROUTER_SALVAGE=off QUERY_ROUTER_FEWSHOT=off QUERY_ROUTER_WORD_CAP=999   baseline
 *   QUERY_ROUTER_SALVAGE=on  QUERY_ROUTER_FEWSHOT=off QUERY_ROUTER_WORD_CAP=999   +§2.1 salvage
 *   QUERY_ROUTER_SALVAGE=off QUERY_ROUTER_FEWSHOT=on  QUERY_ROUTER_WORD_CAP=12    +§2.2 length
 *   (all defaults)                                                                both
 *
 * `--reverse` runs the mix back to front. The working rule is to reverse the order of any A/B run
 * to catch cache-warming artefacts; with an LLM in the loop there is no local cache, but there is
 * a server-side one, and "the first query is always the slow/failing one" is a real pattern.
 *
 * Env: `--env-file=.env` supplies GEMINI_API_KEY. LEX_QUERY_ROUTER=true is required — with the
 * flag off, routeQuery returns null immediately and every call would read as a failure.
 */
import { routeQuery, routeOutcomeCounts, type RouteOutcome } from '../lib/lex/query-expansion'

/**
 * Twelve hard queries. Hard means: long, conversational, spanning more than one corpus, and about
 * an area with a lot of statutory vocabulary — which is what pushes the model into writing five
 * long per-stream strings and running past the output ceiling.
 */
const MIX = [
  'what is the current legal and regulatory position on water company sewage discharges into rivers',
  'how does the law protect leaseholders from unreasonable service charges and what has Parliament said about it',
  'what are the rules on the use of live facial recognition by police forces in England and Wales',
  'what does the law and the guidance say about buy now pay later lending and affordability checks',
  'how has Parliament scrutinised the Online Safety Act and what does Ofcom now require of platforms',
  'what is the legal framework for sponsoring skilled worker visas and how has it been challenged',
  'what protections exist for whistleblowers in financial services and how effective are they said to be',
  'what does the law say about landlord possession under section 21 and what replaces it',
  'how are private equity acquisitions of care home providers regulated and scrutinised in the UK',
  'what rules govern political advertising and misinformation online during a general election campaign',
  'what is the legal position on assisted dying in the UK and how has it been debated in Parliament',
  'how does the UK regulate the environmental impact of data centres and their water and energy use',
]

const REVERSE = process.argv.includes('--reverse')

/**
 * ⚠ REPEATS ARE NOT OPTIONAL, and finding that out cost the first run of this script.
 *
 * One pass of the twelve returned 12/12 `full` — no truncation at all — on the SAME queries that
 * had failed open minutes earlier in check-stream-coverage. The failure this sprint exists to fix
 * is INTERMITTENT: the same query, same prompt, same budget, decides on one call and runs away on
 * the next. A single pass therefore measures the sample, not the system, and a 12/12 would have
 * been reported as "fixed" before anything was changed.
 *
 * Three passes (36 calls) is the smallest thing that gives a rate rather than a coin flip. The
 * denominator below is always the call count, never the query count.
 */
const REPEAT = (() => {
  const i = process.argv.indexOf('--repeat')
  const n = i >= 0 ? parseInt(process.argv[i + 1], 10) : NaN
  return Number.isFinite(n) && n > 0 ? n : 3
})()

/** Count of `[query-router] stream query capped` warnings, so the runaway is visible as a number
 *  rather than inferred from the outcome. Intercepted rather than exported: the cap is a
 *  production behaviour and should not grow an API for the benefit of one script. */
let cappedEvents = 0
let maxWordsSeen = 0
const realWarn = console.warn
console.warn = (...args: unknown[]) => {
  const s = args.map(String).join(' ')
  const m = s.match(/stream query capped — \w+: (\d+) words/)
  if (m) { cappedEvents++; maxWordsSeen = Math.max(maxWordsSeen, parseInt(m[1], 10)) }
  realWarn(...args)
}

/** Derive this call's outcome from the counter deltas — the same counters production logs. */
function outcomeDelta(before: Record<RouteOutcome, number>, after: Record<RouteOutcome, number>): RouteOutcome | 'none' {
  for (const k of ['full', 'partial', 'failed'] as RouteOutcome[]) if (after[k] > before[k]) return k
  return 'none'
}

async function main() {
  if (!process.env.GEMINI_API_KEY) { console.error('GEMINI_API_KEY is not set.'); process.exit(1) }
  if (process.env.LEX_QUERY_ROUTER !== 'true') {
    console.error('LEX_QUERY_ROUTER must be true — with the flag off routeQuery returns null immediately and every call reads as a failure.')
    process.exit(1)
  }

  const config = {
    salvage: process.env.QUERY_ROUTER_SALVAGE ?? 'on',
    fewshot: process.env.QUERY_ROUTER_FEWSHOT ?? 'on',
    wordCap: process.env.QUERY_ROUTER_WORD_CAP ?? '12',
    maxTokens: process.env.QUERY_ROUTER_MAX_TOKENS ?? '4096 (default)',
    model: process.env.QUERY_ROUTER_MODEL ?? 'gemini-2.5-flash',
    timeoutMs: process.env.QUERY_ROUTER_TIMEOUT_MS ?? '25000',
    order: REVERSE ? 'reversed' : 'forward',
  }
  const calls = MIX.length * REPEAT
  console.log(`routing outcome over the fixed 12-query mix × ${REPEAT} pass(es) = ${calls} calls`)
  console.log(`config: ${JSON.stringify({ ...config, repeat: REPEAT })}\n`)

  const queries = REVERSE ? [...MIX].reverse() : MIX
  const rows: Array<{ q: string; outcome: RouteOutcome | 'none'; streams: string[]; ms: number }> = []

  for (let pass = 1; pass <= REPEAT; pass++) {
    console.log(`── pass ${pass}/${REPEAT} ──`)
    for (const q of queries) {
      const before = routeOutcomeCounts()
      const t0 = Date.now()
      const route = await routeQuery(q.split(/\s+/).filter(Boolean), '')
      const ms = Date.now() - t0
      const outcome = outcomeDelta(before, routeOutcomeCounts())
      rows.push({ q, outcome, streams: route ? Object.keys(route) : [], ms })
      const mark = outcome === 'full' ? '✓' : outcome === 'partial' ? '~' : '✗'
      console.log(`  ${mark} ${outcome.padEnd(7)} ${String(ms).padStart(6)}ms  ${route ? Object.keys(route).join(',') : 'FAIL-OPEN'}  ${q.slice(0, 72)}`)
    }
  }

  const totals = routeOutcomeCounts()
  const decided = totals.full + totals.partial
  const latencies = rows.map((r) => r.ms).sort((a, b) => a - b)
  const pct = (n: number) => `${((100 * n) / calls).toFixed(1)}%`
  console.log('\n════ ROUTE OUTCOME ════')
  console.log(`  full     ${totals.full}/${calls}  ${pct(totals.full)}`)
  console.log(`  partial  ${totals.partial}/${calls}  ${pct(totals.partial)}`)
  console.log(`  failed   ${totals.failed}/${calls}  ${pct(totals.failed)}   ← every one produced a route_outcome=failed line above`)
  console.log(`  DECIDED (full|partial)  ${decided}/${calls}  ${pct(decided)}   exit criterion is ≥11/12 = 91.7%`)
  console.log(`  latency p50 ${latencies[Math.floor(latencies.length / 2)]}ms · max ${latencies[latencies.length - 1]}ms`)
  // Which queries are the unstable ones — an intermittent failure concentrated in two queries is a
  // different problem from one spread evenly, and the fix for each is different.
  const perQuery = new Map<string, { d: number; f: number }>()
  for (const r of rows) {
    const e = perQuery.get(r.q) ?? { d: 0, f: 0 }
    if (r.outcome === 'failed') e.f++; else e.d++
    perQuery.set(r.q, e)
  }
  const unstable = [...perQuery.entries()].filter(([, v]) => v.f > 0)
  if (unstable.length) {
    console.log(`  queries that failed at least once (${unstable.length}/${MIX.length}):`)
    for (const [q, v] of unstable) console.log(`   · ${v.f}/${v.d + v.f} failed — ${q.slice(0, 80)}`)
  }
  console.log(`  word cap fired on ${cappedEvents} stream quer${cappedEvents === 1 ? 'y' : 'ies'}${maxWordsSeen ? `; longest emitted ${maxWordsSeen} words` : ''}`)
  const streamCounts = rows.flatMap((r) => r.streams).reduce<Record<string, number>>((a, s) => ({ ...a, [s]: (a[s] ?? 0) + 1 }), {})
  console.log(`  streams selected: ${JSON.stringify(streamCounts)}`)
  process.exit(decided / calls >= 11 / 12 ? 0 : 1)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
