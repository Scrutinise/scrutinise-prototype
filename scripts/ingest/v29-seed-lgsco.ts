/**
 * v29-seed-lgsco.ts — V29 §7: Local Government & Social Care Ombudsman decisions
 * (the clean-licence ombudsman build). New sourceType + corpus 'lgsco',
 * licence 'lgsco-open' (OGL-equivalent, VERIFIED lgo.org.uk/copyright).
 *
 *   --pilot   fetch one listing page + one decision end-to-end. Seeds nothing.
 *   --measure same as pilot plus a per-category first-page size sniff.
 *   --seed    ⚠️ POST-PUSH only. Insert one self-propagating list:{cat}:1 row per
 *             category; the worker walks the rest. est is left unconfirmed
 *             (re-baseline at drain).
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { countWords } from './shared/db-metadata'
import { LGSCO_CATEGORIES, fetchLgscoListPage, fetchLgscoDecision } from './sources/lgsco'

const CORPUS = 'lgsco'

async function main() {
  const mode = process.argv.includes('--seed') ? 'seed' : process.argv.includes('--measure') ? 'measure' : 'pilot'

  if (mode !== 'seed') {
    const first = await fetchLgscoListPage('adult-care-services', 1)
    console.log(`adult-care-services p1: ${first?.paths.length} decisions, full=${first?.full}`)
    if (first?.paths.length) {
      const dec = await fetchLgscoDecision(first.paths[0])
      console.log(`  sample decision ${first.paths[0]}\n    "${dec?.title}" — ${dec ? countWords(dec.mainText) : 0} words, date ${dec?.itemDate}`)
      if (dec) console.log('    ' + dec.mainText.slice(0, 200).replace(/\s+/g, ' '))
    }
    if (mode === 'measure') {
      console.log('\nper-category first-page presence:')
      for (const c of LGSCO_CATEGORIES) {
        const p = await fetchLgscoListPage(c, 1)
        console.log(`  ${c.padEnd(28)} ${p?.paths.length ?? 'FAIL'} on p1, full=${p?.full}`)
        await new Promise(r => setTimeout(r, 400))
      }
    }
    await endNeonPool(); return
  }

  const rows = LGSCO_CATEGORIES.map(c => ({ id: `${CORPUS}:list:${c}:1`, corpus: CORPUS, docId: `list:${c}:1`, sourceType: CORPUS, priority: 4 }))
  const { affected } = await bulkInsertQueueRows(rows)
  const pool = getNeonPool()
  await pool.query(`
    INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, priority, blocked, retired, notes, updated_at)
    VALUES ($1, 'LGSCO decisions', NULL, false, 4, false, false, 'V29 §7 — lgo.org.uk decisions DB, lgsco-open (OGL-equivalent, verified /copyright); self-propagating list rows, re-baseline at drain', NOW())
    ON CONFLICT (corpus_key) DO UPDATE SET est_is_confirmed = false, blocked = false, blocked_reason = NULL, updated_at = NOW()
  `, [CORPUS])
  console.log(`[lgsco] seeded ${affected}/${rows.length} category list-seed rows; worker self-propagates pagination`)
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
