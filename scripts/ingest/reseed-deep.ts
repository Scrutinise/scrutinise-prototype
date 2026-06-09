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
import { bulkUpsertQueueRows, getAllDocIdsForCorpus, disconnectQueue } from './shared/queue-client'

interface CorpusSpec {
  corpus: string
  sourceType: string
  priority: number
  types: string[]
  yearMin: number
  yearMax: number
}

const SPECS: CorpusSpec[] = [
  // si-2010plus: UKSI 2010–present. Queue has 5,838 rows, est 61,017 sections.
  { corpus: 'si-2010plus', sourceType: 'tna-legislation', priority: 2,
    types: ['uksi'], yearMin: 2010, yearMax: 2026 },

  // retained-eu: EU instruments on TNA (eudn/eur/eudr).
  // Queue has 3,390 rows. These cover retained EU law adopted in UK after Brexit.
  { corpus: 'retained-eu', sourceType: 'tna-legislation', priority: 2,
    types: ['eudn', 'eur', 'eudr'], yearMin: 1900, yearMax: 2023 },

  // regional: NI/Scottish/Welsh legislation (asp/anaw/nia/nisi/nisr).
  // Queue has 9,434 done, 0 pending. May have more items.
  { corpus: 'regional', sourceType: 'tna-legislation', priority: 2,
    types: ['asp', 'anaw', 'nia', 'nisi', 'nisr'], yearMin: 1900, yearMax: 2026 },

  // si-pre-2010: UKSI 1948-2009. Queue has 30,907 done. Check for any gaps.
  { corpus: 'si-pre-2010', sourceType: 'tna-legislation', priority: 5,
    types: ['uksi'], yearMin: 1948, yearMax: 2009 },
]

async function reseedCorpus(spec: CorpusSpec): Promise<number> {
  console.log(`\n[deep-reseed] ${spec.corpus} (${spec.types.join(',')} ${spec.yearMin}–${spec.yearMax}) …`)

  const existing = await getAllDocIdsForCorpus(spec.corpus)
  console.log(`[deep-reseed]   existing queue rows: ${existing.size}`)

  let allIds: string[] = []
  for (const type of spec.types) {
    console.log(`[deep-reseed]   enumerating ${type} ${spec.yearMin}–${spec.yearMax} from TNA…`)
    const ids = await listActIds(type, spec.yearMin, spec.yearMax)
    console.log(`[deep-reseed]   ${type}: ${ids.length} acts found`)
    allIds = allIds.concat(ids)
  }

  const missing = allIds
    .filter(id => !existing.has(id))
    .map(id => ({
      id: `${spec.corpus}:${id}`,
      corpus: spec.corpus,
      docId: id,
      sourceType: spec.sourceType,
      priority: spec.priority,
    }))

  console.log(`[deep-reseed]   TNA total: ${allIds.length}  existing: ${existing.size}  missing: ${missing.length}`)

  if (missing.length === 0) {
    console.log(`[deep-reseed]   ${spec.corpus}: fully seeded — no gaps found`)
    return 0
  }

  const inserted = await bulkUpsertQueueRows(missing)
  console.log(`[deep-reseed]   ${spec.corpus}: inserted ${inserted} new queue rows`)
  return inserted
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
