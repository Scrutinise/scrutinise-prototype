/**
 * _legacy-row-split-tmp.ts — THROWAWAY. CC's ask: split the legacy-rows figure by
 * table — LegislationSection (droppable once the FTS-freshness swap + Act-metadata
 * table land) vs LegislationItem (not droppable until the Act-metadata table lands).
 * Reads Railway (DATABASE_URL, the main app's Prisma DB — NOT Neon). Read-only.
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { Pool } from 'pg'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 2, statement_timeout: 120_000 })

  const tables = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%legislation%' ORDER BY table_name`)
  console.log('Legislation* tables found:', tables.rows.map((r: any) => r.table_name))
  for (const r of tables.rows) {
    const t = r.table_name
    const c = await pool.query(`SELECT count(*)::bigint AS n FROM "${t}"`)
    console.log(`  ${t}: ${Number(c.rows[0].n).toLocaleString()}`)
  }

  await pool.end()
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
