import { getNeonPool, endNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const q = await pool.query(`SELECT status, count(*)::int n FROM ingest_queue WHERE corpus='ni-judgments' GROUP BY status`)
  console.table(q.rows)
  const del = await pool.query(`DELETE FROM corpus_sections WHERE corpus='ni-judgments' AND "parentDocId" LIKE 'judiciary/%'`)
  console.log('junk ni sections deleted:', del.rowCount)
  const c = await pool.query(`SELECT corpus, status, count(*)::int n FROM corpus_sections WHERE corpus IN ('committees-reports','committees-evidence','tax-tribunals','ni-judgments') GROUP BY corpus, status ORDER BY corpus`)
  console.table(c.rows)
  const qq = await pool.query(`SELECT corpus, status, count(*)::int n FROM ingest_queue WHERE corpus IN ('committees-reports','committees-evidence','tax-tribunals','ni-judgments') GROUP BY corpus, status ORDER BY corpus, status`)
  console.table(qq.rows)
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
