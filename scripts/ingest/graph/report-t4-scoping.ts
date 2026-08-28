/**
 * report-t4-scoping.ts — T4 of `docs/CC_BRIEF_report_corpus.md`: the cheap
 * scoping row for the conditional fourth measure and the remaining unworked
 * ones. "Reference count and detection breakdown only."
 *
 * Writes `docs/report_run/scoping_remaining.csv` (+ a `.json` twin carrying the
 * resolution evidence the CSV has no room for).
 *
 * ── THE ONE JUDGEMENT CALL, MADE VISIBLE RATHER THAN HIDDEN ─────────────────
 *
 * `CCW_SPEC_starkey_workstreams.md` §3 names a target for some workstreams and
 * not others. WS-02 is "CRA 2005 Pt 3" — a statute. WS-08 is "Judicial review
 * restriction" — a policy, with no instrument named anywhere in the spec.
 *
 * A count against a statute nobody chose is worse than no count, so every row
 * carries `target_named_in_spec`. Where it is `no`, the instrument is MY
 * identification, the row says so, and the analysis track can strike it. And
 * every gid is RESOLVED BY EXACT TITLE MATCH against `corpus_acts` — the same
 * table the text detector resolves against — never typed from memory. The
 * matched title is carried in the JSON so the resolution can be checked.
 *
 * ⚠ Some workstreams have more than one candidate instrument. Collapsing them
 * to one row would mean choosing, which is the analysis track's call, so each
 * gets its own row under the same `ws_id`. The CSV is therefore one row per
 * (workstream, instrument), not one per workstream.
 *
 * ⚠ NO TOTAL COLUMN. markup, text and enabling are reported separately.
 *
 *   npx tsx graph/report-t4-scoping.ts
 */
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { CITATION_TABLE } from './setup-citation-edge-table'
import { EDGE_TABLE } from './graph-common'
import { inboundEvidence, expandPart } from './inbound'
import { MERGE_WARNING, toCsv, writeJson, writeText } from './report-common'

type Candidate = {
  ws_id: string
  measure: string          // verbatim from CCW_SPEC §3
  instrument_title: string // searched against corpus_acts.title
  provision_scope: string  // the Part named in the spec, or ''
  named_in_spec: boolean
  basis: string            // why this instrument is on the list
}

/**
 * ⚠ `measure` strings are copied verbatim from CCW_SPEC_starkey_workstreams.md
 * §3 so a reader can check them against the spec without translation.
 */
const CANDIDATES: Candidate[] = [
  // ── the conditional fourth measure ───────────────────────────────────────
  { ws_id: 'WS-02', measure: 'Supreme Court abolition; appellate jurisdiction returned to the Lords (CRA 2005 Pt 3)', instrument_title: 'Constitutional Reform Act 2005', provision_scope: 'part-3', named_in_spec: true, basis: 'named in the spec' },
  { ws_id: 'WS-03', measure: "Lord Chancellor's office and powers restored (CRA 2005 Pt 2; JAC)", instrument_title: 'Constitutional Reform Act 2005', provision_scope: 'part-2', named_in_spec: true, basis: 'named in the spec' },
  { ws_id: 'WS-03', measure: "Lord Chancellor's office and powers restored (CRA 2005 Pt 2; JAC)", instrument_title: 'Constitutional Reform Act 2005', provision_scope: 'part-4', named_in_spec: false, basis: 'the spec names "JAC" without a Part; the Judicial Appointments Commission is constituted by CRA 2005 Part 4 — MY identification, strike it if wrong' },

  // ── the remaining measures ───────────────────────────────────────────────
  { ws_id: 'WS-06', measure: 'Climate Change Act 2008 + the 2019 target order', instrument_title: 'Climate Change Act 2008', provision_scope: '', named_in_spec: true, basis: 'named in the spec' },
  { ws_id: 'WS-06', measure: 'Climate Change Act 2008 + the 2019 target order', instrument_title: 'The Climate Change Act 2008 (2050 Target Amendment) Order 2019', provision_scope: '', named_in_spec: true, basis: 'the spec names "the 2019 target order"; this is the instrument of that description, resolved by title against corpus_acts' },
  { ws_id: 'WS-07', measure: "Arm's-length body estate (~444 quangos)", instrument_title: 'Public Bodies Act 2011', provision_scope: '', named_in_spec: true, basis: 'named in the spec, as the instrument "for a subset"' },
  { ws_id: 'WS-08', measure: 'Judicial review restriction', instrument_title: 'Senior Courts Act 1981', provision_scope: '', named_in_spec: false, basis: 'the spec names NO instrument. s.31 is the judicial review jurisdiction — MY identification' },
  { ws_id: 'WS-08', measure: 'Judicial review restriction', instrument_title: 'Judicial Review and Courts Act 2022', provision_scope: '', named_in_spec: false, basis: 'the spec names NO instrument. The most recent statute restricting judicial review — MY identification' },
  { ws_id: 'WS-09', measure: 'Patronage restoration — judicial, KC, Regius appointments', instrument_title: 'Constitutional Reform Act 2005', provision_scope: 'part-4', named_in_spec: false, basis: 'the spec names NO instrument. Judicial appointments sit in CRA 2005 Part 4 — MY identification, and it overlaps WS-03' },
  { ws_id: 'WS-10', measure: 'Removal from office and public-employment disqualification', instrument_title: 'House of Commons Disqualification Act 1975', provision_scope: '', named_in_spec: false, basis: 'the spec names NO instrument — MY identification' },
  { ws_id: 'WS-11', measure: 'Non-crime hate incidents; College of Policing guidance; Sentencing Council powers', instrument_title: 'Coroners and Justice Act 2009', provision_scope: '', named_in_spec: false, basis: 'the spec names "Sentencing Council powers" without an Act; the Sentencing Council is constituted by CJA 2009 Part 4 — MY identification' },
  { ws_id: 'WS-11', measure: 'Non-crime hate incidents; College of Policing guidance; Sentencing Council powers', instrument_title: 'Police, Crime, Sentencing and Courts Act 2022', provision_scope: '', named_in_spec: false, basis: 'the spec names NO instrument for non-crime hate incidents — MY identification' },
  // ⚠ WS-12 has no repeal target: the spec says "Analysis only this phase" and
  // §6's task is definitional. The instruments below are the ones §6 names as
  // the EXISTING toolkit, scoped because the report's Part 4 asks what each
  // measure would run into, and a measure whose subject matter is already
  // legislated for runs into those Acts.
  { ws_id: 'WS-12', measure: 'Regulation of religio-political movements (analysis only this phase)', instrument_title: 'Terrorism Act 2000', provision_scope: '', named_in_spec: true, basis: 'named in CCW_SPEC §6 step 2 as part of the existing toolkit, NOT as a repeal target' },
  { ws_id: 'WS-12', measure: 'Regulation of religio-political movements (analysis only this phase)', instrument_title: 'Public Order Act 1986', provision_scope: 'part-III', named_in_spec: true, basis: 'named in CCW_SPEC §6 step 2 ("Public Order Act 1986 Pt 3") as part of the existing toolkit, NOT as a repeal target. ⚠ The CLML id is part-III, in Roman numerals — asking for "part-3" returns an unexpanded 3 rows against 232 act-level, which is why the expansion is checked and not assumed' },
  { ws_id: 'WS-12', measure: 'Regulation of religio-political movements (analysis only this phase)', instrument_title: 'Political Parties, Elections and Referendums Act 2000', provision_scope: '', named_in_spec: true, basis: 'named in CCW_SPEC §6 step 2 as part of the existing toolkit, NOT as a repeal target' },
  { ws_id: 'WS-12', measure: 'Regulation of religio-political movements (analysis only this phase)', instrument_title: 'National Security Act 2023', provision_scope: '', named_in_spec: true, basis: 'named in CCW_SPEC §6 step 2 as part of the existing toolkit, NOT as a repeal target' },
  { ws_id: 'WS-12', measure: 'Regulation of religio-political movements (analysis only this phase)', instrument_title: 'Charities Act 2011', provision_scope: '', named_in_spec: true, basis: 'named in CCW_SPEC §6 step 2 ("Charities Act political-purposes rules") as part of the existing toolkit, NOT as a repeal target' },
]

const CSV_COLUMNS = [
  'ws_id', 'measure', 'instrument_title', 'resolved_gid', 'provision_scope', 'target_named_in_spec',
  'markup', 'text', 'enabling', 'act_level_rows', 'distinct_source_instruments', 'made_under_edges', 'resolution', 'basis',
]

async function main() {
  const pool = getNeonPool()
  const rows: Array<Record<string, unknown>> = []
  const detail: unknown[] = []

  for (const c of CANDIDATES) {
    // resolve by EXACT title against the corpus's own title table
    const { rows: hit } = await pool.query(
      `SELECT gid, title, title_source FROM corpus_acts WHERE lower(title) = lower($1) ORDER BY gid LIMIT 5`,
      [c.instrument_title])
    if (hit.length !== 1) {
      const resolution = hit.length === 0
        ? 'NOT RESOLVED — no exact title match in corpus_acts'
        : `AMBIGUOUS — ${hit.length} instruments carry this exact title (${hit.map((h: { gid: string }) => h.gid).join(', ')})`
      console.log(`  ${c.ws_id.padEnd(6)} ${c.instrument_title.padEnd(58)} ⚠ ${resolution}`)
      rows.push({
        ws_id: c.ws_id, measure: c.measure, instrument_title: c.instrument_title,
        resolved_gid: '', provision_scope: c.provision_scope,
        target_named_in_spec: c.named_in_spec ? 'yes' : 'no',
        markup: '', text: '', enabling: '', act_level_rows: '', distinct_source_instruments: '', made_under_edges: '',
        resolution, basis: c.basis,
      })
      detail.push({ ...c, resolved_gid: null, resolution, candidates: hit })
      continue
    }
    const gid = hit[0].gid as string

    const by: Record<string, number> = { markup: 0, text: 0, enabling: 0 }
    let distinct = 0
    let resolution: string
    let actLevel: number | '' = ''

    if (c.provision_scope) {
      // ⚠⚠ THE PART IS EXPANDED TO ITS MEMBER PROVISIONS, from the Act's own
      // CLML. A literal match on the string 'part-2' returned ZERO on every
      // axis, and a bare zero in a scoping table reads as "nothing refers to the
      // Lord Chancellor provisions" — which is false, and false in the direction
      // that makes the measure look easy. References name SECTIONS, not Parts.
      const { rows: scoped } = await inboundEvidence(gid, c.provision_scope)
      for (const r of scoped) by[r.detection] = (by[r.detection] ?? 0) + 1
      distinct = new Set(scoped.map(r => r.source_gid)).size
      const exp = expandPart(gid, c.provision_scope)
      // ⚠ measured for THIS row, not asserted from another Act's behaviour
      const { rows: lit } = await pool.query(
        `SELECT COUNT(*)::int n FROM ${CITATION_TABLE} WHERE target_act_id = $1 AND target_provision_ref = $2`,
        [gid, c.provision_scope])
      // the act-level band travels with it: those rows name the Act and no
      // provision, and any of them may bear on this Part
      const { rows: al } = await pool.query(
        `SELECT COUNT(*)::int n FROM ${CITATION_TABLE} WHERE target_act_id = $1 AND target_provision_ref IS NULL`, [gid])
      actLevel = al[0].n
      resolution = exp.available
        ? `resolved by exact title match; '${c.provision_scope}' expanded to ${exp.refs.length} provision refs from the Act's own CLML (${exp.note}). ` +
          `A literal match on the bare string '${c.provision_scope}' returns ${lit[0].n} row(s) — references name sections, not Parts, which is why the Part is expanded. ` +
          `act_level_rows (${actLevel}) name the Act with no provision and are reported SEPARATELY: any of them may bear on this Part and the markup does not say which.`
        : `⚠⚠ THE PART COULD NOT BE EXPANDED — ${exp.note}. The counts on this row are a LITERAL match on the string ` +
          `'${c.provision_scope}' and nothing else, so they are a floor and probably a bad one. Do not quote them as this Part's exposure. ` +
          `act_level_rows (${actLevel}) is reported separately.`
    } else {
      const { rows: det } = await pool.query(
        `SELECT detection, COUNT(*)::int n FROM ${CITATION_TABLE} WHERE target_act_id = $1 GROUP BY 1`, [gid])
      for (const d of det) by[d.detection] = d.n
      const { rows: dist } = await pool.query(
        `SELECT COUNT(DISTINCT source_gid)::int n FROM ${CITATION_TABLE} WHERE target_act_id = $1`, [gid])
      distinct = dist[0].n
      resolution = 'resolved by exact title match; whole-Act counts'
    }
    const { rows: mu } = await pool.query(
      `SELECT COUNT(*)::int n FROM ${EDGE_TABLE} WHERE edge_type = 'made-under' AND split_part(to_id, ':', 2) = $1`, [gid])
    const dist = [{ n: distinct }]
    console.log(`  ${c.ws_id.padEnd(6)} ${c.instrument_title.slice(0, 46).padEnd(48)} ${gid.padEnd(15)} ${c.provision_scope.padEnd(8)} markup ${String(by.markup).padStart(4)}  text ${String(by.text).padStart(5)}  enabling ${String(by.enabling).padStart(4)}  (${dist[0].n} docs)`)

    rows.push({
      ws_id: c.ws_id, measure: c.measure, instrument_title: c.instrument_title,
      resolved_gid: gid, provision_scope: c.provision_scope,
      target_named_in_spec: c.named_in_spec ? 'yes' : 'no',
      markup: by.markup, text: by.text, enabling: by.enabling, act_level_rows: actLevel,
      distinct_source_instruments: dist[0].n, made_under_edges: mu[0].n,
      resolution, basis: c.basis,
    })
    detail.push({ ...c, resolved_gid: gid, resolved_title: hit[0].title, title_source: hit[0].title_source, counts_by_detection: by, act_level_rows: actLevel, distinct_source_instruments: dist[0].n, made_under_edges: mu[0].n, resolution })
  }

  writeText('scoping_remaining.csv', toCsv(rows, CSV_COLUMNS))
  writeJson('scoping_remaining.json', {
    generated_at: new Date().toISOString(),
    what_this_is:
      'Reference count and detection breakdown only, for the measures not worked at full depth. ' +
      'One row per (workstream, instrument): several workstreams name more than one instrument, and ' +
      'collapsing them would mean choosing between them, which is the analysis track\'s call.',
    merge_warning: MERGE_WARNING,
    caveats: [
      '⚠ target_named_in_spec = no means the instrument is CC\'s identification, not the programme spec\'s. Strike any row you disagree with; the count is only as good as the target.',
      '⚠ Every gid is resolved by EXACT title match against corpus_acts, the same table the text detector resolves against. The matched title and its title_source are carried here so the resolution can be checked.',
      '⚠⚠ Where provision_scope is set, the Part IS expanded to its member provisions from the Act\'s own CLML, exactly as inbound() does it. A LITERAL match on the string returns 0 on every axis for CRA 2005 Part 2, because references name sections and not Parts — a bare 0 there would have read as "nothing refers to the Lord Chancellor provisions", which is false, and false in the direction that makes the measure look easy.',
      '⚠ act_level_rows is reported SEPARATELY on Part-scoped rows and is never added in: those rows name the Act with no provision, any of them may bear on the Part, and the markup does not say which. It is a floor on unknown in-scope exposure, not noise.',
      '⚠ WS-12 has no repeal target. The spec says "Analysis only this phase". Its rows are the instruments CCW_SPEC §6 names as the EXISTING toolkit and must not be read as things the programme proposes to repeal.',
    ],
    rows: detail,
  })
  console.log(`\n  wrote docs/report_run/scoping_remaining.csv and .json (${rows.length} rows)`)

  // ── P5, scored ────────────────────────────────────────────────────────────
  const get = (title: string, axis: string) => {
    const r = rows.find(x => x.instrument_title === title && !x.provision_scope)
    return r ? Number(r[axis]) : NaN
  }
  console.log('\n══ P5 SCORED ══')
  console.log('  predicted: CRA 2005 > Climate Change Act 2008 > Public Bodies Act 2011, and PBA 2011 under 200 rows.')
  const { rows: cra } = await pool.query(
    `SELECT detection, COUNT(*)::int n FROM ${CITATION_TABLE} WHERE target_act_id = 'ukpga/2005/4' GROUP BY 1`)
  const craBy: Record<string, number> = { markup: 0, text: 0, enabling: 0 }
  for (const d of cra) craBy[d.detection] = d.n
  for (const axis of ['markup', 'text', 'enabling']) {
    const a = craBy[axis], b = get('Climate Change Act 2008', axis), c = get('Public Bodies Act 2011', axis)
    console.log(`    ${axis.padEnd(9)} CRA ${String(a).padStart(4)} > CCA ${String(b).padStart(4)} > PBA ${String(c).padStart(4)}  →  ${a > b && b > c ? 'HOLDS' : '⚠ BREAKS on this axis'}`)
  }
  const pbaAxes = ['markup', 'text', 'enabling'].map(a => get('Public Bodies Act 2011', a))
  console.log(`    Public Bodies Act 2011, largest single axis: ${Math.max(...pbaAxes)} — predicted under 200 on every axis: ${pbaAxes.every(n => n < 200) ? 'HOLDS' : '⚠ WRONG'}`)

  await endNeonPool()
}

if (require.main === module) {
  main().catch(e => { console.error('[t4] FATAL', e); process.exit(1) })
}
