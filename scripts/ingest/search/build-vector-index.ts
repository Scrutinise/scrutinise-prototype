/**
 * build-vector-index.ts — STEP 2 of the full-corpus vector layer (INERT until
 * triggered on the Hetzner build box; the spend is the Batch API embed). Reads the
 * `corpus_chunks` manifest (build-corpus-chunks.ts), embeds every chunk with
 * gemini-embedding-001 @768-d via the Gemini Batch API (50% discount), writes the
 * vectors to the `corpus_vec` Lance table on R2, then builds an ANN index on top.
 *
 * This is the script hetzner-build-run.ts's placeholder referenced:
 *   HETZNER_BUILD_CMD="R2_MAX_SOCKETS=256 npx tsx search/build-vector-index.ts"
 *
 * ── SHARDING (Gemini Batch limits: ≤50k requests/job, ≤2GB file, 20GB storage,
 * per-tier enqueued-token quota) ──────────────────────────────────────────────
 * The canonical order is corpus_chunks sorted by chunkId. We slice it into
 * contiguous chunkId ranges of SHARD_SIZE (< 50k). Up to MAX_INFLIGHT_SHARDS run
 * concurrently (server-side batch jobs; the enqueued-token footprint ≈
 * MAX_INFLIGHT × SHARD_SIZE × ~310 tok — keep it under the account's quota via env).
 * Input files are deleted as each shard completes, so Files storage stays bounded.
 *
 * ── RESUMABLE + IDEMPOTENT ────────────────────────────────────────────────────
 * Checkpoint (`_search/corpus_vec.checkpoint.json`) holds the set of DONE shard
 * indices + counters. Shard boundaries are DETERMINISTIC from the sorted chunkId
 * list (corpus_chunks is immutable post-build), so shard i is always the same range
 * across runs. Before appending a shard we DELETE any vectors already in its chunkId
 * range → a redo after a crash-between-append-and-checkpoint can never duplicate.
 *
 * Usage (Hetzner, or locally with creds + @google/genai):
 *   npx tsx search/build-vector-index.ts             # full / resume
 *   npx tsx search/build-vector-index.ts --canary    # ONE small shard end-to-end to a throwaway table (validate the live batch shape) — no ANN
 *   npx tsx search/build-vector-index.ts --limit N   # first N shards only
 *   npx tsx search/build-vector-index.ts --index-only # skip embed, (re)build the ANN index
 *   npx tsx search/build-vector-index.ts --reset      # drop corpus_vec, fresh checkpoint, then full
 * Env: VECTOR_SHARD_SIZE(40000) VECTOR_MAX_INFLIGHT(8) VECTOR_SHARD_RETRIES(3)
 *      VECTOR_ANN_PARTITIONS(4096) VECTOR_ANN_SUBVECTORS(96) VECTOR_CANARY_N(200)
 */
import { Schema, Field, Utf8, Float32, FixedSizeList } from 'apache-arrow'
import { connectLance, lanceDbUri, lancedb } from './lance'
import { CHUNKS_TABLE, VEC_TABLE, VEC_CHECKPOINT_KEY, VECTOR_DIMS, VECTOR_MODEL, SHARD_SIZE, MAX_INFLIGHT_SHARDS } from './vector-common'
import { embedShardViaBatch, ChunkForEmbed } from './gemini-batch'
import { r2Get, r2Put } from '../shared/r2-client'

const RESET = process.argv.includes('--reset')
const CANARY = process.argv.includes('--canary')
const INDEX_ONLY = process.argv.includes('--index-only')
const LIMIT = (() => { const i = process.argv.indexOf('--limit'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : Infinity })()
const RETRIES = parseInt(process.env.VECTOR_SHARD_RETRIES ?? '3', 10)
const CANARY_N = parseInt(process.env.VECTOR_CANARY_N ?? '200', 10)
const ANN_PARTITIONS = parseInt(process.env.VECTOR_ANN_PARTITIONS ?? '4096', 10)
const ANN_SUBVECTORS = parseInt(process.env.VECTOR_ANN_SUBVECTORS ?? '96', 10) // must divide VECTOR_DIMS (768/96 = 8 dims/subvec)

const vecTableName = CANARY ? `${VEC_TABLE}_canary` : VEC_TABLE
const checkpointKey = CANARY ? `_search/${vecTableName}.checkpoint.json` : VEC_CHECKPOINT_KEY

function vecSchema(): Schema {
  return new Schema([
    new Field('chunkId', new Utf8(), false),
    new Field('sectionId', new Utf8(), false),
    new Field('corpus', new Utf8(), false),
    new Field('tier', new Utf8(), false),
    new Field('vector', new FixedSizeList(VECTOR_DIMS, new Field('item', new Float32(), true)), false),
  ])
}

type Checkpoint = { phase: 'embedding' | 'indexing' | 'done'; doneShards: number[]; vectors: number; misses: number; updatedAt: string }
const FRESH: Checkpoint = { phase: 'embedding', doneShards: [], vectors: 0, misses: 0, updatedAt: '' }

async function loadCp(): Promise<Checkpoint> {
  if (RESET) return { ...FRESH }
  const raw = await r2Get(checkpointKey)
  if (!raw) return { ...FRESH }
  try { return { ...FRESH, ...JSON.parse(raw) } } catch { return { ...FRESH } }
}
async function saveCp(cp: Checkpoint) { cp.updatedAt = new Date().toISOString(); await r2Put(checkpointKey, JSON.stringify(cp), 'application/json') }

const esc = (s: string) => s.replace(/'/g, "''")

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastErr: any
  for (let i = 0; i < RETRIES; i++) {
    try { return await fn() } catch (e) {
      lastErr = e
      const wait = Math.min(60_000, 5000 * 2 ** i)
      console.warn(`[vec-index] ${label} attempt ${i + 1}/${RETRIES} failed: ${(e as Error).message} — retrying in ${wait / 1000}s`)
      await new Promise((r) => setTimeout(r, wait))
    }
  }
  throw lastErr
}

async function main() {
  console.log(`[vec-index] dataset=${lanceDbUri()}/${vecTableName} model=${VECTOR_MODEL} dims=${VECTOR_DIMS} shard=${SHARD_SIZE} inflight=${MAX_INFLIGHT_SHARDS}` + (CANARY ? ` CANARY(n=${CANARY_N})` : '') + (RESET ? ' RESET' : ''))
  const conn = await connectLance()
  const chunksTbl = await conn.openTable(CHUNKS_TABLE)

  if (RESET) { try { await conn.dropTable(vecTableName) } catch { /* absent */ } }
  const vecTbl = await conn.createEmptyTable(vecTableName, vecSchema(), { mode: 'create', existOk: true })

  const cp = await loadCp()
  console.log(`[vec-index] checkpoint: phase=${cp.phase} doneShards=${cp.doneShards.length} vectors=${cp.vectors} misses=${cp.misses}`)

  // ── build the canonical shard plan from the sorted chunkId list ──────────────
  // chunkId-only scan (bodies excluded) — ~22M × ~40B ≈ <1GB, sortable on the 64GB box.
  if (cp.phase === 'embedding' && !INDEX_ONLY) {
    console.log('[vec-index] loading chunkId list for the shard plan…')
    const idRows = await chunksTbl.query().select(['chunkId']).limit(1_000_000_000).toArray() as any[]
    const ids: string[] = idRows.map((r) => r.chunkId as string).sort()
    const plannedIds = CANARY ? ids.slice(0, CANARY_N) : ids
    const shards: Array<{ i: number; lo: string; hi: string; n: number }> = []
    for (let i = 0, s = 0; i < plannedIds.length; i += SHARD_SIZE, s++) {
      const slice = plannedIds.slice(i, i + SHARD_SIZE)
      shards.push({ i: s, lo: slice[0], hi: slice[slice.length - 1], n: slice.length })
    }
    const totalShards = shards.length
    const done = new Set(cp.doneShards)
    const todo = shards.filter((s) => !done.has(s.i)).slice(0, Number.isFinite(LIMIT) ? LIMIT : undefined)
    console.log(`[vec-index] ${plannedIds.length} chunks → ${totalShards} shards; ${done.size} done, ${todo.length} to embed this run`)

    // single-writer mutex so concurrent shard tasks serialise their Lance append + checkpoint
    let writeChain: Promise<void> = Promise.resolve()
    const failed: number[] = []
    let firstCanaryLogged = false

    async function processShard(s: { i: number; lo: string; hi: string; n: number }) {
      const tag = `shard-${String(s.i).padStart(6, '0')}`
      // fetch this shard's chunks by contiguous chunkId range (immutable table → stable)
      const rows = await chunksTbl.query()
        .where(`chunkId >= '${esc(s.lo)}' AND chunkId <= '${esc(s.hi)}'`)
        .select(['chunkId', 'sectionId', 'corpus', 'tier', 'body']).limit(SHARD_SIZE * 2).toArray() as any[]
      rows.sort((a, b) => (a.chunkId < b.chunkId ? -1 : a.chunkId > b.chunkId ? 1 : 0))
      const chunks: ChunkForEmbed[] = rows.map((r) => ({ chunkId: r.chunkId, body: r.body }))

      const vecs = await withRetry(tag, () => embedShardViaBatch(chunks, tag))

      if (CANARY && !firstCanaryLogged) {
        firstCanaryLogged = true
        const okDims = vecs.find((v) => v)?.length
        console.log(`[vec-index] CANARY first-vector dims=${okDims} (expected ${VECTOR_DIMS}); non-null ${vecs.filter(Boolean).length}/${vecs.length}`)
      }

      const records: any[] = []
      let miss = 0
      rows.forEach((r, k) => { const v = vecs[k]; if (v && v.length === VECTOR_DIMS) records.push({ chunkId: r.chunkId, sectionId: r.sectionId, corpus: r.corpus, tier: r.tier, vector: v }); else miss++ })

      // serialise the write + checkpoint
      writeChain = writeChain.then(async () => {
        await vecTbl.delete(`chunkId >= '${esc(s.lo)}' AND chunkId <= '${esc(s.hi)}'`) // idempotent redo
        if (records.length) await vecTbl.add(records)
        cp.doneShards.push(s.i)
        cp.vectors += records.length
        cp.misses += miss
        await saveCp(cp)
        console.log(`[vec-index] ${tag} done (${records.length} vec, ${miss} miss) | total ${cp.vectors} vec, ${cp.doneShards.length}/${totalShards} shards`)
      })
      await writeChain
    }

    // bounded in-flight pool
    let next = 0
    async function worker() {
      while (true) {
        const idx = next++
        if (idx >= todo.length) return
        try { await processShard(todo[idx]) }
        catch (e) { failed.push(todo[idx].i); console.error(`[vec-index] ${todo[idx].i} FAILED after ${RETRIES} retries: ${(e as Error).message}`) }
      }
    }
    await Promise.all(Array.from({ length: Math.min(MAX_INFLIGHT_SHARDS, Math.max(todo.length, 1)) }, worker))
    await writeChain

    if (CANARY) { console.log(`[vec-index] CANARY complete — ${cp.vectors} vectors in ${vecTableName}. Inspect, then run the full build. (ANN skipped.)`); return }
    if (failed.length) { console.error(`[vec-index] ${failed.length} shard(s) FAILED: ${failed.join(',')} — re-run to retry (resumable).`); process.exit(1) }
    if (cp.doneShards.length < totalShards) { console.log(`[vec-index] --limit stop: ${cp.doneShards.length}/${totalShards} shards done. Re-run to continue.`); return }

    cp.phase = 'indexing'
    await saveCp(cp)
  }

  // ── ANN index ────────────────────────────────────────────────────────────────
  if (cp.phase === 'indexing' || INDEX_ONLY) {
    console.log(`[vec-index] compacting corpus_vec before indexing…`)
    try { const st = await vecTbl.optimize(); console.log('[vec-index] optimize:', JSON.stringify(st?.compaction ?? st)) } catch (e) { console.warn('[vec-index] optimize warning:', (e as Error).message) }
    const rows = await vecTbl.countRows()
    console.log(`[vec-index] building IVF_PQ ANN index on \`vector\` (rows=${rows}, partitions=${ANN_PARTITIONS}, subvectors=${ANN_SUBVECTORS}, cosine)…`)
    const t0 = Date.now()
    await vecTbl.createIndex('vector', {
      config: lancedb.Index.ivfPq({ numPartitions: ANN_PARTITIONS, numSubVectors: ANN_SUBVECTORS, distanceType: 'cosine' }),
    })
    console.log(`[vec-index] ANN index built in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
    cp.phase = 'done'
    await saveCp(cp)
  }

  console.log(`[vec-index] DONE. corpus_vec rows=${await vecTbl.countRows()} (vectors=${cp.vectors}, misses=${cp.misses})`)
}

main().catch((e) => { console.error('[vec-index] FATAL', e); process.exit(1) })
