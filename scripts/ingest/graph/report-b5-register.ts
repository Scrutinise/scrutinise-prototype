/**
 * report-b5-register.ts — CCW-B5: resolving the register.
 *
 * Input : docs/report_run/register_proposals.json  (CCW's column one)
 * Output: docs/report_run/register_resolved.json + .csv
 *
 *   scripts/ingest> npx tsx graph/report-b5-register.ts
 *
 * ── WHAT THIS IS ────────────────────────────────────────────────────────────
 * Column two of the report's register: for each thing the proposer said he
 * wants to change, the legislation that would have to change, and why. His
 * first task on receiving it is to correct it, so every row carries its
 * reasoning and every guess is visibly a guess.
 *
 * The counting method is deliberately IDENTICAL to report-t4-scoping.ts — same
 * exact-title resolution against corpus_acts, same inboundEvidence(), same Part
 * expansion, same three detection counts never summed. Two tables in one report
 * that count differently are worse than one table.
 *
 * ── THE RULES THAT SHAPE THE OUTPUT (B5 §4) ─────────────────────────────────
 *  1. `basis` is never blank and never optimistic. `named by the proposer` only
 *     where the instrument appears in his own words; otherwise `my
 *     identification`, and the reasoning is what he will read and correct.
 *     ⚠ `named_by` carries WHO named it, because SP-02's statutes are named by
 *     the INTERVIEWER and Starkey only assents. "Named by the proposer" alone
 *     would overstate his commitment, which is the one error this report cannot
 *     afford.
 *  2. Gates are yes/no/unknown FLAGS, not analysis. Whether a gate bites is
 *     CCW's call. `unknown` is used freely and is never a euphemism for a guess;
 *     every non-unknown flag names the evidence that set it.
 *  3. The three detection counts are never merged.
 *  4. Overlaps are recorded BOTH ways, computed from shared gid rather than
 *     asserted, because several proposals land on the same statute and that
 *     changes what "twelve measures" means.
 *  5. A proposal that cannot be resolved is `unresolved: true` with the terms
 *     tried. An honest blank is a row he can fill in; a wrong instrument is a
 *     row that discredits the ones beside it.
 */
import * as fs from 'fs'
import * as path from 'path'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { CITATION_TABLE } from './setup-citation-edge-table'
import { EDGE_TABLE } from './graph-common'
import { inboundEvidence, expandPart } from './inbound'
import { MERGE_WARNING, toCsv, writeJson, writeText } from './report-common'

const REPORT_DIR = path.resolve(__dirname, '../../../docs/report_run')

type Gate = 'yes' | 'no' | 'unknown'

type Cand = {
  proposal_id: string
  title: string              // searched against corpus_acts.title, exact
  provision_scope: string
  basis: 'named by the proposer' | 'my identification'
  named_by?: string          // who said the name, where basis is "named by the proposer"
  reasoning: string
  confidence: 'high' | 'medium' | 'low'
  international?: Gate       // declared, never computed — see gateInternational()
  international_why?: string
}

/** Proposals with no instrument to resolve to, and why. B5 §4.5. */
const UNRESOLVED: Record<string, { why: string; terms_tried: string[] }> = {
  'SP-01': {
    why: 'The scope is stated as a DATE RANGE, not an instrument: "the legislation passed under the Blair and Brown governments from 1997 to 2010". There is no single instrument to name, and naming one would misrepresent the proposal as narrower than it is. It is countable rather than resolvable — see scope_measurement on this row, which is the answer to CCW\'s note_for_resolution.',
    terms_tried: ['great repeal', 'restoration', '1997', '2010', 'Blair', 'Brown'],
  },
  'SP-06': {
    why: 'Carries no independent target. It restates the ECHR position of SP-05 as an agreed premise while discussing how it is HEARD — a communications question, not a statement of legislative intent. Resolving it separately would double-count one proposal. Cross-referenced to SP-05 rather than given its own instrument.',
    terms_tried: ['ECHR', 'European Convention', 'leave the ECHR'],
  },
  'SP-07': {
    why: 'The AIM, not a measure. "Fix parliamentary sovereignty, get all the powers back" is the objective every other row is instrumental to. It has no instrument of its own, and his own reply redirects to de-bureaucratisation as a social question rather than a legal one. ⚠ The open question for him — whether sovereignty is restored by repeal alone or needs positive assertion in statute — is a drafting decision nobody has taken, not a gap in this resolution.',
    terms_tried: ['parliamentary sovereignty', 'sovereignty', 'get the powers back'],
  },
  'SP-14': {
    why: 'Explicitly not a measure. It is the proposer stating the standard the programme must meet — "it has got to be legally watertight". Belongs in the register\'s front matter, as CCW\'s own note says, and is the strongest available justification for this document\'s method.',
    terms_tried: ['(none — not a proposal)'],
  },
}

const CANDIDATES: Cand[] = [
  // ── SP-02 — the only passage in the series naming statutes ──────────────
  { proposal_id: 'SP-02', title: 'Human Rights Act 1998', provision_scope: '', basis: 'named by the proposer',
    named_by: '⚠ Named by LITTLEWOOD, the interviewer, not by Starkey. Starkey\'s own words in reply are "I think it is a day one thing." He assents to a list he did not state.',
    reasoning: 'The Act is named in the passage itself, so this is not my identification. It is the instrument that gives the Convention rights effect in domestic law, and repealing it is the domestic half of what SP-05 describes. ⚠ He should be asked whether the list is his and whether it is complete, because he did not compose it.',
    confidence: 'high', international: 'yes',
    international_why: 'The Act gives effect to a treaty the UK remains party to; repeal engages the ECHR whether or not the treaty is denounced. Declared from the instrument\'s own subject matter, not computed.' },
  { proposal_id: 'SP-02', title: 'Equality Act 2010', provision_scope: '', basis: 'named by the proposer',
    named_by: '⚠ Named by LITTLEWOOD, not by Starkey — and he says "the EQUALITIES Act", which is not the statute\'s title. See B10 §8.2: the literal short title is never uttered anywhere in the eight thesis videos.',
    reasoning: 'Named in the passage. The Act consolidates the discrimination statutes and carries the s.149 public sector equality duty that SP-10 objects to separately. ⚠ The proposal is stated as repeal of law that "politicised the judiciary"; most of the Equality Act is not about the judiciary, so the stated rationale and the named instrument do not obviously match. That mismatch is his to resolve, not mine.',
    confidence: 'medium' },

  // ── SP-03 — four dispositions in one sentence ───────────────────────────
  { proposal_id: 'SP-03', title: 'Public Bodies Act 2011', provision_scope: '', basis: 'my identification',
    reasoning: '⚠⚠ He names NO instrument, and offers FOUR different dispositions in one sentence — abandon, kill off, privatise, renationalise into government. Those are four different instruments with four different consequences, not one proposal. The Public Bodies Act 2011 is the existing mechanism for abolishing or merging arm\'s-length bodies by order, and it reaches only a SUBSET: bodies listed in its Schedules. It is the nearest existing route for "abandon" and "kill off" and does nothing for "privatise" or "renationalise". Offered as the starting point, not as the answer. He should be asked which disposition applies to which bodies.',
    confidence: 'low' },

  // ── SP-04 — Supreme Court ───────────────────────────────────────────────
  { proposal_id: 'SP-04', title: 'Constitutional Reform Act 2005', provision_scope: 'part-3', basis: 'my identification',
    reasoning: 'He names the institution ("a Supreme Court"), never the statute. CRA 2005 Part 3 creates the Court and transfers the appellate jurisdiction of the House of Lords to it; reversing the creation means Part 3. ⚠ He states the contradiction — a supreme court alongside a sovereign parliament — without stating the remedy, so whether he wants the court abolished or merely restrained is unresolved in his own words. This row assumes abolition because that is what "reversal of its creation" means; if he means restraint, the instrument is different.',
    confidence: 'medium' },
  { proposal_id: 'SP-04', title: 'Scotland Act 1998', provision_scope: '', basis: 'my identification',
    reasoning: 'Consequential, and easy to miss: the Supreme Court holds the devolution reference jurisdiction under Scotland Act 1998 Sch 6. Abolishing the Court does not abolish that jurisdiction — it has to be relocated, or the devolution settlement loses its adjudicator. MY identification; he has never mentioned it.',
    confidence: 'medium' },
  { proposal_id: 'SP-04', title: 'Northern Ireland Act 1998', provision_scope: '', basis: 'my identification',
    reasoning: 'The same point as the Scotland Act row: the equivalent devolution jurisdiction sits in Northern Ireland Act 1998 Sch 10. MY identification.',
    confidence: 'medium' },

  // ── SP-05 — the route he names does not exist ───────────────────────────
  { proposal_id: 'SP-05', title: 'Human Rights Act 1998', provision_scope: '', basis: 'my identification',
    reasoning: '⚠⚠ THE STATED ROUTE IS NOT AVAILABLE AS DESCRIBED. He says "repeal the European Convention". A treaty is not repealed by an Act; it is DENOUNCED, under ECHR Article 58, which takes effect six months after notice and is a prerogative act rather than a legislative one. Denunciation also does not by itself alter domestic law — the Convention rights would remain enforceable through the Human Rights Act until that Act is changed. So the proposal as spoken splits into two distinct actions: denunciation (prerogative, no Bill) and HRA repeal (primary legislation). This row is the domestic half and is MY identification, because he named the treaty, not the Act. ⚠ He should be asked which he intends: denunciation, HRA repeal, or both. They are separable and have different effects.',
    confidence: 'high', international: 'yes',
    international_why: 'The proposal is directed at a treaty. Declared from the proposal\'s own subject matter.' },

  // ── SP-08 — a defect, never a measure ───────────────────────────────────
  { proposal_id: 'SP-08', title: 'Senior Courts Act 1981', provision_scope: '', basis: 'my identification',
    reasoning: 'He names judicial review as a DEFECT ("constant intervention by judges"), never as a measure, and no instrument appears anywhere in the corpus. s.31 is the judicial review jurisdiction of the High Court and is where any restriction of the remedy would sit. MY identification — the same one recorded for WS-08 in scoping_remaining.csv, carried here so the two tables agree.',
    confidence: 'low' },
  { proposal_id: 'SP-08', title: 'Judicial Review and Courts Act 2022', provision_scope: '', basis: 'my identification',
    reasoning: 'The most recent statute restricting judicial review, and the obvious model for a further restriction. MY identification. ⚠ Restricting standing, restricting remedies, and ousting review for named decisions are three different Bills; he has not said which, so this row should not be read as a settled target.',
    confidence: 'low' },

  // ── SP-09 — he argues against 1854, not against 2010 ────────────────────
  { proposal_id: 'SP-09', title: 'Constitutional Reform and Governance Act 2010', provision_scope: 'part-1', basis: 'my identification',
    reasoning: '⚠⚠ THE WORKSTREAM MAY BE AIMED AT AN INSTRUMENT HE HAS NOT NAMED. WS-05 is built on CRAG 2010 Part 1, which puts the civil service on a statutory footing. What he actually argues against is the NORTHCOTE-TREVELYAN settlement of 1854 — a permanent, appointed, examined civil service — and he cites Disraeli\'s opposition to it. The phrase "civil service commission" is never uttered across all 287 transcripts (B10 §2). CRAG 2010 Part 1 is the modern statutory expression of that settlement and is the only repealable instrument in the vicinity, so it is offered as MY identification and flagged. ⚠ Repealing CRAG Part 1 would remove the statutory footing but would not restore patronage appointment, which is what he appears to want; the two are not the same measure.',
    confidence: 'low' },

  // ── SP-10 — a target that may not be in force ──────────────────────────
  { proposal_id: 'SP-10', title: 'Equality Act 2010', provision_scope: 'section-149', basis: 'my identification',
    reasoning: 'For the DEI half of the proposal. He objects to "foisting the whole DEI agenda on the civil service"; the legal hook is the public sector equality duty in s.149, which is the only part of the statute book that requires public authorities to have regard to equality objectives. Much of what he describes is departmental policy rather than statute, and repealing s.149 would not by itself end it. MY identification.',
    confidence: 'medium' },
  { proposal_id: 'SP-10', title: 'Gender Recognition Act 2004', provision_scope: '', basis: 'my identification',
    reasoning: '⚠⚠ THE PREMISE APPEARS TO BE MISTAKEN AND THIS ROW EXISTS TO SAY SO. He refers to "the beginning of gender self identification for transsexuals" under Miller and Mordaunt. Gender self-identification was NEVER ENACTED in Great Britain — the 2018 consultation was not legislated, and the Scottish Bill that would have introduced it did not receive Royal Assent. The instrument actually in force is the Gender Recognition Act 2004, which requires a diagnosis of gender dysphoria and a determination by a Gender Recognition Panel: close to the opposite of self-identification. ⚠ So there is nothing here to repeal that matches what he described. This is included as a row, not omitted, because an honest "the thing you object to is not in force" is a finding he needs, and the alternative is a register row pointing at a statute that does not do what he thinks it does.',
    confidence: 'low' },

  // ── SP-11 — the one the programme spec missed ──────────────────────────
  { proposal_id: 'SP-11', title: 'Bank of England Act 1998', provision_scope: '', basis: 'my identification',
    reasoning: '⚠⚠ NOT IN ANY OF THE TWELVE WORKSTREAMS, and squarely inside his own stated 1997-2010 scope. He names the thing precisely — "complete political independence in 1998" — which is the Bank of England Act 1998: it made the Monetary Policy Committee responsible for setting rates and removed that from the Treasury. He names the year and the effect but not the Act, so MY identification. ⚠ He does not say what should replace it, and "reversal" could mean Treasury direction, a reconstituted MPC, or absorption into the quango measure at SP-03. Those are different Bills.',
    confidence: 'medium' },

  // ── SP-12 — charities ───────────────────────────────────────────────────
  { proposal_id: 'SP-12', title: 'Charities Act 2011', provision_scope: '', basis: 'my identification',
    reasoning: 'He names no instrument — "the charities... are no longer properly independent. They\'re sock puppets." The political-purposes rules for registered charities sit in the Charities Act 2011 and in Charity Commission guidance made under it. MY identification. ⚠ Note that CCW_SPEC §6 lists this Act as part of the EXISTING TOOLKIT for a different workstream (WS-12), not as a repeal target — so the same statute appears in the programme twice, pointing opposite ways. That is a contradiction for him to resolve, and it is why this row is recorded rather than dropped for being low-confidence.',
    confidence: 'low' },

  // ── SP-13 — the Sentencing Council, named inside SP-03 ─────────────────
  { proposal_id: 'SP-13', title: 'Coroners and Justice Act 2009', provision_scope: 'part-4', basis: 'my identification',
    reasoning: 'He names "sentencing guidance" as an instance of the quango problem, not as a measure of its own. The Sentencing Council is constituted by Coroners and Justice Act 2009 Part 4, and the duty on courts to follow its guidelines is statutory — so it cannot be reached by the general quango route at SP-03 and needs separate treatment. MY identification. Kept as its own row for that reason, and overlapping SP-03 by design.',
    confidence: 'medium' },
]

// Instruments whose absorption gate B3 already measured, keyed by gid.
const B3_ABSORPTION: Record<string, string> = {
  'ukpga/1998/42': 'caselaw_WS-01.json',
  'ukpga/2010/15': 'caselaw_WS-04.json',
  'ukpga/2010/25': 'caselaw_WS-05.json',
}

const DEVOLUTION_ACTS: Record<string, string> = {
  'ukpga/1998/46': 'Scotland Act 1998',
  'ukpga/2006/32': 'Government of Wales Act 2006',
  'ukpga/1998/47': 'Northern Ireland Act 1998',
}

const CSV_COLUMNS = [
  'proposal_id', 'verbatim', 'instrument_title', 'gid', 'provision_scope', 'basis', 'confidence',
  'markup', 'text', 'enabling', 'act_level_rows', 'distinct_source_instruments', 'made_under_edges',
  'gate_devolution', 'gate_international', 'gate_northern_ireland', 'gate_absorption',
  'overlaps', 'unresolved', 'reasoning',
]

async function main() {
  const pool = getNeonPool()
  const input = JSON.parse(fs.readFileSync(path.join(REPORT_DIR, 'register_proposals.json'), 'utf8'))
  const proposals: any[] = input.proposals
  console.log(`[b5] ${proposals.length} proposals in, ${CANDIDATES.length} candidate instruments to resolve\n`)

  // ── absorption evidence from B3, read not re-derived ────────────────────
  const absorption: Record<string, { flag: Gate; why: string }> = {}
  for (const [gid, file] of Object.entries(B3_ABSORPTION)) {
    const c = JSON.parse(fs.readFileSync(path.join(REPORT_DIR, file), 'utf8'))
    const setB = c.counts?.set_b ?? 0
    absorption[gid] = {
      flag: setB > 0 ? 'yes' : 'no',
      why: `${file}: Set B = ${setB} judgments containing the principle terms independently of the Act. ` +
        `${c.counts?.set_b_note ?? ''} Read from B3, not re-derived. Whether the principle survives repeal is CCW's call.`,
    }
  }

  type Resolved = { row: Record<string, unknown>; detail: Record<string, unknown> }
  const byProposal = new Map<string, Resolved[]>()
  const gidToProposals = new Map<string, Set<string>>()

  for (const c of CANDIDATES) {
    const { rows: hit } = await pool.query(
      `SELECT gid, title, title_source FROM corpus_acts WHERE lower(title) = lower($1) ORDER BY gid LIMIT 5`, [c.title])
    if (hit.length !== 1) {
      const resolution = hit.length === 0
        ? 'NOT RESOLVED — no exact title match in corpus_acts'
        : `AMBIGUOUS — ${hit.length} instruments carry this exact title (${hit.map((h: any) => h.gid).join(', ')})`
      console.log(`  ${c.proposal_id}  ${c.title.padEnd(48)} ⚠ ${resolution}`)
      const entry: Resolved = {
        row: { ...c, gid: '', resolution, markup: '', text: '', enabling: '' },
        detail: { ...c, gid: null, resolution },
      }
      if (!byProposal.has(c.proposal_id)) byProposal.set(c.proposal_id, [])
      byProposal.get(c.proposal_id)!.push(entry)
      continue
    }
    const gid = hit[0].gid as string
    if (!gidToProposals.has(gid)) gidToProposals.set(gid, new Set())
    gidToProposals.get(gid)!.add(c.proposal_id)

    // ── detection counts, exactly as report-t4-scoping.ts does them ───────
    const by: Record<string, number> = { markup: 0, text: 0, enabling: 0 }
    let distinct = 0
    let actLevel: number | '' = ''
    let resolution: string

    if (c.provision_scope) {
      const { rows: scoped } = await inboundEvidence(gid, c.provision_scope)
      for (const r of scoped) by[r.detection] = (by[r.detection] ?? 0) + 1
      distinct = new Set(scoped.map((r: any) => r.source_gid)).size
      const exp = expandPart(gid, c.provision_scope)
      const { rows: lit } = await pool.query(
        `SELECT COUNT(*)::int n FROM ${CITATION_TABLE} WHERE target_act_id = $1 AND target_provision_ref = $2`,
        [gid, c.provision_scope])
      const { rows: al } = await pool.query(
        `SELECT COUNT(*)::int n FROM ${CITATION_TABLE} WHERE target_act_id = $1 AND target_provision_ref IS NULL`, [gid])
      actLevel = al[0].n
      // ⚠ A SECTION is not a Part and must not carry the Part warning. Part
      // expansion exists because references name sections, not Parts, so a
      // literal match on 'part-4' returns 0 while the Part is heavily
      // referenced. For 'section-149' the literal match IS the correct query —
      // it is exactly the form references use. Emitting "probably a bad one"
      // there would tell a reader to distrust a number that is right.
      const isSection = /^section-/i.test(c.provision_scope)
      resolution = exp.available
        ? `resolved by exact title match; '${c.provision_scope}' expanded to ${exp.refs.length} provision refs from the Act's own CLML (${exp.note}). ` +
          `A literal match on the bare string returns ${lit[0].n} row(s). act_level_rows (${actLevel}) name the Act with no provision and are reported SEPARATELY.`
        : isSection
          ? `resolved by exact title match; scope is a SECTION, so the counts are a direct match on target_provision_ref = '${c.provision_scope}' — which is the form references actually use, and is the correct query for a section. No Part expansion applies or is needed. ` +
            `act_level_rows (${actLevel}) name the Act with no provision and are reported SEPARATELY: any of them may bear on this section and the markup does not say which.`
          : `⚠⚠ THE PART COULD NOT BE EXPANDED — ${exp.note}. The counts are a LITERAL match on '${c.provision_scope}' and are a floor, probably a bad one. Do not quote them as this scope's exposure. act_level_rows (${actLevel}) reported separately.`
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

    // ── gates ────────────────────────────────────────────────────────────
    // devolution / northern_ireland are COMPUTED from citation edges either
    // direction between this Act and the devolution Acts. That is a checkable
    // fact about the corpus, not a view about whether the gate bites.
    const devoHits: string[] = []
    for (const [dGid, dTitle] of Object.entries(DEVOLUTION_ACTS)) {
      if (dGid === gid) continue
      const { rows: e } = await pool.query(
        `SELECT COUNT(*)::int n FROM ${CITATION_TABLE}
          WHERE (target_act_id = $1 AND source_gid = $2) OR (target_act_id = $2 AND source_gid = $1)`, [gid, dGid])
      if (e[0].n > 0) devoHits.push(`${dTitle} (${e[0].n} edges)`)
    }
    const niHit = devoHits.find(h => h.startsWith('Northern Ireland Act'))
    const gates = {
      devolution: (devoHits.length ? 'yes' : 'no') as Gate,
      international: (c.international ?? 'unknown') as Gate,
      northern_ireland: (niHit ? 'yes' : 'no') as Gate,
      absorption: (absorption[gid]?.flag ?? 'unknown') as Gate,
    }
    const gates_why = {
      devolution: devoHits.length
        ? `citation edges between this instrument and: ${devoHits.join('; ')}. Computed, not asserted. Whether the gate bites is CCW's call.`
        : 'no citation edges between this instrument and the Scotland Act 1998, Government of Wales Act 2006 or Northern Ireland Act 1998 in citation_edge. ⚠ Absence of an edge is weaker evidence than presence of one: the detector may simply not have found it.',
      international: c.international_why ?? 'not assessed — international engagement is not computable from the citation graph, and a guess is worse than unknown (B5 §4.2).',
      northern_ireland: niHit ? `citation edges with the ${niHit}. Computed.` : 'no citation edges with the Northern Ireland Act 1998. ⚠ Same caveat as devolution: absence is weak evidence.',
      absorption: absorption[gid]?.why ?? 'not measured for this instrument — B3 covered only WS-01, WS-04 and WS-05. unknown, not no.',
    }

    console.log(`  ${c.proposal_id}  ${c.title.slice(0, 44).padEnd(46)} ${gid.padEnd(15)} ${(c.provision_scope || '-').padEnd(12)} markup ${String(by.markup).padStart(4)}  text ${String(by.text).padStart(5)}  enabling ${String(by.enabling).padStart(4)}  devo ${gates.devolution}`)

    const entry: Resolved = {
      row: {
        title: c.title, gid, provision_scope: c.provision_scope, basis: c.basis, named_by: c.named_by ?? '',
        reasoning: c.reasoning, confidence: c.confidence,
        markup: by.markup, text: by.text, enabling: by.enabling,
        act_level_rows: actLevel, distinct_source_instruments: distinct, made_under_edges: mu[0].n,
        gates, gates_why, resolution, overlaps: [] as string[],
      },
      detail: { resolved_title: hit[0].title, title_source: hit[0].title_source },
    }
    if (!byProposal.has(c.proposal_id)) byProposal.set(c.proposal_id, [])
    byProposal.get(c.proposal_id)!.push(entry)
  }

  // ── overlaps, computed from shared gid and recorded BOTH ways (B5 §4.4) ──
  for (const [pid, entries] of byProposal) {
    for (const e of entries) {
      const gid = e.row.gid as string
      if (!gid) continue
      const others = [...(gidToProposals.get(gid) ?? [])].filter(p => p !== pid).sort()
      e.row.overlaps = others
    }
  }

  // ── overlaps ACROSS tables, which the within-table ones cannot see ──────
  // CRA 2005 carries SP-04 here and WS-02, WS-03 and WS-09 in
  // scoping_remaining.csv. Computing overlaps only within this file makes it
  // look unclaimed by anything else, which is the opposite of true and
  // understates exactly the point B5 §4.4 exists to make.
  const crossTable: Record<string, { workstreams: string[]; note: string }> = {}
  try {
    const scoping = JSON.parse(fs.readFileSync(path.join(REPORT_DIR, 'scoping_remaining.json'), 'utf8'))
    const scopeRows: any[] = scoping.rows ?? scoping.detail ?? scoping.scoping ?? []
    for (const gid of gidToProposals.keys()) {
      const ws = [...new Set(scopeRows.filter(r => r.resolved_gid === gid).map(r => r.ws_id))].sort()
      if (ws.length) crossTable[gid] = {
        workstreams: ws as string[],
        note: `Also claimed by ${ws.join(', ')} in scoping_remaining.csv. The same statute is the target of more than one measure across the two tables, which is invisible if you read either alone.`,
      }
    }
  } catch (e) {
    console.log('  ⚠ scoping_remaining.json not readable — cross-table overlaps not computed:', (e as Error).message)
  }
  for (const [, entries] of byProposal) for (const e of entries) {
    const gid = e.row.gid as string
    if (gid && crossTable[gid]) (e.row as any).also_claimed_by_workstreams = crossTable[gid].workstreams
  }

  // ── SP-01: countable rather than resolvable ─────────────────────────────
  const { rows: acts } = await pool.query(
    `SELECT COUNT(*)::int n FROM corpus_acts WHERE gid ~ '^ukpga/[0-9]{4}/' AND (split_part(gid,'/',2))::int BETWEEN 1997 AND 2010`)
  const { rows: kinds } = await pool.query(
    `SELECT split_part(gid,'/',1) kind, COUNT(*)::int n FROM corpus_acts
      WHERE (split_part(gid,'/',2))::int BETWEEN 1997 AND 2010 AND gid ~ '^[a-z]+/[0-9]{4}/' GROUP BY 1 ORDER BY 2 DESC LIMIT 8`)
  const scopeMeasurement = {
    question: 'CCW\'s note_for_resolution on SP-01: "establish what primary legislation was passed 1997-2010 ... that is a countable question and it bounds every other row."',
    uk_public_general_acts_1997_2010: acts[0].n,
    all_instrument_kinds_1997_2010: Object.fromEntries(kinds.map((k: any) => [k.kind, k.n])),
    what_this_is_not: '⚠ These are counts of what THIS CORPUS HOLDS for that date range, not of what was enacted, and not of what is still in force. corpus_acts is not a complete statute book and no in-force filter has been applied. Treat as an order of magnitude.',
    why_it_matters: 'The proposal\'s own scope is temporal. Even at the narrowest reading — UK public general Acts only — it is hundreds of instruments, and on any reading that includes secondary legislation it is tens of thousands. That is a different and far larger drafting problem than twelve named measures, and it is the single most important thing this resolution can tell the proposer.',
  }

  // ── assemble ────────────────────────────────────────────────────────────
  const out: any[] = []
  const csv: Record<string, unknown>[] = []
  for (const p of proposals) {
    const pid = p.proposal_id
    const entries = byProposal.get(pid) ?? []
    const un = UNRESOLVED[pid]
    const row: any = {
      proposal_id: pid,
      verbatim: p.verbatim,
      ccw_reading: p.ccw_reading,
      video_url: p.video_url,
      candidate_instruments: entries.map(e => e.row),
      unresolved: !!un,
      why_unresolved: un?.why ?? '',
    }
    if (un) row.search_terms_tried = un.terms_tried
    if (pid === 'SP-01') row.scope_measurement = scopeMeasurement
    if (pid === 'SP-06') row.see_also = ['SP-05']
    out.push(row)

    if (!entries.length) {
      csv.push({
        proposal_id: pid, verbatim: p.verbatim, instrument_title: '', gid: '', provision_scope: '',
        basis: '', confidence: '', markup: '', text: '', enabling: '', act_level_rows: '',
        distinct_source_instruments: '', made_under_edges: '',
        gate_devolution: '', gate_international: '', gate_northern_ireland: '', gate_absorption: '',
        overlaps: '', unresolved: 'yes', reasoning: un?.why ?? '',
      })
    } else {
      for (const e of entries) {
        const r = e.row as any
        csv.push({
          proposal_id: pid, verbatim: p.verbatim, instrument_title: r.title, gid: r.gid,
          provision_scope: r.provision_scope, basis: r.basis, confidence: r.confidence,
          markup: r.markup, text: r.text, enabling: r.enabling, act_level_rows: r.act_level_rows,
          distinct_source_instruments: r.distinct_source_instruments, made_under_edges: r.made_under_edges,
          gate_devolution: r.gates?.devolution ?? '', gate_international: r.gates?.international ?? '',
          gate_northern_ireland: r.gates?.northern_ireland ?? '', gate_absorption: r.gates?.absorption ?? '',
          overlaps: (r.overlaps ?? []).join(' '), unresolved: 'no', reasoning: r.reasoning,
        })
      }
    }
  }

  // ── done-means checks, run here so a failure is loud (B5 §6) ────────────
  const inputIds = proposals.map((p: any) => p.proposal_id)
  const outIds = out.map(o => o.proposal_id)
  const missing = inputIds.filter((i: string) => !outIds.includes(i))
  const noBasis = out.flatMap(o => o.candidate_instruments).filter((i: any) => !i.basis || !i.reasoning || !i.confidence)
  const overlapAsym: string[] = []
  for (const o of out) for (const i of o.candidate_instruments as any[]) {
    for (const other of i.overlaps ?? []) {
      const back = out.find(x => x.proposal_id === other)
      const ok = (back?.candidate_instruments ?? []).some((j: any) => j.gid === i.gid && (j.overlaps ?? []).includes(o.proposal_id))
      if (!ok) overlapAsym.push(`${o.proposal_id}->${other} on ${i.gid}`)
    }
  }
  // ⚠ Two of these are INVARIANTS, not checks, and they are labelled as such.
  // overlaps are built from one gid->proposals map, so symmetry cannot fail;
  // no_total_column reads a constant declared in this file. Both would pass on
  // a completely broken run. Reporting them as "checks" would be the shape this
  // project has been bitten by all day — a guard that cannot fail, printing a
  // reassuring result. They are kept because they catch corruption during
  // assembly, and demoted because that is all they catch.
  const csvHeader = CSV_COLUMNS.join(',')
  const checks = {
    every_proposal_present: {
      kind: 'check', pass: missing.length === 0, missing,
      why_it_can_fail: 'compares the emitted ids against the INPUT file\'s ids; a dropped proposal fails it.',
    },
    every_instrument_has_basis_reasoning_confidence: {
      kind: 'check', pass: noBasis.length === 0, offenders: noBasis.length,
      why_it_can_fail: 'a candidate added without reasoning fails it — the field is hand-written per instrument, not generated.',
    },
    overlaps_symmetric: {
      kind: 'invariant (cannot fail by construction)', pass: overlapAsym.length === 0, asymmetric: overlapAsym,
      caveat: '⚠ Overlaps are derived from a single gid->proposals map, so symmetry is guaranteed by how they are built, not established by this test. Passing means assembly did not corrupt them. It is NOT evidence the overlaps are correct.',
    },
    no_total_column: {
      kind: 'invariant (reads a constant in this file)', pass: !/(^|,)total(,|$)/.test(csvHeader) && ['markup', 'text', 'enabling'].every(c => CSV_COLUMNS.includes(c)),
      emitted_header: csvHeader,
      caveat: '⚠ This inspects the column list declared above, not the numbers. It shows no total column is emitted; it cannot show that nothing downstream adds them.',
    },
  }

  writeJson('register_resolved.json', {
    generated_at: new Date().toISOString(),
    what_this_is: 'Column two of the report register: for each stated proposal, the legislation that would have to change, and why. Produced by CC. Nothing here is a disposition — whether a gate bites, and whether a measure is worth doing, are CCW\'s calls.',
    input: 'docs/report_run/register_proposals.json',
    merge_warning: MERGE_WARNING,
    method: 'Instruments resolved by EXACT title match against corpus_acts — the same table the text detector resolves against — never typed from memory. Detection counts and Part expansion use the identical code path as report-t4-scoping.ts (inboundEvidence/expandPart), so the two tables in this report count the same way.',
    caveats: [
      '⚠ basis = "my identification" means CC picked the instrument, not the proposer. The reasoning on those rows is what he is being asked to correct, and striking one costs nothing.',
      '⚠ "named by the proposer" carries a `named_by` field, and on SP-02 it says the statutes were named by the INTERVIEWER with Starkey only assenting. Reading that row as his own naming would overstate his commitment.',
      '⚠ Gates are FLAGS, not analysis. devolution and northern_ireland are computed from citation edges either direction; international is declared only where the instrument is on its face treaty-connected; absorption is read from B3 and is "unknown" wherever B3 did not measure it. unknown is used freely and never means no.',
      '⚠ ABSENCE OF A CITATION EDGE IS WEAKER EVIDENCE THAN PRESENCE OF ONE. A "no" on the devolution gate means the detector found nothing, not that nothing is there.',
      '⚠ markup, text and enabling are NEVER summed, here or anywhere. act_level_rows is reported separately on scoped rows and never added in.',
      '⚠ Several proposals land on the same statute; overlaps are computed from shared gid and recorded both ways. CRA 2005 and the Human Rights Act each carry more than one.',
      '⚠ SP-10 is included precisely BECAUSE its premise appears to be mistaken. Gender self-identification was never enacted in Great Britain; the row exists to say so rather than to point at a statute that does not do what he thinks it does.',
    ],
    checks,
    counts: {
      proposals_in: proposals.length,
      proposals_resolved: out.filter(o => !o.unresolved).length,
      proposals_unresolved: out.filter(o => o.unresolved).length,
      candidate_instruments: out.flatMap(o => o.candidate_instruments).length,
      by_basis: out.flatMap(o => o.candidate_instruments as any[]).reduce((m: any, i: any) => (m[i.basis] = (m[i.basis] ?? 0) + 1, m), {}),
      by_confidence: out.flatMap(o => o.candidate_instruments as any[]).reduce((m: any, i: any) => (m[i.confidence] = (m[i.confidence] ?? 0) + 1, m), {}),
    },
    register: out,
  })
  writeText('register_resolved.csv', toCsv(csv, CSV_COLUMNS))

  console.log('\nchecks:', JSON.stringify(checks, null, 1))
  console.log(`\nproposals ${out.length}  resolved ${out.filter(o => !o.unresolved).length}  unresolved ${out.filter(o => o.unresolved).length}  instruments ${out.flatMap(o => o.candidate_instruments).length}`)
  await endNeonPool()
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
