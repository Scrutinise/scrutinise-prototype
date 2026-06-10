import path from "path"
try { require("dotenv").config({ path: path.join(__dirname, "../../scrutinise-web/.env") }) } catch {}
import { getNeonPool, endNeonPool } from "./shared/neon-pool"
async function main() {
  const pool = getNeonPool()
  for (let i = 0; i < 45; i++) {
    const st = await pool.query(`SELECT EXTRACT(EPOCH FROM (NOW() - last_beat))::int AS age, last_start_trigger, starts_count, starts_on FROM ingest_service_state WHERE id = 1`)
    const s = st.rows[0]
    if (s.last_start_trigger) {
      console.log(`LIVENESS TRIGGER FIRED: at ${s.last_start_trigger}, starts today: ${s.starts_count}`)
      break
    }
    if (i % 6 === 0) console.log(`waiting… beatAge=${s.age}s starts=${s.starts_count}`)
    await new Promise(r => setTimeout(r, 20_000))
  }
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
