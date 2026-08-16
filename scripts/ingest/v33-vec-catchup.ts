/**
 * v33-vec-catchup.ts — V33 §2: embed the sections that have no vector, WITHOUT disturbing the
 * 21 Jul build. The vector-side twin of `fts-catchup.ts`.
 *
 * ⚠ WHY THIS EXISTS RATHER THAN "just re-run build-vector-index.ts". That script builds its shard
 * plan by sorting the WHOLE `corpus_chunks` chunkId list and records **DONE SHARD INDICES** in its
 * checkpoint. Its header states the assumption out loud: `corpus_chunks` is immutable post-build.
 * Append 700k chunks and every shard boundary moves, so index 417 no longer means the range it
 * meant when it was marked done — previously embedded ranges would be skipped and new content
 * would go unembedded, silently. A `--reset` would instead re-embed all 21.8M chunks, which at
 * $0.075/M is a four-figure mistake. So the delta gets its own plan, its own checkpoint, and
 * touches neither.
 *
 * (Both existing checkpoints are `phase: "done"`, so a plain re-run of `build-vector-index.ts`
 * skips shard planning entirely and is unaffected by this script's appends. It is `--reset` that
 * is dangerous, and it was dangerous before this script existed.)
 *
 * ── TWO PHASES, EACH SEPARATELY RESUMABLE ───────────────────────────────────
 *  1. CHUNK  — read each delta section's body from R2, apply the SAME archetype-A citation
 *              enrichment `build-corpus-chunks.ts` applies (so a chunk's text is byte-identical
 *              to what BM25 indexes — required for a fair hybrid), run the real `chunkBody`,
 *              append to `corpus_chunks`.
 *  2. EMBED  — shard the NEW chunkIds only, embed through the same transport the main build used
 *              (`gemini-batch.ts`, or `gemini-sync.ts` at 2x), append to `corpus_vec`.
 *
 * IDEMPOTENCE WITHOUT A DELETE STORM. A crash between the Lance append and the checkpoint save is
 * the only way to duplicate. So the checkpoint records ATTEMPTED shards as well as DONE ones, and
 * the pre-delete runs only for a shard that was attempted and not completed. On the happy path
 * there are no deletes at all — which matters, because every LanceDB delete writes a deletion
 * file and 4,000 of them would cost more than the embed.
 *
 * SPEND. Nothing here spends until `--embed` is passed. `--plan` prices the run and stops.
 * `--max-cost N` is a hard ceiling: the run stops cleanly before the shard that would cross it.
 *
 * Usage:
 *   tsx v33-vec-catchup.ts --plan                      # cost + shard plan, no writes, no spend
 *   tsx v33-vec-catchup.ts --chunk                     # phase 1 only (no spend)
 *   tsx v33-vec-catchup.ts --canary                    # phase 1 + ONE small shard embedded
 *   tsx v33-vec-catchup.ts --chunk --embed --max-cost 60
 * Env: VECTOR_EMBED_MODE(batch) VECTOR_SHARD_SIZE(12000) VECTOR_MAX_INFLIGHT(1)
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import fs from 'fs'
import readline from 'readline'
import { Pool } from 'pg'
import { connectLance } from './search/lance'
import { CHUNKS_TABLE, VEC_TABLE, VECTOR_DIMS, VECTOR_MODEL, SHARD_SIZE, MAX_INFLIGHT_SHARDS, EMBED_MODE, chunkId as mkChunkId, estTokens } from './search/vector-common'
import { chunkBody } from './search/chunk'
import { tierFor } from './search/corpus-map'
import { gidFromId, buildCitation, applyCitationToBody } from './search/citation'
import { embedShardViaBatch, ChunkForEmbed } from './search/gemini-batch'
import { embedShardViaSync } from './search/gemini-sync'
import { r2Get, r2Put } from './shared/r2-client'

export {}

const PLAN = process.argv.includes('--plan')
const DO_CHUNK = process.argv.includes('--chunk')
const DO_EMBED = process.argv.includes('--embed')
const CANARY = process.argv.includes('--canary')
const argN = (f: string, d: number) => { const i = process.argv.indexOf(f); return i >= 0 ? parseFloat(process.argv[i + 1]) : d }
const MAX_COST = argN('--max-cost', Infinity)
const CANARY_N = parseInt(process.env.VEC_CATCHUP_CANARY_N ?? '400', 10)
// ⚠ `--run <tag>` IS A SAFETY MECHANISM, NOT A CONVENIENCE (V35, 2026-08-12). The V33 checkpoint
// is `phase: "done"` with 62 `doneShards` recorded as INDICES. A second delta re-uses this script
// against a DIFFERENT work list, which produces a different shard numbering — so shard 7 of the
// V35 delta would be skipped because shard 7 of the V33 delta was done. That is the identical
// failure this script's own header describes for `build-vector-index.ts`, one level down, and it
// would be silent: the run would report success having embedded a subset.
// The tag names the work list AND the checkpoint. Default `v33` = the historical paths.
const RUN = (() => { const i = process.argv.indexOf('--run'); return i >= 0 ? process.argv[i + 1] : 'v33' })()
const WORKLIST = path.join(__dirname, `${RUN}-vec-delta.jsonl`)
const CKPT_KEY = `_search/${RUN}_vec_catchup.checkpoint.json`
const CHUNK_BATCH = parseInt(process.env.VEC_CATCHUP_CHUNK_BATCH ?? '2000', 10)
const R2_CONCURRENCY = parseInt(process.env.FTS_R2_CONCURRENCY ?? '24', 10)
const RATE = parseFloat(process.env.EMBED_RATE_PER_M ?? '0.075')
const RETRIES = parseInt(process.env.VECTOR_SHARD_RETRIES ?? '3', 10)

const n = (v: number) => Number(v).toLocaleString('en-GB')
const esc = (s: string) => s.replace(/'/g, "''")

type Ckpt = {
  phase: 'chunking' | 'embedding' | 'done'
  /** index into the work list of the last section whose chunks are committed */
  chunkCursor: number
  chunksWritten: number
  bodyMisses: number
  doneShards: number[]
  attemptedShards: number[]
  /**
   * ⚠ SET WHEN THE SHARD INDICES IN `doneShards` CAME FROM A `--canary` RUN.
   *
   * A canary plans over `deltaChunkIds.slice(0, 400)`, so its "shard 0" is 400 chunks.
   * A full run plans over all of them, so its shard 0 is SHARD_SIZE (40,000) chunks.
   * Both record the INDEX 0. Without this flag the full run reads `doneShards: [0]`,
   * skips its own 40,000-chunk shard 0 having embedded 400 of them, and prints
   * "2/2 shards done" — a partial embed wearing the face of a completed one, and
   * caused by the safety measure. Measured on the V36 catch-up, 2026-08-15.
   */
  canaryShards?: boolean
  vectors: number
  misses: number
  spentUsd: number
  shardSize: number | null
  updatedAt: string
}
const FRESH: Ckpt = { phase: 'chunking', chunkCursor: 0, chunksWritten: 0, bodyMisses: 0, doneShards: [], attemptedShards: [], vectors: 0, misses: 0, spentUsd: 0, shardSize: null, updatedAt: '' }

async function loadCkpt(): Promise<Ckpt> {
  const raw = await r2Get(CKPT_KEY)
  if (!raw) return { ...FRESH }
  try { return { ...FRESH, ...JSON.parse(raw) } } catch { return { ...FRESH } }
}
async function saveCkpt(c: Ckpt) { c.updatedAt = new Date().toISOString(); await r2Put(CKPT_KEY, JSON.stringify(c, null, 2), 'application/json') }

type Item = { id: string; corpus: string; wordCount: number }

async function readWorkList(): Promise<Item[]> {
  if (!fs.existsSync(WORKLIST)) throw new Error(`work list missing: ${WORKLIST} — run v33-vec-delta.ts --write first`)
  const items: Item[] = []
  const rl = readline.createInterface({ input: fs.createReadStream(WORKLIST), crlfDelay: Infinity })
  for await (const line of rl) { if (line.trim()) items.push(JSON.parse(line)) }
  // Sorted so the shard plan is deterministic across runs regardless of how the list was produced.
  items.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return items
}

async function mapPool<T, R>(items: T[], k: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: Math.min(k, items.length) }, async () => {
    for (;;) { const j = i++; if (j >= items.length) return; out[j] = await fn(items[j], j) }
  }))
  return out
}

/** Act titles for the citation enrichment — from `corpus_acts`, never the legacy LegislationItem. */
async function loadTitleMap(pool: Pool): Promise<Map<string, string>> {
  const { rows } = await pool.query<{ gid: string; title: string }>(
    `SELECT gid, title FROM corpus_acts WHERE gid IS NOT NULL AND title IS NOT NULL`)
  return new Map(rows.map((r) => [r.gid, r.title]))
}

async function main() {
  console.log(`[vec-catchup] run=${RUN} worklist=${path.basename(WORKLIST)} checkpoint=${CKPT_KEY}`)
  console.log(`[vec-catchup] mode=${EMBED_MODE} model=${VECTOR_MODEL} dims=${VECTOR_DIMS} shard=${SHARD_SIZE} inflight=${MAX_INFLIGHT_SHARDS}`)
  const items = await readWorkList()
  console.log(`[vec-catchup] work list: ${n(items.length)} sections with no vector`)

  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 4, statement_timeout: 300_000 })
  const conn = await connectLance()
  const chunksTbl = await conn.openTable(CHUNKS_TABLE)
  const vecTbl = await conn.openTable(VEC_TABLE)
  const cp = await loadCkpt()
  console.log(`[vec-catchup] checkpoint: phase=${cp.phase} chunkCursor=${n(cp.chunkCursor)} chunksWritten=${n(cp.chunksWritten)} doneShards=${cp.doneShards.length} vectors=${n(cp.vectors)} spent=$${cp.spentUsd.toFixed(2)}`)
  if (cp.shardSize && cp.shardSize !== SHARD_SIZE) {
    throw new Error(`checkpoint was planned with VECTOR_SHARD_SIZE=${cp.shardSize}, this run has ${SHARD_SIZE} — shard boundaries must not move mid-run`)
  }

  // ── metadata needed for both phases ─────────────────────────────────────────
  const byId = new Map(items.map((i) => [i.id, i]))
  const ids = items.map((i) => i.id)
  const meta = new Map<string, { sectionTitle: string | null; r2Key: string | null }>()
  for (let i = 0; i < ids.length; i += 5000) {
    const { rows } = await pool.query<{ id: string; sectionTitle: string | null; r2Key: string | null }>(
      `SELECT id, "sectionTitle", "r2Key" FROM corpus_sections WHERE id = ANY($1::text[])`, [ids.slice(i, i + 5000)])
    for (const r of rows) meta.set(r.id, { sectionTitle: r.sectionTitle, r2Key: r.r2Key })
  }
  console.log(`[vec-catchup] metadata resolved for ${n(meta.size)} of ${n(ids.length)} sections`)

  // ── PLAN (prices from the modelled chunk count; the real count lands in phase 1) ─
  if (PLAN) {
    const est = items.reduce((a, i) => a + Math.max(1, Math.min(8, Math.ceil((i.wordCount * 6.15) / 2720))), 0)
    const tok = items.reduce((a, i) => a + estTokens('x'.repeat(Math.round(i.wordCount * 6.15))), 0)
    console.log(`\n  modelled chunks   ${n(est)}`)
    console.log(`  modelled tokens   ${n(tok)}`)
    console.log(`  modelled cost     $${((tok / 1e6) * RATE).toFixed(2)} at $${RATE}/M (batch)`)
    console.log(`  shards            ${Math.ceil(est / SHARD_SIZE)} at ${n(SHARD_SIZE)} chunks each`)
    console.log('\n  --plan only. Nothing written, nothing spent.')
    await pool.end(); return
  }

  // ── PHASE 1: CHUNK ──────────────────────────────────────────────────────────
  if (DO_CHUNK && cp.phase === 'chunking') {
    const titles = await loadTitleMap(pool)
    console.log(`[vec-catchup] phase 1 — chunking from section ${n(cp.chunkCursor)}; act titles: ${n(titles.size)}`)
    const t0 = Date.now()
    while (cp.chunkCursor < items.length) {
      const slice = items.slice(cp.chunkCursor, cp.chunkCursor + CHUNK_BATCH)
      // A crash between append and checkpoint can leave this batch's chunks half-written, so
      // clear them first. Bounded to ONE batch, not the whole run.
      await chunksTbl.delete(`sectionId IN (${slice.map((s) => `'${esc(s.id)}'`).join(',')})`)

      const records: Array<{ chunkId: string; sectionId: string; corpus: string; tier: string; sectionTitle: string; body: string }> = []
      let misses = 0
      await mapPool(slice, R2_CONCURRENCY, async (it) => {
        const m = meta.get(it.id)
        if (!m?.r2Key) { misses++; return }
        const raw = await r2Get(m.r2Key)
        if (!raw) { misses++; return }
        // Same enrichment as build-corpus-chunks.ts, so chunk text matches what BM25 indexes.
        let body = raw
        let title = m.sectionTitle ?? ''
        const gid = gidFromId(it.id)
        const cit = gid ? buildCitation(it.id, titles.get(gid) ?? null, m.sectionTitle) : null
        if (cit) { body = applyCitationToBody(cit.bodyHeader, raw); title = cit.sectionTitle }
        const parts = chunkBody(body)
        parts.forEach((text, k) => records.push({
          chunkId: mkChunkId(it.id, k), sectionId: it.id, corpus: it.corpus,
          tier: tierFor(it.corpus), sectionTitle: title, body: text,
        }))
      })

      // ⚠ RETRIED, because this line killed a 32,113-section run at section 10,000 on 2026-08-12
      // with `Generic S3 error: Error performing PUT … partNumber=2 … in 60ms - HTTP error: error
      // sending request`. That is a transient network fault on an R2 multipart upload, which is
      // exactly the class CLAUDE.md §13 says to retry — and phase 2 already retries its embed
      // calls three times while phase 1 had no retry at all, so a blip here cost the whole phase.
      // Safe to repeat: the batch's chunks were deleted immediately above, so a partial append
      // followed by a retry cannot duplicate, and the checkpoint has not moved yet.
      if (records.length) {
        let lastErr: unknown
        for (let a = 0; a < RETRIES; a++) {
          try { await chunksTbl.add(records); lastErr = null; break }
          catch (e) {
            lastErr = e
            const w = Math.min(60_000, 5000 * 2 ** a)
            console.warn(`[vec-catchup] chunk append at ${n(cp.chunkCursor)} attempt ${a + 1}/${RETRIES}: ${(e as Error).message.slice(0, 160)} — retrying in ${w / 1000}s`)
            await new Promise((r) => setTimeout(r, w))
            // Clear whatever the failed attempt may have committed before trying again.
            await chunksTbl.delete(`sectionId IN (${slice.map((s) => `'${esc(s.id)}'`).join(',')})`).catch(() => {})
          }
        }
        if (lastErr) throw lastErr
      }
      cp.chunkCursor += slice.length
      cp.chunksWritten += records.length
      cp.bodyMisses += misses
      await saveCkpt(cp)
      const rate = cp.chunkCursor / ((Date.now() - t0) / 1000)
      console.log(`[vec-catchup] chunked ${n(cp.chunkCursor)}/${n(items.length)} sections → ${n(cp.chunksWritten)} chunks (${misses} body misses this batch) ${rate.toFixed(0)} sec/s eta ${Math.round((items.length - cp.chunkCursor) / rate / 60)}m`)
    }
    cp.phase = 'embedding'
    await saveCkpt(cp)
    console.log(`[vec-catchup] phase 1 complete: ${n(cp.chunksWritten)} chunks, ${n(cp.bodyMisses)} body misses`)
  }

  // ── PHASE 2: EMBED ──────────────────────────────────────────────────────────
  if (!DO_EMBED && !CANARY) {
    console.log('[vec-catchup] --embed not passed — stopping before any spend.')
    await pool.end(); return
  }
  if (cp.phase === 'chunking') { console.log('[vec-catchup] phase 1 is not complete — run with --chunk first'); await pool.end(); return }

  // The delta's own shard plan: the new chunkIds ONLY, read back from corpus_chunks by sectionId.
  console.log('[vec-catchup] planning shards over the delta chunkIds…')
  const deltaChunkIds: string[] = []
  for (let i = 0; i < ids.length; i += 2000) {
    const slice = ids.slice(i, i + 2000)
    const arrow = await chunksTbl.query()
      .where(`sectionId IN (${slice.map((s) => `'${esc(s)}'`).join(',')})`)
      .select(['chunkId']).limit(1_000_000).toArrow()
    const col = arrow.getChild('chunkId')
    if (col) for (let k = 0; k < arrow.numRows; k++) deltaChunkIds.push(col.get(k) as string)
  }
  deltaChunkIds.sort()
  console.log(`[vec-catchup] ${n(deltaChunkIds.length)} delta chunks to embed`)

  const shards: Array<{ i: number; ids: string[] }> = []
  const planned = CANARY ? deltaChunkIds.slice(0, CANARY_N) : deltaChunkIds
  for (let i = 0, s = 0; i < planned.length; i += SHARD_SIZE, s++) shards.push({ i: s, ids: planned.slice(i, i + SHARD_SIZE) })
  cp.shardSize = SHARD_SIZE
  // A canary's shard indices do not mean the same thing as a full run's (see Ckpt.canaryShards).
  // Refuse to inherit them rather than silently skipping a 40,000-chunk shard.
  if (cp.canaryShards && !CANARY) {
    console.log(
      `[vec-catchup] ⚠ the checkpoint's doneShards ${JSON.stringify(cp.doneShards)} came from a --canary run, ` +
      `whose shard 0 was ${CANARY_N} chunks, not ${n(SHARD_SIZE)}. Discarding them so this run re-plans from scratch.\n` +
      `[vec-catchup]   ⚠ the canary's ${n(cp.vectors)} vectors are ALREADY in corpus_vec and vecTbl.add() does not ` +
      `dedupe — delete them before this run, or it will write duplicates.`
    )
    cp.doneShards = []
    cp.attemptedShards = []
    cp.canaryShards = false
    await saveCkpt(cp)
  }
  if (CANARY) cp.canaryShards = true
  const done = new Set(cp.doneShards)
  const attempted = new Set(cp.attemptedShards)
  const todo = shards.filter((s) => !done.has(s.i))
  console.log(`[vec-catchup] ${shards.length} shards; ${done.size} done, ${todo.length} to go${Number.isFinite(MAX_COST) ? `; hard ceiling $${MAX_COST} (spent $${cp.spentUsd.toFixed(2)})` : ''}`)

  let writeChain: Promise<void> = Promise.resolve()
  let stopped = false

  async function processShard(s: { i: number; ids: string[] }) {
    const tag = `${RUN}-shard-${String(s.i).padStart(5, '0')}`
    const rows: any[] = []
    for (let i = 0; i < s.ids.length; i += 2000) {
      const part = s.ids.slice(i, i + 2000)
      const got = await chunksTbl.query()
        .where(`chunkId IN (${part.map((c) => `'${esc(c)}'`).join(',')})`)
        .select(['chunkId', 'sectionId', 'corpus', 'tier', 'body']).limit(part.length * 2).toArray() as any[]
      rows.push(...got)
    }
    rows.sort((a, b) => (a.chunkId < b.chunkId ? -1 : a.chunkId > b.chunkId ? 1 : 0))

    const shardTokens = rows.reduce((a, r) => a + estTokens(r.body), 0)
    const shardCost = (shardTokens / 1e6) * RATE
    if (cp.spentUsd + shardCost > MAX_COST) {
      stopped = true
      console.log(`[vec-catchup] STOPPING before ${tag}: it would take spend to $${(cp.spentUsd + shardCost).toFixed(2)}, past the --max-cost ceiling of $${MAX_COST}`)
      return
    }

    // Only pay for a pre-delete if this shard was attempted before and did not complete.
    if (attempted.has(s.i)) {
      for (let i = 0; i < s.ids.length; i += 500) {
        await vecTbl.delete(`chunkId IN (${s.ids.slice(i, i + 500).map((c) => `'${esc(c)}'`).join(',')})`)
      }
    }
    cp.attemptedShards.push(s.i)
    await saveCkpt(cp)

    const chunks: ChunkForEmbed[] = rows.map((r) => ({ chunkId: r.chunkId, body: r.body }))
    let vecs: (number[] | null)[] | null = null
    let lastErr: unknown
    for (let a = 0; a < RETRIES; a++) {
      try { vecs = await (EMBED_MODE === 'sync' ? embedShardViaSync(chunks, tag) : embedShardViaBatch(chunks, tag)); break }
      catch (e) { lastErr = e; const w = Math.min(60_000, 5000 * 2 ** a); console.warn(`[vec-catchup] ${tag} attempt ${a + 1}/${RETRIES}: ${(e as Error).message} — retrying in ${w / 1000}s`); await new Promise((r) => setTimeout(r, w)) }
    }
    if (!vecs) throw lastErr

    const records: any[] = []
    let miss = 0
    rows.forEach((r, k) => {
      const v = vecs![k]
      if (v && v.length === VECTOR_DIMS) records.push({ chunkId: r.chunkId, sectionId: r.sectionId, corpus: r.corpus, tier: r.tier, vector: v })
      else miss++
    })

    writeChain = writeChain.then(async () => {
      if (records.length) await vecTbl.add(records)
      cp.doneShards.push(s.i)
      cp.vectors += records.length
      cp.misses += miss
      cp.spentUsd += shardCost
      await saveCkpt(cp)
      console.log(`[vec-catchup] ${tag} done (${n(records.length)} vec, ${miss} miss, $${shardCost.toFixed(3)}) | total ${n(cp.vectors)} vec, ${cp.doneShards.length}/${shards.length} shards, $${cp.spentUsd.toFixed(2)}`)
    })
    await writeChain
  }

  let next = 0
  const failed: number[] = []
  await Promise.all(Array.from({ length: Math.min(MAX_INFLIGHT_SHARDS, Math.max(todo.length, 1)) }, async () => {
    for (;;) {
      const k = next++
      if (k >= todo.length || stopped) return
      try { await processShard(todo[k]) }
      catch (e) { failed.push(todo[k].i); console.error(`[vec-catchup] shard ${todo[k].i} FAILED after ${RETRIES} retries: ${(e as Error).message}`) }
    }
  }))
  await writeChain

  if (!CANARY && !stopped && failed.length === 0 && cp.doneShards.length === shards.length) {
    cp.phase = 'done'
    await saveCkpt(cp)
  }

  console.log('\n═══ RESULT ══════════════════════════════════════════════════════════════════')
  console.log(`  sections in the delta      ${n(items.length)}`)
  console.log(`  chunks written             ${n(cp.chunksWritten)}   (body misses ${n(cp.bodyMisses)})`)
  console.log(`  vectors written            ${n(cp.vectors)}   (misses ${n(cp.misses)})`)
  console.log(`  shards                     ${cp.doneShards.length}/${shards.length} done, ${failed.length} failed`)
  console.log(`  SPEND                      $${cp.spentUsd.toFixed(2)}`)
  console.log(`  corpus_vec rows now        ${n(await vecTbl.countRows())}`)
  console.log(`  corpus_chunks rows now     ${n(await chunksTbl.countRows())}`)
  if (cp.phase === 'done') {
    console.log('\n  NEXT — the ANN index must be rebuilt or every query pays a brute-force scan')
    console.log('  over the new fragments forever (INGEST_PLAYBOOK §20):')
    // ⚠ `vector-reindex`, NOT `vector-index` — this line said `vector-index` until 2026-08-12 and
    // following it would have produced a job that REPORTS SUCCESS AND BUILDS NOTHING. Both of
    // `vector-index`'s scripts are checkpointed `phase: "done"` from the 21–22 Jul build, so it
    // prints "already done — nothing to do", creates no index, and destroys the box.
    // `vector-reindex` exists precisely for this and passes `--index-only`, the flag that enters
    // the ANN block regardless of phase. jobs.ts says all of this at its definition; this line
    // was pointing away from it.
    console.log('    tsx ../ops/heavy-job/run.ts plan vector-reindex   # prices it, creates nothing')
    console.log('    tsx ../ops/heavy-job/run.ts run  vector-reindex   # ~5.6 GB peak, ~30 min, ~€0.15')
    console.log('    tsx search/vector-serve-run.ts redeploy           # it does NOT auto-deploy from GitHub,')
    console.log('                                                     # and openTable() is called once at boot')
  }
  await pool.end()
}
main().catch((e) => { console.error('[vec-catchup] FATAL', e); process.exit(1) })
