import { Pool } from 'pg'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch {}

async function main() {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 })

  const [statusRes, lda, committees] = await Promise.all([
    pool.query<{ status: string; n: string }>(`SELECT status, COUNT(*) as n FROM ingest_queue GROUP BY status ORDER BY COUNT(*) DESC`),
    pool.query<{ corpus: string; status: string; n: string }>(`SELECT corpus, status, COUNT(*) as n FROM ingest_queue WHERE corpus IN ('lda-commonswrittenquestions','lda-lordswrittenquestions') GROUP BY corpus, status`),
    pool.query<{ corpus: string; status: string; n: string }>(`SELECT corpus, status, COUNT(*) as n FROM ingest_queue WHERE corpus IN ('committees-reports','committees-evidence') GROUP BY corpus, status ORDER BY corpus, status`),
  ])

  console.log('\n[Neon ingest_queue status]')
  for (const r of statusRes.rows) console.log(`  ${r.status.padEnd(15)} ${r.n}`)

  console.log('\n[LDA written questions — should all be done/retired]')
  if (lda.rows.length === 0) console.log('  (no rows found)')
  for (const r of lda.rows) console.log(`  ${r.corpus}  ${r.status}  ${r.n}`)

  console.log('\n[Committees queue]')
  if (committees.rows.length === 0) console.log('  (no rows)')
  for (const r of committees.rows) console.log(`  ${r.corpus}  ${r.status}  ${r.n}`)

  // Check for very recent claims (workers active on Neon)
  const claimedRes = await pool.query<{ n: string; oldest: string }>(`
    SELECT COUNT(*) as n, MIN("claimedAt") as oldest FROM ingest_queue
    WHERE status = 'claimed' AND "claimedAt" > NOW() - INTERVAL '10 minutes'
  `)
  console.log(`\n[Workers active on Neon in last 10min] claimed: ${claimedRes.rows[0].n}`)

  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
