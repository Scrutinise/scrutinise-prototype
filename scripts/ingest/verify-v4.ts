import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 30_000,
})

async function run() {
  const q1 = await pool.query(`
    SELECT corpus, status, COUNT(*)
    FROM ingest_queue
    GROUP BY corpus, status
    ORDER BY corpus, status
  `)
  console.log('Queue by corpus+status:'); console.table(q1.rows)

  const q2 = await pool.query(`
    SELECT corpus, COUNT(*) as sections
    FROM corpus_sections
    GROUP BY corpus ORDER BY sections DESC
  `)
  console.log('\ncorpus_sections totals:'); console.table(q2.rows)

  const q3 = await pool.query('SELECT COUNT(*) as grand_total FROM corpus_sections')
  console.log('\nGrand total:', q3.rows[0].grand_total)

  await pool.end()
}
run().catch(e => { console.error(e); process.exit(1) })
