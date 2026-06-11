import { getNeonPool } from './shared/neon-pool'
const ACTS = ['uksi/1993/197', 'uksi/1994/1139', 'uksi/1999/1867', 'uksi/1999/1958']
async function main() {
  const pool = getNeonPool()
  // The failed rows are AI-compile-era relics; the modern CLML path (rawToText)
  // will overwrite them by section id on reprocess — but only if R2 lacks the
  // compiled key. Check and clear stale R2-state by deleting the failed rows'
  // ids is unsafe; instead requeue and verify post-drain.
  for (const docId of ACTS) {
    await pool.query(`
      INSERT INTO ingest_queue (id, corpus, "docId", "sourceType", priority, status)
      VALUES ($1, 'si-pre-2010', $2, 'tna-legislation', 1, 'pending')
      ON CONFLICT (id) DO UPDATE SET status='pending', "lastError"=NULL, "claimedBy"=NULL, "claimedAt"=NULL`,
      [`si-pre-2010:${docId}`, docId])
  }
  console.log('requeued', ACTS.length, 'si-pre-2010 instruments')
  const u = await pool.query(`SELECT id, availability_status FROM corpus_sections WHERE corpus='si-pre-2010' AND status='unavailable'`)
  console.table(u.rows)
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
