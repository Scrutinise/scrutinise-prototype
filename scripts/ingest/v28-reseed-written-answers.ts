/**
 * v28-reseed-written-answers.ts — V28 §1.1. Re-ingest written-answers as one
 * section per question-and-answer (was date-range blobs: 128/143 sections
 * >512KB, avg ~306k words — the wrong retrieval unit).
 *
 * The original `answers:{from}:{to}` queue rows were long since cleaned (hourly
 * cleanup deletes done rows after 7 days), so the windows are recovered from the
 * existing section ids (written-answers:{from}:{to}:1).
 *
 *   (default)  audit: list the recovered windows + run a one-window PILOT
 *              (fetch per-item Q&A, show count + max words) — predict the result.
 *   --seed     POST-PUSH: delete the legacy blob sections, re-seed the window
 *              rows (sourceType 'hansard', docId 'answers:{from}:{to}'); the
 *              redeployed worker re-processes them per-item.
 *
 * Acceptance (brief §1.1): max written-answers section size well under 512 KB;
 * section count rises toward one-per-answer. pwdata-wrans is NOT touched.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { fetchWrittenAnswerItems, compileWrittenQa } from './sources/parliament-api'

const CORPUS = 'written-answers'

async function recoverWindows(): Promise<Array<{ from: string; to: string }>> {
  const pool = getNeonPool()
  // legacy blob ids: written-answers:{from}:{to}:1  (from/to are ISO dates)
  const r = await pool.query<{ id: string }>(
    `SELECT id FROM corpus_sections WHERE corpus = $1 AND "parentDocId" IS NULL`, [CORPUS])
  const wins = new Map<string, { from: string; to: string }>()
  for (const row of r.rows) {
    const p = row.id.split(':')
    if (p.length >= 4 && /^\d{4}-\d{2}-\d{2}$/.test(p[1]) && /^\d{4}-\d{2}-\d{2}$/.test(p[2])) {
      wins.set(`${p[1]}:${p[2]}`, { from: p[1], to: p[2] })
    }
  }
  return [...wins.values()].sort((a, b) => a.from.localeCompare(b.from))
}

async function main() {
  const seed = process.argv.includes('--seed')
  const pool = getNeonPool()
  const windows = await recoverWindows()
  console.log(`recovered ${windows.length} written-answers date windows; span ${windows[0]?.from} … ${windows[windows.length - 1]?.to}`)

  // PILOT — one window end-to-end (predict-measure)
  const pilotWin = windows[Math.floor(windows.length / 2)] ?? windows[0]
  if (pilotWin) {
    const items = await fetchWrittenAnswerItems(pilotWin.from, pilotWin.to)
    const maxWords = items.reduce((m, it) => Math.max(m, compileWrittenQa(it).split(/\s+/).length), 0)
    console.log(`PILOT window ${pilotWin.from}…${pilotWin.to}: ${items.length} Q&A items, max ${maxWords} words/item`)
    console.log(`  → projection: ~${items.length} sections per window × ${windows.length} windows`)
    if (items[0]) console.log('  sample:', compileWrittenQa(items[0]).slice(0, 160).replace(/\n/g, ' | '))
  }

  if (!seed) { console.log('\n(dry-run; pass --seed POST-PUSH to delete blobs + re-seed windows)'); await endNeonPool(); return }

  // delete legacy blobs (parentDocId IS NULL = the old aggregate rows)
  const del = await pool.query(`DELETE FROM corpus_sections WHERE corpus = $1 AND "parentDocId" IS NULL`, [CORPUS])
  console.log(`deleted ${del.rowCount} legacy blob sections`)
  const rows = windows.map(w => ({
    id: `${CORPUS}:answers:${w.from}:${w.to}`, corpus: CORPUS,
    docId: `answers:${w.from}:${w.to}`, sourceType: 'hansard', priority: 3,
  }))
  const { affected } = await bulkInsertQueueRows(rows, { resetExisting: true })
  console.log(`re-seeded ${affected} window rows (sourceType hansard) — worker re-processes per-item POST-PUSH`)
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
