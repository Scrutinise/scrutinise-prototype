async function main() {
  const { getNeonPool } = await import('../../ingest/shared/neon-pool')
  const pool = getNeonPool()
  for (const doc of ['uksi/1999/1867', 'uksi/1999/1958']) {
    const r = await pool.query(`
      SELECT status, count(*)::int n FROM corpus_sections
      WHERE corpus='si-pre-2010' AND split_part(id,':',2)=$1 GROUP BY status`, [doc])
    console.log(doc, JSON.stringify(r.rows))
  }
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
