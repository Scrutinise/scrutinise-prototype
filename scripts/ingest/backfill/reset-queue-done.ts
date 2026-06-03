/**
 * reset-queue-done.ts — reset 'done' rows back to 'pending' for corpora where
 * workers marked rows done without writing any corpus_sections.
 *
 * Root cause: api.parliament.uk/v1/hansard returns 403 from Railway IPs,
 * causing listHansardDebates() to yield 0 debates. Workers loop 0 times and
 * call markDone() with no content written. FCA/ECHR had similar API issues.
 *
 * This script resets only rows where the corpus has 0 corpus_sections, so it
 * is safe to re-run — it will not touch corpora where content was written.
 *
 * Run:
 *   NODE_PATH=scrutinise-web/node_modules \
 *   scrutinise-web/node_modules/.bin/tsx --tsconfig scripts/tsconfig.json \
 *   scripts/ingest/backfill/reset-queue-done.ts [--dry-run]
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { Pool } from 'pg'

const DRY_RUN = process.argv.includes('--dry-run')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 30_000,
})

// Corpora with done queue rows but confirmed 0 corpus_sections
const CORPORA_TO_RESET = [
  'hansard-commons-a',
  'hansard-commons-b',
  'hansard-lords-a',
  'hansard-lords-b',
  'committees-a',
  'echr-hudoc',
  'fca-regulators',
  'uk-treaties',
]

async function run() {
  console.log(`[reset] ${DRY_RUN ? 'DRY RUN — ' : ''}Resetting empty-output done rows to pending\n`)

  for (const corpus of CORPORA_TO_RESET) {
    // Count sections that were actually written for this corpus
    const secRes = await pool.query<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM corpus_sections WHERE corpus = $1',
      [corpus]
    )
    const sectionCount = secRes.rows[0]?.count ?? 0

    // Count done queue rows
    const qRes = await pool.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM ingest_queue WHERE corpus = $1 AND status = 'done'",
      [corpus]
    )
    const doneCount = qRes.rows[0]?.count ?? 0

    if (sectionCount > 0) {
      console.log(`[reset] ${corpus}: ${sectionCount} sections exist, ${doneCount} done rows — SKIPPING (has content)`)
      continue
    }

    if (doneCount === 0) {
      console.log(`[reset] ${corpus}: 0 done rows — nothing to reset`)
      continue
    }

    if (DRY_RUN) {
      console.log(`[reset] ${corpus}: would reset ${doneCount} rows to pending (dry run)`)
      continue
    }

    const res = await pool.query(
      "UPDATE ingest_queue SET status = 'pending', \"lastError\" = NULL WHERE corpus = $1 AND status = 'done'",
      [corpus]
    )
    console.log(`[reset] ${corpus}: reset ${res.rowCount} rows to pending`)
  }

  // Verify final state
  console.log('\n[reset] Verification — pending rows per corpus after reset:')
  const verify = await pool.query<{ corpus: string; pending: number }>(
    `SELECT corpus, COUNT(*)::int AS pending FROM ingest_queue WHERE corpus = ANY($1) AND status = 'pending' GROUP BY corpus`,
    [CORPORA_TO_RESET]
  )
  console.table(verify.rows)

  await pool.end()
  console.log(DRY_RUN ? '\n[reset] Dry run complete — no changes made' : '\n[reset] Done')
}

run().catch(e => { console.error('[reset] fatal:', e); process.exit(1) })
