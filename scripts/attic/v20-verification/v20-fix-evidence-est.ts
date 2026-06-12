import { getNeonPool, endNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  await pool.query(`UPDATE corpus_targets SET est_sections=142397 WHERE corpus_key='committees-evidence'`)
  console.log('committees-evidence est restored to 142,397')
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
