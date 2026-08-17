/**
 * rescore-extracts.ts — re-run `findExtract` over positions ALREADY STORED, and report the change.
 *
 * The check on whether a quotation is real is ours, not the model's, so when the check is repaired
 * the existing rows can be re-scored for nothing. That matters twice over: it proves the repair on
 * the real material rather than on fixtures, and it means the fabricated-quotation rate is a
 * property of the current matcher rather than of whichever matcher happened to be running that day.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/rescore-extracts.ts --run-id pilot-2d3            # dry run, reports only
 *   npx tsx position-graph/rescore-extracts.ts --run-id pilot-2d3 --apply    # writes the new values
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { getDocText, findExtract } from './text-2d3'

export {}

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const runId = (() => { const i = argv.indexOf('--run-id'); return i >= 0 ? argv[i + 1] : 'pilot-2d3' })()

async function main() {
  const pool = getNeonPool()
  try {
    const { rows } = await pool.query<{ id: string; extract: string; was: boolean | null; r2key: string }>(`
      SELECT p.id::text, p.extract, p.extract_found_in_source was, c."r2Key" r2key
      FROM graph_position p JOIN corpus_sections c ON c.id = p.section_id
      WHERE p.run_id LIKE $1 || '%' AND p.polarity <> 'no-position'
      ORDER BY p.section_id, p.id`, [runId])
    console.log(`\n════ RESCORE — ${rows.length} positions in run_id ${runId}* ${APPLY ? '(APPLYING)' : '(dry run)'} ════`)

    const cache = new Map<string, string>()
    let falseToTrue = 0
    let trueToFalse = 0
    let unchanged = 0
    let unreadable = 0
    const updates: Array<[string, boolean, number | null]> = []

    for (const r of rows) {
      let doc = cache.get(r.r2key)
      if (doc === undefined) { doc = (await getDocText(r.r2key)) ?? ''; cache.set(r.r2key, doc) }
      if (!doc) { unreadable++; continue }
      const m = findExtract(r.extract, doc)
      if (m.found === r.was) unchanged++
      else if (m.found) falseToTrue++
      else trueToFalse++
      updates.push([r.id, m.found, m.offset])
    }

    const nowFound = updates.filter((u) => u[1]).length
    console.log(`  unchanged                     ${unchanged}`)
    console.log(`  NOT-FOUND → found             ${falseToTrue}   ← the repair`)
    console.log(`  found → NOT-FOUND             ${trueToFalse}   ${trueToFalse ? '⚠ a regression, read these' : '(none — the repair only ever loosened)'}`)
    if (unreadable) console.log(`  documents unreadable          ${unreadable}`)
    console.log(`\n  extract found in source       ${nowFound}/${updates.length}`)
    console.log(`  NOT found — the fabricated-quotation rate  ${updates.length - nowFound}/${updates.length}`
      + ` = ${(100 * (updates.length - nowFound) / Math.max(1, updates.length)).toFixed(1)}%`)

    if (!APPLY) { console.log(`\n  --dry run: nothing written. Re-run with --apply.`); return }
    for (let i = 0; i < updates.length; i += 500) {
      const batch = updates.slice(i, i + 500)
      await pool.query(
        `UPDATE graph_position AS p SET extract_found_in_source = v.found, extract_offset = v.off
         FROM (SELECT unnest($1::bigint[]) id, unnest($2::boolean[]) found, unnest($3::int[]) off) v
         WHERE p.id = v.id`,
        [batch.map((b) => b[0]), batch.map((b) => b[1]), batch.map((b) => b[2])])
    }
    console.log(`\n  ${updates.length} rows re-scored.`)
  } finally { await endNeonPool() }
}
// ⚠ GUARDED: this module exports helpers, and an unguarded main() means an IMPORT runs the
// script. trial-positions.ts imports prefixKey from extract-positions and triggered its $8.51
// population report mid-trial. A module that does work on import cannot be reused.
if (require.main === module) main().catch((e) => { console.error('[rescore-extracts] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
