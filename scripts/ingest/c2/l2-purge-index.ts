/**
 * l2-purge-index.ts — LANE A, LAYER THREE. Remove the purged sections from the SERVING index.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS IS A SEPARATE SCRIPT AND NOT AN AFTERTHOUGHT
 *
 * `l2-purge.ts` deletes from `corpus_sections` and then prints "NEXT (index layer, not done here)".
 * That sentence IS the defect the whole purge exists to fix: retiring a target set a boolean and
 * deleted nothing, and 28,629 rows went on answering queries for months. Deleting the database rows
 * and leaving the index is the same mistake one layer along — the rows would still be returned to
 * users, now with no source row behind them.
 *
 * ⚠ IT KEYS OFF THE MANIFEST, NOT OFF A RE-QUERY. `--stamp=` names one `l2-purge.ts` run and this
 * script reads that run's `*.ids.txt` files. Re-deriving the id list here would let the two layers
 * drift the moment the database changed between them, which is exactly the class of bug being fixed.
 *
 * ── THE THREE TABLES, AND WHY THEY ARE NOT DELETED THE SAME WAY ─────────────────────────────────
 *   corpus_fts     (18.27M rows)  keyed by `id`        — NO scalar index. Measured 24 Aug: a
 *                                                        non-matching `id =` probe takes 8.0 s, a
 *                                                        full-table scan. Cost is per PREDICATE.
 *   corpus_chunks  (22.67M rows)  keyed by `sectionId` — BTree index `sectionId_idx`. Measured 0.3 s.
 *   corpus_vec     (22.67M rows)  keyed by `sectionId` — no index, but chunkId/sectionId sort order
 *                                                        gives zone-map pruning. Measured 0.2 s.
 *
 * So SEVEN of the eight collections go in ONE predicate each (`corpus IN (…)`), because the whole
 * collection is being removed. Only `et-decisions` needs an id list, because 161,753 PDF rows in
 * that same collection MUST SURVIVE — and `corpus_fts` carries no `format` column to separate them
 * with. ⚠ The tempting shortcut, id ending in ':1', is WRONG and was tested against the database
 * first: 18 non-html `et-decisions` rows also end in ':1', so it would delete 18 real judgments.
 *
 * ── THE GUARD ──────────────────────────────────────────────────────────────────────────────────
 * Every table is counted before and after. The observed delta must equal the counted-before, and a
 * mismatch sets a non-zero exit rather than being smoothed over. The et-decisions SURVIVORS are
 * counted too — a purge that removed the judgments instead of the landing pages would otherwise
 * report a perfectly correct-looking total.
 *
 * Rows present in `corpus_sections` but ABSENT from an index are expected (the index lags ingest)
 * and are reported as a number, not treated as an error — but the number is printed, because a
 * large one means the index is stale in a way somebody should know about.
 *
 * ⚠ AND IT DOES NOT REACH A USER. `fts-serve` and `vector-serve` call `openTable()` once at boot
 * with no `readConsistencyInterval`. Until they are REDEPLOYED they keep serving the version they
 * opened. Said at the end of every run.
 *
 * ⚠ THIS MOVES BM25 DOCUMENT FREQUENCIES ACROSS THE WHOLE TABLE. 168,569 of 18.27M rows is 0.92%.
 * S11 measured 0 of 5 sampled rankings surviving a comparable case-law rewrite. Every recall number
 * taken before this run is VOID for comparison across it.
 *
 * Usage:
 *   tsx c2/l2-purge-index.ts --stamp=2026-08-24T00-34-43-701Z             # dry run, counts only
 *   tsx c2/l2-purge-index.ts --stamp=... --execute
 *   tsx c2/l2-purge-index.ts --stamp=... --execute --only=corpus_fts
 */
import fs from 'fs'
import path from 'path'
import { connectLance, FTS_TABLE } from '../search/lance'
import { VEC_TABLE, CHUNKS_TABLE } from '../search/vector-common'

const EXECUTE = process.argv.includes('--execute')
const arg = (name: string) => (process.argv.find((a) => a.startsWith(`--${name}=`)) ?? '').split('=')[1] || null
const STAMP = arg('stamp')
const ONLY = arg('only')
const ID_BATCH = parseInt(arg('batch') ?? '4000', 10)
const MANIFEST_DIR = path.join(__dirname, 'purge-manifests')

/** The seven collections removed WHOLE — one predicate each, no id list needed. */
const WHOLE_CORPORA = [
  'lda-lordswrittenquestions', 'lda-commonswrittenquestions', 'written-statements',
  'lda-commonsdivisions', 'lda-lordsdivisions', 'written-answers', 'oecd',
]
/** The one collection removed in PART — the landing pages only; its PDFs must survive. */
const PARTIAL_CORPUS = 'et-decisions'
const PARTIAL_IDS_FILE = 'et-decisions-landing'

const n = (x: number) => x.toLocaleString('en-GB')
const esc = (s: string) => s.replace(/'/g, "''")
/**
 * ⚠ THE COLUMN NAME IS NOT QUOTED, AND THAT IS LOAD-BEARING. Found the hard way on 24 Aug 2026
 * while this script was still in dry run: LanceDB's DataFusion predicate parser accepts
 * `"id" = 'x'` and `"sectionId" IN (…)` WITHOUT ERROR and matches NOTHING. Measured on all three
 * tables, both forms, the same ids:
 *
 *     corpus_fts     id = 'x' → 1                  "id" = 'x' → 0
 *     corpus_chunks  sectionId IN (2000) → 2000    "sectionId" IN (2000) → 0
 *     corpus_vec     sectionId IN (2000) → 2000    "sectionId" IN (2000) → 0
 *
 * A `delete()` carrying the quoted form removes 0 rows, raises nothing, and returns normally — so
 * the purge would have reported success and left every row serving. The quoted form is also ~70×
 * FASTER (0.1 s against 6.9–10.1 s) because it prunes every fragment, which is exactly what makes
 * it look like a working optimisation. `fts-hygiene.ts` and `vec-hygiene.ts` both use the bare
 * form; this file broke with them, and the count-before guard below is what caught it.
 */
const inList = (col: string, ids: string[]) => `${col} IN (${ids.map((i) => `'${esc(i)}'`).join(',')})`
function batched<T>(a: T[], k: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < a.length; i += k) out.push(a.slice(i, i + k))
  return out
}

interface Layer { table: string; key: string }
const LAYERS: Layer[] = [
  { table: FTS_TABLE, key: 'id' },            // corpus_fts is one row per SECTION
  { table: CHUNKS_TABLE, key: 'sectionId' },  // corpus_chunks / corpus_vec are one row per CHUNK
  { table: VEC_TABLE, key: 'sectionId' },
]

async function main() {
  if (!STAMP) { console.error('need --stamp=<the l2-purge.ts run stamp>'); process.exit(1) }

  // ── read the id list from THAT run's manifest, not from a fresh query
  const idsPath = path.join(MANIFEST_DIR, `${PARTIAL_IDS_FILE}.${STAMP}.ids.txt`)
  if (!fs.existsSync(idsPath)) {
    console.error(`no manifest for stamp ${STAMP}: ${idsPath} does not exist.`)
    console.error('Available:')
    for (const f of fs.readdirSync(MANIFEST_DIR).filter((f) => f.endsWith('.ids.txt'))) console.error('  ' + f)
    process.exit(1)
  }
  const partialIds = fs.readFileSync(idsPath, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean)
  console.log(`manifest ${STAMP}`)
  console.log(`  ${PARTIAL_CORPUS}: ${n(partialIds.length)} landing-page ids read from disk`)
  console.log(`  whole collections: ${WHOLE_CORPORA.join(', ')}`)
  console.log(EXECUTE
    ? '\n⚠ EXECUTE MODE — the Lance tables on R2 will be written.\n'
    : '\nDRY RUN — counts only, nothing written. Pass --execute to perform.\n')

  const db = await connectLance()
  const report: any[] = []
  const wholePred = `corpus IN (${WHOLE_CORPORA.map((c) => `'${esc(c)}'`).join(',')})`
  const idBatches = batched(partialIds, ID_BATCH)

  for (const layer of LAYERS) {
    if (ONLY && layer.table !== ONLY) continue
    const tbl = await db.openTable(layer.table)
    const versionBefore = typeof (tbl as any).version === 'function' ? await (tbl as any).version() : '?'
    const rowsBefore = await tbl.countRows()
    console.log(`── ${layer.table}   version ${versionBefore}   ${n(rowsBefore)} rows   (key: ${layer.key})`)

    // counted BEFORE, so the delta can be checked against something measured rather than assumed
    const t0 = Date.now()
    const wholeCount = await tbl.countRows(wholePred)
    console.log(`   seven whole collections present here: ${n(wholeCount)}   (${((Date.now() - t0) / 1000).toFixed(1)}s)`)

    let partialCount = 0
    const tp0 = Date.now()
    for (const c of idBatches) partialCount += await tbl.countRows(inList(layer.key, c))
    console.log(`   et-decisions landing pages present here: ${n(partialCount)} rows   (${((Date.now() - tp0) / 1000).toFixed(1)}s over ${idBatches.length} predicates)`)
    const etTotal = await tbl.countRows(`corpus = '${PARTIAL_CORPUS}'`)
    console.log(`   et-decisions total here: ${n(etTotal)}  →  ${n(etTotal - partialCount)} must SURVIVE`)

    // ── THE PREDICATE MUST DEMONSTRABLY MATCH SOMETHING. A predicate that matches nothing
    //    deletes nothing and reports success — the exact failure this run nearly shipped, and the
    //    reason the counts above are taken before the delete rather than inferred after it.
    if (partialIds.length > 0 && partialCount === 0) {
      console.log(`   ⛔ ABORT — the id predicate matched 0 of ${n(partialIds.length)} manifest ids in ${layer.table},`)
      console.log(`      while the collection itself holds ${n(etTotal)} rows there. A delete on this predicate`)
      console.log('      would remove nothing and report success. Fix the predicate before running anything else.')
      process.exit(1)
    }
    if (wholeCount === 0) {
      console.log(`   ⛔ ABORT — the corpus predicate matched 0 rows in ${layer.table}. Same reason.`)
      process.exit(1)
    }

    if (!EXECUTE) {
      console.log(`   DRY RUN — would remove ${n(wholeCount + partialCount)} rows from ${layer.table}.\n`)
      report.push({ table: layer.table, versionBefore, rowsBefore, wholeCount, partialCount, etTotal, executed: false })
      continue
    }

    const d0 = Date.now()
    await tbl.delete(wholePred)
    console.log(`   ✓ seven collections deleted in one predicate (${((Date.now() - d0) / 1000).toFixed(1)}s)`)
    let done = 0
    const d1 = Date.now()
    for (const c of idBatches) {
      await tbl.delete(inList(layer.key, c))
      done += c.length
      process.stdout.write(`\r   et-decisions landing: ${n(done)}/${n(partialIds.length)} ids, ${idBatches.length} predicates, ${((Date.now() - d1) / 1000).toFixed(0)}s…   `)
    }
    process.stdout.write('\n')

    const rowsAfter = await tbl.countRows()
    const versionAfter = typeof (tbl as any).version === 'function' ? await (tbl as any).version() : '?'
    const removed = rowsBefore - rowsAfter
    const expected = wholeCount + partialCount
    const etAfter = await tbl.countRows(`corpus = '${PARTIAL_CORPUS}'`)
    const okTotal = removed === expected
    const okSurvivors = etAfter === etTotal - partialCount
    console.log(`   rows ${n(rowsBefore)} → ${n(rowsAfter)}   removed ${n(removed)}, expected ${n(expected)}  ${okTotal ? '✓' : '⚠ MISMATCH'}`)
    console.log(`   et-decisions survivors: ${n(etAfter)}, expected ${n(etTotal - partialCount)}  ${okSurvivors ? '✓' : '⚠ MISMATCH'}`)
    console.log(`   version ${versionBefore} → ${versionAfter}\n`)
    if (!okTotal || !okSurvivors) process.exitCode = 1
    report.push({ table: layer.table, versionBefore, versionAfter, rowsBefore, rowsAfter, removed, expected, etTotal, etAfter, executed: true })
  }

  // ⚠ THE MODE IS IN THE FILENAME. A dry run and an execute run of the same manifest would
  //   otherwise write to the same path, and the later one would silently overwrite the earlier —
  //   the "never share an output path between two runs" rule, which this script broke first.
  const outPath = path.join(__dirname, '../../../docs/census',
    `C2_L2_purge_index.${STAMP}.${EXECUTE ? 'execute' : 'dryrun'}.json`)
  fs.writeFileSync(outPath, JSON.stringify({ generated: new Date().toISOString(), stamp: STAMP, executed: EXECUTE, report }, null, 2))
  console.log(`written: ${path.relative(process.cwd(), outPath)}`)
  if (EXECUTE) {
    console.log('\n⚠ NOTHING HERE HAS REACHED A USER YET. `fts-serve` and `vector-serve` hold their Lance')
    console.log('  tables open from boot. Redeploy both, then run labels/verify-retired-gone.ts.')
    console.log('⚠ Every recall number taken before this run is VOID for comparison across it — 0.92% of')
    console.log('  corpus_fts moved, and BM25 document frequencies are table-wide.')
  }
}
main().catch((e) => { console.error('FAIL', e); process.exit(1) })
