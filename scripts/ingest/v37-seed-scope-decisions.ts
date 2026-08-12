/**
 * v37-seed-scope-decisions.ts — ADDENDUM_V36_SEED_ORDER §2: record apni, ukcm and
 * ukci as corpus targets.
 *
 * These were the three doctypes V37's citation audit flagged as `needs-a-decision`
 * — no ingest route and no recorded reason for not having one. Charlie's answers:
 *
 *   apni  INGEST — Acts of the Parliament of Northern Ireland 1921–1972. Fifty years
 *                  of NI primary legislation with nothing in the corpus for the
 *                  period; we hold nia (2000+) and nisi Orders in Council and a
 *                  five-decade hole between them. 2,602 references from material we
 *                  already hold. Much of it is still in force.
 *   ukcm  INGEST — Church Measures. Passed by General Synod, with THE FORCE OF AN ACT
 *                  of Parliament. 6,803 references; ukcm/1969/2 alone carries 1,108.
 *   ukci  INGEST — Church Instruments, alongside ukcm. Splitting them would leave the
 *                  Measures without their subordinate instruments, which is the same
 *                  mistake as holding an Act without its regulations.
 *
 * ⚠ THESE ARE TARGETS, NOT PART OF THE V36 RECOVERY RUN. The addendum is explicit:
 * "Folding a new source into a recovery sprint is how a run stops being
 * attributable." So this writes corpus_targets rows and seeds NO queue rows. The
 * ingest gets its own prediction and its own run.
 *
 * est_sections is deliberately NULL with est_is_confirmed=false: no pilot has been
 * run, and a guessed estimate in that column is exactly the "placeholder that looked
 * like data" this codebase keeps paying for.
 *
 * Usage: tsx v37-seed-scope-decisions.ts [--apply]
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { getNeonPool, endNeonPool } from './shared/neon-pool'

const APPLY = process.argv.includes('--apply')

const TARGETS = [
  { key: 'apni', label: 'Acts of the Parliament of Northern Ireland (1921–1972)',
    note: 'V37 scope decision, 12 Aug 2026: INGEST. 1,264 instruments / 2,602 citation references; the corpus holds nia (2000+) and nisi and nothing for 1921–1972. Not yet seeded — needs its own prediction (addendum §2).' },
  { key: 'ukcm', label: 'Church Measures',
    note: 'V37 scope decision, 12 Aug 2026: INGEST. 245 instruments / 6,803 citation references; a Measure has the force of an Act of Parliament. Not yet seeded — needs its own prediction (addendum §2).' },
  { key: 'ukci', label: 'Church Instruments',
    note: 'V37 scope decision, 12 Aug 2026: INGEST alongside ukcm — subordinate instruments to the Measures. Not yet seeded — needs its own prediction (addendum §2).' },
]

async function main() {
  const pool = getNeonPool()
  const { rows: cols } = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='corpus_targets'`)
  const hasNote = cols.some(c => c.column_name === 'note')

  for (const t of TARGETS) {
    const { rows: existing } = await pool.query(
      `SELECT corpus_key, est_sections, est_is_confirmed FROM corpus_targets WHERE corpus_key = $1`, [t.key])
    console.log(`${t.key.padEnd(6)} ${existing.length ? 'ALREADY PRESENT' : 'to add'}  ${t.label}`)
    if (!APPLY || existing.length) continue
    await pool.query(
      hasNote
        ? `INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, blocked, note)
           VALUES ($1, $2, NULL, false, false, $3) ON CONFLICT (corpus_key) DO NOTHING`
        : `INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, blocked)
           VALUES ($1, $2, NULL, false, false) ON CONFLICT (corpus_key) DO NOTHING`,
      hasNote ? [t.key, t.label, t.note] : [t.key, t.label])
  }

  if (!APPLY) { console.log('\n[scope] REPORT ONLY — re-run with --apply'); await endNeonPool(); return }

  // Read back. An INSERT's rowCount says the statement ran, not that the table says
  // what we think it says.
  const { rows: after } = await pool.query(
    `SELECT corpus_key, display_label, est_sections, est_is_confirmed FROM corpus_targets
     WHERE corpus_key = ANY($1::text[]) ORDER BY corpus_key`, [TARGETS.map(t => t.key)])
  console.log(`\n[scope] verified ${after.length}/3 target rows:`)
  for (const r of after) console.log(`  ${r.corpus_key.padEnd(6)} est=${r.est_sections ?? 'NULL'} confirmed=${r.est_is_confirmed}  ${r.display_label}`)
  const { rows: [q] } = await pool.query(
    `SELECT count(*)::int AS n FROM ingest_queue WHERE corpus = ANY($1::text[])`, [TARGETS.map(t => t.key)])
  console.log(`[scope] queue rows seeded for these corpora: ${q.n} — MUST be 0 (targets, not a run)`)
  if (after.length !== 3 || q.n !== 0) process.exitCode = 1
  await endNeonPool()
}

main().catch(e => { console.error(e); process.exitCode = 1 })
