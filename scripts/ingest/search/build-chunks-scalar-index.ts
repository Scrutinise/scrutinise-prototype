/**
 * build-chunks-scalar-index.ts — build the BTREE scalar index on `corpus_chunks.sectionId`.
 *
 * WHY. `corpus_chunks` holds 21,839,900 rows and carries NO index of any kind.
 * `vector-query-service.ts` hydrates snippets with `where("sectionId IN (…)")` on every
 * query, which without an index is a full scan of the chunk bodies on R2. Measured
 * 7 Aug 2026:
 *
 *     embed (Gemini)      348 ms    3%
 *     ANN (corpus_vec)  2,178 ms   21%
 *     snippets (chunks) 7,825 ms   76%   ← this
 *
 * Proven to be a scan rather than a lookup: an IN-list of 1 id costs the same as an
 * IN-list of 20 (~6 s), while the same table with NO predicate returns in 132 ms. So the
 * cost is predicate evaluation over every row, not the volume read back.
 *
 * ⚠ THIS IS A HEAVY JOB (docs/CLAUDE.md §17). Index builds are named there explicitly:
 * they run through the Heavy Job Runner, never on Railway and never locally. Registered as
 * `chunks-scalar-index` in scripts/ops/heavy-job/jobs.ts. Its peak memory is UNMEASURED —
 * `expectedPeakGb` is null there on purpose, and this run is what fills it in.
 *
 * ⚠ NO COMPACTION. `optimize()` is the pathological step in LanceDB v0.30 — it bundles
 * compaction with the index merge and has an independent memory cost that OOM'd the FTS
 * build repeatedly (§17). This script calls `createIndex` only. Do not add a compaction
 * step to "tidy up" afterwards.
 *
 * ⚠ THIS INDEX WILL NEED REBUILDING IF THE MAX_CHUNKS TOP-UP HAPPENS. That top-up appends
 * 2.7–4.8 M rows to corpus_chunks (V32_COMMITTEES_AUDIT.md §4 addendum), and per
 * INGEST_PLAYBOOK.md §20 an append leaves new rows outside the index. Accepted
 * deliberately: the index fixes 76% of query latency now, and any load test run without it
 * measures an unindexed scan rather than the system.
 *
 * ⚠ RESTART THE SERVE AFTER THIS. vector-query-service.ts calls openTable() once at boot
 * with no readConsistencyInterval, so it holds a fixed snapshot and will keep scanning
 * until restarted:  npx tsx search/vector-serve-run.ts restart
 *
 * Usage:
 *   npx tsx search/build-chunks-scalar-index.ts --verify-only   # metadata read, costs nothing
 *   npx tsx search/build-chunks-scalar-index.ts                 # build
 */
// ⚠ MUST be set BEFORE the native module is loaded — Lance reads it when it builds its
// DataFusion runtime, so a later assignment is ignored. This is why it is here and not in
// jobs.ts's command string alone.
//
// THE FIRST RUN FAILED HERE, AND NOT FOR THE REASON §17 TRAINS YOU TO EXPECT:
//   LanceError(IO): Resources exhausted: Failed to allocate additional 325.5 KB for
//   ExternalSorterMerge[0] … 138.4 KB remain available for the total pool
// on a 32 GB box whose PEAK RSS WAS 42 MB. That is not machine memory — it is DataFusion's
// internal memory pool, which Lance sizes conservatively by default. A bigger server would
// have failed in exactly the same way at exactly the same point, which is the trap worth
// recording: "resources exhausted" during an index build reads like the OOM §17 is about,
// and here it was a configuration knob costing €0.005 to discover instead of a hardware bill.
// Sized at 8 GiB: the sort is over 21.8M sectionId strings (~1.5 GB of key+rowid data),
// and a sort typically wants 2-3x its input. Well inside the 32 GB box.
process.env.LANCE_MEM_POOL_SIZE ??= String(8 * 1024 * 1024 * 1024)

import { connectLance, lancedb } from './lance'
import { CHUNKS_TABLE } from './vector-common'

export {}

const VERIFY_ONLY = process.argv.includes('--verify-only')
const COLUMN = process.env.CHUNKS_INDEX_COLUMN ?? 'sectionId'

let peakRss = 0
function sampleMem() { peakRss = Math.max(peakRss, process.memoryUsage().rss) }
const gb = (b: number) => (b / 1024 / 1024 / 1024).toFixed(2)

async function listIndices(tbl: lancedb.Table) {
  try { return await tbl.listIndices() } catch { return [] }
}

async function main() {
  const t0 = Date.now()
  const timer = setInterval(sampleMem, 2_000)
  timer.unref()

  console.log(`[chunks-index] opening ${CHUNKS_TABLE}…`)
  const conn = await connectLance()
  const tbl = await conn.openTable(CHUNKS_TABLE)
  const rows = await tbl.countRows()
  const before = await listIndices(tbl)
  console.log(`[chunks-index] rows=${rows.toLocaleString()}`)
  console.log(`[chunks-index] existing indices: ${before.length ? before.map((i: any) => `${i.name} on [${(i.columns ?? []).join(',')}]`).join(', ') : 'NONE'}`)

  const already = before.some((i: any) => (i.columns ?? []).includes(COLUMN))

  if (VERIFY_ONLY) {
    // §17: "check whether the job is already done before running it" — a metadata read
    // that costs nothing, and is how a duplicate FTS rebuild was avoided on 4 Aug.
    console.log(already
      ? `[chunks-index] VERIFY: an index on "${COLUMN}" EXISTS. Nothing to do.`
      : `[chunks-index] VERIFY: NO index on "${COLUMN}". The build is still required.`)
    process.exit(already ? 0 : 3)
  }

  if (already) {
    console.log(`[chunks-index] an index on "${COLUMN}" already exists — refusing to rebuild it blindly.`)
    console.log('[chunks-index] pass CHUNKS_INDEX_REPLACE=true to replace it deliberately.')
    if (process.env.CHUNKS_INDEX_REPLACE !== 'true') { clearInterval(timer); return }
  }

  console.log(`[chunks-index] building BTREE scalar index on "${COLUMN}" (no compaction)…`)
  sampleMem()
  await tbl.createIndex(COLUMN, {
    config: lancedb.Index.btree(),
    replace: true,
  })
  sampleMem()

  const after = await listIndices(tbl)
  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`[chunks-index] DONE in ${secs}s`)
  console.log(`[chunks-index] indices now: ${after.map((i: any) => `${i.name} on [${(i.columns ?? []).join(',')}]`).join(', ')}`)
  // The number jobs.ts wants: peak RSS, observed, so expectedPeakGb stops being a guess.
  console.log(`[chunks-index] PEAK RSS: ${gb(peakRss)} GB  (record this as expectedPeakGb in scripts/ops/heavy-job/jobs.ts)`)

  const ok = after.some((i: any) => (i.columns ?? []).includes(COLUMN))
  if (!ok) { console.error('[chunks-index] FAILED — no index on the column after the build.'); process.exit(1) }
  console.log('[chunks-index] ⚠ NOW RESTART THE SERVE: npx tsx search/vector-serve-run.ts restart')
  clearInterval(timer)
}

main().catch((e) => { console.error('[chunks-index] FATAL', e); process.exit(1) })
