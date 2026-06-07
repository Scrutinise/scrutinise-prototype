import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { Pool } from 'pg'

async function main() {
  const url = process.env.NEON_DATABASE_URL
  if (!url) throw new Error('NEON_DATABASE_URL not set')
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })

  const res = await pool.query(`
    UPDATE corpus_targets
    SET retired        = true,
        blocked        = true,
        blocked_reason = 'superseded by fca-handbook (JSON API client, V10 — direct access to api-handbook.fca.org.uk)'
    WHERE corpus_key IN ('fca-publications', 'fca-regulators')
    RETURNING corpus_key, retired, blocked_reason
  `)

  console.log(`Updated ${res.rowCount} row(s):`)
  res.rows.forEach(r => console.log(`  ${r.corpus_key}: retired=${r.retired}  reason="${r.blocked_reason}"`))

  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })
