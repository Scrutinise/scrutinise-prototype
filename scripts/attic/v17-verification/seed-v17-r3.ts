import path from "path"
try { require("dotenv").config({ path: path.join(__dirname, "../../scrutinise-web/.env") }) } catch {}
import { getNeonPool, endNeonPool } from "./shared/neon-pool"
async function main() {
  const pool = getNeonPool()
  const reset = await pool.query(`
    UPDATE ingest_queue
    SET status = 'pending', "claimedBy" = NULL, "claimedAt" = NULL, "completedAt" = NULL,
        "lastError" = 'V17 shakedown r3'
    WHERE id IN (
      SELECT id FROM ingest_queue
      WHERE corpus = 'si-2010plus' AND "docId" >= 'uksi/2026/80' AND "docId" <= 'uksi/2026/89' AND status = 'done'
    ) RETURNING "docId"
  `)
  console.log(`reset (${reset.rowCount}):`, reset.rows.map(r => r.docId).join(", "))
  for (let i = 0; i < 3; i++) {
    const start = 999250 + i * 50
    await pool.query(
      `INSERT INTO ingest_queue (id, corpus, "docId", "sourceType", priority, status)
       VALUES ($1, 'echr-hudoc', $2, 'echr', 5, 'pending') ON CONFLICT (id) DO NOTHING`,
      [`echr-hudoc:page:${start}`, `page:${start}`]
    )
  }
  const q = await pool.query(`SELECT status, COUNT(*)::int n FROM ingest_queue GROUP BY status ORDER BY status`)
  console.log("queue:", q.rows.map(r => `${r.status}=${r.n}`).join(" "))
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
