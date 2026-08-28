/**
 * report-t3-gates.ts — T3 of `docs/CC_BRIEF_report_corpus.md`.
 *
 * ⚠ RETRIEVAL, NOT ANALYSIS. Whether a gate is engaged is the analysis track's
 * call. This puts the words in front of them. Nothing in this file decides
 * anything, and every text it emits is the statute's own, from the local CLML.
 *
 * Writes `docs/report_run/gates_{ws_id}.json` per measure:
 *
 *   devolution              Scotland Act 1998 s.29 and Sch 6; Government of Wales
 *                           Act 2006 s.108A; Northern Ireland Act 1998 s.6 and
 *                           Sch 10 — full text, plus every inbound reference
 *                           FROM those three Acts TO the target
 *   northern_ireland        NIA 1998 s.76, and the fair employment provisions,
 *                           found by searching the Act rather than assumed
 *   instrument_allocation   the enabling powers the target CONFERS, each with
 *                           the instruments made under it — this is what tells
 *                           the report which statutory instruments fall with the
 *                           parent
 *   supreme_court_devolution_jurisdiction
 *                           the one question the brief asks to be checked and
 *                           not concluded: does the Supreme Court hold the
 *                           devolution reference jurisdiction under Scotland Act
 *                           1998 Sch 6 and Northern Ireland Act 1998 Sch 10?
 *                           ⚠ What the statutes SAY, quoted. No conclusion.
 *
 * ⚠ AN ENABLING EDGE IS NOT A MENTION AND IS NOT COUNTED WITH ONE. An
 * instrument that merely mentions an Act survives its repeal; an instrument
 * whose enabling power is repealed may fall with it. That distinction is the
 * whole point of the instrument-allocation section.
 *
 *   npx tsx graph/report-t3-gates.ts [--include-t4]
 */
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { CITATION_TABLE } from './setup-citation-edge-table'
import { EDGE_TABLE } from './graph-common'
import {
  MEASURES, MEASURE_T4, Measure, DocVersion, readDocWithVersion, provisionSlice, flattenClml,
  countsByDetection, MERGE_WARNING, writeJson, closeZip, versionsHeld,
} from './report-common'

// ── the gate statutes ───────────────────────────────────────────────────────

const SCOTLAND = 'ukpga/1998/46'
const WALES = 'ukpga/2006/32'
const NI = 'ukpga/1998/47'

const GATE_ACTS: Record<string, string> = {
  [SCOTLAND]: 'Scotland Act 1998',
  [WALES]: 'Government of Wales Act 2006',
  [NI]: 'Northern Ireland Act 1998',
}

type Want = { gate: string; gid: string; ref: string; why: string; named_in_brief: boolean }

const DEVOLUTION_ITEMS: Want[] = [
  { gate: 'devolution', gid: SCOTLAND, ref: 'section-29', why: 'legislative competence of the Scottish Parliament', named_in_brief: true },
  { gate: 'devolution', gid: SCOTLAND, ref: 'schedule-6', why: 'devolution issues — Scotland', named_in_brief: true },
  { gate: 'devolution', gid: WALES, ref: 'section-108A', why: "legislative competence of the Senedd", named_in_brief: true },
  { gate: 'devolution', gid: NI, ref: 'section-6', why: 'legislative competence of the Northern Ireland Assembly', named_in_brief: true },
  { gate: 'devolution', gid: NI, ref: 'schedule-10', why: 'devolution issues — Northern Ireland', named_in_brief: true },
  // ⚠ Not in the brief's list, and retrieved anyway with the reason stated. The
  // brief asks whether the Supreme Court holds the devolution reference
  // jurisdiction; Scotland and Northern Ireland have a named schedule for it and
  // Wales does not appear in the list at all. Retrieving Wales's equivalent lets
  // the analysis track see for itself rather than infer from a silence.
  { gate: 'devolution', gid: WALES, ref: 'schedule-9', why: "devolution issues — Wales; NOT named in the brief, retrieved so the Welsh position is not inferred from a gap", named_in_brief: false },
]

const NI_ITEMS: Want[] = [
  { gate: 'northern_ireland', gid: NI, ref: 'section-76', why: 'discrimination by public authorities', named_in_brief: true },
  { gate: 'northern_ireland', gid: NI, ref: 'section-75', why: 'statutory equality duty; retrieved with s.76 because the two operate together and the brief names "the fair employment provisions" without a section number', named_in_brief: false },
]

// ── retrieval ───────────────────────────────────────────────────────────────

export type GateItem = {
  gate: string
  act_gid: string
  act_title: string
  provision_ref: string
  heading: string | null
  text: string | null
  words: number
  source_url: string
  document_version: DocVersion | null
  versions_held: DocVersion[]
  named_in_brief: boolean
  why: string
  /** ⚠ present, and non-null, ONLY when retrieval failed. A gap says so. */
  retrieval_failure: string | null
}

function headingOf(slice: string): string | null {
  const t = slice.match(/<(?:Title|TitleBlock)\b[^>]*>([\s\S]*?)<\/(?:Title|TitleBlock)>/)
  return t ? flattenClml(t[1]) || null : null
}

export function retrieve(w: Want): GateItem {
  const versions = versionsHeld(w.gid)
  const d = readDocWithVersion(w.gid)
  const base = {
    gate: w.gate, act_gid: w.gid, act_title: GATE_ACTS[w.gid] ?? w.gid,
    provision_ref: w.ref, named_in_brief: w.named_in_brief, why: w.why,
    source_url: `https://www.legislation.gov.uk/${w.gid}/${w.ref.replace(/-/g, '/')}`,
    versions_held: versions, document_version: d?.version ?? null,
  }
  if (!d) return { ...base, heading: null, text: null, words: 0, retrieval_failure: `${w.gid} is not in the local bulk CLML file` }
  const slice = provisionSlice(d.xml, w.ref)
  if (!slice) return { ...base, heading: null, text: null, words: 0, retrieval_failure: `${w.gid} holds no element with id="${w.ref}" in its ${d.version} copy` }
  const text = flattenClml(slice)
  return { ...base, heading: headingOf(slice), text, words: text.split(/\s+/).filter(Boolean).length, retrieval_failure: null }
}

/**
 * The fair employment provisions, FOUND rather than assumed.
 *
 * The brief names "the fair employment provisions" without a section number,
 * and guessing one is exactly the kind of uncited assertion this programme
 * treats as a defect. So the Act is searched for the phrase and every provision
 * carrying it is returned with its own words.
 */
export function fairEmploymentProvisions(): GateItem[] {
  const d = readDocWithVersion(NI)
  if (!d) return []
  const out: GateItem[] = []
  const seen = new Set<string>()
  for (const m of d.xml.matchAll(/fair employment/gi)) {
    // walk back to the nearest enclosing element that carries a structural id
    const before = d.xml.slice(0, m.index!)
    const ids = [...before.matchAll(/\sid="((?:section|schedule|part|article|regulation)[^"]*)"/g)]
    if (!ids.length) continue
    const ref = ids[ids.length - 1][1]
    // the section, not the sub-paragraph: `section-70-2-a` → `section-70`
    const root = ref.match(/^(schedule-\d+[A-Za-z]*(?:-paragraph-\d+[A-Za-z]*)?|section-\d+[A-Za-z]*)/)?.[1] ?? ref
    if (seen.has(root)) continue
    seen.add(root)
    out.push(retrieve({
      gate: 'northern_ireland', gid: NI, ref: root, named_in_brief: true,
      why: 'contains the words "fair employment" — found by searching the Act, not assumed',
    }))
  }
  return out
}

// ── the Supreme Court question ──────────────────────────────────────────────

/**
 * ⚠ The brief: "Report what the statute says. Do not conclude."
 *
 * So this returns the sentences of Scotland Act 1998 Sch 6 and Northern Ireland
 * Act 1998 Sch 10 that name a court, and the counts, and nothing else. Whether
 * abolishing the Supreme Court requires the jurisdiction to be relocated is not
 * a question this file answers.
 */
export function supremeCourtJurisdiction() {
  const out: Array<{
    act_gid: string; act_title: string; provision_ref: string
    mentions_supreme_court: number; mentions_judicial_committee: number
    sentences_naming_a_court: string[]
    retrieval_failure: string | null
  }> = []
  for (const [gid, ref] of [[SCOTLAND, 'schedule-6'], [NI, 'schedule-10'], [WALES, 'schedule-9']] as const) {
    const d = readDocWithVersion(gid)
    const slice = d ? provisionSlice(d.xml, ref) : null
    if (!slice) {
      out.push({
        act_gid: gid, act_title: GATE_ACTS[gid], provision_ref: ref,
        mentions_supreme_court: 0, mentions_judicial_committee: 0, sentences_naming_a_court: [],
        retrieval_failure: d ? `no element with id="${ref}"` : 'document not held locally',
      })
      continue
    }
    const flat = flattenClml(slice)
    const sentences: string[] = []
    // split on real sentence ends is overkill here; the schedule's paragraphs are
    // the natural unit and each is short. Take the window around each mention.
    for (const m of flat.matchAll(/Supreme Court|Judicial Committee/g)) {
      const s = flat.slice(Math.max(0, m.index! - 300), m.index! + 300).trim()
      if (!sentences.some(x => x.includes(s.slice(50, 150)))) sentences.push(s)
    }
    out.push({
      act_gid: gid, act_title: GATE_ACTS[gid], provision_ref: ref,
      mentions_supreme_court: [...flat.matchAll(/Supreme Court/g)].length,
      mentions_judicial_committee: [...flat.matchAll(/Judicial Committee/g)].length,
      sentences_naming_a_court: sentences,
      retrieval_failure: null,
    })
  }
  return {
    question: 'Does the Supreme Court hold the devolution reference jurisdiction under Scotland Act 1998 Sch 6 and Northern Ireland Act 1998 Sch 10?',
    instruction_followed: 'Report what the statute says. Do not conclude. — CC_BRIEF_report_corpus.md §5',
    caveat:
      'These are the words of the schedules as the corpus holds them (the revised, as-amended copy). ' +
      'The counts and the quoted windows are mechanical. No inference about what abolition would require is drawn here.',
    schedules: out,
  }
}

// ── per measure ─────────────────────────────────────────────────────────────

async function inboundFromGateActs(gid: string) {
  const { rows } = await getNeonPool().query(
    `SELECT source_gid, source_doc_uri, source_provision_ref, source_type, detection,
            target_provision_ref, citation_text, raw_fragment, resolved
     FROM ${CITATION_TABLE}
     WHERE target_act_id = $1 AND source_gid = ANY($2::text[])
     ORDER BY source_gid, source_provision_ref`, [gid, Object.keys(GATE_ACTS)])
  return rows as Array<{ source_gid: string; detection: string; source_provision_ref: string | null; citation_text: string }>
}

async function enablingPowersConferred(m: Measure) {
  const pool = getNeonPool()
  const { rows } = await pool.query(
    `SELECT target_provision_ref, source_gid, source_doc_uri, source_type, citation_text, raw_fragment
     FROM ${CITATION_TABLE}
     WHERE target_act_id = $1 AND detection = 'enabling'
     ORDER BY target_provision_ref NULLS LAST, source_gid`, [m.gid])
  // cross-check against the other graph table, which records made-under without
  // evidence. Two counts from two code paths; reported side by side, never merged.
  const { rows: le } = await pool.query(
    `SELECT COUNT(*)::int n, COUNT(DISTINCT split_part(from_id, ':', 2))::int instruments
     FROM ${EDGE_TABLE} WHERE edge_type = 'made-under' AND split_part(to_id, ':', 2) = $1`, [m.gid])

  const d = readDocWithVersion(m.gid)
  const byPower = new Map<string, { power_provision_ref: string | null; power_text: string | null; instruments: unknown[] }>()
  for (const r of rows as Array<Record<string, string | null>>) {
    const key = r.target_provision_ref ?? '(no provision named)'
    if (!byPower.has(key)) {
      const slice = r.target_provision_ref && d ? provisionSlice(d.xml, r.target_provision_ref) : null
      byPower.set(key, {
        power_provision_ref: r.target_provision_ref,
        power_text: slice ? flattenClml(slice) : null,
        instruments: [],
      })
    }
    byPower.get(key)!.instruments.push({
      instrument_gid: r.source_gid, instrument_uri: r.source_doc_uri,
      source_type: r.source_type, enacting_words: r.citation_text,
    })
  }
  return {
    powers: [...byPower.values()].map(p => ({ ...p, instrument_count: p.instruments.length })),
    citation_edge_enabling_rows: rows.length,
    legislation_edges_made_under_rows: le[0].n,
    legislation_edges_distinct_instruments: le[0].instruments,
    cross_check_note:
      'Two counts from two code paths over the same source bytes, reported side by side and never merged. ' +
      `citation_edge carries the enacting words as evidence; ${EDGE_TABLE} carries the made-under edge without them. ` +
      'They differ because citation_edge is per citation INSTANCE and the edge table collapses to one row per pair, ' +
      'and because the two extractors ran over different scopes. A disagreement is information, not an error to hide.',
  }
}

async function runMeasure(m: Measure) {
  console.log(`\n══ ${m.ws_id} — ${m.title} ══`)
  const devolution = DEVOLUTION_ITEMS.map(retrieve)
  // ⚠ dedupe by (act, ref): s.76 is both a brief-named item and a "fair
  // employment" search hit, and shipping its 799 words twice would let a reader
  // counting items think the search found one more provision than it did.
  const ni: GateItem[] = []
  for (const i of [...NI_ITEMS.map(retrieve), ...fairEmploymentProvisions()])
    if (!ni.some(x => x.act_gid === i.act_gid && x.provision_ref === i.provision_ref)) ni.push(i)
  const gateRefs = await inboundFromGateActs(m.gid)
  const alloc = await enablingPowersConferred(m)

  const failed = [...devolution, ...ni].filter(i => i.retrieval_failure)
  console.log(`  devolution items: ${devolution.length} (${devolution.filter(i => !i.retrieval_failure).length} retrieved)`)
  const feFound = ni.filter(i => i.why.startsWith('contains the words'))
  console.log(`  Northern Ireland items: ${ni.length} (${ni.filter(i => !i.retrieval_failure).length} retrieved)`)
  console.log(`      provisions containing "fair employment", found by search: ${feFound.map(i => i.provision_ref).join(', ') || 'none'}`)
  for (const f of failed) console.error(`  ⚠ NOT RETRIEVED: ${f.act_gid} ${f.provision_ref} — ${f.retrieval_failure}`)
  const gateDet = countsByDetection(gateRefs)
  console.log(`  inbound from the three devolution Acts to ${m.gid}: markup ${gateDet.markup}, text ${gateDet.text}, enabling ${gateDet.enabling}`)
  for (const [g, name] of Object.entries(GATE_ACTS)) {
    const n = gateRefs.filter(r => r.source_gid === g)
    if (n.length) console.log(`      ${name}: ${n.length} row(s) — ${[...new Set(n.map(r => r.source_provision_ref ?? '(no provision)'))].slice(0, 8).join(', ')}`)
  }
  console.log(`  enabling powers conferred by ${m.gid}: ${alloc.powers.length} distinct power(s), ${alloc.citation_edge_enabling_rows} instrument reference(s)`)
  console.log(`      ${EDGE_TABLE} made-under says: ${alloc.legislation_edges_made_under_rows} rows / ${alloc.legislation_edges_distinct_instruments} instruments`)

  const p = writeJson(`gates_${m.ws_id}.json`, {
    generated_at: new Date().toISOString(),
    measure: m,
    instruction:
      'RETRIEVE, DO NOT INTERPRET. Whether a gate is engaged is the analysis track\'s call. ' +
      'Everything here is the statute\'s own words, from the local bulk CLML (revised copy), with no conclusion drawn.',
    source_of_statutory_text: 'best-collection-xml.zip (local bulk CLML), revised copy where one is held — no network was used',
    devolution: {
      items: devolution,
      inbound_from_the_devolution_acts: {
        rows_in_this_file: gateRefs.length,
        counts_by_detection: countsByDetection(gateRefs),
        merge_warning: MERGE_WARNING,
        rows: gateRefs,
      },
    },
    northern_ireland: {
      items: ni,
      note:
        'The brief names "Northern Ireland Act 1998 s.76 and the fair employment provisions" without section numbers ' +
        'for the second. Those were FOUND by searching the Act for the phrase, not assumed. s.75 is retrieved alongside ' +
        's.76 because the two operate together; it is flagged as not named in the brief.',
    },
    instrument_allocation: {
      ...alloc,
      note:
        'The enabling powers this Act CONFERS, each with the instruments made under it. ' +
        '⚠ An enabling edge is a different and stronger fact than a mention: an instrument that merely mentions an ' +
        'Act survives its repeal, while one whose enabling power is repealed may fall with it. This section is what ' +
        'tells the report which statutory instruments fall with the parent, and it is never added to the mention counts.',
    },
    supreme_court_devolution_jurisdiction: supremeCourtJurisdiction(),
    retrieval_failures: failed.map(f => ({ act: f.act_gid, ref: f.provision_ref, reason: f.retrieval_failure })),
  })
  console.log(`  wrote ${p}`)
  return { devolution, ni, failed }
}

async function main() {
  const list = process.argv.includes('--include-t4') ? [...MEASURES, MEASURE_T4] : MEASURES
  let firstFailed: unknown[] = []
  for (const m of list) {
    const { failed } = await runMeasure(m)
    firstFailed = failed
  }

  // ── P3 and P4, scored ─────────────────────────────────────────────────────
  const named = [...DEVOLUTION_ITEMS, ...NI_ITEMS].filter(w => w.named_in_brief)
  const namedOk = named.map(retrieve).filter(i => !i.retrieval_failure).length
  const fe = fairEmploymentProvisions()
  console.log(`\n══ P3 SCORED ══`)
  console.log(`  predicted ≥6 of the 8 named gate items would retrieve full text.`)
  console.log(`  actual: ${namedOk} of ${named.length} brief-named provisions retrieved, plus ${fe.length} fair-employment provision(s) found by search.`)
  if (firstFailed.length) console.log(`  ⚠ retrieval failures are listed in every gates_*.json under retrieval_failures.`)

  const sc = supremeCourtJurisdiction()
  console.log(`\n══ P4 SCORED — what the schedules SAY (no conclusion drawn) ══`)
  for (const s of sc.schedules) {
    console.log(`  ${s.act_title} ${s.provision_ref}: "Supreme Court" ×${s.mentions_supreme_court}, "Judicial Committee" ×${s.mentions_judicial_committee}` +
      (s.retrieval_failure ? `  ⚠ ${s.retrieval_failure}` : ''))
  }
  console.log(`  predicted: both Sch 6 and Sch 10, as the corpus holds them, name the Supreme Court.`)

  closeZip()
  await endNeonPool()
}

if (require.main === module) {
  main().catch(e => { console.error('[t3] FATAL', e); process.exit(1) })
}
