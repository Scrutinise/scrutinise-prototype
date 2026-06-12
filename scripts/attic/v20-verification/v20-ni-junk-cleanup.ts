import { getNeonPool, endNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const r = await pool.query(`DELETE FROM ingest_queue WHERE corpus='ni-judgments' AND "docId" LIKE 'judiciary/%'`)
  console.log('junk ni rows deleted:', r.rowCount)
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
