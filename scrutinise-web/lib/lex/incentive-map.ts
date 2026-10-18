// ─────────────────────────────────────────────────────────────────────────────
// 26-T1 §3 (decisions 152, 203) — THE INCENTIVE MAP. PURE; CLIENT-SAFE.
//
// A VIEW over what step 2 already records on each action: Who, Incentive now (with / against / indifferent, and why), What changes it (with a
// link to the action that does), How, Against. ⚠ DECISION 203: THE MAP STORES NOTHING OF ITS OWN. The direction on an action's Incentive-now slot
// is the data; this file only reads it. Nothing here is written back except through the existing slot writers (a renamed spelling is a new
// Who on the actions concerned, written by `setSlot`).
//
// ROWS = implementers, as written in Who (a body or a role). COLUMNS = actions. CELL = the direction as a WORD AND A SHAPE: ▲ with · ▼ against
// · ○ indifferent · — not answered. Never colour alone (CLAUDE.md §21).
//
// ⚠ "AGAINST — nothing changes this" is said in words: an against cell whose What-changes-it slot names no action (or names one that has since
//   left the live list) is the gap Charlie is looking for - the Permanent Secretaries question.
// ⚠ An action with no Who is not absent: it sits in a row of its own, "No implementer named yet".
// ⚠ One answer per action: an action naming two implementers shows the same direction under both, because the record holds one answer.
// ─────────────────────────────────────────────────────────────────────────────

import { parseRecord, type Direction } from './action-record'

export type CellDirection = Direction | 'UNANSWERED'

/** ⚠ ONE place for the shapes, so the map, its legend and its words cannot disagree. A word always sits beside the shape. */
export const INCENTIVE_GLYPH: Record<CellDirection, string> = { WITH: '▲', AGAINST: '▼', INDIFFERENT: '○', UNANSWERED: '—' }
export const INCENTIVE_WORD: Record<CellDirection, string> = { WITH: 'with', AGAINST: 'against', INDIFFERENT: 'indifferent', UNANSWERED: 'not answered' }

export const NO_IMPLEMENTER_KEY = '__none'
export const NO_IMPLEMENTER_NAME = 'No implementer named yet'

/** The slice of a canonical action the map reads. */
export interface MapSource {
  id: string
  number: number | null
  title: string | null
  practicalStep: string
  whoImplements: string | null
  record: unknown
}

export type Changer =
  | { kind: 'ACTION'; number: number; label: string }
  | { kind: 'WORDS'; text: string }
  | { kind: 'LINK_GONE' }
  | { kind: 'NONE' }

export interface MapCell {
  action: number
  id: string
  label: string
  direction: CellDirection
  /** The implementer's incentive in the owner's words, if written. */
  why: string
  /** For an AGAINST cell: what is relied on to turn it. null for the other directions. */
  changer: Changer | null
}

export interface MapRow {
  key: string
  name: string
  inside: boolean | null
  /** Every spelling met under this key, with how many actions used it. */
  spellings: Array<{ spelling: string; count: number }>
  cells: MapCell[]
  counts: { with: number; against: number; indifferent: number; unanswered: number }
  summary: string
  /** Numbers of this row's actions that are AGAINST with nothing changing it. */
  nothingChanges: number[]
}

const labelOf = (a: Pick<MapSource, 'title' | 'practicalStep'>, max = 70): string => {
  const t = a.title?.trim()
  if (t) return t
  const s = a.practicalStep.replace(/\s+/g, ' ').trim()
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

// ── reading Who ─────────────────────────────────────────────────────────────────────────────────────────────────

const INSIDE_RE = /\(?\b(inside|outside)\s+(?:of\s+)?(?:the\s+)?government\b\)?/i

/** The bodies or roles a Who answer names: split on ";" and new lines only (a body's own name may contain "and" or a comma). Pure. */
export function implementersIn(who: string | null | undefined): Array<{ name: string; inside: boolean | null }> {
  if (!who?.trim()) return []
  return who.split(/;|\n/).flatMap((seg) => {
    const m = seg.match(INSIDE_RE)
    const inside = m ? m[1].toLowerCase() === 'inside' : null
    const name = seg.replace(INSIDE_RE, '').replace(/\(\s*\)/g, '').replace(/^[\s,.\-–—]+|[\s,.\-–—]+$/g, '').replace(/\s+/g, ' ').trim()
    return name ? [{ name, inside }] : []
  })
}

/** The identity of a spelling: lower case, "the" and punctuation gone. */
export function keyOf(name: string): string {
  return name.toLowerCase().replace(/&/g, ' and ').replace(/\bthe\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
}

// ── building the map ────────────────────────────────────────────────────────────────────────────────────────────

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

/** What is relied on to turn an AGAINST cell, read from the What-changes-it slot. */
export function changerOf(a: MapSource, byId: Map<string, MapSource>): Changer {
  const slot = parseRecord(a.record).whatChangesIt
  if (slot?.linkActionId) {
    const t = byId.get(slot.linkActionId)
    return t && t.number != null ? { kind: 'ACTION', number: t.number, label: labelOf(t, 60) } : { kind: 'LINK_GONE' }
  }
  if (slot?.text?.trim()) return { kind: 'WORDS', text: slot.text.trim() }
  return { kind: 'NONE' }
}

/** The direction an action's Incentive-now slot records. Text with no direction chosen is NOT an answer to "which way". */
export function directionOf(a: MapSource): { direction: CellDirection; why: string } {
  const slot = parseRecord(a.record).incentiveNow
  const why = slot?.text?.trim() ?? ''
  return { direction: slot?.text?.trim() && slot.direction ? slot.direction : 'UNANSWERED', why }
}

export function buildIncentiveMap(actions: MapSource[]): MapRow[] {
  const byId = new Map(actions.map((a) => [a.id, a]))
  const rows = new Map<string, { name: string; insideVotes: boolean[]; spell: Map<string, number>; cells: MapCell[] }>()
  const row = (key: string) => {
    let r = rows.get(key)
    if (!r) { r = { name: '', insideVotes: [], spell: new Map(), cells: [] }; rows.set(key, r) }
    return r
  }
  for (const a of actions) {
    if (a.number == null) continue
    const { direction, why } = directionOf(a)
    const cell: MapCell = { action: a.number, id: a.id, label: labelOf(a), direction, why, changer: direction === 'AGAINST' ? changerOf(a, byId) : null }
    const who = implementersIn(a.whoImplements)
    if (!who.length) { const r = row(NO_IMPLEMENTER_KEY); r.cells.push(cell); continue }
    const seen = new Set<string>()
    for (const w of who) {
      const key = keyOf(w.name)
      if (!key || seen.has(key)) continue
      seen.add(key)
      const r = row(key)
      r.spell.set(w.name, (r.spell.get(w.name) ?? 0) + 1)
      if (w.inside != null) r.insideVotes.push(w.inside)
      r.cells.push(cell)
    }
  }
  const out: MapRow[] = [...rows.entries()].map(([key, r]) => {
    const spellings = [...r.spell.entries()].map(([spelling, count]) => ({ spelling, count })).sort((x, y) => y.count - x.count || y.spelling.length - x.spelling.length)
    const name = key === NO_IMPLEMENTER_KEY ? NO_IMPLEMENTER_NAME : spellings[0]?.spelling ?? key
    const inside = r.insideVotes.length ? r.insideVotes.filter(Boolean).length >= r.insideVotes.length / 2 : null
    const cells = r.cells.sort((x, y) => x.action - y.action)
    const counts = {
      with: cells.filter((c) => c.direction === 'WITH').length,
      against: cells.filter((c) => c.direction === 'AGAINST').length,
      indifferent: cells.filter((c) => c.direction === 'INDIFFERENT').length,
      unanswered: cells.filter((c) => c.direction === 'UNANSWERED').length,
    }
    const parts = [counts.with && `${counts.with} with`, counts.against && `${counts.against} against`, counts.indifferent && `${counts.indifferent} indifferent`, counts.unanswered && `${counts.unanswered} unanswered`].filter(Boolean)
    return {
      key, name, inside, spellings, cells, counts,
      summary: `${name} — ${cells.length} ${plural(cells.length, 'action', 'actions')}: ${parts.join(', ')}`,
      nothingChanges: cells.filter((c) => c.direction === 'AGAINST' && (c.changer?.kind === 'NONE' || c.changer?.kind === 'LINK_GONE')).map((c) => c.action),
    }
  })
  // most against first (the rows to look at), the unnamed row last
  return out.sort((x, y) => (x.key === NO_IMPLEMENTER_KEY ? 1 : 0) - (y.key === NO_IMPLEMENTER_KEY ? 1 : 0) || y.counts.against - x.counts.against || y.cells.length - x.cells.length || x.name.localeCompare(y.name))
}

/** The words for a changer (never colour, never a bare symbol). */
export function changerWords(c: Changer | null): string {
  if (!c) return ''
  switch (c.kind) {
    case 'ACTION': return `turned by #${c.number} (${c.label})`
    case 'WORDS': return `turned, in words only (no action linked): ${clip(c.text, 160)}`
    case 'LINK_GONE': return 'AGAINST — nothing changes this (the action it relied on has left the live list)'
    case 'NONE': return 'AGAINST — nothing changes this'
  }
}

// ── the step-2 checklist line (3d) ──────────────────────────────────────────────────────────────────────────────

/** Distinct actions whose incentive is AGAINST and nothing changes it. */
export function actionsWithNothingChangingIt(actions: MapSource[]): number[] {
  const byId = new Map(actions.map((a) => [a.id, a]))
  return actions.flatMap((a) => {
    if (a.number == null || directionOf(a).direction !== 'AGAINST') return []
    const c = changerOf(a, byId)
    return c.kind === 'NONE' || c.kind === 'LINK_GONE' ? [a.number] : []
  })
}
export function incentiveChecklistLine(actions: MapSource[]): { key: string; done: boolean; text: string } | null {
  if (!actions.length) return null
  const n = actionsWithNothingChangingIt(actions).length
  return {
    key: 'incentiveNothingChanges', done: n === 0,
    text: n === 0 ? 'No action relies on an implementer whose incentive is against with nothing to change it' : `${n} ${plural(n, 'action relies', 'actions rely')} on an implementer whose incentive is against and nothing changes it`,
  }
}

// ── spelling merges (Lex proposes; the user accepts) ─────────────────────────────────────────────────────────────

const STOP = new Set(['for', 'of', 'the', 'and', 'on', 'in'])

/** Initials of a name, two ways - with the small words ("DfE") and without ("ONS") - and short capital tokens ("HM") kept whole. */
function initialisms(name: string): string[] {
  const toks = keyOf(name).split(' ').filter(Boolean)
  const make = (skip: boolean) => toks.filter((t) => !(skip && STOP.has(t))).map((t) => (t.length <= 2 ? t : t[0])).join('')
  return [...new Set([make(false), make(true)])].filter((s) => s.length >= 2)
}

export interface MergeProposal {
  /** The spelling to keep (the more frequent, then the longer). */
  keep: string
  /** The spellings that would be rewritten to it, with the keys the rewrite looks for. */
  from: Array<{ spelling: string; key: string; actions: number }>
  why: string
}

/** Pairs of rows that look like one body spelt two ways. Deterministic: a short form is the initials of the long one, or its words are all inside the longer. Pure. */
export function proposeSpellingMerges(rows: MapRow[]): MergeProposal[] {
  const named = rows.filter((r) => r.key !== NO_IMPLEMENTER_KEY)
  const used = new Set<string>()
  const out: MergeProposal[] = []
  for (let i = 0; i < named.length; i++) {
    for (let j = i + 1; j < named.length; j++) {
      const a = named[i], b = named[j]
      if (used.has(a.key) || used.has(b.key)) continue
      const [short, long] = a.key.length <= b.key.length ? [a, b] : [b, a]
      const sk = short.key.replace(/ /g, '')
      let why: string | null = null
      if (!short.key.includes(' ') && initialisms(long.name).includes(sk)) why = `“${short.name}” reads as the initials of “${long.name}”.`
      else {
        const st = short.key.split(' ')
        const lt = new Set(long.key.split(' '))
        if (st.every((t) => lt.has(t)) && (st.length > 1 || short.key.length >= 6)) why = `every word of “${short.name}” is also in “${long.name}”.`
      }
      if (!why) continue
      used.add(a.key); used.add(b.key)
      const keep = a.cells.length > b.cells.length || (a.cells.length === b.cells.length && a.name.length >= b.name.length) ? a : b
      const other = keep === a ? b : a
      out.push({ keep: keep.name, from: [{ spelling: other.name, key: other.key, actions: other.cells.length }], why })
    }
  }
  return out
}

/** The Who text with every segment whose name has this key written as `to` instead, the inside/outside note and the other segments untouched. Pure. */
export function renameImplementer(who: string, fromKey: string, to: string): string {
  return who.split(/(;|\n)/).map((seg) => {
    if (seg === ';' || seg === '\n') return seg
    const found = implementersIn(seg)[0]
    if (!found || keyOf(found.name) !== fromKey) return seg
    const idx = seg.indexOf(found.name)
    return idx < 0 ? seg : `${seg.slice(0, idx)}${to}${seg.slice(idx + found.name.length)}`
  }).join('')
}

// ── the annexe (3c): one paragraph per implementer, from the slots, the unanswered shown as unanswered ───────────────

export interface AnnexeParagraph { implementer: string; key: string; inside: boolean | null; actionNumbers: number[]; text: string }

export function incentiveAnnexe(rows: MapRow[]): AnnexeParagraph[] {
  return rows.map((r) => {
    const where = r.inside === true ? 'inside government' : r.inside === false ? 'outside government' : 'inside or outside government not stated'
    const must = r.cells.map((c) => `#${c.action} ${c.label}`).join('; ')
    const dir = (d: CellDirection) => r.cells.filter((c) => c.direction === d)
    const pull: string[] = []
    for (const c of dir('WITH')) pull.push(`with on #${c.action}${c.why ? ` (${clip(c.why, 300)})` : ''}`)
    for (const c of dir('AGAINST')) pull.push(`against on #${c.action}${c.why ? ` (${clip(c.why, 300)})` : ''}`)
    for (const c of dir('INDIFFERENT')) pull.push(`indifferent on #${c.action}${c.why ? ` (${clip(c.why, 300)})` : ''}`)
    const unanswered = dir('UNANSWERED').map((c) => `#${c.action}`)
    const changes = dir('AGAINST').map((c) => `for #${c.action}, ${c.changer?.kind === 'ACTION' ? `the proposal relies on #${c.changer.number} (${c.changer.label}) to change it` : c.changer?.kind === 'WORDS' ? `the record says, in words and with no action linked: ${clip(c.changer.text, 240)}` : 'the record names nothing that changes it'}`)
    const text = r.key === NO_IMPLEMENTER_KEY
      ? `No implementer is named yet for ${r.cells.length} ${plural(r.cells.length, 'action', 'actions')}: ${must}. Their incentives cannot be read until Who is answered.`
      : [
        `${r.name} (${where}) must carry out ${r.cells.length} ${plural(r.cells.length, 'action', 'actions')}: ${must}.`,
        pull.length ? `Their incentive today is ${pull.join('; ')}.` : '',
        unanswered.length ? `Which way their incentive pulls is not answered for ${unanswered.join(', ')}.` : '',
        changes.length ? `What changes it: ${changes.join('; ')}.` : '',
      ].filter(Boolean).join(' ')
    return { implementer: r.name, key: r.key, inside: r.inside, actionNumbers: r.cells.map((c) => c.action), text }
  })
}
