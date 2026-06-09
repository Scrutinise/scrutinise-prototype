/**
 * reseed-deep.ts — full historical reseed for TNA legislation corpora.
 *
 * Enumerates ALL items from TNA Atom feeds for each type/year range,
 * compares against existing queue rows, inserts the gaps.
 * Safe to re-run — ON CONFLICT DO NOTHING.
 *
 * Takes 20-60 minutes (hundreds of TNA HTTP calls with 200ms throttle).
 *
 * Run:
 *   NODE_PATH=scrutinise-web/node_modules \
 *   scrutinise-web/node_modules/.bin/tsx --tsconfig scripts/tsconfig.json \
 *   scripts/ingest/reseed-deep.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch {}

import { listActIds } from './sources/tna-legislation'
import { bulkUpsertQueueRows, disconnectQueue } from './shared/queue-client'

interface CorpusSpec {
  corpus: string
  sourceType: string
  priority: number
  types: string[]
  yearMin: number
  yearMax: number
}

// NOTE: si-2010plus confirmed fully seeded (TNA Atom feed = 5,811 items, queue = 5,838).
// NOTE: si-pre-2010 confirmed fully processed (174,507 Neon sections vs est 174,555).
// Focus: retained-eu and regional which have large gaps vs corpus_targets estimates.
const SPECS: CorpusSpec[] = [
  // retained-eu: EU instruments on TNA (eudn/eur/eudr). est 140,000 sections, only 3,390 queue rows.
  { corpus: 'retained-eu', sourceType: 'tna-legislation', priority: 2,
    types: ['eudn', 'eur', 'eudr'], yearMin: 1900, yearMax: 2023 },

  // regional: NI/Scottish/Welsh legislation. est 160,000 sections, only 9,434 queue rows done.
  { corpus: 'regional', sourceType: 'tna-legislation', priority: 2,
    types: ['asp', 'anaw', 'nia', 'nisi', 'nisr'], yearMin: 1900, yearMax: 2026 },
]

async function reseedCorpus(spec: CorpusSpec): Promise<number> {
  console.log(`\n[deep-reseed] ${spec.corpus} (${spec.types.join(',')} ${spec.yearMin}–${spec.yearMax}) …`)

  // WHY: skip getAllDocIdsForCorpus() — large Railway DB query that hits ECONNRESET.
  // bulkUpsertQueueRows uses ON CONFLICT DO NOTHING so duplicates are safe to insert.
  let allIds: string[] = []
  for (const type of spec.types) {
    console.log(`[deep-reseed]   enumerating ${type} ${spec.yearMin}–${spec.yearMax} from TNA…`)
    const ids = await listActIds(type, spec.yearMin, spec.yearMax)
    console.log(`[deep-reseed]   ${type}: ${ids.length} acts found`)
    allIds = allIds.concat(ids)
  }

  console.log(`[deep-reseed]   TNA total for ${spec.corpus}: ${allIds.length} acts`)

  if (allIds.length === 0) {
    console.log(`[deep-reseed]   ${spec.corpus}: 0 acts found — TNA may be empty for this range`)
    return 0
  }

  const rows = allIds.map(id => ({
    id: `${spec.corpus}:${id}`,
    corpus: spec.corpus,
    docId: id,
    sourceType: spec.sourceType,
    priority: spec.priority,
  }))

  // Retry DB insert on transient errors
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const inserted = await bulkUpsertQueueRows(rows)
      console.log(`[deep-reseed]   ${spec.corpus}: inserted ${inserted} new queue rows (ON CONFLICT ignored dupes)`)
      return inserted
    } catch (err: unknown) {
      const msg = String(err)
      if (attempt < 3 && (msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT') || msg.includes('Connection terminated'))) {
        console.warn(`[deep-reseed]   DB error attempt ${attempt}/3 — retrying in 10s: ${msg}`)
        await new Promise(r => setTimeout(r, 10_000))
      } else {
        throw err
      }
    }
  }
  return 0
}

async function main(): Promise<void> {
  console.log('[deep-reseed] starting full historical TNA reseed')
  console.log('[deep-reseed] this will take 20-60 minutes (TNA rate throttle)')
  console.log('[deep-reseed] progress reported per corpus\n')

  let totalInserted = 0
  for (const spec of SPECS) {
    try {
      const n = await reseedCorpus(spec)
      totalInserted += n
    } catch (err) {
      console.error(`[deep-reseed] ${spec.corpus} failed:`, err)
    }
  }

  console.log(`\n[deep-reseed] COMPLETE — ${totalInserted} total new queue rows inserted`)
  await disconnectQueue()
}

main().catch(err => { console.error(err); process.exit(1) })
