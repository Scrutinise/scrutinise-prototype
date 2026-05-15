import * as path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool } = require(path.join(__dirname, '../../scrutinise-web/node_modules/pg'))

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function main() {
  const client = await pool.connect()
  try {
    const sizeRes = await client.query(
      `SELECT pg_size_pretty(pg_database_size(current_database())) as size, pg_database_size(current_database()) as bytes`
    )
    const itemRes = await client.query(`SELECT COUNT(*)::int as count FROM "LegislationItem"`)
    const sectionRes = await client.query(`SELECT COUNT(*)::int as count FROM "LegislationSection"`)
    const opDocRes = await client.query(`SELECT COUNT(*)::int as count FROM "OperationalDocument"`)
    const opSectionRes = await client.query(`SELECT COUNT(*)::int as count FROM "OperationalSection"`)
    const sampleItemRes = await client.query(`SELECT title, "sourceType" FROM "LegislationItem" LIMIT 1`)
    const sampleSectionRes = await client.query(`SELECT "sectionNumber", "sourceType" FROM "LegislationSection" LIMIT 1`)
    // Confirm CorpusType enum is gone (should error if column exists)
    const enumCheckRes = await client.query(`
      SELECT typname FROM pg_type WHERE typname IN ('CorpusType', 'DocumentSourceType', 'OperationalIngestStatus')
    `)

    const bytes = Number(sizeRes.rows[0].bytes)
    const gb = (bytes / 1024 / 1024 / 1024).toFixed(3)

    console.log('=== Phase A Verification (corrected schema) ===')
    console.log(`Railway DB size:            ${sizeRes.rows[0].size}  (${gb} GB)`)
    console.log(`LegislationItem count:      ${itemRes.rows[0].count}`)
    console.log(`LegislationSection count:   ${sectionRes.rows[0].count}`)
    console.log(`OperationalDocument count:  ${opDocRes.rows[0].count}  (expected: 0)`)
    console.log(`OperationalSection count:   ${opSectionRes.rows[0].count}  (expected: 0)`)
    console.log(`Sample item sourceType:     ${sampleItemRes.rows[0]?.sourceType}  (expected: STATUTE)`)
    console.log(`Sample section sourceType:  ${sampleSectionRes.rows[0]?.sourceType}  (expected: STATUTE)`)
    console.log(`Enums present:              ${enumCheckRes.rows.map((r: any) => r.typname).join(', ')}`)
    console.log(`  (expected: DocumentSourceType, OperationalIngestStatus — NOT CorpusType)`)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(err => { console.error(err.message); process.exit(1) })
