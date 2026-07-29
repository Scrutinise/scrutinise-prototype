/**
 * v30-lgsco-fix.ts — V30 tidy-up §3. Companion to the process-row.ts propagation
 * fix (lgo.org.uk's ?page=N verified to have zero effect — see that file's
 * comment for the full finding).
 *
 * (1) Retires the one stray failed row (list:adult-care-services:108) — not
 *     retried: page 108 returns the identical 10-item listing page 1 already
 *     captured, so retrying adds nothing (superseded by the propagation fix,
 *     not a bug to chase further).
 * (2) Seeds list:{category}:1 for the 7 categories that never produced any
 *     output (children-s-care-services, education, environment-and-regulation,
 *     housing, transport-and-highways, planning, other-categories) — their
 *     initial page-1 seed row from the V29 seed evidently failed early and was
 *     never retried; live-verified 9 Jul [sic — see session] all 9 non-'health'
 *     categories return a full 10-item page-1 right now. 'health' returned 0
 *     live (genuinely empty right now) but is reseeded too for honesty — a
 *     harmless no-op if still empty.
 * (3) Re-baselines corpus_targets.lgsco: the true reachable universe through
 *     this endpoint is capped at "10 most recent per category" (~90-100 max,
 *     NOT the full since-2013 archive — no working pagination/sitemap/search
 *     endpoint exists for that). est_sections set to the honest achievable cap;
 *     notes document the finding + that a real archive build is a future
 *     Charlie-gated decision, not in scope for this tidy-up pass.
 *
 * Idempotent. Default mode prints a dry-run plan; pass --apply to execute.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { LGSCO_CATEGORIES } from './sources/lgsco'

const APPLY = process.argv.includes('--apply')
const CORPUS = 'lgsco'
const MISSING_CATEGORIES = [
  'children-s-care-services', 'education', 'environment-and-regulation', 'housing',
  'transport-and-highways', 'planning', 'other-categories', 'health',
] as const

async function main() {
  const pool = getNeonPool()

  console.log('=== (1) Retire the stray failed list-page row (superseded, not retried) ===')
  const failedRow = await pool.query(
    `SELECT id FROM ingest_queue WHERE corpus=$1 AND status='failed'`, [CORPUS])
  console.log(`  found ${failedRow.rowCount} failed row(s)`)
  if (APPLY) {
    const r = await pool.query(
      `UPDATE ingest_queue SET status='skipped',
         "lastError"='V30: propagation-past-page-1 confirmed pointless (site ignores ?page=N) — superseded, not retried'
       WHERE corpus=$1 AND status='failed'`, [CORPUS])
    console.log(`  skipped ${r.rowCount} row(s)`)
  }

  console.log('\n=== (2) Seed page-1 for the 7 never-captured categories (+ health) ===')
  const rows = MISSING_CATEGORIES.map(c => ({
    id: `${CORPUS}:list:${c}:1`, corpus: CORPUS, docId: `list:${c}:1`, sourceType: CORPUS, priority: 4,
  }))
  console.log(`  categories: ${MISSING_CATEGORIES.join(', ')}`)
  if (APPLY) {
    const { affected } = await bulkInsertQueueRows(rows)
    console.log(`  seeded ${affected}/${rows.length} rows`)
  }

  console.log('\n=== (3) Re-baseline corpus_targets — honest cap for this endpoint ===')
  const cap = LGSCO_CATEGORIES.length * 10 // 10 categories × "10 most recent" ceiling — verified live V30
  console.log(`  est_sections -> ${cap} (10/category × ${LGSCO_CATEGORIES.length} categories, the true ceiling of this endpoint)`)
  if (APPLY) {
    await pool.query(`
      UPDATE corpus_targets SET est_sections=$2, est_is_confirmed=false, blocked=false, blocked_reason=NULL,
        notes='V29 §7 — lgo.org.uk decisions DB, lgsco-open (OGL-equivalent, verified /copyright). V30: ?page=N on /decisions/{category} verified to have ZERO effect (page=1..999999 byte-identical "10 most recent" listing; no sitemap or date-range search endpoint found either) — this endpoint cannot reach the full since-2013 archive. est_sections re-baselined to the honest ceiling (10/category); a real archive build needs a different mechanism (e.g. the sitewide /searchpost form) — future Charlie-gated decision, out of scope for the V30 tidy-up pass.',
        updated_at=NOW()
      WHERE corpus_key=$1`, [CORPUS, cap])
  }

  console.log(APPLY ? '\nAPPLIED.' : '\nDRY-RUN — re-run with --apply to execute.')
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
