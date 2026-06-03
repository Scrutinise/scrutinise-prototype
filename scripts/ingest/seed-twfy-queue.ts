/**
 * seed-twfy-queue.ts — seed monthly TWFY Hansard queue rows for Commons,
 * Lords, and Westminster Hall. Safe to re-run (ON CONFLICT DO NOTHING).
 *
 * Requires: TWFY_API_KEY env var (register free at theyworkforyou.com/api/key)
 *
 * Run after TWFY_API_KEY is added to Railway env:
 *   NODE_PATH=scrutinise-web/node_modules \
 *   scrutinise-web/node_modules/.bin/tsx --tsconfig scripts/tsconfig.json \
 *   scripts/ingest/seed-twfy-queue.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { bulkUpsertQueueRows, disconnectQueue } from './shared/queue-client'
import { twfyMonthlyDocIds, TwfyHouse } from './sources/theyworkforyou'

const HOUSE_TO_CORPUS: Record<TwfyHouse, string> = {
  commons:     'hansard-commons-a',
  lords:       'hansard-lords-a',
  westminhall: 'hansard-commons-b',  // reuse commons-b partition for Westminster Hall
}

async function main() {
  for (const house of ['commons', 'lords', 'westminhall'] as TwfyHouse[]) {
    const corpus = HOUSE_TO_CORPUS[house]
    const rows = []
    for (const docId of twfyMonthlyDocIds(house)) {
      rows.push({ id: `${corpus}:${docId}`, corpus, docId, sourceType: 'hansard', priority: 2 })
    }
    console.log(`[seed] ${house}: ${rows.length} monthly rows`)
    const inserted = await bulkUpsertQueueRows(rows)
    console.log(`[seed] ${house}: ${inserted} new rows inserted`)
  }
  await disconnectQueue()
  console.log('[seed] done')
}

main().catch(e => { console.error(e); process.exit(1) })
