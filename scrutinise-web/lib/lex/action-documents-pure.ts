// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-V1 — DOCUMENTS ON ACTIONS: the vocabulary, D-numbers, parts, "needs a document", and the cascade rows. PURE; CLIENT-SAFE (imports
// only types), so the tree, the record, the pack and Lex's honesty check read one definition (CLAUDE.md §28, §26.5).
//
//   action → document → part, numbered 38.2.1 (decision 240): three levels only; a part never has parts.
//   D-number: D.38.2 = action 38, document 2 (241). Outputs, never evidence: never in the [Ref: n] series, never cited as authority, and
//     wherever one appears in prose it carries its status ("D.38.1, drafted, not accepted") so a draft is never read as settled.
//   Consequential effects are ROWS with a depth, never nested documents (245); the report is two parts by strength (267; 246 withdrawn).
// ⚠ Plain words on screen (§0): "document", "part", "kind", "drafted / accepted / no document yet". Never "artifact", "node", "entity".
// ─────────────────────────────────────────────────────────────────────────────

import type { DraftInstruction } from './action-draft-pure'
import type { EffectCount, TargetState } from './action-touches-pure'

// 26-V1b §5 (259): EXPLANATORY_NOTE appended — DDL prisma/lex_26v1b_explanatory_note.sql widens the CHECK in the same push as this code.
export const DOCUMENT_KINDS = ['DRAFT_CLAUSE', 'COLLISION_REPORT', 'CONSEQUENTIAL_SCHEDULE', 'CODE_TEXT', 'SPECIFICATION', 'COSTING', 'OPERATING_TEXT', 'BACKGROUND_NOTE', 'EXPLANATORY_NOTE'] as const
export type DocumentKind = (typeof DOCUMENT_KINDS)[number]
export const KIND_WORD: Record<DocumentKind, string> = {
  DRAFT_CLAUSE: 'draft clause', COLLISION_REPORT: 'collision report', CONSEQUENTIAL_SCHEDULE: 'consequential schedule', CODE_TEXT: 'code text',
  SPECIFICATION: 'specification', COSTING: 'costing', OPERATING_TEXT: 'operating text', BACKGROUND_NOTE: 'background note', EXPLANATORY_NOTE: 'explanatory note',
}
/** 26-V1b §5a — the explanatory note's caveat, word for word: its first line, always. */
export const NOTE_CAVEAT = 'Drafted by Lex from the clause; not settled; not the Explanatory Notes Parliament will receive.'
/** Built from data with no model call: they cost nothing and are regenerated, never drafted (§4, §5). */
export const GENERATED_KINDS: ReadonlySet<DocumentKind> = new Set(['COLLISION_REPORT', 'CONSEQUENTIAL_SCHEDULE'])

export type DocumentStatus = 'DRAFTED' | 'ACCEPTED' | 'SUPERSEDED'
export const STATUS_WORD: Record<DocumentStatus | 'NONE', string> = { NONE: 'no document yet', DRAFTED: 'drafted, not accepted', ACCEPTED: 'accepted', SUPERSEDED: 'superseded' }

// ── numbers ──────────────────────────────────────────────────────────────────────────────────────────────────
export const documentNumber = (action: number | null, doc: number) => `${action ?? '?'}.${doc}`
export const partNumber = (action: number | null, doc: number, part: number) => `${action ?? '?'}.${doc}.${part}`
export const dNumber = (action: number | null, doc: number) => `D.${action ?? '?'}.${doc}`
/** A D-number as prose prints it: always with its status (241). */
export function dNumberWords(d: { action: number | null; number: number; status: DocumentStatus; stale?: boolean }): string {
  return `${dNumber(d.action, d.number)}, ${STATUS_WORD[d.status]}${d.stale ? ', out of date' : ''}`
}
/** Any D-number in a piece of text (D.38.2, D.38.2.1). The honesty check and the renderers use this one pattern. */
export const D_NUMBER_RE = /\bD\.(\d+)\.(\d+)(?:\.(\d+))?\b/g

// ── parts: the numbered sections of a document's current version ─────────────────────────────────────────────
export interface DocumentPart { n: number; title: string; text: string }

/**
 * The parts of a version's body, by kind. A clause's parts are its numbered subsections — "(1)", "(2)"; a generated report's are its "## "
 * sections (one per Act); any other kind's are its "## " headings, else its top-level numbered paragraphs ("1."). A body with no sections
 * is ONE part: a document always has at least the part that is all of it, so 38.2.1 always exists.
 */
export function partsOf(kind: DocumentKind, body: string): DocumentPart[] {
  const text = body.replace(/\r\n/g, '\n').trim()
  if (!text) return []
  const split = (re: RegExp, titleOf: (m: RegExpExecArray) => string): DocumentPart[] => {
    const hits: Array<{ at: number; title: string }> = []
    for (const m of text.matchAll(re)) hits.push({ at: m.index!, title: titleOf(m as RegExpExecArray) })
    if (!hits.length) return []
    return hits.map((h, i) => ({ n: i + 1, title: h.title, text: text.slice(h.at, hits[i + 1]?.at ?? text.length).trim() }))
  }
  const parts = kind === 'DRAFT_CLAUSE'
    ? split(/^\((\d+)\)\s/gm, (m) => `subsection (${m[1]})`)
    : split(/^##\s+(.+)$/gm, (m) => m[1].trim())
  const fallback = parts.length ? parts : kind === 'DRAFT_CLAUSE' ? [] : split(/^(\d+)\.\s+(.*)$/gm, (m) => `paragraph ${m[1]}`)
  return fallback.length ? fallback : [{ n: 1, title: 'the whole document', text }]
}

// ── "needs a document": derived from avenue and instrument (240, 2d), overridable with a reason ────────────────
export interface NeedsOverride { mode: 'nothing' | 'set'; kinds?: DocumentKind[]; reason: string; by: string; at: string }
export interface NeedsInput {
  avenue: string | null; instrument: DraftInstruction['instrument'] | null; override?: NeedsOverride | null
  /** 26-V1b §5a — the action's clause has been accepted (at some version): it then needs its explanatory note. */
  clauseAccepted?: boolean
  /** 26-V2c (268) — the KIND of the heading the action sits under: a specification is derived from it (no avenue says "software"). */
  headingKind?: string | null
  /** The heading's name, for the why line only — the rule never reads it. */
  headingName?: string | null
}
export interface Needs { kinds: DocumentKind[]; why: string; overridden: boolean }

// ── a heading's KIND (26-V2c, 268): the type of instrument its actions make ──────────────────────────────────────
//
// 24 Oct (4, revised): "no name match. Give each heading a kind (the instrument type …), set by the owner on the heading row and proposed by
// Lex for existing headings; the specification rule and any future rule bind to the kind." Charlie's eight, in his order. Null = not yet
// said. The DDL's CHECK lists the same values (prisma/lex_26v2c_heading_kind_issue_attach.sql); check:lex-26v2c asserts the two agree.
// ⚠ The heading's NAME is never read by a rule. A kind is set by the owner, or proposed by Lex (`proposedKind`) and accepted by the owner.
export const HEADING_KINDS = ['PRIMARY_LEGISLATION', 'CODE', 'MANAGEMENT_CODE', 'PLATFORM', 'BUDGET', 'TRANSPARENCY', 'GUIDANCE_PILOT', 'OTHER'] as const
export type HeadingKind = (typeof HEADING_KINDS)[number]
export const HEADING_KIND_WORD: Record<HeadingKind, string> = {
  PRIMARY_LEGISLATION: 'primary legislation', CODE: 'code', MANAGEMENT_CODE: 'management code', PLATFORM: 'platform', BUDGET: 'budget',
  TRANSPARENCY: 'transparency', GUIDANCE_PILOT: 'guidance or pilot', OTHER: 'other',
}
export const isHeadingKind = (k: unknown): k is HeadingKind => typeof k === 'string' && (HEADING_KINDS as readonly string[]).includes(k)

/** 26-V2 §4, bound to the kind by 268: every action under a heading of kind PLATFORM needs a specification. Anywhere else one is added by hand. */
export const needsSpecification = (kind: string | null | undefined) => kind === 'PLATFORM'

export function needsDocuments(a: NeedsInput): Needs {
  if (a.override?.mode === 'nothing') return { kinds: [], why: `needs nothing: ${a.override.reason}`, overridden: true }
  if (a.override?.mode === 'set') return { kinds: [...new Set(a.override.kinds ?? [])], why: a.override.reason, overridden: true }
  const base = derivedNeeds(a)
  if (!needsSpecification(a.headingKind)) return base
  const under = a.headingName?.trim() ? `under “${a.headingName.trim()}”, a ${HEADING_KIND_WORD.PLATFORM} heading` : `under a ${HEADING_KIND_WORD.PLATFORM} heading`
  return base.kinds.length
    ? { kinds: [...base.kinds, 'SPECIFICATION'], why: `${base.why}, ${under}`, overridden: false }
    : { kinds: ['SPECIFICATION'], why: under, overridden: false }
}

function derivedNeeds(a: NeedsInput): Needs {
  if (a.instrument === 'STATUTORY_CODE' || a.instrument === 'MANAGEMENT_CODE') return { kinds: ['CODE_TEXT'], why: 'the instrument is a code', overridden: false }
  // 259: an accepted clause needs its explanatory note — one plain-English paragraph per subsection
  if (a.avenue === 'LEGISLATIVE') return a.clauseAccepted
    ? { kinds: ['DRAFT_CLAUSE', 'COLLISION_REPORT', 'EXPLANATORY_NOTE'], why: 'a legislative action with an accepted clause', overridden: false }
    : { kinds: ['DRAFT_CLAUSE', 'COLLISION_REPORT'], why: 'a legislative action', overridden: false }
  if (a.avenue === 'FINANCIAL') return { kinds: ['COSTING'], why: 'a financial action', overridden: false }
  if (a.avenue === 'ORGANISATIONAL') return { kinds: ['OPERATING_TEXT'], why: 'an organisational action', overridden: false }
  // ⚠ No avenue yet: nothing is derived, and the line says so rather than reading "needs nothing".
  return { kinds: [], why: 'no avenue chosen yet, so nothing is derived', overridden: false }
}

/** The checklist line per action: "needs 2 documents: 0 drafted". */
export function needsLine(needed: number, drafted: number, accepted: number): string {
  if (!needed) return 'needs no document'
  return `needs ${needed} document${needed === 1 ? '' : 's'}: ${drafted} drafted${accepted ? `, ${accepted} accepted` : ''}`
}

// ── the collision report: the clause's own rows, then TWO PARTS per provision, never merged (245, 267) ──────────────
//
// 267 (24 Oct, on GRAPH 8): under each provision the clause changes, "What depends on this" (instruments made under it, and the official
// record of what operates on it) and "Provisions that refer to this — for review" (references: depth 1 with the words, depth 2 labelled
// weak, never depth 3). The walk stops by STRENGTH, not by a depth number; 246's "display stops at three, see the schedule" is withdrawn,
// and the schedule is never filled from this report (it lists drafted amendments only, below).
export type ReportPart = 'clause' | 'depends' | 'refers'
export interface EffectRow {
  /** Index of this row in the report's rows. */
  i: number
  /** 1 = the clause's own line; an onward row is 1 + its step from the provision (a step-1 reference is depth 2). */
  depth: 1 | 2 | 3 | number
  /** The row this one hangs from (null for the clause's own lines). */
  parent: number | null
  /** The clause's relation (amends, repeals…), or the onward row's kind (made-under, amends, cites…). */
  relation: string
  docUri: string
  provisionPath: string | null
  actTitle: string | null
  state: TargetState
  note: string
  /** GRAPH 6's per-type figures for the target, as the reader returns them: the "changes the words / does not / unclassified" split. */
  effects: EffectCount[]
  /** 267 — absent on a V1 row, which is a clause row. */
  part?: ReportPart
  /** Steps from the provision the clause changes (onward rows only): 1, 2, … */
  step?: number
  /** `provision` = names the provision asked about; `act-wide` = recorded against the whole Act. */
  scope?: 'provision' | 'act-wide'
  /** The stored citing words, already marked as cut (onward-pure `citingTextForDisplay`); null when none are stored. */
  words?: string | null
  /** A step-2 reference: weak, and said to be. */
  weak?: boolean
}

/** One line per provision walked, per part: what was counted, what was not walked, and why — in words (GRAPH 8 rule 3). */
export interface WalkNote { from: number; part: 'depends' | 'refers'; line: string }

export const PART_HEADING: Record<'depends' | 'refers', string> = {
  depends: 'What depends on this',
  refers: 'Provisions that refer to this — for review',
}
/** Said once at the top of every report: the two parts are different things. */
export const TWO_PARTS_LINE = 'Under each provision the clause changes, two parts, never merged: what depends on it — instruments made under it, and the official record of what operates on it — and provisions that refer to it, for a drafter to read. A reference is not a change; most will not need one.'
export const rowOf = (r: EffectRow): ReportPart => r.part ?? 'clause'

/** Counted per Act, for the report's headings. */
export function perAct(rows: EffectRow[]): Array<{ docUri: string; actTitle: string | null; rows: EffectRow[] }> {
  const out = new Map<string, { docUri: string; actTitle: string | null; rows: EffectRow[] }>()
  for (const r of rows) { const g = out.get(r.docUri) ?? { docUri: r.docUri, actTitle: r.actTitle, rows: [] }; g.rows.push(r); if (!g.actTitle) g.actTitle = r.actTitle; out.set(r.docUri, g) }
  return [...out.values()]
}

const STATE_SAY: Record<TargetState, string> = {
  held: 'held', 'before-parliament': 'before Parliament — not yet law', document: 'a document, not law', 'named-not-held': 'named, not held',
  'no-such-act': 'no such Act', 'lookup-failed': 'lookup failed',
}
const effectsSay = (e: EffectCount[]) => e.map((c) => `${c.type} ${c.total} (${c.changeTheWords} change the words, ${c.doNotChangeTheWords} do not, ${c.unclassified} unclassified)`).join('; ')
const where = (r: EffectRow) => `${r.docUri}${r.provisionPath ? ` · ${r.provisionPath}` : ''}`
const clauseLine = (r: EffectRow) => `- ${r.relation} ${where(r)} — ${STATE_SAY[r.state]}${r.note ? `; ${r.note}` : ''}${r.effects.length ? `; changes already made to it: ${effectsSay(r.effects)}` : ''}`
const onwardLine = (r: EffectRow) => `${'  '.repeat(Math.max(0, (r.step ?? 1) - 1))}- ${r.weak ? 'weak (step 2): ' : (r.step ?? 1) > 1 ? `step ${r.step}: ` : ''}${r.relation} — ${r.actTitle ? `${r.actTitle} ` : ''}(${where(r)})${r.scope === 'act-wide' ? ' — recorded against the whole Act' : ''}${r.note ? `; ${r.note}` : ''}${r.words ? ` ${r.words}` : ''}`

/** The rows of one part under one clause row, each beneath the row it hangs from (depth-first, in stored order). */
function partRows(rows: EffectRow[], from: number, part: 'depends' | 'refers'): EffectRow[] {
  const kids = new Map<number, EffectRow[]>()
  for (const r of rows) if (r.part === part && r.parent != null) kids.set(r.parent, [...(kids.get(r.parent) ?? []), r])
  const out: EffectRow[] = []
  const walk = (p: number) => { for (const r of kids.get(p) ?? []) { out.push(r); walk(r.i) } }
  walk(from)
  return out
}

/**
 * A collision report's text: one "## " section (a part, 38.2.1) per Act the clause names; under each of the clause's lines that changes
 * a provision, "### What depends on this" and "### Provisions that refer to this — for review", each with its rows and its walk notes.
 */
export function collisionBody(rows: EffectRow[], opts: { loadDate: string | null; caveat: string | null; notes: WalkNote[] }): string {
  const lines = [
    `Generated from the clause's drafting instruction, the official record of changes and the citations we hold${opts.loadDate ? ` (loaded ${opts.loadDate})` : ''}.${opts.caveat ? ` ${opts.caveat}` : ''}`,
    '', TWO_PARTS_LINE,
  ]
  const clause = rows.filter((r) => rowOf(r) === 'clause')
  if (!clause.length) return [...lines, '', 'The drafting instruction names no provision it amends, repeals or modifies.'].join('\n')
  for (const g of perAct(clause)) {
    lines.push('', `## ${g.actTitle ?? g.docUri} (${g.docUri})`)
    for (const c of g.rows) {
      lines.push(clauseLine(c))
      for (const part of ['depends', 'refers'] as const) {
        const own = partRows(rows, c.i, part), notes = opts.notes.filter((n) => n.from === c.i && n.part === part)
        if (!own.length && !notes.length) continue
        lines.push('', `### ${PART_HEADING[part]} — ${where(c)}`, ...own.map(onwardLine), ...notes.map((n) => `- ${n.line}`))
      }
    }
  }
  return lines.join('\n')
}

// ── the consequential schedule: DRAFTED amendments in ACCEPTED instructions only (233, 267) ──────────────────────
// ⚠ Never from the collision report, never from the onward reader: that reader produces candidates, and this annexe records what has been
// drafted and accepted (GRAPH 8 rule 4). A line here is an amends / repeals / modifies line of an accepted drafting-instruction version.
export const SCHEDULE_RELATIONS = ['amends', 'repeals', 'modifies'] as const
export interface ScheduleRow { action: number | null; d: string; v: number; relation: string; docUri: string; provisionPath: string | null; note: string }

/** The schedule's rows from accepted instruction versions, in action-number order. Pure. */
export function scheduleRows(accepted: Array<{ action: number | null; d: string; v: number; ins: Pick<DraftInstruction, 'provisions'> }>): ScheduleRow[] {
  return [...accepted]
    .sort((x, y) => (x.action ?? 1e9) - (y.action ?? 1e9))
    .flatMap((a) => a.ins.provisions
      .filter((p) => (SCHEDULE_RELATIONS as readonly string[]).includes(p.relation))
      .map((p) => ({ action: a.action, d: a.d, v: a.v, relation: p.relation, docUri: p.docUri, provisionPath: p.provisionPath, note: p.note })))
}

/** The schedule's text: counted, then listed per Act. Nothing here comes from the record of effects or from a reference. */
export function scheduleBody(rows: ScheduleRow[]): string {
  const lines = ['Generated from the drafted amendments in accepted drafting instructions only — never from a collision report or the record of references. A draft that is not yet accepted is not here.']
  if (!rows.length) return [...lines, '', 'No accepted drafting instruction amends, repeals or modifies an existing provision yet.'].join('\n')
  const acts = new Map<string, ScheduleRow[]>()
  for (const r of rows) acts.set(r.docUri, [...(acts.get(r.docUri) ?? []), r])
  const n = (rel: string) => rows.filter((r) => r.relation === rel).length
  lines.push('', `${n('amends')} amended, ${n('repeals')} repealed, ${n('modifies')} modified, across ${acts.size} Act${acts.size === 1 ? '' : 's'}.`)
  for (const [uri, rs] of acts) lines.push('', `## ${uri} — ${rs.length}`, ...rs.map((r) => `- ${r.relation} ${uri}${r.provisionPath ? ` · ${r.provisionPath}` : ''} — from #${r.action ?? '?'}’s drafting instruction, version ${r.v} (accepted; ${r.d})${r.note ? `; ${r.note}` : ''}`))
  return lines.join('\n')
}

// ── the tree's counts (§3c) ───────────────────────────────────────────────────────────────────────────────────
export interface TreeAction { needs: Needs; documents: Array<{ kind: DocumentKind; status: DocumentStatus }> }
export function treeCounts(actions: TreeAction[]) {
  let needDocs = 0, drafted = 0, accepted = 0, missing = 0
  for (const a of actions) {
    if (a.needs.kinds.length) needDocs++
    const live = a.documents.filter((d) => d.status !== 'SUPERSEDED')
    drafted += live.filter((d) => d.status === 'DRAFTED').length
    accepted += live.filter((d) => d.status === 'ACCEPTED').length
    missing += a.needs.kinds.filter((k) => !live.some((d) => d.kind === k)).length
  }
  return { actions: actions.length, needDocs, drafted, accepted, missing, line: `${actions.length} actions · ${needDocs} need documents · ${drafted} drafted · ${accepted} accepted · ${missing} missing` }
}
