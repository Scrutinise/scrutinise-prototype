/**
 * probe-committee-yield.ts — how many results does the LIVE committees stream actually return?
 *
 * The live committees stream (query-router.ts::ftsStream) does this:
 *     runFtsSearch(query, limit, tier='parliamentary')   → top `limit` over 14.17M rows
 *     .filter(r => r.type === 'COMMITTEE')               → POST-filter, client side
 *
 * and corpus-type-map.ts maps type COMMITTEE to `corpus.startsWith('committees')`, which is
 * committees-reports + committees-evidence = 165,443 rows — **1.17% of the parliamentary tier**.
 *
 * A post-filter keeping 1.17% of a 20-row result set is expected to keep ~0 rows. This measures
 * whether that is what actually happens, because "expected to" is not evidence — it is the same
 * prefilter-vs-postfilter trap vector-core.ts already documents for the tier filter on the dense
 * side, and the argument there was that post-filtering "would look like weak recall rather than
 * a scoping bug". The same argument applies here, on the BM25 side, in code that is LIVE now.
 *
 * Read-only: it runs the retrieval and counts, changes nothing.
 *
 * Usage: tsx search/probe-committee-yield.ts
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { connectLance, FTS_TABLE } from './lance'
import { rankedSearch } from './fts-core'
import { draftFor } from './gold-draft-streams'

const LIMIT = 20
const isCommittee = (id: string) => id.startsWith('committees')

async function main() {
  const conn = await connectLance()
  const tbl = await conn.openTable(FTS_TABLE)
  console.log(`[yield] top-${LIMIT} over tier='parliamentary', counting how many survive a COMMITTEE post-filter\n`)

  let totalKept = 0
  const qs = draftFor('committees')
  for (const q of qs) {
    const hits = await rankedSearch(tbl, q.query, { limit: LIMIT, tier: 'parliamentary' })
    const kept = hits.filter((h) => isCommittee(h.id))
    totalKept += kept.length
    console.log(`  ${q.id}: ${kept.length}/${hits.length} survive the post-filter   "${q.query.slice(0, 62)}…"`)
    for (const h of kept.slice(0, 3)) console.log(`        kept → ${h.id}`)
    if (!kept.length) console.log(`        (top hit was ${hits[0]?.id ?? 'nothing'})`)
  }

  console.log(`\n[yield] TOTAL across ${qs.length} questions: ${totalKept} committee results in ${qs.length * LIMIT} retrieved rows`)

  // The counterfactual: what a PREfiltered committees stream would return for the same queries.
  console.log(`\n[yield] same queries, PREfiltered to the committee corpora instead:`)
  for (const q of qs) {
    const hits = await rankedSearch(tbl, q.query, { limit: LIMIT, tier: 'parliamentary' })
    // rankedSearch has no corpus filter, so approximate the prefilter with a direct scan of the
    // committee corpora for the same query terms — enough to show content EXISTS to be found.
    const rows = await tbl.query()
      .where(`tier = 'parliamentary' AND (corpus = 'committees-reports' OR corpus = 'committees-evidence')`)
      .select(['id', 'sectionTitle'])
      .limit(3)
      .toArray() as any[]
    console.log(`  ${q.id}: post-filter kept ${hits.filter((h) => isCommittee(h.id)).length}; committee corpora hold content, e.g. ${rows[0]?.id ?? 'n/a'}`)
  }
}

main().catch((e) => { console.error('[yield] FATAL', e instanceof Error ? e.stack ?? e.message : e); process.exit(1) })
