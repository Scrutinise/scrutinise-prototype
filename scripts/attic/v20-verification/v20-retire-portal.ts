/**
 * v20-retire-portal.ts — committees-api canary verified from Railway (73
 * sections compiled): clear the committees-portal breaker and retire the
 * portal-era rows per the V16 handoff SQL (superseded by committees-api).
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const b = await pool.query(`
    UPDATE source_status SET state='ok', trip_reason=NULL, tripped_at=NULL, zero_output_streak=0
    WHERE source_key='committees-portal'`)
  console.log('breaker cleared:', b.rowCount)
  const r = await pool.query(`
    UPDATE ingest_queue SET status='done', "lastError"='retired V20 — replaced by committees-api rows'
    WHERE "sourceType" IN ('committees-portal', 'committees-document')
      AND status IN ('failed', 'blocked', 'pending')`)
  console.log('portal rows retired:', r.rowCount)
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
