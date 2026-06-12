import { getNeonPool, endNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const r = await pool.query(`
    SELECT corpus,
           count(DISTINCT split_part(id, ':', 2)) FILTER (WHERE split_part(id, ':', 2) ~ '^uksi/[0-9]{4}/[0-9]+$')::int uksi_docs,
           count(DISTINCT split_part(id, ':', 2)) FILTER (WHERE split_part(id, ':', 2) ~ '^uksi/[0-9]{4}/[0-9]+$'
             AND split_part(split_part(id, ':', 2), '/', 2)::int >= 2002)::int uksi_2002plus,
           count(DISTINCT split_part(id, ':', 2))::int all_docs
    FROM corpus_sections WHERE corpus IN ('si-pre-2010', 'si-2010plus') GROUP BY corpus`)
  console.table(r.rows)
  const s = await pool.query(`SELECT id FROM corpus_sections WHERE corpus='si-2010plus' LIMIT 3`)
  console.log(s.rows)
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
