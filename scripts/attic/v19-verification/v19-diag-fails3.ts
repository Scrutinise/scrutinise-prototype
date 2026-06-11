import { getNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const f = await pool.query(`
    SELECT right("lastError", 12) AS tail, count(*)::int n FROM ingest_queue
    WHERE corpus='et-decisions' AND status='failed' GROUP BY 1 ORDER BY n DESC LIMIT 6`)
  console.table(f.rows)
  // close the legitimately-empty LDA boundary page
  await pool.query(`UPDATE ingest_queue SET status='skipped', "lastError"='V19: page beyond live extent (LDA pages are 0-indexed; 0-140 covers 70,040 records)' WHERE id='lda-commonsoralquestions:page:141'`)
  console.log('lda page:141 closed as skipped (0-indexed paging; beyond extent)')
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
