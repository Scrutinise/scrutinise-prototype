import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { Pool } from 'pg'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })

  // Check table exists and its contents
  const rows = await pool.query(`SELECT * FROM scheduler_lock`)
  console.log(`scheduler_lock rows: ${rows.rowCount}`)
  rows.rows.forEach(r => console.log('  ', JSON.stringify(r)))

  if (rows.rowCount === 0) {
    console.log('\nTable is empty — re-inserting seed row...')
    const ins = await pool.query(`
      INSERT INTO scheduler_lock (id, "lockedBy", "lockedAt")
      VALUES (1, NULL, NULL)
      ON CONFLICT (id) DO NOTHING
    `)
    console.log(`Inserted: ${ins.rowCount} row(s)`)

    const verify = await pool.query(`SELECT * FROM scheduler_lock`)
    console.log('Verified:', JSON.stringify(verify.rows[0]))
  }

  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })
