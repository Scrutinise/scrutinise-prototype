import { getNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const r = await pool.query(`
    SELECT split_part(split_part(id,':',2),'/',1) AS court, count(*)::int n
    FROM corpus_sections WHERE corpus='tna-caselaw'
    GROUP BY 1 ORDER BY n DESC`)
  console.table(r.rows)
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
