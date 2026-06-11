import { getNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const notes = await pool.query(`
    SELECT availability_note, count(*)::int n FROM corpus_sections
    WHERE corpus='hmrc-manuals' AND status<>'compiled' GROUP BY 1 ORDER BY n DESC LIMIT 5`)
  console.table(notes.rows)
  const sample = await pool.query(`
    SELECT split_part(id,':',2) AS doc FROM corpus_sections
    WHERE corpus='hmrc-manuals' AND status<>'compiled' ORDER BY random() LIMIT 100`)
  console.log(JSON.stringify(sample.rows.map(r => r.doc)))
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
