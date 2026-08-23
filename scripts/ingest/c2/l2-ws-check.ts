/** l2-ws-check.ts — READ-ONLY. Is `written-statements` really a duplicate, or is it real text
 *  that the brief is about to delete because a target row was retired? */
import { pool } from './db'
import { r2Get } from '../shared/r2-client'
;(async () => {
  const p = pool()
  const q = async (s: string, a: any[] = []) => (await p.query(s, a)).rows
  console.log('=== shape ===')
  console.log(await q(`select corpus, count(*)::int n, avg("wordCount")::int avg_w,
      min("itemDate")::text lo, max("itemDate")::text hi
    from corpus_sections where corpus in ('written-statements','pwdata-wms','pwdata-lordswms')
    group by 1 order by 2 desc`))
  console.log('\n=== a written-statements body (is it one statement, or a whole file?) ===')
  const r = (await q(`select id, "r2Key", "wordCount", "sourceUrl" from corpus_sections
    where corpus='written-statements' and "r2Key" is not null order by md5(id) limit 2`))
  for (const x of r as any[]) {
    const b = ((await r2Get(x.r2Key)) ?? '').replace(/\s+/g, ' ').trim()
    console.log(`\n  ${x.id}  (wc=${x.wordCount})  ${x.sourceUrl}`)
    console.log(`  "${b.slice(0, 300)}…"`)
  }
  await p.end()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
