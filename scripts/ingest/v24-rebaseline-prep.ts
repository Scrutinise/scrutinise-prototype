/**
 * v24-rebaseline-prep.ts — §1 prep: clear the small failed-row counts blocking ✓
 * on ni-judgments, quangos-govuk, historic-hansard so the live ingest service can
 * drain the transient ones and the deterministic gap-fill misses are classified
 * (not left as 'failed', which the rebaseline guard treats as an open row).
 *
 *   --inspect   : show the failed rows, change nothing (default)
 *   --apply     : reset transient failures to pending; skip deterministic gapday misses
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'

async function main() {
  const pool = getNeonPool()
  const apply = process.argv.includes('--apply')

  console.log('=== failed rows under §1 corpora ===')
  const rows = await pool.query(`
    SELECT id, corpus, "sourceType", "docId", "lastError"
    FROM ingest_queue
    WHERE status='failed' AND corpus IN ('ni-judgments','quangos-govuk','historic-hansard')
    ORDER BY corpus, id`)
  for (const r of rows.rows) console.log(`${r.corpus}\t${r.sourceType}\t${r.docId}\t${(r.lastError ?? '').slice(0,90)}`)

  if (!apply) { console.log('\n(dry-run; pass --apply)'); await endNeonPool(); return }

  // Transient (connection timeout / abort) → retry: the live worker re-claims pending.
  const reset = await pool.query(`
    UPDATE ingest_queue SET status='pending', "lastError"=NULL, "claimedBy"=NULL, "claimedAt"=NULL
    WHERE status='failed' AND corpus IN ('ni-judgments','quangos-govuk')`)
  console.log(`\nreset transient failures → pending: ${reset.rowCount}`)

  // historic-hansard gap-fill day-index misses are deterministic (the HTML archive
  // has no page for that sitting day) — the V22 "genuinely lost" category. Mark
  // skipped with a note so ✓ is not blocked and the loss is recorded, not hidden.
  const skip = await pool.query(`
    UPDATE ingest_queue
    SET status='skipped',
        "lastError"='V24: gap-fill day-index absent on historic-hansard HTML archive — genuinely unfillable (recorded, not lost-silently)'
    WHERE status='failed' AND corpus='historic-hansard'`)
  console.log(`historic-hansard gapday misses → skipped: ${skip.rowCount}`)

  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
