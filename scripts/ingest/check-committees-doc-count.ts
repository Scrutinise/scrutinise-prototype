import { Pool } from 'pg'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch {}

async function main() {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 })

  const [byType, docTotal] = await Promise.all([
    pool.query<{ sourceType: string; corpus: string; status: string; n: string }>(`
      SELECT "sourceType", corpus, status, COUNT(*) as n
      FROM ingest_queue
      WHERE "sourceType" IN ('committees-document', 'committees-portal')
      GROUP BY "sourceType", corpus, status
      ORDER BY "sourceType", corpus, status
    `),
    pool.query<{ n: string }>(`SELECT COUNT(*) as n FROM ingest_queue WHERE "sourceType" = 'committees-document'`),
  ])

  console.log('[by sourceType + corpus + status]')
  for (const r of byType.rows) console.log(`  ${r.sourceType.padEnd(22)} ${r.corpus.padEnd(22)} ${r.status.padEnd(10)} ${r.n}`)
  console.log(`\ncommittees-document total rows: ${docTotal.rows[0].n}`)

  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
