/**
 * v28-jurisdiction-column.ts — V28 §1.2 (search-thread relay).
 *
 * Adds corpus_sections.jurisdiction (per-section, populated corpus-level as the
 * first approximation) and a column comment flagging the territorial-extent
 * caveat. Values match the search thread's jurisdictionFor() labels exactly —
 * 'uk' | 'wales' | 'scotland' | 'ni' — so search/corpus-map.ts can switch its
 * stopgap map off and read the column directly (the brief writes "uk-wide";
 * we use 'uk' for value-compatibility with the live search map — reversible).
 *
 * Churn-aware: ADD COLUMN ... NOT NULL DEFAULT 'uk' is a metadata-only change in
 * Postgres 11+ (no 17M-row rewrite — the default is stored once and returned for
 * existing rows). Only the ~399k devolved rows are UPDATEd to their nation, so
 * MVCC churn is ~399k dead tuples, not 17M (the project defers the pwdata licence
 * backfill for exactly this reason — see CLAUDE.md storage notes).
 *
 *   --check   report current state (column present? per-jurisdiction counts)
 *   --apply   add the column (idempotent), backfill devolved corpora, comment
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'

// Mirror of scripts/ingest/search/corpus-map.ts jurisdictionFor(), expressed as
// SQL so the backfill agrees with the indexer byte-for-byte.
//   senedd*                              → wales
//   scottish* | scotlawcom               → scotland
//   niassembly-hansard|ni-judgments|nilawcom → ni
//   else                                 → uk
const DEVOLVED_UPDATE = `
  UPDATE corpus_sections SET jurisdiction = CASE
    WHEN corpus LIKE 'senedd%'                                   THEN 'wales'
    WHEN corpus LIKE 'scottish%' OR corpus = 'scotlawcom'        THEN 'scotland'
    WHEN corpus IN ('niassembly-hansard','ni-judgments','nilawcom') THEN 'ni'
    ELSE 'uk' END
  WHERE (corpus LIKE 'senedd%'
      OR corpus LIKE 'scottish%' OR corpus = 'scotlawcom'
      OR corpus IN ('niassembly-hansard','ni-judgments','nilawcom'))
    AND jurisdiction IS DISTINCT FROM (CASE
      WHEN corpus LIKE 'senedd%'                                   THEN 'wales'
      WHEN corpus LIKE 'scottish%' OR corpus = 'scotlawcom'        THEN 'scotland'
      WHEN corpus IN ('niassembly-hansard','ni-judgments','nilawcom') THEN 'ni'
      ELSE 'uk' END)
`

async function report() {
  const pool = getNeonPool()
  const has = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text n FROM information_schema.columns
     WHERE table_name='corpus_sections' AND column_name='jurisdiction'`)
  console.log('jurisdiction column present:', has.rows[0].n === '1')
  if (has.rows[0].n === '1') {
    const j = await pool.query<{ jurisdiction: string | null; n: string }>(
      `SELECT jurisdiction, COUNT(*)::text n FROM corpus_sections GROUP BY jurisdiction ORDER BY jurisdiction`)
    console.log('per-jurisdiction counts:')
    for (const r of j.rows) console.log(`  ${r.jurisdiction ?? '(null)'}\t${r.n}`)
  }
}

async function apply() {
  const pool = getNeonPool()
  console.log('ADD COLUMN jurisdiction TEXT NOT NULL DEFAULT \'uk\' (metadata-only)…')
  await pool.query(`ALTER TABLE corpus_sections ADD COLUMN IF NOT EXISTS jurisdiction TEXT NOT NULL DEFAULT 'uk'`)
  await pool.query(`COMMENT ON COLUMN corpus_sections.jurisdiction IS
    'V28 §1.2: first-approximation jurisdiction, populated corpus-level (senedd→wales; scottish*/scotlawcom→scotland; niassembly-hansard/ni-judgments/nilawcom→ni; else uk). NOTE: some UK-wide Acts have territorial-extent differences (extent clauses) that this corpus-level label does NOT capture — refine per-section later from CLML <Extent> where ranking needs it.'`)
  console.log('backfilling devolved corpora…')
  const r = await pool.query(DEVOLVED_UPDATE)
  console.log(`devolved rows updated: ${r.rowCount}`)
  await report()
}

async function main() {
  const mode = process.argv.includes('--apply') ? 'apply' : 'check'
  if (mode === 'apply') await apply()
  else await report()
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
