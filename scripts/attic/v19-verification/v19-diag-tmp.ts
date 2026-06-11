import { getNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const r = await pool.query(`SELECT id, corpus, "docId", "sourceType", status, priority FROM ingest_queue WHERE corpus='retained-eu' ORDER BY "completedAt" DESC NULLS LAST LIMIT 5`)
  console.table(r.rows)
  const c = await pool.query(`SELECT status, count(*)::int n FROM ingest_queue WHERE corpus='retained-eu' GROUP BY status`)
  console.table(c.rows)
  const s = await pool.query(`SELECT count(DISTINCT split_part(id,':',2))::int AS docs, count(*)::int AS sections, count(*) FILTER (WHERE availability_status <> 'full')::int AS markers FROM corpus_sections WHERE corpus='retained-eu'`)
  console.table(s.rows)
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
