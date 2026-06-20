/**
 * v29-triage-probe.ts — §1 live triage. Re-fetch a sample of the failed ico +
 * scottish-courts rows directly and report the REAL HTTP outcome (status / error
 * class), so "page fetch failed" can be split into genuine 404 dead pages
 * (reclassify) vs a systematic fetch failure (fix the adapter).
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { keyToPdfUrl } from './sources/scottish-courts'

const UA = 'Mozilla/5.0 (compatible; Scrutinise-Ingest/1.0; +https://scrutinise.org)'

async function probe(url: string, accept: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': accept, 'Accept-Encoding': 'gzip, deflate', 'Referer': 'https://ico.org.uk/' } })
    let extra = ''
    if (res.ok && accept.includes('pdf')) {
      const buf = Buffer.from(await res.arrayBuffer())
      extra = ` len=${buf.length} magic=${buf.toString('latin1', 0, 4)}`
    } else if (res.ok) {
      const txt = await res.text()
      extra = ` len=${txt.length}`
    }
    return `HTTP ${res.status} ${res.headers.get('content-type') ?? ''}${extra}`
  } catch (e: any) {
    return `THROW ${e?.cause?.code ?? e?.code ?? e?.message ?? e}`
  }
}

async function main() {
  const pool = getNeonPool()

  console.log('=== ICO failed sample — live re-fetch ===')
  const ico = await pool.query<{ docId: string }>(
    `SELECT "docId" FROM ingest_queue WHERE "sourceType"='ico' AND status='failed' ORDER BY random() LIMIT 14`)
  for (const r of ico.rows) {
    const url = `https://ico.org.uk/${r.docId}/`
    const out = await probe(url, 'text/html')
    console.log(`  ${out.padEnd(40)} ${r.docId}`)
    await new Promise(r => setTimeout(r, 400))
  }

  console.log('\n=== scottish-courts failed (all 9) — live re-fetch PDF ===')
  const sc = await pool.query<{ docId: string }>(
    `SELECT "docId" FROM ingest_queue WHERE "sourceType"='scottish-courts' AND status='failed'`)
  for (const r of sc.rows) {
    const key = r.docId.split('|')[0]
    const url = keyToPdfUrl(key)
    const out = await probe(url, 'application/pdf')
    console.log(`  ${out.padEnd(46)} ${key}`)
    await new Promise(r => setTimeout(r, 500))
  }

  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
