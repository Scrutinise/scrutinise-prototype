import { Pool } from 'pg'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch {}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 })
  const res = await pool.query<{ application_name: string; connections: string; state: string }>(`
    SELECT application_name,
           state,
           COUNT(*) as connections
    FROM pg_stat_activity
    WHERE datname = current_database()
    GROUP BY application_name, state
    ORDER BY COUNT(*) DESC
  `)
  console.log('\n[Railway pg_stat_activity]')
  console.log(`${'application_name'.padEnd(40)} ${'state'.padEnd(12)} connections`)
  console.log('─'.repeat(70))
  for (const r of res.rows) {
    console.log(`${String(r.application_name ?? '(null)').padEnd(40)} ${String(r.state ?? 'null').padEnd(12)} ${r.connections}`)
  }
  console.log()

  const totalRes = await pool.query<{ n: string }>('SELECT COUNT(*) as n FROM pg_stat_activity WHERE datname = current_database()')
  console.log(`Total connections to Railway DB: ${totalRes.rows[0].n}`)
  console.log('Expected: only prisma/Next.js web app. Zero pg_node = ingest workers not connecting.')

  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
