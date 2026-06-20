/**
 * v29-seed-cps.ts — V29 §4: CPS prosecution guidance (cps.gov.uk, OGL v3.0
 * VERIFIED at /crown-copyright-and-disclaimer). New sourceType + corpus
 * 'cps-guidance'.
 *
 *   --pilot     enumerate; run 3 guidance docs end-to-end (page → <main> text);
 *               predict size. Seeds nothing.
 *   --measure   full enumeration count. Seeds nothing.
 *   --seed      ⚠️ POST-PUSH only. One row per guidance leaf, upsert the target.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { countWords } from './shared/db-metadata'
import { enumerateCpsGuidance, fetchCpsPage } from './sources/cps-guidance'

const CORPUS = 'cps-guidance'

async function main() {
  const mode = process.argv.includes('--seed') ? 'seed' : process.argv.includes('--measure') ? 'measure' : 'pilot'
  const leaves = await enumerateCpsGuidance()
  console.log(`enumerated ${leaves.length} CPS legal-guidance documents`)

  if (mode === 'pilot') {
    let words = 0, ok = 0
    for (const l of leaves.slice(0, 3)) {
      const page = await fetchCpsPage(l.path)
      if (!page) { console.log(`  ✗ ${l.path} — fetch failed`); continue }
      const w = countWords(page.mainText)
      if (w > 0) { ok++; words += w }
      console.log(`  ✓ ${w} words | ${page.itemDate ?? '?'} | ${page.title.slice(0, 55)}`)
      await new Promise(r => setTimeout(r, 600))
    }
    const avg = ok ? Math.round(words / ok) : 0
    console.log(`\nextract ${ok}/3; avg ${avg} words`)
    console.log(`PREDICTION: ~${leaves.length} sections / ~${(leaves.length * avg / 1e6).toFixed(2)}M words`)
  }
  if (mode !== 'seed') { await endNeonPool(); return }

  const rows = leaves.map(l => ({ id: `${CORPUS}:${l.path}`, corpus: CORPUS, docId: l.path, sourceType: CORPUS, priority: 3 }))
  const { affected } = await bulkInsertQueueRows(rows)
  const pool = getNeonPool()
  await pool.query(`
    INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, priority, blocked, retired, notes, updated_at)
    VALUES ($1, 'CPS prosecution guidance', $2, true, 3, false, false, 'V29 §4 — cps.gov.uk prosecution-guidance + Code for Crown Prosecutors, OGL v3.0', NOW())
    ON CONFLICT (corpus_key) DO UPDATE SET est_sections = $2, est_is_confirmed = true, blocked = false, blocked_reason = NULL, updated_at = NOW()
  `, [CORPUS, leaves.length])
  console.log(`[cps-guidance] seeded ${affected}/${rows.length} rows; target est=${leaves.length}`)
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
