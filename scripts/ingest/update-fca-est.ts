import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { Pool } from 'pg'

async function main() {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false } })
  const res = await pool.query(`
    UPDATE corpus_targets
    SET est_sections     = 3661,
        est_is_confirmed = true
    WHERE corpus_key = 'fca-handbook'
    RETURNING corpus_key, est_sections, est_is_confirmed
  `)
  console.log('Updated:', res.rows[0])
  await pool.end()
}
main().catch(err => { console.error(err); process.exit(1) })
