/**
 * l2-measure.ts — LANE 2 BASELINE. READ-ONLY. Nothing is written, nothing is deleted.
 *
 * Measures the present state of all nine Lane 2 items BEFORE any repair, so every later
 * claim has a before to sit beside it. Playbook §21 R8: held is not usable.
 */
import fs from 'fs'
import path from 'path'
import { pool, OUT } from './db'

const RETIRED_3 = ['lda-lordswrittenquestions', 'lda-commonswrittenquestions', 'written-statements']

;(async () => {
  const p = pool()
  const out: any = { measured_at: new Date().toISOString(), items: {} }
  const q = async (sql: string, args: any[] = []) => (await p.query(sql, args)).rows

  // ---- headline + drift since C1 (18,272,452 on 23 Aug 01:50 UTC)
  const head = await q(`
    select count(*)::int total,
           count(*) filter (where "createdAt" > timestamptz '2026-08-23 01:50+00')::int since_c1
    from corpus_sections`)
  out.headline = head[0]
  const driftBy = await q(`
    select corpus, count(*)::int n from corpus_sections
    where "createdAt" > timestamptz '2026-08-23 01:50+00' group by 1 order by 2 desc limit 10`)
  out.headline.drift_by_corpus = driftBy
  console.log('HEADLINE', JSON.stringify(out.headline, null, 1))

  // ---- item 1: et-decisions landing pages
  const et = await q(`
    select count(*)::int rows,
           count(*) filter (where "wordCount" < 50)::int under50,
           percentile_cont(0.5) within group (order by "wordCount")::int median,
           count(*) filter (where format='pdf')::int pdfs
    from corpus_sections where corpus='et-decisions'`)
  out.items.et_decisions = et[0]
  console.log('ET', JSON.stringify(et[0]))

  // ---- item 2: three retired collections still present
  const ret = await q(
    `select corpus, count(*)::int n, sum("wordCount")::bigint words from corpus_sections
     where corpus = any($1) group by 1 order by 2 desc`, [RETIRED_3])
  out.items.retired_still_held = ret
  console.log('RETIRED', JSON.stringify(ret))

  // ---- item 3: tna-caselaw size
  const tna = await q(`
    select count(*)::int rows, sum("wordCount")::bigint words,
           avg("wordCount")::int avg_words from corpus_sections where corpus='tna-caselaw'`)
  out.items.tna_caselaw = tna[0]
  console.log('TNA', JSON.stringify(tna[0]))

  // ---- item 4: dot leaders (one-word legislation sections)
  const dot = await q(`
    select corpus, count(*)::int n from corpus_sections
    where "wordCount" <= 1 group by 1 order by 2 desc limit 15`)
  out.items.dot_leaders = dot
  const dotTotal = dot.reduce((a: number, r: any) => a + r.n, 0)
  console.log('DOT LEADERS total(top15)', dotTotal, JSON.stringify(dot.slice(0, 6)))

  // ---- item 5: written-answers
  const wa = await q(`
    select count(*)::int rows, avg("wordCount")::int avg_words,
           max("wordCount")::int max_words, sum("wordCount")::bigint words
    from corpus_sections where corpus='written-answers'`)
  out.items.written_answers = wa[0]
  console.log('WRITTEN-ANSWERS', JSON.stringify(wa[0]))

  // ---- item 6: building-regs
  const br = await q(`
    select count(*)::int rows, avg("wordCount")::int avg_words, sum("wordCount")::bigint words
    from corpus_sections where corpus='building-regs'`)
  out.items.building_regs = br[0]
  console.log('BUILDING-REGS', JSON.stringify(br[0]))

  // ---- item 7: senedd-cofnod heading inheritance
  const sen = await q(`
    select count(*)::int rows, count(distinct "sectionTitle")::int distinct_titles,
           count(distinct "parentDocId")::int docs
    from corpus_sections where corpus='senedd-cofnod'`)
  out.items.senedd = sen[0]
  const senTop = await q(`
    with per as (
      select "parentDocId" d, "sectionTitle" t, count(*)::int n
      from corpus_sections where corpus='senedd-cofnod' group by 1,2)
    select sum(n)::bigint in_biggest from (
      select d, max(n) n from per group by d) x`)
  out.items.senedd.in_biggest_heading_block = Number(senTop[0].in_biggest)
  out.items.senedd.pct_in_biggest =
    +(100 * Number(senTop[0].in_biggest) / sen[0].rows).toFixed(1)
  console.log('SENEDD', JSON.stringify(out.items.senedd))

  // ---- item 8: duplicate pairs — row counts and itemDate overlap
  const pairs = [
    ['lda-commonsdivisions', 'commons-divisions-votes'],
    ['lda-lordsdivisions', 'lords-divisions-votes'],
    ['uk-treaties', 'uk-treaties-fcdo'],
    ['historic-hansard', 'pwdata-debates'],
  ]
  out.items.duplicate_pairs = []
  for (const [a, b] of pairs) {
    const r = await q(`
      select corpus, count(*)::int n, min("itemDate")::text lo, max("itemDate")::text hi
      from corpus_sections where corpus = any($1) group by 1`, [[a, b]])
    out.items.duplicate_pairs.push({ pair: [a, b], sides: r })
    console.log('PAIR', a, '/', b, JSON.stringify(r))
  }

  // ---- item 9: legacy table
  const leg = await q(`
    select count(*)::int sections, count(distinct "itemId")::int instruments
    from "LegislationSection"`)
  out.items.legacy_table = leg[0]
  console.log('LEGACY', JSON.stringify(leg[0]))

  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'C2_L2_baseline.json'), JSON.stringify(out, null, 2))
  console.log('\nwrote docs/census/C2_L2_baseline.json')
  await p.end()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
