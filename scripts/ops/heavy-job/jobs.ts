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
    // NOT MEASURED for this exact shape (index-only, no compaction). 32 is carried over from the
    // parent as an upper bound rather than guessed downward; replace it with the first run's own
    // reported peak.
    expectedPeakGb: 32,
    peakSource: 'inherited from `vector-index` (21 Jul 2026), where 32 GB completed once compaction was skipped — NOT yet measured for the index-only path; replace with the first run\'s own report',
  },
}

export function getJob(name: string): HeavyJob {
  const job = JOBS[name]
  if (!job) {
    throw new Error(`unknown job "${name}" — known jobs: ${Object.keys(JOBS).join(', ')}`)
  }
  return job
}
