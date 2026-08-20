/**
 * measure-s10-stats.ts — BRIEF_SEARCH_S10 §4. Score Q51–Q60 and make the call on LEX_STATS_STREAM.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * FOUR MEASUREMENTS, AND THE SECOND ONE MATTERS MOST
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * 1. SELECTION — does the router choose `statistics` on Charlie's nine accepted quantitative
 *    questions, and leave the negative control alone?
 *
 * 2. ⚠⚠ FALSE POSITIVES — does it leave the stream alone on questions that are legal or
 *    evidential? "A stream that fires on everything is worse than one that fires on nothing."
 *    S9 measured 0 of 10 against probes IT WROTE ITSELF, which is the exam-marking problem again.
 *    This runs it against Charlie's fifty validated Q1–Q50 — committees, case law, guidance,
 *    impact assessments and consultations. Every one of those is a question where selecting
 *    statistics would be wrong. Fifty is also a real denominator rather than ten.
 *
 * 3. RETRIEVAL — for the questions where the router did select it, is the keyed series in the
 *    returned descriptors?
 *
 * 4. ⚠ THE LICENCE GATE, UNDER BOTH USE CONTEXTS, MEASURED. §4.1: S9 reported "40.6% of series,
 *    50.2% of observations withheld" without saying which setting produced it, "and the direction
 *    matters: a licence marked commercialUseExcluded should PERMIT use in a non-commercial
 *    context." It does — the gate withholds under `commercial` — so those figures describe the
 *    arm that is NOT in production. Both are measured here and printed side by side.
 *
 * ⚠ NO NUMBER IS EVER RETRIEVED OR PRINTED BY THIS SCRIPT. `searchCatalogue` returns descriptors
 * and `assertNoObservationValues` re-checks that at the boundary on every call. A statistics
 * question is answered correctly by naming a SERIES, never a figure — so "correct" here means the
 * right series descriptor came back, and a script that printed values would be demonstrating the
 * exact failure S9 built the separation to prevent.
 *
 * Usage (from scrutinise-web):
 *   npx tsx --env-file=.env scripts/measure-s10-stats.ts
 *   npx tsx --env-file=.env scripts/measure-s10-stats.ts --reroute
 */
import fs from 'node:fs'
import path from 'node:path'
import { routeQuery } from '../lib/lex/query-expansion'
import { searchCatalogue, statsUseContext, assertNoObservationValues, type SeriesDescriptor } from '../lib/lex/stats-catalogue'
import { runSearch } from '../lib/lex/search-gateway'
import { STATS_LICENCE_DECISION } from '../lib/lex/stats-licence-register'
import { GOLD_CORPUS, GOLD_STATS, type StatsKey } from './gold/s10-gold-set'

export {}

const argv = process.argv.slice(2)
const has = (n: string) => argv.includes(`--${n}`)
const DIR = path.join(__dirname, 'gold')
const CACHE = path.join(DIR, 's10-stats-routes.json')

// ════════════════════════════════════════════════════════════════════════════════════════════════
// PREDICTIONS, RECORDED BEFORE THE RUN
// ════════════════════════════════════════════════════════════════════════════════════════════════
// S9 predicted 9/10 selection and measured 10/10; predicted 2 false positives and measured 0. Both
// were refuted, one in each direction, on ITS OWN probes. These are the predictions for CHARLIE'S.
const PREDICTIONS = {
  selection: '9 of 9 accepted quantitative questions select statistics. S9 got 10/10 on its own probes and these questions are phrased more plainly ("Is there a figure for…", "Does anyone track…"), which is if anything easier. I predict the one miss, if there is one, is Q53 — "how UK health spending compares with other countries" reads as a comparison question and the prompt tells the router not to pad with comparison words.',
  negativeControl: 'Q60 (NHS waiting list) IS selected by the router — it is plainly a quantitative question — and the CATALOGUE correctly returns nothing. Selection and retrieval are different gates and this control tests the second. S9 had to add two relevance floors to make this hold; I predict they still hold.',
  falsePositives: '3 to 6 of the 50 legal/evidential questions wrongly select statistics — higher than S9\'s 0 of 10, because Charlie\'s set contains questions with quantitative surface ("Has Parliament examined NHS WAITING TIMES", "what did the government think banning plastic straws would COST", "what was the PREDICTED COST of the residual waste target"). Those read as cost/quantity questions and I expect the router to reach for the stream. Naming them in advance: Q10, Q31, Q33, Q35, Q38.',
  withheld: 'Under non-commercial (the production value) the withheld count is ZERO. Under commercial it is 2,329 series. S9\'s headline figures were the commercial arm and did not say so.',
}

const pct = (n: number, d: number) => (d === 0 ? 'n/a' : `${((100 * n) / d).toFixed(0)}%`)

/** Does a returned descriptor satisfy one of a question's keys? All named fields must match. */
function matches(d: SeriesDescriptor, k: StatsKey): boolean {
  if (k.keyPrefix && !d.seriesKey.startsWith(k.keyPrefix)) return false
  if (k.dataset && d.datasetId !== k.dataset) return false
  if (k.measure && d.measure !== k.measure) return false
  // `seriesId` is not on the descriptor by design (S9: 79% of it is our own synthesised slug and
  // it is "no longer null; it is also not provenance"). The catalogue returns `seriesKey` and
  // nothing else as a handle, so a seriesId-only key is matched against the MEASURE, which is what
  // the markdown's examples actually name (`tax_gap_pct_beer_duty`, `unemployment_rate`).
  if (k.seriesId && d.measure !== k.seriesId) return false
  return !!(k.keyPrefix || k.dataset || k.measure || k.seriesId)
}

async function main() {
  console.log('═'.repeat(100))
  console.log('S10 §4 — STATISTICS: SCORE Q51–Q60 AND MAKE THE CALL')
  console.log('═'.repeat(100))

  console.log('\n── PREDICTIONS, RECORDED BEFORE THE RUN ───────────────────────────────────────────────')
  for (const [k, v] of Object.entries(PREDICTIONS)) console.log(`  ${k}:\n    ${v}\n`)

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // §4.1 — THE LICENCE GATE, UNDER BOTH CONTEXTS, MEASURED
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  console.log('── §4.1 THE LICENCE GATE UNDER EACH USE CONTEXT (measured, not inferred) ──────────────')
  const probe = 'UK public expenditure health'
  const nc = await searchCatalogue(probe, { limit: 8, useContext: 'non-commercial' })
  const cm = await searchCatalogue(probe, { limit: 8, useContext: 'commercial' })
  if (nc.unavailable || cm.unavailable) {
    console.log('  ⚠ THE CATALOGUE IS UNAVAILABLE from this machine (STATS_DATABASE_URL). Reported, not')
    console.log('    worked around — an unavailable store and an empty one must never look alike.')
  } else {
    console.log(`  probe: "${probe}"`)
    console.log(`  non-commercial   withheld=${String(nc.licenceWithheld).padStart(5)}   searchedOver=${String(nc.searchedOver).padStart(5)}   returned=${nc.results.length}`)
    console.log(`  commercial       withheld=${String(cm.licenceWithheld).padStart(5)}   searchedOver=${String(cm.searchedOver).padStart(5)}   returned=${cm.results.length}`)
    const total = nc.searchedOver
    console.log(`\n  ⚠⚠ S9's "40.6% of series, 50.2% of observations withheld" is the COMMERCIAL arm.`)
    console.log(`     Under the value now set in Vercel (non-commercial) the withheld count is ${nc.licenceWithheld}`)
    console.log(`     and all ${total} series are searchable. Both figures are correct; only one describes production.`)
  }
  console.log(`\n  DECLARED (lib/lex/stats-licence-register.ts): ${STATS_LICENCE_DECISION.useContext}, decided ${STATS_LICENCE_DECISION.decidedOn}`)
  console.log(`  RUNNING  (statsUseContext(), this shell):     ${statsUseContext()}`)
  console.log(`  agree?   ${STATS_LICENCE_DECISION.useContext === statsUseContext() ? '✓ yes' : '✗ NO — check:s10-stats-licence will fail'}`)

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // §4 — SELECTION AND FALSE POSITIVES. ONE ROUTING PASS, STATS STREAM OFFERED.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  process.env.LEX_STATS_STREAM = 'true'
  interface Routed { n: number; code: string; picked: boolean; query: string | null; streams: string[] }
  let routed: Routed[]
  const cached = has('reroute') ? null : (() => { try { return JSON.parse(fs.readFileSync(CACHE, 'utf8')) as Routed[] } catch { return null } })()
  if (cached) {
    routed = cached
    console.log(`\n[routes] reusing ${routed.length} cached statistics-arm routes`)
  } else {
    console.log('\n[routes] rolling routes with LEX_STATS_STREAM=true over all 60 questions…')
    routed = []
    for (const q of [...GOLD_CORPUS, ...GOLD_STATS]) {
      const r = await routeQuery(q.question.split(/\s+/).filter(Boolean), '')
      routed.push({
        n: q.n, code: q.code,
        picked: !!r?.statistics,
        query: r?.statistics ?? null,
        streams: r ? Object.keys(r) : [],
      })
    }
    fs.mkdirSync(DIR, { recursive: true })
    fs.writeFileSync(CACHE, JSON.stringify(routed, null, 2))
  }
  const at = (n: number) => routed.find((r) => r.n === n)!

  console.log('\n── SELECTION on the nine accepted quantitative questions (Q51–Q59) ────────────────────')
  let selected = 0
  for (const q of GOLD_STATS.filter((x) => x.scoring !== 'negative-control')) {
    const r = at(q.n)
    if (r.picked) selected++
    console.log(`  Q${q.n} ${r.picked ? '✓ selected' : '✗ NOT selected'}   ${r.picked ? `query="${r.query}"` : `streams=${r.streams.join(',') || 'none'}`}`)
  }
  console.log(`  → ${selected}/9 (${pct(selected, 9)})`)

  console.log('\n── ⚠⚠ FALSE POSITIVES on Charlie\'s 50 legal/evidential questions (Q1–Q50) ─────────────')
  console.log('  Every one of these is a question where selecting statistics is WRONG. This is the number')
  console.log('  §4 says matters more than the positive half, and it is measured on Charlie\'s questions')
  console.log('  rather than on the ten probes S9 wrote for itself.')
  const fps = GOLD_CORPUS.filter((q) => at(q.n).picked)
  for (const q of fps) console.log(`  ✗ Q${String(q.n).padStart(2)} ${q.code.padEnd(4)} query="${at(q.n).query}"  — ${q.question.slice(0, 60)}`)
  console.log(`  → ${fps.length}/50 false positives (${pct(fps.length, 50)})${fps.length === 0 ? ' — the stream stayed out of every legal and evidential question' : ''}`)

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // RETRIEVAL — is the keyed series actually returned?
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n── RETRIEVAL on the selected statistics questions ─────────────────────────────────────')
  console.log('  ⚠ "Correct" is the right SERIES DESCRIPTOR, never a value. Nothing below is a number.')
  let hit = 0
  let scored = 0
  for (const q of GOLD_STATS) {
    const r = at(q.n)
    if (!r.picked || !r.query) {
      console.log(`  Q${q.n} — router did not select the stream; nothing retrieved`)
      continue
    }
    const out = await searchCatalogue(r.query, { limit: 8, useContext: statsUseContext() })
    if (out.unavailable) { console.log(`  Q${q.n} — catalogue UNAVAILABLE`); continue }
    // The never-claim boundary, re-checked here as well as inside the module: this script hands
    // descriptors to a formatter, which is exactly the kind of caller the assertion exists for.
    assertNoObservationValues(out.results)

    if (q.scoring === 'negative-control') {
      // ⚠ SCORED BACKWARDS ON PURPOSE (§1.3). A helpful answer is the failure.
      const pass = out.results.length === 0
      console.log(`  Q${q.n} NEGATIVE CONTROL — returned ${out.results.length} series. ${pass ? '✓ PASS (said nothing, correctly)' : '✗ FAIL — manufactured plausible hits for a question the store cannot answer'}`)
      if (!pass) for (const d of out.results.slice(0, 5)) console.log(`         ✗ ${d.seriesLabel}  [${d.datasetId}]`)
      continue
    }

    scored++
    const found = out.results.some((d) => q.statsKeys.some((k) => matches(d, k)))
    if (found) hit++
    const hard = q.scoring === 'recall-known-hard' ? ' [KNOWN HARD]' : ''
    console.log(`  Q${q.n}${hard} ${found ? '✓ keyed series returned' : '· keyed series NOT in top 8'}   top: ${out.results[0] ? `"${out.results[0].seriesLabel}" [${out.results[0].datasetId}]` : '(nothing)'}`)
    if (!found && out.results.length) {
      console.log(`         wanted one of: ${q.statsKeys.map((k) => JSON.stringify(k)).join(' | ')}`)
    }
  }
  console.log(`  → ${hit}/${scored} of the selected, scoreable statistics questions returned their keyed series in the top 8`)

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // LATENCY AND NON-REGRESSION — the flag both off and on
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n── LATENCY AND NON-REGRESSION, FLAG OFF vs ON ────────────────────────────────────────')
  console.log('  Six questions, each run with LEX_STATS_STREAM off and then on, alternating in one process')
  console.log('  against the same warm services. The corpus half of the result is compared id-for-id:')
  console.log('  ⚠ ADDING A STREAM THAT TOUCHES A DIFFERENT DATABASE MUST NOT CHANGE THE CORPUS ANSWER.')
  const sample = [...GOLD_CORPUS.slice(0, 3), ...GOLD_STATS.slice(0, 3)]
  const offMs: number[] = []
  const onMs: number[] = []
  let identical = 0
  for (const q of sample) {
    const kw = q.question.split(/\s+/).filter(Boolean)
    process.env.LEX_STATS_STREAM = 'false'
    let t = Date.now()
    const off = await runSearch({ keywords: kw, intent: 'GENERAL_CORPUS_CHAT', limit: 20 })
    offMs.push(Date.now() - t)
    process.env.LEX_STATS_STREAM = 'true'
    t = Date.now()
    const on = await runSearch({ keywords: kw, intent: 'GENERAL_CORPUS_CHAT', limit: 20 })
    onMs.push(Date.now() - t)
    // ⚠ THE ROUTER RE-ROLLS BETWEEN THE TWO CALLS, so a difference here is not necessarily the
    // stats stream — it may be a different route. Reported as "comparable" only when the routed
    // stream sets match; otherwise named as unattributable rather than counted as a regression.
    const sameRoute = JSON.stringify((off.meta.routedStreams ?? []).filter((s) => s !== 'statistics').sort())
      === JSON.stringify((on.meta.routedStreams ?? []).filter((s) => s !== 'statistics').sort())
    const sameIds = JSON.stringify(off.results.map((r) => r.id)) === JSON.stringify(on.results.map((r) => r.id))
    if (sameRoute && sameIds) identical++
    console.log(`  Q${String(q.n).padStart(2)} off=${String(offMs[offMs.length - 1]).padStart(5)}ms on=${String(onMs[onMs.length - 1]).padStart(5)}ms  corpus results ${sameRoute ? (sameIds ? 'IDENTICAL ✓' : 'DIFFER ✗') : 'unattributable (route re-rolled differently)'}  stats=${on.statistics ? `${on.statistics.results.length} series` : 'not selected'}`)
  }
  const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / (xs.length || 1))
  console.log(`\n  mean latency  off=${mean(offMs)}ms  on=${mean(onMs)}ms  delta=${mean(onMs) - mean(offMs)}ms`)
  console.log(`  corpus results identical on ${identical}/${sample.length} comparable pairs`)
  console.log('  ⚠ The catalogue runs CONCURRENTLY with corpus retrieval and touches a different database,')
  console.log('    so its cost hides inside the slowest corpus stream rather than adding to it. A delta')
  console.log('    near zero is the expected result and is not evidence the stream did nothing — the')
  console.log('    `stats=` column above is what shows it ran.')
}

main().catch((e) => { console.error(e); process.exit(1) })
