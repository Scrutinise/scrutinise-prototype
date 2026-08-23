/**
 * l2-item8-lords.ts — LANE 2 item 8, the one pair C1 left open. READ-ONLY.
 *
 * `lda-lordsdivisions` (2,089) / `lords-divisions-votes` (3,284). C1 could not prove it by text
 * query — median 8 words gives BM25 nothing to bite on — and recorded "structural duplication
 * likely, unmeasured". A pair is not disproved by a failed instrument, so it is measured here
 * on the item: the division's own identity (date + title), which is what a duplicate IS.
 */
import { pool } from './db'
;(async () => {
  const p = pool()
  const q = async (s: string, a: any[] = []) => (await p.query(s, a)).rows
  const show = (t: string, r: any) => { console.log(`\n=== ${t} ===`); console.log(r) }

  show('shape of each side', await q(`
    select corpus, count(*)::int n,
      count("itemDate")::int with_date, min("itemDate")::text lo, max("itemDate")::text hi,
      percentile_cont(0.5) within group (order by "wordCount")::int median_words,
      count("sectionTitle")::int with_title
    from corpus_sections where corpus in ('lda-lordsdivisions','lords-divisions-votes')
    group by 1`))

  show('sample ids and titles, both sides', await q(`
    (select corpus, id, "itemDate"::text d, "sectionTitle", "wordCount"
     from corpus_sections where corpus='lda-lordsdivisions' order by md5(id) limit 4)
    union all
    (select corpus, id, "itemDate"::text d, "sectionTitle", "wordCount"
     from corpus_sections where corpus='lords-divisions-votes' order by md5(id) limit 4)`))

  // ── the item-level test: same division, both collections.
  show('shared dates', await q(`
    with a as (select distinct "itemDate" d from corpus_sections where corpus='lda-lordsdivisions' and "itemDate" is not null),
         b as (select distinct "itemDate" d from corpus_sections where corpus='lords-divisions-votes' and "itemDate" is not null)
    select (select count(*) from a)::int a_days, (select count(*) from b)::int b_days,
           (select count(*) from (select d from a intersect select d from b) x)::int shared_days`))

  show('same date AND same normalised title — a concrete duplicated division', await q(`
    with a as (select id, "itemDate" d, lower(regexp_replace(coalesce("sectionTitle",''), '[^a-z0-9]+', ' ', 'gi')) t
               from corpus_sections where corpus='lda-lordsdivisions'),
         b as (select id, "itemDate" d, lower(regexp_replace(coalesce("sectionTitle",''), '[^a-z0-9]+', ' ', 'gi')) t
               from corpus_sections where corpus='lords-divisions-votes')
    select a.id a_id, b.id b_id, a.d::text date, a.t title
    from a join b on a.d = b.d and a.t = b.t and length(a.t) > 8
    limit 8`))

  await p.end()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
