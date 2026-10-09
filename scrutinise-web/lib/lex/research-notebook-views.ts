// ─────────────────────────────────────────────────────────────────────────────
// 26-R §4 — THE NOTEBOOK LIST, REGROUPED. Pure functions over the notes the route returns, so the screen and a check read ONE copy.
//   by source   — every note on a document, under it
//   by bearing  — every note on cause 3, the policy, action 12 (a note on two things appears under both: it bears on both)
//   by stance   — the for and the against side by side
//   timeline    — the research log, in the order it was read
//   by author   — who added what (the team view)
// ⚠ NO IMPORTS BUT TYPES (CLAUDE.md §28): a client component imports this.
// ⚠ A note with nothing to group it by is never dropped: it lands in a group that says so, in words ("No source recorded", "Not yet
//   linked to anything"). Silence is how an empty row looks like a tidy one.
// ─────────────────────────────────────────────────────────────────────────────

import type { NoteView } from './research-notes'

export const VIEW_MODES = ['source', 'bearing', 'stance', 'time', 'author'] as const
export type ViewMode = (typeof VIEW_MODES)[number]
export const VIEW_LABEL: Record<ViewMode, string> = { source: 'By source', bearing: 'By what it bears on', stance: 'By stance', time: 'Timeline', author: 'By author' }

export interface NoteGroup { key: string; label: string; notes: NoteView[] }

const STANCE_ORDER = ['SUPPORTS', 'CONTRADICTS', 'CONTEXT', 'UNDECIDED'] as const
const STANCE_WORD: Record<string, string> = { SUPPORTS: 'Supports', CONTRADICTS: 'Contradicts', CONTEXT: 'Context', UNDECIDED: 'Undecided' }

export function groupNotes(notes: readonly NoteView[], mode: ViewMode): NoteGroup[] {
  const out: NoteGroup[] = []
  const bucket = (key: string, label: string) => {
    let g = out.find((x) => x.key === key)
    if (!g) { g = { key, label, notes: [] }; out.push(g) }
    return g
  }
  const byTime = (a: NoteView, b: NoteView) => a.createdAt.localeCompare(b.createdAt)

  if (mode === 'source') {
    for (const n of [...notes].sort(byTime)) {
      if (n.source) bucket(`s:${n.source.id}`, `[Ref: ${n.source.number}] ${n.source.title}`).notes.push(n)
      else bucket('none', 'No source recorded').notes.push(n)
    }
    return out.sort((a, b) => rank(a.key, b.key, (k) => Number(/\[Ref: (\d+)\]/.exec(out.find((g) => g.key === k)?.label ?? '')?.[1] ?? 1e9)))
  }
  if (mode === 'bearing') {
    for (const n of [...notes].sort(byTime)) {
      if (n.bearsOn.length === 0) { bucket('none', 'Not yet linked to anything').notes.push(n); continue }
      for (const b of n.bearsOn) bucket(`b:${b.kind}:${b.id}`, b.label?.trim() || `${b.kind} ${b.id.slice(0, 6)}`).notes.push(n)
    }
    return out.sort((a, b) => (a.key === 'none' ? 1 : b.key === 'none' ? -1 : a.label.localeCompare(b.label, 'en', { numeric: true })))
  }
  if (mode === 'stance') {
    for (const s of STANCE_ORDER) bucket(`st:${s}`, STANCE_WORD[s])
    for (const n of [...notes].sort(byTime)) bucket(`st:${n.stance}`, STANCE_WORD[n.stance] ?? n.stance).notes.push(n)
    return out // the four are always present, in the brief's order — an empty "Contradicts" is information
  }
  if (mode === 'author') {
    // Lex's own findings (virtual rows) and the notes Lex wrote for a person are different things from that person's own words.
    for (const n of [...notes].sort(byTime)) {
      if (n.lex) bucket('a:lex', 'Lex’s findings').notes.push(n)
      else if (n.authorKind === 'LEX') bucket(`a:${n.authorId}:lex`, `Written by Lex for ${n.mine ? 'you' : n.authorName}`).notes.push(n)
      else bucket(`a:${n.authorId}`, n.mine ? `${n.authorName} (you)` : n.authorName).notes.push(n)
    }
    return out.sort((a, b) => (a.key === 'a:lex' ? 1 : b.key === 'a:lex' ? -1 : a.label.localeCompare(b.label)))
  }
  // timeline — oldest first, grouped by the day it was read
  for (const n of [...notes].sort(byTime)) bucket(`d:${n.createdAt.slice(0, 10)}`, longDay(n.createdAt)).notes.push(n)
  return out
}

function rank(a: string, b: string, num: (k: string) => number): number {
  if (a === 'none') return 1
  if (b === 'none') return -1
  return num(a) - num(b)
}

export function longDay(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** The one line a note is known by in a titles-only list: the start of its quote, else of its comment. */
export function noteTitle(n: Pick<NoteView, 'quote' | 'comment'>, max = 110): string {
  const t = (n.quote?.trim() || n.comment?.trim() || '(empty)').replace(/\s+/g, ' ')
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

// ── similar notes and disagreements (26-R §5: find_similar_notes, find_disagreements) — pure, no model, no cost ──────────────────

const STOP = new Set('the a an and or of to in on for with that this is are was were be by as at it its from not no but which have has had will would can could should may might into than then there their they them we our you your i he she his her'.split(' '))
const tokens = (s: string): Set<string> => new Set((s.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter((t) => !STOP.has(t)))

/** Jaccard overlap of the words in two notes' quote + comment (0–1). */
export function noteSimilarity(a: Pick<NoteView, 'quote' | 'comment'>, b: Pick<NoteView, 'quote' | 'comment'>): number {
  const A = tokens(`${a.quote ?? ''} ${a.comment ?? ''}`), B = tokens(`${b.quote ?? ''} ${b.comment ?? ''}`)
  if (!A.size || !B.size) return 0
  let inter = 0
  for (const t of A) if (B.has(t)) inter++
  return inter / (A.size + B.size - inter)
}

/** The notes most like `target`, best first. A note is never "similar to" itself. */
export function similarNotes(target: NoteView, notes: readonly NoteView[], opts: { min?: number; limit?: number } = {}): Array<{ note: NoteView; score: number }> {
  const min = opts.min ?? 0.18
  return notes
    .filter((n) => n.id !== target.id)
    .map((note) => ({ note, score: noteSimilarity(target, note) }))
    .filter((x) => x.score >= min)
    .sort((x, y) => y.score - x.score)
    .slice(0, opts.limit ?? 8)
}

export interface Disagreement { kind: 'marked-contradicts' | 'opposite-stances'; on: string; notes: NoteView[]; between: string[] }

/**
 * Where the research disagrees with itself: (1) every note someone marked CONTRADICTS; (2) pairs of notes that bear on the SAME thing
 * with OPPOSITE stances (supports vs contradicts) — and `between` names the people, so a disagreement BETWEEN TEAM MEMBERS is
 * said as such (BRIEF_26R §7b).
 */
export function findDisagreements(notes: readonly NoteView[]): Disagreement[] {
  const live = notes.filter((n) => n.status !== 'SET_ASIDE' && !n.lex)
  const out: Disagreement[] = []
  for (const n of live.filter((x) => x.stance === 'CONTRADICTS')) {
    out.push({ kind: 'marked-contradicts', on: n.bearsOn.map((b) => b.label ?? b.kind).join('; ') || (n.source ? `[Ref: ${n.source.number}] ${n.source.title}` : 'unlinked'), notes: [n], between: [n.authorName] })
  }
  const byThing = new Map<string, { label: string; notes: NoteView[] }>()
  for (const n of live) for (const b of n.bearsOn) {
    const e = byThing.get(`${b.kind}:${b.id}`) ?? { label: b.label ?? `${b.kind} ${b.id.slice(0, 6)}`, notes: [] }
    e.notes.push(n); byThing.set(`${b.kind}:${b.id}`, e)
  }
  for (const { label, notes: ns } of byThing.values()) {
    const sup = ns.filter((n) => n.stance === 'SUPPORTS'), con = ns.filter((n) => n.stance === 'CONTRADICTS')
    for (const s of sup) for (const c of con) {
      out.push({ kind: 'opposite-stances', on: label, notes: [s, c], between: s.authorId === c.authorId ? [s.authorName] : [s.authorName, c.authorName] })
    }
  }
  return out
}

/** Case-insensitive match across the words a person would search by. */
export function noteMatches(n: NoteView, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  return [n.quote, n.comment, n.source?.title, n.heading, n.tags.join(' '), n.authorName].some((x) => (x ?? '').toLowerCase().includes(s))
}
