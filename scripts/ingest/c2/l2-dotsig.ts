/**
 * l2-dotsig.ts — READ-ONLY. The hollow-unit instrument counts punctuation as words.
 *
 * Every sampled dot leader scores wordCount=33 and so passes a "<15 words" hollow test.
 * Q1: is 33 a signature or a coincidence?
 * Q2: does the signature find rows the 178,826 census MISSED?
 */
import fs from 'fs'
import path from 'path'
import { pool, OUT } from './db'
;(async () => {
  const p = pool()
  const q = async (s: string, a: any[] = []) => (await p.query(s, a)).rows
  const out: any = {}

  console.log('=== Q1: wordCount distribution of the 178,826 ===')
  out.wc_dist = await q(`
    select s."wordCount" wc, count(*)::int n
    from section_repeals r join corpus_sections s on s.id = r.section_id
    group by 1 order by 2 desc limit 12`)
  console.log(out.wc_dist)

  const LEG = ['primary-acts-pre-2000','primary-acts-2000plus','si-pre-2010','si-2010plus','regional','retained-eu']

  console.log('\n=== Q2: legislation rows at the same wordCount NOT in the census ===')
  out.unflagged = await q(`
    select s."wordCount" wc, count(*)::int n
    from corpus_sections s
    where s.corpus = any($1)
      and s."wordCount" in (32, 33, 34)
      and not exists (select 1 from section_repeals r where r.section_id = s.id)
    group by 1 order by 1`, [LEG])
  console.log(out.unflagged)

  console.log('\n=== how big is the legislation body the census scanned? ===')
  out.leg_total = (await q(
    `select count(*)::int n from corpus_sections where corpus = any($1)`, [LEG]))[0]
  console.log(out.leg_total, '· census scanned 1,563,090 · flagged 178,826')

  console.log('\n=== what a "<15 words" hollow test sees in legislation ===')
  out.floor_check = (await q(`
    select
      count(*) filter (where "wordCount" < 15)::int below_floor,
      count(*) filter (where "wordCount" between 15 and 60)::int floor_to_60
    from corpus_sections where corpus = any($1)`, [LEG]))[0]
  console.log(out.floor_check)

  fs.writeFileSync(path.join(OUT, 'C2_L2_dotsig.json'), JSON.stringify(out, null, 2))
  await p.end()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
