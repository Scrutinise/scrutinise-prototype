import path from "path"
try { require("dotenv").config({ path: path.join(__dirname, "../../scrutinise-web/.env") }) } catch {}
import { getNeonPool, endNeonPool } from "./shared/neon-pool"

type Phase = "drain" | "stale" | "seeded" | "started"
let ph: Phase = "drain"
const t0 = Date.now()

async function main() {
  const pool = getNeonPool()
  let lastLine = ""
  while (Date.now() - t0 < 40 * 60_000) {
    const [st, q] = await Promise.all([
      pool.query(`SELECT last_beat, EXTRACT(EPOCH FROM (NOW() - last_beat))::int AS age, last_start_trigger, starts_count FROM ingest_service_state WHERE id = 1`),
      pool.query(`SELECT COUNT(*)::int n FROM ingest_queue WHERE status = 'pending'`),
    ])
    const s = st.rows[0] ?? {}
    const pending = q.rows[0].n
    const line = `phase=${ph} beatAge=${s.age}s pending=${pending} starts=${s.starts_count ?? 0} trig=${s.last_start_trigger ?? "never"}`
    if (line !== lastLine) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${line}`); lastLine = line }

    if (ph === "drain" && pending === 0) { ph = "stale"; console.log("MILESTONE: queue drained — waiting for heartbeat to go stale (>610s)") }
    if (ph === "stale" && s.age > 610) {
      const r = await pool.query(`
        UPDATE ingest_queue SET status='pending', "claimedBy"=NULL, "claimedAt"=NULL, "completedAt"=NULL, "lastError"='V17 liveness test'
        WHERE id IN (SELECT id FROM ingest_queue WHERE corpus='si-2010plus' AND status='done' ORDER BY "docId" DESC LIMIT 5)
        RETURNING "docId"`)
      console.log(`MILESTONE: heartbeat stale — seeded ${r.rowCount} rows; ops should trigger start within 15 min`)
      ph = "seeded"
    }
    if (ph === "seeded" && s.last_start_trigger && new Date(s.last_start_trigger).getTime() > t0) {
      console.log(`MILESTONE: OPS TRIGGERED INGEST START (starts_count=${s.starts_count})`)
      ph = "started"
    }
    if (ph === "started" && pending === 0 && s.age < 120) {
      console.log("TERMINAL: liveness-started ingest drained the queue — full autonomous loop verified")
      break
    }
    await new Promise(r => setTimeout(r, 20_000))
  }
  if (ph !== "started") console.log(`ENDED in phase=${ph} (timeout or partial)`)
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
