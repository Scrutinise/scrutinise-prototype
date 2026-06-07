import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { Pool } from 'pg'

async function main() {
  const url = process.env.NEON_DATABASE_URL
  if (!url) throw new Error('NEON_DATABASE_URL not set')
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })

  // Sections written in last 5 minutes, by corpus
  const recent = await pool.query<{ corpus: string; count: string; newest: string }>(`
    SELECT corpus, COUNT(*)::int AS count, MAX("createdAt") AS newest
    FROM corpus_sections
    WHERE "createdAt" > NOW() - INTERVAL '5 minutes'
    GROUP BY corpus
    ORDER BY count DESC
  `)

  if (recent.rows.length === 0) {
    console.log('No sections written in the last 5 minutes.')
  } else {
    console.log(`Sections written in last 5 min (${recent.rows.length} corpora active):`)
    recent.rows.forEach(r =>
      console.log(`  ${r.corpus.padEnd(35)} ${String(r.count).padStart(5)} rows  latest: ${r.newest.toString().slice(0, 19)}`)
    )
    const total = recent.rows.reduce((s, r) => s + Number(r.count), 0)
    console.log(`  TOTAL: ${total} sections`)
  }

  // Also show total corpus_sections count
  const total = await pool.query<{ count: string }>('SELECT COUNT(*)::int AS count FROM corpus_sections')
  console.log(`\nTotal corpus_sections: ${total.rows[0].count}`)

  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })
