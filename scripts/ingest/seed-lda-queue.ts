/**
 * seed-lda-queue.ts — seed ingest_queue rows for confirmed LDA Parliament datasets.
 *
 * Confirmed working (V6 diagnostic, 3 Jun 2026):
 *   commonsoralquestions   — 69,852 records  → 140 pages
 *   lordswrittenquestions  — 103,137 records → 207 pages
 *   commonswrittenquestions — 618,599 records → 1,238 pages
 *   commonsdivisions       — 5,553 records   → 12 pages
 *   lordsdivisions         — 2,089 records   → 5 pages
 *
 * Run once after V6 deploy:
 *   NODE_PATH=scrutinise-web/node_modules \
 *   scrutinise-web/node_modules/.bin/tsx --tsconfig scripts/tsconfig.json \
 *   scripts/ingest/seed-lda-queue.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { bulkUpsertQueueRows, disconnectQueue } from './shared/queue-client'

const PAGE_SIZE = 500

const LDA_DATASETS = [
  { slug: 'commonsoralquestions',   corpus: 'lda-commonsoralquestions',   totalResults: 69_852,   priority: 2 },
  { slug: 'lordswrittenquestions',  corpus: 'lda-lordswrittenquestions',  totalResults: 103_137,  priority: 2 },
  { slug: 'commonswrittenquestions', corpus: 'lda-commonswrittenquestions', totalResults: 618_599, priority: 2 },
  { slug: 'commonsdivisions',       corpus: 'lda-commonsdivisions',       totalResults: 5_553,    priority: 3 },
  { slug: 'lordsdivisions',         corpus: 'lda-lordsdivisions',         totalResults: 2_089,    priority: 3 },
]

async function main(): Promise<void> {
  let totalInserted = 0

  for (const ds of LDA_DATASETS) {
    const totalPages = Math.ceil(ds.totalResults / PAGE_SIZE)
    const rows = []
    for (let page = 0; page < totalPages; page++) {
      rows.push({
        id: `${ds.corpus}:page:${page}`,
        corpus: ds.corpus,
        docId: `page:${page}`,
        sourceType: 'lda-parliament',
        priority: ds.priority,
      })
    }
    const inserted = await bulkUpsertQueueRows(rows)
    console.log(`${ds.slug}: ${totalPages} pages → ${inserted} new rows`)
    totalInserted += inserted
  }

  console.log(`[seed-lda-queue] done — ${totalInserted} total rows inserted`)
  await disconnectQueue()
}

main().catch(err => { console.error(err); process.exit(1) })
