/**
 * measure-s9-stats-stream.ts — BRIEF_SEARCH_S9 §5. MEASURE HONESTLY.
 *
 * ⚠⚠ WHAT THIS IS NOT. It is NOT a recall measurement, and no number it prints is one.
 * §5 is explicit: "There is no gold set for statistics, and one cannot be borrowed. Do not
 * report a recall figure scored on questions you wrote for yourself as though it were a
 * quality measurement — committees has been unevaluable for exactly that reason since S7."
 * Q51–Q60 in GOLD_CANDIDATES_S8.md are marked UNVALIDATED and await Charlie.
 *
 * What this measures instead is BEHAVIOURAL, and the more important half is the negative one:
 *   A. does the router select `statistics` when a numeric series is plainly wanted?
 *   B. does it LEAVE IT ALONE when the question is legal or evidential?
 *      "A stream that fires on everything is worse than one that fires on nothing."
 *   C. what latency does selecting the stream add?
 *   D. does anything regress on the S5 ten with the flag OFF vs ON?
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * THE PREDICTION — WRITTEN DOWN BEFORE THE FIRST RUN, per §5 and SEARCH_STRATEGY v5 §1
 * ("Record the prediction before the measurement. A written prediction is what makes a
 * surprising result a finding rather than a shrug.")
 *
 *   A. POSITIVE PROBES (Q51–Q60, all requests for a quantity): I expect the router to
 *      select `statistics` on **9 of 10**.
 *      The one I expect it to MISS is **Q55** ("has anyone measured whether people in the UK
 *      are actually happier") — it reads as an emotional rather than a quantitative
 *      question, and nothing in its wording names a number, a unit or a publisher.
 *      ⚠ Q60 (NHS waiting lists) is counted as a POSITIVE here on purpose: it is a genuine
 *      request for a series, and the fact that we hold no such series is the CATALOGUE's
 *      job to report, not the router's. Routing is about what was asked, not about what we
 *      happen to have.
 *
 *   B. NEGATIVE CONTROLS (the ten S5 questions, all legal/evidential/policy): I expect
 *      **2 of 10 false positives**, and I name them in advance:
 *        · "what have select committees said about water company sewage discharge" —
 *          discharge volumes are measured, so the subject is quantitative even though the
 *          question is evidential;
 *        · "has parliament scrutinised the rollout of universal credit" — caseload numbers
 *          are the obvious adjacent series.
 *      I expect the three exact-citation-shaped legislation questions to be clean.
 *
 *   C. LATENCY: the catalogue runs CONCURRENTLY with corpus retrieval against a different
 *      database, and the index is cached in-process. I expect the added wall-clock on a
 *      routed query to be **under 50 ms**, i.e. hidden inside the slowest corpus stream —
 *      with the exception of the first call after a cold start, which pays the ~350 ms
 *      index build (measured by check:s9-catalogue).
 *
 *   D. REGRESSION: I expect **none** on the S5 ten — the statistics stream adds no corpus
 *      retrieval, so `results` should be identical in both arms except for router
 *      non-determinism. ⚠ I expect that non-determinism to be VISIBLE and to be the main
 *      difficulty in reading this arm, exactly as it confounded S8 §4 at n=1.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * Run: npm run measure:s9-stats     (needs GEMINI_API_KEY, STATS_DATABASE_URL)
 */

import { routeQuery, routerEnabled } from '../lib/lex/query-expansion'
import { runSearch } from '../lib/lex/search-gateway'
import { searchCatalogue, getCatalogueIndex, statsUseContext } from '../lib/lex/stats-catalogue'
import { flagEnabled } from '../lib/env-flags'

// ── the probes ───────────────────────────────────────────────────────────────

/** Q51–Q60 of GOLD_CANDIDATES_S8.md, verbatim. All are requests for a QUANTITY. */
const POSITIVE: Array<{ id: string; q: string }> = [
  { id: 'Q51', q: 'Does anyone publish how much the UK government spends on health compared to other things?' },
  { id: 'Q52', q: 'Is there a figure for how much tax goes uncollected each year?' },
  { id: 'Q53', q: 'Do we have numbers on how UK health spending compares with other countries?' },
  { id: 'Q54', q: 'Is there an official series for the unemployment rate?' },
  { id: 'Q55', q: 'Has anyone measured whether people in the UK are actually happier?' },
  { id: 'Q56', q: 'What does the OBR forecast for government borrowing?' },
  { id: 'Q57', q: 'Is there data on how much different government departments spend?' },
  { id: 'Q58', q: 'Are there figures for how much alcohol duty raises?' },
  { id: 'Q59', q: 'Does anyone track income inequality in the UK over time?' },
  { id: 'Q60', q: 'How many people are on an NHS waiting list?' },
]

/** ⚠ THE S5 TEN, VERBATIM — the same set S4, S5 and S8 used, so this arm is comparable
 *  with theirs rather than being a fresh set chosen to look good. Every one is legal,
 *  evidential or policy. NONE should select `statistics`. */
const NEGATIVE: Array<{ q: string; shape: 'legislation' | 'not-legislation' }> = [
  { q: 'companies act 2006 directors duties', shape: 'legislation' },
  { q: 'data protection lawful basis for processing personal data', shape: 'legislation' },
  { q: 'equality act public sector equality duty', shape: 'legislation' },
  { q: 'what have select committees said about water company sewage discharge', shape: 'not-legislation' },
  { q: 'what did MPs argue in the debate on assisted dying', shape: 'not-legislation' },
  { q: 'how have the courts interpreted the duty to make reasonable adjustments', shape: 'not-legislation' },
  { q: 'government guidance on procurement social value', shape: 'not-legislation' },
  { q: 'what evidence did witnesses give on leasehold reform', shape: 'not-legislation' },
  { q: 'has parliament scrutinised the rollout of universal credit', shape: 'not-legislation' },
  { q: 'what was said about buy now pay later regulation in parliament', shape: 'not-legislation' },
]

/** Named in the prediction as the two expected false positives. */
const PREDICTED_FALSE_POSITIVES = [
  'what have select committees said about water company sewage discharge',
  'has parliament scrutinised the rollout of universal credit',
]
const PREDICTED_MISS = 'Q55'

const pct = (a: number, b: number) => (b === 0 ? '—' : `${((100 * a) / b).toFixed(0)}%`)
const p = (xs: number[], q: number) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((q / 100) * s.length))]
}

async function main(): Promise<void> {
  console.log('\n═══ measure-s9-stats-stream — BEHAVIOURAL, NOT RECALL ═══\n')
  console.log('⚠ No number below is a recall figure. Q51–Q60 are UNVALIDATED questions written')
  console.log('  by the implementer. §5 forbids scoring quality against them.\n')

  if (!routerEnabled()) {
    console.error('LEX_QUERY_ROUTER is off — this measures the router, so there is nothing to measure.')
    console.error('Set LEX_QUERY_ROUTER=true for this run.')
    process.exit(1)
  }
  // The flag must be ON for the stream to exist in the schema at all.
  process.env.LEX_STATS_STREAM = 'true'
  console.log(`config: LEX_STATS_STREAM=${flagEnabled('LEX_STATS_STREAM') ? 'ON' : 'off'} · ` +
    `STATS_USE_CONTEXT=${statsUseContext()}\n`)

  // Warm the index so the latency arm measures steady state, and report the cold cost once.
  const cold = Date.now()
  const idx = await getCatalogueIndex(true)
  const coldMs = Date.now() - cold
  if (!idx) { console.error('catalogue index unavailable — cannot measure.'); process.exit(1) }
  console.log(`catalogue: ${idx.rows.length} series indexed, cold build ${coldMs} ms\n`)

  // ── A. positive probes ─────────────────────────────────────────────────────
  console.log('── A. DOES IT FIRE WHEN A QUANTITY IS WANTED? (Q51–Q60) ' + '─'.repeat(18))
  let selectedPos = 0
  const missed: string[] = []
  for (const { id, q } of POSITIVE) {
    const route = await routeQuery(q.split(/\s+/), '')
    const chose = !!route?.statistics
    if (chose) selectedPos += 1; else missed.push(id)
    // What the catalogue then returned — reported so "routed" is not mistaken for "answered".
    let found = '—'
    if (chose) {
      const out = await searchCatalogue(route!.statistics!, { limit: 5, useContext: statsUseContext() })
      found = out.results.length ? `${out.results.length} series, top: ${out.results[0].seriesLabel.slice(0, 44)}` : 'NO SERIES'
    }
    console.log(`  ${chose ? '●' : '○'} ${id}  streams=${route ? Object.keys(route).join(',') : 'FAIL-OPEN'}`)
    console.log(`     statsQuery=${route?.statistics ? JSON.stringify(route.statistics) : '—'}  → ${found}`)
  }
  console.log(`\n  SELECTED ${selectedPos}/10 (${pct(selectedPos, 10)}).  Missed: ${missed.join(', ') || 'none'}`)
  console.log(`  PREDICTED 9/10, miss = ${PREDICTED_MISS}.  ` +
    `${selectedPos === 9 && missed.length === 1 && missed[0] === PREDICTED_MISS
      ? '✅ prediction held exactly'
      : `⚠ prediction ${selectedPos === 9 ? 'held on the count but not the identity' : 'did NOT hold'}`}`)

  // ── B. negative controls — the half that matters more ──────────────────────
  console.log('\n── B. DOES IT STAY QUIET ON LEGAL/EVIDENTIAL QUESTIONS? (the S5 ten) ' + '─'.repeat(5))
  let falsePos = 0
  const firedOn: string[] = []
  for (const { q, shape } of NEGATIVE) {
    const route = await routeQuery(q.split(/\s+/), '')
    const chose = !!route?.statistics
    if (chose) { falsePos += 1; firedOn.push(q) }
    console.log(`  ${chose ? '⚠ FIRED' : '  quiet'}  [${shape}] ${q.slice(0, 62)}`)
    if (chose) console.log(`            statsQuery=${JSON.stringify(route!.statistics)}`)
  }
  console.log(`\n  FALSE POSITIVES ${falsePos}/10 (${pct(falsePos, 10)}).`)
  console.log(`  PREDICTED 2/10, specifically:`)
  for (const f of PREDICTED_FALSE_POSITIVES) console.log(`     · ${f.slice(0, 66)}`)
  const namedHit = firedOn.filter((f) => PREDICTED_FALSE_POSITIVES.includes(f)).length
  console.log(`  → ${falsePos} fired; ${namedHit} of them were the two named in advance.`)

  // ── C. latency ─────────────────────────────────────────────────────────────
  console.log('\n── C. LATENCY ADDED WHEN THE STREAM IS SELECTED ' + '─'.repeat(26))
  const catMs: number[] = []
  for (const { q } of POSITIVE) {
    const t = Date.now()
    await searchCatalogue(q, { limit: 8, useContext: statsUseContext() })
    catMs.push(Date.now() - t)
  }
  console.log(`  catalogue retrieval alone, warm index, n=${catMs.length}:`)
  console.log(`     p50 ${p(catMs, 50)} ms · p95 ${p(catMs, 95)} ms · max ${Math.max(...catMs)} ms`)
  console.log(`  cold index build (once per process / per TTL expiry): ${coldMs} ms`)
  console.log('  ⚠ This is the cost of the retrieval, not the added wall-clock of a routed query —')
  console.log('    the catalogue runs CONCURRENTLY with corpus retrieval, so the added wall-clock is')
  console.log('    max(0, catalogue − slowest corpus stream), measured in D below.')

  // ── D. regression on the S5 ten, flag OFF vs ON ────────────────────────────
  console.log('\n── D. REGRESSION ON THE S5 TEN — FLAG OFF vs ON ' + '─'.repeat(26))
  console.log('  ⚠ ALTERNATED PER QUESTION, not run as two blocks, so warm-up and service state')
  console.log('    cannot land differently on the two arms (the S8 §6 lesson).\n')
  const off: number[] = []
  const on: number[] = []
  let resultsDiffer = 0
  let streamsDiffer = 0
  for (const { q } of NEGATIVE) {
    process.env.LEX_STATS_STREAM = 'false'
    const t1 = Date.now()
    const a = await runSearch({ keywords: q.split(/\s+/), intent: 'GENERAL_CORPUS_CHAT', limit: 12 })
    off.push(Date.now() - t1)

    process.env.LEX_STATS_STREAM = 'true'
    const t2 = Date.now()
    const b = await runSearch({ keywords: q.split(/\s+/), intent: 'GENERAL_CORPUS_CHAT', limit: 12 })
    on.push(Date.now() - t2)

    const idsA = a.results.map((r) => r.id).join('|')
    const idsB = b.results.map((r) => r.id).join('|')
    const sA = (a.meta.routedStreams ?? []).filter((s) => s !== 'statistics').sort().join(',')
    const sB = (b.meta.routedStreams ?? []).filter((s) => s !== 'statistics').sort().join(',')
    if (idsA !== idsB) resultsDiffer += 1
    if (sA !== sB) streamsDiffer += 1
    console.log(`  ${idsA === idsB ? '=' : '≠'} ${q.slice(0, 46).padEnd(46)} ` +
      `off ${String(off[off.length - 1]).padStart(5)}ms  on ${String(on[on.length - 1]).padStart(5)}ms  ` +
      `${sA === sB ? 'same streams' : `streams ${sA || '∅'} → ${sB || '∅'}`}` +
      `${b.statistics ? `  [stats: ${b.statistics.results.length}]` : ''}`)
  }
  console.log(`\n  corpus results identical on ${10 - resultsDiffer}/10 · corpus stream selection identical on ${10 - streamsDiffer}/10`)
  console.log(`  latency  OFF p50 ${p(off, 50)} ms p95 ${p(off, 95)} ms  |  ON p50 ${p(on, 50)} ms p95 ${p(on, 95)} ms`)
  console.log(`  delta    p50 ${p(on, 50) - p(off, 50) >= 0 ? '+' : ''}${p(on, 50) - p(off, 50)} ms · p95 ${p(on, 95) - p(off, 95) >= 0 ? '+' : ''}${p(on, 95) - p(off, 95)} ms`)
  console.log('  ⚠ n=1 per arm per question. Router non-determinism (a fresh LLM call per arm) is')
  console.log('    confounded with the flag — S8 §4 hit exactly this and it is not fixed here.')
  console.log('    A "≠" row is therefore NOT evidence the flag changed retrieval; the stream-')
  console.log('    selection column is the one to read, and even it re-rolls the dice per arm.')

  console.log('\n═══ done — see SEARCH_S9_REPORT.md §B for what these numbers mean ═══\n')
}

main().catch((e) => { console.error('measure-s9-stats-stream THREW:', e); process.exit(1) })
