/**
 * report-t1-inbound.ts — T1 of `docs/CC_BRIEF_report_corpus.md`: the reference
 * maps for WS-05, WS-01 and WS-04.
 *
 * Writes, per measure, into `docs/report_run/`:
 *   {ws_id}_inbound.json  — the full row set with evidence, plus the coverage
 *                           block EXACTLY as `getCoverage()` returned it
 *   {ws_id}_inbound.csv   — the same rows, flat, for the analysis track
 *
 * ── WHAT THIS FILE DELIBERATELY DOES NOT DO ─────────────────────────────────
 *
 * ⚠ IT EMITS NO MERGED TOTAL. `markup`, `text` and `enabling` are three
 * strengths of evidence. The brief: "A merged count is a wrong count, and it is
 * wrong in the direction that inflates the work." So every count is
 * per-detection, and the only whole-file number is `rows_in_this_file`, which
 * is labelled as a fact about the file.
 *
 * ⚠ IT DOES NOT TIDY THE COVERAGE BLOCK. It is generated from live state and
 * the report prints it as generated — verbatim, unedited, with its timestamp.
 *
 * ⚠ FOR WS-05 IT DOES NOT DECIDE WHAT COUNTS AS "PART 1". Every act-wide row is
 * carried and each is labelled with the band it falls in:
 *   `part-1`          — names a provision inside Part 1, as expanded from CRAG's
 *                       own CLML (not from an assumption about which sections
 *                       Part 1 contains)
 *   `act-level`       — names the Act and no provision. ⚠ This band is a FLOOR
 *                       on unknown Part-1 exposure, not noise: any of these may
 *                       bear on Part 1 and the markup does not say.
 *   `other-provision` — names a provision outside Part 1
 * Which bands the report counts is the analysis track's call, and it can only
 * make it if all three arrive labelled.
 *
 *   npx tsx graph/report-t1-inbound.ts
 */
import { endNeonPool } from '../shared/neon-pool'
import { inboundEvidence, inboundSummary, expandPart, InboundEvidenceRow } from './inbound'
import { describeCoverage } from './coverage'
import { MEASURES, MEASURE_T4, Measure, countsByDetection, MERGE_WARNING, toCsv, writeJson, writeText } from './report-common'

const CSV_COLUMNS = [
  'ws_id', 'target_act_id', 'target_provision_ref', 'scope_band', 'detection',
  'source_type', 'source_gid', 'source_doc_uri', 'source_provision_ref',
  'resolved', 'target_uri', 'citation_text', 'raw_fragment',
]

type BandedRow = InboundEvidenceRow & { ws_id: string; scope_band: string }

const rowKey = (r: InboundEvidenceRow) =>
  `${r.source_gid}|${r.source_provision_ref}|${r.target_uri}|${r.target_provision_ref}|${r.detection}|${r.citation_text}`

export async function runMeasure(m: Measure): Promise<{ rows: BandedRow[]; bands: Record<string, number> }> {
  console.log(`\n══ ${m.ws_id} — ${m.title} (${m.gid}) ══`)
  const { rows: actWide, coverage } = await inboundEvidence(m.gid)
  const summary = await inboundSummary(m.gid, 500)

  // ── band every row ────────────────────────────────────────────────────────
  let expansion: ReturnType<typeof expandPart> | null = null
  let inScope = new Set<string>()
  if (m.scope) {
    expansion = expandPart(m.gid, m.scope)
    console.log(`  Part expansion: available=${expansion.available} — ${expansion.note}`)
    if (!expansion.available) {
      console.error(`  ⚠⚠ ${m.ws_id}: the Part could not be expanded. Every row would be banded from the literal ` +
        `string '${m.scope}' alone, which UNDERSTATES the scope band. Reported, not papered over.`)
    }
    const { rows: scoped } = await inboundEvidence(m.gid, m.scope)
    inScope = new Set(scoped.map(rowKey))
  }

  const rows: BandedRow[] = actWide.map(r => ({
    ...r,
    ws_id: m.ws_id,
    scope_band: !m.scope
      ? 'whole-act'
      : inScope.has(rowKey(r)) ? m.scope
        : r.target_provision_ref === null ? 'act-level' : 'other-provision',
  }))

  const bands: Record<string, number> = {}
  for (const r of rows) bands[r.scope_band] = (bands[r.scope_band] ?? 0) + 1

  // ── report, per detection, never merged ───────────────────────────────────
  const byDet = countsByDetection(rows)
  console.log(`  detection (NOT a total): markup ${byDet.markup}, text ${byDet.text}, enabling ${byDet.enabling}`)
  console.log(`  scope bands: ${Object.entries(bands).map(([k, v]) => `${k} ${v}`).join(', ')}`)
  const perBandDet: Record<string, Record<string, number>> = {}
  for (const b of Object.keys(bands)) perBandDet[b] = countsByDetection(rows.filter(r => r.scope_band === b))
  for (const [b, d] of Object.entries(perBandDet))
    console.log(`      ${b}: markup ${d.markup}, text ${d.text}, enabling ${d.enabling}`)
  console.log(`  distinct source instruments: ${summary.distinctSourceActs}`)

  // ── write ─────────────────────────────────────────────────────────────────
  const jsonPath = writeJson(`${m.ws_id}_inbound.json`, {
    generated_at: new Date().toISOString(),
    measure: m,
    // ⚠ named so it cannot be read as an evidence total
    rows_in_this_file: rows.length,
    rows_in_this_file_note:
      'A count of the rows in this file, not a count of evidence. The three detection values are ' +
      'different strengths and are not summed anywhere in this deliverable.',
    counts_by_detection: byDet,
    counts_by_scope_band: bands,
    counts_by_scope_band_and_detection: perBandDet,
    scope_bands_explained: m.scope
      ? {
        [m.scope]: `names a provision inside ${m.scope}, expanded from the Act's own CLML`,
        'act-level': 'names the Act and no provision — a FLOOR on unknown in-scope exposure, not noise',
        'other-provision': `names a provision outside ${m.scope}`,
      }
      : { 'whole-act': 'the whole Act is the measure; no provision banding applies' },
    part_expansion: expansion,
    merge_warning: MERGE_WARNING,
    distinct_source_instruments: summary.distinctSourceActs,
    by_source_type: summary.bySourceType,
    by_source_act: summary.bySourceAct,
    by_detection: summary.byDetection,
    // ⚠ verbatim, unedited, with its own generation timestamp
    coverage,
    coverage_rendered: describeCoverage(coverage),
    rows,
  })
  const csvPath = writeText(`${m.ws_id}_inbound.csv`, toCsv(rows as unknown as Array<Record<string, unknown>>, CSV_COLUMNS))
  console.log(`  wrote ${jsonPath}`)
  console.log(`  wrote ${csvPath}`)
  return { rows, bands }
}

async function main() {
  const alsoT4 = process.argv.includes('--include-t4')
  const list = alsoT4 ? [...MEASURES, MEASURE_T4] : MEASURES
  if (alsoT4) console.log('⚠ --include-t4: running the CONDITIONAL fourth measure (CC_BRIEF_report_corpus.md §5).')

  const results: Array<{ m: Measure; byDet: Record<string, number> }> = []
  for (const m of list) {
    const { rows } = await runMeasure(m)
    results.push({ m, byDet: countsByDetection(rows) })
  }

  // ── the ordering control, restated from THIS run's numbers ────────────────
  // ⚠ Stated on each detection axis separately. The brief's expected ordering
  // is about references; summing the three axes to check it would break the
  // rule the check exists to protect.
  console.log('\n══ ORDERING CONTROL (brief §2: Equality Act > Human Rights Act > CRAG) ══')
  const by = (id: string) => results.find(r => r.m.ws_id === id)!.byDet
  for (const axis of ['markup', 'text', 'enabling'] as const) {
    const eq = by('WS-04')[axis], hr = by('WS-01')[axis], cr = by('WS-05')[axis]
    const holds = eq > hr && hr > cr
    console.log(`  ${axis.padEnd(9)} EqA ${String(eq).padStart(5)} > HRA ${String(hr).padStart(5)} > CRAG ${String(cr).padStart(5)}  →  ${holds ? 'HOLDS' : '⚠ BREAKS on this axis'}`)
  }
  console.log('  ⚠ The three axes are checked separately on purpose. If one breaks and the others hold,')
  console.log('    that is a fact about that kind of evidence, not a failure of the reference map.')

  await endNeonPool()
}

if (require.main === module) {
  main().catch(e => { console.error('[t1] FATAL', e); process.exit(1) })
}
