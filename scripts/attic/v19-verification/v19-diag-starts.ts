async function main() {
  const { getNeonPool } = await import('../../ingest/shared/neon-pool')
  const pool = getNeonPool()
  const r = await pool.query(`SELECT * FROM ingest_service_state`)
  console.log(JSON.stringify(r.rows, null, 1))
  // gap analysis on done timestamps: a restart shows as a 1-3 min processing gap
  const g = await pool.query(`
    SELECT date_trunc('minute', "completedAt") AS m, count(*)::int n
    FROM ingest_queue WHERE "completedAt" > '2026-06-11T16:40:00Z' AND "completedAt" < '2026-06-11T17:10:00Z'
    GROUP BY 1 ORDER BY 1`)
  console.table(g.rows)
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
