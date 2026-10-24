// ─────────────────────────────────────────────────────────────────────────────
// check:onward — the onward reader and `statute_onward` (GRAPH 8, docs/BRIEF_GRAPH_8_ONWARD.md).
//
// ⚠⚠ EVERY CASE REPORTS WHAT IT COUNTED: rows EXAMINED and assertions MADE. A case that read nothing
// fails — "zero counter-examples" and "zero rows read" print the same zero.
//
// ⚠ THE LIVE CASES ARE COLD READS (CLAUDE.md §26): Acts this script did not create, called through what
// the product calls (`onwardFrom`, the tool's `run`), compared against a SEPARATE plain-SQL read written
// here — never a second copy of the reader. Writes nothing; every query is a SELECT.
//
// ⚠ THE FAILURE THIS CHECK EXISTS FOR: a citation row presented as a consequence. B4 and B11 assert it
// on the reader's rows AND on the words the tool hands Lex; control K1 proves the assertion can fire.
//
// Usage:  npm run check:onward
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { onwardFrom, ENABLING_SOURCE, type OnwardResult } from '../lib/lex/onward'
import {
  ONWARD_KINDS, ALL_ONWARD_KINDS, CASELAW_KIND, STRENGTH_OF, STRENGTH_HEADING, CONSEQUENCE_WORDS, ONWARD_RULES,
  strengthOf, parseTarget, isUnaddressableRef, provisionMatches, citingTextStateOf, citingTextForDisplay,
  onwardCaveat, describeKindLine, describeOnwardSummary, withheldAt, legPath,
  type Strength, type OnwardKind,
} from '../lib/lex/onward-pure'
import { statuteOnward, STATUTE_ONWARD_DESCRIPTION } from '../lib/lex/agent/onward-tool'
import { readEffect } from '../lib/lex/effect-kinds'
import { toolByName, MODEL_TOOLS } from '../lib/lex/agent/tools'

// ── harness (the GRAPH 6 shape) ───────────────────────────────────────────────

interface Outcome { examined: number; inputs: number; asserted: number; fail?: string; note?: string }
interface Case { name: string; run: () => Promise<Outcome> }
const CASES: Case[] = []
const CONTROLS: Array<{ name: string; propertyHolds: () => boolean | Promise<boolean> }> = []
const tc = (name: string, run: () => Promise<Outcome>) => CASES.push({ name, run })
const control = (name: string, propertyHolds: () => boolean | Promise<boolean>) => CONTROLS.push({ name, propertyHolds })

class A {
  asserted = 0; examined = 0; inputs = 0; failures: string[] = []
  ok(label: string, cond: boolean, detail = '') { this.asserted++; if (!cond) this.failures.push(`${label}${detail ? ` — ${detail}` : ''}`) }
  read(n: number) { this.examined += n }
  input(n: number) { this.inputs += n }
  done(note?: string): Outcome {
    if (this.examined === 0 && this.inputs === 0) return { examined: 0, inputs: 0, asserted: this.asserted, fail: 'examined 0 rows and 0 inputs — a check that read nothing proves nothing', note }
    if (this.asserted === 0) return { examined: this.examined, inputs: this.inputs, asserted: 0, fail: 'made 0 assertions', note }
    return { examined: this.examined, inputs: this.inputs, asserted: this.asserted, fail: this.failures.length ? this.failures.slice(0, 6).join(' | ') + (this.failures.length > 6 ? ` (+${this.failures.length - 6} more)` : '') : undefined, note }
  }
}
const sql = <T = any>(q: string, ...p: unknown[]) => prisma.$queryRawUnsafe<T[]>(q, ...p)
const num = (x: unknown) => Number(x)

// The four Acts the brief names for the branching factor, plus one pre-1963 Act for the bridge.
const ACTS = [
  { label: 'CRaG 2010', gid: 'ukpga/2010/25' },
  { label: 'Civil Service (Management Functions) Act 1992', gid: 'ukpga/1992/61' },
  { label: 'Government Resources and Accounts Act 2000', gid: 'ukpga/2000/20' },
  { label: 'Equality Act 2010', gid: 'ukpga/2010/15' },
]
const OAPA = { calendar: 'ukpga/1861/100', regnal: 'ukpga/Vict/24-25/100' }

/** Every word a reader is given for a result, as the tool would assemble it — for the consequence-word guard. */
function wordsFor(r: OnwardResult): Array<{ strength: Strength; text: string }> {
  return r.perKind.map((c) => ({ strength: c.strength, text: describeKindLine(c) }))
}
const fakeCtx = () => ({ turn: { tainted: false } }) as any

// ── A. pure ────────────────────────────────────────────────────────────────────

tc('A1 every kind has exactly one strength; an unknown kind has none', async () => {
  const a = new A()
  for (const k of ALL_ONWARD_KINDS) { a.input(1); a.ok(`${k} has a strength`, strengthOf(k) !== null) }
  a.ok('cites is a reference', STRENGTH_OF.cites === 'reference')
  a.ok('made-under is a dependency', STRENGTH_OF['made-under'] === 'dependency')
  a.ok('case law is interpretation', STRENGTH_OF[CASELAW_KIND] === 'interpretation')
  for (const k of ['affects', 'cites-text', '', 'Cites']) { a.input(1); a.ok(`"${k}" has no strength`, strengthOf(k) === null) }
  a.ok('case law is not walked by default', !(ONWARD_KINDS as readonly string[]).includes(CASELAW_KIND))
  return a.done()
})

tc('A2 a reference is never described as a consequence (headings, kind lines, rules)', async () => {
  const a = new A()
  for (const s of ['reference', 'interpretation'] as Strength[]) {
    a.input(1)
    a.ok(`${s} heading free of consequence words`, !CONSEQUENCE_WORDS.test(STRENGTH_HEADING[s].heading + ' ' + STRENGTH_HEADING[s].meaning), STRENGTH_HEADING[s].heading)
  }
  for (const counted of [0, 1, 12]) {
    const line = describeKindLine({ kind: 'cites', strength: STRENGTH_OF.cites, counted, returned: counted, instruments: counted, split: null })
    a.input(1); a.ok('cites line uses the reference heading', line.startsWith(STRENGTH_HEADING.reference.heading), line)
    a.ok('cites line free of consequence words', !CONSEQUENCE_WORDS.test(line), line)
  }
  a.ok('the guard itself recognises the forbidden words', ['consequential amendments', 'knock-on effects', 'a consequence of', 'must be amended'].every((w) => CONSEQUENCE_WORDS.test(w)))
  a.ok('the tool description carries all four rules verbatim', ONWARD_RULES.every((r) => STATUTE_ONWARD_DESCRIPTION.includes(r)))
  a.ok('rule 4 names the annexe', ONWARD_RULES.some((r) => r.includes('Consequential amendments and repeals')))
  return a.done()
})

tc('A3 target forms parse to the same Act; malformed ones are refused, not guessed', async () => {
  const a = new A()
  const same: Array<[string, string | null, string, string | null]> = [
    ['ukpga/2010/25', null, 'ukpga/2010/25', null],
    ['https://www.legislation.gov.uk/ukpga/2010/25/section/20', null, 'ukpga/2010/25', 'section-20'],
    ['ukpga/2010/25/section/20/enacted', null, 'ukpga/2010/25', 'section-20'],
    ['primary-acts-2000plus:ukpga/2010/25:section-20', null, 'ukpga/2010/25', 'section-20'],
    ['ukpga/2010/25:section-20', null, 'ukpga/2010/25', 'section-20'],
    ['ukpga/2010/25', 'section/20', 'ukpga/2010/25', 'section-20'],
    ['ukpga/Vict/24-25/100/section/18', null, 'ukpga/Vict/24-25/100', 'section-18'],
    ['asp/2010/13/section/179', null, 'asp/2010/13', 'section-179'],
    ['uksi/2010/1277', null, 'uksi/2010/1277', null],
  ]
  for (const [g, p, gid, prov] of same) {
    a.input(1)
    const t = parseTarget(g, p)
    a.ok(`${g} → ${gid} ${prov}`, t.error === null && t.gid === gid && t.provision === prov, JSON.stringify(t))
  }
  for (const bad of ['equality act', 'ukpga/2010', 'ukpga/2010/25/section/20;drop', 'ukpga/Vict/24-25']) {
    a.input(1); a.ok(`"${bad}" refused`, parseTarget(bad).error !== null, JSON.stringify(parseTarget(bad)))
  }
  a.ok('legPath round-trips', legPath('asp/2010/13', 'section-179') === 'asp/2010/13/section/179' && legPath('uksi/2010/1277', null) === 'uksi/2010/1277')
  return a.done()
})

tc('A4 Parts and Chapters are unaddressable; sections and schedule parts are not', async () => {
  const a = new A()
  for (const r of ['part-1', 'part-11', 'chapter-2', 'part-2-chapter-1', 'Part-III']) { a.input(1); a.ok(`${r} unaddressable`, isUnaddressableRef(r)) }
  for (const r of ['section-20', 'schedule-4-part-2', 'section-21A', null]) { a.input(1); a.ok(`${r} addressable`, !isUnaddressableRef(r)) }
  return a.done()
})

tc('A5 section-3 matches its subsections and insertions, never section-30', async () => {
  const a = new A()
  const yes = ['section-3', 'section-3-2', 'section-3a', 'Section-3A', 'section-3-2-a']
  const no = ['section-30', 'section-31', 'section-2', null]
  for (const r of yes) { a.input(1); a.ok(`${r} matches`, provisionMatches(r, 'section-3')) }
  for (const r of no) { a.input(1); a.ok(`${r} does not`, !provisionMatches(r, 'section-3')) }
  return a.done()
})

tc('A6 stored words are marked at both ends; tag debris removed; words never altered', async () => {
  const a = new A()
  const samples = [
    'id="schedule-4-paragraph-25-4" RestrictStartDate="2026-04-01">4In the Schedule (minor and consequential amendments), omit paragraphs 1 to 9. Equality Act 2010 (c. 15)',
    'subsection (6), “disabled person” is to be interpreted in accordance with section 6 of the Equality Act 2010',
  ]
  for (const s of samples) {
    a.input(1)
    const d = citingTextForDisplay(s)!
    a.ok('starts with an ellipsis', d.startsWith('“…'), d)
    a.ok('says the words after are not stored', d.includes('words after the reference are not stored'), d)
    a.ok('no tag debris', !/="/.test(d), d)
    const inner = d.slice(2, d.indexOf('”'))
    a.ok('the words are a verbatim substring of the stored text', s.includes(inner), inner)
    a.ok('state is possibly-truncated', citingTextStateOf(s) === 'possibly-truncated')
  }
  a.ok('no text → none-stored, nothing displayed', citingTextStateOf(null) === 'none-stored' && citingTextStateOf('  ') === 'none-stored' && citingTextForDisplay(null) === null)
  return a.done()
})

tc('A7 the caveat gets stronger with depth, and states no figure of its own', async () => {
  const a = new A()
  const d1 = onwardCaveat('2026-07-05', 110, 1), d2 = onwardCaveat('2026-07-05', 110, 2), d3 = onwardCaveat('2026-07-05', 110, 3)
  a.input(3)
  a.ok('depth 1 names the date', d1.includes('2026-07-05'))
  a.ok('depth 1 does not claim a hidden subtree', !d1.includes('hides everything'))
  a.ok('depth 2 says a gap above hides everything below', d2.startsWith(d1) && d2.includes('hides everything'))
  a.ok('depth 3 likewise, with its step number', d3.includes('step 3') && d3.includes('hides everything'))
  a.ok('no date → says so, no digit invented', !/\d/.test(onwardCaveat(null, null, 1)))
  a.ok('withheld from depth 3 for references and operations, never for dependencies',
    withheldAt('reference', 3) && withheldAt('operation', 3) && !withheldAt('reference', 2) && !withheldAt('dependency', 9))
  return a.done()
})

// ── B. live — cold reads against plain SQL ─────────────────────────────────────

const OFFICIAL = ['amends', 'repeals', 'modifies', 'commences'] as const

tc('B1 official effects: counts, instruments and the words split equal plain SQL (four Acts)', async () => {
  const a = new A()
  for (const act of ACTS) {
    const r = await onwardFrom(act.gid, { kinds: [...OFFICIAL], limit: 500 })
    const g = await sql<{ edge_type: string; sub_type: string; n: bigint }>(
      `SELECT edge_type, sub_type, COUNT(*) n FROM legislation_edges WHERE split_part(to_id, ':', 2) = $1 AND edge_type = ANY($2::text[]) GROUP BY 1, 2`, act.gid, [...OFFICIAL])
    const inst = await sql<{ edge_type: string; n: bigint }>(
      `SELECT edge_type, COUNT(DISTINCT split_part(from_id, ':', 2)) n FROM legislation_edges WHERE split_part(to_id, ':', 2) = $1 AND edge_type = ANY($2::text[]) GROUP BY 1`, act.gid, [...OFFICIAL])
    for (const k of OFFICIAL) {
      const rows = g.filter((x) => x.edge_type === k)
      const total = rows.reduce((s, x) => s + num(x.n), 0)
      a.read(total)
      const c = r.perKind.find((x) => x.kind === k)!
      a.ok(`${act.label} ${k} counted`, c.counted === total, `${c.counted} vs ${total}`)
      a.ok(`${act.label} ${k} instruments`, c.instruments === num(inst.find((x) => x.edge_type === k)?.n ?? 0))
      const textual = rows.filter((x) => readEffect(k, x.sub_type).kind === 'textual').reduce((s, x) => s + num(x.n), 0)
      a.ok(`${act.label} ${k} split`, total === 0 ? c.split === null : c.split?.total === total && c.split.changeWords === textual
        && c.split.changeWords + c.split.doNot + c.split.unclassified === total, JSON.stringify(c.split))
      a.ok(`${act.label} ${k} strength`, c.strength === 'operation')
    }
  }
  return a.done()
})

tc('B2 made-under: instruments equal the enabling rows whose words name the POWER (decision 271, four Acts); a chain ends', async () => {
  const a = new A()
  for (const act of ACTS) {
    const r = await onwardFrom(act.gid, { kinds: ['made-under'], limit: 500 })
    const n = await sql<{ n: bigint; rows: bigint }>(`SELECT COUNT(DISTINCT source_gid) n, COUNT(*) rows FROM citation_edge WHERE target_act_id = $1 AND detection = 'enabling' AND enabling_role = 'power'`, act.gid)
    a.read(num(n[0].rows))
    const c = r.perKind[0]
    a.ok(`${act.label} instruments`, c.instruments === num(n[0].n), `${c.instruments} vs ${num(n[0].n)}`)
    a.ok(`${act.label} every row is a dependency from ${ENABLING_SOURCE}, its words naming the power`, r.rows.every((x) => x.strength === 'dependency' && x.source === ENABLING_SOURCE && x.enablingRole === 'power' && !!x.enablingRoleWords))
    a.ok(`${act.label} enacting words held or counted`, (c.citingText!.possiblyTruncated + c.citingText!.noneStored) === c.counted && c.citingText!.held === 0)
  }
  // "Walk it until it ends": one step from each instrument under CRaG finds nothing made under it.
  const crag = await onwardFrom('ukpga/2010/25', { kinds: ['made-under'], limit: 500 })
  for (const n of crag.next) {
    const r2 = await onwardFrom(n.node, { kinds: ['made-under'], depth: 2 })
    a.read(1); a.ok(`${n.node} has nothing made under it`, r2.perKind[0].counted === 0)
  }
  return a.done()
})

tc('B3 cites: counted equals plain SQL; words joined from markup rows; none-stored equals the unmatched count', async () => {
  const a = new A()
  for (const act of ACTS) {
    const r = await onwardFrom(act.gid, { kinds: ['cites'], limit: 500 })
    const q = await sql<{ n: bigint; unmatched: bigint }>(`
      SELECT COUNT(*) n, COUNT(*) FILTER (WHERE NOT EXISTS (
        SELECT 1 FROM citation_edge e WHERE e.source_gid = split_part(l.from_id, ':', 2)
          AND coalesce(e.source_provision_ref, '') = split_part(l.from_id, ':', 3)
          AND e.target_act_id = $1 AND e.detection = 'markup')) unmatched
      FROM legislation_edges l WHERE split_part(l.to_id, ':', 2) = $1 AND l.edge_type = 'cites'`, act.gid)
    a.read(num(q[0].n))
    const c = r.perKind[0]
    a.ok(`${act.label} counted`, c.counted === num(q[0].n), `${c.counted} vs ${num(q[0].n)}`)
    a.ok(`${act.label} none-stored`, c.citingText!.noneStored === num(q[0].unmatched), `${c.citingText!.noneStored} vs ${num(q[0].unmatched)}`)
    a.ok(`${act.label} held never fires`, c.citingText!.held === 0)
    for (const row of r.rows.filter((x) => x.citingText)) {
      const hit = await sql<{ n: bigint }>(`SELECT COUNT(*) n FROM citation_edge WHERE citation_text = $1 AND target_act_id = $2 AND detection = 'markup'`, row.citingText, act.gid)
      a.ok(`${row.provision} words are a stored row, verbatim`, num(hit[0].n) > 0)
    }
  }
  return a.done()
})

tc('B4 ⚠ no row is presented as stronger than its kind — a cites row is a reference, everywhere', async () => {
  const a = new A()
  for (const act of ACTS) {
    const r = await onwardFrom(act.gid, { limit: 500, kinds: [...ONWARD_KINDS, CASELAW_KIND] })
    a.read(r.rows.length)
    for (const row of r.rows) a.ok(`${row.provision} ${row.kind} → ${row.strength}`, row.strength === STRENGTH_OF[row.kind])
    for (const w of wordsFor(r)) if (w.strength === 'reference' || w.strength === 'interpretation') a.ok(`${act.label} line free of consequence words`, !CONSEQUENCE_WORDS.test(w.text), w.text)
    const summary = describeOnwardSummary(r.perKind)
    const refAt = summary.findIndex((l) => l.startsWith(STRENGTH_HEADING.reference.heading))
    a.ok(`${act.label} the cites line sits under the reference heading`, refAt >= 0 && summary[refAt + 1]?.includes('cites:'), summary.join(' / '))
    a.ok(`${act.label} rows are ordered strongest first`, r.rows.every((x, i) => i === 0 || ['dependency', 'operation', 'reference', 'interpretation'].indexOf(r.rows[i - 1].strength) <= ['dependency', 'operation', 'reference', 'interpretation'].indexOf(x.strength)))
  }
  return a.done()
})

tc('B5 a capped kind says so: truncated is given for every kind, counted ≥ returned', async () => {
  const a = new A()
  const r = await onwardFrom('ukpga/2010/25', { limit: 5 })
  a.read(r.examined.rowsCounted)
  a.ok('one truncated entry per kind asked', r.truncated.length === ONWARD_KINDS.length && ONWARD_KINDS.every((k) => r.truncated.some((t) => t.kind === k)))
  for (const t of r.truncated) a.ok(`${t.kind} counted ≥ returned ≤ limit`, t.counted >= t.returned && t.returned <= 5)
  const com = r.truncated.find((t) => t.kind === 'commences')!
  const sqlN = num((await sql<{ n: bigint }>(`SELECT COUNT(*) n FROM legislation_edges WHERE split_part(to_id, ':', 2) = 'ukpga/2010/25' AND edge_type = 'commences'`))[0].n)
  a.ok('commences: the true count, and the cap visible', com.counted === sqlN && com.returned === 5, JSON.stringify(com))
  a.ok('rows returned = sum of returned', r.rows.length === r.truncated.reduce((s, t) => s + t.returned, 0))
  return a.done()
})

tc('B6 a Part is unaddressable — a result, not an empty list — and the Act was still checked', async () => {
  const a = new A()
  for (const t of ['ukpga/2010/25/part/1', 'ukpga/2010/15/part/11', 'ukpga/2010/15/chapter/2']) {
    const r = await onwardFrom(t)
    a.read(1)
    a.ok(`${t} unaddressable`, r.unaddressable?.code === 'part-or-chapter', JSON.stringify(r.unaddressable))
    a.ok(`${t} names the Act it found`, !!r.target.title && r.unaddressable!.reason.includes(r.target.title))
    a.ok(`${t} no rows`, r.rows.length === 0)
  }
  const bad = await onwardFrom('not an id')
  a.ok('a malformed id is not-an-id, not an empty walk', bad.unaddressable?.code === 'not-an-id')
  const tool = await statuteOnward.run(fakeCtx(), { target: 'ukpga/2010/25/part/1', depth: 1, limit: 20, include_case_law: false })
  a.ok('the tool says it is not an empty answer', tool.ok && (tool.data as any).note?.includes('not an empty answer'))
  return a.done()
})

tc('B7 identity bridge: both year forms of the 1861 Act give the same answer, equal to SQL over both', async () => {
  const a = new A()
  const kinds: OnwardKind[] = ['cites', 'amends', 'repeals']
  const cal = await onwardFrom(OAPA.calendar, { kinds, limit: 500 })
  const reg = await onwardFrom(OAPA.regnal, { kinds, limit: 500 })
  const q = await sql<{ edge_type: string; n: bigint }>(
    `SELECT edge_type, COUNT(*) n FROM legislation_edges WHERE split_part(to_id, ':', 2) = ANY($1::text[]) AND edge_type = ANY($2::text[]) GROUP BY 1`,
    [OAPA.calendar, OAPA.regnal], kinds)
  for (const k of kinds) {
    const n = num(q.find((x) => x.edge_type === k)?.n ?? 0)
    a.read(n)
    a.ok(`${k} calendar = regnal = SQL`, cal.perKind.find((c) => c.kind === k)!.counted === n && reg.perKind.find((c) => c.kind === k)!.counted === n, `${n}`)
  }
  a.ok('bridged', cal.resolution?.bridge === 'bridged' && reg.resolution?.bridge === 'bridged')
  a.ok('cites alone would be zero under the regnal form', num((await sql<{ n: bigint }>(`SELECT COUNT(*) n FROM legislation_edges WHERE split_part(to_id, ':', 2) = $1 AND edge_type = 'cites'`, OAPA.regnal))[0].n) === 0)
  return a.done()
})

tc('B8 identity bridge at the OTHER end: a calendar-form row comes back under its canonical form', async () => {
  const a = new A()
  const probe = await sql<{ from_gid: string; to_gid: string; canonical: string }>(`
    SELECT split_part(l.from_id, ':', 2) from_gid, split_part(l.to_id, ':', 2) to_gid, i.canonical
    FROM legislation_edges l JOIN legislation_identity i ON i.form = split_part(l.from_id, ':', 2)
    WHERE l.edge_type = 'cites' AND i.canonical IS NOT NULL AND i.canonical <> i.form LIMIT 3`)
  a.read(probe.length)
  for (const p of probe) {
    const r = await onwardFrom(p.to_gid, { kinds: ['cites'], limit: 500 })
    a.read(r.rows.length)
    a.ok(`${p.from_gid} comes back as ${p.canonical}`, r.rows.some((x) => x.act === p.canonical) && !r.rows.some((x) => x.act === p.from_gid))
    a.ok(`${p.canonical} node is walkable`, r.rows.filter((x) => x.act === p.canonical).every((x) => x.provision.startsWith(p.canonical)))
  }
  return a.done(probe.length ? undefined : 'no calendar-form cites source found')
})

tc('B9 case law is out of the default walk, and requestable separately as interpretation', async () => {
  const a = new A()
  const d = await onwardFrom('ukpga/2010/15', { limit: 50 })
  a.read(d.rows.length)
  a.ok('no case-law row by default', !d.rows.some((x) => x.kind === CASELAW_KIND) && !d.perKind.some((c) => c.kind === CASELAW_KIND))
  const c = await onwardFrom('ukpga/2010/15', { kinds: [CASELAW_KIND], limit: 10 })
  const n = num((await sql<{ n: bigint }>(`SELECT COUNT(*) n FROM citation_edge WHERE target_act_id = 'ukpga/2010/15' AND detection = 'caselaw-markup'`))[0].n)
  a.read(n)
  a.ok('requested: counted equals SQL', c.perKind[0].counted === n, `${c.perKind[0].counted} vs ${n}`)
  a.ok('requested: every row is interpretation', c.rows.length > 0 && c.rows.every((x) => x.strength === 'interpretation'))
  return a.done()
})

tc('B10 a provision walk: no instrument made under ANOTHER section comes back, and each is counted', async () => {
  const a = new A()
  for (const [gid, prov] of [['ukpga/2010/25', 'section-20'], ['ukpga/2010/25', 'section-2'], ['ukpga/2010/15', 'section-149']] as const) {
    const r = await onwardFrom(gid, { provision: prov, kinds: ['made-under'], limit: 500 })
    const q = await sql<{ source_gid: string; refs: string[] }>(
      `SELECT source_gid, array_remove(array_agg(DISTINCT target_provision_ref), NULL) refs FROM citation_edge
       WHERE target_act_id = $1 AND detection = 'enabling' AND enabling_role = 'power' GROUP BY 1`, gid)
    a.read(q.length)
    const other = q.filter((x) => x.refs.length && !x.refs.some((p) => provisionMatches(p, prov))).length
    const nw = r.notWalked.find((x) => x.kind === 'made-under')?.rows ?? 0
    a.ok(`${gid} ${prov}: other-section instruments counted`, nw === other, `${nw} vs ${other}`)
    for (const row of r.rows) a.ok(`${row.act} bears on ${prov} or names no section`, row.thisEndProvision === null || provisionMatches(row.thisEndProvision, prov), String(row.thisEndProvision))
    a.ok(`${gid} ${prov}: kept + other = all instruments`, r.perKind[0].instruments + other === q.length)
  }
  return a.done()
})

tc('B11 ⚠ the tool withholds depth-3 citations and effects, labels depth 2 weak, and never calls a reference a consequence', async () => {
  const a = new A()
  for (const depth of [1, 2, 3]) {
    const t = await statuteOnward.run(fakeCtx(), { target: 'ukpga/2010/15', depth, limit: 20, include_case_law: false })
    const d = t.data as any
    a.read(d.rows.length)
    const refRows = d.rows.filter((x: any) => x.kind === 'cites')
    const opRows = d.rows.filter((x: any) => x.strength === 'operation')
    if (depth >= 3) {
      a.ok('depth 3: no cites row shown', refRows.length === 0)
      a.ok('depth 3: no operation row shown', opRows.length === 0)
      a.ok('depth 3: what was withheld is counted', Array.isArray(d.withheld) && d.withheld.some((w: string) => w.startsWith('cites:')))
      a.ok('depth 3: made-under still shown', d.rows.some((x: any) => x.kind === 'made-under'))
    } else {
      a.ok(`depth ${depth}: cites shown`, refRows.length > 0)
    }
    a.ok(`depth ${depth}: weak label only at 2`, depth === 2 ? !!d.weak : !d.weak)
    for (const x of refRows) a.ok('cites row carries the reference heading', x.heading === STRENGTH_HEADING.reference.heading && x.strength === 'reference')
    const visible = JSON.stringify({ summary: d.summary, rows: refRows })
    a.ok(`depth ${depth}: no consequence word on any reference`, !CONSEQUENCE_WORDS.test(visible.replace(/Consequential Amendments\) Regulations/g, '')), visible.match(CONSEQUENCE_WORDS)?.[0] ?? '')
    a.ok(`depth ${depth}: words go out fenced`, !t.untrusted || t.untrusted.includes('<untrusted_content'))
  }
  return a.done()
})

tc('B12 freshness is the table\'s own load date; depth strengthens the caveat', async () => {
  const a = new A()
  const max = (await sql<{ d: Date }>(`SELECT MAX(extracted_at) d FROM legislation_edges`))[0].d
  a.read(1)
  const r1 = await onwardFrom('ukpga/1992/61'), r2 = await onwardFrom('ukpga/1992/61', { depth: 2 })
  a.ok('loadDate = newest extracted_at', r1.freshness.loadDate === new Date(max).toISOString().slice(0, 10), `${r1.freshness.loadDate}`)
  a.ok('caveat names it', r1.freshness.caveat.includes(r1.freshness.loadDate!))
  a.ok('depth 2 caveat is stronger', r2.freshness.caveat.length > r1.freshness.caveat.length && r2.freshness.caveat.includes('hides everything'))
  a.ok('a step with no rows is a stated zero, every kind present', r1.truncated.length === ONWARD_KINDS.length && r1.truncated.filter((t) => t.kind === 'cites')[0].counted === 0)
  return a.done()
})

tc('B13 the truncation determination: a 300-character window with a pile-up below it', async () => {
  const a = new A()
  const d = await sql<{ len: number; n: bigint }>(`SELECT length(citation_text) len, COUNT(*) n FROM citation_edge WHERE detection IN ('markup','text') AND length(citation_text) >= 280 GROUP BY 1`)
  const total = d.reduce((s, x) => s + num(x.n), 0)
  a.read(total)
  const at = (l: number) => num(d.find((x) => x.len === l)?.n ?? 0)
  a.ok('nothing longer than 300', d.every((x) => x.len <= 300))
  // A natural distribution thins toward its maximum; a cut piles rows up against it.
  const mode = d.reduce((m, x) => (num(x.n) > num(m.n) ? x : m), d[0])
  a.ok('the most populated length of the top twenty is within 3 of the limit', mode.len >= 297, `mode ${mode.len} (${num(mode.n)} rows)`)
  a.ok('and holds several times the rows at 280', at(mode.len) > 5 * Math.max(at(280), 1), `${at(mode.len)} vs ${at(280)}`)
  a.ok('so every stored text is reported possibly-truncated', citingTextStateOf('x'.repeat(120)) === 'possibly-truncated')
  return a.done()
})

tc('B14 a provision count is split into "names this provision" and "only the Act", and the split equals SQL', async () => {
  const a = new A()
  const r = await onwardFrom('ukpga/2010/25', { provision: 'section-20', limit: 500 })
  for (const c of r.perKind) { a.read(c.counted); a.ok(`${c.kind}: provision + act-wide = counted`, c.scope.provision + c.scope.actWide === c.counted, JSON.stringify(c.scope)) }
  for (const k of OFFICIAL) {
    const q = await sql<{ aw: bigint; p: bigint }>(`
      SELECT COUNT(*) FILTER (WHERE split_part(to_id, ':', 3) = '') aw,
             COUNT(*) FILTER (WHERE lower(split_part(to_id, ':', 3)) = 'section-20' OR lower(split_part(to_id, ':', 3)) ~ '^section-20([^0-9].*)?$') p
      FROM legislation_edges WHERE split_part(to_id, ':', 2) = 'ukpga/2010/25' AND edge_type = $1`, k)
    const c = r.perKind.find((x) => x.kind === k)!
    a.ok(`${k} split equals SQL`, c.scope.actWide === num(q[0].aw) && c.scope.provision === num(q[0].p), `${JSON.stringify(c.scope)} vs ${num(q[0].p)}/${num(q[0].aw)}`)
  }
  // From the rows: the made-under rows that name s.20 are exactly the `provision` ones.
  const mu = r.perKind.find((c) => c.kind === 'made-under')!
  a.ok('made-under provision count = rows naming section-20', mu.scope.provision === r.rows.filter((x) => x.kind === 'made-under' && x.thisEndProvision && provisionMatches(x.thisEndProvision, 'section-20')).length)
  const t = await statuteOnward.run(fakeCtx(), { target: 'ukpga/2010/25/section/20', depth: 1, limit: 50, include_case_law: false })
  const line = ((t.data as any).summary as string[]).find((l) => l.includes('made-under:'))!
  a.ok('the tool\'s made-under line states the split', line.includes(`${mu.scope.provision} name this provision, ${mu.scope.actWide} only the Act as a whole`), line)
  const whole = await statuteOnward.run(fakeCtx(), { target: 'ukpga/2010/25', depth: 1, limit: 5, include_case_law: false })
  a.ok('a whole-Act summary carries no provision split', !((whole.data as any).summary as string[]).some((l) => l.includes('name this provision')))
  return a.done()
})

tc('B16 ⚠ DECISION 271: an enabling row is made-under only when its words name the power; every other one is an enacting-mention, a reference', async () => {
  const a = new A()
  for (const act of ACTS) {
    const r = await onwardFrom(act.gid, { kinds: ['made-under', 'enacting-mention'], limit: 500 })
    const q = await sql<{ all_i: bigint; power_i: bigint; only_other_i: bigint }>(`
      SELECT COUNT(*) all_i, COUNT(*) FILTER (WHERE has_power) power_i, COUNT(*) FILTER (WHERE NOT has_power) only_other_i
        FROM (SELECT source_gid, bool_or(enabling_role = 'power') has_power FROM citation_edge
               WHERE target_act_id = $1 AND detection = 'enabling' GROUP BY 1) s`, act.gid)
    a.read(num(q[0].all_i))
    const mu = r.perKind.find((c) => c.kind === 'made-under')!, em = r.perKind.find((c) => c.kind === 'enacting-mention')!
    a.ok(`${act.label} made-under instruments = those with a power row`, mu.instruments === num(q[0].power_i), `${mu.instruments} vs ${num(q[0].power_i)}`)
    a.ok(`${act.label} enacting-mention instruments = those with none`, em.instruments === num(q[0].only_other_i), `${em.instruments} vs ${num(q[0].only_other_i)}`)
    a.ok(`${act.label} none lost, none twice`, mu.instruments + em.instruments === num(q[0].all_i))
    a.ok(`${act.label} an enacting-mention row is a reference, its role not power`, r.rows.filter((x) => x.kind === 'enacting-mention').every((x) => x.strength === 'reference' && x.enablingRole !== 'power'))
  }
  // The test case: CRaG s.20 confers no power, and the three instruments that name it say so in their own words.
  const s20 = await onwardFrom('ukpga/2010/25', { provision: 'section-20', limit: 500 })
  const three = ['ssi/2024/101', 'uksi/2024/512', 'uksi/2020/38']
  a.read(s20.rows.length)
  for (const g of three) {
    a.ok(`${g} is NOT made under s.20`, !s20.rows.some((x) => x.act === g && x.kind === 'made-under'))
    const m = s20.rows.find((x) => x.act === g && x.kind === 'enacting-mention')
    a.ok(`${g} is an enacting-mention naming s.20, with the phrase it was read from`, !!m && m.scope === 'provision' && m.enablingRole === 'mention' && !!m.enablingRoleWords, JSON.stringify(m && { role: m.enablingRole, words: m.enablingRoleWords }))
  }
  a.ok('s.20: nothing made under it NAMES s.20', s20.perKind.find((c) => c.kind === 'made-under')!.scope.provision === 0)
  const t = await statuteOnward.run(fakeCtx(), { target: 'ukpga/2010/25/section/20', depth: 1, limit: 50, include_case_law: false })
  const tr = ((t.data as any).rows as any[]).filter((x) => three.includes(x.node))
  a.ok('the tool shows them under the reference heading, with their role', tr.length === 3 && tr.every((x) => x.heading === STRENGTH_HEADING.reference.heading && x.enabling_role === 'mention'), JSON.stringify(tr.map((x) => [x.node, x.heading, x.enabling_role])))
  return a.done()
})

tc('B15 the tool is registered where Lex can reach it, read-only, and its description is the rules', async () => {
  const a = new A()
  const t = toolByName('statute_onward')
  a.input(1)
  a.ok('registered', !!t && MODEL_TOOLS.includes(t))
  a.ok('read-only category, runs without a button', t?.category === 'search' && t?.tier === 'free')
  a.ok('the registered description is the one carrying the rules', t?.description === STATUTE_ONWARD_DESCRIPTION)
  a.ok('no idea or user argument — it reads the law, nothing of the user’s', !!t && !Object.keys((t.schema as any).shape).some((k) => /idea|user/i.test(k)))
  return a.done()
})

// ── K. controls — each breaks one property and must make it read FALSE ─────────

control('K8 a provision headline without its split is caught', () => {
  const line = describeKindLine({ kind: 'made-under', strength: 'dependency', counted: 11, returned: 11, instruments: 11, split: null })
  return line.includes('only the Act as a whole')
})

control('K1 cites mapped to a dependency is caught (the brief\'s failure)', () => {
  const broken = { ...STRENGTH_OF, cites: 'dependency' as Strength }
  const line = describeKindLine({ kind: 'cites', strength: broken.cites, counted: 3, returned: 3, instruments: 3, split: null })
  return broken.cites === 'reference' && line.startsWith(STRENGTH_HEADING.reference.heading)
})
control('K9 an enacting-mention mapped to a dependency is caught (decision 271 undone)', () => {
  const broken = { ...STRENGTH_OF, 'enacting-mention': 'dependency' as Strength }
  return broken['enacting-mention'] === 'reference'
})
control('K2 the consequence guard fires on a reference described as a knock-on', () => !CONSEQUENCE_WORDS.test('Provisions that refer to this — knock-on effects'))
control('K3 an unmarked quotation is caught', () => {
  const unmarked = (s: string) => s
  const d = unmarked('section 6 of the Equality Act 2010')
  return d.startsWith('“…') && d.includes('not stored')
})
control('K4 a naive prefix match is caught (section-30 for section-3)', () => {
  const naive = (r: string, p: string) => r.startsWith(p)
  return !naive('section-30', 'section-3')
})
control('K5 a caveat that ignores depth is caught', () => {
  const flat = (_d: number) => onwardCaveat('2026-07-05', 110, 1)
  return flat(2).includes('hides everything')
})
control('K6 a fixed-position gid split is caught on a regnal Act', () => {
  const fixed = (s: string) => s.split('/').slice(0, 3).join('/')
  return fixed('ukpga/Vict/24-25/100/section/18') === 'ukpga/Vict/24-25/100'
})
control('K7 a tool that shows depth-3 citations is caught', () => {
  const never = (_s: Strength, _d: number) => false
  return never('reference', 3)
})

// ── run ─────────────────────────────────────────────────────────────────────────

;(async () => {
  let failed = 0, examined = 0, inputs = 0, asserted = 0
  for (const c of CASES) {
    const t = Date.now()
    let o: Outcome
    try { o = await c.run() } catch (e) { o = { examined: 0, inputs: 0, asserted: 0, fail: `threw: ${e instanceof Error ? e.message : String(e)}` } }
    examined += o.examined; inputs += o.inputs; asserted += o.asserted
    if (o.fail) failed++
    console.log(`${o.fail ? '✗' : '✓'} ${c.name} — rows ${o.examined}, inputs ${o.inputs}, asserted ${o.asserted} (${Date.now() - t}ms)${o.note ? ` · ${o.note}` : ''}${o.fail ? `\n    ${o.fail}` : ''}`)
  }
  let fired = 0
  for (const k of CONTROLS) {
    const holds = await k.propertyHolds()
    if (!holds) fired++
    console.log(`${holds ? '✗ DEAD' : '✓ fired'} ${k.name}`)
  }
  console.log(`\ncheck:onward — ${CASES.length - failed}/${CASES.length} cases, ${asserted} assertions over ${examined} rows + ${inputs} inputs; controls ${fired}/${CONTROLS.length} fired`)
  await prisma.$disconnect()
  process.exit(failed || fired !== CONTROLS.length ? 1 : 0)
})()
