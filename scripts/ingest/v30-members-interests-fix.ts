/**
 * v30-members-interests-fix.ts — V30 tidy-up §2. Companion to the TAKE=20 fix
 * in process-row.ts / v29-seed-parliament.ts (interests-api.parliament.uk caps
 * Take at 20 regardless of what's requested; the original TAKE=100 + skip-by-100
 * seeder meant every row only captured the first 20 of its intended 100-item
 * window — 80% of the corpus (items 20-99 of every hundred) was never fetched.
 * That's the "stall": 34 rows × 20 items/row ≈ 680 sections, matching the
 * reported 680/3,341 = 20.4% exactly.
 *
 * Reseeds list:{skip} for skip=0,20,40,...< live total (currently 3,415, up
 * from the 3,341 measured at the original V29 seed — re-baselined here too).
 * Idempotent — re-touches the already-compiled skip=0/100/200/... windows
 * harmlessly (a handful of redundant re-fetches) but guarantees complete
 * step-20 coverage across the whole range.
 *
 * Default mode prints a dry-run plan; pass --apply to execute.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { interestsTotal } from './sources/members-interests'

const APPLY = process.argv.includes('--apply')
const CORPUS = 'members-interests'
const TAKE = 20

async function main() {
  const pool = getNeonPool()

  const total = await interestsTotal()
  console.log(`live total (incl. child interests): ${total}`)

  const rows = []
  for (let skip = 0; skip < total; skip += TAKE) {
    rows.push({ id: `${CORPUS}:list:${skip}`, corpus: CORPUS, docId: `list:${skip}`, sourceType: CORPUS, priority: 3 })
  }
  console.log(`plan: ${rows.length} list-page rows (step ${TAKE}), covering skip=0..${total}`)

  if (APPLY) {
    const { affected } = await bulkInsertQueueRows(rows)
    console.log(`seeded ${affected}/${rows.length} rows`)
    await pool.query(`
      UPDATE corpus_targets SET est_sections=$2, est_is_confirmed=false,
        notes='V29 §3 Parliament remainder — Open Parliament Licence v3.0. V30: fixed a step-size bug — interests-api.parliament.uk caps Take at 20 regardless of what is requested (verified live); the original TAKE=100 + skip-by-100 seeder silently skipped 80% of every 100-item window (the 680/3,341=20.4% "stall" was this, not a fetch failure). Reseeded at the correct step-20; re-baseline to true drained count once complete.',
        updated_at=NOW()
      WHERE corpus_key=$1`, [CORPUS, total])
    console.log(`corpus_targets.est_sections -> ${total}`)
  }

  console.log(APPLY ? '\nAPPLIED.' : '\nDRY-RUN — re-run with --apply to execute.')
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
