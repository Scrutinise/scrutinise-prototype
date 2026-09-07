/**
 * feed-meta.ts — walk the `ukia` year feeds and record the metadata the ingest did NOT store.
 *
 * ⚠ WHY THIS EXISTS. `corpus_sections` keeps `sourceUrl`, `itemDate` and `parentDocId` for these
 * documents and nothing else. The feed publishes four more fields per entry, structured, and two of
 * them decide §3 entirely:
 *
 *     <ukm:DocumentStage Value="Post Implementation"/>   ← WHICH deposits are actually REVIEWS
 *     <ukm:Department Value="Department for Transport"/>  ← who wrote it
 *
 * Without `DocumentStage`, "how many post-implementation reviews do we hold?" can only be answered
 * by looking for a heading — and the heading "Post-implementation review" appears in 1,052 of the
 * 1,169 held assessments because it is a QUESTION ON THE PROFORMA ("Will the policy be reviewed?"),
 * asked of every measure, answered by most with a date or a "No". Counting those as reviews would
 * turn ~90 real reviews into ~1,050 and is precisely the substitution §3 forbids.
 *
 * It also gives the source-side denominator: how many `ukia` deposits legislation.gov.uk publishes,
 * against how many we hold.
 *
 * Output: docs/census/IMPACT_feed_meta.json
 * Usage: tsx impact/feed-meta.ts
 */
import fs from 'fs'
import path from 'path'
import { UKIA_YEARS, listUkiaYear, ukiaYearTotal, ImpactAssessment } from '../sources/impact-assessments'

const OUT = path.join(__dirname, '../../../docs/census/IMPACT_feed_meta.json')

async function main() {
  const all: ImpactAssessment[] = []
  const perYear: Array<{ year: number; declared: number; walked: number }> = []

  for (const y of UKIA_YEARS) {
    const declared = await ukiaYearTotal(y)
    const items = await listUkiaYear(y)
    perYear.push({ year: y, declared, walked: items.length })
    all.push(...items)
    console.log(`  ${y}  feed says ${String(declared).padStart(4)}  walked ${String(items.length).padStart(4)}` +
      (declared !== items.length ? `   ⚠ SHORT BY ${declared - items.length}` : ''))
  }

  // ⚠ UKIA_YEARS is a hardcoded list "measured 10 Aug 2026". A year that has since gained deposits
  // would be silently dropped, so probe the two known-gap ranges rather than trusting the constant.
  console.log(`\n  probing the years UKIA_YEARS excludes (2008–2016, 2024–2025) —`)
  console.log(`  a non-zero total here means the constant is now stale and content is being dropped:`)
  const gaps: Array<{ year: number; total: number }> = []
  for (let y = 2008; y <= 2016; y++) gaps.push({ year: y, total: await ukiaYearTotal(y) })
  for (const y of [2024, 2025]) gaps.push({ year: y, total: await ukiaYearTotal(y) })
  const live = gaps.filter(g => g.total > 0)
  console.log(live.length
    ? `  ⚠⚠ ${live.length} EXCLUDED YEARS NOW HAVE DEPOSITS: ${live.map(g => `${g.year}=${g.total}`).join(' ')}`
    : `  none — the 2008–2016 and 2024–2025 gaps are still real at source.`)

  const stages = new Map<string, number>()
  for (const a of all) stages.set(a.stage ?? '(none)', (stages.get(a.stage ?? '(none)') ?? 0) + 1)
  console.log(`\n  DocumentStage across ${all.length} deposits:`)
  for (const [s, c] of [...stages.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${String(c).padStart(5)}  ${s}`)

  const depts = new Map<string, number>()
  for (const a of all) depts.set(a.department ?? '(none)', (depts.get(a.department ?? '(none)') ?? 0) + 1)
  console.log(`\n  ${depts.size} distinct departments; top 10:`)
  for (const [d, c] of [...depts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`    ${String(c).padStart(5)}  ${d}`)

  console.log(`\n  instrument link present: ${all.filter(a => a.instrumentId).length}/${all.length}`)

  fs.writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), perYear, gaps, items: all }, null, 2))
  console.log(`\nwrote ${path.relative(process.cwd(), OUT)}`)
}
main().catch(e => { console.error(e); process.exit(1) })
