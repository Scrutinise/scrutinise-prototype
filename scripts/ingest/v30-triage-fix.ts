/**
 * v30-triage-fix.ts — V30 tidy-up pass §1+§5. Clears the 3 tripped breakers
 * and classifies/resets all currently-failed queue rows, per the same
 * verify-then-clear methodology as v29-triage-fix.ts.
 *
 * Live re-fetch (this session, see CHANGE_LOG) found:
 *   govuk-content (5 failed)          → unanimous HTTP 200, transient
 *   ico (5 failed)                    → unanimous HTTP 200, transient
 *   scottish-parliament-or (4 failed) → unanimous HTTP 200, transient
 *   petitions (3 failed)              → 'deadlock detected' (Postgres-side
 *                                        contention, not a fetch issue at all)
 *   pwdata-debates (1 failed)         → HTTP 503 (explicit transient signal)
 *   ofcom (1 failed)                  → 'Query read timeout' (DB-side)
 *   ofgem (1 failed)                  → AggregateError, live re-fetch → 200
 *   cma-cases (8 failed)              → unanimous HTTP 404/410 — genuinely
 *                                        dead: the decision PDFs were removed
 *                                        from assets.publishing.service.gov.uk.
 *                                        NOT retried (deterministic, per
 *                                        CLAUDE.md §13 retry policy) — classified
 *                                        as an honest known-unknown instead
 *                                        (same pattern as v29-triage-fix.ts's
 *                                        scottish-courts 404 handling).
 *
 * Idempotent. Default mode prints a dry-run plan; pass --apply to execute.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { upsertSection, sectionId } from './shared/db-metadata'

const APPLY = process.argv.includes('--apply')

const TRANSIENT_SOURCE_TYPES = [
  'govuk-content', 'ico', 'scottish-parliament-or', 'petitions', 'twfy-pwdata', 'ofcom', 'ofgem',
] as const

const TRIPPED_BREAKERS = ['govuk-content', 'ico', 'cma-cases'] as const

async function main() {
  const pool = getNeonPool()

  // ── 1. Bulk-reset all confirmed-transient failed rows ─────────────────────
  console.log('=== Bulk reset: confirmed-transient failed rows ===')
  for (const st of TRANSIENT_SOURCE_TYPES) {
    const count = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text n FROM ingest_queue WHERE "sourceType"=$1 AND status='failed'`, [st])
    console.log(`  ${st}: ${count.rows[0].n} failed → pending`)
    if (APPLY && Number(count.rows[0].n) > 0) {
      const r = await pool.query(
        `UPDATE ingest_queue SET status='pending', "claimedBy"=NULL, "claimedAt"=NULL, "lastError"=NULL
         WHERE "sourceType"=$1 AND status='failed'`, [st])
      console.log(`    reset ${r.rowCount} rows`)
    }
  }

  // ── 2. cma-cases: per-row classify (verified 404/410, genuinely dead) ─────
  console.log('\n=== cma-cases: classify confirmed-dead PDF rows (verified 404/410 this session) ===')
  const cma = await pool.query<{ id: string; docId: string }>(
    `SELECT id, "docId" FROM ingest_queue WHERE "sourceType"='cma-cases' AND status='failed'`)
  for (const row of cma.rows) {
    const bar = row.docId.indexOf('|')
    const meta = row.docId.slice(0, bar)
    const pdfUrl = row.docId.slice(bar + 1)
    const hash = meta.indexOf('#')
    const slug = hash >= 0 ? meta.slice(0, hash) : meta
    const seq = hash >= 0 ? meta.slice(hash + 1) : '1'
    console.log(`  ${slug}#${seq} → unavailable marker + skipped (${pdfUrl})`)
    if (APPLY) {
      await upsertSection({
        id: sectionId('cma-cases', slug, seq),
        corpus: 'cma-cases',
        sourceUrl: pdfUrl,
        status: 'unavailable',
        availabilityStatus: 'pdf-only',
        availabilityNote: 'CMA decision PDF returns 404/410 — asset removed from assets.publishing.service.gov.uk (verified V30 tidy-up pass)',
        parentDocId: slug,
      })
      await pool.query(
        `UPDATE ingest_queue SET status='skipped', "lastError"='V30: confirmed 404/410 — classified unavailable' WHERE id=$1`, [row.id])
    }
  }

  // ── 3. Clear the 3 tripped breakers (root causes now resolved/classified) ─
  console.log('\n=== Clearing tripped breakers ===')
  for (const sk of TRIPPED_BREAKERS) {
    console.log(`  ${sk} → state='ok'`)
    if (APPLY) {
      await pool.query(
        `UPDATE source_status SET state='ok', trip_reason=NULL, tripped_at=NULL, zero_output_streak=0
         WHERE source_key=$1`, [sk])
    }
  }

  // ── 4. Un-park any blocked rows for these sources (none found at diagnosis
  //      time, but harmless / idempotent to run) ─────────────────────────────
  console.log('\n=== Un-parking any blocked rows for the 3 breakers ===')
  for (const sk of TRIPPED_BREAKERS) {
    const count = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text n FROM ingest_queue WHERE "sourceType"=$1 AND status='blocked'`, [sk])
    console.log(`  ${sk}: ${count.rows[0].n} blocked`)
    if (APPLY && Number(count.rows[0].n) > 0) {
      const r = await pool.query(
        `UPDATE ingest_queue SET status='pending', "lastError"=NULL WHERE "sourceType"=$1 AND status='blocked'`, [sk])
      console.log(`    un-parked ${r.rowCount} rows`)
    }
  }

  console.log(APPLY ? '\nAPPLIED.' : '\nDRY-RUN — re-run with --apply to execute.')
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
