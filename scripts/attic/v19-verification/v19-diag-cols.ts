import { getNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='corpus_sections' ORDER BY ordinal_position`)
  console.log(cols.rows.map(r => r.column_name).join(', '))
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
