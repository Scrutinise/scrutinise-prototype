/**
 * v32-check-residual.ts — read-only: archive-miss markers that co-exist with content.
 *
 * A marker on a publication that HAS content overstates the corpus gap and would be reported as
 * a known-unknown that is not in fact unknown. This dumps the write timestamps on both sides so
 * the ordering that produced them is evidence, not a hypothesis.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'

async function main() {
  const p = getNeonPool()

  const { rows } = await p.query(
    `SELECT m."parentDocId", m.id AS marker_id,
            to_char(m."createdAt",'MM-DD HH24:MI:SS') AS marker_written,
            m.availability_note,
            c.n::int AS arc_sections,
            to_char(c.first_at,'MM-DD HH24:MI:SS') AS content_first,
            to_char(c.last_at,'MM-DD HH24:MI:SS')  AS content_last
     FROM corpus_sections m
     JOIN LATERAL (
       SELECT COUNT(*) AS n, MIN(s."createdAt") AS first_at, MAX(s."createdAt") AS last_at
       FROM corpus_sections s
       WHERE s.corpus='committees-reports' AND s."parentDocId"=m."parentDocId"
         AND s.status='compiled' AND s.id LIKE '%:arc-%'
     ) c ON c.n > 0
     WHERE m.corpus='committees-reports' AND m.availability_status='archive-miss'
     ORDER BY m."createdAt"`)

  console.log(`\n  ${rows.length} archive-miss markers co-existing with content:\n`)
  for (const r of rows) {
    console.log(`    ${String(r.parentDocId).padEnd(22)} marker@${r.marker_written}  content ${String(r.arc_sections).padStart(4)} rows @${r.content_first}..${r.content_last}`)
    console.log(`      ${String(r.availability_note).slice(0, 95)}`)
  }
  const after = rows.filter((r: any) => r.marker_written > r.content_last).length
  console.log(`\n  markers written AFTER the content landed: ${after} of ${rows.length}`)
  console.log(`  marker ids (for the cleanup):`)
  for (const r of rows) console.log(`    ${r.marker_id}`)

  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
