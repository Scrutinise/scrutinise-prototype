/**
 * v20-licence-backfill.ts — V20 §2: licence metadata.
 *
 * 1. Adds corpus_sections.licence + attribution (nullable, additive — instant).
 * 2. Backfills licence per corpus from shared/licence-map.ts for every corpus
 *    EXCEPT pwdata-* (8.8M uniform-OPL rows: a full-row MVCC rewrite would churn
 *    ~4-5GB of the 20GB Neon budget for zero information gain — deferred as a
 *    Charlie decision, see V20 CHANGE_LOG; the map remains authoritative for
 *    them and new pwdata rows get licence at ingest).
 *
 * Idempotent (licence IS NULL guard) — rerun at sprint close to sweep rows
 * written by the still-deployed pre-V20 code.
 */
import { Client } from 'pg'
import path from 'path'
import { CORPUS_LICENCES } from './shared/licence-map'

try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* optional */ }

const DEFER_PREFIX = 'pwdata-'

async function main() {
  // Dedicated client: the shared pool's 60s client-side query_timeout is a
  // worker safety net — migration batches legitimately exceed it (non-HOT
  // updates re-insert relic caselaw tsvectors into the 266MB GIN index).
  const pool = new Client({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await pool.connect()
  await pool.query(`SET statement_timeout = '600s'`)

  await pool.query(`ALTER TABLE corpus_sections ADD COLUMN IF NOT EXISTS licence text`)
  await pool.query(`ALTER TABLE corpus_sections ADD COLUMN IF NOT EXISTS attribution text`)
  console.log('[schema] licence + attribution columns present')

  let total = 0
  for (const [corpus, info] of Object.entries(CORPUS_LICENCES)) {
    if (corpus.startsWith(DEFER_PREFIX)) { console.log(`[skip] ${corpus} (pwdata deferred — see CHANGE_LOG V20)`); continue }
    // Batched: the table is hot with live ingest and the shared pool enforces a
    // 60s client-side query_timeout — single big UPDATEs time out.
    let corpusTotal = 0
    while (true) {
      const res = await pool.query(
        `UPDATE corpus_sections SET licence = $1
         WHERE id IN (SELECT id FROM corpus_sections WHERE corpus = $2 AND licence IS NULL LIMIT 20000)`,
        [info.licence, corpus]
      )
      corpusTotal += res.rowCount ?? 0
      if ((res.rowCount ?? 0) === 0) break
    }
    total += corpusTotal
    console.log(`[backfill] ${corpus} → ${info.licence}: ${corpusTotal} rows`)
  }
  console.log(`[done] ${total} rows backfilled`)

  const nulls = await pool.query(
    `SELECT corpus, count(*)::int n FROM corpus_sections WHERE licence IS NULL GROUP BY corpus ORDER BY n DESC`
  )
  console.log('[remaining NULL licence]'); console.table(nulls.rows)

  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
