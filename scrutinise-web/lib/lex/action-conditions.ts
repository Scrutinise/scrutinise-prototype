// ─────────────────────────────────────────────────────────────────────────────
// 26-S2 decision 188 — THE CONDITIONS FACET. PURE; CLIENT-SAFE (types only).
//
// A proposal has to meet a short list of CONDITIONS (Charlie's ten on 452c5ade: "One named owner per task", "Safeguards against gaming" …),
// stored on the idea as an ordered list. Each action says which conditions it DELIVERS (many), or is marked SUPPORT: it delivers none
// directly (training, a pilot, a consultation). The coverage view is conditions × actions; a condition no live action delivers reads
// "NO ACTION" in words — the gap Charlie was finding by reading.
//
// ⚠ A condition is never deleted: removing one RETIRES it (kept, out of the coverage and the checklist), so an action's reference does
// not dangle. ⚠ Lex's additions are PROPOSALS beside the list; the owner accepts them.
// ─────────────────────────────────────────────────────────────────────────────

import type { CanonicalAction } from './page1-config'

export interface Condition { id: string; text: string; by: string | null; at: string | null; retired?: boolean }
export interface ConditionProposal { id: string; text: string; why: string }
/** The stored shape of `Idea.conditions`. `source` says where the list was cited from (the notebook note it was filed in). */
export interface ConditionsDoc { items: Condition[]; proposals: ConditionProposal[]; source: { noteId: string | null; label: string } | null }

export const EMPTY_CONDITIONS: ConditionsDoc = { items: [], proposals: [], source: null }
export const CONDITION_MAX = 400

const str = (v: unknown) => (typeof v === 'string' ? v : '')

/** Tolerant read of the JSON column: anything malformed reads as an empty list rather than breaking the screen. */
export function parseConditions(raw: unknown): ConditionsDoc {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const items: Condition[] = (Array.isArray(r.items) ? r.items : []).flatMap((x) => {
    const o = x as Record<string, unknown>
    const id = str(o?.id), text = str(o?.text).trim()
    return id && text ? [{ id, text, by: str(o.by) || null, at: str(o.at) || null, ...(o.retired === true ? { retired: true } : {}) }] : []
  })
  const proposals: ConditionProposal[] = (Array.isArray(r.proposals) ? r.proposals : []).flatMap((x) => {
    const o = x as Record<string, unknown>
    const id = str(o?.id), text = str(o?.text).trim()
    return id && text ? [{ id, text, why: str(o.why) }] : []
  })
  const s = r.source as Record<string, unknown> | null | undefined
  const source = s && typeof s === 'object' && str(s.label) ? { noteId: str(s.noteId) || null, label: str(s.label) } : null
  return { items, proposals, source }
}

/** The conditions in force, in order. A condition's NUMBER is its place among these (the user says "condition 6"). */
export const activeConditions = (doc: ConditionsDoc): Condition[] => doc.items.filter((c) => !c.retired)

export type ActLike = Pick<CanonicalAction, 'id'> & Partial<Pick<CanonicalAction, 'conditionIds' | 'supportOnly'>>

export interface ConditionCoverage {
  rows: Array<{ condition: Condition; number: number; actionIds: string[] }>
  /** Active conditions no live action delivers. */
  uncovered: Array<{ condition: Condition; number: number }>
  /** Live actions that deliver no condition and are not marked support. */
  unassigned: string[]
  support: number
}

/** Conditions × actions over the LIVE, un-folded actions the caller passes. An action's reference to a retired or unknown condition counts for nothing. */
export function conditionCoverage(doc: ConditionsDoc, actions: ActLike[]): ConditionCoverage {
  const active = activeConditions(doc)
  const rows = active.map((condition, i) => ({ condition, number: i + 1, actionIds: actions.filter((a) => !a.supportOnly && (a.conditionIds ?? []).includes(condition.id)).map((a) => a.id) }))
  const known = new Set(active.map((c) => c.id))
  return {
    rows,
    uncovered: rows.filter((r) => r.actionIds.length === 0).map((r) => ({ condition: r.condition, number: r.number })),
    unassigned: actions.filter((a) => !a.supportOnly && !(a.conditionIds ?? []).some((c) => known.has(c))).map((a) => a.id),
    support: actions.filter((a) => a.supportOnly).length,
  }
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

/** Step-1 checklist lines (advisory, with counts). Empty when the idea has no conditions: nothing to be unfinished. */
export function conditionChecklist(doc: ConditionsDoc, actions: ActLike[]): Array<{ key: string; done: boolean; text: string }> {
  const active = activeConditions(doc)
  if (!active.length || !actions.length) return []
  const cov = conditionCoverage(doc, actions)
  const nU = cov.uncovered.length, nA = cov.unassigned.length
  return [
    { key: 'conditionCovered', done: nU === 0, text: nU === 0 ? 'Every condition has at least one action' : `${nU} of ${active.length} ${plural(nU, 'condition has', 'conditions have')} no action` },
    { key: 'conditionDelivered', done: nA === 0, text: nA === 0 ? 'Every action delivers at least one condition or is marked support' : `${nA} ${plural(nA, 'action delivers', 'actions deliver')} no condition and ${plural(nA, 'is', 'are')} not marked support` },
  ]
}

/** "1, 4 and 6" / "support" / "none" — the words for an action's conditions. */
export function conditionWords(doc: ConditionsDoc, a: ActLike): string {
  if (a.supportOnly) return 'support'
  const active = activeConditions(doc)
  const nums = active.map((c, i) => ((a.conditionIds ?? []).includes(c.id) ? i + 1 : 0)).filter(Boolean)
  if (!nums.length) return 'none'
  return nums.length === 1 ? String(nums[0]) : `${nums.slice(0, -1).join(', ')} and ${nums[nums.length - 1]}`
}
