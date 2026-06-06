/**
 * seed-pwdata-queue.ts — seed ingest_queue rows for TWFY pwdata bulk Hansard XML.
 *
 * Verified accessible (4 Jun 2026):
 *   pwdata-debates     → debates/     19,999 files (1919–present)
 *   pwdata-lords       → lordspages/   5,663 files (1999–present)
 *   pwdata-wrans       → wrans/        6,857 files (2001–present)
 *   pwdata-westminster → westminhall/  3,932 files (2000–present)
 *
 * Added (6 Jun 2026 V8):
 *   pwdata-lordswrans  → lordswrans/   5,167 files (1999–present) Lords Written Answers
 *   pwdata-wms         → wms/          4,463 files (2002–present) Commons Written Ministerial Statements
 *   pwdata-lordswms    → lordswms/     3,673 files (2004–present) Lords Written Ministerial Statements
 *
 * Run once after V8 deploy:
 *   NODE_PATH=scrutinise-web/node_modules \
 *   scrutinise-web/node_modules/.bin/tsx --tsconfig scripts/tsconfig.json \
 *   scripts/ingest/seed-pwdata-queue.ts
 *
 * Safe to re-run — ON CONFLICT DO NOTHING in bulkUpsertQueueRows.
 * Re-run periodically to pick up new daily files.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { bulkUpsertQueueRows, disconnectQueue } from './shared/queue-client'
import { listPwdataFiles, PWDATA_CORPUS_CONFIG } from './sources/twfy-pwdata'

const CORPUS_PRIORITIES: Record<string, number> = {
  'pwdata-debates':     2,
  'pwdata-lords':       2,
  'pwdata-wrans':       2,
  'pwdata-lordswrans':  2,
  'pwdata-wms':         2,
  'pwdata-lordswms':    2,
  'pwdata-westminster': 3,
}

async function main(): Promise<void> {
  let totalInserted = 0

  for (const corpus of Object.keys(PWDATA_CORPUS_CONFIG)) {
    const priority = CORPUS_PRIORITIES[corpus] ?? 3
    console.log(`[seed-pwdata] fetching directory listing for ${corpus}...`)

    let files
    try {
      files = await listPwdataFiles(corpus)
    } catch (err) {
      console.error(`[seed-pwdata] ${corpus}: directory listing failed —`, err)
      continue
    }

    console.log(`[seed-pwdata] ${corpus}: ${files.length} files found`)

    const rows = files.map(f => ({
      id: `${corpus}:${f.docId}`,
      corpus,
      docId: f.docId,
      sourceType: 'twfy-pwdata',
      priority,
    }))

    const inserted = await bulkUpsertQueueRows(rows)
    console.log(`[seed-pwdata] ${corpus}: ${inserted} new rows inserted`)
    totalInserted += inserted
  }

  console.log(`[seed-pwdata] done — ${totalInserted} total new rows inserted`)
  await disconnectQueue()
}

main().catch(err => { console.error(err); process.exit(1) })
