/** diag-v18-fts.ts — what populates corpus_sections.ftsVector + table sizes (read-only) */
import { getNeonPool, endNeonPool } from './shared/neon-pool'

async function main() {
  const pool = getNeonPool()
  const trg = await pool.query(`
    SELECT tgname, pg_get_triggerdef(t.oid) AS def
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'corpus_sections' AND NOT t.tgisinternal
  `)
  console.log('triggers on corpus_sections:')
  for (const r of trg.rows) console.log(`  ${r.tgname}: ${r.def}`)

  const idx = await pool.query<{ indexname: string; indexdef: string }>(`
    SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'corpus_sections'
  `)
  console.log('\nindexes:')
  for (const r of idx.rows) console.log(`  ${r.indexname}: ${r.indexdef}`)

  const sizes = await pool.query<{ t: string; s: string }>(`
    SELECT 'corpus_sections total' AS t, pg_size_pretty(pg_total_relation_size('corpus_sections')) AS s
    UNION ALL SELECT 'corpus_sections table', pg_size_pretty(pg_relation_size('corpus_sections'))
    UNION ALL SELECT 'LegislationSection total', pg_size_pretty(pg_total_relation_size('"LegislationSection"'))
  `)
  console.log('\nsizes:')
  for (const r of sizes.rows) console.log(`  ${r.t}: ${r.s}`)

  const rowCount = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM corpus_sections`)
  console.log(`  corpus_sections rows: ${parseInt(rowCount.rows[0].n, 10).toLocaleString()}`)

  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
