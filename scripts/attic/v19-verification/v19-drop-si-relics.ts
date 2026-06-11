async function main() {
  const { getNeonPool } = await import('../../ingest/shared/neon-pool')
  const pool = getNeonPool()
  const r = await pool.query(`
    DELETE FROM corpus_sections
    WHERE id IN ('si-pre-2010:uksi/1999/1867:regulation-1','si-pre-2010:uksi/1999/1958:schedule-6-paragraph-6')
    RETURNING id`)
  console.log('stale relic rows deleted:', r.rows.map(x => x.id))
  const m = await pool.query(`SELECT count(*) FILTER (WHERE status='compiled')::int c, count(*) FILTER (WHERE status<>'compiled')::int res FROM corpus_sections WHERE corpus='si-pre-2010'`)
  console.log(`si-pre-2010 FINAL: ✓ ${m.rows[0].c} compiled, classified residue ${m.rows[0].res} (uksi/1958/1156 metadata-only)`)
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
