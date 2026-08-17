/**
 * probe-surface-1-visibility.ts — can a repealed provision actually be SURFACED by a search?
 *
 * §3 asks for a definitely-repealed provision found "as a user would". The eight realistic queries
 * in count-surface-1.ts returned 0 repealed results in 96, which needs explaining rather than
 * reporting as a clean bill of health: repealed sections median 33 words against 69 for live ones,
 * and their body is largely dot leaders, so they rank poorly. This tries the strongest case — the
 * provision's own distinctive title — to establish whether the label can be seen in a real search
 * at all, or only in a unit check.
 */
import { Client } from 'pg'
import { searchLegislationViaGateway } from '../lib/lex/gateway-legacy'
import { repealLabel } from '../lib/lex/repeal-status'
export {}

async function main() {
  const db = new Client({ connectionString: process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await db.connect()
  const { rows } = await db.query<{ section_id: string; title: string; repealed_by: string | null }>(`
    SELECT r.section_id, cs."sectionTitle" title, r.repealed_by
    FROM section_repeals r JOIN corpus_sections cs ON cs.id = r.section_id
    WHERE cs."sectionTitle" IS NOT NULL AND length(cs."sectionTitle") > 34 AND r.repealed_by IS NOT NULL
    ORDER BY md5(r.section_id) LIMIT 8`)
  console.log('\n════ CAN A REPEALED PROVISION BE SURFACED BY SEARCH? ════')
  let surfaced = 0
  for (const r of rows) {
    const q = r.title.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 9).join(' ')
    const gw = await searchLegislationViaGateway({ q, limit: 20, intent: 'LEGISLATION_SEARCH' })
    const hit = gw.results.find((x) => x.sectionId === r.section_id)
    const anyRepealed = gw.results.filter((x) => x.repeal && x.repeal.state !== 'no-record')
    if (hit) surfaced++
    console.log(`\n  query: "${q}"`)
    console.log(`    target ${r.section_id}`)
    console.log(`    target in top 20: ${hit ? `YES at rank ${gw.results.indexOf(hit) + 1} — ${repealLabel(hit.repeal!)}` : 'no'}`)
    console.log(`    any repealed in the 20: ${anyRepealed.length}${anyRepealed.length ? ` — e.g. ${repealLabel(anyRepealed[0].repeal!).slice(0, 60)}` : ''}`)
  }
  console.log(`\n  the target provision was reachable by its own title in ${surfaced} of ${rows.length} attempts`)
  await db.end()
}
main().catch((e) => { console.error(e); process.exit(1) })
