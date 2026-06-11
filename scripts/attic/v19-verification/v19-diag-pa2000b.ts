import { getNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const r = await pool.query(`SELECT status, count(*)::int n FROM corpus_sections WHERE corpus='primary-acts-pre-2000' GROUP BY status`)
  console.table(r.rows)
  const s = await pool.query(`SELECT id, status, availability_status FROM corpus_sections WHERE corpus='primary-acts-pre-2000' AND status <> 'compiled' LIMIT 10`)
  console.table(s.rows)
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
