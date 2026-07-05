/**
 * score-gold-d.ts — re-score gold archetype D ([GRAPH], floored at 0 for text
 * search) through the edge traversal.
 *
 * Method mirrors score-fts.ts: each D query's expected-sources count as
 * RETRIEVED if any pattern matches the traversal output haystack. The target
 * gid/section is derived from the query text by the SAME production-detectable
 * citation resolver the search stack uses (parseCitation → ActIndex →
 * resolveCitation) — no hand-mapping, so this measures what a wired-up Lex
 * could actually do.
 *
 * Haystack per query = every impact-set edge's `id + title + subType + detail`
 * (both directions, both depths) — the graph answer, not BM25 rows.
 *
 *   npx tsx graph/score-gold-d.ts
 */
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { GOLD } from '../search/gold-queries'
import { ActIndex, ResolvedCitation, loadActIndex, parseCitation, resolveCitation } from '../search/citation-resolver'
import { impactSet, ImpactEdge } from './traverse-edges'

/** parseCitation's ACT_RX anchors on the EARLIEST 8-word window ending in
 *  "<act-kw> YYYY", which on D-style phrasings ("List the statutory instruments
 *  made under the Building Safety Act 2022") captures a junk prefix and
 *  resolves to nothing. Fallback: take the Title-Case run ending in the act
 *  keyword + year ("Building Safety Act 2022") — what an intent router in
 *  front of the graph would extract. Section ref still comes from
 *  parseCitation where present. */
function resolveTarget(query: string, idx: ActIndex): ResolvedCitation | null {
  const parsed = parseCitation(query)
  const direct = parsed ? resolveCitation(parsed, idx) : null
  if (direct) return direct
  const cap = query.match(/\b((?:[A-Z][\w'’()-]*\s+)+?(?:Act|Regulations|Order|Rules|Measure|Scheme)\s+\d{4})\b/)
  if (!cap) return null
  return resolveCitation({ actPhrase: cap[1], refToken: parsed?.refToken ?? null, refNum: parsed?.refNum ?? null }, idx)
}

async function main() {
  const pool = getNeonPool()
  const actIndex = await loadActIndex(pool)
  const dQueries = GOLD.filter(q => q.archetype === 'D')
  console.log(`[score-d] ${dQueries.length} archetype-D queries; act index ${actIndex.byTitle.size} titles\n`)

  let retrievedTotal = 0
  let expectedTotal = 0
  const perQuery: Array<{ id: string; retrieved: number; expected: number; note: string }> = []

  for (const q of dQueries) {
    const resolved = resolveTarget(q.query, actIndex)
    if (!resolved) {
      perQuery.push({ id: q.id, retrieved: 0, expected: q.expected.length, note: 'citation resolver found no target in query' })
      expectedTotal += q.expected.length
      console.log(`${q.id}: NO TARGET RESOLVED — "${q.query}"`)
      continue
    }
    const sectionRef = resolved.refToken && resolved.refNum ? `${resolved.refToken}-${resolved.refNum}` : null
    const impact = await impactSet(pool, resolved.gid, sectionRef, { depth: 2, limitPerGroup: 2000 })

    const edges: ImpactEdge[] = [...Object.values(impact.direct).flat(), ...Object.values(impact.oneHop).flat()]
    const haystack = edges.map(e => `${e.id}\n${e.title ?? ''}\n${e.subType}\n${e.detail ?? ''}`).join('\n')
      + `\n${impact.target.gid}\n${impact.target.title ?? ''}` // the resolved anchor itself counts (D2/D3/D4 expect it)

    let retrieved = 0
    const misses: string[] = []
    for (const src of q.expected) {
      if (src.patterns.some(p => p.test(haystack))) retrieved++
      else misses.push(src.label)
    }
    retrievedTotal += retrieved
    expectedTotal += q.expected.length
    perQuery.push({ id: q.id, retrieved, expected: q.expected.length, note: misses.length ? `missing: ${misses.join('; ')}` : 'all found' })

    console.log(`${q.id}: target=${resolved.gid}${sectionRef ? ':' + sectionRef : ''}  edges=${edges.length}  ${retrieved}/${q.expected.length}${misses.length ? `  MISSING: ${misses.join('; ')}` : '  ✓'}`)
    console.log(`    counts=${JSON.stringify(impact.counts)}`)
  }

  console.log(`\n[score-d] HEADLINE: ${retrievedTotal}/${expectedTotal} expected sources retrieved (${(100 * retrievedTotal / Math.max(1, expectedTotal)).toFixed(1)}%)`)
  console.log('[score-d] v1 baseline for D: 0% (floor — text search cannot answer [GRAPH])')
  for (const r of perQuery) console.log(`  ${r.id}  ${r.retrieved}/${r.expected}  ${r.note}`)
  await endNeonPool()
}
main().catch(e => { console.error('[score-d] FATAL', e); process.exit(1) })
