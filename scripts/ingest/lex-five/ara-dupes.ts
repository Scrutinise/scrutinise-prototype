/**
 * ara-dupes.ts — INGEST_LEX_FIVE §2. Within one `departmental-accounts` document, PDF sections whose word counts
 * are within 3% of each other are the same report in another typesetting (accessible / print / web variants not
 * titled "print ready"). Dry run lists them with their titles; `--delete` removes the smaller-or-later copies
 * from corpus_sections ONLY (R2 text is left, so it is reversible by re-running run-ara.ts after the filter).
 */
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
const DELETE = process.argv.includes('--delete')
async function main() {
  const pool = getNeonPool()
  const { rows } = await pool.query(`select id, "parentDocId" p, "sectionTitle" t, "wordCount" w, "sourceUrl" u from corpus_sections where corpus='departmental-accounts' and format='pdf' order by "parentDocId", id`)
  const by = new Map<string, any[]>()
  for (const r of rows) by.set(r.p, [...(by.get(r.p) ?? []), r])
  const drop: string[] = []
  const shown: string[] = []
  for (const [p, secs] of by) {
    const kept: any[] = []
    for (const s of secs) {
      // a 72-word correction slip is its own document, not a twin of another 72-word slip
      const twin = s.w >= 1000 ? kept.find(k => k.w >= 1000 && Math.abs(k.w - s.w) <= 0.03 * Math.max(k.w, s.w)) : undefined
      if (twin) { drop.push(s.id); if (shown.length < 12) shown.push(`${p}\n     keep ${twin.w} "${twin.t}" ${twin.u.split('/').pop()}\n     drop ${s.w} "${s.t}" ${s.u.split('/').pop()}`) }
      else kept.push(s)
    }
  }
  console.log(`pdf sections ${rows.length} in ${by.size} documents; near-duplicate (within 3%) sections: ${drop.length}`)
  shown.forEach(s => console.log('  ' + s))
  if (DELETE) {
    const r = await pool.query(`delete from corpus_sections where corpus='departmental-accounts' and id = any($1::text[])`, [drop])
    console.log('deleted', r.rowCount)
    const a = await pool.query(`select count(*)::int n, sum("wordCount")::bigint w from corpus_sections where corpus='departmental-accounts'`)
    console.log('after', JSON.stringify(a.rows[0]))
  }
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
