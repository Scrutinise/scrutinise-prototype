import * as path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import { getRailwayPool, endPools } from '../../scrutinise-web/lib/pg-pool'

async function main() {
  const url = process.env.DATABASE_URL || '(not set)'
  const masked = url.replace(/:[^:@]+@/, ':(password)@')
  console.log(`DATABASE_URL: ${masked}`)

  const pool = getRailwayPool()

  const ping = await pool.query('SELECT 1 AS ok, version() AS v')
  console.log(`Railway ping: ${ping.rows[0].ok} ✓`)
  console.log(`PostgreSQL: ${ping.rows[0].v}`)

  const items = await pool.query('SELECT COUNT(*) AS count FROM "LegislationItem"')
  const sects = await pool.query('SELECT COUNT(*) AS count FROM "LegislationSection"')
  console.log(`LegislationItem:    ${Number(items.rows[0].count).toLocaleString()}`)
  console.log(`LegislationSection: ${Number(sects.rows[0].count).toLocaleString()}`)

  const byType = await pool.query(`
    SELECT li."legislationType"::text AS type, COUNT(*) AS sections
    FROM "LegislationSection" ls
    JOIN "LegislationItem" li ON ls."legislationItemId" = li.id
    GROUP BY li."legislationType" ORDER BY sections DESC
  `)
  console.log('By legislationType:')
  byType.rows.forEach((r: { type: string; sections: string }) =>
    console.log(`  ${r.type.padEnd(8)} ${Number(r.sections).toLocaleString().padStart(8)} sections`)
  )
  await endPools()
}
main().catch(async e => {
  console.error('Error:', e.message)
  await endPools().catch(() => {})
  process.exit(1)
})
