/**
 * probe-surface-1-detail-page.ts — how well does the (gid, section_ref) join actually place a
 * repeal on the legislation detail page?
 *
 * The detail page reads the LEGACY table, whose ids are not corpus_sections ids, so the join is on
 * (gid, section_ref) and cannot reconstruct every ref form from a bare section number. That match
 * rate is measured here rather than assumed, because an unmatched section shows no status and a
 * reader has no way to tell "not repealed" from "we could not place it".
 */
import { Client } from 'pg'
import { repealsForItem } from '../lib/lex/repeal-status'
export {}

async function main() {
  const db = new Client({ connectionString: process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await db.connect()
  // Acts that have both a detail page (LegislationItem) and known repeals.
  const { rows: items } = await db.query<{ id: string; gid: string; title: string; secs: string }>(`
    SELECT li.id, li."legislationGovUkId" gid, li.title, COUNT(ls.id)::text secs
    FROM "LegislationItem" li JOIN "LegislationSection" ls ON ls."legislationItemId" = li.id
    WHERE EXISTS (SELECT 1 FROM section_repeals r WHERE r.gid = li."legislationGovUkId")
    GROUP BY 1,2,3 ORDER BY COUNT(ls.id) DESC LIMIT 10`)
  console.log('\n════ DETAIL-PAGE JOIN — measured, not assumed ════')
  console.log('  act                                          sections  repeals recorded  placed on the page')
  let secTotal = 0; let repTotal = 0; let placed = 0
  for (const it of items) {
    const { rows: nums } = await db.query<{ n: string }>(
      `SELECT ls."sectionNumber" n FROM "LegislationSection" ls WHERE ls."legislationItemId" = $1`, [it.id])
    const { rows: [rc] } = await db.query<{ n: string }>(
      'SELECT COUNT(*)::text n FROM section_repeals WHERE gid = $1', [it.gid])
    const map = await repealsForItem(it.gid, nums.map((x) => x.n))
    secTotal += nums.length; repTotal += Number(rc.n); placed += map.size
    console.log(`  ${it.title.slice(0, 42).padEnd(42)} ${String(nums.length).padStart(9)} ${String(rc.n).padStart(17)} ${String(map.size).padStart(19)}`)
  }
  console.log(`\n  TOTAL${' '.repeat(39)} ${String(secTotal).padStart(9)} ${String(repTotal).padStart(17)} ${String(placed).padStart(19)}`)
  console.log(`\n  ⚠ "placed" counts repeals matched to a section the page actually lists. It is lower than`)
  console.log(`  "recorded" for two honest reasons: the page lists only COMPILED sections, and a`)
  console.log(`  section_ref like schedule-15-paragraph-10 cannot be reconstructed from a bare number.`)
  console.log(`  An unplaced section shows NO status rather than a reassuring one.`)
  await db.end()
}
main().catch((e) => { console.error(e); process.exit(1) })
