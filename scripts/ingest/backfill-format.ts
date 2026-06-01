/**
 * backfill-format.ts — one-shot script to set format = 'clml' on all
 * corpus_sections rows that were compiled before the format column was added.
 *
 * Criteria: format IS NULL AND status = 'compiled' AND r2Key IS NOT NULL
 *   - format IS NULL: pre-migration rows
 *   - status = 'compiled': successfully processed
 *   - r2Key IS NOT NULL: content was written to R2 (equivalent to r2Exists check,
 *     instant vs 173k HEAD requests which would take ~7 hours)
 *
 * All rows meeting these criteria are clml format — only clml content was written
 * before the format column existed. Runs as a single SQL UPDATE, no TNA re-fetch.
 *
 * Usage: npx tsx scripts/ingest/backfill-format.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { PrismaClient } from '@prisma/client'

async function main(): Promise<void> {
  const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })

  console.log('[backfill] counting rows to update...')

  const countResult = await db.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) AS count
    FROM corpus_sections
    WHERE format IS NULL AND status = 'compiled' AND "r2Key" IS NOT NULL
  `
  const count = Number(countResult[0].count)
  console.log(`[backfill] ${count.toLocaleString()} rows to update`)

  if (count === 0) {
    console.log('[backfill] nothing to do')
    await db.$disconnect()
    return
  }

  console.log('[backfill] running UPDATE...')
  const updated = await db.$executeRaw`
    UPDATE corpus_sections
    SET format = 'clml'
    WHERE format IS NULL AND status = 'compiled' AND "r2Key" IS NOT NULL
  `
  console.log(`[backfill] done — ${Number(updated).toLocaleString()} rows updated to format='clml'`)

  await db.$disconnect()
}

main().catch(err => { console.error('[backfill] fatal:', err); process.exit(1) })
