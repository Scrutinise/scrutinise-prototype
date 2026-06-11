import { getNeonPool } from './shared/neon-pool'
async function main() {
  const pool = getNeonPool()
  const r = await pool.query(`
    SELECT
      count(*) FILTER (WHERE id ~ 'EAT')::int eat,
      count(*) FILTER (WHERE id ~ 'UKUT')::int ukut,
      count(*) FILTER (WHERE id ~ 'UKFTT')::int ukftt,
      count(*) FILTER (WHERE id ~ 'UKPC')::int ukpc,
      count(*) FILTER (WHERE id ~ 'UKIPTrib|UKIST')::int ipt,
      count(*)::int total
    FROM corpus_sections WHERE corpus='tna-caselaw'`)
  console.table(r.rows)
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
