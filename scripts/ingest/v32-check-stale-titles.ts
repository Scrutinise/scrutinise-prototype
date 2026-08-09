/**
 * v32-check-stale-titles.ts — read-only: do rows ALREADY in corpus_fts hold the truncated
 * committee name that the metadata-pass fix has since repaired in Neon?
 *
 * WHY IT MATTERS: fts-catchup only ever APPENDS ids missing from the index; it does not update a
 * row that is already there. The heavy-job merge rebuilds the inverted index over existing
 * fragments and does not re-read Neon either. So a row indexed BEFORE the repair keeps its cut
 * name ("… — Se") in the index for good, and stays unfindable by committee — the §D failure.
 *
 * The candidate population is the 895 non-`arc-` rows sitting at exactly 500 chars that were
 * created before the 2026-08-07 19:50 catch-up.
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { connectLance, FTS_TABLE } from './search/lance'

async function main() {
  const p = getNeonPool()
  const { rows: cands } = await p.query<{ id: string; sectionTitle: string }>(
    `SELECT id, "sectionTitle" FROM corpus_sections
     WHERE corpus='committees-reports' AND status='compiled'
       AND length("sectionTitle")=500 AND id NOT LIKE '%:arc-%'
       AND "createdAt" < timestamp '2026-08-07 19:50'
     ORDER BY id`)
  console.log(`  candidate rows in Neon: ${cands.length}`)
  if (cands.length === 0) { await endNeonPool(); return }

  const db = await connectLance()
  const tbl = await db.openTable(FTS_TABLE)

  // Chunked IN-list: ask the index for exactly these ids and compare titles.
  let inIndex = 0, stale = 0, fresh = 0
  const samples: string[] = []
  const byId = new Map(cands.map(c => [c.id, c.sectionTitle]))
  const ids = cands.map(c => c.id)
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200)
    const list = chunk.map(id => `'${id.replace(/'/g, "''")}'`).join(',')
    const res = await tbl.query().where(`id IN (${list})`).select(['id', 'sectionTitle']).toArray()
    for (const r of res as any[]) {
      inIndex++
      const neonTitle = byId.get(r.id)
      if (neonTitle !== r.sectionTitle) {
        stale++
        if (samples.length < 5) samples.push(`  id=${r.id}\n    index: …${String(r.sectionTitle).slice(-70)}\n    neon : …${String(neonTitle).slice(-70)}`)
      } else fresh++
    }
  }

  console.log(`  present in the index      ${inIndex}`)
  console.log(`    title MATCHES Neon      ${fresh}`)
  console.log(`    title STALE vs Neon     ${stale}  ← unfindable by committee until re-indexed`)
  console.log(`  absent from the index     ${cands.length - inIndex}  (catch-up will add these correctly)`)
  if (samples.length) { console.log(`\n  samples:`); samples.forEach(s => console.log(s)) }

  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
