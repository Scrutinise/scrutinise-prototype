import { getNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const r = await pool.query(`
    SELECT count(*)::int n FROM ingest_queue q
    WHERE q.corpus='hmrc-manuals' AND q.status='done'
    AND NOT EXISTS (SELECT 1 FROM corpus_sections s WHERE s.corpus='hmrc-manuals' AND split_part(s.id,':',2)=q."docId")`)
  console.log('hmrc-manuals done rows with zero sections:', r.rows[0])
  const sample = await pool.query(`
    SELECT q."docId" FROM ingest_queue q
    WHERE q.corpus='hmrc-manuals' AND q.status='done'
    AND NOT EXISTS (SELECT 1 FROM corpus_sections s WHERE s.corpus='hmrc-manuals' AND split_part(s.id,':',2)=q."docId")
    ORDER BY random() LIMIT 100`)
  console.log(JSON.stringify(sample.rows.map(x => x.docId)))
  const tot = await pool.query(`SELECT count(*)::int done FROM ingest_queue WHERE corpus='hmrc-manuals' AND status='done'`)
  const sec = await pool.query(`SELECT count(*)::int sections, count(DISTINCT split_part(id,':',2))::int docs FROM corpus_sections WHERE corpus='hmrc-manuals'`)
  console.log('queue done:', tot.rows[0], 'sections:', sec.rows[0])
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
