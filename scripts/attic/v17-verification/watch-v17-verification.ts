import path from "path"
try { require("dotenv").config({ path: path.join(__dirname, "../../scrutinise-web/.env") }) } catch {}
import { getNeonPool, endNeonPool } from "./shared/neon-pool"

const started = Date.now()
let lastLine = ""
let sawBeat = false

async function poll(): Promise<boolean> {
  const pool = getNeonPool()
  const [stateRes, queueRes, secRes, breakerRes] = await Promise.all([
    pool.query(`SELECT last_beat, last_start_trigger, starts_count FROM ingest_service_state WHERE id = 1`),
    pool.query(`SELECT status, COUNT(*)::int n FROM ingest_queue WHERE status IN ('pending','claimed','failed','blocked') GROUP BY status`),
    pool.query(`SELECT COUNT(*)::int n FROM corpus_sections`),
    pool.query(`SELECT source_key, state, trip_reason FROM source_status WHERE state = 'tripped' AND source_key = 'echr'`),
  ])
  const st = stateRes.rows[0] ?? {}
  const beatAge = st.last_beat ? Math.round((Date.now() - new Date(st.last_beat).getTime()) / 1000) : -1
  const trigAge = st.last_start_trigger ? Math.round((Date.now() - new Date(st.last_start_trigger).getTime()) / 1000) : -1
  const q: Record<string, number> = {}
  for (const r of queueRes.rows) q[r.status] = r.n
  const beatFresh = beatAge >= 0 && beatAge < 90
  if (beatFresh) sawBeat = true
  const echrTripped = breakerRes.rows.length > 0
  const line = `beat=${beatAge}s trig=${trigAge}s starts=${st.starts_count ?? 0} pending=${q.pending ?? 0} claimed=${q.claimed ?? 0} failed=${q.failed ?? 0} blocked=${q.blocked ?? 0} sections=${secRes.rows[0].n} echrTripped=${echrTripped}`
  if (line !== lastLine) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${line}`); lastLine = line }
  // Terminal: work drained, ingest heartbeat gone stale again after having been seen
  const drained = (q.pending ?? 0) === 0 && (q.claimed ?? 0) === 0
  if (drained && sawBeat && !beatFresh) { console.log("TERMINAL: queue drained, ingest exited (heartbeat stale)"); return true }
  if (Date.now() - started > 25 * 60_000) { console.log("TIMEOUT after 25 min"); return true }
  return false
}

async function main() {
  while (true) {
    try { if (await poll()) break } catch (e) { console.error("poll error:", String(e).slice(0, 100)) }
    await new Promise(r => setTimeout(r, 20_000))
  }
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
