async function main() {
  const { getNeonPool } = await import('../../ingest/shared/neon-pool')
  const { r2Exists } = await import('../../ingest/shared/r2-client')
  const pool = getNeonPool()
  const rows = await pool.query(`SELECT id, status, "r2Key", "errorMsg", availability_status FROM corpus_sections WHERE corpus='si-pre-2010' AND status<>'compiled'`)
  for (const r of rows.rows) {
    const has = r.r2Key ? await r2Exists(r.r2Key) : false
    console.log(`${r.id} [${r.status}] r2=${has} note=${(r.errorMsg ?? '').slice(0, 60)}`)
    if (has && r.status === 'failed') {
      await pool.query(`UPDATE corpus_sections SET status='compiled', "errorMsg"=NULL WHERE id=$1`, [r.id])
      console.log(`  -> flipped to compiled (R2 content present)`)
    }
  }
  const m = await pool.query(`SELECT count(*) FILTER (WHERE status='compiled')::int c, count(*) FILTER (WHERE status<>'compiled')::int r FROM corpus_sections WHERE corpus='si-pre-2010'`)
  await pool.query(`UPDATE corpus_targets SET est_sections=$1, est_is_confirmed=true WHERE corpus_key='si-pre-2010'`, [m.rows[0].c])
  console.log(`si-pre-2010 final: ✓ ${m.rows[0].c} compiled, residue ${m.rows[0].r}`)
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
