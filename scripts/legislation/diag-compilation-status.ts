/**
 * diag-compilation-status.ts
 * One-off: check what compilationStatus values exist on LegislationItem in Railway.
 */
import * as path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import { getRailwayPool, endPools } from '../../scrutinise-web/lib/pg-pool'

async function main() {
  const pool = getRailwayPool()

  const statusRes = await pool.query(`
    SELECT "compilationStatus", COUNT(*) AS count
    FROM "LegislationItem"
    GROUP BY "compilationStatus"
    ORDER BY count DESC
  `)
  console.log('compilationStatus breakdown on Railway LegislationItem:')
  console.log(JSON.stringify(statusRes.rows, null, 2))

  const totalRes = await pool.query('SELECT COUNT(*) AS count FROM "LegislationItem"')
  console.log(`\nTotal LegislationItem rows: ${Number(totalRes.rows[0].count).toLocaleString()}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => endPools())
