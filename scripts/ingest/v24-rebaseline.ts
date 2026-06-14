/**
 * v24-rebaseline.ts — V24 §1: ✓ re-baseline the settled corpora.
 *
 * Same guard as v23-rebaseline (INGEST_PLAYBOOK §1c): a denominator is ✓ only
 * when it equals the measured compiled count AND zero queue rows remain open
 * (pending/claimed/blocked/failed). Classified residue (skipped / non-'compiled'
 * availability markers) does NOT block ✓ — it is accounted-for non-text.
 *
 * V24 candidate set adds historic-hansard (Lords 1919-1999 tranche + HTML gap-fill
 * have drained — only 2 deterministic gapday misses, now classified skipped) and
 * quangos-govuk T1 to the V23 list. Re-runnable: still-draining corpora print
 * their open breakdown and are skipped, not stamped.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'

const CANDIDATES = [
  'retained-eu', 'si-2010plus', 'committees-reports', 'committees-evidence',
  'explanatory-notes', 'explanatory-memoranda', 'ni-judgments',
  'historic-hansard', 'quangos-govuk',
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
    const before = await pool.query<{ est_sections: number; est_is_confirmed: boolean }>(
      `SELECT est_sections, est_is_confirmed FROM corpus_targets WHERE corpus_key=$1`, [corpus])
    const openTotal = open.rows.reduce((s, r) => s + r.n, 0)
    const compiled = m.rows[0].compiled
    const residue = m.rows[0].residue
    const wasEst = before.rows[0]?.est_sections ?? null
    const wasConf = before.rows[0]?.est_is_confirmed ?? null

    if (openTotal > 0) {
      const brk = open.rows.map(r => `${r.status} ${r.n}`).join(', ')
      console.log(`${corpus}: ${openTotal} OPEN (${brk}) — NOT ✓ | compiled so far ${compiled}`)
      continue
    }
    if (compiled === 0) { console.log(`${corpus}: 0 compiled — skip`); continue }

    if (confirm) {
      await pool.query(`UPDATE corpus_targets SET est_sections=$2, est_is_confirmed=true WHERE corpus_key=$1`, [corpus, compiled])
      console.log(`${corpus}: ✓ CONFIRMED  ${wasEst} (conf=${wasConf}) → ${compiled}  | residue ${residue}`)
    } else {
      console.log(`${corpus}: READY ✓  ${wasEst} (conf=${wasConf}) → ${compiled}  | residue ${residue} (dry-run; pass --confirm)`)
    }
  }
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
