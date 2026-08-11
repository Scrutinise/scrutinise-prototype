/**
 * jobs.ts — the registry of named heavy jobs.
 *
 * A "heavy job" is anything that OOMs on Railway: single-process, memory-bound, run
 * rarely. Adding one is an entry here, not a new script — that is the whole point of
 * the runner (docs/HEAVY_JOBS.md).
 *
 * `expectedPeakGb` is OBSERVED, not guessed. Fill it in from the run's own report so
 * the next size decision is evidence-based; leave it null until something is measured.
 */

export interface HeavyJob {
  name: string
  description: string
  /** Run from /root/repo/scripts/ingest on the box. */
  command: string
  /** A cheap follow-up that proves the job did what it claimed. Optional. */
  verify?: string
  /**
   * Server types in PREFERENCE ORDER. The runner walks the list and takes the first
   * the account can actually create — Hetzner enforces a per-account dedicated-core
   * quota, so a ccx43 (16 dedicated cores) can be refused outright with
   * `resource_limit_exceeded`. That is not hypothetical: it blocked the CCX43 fallback
   * during the vector rebuild too (CHANGE_LOG 2026-07-21). Shared-vCPU types (cx/cpx)
   * do not draw on that quota and are far cheaper. x86 only — the Lance native
   * bindings are not exercised on ARM (cax*), so it is not worth discovering that here.
   */
  serverTypes?: string[]
  /**
   * Credentials this job needs BEYOND the runner's standard set (Neon + R2). Per-job rather than
   * added to the shared list, so a key one job wants cannot become a boot requirement for the
   * four that do not want it. Named here, resolved from scrutinise-web/.env, and missing → refuse
   * before spending anything.
   */
  extraEnv?: string[]
  /** Highest RSS actually observed, in GB — evidence for the size choice. */
  expectedPeakGb: number | null
  /** Where the job's peak was measured, so the number can be re-checked. */
  peakSource?: string
}

export const JOBS: Record<string, HeavyJob> = {
  'fts-index': {
    name: 'fts-index',
    description:
      'Rebuild the corpus_fts inverted index over the existing fragments (no compaction). ' +
      'Absorbs rows appended by fts-catchup, which are otherwise brute-force scanned on every query.',
    // NEVER add --compact: optimize() is the pathological step (v0.30 memory bug), and
    // skipping it is the standing workaround shared with the vector build.
    command: 'R2_MAX_SOCKETS=256 npx tsx search/fts-optimize.ts',
    verify: 'npx tsx search/fts-optimize.ts --verify-only',
    // 32 GB shared is ample: June's equivalent build fitted in 24 GB, and the observed
    // climb was still under 7 GB. ccx43 stays last as the big-hammer fallback.
    // cpx62 (32 GB shared) first: ample headroom over the >6.1 GB observed and June's
    // 24 GB precedent, no dedicated-core quota, EU stock. ccx43 is the hammer if not.
    serverTypes: ['cpx62', 'cpx52', 'ccx43'],
    // Railway SIGKILLed this at 6.1 GB against an 8 GB cap while still climbing, so the
    // true peak is above 6.1 and unknown; June's equivalent fitted in 24 GB.
    // MEASURED on the 4 Aug run at 17,700,396 rows: 19.8 GB peak RSS. This retires the
    // guesswork — Railway Hobby's 8 GB cap could never have run it at any setting, and
    // June's 24 GB success was closer to the edge than anyone realised. 32 GB is the
    // right size; do not drop below it as the corpus grows.
    // Two runs now agree, which is what makes 32 GB the settled answer rather than one
    // lucky measurement. Keep the HIGHER of the two: the 5 Aug run was on a slightly
    // smaller table (19,161 rows removed by fts-hygiene), so its lower peak reflects less
    // data, not more headroom. Sizing down on it would be reading noise as a trend.
    // THIRD measurement, 9 Aug 2026 (V32 §2 merge): 18.0 GB peak on a LARGER table
    // (17,978,744 rows, 533s, €0.053). Deliberately NOT lowering the number — the same rule
    // applies in reverse: one run below the record on more data is noise, not headroom, and
    // 32 GB stays the right size. Three runs now bracket 18.0-19.8 GB.
    // FOURTH measurement, 9 Aug 2026 (V33 §1 re-sectioning merge): 19.3 GB peak on 18,166,926
    // rows — the largest table yet — in 552s for €0.053, query 5,573ms → 1,508ms, unindexed 0.
    // Still not lowered: four runs now sit in 18.0-19.8 GB and the trend against row count is
    // flat, which is the case for keeping the record rather than the mean.
    expectedPeakGb: 19.8,
    peakSource:
      '4 Aug 2026, cpx62 (32 GB), 17,700,396 rows, 499s → 19.8 GB peak. ' +
      'Confirmed 5 Aug 2026, cpx62, 17,681,503 rows (post index-hygiene), 509s → 19.4 GB peak, €0.049.',
  },
  'chunks-scalar-index': {
    name: 'chunks-scalar-index',
    description:
      'Build the BTREE scalar index on corpus_chunks.sectionId (21.8M rows, currently NO index). ' +
      'Snippet hydration does `where("sectionId IN (…)")` on every vector query; unindexed that is a ' +
      'full scan, measured at 76% of total query latency vs 21% for the ANN search itself.',
    // createIndex ONLY. optimize() is the pathological v0.30 step that OOM'd the FTS build
    // repeatedly (§17) — do not add a compaction step here.
    command: 'R2_MAX_SOCKETS=256 npx tsx search/build-chunks-scalar-index.ts',
    verify: 'npx tsx search/build-chunks-scalar-index.ts --verify-only',
    // Same shape as fts-index: shared-vCPU first (no dedicated-core quota, EU stock,
    // far cheaper), ccx43 as the big hammer. A scalar BTREE over one string column
    // should be much lighter than the 19.8 GB inverted-index build — but "should be" is
    // exactly the reasoning §17 exists to stop, so size generously until measured.
    serverTypes: ['cpx62', 'cpx52', 'ccx43'],
    // MEASURED on the 7 Aug run: 1.72 GB peak at 21,839,900 rows, 39.1s, €0.010.
    // ⚠ Honest note for whoever sizes this next: at 1.72 GB this one would have fitted on
    // Railway's 8 GB cap. It is kept here anyway — the run cost a penny, the peak was not
    // knowable in advance (§17's whole point), and the first attempt DID fail, just not for
    // a memory reason. cpx62 is over-sized for it; cpx52 would do, and the list already
    // falls through to it.
    expectedPeakGb: 1.72,
    peakSource:
      '7 Aug 2026, cpx62 (32 GB), 21,839,900 rows, 39.1s → 1.72 GB peak, €0.010. ' +
      'First attempt failed at 42 MB RSS with a DataFusion ExternalSorterMerge pool exhaustion ' +
      '("138.4 KB remain available for the total pool") — fixed with LANCE_MEM_POOL_SIZE=8GiB, ' +
      'NOT with a bigger box. A size increase would have failed identically.',
  },
  'vector-index': {
    name: 'vector-index',
    description:
      'Full-corpus chunk manifest + batch embed + ANN index build (docs/VECTOR_EMBED_REPORT.md). ' +
      'The original 64 GB Hetzner job this runner is descended from.',
    command: 'R2_MAX_SOCKETS=256 npx tsx search/build-corpus-chunks.ts && npx tsx search/build-vector-index.ts',
    // The vector build genuinely needed 64 GB; keep the dedicated box first here.
    serverTypes: ['ccx43', 'ccx53', 'cpx51'],
    expectedPeakGb: 32,
    peakSource: 'CHANGE_LOG 2026-07-21: OOM at fragment compaction on a 32 GB box; completed with VECTOR_SKIP_COMPACT',
  },
  'vector-reindex': {
    name: 'vector-reindex',
    description:
      'Rebuild ONLY the IVF_PQ ANN index on corpus_vec, absorbing vectors appended by ' +
      'v33-vec-catchup.ts. The vector twin of `fts-index`: without it every query brute-force ' +
      'scans the new fragments forever (INGEST_PLAYBOOK §20).',
    // ⚠ WHY THIS EXISTS RATHER THAN RE-RUNNING `vector-index`. Both of that job's scripts are
    // checkpointed `phase: "done"` from the 21–22 Jul build, so it would print "already done —
    // nothing to do" and "DONE", create nothing, and destroy the box — a job that reports
    // success while doing NOTHING. `--index-only` is the flag that enters the ANN block
    // regardless of phase. (docs/CLAUDE.md §18's family: a failure wearing the face of a
    // success.)
    // VECTOR_SKIP_COMPACT is not optional here: optimize() SIGKILLed twice at 32 GB on 21 Jul
    // before createIndex() was ever reached, and compaction is a read-efficiency step, not a
    // correctness requirement — §17's standing workaround, shared with the FTS build.
    // ⚠ VECTOR_SHARD_SIZE=12000 is REQUIRED even though --index-only processes no shards.
    // build-vector-index.ts asserts `cp.shardSize === SHARD_SIZE` at the top of main(), BEFORE it
    // branches on --index-only, so the env default of 40000 against the 21 Jul checkpoint's 12000
    // aborts a run that was never going to touch a shard. Measured 11 Aug 2026: the job died in
    // 84 seconds on exactly this.
    // ⚠ AND: the runner executes the GitHub clone, not the local working tree. Any script named
    // here — command or verify — must be COMMITTED AND PUSHED first. The same run lost its verify
    // step to `Cannot find module .../verify-vector-index.ts` because that file was still local.
    command: 'VECTOR_SHARD_SIZE=12000 VECTOR_SKIP_COMPACT=true R2_MAX_SOCKETS=256 npx tsx search/build-vector-index.ts --index-only',
    // ⚠ NOT `check-vector-serving.ts`, which this job originally named: that is a pure-logic unit
    // check with no Lance and no network, so it passes in a second whether or not an index was
    // built. A verify that cannot fail for the reason the job exists is a second success message,
    // not a check — the same shape as the no-op `vector-index` run this job replaced.
    // `verify-vector-index.ts` reads the index stats and fails on a missing index or any
    // unindexed row.
    verify: 'npx tsx search/verify-vector-index.ts',
    // ⚠ SHARED vCPU FIRST, and this is a correction. This job first inherited `vector-index`'s
    // ['ccx43','ccx53','cpx51'] and every dedicated placement was REFUSED — ccx43@nbg1,
    // ccx43@hel1, ccx53@nbg1, ccx53@hel1 — on 11 Aug 2026. That is the per-account dedicated-core
    // quota this file already warns about, and it is the second time it has blocked a vector
    // rebuild (CHANGE_LOG 2026-07-21).
    //
    // 32 GB shared is the EVIDENCED size, not a hopeful downgrade. The parent job's own peakSource
    // records the 21 Jul failure as "OOM at fragment COMPACTION on a 32 GB box; completed with
    // VECTOR_SKIP_COMPACT" — i.e. the 64 GB requirement belonged to the compaction step, and this
    // job sets VECTOR_SKIP_COMPACT=true, so it is not doing that step. cpx62 is also less than
    // half the price (€0.2942/h vs €0.6259/h) and draws no dedicated-core quota. Same list
    // `fts-index` uses, which has succeeded four times.
    serverTypes: ['cpx62', 'cpx52', 'ccx43'],
    // MEASURED 11 Aug 2026, first successful run: **5.6 GB peak** at 22,518,608 rows, 29.5 min,
    // €0.145 — against the 32 GB inherited from the parent. The gap is the whole point of §17's
    // "size from evidence": compaction, not the ANN build, was what needed 64 GB.
    // ⚠ Deliberately NOT dropped to ~8 GB on one run. `chunks-scalar-index` sets the precedent —
    // it measured 1.72 GB and stayed on a 32 GB box, because the peak was not knowable in advance
    // and the run costs pennies. Record the measurement, keep the headroom; revisit after a
    // second run agrees, and remember the table only grows.
    // ⚠ And 5.6 GB does NOT mean "this could go back on Railway". It would fit the 8 GB
    // per-replica cap today, but the margin is one corpus growth spurt wide, and the runner is
    // the standard home for this class of work.
    expectedPeakGb: 5.6,
    peakSource: '11 Aug 2026, cpx62 (32 GB shared), 22,518,608 rows, 29.5 min → 5.6 GB peak, €0.145, unindexed 0. Two earlier attempts the same night cost €0.007 and never reached the build: all dedicated placements refused (quota), then the shard-size assertion aborted it in 84s.',
  },
  'vector-gold-reconfirm': {
    name: 'vector-gold-reconfirm',
    description:
      'Score the gold set against the REAL corpus_fts + corpus_vec indexes at a given VECTOR_NPROBES, ' +
      'and print the per-archetype recall so an nprobes A/B has a recall half as well as a latency half ' +
      '(BRIEF_SEARCH_S2C5 §1). Run twice — VECTOR_NPROBES=24 then 64 — and compare the printed tables.',
    // NPROBES comes from the environment so the same registered job measures both rungs; nothing about
    // the harness changes between runs, which is what makes the comparison a single-variable one.
    command: `R2_MAX_SOCKETS=256 LANCE_INCLUDE_VECTOR_CENTROIDS=false VECTOR_NPROBES=${process.env.GOLD_NPROBES ?? '24'} npx tsx search/score-vector-full.ts`,
    // ⚠ No verify step. The job's product is a printed table, and the only honest check on it is a
    // human reading two runs side by side. A verify that re-ran the same script would just be a second
    // opinion from the same source — the shape of check this project has already been bitten by.
    serverTypes: ['cpx42', 'cpx52', 'cpx32'],
    extraEnv: ['GEMINI_API_KEY'], // every gold query is embedded live, RETRIEVAL_QUERY
    // Same class of work as ann-recall-check (Lance reads from R2, one process), and that measured
    // 7.6 GB at 4,096 probes. This runs at 24-64 probes over ~36 queries plus a BM25 arm, so it should
    // sit well below that — but "should" is what §17 exists to stop, so the size is unchanged and the
    // number will be filled in from the run's own report.
    expectedPeakGb: 3.0,
    peakSource: '12 Aug 2026, cpx42, two runs: nprobes=24 → 5.1 min / 2.5 GB / EUR 0.013; nprobes=64 → 6.4 min / 3.0 GB / EUR 0.017. Higher rung = more probed partitions held, so the peak tracks nprobes.',
  },
  'ann-recall-check': {
    name: 'ann-recall-check',
    description:
      'Measure what the IVF_PQ ANN index actually retrieves: top-20 overlap between production ' +
      'nprobes=24 and an exhaustive 4,096-partition probe, over the gold + ordering query sets ' +
      '(BRIEF_SEARCH_S2C4 §1). Settles whether dense recall is degraded BEFORE the ordering ' +
      'baseline is read, so a clustering parameter cannot be mistaken for a reranker case.',
    // ⚠ NOT under scripts/ingest/search/. That path is the WATCH PATTERN on both fts-serve and
    // vector-serve (read from the Railway API, 11 Aug 2026), so a push there auto-redeploys and
    // restarts the two services this sprint is trying to measure. A probe must not move its own
    // subject: this file sits one directory up for exactly that reason.
    command: `R2_MAX_SOCKETS=256 LANCE_INCLUDE_VECTOR_CENTROIDS=false npx tsx ann-recall-check.ts --ladder ${process.env.ANN_LADDER ?? '1,24,256,4096'} --exact ${process.env.ANN_EXACT ?? '2'} --live ${process.env.ANN_LIVE ?? '6'}`,
    // The mirror guard, watched failing on 5 planted defects. It asserts the probe still describes
    // the retrieval in vector-core.ts — if that file changes, this job fails instead of quietly
    // measuring a system nobody serves. No Lance, no network: it costs a second.
    verify: 'npx tsx ann-recall-check.ts --self-test',
    // IO-bound, not memory-bound: the work is pulling PQ codes for up to 4,096 partitions out of
    // R2. Shared vCPU is right (no dedicated-core quota — that has now blocked a vector job twice)
    // and 16 GB is chosen for the index cache, not for the job's own allocations.
    // ⚠ cpx42, not cpx41. The CPX line has been RENUMBERED — Hetzner now offers
    // cpx12/22/32/42/52/62 and the odd-numbered names this file's other jobs were written against
    // (cpx41, cpx51, cpx31) no longer exist in fsn1/nbg1/hel1. The runner's availability read
    // caught it and refused before creating anything, which is the behaviour that turned a stale
    // constant into a 10-second correction instead of a failed run.
    serverTypes: ['cpx42', 'cpx52', 'cpx32'],
    extraEnv: ['GEMINI_API_KEY'], // every query has to be embedded before it can be searched
    // MEASURED locally first, which is why this is a box job at all: one query's exhaustive rung
    // took 150s from a home connection (~15 MB/s against ~2.2 GB of PQ codes). 58 queries × 4 rungs
    // would have been three hours here.
    // MEASURED on the box, 11 Aug 2026: 7.1 GB peak at 22,518,608 rows, 37.6 min, €0.099 on a cpx42
    // (16 GB). Higher than the 5.6 GB of `vector-reindex`, which is the right way round — this job
    // holds probed IVF partitions in the index cache for 58 queries at up to 4,096 probes, where the
    // rebuild streams them once. 16 GB is the right size; the 8 GB Railway cap could not run it.
    expectedPeakGb: 7.6,
    peakSource: '11 Aug 2026, cpx42 (8 vCPU shared / 16 GB) in nbg1, 58 queries × 4 rungs, 37.6 then 36.9 min → 7.1 then 7.6 GB peak, €0.099 + €0.097. A third run with the 4,096 rung REMOVED (--ladder 24,64,128,256) took 6.0 min and peaked at 1.8 GB for €0.016 — the exhaustive rung is essentially the whole cost of this job. The run also exposed a log-transport defect that hid its own results — see the runner\'s follow-by-content note.',
  },
}

export function getJob(name: string): HeavyJob {
  const job = JOBS[name]
  if (!job) {
    throw new Error(`unknown job "${name}" — known jobs: ${Object.keys(JOBS).join(', ')}`)
  }
  return job
}
