import { getNeonPool, endNeonPool } from './shared/neon-pool'
async function main(){
  const pool=getNeonPool()
  // proxy: 512KB text ~ 85k words; flag corpora with large max/section
  const r=await pool.query(`
    SELECT corpus,
      COUNT(*)::int n,
      MAX("wordCount")::int maxwc,
      ROUND(AVG("wordCount"))::int avgwc,
      COUNT(*) FILTER (WHERE "wordCount" > 85000)::int over512k,
      COUNT(*) FILTER (WHERE "wordCount" > 20000)::int over20k
    FROM corpus_sections WHERE status='compiled'
    GROUP BY corpus HAVING MAX("wordCount") > 20000
    ORDER BY maxwc DESC`)
  console.log('corpora with any section >20k words (oversized-blob candidates):')
  console.log('corpus | n | maxWC | avgWC | >512KB(~85kw) | >20kw')
  for(const x of r.rows) console.log(`  ${x.corpus} | ${x.n} | ${x.maxwc} | ${x.avgwc} | ${x.over512k} | ${x.over20k}`)
  // written-answers/statements queue sourceType + row form
  const q=await pool.query(`SELECT corpus, "sourceType", COUNT(*)::int n FROM ingest_queue WHERE corpus IN ('written-answers','written-statements') GROUP BY 1,2`)
  console.log('\nwritten-answers/statements queue rows:', q.rows)
  await endNeonPool()
}
main().catch(e=>{console.error(e);process.exit(1)})
