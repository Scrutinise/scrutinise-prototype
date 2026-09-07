/**
 * audit-s18-routing.ts — BRIEF_SEARCH_S18 §1. WHY DOES THE WORST-PERFORMING COLLECTION NEVER
 * GET SEARCHED?
 *
 * ⚠⚠ §1 IS THE SPRINT'S MOST VALUABLE ARTEFACT and it is a DIAGNOSIS, not a fix. The brief names
 * three candidate causes that have three different fixes, and says to establish which with
 * numbers rather than by analogy:
 *
 *   (a) STREAM SELECTION — the router never names a stream that admits the collection.
 *   (b) TIER            — the collection sits under a tier no stream selects in the BUILT index.
 *   (c) SCOPE           — a stream's tier is right but its corpus/type filters exclude it.
 *
 * and a fourth that is none of them and must not be misattributed to routing:
 *
 *   (d) MATCHING        — the right stream WAS searched, the row IS admitted, and BM25 still did
 *                         not return it. S16/S17 already published one of these (S10-Q32).
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * FOUR THINGS THIS SCRIPT DOES THAT A CHEAPER VERSION WOULD GET WRONG
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * 1. ⚠ THE TIER IS READ BACK OFF `fts-serve`, NEVER OFF `corpus_reachability.json`. S16 published
 *    UNREACHABLE=4 because its autopsy took the tier from an artefact generated one day before
 *    S11's re-tier; S17 recounted it to 0. The tier is a property of the INDEX, so it is read from
 *    hits that carry their own `tier` field, and the artefact's staleness cannot reach this table.
 *
 * 2. ⚠ THE SCOPE TEST IS IMPORTED (`streamCanSelect`), NEVER RE-IMPLEMENTED. The same S17 finding:
 *    a re-implemented `admits()` that never looked at `extraCorpora` is what produced the wrong
 *    class. stream-scopes.ts's own header warns about the copy; this file takes the original.
 *
 * 3. ⚠ THE ROUTER IS ROLLED MORE THAN ONCE PER QUESTION. An LLM sits between the question and the
 *    retrieval and routing is measurably INTERMITTENT (measure-routing.ts, §2.3). One roll measures
 *    the sample, not the system, so `--repeat` defaults to 3 and every rate below has the CALL
 *    count as its denominator, never the question count.
 *
 * 4. ⚠ A CORPUS-SCOPED CONTROL RUNS FOR EVERY KEY. "The router did not choose the stream" and "the
 *    document cannot be found anyway" are different findings with different fixes, and only a
 *    search restricted to the collection itself separates them. A key that ranks 1 of its own
 *    collection and is missing from the whole-corpus answer is a routing failure; a key that
 *    cannot be found even scoped to its own 18,700 documents is not, and no amount of routing will
 *    save it. THE CONTROL IS WHAT MAKES THE ROUTING NUMBER MEAN ANYTHING.
 *
 * Usage (from scrutinise-web):
 *   npx tsx --env-file=.env --tsconfig tsconfig.json scripts/audit-s18-routing.ts
 *   …            --repeat 3            rolls per question per arm
 *   …            --arms v1,v2          which router arms to run
 *   …            --no-router           skip the LLM half, refresh the corpus half only
 */
import fs from 'node:fs'
import path from 'node:path'
import { routeQueryDetailed } from '../lib/lex/query-expansion'
import {
  STREAM_SCOPES, STREAM_SCOPES_V2, streamCanSelect, type StreamScope,
} from '../lib/lex/stream-scopes'
import { corpusToType } from '../lib/lex/corpus-type-map'
import { capabilityLine } from '../lib/env-flags'
import { GOLD_CORPUS, type GoldQuestion } from './gold/s10-gold-set'

export {}

const argv = process.argv.slice(2)
const has = (n: string) => argv.includes(`--${n}`)
const arg = (n: string) => {
  const i = argv.indexOf(`--${n}`)
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1]
  const eq = argv.find((x) => x.startsWith(`--${n}=`))
  return eq ? eq.split('=').slice(1).join('=') : null
}

const REPEAT = parseInt(arg('repeat') ?? '3', 10)
const ARMS = (arg('arms') ?? 'v1,v2').split(',').map((s) => s.trim()).filter(Boolean)
const OUT = path.join(__dirname, '../../docs/census/s18-routing.json')
const FTS_URL = (process.env.FTS_SEARCH_URL ?? '').replace(/\/$/, '')

/** The nine recall questions plus the one negative control — Charlie's set, unedited. */
const QUESTIONS: GoldQuestion[] = GOLD_CORPUS.filter(
  (q) => q.collection === 'impact-assessments' && q.verdict === 'ACCEPT',
)

// ── the FTS service, called raw ─────────────────────────────────────────────────────────────────
// ⚠ RAW, NOT THROUGH `runFtsSearch`, FOR ONE REASON: the adapter maps hits onto `SearchResult`,
// which has no `tier` field. The tier is the thing this audit is trying to read, so it has to come
// off the wire. Everything else here uses the shared modules.
interface Hit { id: string; corpus: string; tier: string; sectionTitle: string | null; score: number }

async function ftsSearch(
  query: string, limit: number, scope: { tier?: string; corpora?: string[] } = {},
): Promise<{ hits: Hit[]; echoedCorpora: string[] | null }> {
  if (!FTS_URL) throw new Error('FTS_SEARCH_URL is not set — this audit cannot read the served index')
  const res = await fetch(`${FTS_URL}/fts-search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, limit, ...scope }),
  })
  if (!res.ok) throw new Error(`FTS ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = (await res.json()) as { results?: Hit[]; corpora?: string[] | null }
  return { hits: json.results ?? [], echoedCorpora: json.corpora ?? null }
}

// ── the router, rolled ──────────────────────────────────────────────────────────────────────────
interface Roll {
  /** Streams the model named, in the order it emitted them. */
  streams: string[]
  /** The tailored query it wrote for each — the "why" §1.1 asks for, in the model's own words. */
  queries: Record<string, string>
  /** null = the router failed open (see routerFailOpen); it is NOT the same as naming no stream. */
  failedOpen: boolean
}

async function roll(question: string): Promise<Roll> {
  const keywords = question.trim().split(/\s+/).filter(Boolean)
  const decision = await routeQueryDetailed(keywords, '')
  if (!decision?.route) return { streams: [], queries: {}, failedOpen: true }
  const queries = decision.route as Record<string, string>
  return { streams: Object.keys(queries), queries, failedOpen: false }
}

// ── plumbing ────────────────────────────────────────────────────────────────────────────────────
const pct = (n: number, d: number) => (d === 0 ? 'n/a' : `${((100 * n) / d).toFixed(1)}%`)
const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n))

interface KeyFact {
  id: string
  corpus: string
  /** ⚠ READ BACK OFF THE SERVED INDEX. Null = the key never came back from its own collection,
   *  which is itself the finding (it cannot be a routing failure if it cannot be retrieved). */
  servedTier: string | null
  /** Rank within a search restricted to the key's OWN collection. -1 = not in the top N. */
  scopedRank: number
  /** Which streams admit it, computed from the LIVE scopes with the IMPORTED predicate. */
  admittedBy: string[]
  admittedByV2: string[]
}

async function keyFacts(key: string, question: string, limit: number): Promise<KeyFact> {
  const corpus = key.split(':')[0]
  // The corpus-scoped control. The RAW QUESTION is used, not a router-tailored string: the point
  // is to ask whether the document is findable at all by what the user typed, with every other
  // collection taken out of the race.
  const { hits, echoedCorpora } = await ftsSearch(question, limit, { corpora: [corpus] })
  if (echoedCorpora && !echoedCorpora.includes(corpus)) {
    // ⚠ Stated, not swallowed. An unhonoured prefilter would make every rank below meaningless.
    console.warn(`  ⚠ fts-serve did not honour corpora=[${corpus}] (echoed ${JSON.stringify(echoedCorpora)}) — ranks below are NOT collection-scoped`)
  }
  const idx = hits.findIndex((h) => h.id === key)
  // The tier: prefer the key's own hit; fall back to any hit of the same collection, since tier is
  // a property of the collection in the index, and say which was used.
  const own = idx >= 0 ? hits[idx] : null
  const sibling = hits.find((h) => h.corpus === corpus) ?? null
  const servedTier = own?.tier ?? sibling?.tier ?? null

  const type = servedTier ? corpusToType(corpus, servedTier, key) : null
  const admits = (scopes: StreamScope[]) =>
    servedTier === null ? [] : scopes.filter((s) => streamCanSelect(s, corpus, servedTier, type)).map((s) => s.name)

  return {
    id: key,
    corpus,
    servedTier,
    scopedRank: idx >= 0 ? idx + 1 : -1,
    admittedBy: admits(STREAM_SCOPES),
    admittedByV2: admits([...STREAM_SCOPES, ...STREAM_SCOPES_V2]),
  }
}

async function main() {
  const CONFIG = `${capabilityLine()} | FTS_SEARCH_URL=${FTS_URL ? 'set' : 'UNSET'} | GEMINI_API_KEY=${process.env.GEMINI_API_KEY ? 'set' : 'UNSET'}`
  const degraded: string[] = []
  if (!FTS_URL) degraded.push('FTS_SEARCH_URL unset — the corpus half of this audit cannot run at all')
  if (!process.env.GEMINI_API_KEY) degraded.push('GEMINI_API_KEY unset — the router half cannot run')

  console.log('── S18 §1 · WHY IS THE IMPACT-ASSESSMENT COLLECTION NEVER SEARCHED? ──')
  console.log(`  config    : ${CONFIG}`)
  console.log(`  degraded  : ${degraded.length ? degraded.join(' | ') : '(none)'}`)
  console.log(`  fts-serve : ${FTS_URL || 'UNSET'}`)
  console.log(`  questions : ${QUESTIONS.length} (Charlie's validated set, unedited)`)
  console.log(`  arms      : ${ARMS.join(', ')}   repeat ${REPEAT} roll(s) per question per arm`)
  if (FTS_URL) {
    try {
      const s = (await (await fetch(`${FTS_URL}/stats`)).json()) as Record<string, unknown>
      console.log(`  served    : build=${s.build ?? '?'} rows=${s.rows ?? '?'}`)
    } catch (e) { console.log(`  served    : ⚠ /stats unreadable (${(e as Error).message})`) }
  }
  console.log()

  // ── the corpus half: tier, scope and the collection-scoped control ────────────────────────────
  console.log('── (b)+(c)+(d): TIER, SCOPE, AND THE COLLECTION-SCOPED CONTROL ──')
  console.log('  Every tier below is read back off the SERVED index; every `admittedBy` is computed')
  console.log('  with the IMPORTED `streamCanSelect`, over the live STREAM_SCOPES.\n')
  const facts: Record<string, KeyFact[]> = {}
  for (const q of QUESTIONS) {
    facts[q.code] = []
    for (const k of q.keys) {
      const f = await keyFacts(k, q.question, 200)
      facts[q.code].push(f)
      console.log(
        `  ${pad(q.code, 4)} ${pad(k, 34)} tier=${pad(f.servedTier ?? 'UNREAD', 12)}` +
        ` scopedRank=${f.scopedRank === -1 ? 'NOT-IN-200' : String(f.scopedRank).padStart(3)}` +
        `  admittedBy=[${f.admittedBy.join(',') || 'NONE'}]  +V2=[${f.admittedByV2.join(',') || 'NONE'}]`,
      )
    }
    if (!q.keys.length) console.log(`  ${pad(q.code, 4)} (negative control — no key, by design)`)
  }

  // ── the router half ───────────────────────────────────────────────────────────────────────────
  const rolls: Record<string, Record<string, Roll[]>> = {}
  if (!has('no-router') && process.env.GEMINI_API_KEY) {
    for (const armName of ARMS) {
      // ⚠ The flag is set per arm and the resulting prompt/schema are read at CALL time
      // (routerSystemPrompt / routerSchema both call flagEnabled), so both arms genuinely run in
      // one process against the same warm service.
      process.env.LEX_ROUTER_STREAMS_V2 = armName === 'v2' ? 'true' : 'false'
      console.log(`\n── (a): STREAM SELECTION — arm ${armName.toUpperCase()} (LEX_ROUTER_STREAMS_V2=${process.env.LEX_ROUTER_STREAMS_V2}) ──`)
      for (const q of QUESTIONS) {
        rolls[q.code] ??= {}
        rolls[q.code][armName] = []
        for (let r = 0; r < REPEAT; r++) {
          const out = await roll(q.question)
          rolls[q.code][armName].push(out)
        }
        const rs = rolls[q.code][armName]
        const named = (s: string) => rs.filter((x) => x.streams.includes(s)).length
        console.log(`  ${pad(q.code, 4)} ${pad(q.question, 62)}`)
        console.log(`        rolls: ${rs.map((x) => (x.failedOpen ? 'FAIL-OPEN' : x.streams.join('+') || 'NONE')).join('   |   ')}`)
        console.log(`        legislation ${named('legislation')}/${REPEAT}` +
          (armName === 'v2' ? `   impact-assessments ${named('impact-assessments')}/${REPEAT}` : ''))
        // The model's own words for the stream that would have found it — the "why".
        const withLeg = rs.find((x) => x.queries['legislation'])
        const withIa = rs.find((x) => x.queries['impact-assessments'])
        if (withLeg) console.log(`        legislation query: ${JSON.stringify(withLeg.queries['legislation'])}`)
        if (withIa) console.log(`        impact-assessments query: ${JSON.stringify(withIa.queries['impact-assessments'])}`)
      }
    }
  } else {
    console.log('\n── (a): STREAM SELECTION — SKIPPED (--no-router or no GEMINI_API_KEY) ──')
  }

  // ── the classification ────────────────────────────────────────────────────────────────────────
  console.log('\n── THE ANSWER TO §1.2, PER QUESTION ──')
  const rows: Array<Record<string, unknown>> = []
  let selection = 0, matching = 0, tier = 0, scope = 0, unread = 0
  for (const q of QUESTIONS) {
    const ks = facts[q.code]
    if (!ks.length) continue // the negative control has no key and no class
    const anyAdmitted = ks.some((k) => k.admittedBy.length > 0)
    const anyFindable = ks.some((k) => k.scopedRank > 0)
    const anyTierRead = ks.some((k) => k.servedTier !== null)
    const legRate = rolls[q.code]?.v1
      ? rolls[q.code].v1.filter((r) => r.streams.includes('legislation')).length / REPEAT
      : null

    let cls: string
    let why: string
    if (!anyTierRead) { cls = 'TIER-UNREAD'; why = 'no hit of this collection came back from the served index at all'; unread++ }
    else if (!anyAdmitted) {
      // Distinguish (b) from (c): is the TIER outside every stream, or does a stream own the tier
      // and exclude the corpus?
      const t = ks[0].servedTier
      const tierOwned = STREAM_SCOPES.some((s) => s.tier === t)
      if (tierOwned) { cls = 'SCOPE'; why = `tier '${t}' is owned by a stream, but its corpus/type filters exclude this collection`; scope++ }
      else { cls = 'TIER'; why = `indexed tier '${t}' is selected by NO stream`; tier++ }
    } else if (legRate !== null && legRate < 0.5) {
      cls = 'SELECTION'
      why = `admitted by [${ks[0].admittedBy.join(',')}] and findable scoped (best rank ${Math.min(...ks.filter((k) => k.scopedRank > 0).map((k) => k.scopedRank), Infinity)}), but the router named that stream on only ${Math.round(legRate * REPEAT)}/${REPEAT} rolls`
      selection++
    } else if (!anyFindable) {
      cls = 'MATCHING'
      why = 'the stream is routed and admits it, and the key is not in the top 200 even scoped to its OWN collection — routing cannot fix this'
      matching++
    } else {
      cls = 'MATCHING'
      why = `the stream is routed and admits it, and the key IS findable scoped (best rank ${Math.min(...ks.filter((k) => k.scopedRank > 0).map((k) => k.scopedRank))}) — it loses inside the stream, not before it`
      matching++
    }
    console.log(`  ${pad(q.code, 4)} ${pad(cls, 12)} ${why}`)
    rows.push({
      code: q.code, n: q.n, question: q.question, cls, why,
      keys: ks, legislationRollRate: legRate,
      rolls: rolls[q.code] ?? null,
    })
  }

  console.log('\n── DISTRIBUTION (the nine recall questions; the negative control is not classified) ──')
  console.log(`  SELECTION   ${selection}   the router never named the stream that admits the collection`)
  console.log(`  MATCHING    ${matching}   the stream was named and the document still did not come back`)
  console.log(`  TIER        ${tier}`)
  console.log(`  SCOPE       ${scope}`)
  console.log(`  TIER-UNREAD ${unread}`)

  const artefact = {
    takenAt: new Date().toISOString(),
    config: CONFIG,
    degraded,
    repeat: REPEAT,
    arms: ARMS,
    ftsUrl: FTS_URL,
    distribution: { SELECTION: selection, MATCHING: matching, TIER: tier, SCOPE: scope, 'TIER-UNREAD': unread },
    rows,
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(artefact, null, 2))
  console.log(`\n  → ${path.relative(process.cwd(), OUT)}`)
  console.log(`  ⚠ every number above is UNDER: ${CONFIG}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
