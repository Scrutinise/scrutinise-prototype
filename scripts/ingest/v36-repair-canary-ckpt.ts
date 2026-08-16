/**
 * v36-repair-canary-ckpt.ts — undo the canary so the full embed can run exactly once.
 *
 * THE PROBLEM, measured rather than suspected (see the checkpoint read on 2026-08-15):
 * `--canary` embedded 400 chunks and recorded `doneShards: [0]`. A full `--embed` plans
 * shard 0 as SHARD_SIZE (40,000) chunks and skips any index already in `doneShards`, so
 * it would embed shard 1 only, leave ~40,000 chunks with no vector, and report
 * "2/2 shards done". And because `vecTbl.add()` is a plain add with no mergeInsert,
 * simply clearing `doneShards` instead would write the canary's 400 a second time.
 *
 * So both halves have to be undone together: delete the 400 vectors, then clear the
 * shard state. The canary's chunks are deterministic — `deltaChunkIds` is the full
 * sorted chunkId list for the work list's sections, and the canary took the first
 * CANARY_N of it — so the same slice is recomputed here rather than guessed.
 *
 *   --apply   actually delete and rewrite. Default is a dry run.
 *
 * Usage: tsx v36-repair-canary-ckpt.ts [--apply]
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import fs from 'fs'
import { connectLance } from './search/lance'
import { VEC_TABLE, CHUNKS_TABLE } from './search/vector-common'
import { r2Get, r2Put } from './shared/r2-client'

const RUN = 'v36'
const CANARY_N = parseInt(process.env.VEC_CATCHUP_CANARY_N ?? '400', 10)
const APPLY = process.argv.includes('--apply')
const WORKLIST = path.join(__dirname, `${RUN}-vec-delta.jsonl`)
const CKPT_KEY = `_search/${RUN}_vec_catchup.checkpoint.json`
const esc = (s: string) => s.replace(/'/g, "''")
const n = (v: number) => Number(v).toLocaleString('en-GB')

async function main() {
  const ids: string[] = []
  for (const line of fs.readFileSync(WORKLIST, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try { ids.push(JSON.parse(line).id) } catch { /* skip */ }
  }
  console.log(`work list: ${n(ids.length)} sections`)

  const db = await connectLance()
  const chunksTbl = await db.openTable(CHUNKS_TABLE)
  const vecTbl = await db.openTable(VEC_TABLE)

  // Recompute the canary's slice exactly as the catch-up does.
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
  const canaryIds = deltaChunkIds.slice(0, CANARY_N)
  console.log(`delta chunks ${n(deltaChunkIds.length)} · canary slice ${n(canaryIds.length)}`)

  const vecBefore = await vecTbl.countRows()
  const chunksNow = await chunksTbl.countRows()
  console.log(`corpus_vec ${n(vecBefore)} · corpus_chunks ${n(chunksNow)}`)

  // How many of the canary slice are actually present as vectors?
  let present = 0
  for (let i = 0; i < canaryIds.length; i += 500) {
    const part = canaryIds.slice(i, i + 500)
    present += await vecTbl.countRows(`chunkId IN (${part.map((c) => `'${esc(c)}'`).join(',')})`)
  }
  console.log(`canary vectors present in corpus_vec: ${n(present)} of ${n(canaryIds.length)}`)

  const ckptRaw = await r2Get(CKPT_KEY)
  const ckpt = ckptRaw ? JSON.parse(ckptRaw) : null
  console.log(`checkpoint doneShards=${JSON.stringify(ckpt?.doneShards)} vectors=${ckpt?.vectors} spent=$${ckpt?.spentUsd}`)

  if (!APPLY) {
    console.log(`\n--apply not passed. WOULD delete ${n(present)} canary vectors and reset doneShards/attemptedShards/vectors.`)
    console.log(`Target after the full embed: corpus_vec == corpus_chunks == ${n(chunksNow)}`)
    return
  }

  for (let i = 0; i < canaryIds.length; i += 500) {
    const part = canaryIds.slice(i, i + 500)
    await vecTbl.delete(`chunkId IN (${part.map((c) => `'${esc(c)}'`).join(',')})`)
  }
  const vecAfter = await vecTbl.countRows()
  console.log(`corpus_vec ${n(vecBefore)} → ${n(vecAfter)}  (removed ${n(vecBefore - vecAfter)})`)

  if (ckpt) {
    ckpt.doneShards = []
    ckpt.attemptedShards = []
    ckpt.canaryShards = false
    ckpt.vectors = 0
    ckpt.misses = 0
    // spentUsd is DELIBERATELY left alone: $0.004 of real money was spent and the
    // ledger should say so. Resetting it would make the run's own cost report a lie.
    ckpt.updatedAt = new Date().toISOString()
    await r2Put(CKPT_KEY, JSON.stringify(ckpt, null, 2), 'application/json')
    console.log(`checkpoint reset (spentUsd left at $${ckpt.spentUsd} — real money, real ledger)`)
  }
  console.log(`\nTarget after the full embed: corpus_vec == corpus_chunks == ${n(chunksNow)}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
