/**
 * ots-measured.ts — ADDENDUM C3 §1.3: mark `ots-reports` MEASURED, with 222 as a real denominator.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * ⚠⚠ TODAY THE DENOMINATOR IS THE NUMERATOR.
 *
 *     corpus_targets   ots-reports   est_sections = 497   est_is_confirmed = true
 *
 * 497 is the number of rows we hold. An estimate that equals the row count can never disagree with
 * it, so "100% complete" is arithmetic about itself — the same closed loop GRAPH 3B found behind
 * the storage alert line, and the same shape as a check that cannot fail.
 *
 * The real denominator comes from outside: the OTS was abolished in 2023 and gov.uk's own
 * `filter_organisations=office-of-tax-simplification` returns **222** documents — a closed, finite
 * universe, maintained by the publisher. That is one of the very few collections that can honestly
 * be called complete.
 *
 * ⚠ 222 DOCUMENTS IS NOT 222 REPORTS, and the note written into the row says so. Every row in this
 * collection has `format = null` and a median of 399 words: what is stored is the gov.uk landing
 * page. 143 of the 222 (64.4%) keep their substance in a PDF attachment nobody fetches. Recording
 * 222 without that sentence would trade one flattering number for another.
 *
 * ⚠ IT RE-READS THE UNIVERSE LIVE rather than trusting the number in this comment, and REFUSES if
 * gov.uk answers with something other than 222 — a denominator copied forward is an inference
 * travelling as a measurement.
 *
 * Usage:
 *   tsx c3a/ots-measured.ts             # dry run
 *   tsx c3a/ots-measured.ts --execute
 */
import { pool } from '../c2/db'

const EXECUTE = process.argv.includes('--execute')
const ORG = 'office-of-tax-simplification'
const UA = { 'User-Agent': 'ScrutiniseBot/1.0 (+https://www.scrutinise.org)' }
const NOTE = 'MEASURED 2026-08-26: the universe is the publisher\'s own filter_organisations='
  + ORG + ' = 222 documents. The OTS was abolished in 2023, so this is a CLOSED universe, not a '
  + 'snapshot. ⚠ 222 documents announced is not 222 documents held: every row is format=null (the '
  + 'gov.uk landing page, median 399 words) and 143 of the 222 keep their substance in a PDF '
  + 'attachment that is not fetched. Previous est_sections was 497 — our own row count, i.e. the '
  + 'denominator was the numerator.'

async function main() {
  const live = (await (await fetch(`https://www.gov.uk/api/search.json?filter_organisations=${ORG}&count=0`, { headers: UA })).json() as any).total
  console.log(`gov.uk reports ${live} documents for filter_organisations=${ORG}`)
  if (live !== 222) {
    console.log(`⛔ ABORT — expected 222. The universe has moved, so the number in this script is stale.`)
    console.log('   Re-measure and update the script deliberately; do not write a number nobody checked.')
    process.exit(1)
  }

  const p = pool()
  const before = (await p.query(
    `SELECT corpus_key, est_sections, est_is_confirmed, notes FROM corpus_targets WHERE corpus_key='ots-reports'`)).rows[0]
  const held = (await p.query(`SELECT count(*)::int n FROM corpus_sections WHERE corpus='ots-reports'`)).rows[0].n
  console.log(`\nbefore: est_sections=${before?.est_sections} confirmed=${before?.est_is_confirmed}`)
  console.log(`held today: ${held} rows`)
  if (before && before.est_sections === held) {
    console.log('⚠ the estimate EQUALS the row count — that is the defect this script exists to remove.')
  }

  if (!EXECUTE) {
    console.log(`\nDRY RUN — would set est_sections = 222, est_is_confirmed = true, and write the note.`)
    console.log('   note: ' + NOTE.slice(0, 120) + '…')
    await p.end(); return
  }
  await p.query(
    `UPDATE corpus_targets SET est_sections = 222, est_is_confirmed = true, notes = $1, updated_at = now()
      WHERE corpus_key = 'ots-reports'`, [NOTE])
  const after = (await p.query(
    `SELECT est_sections, est_is_confirmed, notes FROM corpus_targets WHERE corpus_key='ots-reports'`)).rows[0]
  console.log(`\nafter (re-read from the database, not assumed): est_sections=${after.est_sections} confirmed=${after.est_is_confirmed}`)
  console.log(`   notes: ${String(after.notes).slice(0, 100)}…`)
  if (after.est_sections !== 222) { console.log('⚠ MISMATCH'); process.exitCode = 1 }
  await p.end()
}
main().catch((e) => { console.error('FAIL', e.message ?? e); process.exit(1) })
