/** l2-reconcile.ts — READ-ONLY. Resolve the 248,742 gap vs C1's 18,272,452, and define dot leaders. */
import { pool } from './db'
;(async () => {
  const p = pool()
  const q = async (s: string, a: any[] = []) => (await p.query(s, a)).rows

  console.log('=== status distribution ===')
  console.log(await q(`select status, count(*)::int n from corpus_sections group by 1 order by 2 desc`))

  console.log('\n=== availability_status ===')
  console.log(await q(
    `select availability_status, count(*)::int n from corpus_sections group by 1 order by 2 desc limit 8`))

  console.log('\n=== createdAt nulls / range ===')
  console.log(await q(`select count(*) filter (where "createdAt" is null)::int nulls,
    min("createdAt")::text lo, max("createdAt")::text hi from corpus_sections`))

  console.log('\n=== C1 A2 arithmetic: compiled only ===')
  console.log(await q(`select count(*) filter (where status='compiled')::int compiled,
    count(*)::int all_rows from corpus_sections`))

  console.log('\n=== dot leaders: candidate definitions ===')
  console.log(await q(`select
      count(*) filter (where "wordCount" <= 1)::int wc_le_1,
      count(*) filter (where "wordCount" = 1)::int wc_eq_1,
      count(*) filter (where "wordCount" = 0)::int wc_eq_0,
      count(*) filter (where "wordCount" <= 3)::int wc_le_3
    from corpus_sections`))
  console.log('\n-- restricted to legislation-ish corpora --')
  console.log(await q(`select corpus, count(*)::int n from corpus_sections
    where "wordCount" <= 1 group by 1 order by 2 desc`))
  await p.end()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
