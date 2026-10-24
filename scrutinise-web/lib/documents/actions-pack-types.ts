// ─────────────────────────────────────────────────────────────────────────────
// 26-T2 §4/§5 — WHAT THE ACTIONS PACK, THE BACKGROUND REPORT AND THE INTRODUCTORY SUMMARY READ BEYOND THE PROPOSAL SNAPSHOT. TYPES ONLY (no imports).
//
// It rides inside `ProposalSnapshot.actionsPack` as an OPTIONAL member (CLAUDE.md-wise the same reasoning as `prioritySources`): a stored
// version minted before 26-T2 has none, and the three documents then say "this version predates it" rather than printing a blank. ⚠ Nothing
// here is a Lex proposal: a slot is a PACK SLOT only when the owner wrote it or accepted it; an unaccepted proposal never enters the snapshot.
// ─────────────────────────────────────────────────────────────────────────────

export type PackDirection = 'WITH' | 'AGAINST' | 'INDIFFERENT'
export const PACK_SLOT_KEYS = ['who', 'incentiveNow', 'whatChangesIt', 'skill', 'how', 'against', 'worked'] as const
export type PackSlotKey = (typeof PACK_SLOT_KEYS)[number]
export const PACK_SLOT_LABEL: Record<PackSlotKey, string> = {
  who: 'Who', incentiveNow: 'Incentive now', whatChangesIt: 'What changes it', skill: 'Skill', how: 'How', against: 'Against', worked: 'What tells us it worked',
}

export interface PackSlot {
  text: string
  /** Incentive now only. */
  direction?: PackDirection | null
  /** What changes it only: the id (for the map) and the number (for the words) of the action that does. */
  linkActionId?: string | null
  linkNumber?: number | null
}

export interface PackHeading { id: string; name: string; purpose: string | null; hidden: boolean }

import type { DraftVersion } from '@/lib/lex/action-draft-pure'
import type { Touch } from '@/lib/lex/action-touches'

export interface PackAction {
  id: string
  number: number
  title: string | null
  statement: string
  headingId: string | null
  avenue: string | null
  causeNumbers: number[]
  conditionNumbers: number[]
  support: boolean
  policyTest: { verdict: string; reason: string | null; conflictNote: string | null } | null
  /** Only slots the owner wrote or accepted. Absent = "not yet answered". */
  slots: Partial<Record<PackSlotKey, PackSlot>>
  /** Kept for snapshots stored before 26-V1b; not printed (decision 262 retired Now / Next / Later). */
  sequence: string | null
  beforeNumbers: number[]
  /** 26-V1b §7b — what this action must come after, each with the owner's because line. Absent on an older snapshot: derived from beforeNumbers. */
  afterLines?: Array<{ number: number; because: string | null }>
  parked: boolean
  parkedReason: string | null
  /** The commentary, with its "Parts of this action, quoted" bullets lifted out (they are printed on their own). */
  detail: string | null
  /** Each folded part: its number, the words of the quote, the optional title, and the reason; plus any [Ref: n] in the line. */
  parts: Array<{ number: number; quote: string; title: string | null; reason: string | null; refs: number[] }>
  /** Every [Ref: n] this action rests on: accepted evidence, the commentary and its parts, and the owner's notes bearing on it. */
  refs: number[]
  /** Notes IN THE RECORD (the owner's, or put there by the owner) that bear on this action. */
  notes: Array<{ text: string; ref: number | null; author: string; at: string; stance: string }>
  /** 26-U — the current drafting-instruction version (null = none written), and what it touches (null = not computed for this printing). */
  draft: DraftVersion | null
  touches: Touch[] | null
  /** 26-V1 — the action's documents, in number order (current version). Absent on a snapshot stored before 26-V: reads as none. */
  documents?: import('@/lib/lex/action-documents').PackDocument[]
  /** 267 — the drafted amendments of this action's ACCEPTED drafting-instruction version: the only rows the annexe prints. Absent = none accepted. */
  scheduleRows?: import('@/lib/lex/action-documents-pure').ScheduleRow[]
}

export interface PackRuledOut {
  number: number
  title: string | null
  statement: string
  headingId: string | null
  reason: string | null
  /** The row's last change (there is no separate rule-out date). */
  lastChanged: string
}

export interface PackDigest {
  scope: 'HEADING' | 'SET'
  headingId: string | null
  headingName: string | null
  createdAt: string
  /** "written when this heading had 5 actions; it now has 7", or null when current. */
  staleNote: string | null
  answering: number
  answers: Array<{ question: number; reconciled: string }>
  disagreements: Array<{ topic: string; positions: Array<{ model: string; position: string }> }>
  gaps: Array<{ item: string; whatFails: string; category: string; namedBy: string[] }>
}

export interface PackSource { number: number; title: string; citation: string | null; url: string | null; kind: string }

/** Notes and findings set aside, and policy options ruled out - "considered, not taken" (decision 150). */
export interface PackSetAside {
  kind: 'NOTE' | 'FINDING' | 'POLICY_OPTION'
  text: string
  reason: string | null
  at: string | null
  ref: number | null
}

/** One note the Background Report prints, with the stance it carries. */
export interface PackNote { id: string; text: string; quote: string | null; ref: number | null; stance: string; bearsOn: string[]; author: string; at: string }

export interface ActionsPackData {
  headings: PackHeading[]
  conditions: Array<{ number: number; text: string }>
  conditionsSource: string | null
  causes: Array<{ number: number; text: string }>
  actions: PackAction[]
  ruledOut: PackRuledOut[]
  digests: PackDigest[]
  registry: PackSource[]
  /** The Background Report's own reads (decision 150, §5): notes in the record, and what was considered and not taken. */
  notes: PackNote[]
  setAside: PackSetAside[]
  /** Where two notes in the record take opposite stances on the same thing, or one is marked contradicts. */
  disagreements: Array<{ on: string; between: string[] }>
  /** Issues the research raised, with the actions a note in the record links to each (empty = none recorded as meeting it). */
  issueActions: Array<{ issue: string; actionNumbers: number[] }>
}
