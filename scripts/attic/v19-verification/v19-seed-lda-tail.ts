import { getNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
async function main() {
  const pool = getNeonPool()
  // 70,040 live records / 500 per page = 141 pages; new records append at the
  // end. 22 pages stays under the 25-row zero-output breaker threshold.
  const rows = []
  for (let p = 120; p <= 141; p++) {
    rows.push({ id: `lda-commonsoralquestions:page:${p}`, corpus: 'lda-commonsoralquestions', docId: `page:${p}`, sourceType: 'lda-parliament', priority: 2 })
  }
  const { affected } = await bulkInsertQueueRows(rows, { resetExisting: true })
  console.log('lda oral tail pages seeded:', affected)
  await pool.query(`UPDATE corpus_targets SET est_sections = 70040, est_is_confirmed = false WHERE corpus_key = 'lda-commonsoralquestions'`)
  console.log('est_sections -> 70,040 (live LDA totalResults; ✓ at drain)')
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
