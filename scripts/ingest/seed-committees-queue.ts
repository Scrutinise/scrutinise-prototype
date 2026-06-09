/**
 * seed-committees-queue.ts — seed ingest_queue rows for Parliamentary Committees portal.
 *
 * Each queue row = one listing page. Workers claim a page, scrape all publications,
 * insert corpus_sections rows.
 *
 * Confirmed accessible via portal (9 Jun 2026 V15):
 *   reports-responses:  9,959 publications, 498 pages
 *   other-publications: 40,794 publications, ~2,040 pages
 *
 * WHY page-per-row: each listing page has ~20 publications + their HTML fetches.
 * One row per page = manageable claim size (~30s per claim at 500ms rate limit).
 * Compared to one row per publication (9,959 rows) this reduces queue churn.
 *
 * Run:
 *   NODE_PATH=scrutinise-web/node_modules \
 *   scrutinise-web/node_modules/.bin/tsx --tsconfig scripts/tsconfig.json \
 *   scripts/ingest/seed-committees-queue.ts
 *
 * Safe to re-run — ON CONFLICT DO NOTHING.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { bulkUpsertQueueRows, disconnectQueue } from './shared/queue-client'
import { getCommitteeTotalPages } from './sources/committees-portal'

async function seedCorpus(
  corpus: string,
  sourceType: string,
  type: 'reports-responses' | 'other-publications',
  priority: number,
  knownPages?: number,
): Promise<number> {
  let totalPages = knownPages ?? 0
  if (!totalPages) {
    console.log(`[seed-committees] fetching page count for ${corpus}...`)
    totalPages = await getCommitteeTotalPages(type)
    console.log(`[seed-committees] ${corpus}: ${totalPages} pages found`)
  }

  const rows = []
  for (let page = 1; page <= totalPages; page++) {
    rows.push({
      id: `${corpus}:page:${page}`,
      corpus,
      docId: `page:${page}`,
      sourceType,
      priority,
    })
  }

  const inserted = await bulkUpsertQueueRows(rows)
  console.log(`[seed-committees] ${corpus}: ${inserted} new rows inserted (${totalPages} total pages)`)
  return inserted
}

async function main(): Promise<void> {
  let totalInserted = 0

  // Reports and government responses — 9,959 publications, 498 pages
  totalInserted += await seedCorpus(
    'committees-reports',
    'committees-portal',
    'reports-responses',
    2,
    498,
  )

  // Other publications (evidence sessions, oral/written evidence, correspondence)
  // 40,794 publications confirmed (9 Jun 2026). ~20 per page = 2,040 pages.
  totalInserted += await seedCorpus(
    'committees-evidence',
    'committees-portal',
    'other-publications',
    3,
  )

  console.log(`[seed-committees] done — ${totalInserted} total new rows inserted`)
  await disconnectQueue()
}

main().catch(err => { console.error(err); process.exit(1) })
