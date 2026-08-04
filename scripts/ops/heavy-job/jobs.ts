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
    expectedPeakGb: 19.8,
    peakSource: '4 Aug 2026 run, cpx62 (32 GB), 17.7M rows, 499s — see docs/HEAVY_JOBS.md',
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
}

export function getJob(name: string): HeavyJob {
  const job = JOBS[name]
  if (!job) {
    throw new Error(`unknown job "${name}" — known jobs: ${Object.keys(JOBS).join(', ')}`)
  }
  return job
}
