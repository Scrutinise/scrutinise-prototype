import { getNeonPool, endNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const q = await pool.query(`DELETE FROM ingest_queue WHERE corpus='ni-judgments' AND "docId" LIKE '%/%'`)
  console.log('facet queue rows deleted:', q.rowCount)
  const s = await pool.query(`DELETE FROM corpus_sections WHERE corpus='ni-judgments' AND "parentDocId" LIKE '%/%'`)
  console.log('facet sections deleted:', s.rowCount)
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
