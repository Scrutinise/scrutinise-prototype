/**
 * seed-explanatory-queue.ts — V20 probe 3: Explanatory Notes (Acts, 1999+) and
 * Explanatory Memoranda (SIs, 2002+) from legislation.gov.uk.
 *
 * ⚠️ RUN ONLY AFTER THE V20 PUSH — rows ride sourceType 'tna-legislation' with
 * docId prefix en:/em:, which the pre-V20 deployed processor treats as an act
 * id and would dead-end (playbook §8: seed-after-push).
 *
 * No enumeration needed: the universe derives from docIds already held in
 * corpus_sections (the parent corpora are fully enumerated). One row per
 * Act/SI; absent EN/EMs classify as unavailable markers.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'

async function main() {
  const pool = getNeonPool()

  // ENs: ukpga 1999+ (ENs began with the 1999 session)
  const acts = await pool.query<{ d: string }>(`
    SELECT DISTINCT split_part(id, ':', 2) AS d
    FROM corpus_sections
    WHERE corpus IN ('primary-acts-pre-2000', 'primary-acts-2000plus')
      AND split_part(id, ':', 2) ~ '^ukpga/[0-9]{4}/[0-9]+$'
      AND split_part(split_part(id, ':', 2), '/', 2)::int >= 1999`)
  // EMs: uksi 2002+ (EM publication established from ~2002)
  const sis = await pool.query<{ d: string }>(`
    SELECT DISTINCT split_part(id, ':', 2) AS d
    FROM corpus_sections
    WHERE corpus IN ('si-pre-2010', 'si-2010plus')
      AND split_part(id, ':', 2) ~ '^uksi/[0-9]{4}/[0-9]+$'
      AND split_part(split_part(id, ':', 2), '/', 2)::int >= 2002`)

  console.log(`[seed] universe: ${acts.rows.length} acts (en), ${sis.rows.length} SIs (em)`)

  const enRows = acts.rows.map(r => ({
    id: `explanatory-notes:en:${r.d}`,
    corpus: 'explanatory-notes',
    docId: `en:${r.d}`,
    sourceType: 'tna-legislation',
    priority: 3,
  }))
  const emRows = sis.rows.map(r => ({
    id: `explanatory-memoranda:em:${r.d}`,
    corpus: 'explanatory-memoranda',
    docId: `em:${r.d}`,
    sourceType: 'tna-legislation',
    priority: 3,
  }))

  const a = await bulkInsertQueueRows(enRows)
  const b = await bulkInsertQueueRows(emRows)
  console.log(`[seed] explanatory-notes: ${a.affected} new rows; explanatory-memoranda: ${b.affected} new rows`)

  await pool.query(`
    INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, blocked, blocked_reason)
    VALUES ('explanatory-notes', 'Explanatory Notes (Acts)', $1, false, false, NULL),
           ('explanatory-memoranda', 'Explanatory Memoranda (SIs)', $2, false, false, NULL)
    ON CONFLICT (corpus_key) DO UPDATE SET est_sections = EXCLUDED.est_sections, blocked = false, blocked_reason = NULL
  `, [acts.rows.length, sis.rows.length])
  console.log('[targets] explanatory-notes + explanatory-memoranda upserted')

  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
