/**
 * v27-seed-ico.ts — V27 §4. Information Commissioner's Office decisions &
 * enforcement (the cleanest exempt-org build: OGL v3.0, flat-sitemap route).
 *
 *   --pilot     enumerate leaves; run 5 end-to-end (page → PDF → pdfToText);
 *               predict the corpus size. Seeds nothing.
 *   --measure   full enumeration + category breakdown. Seeds nothing.
 *   --seed      POST-PUSH only. Bulk-insert one row per leaf, upsert the 'ico'
 *               corpus_target. Idempotent (ON CONFLICT DO NOTHING; worker skips
 *               R2-present content).
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { pdfToText } from './shared/compile'
import { countWords } from './shared/db-metadata'
import { enumerateIcoLeaves, fetchIcoPage, fetchIcoPdf } from './sources/ico'

const CORPUS = 'ico'
const SOURCE = 'ico'

async function pilot() {
  console.log('=== PILOT — enumerate + 5 leaves end-to-end ===')
  const leaves = await enumerateIcoLeaves()
  const byCat = new Map<string, number>()
  for (const l of leaves) byCat.set(l.category, (byCat.get(l.category) ?? 0) + 1)
  console.log(`enumerated ${leaves.length} action-weve-taken leaves:`)
  for (const [c, n] of [...byCat.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(6)}  ${c}`)

  // sample across categories: first leaf of each of the top categories + fillers
  const sample = leaves.slice(0, 5)
  let words = 0, ok = 0
  for (const l of sample) {
    const page = await fetchIcoPage(l.path)
    if (!page) { console.log(`  ✗ ${l.path} — page fetch failed`); continue }
    let w = 0, via = 'none'
    if (page.pdfUrls.length > 0) {
      const buf = await fetchIcoPdf(page.pdfUrls[0])
      if (buf) { const t = await pdfToText(buf, page.pdfUrls[0]); if (t) { w = countWords(t); via = 'pdf' } }
    }
    if (w === 0 && page.mainText.length >= 200) { w = countWords(page.mainText); via = 'html' }
    if (w > 0) { ok++; words += w }
    console.log(`  ✓ [${via}] ${w} words | ${page.itemDate ?? '?'} | ${page.title.slice(0, 50)}`)
    await new Promise(r => setTimeout(r, 600))
  }
  const avg = ok > 0 ? Math.round(words / ok) : 0
  console.log(`\nextract success: ${ok}/${sample.length}; avg ${avg} words/leaf`)
  console.log(`PREDICTION: ~${leaves.length} sections / ~${(leaves.length * avg / 1e6).toFixed(1)}M words`)
}

async function measure() {
  const leaves = await enumerateIcoLeaves()
  console.log(`measured ICO universe: ${leaves.length} leaves`)
  return leaves
}

async function seed() {
  const leaves = await measure()
  console.log('\n=== SEED — inserting rows ===')
  const rows = leaves.map(l => ({ id: `${CORPUS}:${l.path}`, corpus: CORPUS, docId: l.path, sourceType: SOURCE, priority: 4 }))
  const { affected } = await bulkInsertQueueRows(rows)
  console.log(`bulkInsertQueueRows: ${affected} new rows (of ${rows.length})`)

  const pool = getNeonPool()
  await pool.query(`
    INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, priority, blocked, retired, notes, updated_at)
    VALUES ($1, 'ICO decisions & enforcement', $2, true, 4, false, false, 'V27 §4 exempt-org build — ico.org.uk action-weve-taken, OGL v3.0', NOW())
    ON CONFLICT (corpus_key) DO UPDATE SET
      est_sections = $2, est_is_confirmed = true, blocked = false, blocked_reason = NULL, updated_at = NOW()
  `, [CORPUS, leaves.length])
  console.log(`corpus_target '${CORPUS}' upserted (est=${leaves.length})`)
}

async function main() {
  const mode = process.argv.find(a => ['--pilot', '--measure', '--seed'].includes(a)) ?? '--pilot'
  if (mode === '--pilot') await pilot()
  else if (mode === '--measure') await measure()
  else await seed()
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
