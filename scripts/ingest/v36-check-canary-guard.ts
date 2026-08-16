/**
 * v36-check-canary-guard.ts — watch the canaryShards guard fire before trusting it.
 *
 * The defect it prevents (measured on the V36 catch-up, 2026-08-15): `--canary` embeds
 * `deltaChunkIds.slice(0, 400)` and records `doneShards: [0]`. A full `--embed` plans
 * shard 0 as SHARD_SIZE (40,000) chunks and skips any index in `doneShards`, so it
 * embeds shard 1 only, leaves ~40,000 chunks with no vector, and prints
 * "2/2 shards done". A partial embed wearing the face of a complete one — caused by
 * the safety measure.
 *
 * Two scenarios against a throwaway run tag, so nothing real is touched:
 *
 *   1. checkpoint carries canaryShards:true  → MUST discard doneShards and say so.
 *   2. checkpoint carries canaryShards:false → MUST keep doneShards untouched.
 *
 * Scenario 2 is what makes this a guard rather than a tripwire: it fails if the fix is
 * over-applied and throws away legitimate resume state, which would re-embed and
 * re-bill work already done.
 *
 * `--max-cost 0` means neither scenario can spend: the run stops before the first shard.
 *
 * Usage: tsx v36-check-canary-guard.ts
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import fs from 'fs'
import { execFileSync } from 'child_process'
import { r2Put, r2Get } from './shared/r2-client'

const TAG = 'v36guard'
const WORKLIST = path.join(__dirname, `${TAG}-vec-delta.jsonl`)
const CKPT_KEY = `_search/${TAG}_vec_catchup.checkpoint.json`
const SRC_WORKLIST = path.join(__dirname, 'v36-vec-delta.jsonl')

function ckpt(canaryShards: boolean, nIds: number) {
  return {
    phase: 'embedding', chunkCursor: nIds, chunksWritten: 3, bodyMisses: 0,
    doneShards: [0], attemptedShards: [0], canaryShards,
    vectors: 400, misses: 0, spentUsd: 0, shardSize: 40000, updatedAt: new Date().toISOString(),
  }
}

async function run(canaryShards: boolean): Promise<string> {
  const lines = fs.readFileSync(SRC_WORKLIST, 'utf8').split('\n').filter(Boolean).slice(0, 3)
  fs.writeFileSync(WORKLIST, lines.join('\n') + '\n')
  await r2Put(CKPT_KEY, JSON.stringify(ckpt(canaryShards, lines.length), null, 2), 'application/json')
  try {
    return execFileSync('npx', ['tsx', path.join(__dirname, 'v33-vec-catchup.ts'), '--embed', '--run', TAG, '--max-cost', '0'],
      { cwd: __dirname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: true, timeout: 600_000 })
  } catch (e: any) {
    return String(e.stdout ?? '') + String(e.stderr ?? '')
  }
}

async function main() {
  let pass = 0, fail = 0
  const DISCARD = 'came from a --canary run'

  for (const [label, canaryShards, expect] of [
    ['canaryShards:true  → discard', true, true],
    ['canaryShards:false → keep', false, false],
  ] as Array<[string, boolean, boolean]>) {
    const out = await run(canaryShards)
    const discarded = out.includes(DISCARD)
    const after = JSON.parse((await r2Get(CKPT_KEY)) ?? '{}')
    const shardsCleared = Array.isArray(after.doneShards) && after.doneShards.length === 0
    const ok = discarded === expect && (expect ? shardsCleared : !shardsCleared)
    ok ? pass++ : fail++
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(32)} discarded=${discarded} (expected ${expect})  ` +
      `doneShards after=${JSON.stringify(after.doneShards)}`
    )
  }

  fs.rmSync(WORKLIST, { force: true })
  console.log(`\n[check] ${pass}/${pass + fail} passed`)
  if (fail) process.exitCode = 1
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
