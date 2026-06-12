import { getNeonPool, endNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const r = await pool.query(`SELECT corpus_key, est_sections, est_is_confirmed, retired, blocked FROM corpus_targets WHERE corpus_key LIKE '%written%' OR corpus_key LIKE '%answer%'`)
  console.table(r.rows)
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
