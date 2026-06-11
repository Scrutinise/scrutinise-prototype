async function main() {
  const { getNeonPool } = await import('../../ingest/shared/neon-pool')
  const pool = getNeonPool()
  const r = await pool.query(`
    SELECT date_trunc('hour', "createdAt") AS created_hour, status, count(*)::int n
    FROM ingest_queue WHERE corpus='retained-eu'
    GROUP BY 1,2 ORDER BY 1 DESC, 2 LIMIT 12`)
  console.table(r.rows)
  const s = await pool.query(`
    SELECT split_part("docId",'/',1) AS typ, count(*)::int n,
           min("docId") AS sample
    FROM ingest_queue WHERE corpus='retained-eu' AND status='pending'
    GROUP BY 1 ORDER BY n DESC LIMIT 8`)
  console.table(s.rows)
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
