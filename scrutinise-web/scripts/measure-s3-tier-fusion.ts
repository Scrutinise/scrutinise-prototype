/**
 * measure-s3-tier-fusion.ts — S3 §1 requirement 3: before and after, same questions.
 *
 * The change: a tier-scoped caller used to reach `runFtsSearch` (BM25 only) because
 * per-stream fusion lived inside `runRoutedSearch`, which the tier-scoped branch never
 * called. The three legacy legislation surfaces therefore had the router's query
 * REWRITE and no dense retrieval at all.
 *
 *   BEFORE = runFtsSearch(keywords, limit, 'legislation')      ← exactly the old path
 *   AFTER  = STREAMS['legislation'].search(query, limit)       ← BM25 + dense, same scope
 *
 * Both are called directly rather than by toggling a flag, so the comparison is of the
 * two retrieval calls themselves and cannot drift with unrelated gateway behaviour.
 *
 * "This ships with a before-and-after or not at all" — so this reports content overlap,
 * what each side finds that the other does not, and latency. It does NOT declare a
 * winner: a document appearing is not the same as a better answer, and only the gold
 * set can say that.
 *
 * Usage:
 *   LEX_QUERY_ROUTER=true FTS_SEARCH_URL=… LEX_VECTOR_STREAMS=legislation \
 *     npx tsx --env-file=.env --tsconfig tsconfig.json scripts/measure-s3-tier-fusion.ts
 */
import { runFtsSearch } from '../lib/lex/fts-search'
import { STREAMS, perStreamVectorActive } from '../lib/lex/query-router'
import { assertRetrievalConfig, resolvedConfigLine } from '../lib/lex/harness-preflight'
import type { SearchResult } from '../lib/lex/page1-config'

const LIMIT = 16

// The questions the legacy surfaces actually get: legislation lookups on the Lex chat
// route and the panel. The Companies Act one is deliberate — it is the query the brief
// warned might REGRESS on the corpus path, and V36 is what settled that.
const QUESTIONS: string[] = [
  'companies act 2006 directors duties',
  'data protection lawful basis personal data',
  'equality act public sector equality duty',
  'planning permission change of use',
  'employment rights unfair dismissal qualifying period',
  'environmental permitting waste operations',
  'freedom of information exemptions public interest',
  'consumer rights act digital content',
]

const idsOf = (rs: SearchResult[]) => rs.map((r) => String(r.id))
const titleOf = (r: SearchResult) => String(r.title ?? r.citation ?? r.id).slice(0, 62)

async function main() {
  assertRetrievalConfig('measure-s3-tier-fusion')
  console.log(`dense per-stream active: ${perStreamVectorActive()}`)
  const stream = STREAMS.find((s) => s.name === 'legislation')
  if (!stream) throw new Error('no legislation stream configured')

  let totalBefore = 0, totalAfter = 0, totalOverlap = 0, tBefore = 0, tAfter = 0
  const newFinds: string[] = []
  const lostFinds: string[] = []

  for (const q of QUESTIONS) {
    const kw = q.split(/\s+/)

    const t0 = Date.now()
    const before = (await runFtsSearch(kw, LIMIT, 'legislation').catch(() => ({ results: [] as SearchResult[] }))).results
    const t1 = Date.now()
    const after = await stream.search(q, LIMIT).catch(() => [] as SearchResult[])
    const t2 = Date.now()

    const b = new Set(idsOf(before)), a = new Set(idsOf(after))
    const overlap = [...a].filter((x) => b.has(x)).length
    const onlyAfter = after.filter((r) => !b.has(String(r.id)))
    const onlyBefore = before.filter((r) => !a.has(String(r.id)))

    totalBefore += before.length; totalAfter += after.length; totalOverlap += overlap
    tBefore += t1 - t0; tAfter += t2 - t1

    console.log(`\n"${q}"`)
    console.log(`  before ${String(before.length).padStart(3)} · after ${String(after.length).padStart(3)} · overlap ${overlap}` +
      `  |  ${t1 - t0}ms → ${t2 - t1}ms`)
    if (onlyAfter.length) {
      console.log(`  NEW in after (${onlyAfter.length}):`)
      for (const r of onlyAfter.slice(0, 3)) console.log(`    + ${titleOf(r)}`)
      newFinds.push(...onlyAfter.slice(0, 1).map(titleOf))
    }
    if (onlyBefore.length) {
      console.log(`  LOST from before (${onlyBefore.length}):`)
      for (const r of onlyBefore.slice(0, 3)) console.log(`    − ${titleOf(r)}`)
      lostFinds.push(...onlyBefore.slice(0, 1).map(titleOf))
    }
  }

  const n = QUESTIONS.length
  console.log(`\n════ S3 §1 — TIER-SCOPED BM25 vs TIER-SCOPED FUSED ════`)
  console.log(`  ${resolvedConfigLine()}`)
  console.log(`  results/query   before ${(totalBefore / n).toFixed(1)}   after ${(totalAfter / n).toFixed(1)}`)
  console.log(`  overlap/query   ${(totalOverlap / n).toFixed(1)} of ${LIMIT}`)
  console.log(`  latency/query   before ${(tBefore / n).toFixed(0)}ms   after ${(tAfter / n).toFixed(0)}ms` +
    `   (${tAfter > tBefore ? '+' : ''}${(((tAfter - tBefore) / Math.max(tBefore, 1)) * 100).toFixed(0)}%)`)
  console.log(`\n  ⚠ Documents appearing is not the same as answers improving. This says WHAT`)
  console.log(`    changed and at what latency cost; whether it is better is the gold set's`)
  console.log(`    question, and the gold key is still the binding constraint there.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
