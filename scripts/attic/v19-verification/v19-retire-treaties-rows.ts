import { getNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const r = await pool.query(`
    UPDATE ingest_queue SET status='done', "lastError"='retired V19 — uk-treaties re-pointed to govuk-content (international_treaty)'
    WHERE "sourceType"='treaties' AND status <> 'done' RETURNING id`)
  console.log('non-done treaties rows retired:', r.rowCount)
  const n = await pool.query(`
    UPDATE ingest_queue SET "lastError"='retired V19 — uk-treaties re-pointed to govuk-content (international_treaty)'
    WHERE "sourceType"='treaties' RETURNING id`)
  console.log('treaties rows annotated:', n.rowCount)
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
