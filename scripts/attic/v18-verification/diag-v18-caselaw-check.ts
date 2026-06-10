import { getNeonPool, endNeonPool } from './shared/neon-pool'
async function main() {
  const p = getNeonPool()
  const q = await p.query("SELECT status, COUNT(*)::text AS n FROM ingest_queue WHERE corpus = 'tna-caselaw' GROUP BY status")
  console.log('caselaw queue:', q.rows.map((r: any) => `${r.status}=${r.n}`).join('  ') || '(none)')
  const s = await p.query("SELECT COUNT(*)::text AS n FROM corpus_sections WHERE corpus = 'tna-caselaw'")
  console.log('caselaw sections:', s.rows[0].n, '(was 74,730 before tail seed; TNA total ~75,050)')
  const hb = await p.query('SELECT last_beat FROM ingest_service_state')
  console.log('heartbeat:', hb.rows[0]?.last_beat)
  const pend = await p.query("SELECT COUNT(*)::int AS n FROM ingest_queue WHERE status = 'pending'")
  console.log('total pending:', pend.rows[0].n)
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
