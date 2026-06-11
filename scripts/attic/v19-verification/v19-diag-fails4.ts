import { getNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const f = await pool.query(`
    SELECT date_trunc('minute', "completedAt") AS minute, count(*)::int fails
    FROM ingest_queue WHERE corpus='et-decisions' AND status='failed'
    GROUP BY 1 ORDER BY 1 DESC LIMIT 10`)
  console.table(f.rows)
  const ok = await pool.query(`
    SELECT date_trunc('minute', "completedAt") AS minute, count(*)::int done
    FROM ingest_queue WHERE corpus='et-decisions' AND status='done'
    GROUP BY 1 ORDER BY 1 DESC LIMIT 5`)
  console.table(ok.rows)
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
