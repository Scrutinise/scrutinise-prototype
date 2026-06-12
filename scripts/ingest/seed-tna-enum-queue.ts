/**
 * seed-tna-enum-queue.ts — V20: queue-driven TNA year enumeration.
 *
 * ⚠️ RUN ONLY AFTER THE V20 PUSH (the enum:{type}:{year} docId form is new).
 *
 * Replaces the local enumeration runs that TNA keeps penalty-boxing (the V19
 * regnal pass and the regional universe pass) — the rows run from Railway IPs
 * under the normal tna-legislation budget. Each enum row seeds pending act
 * rows for anything corpus_sections doesn't hold (processTnaEnum).
 *
 *  - ukpga 1267–1999 → corpus primary-acts-pre-2000 (regnal completion, V19 §2.1)
 *  - 9 regional types 1970–2026 → corpus regional (universe re-baseline; includes
 *    asc + mwa, which discovery's 7-type list omitted — found V20)
 *
 * After the ukpga rows drain AND their spawned act rows drain, run
 * v19-cleanup-ukpga-calendar.ts locally (DB+R2 only), then ✓ re-baseline both
 * corpora per playbook §1c.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'

// The 3 acts holding V19's 27 failed sections (AI-billing-era relics) — plain
// act rows, carried from v19-seed-ukpga-regnal which never got to run locally.
const FAILED_ACT_REQUEUE = ['ukpga/1996/58', 'ukpga/1996/59', 'ukpga/1988/52']

const REGIONAL_TYPES = ['asp', 'asc', 'anaw', 'mwa', 'nia', 'nisi', 'nisr', 'ssi', 'wsi']

async function main() {
  const pool = getNeonPool()
  const rows: Array<{ id: string; corpus: string; docId: string; sourceType: string; priority: number }> = []

  for (let y = 1267; y <= 1999; y++) {
    rows.push({ id: `primary-acts-pre-2000:enum:ukpga:${y}`, corpus: 'primary-acts-pre-2000', docId: `enum:ukpga:${y}`, sourceType: 'tna-legislation', priority: 2 })
  }
  for (const type of REGIONAL_TYPES) {
    for (let y = 1970; y <= 2026; y++) {
      rows.push({ id: `regional:enum:${type}:${y}`, corpus: 'regional', docId: `enum:${type}:${y}`, sourceType: 'tna-legislation', priority: 2 })
    }
  }
  const { affected } = await bulkInsertQueueRows(rows)
  console.log(`[seed] ${affected} enum rows (${rows.length} total: 733 ukpga + ${REGIONAL_TYPES.length}×57 regional)`)

  for (const docId of FAILED_ACT_REQUEUE) {
    await pool.query(
      `INSERT INTO ingest_queue (id, corpus, "docId", "sourceType", priority, status)
       VALUES ($1, 'primary-acts-pre-2000', $2, 'tna-legislation', 1, 'pending')
       ON CONFLICT (id) DO UPDATE SET status='pending', "lastError"=NULL, "claimedBy"=NULL, "claimedAt"=NULL`,
      [`primary-acts-pre-2000:${docId}`, docId])
  }
  console.log(`[seed] re-queued ${FAILED_ACT_REQUEUE.length} failed-section acts`)
  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
