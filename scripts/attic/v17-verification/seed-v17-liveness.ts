import path from "path"
try { require("dotenv").config({ path: path.join(__dirname, "../../scrutinise-web/.env") }) } catch {}
import { getNeonPool, endNeonPool } from "./shared/neon-pool"
async function main() {
  const pool = getNeonPool()
  const reset = await pool.query(`
    UPDATE ingest_queue
    SET status = 'pending', "claimedBy" = NULL, "claimedAt" = NULL, "completedAt" = NULL,
        "lastError" = 'V17 liveness test'
    WHERE id IN (
      SELECT id FROM ingest_queue
      WHERE corpus = 'si-2010plus' AND status = 'done'
      ORDER BY "docId" DESC LIMIT 5
    ) RETURNING "docId"
  `)
  console.log(`reset (${reset.rowCount}):`, reset.rows.map(r => r.docId).join(", "))
  const st = await pool.query(`SELECT last_beat, NOW() - last_beat AS age FROM ingest_service_state WHERE id = 1`)
  console.log("heartbeat age:", JSON.stringify(st.rows[0]?.age))
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
