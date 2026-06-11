import { getNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const q1 = await pool.query(`SELECT status, count(*)::int n FROM ingest_queue WHERE corpus='retained-eu' GROUP BY status`)
  console.table(q1.rows)
  const q2 = await pool.query(`SELECT "sourceKey", suspended, "suspendedUntil" FROM source_rate_limits WHERE "sourceKey"='tna-legislation'`)
  console.table(q2.rows)
  const q3 = await pool.query(`SELECT corpus, status, count(*)::int n FROM ingest_queue WHERE corpus LIKE 'pwdata%' GROUP BY corpus, status ORDER BY corpus`)
  console.table(q3.rows)
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
