async function main() {
  const { getNeonPool } = await import('../../ingest/shared/neon-pool')
  const pool = getNeonPool()
  const r = await pool.query(`
    SELECT t.corpus_key, t.est_sections::int est, t.est_is_confirmed,
           (SELECT count(*) FROM corpus_sections s WHERE s.corpus = t.corpus_key AND s.status='compiled')::int actual
    FROM corpus_targets t
    WHERE t.corpus_key IN ('primary-acts-2000plus','primary-acts-pre-2000','si-pre-2010','si-2010plus',
                           'hmrc-manuals','hmrc-ancillary','tax-treaties-dta','hmrc-tiins','hmrc-codes-guidance')
    ORDER BY t.corpus_key`)
  for (const row of r.rows) {
    const pct = row.est ? ((row.actual / row.est) * 100).toFixed(1) : '?'
    console.log(`${row.corpus_key.padEnd(24)} ${String(row.actual).padStart(9)} / ${String(row.est).padStart(9)} ${row.est_is_confirmed ? '✓' : '~'}  ${pct}%`)
  }
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
