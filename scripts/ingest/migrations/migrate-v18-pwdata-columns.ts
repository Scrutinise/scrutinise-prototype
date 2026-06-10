/**
 * migrate-v18-pwdata-columns.ts — V18 per-item metadata columns (idempotent).
 *
 * Adds nullable metadata columns to corpus_sections for the pwdata per-speech
 * granularity migration: heading, speaker, sitting date, parent day-file ID.
 * Additive and nullable — safe to run while the old code is still deployed.
 * entity_list_v5.md update is CCh's to make (noted in CHANGE_LOG).
 */
import { getNeonPool, endNeonPool } from '../shared/neon-pool'

async function main() {
  const pool = getNeonPool()
  await pool.query(`
    ALTER TABLE corpus_sections
      ADD COLUMN IF NOT EXISTS "sectionTitle" TEXT,
      ADD COLUMN IF NOT EXISTS speaker TEXT,
      ADD COLUMN IF NOT EXISTS "itemDate" DATE,
      ADD COLUMN IF NOT EXISTS "parentDocId" TEXT
  `)
  console.log('columns added (or already present)')
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_corpus_sections_parent
    ON corpus_sections ("parentDocId") WHERE "parentDocId" IS NOT NULL
  `)
  console.log('parentDocId partial index ready')
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
