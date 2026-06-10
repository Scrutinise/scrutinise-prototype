import { getNeonPool, endNeonPool } from './shared/neon-pool'
async function main() {
  const p = getNeonPool()
  const r = await p.query("SELECT pg_get_functiondef(oid) AS def FROM pg_proc WHERE proname = 'corpus_sections_fts_update'")
  console.log(r.rows[0]?.def ?? '(not found)')
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
