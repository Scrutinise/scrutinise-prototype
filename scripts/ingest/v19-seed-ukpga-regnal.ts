/**
 * v19-seed-ukpga-regnal.ts — V19 §2.1: complete primary-acts-pre-2000.
 *
 * Root cause (V19): pre-1963 acts are canonically regnal (ukpga/Geo5/14-15/41);
 * the enumeration regex only matched calendar ids, so pre-1963 acts were never
 * enumerable. The 6,897 pre-1963 rows seeded from Neon legacy used calendar ids:
 * data.xml dead-ends (300/301→/resources) pushed 5,840 acts into the data.htm
 * fallback which captured ~834 words of site chrome each (silently marked
 * compiled), and 1,057 ambiguous ids (two acts sharing year+chapter) were marked
 * unavailable. Regnal ids work: 307 → /enacted/data.xml or full revised CLML.
 *
 * This seeder:
 *  1. Enumerates ukpga 1267–1999 via listActEntries (checkpointed).
 *  2. Seeds a regnal-id queue row for EVERY pre-1963 act (replacing the garbage
 *     coverage), and a canonical-id row for any post-1963 act with no sections.
 *  3. Re-queues the 3 acts holding the 27 status='failed' sections.
 *
 * After the queue drains, run v19-cleanup-ukpga-calendar.ts to delete the
 * superseded calendar-form boilerplate/unavailable rows and re-baseline ✓.
 */
import * as fs from 'fs'
import * as path from 'path'
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { listActEntries, TnaActEntry } from './sources/tna-legislation'

const CHECKPOINT = path.join(__dirname, 'v19-ukpga-enum.json')
const FAILED_ACT_REQUEUE = ['ukpga/1996/58', 'ukpga/1996/59', 'ukpga/1988/52']

function isRegnal(docId: string): boolean {
  return !/^ukpga\/[0-9]+\/[0-9]+$/.test(docId)
}

async function main() {
  const pool = getNeonPool()

  let entries: TnaActEntry[]
  if (fs.existsSync(CHECKPOINT)) {
    entries = JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8'))
    console.log(`[enum] ${entries.length} entries from checkpoint`)
  } else {
    entries = await listActEntries('ukpga', 1267, 1999)
    fs.writeFileSync(CHECKPOINT, JSON.stringify(entries))
  }

  const regnal = entries.filter(e => isRegnal(e.docId))
  const calendar = entries.filter(e => !isRegnal(e.docId))
  console.log(`universe: ${entries.length} acts (${regnal.length} regnal / ${calendar.length} calendar)`)

  // Docs already carrying REAL content: any compiled section that is not the
  // chrome-boilerplate html capture. (All 5,840 format='html' rows in this
  // corpus are boilerplate — verified V19: uniform ~834 words, zero Leg markers.)
  const realRes = await pool.query<{ d: string }>(`
    SELECT DISTINCT split_part(id, ':', 2) AS d
    FROM corpus_sections
    WHERE corpus = 'primary-acts-pre-2000' AND status = 'compiled' AND format <> 'html'
  `)
  const hasRealContent = new Set(realRes.rows.map(r => r.d))
  // Docs with ANY row (incl. markers) — used only for the post-1963 missing check
  const anyRes = await pool.query<{ d: string }>(`
    SELECT DISTINCT split_part(id, ':', 2) AS d
    FROM corpus_sections WHERE corpus = 'primary-acts-pre-2000'
  `)
  const hasAnyRow = new Set(anyRes.rows.map(r => r.d))

  const rows: Array<{ id: string; corpus: string; docId: string; sourceType: string; priority: number }> = []

  // Pre-1963 (regnal feed id): seed regnal docId unless it already has rows
  // (idempotent reruns) or its calendar alias already has real (non-html) content.
  let skippedReal = 0
  for (const e of regnal) {
    if (hasAnyRow.has(e.docId)) continue
    if (e.calendarId && hasRealContent.has(e.calendarId)) { skippedReal++; continue }
    rows.push({ id: `primary-acts-pre-2000:${e.docId}`, corpus: 'primary-acts-pre-2000', docId: e.docId, sourceType: 'tna-legislation', priority: 1 })
  }

  // Post-1963 calendar entries: seed only when the act has no rows at all.
  let missingCalendar = 0
  for (const e of calendar) {
    if (hasAnyRow.has(e.docId)) continue
    missingCalendar++
    rows.push({ id: `primary-acts-pre-2000:${e.docId}`, corpus: 'primary-acts-pre-2000', docId: e.docId, sourceType: 'tna-legislation', priority: 1 })
  }

  console.log(`to seed: ${rows.length} (regnal ${rows.length - missingCalendar}, skipped ${skippedReal} with real CLML under calendar id, missing post-1963 calendar ${missingCalendar})`)

  const { affected } = await bulkInsertQueueRows(rows, { resetExisting: true })
  console.log(`queue rows inserted/reset: ${affected}`)

  // Re-queue the 3 acts with failed sections (post-1963, CLML path fine —
  // upsertSection overwrites the failed rows by id on reprocess).
  for (const docId of FAILED_ACT_REQUEUE) {
    await pool.query(
      `INSERT INTO ingest_queue (id, corpus, "docId", "sourceType", priority, status)
       VALUES ($1, 'primary-acts-pre-2000', $2, 'tna-legislation', 1, 'pending')
       ON CONFLICT (id) DO UPDATE SET status='pending', "lastError"=NULL, "claimedBy"=NULL, "claimedAt"=NULL`,
      [`primary-acts-pre-2000:${docId}`, docId]
    )
  }
  console.log(`re-queued ${FAILED_ACT_REQUEUE.length} acts with failed sections`)

  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
