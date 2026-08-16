/**
 * v36-read-catchup-ckpt.ts — read the vec-catchup checkpoint out of R2.
 *
 * Needed because `--canary` and a full `--embed` both plan shards indexed from 0, and
 * `doneShards` stores the INDEX. A canary that completes "shard 0" (400 chunks) can
 * therefore mark the full run's shard 0 (40,000 chunks) as already done — skipping
 * 39,600 chunks while reporting success.
 *
 * Usage: tsx v36-read-catchup-ckpt.ts [--run v36]
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { r2Get } from './shared/r2-client'

const RUN = (() => { const i = process.argv.indexOf('--run'); return i >= 0 ? process.argv[i + 1] : 'v36' })()

async function main() {
  const key = `_search/${RUN}_vec_catchup.checkpoint.json`
  const raw = await r2Get(key)
  if (!raw) { console.log(`no checkpoint at ${key}`); return }
  console.log(`${key}:\n${raw}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
