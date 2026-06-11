import { getNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const r = await pool.query(`SELECT id, availability_note FROM corpus_sections WHERE corpus='primary-acts-pre-2000' AND status='failed' LIMIT 30`)
  console.table(r.rows)
  const u = await pool.query(`SELECT availability_note, count(*)::int n FROM corpus_sections WHERE corpus='primary-acts-pre-2000' AND status='unavailable' GROUP BY 1 ORDER BY n DESC LIMIT 10`)
  console.table(u.rows)
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
