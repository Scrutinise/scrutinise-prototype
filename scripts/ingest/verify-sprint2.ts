import { Pool } from 'pg'
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? require('fs').readFileSync(
    require('path').join(__dirname, '../../scrutinise-web/.env'), 'utf8'
  ).match(/DATABASE_URL="([^"]+)"/)?.[1],
  ssl: { rejectUnauthorized: false },
  statement_timeout: 30_000,
})

async function run() {
  const q1 = await pool.query('SELECT status, COUNT(*) FROM ingest_queue GROUP BY status ORDER BY status')
  console.log('Queue state:'); console.table(q1.rows)

  const q2 = await pool.query(`
    SELECT corpus, COUNT(*) as sections, MAX("createdAt") as latest
    FROM corpus_sections
    GROUP BY corpus ORDER BY sections DESC
  `)
  console.log('\ncorpus_sections by corpus:'); console.table(q2.rows)

  const q3 = await pool.query('SELECT COUNT(*) as total_sections FROM corpus_sections')
  console.log('\nTotal corpus_sections:', q3.rows[0].total_sections)

  await pool.end()
}

import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
run().catch(e => { console.error(e); process.exit(1) })
