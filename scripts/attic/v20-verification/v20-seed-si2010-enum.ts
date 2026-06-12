/**
 * v20-seed-si2010-enum.ts — V20 finding: si-2010plus holds only 5,899 distinct
 * uksi instruments (the V12-noted "needs reseeding for 2015–2026 gap" was never
 * run; the corpus was never ✓'d). Seeds enum:uksi:{2010..2026} rows — the
 * queue-driven enumeration (processTnaEnum) fills missing instruments from
 * Railway IPs. Re-baseline si-2010plus ✓ at drain; rerun
 * seed-explanatory-queue.ts afterwards so new SIs get EM rows.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'

async function main() {
  const rows = []
  for (let y = 2010; y <= 2026; y++) {
    rows.push({ id: `si-2010plus:enum:uksi:${y}`, corpus: 'si-2010plus', docId: `enum:uksi:${y}`, sourceType: 'tna-legislation', priority: 2 })
  }
  const { affected } = await bulkInsertQueueRows(rows)
  console.log(`[seed] si-2010plus enum rows: ${affected}`)
  const pool = getNeonPool()
  await pool.query(`UPDATE corpus_targets SET est_is_confirmed = false WHERE corpus_key = 'si-2010plus'`)
  console.log('[targets] si-2010plus est_is_confirmed → false (re-baseline at enum drain)')
  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
