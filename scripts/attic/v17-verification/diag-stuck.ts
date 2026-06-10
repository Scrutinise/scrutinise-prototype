import path from "path"
try { require("dotenv").config({ path: path.join(__dirname, "../../scrutinise-web/.env") }) } catch {}
import { getNeonPool, endNeonPool } from "./shared/neon-pool"
async function main() {
  const pool = getNeonPool()
  const rows = await pool.query(`SELECT id, status, attempts, "claimedBy", "claimedAt", "lastError" FROM ingest_queue WHERE status IN ('pending','claimed') OR ("completedAt" > NOW() - INTERVAL '60 minutes') ORDER BY id LIMIT 30`)
  for (const r of rows.rows) console.log(JSON.stringify(r))
  const rl = await pool.query(`SELECT "sourceKey", suspended, "suspendedUntil", "isComplete" FROM source_rate_limits WHERE "sourceKey" IN ('echr','tna-legislation')`)
  for (const r of rl.rows) console.log(JSON.stringify(r))
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
