import path from "path"
try { require("dotenv").config({ path: path.join(__dirname, "../../scrutinise-web/.env") }) } catch {}
import { getNeonPool, endNeonPool } from "./shared/neon-pool"
import { listPwdataFiles } from "./sources/twfy-pwdata"
async function main() {
  const pool = getNeonPool()
  const q = await pool.query(`SELECT corpus, status, COUNT(*)::int n FROM ingest_queue WHERE corpus LIKE 'pwdata-%' GROUP BY corpus, status ORDER BY corpus`)
  console.log("queue pwdata rows:", q.rows.length === 0 ? "(none)" : "")
  for (const r of q.rows) console.log(" ", r.corpus, r.status, r.n)
  const s = await pool.query(`SELECT corpus, MAX(id) AS max_id, COUNT(*)::int n FROM corpus_sections WHERE corpus LIKE 'pwdata-%' GROUP BY corpus ORDER BY corpus`)
  for (const r of s.rows) console.log(" sections:", r.corpus, r.n, "latest:", r.max_id)
  const files = await listPwdataFiles("pwdata-debates")
  console.log("twfy debates dir:", files.length, "files; last 3:", files.slice(-3).map(f => f.docId).join(", "))
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
