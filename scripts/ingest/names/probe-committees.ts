import { getNeonPool, endNeonPool } from '../shared/neon-pool'
;(async () => {
  const p = getNeonPool()
  for (const c of ['committees-evidence','committees-reports']) {
    const r = (await p.query(
      `SELECT COUNT(*)::int n, COUNT(notes)::int with_notes, COUNT("sectionTitle")::int titled,
              COUNT(speaker)::int spk, COUNT(attribution)::int attr, COUNT("parentDocId")::int parent
         FROM corpus_sections WHERE corpus=$1`, [c])).rows[0]
    console.log(`\n=== ${c}`, JSON.stringify(r))
    const s = (await p.query(
      `SELECT id, "sectionTitle", "parentDocId", notes, "sourceUrl", format, "wordCount"
         FROM corpus_sections WHERE corpus=$1 ORDER BY md5(id) LIMIT 6`, [c])).rows
    for (const x of s) {
      console.log(`  id=${x.id}`)
      console.log(`    title=${JSON.stringify(x.sectionTitle)}`)
      console.log(`    parentDocId=${JSON.stringify(x.parentDocId)}  format=${x.format} words=${x.wordCount}`)
      console.log(`    sourceUrl=${x.sourceUrl}`)
      console.log(`    notes=${x.notes ? String(x.notes).slice(0,300) : 'null'}`)
    }
  }
  await endNeonPool()
})().catch(e => { console.error(e); process.exit(1) })
