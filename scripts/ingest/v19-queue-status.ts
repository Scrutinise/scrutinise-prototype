import { getNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const r = await pool.query(`
    SELECT corpus, status, count(*)::int n FROM ingest_queue
    WHERE status IN ('pending','claimed','failed')
    GROUP BY corpus, status ORDER BY corpus, status`)
  console.table(r.rows)
  const s = await pool.query(`
    SELECT corpus, count(*)::int sections FROM corpus_sections
    WHERE corpus IN ('hmrc-ancillary','tax-treaties-dta','uk-treaties','et-decisions')
    GROUP BY corpus`)
  console.table(s.rows)
  const hb = await pool.query(`SELECT last_beat, now() - last_beat AS age FROM ingest_service_state`)
  console.table(hb.rows)
  const b = await pool.query(`SELECT source_key, state, zero_output_streak FROM source_status WHERE state='tripped' OR zero_output_streak > 5`)
  console.table(b.rows)
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
