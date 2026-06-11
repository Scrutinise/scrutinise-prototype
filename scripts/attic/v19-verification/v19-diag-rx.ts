import { getNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const t = await pool.query(`SELECT '1873' ~ '^\d+$' AS m1, '1873' ~ '^[0-9]+$' AS m2`)
  console.log(t.rows[0])
  const cnt = await pool.query(`
    SELECT count(DISTINCT split_part(id,':',2))::int docs, count(*)::int sections
    FROM corpus_sections
    WHERE corpus='primary-acts-pre-2000' AND status='compiled'
      AND split_part(split_part(id,':',2),'/',2) ~ '^[0-9]+$'
      AND split_part(split_part(id,':',2),'/',2)::int < 1963`)
  console.log('pre-1963 calendar compiled:', cnt.rows[0])
  const fmt = await pool.query(`
    SELECT format, count(*)::int n
    FROM corpus_sections
    WHERE corpus='primary-acts-pre-2000' AND status='compiled'
      AND split_part(split_part(id,':',2),'/',2)::int < 1963
    GROUP BY 1`)
  console.table(fmt.rows)
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
