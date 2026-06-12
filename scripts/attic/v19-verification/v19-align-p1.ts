async function main() {
  const { getNeonPool } = await import('../../ingest/shared/neon-pool')
  const pool = getNeonPool()
  for (const k of ['primary-acts-2000plus', 'si-2010plus']) {
    const m = await pool.query(`SELECT count(*)::int c FROM corpus_sections WHERE corpus=$1 AND status='compiled'`, [k])
    await pool.query(`UPDATE corpus_targets SET est_sections=$2, est_is_confirmed=true WHERE corpus_key=$1`, [k, m.rows[0].c])
    console.log(`${k}: ✓ aligned to measured ${m.rows[0].c}`)
  }
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
