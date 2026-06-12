import { getNeonPool, endNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const r = await pool.query(`SELECT "docId", "lastError" FROM ingest_queue WHERE corpus='ni-judgments' AND status='failed'`)
  for (const row of r.rows) console.log(row.docId, '::', (row.lastError ?? '').slice(0, 120))
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
