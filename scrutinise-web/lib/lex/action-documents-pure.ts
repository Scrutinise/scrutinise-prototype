// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-V1 — DOCUMENTS ON ACTIONS: the vocabulary, D-numbers, parts, "needs a document", and the cascade rows. PURE; CLIENT-SAFE (imports
// only types), so the tree, the record, the pack and Lex's honesty check read one definition (CLAUDE.md §28, §26.5).
//
//   action → document → part, numbered 38.2.1 (decision 240): three levels only; a part never has parts.
//   D-number: D.38.2 = action 38, document 2 (241). Outputs, never evidence: never in the [Ref: n] series, never cited as authority, and
//     wherever one appears in prose it carries its status ("D.38.1, drafted, not accepted") so a draft is never read as settled.
//   Consequential effects are ROWS with a depth, never nested documents (245); display stops at depth three (246).
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
}
export interface Needs { kinds: DocumentKind[]; why: string; overridden: boolean }

export function needsDocuments(a: NeedsInput): Needs {
  if (a.override?.mode === 'nothing') return { kinds: [], why: `needs nothing: ${a.override.reason}`, overridden: true }
  if (a.override?.mode === 'set') return { kinds: [...new Set(a.override.kinds ?? [])], why: a.override.reason, overridden: true }
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

// ── the cascade: rows with a depth (245, 246, 252) ───────────────────────────────────────────────────────────────
export interface EffectRow {
  /** Index of this row in the report's rows. */
  i: number
  /** 1 = the clause's own effect; 2 = what that knocks on to; 3 = the next step. GRAPH supplies depths 2–3 (252: not yet). */
  depth: 1 | 2 | 3 | number
  /** The row this one hangs from (null at depth 1). */
  parent: number | null
  relation: string
  docUri: string
  provisionPath: string | null
  actTitle: string | null
  state: TargetState
  note: string
  /** GRAPH 6's per-type figures for the target, as the reader returns them: the "changes the words / does not / unclassified" split. */
  effects: EffectCount[]
}
export const DISPLAY_DEPTH = 3

/** The rows a report PRINTS: depth 1 in full, each depth-2 row beneath its parent, each depth-3 row beneath that; and the count beyond. */
export function displayRows(rows: EffectRow[], maxDepth = DISPLAY_DEPTH): { shown: EffectRow[]; further: number; furtherLine: string | null } {
  const kids = new Map<number | null, EffectRow[]>()
  for (const r of rows) kids.set(r.parent, [...(kids.get(r.parent) ?? []), r])
  const shown: EffectRow[] = []
  const walk = (parent: number | null) => { for (const r of kids.get(parent) ?? []) { if (r.depth <= maxDepth) { shown.push(r); walk(r.i) } } }
  walk(null)
  const further = rows.length - shown.length
  return { shown, further, furtherLine: further > 0 ? `and ${further} further effect${further === 1 ? '' : 's'} — see the schedule` : null }
}

/** Counted per Act, for the schedule and the report headings. */
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
const rowLine = (r: EffectRow) => `${'  '.repeat(Math.max(0, r.depth - 1))}- ${r.relation} ${r.docUri}${r.provisionPath ? ` · ${r.provisionPath}` : ''} — ${STATE_SAY[r.state]}${r.note ? `; ${r.note}` : ''}${r.effects.length ? `; changes already made to it: ${effectsSay(r.effects)}` : ''}`

/** A collision report's text: one "## " section (a part) per Act, the rows beneath, stopping at depth three with the count beyond. */
export function collisionBody(rows: EffectRow[], opts: { loadDate: string | null; depthNote: string }): string {
  const { shown, furtherLine } = displayRows(rows)
  const lines = [
    `Generated from the clause's drafting instruction and the official record of changes${opts.loadDate ? ` (effects data loaded ${opts.loadDate})` : ''}. ${opts.depthNote}`,
  ]
  if (!rows.length) return [...lines, '', 'The drafting instruction names no provision it amends, repeals or modifies.'].join('\n')
  for (const g of perAct(shown)) lines.push('', `## ${g.actTitle ?? g.docUri} (${g.docUri})`, ...g.rows.map(rowLine))
  if (furtherLine) lines.push('', furtherLine)
  return lines.join('\n')
}

/** The schedule's text: every row of every collision report on the idea, FLATTENED (no depth limit), counted per Act. */
export function scheduleBody(rows: Array<EffectRow & { from: string }>, opts: { loadDate: string | null }): string {
  const lines = [`Generated from every collision report on this idea${opts.loadDate ? ` (effects data loaded ${opts.loadDate})` : ''}; refreshed when the effects data is. Nothing here is typed.`]
  if (!rows.length) return [...lines, '', 'No collision report on this idea names a provision yet.'].join('\n')
  const acts = perAct(rows)
  lines.push('', `${rows.length} effect${rows.length === 1 ? '' : 's'} across ${acts.length} Act${acts.length === 1 ? '' : 's'}.`)
  for (const g of acts) lines.push('', `## ${g.actTitle ?? g.docUri} (${g.docUri}) — ${g.rows.length}`, ...(g.rows as Array<EffectRow & { from: string }>).map((r) => `- ${r.relation} ${r.docUri}${r.provisionPath ? ` · ${r.provisionPath}` : ''} — depth ${r.depth}, from ${r.from}`))
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
