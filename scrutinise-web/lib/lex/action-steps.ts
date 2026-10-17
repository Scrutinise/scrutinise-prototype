// ─────────────────────────────────────────────────────────────────────────────
// 26-S2 §3 (decision 166) — THE COHERENT ACTIONS SCREEN WORKS IN FOUR STEPS. PURE; CLIENT-SAFE (no imports but types).
//
//   1 Sort and prune · 2 Who, how and against · 3 Costs · 4 Order
//
// THE DESIGN RULE THIS SPRINT INTRODUCES: *the screen shows only the tools for the step the user is on; everything else waits,
// reachable but out of the way.* 26-Q put fourteen tools and six facets on one screen — "the dashboard of a fighter jet" (Charlie,
// 17 Oct). A user sorting fifty actions cannot also be asked who implements each, what it costs and what comes before what.
//
// A checklist is ADVISORY: it says what is unfinished and never blocks moving on.
// ─────────────────────────────────────────────────────────────────────────────

import type { CanonicalAction } from './page1-config'

export type ActionsStep = 1 | 2 | 3 | 4
export const STEP_NUMBERS: ActionsStep[] = [1, 2, 3, 4]
export const DEFAULT_STEP: ActionsStep = 1

export function clampStep(n: unknown): ActionsStep {
  const v = typeof n === 'number' ? Math.trunc(n) : Number(n)
  return v === 2 || v === 3 || v === 4 ? v : 1
}

/** The step bar's words, and each step's intro paragraph — VERBATIM from BRIEF_26S2 §4–§7 (`lead` is the bold run). */
export const STEPS: Record<ActionsStep, { label: string; lead: string; body: string }> = {
  1: {
    label: 'Sort and prune',
    lead: 'Sort and prune.',
    body: 'Get the list into shape before adding detail. Give every action a heading — the instrument it belongs to — link it to the causes it attacks, and say which avenue it uses: legislative, organisational or financial. Merge duplicates, rule out what does not fit the policy (with a reason — nothing is deleted), and check for gaps. Who does what, what it costs and what comes first are the next steps.',
  },
  2: {
    label: 'Who, how and against',
    lead: 'Who, how and against.',
    body: 'An action is only real when someone named will do it, with a reason to, and when you know what will push back. For each action: who implements it and whether their present incentive pulls with it or against it; what in the proposal changes that; how it is enforced and by whom; and what will oppose it — strikes, gaming, legal challenge, delay. Lex can propose answers; you decide.',
  },
  3: {
    label: 'Costs',
    lead: 'Costs.',
    body: 'A range is enough here: low and high, what it is based on, and the price year. The full costing — in the shape of the Treasury’s Green Book, which is how departments appraise a proposal — happens in the Deepening, where each clause can be costed rather than each aspiration.',
  },
  4: {
    label: 'Order',
    lead: 'Order.',
    body: 'Which actions must come first, and which depend on others. This is sequence, not a project plan: a plan with dates belongs in a project tool once the proposal is adopted.',
  },
}

/** Decision 179 — the three cost columns are COST lines, labelled so, in step 3 only. Never "Against" (that is the step-2 slot). */
export const COST_LINE_LABEL = { implementationCost: 'Cost to implement', enforcementCost: 'Cost to enforce', regulatoryFriction: 'Cost of compliance' } as const

export interface ChecklistLine { key: string; done: boolean; text: string }

export interface ChecklistContext {
  /** Has "Find duplicates" run since the last change to the list? */
  duplicatesChecked: boolean
}

type A = Pick<CanonicalAction, 'id' | 'headingId' | 'targetCauseIds' | 'avenue' | 'policyTest' | 'conflictNote' | 'whoImplements' | 'sequence' | 'implementationCost' | 'enforcementCost' | 'regulatoryFriction'>

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)
const line = (key: string, count: number, missing: (n: number) => string, ok: string): ChecklistLine => ({ key, done: count === 0, text: count === 0 ? ok : missing(count) })

/** Does the action carry any cost range of its own? (Cost LINES are counted by the caller and passed in `withLines`.) */
export function hasCostRange(a: Pick<CanonicalAction, 'implementationCost' | 'enforcementCost' | 'regulatoryFriction'>): boolean {
  return [a.implementationCost, a.enforcementCost, a.regulatoryFriction].some((c) => c && (c.low != null || c.high != null))
}

/** A conflicting action nobody has dealt with: still live, still CONFLICTS, no note. (Ruled out leaves the live list; a re-test replaces the verdict.) */
export const unresolvedConflict = (a: Pick<CanonicalAction, 'policyTest' | 'conflictNote'>): boolean => a.policyTest?.verdict === 'CONFLICTS' && !a.conflictNote?.trim()

/** The advisory checklist for a step, over the live, un-parked actions. Every line is words with a count; never blocks. */
export function stepChecklist(step: ActionsStep, actions: A[], ctx: ChecklistContext, opts: { actionIdsWithCostLines?: Set<string> } = {}): ChecklistLine[] {
  const n = actions.length
  if (n === 0) return []
  switch (step) {
    case 1: {
      const noHeading = actions.filter((a) => !a.headingId).length
      const noCause = actions.filter((a) => a.targetCauseIds.length === 0).length
      const noAvenue = actions.filter((a) => !a.avenue).length
      const untested = actions.filter((a) => !a.policyTest || a.policyTest.verdict === 'NOT_TESTED').length
      const conflicts = actions.filter(unresolvedConflict).length
      return [
        line('heading', noHeading, (c) => `${c} ${plural(c, 'action has', 'actions have')} no heading`, 'All actions have a heading'),
        line('cause', noCause, (c) => `${c} ${plural(c, 'action has', 'actions have')} no cause`, 'All actions have at least one cause'),
        line('avenue', noAvenue, (c) => `${c} ${plural(c, 'action has', 'actions have')} no avenue`, 'All actions have an avenue'),
        line('tested', untested, (c) => `${c} ${plural(c, 'action has', 'actions have')} not been tested against the policy`, 'Every action has been tested against the policy'),
        { key: 'duplicates', done: ctx.duplicatesChecked, text: ctx.duplicatesChecked ? 'Find duplicates has been run since the last change' : 'Find duplicates has not been run since the last change' },
        line('conflicts', conflicts, (c) => `${c} ${plural(c, 'action conflicts', 'actions conflict')} with the policy and ${plural(c, 'has', 'have')} not been ruled out, re-tested after an edit, or kept with a note`, 'No action that conflicts with the policy is waiting for a decision'),
      ]
    }
    case 2: {
      const noWho = actions.filter((a) => !a.whoImplements?.trim()).length
      return [line('who', noWho, (c) => `${c} ${plural(c, 'action has', 'actions have')} no one named to implement ${plural(c, 'it', 'them')} (Who)`, 'Every action names who implements it')]
    }
    case 3: {
      const none = actions.filter((a) => !hasCostRange(a) && !opts.actionIdsWithCostLines?.has(a.id)).length
      return [line('cost', none, (c) => `${c} ${plural(c, 'action has', 'actions have')} no cost range`, 'Every action has a cost range')]
    }
    case 4: {
      const noSeq = actions.filter((a) => !a.sequence).length
      return [line('sequence', noSeq, (c) => `${c} ${plural(c, 'action has', 'actions have')} no sequence slot`, 'Every action has a sequence slot')]
    }
  }
}

/** What the opened record's collapsed sections say, one line each ("Who, how and against — not yet answered · from step 2"). */
export function otherStepLine(step: ActionsStep, a: Pick<CanonicalAction, 'whoImplements' | 'sequence' | 'implementationCost' | 'enforcementCost' | 'regulatoryFriction' | 'avenue' | 'targetCauseIds' | 'policyTest'>, hasLines: boolean, headingName?: string | null): string {
  switch (step) {
    case 1: {
      const verdict = a.policyTest && a.policyTest.verdict !== 'NOT_TESTED' ? { FITS: 'fits the policy', DOES_NOT_FIT: 'does not fit the policy', CONFLICTS: 'conflicts with the policy', NOT_TESTED: '' }[a.policyTest.verdict] : 'not tested against the policy'
      const bits = [headingName ? `under “${headingName}”` : 'no heading', a.avenue ? a.avenue.toLowerCase() : 'no avenue', `${a.targetCauseIds.length} cause${a.targetCauseIds.length === 1 ? '' : 's'}`, verdict]
      return `${STEPS[1].label} — ${bits.join(' · ')} · from step 1`
    }
    case 2: return `${STEPS[2].label} — ${a.whoImplements?.trim() ? `Who: ${a.whoImplements.trim().length > 60 ? `${a.whoImplements.trim().slice(0, 59)}…` : a.whoImplements.trim()}` : 'not yet answered'} · from step 2`
    case 3: return `${STEPS[3].label} — ${hasCostRange(a) || hasLines ? 'a cost range is recorded' : 'not yet answered'} · from step 3`
    case 4: return `${STEPS[4].label} — ${a.sequence ? `sequence: ${a.sequence.toLowerCase()}` : 'not yet answered'} · from step 4`
  }
}
