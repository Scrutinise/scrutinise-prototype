// V19 sprint opening state check — read-only
import { getNeonPool } from './shared/neon-pool'

async function main() {
  const pool = getNeonPool()

  const q = async (label: string, sql: string) => {
    const r = await pool.query(sql)
    console.log(`\n=== ${label} ===`)
    console.table(r.rows)
  }

  await q('queue by status', `SELECT status, count(*)::int AS n FROM ingest_queue GROUP BY status ORDER BY n DESC`)

  await q('failed rows by corpus', `SELECT corpus, count(*)::int AS n, min("lastError") AS sample_error FROM ingest_queue WHERE status='failed' GROUP BY corpus ORDER BY n DESC`)

  await q('pending/blocked by corpus', `SELECT corpus, status, count(*)::int AS n FROM ingest_queue WHERE status IN ('pending','blocked','claimed') GROUP BY corpus, status ORDER BY n DESC`)

  await q('twfy + govuk + fcl rate limits', `SELECT "sourceKey", "intervalMs", "maxConcurrentWorkers", suspended FROM source_rate_limits WHERE "sourceKey" IN ('twfy-pwdata','govuk-content','fcl-caselaw','tna-caselaw','tna-legislation','govuk','bailii') ORDER BY "sourceKey"`)

  await q('source_status breakers (tripped or streaking)', `SELECT * FROM source_status ORDER BY source_key`)

  await q('pwdata corpus_sections counts', `SELECT corpus, count(*)::int AS sections, count(*) FILTER (WHERE availability_status <> 'full')::int AS markers FROM corpus_sections WHERE corpus LIKE 'pwdata%' GROUP BY corpus ORDER BY corpus`)

  await q('corpus_targets pwdata + P1 + tax', `SELECT corpus_key, display_label, est_sections, est_is_confirmed, priority, blocked, retired FROM corpus_targets WHERE corpus_key LIKE 'pwdata%' OR corpus_key IN ('primary-acts-pre-2000','primary-acts-2000plus','regional','retained-eu','si-pre-2010','si-2010plus','hmrc-manuals','uk-treaties','lda-commonsoralquestions','bailii-eat','bailii-tribunals','bailii-privy-ni','tna-caselaw') ORDER BY priority, corpus_key`)

  await q('ingest service heartbeat', `SELECT * FROM ingest_service_state`)

  await q('total corpus_sections', `SELECT count(*)::int AS total, count(*) FILTER (WHERE availability_status='full')::int AS full FROM corpus_sections`)

  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
