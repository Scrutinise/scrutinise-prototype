async function main() {
  const { getNeonPool } = await import('../../ingest/shared/neon-pool')
  const pool = getNeonPool()
  const q = await pool.query(`SELECT status, count(*)::int n FROM ingest_queue WHERE corpus='retained-eu' GROUP BY status`)
  console.table(q.rows)
  const docs = await pool.query(`SELECT count(DISTINCT split_part(id,':',2))::int docs, count(*)::int sections FROM corpus_sections WHERE corpus='retained-eu'`)
  console.table(docs.rows)
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
