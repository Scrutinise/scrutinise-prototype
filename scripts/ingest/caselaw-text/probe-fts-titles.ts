/**
 * probe-fts-titles.ts — the §3 "before" run returned `(untitled)` for every case-law hit, which
 * would mean last night's title recovery reached the database and stopped there. Rather than infer
 * that from three queries, this counts it over the whole collection in both places. WRITES NOTHING.
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { Pool } from 'pg'
import { connectLance, FTS_TABLE } from '../search/lance'

const CORPUS = 'tna-caselaw'

;(async () => {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2, statement_timeout: 600_000 })
  const db = await connectLance()
  const tbl = await db.openTable(FTS_TABLE)

  const rows = await tbl.query().where(`corpus = '${CORPUS}'`).select(['id', 'sectionTitle', 'itemDate']).toArray() as Array<{ sectionTitle: string | null; itemDate: string | null }>
  const titled = rows.filter(r => r.sectionTitle && String(r.sectionTitle).trim()).length
  const jan1 = rows.filter(r => String(r.itemDate ?? '').slice(5, 10) === '01-01').length

  const dbRow = (await pool.query(
    `SELECT COUNT(*)::int n,
            COUNT(NULLIF(btrim(COALESCE("sectionTitle",'')),''))::int titled,
            COUNT(*) FILTER (WHERE to_char("itemDate",'MM-DD')='01-01')::int jan1
       FROM corpus_sections WHERE corpus=$1`, [CORPUS])).rows[0]

  const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(2)}%` : '—')
  console.log(`\n                      corpus_sections (the database)   ${FTS_TABLE} (what keyword search serves)`)
  console.log(`  rows                ${String(dbRow.n).padStart(10)}                      ${String(rows.length).padStart(10)}`)
  console.log(`  carrying a title    ${String(dbRow.titled).padStart(10)} ${pct(dbRow.titled, dbRow.n).padStart(8)}             ${String(titled).padStart(10)} ${pct(titled, rows.length).padStart(8)}`)
  console.log(`  dated 1 January     ${String(dbRow.jan1).padStart(10)} ${pct(dbRow.jan1, dbRow.n).padStart(8)}             ${String(jan1).padStart(10)} ${pct(jan1, rows.length).padStart(8)}`)
  await pool.end()
})().catch(e => { console.error(e); process.exit(1) })
