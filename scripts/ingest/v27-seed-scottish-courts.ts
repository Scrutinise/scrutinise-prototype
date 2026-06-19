/**
 * v27-seed-scottish-courts.ts — V27 §2. Scottish Courts & Tribunals judgments.
 *
 *   --pilot          enumerate page 1, run 5 judgments end-to-end (fetch PDF →
 *                    pdfToText → word count) on the REAL worker path; predict the
 *                    full-corpus size. Seeds nothing.
 *   --measure        full enumeration; report the measured universe. Seeds nothing.
 *   --seed           full enumeration; bulk-insert one content row per judgment,
 *                    clear the blocked corpus_target, set the measured estimate.
 *
 * Idempotent: queue ids are ON CONFLICT DO NOTHING and the worker skips PDFs
 * already in R2. New sourceType 'scottish-courts' — seed POST-PUSH only (the
 * processor must be deployed first, or the old worker markSkipped's the rows).
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { pdfToText } from './shared/compile'
import { countWords } from './shared/db-metadata'
import {
  enumerateAllJudgments, searchJudgmentsPage, fetchJudgmentPdf, linkToKey,
  type JudgmentEntry,
} from './sources/scottish-courts'

const CORPUS = 'scottish-courts'
const SOURCE = 'scottish-courts'

function packDocId(e: JudgmentEntry): { id: string; docId: string } {
  const key = linkToKey(e.documentLink)
  return { id: `${CORPUS}:${key}`, docId: `${key}|${e.date ?? ''}|${e.court ?? ''}` }
}

async function pilot() {
  console.log('=== PILOT — page 1 + 5 judgments end-to-end ===')
  const pg = await searchJudgmentsPage(1, 50)
  if (!pg) throw new Error('page 1 enumeration failed')
  console.log(`universe (pagination.count.total): ${pg.total} judgments`)
  console.log(`page 1 returned ${pg.entries.length} entries\n`)

  const sample = pg.entries.slice(0, 5)
  let words = 0, ok = 0
  for (const e of sample) {
    const key = linkToKey(e.documentLink)
    const buf = await fetchJudgmentPdf(key)
    if (!buf) { console.log(`  ✗ ${key} — PDF fetch failed`); continue }
    const text = await pdfToText(buf, key)
    const w = text ? countWords(text) : 0
    if (text && text.length >= 100) { ok++; words += w }
    console.log(`  ✓ ${e.court ?? '?'} | ${e.date ?? '?'} | ${w} words | ${e.title.slice(0, 50)}`)
    await new Promise(r => setTimeout(r, 800))
  }
  const avg = ok > 0 ? Math.round(words / ok) : 0
  console.log(`\nextract success: ${ok}/${sample.length}; avg ${avg} words/judgment`)
  console.log(`PREDICTION: ~${pg.total} sections / ~${(pg.total * avg / 1e6).toFixed(1)}M words`)
}

async function measure() {
  console.log('=== MEASURE — full enumeration (seeds nothing) ===')
  const all = await enumerateAllJudgments(200, 1000, (c, t) => {
    if (c % 1000 < 200) process.stdout.write(`  collected ${c}/${t}\r`)
  })
  console.log(`\nmeasured universe: ${all.length} distinct judgments`)
  const byCourt = new Map<string, number>()
  for (const e of all) byCourt.set(e.court ?? '(none)', (byCourt.get(e.court ?? '(none)') ?? 0) + 1)
  console.log('by court:')
  for (const [c, n] of [...byCourt.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${n}\t${c}`)
  return all
}

async function seed() {
  const all = await measure()
  console.log('\n=== SEED — inserting content rows ===')
  const rows = all.map(e => { const { id, docId } = packDocId(e); return { id, corpus: CORPUS, docId, sourceType: SOURCE, priority: 4 } })
  const { affected } = await bulkInsertQueueRows(rows)
  console.log(`bulkInsertQueueRows: ${affected} new rows (of ${rows.length})`)

  const pool = getNeonPool()
  await pool.query(`
    UPDATE corpus_targets
    SET blocked = false, blocked_reason = NULL,
        est_sections = $2, est_is_confirmed = true,
        notes = 'V27 §2: API unblocked via Origin/Referer-gated search; ' || COALESCE(notes,''),
        updated_at = NOW()
    WHERE corpus_key = $1
  `, [CORPUS, all.length])
  console.log(`corpus_target '${CORPUS}' cleared (blocked=false, est=${all.length}, confirmed)`)
}

async function main() {
  const mode = process.argv.find(a => ['--pilot', '--measure', '--seed'].includes(a)) ?? '--pilot'
  if (mode === '--pilot') await pilot()
  else if (mode === '--measure') await measure()
  else await seed()
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
