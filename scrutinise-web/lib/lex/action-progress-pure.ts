// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-X §5f (decision 310) — THE PER-ACTION PROGRESS STRIP. PURE; CLIENT-SAFE (imports types and the label table only).
//
//   Defined ● → Briefed ● → Drafted ○ → Reviewed ○ → Accepted ○
//
// DERIVED, NEVER STORED BY HAND. Every state is read from what the record already holds — the statement, the heading and its kind, and the
// documents tree (lib/lex/action-documents.ts `documentTree`): each document's status, its accepted version and how many of the five review
// passes read its current version. Nothing here writes, and no second store exists to drift from the first.
//
//   Defined   the statement, a heading, and the heading's KIND (CCh-Lex 4 Nov (2), item 3)
//   Briefed   a Brief exists, or the action "needs no draft" (with its reason). ⚠ X1: the Brief on every draft is X2 (BRIEF_26X §5d). Until it
//             lands, the one Brief that exists is a draft clause's drafting instruction (26-U), whose versions ARE that kind's Brief — so a
//             clause action is Briefed once it has one, and every other kind reads "no Brief yet". Said on the field guide's entry, not hidden.
//   Drafted   the action's draft (its instrument) has a version
//   Reviewed  all five review passes read the CURRENT version of the draft
//   Accepted  the draft is accepted AT its current version (26-V1b 263: a new version moves an accepted draft back to "drafted")
//
// SHAPE AND WORD, NEVER COLOUR (CLAUDE.md §21): ● done · ◐ in progress · ○ not yet, each with its word.
// "Needs no draft" (313) is a stated state with a reason: it reads "Defined ● · needs no draft ✓" and counts as done for the lock (317).
// ─────────────────────────────────────────────────────────────────────────────

import type { DocumentKind, DocumentStatus } from './action-documents-pure'
import { PROGRESS_WORD } from './screen-labels'

export type ProgressKey = 'defined' | 'briefed' | 'drafted' | 'reviewed' | 'accepted'
export const PROGRESS_KEYS: readonly ProgressKey[] = ['defined', 'briefed', 'drafted', 'reviewed', 'accepted']
export type Mark = 'done' | 'part' | 'none'
export const MARK_GLYPH: Record<Mark, string> = { done: '●', part: '◐', none: '○' }
export const NO_DRAFT_GLYPH = '✓'

/** Companions of a draft (313): what is made BESIDE the instrument, never the instrument. A costing is the draft only when nothing else is. */
export const COMPANION_KINDS: ReadonlySet<DocumentKind> = new Set<DocumentKind>(['COLLISION_REPORT', 'EXPLANATORY_NOTE', 'CONSEQUENTIAL_SCHEDULE'])

/** What the strip reads about one action: the action's own fields, its heading's kind, and its row of the documents tree. */
export interface ProgressInput {
  statement: string
  /** 26-X addendum 322 — a title alone is a start: an action added with only its title reads "Defined ◐". */
  title?: string | null
  headingId: string | null
  headingKind: string | null
  /** The tree's `needs`: the kinds it needs, and whether that was set by hand. `kinds: []` + overridden = "needs no draft". */
  needs: { kinds: DocumentKind[]; why: string; overridden: boolean }
  documents: Array<{ kind: DocumentKind; status: DocumentStatus; acceptedV: number | null; current: { v: number } | null; reviewed: number }>
}

export interface Progress {
  marks: Record<ProgressKey, Mark>
  /** "needs no draft", with the reason the owner gave (313). */
  noDraft: { reason: string } | null
  /** The kinds that make up this action's draft (the instrument), in words order; empty when nothing is derived yet. */
  draftKinds: DocumentKind[]
  /** Where the action stands, one of the Drafting page's filters (§5a). Every action is in exactly one. */
  stage: DraftingStage
}

export type DraftingStage = 'toBrief' | 'toDraft' | 'toReview' | 'toAccept' | 'noDraft' | 'accepted'
export const DRAFTING_STAGES: readonly DraftingStage[] = ['toBrief', 'toDraft', 'toReview', 'toAccept', 'noDraft', 'accepted']

/** The draft's kinds: what is needed, less the companions; a costing on its own is the draft (a financial action's instrument). */
export function draftKindsOf(needed: readonly DocumentKind[]): DocumentKind[] {
  const core = needed.filter((k) => !COMPANION_KINDS.has(k))
  const withoutCosting = core.filter((k) => k !== 'COSTING')
  return withoutCosting.length ? withoutCosting : core
}

const all = <T,>(xs: T[], f: (x: T) => boolean) => xs.length > 0 && xs.every(f)
const some = <T,>(xs: T[], f: (x: T) => boolean) => xs.some(f)
const mark = (done: boolean, part: boolean): Mark => (done ? 'done' : part ? 'part' : 'none')

/** The five marks for one action. `passes` is the number of review passes (deepening-config PASSES), handed in so this file imports nothing. */
export function progressOf(a: ProgressInput, passes: number): Progress {
  const statement = !!a.statement.trim()
  // ● = statement + heading + the heading's kind (CCh-Lex 4 Nov (2) item 3). ◐ = begun but not all three (322: "Defined ◐ until the statement
  // and heading are both set" — a new action with only a title, or a heading and no statement, is ◐). ○ = nothing at all.
  const defined = mark(statement && !!a.headingId && !!a.headingKind, statement || !!a.title?.trim() || !!a.headingId)
  const noDraft = a.needs.overridden && a.needs.kinds.length === 0 ? { reason: a.needs.why.replace(/^needs nothing:\s*/, '') } : null
  const draftKinds = draftKindsOf(a.needs.kinds)
  const live = a.documents.filter((d) => d.status !== 'SUPERSEDED')
  // the draft: for each kind it needs, the latest live document of that kind
  const drafts = draftKinds.map((k) => live.filter((d) => d.kind === k).at(-1) ?? null)
  const present = drafts.filter((d): d is NonNullable<typeof d> => !!d)
  const drafted = mark(drafts.length > 0 && all(drafts, (d) => !!d?.current), some(present, (d) => !!d.current))
  const reviewed = mark(all(drafts, (d) => !!d?.current && d.reviewed >= passes), some(present, (d) => d.reviewed > 0))
  // accepted at the current version; an earlier acceptance since changed is "in progress", said as such on the guide
  const accepted = mark(drafts.length > 0 && all(drafts, (d) => d?.status === 'ACCEPTED'), some(present, (d) => d.status === 'ACCEPTED' || d.acceptedV != null))
  // X1: only a draft clause's instruction is a Brief (see the header). A clause document with a version holds one.
  const clauseBrief = live.some((d) => d.kind === 'DRAFT_CLAUSE' && !!d.current)
  const briefed: Mark = noDraft || clauseBrief ? 'done' : 'none'
  const marks: Record<ProgressKey, Mark> = noDraft
    ? { defined, briefed: 'done', drafted: 'none', reviewed: 'none', accepted: 'none' }
    : { defined, briefed, drafted, reviewed, accepted }
  const stage: DraftingStage = noDraft ? 'noDraft'
    : accepted === 'done' ? 'accepted'
    : drafted === 'done' && reviewed === 'done' ? 'toAccept'
    : drafted === 'done' ? 'toReview'
    : briefed === 'done' ? 'toDraft'
    : 'toBrief'
  return { marks, noDraft, draftKinds, stage }
}

/** An action is DONE for the lock (317) when it is accepted or needs no draft. */
export const isDone = (p: Pick<Progress, 'stage'>) => p.stage === 'accepted' || p.stage === 'noDraft'

export interface DraftingCounts { total: number; accepted: number; noDraft: number; toGo: number; drafted: number; byStage: Record<DraftingStage, number> }

export function draftingCounts(ps: ReadonlyArray<Pick<Progress, 'stage' | 'marks'>>): DraftingCounts {
  const byStage = Object.fromEntries(DRAFTING_STAGES.map((s) => [s, 0])) as Record<DraftingStage, number>
  for (const p of ps) byStage[p.stage]++
  return {
    total: ps.length, accepted: byStage.accepted, noDraft: byStage.noDraft, toGo: ps.length - byStage.accepted - byStage.noDraft,
    drafted: ps.filter((p) => p.marks.drafted === 'done').length, byStage,
  }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** §5a / §3a item 5 — "57 actions: 41 accepted · 3 need no draft · 13 to go". */
export function draftingLine(c: DraftingCounts): string {
  return `${plural(c.total, 'action', 'actions')}: ${c.accepted} accepted · ${c.noDraft} ${c.noDraft === 1 ? 'needs' : 'need'} no draft · ${c.toGo} to go`
}

/** The strip in words, for a screen reader, a printed line or Lex: "Defined ● · Briefed ● · Drafted ○ · Reviewed ○ · Accepted ○". */
export function stripWords(p: Pick<Progress, 'marks' | 'noDraft'>): string {
  if (p.noDraft) return `${PROGRESS_WORD.defined} ${MARK_GLYPH[p.marks.defined]} · ${PROGRESS_WORD.noDraft} ${NO_DRAFT_GLYPH}`
  return PROGRESS_KEYS.map((k) => `${PROGRESS_WORD[k]} ${MARK_GLYPH[p.marks[k]]}`).join(' · ')
}
