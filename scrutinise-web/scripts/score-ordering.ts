/**
 * score-ordering.ts — the ordering BASELINE, measured on the production ranking.
 *
 * Imports the real `runSearch`, so this is the gateway with routing, per-stream fusion and the
 * tuned weight — not a reimplementation that could drift from it. That matters: the whole point is
 * to measure what users get.
 *
 * Two modes:
 *   --benchmark   run one query and print the ranking (re-establishing the 4 Aug benchmark)
 *   (default)     score every pair in gold-preferences.ts and report preference accuracy
 *
 * Scoring rule (docs/ORDERING_METRIC_PROPOSAL.md), including the asymmetric cases:
 *   rank(A) < rank(B)            pass
 *   rank(B) < rank(A)            fail
 *   A present, B absent          pass    — preferred retrieved, dispreferred not
 *   A absent,  B present         fail    — surfaced only the worse of the two
 *   both absent                  VACUOUS — reported, EXCLUDED from the denominator
 *
 * ⚠ Vacuous pairs are excluded and reported separately, or the metric is gameable by retrieving
 * nothing: an empty ranking has zero fails.
 *
 * ⚠ recall@20 is NOT computed here. It is the guard, and it already has a harness on the ingest
 * side. The pairing to hold in mind: a reranker only REORDERS, so recall must be invariant —
 * preference accuracy up with recall down means it is discarding, not ordering.
 *
 * Measured on the fused list BEFORE grouping: `runSearch` returns `results` (fused, ungrouped) and
 * `grouped` (≤3/type, ~20). Grouping would mask a legislation-vs-legislation error by keeping only
 * the top three of that type, which is exactly the error being measured.
 *
 * Env (none of these live in .env locally — pass them inline):
 *   FTS_SEARCH_URL VECTOR_SEARCH_URL GEMINI_API_KEY LEX_QUERY_ROUTER=true LEX_VECTOR_STREAMS=legislation
 */
import { runSearch } from '../lib/lex/search-gateway'
import { PREFERENCES, PREFERENCE_QUERIES, type GoldPreference, type PrefSide } from './gold-preferences'
import type { SearchResult } from '../lib/lex/page1-config'

const K = parseInt(process.env.ORDER_K ?? '20', 10)
const LIMIT = parseInt(process.env.ORDER_LIMIT ?? '16', 10)
const arg = (n: string) => process.argv.includes(`--${n}`)
// A flag used bare (`--benchmark` with no value, or followed by another flag) must fall back to
// the default rather than picking up `undefined` — the next token is not necessarily a value.
const argv = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`)
  const next = i >= 0 ? process.argv[i + 1] : undefined
  return next && !next.startsWith('--') ? next : d
}

/** Haystack per hit — id first, since most patterns are gov.uk paths. */
const hay = (r: SearchResult) => `${r.id}\n${r.title ?? ''}\n${r.citation ?? ''}`

/** 0-based rank of the first hit matching any pattern, or -1. */
function rankOf(side: PrefSide, ranking: SearchResult[]): number {
  for (let i = 0; i < Math.min(ranking.length, K); i++) {
    if (side.patterns.some((p) => p.test(hay(ranking[i])))) return i
  }
  return -1
}

async function rank(query: string): Promise<{ results: SearchResult[]; streams?: string[] }> {
  const out = await runSearch({ keywords: query.split(/\s+/).filter(Boolean), intent: 'GENERAL_CORPUS_CHAT', limit: LIMIT })
  return { results: out.results, streams: out.meta.routedStreams }
}

async function benchmark() {
  const q = argv('benchmark', 'what is the law on data protection currently?')
  console.log(`query: ${q}\n`)
  const { results, streams } = await rank(q)
  console.log(`routed streams: ${streams?.length ? streams.join(', ') : 'NONE — router did not dispatch'}`)
  console.log(`retrieved: ${results.length} (showing top ${K})\n`)
  results.slice(0, K).forEach((r, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${(r.type ?? '').padEnd(24)} ${r.id}`)
    console.log(`      ${(r.title ?? '').slice(0, 96)}`)
  })
  // The specific question the benchmark exists to answer.
  const gdpr = rankOf({ label: 'UK GDPR', patterns: [/eur\/2016\/679/i, /uk\s*gdpr/i] }, results)
  const dpa = rankOf({ label: 'DPA 2018', patterns: [/ukpga\/2018\/12/i] }, results)
  const pecr = rankOf({ label: 'PECR 2003', patterns: [/uksi\/2003\/2426/i] }, results)
  console.log('\nthe 4 Aug question, answered:')
  const fmt = (n: number) => (n < 0 ? 'absent' : `rank ${n + 1}`)
  console.log(`  UK GDPR  ${fmt(gdpr)}\n  DPA 2018 ${fmt(dpa)}\n  PECR 2003 ${fmt(pecr)}`)

  // ⚠ A CONCLUSION MAY NOT BE DRAWN FROM AN ABSENCE OF DATA, and this printed one for a week.
  // With an empty ranking every rank is -1, so `principalFirst` was false for both instruments and
  // the else-branch fired: "PECR still leads the principal instruments. The ordering problem is
  // REAL." — the most alarming available verdict, reported from ZERO retrieved documents. It
  // happened for real on 2026-08-12: `DATABASE_URL` was absent, `prisma.$queryRaw` threw,
  // `fts-search` returned empty "NOT a stub" as designed, and the harness turned that into
  // evidence for building a reranker. Same family as the invisible fail-open (docs/CLAUDE.md §18):
  // a failure wearing the face of a result.
  if (!results.length) {
    console.log('\n  ⚠ NOTHING WAS RETRIEVED — no conclusion is available, and the absence of a')
    console.log('    principal instrument is NOT evidence about ordering. Check FTS_SEARCH_URL,')
    console.log('    DATABASE_URL (the FTS adapter hydrates titles through Prisma) and GEMINI_API_KEY.')
    process.exitCode = 1
    return
  }
  if (pecr < 0 && gdpr < 0 && dpa < 0) {
    console.log('\n  · VACUOUS: none of the three instruments appears in the top ' + K + '. The')
    console.log('    benchmark cannot speak to their relative order. This is a retrieval finding,')
    console.log('    not an ordering one, and it is reported as such rather than scored.')
    return
  }
  const principalFirst = (n: number) => n >= 0 && (pecr < 0 || n < pecr)
  console.log(principalFirst(gdpr) || principalFirst(dpa)
    ? '  → a principal instrument OUTRANKS PECR. The observed regression does NOT reproduce.'
    : pecr >= 0
      ? '  → PECR still leads the principal instruments. The ordering problem is REAL.'
      : '  → inconclusive: PECR is absent and so are both principal instruments above it.')
}

async function scorePreferences() {
  // ── S2C5 §2: a pair is scored only where its order is a RANKING DECISION ────────────────────
  // The 5 cross-stream pairs are excluded, not silently mis-scored. Round-robin interleaving is
  // stream-balanced by construction, and `groupForPanel` is a stable filter over that list (its
  // global cross-stream sort was deleted 2026-08-09), so between two streams there is no surface
  // anywhere in the product whose order reflects relevance. Scoring them would measure the
  // `STREAMS` declaration order and report it as ranking quality.
  const scoreable = PREFERENCES.filter((p) => p.surface === 'within-stream')
  const excluded = PREFERENCES.filter((p) => p.surface !== 'within-stream')
  console.log(`pairs: ${PREFERENCES.length} authored — ${scoreable.length} scoreable (within-stream), ${excluded.length} EXCLUDED (cross-stream)`)
  console.log('  excluded, and why — these are not deleted; they are the ready-made acceptance test for a reranker:')
  for (const p of excluded) console.log(`   · ${p.above.label} > ${p.below.label}  [${p.query.slice(0, 56)}]`)
  console.log(`\nscoring ${scoreable.length} pairs over ${PREFERENCE_QUERIES.length} queries, k=${K}\n`)

  const rankings = new Map<string, { results: SearchResult[]; streams?: string[] }>()
  for (const q of PREFERENCE_QUERIES) {
    process.stdout.write(`  retrieving: ${q.slice(0, 62).padEnd(64)}`)
    try {
      const r = await rank(q)
      rankings.set(q, r)
      console.log(`${String(r.results.length).padStart(4)} hits  [${r.streams?.join(', ') ?? 'no routing'}]`)
    } catch (e) {
      console.log(`FAILED — ${(e as Error).message}`)
      rankings.set(q, { results: [] })
    }
  }

  let pass = 0, fail = 0, vacuous = 0
  const failed: Array<{ p: GoldPreference; a: number; b: number }> = []
  console.log('\npairs:')
  for (const p of scoreable) {
    const ranking = rankings.get(p.query)?.results ?? []
    const a = rankOf(p.above, ranking)
    const b = rankOf(p.below, ranking)
    let verdict: 'pass' | 'fail' | 'vacuous'
    if (a < 0 && b < 0) { verdict = 'vacuous'; vacuous++ }
    else if (a >= 0 && b < 0) { verdict = 'pass'; pass++ }
    else if (a < 0 && b >= 0) { verdict = 'fail'; fail++; failed.push({ p, a, b }) }
    else if (a < b) { verdict = 'pass'; pass++ }
    else { verdict = 'fail'; fail++; failed.push({ p, a, b }) }

    const mark = verdict === 'pass' ? '✓' : verdict === 'fail' ? '✗' : '·'
    const pos = (n: number) => (n < 0 ? '—' : String(n + 1))
    console.log(`  ${mark} ${p.above.label} (${pos(a)}) > ${p.below.label} (${pos(b)})`)
    if (verdict !== 'pass') console.log(`      q: ${p.query.slice(0, 84)}`)
  }

  const denom = pass + fail
  console.log('\n════ BASELINE ════')
  console.log(`  preference accuracy   ${denom ? ((100 * pass) / denom).toFixed(1) + '%' : 'n/a'}  (${pass}/${denom})`)
  console.log(`  cross-stream excluded ${excluded.length}  ← no product surface orders two streams by relevance; scoring them would measure the STREAMS declaration order`)
  console.log(`  vacuous (excluded)    ${vacuous}  ← neither side retrieved; a shrinking denominator is a warning, not a win`)
  if (failed.length) {
    console.log('\n  failures, most-wrong first:')
    for (const f of failed.sort((x, y) => (x.a < 0 ? 999 : x.a) - (y.a < 0 ? 999 : y.a)).slice(0, 12)) {
      console.log(`   · ${f.p.above.label} should outrank ${f.p.below.label}`)
      console.log(`     ${f.p.why}`)
    }
  }
  console.log('\n  ⚠ recall@20 is the GUARD and is not measured here — a reranker only reorders, so it')
  console.log('    must stay invariant. Accuracy up with recall down means discarding, not ordering.')
}

async function main() {
  for (const v of ['FTS_SEARCH_URL', 'GEMINI_API_KEY']) {
    if (!process.env[v]) { console.error(`${v} is not set — this measures the LIVE ranking and cannot run without it.`); process.exit(1) }
  }
  console.log(`router=${process.env.LEX_QUERY_ROUTER ?? '(unset)'} vectorStreams=${process.env.LEX_VECTOR_STREAMS ?? '(unset)'} vectorUrl=${process.env.VECTOR_SEARCH_URL ? 'set' : 'UNSET'}\n`)
  if (arg('benchmark')) await benchmark()
  else await scorePreferences()
}

main().catch((e) => { console.error(e); process.exit(1) })
