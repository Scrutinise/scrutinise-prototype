import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { Pool } from 'pg'

async function main() {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false } })

  // How many fca-handbook sections made it to Neon, and sample them
  const count = await pool.query(`
    SELECT COUNT(*)::int AS total FROM corpus_sections WHERE corpus = 'fca-handbook'
  `)
  console.log('fca-handbook sections in Neon:', count.rows[0].total)

  if (count.rows[0].total > 0) {
    const sample = await pool.query(`
      SELECT id, "r2Key", "wordCount", "createdAt"
      FROM corpus_sections
      WHERE corpus = 'fca-handbook'
      ORDER BY "createdAt" DESC
      LIMIT 5
    `)
    console.log('Recent rows:')
    sample.rows.forEach(r => console.log(`  ${r.id}  wc=${r.wordCount}  key=${r.r2Key}`))
  }

  // Also check for fca-handbook rows with 0 word count (empty — failed silently)
  const empty = await pool.query(`
    SELECT COUNT(*)::int AS empty FROM corpus_sections
    WHERE corpus = 'fca-handbook' AND ("wordCount" = 0 OR "wordCount" IS NULL)
  `)
  console.log('Zero-wordcount rows:', empty.rows[0].empty)

  await pool.end()
}
main().catch(err => { console.error(err); process.exit(1) })
