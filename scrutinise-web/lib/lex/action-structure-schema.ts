// ─────────────────────────────────────────────────────────────────────────────
// THE REQUEST CONTRACT OF /api/ideas/[id]/action-structure — ONE DEFINITION, READ BY THE ROUTE AND TYPED INTO THE UI.
//
// ⚠ WHY THIS IS A FILE OF ITS OWN (8 Oct 2026). The schema lived inside the route and the client built its request
// bodies as untyped objects, so the two could disagree and nothing would say so until a user pressed a button: the
// per-row heading dropdown sent `actionIds`, the bulk bar sent `ids`, and the route wanted `actionIds`. The bulk bar
// answered "That request was not valid." The client now types every call as `ActionStructureRequest` (`import type`
// — erased, no zod in the bundle), so the same mistake is a compile error.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod'
import { LIMITS } from './input-limits'

const ids = z.array(z.string().min(1)).min(1).max(300)
const SLOT_NAMES = ['who', 'incentiveNow', 'whatChangesIt', 'skill', 'how', 'against', 'worked'] as const
const Answer = z.object({
  verdict: z.enum(['MERGE', 'ONE_CONTAINS_THE_OTHER', 'SEQUENCE', 'CONTRADICTORY']),
  reasoning: z.string().max(4000),
  merged: z.object({ title: z.string().max(300), practicalStep: z.string().min(1).max(4000) }).nullable().optional(),
  subordinateNumber: z.number().int().nullable().optional(),
})
const Facets = z.object({
  targetCauseIds: z.array(z.string()).max(40).optional(),
  avenue: z.enum(['LEGISLATIVE', 'ORGANISATIONAL', 'FINANCIAL']).nullable().optional(),
  link: z.string().max(LIMITS.classificationLink).nullable().optional(),
  sequence: z.enum(['NOW', 'NEXT', 'LATER']).nullable().optional(),
  beforeIds: z.array(z.string()).max(100).optional(),
})

export const ActionStructureBody = z.discriminatedUnion('op', [
  z.object({ op: z.literal('createHeading'), name: z.string().min(1).max(LIMITS.headingName), colourKey: z.string().max(30).optional() }),
  z.object({ op: z.literal('updateHeading'), headingId: z.string(), name: z.string().min(1).max(LIMITS.headingName).optional(), colourKey: z.string().max(30).optional(), hidden: z.boolean().optional() }),
  z.object({ op: z.literal('deleteHeading'), headingId: z.string() }),
  z.object({ op: z.literal('assignHeading'), actionIds: ids, headingId: z.string().nullable() }),
  // 26-S browser pass B — the bulk bar's "+ New heading…": the heading is made and the selected rows go onto it in ONE request.
  z.object({ op: z.literal('assignToNewHeading'), actionIds: ids, name: z.string().min(1).max(LIMITS.headingName) }),
  z.object({ op: z.literal('setTitle'), actionId: z.string(), title: z.string().max(LIMITS.actionTitle).nullable() }),
  z.object({ op: z.literal('acceptTitles'), ids: ids.optional() }),
  z.object({ op: z.literal('dismissTitles'), ids: ids.optional() }),
  z.object({ op: z.literal('proposeTitles') }),
  z.object({ op: z.literal('reorder'), order: z.array(z.string()).min(1).max(500) }),
  z.object({ op: z.literal('park'), ids, reason: z.string().max(LIMITS.ruleOutReason).nullable().optional() }),
  z.object({ op: z.literal('unpark'), ids }),
  z.object({ op: z.literal('ruleOut'), ids, reason: z.string().max(LIMITS.ruleOutReason) }),
  z.object({ op: z.literal('restore'), ids }),
  z.object({ op: z.literal('setFacets'), actionId: z.string(), patch: Facets }),
  // `step`: accept / dismiss only that step's part of a proposal (1 causes + avenue, 4 sequence + before); absent = all of it.
  z.object({ op: z.literal('acceptFacets'), ids: ids.optional(), step: z.number().int().min(1).max(4).optional() }),
  z.object({ op: z.literal('dismissFacets'), ids: ids.optional(), step: z.number().int().min(1).max(4).optional() }),
  z.object({ op: z.literal('proposeFacets') }),
  z.object({ op: z.literal('suggestHeadings') }),
  z.object({ op: z.literal('judgeMerge'), a: z.number().int(), b: z.number().int() }),
  z.object({ op: z.literal('applyMerge'), a: z.number().int(), b: z.number().int(), answer: Answer }),
  z.object({ op: z.literal('undoMerge'), mergedId: z.string() }),
  z.object({ op: z.literal('findDuplicates') }),
  // 26-S2 §3 — the step bar (decision 166) and "kept with a note" for an action the policy test says CONFLICTS (§3c).
  z.object({ op: z.literal('setStep'), step: z.number().int().min(1).max(4) }),
  z.object({ op: z.literal('keepConflict'), actionId: z.string(), note: z.string().max(LIMITS.ruleOutReason).nullable() }),
  // 170 — "Test against the policy": no `ids` = every action that reads "? Not tested"; `ids` = test (or re-test) those.
  z.object({ op: z.literal('testPolicy'), ids: ids.optional() }),
  // 26-S2 §5 (177) — step 2, "Who, how and against": the seven slots. `text` empty clears the slot. Accepting onto the user's own answer needs `replace`.
  z.object({ op: z.literal('setSlot'), actionId: z.string(), slot: z.enum(SLOT_NAMES), text: z.string().max(LIMITS.slotAnswer), direction: z.enum(['WITH', 'AGAINST', 'INDIFFERENT']).nullable().optional(), linkActionId: z.string().nullable().optional() }),
  z.object({ op: z.literal('acceptSlot'), actionId: z.string(), slot: z.enum(SLOT_NAMES), replace: z.boolean().optional() }),
  z.object({ op: z.literal('dismissSlot'), actionId: z.string(), slot: z.enum(SLOT_NAMES) }),
  // "Classify with Lex" in step 2 (no `ids`: every action with an unanswered slot) and the per-action "Ask Lex" (`ids`).
  z.object({ op: z.literal('proposeSlots'), ids: ids.optional() }),
  z.object({ op: z.literal('dismissSlots'), ids: ids.optional() }),
])

/** What the UI must send — the schema's INPUT type, so an optional/defaulted key stays optional. */
export type ActionStructureRequest = z.input<typeof ActionStructureBody>
export type ActionStructureOp = ActionStructureRequest['op']

/** The words the user knows each control by, for the rejection sentence. */
export const OP_WORDS: Record<ActionStructureOp, string> = {
  createHeading: '“Add heading”', updateHeading: 'Editing the heading', deleteHeading: '“Delete heading”',
  assignHeading: '“Assign to heading”', assignToNewHeading: '“+ New heading…”', setTitle: '“Save title”', acceptTitles: 'Accepting the proposed titles',
  dismissTitles: 'Dismissing the proposed title', proposeTitles: '“Title these for me”', reorder: 'Saving the new order',
  park: '“Later phase”', unpark: '“Bring back”', ruleOut: '“Rule out”', restore: '“Restore”', setFacets: 'Saving the classification',
  acceptFacets: 'Accepting the proposed classification', dismissFacets: 'Dismissing the proposed classification',
  proposeFacets: '“Classify with Lex”', suggestHeadings: '“Suggest headings from my guiding policy”',
  judgeMerge: '“Compare”', applyMerge: '“Merge”', undoMerge: '“Undo merge”', findDuplicates: '“Find duplicates”',
  setStep: 'Moving to that step', keepConflict: '“Keep it, with a note”', testPolicy: '“Test against the policy”',
  setSlot: 'Saving the answer', acceptSlot: 'Using Lex’s proposed answer', dismissSlot: 'Dismissing Lex’s proposed answer',
  proposeSlots: '“Classify with Lex” / “Ask Lex”', dismissSlots: 'Dismissing Lex’s proposed answers',
}

/** And the words for the inputs those controls send. */
export const INPUT_WORDS: Record<string, string> = {
  actionIds: 'the selected actions', ids: 'the selected actions', actionId: 'the action', headingId: 'the heading',
  name: 'the heading name', colourKey: 'the colour', title: 'the title', reason: 'the reason', order: 'the new order',
  patch: 'the classification', answer: 'Lex’s answer', mergedId: 'the merged action', a: 'the first action number', b: 'the second action number',
  op: 'the control', step: 'the step (1 to 4)', note: 'the note', slot: 'the question being answered', text: 'the answer', direction: 'the direction (with, against, indifferent)', linkActionId: 'the linked action', replace: 'the choice to replace your answer',
}
