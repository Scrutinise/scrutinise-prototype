/**
 * record-4b-facts.ts — GRAPH 4B §4. This sprint's extraction-run statistics into
 * `graph_coverage_fact`, so the coverage block quotes them WITH THEIR AGE.
 *
 * ⚠ Every value is read from an audit's own JSON — never typed in. A re-keyed
 * number is a constant with extra steps.
 *
 * ⚠⚠ These four are here because they are properties of an EXTRACTION RUN over
 * a 1.4 GB snapshot, not of any row in the database. Everything that IS a
 * property of a row — the bridge's residual, schedule coverage, Layer 2's size —
 * is a live query in `coverage.ts` and must never be recorded here as well: two
 * sources for one figure is how they drift.
 *
 *   npx tsx graph/record-4b-facts.ts
 */
import fs from 'fs'
import path from 'path'
import { recordFact } from './setup-coverage-table'
import { endNeonPool } from '../shared/neon-pool'

const HERE = __dirname
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(HERE, f), 'utf8'))

async function main() {
  const sched = read('audit-4b-schedules.json')
  const layer2 = read('audit-4b-layer2.json')
  const tax = read('audit-4b-tax.json')
  const identity = read('audit-4b-identity.json')

  const facts: Array<[string, number, string, string]> = [
    ['si_schedule_retention_pct', Math.round(sched.matched.retentionPct * 10) / 10,
     'percentage of sampled instruments whose bulk-CLML schedule also reached the corpus as a schedule section. ' +
     'A schedule the ingest dropped presents as a SHORT DOCUMENT, not as an error, so this bounds every answer ' +
     'that depends on scheduled text — a treaty above all.',
     'graph/audit-4b-schedules.ts'],

    ['dta_orders_recoverable_from_held_bytes', tax.q1.recoverableFromHeldBytes ?? tax.q1.recoverableFromBytesWeHold,
     'double taxation Orders whose scheduled agreement is ABSENT from the corpus but PRESENT in the bulk CLML ' +
     'already on disk. No fetch is needed to recover these; an ingest pass is. The remainder need the source.',
     'graph/audit-4b-tax.ts'],

    ['madeunder_section_refs_wrong_pct', Math.round(layer2.parserDefect.pctOfOldSectionRefsWrong * 10) / 10,
     'percentage of the pre-2026-08-28 preamble parser\'s SECTION-level refs that were wrong — a bracketed ' +
     'subsection read as a section, or a ref list attached to a different Act named in the same preamble. ' +
     'legislation_edges still holds them; citation_edge\'s enabling rows were written by the fixed parser.',
     'graph/audit-4b-layer2.ts'],

    ['identity_ambiguous_calendar_forms', identity.bridge.ambiguousForms,
     'calendar-year id forms that name MORE THAN ONE Act, because two parliamentary sessions can fall inside ' +
     'one calendar year and each numbers its chapters from the start. REFUSED a bridge and recorded as refusals, ' +
     'never resolved by first-wins.',
     'graph/audit-4b-identity.ts'],
  ]

  console.log('[4b-facts] recorded:')
  for (const [key, n, note, by] of facts) {
    if (n == null || Number.isNaN(n)) throw new Error(`[4b-facts] ${key} is not a number — refusing to record a null as a measurement`)
    await recordFact(key, n, note, by)
    console.log(`  ${key.padEnd(40)} = ${n}`)
  }
  await endNeonPool()
}

if (require.main === module) {
  main().catch(e => { console.error('[4b-facts] FATAL', e); process.exit(1) })
}
