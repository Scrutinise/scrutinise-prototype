/**
 * look.ts — scratch lookup helper for GOLD v2. DB ONLY, never runSearch().
 *   npx tsx look.ts title "<ilike>" [corpusPrefix] [minWords]
 *   npx tsx look.ts speaker "<ilike>" "<titleIlike>"
 *   npx tsx look.ts act "<ilike>"
 *   npx tsx look.ts sec "<gid>" "<sectionTitleIlike>"
 *   npx tsx look.ts id "<id>"
 */
import { Pool } from 'pg'

const [, , mode, a, b, c] = process.argv

;(async () => {
  const p = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }, statement_timeout: 900_000,
  })

  if (mode === 'title') {
    const prefix = b ?? 'pwdata-'
    const minWords = c ? parseInt(c, 10) : 250
    const { rows } = await p.query(
      `SELECT id, corpus, "sectionTitle", speaker, "itemDate"::text d, "wordCount"
         FROM corpus_sections
        WHERE corpus LIKE $2 || '%' AND status='compiled'
          AND "sectionTitle" ILIKE $1 AND "wordCount" >= $3
        ORDER BY "wordCount" DESC LIMIT 25`, [a, prefix, minWords])
    for (const r of rows) {
      console.log(`${r.id}\n    ${r.d}  ${r.wordCount}w  [${r.corpus}]  ${r.speaker ?? '—'}\n    ${r.sectionTitle}`)
    }
    console.log(`(${rows.length} rows)`)
  }

  if (mode === 'speaker') {
    const { rows } = await p.query(
      `SELECT id, corpus, "sectionTitle", speaker, "itemDate"::text d, "wordCount"
         FROM corpus_sections
        WHERE status='compiled' AND speaker ILIKE $1 AND "sectionTitle" ILIKE $2
          AND "wordCount" >= 200
        ORDER BY "wordCount" DESC LIMIT 20`, [a, b])
    for (const r of rows) console.log(`${r.id}\n    ${r.d}  ${r.wordCount}w  ${r.speaker}\n    ${r.sectionTitle}`)
    console.log(`(${rows.length} rows)`)
  }

  if (mode === 'act') {
    const { rows } = await p.query(
      `SELECT "legislationGovUkId" gid, title, year FROM "LegislationItem"
        WHERE title ILIKE $1 ORDER BY year DESC LIMIT 25`, [a])
    for (const r of rows) console.log(`${String(r.gid).padEnd(28)} ${r.year ?? ''}  ${r.title}`)
    console.log(`(${rows.length} rows)`)
  }

  if (mode === 'sec') {
    const { rows } = await p.query(
      `SELECT id, corpus, "sectionTitle", "wordCount"
         FROM corpus_sections
        WHERE status='compiled' AND id LIKE '%' || $1 || ':%'
          AND ($2 = '' OR "sectionTitle" ILIKE $2)
        ORDER BY "wordCount" DESC LIMIT 25`, [a, b ?? ''])
    for (const r of rows) console.log(`${r.id}\n    ${r.wordCount}w  ${r.sectionTitle}`)
    console.log(`(${rows.length} rows)`)
  }

  if (mode === 'id') {
    const { rows } = await p.query(
      `SELECT id, corpus, "sectionTitle", speaker, "itemDate"::text d, "wordCount", "r2Key", status
         FROM corpus_sections WHERE id = $1`, [a])
    console.log(JSON.stringify(rows, null, 1))
  }

  await p.end()
})().catch((e) => { console.error(e); process.exit(1) })
