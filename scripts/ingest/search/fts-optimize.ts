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
 * Proof that this is the whole story: a rare term with ZERO matches ("quokka") takes
 * 24.2s against the live service — an indexed lookup for a term that isn't there returns
 * in milliseconds, so those 24 seconds ARE the scan of the un-indexed rows.
 *
 * DO NOT USE optimize() FOR THIS (learned the hard way, 3 Aug 2026)
 * ------------------------------------------------------------------
 * The first attempt called `table.optimize()`. It OOM-killed the Railway container
 * ~45s in, eight times in a row. That is the SAME wall this repo already hit twice and
 * already documented — `build-fts-index.ts` carries the note from 22 Jul:
 *
 *     "optimize() has an independent v0.30 bug/memory cost on top of createIndex's own
 *      OOM risk. FTS_SKIP_COMPACT=true skips fragment compaction and runs createIndex()
 *      directly over the existing fragments"
 *
 * — and the vector build has the identical `VECTOR_SKIP_COMPACT` escape. Compaction is
 * the part that explodes, and we do not need it: we need the rows INDEXED, not the files
 * merged. So the default action here is a `createIndex` rebuild over the existing
 * fragments, which is exactly how the live index was built (2026-06-20: 16,509,051 rows
 * in 339s, no OOM). Compaction is available behind --compact for anyone who wants it,
 * with the memory warning attached.
 *
 * The index config below MIRRORS build-fts-index.ts EXACTLY, including
 * withPosition=false. The live index is the no-positions v1 build (CHANGE_LOG
 * 2026-06-20; the positions rider was abandoned 2026-07-22), and rebuilding with
 * different settings would silently change ranking. If you change one, change both.
 *
 * RUN IT IN THE DATACENTRE — it reads the whole body column from R2.
 *   Railway:  FTS_SERVICE=fts-build tsx search/fts-railway-run.ts optimize
 *   Direct:   tsx search/fts-optimize.ts        (--verify-only to just report coverage)
 *
 * Heartbeat every 30s: these are single long native calls, and without it a healthy run
 * looks hung.
 */
import { connectLance, FTS_TABLE, lancedb } from './lance'

const VERIFY_ONLY = process.argv.includes('--verify-only')
/** Opt in to compaction. It OOM-killed a Railway container on 3 Aug; see the header. */
const COMPACT = process.argv.includes('--compact')
/** Must match the live index. The v1 build is no-positions — see the header. */
const WITH_POSITION = (process.env.FTS_WITH_POSITIONS ?? 'false') !== 'false'
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
  if (totalUnindexed === 0 && !COMPACT) {
    log('every row is already indexed — nothing to do. Pass --compact to compact files anyway.')
    return
  }

  const t0 = Date.now()
  const beat = setInterval(
    () => log(`  … still working, ${Math.round((Date.now() - t0) / 1000)}s elapsed, rss=${rssMb()}MB`),
    HEARTBEAT_MS,
  )
  try {
    if (COMPACT) {
      log('--compact given: running optimize() (compaction + prune + index). MEMORY-HEAVY — see header.')
      const stats = await table.optimize()
      log(`  compaction: ${JSON.stringify(stats.compaction)}`)
      log(`  prune:      ${JSON.stringify(stats.prune)}`)
    } else {
      log(`rebuilding the FTS index over the existing fragments (withPosition=${WITH_POSITION}) — no compaction.`)
      await table.createIndex('body', {
        config: lancedb.Index.fts({
          withPosition: WITH_POSITION,
          baseTokenizer: 'simple',
          stem: true,
          language: 'English',
          removeStopWords: false,   // keep shall/may/must — legally meaningful
          asciiFolding: true,
          maxTokenLength: 40,
          lowercase: true,
        }),
        replace: true,
      })
    }
  } finally {
    clearInterval(beat)
  }
  const elapsed = Math.round((Date.now() - t0) / 1000)
  log(`finished in ${elapsed}s, rss=${rssMb()}MB`)

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
    log(`!! ${stillUnindexed.toLocaleString()} rows STILL outside the index — the rebuild did not cover everything.`)
    process.exitCode = 1
  }

  log(`DONE in ${elapsed}s — rows ${rowsAfter.toLocaleString()}, unindexed ${stillUnindexed.toLocaleString()}, query ${qBefore}ms → ${qAfter}ms`)
}

main().catch((e) => {
  console.error('[fts-optimize] FATAL', e instanceof Error ? e.stack ?? e.message : e)
  process.exit(1)
})
