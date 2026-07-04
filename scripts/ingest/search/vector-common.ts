/**
 * vector-common.ts — side-effect-free shared constants for the FULL-CORPUS vector
 * layer (the production embed, distinct from the throwaway pilot in pilot-*.ts).
 *
 * Kept free of top-level side effects (no main()) so any script can import a table
 * name without triggering a build — same discipline as pilot-common.ts.
 *
 * DECISION (docs/PILOT_REPORT.md): model = gemini-embedding-001; dims = 768 (Matryoshka
 * `outputDimensionality`) — the 768-d gold-set check showed no measured recall loss vs
 * 1536-d, at half the storage (768×4 B = 3,072 B/vector; 22.25 M chunks ≈ 68 GB, vs
 * ~137 GB at 1536-d). Embedded via the Gemini Batch API (asyncBatchEmbedContent) for the
 * 50 % discount ($0.075 vs $0.15 / 1 M tokens) — this is non-real-time indexing work.
 */

// ── model / embedding config ────────────────────────────────────────────────
export const VECTOR_MODEL = process.env.VECTOR_MODEL ?? 'gemini-embedding-001'
export const VECTOR_DIMS = parseInt(process.env.VECTOR_DIMS ?? '768', 10)
// Asymmetric retrieval pair — documents and queries get different task types so the
// model places a lay-vocabulary query near the formal-language passage that answers it.
export const TASK_DOCUMENT = 'RETRIEVAL_DOCUMENT'
export const TASK_QUERY = 'RETRIEVAL_QUERY'

// ── Lance tables (on R2, under s3://{bucket}/_search) ────────────────────────
// Chunk manifest (chunkId + body + section metadata) — the embed step's input, and
// reusable for hybrid/rerank later without re-reading 17.6 M bodies from R2.
export const CHUNKS_TABLE = process.env.VECTOR_CHUNKS_TABLE ?? 'corpus_chunks'
// The vectors themselves (chunkId → 768-d embedding + section metadata for collapse).
export const VEC_TABLE = process.env.VECTOR_VEC_TABLE ?? 'corpus_vec'

// ── R2 checkpoints (resumable, mirror build-fts-index.ts) ────────────────────
export const CHUNKS_CHECKPOINT_KEY = `_search/${CHUNKS_TABLE}.checkpoint.json`
export const VEC_CHECKPOINT_KEY = `_search/${VEC_TABLE}.checkpoint.json`

// ── Batch API sharding (Gemini limits, verified 2026-07: ≤50k requests/job,
// ≤2 GB input file, 20 GB Files storage, 100 concurrent jobs, per-tier enqueued-token
// quota). SHARD_SIZE stays under the 50k/job hard cap; MAX_INFLIGHT_SHARDS keeps the
// enqueued-token footprint and Files-storage footprint bounded (input files are deleted
// as each shard completes, so storage never approaches the 20 GB cap). ──────────
export const SHARD_SIZE = parseInt(process.env.VECTOR_SHARD_SIZE ?? '40000', 10)     // < 50k hard cap, headroom
export const MAX_INFLIGHT_SHARDS = parseInt(process.env.VECTOR_MAX_INFLIGHT ?? '8', 10)

export function chunkId(sectionId: string, k: number): string { return `${sectionId}#${k}` }
