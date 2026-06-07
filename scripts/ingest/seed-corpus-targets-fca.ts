import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { Pool } from 'pg'

async function main() {
  const url = process.env.NEON_DATABASE_URL
  if (!url) { console.error('NEON_DATABASE_URL not set'); process.exit(1) }

  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })

  const res = await pool.query(`
    INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, blocked, blocked_reason)
    VALUES ('fca-handbook', 'FCA Handbook', 8000, false, false, NULL)
    ON CONFLICT (corpus_key) DO UPDATE
      SET display_label = 'FCA Handbook',
          est_sections = 8000,
          est_is_confirmed = false,
          blocked = false,
          blocked_reason = NULL
  `)
  console.log('corpus_targets upserted:', res.rowCount, 'row(s) affected')

  const check = await pool.query(
    `SELECT corpus_key, display_label, est_sections, blocked FROM corpus_targets WHERE corpus_key = 'fca-handbook'`
  )
  console.log('Verified:', check.rows[0])

  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })
