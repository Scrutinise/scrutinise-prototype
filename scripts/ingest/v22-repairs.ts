/**
 * v22-repairs.ts — V22 §1 repairs (committees-api + throttled enum rows).
 *
 * committees-api: the WrittenEvidence offset walk dies server-side past deep
 * skips (HTTP 500 after ~31s — load-dependent; probed 13 Jun: skip=50000 also
 * 500s). Item-row processing was never the problem (12,732 done before the
 * trip). So: retire the offset list: rows (replaced by date-windowed rows,
 * seeded post-push), clear the breaker, unpark the item rows — they drain
 * under currently-deployed code.
 *
 * judiciaryni is NOT touched here: its fix (status-0/403 backoff + halved
 * rate) needs the push first, or the same burn-through repeats.
 *
 * Throttled enum rows (regional 61 + ukpga 27): cooloff long passed — reset.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'

async function main() {
  const pool = getNeonPool()

  // 1. Retire the offset-walk list rows (failed + blocked) — replaced by
  //    date-windowed list rows in V22.
  const retired = await pool.query(`
    UPDATE ingest_queue
    SET status = 'done', "lastError" = 'retired V22 — offset walk replaced by date-windowed list rows'
    WHERE "sourceType" = 'committees-api'
      AND "docId" LIKE 'list:%'
      AND status IN ('failed', 'blocked')`)
  console.log(`[committees] retired offset list rows: ${retired.rowCount}`)

  // 2. Clear the committees-api breaker.
  await pool.query(`
    UPDATE source_status
    SET state = 'ok', trip_reason = NULL, tripped_at = NULL, zero_output_streak = 0
    WHERE source_key = 'committees-api'`)
  console.log('[committees] breaker cleared')

  // 3. Unpark the blocked item rows.
  const unparked = await pool.query(`
    UPDATE ingest_queue
    SET status = 'pending', "lastError" = NULL
    WHERE "sourceType" = 'committees-api' AND status = 'blocked'`)
  console.log(`[committees] unparked item rows: ${unparked.rowCount}`)

  // 4. Reset throttled TNA enum rows (cooloff passed).
  const enums = await pool.query(`
    UPDATE ingest_queue
    SET status = 'pending', "lastError" = NULL, "claimedBy" = NULL, "claimedAt" = NULL
    WHERE status = 'failed' AND "lastError" LIKE '%throttled — reset after cooloff%'`)
  console.log(`[tna-enum] reset throttled enum rows: ${enums.rowCount}`)

  // 5. Inspect the si-2010plus 17-row tail (why pending?).
  const si = await pool.query(`
    SELECT "docId", "sourceType", priority, status, "createdAt"
    FROM ingest_queue WHERE corpus = 'si-2010plus' AND status = 'pending'
    ORDER BY "docId"`)
  console.log('[si-2010plus] pending tail:')
  for (const r of si.rows) console.log('  ', JSON.stringify(r))

  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
