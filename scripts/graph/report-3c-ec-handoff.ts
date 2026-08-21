/**
 * report-3c-ec-handoff.ts — GRAPH 3C §4.2. What acquiring the missing Companies House numbers
 * would take, priced, and the work-list emitted so it can be handed over rather than described.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS EMITS A LIST AND NOT AN INGEST
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * Design §3: **the graph never creates organisations.** 3B's D-10 says the same thing and sends the
 * numbers to the entity sweep. Brief §4.2 says *"Report what acquiring them would take; build it
 * only if it is small."*
 *
 * The honest reading is that the acquiring is not the graph's to build at all — but the WORK-LIST
 * is, because it is a query over a table the graph owns, and a handoff that arrives as a paragraph
 * is a handoff that gets re-derived by whoever picks it up. So this emits the list, ordered by what
 * each number would unlock, and stops there.
 *
 * ⚠ AND IT CORRECTS D-10'S HEADLINE NUMBER. 3B says *"roughly 11× the current yield"*, from
 * 14,879 unheld-number rows against 1,489 held ones. That is the ratio of ROWS, and rows are not
 * signals: a donation only becomes a signal when BOTH ends resolve, and the donee resolves on only
 * 8.6% of them. The measured ceiling is 7.7×, not 11×. Better than it sounds, too — see below.
 *
 * Usage (from scripts/graph):
 *   npx tsx report-3c-ec-handoff.ts          # print the summary
 *   npx tsx report-3c-ec-handoff.ts --write  # …and write the CSV work-list
 */
import fs from 'fs'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'

export {}

const WRITE = process.argv.includes('--write')
const OUT = path.join(__dirname, 'ec-companies-to-acquire.csv')

async function main() {
  const pool = getNeonPool()
  try {
    const host = /@([^/:?]+)/.exec(process.env.NEON_DATABASE_URL ?? '')?.[1] ?? '(unparsed)'
    if (!/ep-old-dust-aboxi69a/.test(host)) { console.error(`❌ not Neon production (${host})`); process.exit(1) }
    console.log(`host ${host}`)

    // ── 1 · the ceiling, computed as SIGNALS rather than as rows ─────────────────────────────
    const { rows: [c] } = await pool.query<Record<string, string>>(`
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE donor_resolution = 'resolved:companies-house-no')::text AS donor_held,
        COUNT(*) FILTER (WHERE donor_resolution = 'unresolved:number-not-held')::text AS donor_unheld,
        COUNT(DISTINCT company_registration_number)
          FILTER (WHERE donor_resolution = 'unresolved:number-not-held')::text AS companies,
        COUNT(*) FILTER (WHERE donee_entity_id IS NOT NULL AND donor_entity_id IS NOT NULL
                           AND accepted_date IS NOT NULL)::text AS signals_now,
        COUNT(*) FILTER (WHERE donee_entity_id IS NOT NULL
                           AND donor_resolution = 'unresolved:number-not-held'
                           AND accepted_date IS NOT NULL)::text AS signals_unlocked
      FROM position_donation`)

    const now = Number(c.signals_now)
    const unlocked = Number(c.signals_unlocked)
    console.log(`\n════ §4.2 · THE CEILING, IN SIGNALS RATHER THAN IN ROWS ════`)
    console.log(`  published records                                    ${Number(c.total).toLocaleString().padStart(8)}`)
    console.log(`  donor CH number we HOLD                              ${Number(c.donor_held).toLocaleString().padStart(8)}`)
    console.log(`  donor CH number we DO NOT hold                       ${Number(c.donor_unheld).toLocaleString().padStart(8)}   ← 3B's "11×" is this ÷ the line above`)
    console.log(`  DISTINCT companies behind those rows                 ${Number(c.companies).toLocaleString().padStart(8)}   ← the actual work-list length`)
    console.log(`\n  rows that are a SIGNAL today (both ends + a date)     ${now.toLocaleString().padStart(8)}`)
    console.log(`  rows that would become one (donee already resolves)   ${unlocked.toLocaleString().padStart(8)}`)
    console.log(`  ⇒ ceiling ${(now + unlocked).toLocaleString()} signals, a ${((now + unlocked) / Math.max(1, now)).toFixed(1)}× widening — NOT 11×.`)
    console.log(`    The rows/signals distinction is the whole difference: a donation is only a signal`)
    console.log(`    when BOTH ends resolve, and the donee resolves on 8.6% of the register.`)

    // ── 2 · what acquiring them would take ──────────────────────────────────────────────────
    const perFive = 600
    const minutes = Math.ceil(Number(c.companies) / perFive) * 5
    console.log(`\n════ WHAT ACQUIRING THEM WOULD TAKE ════`)
    console.log(`  route A · Companies House REST API, one lookup per number`)
    console.log(`            ${Number(c.companies).toLocaleString()} numbers ÷ ${perFive} requests per 5 minutes = ~${minutes} minutes of wall clock.`)
    console.log(`            ⚠ needs COMPANIES_HOUSE_API_KEY, which is NOT in scrutinise-web/.env (3B's D-12).`)
    console.log(`            Free to obtain. This is a small job — an afternoon — but it is the ENTITY`)
    console.log(`            SWEEP's job, not the graph's: design §3 forbids the graph creating organisations.`)
    console.log(`  route B · Companies House bulk product (the free monthly full-company snapshot)`)
    console.log(`            No key, no rate limit, but a multi-GB download to join ${Number(c.companies).toLocaleString()} numbers against.`)
    console.log(`            Worth it only if the entity sweep wants the whole register anyway.`)
    console.log(`  ⇒ RECOMMEND route A, run by the entity sweep, with the work-list below as its input.`)

    // ── 3 · the work-list, ordered by what each number unlocks ──────────────────────────────
    const { rows } = await pool.query<{
      crn: string; donor_name: string; rows_total: string; rows_unlocking: string
      members: string; first_date: string | null; last_date: string | null; pence: string }>(`
      SELECT company_registration_number AS crn,
             (ARRAY_AGG(donor_name ORDER BY accepted_date DESC NULLS LAST))[1] AS donor_name,
             COUNT(*)::text AS rows_total,
             COUNT(*) FILTER (WHERE donee_entity_id IS NOT NULL AND accepted_date IS NOT NULL)::text AS rows_unlocking,
             COUNT(DISTINCT donee_entity_id) FILTER (WHERE donee_entity_id IS NOT NULL)::text AS members,
             MIN(accepted_date)::text AS first_date,
             MAX(accepted_date)::text AS last_date,
             COALESCE(SUM(value_pence), 0)::text AS pence
        FROM position_donation
       WHERE donor_resolution = 'unresolved:number-not-held'
       GROUP BY 1
       ORDER BY COUNT(*) FILTER (WHERE donee_entity_id IS NOT NULL AND accepted_date IS NOT NULL) DESC,
                COUNT(*) DESC`)

    console.log(`\n════ THE WORK-LIST — ${rows.length.toLocaleString()} companies, top 20 by signals unlocked ════`)
    console.log(`  ${'CRN'.padEnd(10)} ${'unlocks'.padStart(7)} ${'rows'.padStart(6)} ${'members'.padStart(7)}  donor as published`)
    for (const r of rows.slice(0, 20)) {
      console.log(`  ${r.crn.padEnd(10)} ${Number(r.rows_unlocking).toString().padStart(7)} ${Number(r.rows_total).toString().padStart(6)} ` +
        `${Number(r.members).toString().padStart(7)}  ${(r.donor_name ?? '').slice(0, 52)}`)
    }
    const zero = rows.filter((r) => Number(r.rows_unlocking) === 0).length
    console.log(`\n  ⚠ ${zero.toLocaleString()} of ${rows.length.toLocaleString()} companies (${((100 * zero) / rows.length).toFixed(1)}%) unlock NOTHING —`)
    console.log(`    every one of their donations went to a party, or to a donee this graph will not name.`)
    console.log(`    Acquiring all 4,458 is therefore the WRONG shape of job for the graph's purposes;`)
    console.log(`    the ${(rows.length - zero).toLocaleString()} that unlock something are the list worth handing over, and they are the`)
    console.log(`    first ${(rows.length - zero).toLocaleString()} rows of the CSV because it is sorted that way.`)

    // ── 4 · ⚠ A DEFECT IN THE EXISTING RESOLUTION, VISIBLE IN THE WORK-LIST ITSELF ──────────
    //
    // The top-20 list contains `9630980` AND `09630980` (Labour Together), `8114952` AND
    // `08114952` (Conservative Friends of Israel), `7213374` AND `07213374` (MPM Connect). The
    // Commission publishes the same company's number with and without its leading zero.
    //
    // ⚠ NORMALISING THIS IS NOT FUZZY MATCHING AND THE DISTINCTION MATTERS. A Companies House
    // number is an 8-character zero-padded identifier BY DEFINITION; `9630980` and `09630980` are
    // the same string under the format's own rules, exactly as `1e3` and `1000` are the same
    // number. The standing rule forbids merging identities on SIMILARITY — on a judgement that two
    // different keys probably mean one thing. This is the opposite: one key, written two ways.
    const { rows: [pad] } = await pool.query<Record<string, string>>(`
      WITH norm AS (
        SELECT company_registration_number AS raw,
               CASE WHEN company_registration_number ~ '^[0-9]+$'
                    THEN lpad(company_registration_number, 8, '0')
                    ELSE upper(company_registration_number) END AS n,
               donor_resolution, donee_entity_id, accepted_date
          FROM position_donation
         WHERE company_registration_number IS NOT NULL AND company_registration_number <> '')
      SELECT COUNT(*) FILTER (WHERE raw <> n)::text AS rows_unpadded,
             COUNT(DISTINCT n) FILTER (WHERE raw <> n)::text AS companies_unpadded,
             (SELECT COUNT(*)::text FROM norm x
               WHERE x.donor_resolution = 'unresolved:number-not-held'
                 AND EXISTS (SELECT 1 FROM graph_entity g
                              WHERE lpad(g.companies_house_no, 8, '0') = x.n)) AS would_now_resolve,
             (SELECT COUNT(*)::text FROM norm x
               WHERE x.donor_resolution = 'unresolved:number-not-held'
                 AND x.donee_entity_id IS NOT NULL AND x.accepted_date IS NOT NULL
                 AND EXISTS (SELECT 1 FROM graph_entity g
                              WHERE lpad(g.companies_house_no, 8, '0') = x.n)) AS new_signals
        FROM norm`)
    console.log(`\n════ ⚠ AND A DEFECT IN THE RESOLUTION WE ALREADY HAVE ════`)
    console.log(`  register rows whose CH number is not zero-padded to 8   ${Number(pad.rows_unpadded).toLocaleString().padStart(7)}`)
    console.log(`  distinct companies affected                            ${Number(pad.companies_unpadded).toLocaleString().padStart(7)}`)
    console.log(`  rows that would resolve TODAY on a padded comparison    ${Number(pad.would_now_resolve).toLocaleString().padStart(7)}`)
    console.log(`  …of which would become SIGNALS                          ${Number(pad.new_signals).toLocaleString().padStart(7)}`)
    if (Number(pad.would_now_resolve) === 0) {
      console.log(`  ⇒ ⚠⚠ ZERO TODAY, AND THAT IS THE DANGEROUS ANSWER, NOT THE REASSURING ONE.`)
      console.log(`    The defect costs nothing right now only because we hold NONE of those 1,833`)
      console.log(`    companies under either spelling. The moment the entity sweep acquires them, a`)
      console.log(`    padded store meeting an unpadded register produces a join that silently misses`)
      console.log(`    ${Number(pad.rows_unpadded).toLocaleString()} rows and looks exactly like "those donors are not in the register".`)
      console.log(`    So it must be fixed BEFORE the acquisition, not diagnosed after it.`)
    }
    console.log(`  ⇒ Normalising is a FORMAT change to an exact key, not a similarity match: a CH`)
    console.log(`    number is 8 characters zero-padded by definition, so 9630980 and 09630980 are one`)
    console.log(`    key written two ways — not two keys judged to probably mean one thing. It is still`)
    console.log(`    a change to the identity rule, so it is REPORTED as decision D-6 and NOT applied here.`)

    if (WRITE) {
      // ⚠ Newlines are stripped from the donor name before quoting. They are correctly escaped by
      // RFC 4180 quoting either way, but the read-back below counts lines — and the first run
      // reported "4,462 data rows" for 4,458 companies because four published donor names contain
      // a line break. A verification that miscounts is worse than none: it looks like a discrepancy
      // in the data rather than in the check.
      const esc = (s: string | null) => `"${(s ?? '').replace(/\s+/g, ' ').trim().replace(/"/g, '""')}"`
      const csv = [
        'company_registration_number,donor_name_as_published,donation_rows,rows_that_would_become_signals,distinct_members,first_accepted,last_accepted,total_pence',
        ...rows.map((r) => [r.crn, esc(r.donor_name), r.rows_total, r.rows_unlocking, r.members,
          r.first_date ?? '', r.last_date ?? '', r.pence].join(',')),
      ].join('\n')
      fs.writeFileSync(OUT, csv, 'utf8')
      console.log(`\n  ✓ work-list written: ${OUT} (${(Buffer.byteLength(csv) / 1024).toFixed(0)} KB, ${rows.length.toLocaleString()} rows)`)
      // Read it back — a byte count from a write says what the driver thought it sent.
      const back = fs.readFileSync(OUT, 'utf8').split('\n')
      console.log(`  ✓ read back: ${(back.length - 1).toLocaleString()} data rows, header "${back[0].slice(0, 60)}…"`)
    } else {
      console.log(`\n  (--write to emit the CSV work-list)`)
    }
  } finally {
    await endNeonPool()
  }
}

main().catch((e) => { console.error('[report-3c-ec-handoff] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
