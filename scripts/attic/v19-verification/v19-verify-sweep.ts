async function main() {
  const { getNeonPool } = await import('../../ingest/shared/neon-pool')
  const pool = getNeonPool()
  const court = await pool.query(`
    SELECT status, count(*)::int n FROM ingest_queue
    WHERE corpus='tna-caselaw' AND "docId" LIKE 'court:%' GROUP BY status`)
  console.log('court pages:'); console.table(court.rows)
  const trib = await pool.query(`
    SELECT count(*) FILTER (WHERE id ~ 'EAT')::int eat,
           count(*) FILTER (WHERE id ~ 'UKUT')::int ukut,
           count(*) FILTER (WHERE id ~ 'UKFTT')::int ukftt,
           count(*) FILTER (WHERE id ~ 'UKPC')::int ukpc
    FROM corpus_sections WHERE corpus='tna-caselaw'`)
  console.log('tribunal sections:'); console.table(trib.rows)
  const gov = await pool.query(`
    SELECT corpus, count(*) FILTER (WHERE status='failed')::int failed,
           count(*) FILTER (WHERE status='pending')::int pending,
           count(*) FILTER (WHERE status='done')::int done
    FROM ingest_queue WHERE "sourceType"='govuk-content' GROUP BY corpus`)
  console.log('govuk rows:'); console.table(gov.rows)
  const b = await pool.query(`SELECT source_key, state, zero_output_streak FROM source_status WHERE state='tripped'`)
  console.log('tripped:'); console.table(b.rows)
  const reu = await pool.query(`SELECT count(*) FILTER (WHERE status='done')::int done, count(*) FILTER (WHERE status='pending')::int pending FROM ingest_queue WHERE corpus='retained-eu'`)
  console.log('retained-eu:'); console.table(reu.rows)
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
