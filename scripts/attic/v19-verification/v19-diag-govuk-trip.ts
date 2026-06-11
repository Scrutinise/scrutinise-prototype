import { getNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const t = await pool.query(`SELECT source_key, state, trip_reason, tripped_at FROM source_status WHERE source_key='govuk-content'`)
  console.log(JSON.stringify(t.rows, null, 1))
  const f = await pool.query(`
    SELECT "lastError", count(*)::int n FROM ingest_queue
    WHERE corpus='et-decisions' AND status='failed' GROUP BY 1 ORDER BY n DESC LIMIT 5`)
  console.table(f.rows)
  const blocked = await pool.query(`SELECT corpus, count(*)::int n FROM ingest_queue WHERE status='blocked' GROUP BY corpus`)
  console.table(blocked.rows)
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
