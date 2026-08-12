/**
 * v36-pdfonly-probe.ts — V36: `specialist_queue` holds 117,667 `pdf-only`
 * instruments, all `pending`, and it has exactly one writer
 * (process-row.ts:214) and NO CONSUMER. Nothing has ever drained it.
 *
 * Before that is reported as recoverable text, it has to be shown that the PDFs
 * carry extractable text rather than page scans. Random sample, real code path
 * (fetchBinary + pdfToText, the same pair the ingest uses).
 */
process.env.TNA_THROTTLE_FLOOR_MS = process.env.TNA_THROTTLE_FLOOR_MS ?? '1000'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { Pool } from 'pg'
import { pdfToText } from './shared/compile'

const N = Number(process.argv.includes('--n') ? process.argv[process.argv.indexOf('--n') + 1] : 12)

async function main() {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1, statement_timeout: 300_000, query_timeout: 300_000 })
  await pool.query(`SELECT setseed(0.37)`)
  const { rows } = await pool.query(
    `SELECT "docId", corpus, "legislationYear", title FROM specialist_queue
     WHERE specialist_type='pdf-only' AND status='pending' ORDER BY random() LIMIT $1`, [N])
  await pool.end()

  let withText = 0, noPdf = 0, scanned = 0, chars = 0
  for (const r of rows) {
    const url = `https://www.legislation.gov.uk/${r.docId}/data.pdf`
    let verdict = '', n = 0
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Scrutinise-Ingest/1.0 (legal corpus research)' } })
      if (!res.ok) { verdict = `HTTP ${res.status}`; noPdf++ }
      else {
        const buf = Buffer.from(await res.arrayBuffer())
        const text = await pdfToText(buf, url)
        n = text ? text.trim().length : 0
        if (n > 200) { withText++; chars += n; verdict = `TEXT ${n.toLocaleString()} chars (pdf ${(buf.length / 1024).toFixed(0)}KB)` }
        else { scanned++; verdict = `no extractable text (pdf ${(buf.length / 1024).toFixed(0)}KB)` }
      }
    } catch (e) { verdict = `THREW ${String(e).slice(0, 60)}`; noPdf++ }
    console.log(`${String(r.docId).padEnd(24)} ${String(r.legislationYear ?? '').padStart(4)}  ${verdict}`)
    await new Promise(s => setTimeout(s, 800))
  }
  console.log(`\n[pdf-only] ${withText}/${rows.length} carry extractable text · ${scanned} scan-only · ${noPdf} no PDF`)
  if (withText) console.log(`[pdf-only] mean ${Math.round(chars / withText).toLocaleString()} chars per recoverable instrument`)
}
main().catch(e => { console.error(e); process.exitCode = 1 })
