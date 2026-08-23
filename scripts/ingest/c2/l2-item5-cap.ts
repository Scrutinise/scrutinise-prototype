/** l2-item5-cap.ts — READ-ONLY. Is written-answers capped at 5,000/month, and is it covered
 *  by pwdata-wrans anyway? */
import { pool } from './db'
import { r2Get } from '../shared/r2-client'
;(async () => {
  const p = pool()
  const q = async (s: string, a: any[] = []) => (await p.query(s, a)).rows
  const rows = await q(`select id, "r2Key", "wordCount" from corpus_sections
    where corpus='written-answers' and "r2Key" is not null order by "wordCount" desc limit 10`)
  console.log('=== separator counts in the 10 largest rows (5,000 would be an API page cap) ===')
  let capped = 0
  for (const r of rows as any[]) {
    const b = (await r2Get(r.r2Key)) ?? ''
    const seps = (b.match(/ --- /g) ?? []).length
    if (seps === 4999) capped++
    console.log(`  ${r.id}  wc=${r.wordCount}  answers=${seps + 1}${seps === 4999 ? '   ← exactly 5,000: A CAP, not a month' : ''}`)
  }
  console.log(`\n${capped} of ${rows.length} sampled rows sit exactly on 5,000 answers.`)

  console.log('\n=== date span covered by each collection ===')
  // written-answers ids encode their own range; pwdata carries a real itemDate
  const spans = await q(`select corpus, count(*)::int n, min("itemDate")::text lo, max("itemDate")::text hi
    from corpus_sections where corpus in ('pwdata-wrans','pwdata-lordswrans') group by 1`)
  console.log(spans)
  const ids = (await q(`select id from corpus_sections where corpus='written-answers' order by id`)).map((r: any) => r.id)
  const dates = ids.map((i: string) => i.split(':')[1]).filter(Boolean).sort()
  console.log(`written-answers months: ${dates.length}, ${dates[0]} … ${dates[dates.length - 1]}`)
  await p.end()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
