import { getNeonPool, endNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const r = await pool.query(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename='corpus_sections'`)
  for (const row of r.rows) console.log(row.indexname, '::', row.indexdef)
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
