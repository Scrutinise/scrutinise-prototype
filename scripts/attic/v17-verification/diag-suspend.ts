import path from "path"
try { require("dotenv").config({ path: path.join(__dirname, "../../scrutinise-web/.env") }) } catch {}
import { getNeonPool, endNeonPool } from "./shared/neon-pool"
async function main() {
  const pool = getNeonPool()
  const r = await pool.query(`SELECT "sourceKey", "intervalMs", "maxConcurrentWorkers", suspended, "suspendedUntil", NOW() AS db_now FROM source_rate_limits WHERE "sourceKey" IN ('echr','tna-legislation','tna-caselaw')`)
  for (const row of r.rows) console.log(JSON.stringify(row))
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
