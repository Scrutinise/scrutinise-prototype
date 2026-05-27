/**
 * neon-analyze.ts — Run ANALYZE on Neon LegislationSection to update
 * planner statistics after bulk transfer. Run once post-transfer.
 */
import * as path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import { getNeonPool, endPools } from '../../scrutinise-web/lib/pg-pool'

async function main() {
  const pool = getNeonPool()
  console.log('Running ANALYZE on LegislationSection (updates planner statistics for GIN)...')
  const t0 = Date.now()
  await pool.query('ANALYZE "LegislationSection"')
  console.log(`ANALYZE complete in ${((Date.now() - t0) / 1000).toFixed(1)}s`)

  // Also analyze LegislationItem for completeness
  console.log('Running ANALYZE on LegislationItem...')
  await pool.query('ANALYZE "LegislationItem"')
  console.log('Done.')
  await endPools()
}

main().catch(async err => {
  console.error('Error:', err.message)
  await endPools().catch(() => {})
  process.exit(1)
})
