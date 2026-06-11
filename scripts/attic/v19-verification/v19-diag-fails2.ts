import { getNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const f = await pool.query(`
    SELECT substring("lastError" for 90) AS err, count(*)::int n FROM ingest_queue
    WHERE corpus='et-decisions' AND status='failed' GROUP BY 1 ORDER BY n DESC LIMIT 5`)
  console.table(f.rows)
  const l = await pool.query(`SELECT "docId", "lastError" FROM ingest_queue WHERE corpus='lda-commonsoralquestions' AND status='failed'`)
  console.table(l.rows)
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
