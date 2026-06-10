import path from "path"
try { require("dotenv").config({ path: path.join(__dirname, "../../scrutinise-web/.env") }) } catch {}
import { getNeonPool, endNeonPool } from "./shared/neon-pool"
async function main() {
  const pool = getNeonPool()
  for (let i = 0; i < 25; i++) {
    const q = await pool.query(`SELECT COUNT(*)::int n FROM ingest_queue WHERE status = 'pending'`)
    const st = await pool.query(`SELECT EXTRACT(EPOCH FROM (NOW() - last_beat))::int AS age FROM ingest_service_state WHERE id = 1`)
    console.log(`pending=${q.rows[0].n} beatAge=${st.rows[0].age}s`)
    if (q.rows[0].n === 0 && st.rows[0].age < 90) { console.log("DRAINED by liveness-started instance"); break }
    await new Promise(r => setTimeout(r, 25_000))
  }
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
