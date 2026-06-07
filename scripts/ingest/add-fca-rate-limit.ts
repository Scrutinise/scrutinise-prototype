import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { Pool } from 'pg'

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

  // Check actual columns
  const cols = await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'source_rate_limits'
    ORDER BY ordinal_position
  `)
  console.log('source_rate_limits columns:', cols.rows.map(r => `${r.column_name}(${r.data_type})`).join(', '))

  // Insert without note column
  const res = await pool.query(`
    INSERT INTO source_rate_limits ("sourceKey", "intervalMs", "maxConcurrentWorkers")
    VALUES ('fca-handbook', 500, 3)
    ON CONFLICT ("sourceKey") DO UPDATE
      SET "intervalMs"           = EXCLUDED."intervalMs",
          "maxConcurrentWorkers" = EXCLUDED."maxConcurrentWorkers"
    RETURNING "sourceKey", "intervalMs", "maxConcurrentWorkers"
  `)
  console.log('Upserted:', res.rows[0])

  const check = await pool.query(`
    SELECT "sourceKey", "intervalMs", "maxConcurrentWorkers"
    FROM source_rate_limits
    WHERE "sourceKey" LIKE 'tna%' OR "sourceKey" LIKE 'fca%'
    ORDER BY "sourceKey"
  `)
  console.log('\nFull fca/tna rate limits:')
  check.rows.forEach(r => console.log(`  ${r.sourceKey.padEnd(25)} ${r.intervalMs}ms  maxConcurrent=${r.maxConcurrentWorkers}`))

  await pool.end()
}
main().catch(err => { console.error(err); process.exit(1) })
