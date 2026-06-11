import { getNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const r = await pool.query(`
    SELECT id, split_part(id,':',2) AS p2, split_part(split_part(id,':',2),'/',2) AS yr
    FROM corpus_sections WHERE corpus='primary-acts-pre-2000' ORDER BY random() LIMIT 10`)
  console.table(r.rows)
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
