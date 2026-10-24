// ─────────────────────────────────────────────────────────────────────────────
// check:graph-9 — power or mention, the `mentions` kind, explanatory notes, and the two small items
// (docs/BRIEF_GRAPH_9.md; docs/GRAPH_9_REPORT.md).
//
// ⚠ THE FAILURE THIS CHECK EXISTS FOR (§6g): a procedural mention classified as a power. G2 and G3 assert it on the
// reader's rows and on the tool's words for CRaG s.20; the mutation run in the report breaks `enablingKindOf` and
// watches them go red.
//
// ⚠ COLD READS (CLAUDE.md §26): Acts this script did not create, called through what the product calls (`onwardFrom`,
// the tool's `run`, `inboundFor`), compared against plain SQL written HERE. Writes nothing; every query is a SELECT.
//
// Usage:  npm run check:graph-9
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '../lib/prisma'
import { onwardFrom, noteNode, PROVISION_POWER_TABLE } from '../lib/lex/onward'
import {
  ONWARD_KINDS, ALL_ONWARD_KINDS, MENTIONS_KIND, CASELAW_KIND, STRENGTH_OF, STRENGTH_HEADING, STRENGTH_ORDER, KIND_LABEL,
  CONSEQUENCE_WORDS, enablingKindOf, citingTextForDisplay, zoneLabel, rowZoneOf, mentionOnlySentence, describeKindLine,
} from '../lib/lex/onward-pure'
import { statuteOnward } from '../lib/lex/agent/onward-tool'
import { inboundFor, detectionOf, graphCoverage } from '../lib/lex/statutory-graph'

interface Outcome { examined: number; inputs: number; asserted: number; fail?: string; note?: string }
const CASES: Array<{ name: string; run: () => Promise<Outcome> }> = []
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
const fakeCtx = () => ({ turn: { tainted: false } }) as any
const GRAPH = path.join(__dirname, '..', '..', 'scripts', 'ingest', 'graph')
const json = (f: string) => JSON.parse(fs.readFileSync(path.join(GRAPH, f), 'utf8'))
const CRAG = 'ukpga/2010/25'
const THREE = ['ssi/2024/101', 'uksi/2024/512', 'uksi/2020/38']

// ── §0 ─────────────────────────────────────────────────────────────────────────

tc('G0 §0: official effect rows carry the publisher’s identifiers; the extracted made-under rows are the 36%', async () => {
  const a = new A()
  const j = json('audit-g9-provision-ids.json')
  a.input(1)
  a.ok('against the files the table was built from: 0 to-side, 0 from-side', j.run_against_july_files.to_side.startsWith('0 of') && j.run_against_july_files.from_side.startsWith('0 of'))
  a.ok('against today’s files the residue is the publisher re-keying, under 0.1% each side',
    j.official_bulk_amendments.to_side.pct < 0.1 && j.official_bulk_amendments.from_side.pct < 0.1, JSON.stringify([j.official_bulk_amendments.to_side.pct, j.official_bulk_amendments.from_side.pct]))
  a.ok('the in-force rows: 0', j.official_inforce.not_in_publisher_csv === 0)
  const ctl = j.official_bulk_amendments.control
  a.ok('the test can fail: ≥90% of subsection artefacts and ≥70% of re-attributions planted in real rows are caught',
    ctl.subsectionMissed / ctl.subsection >= 0.9 && ctl.reattributedMissed / ctl.reattributed >= 0.7, JSON.stringify(ctl))
  a.ok('the extracted made-under section rows disagree with the corrected parser about a third of the time', j.extracted_made_under.pct > 30 && j.extracted_made_under.pct < 40, String(j.extracted_made_under.pct))
  // and the reader never reads them: made-under comes from citation_edge
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'lex', 'onward.ts'), 'utf8')
  a.ok('onward.ts reads enabling rows from citation_edge, and no made-under row from legislation_edges', /detection = 'enabling'/.test(src) && !/edge_type = 'made-under'/.test(src))
  // the guard that stops an import downloading the publisher's files over ours
  const dl = fs.readFileSync(path.join(GRAPH, 'download-graph-sources.ts'), 'utf8')
  a.ok('download-graph-sources.ts runs only as a script', /if \(require\.main === module\) \{\s*main\(\)/.test(dl))
  return a.done()
})

// ── §2 ─────────────────────────────────────────────────────────────────────────

tc('G1 provision_power holds one row per provision an enabling row names, in three states', async () => {
  const a = new A()
  const q = await sql<{ named: bigint; missing: bigint; extra: bigint }>(`
    WITH n AS (SELECT DISTINCT target_act_id g, target_provision_ref p FROM citation_edge
                WHERE detection = 'enabling' AND target_provision_ref IS NOT NULL AND target_act_id IS NOT NULL)
    SELECT (SELECT COUNT(*) FROM n) named,
           (SELECT COUNT(*) FROM n LEFT JOIN ${PROVISION_POWER_TABLE} pp ON pp.gid = n.g AND pp.provision_ref = n.p WHERE pp.gid IS NULL) missing,
           (SELECT COUNT(*) FROM ${PROVISION_POWER_TABLE} pp LEFT JOIN n ON pp.gid = n.g AND pp.provision_ref = n.p WHERE n.g IS NULL) extra`)
  a.read(num(q[0].named))
  a.ok('every named provision has a row', num(q[0].missing) === 0, `${num(q[0].missing)} missing`)
  a.ok('no row for a provision nothing names', num(q[0].extra) === 0, `${num(q[0].extra)} extra`)
  const s = await sql<{ state: string; n: bigint }>(`SELECT state, COUNT(*) n FROM ${PROVISION_POWER_TABLE} GROUP BY 1`)
  a.ok('three states, all present', s.length === 3 && ['power', 'none', 'unknown'].every((x) => s.some((r) => r.state === x)), JSON.stringify(s.map((r) => [r.state, num(r.n)])))
  return a.done()
})

tc('G2 ⚠ CRaG s.20 — the acceptance test: no instrument made under it, the three that name it are mentions, and the reader says so', async () => {
  const a = new A()
  const pp = await sql<{ state: string; basis: string; publisher_flag: boolean; document_marked: boolean }>(
    `SELECT state, basis, publisher_flag, document_marked FROM ${PROVISION_POWER_TABLE} WHERE gid = $1 AND provision_ref = 'section-20'`, CRAG)
  a.read(pp.length)
  a.ok('s.20 itself: none — the publisher marked CRaG and did not mark s.20, and its text has no power phrase',
    pp[0]?.state === 'none' && pp[0]?.basis === 'no-flag-no-text' && pp[0]?.document_marked === true && pp[0]?.publisher_flag === false, JSON.stringify(pp[0]))
  const s52 = await sql<{ state: string }>(`SELECT state FROM ${PROVISION_POWER_TABLE} WHERE gid = $1 AND provision_ref = 'section-52'`, CRAG)
  a.ok('and s.52 (a power to commence by order) is power — the test can tell them apart', s52[0]?.state === 'power', JSON.stringify(s52[0]))

  const r = await onwardFrom(CRAG, { provision: 'section-20', limit: 500 })
  a.read(r.rows.length)
  const k = (x: string) => r.perKind.find((c) => c.kind === x)!
  a.ok('made-under naming s.20: 0', k('made-under').scope.provision === 0)
  a.ok('unresolved naming s.20: 0', k('enacting-unresolved').scope.provision === 0)
  for (const g of THREE) {
    const m = r.rows.find((x) => x.act === g && x.kind === 'enacting-mention' && x.scope === 'provision')
    a.ok(`${g}: an enacting-mention naming s.20, its words procedural, the provision none`,
      !!m && m.enablingRole === 'mention' && !!m.enablingRoleWords && m.provisionPower?.state === 'none',
      JSON.stringify(m && [m.enablingRole, m.enablingRoleWords, m.provisionPower]))
    // ⚠ The property, not "no other row": the M3 mutation showed a text-detected `mentions` row for the same SI is legitimate.
    a.ok(`${g}: not made under s.20, nor unresolved`, !r.rows.some((x) => x.act === g && (x.kind === 'made-under' || x.kind === 'enacting-unresolved') && x.scope === 'provision'))
  }
  // the words, read rather than trusted
  const words = await sql<{ source_gid: string; citation_text: string }>(
    `SELECT source_gid, citation_text FROM citation_edge WHERE detection = 'enabling' AND target_act_id = $1 AND target_provision_ref = 'section-20'`, CRAG)
  a.read(words.length)
  a.ok('ssi/2024/101 and uksi/2024/512 say "the requirements of section 20"', ['ssi/2024/101', 'uksi/2024/512'].every((g) => words.some((w) => w.source_gid === g && /requirements of section 20\b/.test(w.citation_text))))
  a.ok('uksi/2020/38 says "under section 20(1)(a)" — of a copy LAID BEFORE Parliament, not of a power', words.some((w) => w.source_gid === 'uksi/2020/38' && /under section 20\(1\)\(a\)/.test(w.citation_text)))
  a.ok('the reader says the §2.3 sentence', !!r.mentionOnly && r.mentionOnly.startsWith('3 instruments reference this provision') && r.mentionOnly.includes('None is made under a power in it'), String(r.mentionOnly))
  const t = await statuteOnward.run(fakeCtx(), { target: 'ukpga/2010/25/section/20', depth: 1, limit: 50, include_case_law: false, include_mentions: false })
  const d = t.data as any
  a.ok('the tool hands Lex the provision’s own state, low confidence, and the sentence', d.provision_itself?.state === 'none' && d.provision_itself?.confidence === 'low' && d.mention_only === r.mentionOnly)
  a.ok('the tool shows the three under the reference heading, never the dependency heading',
    THREE.every((g) => (d.rows as any[]).some((x) => x.node === g && x.heading === STRENGTH_HEADING.reference.heading))
    && !(d.rows as any[]).some((x) => THREE.includes(x.node) && x.heading === STRENGTH_HEADING.dependency.heading))
  return a.done(`made-under Act-wide on s.20: ${k('made-under').scope.actWide} (words name ss.45/46/52; the list parser drops their section)`)
})

tc('G3 enacting-unresolved: words claim the power, the provision is none — every such row, and only those, against SQL', async () => {
  const a = new A()
  // The rule, per INSTRUMENT, written here in SQL and nowhere else in this check:
  //   made-under  its words name a provision as the power that is not `none` — or name no provision but the Act
  //   unresolved  its words name provisions as the power, and every one is `none` (its Act-level row is the same anchor)
  //   mention     neither
  // ⚠ The first version chose Acts by power-on-none ROWS; on all three, every such instrument also named a real power and
  // so was, rightly, made-under — and "every unresolved row" was asserted over an empty set. Then, choosing instruments
  // that are ONLY unresolved found none in the whole table: the reader was letting the Act-level row of the same anchor
  // keep them made-under. Both are why this classifies per instrument.
  const PER_INSTRUMENT = `
      SELECT c.target_act_id g, c.source_gid,
             bool_or(c.enabling_role = 'power' AND c.target_provision_ref IS NOT NULL) pp_any,
             bool_or(c.enabling_role = 'power' AND c.target_provision_ref IS NOT NULL AND pp.state IS DISTINCT FROM 'none') pp_ok,
             bool_or(c.enabling_role = 'power' AND c.target_provision_ref IS NULL) act_p
        FROM citation_edge c LEFT JOIN ${PROVISION_POWER_TABLE} pp ON pp.gid = c.target_act_id AND pp.provision_ref = c.target_provision_ref
       WHERE c.detection = 'enabling'`
  const acts = await sql<{ g: string; n: bigint }>(`
    WITH x AS (${PER_INSTRUMENT} GROUP BY 1, 2)
    SELECT g, COUNT(*) n FROM x WHERE pp_any AND NOT pp_ok GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 3`)
  a.ok('there are such rows to test', acts.length === 3)
  for (const { g } of acts) {
    const r = await onwardFrom(g, { kinds: ['made-under', 'enacting-unresolved', 'enacting-mention'], limit: 500 })
    const q = await sql<{ mu: bigint; un: bigint; em: bigint; all_i: bigint }>(`
      WITH x AS (${PER_INSTRUMENT} AND c.target_act_id = $1 GROUP BY 1, 2),
           k AS (SELECT pp_ok OR (NOT pp_any AND act_p) mu, pp_any AND NOT pp_ok un FROM x)
      SELECT COUNT(*) FILTER (WHERE mu) mu, COUNT(*) FILTER (WHERE un) un, COUNT(*) FILTER (WHERE NOT mu AND NOT un) em, COUNT(*) all_i FROM k`, g)
    a.read(num(q[0].all_i))
    const ins = (k: string) => r.perKind.find((c) => c.kind === k)!.instruments
    a.ok(`${g} made-under instruments = SQL`, ins('made-under') === num(q[0].mu), `${ins('made-under')} vs ${num(q[0].mu)}`)
    a.ok(`${g} unresolved instruments = SQL`, ins('enacting-unresolved') === num(q[0].un), `${ins('enacting-unresolved')} vs ${num(q[0].un)}`)
    a.ok(`${g} mention instruments = SQL`, ins('enacting-mention') === num(q[0].em), `${ins('enacting-mention')} vs ${num(q[0].em)}`)
    const un = r.rows.filter((x) => x.kind === 'enacting-unresolved')
    a.ok(`${g} every unresolved row: words power, provision none, its own strength`, un.length > 0 && un.every((x) => x.enablingRole === 'power' && x.provisionPower?.state === 'none' && x.strength === 'unresolved'))
    a.ok(`${g} no made-under row names a provision that is none`, !r.rows.some((x) => x.kind === 'made-under' && x.provisionPower?.state === 'none'))
  }
  return a.done()
})

// ── §3 ─────────────────────────────────────────────────────────────────────────

tc('G4 mentions: opt-in, never merged into cites, counted against SQL, labelled as the weaker kind', async () => {
  const a = new A()
  a.input(1)
  a.ok('not in the default walk', !(ONWARD_KINDS as readonly string[]).includes(MENTIONS_KIND))
  a.ok('requestable', ALL_ONWARD_KINDS.includes(MENTIONS_KIND))
  a.ok('a reference, with its own label that is not the cites label', STRENGTH_OF.mentions === 'reference' && !!KIND_LABEL.mentions && /not marked up/.test(KIND_LABEL.mentions!))
  for (const g of [CRAG, 'ukpga/2010/15']) {
    const plain = await onwardFrom(g, { limit: 5 })
    const both = await onwardFrom(g, { kinds: [...ONWARD_KINDS, MENTIONS_KIND], limit: 5 })
    const q = await sql<{ n: bigint; g: bigint }>(`SELECT COUNT(*) n, COUNT(DISTINCT source_gid) g FROM citation_edge WHERE target_act_id = $1 AND detection = 'text'`, g)
    a.read(num(q[0].n))
    a.ok(`${g} default walk has no mentions line`, !plain.perKind.some((c) => c.kind === MENTIONS_KIND))
    const m = both.perKind.find((c) => c.kind === MENTIONS_KIND)!
    a.ok(`${g} mentions counted = SQL`, m.counted === num(q[0].n) && m.instruments === num(q[0].g), `${m.counted}/${m.instruments} vs ${num(q[0].n)}/${num(q[0].g)}`)
    const c1 = plain.perKind.find((c) => c.kind === 'cites')!, c2 = both.perKind.find((c) => c.kind === 'cites')!
    a.ok(`${g} asking for mentions leaves cites unchanged`, c1.counted === c2.counted, `${c1.counted} vs ${c2.counted}`)
    a.ok(`${g} the mentions line says what it is`, describeKindLine(m).includes(KIND_LABEL.mentions!))
  }
  return a.done()
})

// ── §4 ─────────────────────────────────────────────────────────────────────────

tc('G5 explanatory notes: tagged on every reachable row, labelled before the words, and never handed back as a provision', async () => {
  const a = new A()
  const z = await sql<{ zone: string | null; n: bigint }>(`SELECT source_zone zone, COUNT(*) n FROM citation_edge WHERE detection IN ('markup', 'text') GROUP BY 1`)
  const tot = z.reduce((s, r) => s + num(r.n), 0)
  const und = num(z.find((r) => r.zone === null)?.n ?? 0)
  a.read(tot)
  a.ok('a zone on ≥98% of markup/text rows; the rest stated, not assumed', und / tot < 0.02, `${und} of ${tot} not determined`)
  const enab = await sql<{ n: bigint }>(`SELECT COUNT(*) n FROM citation_edge WHERE detection NOT IN ('markup', 'text') AND source_zone IS NOT NULL`)
  a.ok('no zone on enabling or case-law rows (not applicable)', num(enab[0].n) === 0)
  // GRAA: every marked-up reference to it is in a note (audit-g9-mentions-notes.json)
  const r = await onwardFrom('ukpga/2000/20', { kinds: ['cites'], limit: 50 })
  const cites = r.rows.filter((x) => x.kind === 'cites')
  a.read(cites.length)
  const q = await sql<{ g: string; p: string | null; zone: string | null }>(`
    SELECT source_gid g, source_provision_ref p, source_zone zone FROM citation_edge WHERE target_act_id = 'ukpga/2000/20' AND detection = 'markup'`)
  for (const row of cites) {
    const prov = row.provision.slice(row.act.length + 1).split('/').join('-') || null
    const sqlZone = q.filter((x) => x.g === row.act).map((x) => x.zone)
    const isNote = row.sourceZone === 'explanatory-note' || row.sourceZone === 'earlier-orders-note'
    a.ok(`${row.act}: zone agrees with SQL`, sqlZone.includes(row.sourceZone as string), `${row.sourceZone} vs ${JSON.stringify(sqlZone)}`)
    if (isNote) {
      a.ok(`${row.act}: a note row is handed back as the instrument, not the provision it was filed under`, row.provision === row.act, `${row.provision} (${prov})`)
      const shown = citingTextForDisplay(row.citingText, row.sourceZone)
      a.ok(`${row.act}: the words open with "not part of the law"`, !!shown && /^\[(?:explanatory note|note as to earlier commencement orders) — not part of the law\]/.test(shown), String(shown).slice(0, 60))
    }
  }
  a.ok('GRAA: its cites rows are notes', cites.length > 0 && cites.every((x) => x.sourceZone === 'explanatory-note' || x.sourceZone === 'earlier-orders-note'))
  const t = await statuteOnward.run(fakeCtx(), { target: 'ukpga/2000/20', depth: 1, limit: 50, include_case_law: false, include_mentions: false })
  const tr = ((t.data as any).rows as any[]).filter((x) => x.kind === 'cites')
  a.ok('the tool marks each note row "not part of the law"', tr.length === cites.length && tr.every((x) => /not part of the law/.test(x.not_part_of_the_law ?? '')))
  a.ok('and says how many in its summary', ((t.data as any).notes_not_law ?? []).some((l: string) => l.startsWith(`cites: ${cites.length} of ${cites.length} rows quote an explanatory note`)))
  return a.done()
})

// ── §5 ─────────────────────────────────────────────────────────────────────────

tc('G6 §5a/§5b: judgments are recognised, in their own list, and the coverage layers match Search/Graph', async () => {
  const a = new A()
  a.input(1)
  a.ok('detectionOf recognises caselaw-markup', detectionOf('caselaw-markup') === 'caselaw-markup')
  a.ok('and still returns null for a value it does not know', detectionOf('treaty') === null)
  for (const g of [CRAG, 'ukpga/2010/15']) {
    const i = await inboundFor(g)
    const q = await sql<{ n: bigint; cl: bigint }>(`SELECT COUNT(*) n, COUNT(*) FILTER (WHERE detection = 'caselaw-markup') cl FROM citation_edge WHERE target_act_id = $1`, g)
    a.read(num(q[0].n))
    a.ok(`${g}: judgments = SQL, none unrecognised`, i.caselaw.length === num(q[0].cl) && i.unrecognised.length === 0, `${i.caselaw.length}/${i.unrecognised.length} vs ${num(q[0].cl)}`)
    a.ok(`${g}: no judgment among the statute lists`, ![...i.enabling, ...i.rows, ...i.titleOnly].some((x) => (x.detection as string) === 'caselaw-markup'))
    a.ok(`${g}: the partition is the whole table`, i.enabling.length + i.rows.length + i.titleOnly.length + i.caselaw.length + i.unrecognised.length === num(q[0].n))
  }
  const cov = await graphCoverage()
  const enab = await sql<{ n: bigint }>(`SELECT COUNT(*) n FROM citation_edge WHERE detection = 'enabling'`)
  a.ok('the enabling-power layer counts enabling rows, not judgments', cov.layers.find((l) => l.id === 'enabling-power')?.rows === num(enab[0].n))
  const theirs = fs.readFileSync(path.join(GRAPH, 'coverage.ts'), 'utf8')
  const theirIds = [...theirs.matchAll(/id:\s*'([a-z-]+)'/g)].map((m) => m[1])
  a.ok('every layer Search/Graph declares is declared here', theirIds.every((id) => cov.layers.some((l) => l.id === id)), theirIds.filter((id) => !cov.layers.some((l) => l.id === id)).join(','))
  a.ok('case-to-case is held elsewhere, not "not built"', cov.layers.find((l) => l.id === 'case-to-case-citations')?.status === 'held-elsewhere')
  return a.done()
})

tc('G7 the words a reader is given never call an unresolved row a consequence, and the strengths stay ordered', async () => {
  const a = new A()
  a.input(1)
  a.ok('unresolved sits between dependency and operation', STRENGTH_ORDER.indexOf('unresolved') === 1)
  a.ok('its heading and meaning carry no consequence words', !CONSEQUENCE_WORDS.test(STRENGTH_HEADING.unresolved.heading + ' ' + STRENGTH_HEADING.unresolved.meaning))
  a.ok('every kind has a strength', ALL_ONWARD_KINDS.every((k) => !!STRENGTH_OF[k]))
  a.ok('case law and mentions stay opt-in', !(ONWARD_KINDS as readonly string[]).includes(CASELAW_KIND) && !(ONWARD_KINDS as readonly string[]).includes(MENTIONS_KIND))
  return a.done()
})

// ── controls — each feeds a BROKEN input through the same predicate and must read false ─

control('L1 ⚠ a procedural mention classified as a power is caught (the brief’s failure)', () => {
  const broken = (_role: any, ref: string | null, st: any) => enablingKindOf('power', ref, st) // ignores the words
  return broken('mention', 'section-20', 'none') === 'enacting-mention' && broken('mention', null, null) === 'enacting-mention'
})
control('L2 words-power on a provision that confers none, kept as made-under, is caught', () => {
  const broken = (role: any, _ref: string | null, _st: any) => (role === 'power' ? 'made-under' : 'enacting-mention')
  return broken('power', 'section-20', 'none') === 'enacting-unresolved'
})
control('L3 the provision promoting a mention to a power is caught', () => {
  const broken = (role: any, ref: string | null, st: any) => (st === 'power' ? 'made-under' : enablingKindOf(role, ref, st))
  return broken('mention', 'section-52', 'power') === 'enacting-mention'
})
control('L4 mentions merged into cites is caught', () => {
  const mergedKindOf = (_k: string) => 'cites' as const // every text-detected row filed as a citation
  const line = describeKindLine({ kind: mergedKindOf(MENTIONS_KIND), strength: 'reference', counted: 1868, returned: 50, instruments: 600, split: null })
  return line.includes(KIND_LABEL.mentions!)
})
control('L5 a note shown without its label is caught', () => {
  const unlabelled = (t: string) => citingTextForDisplay(t, null)
  return !!unlabelled('This Order brings into force section 45(1)')?.startsWith('[explanatory note')
})
control('L6 a note handed back as the provision it was filed under is caught', () => {
  const naive = (_z: any, _act: string, filed: string) => filed
  return naive('explanatory-note', 'uksi/2014/3245', 'uksi/2014/3245/article/2') === noteNode('explanatory-note', 'uksi/2014/3245', 'uksi/2014/3245/article/2')
})
control('L7 an undetermined zone read as body is caught', () => {
  const asBody = (s: string | null) => rowZoneOf(s ?? 'body')
  return zoneLabel(asBody(null)) !== null
})
control('L8 the §2.3 sentence said where an instrument IS made under the provision is caught', () => {
  const always = (n: number) => `${n} instruments reference this provision in their enacting words. None is made under a power in it.`
  return always(3) === mentionOnlySentence(3, 1, 0, 'none')
})
control('L9 detectionOf with case law dropped is caught', () => {
  const old = (raw: string) => (raw === 'markup' || raw === 'text' || raw === 'enabling' ? raw : null)
  return old('caselaw-markup') === detectionOf('caselaw-markup')
})

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
  console.log(`\ncheck:graph-9 — ${CASES.length - failed}/${CASES.length} cases, ${asserted} assertions over ${examined} rows + ${inputs} inputs; controls ${fired}/${CONTROLS.length} fired`)
  await prisma.$disconnect()
  process.exit(failed || fired !== CONTROLS.length ? 1 : 0)
})()
