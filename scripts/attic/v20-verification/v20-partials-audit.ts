import { getNeonPool, endNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const corpora = ['written-statements','college-of-policing','sentencing-council','building-regs','planning-policy','nilawcom','hmrc-tiins']
  const r = await pool.query(`
    SELECT corpus, status, format, count(*)::int n FROM corpus_sections
    WHERE corpus = ANY($1) GROUP BY corpus, status, format ORDER BY corpus, n DESC`, [corpora])
  console.table(r.rows)
  const q = await pool.query(`
    SELECT corpus, status, count(*)::int n FROM ingest_queue
    WHERE corpus = ANY($1) GROUP BY corpus, status ORDER BY corpus`, [corpora])
  console.log('queue rows:'); console.table(q.rows)
  // The 791 coincidence: do these three corpora share section ids/docs?
  const s = await pool.query(`
    SELECT corpus, min(id) sample_id, max("createdAt")::date latest, count(DISTINCT split_part(id,':',2))::int docs
    FROM corpus_sections WHERE corpus = ANY($2) GROUP BY corpus`, )
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
