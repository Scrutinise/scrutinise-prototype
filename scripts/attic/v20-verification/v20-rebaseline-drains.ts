import { getNeonPool, endNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const r = await pool.query(`
    SELECT corpus, status, count(*)::int n FROM corpus_sections
    WHERE corpus IN ('et-decisions','uk-treaties') GROUP BY corpus, status ORDER BY corpus, status`)
  console.table(r.rows)
  for (const corpus of ['et-decisions', 'uk-treaties']) {
    const c = await pool.query(`SELECT count(*)::int n FROM corpus_sections WHERE corpus=$1 AND status='compiled'`, [corpus])
    const n = c.rows[0].n
    await pool.query(`UPDATE corpus_targets SET est_sections=$1, est_is_confirmed=true WHERE corpus_key=$2`, [n, corpus])
    console.log(`[rebaseline] ${corpus}: est_sections=${n} CONFIRMED`)
  }
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
