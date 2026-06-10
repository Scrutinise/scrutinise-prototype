import path from "path"
try { require("dotenv").config({ path: path.join(__dirname, "../../scrutinise-web/.env") }) } catch {}
import { getNeonPool, endNeonPool } from "./shared/neon-pool"
async function main() {
  const pool = getNeonPool()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const claimable = await client.query(`SELECT id FROM ingest_queue WHERE status = 'pending' FOR UPDATE SKIP LOCKED`)
    await client.query("ROLLBACK")
    console.log("claimable pending rows:", claimable.rows.map(r => r.id).join(", ") || "(NONE)")
  } finally { client.release() }
  const all = await pool.query(`SELECT id FROM ingest_queue WHERE status = 'pending' ORDER BY id`)
  console.log("all pending rows:     ", all.rows.map(r => r.id).join(", "))
  const act = await pool.query(`SELECT pid, state, application_name, backend_start, state_change, LEFT(query, 60) AS q FROM pg_stat_activity WHERE state <> 'idle' AND pid <> pg_backend_pid()`)
  for (const r of act.rows) console.log("activity:", JSON.stringify(r))
  const iit = await pool.query(`SELECT pid, state, NOW() - state_change AS stuck_for, LEFT(query, 80) AS q FROM pg_stat_activity WHERE state LIKE 'idle in transaction%'`)
  for (const r of iit.rows) console.log("IDLE-IN-TXN:", JSON.stringify(r))
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
