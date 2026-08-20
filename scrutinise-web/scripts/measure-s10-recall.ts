/**
 * measure-s10-recall.ts — BRIEF_SEARCH_S10 §1, §2 and §3, from ONE retrieval pass.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT MAKES THIS DIFFERENT FROM EVERY PRIOR RETRIEVAL MEASUREMENT IN THIS PROJECT
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * The questions are Charlie's. Since S7 every statement made about retrieval quality has rested on
 * questions the implementer wrote for itself — the "implementer writing its own exam" problem named
 * in SEARCH_STRATEGY v5 §5.2 as the binding constraint on everything. Charlie's validation pass
 * lifts it. `docs/GOLD_CANDIDATES_S8.md` carries the verdicts; `scripts/gold/s10-gold-set.ts` is
 * the transcription.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE THREE THINGS THAT MAKE THE ARMS COMPARABLE, EACH LEARNED FROM A MEASUREMENT THAT WASN'T
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * 1. ⚠ THE ROUTE IS ROLLED ONCE AND REUSED. S9's A/B was unreadable because "the router re-rolls
 *    every query per arm" — an LLM call sits between the question and the retrieval, so two arms
 *    of the same query can be routed to different streams and the difference gets attributed to
 *    whatever the arm was testing. Routes are cached to `scripts/gold/s10-routes.json` and every
 *    arm dispatches the SAME decision. `--reroute` refreshes them deliberately.
 *
 * 2. ⚠ EVERY ARM IS COMPUTED FROM ONE RETRIEVAL, AND THE RECOMPUTATION IS PROVEN RATHER THAN
 *    ASSERTED. A fusion weight does not change what is retrieved — only how the two rankings are
 *    merged. So the BM25 and dense legs are captured from the REAL production path
 *    (`query-router.ts::captureLegs`, not a reimplementation) and every weight is computed from
 *    them. The load-bearing guard is `--verify-recompute`: recomputing at the weight the live call
 *    actually used must reproduce that call's own per-stream id sequence EXACTLY. If it does not,
 *    the sweep is void and this script says so and stops. Without that check this whole file is a
 *    plausible copy of the ranking pipeline, which is the failure stream-scopes.ts is written
 *    against.
 *
 * 3. ⚠ THE SERVICES ARE PROVEN ENGAGED, POSITIVELY. `FTS_SEARCH_URL` is not in the local `.env`,
 *    and a run without it searches nothing and reports zeros that look exactly like a regression —
 *    that is precisely what happened to S9's first A/B arm, which compared 0 results against 0 and
 *    printed "identical on 10/10". `served` counters are read either side of the run and the delta
 *    printed beside every number. A zero delta is a finding, not a rounding error.
 *
 * ⚠ WHAT THIS CANNOT DO. It cannot read or set anything in Vercel — that token is SAML-blocked
 * (docs/CLAUDE.md §19). Every output is a recommendation with numbers under it. Where this script
 * names a "production" configuration it is naming S7's RECOMMENDATION, which is an inference about
 * Vercel and is labelled as one everywhere it appears.
 *
 * Usage (from scrutinise-web):
 *   FTS_SEARCH_URL=https://fts-serve-production.up.railway.app \
 *   LEX_QUERY_ROUTER=true \
 *     npx tsx --env-file=.env scripts/measure-s10-recall.ts --retrieve   # the one live pass
 *     npx tsx --env-file=.env scripts/measure-s10-recall.ts --score      # arms, offline, free
 *     npx tsx --env-file=.env scripts/measure-s10-recall.ts --latency    # §2's latency half
 */
import fs from 'node:fs'
import path from 'node:path'
import { runSearch } from '../lib/lex/search-gateway'
import { routeQuery } from '../lib/lex/query-expansion'
import { captureLegs, streams, type CapturedLegs } from '../lib/lex/query-router'
import { interleaveStreams } from '../lib/lex/interleave'
import { fuseWeightedRrf, resolvedFusionWeights, VECTOR_WEIGHT } from '../lib/lex/fusion'
import { assertRetrievalConfig, resolvedConfigLine, readServiceConfig, servedDelta } from '../lib/lex/harness-preflight'
import { capabilityLine } from '../lib/env-flags'
import type { SearchResult } from '../lib/lex/page1-config'
import { GOLD_CORPUS, SCOREABLE, collectionCounts, type GoldQuestion } from './gold/s10-gold-set'

export {}

const argv = process.argv.slice(2)
const has = (n: string) => argv.includes(`--${n}`)
const arg = (n: string) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : null }

const DIR = path.join(__dirname, 'gold')
const ROUTES = path.join(DIR, 's10-routes.json')
const LEGS = path.join(DIR, 's10-legs.json')
const LIMIT = parseInt(arg('limit') ?? '20', 10)

/** Every stream the router can name today (V2 off). The retrieval pass turns dense on for ALL of
 *  them, so that a single pass carries both arms of every per-stream vector decision. */
const ALL_STREAMS = ['legislation', 'debates', 'committees', 'caselaw', 'guidance']

// ════════════════════════════════════════════════════════════════════════════════════════════════
// THE PREDICTIONS, RECORDED BEFORE THE RUN (§1.2 — predict-measure-compare)
// ════════════════════════════════════════════════════════════════════════════════════════════════
// A written prediction is what turns a surprising number into a finding rather than a shrug. These
// are stated in the harness rather than only in the report so they cannot be quietly edited
// afterwards to match. Reasoning is given because a prediction without one cannot be learned from.
const PREDICTIONS: Record<string, { recall20: number; why: string }> = {
  committees: { recall20: 60, why:
    'The largest evidence collection and the one that has never been evaluated. Every key is a specific publication with a distinctive title ("The affluent and the effluent"), and the questions were written outside-in from real controversies. BM25 should do well on the named ones (Horizon, Grenfell, Universal Credit) and badly on the vague ones (Q9 "serious violence" is two very common words against 2.6M parliamentary sections). I predict the misses concentrate in the written-evidence half, because a submission is titled by its reference code (SCN0679) rather than its subject.' },
  caselaw: { recall20: 50, why:
    'PRE-FIX BASELINE ONLY (§0). Three of the six accepted questions name their subject in words the judgment itself uses barely at all, and the stored text is still an Akoma Ntoso stylesheet preamble followed by the judgment. Q20 — the exact-citation control — should be 100%: it is a pure pin lookup. I predict Q20 succeeds and roughly half of the topical five do not.' },
  guidance: { recall20: 80, why:
    'The easiest collection in the set. Every key is a topically-titled document from a collection chosen BECAUSE it has topical titles (hmrc-manuals, cps-guidance, college-of-policing), and eight of the ten questions are document-outward — written from the document, so they inherit its vocabulary. A high number here is partly the set being easy and the report must say so.' },
  'impact-assessments': { recall20: 25, why:
    'The lowest, and for a structural reason rather than a retrieval one. With LEX_ROUTER_STREAMS_V2 off these have no stream of their own: they sit in the legislation tier and compete for legislation slots against 1.6M sections of statute. Worse, the sections average 37 words (measured by verify-s10-keys). A 37-word section has almost nothing to match on and the title is an internal heading — "Summary", "Costs and benefits". I predict near-zero with V2 off and a large jump with it on, and that the jump is the finding.' },
  consultations: { recall20: 55, why:
    'Same structural problem as impact assessments — no stream of their own with V2 off, competing inside guidance — but the documents are far better titled: the id itself contains the full slug ("storm-overflows-reducing-sewage-discharges"). I predict they do better than impact assessments and worse than guidance, and that V2 helps them less than it helps impact assessments because guidance is a much smaller tier than legislation.' },
}

// ── plumbing ────────────────────────────────────────────────────────────────────────────────────
const pct = (n: number, d: number) => (d === 0 ? 'n/a' : `${((100 * n) / d).toFixed(1)}%`)
const percentile = (xs: number[], q: number) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((q / 100) * s.length))]
}

interface StoredLeg { stream: string; bm25: string[]; vector: string[]; weight: number }
interface StoredQuestion {
  n: number
  code: string
  collection: string
  question: string
  routedStreams: string[]
  /** The live gateway's own interleaved id list — the §1 headline, and the fidelity control. */
  liveIds: string[]
  /** The live call's per-stream id lists, straight off `runRoutedSearch`. */
  livePerStream: Array<{ stream: string; ids: string[] }>
  legs: StoredLeg[]
  ms: number
}

function readJson<T>(p: string): T | null {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) as T } catch { return null }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// PHASE 1 — ROUTE ONCE
// ════════════════════════════════════════════════════════════════════════════════════════════════
async function buildRoutes(): Promise<Record<string, Record<string, string>>> {
  const cached = readJson<Record<string, Record<string, string>>>(ROUTES)
  if (cached && !has('reroute')) {
    console.log(`[routes] reusing ${Object.keys(cached).length} cached route(s) from ${path.relative(process.cwd(), ROUTES)}`)
    console.log('         ⚠ REUSED ON PURPOSE — a re-rolled route makes two arms incomparable (S9).')
    return cached
  }
  console.log(`[routes] rolling ${GOLD_CORPUS.length} routes (one Gemini call each)…`)
  const out: Record<string, Record<string, string>> = {}
  for (const q of GOLD_CORPUS) {
    const keywords = q.question.split(/\s+/).filter(Boolean)
    const route = await routeQuery(keywords, '')
    if (!route || !Object.keys(route).length) {
      // ⚠ A FAIL-OPEN IS RECORDED, NOT SILENTLY RETRIED. The gateway degrades to an unrouted,
      // unscoped, dense-free search — a real capability loss for that query — and a set where
      // some questions were routed and others were not must say which.
      console.warn(`  Q${q.n} ${q.code}: ROUTER FAILED OPEN — recorded as unrouted`)
      out[String(q.n)] = {}
      continue
    }
    out[String(q.n)] = route as Record<string, string>
    console.log(`  Q${String(q.n).padStart(2)} ${q.code.padEnd(4)} → ${Object.keys(route).join(', ')}`)
  }
  fs.mkdirSync(DIR, { recursive: true })
  fs.writeFileSync(ROUTES, JSON.stringify(out, null, 2))
  console.log(`[routes] cached to ${path.relative(process.cwd(), ROUTES)}`)
  return out
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// PHASE 2 — ONE LIVE RETRIEVAL PASS, THROUGH runSearch(), WITH THE LEGS CAPTURED
// ════════════════════════════════════════════════════════════════════════════════════════════════
async function retrieve() {
  // §1.1: score through `runSearch()` — the real gateway, with routing and fusion. Not
  // `rankedSearch` against `corpus_fts`; GOLD TEST 11 measured a system nobody runs and produced
  // an 8.1% floor against a platform headline near 62%.
  //
  // ⚠ DENSE ON FOR EVERY STREAM DURING THE PASS. This is NOT the recommended configuration and is
  // not reported as one: it is what makes a single pass carry both arms of every per-stream vector
  // decision, because a stream's BM25 leg is byte-identical whether or not its dense leg ran
  // (`fusedStream` calls the same `bm25Only`/`extraFts` either way). The vector-OFF arm is the
  // captured `bm25` list; the vector-ON arm is the fusion of the two captured lists.
  process.env.LEX_VECTOR_STREAMS = ALL_STREAMS.join(',')

  console.log('═'.repeat(100))
  console.log('S10 §1/§2/§3 — THE ONE LIVE RETRIEVAL PASS')
  console.log('═'.repeat(100))
  console.log(capabilityLine())
  console.log(resolvedConfigLine())
  console.log(resolvedFusionWeights(ALL_STREAMS))
  assertRetrievalConfig('measure-s10-recall')

  const before = await readServiceConfig()
  console.log('\n[services] before:')
  for (const s of before) console.log(`  ${s.name.padEnd(7)} ${s.reachable ? 'reachable' : 'UNREACHABLE'}  ${s.detail}`)

  const routes = await buildRoutes()

  const stored: StoredQuestion[] = []
  console.log('\n── RETRIEVING ────────────────────────────────────────────────────────────────────────')
  for (const q of GOLD_CORPUS) {
    const captured: CapturedLegs[] = []
    const uninstall = captureLegs((l) => captured.push(l))
    const t0 = Date.now()
    let out
    try {
      out = await runSearch({
        keywords: q.question.split(/\s+/).filter(Boolean),
        intent: 'GENERAL_CORPUS_CHAT',
        limit: LIMIT,
      })
    } finally {
      uninstall()
    }
    const ms = Date.now() - t0
    stored.push({
      n: q.n, code: q.code, collection: q.collection, question: q.question,
      routedStreams: out.meta.routedStreams ?? [],
      liveIds: out.results.map((r) => r.id),
      livePerStream: (out.meta.perStream ?? []).map((s) => ({ stream: s.stream, ids: s.ids })),
      legs: captured.map((l) => ({
        stream: l.stream,
        bm25: l.bm25.map((r) => r.id),
        vector: l.vector.map((r) => r.id),
        weight: l.weight,
      })),
      ms,
    })
    const hit = q.keys.some((k) => out.results.slice(0, 20).some((r) => r.id === k))
    console.log(`  Q${String(q.n).padStart(2)} ${q.code.padEnd(4)} ${String(ms).padStart(6)}ms  streams=${(out.meta.routedStreams ?? []).length}  results=${out.results.length}  ${q.keys.length ? (hit ? '✓ hit@20' : '· miss@20') : '(no key — control)'}`)
  }

  const after = await readServiceConfig()
  console.log('\n[services] after:')
  for (const s of after) console.log(`  ${s.name.padEnd(7)} ${s.reachable ? 'reachable' : 'UNREACHABLE'}  ${s.detail}`)
  // ⚠ THE ENGAGEMENT LINE. Printed beside every number this pass produces. A zero delta means the
  // results came from somewhere other than the services — the stub, a cache, or an arm that
  // silently failed open — whatever the environment variables claimed.
  console.log(`\n[engagement] ${servedDelta(before, after)}`)

  fs.mkdirSync(DIR, { recursive: true })
  fs.writeFileSync(LEGS, JSON.stringify({
    at: new Date().toISOString(),
    limit: LIMIT,
    config: resolvedConfigLine(),
    engagement: servedDelta(before, after),
    vectorStreamsDuringPass: process.env.LEX_VECTOR_STREAMS,
    questions: stored,
  }, null, 2))
  console.log(`[legs] written to ${path.relative(process.cwd(), LEGS)} (${stored.length} questions)`)
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// PHASE 3 — THE FIDELITY CONTROL. WITHOUT THIS, EVERY ARM BELOW IS A GUESS.
// ════════════════════════════════════════════════════════════════════════════════════════════════
/**
 * Recompute one stream's ranking from its captured legs, at a given dense weight.
 *
 * ⚠ THE `slice` MIRRORS `fusedStream`'s OWN LAST LINE and is the one piece of ranking arithmetic
 * this file restates. That is exactly why `verifyRecompute` exists: it re-derives the live call's
 * own output from the same legs and fails if a single id is out of place, so a drift between this
 * line and the production one is caught by a run rather than by a reading.
 */
function recomputeStream(leg: StoredLeg, weight: number, vectorOn: boolean): string[] {
  if (!vectorOn || !leg.vector.length) return leg.bm25
  const asResult = (id: string): SearchResult => ({ id } as SearchResult)
  const fused = fuseWeightedRrf(leg.vector.map(asResult), leg.bm25.map(asResult), weight)
  return fused.map((r) => r.id).slice(0, Math.max(LIMIT, leg.bm25.length))
}

function recomputeQuestion(
  q: StoredQuestion,
  weights: Record<string, number>,
  vectorStreams: Set<string>,
): { ids: string[]; perStream: Array<{ stream: string; ids: string[] }> } {
  // ⚠ ORDER MATTERS AND IS TAKEN FROM THE LIVE CALL, not from the scope table. `runRoutedSearch`
  // interleaves in the order `streams()` yields the ACTIVE streams, and round-robin order changes
  // which stream gets the odd slot. Re-deriving the order here would be a second place for it to
  // drift; `livePerStream` records what actually happened.
  const order = q.livePerStream.map((s) => s.stream)
  const per = order.map((name) => {
    const leg = q.legs.find((l) => l.stream === name)
    if (!leg) return { stream: name, ids: [] as string[] }
    const w = weights[name] ?? VECTOR_WEIGHT
    return { stream: name, ids: recomputeStream(leg, w, vectorStreams.has(name)) }
  })
  const total = per.reduce((n, s) => n + s.ids.length, 0)
  const asResult = (id: string): SearchResult => ({ id } as SearchResult)
  const ids = interleaveStreams(per.map((s) => s.ids.map(asResult)), total, {
    names: order, label: 's10-recompute',
  }).map((r) => r.id)
  return { ids, perStream: per }
}

function verifyRecompute(data: { questions: StoredQuestion[] }): boolean {
  console.log('\n── FIDELITY CONTROL: does recomputation reproduce the LIVE call? ──────────────────────')
  console.log('  Recomputing each question at the weight the live call actually used, with dense on for')
  console.log('  every stream (the pass configuration), and comparing id-for-id against what the gateway')
  console.log('  returned. ⚠ IF THIS FAILS, EVERY ARM BELOW IS VOID and nothing should be reported.')
  let ok = 0
  let bad = 0
  const failures: string[] = []
  for (const q of data.questions) {
    if (!q.legs.length) continue
    const weights = Object.fromEntries(q.legs.map((l) => [l.stream, l.weight]))
    const on = new Set(q.legs.map((l) => l.stream))
    const re = recomputeQuestion(q, weights, on)
    // Per-stream first — a mismatch there is a fusion bug; a mismatch only in the interleave is an
    // ordering bug. Naming which is the difference between a five-minute fix and a lost afternoon.
    let streamMismatch: string | null = null
    for (const live of q.livePerStream) {
      const mine = re.perStream.find((s) => s.stream === live.stream)?.ids ?? []
      if (JSON.stringify(mine) !== JSON.stringify(live.ids)) { streamMismatch = live.stream; break }
    }
    const interleaveOk = JSON.stringify(re.ids) === JSON.stringify(q.liveIds)
    if (!streamMismatch && interleaveOk) { ok++; continue }
    bad++
    failures.push(`Q${q.n} ${q.code}: ${streamMismatch ? `stream '${streamMismatch}' ranking differs` : 'per-stream OK but interleave differs'}`)
  }
  console.log(`  ${ok} reproduced exactly · ${bad} differed`)
  for (const f of failures.slice(0, 10)) console.log(`    ✗ ${f}`)
  if (bad) {
    console.error('\n  ✗ RECOMPUTATION IS NOT FAITHFUL. The sweep would be measuring this script rather')
    console.error('    than the product. Refusing to report arm numbers.')
    return false
  }
  console.log('  ✓ Every question reproduced id-for-id — the offline arms measure the production path.')
  return true
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// SCORING
// ════════════════════════════════════════════════════════════════════════════════════════════════
interface ArmScore {
  collection: string
  n: number
  hit5: number
  hit20: number
  /** §7 — "state the headroom of every comparison". How many questions COULD have moved. */
  headroomNote: string
}

function score(
  data: { questions: StoredQuestion[] },
  weights: Record<string, number>,
  vectorStreams: Set<string>,
  useLive = false,
): { byCollection: ArmScore[]; perQuestion: Array<{ q: GoldQuestion; rank: number | null }> } {
  const perQuestion: Array<{ q: GoldQuestion; rank: number | null }> = []
  for (const q of SCOREABLE) {
    const stored = data.questions.find((s) => s.n === q.n)
    if (!stored) { perQuestion.push({ q, rank: null }); continue }
    const ids = useLive ? stored.liveIds : recomputeQuestion(stored, weights, vectorStreams).ids
    // The BEST rank any of the question's keys achieved. A question with three acceptable answers
    // is answered if ANY of them comes back — that is what the markdown's key lists mean.
    let best: number | null = null
    for (const k of q.keys) {
      const i = ids.indexOf(k)
      if (i >= 0 && (best === null || i < best)) best = i
    }
    perQuestion.push({ q, rank: best })
  }
  const collections = ['committees', 'caselaw', 'guidance', 'impact-assessments', 'consultations']
  const byCollection = collections.map((c) => {
    const qs = perQuestion.filter((x) => x.q.collection === c)
    const hit20 = qs.filter((x) => x.rank !== null && x.rank < 20).length
    const hit5 = qs.filter((x) => x.rank !== null && x.rank < 5).length
    return {
      collection: c, n: qs.length, hit5, hit20,
      headroomNote: `${qs.length - hit20} question(s) not in the top 20 — the room any change has to move in`,
    }
  })
  return { byCollection, perQuestion }
}

/**
 * ⚠⚠ THE MOST IMPORTANT TABLE IN THIS SCRIPT, AND IT WAS NOT IN THE FIRST DRAFT.
 *
 * The first run reported guidance at 1/10 and consultations at 7/9 — from the SAME stream, since
 * both collections sit in the `guidance` tier. A single merged recall figure cannot tell those two
 * results apart from each other, let alone say why either happened. A miss is one of three
 * completely different failures and they have three completely different fixes:
 *
 *   NOT ROUTED       the stream that owns the answer was never asked. A routing problem. The
 *                    question never had a chance and counting it as a retrieval miss is a libel
 *                    on the index.
 *   NOT RETRIEVED    the stream WAS asked and its own ranked list does not contain the key
 *                    anywhere. A genuine retrieval miss — the only one of the three that is.
 *   DILUTED          the key IS in its stream's list, at a rank the stream would have served,
 *                    and it did not survive the round-robin interleave into the merged top 20.
 *                    Not a retrieval failure at all: an allocation one.
 *
 * DILUTED is structural and large. `runRoutedSearch` interleaves round-robin, so with four streams
 * routed the top 20 holds about five results per stream — a key at rank 8 of its own stream is
 * simply not reachable in a merged top 20, however good the retrieval was.
 *
 * ⚠ THE OWNING STREAM IS FIXED BY THE SCOPE TABLE, NOT CHOSEN. With `LEX_ROUTER_STREAMS_V2` off,
 * impact assessments are reachable only through `legislation` and consultations only through
 * `guidance`, because that is the tier they are indexed under (stream-scopes.ts). That is the fact
 * that makes those two collections' numbers a statement about slots rather than about search.
 */
const OWNING_STREAM: Record<string, string> = {
  committees: 'committees',
  caselaw: 'caselaw',
  guidance: 'guidance',
  'impact-assessments': 'legislation',
  consultations: 'guidance',
}

function diagnose(
  data: { questions: StoredQuestion[] },
  weights: Record<string, number>,
  vectorStreams: Set<string>,
) {
  console.log('\n' + '═'.repeat(100))
  console.log('WHY EVERY MISS IS A MISS — routing vs retrieval vs interleave dilution')
  console.log('═'.repeat(100))
  console.log('  Three different failures with three different fixes. A single merged recall number')
  console.log('  cannot distinguish them, and acting on one without this split fixes the wrong thing.')
  console.log('')
  console.log('  collection            n   hit@20   DILUTED  NOT-RETRIEVED  NOT-ROUTED   in-stream recall@20')
  const rows: Array<{ collection: string; n: number; hit: number; diluted: number; notRetrieved: number; notRouted: number; inStream: number }> = []
  const detail: string[] = []
  for (const c of ['committees', 'caselaw', 'guidance', 'impact-assessments', 'consultations']) {
    const owner = OWNING_STREAM[c]
    const qs = SCOREABLE.filter((q) => q.collection === c)
    let hit = 0, diluted = 0, notRetrieved = 0, notRouted = 0, inStream = 0
    for (const q of qs) {
      const stored = data.questions.find((s) => s.n === q.n)!
      const re = recomputeQuestion(stored, weights, vectorStreams)
      const merged = re.ids
      const mergedRank = Math.min(...q.keys.map((k) => { const i = merged.indexOf(k); return i < 0 ? Infinity : i }))
      const own = re.perStream.find((s) => s.stream === owner)
      const ownRank = own ? Math.min(...q.keys.map((k) => { const i = own.ids.indexOf(k); return i < 0 ? Infinity : i })) : Infinity
      if (ownRank < 20) inStream++
      if (mergedRank < 20) { hit++; continue }
      if (!stored.routedStreams.includes(owner)) {
        notRouted++
        detail.push(`    NOT-ROUTED     Q${q.n} ${q.code} — '${owner}' was not selected; routed to [${stored.routedStreams.join(', ')}]`)
      } else if (ownRank === Infinity) {
        notRetrieved++
        detail.push(`    NOT-RETRIEVED  Q${q.n} ${q.code} — '${owner}' ran and its ${own?.ids.length ?? 0}-result list does not contain the key`)
      } else {
        diluted++
        detail.push(`    DILUTED        Q${q.n} ${q.code} — rank ${ownRank} within '${owner}' (${own?.ids.length} results), rank ${mergedRank === Infinity ? '—' : mergedRank} merged across ${stored.routedStreams.length} streams`)
      }
    }
    rows.push({ collection: c, n: qs.length, hit, diluted, notRetrieved, notRouted, inStream })
    console.log(`  ${c.padEnd(20)} ${String(qs.length).padStart(2)}    ${String(hit).padStart(2)}/${qs.length}     ${String(diluted).padStart(2)}         ${String(notRetrieved).padStart(2)}            ${String(notRouted).padStart(2)}          ${String(inStream).padStart(2)}/${qs.length}  ${pct(inStream, qs.length)}`)
  }
  const t = rows.reduce((a, r) => ({ n: a.n + r.n, hit: a.hit + r.hit, diluted: a.diluted + r.diluted, notRetrieved: a.notRetrieved + r.notRetrieved, notRouted: a.notRouted + r.notRouted, inStream: a.inStream + r.inStream }), { n: 0, hit: 0, diluted: 0, notRetrieved: 0, notRouted: 0, inStream: 0 })
  console.log(`  ${'ALL'.padEnd(20)} ${String(t.n).padStart(2)}    ${String(t.hit).padStart(2)}/${t.n}     ${String(t.diluted).padStart(2)}         ${String(t.notRetrieved).padStart(2)}            ${String(t.notRouted).padStart(2)}          ${String(t.inStream).padStart(2)}/${t.n}  ${pct(t.inStream, t.n)}`)
  console.log('\n  ⚠ "in-stream recall@20" is what RETRIEVAL achieved — the key\'s rank inside the list the')
  console.log('    owning stream itself returned. The gap between it and hit@20 is what the round-robin')
  console.log('    interleave costs, and it is an allocation decision, not a search-quality one.')
  console.log('\n  every miss, named:')
  for (const d of detail) console.log(d)
}

function reportArm(title: string, s: ReturnType<typeof score>, opts: { detail?: boolean } = {}) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 84 - title.length))}`)
  console.log('  collection            n   recall@20        recall@5')
  let tn = 0, t20 = 0, t5 = 0
  for (const c of s.byCollection) {
    tn += c.n; t20 += c.hit20; t5 += c.hit5
    console.log(`  ${c.collection.padEnd(20)} ${String(c.n).padStart(2)}   ${String(c.hit20).padStart(2)}/${c.n} ${pct(c.hit20, c.n).padStart(7)}   ${String(c.hit5).padStart(2)}/${c.n} ${pct(c.hit5, c.n).padStart(7)}`)
  }
  console.log(`  ${'ALL'.padEnd(20)} ${String(tn).padStart(2)}   ${String(t20).padStart(2)}/${tn} ${pct(t20, tn).padStart(7)}   ${String(t5).padStart(2)}/${tn} ${pct(t5, tn).padStart(7)}`)
  if (opts.detail) {
    console.log('\n  per question (rank of the best key, 0-based; "—" = not in the retrieved list at all):')
    for (const x of s.perQuestion) {
      const r = x.rank === null ? '—' : String(x.rank)
      const mark = x.rank === null ? '  ' : x.rank < 5 ? '✓✓' : x.rank < 20 ? '✓ ' : '· '
      console.log(`    ${mark} Q${String(x.q.n).padStart(2)} ${x.q.code.padEnd(4)} rank=${r.padStart(3)}  ${x.q.question.slice(0, 72)}`)
    }
  }
}

async function scoreAll() {
  const data = readJson<{ questions: StoredQuestion[]; config: string; engagement: string; at: string; vectorStreamsDuringPass: string }>(LEGS)
  if (!data) { console.error(`No captured legs at ${LEGS}. Run --retrieve first.`); process.exit(1) }

  console.log('═'.repeat(100))
  console.log('S10 — SCORING CHARLIE\'S VALIDATED SET')
  console.log('═'.repeat(100))
  console.log(`  retrieval pass taken ${data.at}`)
  console.log(`  ${data.config}`)
  console.log(`  [engagement] ${data.engagement}`)
  console.log(`  dense enabled during the pass: ${data.vectorStreamsDuringPass}`)

  console.log('\n── THE SET, WITH n STATED (§1.2 requires n beside every figure) ───────────────────────')
  for (const c of collectionCounts()) {
    console.log(`  ${c.collection.padEnd(20)} scoreable=${String(c.scoreable).padStart(2)}  rejected=${c.rejected}  negative-controls=${c.controls}`)
  }
  console.log('  ⚠ 51 accepted questions is a real instrument and still a small one. No figure below is')
  console.log('    quoted to two decimal places, and no conclusion is drawn where n < 6.')

  console.log('\n── PREDICTIONS, RECORDED BEFORE THE RUN ───────────────────────────────────────────────')
  for (const [c, p] of Object.entries(PREDICTIONS)) console.log(`  ${c.padEnd(20)} recall@20 ≈ ${p.recall20}%`)

  if (!verifyRecompute(data)) process.exit(1)

  // ── §1 THE BASELINE ────────────────────────────────────────────────────────────────────────────
  // Two baselines, because only one of them is a claim about what users get.
  //   · LIVE = exactly what `runSearch()` returned during the pass, dense on for all five streams.
  //   · PRODUCTION-INTENT = S7's recommendation, `legislation,caselaw,guidance`. ⚠ THIS IS AN
  //     INFERENCE ABOUT VERCEL, NOT A READING OF IT (docs/CLAUDE.md §19) — the token is
  //     SAML-blocked and the last value anyone on this machine watched Charlie set was
  //     `legislation` alone (VECTOR_FLIP_LOADTEST.md). All three are reported.
  const W = Object.fromEntries(ALL_STREAMS.map((s) => [s, VECTOR_WEIGHT]))
  reportArm('§1 BASELINE — LIVE runSearch(), dense on all five streams, weight 0.5', score(data, W, new Set(ALL_STREAMS), true), { detail: true })
  reportArm('§1 BASELINE — S7 recommendation (legislation,caselaw,guidance) @ 0.5 [INFERRED Vercel state]',
    score(data, W, new Set(['legislation', 'caselaw', 'guidance'])))
  reportArm('§1 BASELINE — last value CONFIRMED set in Vercel (legislation only) @ 0.5',
    score(data, W, new Set(['legislation'])))
  reportArm('§1 CONTROL — keyword only, dense off everywhere', score(data, W, new Set()))

  diagnose(data, W, new Set(ALL_STREAMS))

  // ── §2 THE PER-STREAM VECTOR DECISIONS ────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(100))
  console.log('§2 — THE PER-STREAM VECTOR DECISIONS, RE-TAKEN ON THE VALIDATED SET')
  console.log('═'.repeat(100))
  console.log('  Each row: this stream\'s dense leg ON versus OFF, with every OTHER stream held OFF, so the')
  console.log('  difference is attributable to one stream. Scored over the collection that stream owns.')
  console.log('  ⚠ HEADROOM IS STATED BECAUSE A FLOOR EFFECT IS NOT A NULL RESULT (§7).')
  console.log('')
  console.log('  stream        collection            n   OFF        ON         delta      headroom')
  const streamCollection: Record<string, string> = {
    committees: 'committees', caselaw: 'caselaw', guidance: 'guidance', debates: '(no questions)', legislation: '(no questions)',
  }
  for (const stream of ALL_STREAMS) {
    const collection = streamCollection[stream]
    const off = score(data, W, new Set())
    const on = score(data, W, new Set([stream]))
    if (collection.startsWith('(')) {
      // ⚠ NAMED, NOT SKIPPED. debates and legislation own no collection in this question set, so
      // their per-stream decision CANNOT be re-taken here. Reporting them as 0.0pp would be a null
      // result manufactured out of an absence of questions.
      console.log(`  ${stream.padEnd(13)} ${collection.padEnd(20)}  —   —          —          —          NOT MEASURABLE: the validated set has no ${stream} questions`)
      continue
    }
    const o = off.byCollection.find((c) => c.collection === collection)!
    const n = on.byCollection.find((c) => c.collection === collection)!
    const delta = ((100 * n.hit20) / n.n) - ((100 * o.hit20) / o.n)
    console.log(`  ${stream.padEnd(13)} ${collection.padEnd(20)} ${String(o.n).padStart(2)}   ${String(o.hit20).padStart(2)}/${o.n} ${pct(o.hit20, o.n).padStart(6)}  ${String(n.hit20).padStart(2)}/${n.n} ${pct(n.hit20, n.n).padStart(6)}  ${(delta >= 0 ? '+' : '') + delta.toFixed(1)}pp    ${o.n - Math.max(o.hit20, n.hit20)} of ${o.n} could still move`)
  }

  // ── §3 THE DIAL ───────────────────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(100))
  console.log('§3 — THE FUSION CURVE PER STREAM (the dial)')
  console.log('═'.repeat(100))
  console.log('  Grid: keyword-only, 80/20, 65/35, 50/50 (today), 35/65, vector-only. Six points is enough to')
  console.log('  see a shape; more is over-fitting to 51 questions.')
  console.log('  ⚠ READ THE SHAPE, NOT THE PEAK. A flat curve says the dial does not matter for that stream.')
  console.log('    A single spiky maximum on n≈10 is more likely noise than a finding.')
  const GRID = [0, 0.2, 0.35, 0.5, 0.65, 1]
  const GRID_LABEL = ['kw-only', '80/20', '65/35', '50/50', '35/65', 'vec-only']

  // ⚠ TWO CURVES PER STREAM, AND THE SECOND IS THE ONE THE DIAL ACTUALLY CONTROLS.
  //
  // `recall@20 (merged)` is what a user gets — but with three or four streams routed, the merged
  // top 20 holds only five or six results per stream, so a weight change that moves a key from
  // rank 30 to rank 8 inside its own stream shows up as NO CHANGE AT ALL there. The merged curve
  // is therefore flattened by the interleave, and reading a "flat curve = the dial does not
  // matter" conclusion off it would be reading the allocation, not the ranking.
  //
  // `in-stream recall@20` is the key's rank inside the list the owning stream itself produced —
  // exactly the list `fuseWeightedRrf` orders, and exactly what the weight changes. Adoption
  // decisions are taken off THIS curve; the merged one says what the user would notice.
  const inStreamCurve = (stream: string, collection: string, w: number, depth: number) => {
    const owner = OWNING_STREAM[collection]
    let hit = 0
    const qs = SCOREABLE.filter((q) => q.collection === collection)
    for (const q of qs) {
      const stored = data.questions.find((s) => s.n === q.n)!
      const re = recomputeQuestion(stored, { ...W, [stream]: w }, new Set([stream]))
      const own = re.perStream.find((s) => s.stream === owner)
      if (!own) continue
      const r = Math.min(...q.keys.map((k) => { const i = own.ids.indexOf(k); return i < 0 ? Infinity : i }))
      if (r < depth) hit++
    }
    return `${hit}/${qs.length}`
  }

  for (const stream of ALL_STREAMS) {
    const collection = streamCollection[stream]
    if (collection.startsWith('(')) {
      console.log(`\n  ${stream}: NO CURVE — the validated set has no questions this stream owns. Not swept, not adopted.`)
      continue
    }
    const n = score(data, W, new Set()).byCollection.find((c) => c.collection === collection)!.n
    console.log(`\n  ${stream} (collection ${collection}, n=${n})`)
    const merged20 = GRID.map((w) => { const s = score(data, { ...W, [stream]: w }, new Set([stream])); const c = s.byCollection.find((x) => x.collection === collection)!; return `${c.hit20}/${c.n}` })
    const merged5 = GRID.map((w) => { const s = score(data, { ...W, [stream]: w }, new Set([stream])); const c = s.byCollection.find((x) => x.collection === collection)!; return `${c.hit5}/${c.n}` })
    console.log(`    merged   recall@20:  ${GRID_LABEL.map((l, i) => `${l}:${merged20[i]}`).join('   ')}`)
    console.log(`    merged   recall@5:   ${GRID_LABEL.map((l, i) => `${l}:${merged5[i]}`).join('   ')}`)
    console.log(`  ▶ in-stream recall@20:  ${GRID_LABEL.map((l, i) => `${l}:${inStreamCurve(stream, collection, GRID[i], 20)}`).join('   ')}`)
    console.log(`  ▶ in-stream recall@5:   ${GRID_LABEL.map((l, i) => `${l}:${inStreamCurve(stream, collection, GRID[i], 5)}`).join('   ')}`)
  }
  console.log('\n  ⚠⚠ THE guidance CURVE MUST NOT BE USED TO ADOPT A WEIGHT. Five of its ten questions key')
  console.log('     on `cps-guidance`, which was STRUCTURALLY UNREACHABLE during this pass (indexed under')
  console.log('     tier `other`, so the guidance stream\'s prefilter excludes it — see stream-scopes.ts).')
  console.log('     Those five could not be found at ANY weight, so the curve is measured over five')
  console.log('     questions wearing a denominator of ten. That is a floor effect, not a flat curve.')

  console.log('\n' + '═'.repeat(100))
  console.log('⚠ THE DIAL COSTS NO LATENCY, AND THAT IS STRUCTURAL RATHER THAN MEASURED-AS-ZERO.')
  console.log('  A weight changes only how two already-retrieved rankings are merged; `fusedStream` issues')
  console.log('  the same BM25 and dense calls at every weight, including 0 and 1. The latency decision is')
  console.log('  the ON/OFF one — run --latency for it.')
  console.log('═'.repeat(100))
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// LATENCY — the half of §2 that cannot be recomputed offline
// ════════════════════════════════════════════════════════════════════════════════════════════════
async function latency() {
  const routes = readJson<Record<string, Record<string, string>>>(ROUTES)
  if (!routes) { console.error('No cached routes. Run --retrieve first.'); process.exit(1) }
  const sample = SCOREABLE.filter((q) => ['committees', 'caselaw', 'guidance'].includes(q.collection)).slice(0, 12)
  console.log('═'.repeat(100))
  console.log('§2 — LATENCY: WHAT THE DENSE LEG COSTS, PER STREAM')
  console.log('═'.repeat(100))
  console.log(`  n=${sample.length} questions, same cached routes, arms ALTERNATED within one process against the`)
  console.log('  same warm services — the only way a delta means anything (query-router.ts records why).')
  const arms: Array<{ label: string; streams: string }> = [
    { label: 'dense OFF everywhere', streams: '' },
    { label: 'dense ON: legislation,caselaw,guidance (S7 rec)', streams: 'legislation,caselaw,guidance' },
    { label: 'dense ON: all five streams', streams: ALL_STREAMS.join(',') },
  ]
  const times: Record<string, number[]> = {}
  for (const a of arms) times[a.label] = []
  for (const q of sample) {
    for (const a of arms) {
      process.env.LEX_VECTOR_STREAMS = a.streams
      const t = Date.now()
      await runSearch({ keywords: q.question.split(/\s+/).filter(Boolean), intent: 'GENERAL_CORPUS_CHAT', limit: LIMIT })
      times[a.label].push(Date.now() - t)
    }
  }
  console.log('\n  arm                                              p50        p95')
  for (const a of arms) {
    const xs = times[a.label]
    console.log(`  ${a.label.padEnd(46)} ${String(percentile(xs, 50)).padStart(6)}ms  ${String(percentile(xs, 95)).padStart(6)}ms`)
  }
  console.log('\n  ⚠ Each of these includes ONE Gemini routing call (~1–2s), which is identical across arms')
  console.log('    and so cancels in the delta but inflates every absolute figure.')
}

async function main() {
  if (has('retrieve')) return retrieve()
  if (has('latency')) return latency()
  if (has('score') || !argv.length) return scoreAll()
  console.error('Usage: --retrieve | --score | --latency  [--reroute] [--limit=N]')
  process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
