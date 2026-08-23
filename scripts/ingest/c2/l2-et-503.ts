/**
 * l2-et-503.ts — LANE 2 item 1. READ-ONLY. Which landing pages have nothing behind them?
 *
 * C1 measured 131,147 of 131,650 landing pages already have the real judgment PDF ingested
 * alongside, leaving 503 with nothing. That is re-derived here before anything is deleted,
 * because the 503 are the ONLY thing the deletion would destroy the pointer to.
 */
import fs from 'fs'
import path from 'path'
import { pool, OUT } from './db'
;(async () => {
  const p = pool()
  const q = async (s: string, a: any[] = []) => (await p.query(s, a)).rows

  console.log('=== how the two halves relate: parentDocId ===')
  console.log(await q(`
    select format, count(*)::int rows, count(distinct "parentDocId")::int parents
    from corpus_sections where corpus='et-decisions' group by 1 order by 2 desc`))

  // A landing page is 'covered' when a pdf row shares its parentDocId.
  const orphans = await q(`
    select h.id, h."parentDocId", h."sourceUrl", h."wordCount"
    from corpus_sections h
    where h.corpus='et-decisions' and h.format='html'
      and not exists (
        select 1 from corpus_sections d
        where d.corpus='et-decisions' and d.format='pdf' and d."parentDocId" = h."parentDocId")
    order by h.id`)
  const total = (await q(`select count(*)::int n from corpus_sections where corpus='et-decisions' and format='html'`))[0].n
  console.log(`\nlanding pages            : ${total.toLocaleString()}`)
  console.log(`covered by a held PDF    : ${(total - orphans.length).toLocaleString()}`)
  console.log(`NOTHING BEHIND THEM      : ${orphans.length.toLocaleString()}   ← the re-fetch list`)
  console.log(`\nC1 predicted 131,147 covered / 503 orphaned. ${
    total - orphans.length === 131147 && orphans.length === 503 ? 'REPRODUCES EXACTLY ✓' : 'DIFFERS — see above'}`)
  console.log('\nfirst 5 orphans:')
  for (const o of orphans.slice(0, 5)) console.log(`  ${o.id}  ${o.sourceUrl}`)

  fs.writeFileSync(path.join(OUT, 'C2_L2_et_refetch_list.json'), JSON.stringify(
    { generated: new Date().toISOString(), landing_pages: total,
      covered: total - orphans.length, orphans: orphans.length, list: orphans }, null, 2))
  console.log(`\nwrote docs/census/C2_L2_et_refetch_list.json (${orphans.length} to re-fetch)`)
  await p.end()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
