import { getNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const r = await pool.query(`
    SELECT status, count(*)::int n FROM ingest_queue
    WHERE corpus='tna-caselaw' AND "docId" LIKE 'court:%' GROUP BY status`)
  console.table(r.rows)
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
