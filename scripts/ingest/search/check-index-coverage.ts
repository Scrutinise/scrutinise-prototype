/**
 * check-index-coverage.ts — S16 §1. DOES EVERY INDEX THE SEARCH SERVICES DEPEND ON COVER EVERY ROW?
 *
 * ⚠⚠ THE STANDING RULE THIS ENFORCES: AN EXISTENCE CHECK IS NOT A COMPLETENESS CHECK.
 *
 * S15's real cause was never the service's width. `corpus_chunks.sectionId_idx` existed, and
 * 1,478,964 rows — 6.5% of 22,670,808 — had fallen outside it, because a LanceDB index covers only
 * the rows present when it was built and every append leaves more outside. Each snippet lookup
 * brute-force scanned them: an equality lookup on the INDEXED column took 133,401 ms, while the
 * same table's UNINDEXED column answered in 21,470 ms. The rebuild cost €0.008 and 45 seconds.
 *
 * `build-chunks-scalar-index.ts --verify-only` had been asking *"is there an index on this
 * column?"* — which an index missing 6.5% of its table answers **yes** — and printing
 * "Nothing to do."
 *
 * ⚠ SO THIS CHECK STATES WHAT IT COUNTED, NEVER WHETHER SOMETHING EXISTS. Every line prints
 * indexed and unindexed row counts. A table with no index at all is a DIFFERENT and louder failure
 * than a table whose index is stale, and both are different from "covered".
 *
 * ⚠ UNREADABLE COVERAGE IS TREATED AS UNKNOWN, NOT AS COVERED. `indexStats` failing must never
 * become a pass — that is the silent-success shape this whole check exists to remove.
 *
 * Exit codes: 0 every index covers every row · 3 an index is MISSING · 4 an index is STALE ·
 *             5 coverage could not be read
 *
 * Usage:
 *   tsx search/check-index-coverage.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }
import { connectLance, FTS_TABLE } from './lance'
import { CHUNKS_TABLE, VEC_TABLE } from './vector-common'

interface Finding {
  table: string
  index: string | null
  column: string
  rows: number
  indexed: number | null
  unindexed: number | null
  verdict: 'COVERED' | 'STALE' | 'MISSING' | 'UNKNOWN'
}

/** Indexes the serving path depends on, and the query each one serves. Named rather than
 *  discovered, so an index that DISAPPEARS is a failure rather than an empty list. */
const EXPECTED: Array<{ table: string; column: string; serves: string }> = [
  { table: FTS_TABLE, column: 'body', serves: 'fts-serve: the BM25 match on every query' },
  { table: VEC_TABLE, column: 'vector', serves: 'vector-serve: the ANN search' },
  { table: CHUNKS_TABLE, column: 'sectionId', serves: 'vector-serve: snippet hydration (S15 §1.2)' },
]

/**
 * ⚠ THE NEGATIVE CONTROL, AND IT IS A REAL ONE RATHER THAN A PLANTED STRING.
 *
 * On a healthy corpus this check reports COVERED for everything and exits 0 — which is
 * indistinguishable from a check that cannot fail. `--self-test` adds `corpus_chunks.chunkId`, a
 * column **measured in S15 to have no index at all** (an equality lookup on it took 21,470 ms, and
 * `listIndices` returns only `sectionId_idx` for that table). The run MUST report MISSING and exit
 * non-zero; if it reports COVERED, the checker is broken and everything above it is worthless.
 */
const SELF_TEST: { table: string; column: string; serves: string } =
  { table: CHUNKS_TABLE, column: 'chunkId', serves: 'SELF-TEST — this column has no index; MISSING is the required answer' }

async function main() {
  const SELF = process.argv.includes('--self-test')
  const conn = await connectLance()
  const findings: Finding[] = []
  const expected = SELF ? [...EXPECTED, SELF_TEST] : EXPECTED
  if (SELF) console.log('⚠ SELF-TEST: corpus_chunks.chunkId is included and MUST report MISSING.\n')

  for (const want of expected) {
    let tbl
    try { tbl = await conn.openTable(want.table) } catch (e) {
      console.log(`  ⛔ ${want.table}: cannot open — ${(e as Error).message}`)
      findings.push({ table: want.table, index: null, column: want.column, rows: 0, indexed: null, unindexed: null, verdict: 'UNKNOWN' })
      continue
    }
    const rows = await tbl.countRows()
    const idx = await (tbl as any).listIndices().catch(() => [])
    const hit = idx.find((i: any) => (i.columns ?? []).includes(want.column))
    if (!hit) {
      findings.push({ table: want.table, index: null, column: want.column, rows, indexed: 0, unindexed: rows, verdict: 'MISSING' })
      continue
    }
    let indexed: number | null = null
    let unindexed: number | null = null
    try {
      const s = await (tbl as any).indexStats(hit.name)
      const i = s?.numIndexedRows ?? s?.num_indexed_rows
      const u = s?.numUnindexedRows ?? s?.num_unindexed_rows
      if (typeof i === 'number' && typeof u === 'number') { indexed = i; unindexed = u }
    } catch { /* leaves them null → UNKNOWN */ }
    findings.push({
      table: want.table, index: hit.name, column: want.column, rows, indexed, unindexed,
      verdict: unindexed === null ? 'UNKNOWN' : unindexed > 0 ? 'STALE' : 'COVERED',
    })
  }

  console.log('── index coverage ── every figure is a ROW COUNT, not an existence test\n')
  console.log('  table            index                column      rows         indexed      UNINDEXED    verdict')
  for (const f of findings) {
    const pct = f.unindexed !== null && f.rows ? ` (${((f.unindexed / f.rows) * 100).toFixed(1)}%)` : ''
    console.log(
      `  ${f.table.padEnd(16)} ${(f.index ?? '(none)').padEnd(20)} ${f.column.padEnd(11)} ` +
      `${f.rows.toLocaleString().padStart(12)} ${(f.indexed?.toLocaleString() ?? '?').padStart(12)} ` +
      `${(f.unindexed?.toLocaleString() ?? '?').padStart(12)}${pct.padEnd(9)} ${f.verdict}`)
  }
  console.log('')
  if (SELF) {
    const probe = findings.find((f) => f.column === SELF_TEST.column && f.table === SELF_TEST.table)
    if (probe?.verdict === 'MISSING') {
      console.log('  ✅ SELF-TEST PASSED — the checker reports MISSING for an unindexed column.\n')
    } else {
      console.log(`  ❌ SELF-TEST FAILED — reported ${probe?.verdict} for a column with no index. THIS CHECKER CANNOT BE TRUSTED.\n`)
      process.exit(1)
    }
  }
  for (const f of findings) {
    const w = expected.find((e) => e.table === f.table && e.column === f.column)!
    if (f.verdict === 'STALE') {
      console.log(`  ⚠⚠ ${f.table}.${f.column}: ${f.unindexed!.toLocaleString()} rows are OUTSIDE the index.`)
      console.log(`     Every query brute-force scans them. Serves — ${w.serves}`)
    } else if (f.verdict === 'MISSING') {
      console.log(`  ⛔ ${f.table}.${f.column}: NO INDEX AT ALL on a column the serving path queries.`)
      console.log(`     Serves — ${w.serves}`)
    } else if (f.verdict === 'UNKNOWN') {
      console.log(`  ⚠ ${f.table}.${f.column}: coverage COULD NOT BE READ. Treated as unknown, NOT as covered.`)
    }
  }
  const stale = findings.filter((f) => f.verdict === 'STALE')
  const missing = findings.filter((f) => f.verdict === 'MISSING')
  const unknown = findings.filter((f) => f.verdict === 'UNKNOWN')
  if (!stale.length && !missing.length && !unknown.length) {
    console.log(`  ✅ ${findings.length} of ${findings.length} indexes cover every row of their table.`)
    return
  }
  console.log(`\n  ${findings.length - stale.length - missing.length - unknown.length} covered · ${stale.length} stale · ${missing.length} missing · ${unknown.length} unknown`)
  process.exit(missing.length ? 3 : stale.length ? 4 : 5)
}
main().catch((e) => { console.error('FAILED', e instanceof Error ? e.message : e); process.exit(1) })
