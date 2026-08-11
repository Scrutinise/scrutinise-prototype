/**
 * verify-vector-index.ts — does `corpus_vec` actually have an ANN index, and does it cover every
 * row? The vector twin of `fts-optimize.ts --verify-only`, and the verify step for the
 * `vector-reindex` heavy job.
 *
 * ⚠ WHY THIS EXISTS. `vector-reindex` was first registered with `check-vector-serving.ts` as its
 * verify. That script is a pure-logic unit check — no Lance, no network — so it passes in under a
 * second whether or not an index was built. A verify that cannot fail for the reason the job
 * exists is not a verify; it is a second success message. The `vector-index` job it replaced had
 * the same shape of problem (checkpointed `phase: "done"`, so it printed "already done", created
 * nothing, destroyed the box and reported success).
 *
 * What is actually checked, all read-only and costing a metadata read:
 *   1. an index exists on the `vector` column at all;
 *   2. `numUnindexedRows` is 0 — every appended vector is absorbed, not brute-force scanned
 *      (INGEST_PLAYBOOK §20: unindexed rows stay CORRECT but are paid for on every query forever);
 *   3. indexed + unindexed reconciles against the table's own row count.
 *
 * Exits non-zero when the index is missing or coverage is incomplete, so the heavy-job runner
 * reports a failure instead of a clean run.
 *
 * Usage: tsx search/verify-vector-index.ts [--max-unindexed N]
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { connectLance } from './lance'
import { VEC_TABLE } from './vector-common'

export {}

const MAX_UNINDEXED = (() => {
  const i = process.argv.indexOf('--max-unindexed')
  return i >= 0 ? parseInt(process.argv[i + 1], 10) : 0
})()

const n = (v: number) => Number(v).toLocaleString('en-GB')

async function main() {
  const conn = await connectLance()
  const tbl = await conn.openTable(VEC_TABLE)
  const rows = await tbl.countRows()
  console.log(`[verify-vec] table=${VEC_TABLE} rows=${n(rows)}`)

  const indices = await tbl.listIndices()
  if (!indices.length) {
    console.error('[verify-vec] ❌ NO INDEX ON THIS TABLE AT ALL — every query is a full scan')
    process.exit(1)
  }

  let vectorIndexed = false
  let bad = 0
  for (const idx of indices) {
    const name = (idx as unknown as { name: string }).name
    const cols = (idx as unknown as { columns?: string[] }).columns ?? []
    let st: { numIndexedRows?: number; numUnindexedRows?: number; indexType?: string } = {}
    try { st = (await tbl.indexStats(name)) as never } catch (e) {
      console.error(`[verify-vec] ❌ ${name}: indexStats threw — ${(e as Error).message}`)
      bad++; continue
    }
    const indexed = st.numIndexedRows ?? 0
    const unindexed = st.numUnindexedRows ?? 0
    const pct = rows ? ((unindexed / rows) * 100).toFixed(2) : '0.00'
    console.log(`[verify-vec]   ${name} (${st.indexType ?? '?'}) on [${cols.join(',')}]: indexed=${n(indexed)} unindexed=${n(unindexed)} (${pct}% brute-force scanned per query)`)

    if (cols.includes('vector')) {
      vectorIndexed = true
      if (unindexed > MAX_UNINDEXED) {
        console.error(`[verify-vec] ❌ ${name}: ${n(unindexed)} unindexed rows exceeds the allowed ${n(MAX_UNINDEXED)} — the rebuild did not absorb the appended vectors`)
        bad++
      }
      // indexed + unindexed must account for the whole table, or the stats describe a
      // different table state from the one being served.
      if (indexed + unindexed !== rows) {
        console.error(`[verify-vec] ❌ ${name}: indexed+unindexed = ${n(indexed + unindexed)} but the table holds ${n(rows)}`)
        bad++
      }
    }
  }

  if (!vectorIndexed) {
    console.error(`[verify-vec] ❌ no index covers the \`vector\` column — an ANN rebuild did not happen`)
    bad++
  }

  console.log(bad === 0
    ? `[verify-vec] ✅ ANN index present and covers all ${n(rows)} rows`
    : `[verify-vec] ❌ ${bad} problem(s)`)
  if (bad) process.exit(1)
}
main().catch((e) => { console.error('[verify-vec] FATAL', e); process.exit(1) })
