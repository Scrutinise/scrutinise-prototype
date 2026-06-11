/**
 * v19-cleanup-ukpga-calendar.ts — V19 §2.1 post-drain cleanup.
 *
 * RUN ONLY AFTER the v19-seed-ukpga-regnal.ts queue rows have drained.
 *
 * Deletes the superseded calendar-form pre-1963 rows:
 *  1. The 5,840 chrome-boilerplate `full-doc-html` sections (uniform ~834 words
 *     of site furniture — never real content) + their R2 objects.
 *  2. The 1,057 status='unavailable' calendar markers with no availability
 *     classification (HTTP 300/301 dead-ends) — superseded by regnal rows.
 *  3. Flips any still-'failed' sections whose compiled R2 key now exists.
 * Then re-baselines primary-acts-pre-2000 to measured ✓.
 *
 * Refuses to run while the corpus still has pending/claimed queue rows.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { r2Exists, r2Delete } from './shared/r2-client'

async function main() {
  const pool = getNeonPool()

  const open = await pool.query<{ n: string }>(`
    SELECT count(*)::text n FROM ingest_queue
    WHERE corpus='primary-acts-pre-2000' AND status IN ('pending','claimed')`)
  if (parseInt(open.rows[0].n, 10) > 0) {
    console.error(`ABORT: ${open.rows[0].n} pending/claimed rows — queue not drained`)
    process.exit(1)
  }

  // 1. boilerplate html rows (pre-1963 calendar docs, single full-doc-html section)
  const boiler = await pool.query<{ id: string; r2Key: string }>(`
    SELECT id, "r2Key" FROM corpus_sections
    WHERE corpus='primary-acts-pre-2000' AND format='html' AND status='compiled'
      AND split_part(split_part(id,':',2),'/',2) ~ '^[0-9]+$'
      AND split_part(split_part(id,':',2),'/',2)::int < 1963`)
  console.log(`boilerplate html sections to delete: ${boiler.rows.length}`)
  let r2Deleted = 0
  for (const row of boiler.rows) {
    if (row.r2Key) { try { await r2Delete(row.r2Key); r2Deleted++ } catch { /* already gone */ } }
  }
  const del1 = await pool.query(`
    DELETE FROM corpus_sections
    WHERE corpus='primary-acts-pre-2000' AND format='html' AND status='compiled'
      AND split_part(split_part(id,':',2),'/',2) ~ '^[0-9]+$'
      AND split_part(split_part(id,':',2),'/',2)::int < 1963`)
  console.log(`deleted ${del1.rowCount} boilerplate rows (${r2Deleted} R2 objects)`)

  // 2. unclassified calendar 'unavailable' markers (the 300/301 dead-ends)
  const del2 = await pool.query(`
    DELETE FROM corpus_sections
    WHERE corpus='primary-acts-pre-2000' AND status='unavailable'
      AND availability_status='full'
      AND split_part(split_part(id,':',2),'/',2) ~ '^[0-9]+$'`)
  console.log(`deleted ${del2.rowCount} unclassified calendar unavailable markers`)

  // 3. failed sections whose compiled text actually landed in R2
  const failed = await pool.query<{ id: string; r2Key: string | null }>(`
    SELECT id, "r2Key" FROM corpus_sections WHERE corpus='primary-acts-pre-2000' AND status='failed'`)
  let flipped = 0
  for (const f of failed.rows) {
    if (f.r2Key && await r2Exists(f.r2Key)) {
      await pool.query(`UPDATE corpus_sections SET status='compiled', "errorMsg"=NULL WHERE id=$1`, [f.id])
      flipped++
    }
  }
  console.log(`failed sections: ${failed.rows.length}, flipped to compiled (R2 present): ${flipped}`)

  // 4. re-baseline ✓
  const m = await pool.query<{ compiled: string; residue: string }>(`
    SELECT count(*) FILTER (WHERE status='compiled')::text compiled,
           count(*) FILTER (WHERE status<>'compiled')::text residue
    FROM corpus_sections WHERE corpus='primary-acts-pre-2000'`)
  const compiled = parseInt(m.rows[0].compiled, 10)
  await pool.query(`UPDATE corpus_targets SET est_sections=$1, est_is_confirmed=true WHERE corpus_key='primary-acts-pre-2000'`, [compiled])
  console.log(`re-baselined ✓: ${compiled} compiled, classified residue ${m.rows[0].residue}`)

  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
