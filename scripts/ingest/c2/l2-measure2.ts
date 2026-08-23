/** l2-measure2.ts — READ-ONLY. The Lane 2 items the first pass left open. */
import fs from 'fs'
import path from 'path'
import { pool, OUT } from './db'
;(async () => {
  const p = pool()
  const q = async (s: string, a: any[] = []) => (await p.query(s, a)).rows
  const out: any = { measured_at: new Date().toISOString() }

  // ITEM 4 — what the 178,826 actually are. Evidence kind, and do they in fact say nothing?
  console.log('=== section_repeals evidence kinds ===')
  out.repeal_evidence = await q(
    `select evidence, count(*)::int n, count(repealed_by)::int with_repealer
     from section_repeals group by 1 order by 2 desc`)
  console.log(out.repeal_evidence)

  console.log('\n=== do the repealed sections say anything? (join to wordCount) ===')
  out.repeal_wordcount = await q(`
    select
      count(*)::int joined,
      count(*) filter (where s."wordCount" <= 1)::int wc_le_1,
      count(*) filter (where s."wordCount" between 2 and 14)::int wc_2_14,
      count(*) filter (where s."wordCount" >= 15)::int wc_ge_15,
      percentile_cont(0.5) within group (order by s."wordCount")::int median
    from section_repeals r join corpus_sections s on s.id = r.section_id`)
  console.log(out.repeal_wordcount)

  console.log('\n=== repealed rows by corpus ===')
  out.repeal_by_corpus = await q(
    `select corpus, count(*)::int n from section_repeals group by 1 order by 2 desc`)
  console.log(out.repeal_by_corpus)

  // ITEM 1 — C1 claimed 131,147 of 131,654 landing pages already have the real PDF alongside.
  console.log('\n=== et-decisions: landing pages vs documents, by parentDocId ===')
  out.et_split = await q(`
    select format, count(*)::int n,
           percentile_cont(0.5) within group (order by "wordCount")::int median_words,
           count(distinct "parentDocId")::int parents
    from corpus_sections where corpus='et-decisions' group by 1 order by 2 desc`)
  console.log(out.et_split)

  // ITEM 9 — the legacy table (correct column name this time)
  console.log('\n=== LegislationSection columns ===')
  const cols = await q(`select column_name from information_schema.columns
    where table_name='LegislationSection' order by ordinal_position`)
  console.log(cols.map((c: any) => c.column_name).join(', '))
  out.legacy_cols = cols.map((c: any) => c.column_name)

  fs.writeFileSync(path.join(OUT, 'C2_L2_baseline2.json'), JSON.stringify(out, null, 2))
  console.log('\nwrote docs/census/C2_L2_baseline2.json')
  await p.end()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
