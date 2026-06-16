/**
 * v25-seed-college-policing.ts — V25 §3. College of Policing APP from the UK Gov
 * Web Archive 2022 snapshots. One queue row per APP page (docId =
 * "{timestamp}|{url}", sourceType college-policing-archive); the worker fetches
 * the raw capture and emits one section. Snapshot date carried as itemDate.
 *
 *   (default)   dry-run / enumerate — list page count + snapshot span.
 *   --pilot N   fetch+extract N pages LOCALLY, measure words. No seed.
 *   --seed      insert one row per page; clear the corpus_target breaker/block.
 *               POST-PUSH only.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { listArchivedAppPages, fetchArchivedAppPage, snapshotIsoDate } from './sources/college-policing-archive'
import { countWords } from './shared/db-metadata'

const CORPUS = 'college-of-policing'
const SRC = 'college-policing-archive'

async function main() {
  const seed = process.argv.includes('--seed')
  const pi = process.argv.indexOf('--pilot')
  const pilotN = pi >= 0 ? Number(process.argv[pi + 1]) : 0

  const pages = await listArchivedAppPages()
  if (!pages) { console.log('CDX enumeration failed'); await endNeonPool(); return }
  const span = pages.map(p => p.timestamp).sort()
  console.log(`enumerated ${pages.length} distinct APP pages; snapshot span ${snapshotIsoDate(span[0])} .. ${snapshotIsoDate(span[span.length - 1])}`)

  if (pilotN > 0) {
    let totWords = 0, ok = 0
    for (const p of pages.slice(0, pilotN)) {
      const res = await fetchArchivedAppPage(p.timestamp, p.url)
      if (!res || res.text.length < 100) { console.log(`  ${p.url}: no content`); continue }
      const w = countWords(res.text)
      ok++; totWords += w
      console.log(`  [${snapshotIsoDate(p.timestamp)}] ${res.title.slice(0, 40).padEnd(40)} ${w.toLocaleString()} words — ${p.url.replace('https://www.app.college.police.uk', '')}`)
    }
    const wPer = ok ? totWords / ok : 0
    console.log(`\nPILOT: ${ok}/${pilotN} pages had content, avg ${wPer.toFixed(0)} words/page`)
    console.log(`PREDICTION ≈ ${pages.length.toLocaleString()} sections, ≈ ${(wPer * pages.length / 1e6).toFixed(2)}M words`)
    await endNeonPool(); return
  }

  if (!seed) { console.log('(dry-run — pass --pilot N to measure, --seed POST-PUSH to insert)'); await endNeonPool(); return }

  const rows = pages.map(p => ({
    id: `${CORPUS}:${p.url.replace(/^https?:\/\/www\.app\.college\.police\.uk\//, '').replace(/\/$/, '')}`,
    corpus: CORPUS, docId: `${p.timestamp}|${p.url}`, sourceType: SRC, priority: 3,
  }))
  const { affected } = await bulkInsertQueueRows(rows)
  const pool = getNeonPool()
  await pool.query(`
    INSERT INTO corpus_targets (corpus_key, est_sections, est_is_confirmed, blocked, retired, display_label, notes)
    VALUES ($1, $2, false, false, false, $3, $4)
    ON CONFLICT (corpus_key) DO UPDATE SET est_sections=EXCLUDED.est_sections, blocked=false, notes=EXCLUDED.notes`,
    [CORPUS, pages.length, 'College of Policing APP (2022 web-archive)',
     `V25 §3: ${pages.length} APP pages from UK Gov Web Archive 2022 snapshots, one section per page. Licence college-nc (Non-Commercial College Licence) — COMMERCIAL-SURFACE EXCLUDED. Snapshot ~4yr stale (date in itemDate). Rebaseline at drain.`])
  console.log(`seeded ${affected} new college-of-policing rows (of ${pages.length}); corpus unblocked`)
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
