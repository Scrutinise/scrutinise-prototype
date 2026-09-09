/** l2-dotverify.ts — READ-ONLY. Verify the two numbers the projection rests on. */
import { pool } from './db'
const LEG = ['primary-acts-pre-2000','primary-acts-2000plus','si-pre-2010','si-2010plus','regional','retained-eu']
const CUR = 'si-pre-2010:uksi/2009/994:article-2'
;(async () => {
  const p = pool()
  const q = async (s: string, a: any[] = []) => (await p.query(s, a)).rows
  console.log('=== per-corpus: total vs what the census could see vs what it read ===')
  console.log(await q(`
    select corpus, count(*)::int total,
      count(*) filter (where status='compiled' and "r2Key" is not null)::int censusable
    from corpus_sections where corpus = any($1) group by 1 order by 1`, [LEG]))
  console.log('\n=== did the census finish? rows the cursor never reached ===')
  console.log(await q(`
    select count(*)::int beyond_cursor from corpus_sections
    where corpus = any($1) and status='compiled' and "r2Key" is not null and id > $2`, [LEG, CUR]))
  console.log('\n=== censusable total vs checkpoint read=1,563,090 ===')
  console.log(await q(`
    select count(*)::int censusable_total from corpus_sections
    where corpus = any($1) and status='compiled' and "r2Key" is not null`, [LEG]))
  await p.end()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
