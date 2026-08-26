/**
 * measure-s14-merge.ts — SEARCH S14 §2/§3/§5. EVERY ARM, ONE SESSION, ONE INDEX, ONE RETRIEVAL.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * ⚠⚠ THE ARMS SHARE ONE RETRIEVAL PASS, AND THAT IS THE DESIGN RATHER THAN A SHORTCUT.
 *
 * Every arm here differs ONLY in how the streams' rankings are merged. Retrieval is dispatched
 * once per question, through the production `streams()` objects, and every arm is computed from
 * the identical per-stream lists. Re-retrieving per arm would introduce three sources of
 * difference that have nothing to do with the merge — service warm-up, ANN non-determinism, and a
 * timed-out leg quietly emptying a stream — and any of them would be reported as a merge effect.
 * (S13 had to run its A/B against cached routes for the same reason, one layer up.)
 *
 * ⚠ THE PRICE OF THAT DESIGN IS THAT THIS IS NOT `runRoutedSearch` END TO END, so the harness
 * PROVES its own arm A against the real thing: on a sample of questions it calls `runRoutedSearch`
 * and requires the recomputed round-robin to match id-for-id. A harness that measured a copy of
 * the pipeline would be auditing its copy (stream-scopes.ts records what a copy costs).
 *
 * ── ROUTES ARE ROLLED ONCE AND CACHED. Routing is an LLM decision; two runs of one question can
 * route differently, so arms that re-routed would be comparing different searches. Cached to
 * `scripts/gold/s14-routes.json` under GLOBALLY-UNIQUE ids (`S10-Q1`, `V2-Q1` — the two sets both
 * number from 1, so a bare number silently dispatches one question's routing for another).
 *
 * ⚠ TWO ROUTES ARE ROLLED PER QUESTION, DELIBERATELY: one with `LEX_ROUTER_CONFIDENCE` off and one
 * with it on. Retrieval for EVERY arm uses the OFF route, so no arm can differ by which streams
 * were searched. The ON route is used for its confidences only — and the two are compared, because
 * "adding a question to a choice can change the choice" is a claim this sprint should not have to
 * make on trust.
 *
 * ── ⚠ n IS 64, NOT 65. V2-Q15 is excluded (BRIEF_SEARCH_S14 §5, D-3 approved): its answer key
 * points at a section whose stored body is 66 characters of dot leaders, so it can never score and
 * including it counts a corpus gap as a ranking failure.
 *
 * ── ⚠ CUT-OFF, STATED. Ranks are searched over the WHOLE merged population; 20 is used only to
 * CLASSIFY a rank, never to bound the search for one.
 *
 * Usage:
 *   bash scripts/s14-run.sh measure --json ../docs/census/s14-arms.json
 *   flags: --reroute        roll fresh routes instead of reusing the cache
 *          --no-rerank      skip the model arms (deterministic arms only, free)
 *          --only N         SMOKE TEST over the first N questions — every figure says so
 *          --sweep          print the relevance-floor sweep
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { prisma } from '../lib/prisma'
import { routeQueryDetailed, rankWeight, rankingOf, routeOutcomeCounts, type RouteResult, type StreamConfidence } from '../lib/lex/query-expansion'
import { streams, runRoutedSearch } from '../lib/lex/query-router'
import { interleaveStreams } from '../lib/lex/interleave'
import { mergeJudged } from '../lib/lex/merge-judged'
import { coverageSignalPresent } from '../lib/lex/term-coverage'
import { rerankCandidates, RERANK_CANDIDATES, RERANK_MAX_PENCE, type RerankCandidate } from '../lib/lex/reranker'
import { lookupRepeals, annotate, isHollowRepeal } from '../lib/lex/repeal-status'
import { mapWithLimit, streamConcurrency } from '../lib/lex/stream-batch'
import { assertRetrievalConfig, resolvedConfigLine, readServiceConfig, servedDelta } from '../lib/lex/harness-preflight'
import { modelFor, envVarFor } from '../lib/lex/model-registry'
import { capabilityLine } from '../lib/env-flags'
import { SCOREABLE, type GoldQuestion } from './gold/s10-gold-set'
import { SCOREABLE_V2 } from './gold/gold-v2-set'
import type { SearchResult } from '../lib/lex/page1-config'

export {}

const TOP = 20
/** The PER-STREAM retrieval budget. §2's rule: at least 20 from every routed source, always. */
const WIDTH = 20
const DIR = path.join(__dirname, 'gold')
const ROUTES = path.join(DIR, 's14-routes.json')
const arg = (name: string) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null }
const JSON_OUT = arg('--json')
const REROUTE = process.argv.includes('--reroute')
const NO_RERANK = process.argv.includes('--no-rerank')
const SWEEP = process.argv.includes('--sweep')
const ONLY = (() => { const v = arg('--only'); return v ? parseInt(v, 10) : null })()

/**
 * ⚠⚠ THE RETRIEVAL CACHE, AND WHY IT IS SAFE HERE WHEN A CACHE USUALLY IS NOT.
 *
 * Every arm in this harness is computed from ONE retrieval pass by design — the arms differ only
 * in the merge, so re-retrieving per arm would introduce differences that have nothing to do with
 * what is being measured. `--save-retrieval` writes that single pass to disk and `--load-retrieval`
 * replays it, which extends the SAME property across runs: a re-measure of the model arms after a
 * prompt or budget change is then compared against identical inputs rather than against a fresh
 * retrieval taken hours later.
 *
 * It is worth having because retrieval is the expensive half — three hours for 64 questions at the
 * throttle §0 forces — and the reranker is the half most likely to need a second attempt.
 *
 * ⚠ THE HONESTY GUARDS, because a cached measurement that does not say it is cached is exactly the
 * "confident wrong number" this harness exists to avoid:
 *   · the cache stores the INDEX STAMP and the resolved CONFIG of the run that took it;
 *   · loading REFUSES if the index has moved, rather than silently describing a corpus that no
 *     longer exists;
 *   · the header prints the cache's own timestamp beside every figure.
 */
const SAVE_RETRIEVAL = arg('--save-retrieval')
const LOAD_RETRIEVAL = arg('--load-retrieval')

/** ⚠ D-3, approved. Its stored body is 66 characters of dot leaders — it can never score, and
 *  counting it would report a corpus gap as a ranking failure. Named here, not filtered silently. */
const EXCLUDED: Record<string, string> = {
  'V2-Q15': 'UNSCOREABLE — corpus gap: the keyed section\'s stored body is 66 characters of dot leaders (S13 §1.4, D-3)',
}

interface Q { id: string; query: string; keys: string[]; collection: string; owner: string; set: 'S10' | 'V2' }

const ALL_QUESTIONS: Q[] = [
  ...SCOREABLE.map((q: GoldQuestion): Q => ({
    id: `S10-Q${q.n}`, query: q.question, keys: q.keys, collection: q.collection,
    owner: String((q as any).streamsHint ?? q.collection), set: 'S10',
  })),
  ...SCOREABLE_V2.map((q): Q => ({
    id: `V2-${q.id}`, query: q.query, keys: q.keys, collection: q.collection!,
    owner: q.streamsHint, set: 'V2',
  })),
].filter((q) => !EXCLUDED[q.id])
const QUESTIONS: Q[] = ONLY ? ALL_QUESTIONS.slice(0, ONLY) : ALL_QUESTIONS

const matches = (id: string, keys: string[]) => keys.some((k) => id === k || id.startsWith(k))
const pct = (a: number, b: number) => (b === 0 ? '—' : `${((a / b) * 100).toFixed(0)}%`)

/** The index version this run describes. ⚠ SPAWNED, not imported — `index-state.ts` pulls in
 *  `@lancedb/lancedb`, which lives in the INGEST package's node_modules; importing it from under
 *  `scrutinise-web` is the package-boundary crossing that failed every Vercel build for two days
 *  (CLAUDE.md §20 check 0). The `index state @ <ISO>` header line is dropped because it differs on
 *  every call and comparing it reported THE INDEX MOVED on runs where nothing had. */
function indexStamp(): string[] | null {
  try {
    const cwd = path.join(__dirname, '..', '..', 'scripts', 'ingest')
    const out = execFileSync(process.execPath, [path.join(cwd, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'search/index-state.ts'],
      { cwd, encoding: 'utf8', timeout: 180_000, windowsHide: true })
    return out.trim().split(/\r?\n/).filter((l) => !/^\s*index state @/.test(l))
  } catch (e) {
    console.warn(`  ⚠ index stamp unavailable: ${(e as Error).message}`)
    return null
  }
}

// ── routes ─────────────────────────────────────────────────────────────────────────────────────
interface CachedRoute { plain: RouteResult; conf: RouteResult; confidence: StreamConfidence | null }

/**
 * ⚠⚠ TRUNCATION, COUNTED PER ARM, BECAUSE THE FIRST ENCODING OF (b) BROKE THE ROUTER.
 *
 * The numeric version of this signal — a `confidence` object of numbers — made `gemini-2.5-flash`
 * degenerate into writing an endless decimal and blow the 4,096-token ceiling on **12 of 55 calls
 * (21.8%)**, against **0 of 55** without the question. Nothing about a recall figure would have
 * shown that; the only place it appears is the route outcome. So the two arms' outcomes are
 * counted separately here, every roll, and printed — a signal that costs the ROUTER one call in
 * five is not a signal worth having whatever it does to the ordering.
 */
const routeCost = { plain: { full: 0, partial: 0, failed: 0 }, conf: { full: 0, partial: 0, failed: 0 }, rolled: false }
function delta(before: ReturnType<typeof routeOutcomeCounts>, into: { full: number; partial: number; failed: number }) {
  const now = routeOutcomeCounts()
  into.full += now.full - before.full
  into.partial += now.partial - before.partial
  into.failed += now.failed - before.failed
}

async function buildRoutes(): Promise<Record<string, CachedRoute>> {
  const cached: Record<string, CachedRoute> =
    !REROUTE && fs.existsSync(ROUTES) ? JSON.parse(fs.readFileSync(ROUTES, 'utf8')) : {}
  const missing = QUESTIONS.filter((q) => !cached[q.id])
  if (!missing.length) {
    console.log(`  routes: reusing all ${Object.keys(cached).length} cached decisions (${path.relative(process.cwd(), ROUTES)})`)
    return cached
  }
  console.log(`  routes: rolling ${missing.length} (cache had ${Object.keys(cached).length})`)
  routeCost.rolled = true
  const saved = process.env.LEX_ROUTER_CONFIDENCE
  for (const q of missing) {
    const kw = q.query.split(/\s+/)
    const c0 = routeOutcomeCounts()
    // ⚠ ROLLED WITH THE FLAG OFF FIRST. This is the route every arm RETRIEVES with, so no arm can
    // differ by which streams were searched.
    delete process.env.LEX_ROUTER_CONFIDENCE
    const plain = await routeQueryDetailed(kw, '')
    delta(c0, routeCost.plain)
    const c1 = routeOutcomeCounts()
    process.env.LEX_ROUTER_CONFIDENCE = 'true'
    const conf = await routeQueryDetailed(kw, '')
    delta(c1, routeCost.conf)
    if (saved === undefined) delete process.env.LEX_ROUTER_CONFIDENCE; else process.env.LEX_ROUTER_CONFIDENCE = saved
    // ⚠ A NULL ROUTE IS THE ROUTER FAILING, AND IT IS LEFT ABSENT RATHER THAN CACHED AS `{}` —
    // a dead router recorded as "chose no streams" is CLAUDE.md §18's corollary exactly.
    if (!plain?.route || !Object.keys(plain.route).length) {
      console.warn(`  ⚠ ${q.id}: routeQuery returned nothing — NOT cached, will report ROUTER-FAILED`)
      continue
    }
    cached[q.id] = { plain: plain.route, conf: conf?.route ?? {}, confidence: conf?.confidence ?? null }
  }
  fs.mkdirSync(DIR, { recursive: true })
  fs.writeFileSync(ROUTES, JSON.stringify(cached, null, 2))
  console.log(`  routes: cached ${Object.keys(cached).length} to ${path.relative(process.cwd(), ROUTES)}`)
  return cached
}

// ── the arms ───────────────────────────────────────────────────────────────────────────────────
interface Arm {
  key: string
  label: string
  /** Merge the per-stream lists into one. `priority` supplied by a model arm. */
  merge: (perStream: SearchResult[][], ctx: ArmContext) => SearchResult[]
  /** Model arms declare it so the run can price and count them apart. */
  model?: string
}
interface ArmContext {
  names: string[]
  unionQuery: string
  total: number
  confidence: Record<string, number> | null
  priority: Map<string, number> | null
}

const GATE = 0.34

/**
 * ⚠⚠ WHAT WEIGHT DOES A STREAM GET WHEN THE CONFIDENT ROUTER DID NOT NAME IT? This question is an
 * artefact of the harness and getting it wrong would have inverted the whole (b) arm.
 *
 * Every arm RETRIEVES with the confidence-OFF route, so that no arm can differ by which streams
 * were searched. But the confidence-ON route frequently names FEWER streams — observed repeatedly
 * on the first pass: `legislation,debates,committees,caselaw,guidance` became `caselaw,guidance`.
 * So some retrieved streams have no confidence value at all.
 *
 * `merge-judged.ts` treats an absent value as UNIFORM (1), which is right IN PRODUCTION: there,
 * only routed streams are ever dispatched, so an absent value can only mean "the model was asked
 * and did not say". Here it can also mean "the model was asked and left this stream out", which is
 * a positive judgement of irrelevance. Carrying that through as 1 would give the streams the
 * router REJECTED the HIGHEST weight in the merge — the opposite of the signal.
 *
 * So the harness substitutes the value the prompt itself describes for the bottom of the range.
 * ⚠ This is a harness decision and it is stated in the report, not buried: it makes arm B a proxy
 * for "confidence on, retrieval held fixed", and the routing half of (b) is reported separately.
 */
const UNSELECTED_POSITION = 5

/** The weights arm B actually applies, with the rule above made explicit per stream. Uses the
 *  library's own `rankWeight`, so the harness and production cannot disagree about the scale. */
function confidenceWeights(names: string[], r: CachedRoute | undefined): Record<string, number> | null {
  if (!r?.confidence) return null
  const out: Record<string, number> = {}
  for (const n of names) {
    const v = (r.confidence as Record<string, number>)[n]
    out[n] = typeof v === 'number' ? v : rankWeight(UNSELECTED_POSITION)
  }
  return out
}

const ARMS: Arm[] = [
  {
    key: 'A-round-robin',
    label: 'A · round-robin (today, the baseline)',
    merge: (per, c) => interleaveStreams(per, c.total, { names: c.names, label: 'measure-s14 armA' }),
  },
  {
    key: 'B-confidence',
    label: 'B · judged, ROUTER CONFIDENCE only (§1 b)',
    merge: (per, c) => mergeJudged(per, { streamNames: c.names, query: c.unionQuery, budget: c.total, confidence: c.confidence }).results,
  },
  {
    key: 'B-gate',
    label: `B · judged, ABSOLUTE RELEVANCE FLOOR only (§1 d, gate=${GATE})`,
    merge: (per, c) => mergeJudged(per, { streamNames: c.names, query: c.unionQuery, budget: c.total, relevanceFloor: GATE }).results,
  },
  {
    key: 'B-both',
    label: `B · judged, CONFIDENCE + FLOOR (§1 b+d, gate=${GATE})`,
    merge: (per, c) => mergeJudged(per, { streamNames: c.names, query: c.unionQuery, budget: c.total, confidence: c.confidence, relevanceFloor: GATE }).results,
  },
]

/** The model arms. Two models, because "report which model ran, and its cost" is only meaningful
 *  next to what a cheaper one would have done. */
const RERANK_ARMS = [
  { key: 'C-rerank-pro', label: `C · judged + RERANKER (${modelFor('search.reranker')})`, model: modelFor('search.reranker') },
  { key: 'C-rerank-flash', label: 'C · judged + RERANKER (gemini-2.5-flash — the cheap comparison)', model: 'gemini-2.5-flash' },
]

interface ArmRow { rank: number; verdict: string; windowStreams: Record<string, number> }
interface Row {
  q: Q
  routed: string[]
  ownerRouted: boolean
  foundInStream: string | null
  inStream: number
  total: number
  arms: Record<string, ArmRow>
}

async function main() {
  console.log('═'.repeat(124))
  console.log('SEARCH S14 §2/§3/§5 — EVERY MERGE ARM, ONE RETRIEVAL PASS, ONE INDEX.')
  console.log('═'.repeat(124))
  // ⚠⚠ `--allow-degraded` IS THE DESIGNED ESCAPE HATCH AND IT IS NOT A CONVENIENCE. It exists for a
  // harness that DELIBERATELY measures one leg (harness-preflight.ts's own words), which is exactly
  // the keyword-only arm this sprint has to take while `vector-serve` is saturated (§0). The
  // assertion is waived; the DISCLOSURE never is — the full degradation list still prints, and the
  // banner below repeats it beside the headline so no figure can be read without it.
  const ALLOW_DEGRADED = process.argv.includes('--allow-degraded')
  const flagState = assertRetrievalConfig('measure-s14-merge', { allowDegraded: ALLOW_DEGRADED })
  if (flagState.degraded.length) {
    console.log('  ' + '⚠'.repeat(3) + ` THIS RUN IS DEGRADED IN ${flagState.degraded.length} WAY(S). Every absolute figure below describes`)
    console.log('      that state and NOT a fully-configured stack. The ARM COMPARISON is still valid — all arms')
    console.log('      share one retrieval pass — but the recall percentages are not comparable with a dense run.')
  }
  console.log(`  ${capabilityLine()}`)
  console.log(`  ${resolvedConfigLine()}`)
  console.log(`  per-stream width    ${WIDTH}  (§2: at least 20 from every routed source, always)`)
  console.log(`  stream concurrency  ${streamConcurrency()}`)
  console.log(`  questions           ${QUESTIONS.length} of ${ALL_QUESTIONS.length}` +
    `${ONLY ? `  ⚠⚠ --only ${ONLY}: THIS IS A SMOKE TEST, every figure below is over the subset` : '  (the full validated set, n = 64)'}`)
  for (const [id, why] of Object.entries(EXCLUDED)) console.log(`  ⚠ EXCLUDED ${id} — ${why}`)
  console.log(`  ⚠ ranks are searched over the WHOLE merged population; ${TOP} is used only to classify one.`)
  const before = indexStamp()
  before?.forEach((l) => console.log(`  ${l}`))
  const svcBefore = await readServiceConfig()
  console.log()

  const routes = await buildRoutes()

  // ── §1(b) — DID ASKING FOR CONFIDENCE CHANGE THE STREAM SELECTION? ─────────────────────────
  // ⚠ Measured rather than asserted. Adding a question to a choice can change the choice even when
  // the options' descriptions are byte-identical, which is precisely what the appended-prompt
  // discipline can NOT protect against.
  let sameSelection = 0, differing = 0, narrowed = 0, widened = 0
  let streamsOff = 0, streamsOn = 0
  const selectionDiffs: string[] = []
  for (const q of QUESTIONS) {
    const r = routes[q.id]
    if (!r) continue
    const aKeys = Object.keys(r.plain).sort()
    const bKeys = Object.keys(r.conf).sort()
    streamsOff += aKeys.length; streamsOn += bKeys.length
    if (aKeys.join(',') === bKeys.join(',')) sameSelection++
    else {
      differing++
      if (bKeys.length < aKeys.length) narrowed++; else if (bKeys.length > aKeys.length) widened++
      if (selectionDiffs.length < 10) selectionDiffs.push(`${q.id}: [${aKeys.join(',')}] → [${bKeys.join(',')}]`)
    }
  }
  // How much of each question's routed set the ranking actually covered. The numeric encoding
  // failed mostly here — a value for one stream of four — so this is measured, not assumed.
  let rankedStreams = 0, routedStreamsWithRanking = 0, withRanking = 0
  for (const q of QUESTIONS) {
    const r = routes[q.id]
    if (!r?.confidence) continue
    withRanking++
    const distinct = new Set(Object.values(r.confidence as Record<string, number>))
    rankedStreams += distinct.size
    routedStreamsWithRanking += Object.keys(r.conf).length
  }
  console.log('─'.repeat(124))
  console.log('  §1(b) — THE CONFIDENCE SIGNAL, BEFORE ANY MERGE USES IT')
  console.log(`    stream selection unchanged by asking for confidence: ${sameSelection}/${sameSelection + differing}` +
    `   (${narrowed} narrowed, ${widened} widened)`)
  console.log(`    mean streams routed: ${(streamsOff / Math.max(1, sameSelection + differing)).toFixed(2)} without the question → ` +
    `${(streamsOn / Math.max(1, sameSelection + differing)).toFixed(2)} with it`)
  // ⚠⚠ THIS IS A ROUTING CHANGE, NOT A MERGE CHANGE, AND IT IS THE MOST CONSEQUENTIAL THING (b)
  // DOES. If asking for confidence makes the router prune streams, then turning (b) on in
  // production alters what is RETRIEVED before any merge runs — and a stream that is not retrieved
  // cannot be recovered by any ordering. Every arm below deliberately retrieves with the
  // confidence-OFF route so the merge can be measured on its own; this line is the other half.
  selectionDiffs.forEach((d) => console.log(`      · ${d}`))
  console.log(`    questions returning a usable streamRanking: ${withRanking}/${QUESTIONS.length}`)
  // ⚠ A RANKING THAT COVERS ONE STREAM OF FOUR IS THREE QUARTERS OF A UNIFORM WEIGHTING. The
  // numeric encoding failed here as much as it failed on truncation, so coverage is measured.
  const meanSpread = withRanking ? rankedStreams / withRanking : 0
  console.log(`    mean DISTINCT weights per question: ${meanSpread.toFixed(2)} of ${(routedStreamsWithRanking / Math.max(1, withRanking)).toFixed(2)} routed streams` +
    `${meanSpread < 1.5 ? '  ⚠ mostly single-stream questions — a ranking of one is a uniform weighting' : ''}`)
  console.log(`    weight scale in force: position 0..4 ⇒ ${[0, 1, 2, 3, 4].map((i) => rankWeight(i).toFixed(2)).join(' · ')}` +
    `  (LEX_ROUTER_CONFIDENCE_DECAY=${process.env.LEX_ROUTER_CONFIDENCE_DECAY ?? '0.35 default'})`)
  // ⚠⚠ WHAT THE QUESTION COSTS THE ROUTER, WHICH NO RECALL FIGURE WOULD EVER SHOW.
  if (routeCost.rolled) {
    const pc = (o: { full: number; partial: number; failed: number }) => o.full + o.partial + o.failed
    console.log(`    router outcomes WITHOUT the ranking question: full ${routeCost.plain.full} · partial(truncated) ${routeCost.plain.partial} · failed ${routeCost.plain.failed}  of ${pc(routeCost.plain)}`)
    console.log(`    router outcomes WITH    the ranking question: full ${routeCost.conf.full} · partial(truncated) ${routeCost.conf.partial} · failed ${routeCost.conf.failed}  of ${pc(routeCost.conf)}` +
      `${routeCost.conf.partial > routeCost.plain.partial ? '   ⚠ the question is DESTABILISING GENERATION — see the report' : ''}`)
  } else {
    console.log('    router outcomes per arm: NOT RE-MEASURED this run (routes came from the cache). Re-roll with --reroute to take it.')
  }

  // ── retrieve ONCE per question ─────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(124))
  console.log('  RETRIEVAL — one pass per question, through the production stream objects.')
  interface Retrieved { q: Q; names: string[]; per: SearchResult[][]; unionQuery: string; confidence: Record<string, number> | null }
  const retrieved: Retrieved[] = []
  const routerFailed: string[] = []
  let signalMissing = 0
  let retrievalTakenAt: string | null = null

  if (LOAD_RETRIEVAL) {
    const cache = JSON.parse(fs.readFileSync(LOAD_RETRIEVAL, 'utf8'))
    retrievalTakenAt = cache.takenAt
    // ⚠⚠ REFUSE IF THE INDEX HAS MOVED. A replayed retrieval describes the corpus as it was; if the
    // corpus has changed since, every figure below would describe a state that no longer exists
    // while looking exactly like a fresh measurement.
    if (JSON.stringify(cache.indexStamp) !== JSON.stringify(before)) {
      throw new Error('[measure-s14-merge] REFUSING to replay a cached retrieval taken against a DIFFERENT index.\n' +
        `  cached: ${JSON.stringify(cache.indexStamp)}\n  now:    ${JSON.stringify(before)}\n` +
        '  Re-take the retrieval instead — a replay against a moved corpus describes neither state.')
    }
    const byId = new Map<string, Q>(QUESTIONS.map((q) => [q.id, q]))
    for (const row of cache.rows as Array<{ id: string; names: string[]; unionQuery: string; per: SearchResult[][] }>) {
      const q = byId.get(row.id)
      if (!q) continue
      if (!coverageSignalPresent(row.per)) signalMissing++
      retrieved.push({ q, names: row.names, per: row.per, unionQuery: row.unionQuery, confidence: confidenceWeights(row.names, routes[row.id]) })
    }
    console.log(`  ⚠⚠ RETRIEVAL WAS NOT TAKEN THIS RUN. Replayed from ${LOAD_RETRIEVAL}, captured ${retrievalTakenAt}.`)
    console.log(`     ${retrieved.length} question(s) restored. The index stamp matches, so the corpus these describe is the corpus now.`)
    console.log(`     config at capture: ${cache.config}`)
  } else {
    for (const q of QUESTIONS) {
      const r = routes[q.id]
      if (!r) { routerFailed.push(q.id); continue }
      const active = streams().filter((s) => r.plain[s.name])
      const { results: per } = await mapWithLimit(active, streamConcurrency(), (s) => s.search(r.plain[s.name]!, WIDTH))
      const names = active.map((s) => s.name)
      if (!coverageSignalPresent(per)) signalMissing++
      retrieved.push({ q, names, per, unionQuery: names.map((n2) => r.plain[n2 as keyof RouteResult]!).join(' '), confidence: confidenceWeights(names, r) })
      const thin = names.filter((_, i) => per[i].length < WIDTH)
      console.log(`  ${q.id.padEnd(9)} ${q.collection.padEnd(18)} ${names.map((n2, i) => `${n2}:${per[i].length}`).join(' ')}` +
        `${thin.length ? `   ⚠ under ${WIDTH}: ${thin.join(',')}` : ''}`)
    }
    if (routerFailed.length) console.log(`  ⚠ ROUTER-FAILED and therefore not measured: ${routerFailed.join(', ')}`)
    if (SAVE_RETRIEVAL) {
      fs.mkdirSync(path.dirname(SAVE_RETRIEVAL), { recursive: true })
      fs.writeFileSync(SAVE_RETRIEVAL, JSON.stringify({
        takenAt: new Date().toISOString(), indexStamp: before, config: resolvedConfigLine(), width: WIDTH,
        rows: retrieved.map((r) => ({ id: r.q.id, names: r.names, unionQuery: r.unionQuery, per: r.per })),
      }))
      console.log(`  retrieval saved to ${SAVE_RETRIEVAL} — replay it with --load-retrieval to re-measure the model arms against IDENTICAL inputs.`)
    }
  }
  console.log(`  ⚠ questions whose retrieval carried NO \`snippetMatched\` signal (the gate cannot run on these): ${signalMissing}`)

  // ── the ARM A CONTROL: the recomputation must equal the real pipeline, id for id ───────────
  // ⚠⚠ TWO DIFFERENT THINGS ARE CHECKED HERE AND THE FIRST VERSION OF THIS BLOCK CONFLATED THEM,
  // which would have put a false finding in the report. Comparing this harness's arm A against a
  // FRESH `runRoutedSearch` call measures the merge AND a second, independent retrieval at the
  // same time — and retrieval is not reproducible run to run (a dense leg that times out empties
  // a stream). On the first smoke run that read as "THE RECOMPUTATION IS NOT THE PIPELINE" when
  // what had actually moved was retrieval.
  //
  //   CONTROL 1 — EXACT, and about the merge alone: take the live call's OWN per-stream lists,
  //               apply this harness's arm A to them, and require the result to equal the live
  //               call's `results` id for id. No second retrieval is involved, so a mismatch can
  //               only mean the harness is merging differently from the pipeline.
  //   CONTROL 2 — retrieval reproducibility, reported as a NUMBER rather than as a verdict. It is
  //               the run-to-run variance every figure in this report sits on top of, and S13
  //               measured the same thing at ±3 results of 81.
  console.log('\n  CONTROL 1 — this harness\'s arm A vs `runRoutedSearch`\'s own merge, on the LIVE call\'s own lists:')
  let controlOk = 0, controlBad = 0
  const reproducibility: number[] = []
  // ⚠ CONTROL 2 IS MEANINGLESS ON A REPLAY and is named as skipped rather than quietly reported as
  // a perfect 20/20 — comparing a live retrieval against a cached one measures how much the corpus
  // has moved, not whether retrieval is reproducible. CONTROL 1 still runs: it compares the
  // harness's merge against the pipeline's on the LIVE call's own lists, which needs no cache.
  for (const r of retrieved.slice(0, 3)) {
    const route = routes[r.q.id].plain
    const live = await runRoutedSearch(route, WIDTH)
    const byId = new Map(live.results.map((x) => [x.id, x]))
    const liveLists = live.perStream.map((s) => s.ids.map((id) => byId.get(id)).filter(Boolean) as SearchResult[])
    const remerged = interleaveStreams(liveLists, live.results.length, { names: live.perStream.map((s) => s.stream) })
    const exact = JSON.stringify(remerged.map((x) => x.id)) === JSON.stringify(live.results.map((x) => x.id))
    if (exact) controlOk++; else controlBad++
    console.log(`    ${r.q.id.padEnd(9)} ${exact ? 'IDENTICAL' : '⚠ DIFFERS — this harness is not merging the way the pipeline does'}`)

    const a = new Set(live.results.slice(0, TOP).map((x) => x.id))
    const overlap = interleaveStreams(r.per, r.per.flat().length, { names: r.names })
      .slice(0, TOP).filter((x) => a.has(x.id)).length
    reproducibility.push(overlap)
  }
  if (LOAD_RETRIEVAL) {
    console.log('  CONTROL 2 — retrieval reproducibility: ⚠ SKIPPED, this run replayed a cached retrieval.')
    console.log(`    (Comparing a live pass against a cached one measures how far the corpus has moved, not reproducibility.`)
    console.log(`     For the record the numbers computed were ${reproducibility.join(', ')} of ${TOP} — DO NOT read them as reproducibility.)`)
  } else {
    console.log(`  CONTROL 2 — retrieval reproducibility (a SECOND, independent retrieval of the same query):`)
    console.log(`    top-${TOP} overlap between two passes: ${reproducibility.join(', ')} of ${TOP}` +
      `${reproducibility.some((x) => x < TOP - 2) ? '   ⚠ RETRIEVAL IS NOT STABLE RUN TO RUN — every arm below shares ONE pass, which is why' : ''}`)
  }

  // ── the reranker arms ──────────────────────────────────────────────────────────────────────
  const rerankPriority: Record<string, Map<string, Map<string, number>>> = {}
  const rerankStats: Record<string, { calls: number; applied: number; omitted: number; invented: number; duplicated: number; pence: number; unpriced: number; ms: number; read: number; echoedMatch: number; echoedOther: string[] }> = {}
  if (!NO_RERANK) {
    // ⚠⚠ THE VARIABLE NAME IS COMPUTED, NOT WRITTEN OUT, AND THE FIRST VERSION WROTE IT OUT.
    // `envVarFor('search.reranker')` is `LEX_MODEL__SEARCH_RERANKER` — ONE underscore between
    // SEARCH and RERANKER, because only the DOT is replaced. The hand-written
    // `LEX_MODEL__SEARCH__RERANKER` set nothing, `resolveModel` fell back to the registry default,
    // and **both "model" arms ran gemini-2.5-pro.** The two arms then differed only by the model's
    // own non-determinism, and the run reported a model comparison it had not taken — with the
    // giveaway sitting in plain sight in the output (identical cost, 3.622p vs 3.719p, and
    // identical latency, 29.1s vs 30.4s, for models priced four times apart).
    const MODEL_ENV = envVarFor('search.reranker')
    const savedModel = process.env[MODEL_ENV]
    for (const armDef of RERANK_ARMS) {
      console.log('\n' + '─'.repeat(124))
      console.log(`  §3 — RERANKING with ${armDef.model} · cap ${RERANK_CANDIDATES()} candidates · ceiling ${RERANK_MAX_PENCE()}p/query`)
      console.log(`       (requested via ${MODEL_ENV}=${armDef.model}; the ECHOED model is counted below — a 200 is not proof of the model)`)
      process.env[MODEL_ENV] = armDef.model
      const byQuestion = new Map<string, Map<string, number>>()
      const st = { calls: 0, applied: 0, omitted: 0, invented: 0, duplicated: 0, pence: 0, unpriced: 0, ms: 0, read: 0, echoedMatch: 0, echoedOther: [] as string[] }
      // ⚠ THE MODEL IS THE BOTTLENECK HERE, NOT THE SEARCH SERVICES — this arm touches neither.
      // `gemini-2.5-pro` averaged 29 s per query on the first run, so a serial pass over 64
      // questions is half an hour and two arms is an hour. Eight at a time against a vendor API is
      // a different proposition from four at a time against a 4-wide ANN service (§0); nothing
      // here queues behind `vector-serve`.
      const RERANK_CONCURRENCY = 8
      const { results: outs } = await mapWithLimit(retrieved, RERANK_CONCURRENCY, async (r) => {
        const pool: RerankCandidate[][] = r.per.map((s, i) => s.map((x) => ({
          id: x.id, stream: r.names[i], title: x.title, citation: x.citation, snippet: x.snippet, snippetMatched: x.snippetMatched,
        })))
        return { id: r.q.id, out: await rerankCandidates(r.q.query, pool, { label: r.q.id }) }
      })
      for (const { id, out } of outs) {
        st.calls++
        if (out.applied) { st.applied++; byQuestion.set(id, out.priority) }
        st.omitted += out.omitted; st.invented += out.invented; st.duplicated += out.duplicated
        st.read += out.read; st.ms += out.ms
        if (out.pence == null) st.unpriced++; else st.pence += out.pence
        // ⚠⚠ COMPARE WHAT ANSWERED WITH WHAT WAS ASKED FOR, on every call. `grok-3-fast-beta`
        // returned HTTP 200 for months while the body echoed `grok-4.3`, on every Lex turn that
        // path served, with nothing logged (docs/CLAUDE.md, model-registry.ts). The echoed id is
        // already carried on `LlmUsage` for exactly this; not reading it is how a run reports a
        // model comparison it did not take.
        const echoed = out.usage?.echoedModel
        if (echoed == null) { /* the vendor did not say; not a mismatch */ }
        else if (echoed === armDef.model) st.echoedMatch++
        else if (!st.echoedOther.includes(echoed)) st.echoedOther.push(echoed)
        if (!out.applied) console.log(`    ⚠ ${id} NOT APPLIED (${out.reason}) — ${out.detail ?? ''}`)
      }
      rerankPriority[armDef.key] = byQuestion
      rerankStats[armDef.key] = st
      console.log(`    applied ${st.applied}/${st.calls} · read ${st.read} candidates · omitted ${st.omitted} · invented ${st.invented} · duplicated ${st.duplicated}`)
      console.log(`    model echoed back: ${st.echoedMatch}/${st.calls} matched "${armDef.model}"` +
        `${st.echoedOther.length ? `   ⚠⚠ A DIFFERENT MODEL ANSWERED: ${st.echoedOther.join(', ')} — this arm is NOT what it says it is` : ''}`)
      console.log(`    cost ${st.pence.toFixed(2)}p total = ${(st.pence / Math.max(1, st.calls)).toFixed(3)}p per query (ceiling ${RERANK_MAX_PENCE()}p)` +
        `${st.unpriced ? `  ⚠ ${st.unpriced} call(s) UNPRICED` : ''}`)
      console.log(`    mean latency ${(st.ms / Math.max(1, st.calls) / 1000).toFixed(1)}s per query`)
    }
    if (savedModel === undefined) delete process.env[MODEL_ENV]
    else process.env[MODEL_ENV] = savedModel
  }

  const allArms: Arm[] = [...ARMS]
  if (!NO_RERANK) {
    for (const a of RERANK_ARMS) {
      allArms.push({
        key: a.key, label: a.label, model: a.model,
        merge: (per, c) => mergeJudged(per, { streamNames: c.names, query: c.unionQuery, budget: c.total, priority: c.priority }).results,
      })
    }
  }

  // ── score every arm off the SAME retrieval ─────────────────────────────────────────────────
  const rows: Row[] = []
  for (const r of retrieved) {
    const total = r.per.flat().length
    const ids = r.per.flat().map((x) => x.id)
    const { statuses, ok: repealOk } = await lookupRepeals(ids)

    let inStream = -1
    let foundInStream: string | null = null
    r.per.forEach((s, i) => {
      const k = s.findIndex((x) => matches(x.id, r.q.keys))
      if (k >= 0 && (inStream < 0 || k < inStream)) { inStream = k; foundInStream = r.names[i] }
    })
    const streamOf = new Map<string, string>()
    r.per.forEach((s, i) => s.forEach((x) => { if (!streamOf.has(x.id)) streamOf.set(x.id, r.names[i]) }))

    const arms: Record<string, ArmRow> = {}
    for (const arm of allArms) {
      const merged = arm.merge(r.per, {
        names: r.names, unionQuery: r.unionQuery, total,
        confidence: r.confidence,
        priority: rerankPriority[arm.key]?.get(r.q.id) ?? null,
      })
      // The gateway's post-merge step, from the gateway's own modules — so a rank here is the rank
      // a caller would see and not the rank before hollow-repeal suppression.
      const shown = annotate(merged, statuses, repealOk).filter((x) => !isHollowRepeal(x.repeal))
      const rank = shown.findIndex((x) => matches(x.id, r.q.keys))
      const windowStreams: Record<string, number> = {}
      for (const x of shown.slice(0, TOP)) {
        const nm = streamOf.get(x.id) ?? '?'
        windowStreams[nm] = (windowStreams[nm] ?? 0) + 1
      }
      arms[arm.key] = {
        rank,
        verdict: rank >= 0 && rank < 5 ? 'HIT@5' : rank >= 0 && rank < TOP ? 'HIT@20' : inStream >= 0 ? 'DILUTED' : 'NOT-RETRIEVED',
        windowStreams,
      }
    }
    const ownerRouted = r.names.some((s) => r.q.owner.includes(s))
    for (const a of Object.values(arms)) if (a.verdict === 'NOT-RETRIEVED' && !ownerRouted) a.verdict = 'NOT-ROUTED'
    rows.push({ q: r.q, routed: r.names, ownerRouted, foundInStream, inStream, total, arms })
  }

  // ── the report ─────────────────────────────────────────────────────────────────────────────
  const armKeys = allArms.map((a) => a.key)
  const hit = (k: string, at: number, subset = rows) => subset.filter((x) => x.arms[k].rank >= 0 && x.arms[k].rank < at).length

  console.log('\n' + '═'.repeat(124))
  console.log(`  §5 — RECALL@${TOP} PER ARM. n stated on every figure.` +
    `${ONLY ? '  ⚠⚠ SMOKE TEST SUBSET' : ''}`)
  console.log('═'.repeat(124))
  const collections = [...new Set(rows.map((x) => x.q.collection))].sort()
  const header = `  ${'collection'.padEnd(20)} ${'n'.padEnd(4)} ${'in-stream@20'.padEnd(14)} ` + armKeys.map((k) => k.padEnd(16)).join('')
  console.log(header)
  const perCollection: any[] = []
  for (const c of collections) {
    const qs = rows.filter((x) => x.q.collection === c)
    const i20 = qs.filter((x) => x.inStream >= 0 && x.inStream < TOP).length
    const cells = armKeys.map((k) => `${hit(k, TOP, qs)}/${qs.length} ${pct(hit(k, TOP, qs), qs.length)}`.padEnd(16)).join('')
    console.log(`  ${c.padEnd(20)} ${String(qs.length).padEnd(4)} ${`${i20}/${qs.length} ${pct(i20, qs.length)}`.padEnd(14)} ${cells}`)
    perCollection.push({ collection: c, n: qs.length, inStream20: i20, ...Object.fromEntries(armKeys.map((k) => [k, hit(k, TOP, qs)])) })
  }
  const n = rows.length
  const I20 = rows.filter((x) => x.inStream >= 0 && x.inStream < TOP).length
  console.log('  ' + '─'.repeat(122))
  console.log(`  ${'ALL'.padEnd(20)} ${String(n).padEnd(4)} ${`${I20}/${n} ${pct(I20, n)}`.padEnd(14)} ` +
    armKeys.map((k) => `${hit(k, TOP)}/${n} ${pct(hit(k, TOP), n)}`.padEnd(16)).join(''))
  console.log(`  ${'@5'.padEnd(20)} ${''.padEnd(4)} ${''.padEnd(14)} ` +
    armKeys.map((k) => `${hit(k, 5)}/${n} ${pct(hit(k, 5), n)}`.padEnd(16)).join(''))

  // ── who gained, who lost, against arm A ────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(124))
  console.log('  ⚠ THE NET HIDES THE SHAPE. Per arm, against arm A: questions GAINED, questions LOST, and ranks MOVED.')
  const base = 'A-round-robin'
  const churn: any[] = []
  for (const k of armKeys.filter((x) => x !== base)) {
    const gained = rows.filter((x) => x.arms[base].rank >= TOP || x.arms[base].rank < 0).filter((x) => x.arms[k].rank >= 0 && x.arms[k].rank < TOP)
    const lost = rows.filter((x) => x.arms[base].rank >= 0 && x.arms[base].rank < TOP).filter((x) => x.arms[k].rank < 0 || x.arms[k].rank >= TOP)
    const found = rows.filter((x) => x.arms[base].rank >= 0 && x.arms[k].rank >= 0)
    const moved = found.filter((x) => x.arms[base].rank !== x.arms[k].rank).length
    console.log(`  ${k.padEnd(18)} gained ${String(gained.length).padStart(2)}  lost ${String(lost.length).padStart(2)}  ` +
      `net ${(gained.length - lost.length >= 0 ? '+' : '') + (gained.length - lost.length)}   ranks moved ${moved}/${found.length}`)
    if (gained.length) console.log(`      gained: ${gained.map((x) => `${x.q.id}(in-stream ${x.inStream}, ${x.arms[base].rank < 0 ? 'absent' : x.arms[base].rank}→${x.arms[k].rank})`).join(' · ')}`)
    if (lost.length) console.log(`      ⚠ LOST: ${lost.map((x) => `${x.q.id}(in-stream ${x.inStream}, ${x.arms[base].rank}→${x.arms[k].rank < 0 ? 'absent' : x.arms[k].rank})`).join(' · ')}`)
    churn.push({ arm: k, gained: gained.map((x) => x.q.id), lost: lost.map((x) => x.q.id), moved, ofFound: found.length })
  }

  // ── the window share: can one source hold the window? ──────────────────────────────────────
  console.log('\n' + '─'.repeat(124))
  console.log('  §2 ACCEPTANCE — HOW CONCENTRATED IS THE WINDOW? The round-robin\'s share is floor(20/S) by construction.')
  // ⚠⚠ MEASURED OVER MULTI-STREAM QUESTIONS ONLY, AND THE FIRST VERSION OF THIS TABLE WAS NOT.
  // A question that routes ONE stream has a max share of 20 in every arm — there is no merge at
  // all — so including those inflated the round-robin's own concentration to 14.3 of 20 and made
  // the arms look barely different. 18 of the 64 questions route a single stream (S13 §1.3's
  // fan-out tally), and no merge change of any kind can reach them.
  const multi = rows.filter((x) => x.routed.length >= 3)
  console.log(`  restricted to the ${multi.length} of ${n} questions routing 3+ streams — a 1-stream question has no merge, and its max share is 20 in every arm.`)
  console.log(`  ${'arm'.padEnd(18)} ${'mean max share of 20'.padEnd(22)} ${'questions where ONE source took >8 of 20'.padEnd(42)} max observed`)
  const shareRows: any[] = []
  for (const k of armKeys) {
    const maxes = multi.map((x) => Math.max(0, ...Object.values(x.arms[k].windowStreams)))
    const mean = maxes.length ? maxes.reduce((a, b) => a + b, 0) / maxes.length : 0
    const dominant = maxes.filter((m) => m > 8).length
    console.log(`  ${k.padEnd(18)} ${mean.toFixed(1).padEnd(22)} ${`${dominant}/${multi.length}`.padEnd(42)} ${maxes.length ? Math.max(...maxes) : '—'}`)
    shareRows.push({ arm: k, n: multi.length, meanMaxShare: Math.round(mean * 10) / 10, dominant, max: maxes.length ? Math.max(...maxes) : null })
  }

  // ── the sweep, SHAPE ONLY ──────────────────────────────────────────────────────────────────
  const sweep: any[] = []
  if (SWEEP) {
    console.log('\n' + '─'.repeat(124))
    console.log('  §6 — THE RELEVANCE-FLOOR SWEEP. ⚠ THE SHAPE IS THE OUTPUT, NOT THE WINNING POINT.')
    console.log('       A value picked off this curve is a value fitted to 64 questions; S14 declines to adopt one.')
    for (const g of [0, 0.1, 0.2, 0.25, 0.34, 0.4, 0.5, 0.6, 0.75]) {
      let h = 0
      for (const r of retrieved) {
        const total = r.per.flat().length
        const merged = mergeJudged(r.per, { streamNames: r.names, query: r.unionQuery, budget: total, relevanceFloor: g }).results
        const k = merged.findIndex((x) => matches(x.id, r.q.keys))
        if (k >= 0 && k < TOP) h++
      }
      console.log(`    gate ${String(g).padEnd(6)} ${String(h).padStart(2)}/${n}  ${pct(h, n)}  ${'█'.repeat(h)}`)
      sweep.push({ gate: g, hits: h, n })
    }
    console.log('    ⚠ These figures skip the hollow-repeal suppression the arms above apply, so they are')
    console.log('      comparable WITH EACH OTHER and not with the arm table. Stated rather than left to be found.')
  }

  const after = indexStamp()
  const stamped = !!before && !!after
  const moved = stamped && JSON.stringify(before) !== JSON.stringify(after)
  const svcAfter = await readServiceConfig()
  console.log('\n  service engagement: ' + servedDelta(svcBefore, svcAfter))
  if (!stamped) console.log('  ⚠⚠ NO INDEX STAMP — this run does not say which index it describes.')
  else if (moved) { console.log('  ⚠⚠ THE INDEX CHANGED DURING THIS RUN — these figures describe neither state. Re-take it.'); after!.forEach((l) => console.log(`    ${l}`)) }
  else console.log('  ✅ index stamps match either side of the run — the corpus did not move.')
  console.log(`  control 1: this harness's arm A merged IDENTICALLY to the pipeline on ${controlOk}/${controlOk + controlBad} sampled questions.`)
  const tally = [...rows.reduce((m, r) => m.set(r.routed.length, (m.get(r.routed.length) ?? 0) + 1), new Map<number, number>())].sort((a, b) => a[0] - b[0])
  console.log(`  fan-out tally: ${tally.map(([k, v]) => `${k} stream(s)×${v}q`).join('  ')}`)
  console.log(`  ⚠ ${tally.filter(([k]) => k === 1).reduce((a, [, v]) => a + v, 0)} question(s) route ONE stream — there is no merge at all on those, so NO merge change can reach them.`)

  if (JSON_OUT) {
    fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true })
    fs.writeFileSync(JSON_OUT, JSON.stringify({
      takenAt: new Date().toISOString(), config: resolvedConfigLine(), capabilities: capabilityLine(),
      indexStampBefore: before, indexStampAfter: after, indexMoved: moved,
      n, width: WIDTH, top: TOP, excluded: EXCLUDED, smokeTest: ONLY ?? null,
      degraded: flagState.degraded,
      // ⚠ NON-NULL means retrieval was REPLAYED, not taken. Recorded so a reader of the JSON meets
      // the same disclosure the console printed.
      retrievalReplayedFrom: LOAD_RETRIEVAL ? { path: LOAD_RETRIEVAL, takenAt: retrievalTakenAt } : null,
      routerConfidence: {
        sameSelection, differing, narrowed, widened,
        meanStreamsOff: streamsOff / Math.max(1, sameSelection + differing),
        meanStreamsOn: streamsOn / Math.max(1, sameSelection + differing),
        withRanking, meanDistinctWeights: meanSpread,
        unselectedWeight: rankWeight(UNSELECTED_POSITION),
        weightScale: [0, 1, 2, 3, 4].map((i) => rankWeight(i)),
        routeCost: routeCost.rolled ? { plain: routeCost.plain, conf: routeCost.conf } : null,
        rankings: Object.fromEntries(QUESTIONS.filter((q) => routes[q.id]?.confidence).map((q) => [q.id, rankingOf(routes[q.id].confidence)])),
        examples: selectionDiffs,
      },
      arms: allArms.map((a) => ({ key: a.key, label: a.label, model: a.model ?? null })),
      totals: Object.fromEntries(armKeys.map((k) => [k, { at20: hit(k, TOP), at5: hit(k, 5), n }])),
      perCollection, churn, shareRows, sweep, rerank: rerankStats,
      control: { mergeIdentical: controlOk, of: controlOk + controlBad, retrievalOverlapTop20: reproducibility },
      fanout: Object.fromEntries([...rows.reduce((m, r) => m.set(r.routed.length, (m.get(r.routed.length) ?? 0) + 1), new Map<number, number>())].sort((a, b) => a[0] - b[0])),
      rows: rows.map((r) => ({
        id: r.q.id, collection: r.q.collection, set: r.q.set, query: r.q.query, keys: r.q.keys,
        routed: r.routed, inStream: r.inStream, foundInStream: r.foundInStream, total: r.total,
        arms: r.arms,
      })),
    }, null, 2))
    console.log(`  wrote ${JSON_OUT}`)
  }
  await prisma.$disconnect()
  process.exit(moved || !stamped || controlBad ? 1 : 0)
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
