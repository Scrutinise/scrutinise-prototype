/**
 * probe-et-stubs.ts — what IS an `et-decisions` row, when the median one is 50 words? The report
 * cannot say "76.9% of the largest case-law collection is a stub" without showing one. Five rows,
 * printed whole. WRITES NOTHING.
 */
import { namesPool, endNamesPool } from '../names/names-pool'
import { r2Get } from '../shared/r2-client'

;(async () => {
  const p = namesPool()
  const rows = (await p.query(
    `SELECT id, "sectionTitle", "itemDate"::text AS "itemDate", "sourceUrl", "r2Key", "wordCount"
       FROM corpus_sections WHERE corpus='et-decisions' AND "wordCount" < 200 AND "r2Key" IS NOT NULL
       ORDER BY md5(id || 'stub') LIMIT 5`)).rows
  for (const r of rows) {
    const t = await r2Get(r.r2Key)
    console.log(`\n${'='.repeat(90)}\n${r.id}\n  title ${r.sectionTitle}\n  date ${r.itemDate}   words ${r.wordCount}\n  ${r.sourceUrl}`)
    console.log(`  BODY (whole): ${t}`)
  }
  await endNamesPool()
})().catch(e => { console.error(e); process.exit(1) })
