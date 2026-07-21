/**
 * v31-seed-fcdo-treaties.ts — TREATY_INGEST_BRIEF.md STEP 1: extend to the
 * full UK Treaties Online (FCDO) universe.
 *
 * Enumerates the full treaties.fcdo.gov.uk anonymous-API universe (measured
 * live 8 Jul 2026: 21,970 records — NOT the ~15,000 the brief/gov.uk estimate;
 * honest-denominator correction, reported not silently substituted), does a
 * best-effort dedup against what `uk-treaties` + `tax-treaties-dta` already
 * hold (1,691 docs from gov.uk's filter_format=international_treaty — a
 * DIFFERENT id namespace with no shared key, so dedup is normalized-title
 * exact-match only: conservative on purpose — a false-positive skip would
 * silently drop a unique FCDO treaty, a false-negative just ingests a
 * duplicate, which is cheap and safe), then seeds `uk-treaties-fcdo` as its
 * own corpus (kept separate from the existing gov.uk-sourced corpora rather
 * than merged/replaced — see STEP 0 report in the session transcript / brief
 * response for the reasoning).
 *
 * corpus_targets.est_sections is seeded as the document count (provisional,
 * est_is_confirmed=false) per the existing uk-treaties/tax-treaties-dta
 * convention — final compiled section count (>1 doc for multi-PDF records)
 * gets rebaselined at drain (ACCEPTANCE criterion).
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { enumerateAll } from './sources/fcdo-treaties'

const CORPUS = 'uk-treaties-fcdo'
const PRIORITY = 3   // matches existing uk-treaties priority

function normaliseTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

async function loadExistingTitles(pool: ReturnType<typeof getNeonPool>): Promise<Set<string>> {
  const res = await pool.query<{ sectionTitle: string | null }>(
    `SELECT DISTINCT "sectionTitle" FROM corpus_sections WHERE corpus IN ('uk-treaties','tax-treaties-dta') AND "sectionTitle" IS NOT NULL`
  )
  return new Set(res.rows.map(r => normaliseTitle(r.sectionTitle!)))
}

async function main() {
  const pool = getNeonPool()

  console.log('[v31-fcdo-treaties] loading existing uk-treaties + tax-treaties-dta titles for dedup...')
  const existingTitles = await loadExistingTitles(pool)
  console.log(`[v31-fcdo-treaties] ${existingTitles.size} distinct existing titles loaded`)

  console.log('[v31-fcdo-treaties] enumerating treaties.fcdo.gov.uk (paginated, pageSize=500)...')
  let total = 0
  let dupSkipped = 0
  const newRows: Array<{ id: string; corpus: string; docId: string; sourceType: string; priority: number }> = []

  for await (const batch of enumerateAll(500)) {
    total += batch.length
    for (const rec of batch) {
      if (existingTitles.has(normaliseTitle(rec.title))) { dupSkipped++; continue }
      newRows.push({
        id: `${CORPUS}:${rec.id}`,
        corpus: CORPUS,
        docId: String(rec.id),
        sourceType: 'fcdo-treaties',
        priority: PRIORITY,
      })
    }
    console.log(`[v31-fcdo-treaties]   ...${total} enumerated so far (${newRows.length} queued, ${dupSkipped} title-deduped)`)
  }

  console.log(`[v31-fcdo-treaties] universe: ${total} records; ${dupSkipped} apparent duplicates of uk-treaties/tax-treaties-dta skipped; ${newRows.length} to seed`)

  await pool.query(`
    INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, priority, blocked, blocked_reason)
    VALUES ($1, $2, $3, false, $4, false, NULL)
    ON CONFLICT (corpus_key) DO UPDATE
      SET display_label = EXCLUDED.display_label, est_sections = EXCLUDED.est_sections,
          priority = EXCLUDED.priority, blocked = false, blocked_reason = NULL
  `, [CORPUS, 'UK Treaties Online (FCDO, full universe)', total, PRIORITY])

  const { affected } = await bulkInsertQueueRows(newRows)
  console.log(`[v31-fcdo-treaties] ${CORPUS}: ${affected} queue rows seeded (P${PRIORITY})`)

  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
