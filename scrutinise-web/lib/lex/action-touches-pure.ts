// 26-U §4 — the PURE half of "What this touches": the shapes, the honest-state words and the consequential-schedule counts. Imports only types,
// so the documents and the screen can use it without pulling the database into anything (CLAUDE.md §28). The reads are in action-touches.ts.

import type { DraftProvision } from './action-draft-pure'

export type TargetState = 'held' | 'before-parliament' | 'document' | 'named-not-held' | 'no-such-act' | 'lookup-failed'
export const STATE_WORDS: Record<TargetState, string> = {
  held: 'held', 'before-parliament': 'before Parliament — not yet law', document: 'a document, not law', 'named-not-held': 'named, not held',
  'no-such-act': 'no such Act', 'lookup-failed': 'lookup failed',
}
export const NEAR_QUESTION = 'consistent with this action? — not yet answered'

export interface EffectCount { type: string; total: number; changeTheWords: number; doNotChangeTheWords: number; unclassified: number; official: number; extracted: number }
export interface NearProvision { ref: string; number: string; title: string; why: string; question: string }
export interface Touch {
  line: DraftProvision
  state: TargetState
  /** Why the state is what it is, in words (the failure's own reason for "lookup failed"). */
  stateReason: string
  actTitle: string | null
  corpusId: string | null
  heldText: string | null
  heldChars: number | null
  effects: { headline: string; summary: string[]; perType: EffectCount[]; loadDate: string | null; freshness: string; coverage: string } | null
  near: NearProvision[]
  nearNote: string | null
}
export interface TouchesResult { touches: Touch[]; counted: { lines: number; held: number; notHeld: number; failed: number } }

/** 229 — the consequential schedule, counted: every amends / repeals / modifies line and what it knocks on to. */
export interface ScheduleCounts { acts: number; amended: number; repealed: number; modified: number; onward: number; onwardNotWords: number; unclassified: number }
export function scheduleCounts(all: Touch[]): ScheduleCounts {
  const t = all.filter((x) => ['amends', 'repeals', 'modifies'].includes(x.line.relation))
  const sum = (f: (c: EffectCount) => number) => t.reduce((s, x) => s + (x.effects?.perType ?? []).reduce((a, c) => a + f(c), 0), 0)
  return {
    acts: new Set(t.map((x) => x.line.docUri)).size,
    amended: t.filter((x) => x.line.relation === 'amends').length, repealed: t.filter((x) => x.line.relation === 'repeals').length, modified: t.filter((x) => x.line.relation === 'modifies').length,
    onward: sum((c) => c.total), onwardNotWords: sum((c) => c.doNotChangeTheWords), unclassified: sum((c) => c.unclassified),
  }
}
/** The body sentence (BRIEF_26U §4b's shape). Every figure interpolated; unclassified always printed, never folded into zero (209). */
export const scheduleSentence = (c: ScheduleCounts) =>
  `Primary legislation: ${c.amended} provision${c.amended === 1 ? '' : 's'} amended, ${c.repealed} repealed${c.modified ? `, ${c.modified} modified` : ''}, across ${c.acts} Act${c.acts === 1 ? '' : 's'}; ${c.onward} onward effect${c.onward === 1 ? '' : 's'}, of which ${c.onwardNotWords} do not change the words; ${c.unclassified} unclassified.`
