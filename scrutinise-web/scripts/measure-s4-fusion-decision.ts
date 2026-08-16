/**
 * measure-s4-fusion-decision.ts — BRIEF_SEARCH_S4 §2. Retire S3's eyeball judgement on
 * `LEX_TIER_FUSION` by measuring it, in BOTH run orders, with the resolved config beside the number.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE POPULATION, WHICH IS NOT "THE GOLD SET" AND HAD TO BE ESTABLISHED FIRST
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * `LEX_TIER_FUSION` is read in exactly one place — search-gateway.ts's `flags.router && q.tier`
 * branch. So it governs **tier-scoped callers only**, and today the only tier any caller passes is
 * `legislation` (gateway-legacy.ts). Running the whole gold set through the untiered routed path
 * and toggling the flag would produce two identical numbers and a false verdict of "no effect".
 *
 * The population is therefore: gold queries whose archetype targets legislation AND which are
 * scoreable, run through the tier-scoped path exactly as the three legacy surfaces run.
 *
 * ⚠ AND THE FLAG IS INERT UNLESS `LEX_QUERY_ROUTER` IS ALSO ON. The branch that reads it is guarded
 * by `flags.router`; with the router off, every tier-scoped call goes to `runFtsSearch` and the
 * fusion flag is never consulted. Production's router state cannot be read from this machine
 * (docs/CLAUDE.md §19), so this harness sets the router ON and says so — the measurement below is
 * conditional on that, and it is the condition under which the flag does anything at all.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * BOTH RUN ORDERS, BECAUSE THE LAST MEASUREMENT OF THIS WAS NOT COMPARABLE
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * S3 compared 2,295 ms against 3,710 ms on a warm cache. `vector-serve` runs a query cache, so an
 * OFF pass that precedes an ON pass warms nothing dense while an ON pass that precedes an OFF pass
 * warms everything. This runs OFF→ON and then ON→OFF and reports all four cells. If a condition's
 * two readings disagree, the difference is the cache and the report says so rather than averaging
 * it away.
 *
 * Usage (from scrutinise-web):
 *   FTS_SEARCH_URL=https://fts-serve-production.up.railway.app \
 *   LEX_VECTOR_STREAMS=legislation,debates,committees,caselaw,guidance \
 *   LEX_QUERY_ROUTER=true \
 *     npx tsx --env-file=.env --tsconfig tsconfig.json scripts/measure-s4-fusion-decision.ts
 */
import { runSearch } from '../lib/lex/search-gateway'
import { resolvedConfigLine, assertRetrievalConfig } from '../lib/lex/harness-preflight'
import { perStreamVectorActive } from '../lib/lex/query-router'
import { PREFERENCES } from './gold-preferences'
import { GOLD } from '../../scripts/ingest/search/gold-queries'
import type { SearchResult } from '../lib/lex/page1-config'

const LIMIT = 20        // gateway limit; recall is scored over the top 20 of `results`
const TOP_K = 20

/** Gold queries the flag can possibly affect: legislation-targeted and scoreable. */
const POPULATION = GOLD.filter((g) => g.scoreable && /legislation/.test(g.stream))

/** Haystack for answer-key matching. ⚠ NOT the same haystack as the ingest-side gold harness,
 *  which has the section body; here the body is only the returned snippet. Numbers from the two
 *  are therefore comparable RUN-TO-RUN within this script and not against gold-report recall. */
const haystack = (r: SearchResult) =>
  `${r.id}\n${r.title ?? ''}\n${r.citation ?? ''}\n${r.snippet ?? ''}`

function quantile(sorted: number[], p: number): number {
  if (!sorted.length) return NaN
  const i = (sorted.length - 1) * p
  const lo = Math.floor(i), hi = Math.ceil(i)
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)
}

type Pass = {
  label: string
  flag: boolean
  order: number
  expectedTotal: number
  expectedHit: number
  perQuery: Array<{ id: string; query: string; hit: number; of: number; ms: number; n: number }>
  latencies: number[]
  prefScored: number
  prefCorrect: number
  prefExcluded: number
  resultIds: Map<string, string[]>
}

async function runPass(label: string, flag: boolean, order: number): Promise<Pass> {
  // flagEnabled reads process.env at call time (lib/env-flags.ts), so toggling here is the same
  // switch a deploy would throw — no module reload and no second process needed.
  if (flag) process.env.LEX_TIER_FUSION = 'true'
  else delete process.env.LEX_TIER_FUSION

  const pass: Pass = {
    label, flag, order, expectedTotal: 0, expectedHit: 0, perQuery: [], latencies: [],
    prefScored: 0, prefCorrect: 0, prefExcluded: 0, resultIds: new Map(),
  }

  for (const g of POPULATION) {
    const kw = g.query.split(/\s+/).filter(Boolean)
    const t0 = Date.now()
    const out = await runSearch({ keywords: kw, intent: 'IDEA_CHAT_GROUNDING', limit: LIMIT, tier: 'legislation' })
    const ms = Date.now() - t0
    const top = out.results.slice(0, TOP_K)
    pass.latencies.push(ms)
    pass.resultIds.set(g.id, top.map((r) => String(r.id)))

    let hit = 0
    for (const src of g.expected) {
      const found = top.some((r) => src.patterns.some((p) => p.test(haystack(r))))
      if (found) hit++
    }
    pass.expectedTotal += g.expected.length
    pass.expectedHit += hit
    pass.perQuery.push({ id: g.id, query: g.query.slice(0, 46), hit, of: g.expected.length, ms, n: top.length })
  }

  // ── the preference metric, scored on the SAME tier-scoped ranking ──────────────────────────
  // Only `within-stream` pairs are scoreable at all (S2C5). A pair whose two sides do not both
  // appear in a legislation-scoped result set is EXCLUDED and counted, never scored as a loss.
  for (const pref of PREFERENCES) {
    if (pref.surface !== 'within-stream') { pass.prefExcluded++; continue }
    const kw = pref.query.split(/\s+/).filter(Boolean)
    const out = await runSearch({ keywords: kw, intent: 'IDEA_CHAT_GROUNDING', limit: LIMIT, tier: 'legislation' })
    const top = out.results.slice(0, TOP_K)
    const idxOf = (side: { patterns: RegExp[] }) =>
      top.findIndex((r) => side.patterns.some((p) => p.test(haystack(r))))
    const ia = idxOf(pref.above), ib = idxOf(pref.below)
    if (ia < 0 || ib < 0) { pass.prefExcluded++; continue }
    pass.prefScored++
    if (ia < ib) pass.prefCorrect++
  }

  return pass
}

function summarise(p: Pass) {
  const s = [...p.latencies].sort((a, b) => a - b)
  return {
    condition: p.label,
    order: p.order,
    'recall@20': `${p.expectedHit}/${p.expectedTotal} (${((100 * p.expectedHit) / p.expectedTotal).toFixed(1)}%)`,
    'preference': p.prefScored ? `${p.prefCorrect}/${p.prefScored} (${((100 * p.prefCorrect) / p.prefScored).toFixed(0)}%)` : '—',
    'pref excluded': p.prefExcluded,
    'p50 ms': Math.round(quantile(s, 0.5)),
    'p95 ms': Math.round(quantile(s, 0.95)),
    'mean ms': Math.round(s.reduce((t, v) => t + v, 0) / (s.length || 1)),
  }
}

async function main() {
  console.log('════ SEARCH S4 §2 — LEX_TIER_FUSION, MEASURED ═════════════════════════════════')
  assertRetrievalConfig('measure-s4-fusion-decision')
  console.log(resolvedConfigLine())
  console.log(`dense per-stream active: ${perStreamVectorActive()}`)
  console.log(`population: ${POPULATION.length} scoreable legislation-targeted gold queries`)
  console.log(`  ${POPULATION.map((g) => g.id).join(' ')}`)
  console.log(`⚠ the flag governs TIER-SCOPED callers only, and is inert unless LEX_QUERY_ROUTER is`)
  console.log(`  also on. Production's flag state is unreadable here (docs/CLAUDE.md §19).\n`)

  // Direction 1 — OFF then ON.
  const offFirst = await runPass('FUSION OFF', false, 1)
  const onSecond = await runPass('FUSION ON', true, 2)
  // Direction 2 — ON then OFF, on the same questions, same process, warmed the other way round.
  const onFirst = await runPass('FUSION ON', true, 3)
  const offSecond = await runPass('FUSION OFF', false, 4)

  console.log('\n════ BOTH RUN ORDERS ══════════════════════════════════════════════════════════')
  console.table([summarise(offFirst), summarise(onSecond), summarise(onFirst), summarise(offSecond)])

  console.log('\n════ THE CACHE QUESTION — same condition, both positions ══════════════════════')
  const cacheRows = [
    { condition: 'FUSION OFF', 'run 1st': summarise(offFirst)['p50 ms'], 'run 2nd': summarise(offSecond)['p50 ms'] },
    { condition: 'FUSION ON', 'run 1st': summarise(onFirst)['p50 ms'], 'run 2nd': summarise(onSecond)['p50 ms'] },
  ]
  console.table(cacheRows)
  const offSwing = Math.abs(Number(cacheRows[0]['run 1st']) - Number(cacheRows[0]['run 2nd']))
  const onSwing = Math.abs(Number(cacheRows[1]['run 1st']) - Number(cacheRows[1]['run 2nd']))
  console.log(`  same-condition p50 swing: OFF ${offSwing} ms, ON ${onSwing} ms.`)
  console.log(`  Any OFF-vs-ON difference smaller than the larger of those two is cache, not fusion.`)

  console.log('\n════ RECALL, PER QUERY (order-1 pair) ═════════════════════════════════════════')
  console.table(POPULATION.map((g) => {
    const a = offFirst.perQuery.find((q) => q.id === g.id)!
    const b = onSecond.perQuery.find((q) => q.id === g.id)!
    const idsA = offFirst.resultIds.get(g.id) ?? []
    const idsB = onSecond.resultIds.get(g.id) ?? []
    const overlap = idsA.filter((i) => idsB.includes(i)).length
    return {
      id: g.id, query: g.query.slice(0, 40),
      OFF: `${a.hit}/${a.of}`, ON: `${b.hit}/${b.of}`,
      'Δ': b.hit - a.hit,
      'top-20 overlap': `${overlap}/${Math.max(idsA.length, idsB.length)}`,
      'OFF ms': a.ms, 'ON ms': b.ms,
    }
  }))

  // ── the recommendation, separated from the verdict per §2's last line ───────────────────────
  const rOff = (offFirst.expectedHit + offSecond.expectedHit) / (offFirst.expectedTotal + offSecond.expectedTotal)
  const rOn = (onFirst.expectedHit + onSecond.expectedHit) / (onFirst.expectedTotal + onSecond.expectedTotal)
  const pOff = Math.round(quantile([...offFirst.latencies, ...offSecond.latencies].sort((a, b) => a - b), 0.5))
  const pOn = Math.round(quantile([...onFirst.latencies, ...onSecond.latencies].sort((a, b) => a - b), 0.5))

  console.log('\n════ THE TWO NUMBERS, POOLED ACROSS BOTH ORDERS ═══════════════════════════════')
  console.log(`  recall@20   OFF ${(100 * rOff).toFixed(1)}%   ON ${(100 * rOn).toFixed(1)}%   Δ ${((100 * (rOn - rOff))).toFixed(1)}pp`)
  console.log(`  p50 latency OFF ${pOff} ms   ON ${pOn} ms   Δ ${pOn - pOff} ms (${(((pOn - pOff) / pOff) * 100).toFixed(0)}%)`)
  console.log(`\n  ${resolvedConfigLine()}`)
  console.log(`\n  ⚠ §2's own rule: if quality holds and only latency moves, that is a trade for Charlie,`)
  console.log(`    not a technical verdict. The recommendation is in docs/SEARCH_S4_REPORT.md; the`)
  console.log(`    numbers above are the whole of the evidence for it.`)
}

main().catch((e) => { console.error('[measure-s4-fusion-decision] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
