/**
 * v29-triage-fix.ts — §1 failed-rows recovery. Run POST-PUSH (after the
 * retry-hardened ico.ts / scottish-courts.ts adapters deploy).
 *
 * Diagnosis (v29-triage-probe, 20 Jun 2026): the V27-drain failures are
 * transient host-side throttling under each row's request fan-out, NOT dead
 * pages — 14/14 sampled ICO "page fetch failed" rows and 8/9 scottish-courts
 * "PDF fetch failed" rows re-fetch HTTP 200 on a calm retry. Exactly one
 * scottish-courts row is a genuine 404.
 *
 *   ico             → bulk reset all 'failed' rows to 'pending' (the hardened
 *                     adapter + the gentler re-drain recovers them); no per-row
 *                     re-fetch needed (the sample was unanimous).
 *   scottish-courts → re-fetch each failed PDF: 200 → reset to 'pending';
 *                     404/dead → write an 'unavailable' pdf-only marker (honest
 *                     known-unknown, §1d) and mark the queue row 'skipped'.
 *
 * Idempotent. Default mode prints a dry-run plan; pass --apply to execute.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { upsertSection, sectionId } from './shared/db-metadata'
import { fetchJudgmentPdf, keyToPdfUrl } from './sources/scottish-courts'

const APPLY = process.argv.includes('--apply')

async function main() {
  const pool = getNeonPool()

  // ── ICO: bulk reset (transient) ────────────────────────────────────────────
  const icoCount = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text n FROM ingest_queue WHERE "sourceType"='ico' AND status='failed'`)
  console.log(`ICO failed rows: ${icoCount.rows[0].n} → reset to pending (transient)`)
  if (APPLY) {
    const r = await pool.query(
      `UPDATE ingest_queue SET status='pending', "claimedBy"=NULL, "claimedAt"=NULL, "lastError"=NULL
       WHERE "sourceType"='ico' AND status='failed'`)
    console.log(`  reset ${r.rowCount} ICO rows`)
  }

  // ── Scottish courts: per-row classify (only 9) ─────────────────────────────
  const sc = await pool.query<{ id: string; docId: string }>(
    `SELECT id, "docId" FROM ingest_queue WHERE "sourceType"='scottish-courts' AND status='failed'`)
  console.log(`\nscottish-courts failed rows: ${sc.rows.length} — classifying live`)
  let revived = 0, dead = 0
  for (const row of sc.rows) {
    const key = row.docId.split('|')[0]
    const date = row.docId.split('|')[1] || undefined
    const buf = await fetchJudgmentPdf(key)
    if (buf) {
      console.log(`  ✓ recoverable → pending: ${key}`)
      revived++
      if (APPLY) await pool.query(
        `UPDATE ingest_queue SET status='pending', "claimedBy"=NULL, "claimedAt"=NULL, "lastError"=NULL WHERE id=$1`, [row.id])
    } else {
      console.log(`  ✗ dead (404) → unavailable marker + skipped: ${key}`)
      dead++
      if (APPLY) {
        await upsertSection({
          id: sectionId('scottish-courts', key, '1'),
          corpus: 'scottish-courts',
          sourceUrl: keyToPdfUrl(key),
          status: 'unavailable',
          availabilityStatus: 'pdf-only',
          availabilityNote: 'judgment PDF returns 404 — withdrawn/removed from scotcourts.gov.uk (verified V29 §1)',
          itemDate: date,
          parentDocId: key,
        })
        await pool.query(`UPDATE ingest_queue SET status='skipped', "lastError"='V29 §1: confirmed 404 — classified unavailable' WHERE id=$1`, [row.id])
      }
    }
    await new Promise(r => setTimeout(r, 500))
  }
  console.log(`\nscottish-courts: ${revived} recoverable, ${dead} dead`)
  console.log(APPLY ? '\nAPPLIED.' : '\nDRY-RUN — re-run with --apply to execute.')
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
