/**
 * v30-denominator-rebaseline.ts — V30 tidy-up §4. Fixes the honest-denominator
 * violation flagged this session: summed corpus_targets.est_sections (16.56M)
 * had fallen below actual compiled sections (17.65M compiled / 17.87M total),
 * and two corpora (legacy-legislation-section 914,274 rows, written-answers
 * 143 rows) had no corpus_targets row at all — a "lie of omission" per §1d.
 *
 * Methodology: reads counts from the latest hourly corpus_snapshots row (NOT a
 * live scan over corpus_sections — that 18M-row scan times out, the same class
 * of issue documented in INGEST_PLAYBOOK.md's "Breaker EVALUATION silently
 * stalled" postmortem). Per §1c, the denominator counts COMPILED sections
 * (residue is honest and excluded, not a violation) — so this only touches
 * corpora where actual_compiled > est_sections, not merely actual_total.
 *
 *   - Corpus with an empty ingest_queue backlog (no pending/claimed/failed/
 *     blocked rows) → est_sections = actual_compiled, est_is_confirmed = true.
 *   - Corpus still actively draining a small remainder → est_sections bumped
 *     up to actual_compiled (never left understated) but est_is_confirmed
 *     stays false/unchanged — re-run once fully drained to confirm.
 *   - The 2 orphan corpora get a fresh corpus_targets row at their measured
 *     count, confirmed=true (both are static/legacy, not actively fed by the
 *     Railway ingest queue).
 *
 * Idempotent (re-running after further drain just re-measures). Default mode
 * prints a dry-run plan; pass --apply to execute.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from './shared/neon-pool'

const APPLY = process.argv.includes('--apply')

async function main() {
  const pool = getNeonPool()

  const hourRes = await pool.query(`SELECT MAX(hour) AS hour FROM corpus_snapshots`)
  const hour = hourRes.rows[0].hour
  console.log(`using snapshot hour: ${hour}\n`)

  // ── corpora where actual_compiled > est_sections ───────────────────────────
  const violations = await pool.query(`
    SELECT ct.corpus_key, ct.est_sections, ct.est_is_confirmed,
           COALESCE(cs.compiled_count, 0)::bigint AS actual_compiled,
           NOT EXISTS (
             SELECT 1 FROM ingest_queue q
              WHERE q.corpus = ct.corpus_key AND q.status IN ('pending','claimed','failed','blocked')
           ) AS is_drained
      FROM corpus_targets ct
      LEFT JOIN corpus_snapshots cs ON cs.corpus_key = ct.corpus_key AND cs.hour = $1
     WHERE ct.retired IS NOT TRUE AND ct.est_sections IS NOT NULL
       AND COALESCE(cs.compiled_count, 0) > ct.est_sections
     ORDER BY (COALESCE(cs.compiled_count, 0) - ct.est_sections) DESC`, [hour])

  console.log('=== re-baseline: actual_compiled > est_sections ===')
  for (const r of violations.rows) {
    const newConfirmed = r.is_drained ? true : r.est_is_confirmed
    console.log(`  ${r.corpus_key.padEnd(24)} est ${r.est_sections} -> ${r.actual_compiled}  confirmed ${r.est_is_confirmed} -> ${newConfirmed}  (drained=${r.is_drained})`)
    if (APPLY) {
      await pool.query(
        `UPDATE corpus_targets SET est_sections=$2, est_is_confirmed=$3, updated_at=NOW() WHERE corpus_key=$1`,
        [r.corpus_key, r.actual_compiled, newConfirmed])
    }
  }

  // ── orphan corpora: no corpus_targets row at all ───────────────────────────
  const orphans = await pool.query(`
    SELECT cs.corpus_key, cs.compiled_count FROM corpus_snapshots cs
     LEFT JOIN corpus_targets ct ON ct.corpus_key = cs.corpus_key
    WHERE cs.hour = $1 AND ct.corpus_key IS NULL
    ORDER BY cs.compiled_count DESC`, [hour])

  console.log('\n=== new corpus_targets rows for orphan corpora (honest-denominator gap, §1d) ===')
  const LABELS: Record<string, string> = {
    'legacy-legislation-section': 'Legacy legislation sections (pre-Railway pipeline)',
    'written-answers': 'Written answers (legacy)',
  }
  for (const r of orphans.rows) {
    const label = LABELS[r.corpus_key] ?? r.corpus_key
    console.log(`  ${r.corpus_key.padEnd(28)} -> new row, est_sections=${r.compiled_count}, confirmed=true, "${label}"`)
    if (APPLY) {
      await pool.query(`
        INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, blocked, retired, notes, updated_at)
        VALUES ($1, $2, $3, true, false, false, 'V30 tidy-up — honest-denominator gap: this corpus had NO corpus_targets row despite live section data (§1d). Static/legacy source, not fed by the Railway ingest queue; est_sections is the measured count as of this pass.', NOW())
        ON CONFLICT (corpus_key) DO NOTHING`, [r.corpus_key, label, r.compiled_count])
    }
  }

  console.log(APPLY ? '\nAPPLIED.' : '\nDRY-RUN — re-run with --apply to execute.')
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
