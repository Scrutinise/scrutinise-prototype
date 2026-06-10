/**
 * diag-v18-pwdata.ts — V18 §2 pre-seed survey (read-only).
 * For each of the 7 pwdata corpora: live TWFY directory file count + date range,
 * vs corpus_sections ingested count → the real backlog per corpus.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { listPwdataFiles, PWDATA_CORPUS_CONFIG } from './sources/twfy-pwdata'

async function main() {
  const pool = getNeonPool()

  const sec = await pool.query<{ corpus: string; n: string }>(
    `SELECT corpus, COUNT(*)::text AS n FROM corpus_sections WHERE corpus LIKE 'pwdata-%' GROUP BY corpus`
  )
  const ingested = new Map(sec.rows.map(r => [r.corpus, parseInt(r.n, 10)]))

  const queue = await pool.query<{ corpus: string; status: string; n: string }>(
    `SELECT corpus, status, COUNT(*)::text AS n FROM ingest_queue WHERE corpus LIKE 'pwdata-%' GROUP BY corpus, status`
  )

  console.log('corpus                 dirFiles   ingested   missing   firstFile           lastFile')
  let totalMissing = 0
  for (const corpus of Object.keys(PWDATA_CORPUS_CONFIG)) {
    try {
      const files = await listPwdataFiles(corpus)
      const ing = ingested.get(corpus) ?? 0
      // count files whose docId is NOT in corpus_sections (proper dedup needs the id set;
      // here we just diff counts for the survey — the seeder does exact dedup)
      const idsRes = await pool.query<{ id: string }>(
        `SELECT id FROM corpus_sections WHERE corpus = $1`, [corpus]
      )
      const have = new Set(idsRes.rows.map(r => r.id.split(':')[1]))
      const missing = files.filter(f => !have.has(f.docId))
      totalMissing += missing.length
      const sorted = files.map(f => f.docId).sort()
      console.log(
        `${corpus.padEnd(22)} ${String(files.length).padStart(8)} ${String(ing).padStart(10)} ${String(missing.length).padStart(9)}   ${sorted[0] ?? '-'}   ${sorted[sorted.length - 1] ?? '-'}`
      )
      if (missing.length > 0 && missing.length <= 10) {
        console.log(`    missing: ${missing.map(f => f.docId).join(', ')}`)
      }
    } catch (err: any) {
      console.log(`${corpus.padEnd(22)} ERROR: ${err.message}`)
    }
  }
  console.log(`\nTOTAL missing day-files across pwdata: ${totalMissing.toLocaleString()}`)

  console.log('\nqueue rows (pwdata):')
  if (queue.rows.length === 0) console.log('  (none)')
  for (const r of queue.rows) console.log(`  ${r.corpus.padEnd(22)} ${r.status.padEnd(8)} ${r.n}`)

  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
