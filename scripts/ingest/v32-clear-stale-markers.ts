/**
 * v32-clear-stale-markers.ts — remove `archive-miss` marker rows that sit on publications which
 * DO have archive-sourced content.
 *
 * WHY THEY EXIST (established from write timestamps, not assumed): all 8 were written between
 * 20:04 and 20:59 UTC on 2026-08-07 — the window in which three backfill drivers ran
 * concurrently (the reaped-but-alive incident). One process wrote the content and cleared the
 * publication's marker via deleteStaleSections; a second process, working the same publication,
 * took a contention-induced socket drop and wrote a NEW marker after the content had landed.
 * Every one of the 8 has marker.createdAt > max(content.createdAt).
 *
 * WHY IT MATTERS: the marker is what makes the residual gap a counted known-unknown. A marker on
 * a publication that is not in fact missing overstates the gap and double-counts the publication
 * as both retrieved and absent — which is how 5,390 + 7 + 2,247 came to exceed the 7,636 target.
 *
 * SAFETY: deletes ONLY rows that (a) are archive-miss markers and (b) have compiled `arc-`
 * content under the same parentDocId. Never touches a marker that is the publication's only row.
 * These rows are status='unavailable' so they were never indexed (fts-catchup takes
 * status='compiled' only) — removing them cannot orphan a Lance row.
 *
 * Dry run by default. Usage: tsx v32-clear-stale-markers.ts [--apply]
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'

const APPLY = process.argv.includes('--apply')

const PREDICATE = `
  corpus='committees-reports'
  AND availability_status='archive-miss'
  AND EXISTS (SELECT 1 FROM corpus_sections c
               WHERE c.corpus='committees-reports'
                 AND c."parentDocId" = corpus_sections."parentDocId"
                 AND c.status='compiled' AND c.id LIKE '%:arc-%')`

async function main() {
  const p = getNeonPool()

  const { rows: before } = await p.query(
    `SELECT id, "parentDocId" FROM corpus_sections WHERE ${PREDICATE} ORDER BY id`)
  console.log(`\n  ${APPLY ? '*** APPLY ***' : 'DRY RUN (pass --apply)'}`)
  console.log(`  stale markers to remove: ${before.length}`)
  for (const r of before) console.log(`    ${r.id}`)

  // Guard: never let this become a broad delete. If the count is not what the diagnosis found,
  // something else changed and a human should look before rows go.
  if (before.length > 20) {
    console.error(`\n  ABORT: ${before.length} rows matched — the diagnosed set was 8. Not deleting.`)
    await endNeonPool(); process.exit(1)
  }

  if (APPLY && before.length > 0) {
    const res = await p.query(`DELETE FROM corpus_sections WHERE ${PREDICATE}`)
    console.log(`\n  deleted ${res.rowCount} rows`)

    const { rows: after } = await p.query(`SELECT COUNT(*)::int AS n FROM corpus_sections WHERE ${PREDICATE}`)
    console.log(`  re-check, markers still co-existing with content: ${after[0].n}`)

    // The reconciliation this was all for: the three outcome buckets must now sum to the target.
    const { rows: rec } = await p.query(
      `SELECT
         COUNT(DISTINCT "parentDocId") FILTER (WHERE status='compiled' AND id LIKE '%:arc-%')::int AS fetched,
         COUNT(DISTINCT "parentDocId") FILTER (WHERE availability_status='archive-miss'
               AND availability_note LIKE '[retryable]%')::int AS retryable,
         COUNT(DISTINCT "parentDocId") FILTER (WHERE availability_status='archive-miss'
               AND availability_note NOT LIKE '[retryable]%')::int AS settled
       FROM corpus_sections WHERE corpus='committees-reports'`)
    const r = rec[0]
    console.log(`\n  fetched ${r.fetched} + retryable ${r.retryable} + settled ${r.settled} = ${r.fetched + r.retryable + r.settled}  (target 7,636)`)
  }

  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
