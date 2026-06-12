/**
 * v20-cleanup-mislabeled-govuk.ts — V20 probe 8 (partials audit).
 *
 * Root cause (V2-era, 3 Jun 2026): processGovUk's corpus switch lacked
 * planning-policy/building-regs cases when their __index rows were first
 * processed → the default branch (listHmrcTiins) wrote the SAME 791 TIIN
 * documents under THREE corpus labels (verified: 791/791 doc-id overlap with
 * hmrc-tiins for both). college-of-policing used a free-text gov.uk search
 * with no org filter → 1,944 unrelated documents (DVLA accounts, ET decisions,
 * news updates — verified by sample).
 *
 * This deletes the mislabeled corpus_sections rows + their R2 objects
 * (the V19 chrome-cleanup precedent), then seeds fresh __index rows for
 * building-regs and planning-policy (deployed code has had the correct switch
 * cases since V2 part 3 — safe to seed without a push).
 * college-of-policing is NOT reseeded: the real APP source (college.police.uk)
 * is CF-blocked and licence-unverified — corpus_targets marked blocked.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { r2Delete } from './shared/r2-client'

const MISLABELED = ['building-regs', 'planning-policy', 'college-of-policing']

async function main() {
  const pool = getNeonPool()

  for (const corpus of MISLABELED) {
    const keys = await pool.query<{ r2Key: string | null }>(
      `SELECT "r2Key" FROM corpus_sections WHERE corpus = $1`, [corpus])
    let deleted = 0
    for (const row of keys.rows) {
      if (!row.r2Key) continue
      try { await r2Delete(row.r2Key); deleted++ } catch (e) { console.warn(`[r2] delete failed ${row.r2Key}: ${e}`) }
    }
    const res = await pool.query(`DELETE FROM corpus_sections WHERE corpus = $1`, [corpus])
    console.log(`[cleanup] ${corpus}: ${res.rowCount} rows deleted, ${deleted} R2 objects deleted`)
    await pool.query(`DELETE FROM ingest_queue WHERE corpus = $1`, [corpus])
  }

  // Fresh, correctly-dispatched index rows (sourceType gov-uk, current code path)
  for (const corpus of ['building-regs', 'planning-policy']) {
    await pool.query(`
      INSERT INTO ingest_queue (id, corpus, "docId", "sourceType", priority, status)
      VALUES ($1, $2, '__index', 'gov-uk', 2, 'pending')
      ON CONFLICT (id) DO UPDATE SET status='pending', "lastError"=NULL, "claimedBy"=NULL, "claimedAt"=NULL
    `, [`${corpus}:__index`, corpus])
    console.log(`[seed] ${corpus}:__index pending`)
  }

  // corpus_targets re-baselines from the audit
  const updates: Array<[string, string]> = [
    [`UPDATE corpus_targets SET est_sections=21, est_is_confirmed=false WHERE corpus_key='building-regs'`, 'building-regs est 21 (~, drains to ✓)'],
    [`UPDATE corpus_targets SET est_sections=64, est_is_confirmed=false WHERE corpus_key='planning-policy'`, 'planning-policy est 64 (~, drains to ✓)'],
    [`UPDATE corpus_targets SET est_sections=253, est_is_confirmed=true WHERE corpus_key='sentencing-council'`, 'sentencing-council ✓ 253 (live universe re-measured = 253; V13 ~381 was pre-dedup)'],
    [`UPDATE corpus_targets SET est_sections=17, est_is_confirmed=true WHERE corpus_key='nilawcom'`, 'nilawcom ✓ 17 (site SSL-dead 12 Jun 2026; 17 of ~18 historical reports held)'],
    [`UPDATE corpus_targets SET retired=true, blocked=true, blocked_reason='superseded by pwdata-wrans per-speech corpus (V20 audit)' WHERE corpus_key='written-answers'`, 'written-answers retired'],
    [`UPDATE corpus_targets SET retired=true, blocked=true, blocked_reason='superseded by pwdata-wms/lordswms per-speech corpora (V20 audit)' WHERE corpus_key='written-statements'`, 'written-statements retired'],
    [`UPDATE corpus_targets SET est_sections=0, est_is_confirmed=false, blocked=true, blocked_reason='V20 audit: prior content was unfiltered gov.uk search junk (deleted); real APP source college.police.uk CF-blocked + licence unverified' WHERE corpus_key='college-of-policing'`, 'college-of-policing blocked pending source+licence'],
  ]
  for (const [sql, label] of updates) {
    const r = await pool.query(sql)
    console.log(`[targets] ${label} (${r.rowCount} row)`)
  }

  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
