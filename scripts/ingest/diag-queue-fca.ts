import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { Pool } from 'pg'

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

  const q1 = await pool.query(`
    SELECT corpus, status, COUNT(*)::int AS count
    FROM ingest_queue
    WHERE corpus IN ('fca-handbook', 'si-2010plus', 'si-pre-2010', 'tna-legislation')
    GROUP BY corpus, status
    ORDER BY corpus, status
  `)
  console.log('Queue status:')
  q1.rows.forEach(r => console.log(`  ${r.corpus.padEnd(20)} ${r.status.padEnd(10)} ${r.count}`))

  const q2 = await pool.query(`
    SELECT "sourceKey", "intervalMs", "maxConcurrentWorkers"
    FROM source_rate_limits
    WHERE "sourceKey" LIKE 'tna%' OR "sourceKey" LIKE 'fca%'
    ORDER BY "sourceKey"
  `)
  console.log('\nRate limits:')
  q2.rows.forEach(r => console.log(`  ${r.sourceKey.padEnd(25)} interval=${r.intervalMs}ms  maxConcurrent=${r.maxConcurrentWorkers}`))

  await pool.end()
}
main().catch(err => { console.error(err); process.exit(1) })
