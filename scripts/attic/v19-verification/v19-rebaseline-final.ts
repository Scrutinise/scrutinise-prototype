async function main() {
  const { getNeonPool } = await import('../../ingest/shared/neon-pool')
  const pool = getNeonPool()
  for (const corpus of ['tna-caselaw', 'lda-commonsoralquestions', 'si-pre-2010']) {
    const open = await pool.query(`SELECT count(*)::int n FROM ingest_queue WHERE corpus=$1 AND status IN ('pending','claimed','blocked')`, [corpus])
    const m = await pool.query(`
      SELECT count(*) FILTER (WHERE status='compiled')::int compiled,
             count(*) FILTER (WHERE status<>'compiled')::int residue
      FROM corpus_sections WHERE corpus=$1`, [corpus])
    if (open.rows[0].n > 0) { console.log(`${corpus}: ${open.rows[0].n} open rows — skip`); continue }
    await pool.query(`UPDATE corpus_targets SET est_sections=$2, est_is_confirmed=true WHERE corpus_key=$1`, [corpus, m.rows[0].compiled])
    console.log(`${corpus}: ✓ ${m.rows[0].compiled} compiled, residue ${m.rows[0].residue}`)
  }
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
