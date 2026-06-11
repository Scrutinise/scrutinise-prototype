// V19 post-push resets — run AFTER the V19 deploy is live.
// Mode 'court': reset the 180 FCL court-page rows the old code markSkipped'd,
//               and requeue the unclassified 1958 SI marker.
// Mode 'govuk': clear the govuk-content breaker and reset its 429-burned rows —
//               run only after ≥1h of gov.uk quiet (politeness cooloff).
async function main() {
  const { getNeonPool } = await import('../../ingest/shared/neon-pool')
  const pool = getNeonPool()
  const mode = process.argv[2]

  if (mode === 'court') {
    const r = await pool.query(`
      UPDATE ingest_queue SET status='pending', "lastError"=NULL, "claimedBy"=NULL, "claimedAt"=NULL
      WHERE corpus='tna-caselaw' AND "docId" LIKE 'court:%' AND status='skipped' RETURNING id`)
    console.log('court page rows reset to pending:', r.rowCount)
    await pool.query(`
      INSERT INTO ingest_queue (id, corpus, "docId", "sourceType", priority, status)
      VALUES ('si-pre-2010:uksi/1958/1156', 'si-pre-2010', 'uksi/1958/1156', 'tna-legislation', 1, 'pending')
      ON CONFLICT (id) DO UPDATE SET status='pending', "lastError"=NULL, "claimedBy"=NULL, "claimedAt"=NULL`)
    console.log('uksi/1958/1156 requeued for classification')
  } else if (mode === 'govuk') {
    await pool.query(`UPDATE source_status SET state='ok', trip_reason=NULL, tripped_at=NULL, zero_output_streak=0 WHERE source_key='govuk-content'`)
    const unpark = await pool.query(`UPDATE ingest_queue SET status='pending', "lastError"=NULL WHERE "sourceType"='govuk-content' AND status='blocked' RETURNING id`)
    const refail = await pool.query(`UPDATE ingest_queue SET status='pending', "lastError"=NULL, "claimedBy"=NULL, "claimedAt"=NULL WHERE "sourceType"='govuk-content' AND status='failed' RETURNING id`)
    console.log(`govuk breaker cleared; unparked ${unpark.rowCount}; reset ${refail.rowCount} failed`)
  } else {
    console.error('usage: v19-postpush-resets.ts court|govuk')
    process.exit(1)
  }
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
