/**
 * diag-v11.ts — V11 diagnostic: pwdata queue counts + rate limits
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch {}

import { Pool } from 'pg'

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15_000,
    statement_timeout: 30_000,
  })

  // pwdata queue counts
  const pwdata = await pool.query(`
    SELECT corpus,
           COUNT(*) FILTER (WHERE status='pending') AS pending,
           COUNT(*) FILTER (WHERE status='done')    AS done,
           COUNT(*) FILTER (WHERE status='failed')  AS failed
    FROM ingest_queue
    WHERE corpus LIKE 'pwdata-%'
    GROUP BY corpus ORDER BY corpus
  `)
  console.log('\n=== pwdata queue counts ===')
  for (const r of pwdata.rows) {
    console.log(`  ${r.corpus.padEnd(26)} pending=${r.pending}  done=${r.done}  failed=${r.failed}`)
  }

  // rate limits
  const rl = await pool.query(`
    SELECT "sourceKey", "intervalMs", "maxConcurrentWorkers", suspended, "isComplete"
    FROM source_rate_limits
    WHERE "sourceKey" IN ('tna-legislation','twfy-pwdata','lda-parliament','fca-handbook','eurlex','gov-uk')
    ORDER BY "sourceKey"
  `)
  console.log('\n=== source_rate_limits ===')
  for (const r of rl.rows) {
    console.log(`  ${r.sourceKey.padEnd(20)} ${r.intervalMs}ms  max=${r.maxConcurrentWorkers}  suspended=${r.suspended}  isComplete=${r.isComplete}`)
  }

  // total queue overview
  const totals = await pool.query(`
    SELECT status, COUNT(*) AS n FROM ingest_queue GROUP BY status ORDER BY status
  `)
  console.log('\n=== queue totals ===')
  for (const r of totals.rows) {
    console.log(`  ${r.status}: ${r.n}`)
  }

  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
