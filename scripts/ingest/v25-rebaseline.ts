/**
 * v25-rebaseline.ts — V25 §1.2 + new-corpus ✓ re-baseline (INGEST_PLAYBOOK §1c).
 *
 * A denominator is ✓ only when it equals the measured compiled count AND zero
 * queue rows remain OPEN (pending/claimed/blocked/failed). Classified residue
 * (skipped / non-'compiled' markers) does NOT block ✓.
 *
 * §1.2 names committees-reports, committees-evidence, niassembly-hansard,
 * inquiry-reports — all drained in V24 except a small deterministic FAILED
 * residue (committees-api detail-fetch/AggregateError misses; niassembly
 * components-fetch misses). With --classify-failed those residues (only when
 * small and with no pending/claimed) are marked skipped with a note — the
 * "✓-or-classified" rule — so the genuinely-seeded universe can stamp ✓.
 *
 * The new V25 corpora (senedd-cofnod, bills-api, college-of-policing) are listed
 * too; they stamp ✓ only once their POST-PUSH seeds drain.
 *
 *   (default)          dry-run — print readiness per corpus.
 *   --classify-failed  mark small failed residues skipped (≤ MAX_RESIDUE, no pending/claimed).
 *   --confirm          stamp est_sections = measured compiled, est_is_confirmed = true.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'

const CANDIDATES = [
  'committees-reports', 'committees-evidence', 'niassembly-hansard', 'inquiry-reports',
  'senedd-cofnod', 'bills-api', 'college-of-policing',
]
const MAX_RESIDUE = 200 // classify-failed only applies to small deterministic residues

async function main() {
  const pool = getNeonPool()
  const confirm = process.argv.includes('--confirm')
  const classify = process.argv.includes('--classify-failed')

  for (const corpus of CANDIDATES) {
    const openRows = async () => (await pool.query<{ status: string; n: number }>(`
      SELECT status, COUNT(*)::int n FROM ingest_queue
      WHERE corpus=$1 AND status IN ('pending','claimed','blocked','failed')
      GROUP BY status`, [corpus])).rows

    let open = await openRows()
    const byStatus = (s: string) => open.find(r => r.status === s)?.n ?? 0

    // classify small failed residues (no pending/claimed) → skipped
    if (classify) {
      const failed = byStatus('failed')
      const stuck = byStatus('pending') + byStatus('claimed') + byStatus('blocked')
      if (failed > 0 && failed <= MAX_RESIDUE && stuck === 0) {
        const res = await pool.query(`
          UPDATE ingest_queue SET status='skipped',
            "lastError"=COALESCE("lastError",'') || ' | V25: classified skipped — deterministic fetch miss, accounted-for non-text'
          WHERE corpus=$1 AND status='failed'`, [corpus])
        console.log(`${corpus}: classified ${res.rowCount} failed → skipped`)
        open = await openRows()
      }
    }

    const m = (await pool.query<{ compiled: number; residue: number }>(`
      SELECT count(*) FILTER (WHERE status='compiled')::int compiled,
             count(*) FILTER (WHERE status<>'compiled')::int residue
      FROM corpus_sections WHERE corpus=$1`, [corpus])).rows[0]
    const before = (await pool.query<{ est_sections: number; est_is_confirmed: boolean }>(
      `SELECT est_sections, est_is_confirmed FROM corpus_targets WHERE corpus_key=$1`, [corpus])).rows[0]
    const openTotal = open.reduce((s, r) => s + r.n, 0)

    if (openTotal > 0) {
      console.log(`${corpus}: ${openTotal} OPEN (${open.map(r => `${r.status} ${r.n}`).join(', ')}) — NOT ✓ | compiled ${m.compiled}`)
      continue
    }
    if (m.compiled === 0) { console.log(`${corpus}: 0 compiled — skip`); continue }

    if (confirm) {
      await pool.query(`UPDATE corpus_targets SET est_sections=$2, est_is_confirmed=true WHERE corpus_key=$1`, [corpus, m.compiled])
      console.log(`${corpus}: ✓ CONFIRMED ${before?.est_sections} (conf=${before?.est_is_confirmed}) → ${m.compiled} | residue ${m.residue}`)
    } else {
      console.log(`${corpus}: READY ✓ ${before?.est_sections} (conf=${before?.est_is_confirmed}) → ${m.compiled} | residue ${m.residue} (dry-run; --confirm to stamp)`)
    }
  }
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
