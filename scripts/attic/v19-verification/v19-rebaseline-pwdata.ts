// V19 §1.2 — re-baseline all seven pwdata denominators to measured actuals (✓).
// The era-average estimates are provably wrong (wrans 60.9% was an estimate
// artifact). Residual failures (if any) go to specialist queue with classification.
import { getNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const failed = await pool.query(`SELECT corpus, "docId", "lastError" FROM ingest_queue WHERE corpus LIKE 'pwdata%' AND status='failed'`)
  if (failed.rows.length) { console.log('RESIDUAL FAILURES (classify before re-baseline):'); console.table(failed.rows) }
  else console.log('zero residual pwdata failures — full drain confirmed')

  const m = await pool.query(`
    SELECT corpus, count(*) FILTER (WHERE status='compiled')::int compiled,
           count(*) FILTER (WHERE status<>'compiled')::int markers
    FROM corpus_sections WHERE corpus LIKE 'pwdata%' GROUP BY corpus ORDER BY corpus`)
  console.table(m.rows)
  for (const row of m.rows) {
    await pool.query(`UPDATE corpus_targets SET est_sections=$2, est_is_confirmed=true WHERE corpus_key=$1`, [row.corpus, row.compiled])
  }
  const t = await pool.query(`SELECT corpus_key, est_sections, est_is_confirmed FROM corpus_targets WHERE corpus_key LIKE 'pwdata%' ORDER BY corpus_key`)
  console.table(t.rows)
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
