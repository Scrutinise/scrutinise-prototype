/** l2-item56.ts — LANE 2 items 5 (written-answers) and 6 (building-regs). READ-ONLY diagnosis. */
import { pool } from './db'
import { r2Get } from '../shared/r2-client'
;(async () => {
  const p = pool()
  const q = async (s: string, a: any[] = []) => (await p.query(s, a)).rows

  console.log('=== ITEM 5 — written-answers: what is one row? ===')
  console.log(await q(`select count(*)::int n, avg("wordCount")::int avg_w, min("wordCount")::int min_w,
      max("wordCount")::int max_w from corpus_sections where corpus='written-answers'`))
  const wa = await q(`select id, "r2Key", "wordCount", "sourceUrl" from corpus_sections
    where corpus='written-answers' and "r2Key" is not null order by md5(id) limit 2`)
  for (const x of wa as any[]) {
    const b = ((await r2Get(x.r2Key)) ?? '').replace(/\s+/g, ' ').trim()
    console.log(`\n  ${x.id}  (wc=${x.wordCount})\n  url: ${x.sourceUrl}`)
    console.log(`  head: "${b.slice(0, 200)}…"`)
    const seps = (b.match(/ --- /g) ?? []).length
    console.log(`  ' --- ' separators in the body: ${seps}  → implies ~${seps + 1} answers stored as ONE section`)
  }
  console.log('\n-- the properly-split equivalents we already hold --')
  console.log(await q(`select corpus, count(*)::int n, avg("wordCount")::int avg_w
    from corpus_sections where corpus in ('pwdata-wrans','pwdata-lordswrans') group by 1`))

  console.log('\n=== ITEM 6 — building-regs: 21 rows at ~446 words ===')
  const br = await q(`select id, "r2Key", "wordCount", "sourceUrl", format, "sectionTitle"
    from corpus_sections where corpus='building-regs' order by id`)
  for (const x of br.slice(0, 6) as any[]) {
    const b = ((await r2Get(x.r2Key)) ?? '(no r2 object)').replace(/\s+/g, ' ').trim()
    console.log(`  ${x.id}\n    format=${x.format} wc=${x.wordCount} title=${x.sectionTitle ?? '(none)'}\n    url: ${x.sourceUrl}\n    body: "${b.slice(0, 160)}…"`)
  }
  console.log(`\n  formats present: ${JSON.stringify(await q(
    `select format, count(*)::int n from corpus_sections where corpus='building-regs' group by 1`))}`)
  await p.end()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
