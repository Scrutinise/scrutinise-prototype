/**
 * v23-rebaseline.ts — V23 §1 closeout: ✓ re-baseline drained corpora.
 *
 * Per INGEST_PLAYBOOK §1c rule 1: a corpus denominator is ✓ confirmed only
 * when it equals a measured quantity AND the queue is fully drained (zero
 * pending/claimed/blocked/failed). Classified residue (status<>'compiled' with
 * a real availability_status) does NOT block ✓ — it is accounted-for non-text,
 * excluded from the compiled denominator (rule 2).
 *
 * Refuses to ✓ any corpus with open queue rows; prints the open breakdown so a
 * still-grinding corpus is visible. historic-hansard is intentionally EXCLUDED:
 * its Lords 1919-1999 tranche (S5L 33-606) and the HTML gap-fill are seeded
 * this sprint and must ALL drain before ✓ (brief §1, single corpus).
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'

const CANDIDATES = [
  'retained-eu', 'regional', 'si-2010plus', 'echr-hudoc',
  'tax-tribunals', 'nao-reports', 'ni-judgments', 'lawcom',
  'explanatory-notes', 'explanatory-memoranda',
  'committees-reports', 'committees-evidence',
]

async function main() {
  const pool = getNeonPool()
  const confirm = process.argv.includes('--confirm')

  for (const corpus of CANDIDATES) {
    const open = await pool.query<{ status: string; n: number }>(`
      SELECT status, COUNT(*)::int n FROM ingest_queue
      WHERE corpus=$1 AND status IN ('pending','claimed','blocked','failed')
      GROUP BY status`, [corpus])
    const m = await pool.query<{ compiled: number; residue: number }>(`
      SELECT count(*) FILTER (WHERE status='compiled')::int compiled,
             count(*) FILTER (WHERE status<>'compiled')::int residue
      FROM corpus_sections WHERE corpus=$1`, [corpus])
    const openTotal = open.rows.reduce((s, r) => s + r.n, 0)
    const compiled = m.rows[0].compiled
    const residue = m.rows[0].residue

    if (openTotal > 0) {
      const brk = open.rows.map(r => `${r.status} ${r.n}`).join(', ')
      console.log(`${corpus}: ${openTotal} OPEN (${brk}) — NOT ✓ | compiled so far ${compiled}`)
      continue
    }
    if (compiled === 0) { console.log(`${corpus}: 0 compiled — skip`); continue }

    if (confirm) {
      await pool.query(`UPDATE corpus_targets SET est_sections=$2, est_is_confirmed=true WHERE corpus_key=$1`, [corpus, compiled])
      console.log(`${corpus}: ✓ CONFIRMED ${compiled} compiled, classified residue ${residue}`)
    } else {
      console.log(`${corpus}: READY ✓ → ${compiled} compiled, residue ${residue} (dry-run; pass --confirm)`)
    }
  }
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
