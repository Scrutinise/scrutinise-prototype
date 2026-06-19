/**
 * v28-verify-reseed.ts — V28 §2 verification. Dry-run of the fixed
 * reseedExhaustedPwdata dedup against the LIVE table: per pwdata corpus, list
 * upstream files, run the new index-friendly PK existence check (timed), report
 * how many files are not yet ingested. Inserts NOTHING.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { listPwdataFiles, PWDATA_CORPUS_CONFIG } from './sources/twfy-pwdata'

async function main() {
  const pool = getNeonPool()
  const busyRes = await pool.query<{ corpus: string }>(`
    SELECT DISTINCT corpus FROM ingest_queue
    WHERE corpus LIKE 'pwdata-%' AND status IN ('pending','claimed')`)
  const busy = new Set(busyRes.rows.map(r => r.corpus))

  for (const corpus of Object.keys(PWDATA_CORPUS_CONFIG)) {
    if (busy.has(corpus)) { console.log(`${corpus}: busy (has pending/claimed) — skipped`); continue }
    const files = await listPwdataFiles(corpus)
    if (files.length === 0) { console.log(`${corpus}: 0 upstream files`); continue }

    const firstIds = files.map(f => `${corpus}:${f.docId}:1`)
    const ingested = new Set<string>()
    const t = Date.now()
    const CHUNK = 10_000
    for (let i = 0; i < firstIds.length; i += CHUNK) {
      const slice = firstIds.slice(i, i + CHUNK)
      const r = await pool.query<{ docid: string }>(
        `SELECT split_part(id, ':', 2) AS docid FROM corpus_sections WHERE id = ANY($1::text[])`,
        [slice])
      for (const row of r.rows) ingested.add(row.docid)
    }
    const elapsed = ((Date.now() - t) / 1000).toFixed(2)
    const newFiles = files.filter(f => !ingested.has(f.docId))
    console.log(`${corpus}: ${files.length} files, ${ingested.size} already ingested, ${newFiles.length} NEW — dedup ${elapsed}s`)
    if (newFiles.length > 0 && newFiles.length <= 12) {
      console.log('   new:', newFiles.map(f => f.docId).join(', '))
    }
  }
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
