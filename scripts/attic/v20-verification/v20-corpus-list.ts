import { getNeonPool, endNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const r = await pool.query(`SELECT corpus, count(*)::int n FROM corpus_sections GROUP BY corpus ORDER BY n DESC`)
  console.table(r.rows)
  const c = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='corpus_sections' ORDER BY ordinal_position`)
  console.table(c.rows)
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
