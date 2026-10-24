// ─────────────────────────────────────────────────────────────────────────────
// check:idea-law — the idea↔law join, its reader and its panel (GRAPH 7, BRIEF_GRAPH_7.md).
//
// ⚠ EVERY CASE REPORTS WHAT IT COUNTED (constraint h): rows EXAMINED and assertions MADE. A case that read
// nothing FAILS, so "zero counter-examples" and "zero rows read" can never print the same line.
// ⚠ EVERY PROPERTY HAS A CONTROL that feeds the same predicate a deliberately broken input and must come back
// false (constraint i) — a predicate that cannot say no is not a check.
//
// Parts:
//   A  the table as built — read back from the catalog, not from the migration file
//   B  the resolver on the live corpus and on the publishers, all four states
//   C  the reader on a FIXTURE this script owns (a scratch copy of 452c5ade, deleted in `finally`)
//   D  the panel, rendered, for a set, an empty set and a failed read
//   E  the cold read (CLAUDE.md §26): the real marquee idea and a real idea, nothing created, nothing touched
//
// Writes: only to the scratch copy and its own link rows, all removed at the end. Part A's refusals run inside
// transactions that the server rejects; nothing they attempt can persist.
//
// Usage:  npm run check:idea-law            (needs the network for the publisher cases; --offline skips them, NOT RUN)
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { prisma } from '../lib/prisma'
import { ideaLawSet, resolveLawTarget, effectsLoadDate, type LawFetch } from '../lib/lex/statutory-graph'
import { parseHandFile, attachHandRows } from '../lib/lex/idea-law-attach'
import {
  LAW_RELATIONS, LAW_SOURCES, LAW_TARGET_KINDS, BILL_LABEL, RESOLUTION_WORDS, lawLineKey, mergeLawLines,
  type IdeaLawSet, type LawEffectsSummary, type LawResolutionState,
} from '../lib/lex/idea-law-pure'
import IdeaLawPanel from '../components/lex/IdeaLawPanel'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

const OFFLINE = process.argv.includes('--offline')
const ROOT = process.cwd() // run from scrutinise-web, as every npm script is
const DRAFT = `${ROOT}/../docs/FOR_CHARLIE/graph7_idea_law_rows_452c5ade.txt`
const MARQUEE = '452c5ade-3153-400a-bf48-3b71aaa52773'

// ── harness (as check:effects) ─────────────────────────────────────────────────
interface Outcome { examined: number; inputs: number; asserted: number; fail?: string; notRun?: string; note?: string }
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
const CASES: Array<{ name: string; run: () => Promise<Outcome> }> = []
const CONTROLS: Array<{ name: string; propertyHolds: () => boolean | Promise<boolean> }> = []
const tc = (name: string, run: () => Promise<Outcome>) => CASES.push({ name, run })
const control = (name: string, propertyHolds: () => boolean | Promise<boolean>) => CONTROLS.push({ name, propertyHolds })
const sql = <T = any>(q: string, ...p: unknown[]) => prisma.$queryRawUnsafe<T[]>(q, ...p)
const notRun = (why: string): Outcome => ({ examined: 0, inputs: 0, asserted: 0, notRun: why })

// ── the predicates — shared by the cases and their controls ─────────────────────
/** Every live row in exactly one group, and that group is its own relation. */
function partitionHolds(s: IdeaLawSet): boolean {
  const seen = new Map<string, string>()
  for (const rel of LAW_RELATIONS) for (const r of s.grouped[rel]) {
    if (r.relation !== rel || seen.has(r.id)) return false
    seen.set(r.id, rel)
  }
  return seen.size === s.rows.length && s.rows.every((r) => seen.has(r.id))
}
/** The change-the-words split adds up, per type. */
const splitHolds = (fx: LawEffectsSummary) => fx.perType.length > 0 && fx.perType.every((t) => t.textual + t.notTextual + t.unclassified === t.total)
/** No Bill and no document ever reached the effects reader; no modifies/relies_on/... row carries corpus figures. */
const effectsOnlyWhereAllowed = (s: IdeaLawSet) => s.rows.every((r) =>
  r.effects === null || ((r.relation === 'amends' || r.relation === 'repeals') && r.targetKind !== 'bill' && r.targetKind !== 'document'))
/** The modifies group, as rendered, carries no corpus effects block. */
function renderedModifiesClean(html: string): boolean {
  const m = /data-law-group="modifies"([\s\S]*?)(?=data-law-group="|$)/.exec(html)
  return !!m && !m[1].includes('data-law-effects')
}
/**
 * Every bill row's rendered entry says it is not law, and shows no effects figures.
 * ⚠ The second half was added after mutation 1 (the Bill guard removed) turned only C3 red: the panel drew a
 * Bill carrying “changes already made to it” and the first version of this predicate did not look.
 */
function billsLabelled(html: string, s: IdeaLawSet): boolean {
  const bills = s.rows.filter((r) => r.targetKind === 'bill')
  return bills.length > 0 && bills.every((b) => {
    const m = new RegExp(`data-law-row="${b.id}"([\\s\\S]*?)</li>`).exec(html)
    return !!m && m[1].includes(BILL_LABEL) && !m[1].includes('data-law-effects')
  })
}

// ═══ A — THE TABLE AS BUILT ═══════════════════════════════════════════════════
const EXPECTED_COLUMNS: Record<string, [string, 'YES' | 'NO']> = {
  id: ['text', 'NO'], idea_id: ['text', 'NO'], action_id: ['text', 'YES'], target_kind: ['text', 'NO'],
  doc_uri: ['text', 'NO'], provision_path: ['text', 'YES'], relation: ['text', 'NO'], source: ['text', 'NO'],
  source_detail: ['text', 'YES'], note: ['text', 'YES'], as_at: ['date', 'NO'],
  created_at: ['timestamp with time zone', 'NO'], superseded_by: ['text', 'YES'],
  withdrawn_at: ['timestamp with time zone', 'YES'], withdrawn_detail: ['text', 'YES'],
}

tc('A1 every column exists with the specified type and nullability — ids are TEXT, never numeric', async () => {
  const a = new A()
  const cols = await sql<{ column_name: string; data_type: string; is_nullable: 'YES' | 'NO' }>(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'idea_law_link'`)
  a.read(cols.length)
  a.ok('column count', cols.length === Object.keys(EXPECTED_COLUMNS).length, `${cols.length}`)
  for (const [name, [type, nul]] of Object.entries(EXPECTED_COLUMNS)) {
    const c = cols.find((x) => x.column_name === name)
    a.ok(`${name} present`, !!c)
    if (c) a.ok(`${name} is ${type} ${nul === 'NO' ? 'not null' : 'null'}`, c.data_type === type && c.is_nullable === nul, `${c.data_type} ${c.is_nullable}`)
  }
  return a.done(cols.map((c) => `${c.column_name}:${c.data_type}`).join(' '))
})

async function checkValues(conname: string): Promise<string[]> {
  const r = await sql<{ def: string }>(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'idea_law_link'::regclass AND conname = $1`, conname)
  return r.length ? [...r[0].def.matchAll(/'([^']+)'::text/g)].map((m) => m[1]) : []
}

tc('A2 relation / source / target_kind are enforced by CHECK constraints, and match the application lists exactly', async () => {
  const a = new A()
  for (const [con, list] of [['idea_law_link_relation_check', LAW_RELATIONS], ['idea_law_link_source_check', LAW_SOURCES], ['idea_law_link_target_kind_check', LAW_TARGET_KINDS]] as const) {
    const vals = await checkValues(con)
    a.read(1)
    a.ok(`${con} exists`, vals.length > 0)
    a.ok(`${con} = [${list.join(', ')}]`, JSON.stringify([...vals].sort()) === JSON.stringify([...list].sort()), `db has [${vals.join(', ')}]`)
  }
  a.ok('relation has seven values, modifies among them', LAW_RELATIONS.length === 7 && (LAW_RELATIONS as readonly string[]).includes('modifies'))
  return a.done()
})

tc('A3 the foreign keys name "Idea" and "LexCoherentAction", and neither model is @@map-ped in schema.prisma', async () => {
  const a = new A()
  const fks = await sql<{ conname: string; def: string }>(
    `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'idea_law_link'::regclass AND contype = 'f'`)
  a.read(fks.length)
  const def = (col: string) => fks.find((f) => f.def.startsWith(`FOREIGN KEY (${col})`))?.def ?? ''
  a.ok('idea_id → "Idea"(id) RESTRICT', /REFERENCES "Idea"\(id\) ON DELETE RESTRICT/.test(def('idea_id')), def('idea_id'))
  a.ok('action_id → "LexCoherentAction"(id) RESTRICT', /REFERENCES "LexCoherentAction"\(id\) ON DELETE RESTRICT/.test(def('action_id')), def('action_id'))
  a.ok('superseded_by → idea_law_link(id)', /REFERENCES idea_law_link\(id\)/.test(def('superseded_by')), def('superseded_by'))
  const schema = readFileSync(`${ROOT}/prisma/schema.prisma`, 'utf8')
  for (const model of ['Idea', 'LexCoherentAction']) {
    const block = new RegExp(`^model ${model} \\{([\\s\\S]*?)^\\}`, 'm').exec(schema)?.[1] ?? ''
    a.input(1)
    a.ok(`model ${model} found`, block.length > 0)
    a.ok(`model ${model} has no @@map`, !/@@map\(/.test(block))
  }
  return a.done()
})

tc('A4 the three PARTIAL indexes exist, each on superseded_by IS NULL AND withdrawn_at IS NULL (docs/CLAUDE.md §21)', async () => {
  const a = new A()
  const ix = await sql<{ indexname: string; indexdef: string }>(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'idea_law_link'`)
  a.read(ix.length)
  for (const [name, cols] of [['idea_law_link_idea_live_idx', '(idea_id)'], ['idea_law_link_target_live_idx', '(doc_uri, provision_path)'], ['idea_law_link_action_live_idx', '(action_id)']]) {
    const d = ix.find((x) => x.indexname === name)?.indexdef ?? ''
    a.ok(`${name} on ${cols} WHERE live`, d.includes(cols) && /WHERE \(\(superseded_by IS NULL\) AND \(withdrawn_at IS NULL\)\)/.test(d), d || 'missing')
  }
  const register = readFileSync(`${ROOT}/../docs/CLAUDE.md`, 'utf8')
  a.input(1)
  for (const name of ['idea_law_link_idea_live_idx', 'idea_law_link_target_live_idx', 'idea_law_link_action_live_idx']) a.ok(`${name} is in the §21 register`, register.includes(name))
  return a.done()
})

/** Attempt one insert the database must refuse; true if it was refused. Nothing can persist: it either fails or is rolled back. */
async function refused(ideaId: string, row: Record<string, unknown>): Promise<boolean> {
  const cols = Object.keys(row)
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`INSERT INTO idea_law_link (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})`, ...cols.map((c) => row[c]))
      throw new Error('__accepted__')
    })
    return false
  } catch (e) {
    return !String(e).includes('__accepted__')
  }
}

// ═══ B — THE RESOLVER ═════════════════════════════════════════════════════════
/** The Acts the spec names, by the titles it gives them — written here, independently of the resolver. */
const SPEC_TITLES: Record<string, RegExp> = {
  'ukpga/2010/25': /^Constitutional Reform and Governance Act 2010$/, 'ukpga/1992/61': /^Civil Service \(Management Functions\) Act 1992$/,
  'ukpga/2000/20': /^Government Resources and Accounts Act 2000$/, 'ukpga/1983/44': /^National Audit Act 1983$/,
  'ukpga/2011/4': /^Budget Responsibility and National Audit Act 2011$/, 'ukpga/2000/36': /^Freedom of Information Act 2000$/,
  'ukpga/1998/23': /^Public Interest Disclosure Act 1998$/, 'ukpga/1996/18': /^Employment Rights Act 1996$/,
  'ukpga/2010/15': /^Equality Act 2010$/, 'ukpga/2005/12': /^Inquiries Act 2005$/, 'ukpga/2023/54': /^Procurement Act 2023$/,
  'ukpga/2022/30': /^Building Safety Act 2022$/, 'ukpga/2000/8': /^Financial Services and Markets Act 2000$/,
  'ukpga/2013/33': /^Financial Services \(Banking Reform\) Act 2013$/, 'ukpga/2007/19': /^Corporate Manslaughter and Corporate Homicide Act 2007$/,
  'ukpga/1972/70': /^Local Government Act 1972$/, 'ukpga/1989/42': /^Local Government and Housing Act 1989$/, 'ukpga/2022/31': /^Health and Care Act 2022$/,
}

const fetchSays = (status: number): LawFetch => async () => ({ status })
const fetchThrows: LawFetch = async () => { throw new Error('simulated network failure') }

tc('B1 every id in the draft law list resolves HELD, and to the Act the spec meant (title read from the corpus)', async () => {
  const a = new A()
  const { rows, errors } = parseHandFile(readFileSync(DRAFT, 'utf8'))
  a.ok('draft file parses cleanly', errors.length === 0, errors.join('; '))
  a.ok('draft holds 20 rows', rows.length === 20, `${rows.length}`)
  for (const r of rows) {
    const kind = r.docUri.startsWith('bill/') ? 'bill' : r.provisionPath ? 'provision' : 'act'
    const res = await resolveLawTarget(kind, r.docUri, r.provisionPath, { external: false })
    a.read(1)
    a.ok(`line ${r.line} ${r.docUri} held`, res.state === 'held', `${res.state}: ${res.reason}`)
    if (SPEC_TITLES[r.docUri]) a.ok(`line ${r.line} ${r.docUri} is “${SPEC_TITLES[r.docUri].source}”`, SPEC_TITLES[r.docUri].test(res.title ?? ''), res.title ?? 'no title')
    if (r.provisionPath) a.ok(`line ${r.line} provision ${r.provisionPath} held`, res.provision?.state === 'held', res.provision?.reason)
  }
  return a.done()
})

tc('B2 the four states are DISTINCT for the same unknown id under three publisher answers, and none is “held”', async () => {
  const a = new A()
  const id = 'ukpga/2099/999'
  const states: LawResolutionState[] = []
  for (const [label, f, ext] of [['publisher 200', fetchSays(200), true], ['publisher 400', fetchSays(400), true], ['publisher 404', fetchSays(404), true], ['network down', fetchThrows, true], ['publisher 503', fetchSays(503), true], ['not asked', fetchSays(200), false]] as const) {
    const r = await resolveLawTarget('act', id, null, { fetch: f, external: ext })
    a.input(1)
    states.push(r.state)
    a.ok(`${label}: never held`, r.state !== 'held')
    a.ok(`${label}: says why`, r.reason.length > 0)
  }
  a.ok('200 → named-not-held', states[0] === 'named-not-held', states[0])
  a.ok('400 → no-such-id (legislation.gov.uk answers 400 for a nonexistent id)', states[1] === 'no-such-id', states[1])
  a.ok('404 → no-such-id', states[2] === 'no-such-id', states[2])
  a.ok('network failure → lookup-failed', states[3] === 'lookup-failed', states[3])
  a.ok('503 → lookup-failed, NOT no-such-id', states[4] === 'lookup-failed', states[4])
  a.ok('publisher not asked → lookup-failed, NOT no-such-id', states[5] === 'lookup-failed', states[5])
  return a.done(states.join(' / '))
})

/**
 * Acts in our register with no text under ANY of their forms.
 * ⚠ `in_corpus = false` is a fact about ONE id form, not about the Act: the first version of this query took
 * `ukpga/1801/52`, whose regnal form `ukpga/Geo3/41/52` is held, and the resolver rightly said held. The bridge is
 * excluded here in SQL, independently of the resolver.
 */
const NOT_HELD_SUBJECTS = `
  SELECT a.gid FROM corpus_acts a
  WHERE NOT a.in_corpus AND a.gid ~ '^ukpga/(19[7-9][0-9]|20[0-9]{2})/[0-9]+$'
    AND NOT EXISTS (SELECT 1 FROM legislation_identity i JOIN corpus_acts b ON b.gid IN (i.form, i.canonical) AND b.in_corpus
                    WHERE i.form = a.gid OR i.canonical = a.gid)
  ORDER BY a.gid LIMIT $1`

tc('B3 NAMED, NOT HELD from our own tables (publisher not asked) — and a calendar form of a regnal Act we hold is HELD, not “not held”', async () => {
  const a = new A()
  const reg = await sql<{ gid: string }>(NOT_HELD_SUBJECTS, 3)
  a.read(reg.length)
  if (!reg.length) return notRun('no Act in corpus_acts is registered without text under any form, so this state has no live subject')
  for (const r of reg) {
    const res = await resolveLawTarget('act', r.gid, null, { external: false })
    a.ok(`${r.gid} named-not-held`, res.state === 'named-not-held', `${res.state}: ${res.reason}`)
  }
  const bridged = await sql<{ form: string; canonical: string }>(
    `SELECT i.form, i.canonical FROM legislation_identity i JOIN corpus_acts b ON b.gid = i.canonical AND b.in_corpus AND b.section_count > 0
     JOIN corpus_acts c ON c.gid = i.form AND NOT c.in_corpus WHERE i.basis <> 'ambiguous-refused' ORDER BY i.form LIMIT 1`)
  a.read(bridged.length)
  if (bridged.length) {
    const res = await resolveLawTarget('act', bridged[0].form, null, { external: false })
    a.ok(`${bridged[0].form} (no text under this form) is held as ${bridged[0].canonical}`, res.state === 'held' && res.canonical === bridged[0].canonical, `${res.state} ${res.canonical}`)
  }
  return a.done([...reg.map((r) => r.gid), ...bridged.map((b) => `${b.form}→${b.canonical}`)].join(', '))
})

tc('B4 provisions: held by exact row, held beneath (a schedule), case-insensitive, a Part is unaddressable, a missing section is not held', async () => {
  const a = new A()
  const cases: Array<[string, string, string]> = [
    ['ukpga/2010/15', 'section/149', 'held'], ['ukpga/2000/36', 'schedule/1', 'held'],
    ['ukpga/2000/36', 'schedule/1/paragraph/14a', 'held'], ['ukpga/2010/15', 'part/11', 'unaddressable'],
    ['ukpga/2010/15', 'section/9999', 'not-held'], ['ukpga/2010/15', 'section/14', 'held'],
  ]
  for (const [uri, path, want] of cases) {
    const r = await resolveLawTarget('provision', uri, path, { external: false })
    a.read(1)
    a.ok(`${uri} ${path} → provision ${want}`, r.provision?.state === want, `${r.provision?.state}: ${r.provision?.reason}`)
    if (want === 'not-held') a.ok(`${uri} ${path} overall is not held`, r.state !== 'held', r.state)
  }
  // section/14 must not be satisfied by section/149 (the neighbouring-section rule).
  const s14 = await sql<{ n: number }>(`SELECT COUNT(*)::int AS n FROM corpus_sections WHERE id = 'primary-acts-2000plus:ukpga/2010/15:section-14'`)
  a.read(1)
  a.ok('section-14 is itself a row (so its hold is not borrowed from section-149)', s14[0].n === 1)
  return a.done()
})

tc('B5 Bills and documents: held Bill, held document, malformed ids refused as no-such-id without any lookup', async () => {
  const a = new A()
  const bill = await resolveLawTarget('bill', 'bill/4019', null, { external: false })
  a.read(1); a.ok('bill/4019 held', bill.state === 'held', bill.reason)
  const doc = await resolveLawTarget('document', 'doc/govuk-core-docs/government/publications/civil-service-code', null, { external: false })
  a.read(1); a.ok('the Civil Service Code document held', doc.state === 'held', doc.reason)
  const nodoc = await resolveLawTarget('document', 'doc/govuk-core-docs/government/publications/no-such-thing-graph7', null, { external: false })
  a.read(1); a.ok('a document key we hold nothing under → no-such-id', nodoc.state === 'no-such-id', nodoc.reason)
  for (const [k, u] of [['bill', 'bill/abc'], ['document', 'doc/civil-service-code'], ['act', 'Equality Act 2010']] as const) {
    const r = await resolveLawTarget(k, u, null, { fetch: fetchThrows })
    a.input(1); a.ok(`“${u}” malformed → no-such-id, not lookup-failed`, r.state === 'no-such-id', r.state)
  }
  return a.done()
})

tc('B6 the real publishers: a nonexistent Act, Bill and section of a held Act are each NO-SUCH-ID at the publisher', async () => {
  if (OFFLINE) return notRun('--offline: the publishers were not asked')
  const a = new A()
  const act = await resolveLawTarget('act', 'ukpga/2099/999', null)
  a.input(1); a.ok('ukpga/2099/999 → no-such-id', act.state === 'no-such-id', act.reason)
  const bill = await resolveLawTarget('bill', 'bill/99999999', null)
  a.input(1); a.ok('bill/99999999 → no-such-id', bill.state === 'no-such-id', bill.reason)
  const sec = await resolveLawTarget('provision', 'ukpga/2010/15', 'section/9999')
  a.input(1); a.ok('Equality Act section/9999 → no-such-id at the publisher', sec.state === 'no-such-id', sec.reason)
  return a.done([act, bill, sec].map((r) => r.state).join(' / '))
})

// ═══ C — THE READER, ON A FIXTURE THIS SCRIPT OWNS ═════════════════════════════
let scratch: { id: string } | null = null
let fixtureSet: IdeaLawSet | null = null
const fixture: { actionId?: string; foreignActionId?: string; bill?: string; modifies?: string; notHeld?: string; supersededOld?: string; withdrawn?: string; dupOfHand?: string; inconsistent?: string; actionRow?: string } = {}

async function buildFixture(): Promise<void> {
  scratch = await scratchCopy(MARQUEE.slice(0, 8), 'graph7-check')
  const actions = await prisma.lexCoherentAction.findMany({ where: { ideaId: scratch.id }, orderBy: { number: 'asc' }, take: 1 })
  const foreign = await prisma.lexCoherentAction.findFirst({ where: { ideaId: MARQUEE } })
  if (!actions.length || !foreign) throw new Error('the marquee idea has no actions to copy — the fixture cannot carry an action row')
  fixture.actionId = actions[0].id
  fixture.foreignActionId = foreign.id

  const { rows } = parseHandFile(readFileSync(DRAFT, 'utf8'))
  const r = await attachHandRows(scratch.id, rows, { write: true, by: 'check:idea-law', external: false })
  if (r.wrote !== 20) throw new Error(`the hand path wrote ${r.wrote} of 20: ${r.refusedReason}`)

  const base = { ideaId: scratch.id, asAt: new Date('2026-10-22T00:00:00Z'), source: 'drafting_instruction', sourceDetail: 'check:idea-law fixture' }
  const make = (d: Record<string, unknown>) => prisma.ideaLawLink.create({ data: { ...base, ...d } as never })
  fixture.actionRow = (await make({ actionId: fixture.actionId, targetKind: 'provision', docUri: 'ukpga/2010/15', provisionPath: 'section/149', relation: 'amends', note: 'fixture: an action amending s.149' })).id
  fixture.modifies = (await make({ targetKind: 'provision', docUri: 'ukpga/2000/36', provisionPath: 'section/5', relation: 'modifies', note: 'fixture: applies s.5 as if extended' })).id
  fixture.bill = (await make({ targetKind: 'bill', docUri: 'bill/4019', relation: 'amends', note: 'fixture: a Bill filed under amends — must still never reach the effects reader' })).id
  // A Lex-style write that did not go through the verified path: the reader must still say what it is.
  const notHeld = (await sql<{ gid: string }>(NOT_HELD_SUBJECTS, 1))[0]?.gid
  if (notHeld) fixture.notHeld = (await make({ targetKind: 'act', docUri: notHeld, relation: 'relies_on', note: 'fixture: named, not held' })).id
  const old = await make({ targetKind: 'act', docUri: 'ukpga/1998/42', relation: 'context', note: 'fixture: superseded' })
  const repl = await make({ targetKind: 'act', docUri: 'ukpga/1998/42', relation: 'constrains', note: 'fixture: the replacement' })
  await prisma.ideaLawLink.update({ where: { id: old.id }, data: { supersededById: repl.id } })
  fixture.supersededOld = old.id
  // Retired with nothing to point at (LEX 26-U §5: the target is gone from the instruction's next version).
  fixture.withdrawn = (await make({ targetKind: 'act', docUri: 'ukpga/2006/46', relation: 'relies_on', note: 'fixture: withdrawn', withdrawnAt: new Date(), withdrawnDetail: 'check:idea-law fixture: target absent from v2' })).id
  // BRIEF_26U §5: an instruction row naming what a hand row already names (amends CRaG 2010) is one line, two sources.
  fixture.dupOfHand = (await make({ actionId: fixture.actionId, targetKind: 'act', docUri: 'ukpga/2010/25', relation: 'amends', note: 'fixture: the instruction names CRaG too' })).id
  fixture.inconsistent = (await make({ actionId: fixture.foreignActionId, targetKind: 'act', docUri: 'ukpga/2010/25', relation: 'amends', note: 'fixture: an action of ANOTHER idea' })).id
  fixtureSet = await ideaLawSet(scratch.id, { external: false })
}

async function teardown(): Promise<void> {
  if (!scratch) return
  const ids = { ideaId: scratch.id }
  // Superseding pointers first: superseded_by is RESTRICT.
  await prisma.ideaLawLink.updateMany({ where: ids, data: { supersededById: null } })
  const n = await prisma.ideaLawLink.deleteMany({ where: ids })
  const hard = await deleteScratch(scratch.id)
  const left = await prisma.ideaLawLink.count({ where: ids })
  console.log(`\nteardown: ${n.count} fixture link rows deleted, ${left} left; scratch idea ${hard ? 'deleted' : 'SOFT-deleted (hard delete refused)'}`)
}

const needFixture = (): IdeaLawSet => { if (!fixtureSet) throw new Error('fixture was not built'); return fixtureSet }

tc('C1 every live row lands in exactly one group, its own relation; superseded rows are out and counted', async () => {
  const a = new A()
  const s = needFixture()
  a.read(s.examined.linkRows)
  a.ok('partition holds', partitionHolds(s))
  a.ok('the superseded row is not returned', !s.rows.some((r) => r.id === fixture.supersededOld))
  a.ok('superseded counted: 1', s.examined.superseded === 1, `${s.examined.superseded}`)
  a.ok('its replacement is returned', s.rows.some((r) => r.docUri === 'ukpga/1998/42' && r.relation === 'constrains'))
  a.ok('the withdrawn row is not returned', !s.rows.some((r) => r.id === fixture.withdrawn) && !s.inconsistent.some((r) => r.id === fixture.withdrawn))
  a.ok('withdrawn counted: 1', s.examined.withdrawn === 1, `${s.examined.withdrawn}`)
  // The two CHECKs, exercised: a withdrawal without a reason, and a row both superseded and withdrawn, are refused.
  const refused = (p: Promise<unknown>) => p.then(() => false, (e) => /withdrawn/.test(String(e?.message ?? e)))
  a.ok('withdrawn_at without withdrawn_detail is refused', await refused(prisma.ideaLawLink.update({ where: { id: fixture.withdrawn! }, data: { withdrawnDetail: null } })))
  a.ok('superseded AND withdrawn is refused', await refused(prisma.ideaLawLink.update({ where: { id: fixture.withdrawn! }, data: { supersededById: fixture.modifies! } })))
  const { linkRows, superseded, withdrawn, mergedIntoALine } = s.examined
  a.ok('linkRows = lines + merged + superseded + withdrawn + inconsistent', linkRows === s.rows.length + mergedIntoALine + superseded + withdrawn + s.inconsistent.length, `${linkRows} vs ${s.rows.length}+${mergedIntoALine}+${superseded}+${withdrawn}+${s.inconsistent.length}`)
  return a.done(LAW_RELATIONS.map((r) => `${r} ${s.grouped[r].length}`).join(' · '))
})

tc('C2 action_id survives the union: the action row names WHICH action, the idea rows say “the idea as a whole”', async () => {
  const a = new A()
  const s = needFixture()
  const row = s.rows.find((r) => r.id === fixture.actionRow)
  a.read(s.rows.length)
  a.ok('the action row is in the set', !!row)
  a.ok('it carries the action id', row?.action?.id === fixture.actionId, row?.action?.id ?? 'null')
  a.ok('it carries the action number', typeof row?.action?.number === 'number')
  a.ok('it sits in amends beside the idea-level rows', s.grouped.amends.some((r) => r.id === fixture.actionRow) && s.grouped.amends.some((r) => r.action === null))
  a.ok('every hand row has no action', s.rows.filter((r) => r.source === 'hand').every((r) => r.action === null))
  return a.done()
})

tc('C9 a hand row and an instruction row naming the same (relation, target) are ONE line carrying both sources; a different relation is not merged', async () => {
  const a = new A()
  const s = needFixture()
  a.read(s.rows.length)
  const keys = s.rows.map(lawLineKey)
  a.ok('no two lines share (relation, doc_uri, provision_path)', new Set(keys).size === keys.length)
  const line = s.rows.find((r) => r.sources.some((e) => e.id === fixture.dupOfHand))
  a.ok('the instruction row is on a line', !!line)
  a.ok('that line is amends ukpga/2010/25', line?.relation === 'amends' && line?.docUri === 'ukpga/2010/25' && line?.provisionPath === null)
  a.ok('it carries both sources, hand first', line?.sources.length === 2 && line.sources[0].source === 'hand' && line.sources[1].source === 'drafting_instruction', line?.sources.map((e) => e.source).join(',') ?? 'none')
  a.ok('the instruction entry keeps its action', line?.sources[1]?.action?.id === fixture.actionId)
  a.ok('the instruction row is NOT also a line of its own', !s.rows.some((r) => r.id === fixture.dupOfHand))
  a.ok('merged counted: 1', s.examined.mergedIntoALine === 1, `${s.examined.mergedIntoALine}`)
  a.ok('line as_at is the oldest of its sources', line?.asAt === line?.sources.map((e) => e.asAt).sort()[0])
  // The pure merge, on inputs it did not get from the DB: same target, different relation → two lines.
  const base = line!
  const other = { ...base, id: 'x', relation: 'relies_on' as const, sources: [{ ...base.sources[0], id: 'x' }] }
  a.input(1)
  a.ok('amends and relies_on on one target stay two lines', mergeLawLines([{ ...base, sources: [base.sources[0]] }, other]).length === 2)
  const html = render(s, null)
  a.ok('the panel shows the line once, with both sources', html.split(`data-law-row="${line?.id}"`).length === 2
    && html.includes(`data-law-source-row="${fixture.dupOfHand}"`) && html.includes('data-law-sources="2"'))
  return a.done(`${line?.sources.map((e) => `${e.source}${e.action ? ` (action ${e.action.number})` : ''}`).join(' + ')}`)
})

tc('C10 effectsLoadDate() (LEX 26-U as_at) is the plain-SQL MAX(extracted_at) date, and is the date the panel says the record was refreshed', async () => {
  const a = new A()
  const d = await effectsLoadDate()
  const newest = (await sql<{ d: Date | null }>(`SELECT MAX(extracted_at) AS d FROM legislation_edges`))[0]?.d ?? null
  const direct = newest ? new Date(newest).toISOString().slice(0, 10) : null
  a.read(1)
  a.ok('a YYYY-MM-DD date', !!d && /^\d{4}-\d{2}-\d{2}$/.test(d), String(d))
  a.ok('equals a separate SQL read', d === direct, `${d} vs ${direct}`)
  a.ok('equals freshness.recordRefreshedAt', d === needFixture().freshness.recordRefreshedAt, `${needFixture().freshness.recordRefreshedAt}`)
  return a.done(String(d))
})

tc('C3 a Bill never reaches the effects reader — even one filed under amends — and nothing but amends/repeals carries figures', async () => {
  const a = new A()
  const s = needFixture()
  a.read(s.rows.length)
  const bills = s.rows.filter((r) => r.targetKind === 'bill')
  a.ok('two Bill rows (context + amends)', bills.length === 2, `${bills.length}`)
  a.ok('no Bill row has effects', bills.every((b) => b.effects === null))
  a.ok('effects only where allowed', effectsOnlyWhereAllowed(s))
  return a.done()
})

tc('C4 amends rows carry GRAPH_6 counts that add up per type AND equal a separate plain-SQL count of the effects table', async () => {
  const a = new A()
  const s = needFixture()
  const am = s.grouped.amends.filter((r) => r.targetKind !== 'bill')
  a.ok('amends rows with legislation', am.length >= 4, `${am.length}`)
  for (const r of am) {
    a.ok(`${r.docUri}${r.provisionPath ? ` ${r.provisionPath}` : ''} has effects`, !!r.effects && !r.effects.failed, r.effects?.failed ?? '')
    if (!r.effects) continue
    a.ok(`${r.docUri} split adds up`, splitHolds(r.effects))
    const prov = r.provisionPath ? r.provisionPath.split('/').join('-').toLowerCase() : null
    const direct = await sql<{ edge_type: string; n: number }>(
      `SELECT edge_type, COUNT(*)::int AS n FROM legislation_edges WHERE split_part(to_id, ':', 2) = $1 AND edge_type IN ('amends','repeals','modifies')
       ${prov ? `AND (lower(split_part(to_id, ':', 3)) = $2 OR lower(split_part(to_id, ':', 3)) ~ ('^' || $2 || '([^0-9].*)?$') OR split_part(to_id, ':', 3) = '')` : ''} GROUP BY 1`,
      ...(prov ? [r.docUri, prov] : [r.docUri]))
    a.read(direct.reduce((x, d) => x + d.n, 0))
    for (const t of r.effects.perType) a.ok(`${r.docUri} ${t.edgeType} ${t.total} = plain SQL`, t.total === (direct.find((d) => d.edge_type === t.edgeType)?.n ?? 0), `${direct.find((d) => d.edge_type === t.edgeType)?.n ?? 0}`)
  }
  return a.done()
})

tc('C5 the idea’s modifies row carries no corpus figure, and no corpus modifies count is added into the modifies group', async () => {
  const a = new A()
  const s = needFixture()
  a.read(s.rows.length)
  a.ok('one modifies row', s.grouped.modifies.length === 1, `${s.grouped.modifies.length}`)
  a.ok('it has no effects', s.grouped.modifies.every((r) => r.effects === null))
  a.ok('it is the author’s row, from the fixture', s.grouped.modifies[0]?.id === fixture.modifies)
  return a.done()
})

tc('C6 a row that is not held comes back in `unresolved` with its own state, and the counts agree with the rows', async () => {
  const a = new A()
  const s = needFixture()
  a.read(s.rows.length)
  if (!fixture.notHeld) return notRun('no named-not-held subject in corpus_acts, so the fixture could not carry one')
  const nh = s.unresolved.find((r) => r.id === fixture.notHeld)
  a.ok('the named-not-held row is in unresolved', !!nh)
  a.ok('with state named-not-held', nh?.resolution.state === 'named-not-held', nh?.resolution.state)
  a.ok('and still in its relation group', s.grouped.relies_on.some((r) => r.id === fixture.notHeld))
  const sum = Object.values(s.counts).reduce((x, n) => x + n, 0)
  a.ok('counts sum to the rows', sum === s.rows.length, `${sum} vs ${s.rows.length}`)
  a.ok('unresolved = rows not held', s.unresolved.length === s.rows.length - s.counts.held)
  return a.done(Object.entries(s.counts).map(([k, n]) => `${k} ${n}`).join(' · '))
})

tc('C7 an action of ANOTHER idea is reported in `inconsistent`, never merged into the groups', async () => {
  const a = new A()
  const s = needFixture()
  a.read(s.rows.length + s.inconsistent.length)
  a.ok('in inconsistent', s.inconsistent.some((r) => r.id === fixture.inconsistent))
  a.ok('in no group', !LAW_RELATIONS.some((rel) => s.grouped[rel].some((r) => r.id === fixture.inconsistent)))
  return a.done()
})

tc('C8 the hand path refuses a file with one bad id — ALL OR NOTHING — and re-running a good file writes nothing twice', async () => {
  const a = new A()
  if (!scratch) throw new Error('fixture was not built')
  const before = await prisma.ideaLawLink.count({ where: { ideaId: scratch.id } })
  const bad = parseHandFile('amends, ukpga/2010/25, , fine\nrelies_on, ukpga/2099/999, , does not exist\n').rows
  const r1 = await attachHandRows(scratch.id, bad, { write: true, by: 'check', external: true, fetch: fetchSays(400) })
  a.input(2)
  a.ok('refused', r1.wrote === 0 && !!r1.refusedReason, r1.refusedReason ?? '')
  a.ok('the bad line is no-such-id', r1.rows[1].resolution.state === 'no-such-id', r1.rows[1].resolution.state)
  const { rows } = parseHandFile(readFileSync(DRAFT, 'utf8'))
  const r2 = await attachHandRows(scratch.id, rows, { write: true, by: 'check', external: false })
  a.ok('re-run writes 0', r2.wrote === 0, `${r2.wrote}`)
  a.ok('re-run reports 20 already attached', r2.rows.filter((x) => x.outcome === 'already-attached').length === 20)
  const after = await prisma.ideaLawLink.count({ where: { ideaId: scratch.id } })
  a.read(before + after)
  a.ok('row count unchanged', before === after, `${before} → ${after}`)
  // The database's own refusals (part A, needing a real idea id).
  for (const [label, row] of [
    ['a relation outside the seven', { relation: 'affects', source: 'extraction', target_kind: 'act', doc_uri: 'ukpga/2010/25' }],
    ['a hand row with no note', { relation: 'context', source: 'hand', target_kind: 'act', doc_uri: 'ukpga/2010/25' }],
    ['a Bill kind with an Act id', { relation: 'context', source: 'extraction', target_kind: 'bill', doc_uri: 'ukpga/2010/25' }],
    ['a stored host', { relation: 'context', source: 'extraction', target_kind: 'act', doc_uri: 'https://www.legislation.gov.uk/ukpga/2010/25' }],
    ['a provision kind with no path', { relation: 'context', source: 'extraction', target_kind: 'provision', doc_uri: 'ukpga/2010/25' }],
    ['an act kind with a path', { relation: 'context', source: 'extraction', target_kind: 'act', doc_uri: 'ukpga/2010/25', provision_path: 'section/1' }],
  ] as const) {
    a.input(1)
    a.ok(`the database refuses ${label}`, await refused(scratch.id, { id: `graph7-${Math.random().toString(36).slice(2)}`, idea_id: scratch.id, as_at: '2026-10-22', ...row }))
  }
  a.input(1)
  a.ok('…and accepts a well-formed row (so the refusals are not a broken insert)', !(await refused(scratch.id, { id: `graph7-${Math.random().toString(36).slice(2)}`, idea_id: scratch.id, as_at: '2026-10-22', relation: 'context', source: 'extraction', target_kind: 'act', doc_uri: 'ukpga/2010/25' })))
  return a.done()
})

// ═══ D — THE PANEL, RENDERED ══════════════════════════════════════════════════
const render = (set: IdeaLawSet | null, error: string | null) => renderToStaticMarkup(<IdeaLawPanel set={set} error={error} />)

tc('D1 the panel renders each non-empty relation as its own section, the Bill as not law, modifies with no corpus figures', async () => {
  const a = new A()
  const s = needFixture()
  const html = render(s, null)
  a.input(1)
  for (const rel of LAW_RELATIONS) {
    const want = s.grouped[rel].length > 0
    a.ok(`group ${rel} ${want ? 'rendered' : 'absent'}`, html.includes(`data-law-group="${rel}"`) === want)
  }
  a.ok('every live row rendered once', s.rows.every((r) => html.split(`data-law-row="${r.id}"`).length === 2))
  a.ok('the inconsistent row is not rendered as a row', !html.includes(`data-law-row="${fixture.inconsistent}"`))
  a.ok('Bills labelled “before Parliament — not yet law”', billsLabelled(html, s))
  a.ok('modifies group carries no effects block', renderedModifiesClean(html))
  a.ok('the amends group shows the change-the-words split', /data-law-group="amends"[\s\S]*change the words/.test(html))
  a.ok('the named-not-held row says so in words', !fixture.notHeld || html.includes(RESOLUTION_WORDS['named-not-held']))
  a.ok('the action row names its action', /For action \d+/.test(html))
  return a.done()
})

tc('D2 an empty set and a FAILED read render different sentences', async () => {
  const a = new A()
  const empty = render({ ...needFixture(), rows: [], unresolved: [], inconsistent: [], grouped: Object.fromEntries(LAW_RELATIONS.map((r) => [r, []])) as never }, null)
  const failed = render(null, 'connection refused')
  a.input(2)
  a.ok('empty says none attached', empty.includes('data-idea-law-empty'))
  a.ok('failed says it could not read', failed.includes('data-idea-law-failed') && failed.includes('connection refused'))
  a.ok('failed does not claim none', !failed.includes('data-idea-law-empty'))
  return a.done()
})

tc('D3 the panel is REACHED (CLAUDE.md §23.1): the idea page imports it and the server page reads ideaLawSet', async () => {
  const a = new A()
  const client = readFileSync(`${ROOT}/app/ideas/[id]/IdeaDetailClient.tsx`, 'utf8')
  const page = readFileSync(`${ROOT}/app/ideas/[id]/page.tsx`, 'utf8')
  a.input(2)
  a.ok('IdeaDetailClient imports IdeaLawPanel', /import IdeaLawPanel from '@\/components\/lex\/IdeaLawPanel'/.test(client))
  a.ok('IdeaDetailClient renders it', /<IdeaLawPanel set=\{lawSet\} error=\{lawSetError\} \/>/.test(client))
  a.ok('page.tsx calls ideaLawSet', /await ideaLawSet\(id\)/.test(page))
  a.ok('page.tsx passes both props', /lawSet=\{lawSet\}/.test(page) && /lawSetError=\{lawSetError\}/.test(page))
  return a.done()
})

// ═══ E — THE COLD READ ════════════════════════════════════════════════════════
// ⚠ E1 WAS ONE CASE AND COMPARED LINES WITH ROWS. A line is a (relation, doc_uri, provision_path); stored rows naming
// the same one merge into it (BRIEF_26U §5), so on 452c5ade 27 live rows are 24 lines and "lines ≥ rows" failed on a
// correct reader (LEX, 24 Oct). Split, each against a plain-SQL read of the stored rows and each with its own control:
//   E1a  every live stored row is on exactly one line (or in `inconsistent`) — none lost, none doubled
//   E1b  lines = the distinct keys of those rows — no key unmerged, none invented
//   E1c  each line carries every row of its key with that row's own source and action id — the merge drops neither
interface StoredRow { id: string; relation: string; doc_uri: string; provision_path: string | null; source: string; action_id: string | null }
const storedKey = (r: StoredRow) => lawLineKey({ relation: r.relation as IdeaLawSet['rows'][number]['relation'], docUri: r.doc_uri, provisionPath: r.provision_path })
const consistentStored = (s: IdeaLawSet, stored: StoredRow[]) => { const bad = new Set(s.inconsistent.map((r) => r.id)); return stored.filter((r) => !bad.has(r.id)) }
/** E1a */
function rowsAccounted(s: IdeaLawSet, stored: StoredRow[]): boolean {
  const placed = [...s.rows.flatMap((r) => r.sources.map((e) => e.id)), ...s.inconsistent.map((r) => r.id)]
  const ids = new Set(stored.map((r) => r.id))
  return placed.length === ids.size && new Set(placed).size === placed.length && placed.every((id) => ids.has(id))
}
/** E1b */
function linesMatchKeys(s: IdeaLawSet, stored: StoredRow[]): boolean {
  const keys = new Set(consistentStored(s, stored).map(storedKey))
  const lineKeys = s.rows.map(lawLineKey)
  return lineKeys.length === keys.size && new Set(lineKeys).size === lineKeys.length && lineKeys.every((k) => keys.has(k))
}
/** E1c — and a hand row, where the key has one, is the primary entry. */
function mergeKeepsEveryRow(s: IdeaLawSet, stored: StoredRow[]): boolean {
  const own = consistentStored(s, stored)
  const byId = new Map(own.map((r) => [r.id, r]))
  return s.rows.every((line) => {
    const k = lawLineKey(line)
    const want = own.filter((r) => storedKey(r) === k)
    return line.sources.length === want.length
      && line.sources.every((e) => { const r = byId.get(e.id); return !!r && storedKey(r) === k && e.source === r.source && (e.action?.id ?? null) === r.action_id })
      && (!want.some((r) => r.source === 'hand') || line.sources[0].source === 'hand')
  })
}
/** The stored rows a set was built from, read back off the set itself — for the controls, which break the set. */
const storedOf = (s: IdeaLawSet): StoredRow[] => [
  ...s.rows.flatMap((l) => l.sources.map((e) => ({ id: e.id, relation: l.relation, doc_uri: l.docUri, provision_path: l.provisionPath, source: e.source, action_id: e.action?.id ?? null }))),
  ...s.inconsistent.map((r) => ({ id: r.id, relation: r.relation, doc_uri: r.docUri, provision_path: r.provisionPath, source: r.source, action_id: r.action?.id ?? null })),
]

/** The marquee and the most recently updated real idea, each with a plain-SQL read of its live rows (own, or through its actions). */
async function coldReads(): Promise<Array<{ id: string; s: IdeaLawSet; stored: StoredRow[] }>> {
  const recent = await prisma.idea.findFirst({ where: { deletedAt: null, NOT: { title: { startsWith: 'ZZ-' } }, id: { not: MARQUEE } }, orderBy: { updatedAt: 'desc' }, select: { id: true } })
  const out = []
  for (const id of [MARQUEE, recent?.id].filter(Boolean) as string[]) {
    const stored = await sql<StoredRow>(
      `SELECT l.id, l.relation, l.doc_uri, l.provision_path, l.source, l.action_id FROM idea_law_link l
        WHERE (l.idea_id = $1 OR l.action_id IN (SELECT id FROM "LexCoherentAction" WHERE "ideaId" = $1))
          AND l.superseded_by IS NULL AND l.withdrawn_at IS NULL`, id)
    out.push({ id, s: await ideaLawSet(id, { external: false }), stored })
  }
  return out
}
let coldCache: ReturnType<typeof coldReads> | null = null
const cold = () => (coldCache ??= coldReads())

tc('E1a cold read: every live stored row is on exactly one line (or reported inconsistent) — none lost, none doubled', async () => {
  const a = new A()
  const notes: string[] = []
  for (const { id, s, stored } of await cold()) {
    a.read(stored.length + 1)
    a.ok(`${id.slice(0, 8)} rows accounted (${stored.length} stored)`, rowsAccounted(s, stored))
    a.ok(`${id.slice(0, 8)} partition holds`, partitionHolds(s))
    notes.push(`${id.slice(0, 8)}: ${stored.length} live rows`)
  }
  return a.done(notes.join('; '))
})
tc('E1b cold read: lines = the distinct (relation, doc_uri, provision_path) of the live rows, and the merged count is the difference', async () => {
  const a = new A()
  const notes: string[] = []
  for (const { id, s, stored } of await cold()) {
    a.read(stored.length)
    const own = consistentStored(s, stored)
    a.ok(`${id.slice(0, 8)} lines match keys`, linesMatchKeys(s, stored), `${s.rows.length} lines`)
    a.ok(`${id.slice(0, 8)} mergedIntoALine = rows − lines`, s.examined.mergedIntoALine === own.length - s.rows.length, `${s.examined.mergedIntoALine} vs ${own.length}−${s.rows.length}`)
    notes.push(`${id.slice(0, 8)}: ${own.length} rows on ${s.rows.length} lines, ${s.counts.held} held`)
  }
  return a.done(notes.join('; '))
})
tc('E1c cold read: a merged line keeps every row of its key — each one\'s source and action id — hand row first', async () => {
  const a = new A()
  const notes: string[] = []
  for (const { id, s, stored } of await cold()) {
    a.read(stored.length)
    a.ok(`${id.slice(0, 8)} merge keeps every row`, mergeKeepsEveryRow(s, stored))
    const merged = s.rows.filter((l) => l.sources.length > 1)
    const twoActions = merged.filter((l) => new Set(l.sources.map((e) => e.action?.id ?? null)).size > 1)
    notes.push(`${id.slice(0, 8)}: ${merged.length} merged lines, ${twoActions.length} carrying more than one action id`)
  }
  return a.done(notes.join('; '))
})

// ═══ CONTROLS — each predicate, fed a broken input, must say false ═════════════
control('partition: a row moved into the wrong group', () => {
  const s = needFixture()
  const moved = { ...s, grouped: { ...s.grouped, context: [...s.grouped.context, s.grouped.amends[0]] } }
  return partitionHolds(moved)
})
control('partition: a row dropped from its group', () => {
  const s = needFixture()
  return partitionHolds({ ...s, grouped: { ...s.grouped, precedent: s.grouped.precedent.slice(1) } })
})
/** The fixture's merged line (C9: hand + instruction on amends ukpga/2010/25), and the set with it replaced. */
function withMerged(f: (line: IdeaLawSet['rows'][number]) => IdeaLawSet['rows'][number][]): IdeaLawSet {
  const s = needFixture()
  const line = s.rows.find((r) => r.sources.length > 1)
  if (!line) throw new Error('the fixture has no merged line')
  return { ...s, rows: s.rows.flatMap((r) => (r === line ? f(r) : [r])) }
}
control('E1a: a merged line loses its instruction entry', () => {
  const stored = storedOf(needFixture())
  return rowsAccounted(withMerged((l) => [{ ...l, sources: l.sources.slice(0, 1) }]), stored)
})
control('E1a: an entry placed on two lines', () => {
  const s = needFixture()
  const stored = storedOf(s)
  const merged = s.rows.find((r) => r.sources.length > 1)!
  const other = s.rows.find((r) => r !== merged)!
  return rowsAccounted({ ...s, rows: s.rows.map((r) => (r === other ? { ...r, sources: [...r.sources, merged.sources[1]] } : r)) }, stored)
})
control('E1b: a merged line left as two lines', () => {
  const stored = storedOf(needFixture())
  return linesMatchKeys(withMerged((l) => l.sources.map((e) => ({ ...l, id: e.id, sources: [e] }))), stored)
})
control('E1c: the merge keeps both entries but nulls the instruction\'s action id', () => {
  const stored = storedOf(needFixture())
  return mergeKeepsEveryRow(withMerged((l) => [{ ...l, sources: l.sources.map((e) => ({ ...e, action: null })) }]), stored)
})
control('E1c: the instruction row made primary over the hand row', () => {
  const stored = storedOf(needFixture())
  return mergeKeepsEveryRow(withMerged((l) => [{ ...l, sources: [...l.sources].reverse() }]), stored)
})
control('split: a per-type total that is not the sum of its kinds', () =>
  splitHolds({ perType: [{ edgeType: 'amends', total: 705, textual: 705, notTextual: 6, unclassified: 8 }], caveat: '', rowsCounted: 705, failed: null }))
control('effects: a Bill row given effects', () => {
  const s = needFixture()
  const fx = s.grouped.amends.find((r) => r.effects)!.effects
  return effectsOnlyWhereAllowed({ ...s, rows: s.rows.map((r) => (r.targetKind === 'bill' ? { ...r, effects: fx } : r)) })
})
control('render: corpus figures inside the modifies group', () => {
  const s = needFixture()
  const fx = s.grouped.amends.find((r) => r.effects)!.effects
  const broken = { ...s, grouped: { ...s.grouped, modifies: s.grouped.modifies.map((r) => ({ ...r, effects: fx })) } }
  return renderedModifiesClean(render(broken, null))
})
control('render: a Bill rendered as an Act', () => {
  const s = needFixture()
  const asAct = s.rows.map((r) => (r.targetKind === 'bill' ? { ...r, targetKind: 'act' as const } : r))
  const broken = { ...s, rows: asAct, grouped: Object.fromEntries(LAW_RELATIONS.map((rel) => [rel, asAct.filter((r) => r.relation === rel)])) as never }
  return billsLabelled(render(broken, null), s)
})

// ═══ RUN ══════════════════════════════════════════════════════════════════════
async function main() {
  console.log('── check:idea-law ──\n')
  let built: string | null = null
  try {
    await buildFixture()
  } catch (e) { built = e instanceof Error ? e.message : String(e) }

  let pass = 0, fail = 0, nr = 0, examined = 0, inputs = 0, asserted = 0
  try {
    for (const c of CASES) {
      let o: Outcome
      try {
        o = built && /^[CD]/.test(c.name) && !c.name.startsWith('D3') ? { examined: 0, inputs: 0, asserted: 0, fail: `fixture not built: ${built}` } : await c.run()
      } catch (e) { o = { examined: 0, inputs: 0, asserted: 0, fail: `threw: ${e instanceof Error ? e.message : String(e)}` } }
      examined += o.examined; inputs += o.inputs; asserted += o.asserted
      const tag = o.notRun ? 'NOT RUN' : o.fail ? 'FAIL' : 'pass'
      if (o.notRun) nr++; else if (o.fail) fail++; else pass++
      console.log(`${tag.padEnd(7)} ${c.name}\n        examined ${o.examined} rows, ${o.inputs} inputs, ${o.asserted} assertions${o.note ? ` — ${o.note}` : ''}${o.fail ? `\n        ✗ ${o.fail}` : ''}${o.notRun ? `\n        (${o.notRun})` : ''}`)
    }
    let fired = 0, dead = 0
    console.log('')
    for (const k of CONTROLS) {
      let holds: boolean
      try { holds = await k.propertyHolds() } catch (e) { holds = true; console.log(`        control threw: ${String(e).slice(0, 120)}`) }
      if (holds) dead++; else fired++
      console.log(`${holds ? 'DEAD ' : 'fired'}   control: ${k.name}`)
    }
    console.log(`\n${pass} passed · ${fail} failed · ${nr} NOT RUN — ${CASES.length} cases, ${examined.toLocaleString()} rows examined, ${inputs} inputs, ${asserted} assertions · controls ${fired} fired, ${dead} dead`)
    if (fail || dead || built) process.exitCode = 1
  } finally {
    await teardown().catch((e) => { console.error('⚠ TEARDOWN FAILED:', e); process.exitCode = 1 })
  }
}

main().catch((e) => { console.error('FAILED:', e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
