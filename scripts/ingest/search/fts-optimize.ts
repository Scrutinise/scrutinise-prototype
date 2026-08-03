/**
 * fts-optimize.ts — compact `corpus_fts` and MERGE APPENDED ROWS INTO THE FTS INDEX.
 *
 * WHY THIS EXISTS (the latency incident, 2–3 Aug 2026)
 * ----------------------------------------------------
 * `fts-serve-production` was answering in ~26s at p50 and ~36s at p95, against the
 * platform's 25s client timeout — i.e. the background briefing and every stage search
 * were timing out, which is how a data-protection idea ended up showing road-traffic
 * fixtures (CHANGE_LOG "LEX REBUILD — Sprint 3-C", and the trace before it).
 *
 * The cause was NOT file fragmentation, which is what everyone assumed. It was index
 * COVERAGE. `table.indexStats('body_idx')` reported:
 *
 *      numIndexedRows   16,509,051
 *      numUnindexedRows  1,191,345      ← the 29 Jul fts-catchup backfill
 *
 * exactly the delta that backfill wrote. LanceDB keeps un-indexed fragments SEARCHABLE
 * by brute-force scanning them alongside the inverted index — which is why the backfill
 * was correct (rows were findable immediately, as verified at the time) and yet every
 * query afterwards paid a 1.19M-row scan.
 *
 * `optimize()` in LanceDB 0.30 covers three things — compaction, prune, and
 * "Index: optimizes the indices, ADDING NEW DATA TO EXISTING INDICES". That last one is
 * the fix; it is an incremental merge, not the full 17.7M-row rebuild that OOM-looped
 * when the index was first built.
 *
 * RUN IT IN THE DATACENTRE. Compaction rewrites data files, so this is a
 * datacentre→R2 job, not a home-connection one (same reasoning as fts-railway-run.ts).
 *   Railway:  FTS_SERVICE=fts-build tsx search/fts-railway-run.ts optimize
 *   Direct:   tsx search/fts-optimize.ts            (add --verify-only to just report)
 *
 * It logs a heartbeat every 30s because optimize() is one long native call: without it
 * the logs go silent for a long stretch and a healthy run looks hung.
 */
import { connectLance, FTS_TABLE, lancedb } from './lance'

const VERIFY_ONLY = process.argv.includes('--verify-only')
const HEARTBEAT_MS = 30_000
const log = (msg: string) => console.log(`[fts-optimize] ${msg}`)
const rssMb = () => Math.round(process.memoryUsage().rss / 1024 / 1024)

interface IndexCoverage {
  name: string
  indexType: string
  indexed: number
  unindexed: number
}

async function coverage(table: lancedb.Table): Promise<IndexCoverage[]> {
  const out: IndexCoverage[] = []
  for (const idx of await table.listIndices()) {
    const name = (idx as unknown as { name: string }).name
    try {
      const st = (await table.indexStats(name)) as unknown as {
        numIndexedRows?: number; numUnindexedRows?: number; indexType?: string
      }
      out.push({
        name,
        indexType: st.indexType ?? (idx as unknown as { indexType: string }).indexType,
        indexed: st.numIndexedRows ?? 0,
        unindexed: st.numUnindexedRows ?? 0,
      })
    } catch (e) {
      log(`  index ${name}: stats unavailable — ${(e as Error).message}`)
    }
  }
  return out
}

function report(label: string, rows: number, cov: IndexCoverage[]) {
  log(`${label}: ${rows.toLocaleString()} rows`)
  for (const c of cov) {
    const pct = rows ? ((c.unindexed / rows) * 100).toFixed(2) : '0'
    log(`  ${c.name} (${c.indexType}): indexed=${c.indexed.toLocaleString()} unindexed=${c.unindexed.toLocaleString()} (${pct}% scanned per query)`)
  }
  if (!cov.length) log('  NO INDEX — every query is a full scan.')
}

/** A timed sample query, so the effect is measured here and not only from outside. */
async function sampleQuery(table: lancedb.Table, query: string): Promise<number> {
  const t0 = Date.now()
  await table.search(query, 'fts', 'body').limit(100).toArray()
  return Date.now() - t0
}

async function main() {
  log(`table=${FTS_TABLE} verifyOnly=${VERIFY_ONLY} node=${process.version}`)
  const conn = await connectLance()
  const table = await conn.openTable(FTS_TABLE)

  const rowsBefore = await table.countRows()
  const covBefore = await coverage(table)
  report('BEFORE', rowsBefore, covBefore)

  // The known-slow query, measured in-process so the before/after is like-for-like.
  const qBefore = await sampleQuery(table, 'data protection')
  log(`BEFORE sample query "data protection" (limit 100): ${qBefore}ms`)

  if (VERIFY_ONLY) { log('verify-only — not optimizing.'); return }

  const totalUnindexed = covBefore.reduce((a, c) => a + c.unindexed, 0)
  if (totalUnindexed === 0) {
    log('every row is already indexed; running optimize anyway for compaction + prune.')
  }

  log('running optimize() — compaction + prune + index merge. This is the long part.')
  const t0 = Date.now()
  const beat = setInterval(
    () => log(`  … still optimizing, ${Math.round((Date.now() - t0) / 1000)}s elapsed, rss=${rssMb()}MB`),
    HEARTBEAT_MS,
  )
  let stats
  try {
    stats = await table.optimize()
  } finally {
    clearInterval(beat)
  }
  const elapsed = Math.round((Date.now() - t0) / 1000)
  log(`optimize() returned after ${elapsed}s, rss=${rssMb()}MB`)
  log(`  compaction: ${JSON.stringify(stats.compaction)}`)
  log(`  prune:      ${JSON.stringify(stats.prune)}`)

  const rowsAfter = await table.countRows()
  const covAfter = await coverage(table)
  report('AFTER', rowsAfter, covAfter)

  const qAfter = await sampleQuery(table, 'data protection')
  log(`AFTER sample query "data protection" (limit 100): ${qAfter}ms (was ${qBefore}ms)`)

  // Two things must hold, and both are worth failing loudly on.
  if (rowsAfter !== rowsBefore) {
    log(`!! ROW COUNT CHANGED: ${rowsBefore.toLocaleString()} → ${rowsAfter.toLocaleString()}. Investigate before serving.`)
    process.exitCode = 1
  }
  const stillUnindexed = covAfter.reduce((a, c) => a + c.unindexed, 0)
  if (stillUnindexed > 0) {
    log(`!! ${stillUnindexed.toLocaleString()} rows STILL outside the index — optimize did not fully merge. A createIndex(replace) rebuild may be needed.`)
    process.exitCode = 1
  }

  log(`DONE in ${elapsed}s — rows ${rowsAfter.toLocaleString()}, unindexed ${stillUnindexed.toLocaleString()}, query ${qBefore}ms → ${qAfter}ms`)
}

main().catch((e) => {
  console.error('[fts-optimize] FATAL', e instanceof Error ? e.stack ?? e.message : e)
  process.exit(1)
})
