/**
 * v19-seed-retained-eu-completion.ts — V19 §2.3: the V18-approved bounded
 * completion pass for retained-eu.
 *
 * Enumerates the full eur/eudn/eudr universe from TNA year feeds (pagination
 * fixed in V18 — every year was previously capped at 20 instruments), dedupes
 * against corpus_sections, and seeds pending queue rows for the never-ingested
 * remainder (~29.6k expected, ~93% hasNoProvisions shells that will classify
 * to markers; ~8.7k real sections expected).
 *
 * Enumeration is checkpointed per type to v19-retained-eu-enum.json so a rerun
 * skips completed types. Queue inserts are ON CONFLICT DO NOTHING.
 *
 * Run:
 *   NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx \
 *     --tsconfig scripts/tsconfig.json scripts/ingest/v19-seed-retained-eu-completion.ts
 */
import * as fs from 'fs'
import * as path from 'path'
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { listActIds } from './sources/tna-legislation'

const TYPES = ['eur', 'eudn', 'eudr']
const YEAR_FROM = 1953
const YEAR_TO = 2020 // retained EU law ends at IP completion day (31 Dec 2020)
const CHECKPOINT = path.join(__dirname, 'v19-retained-eu-enum.json')

function loadCheckpoint(): Record<string, string[]> {
  try { return JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')) } catch { return {} }
}

async function main() {
  const pool = getNeonPool()
  const enumd = loadCheckpoint()

  // Per-year enumeration with per-year checkpointing — TNA feed latency varies
  // wildly and the throttle backs off to 30s/req on 429/503; visible progress
  // and resumability matter more than call elegance here.
  //
  // A rate-limited fetch returns null and looks like an EMPTY year — the first
  // run poisoned eur/1986 as 0 ids while TNA was 429ing. So: 0-id years are
  // never checkpointed on first sight; they retry in later rounds and are only
  // accepted as genuinely empty after a clean round confirms them.
  for (const key of Object.keys(enumd)) {
    if (enumd[key].length === 0) delete enumd[key]   // purge prior poisoned zeros
  }
  for (let round = 1; round <= 3; round++) {
    let zeros = 0
    for (const type of TYPES) {
      for (let y = YEAR_FROM; y <= YEAR_TO; y++) {
        const key = `${type}/${y}`
        if (enumd[key]) continue
        const t0 = Date.now()
        const ids = await listActIds(type, y, y)
        if (ids.length > 0 || round === 3) {
          enumd[key] = ids
          fs.writeFileSync(CHECKPOINT, JSON.stringify(enumd))
        } else {
          zeros++
        }
        console.log(`[enum r${round}] ${key}: ${ids.length} ids in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
      }
    }
    if (zeros === 0) break
    console.log(`[enum] round ${round}: ${zeros} zero-id years to retry — pausing 120s`)
    await new Promise(r => setTimeout(r, 120_000))
  }

  const universe = Object.values(enumd).flat()
  const byType = (t: string) => Object.entries(enumd).filter(([k]) => k.startsWith(`${t}/`)).reduce((s, [, v]) => s + v.length, 0)
  console.log(`\nuniverse: ${universe.length.toLocaleString()} instruments (${TYPES.map(t => `${t}=${byType(t)}`).join(' ')})`)

  const ingestedRes = await pool.query<{ d: string }>(
    `SELECT DISTINCT split_part(id, ':', 2) AS d FROM corpus_sections WHERE corpus = 'retained-eu'`
  )
  const ingested = new Set(ingestedRes.rows.map(r => r.d))
  const fresh = universe.filter(id => !ingested.has(id))
  console.log(`already in corpus_sections: ${ingested.size.toLocaleString()}; never ingested: ${fresh.length.toLocaleString()}`)

  const rows = fresh.map(docId => ({
    id: `retained-eu:${docId}`,
    corpus: 'retained-eu',
    docId,
    sourceType: 'tna-legislation',
    priority: 2,
  }))
  const { affected } = await bulkInsertQueueRows(rows)
  console.log(`queue rows inserted: ${affected.toLocaleString()} (of ${rows.length.toLocaleString()} candidates)`)

  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
