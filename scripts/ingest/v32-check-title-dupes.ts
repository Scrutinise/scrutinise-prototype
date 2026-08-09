/**
 * v32-check-title-dupes.ts — read-only: why is the metadata pass's title enrichment not idempotent?
 *
 * HYPOTHESIS UNDER TEST: the enrichment does `${title} — ${committeeName}`.slice(0, 500). When the
 * result exceeds 500 characters the appended name is CUT — so the guard `!title.includes(name)`
 * finds no name on the next run and appends again, truncating again, forever. Each run therefore
 * grows the middle of the title and re-cuts the tail.
 *
 * Prediction if true: the rows a second run would re-enrich sit AT the 500-char cap.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'

async function main() {
  const p = getNeonPool()

  const { rows: dist } = await p.query(
    `SELECT
       COUNT(*) FILTER (WHERE length("sectionTitle") >= 500)::int AS at_cap,
       COUNT(*) FILTER (WHERE length("sectionTitle") BETWEEN 490 AND 499)::int AS near_cap,
       COUNT(*) FILTER (WHERE length("sectionTitle") < 490)::int AS under_cap,
       COUNT(*)::int AS total
     FROM corpus_sections
     WHERE corpus='committees-reports' AND notes IS NOT NULL AND "sectionTitle" IS NOT NULL
       AND coalesce(notes::json->>'committeeName','') <> ''
       AND position((notes::json->>'committeeName') in "sectionTitle") = 0`)
  const d = dist[0]
  console.log(`\n  Rows a re-run WOULD enrich (committee name not present in the title): ${d.total}`)
  console.log(`    at the 500-char cap   ${d.at_cap}`)
  console.log(`    490-499 chars         ${d.near_cap}`)
  console.log(`    under 490 chars       ${d.under_cap}`)

  const { rows: ex } = await p.query(
    `SELECT length("sectionTitle") AS len, notes::json->>'committeeName' AS cname,
            right("sectionTitle", 90) AS tail
     FROM corpus_sections
     WHERE corpus='committees-reports' AND notes IS NOT NULL AND "sectionTitle" IS NOT NULL
       AND coalesce(notes::json->>'committeeName','') <> ''
       AND position((notes::json->>'committeeName') in "sectionTitle") = 0
     ORDER BY length("sectionTitle") DESC LIMIT 8`)
  console.log(`\n  samples (tail of the title, to show the cut):`)
  for (const r of ex) console.log(`    len=${r.len}  [${r.cname}]\n      …${r.tail}`)

  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
