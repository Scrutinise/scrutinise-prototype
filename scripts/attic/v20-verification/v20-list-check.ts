import { getNeonPool, endNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const r = await pool.query(`
    SELECT status, count(*)::int n FROM ingest_queue
    WHERE corpus='committees-evidence' AND "docId" LIKE 'list:%' GROUP BY status`)
  console.table(r.rows)
  const e = await pool.query(`
    SELECT "lastError", count(*)::int n FROM ingest_queue
    WHERE corpus='committees-evidence' AND "docId" LIKE 'list:%' AND status='failed' GROUP BY "lastError" LIMIT 3`)
  if (e.rows.length) console.table(e.rows)
  const b = await pool.query(`SELECT source_key, state FROM source_status WHERE source_key='committees-api'`)
  console.table(b.rows)
  const q = await pool.query(`
    SELECT corpus, status, count(*)::int n FROM ingest_queue
    WHERE corpus IN ('committees-evidence','committees-reports') GROUP BY corpus, status ORDER BY corpus, status`)
  console.table(q.rows)
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
