import * as path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool } = require(path.join(__dirname, '../../scrutinise-web/node_modules/pg'))
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function main() {
  const client = await pool.connect()
  try {
    const sizeRes = await client.query(
      `SELECT pg_size_pretty(pg_database_size(current_database())) as size, pg_database_size(current_database()) as bytes`
    )
    const docRes = await client.query(
      `SELECT id, title, "ingestStatus", "pageCount", "sourceType", "r2Prefix" FROM "OperationalDocument" ORDER BY "createdAt"`
    )
    const secRes = await client.query(
      `SELECT COUNT(*)::int as count FROM "OperationalSection"`
    )
    const sampleRes = await client.query(
      `SELECT "pageSlug", "chapterSlug", "pageTitle", "wordCount", "htmlKey", "ingestStatus", "sourceType"
       FROM "OperationalSection" ORDER BY "createdAt" LIMIT 5`
    )
    const filterRes = await client.query(
      `SELECT COUNT(*)::int as count FROM "OperationalSection" WHERE "sourceType" = 'ADMINISTRATIVE_GUIDANCE'`
    )

    const bytes = Number(sizeRes.rows[0].bytes)
    const gb = (bytes / 1024 / 1024 / 1024).toFixed(3)

    console.log('=== Phase B Verification ===')
    console.log(`Railway DB size:      ${sizeRes.rows[0].size}  (${gb} GB)`)
    console.log(`OperationalDocument:  ${docRes.rows.length} rows`)
    for (const r of docRes.rows) {
      console.log(`  [${r.ingestStatus}] ${r.title}  pages=${r.pageCount}  sourceType=${r.sourceType}`)
      console.log(`    r2Prefix: ${r.r2Prefix}`)
    }
    console.log(`OperationalSection:   ${secRes.rows[0].count} rows`)
    console.log(`  ADMINISTRATIVE_GUIDANCE filter: ${filterRes.rows[0].count} rows`)
    console.log(`\nSample sections:`)
    for (const r of sampleRes.rows) {
      console.log(`  [${r.sourceType}] ${r.pageSlug} (ch:${r.chapterSlug})  "${(r.pageTitle ?? '').slice(0,60)}"  ${r.wordCount}w  htmlKey:${r.htmlKey}`)
    }
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(err => { console.error(err.message); process.exit(1) })
