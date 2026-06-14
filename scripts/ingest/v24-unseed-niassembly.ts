/**
 * v24-unseed-niassembly.ts — remove the prematurely-seeded niassembly-hansard
 * rows. The new sourceType processor is not deployed yet, so the live worker
 * would markSkipped these. Seeding is deferred to the POST-PUSH run order
 * (re-run v24-seed-niassembly-hansard.ts --seed after the deploy). One-off.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'

async function main() {
  const pool = getNeonPool()
  const before = await pool.query(`SELECT status, COUNT(*)::int n FROM ingest_queue WHERE "sourceType"='niassembly-hansard' GROUP BY status`)
  for (const r of before.rows) console.log(`before: ${r.status} ${r.n}`)
  const del = await pool.query(`DELETE FROM ingest_queue WHERE "sourceType"='niassembly-hansard'`)
  console.log(`deleted ${del.rowCount} niassembly-hansard queue rows`)
  const secs = await pool.query(`SELECT COUNT(*)::int n FROM corpus_sections WHERE corpus='niassembly-hansard'`)
  console.log(`corpus_sections for niassembly-hansard (should be 0 — none processed yet): ${secs.rows[0].n}`)
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
