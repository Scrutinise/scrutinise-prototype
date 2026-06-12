import { getNeonPool, endNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const corpora = ['written-statements','college-of-policing','sentencing-council','building-regs','planning-policy','nilawcom','hmrc-tiins','written-answers']
  const r = await pool.query(`
    SELECT corpus, count(*)::int sections, count(DISTINCT split_part(id,':',2))::int docs,
           min("createdAt")::date first, max("createdAt")::date last,
           min(id) sample_id, round(avg("wordCount"))::int avg_words, round(stddev("wordCount"))::int sd_words
    FROM corpus_sections WHERE corpus = ANY($1) GROUP BY corpus ORDER BY corpus`, [corpora])
  console.table(r.rows)
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
