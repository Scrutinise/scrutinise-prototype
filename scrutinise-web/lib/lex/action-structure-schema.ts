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

const ids = z.array(z.string().min(1)).min(1).max(300)
const Answer = z.object({
  verdict: z.enum(['MERGE', 'ONE_CONTAINS_THE_OTHER', 'SEQUENCE', 'CONTRADICTORY']),
  reasoning: z.string().max(4000),
  merged: z.object({ title: z.string().max(300), practicalStep: z.string().min(1).max(4000) }).nullable().optional(),
  subordinateNumber: z.number().int().nullable().optional(),
})
const Facets = z.object({
  targetCauseIds: z.array(z.string()).max(40).optional(),
  avenue: z.enum(['LEGISLATIVE', 'ORGANISATIONAL', 'FINANCIAL']).nullable().optional(),
  link: z.string().max(200).nullable().optional(),
  sequence: z.enum(['NOW', 'NEXT', 'LATER']).nullable().optional(),
  beforeIds: z.array(z.string()).max(100).optional(),
})

export const ActionStructureBody = z.discriminatedUnion('op', [
  z.object({ op: z.literal('createHeading'), name: z.string().min(1).max(80), colourKey: z.string().max(30).optional() }),
  z.object({ op: z.literal('updateHeading'), headingId: z.string(), name: z.string().min(1).max(80).optional(), colourKey: z.string().max(30).optional(), hidden: z.boolean().optional() }),
  z.object({ op: z.literal('deleteHeading'), headingId: z.string() }),
  z.object({ op: z.literal('assignHeading'), actionIds: ids, headingId: z.string().nullable() }),
  z.object({ op: z.literal('setTitle'), actionId: z.string(), title: z.string().max(300).nullable() }),
  z.object({ op: z.literal('acceptTitles'), ids: ids.optional() }),
  z.object({ op: z.literal('dismissTitles'), ids: ids.optional() }),
  z.object({ op: z.literal('proposeTitles') }),
  z.object({ op: z.literal('reorder'), order: z.array(z.string()).min(1).max(500) }),
  z.object({ op: z.literal('park'), ids, reason: z.string().max(600).nullable().optional() }),
  z.object({ op: z.literal('unpark'), ids }),
  z.object({ op: z.literal('ruleOut'), ids, reason: z.string().max(600) }),
  z.object({ op: z.literal('restore'), ids }),
  z.object({ op: z.literal('setFacets'), actionId: z.string(), patch: Facets }),
  z.object({ op: z.literal('acceptFacets'), ids: ids.optional() }),
  z.object({ op: z.literal('dismissFacets'), ids: ids.optional() }),
  z.object({ op: z.literal('proposeFacets') }),
  z.object({ op: z.literal('suggestHeadings') }),
  z.object({ op: z.literal('judgeMerge'), a: z.number().int(), b: z.number().int() }),
  z.object({ op: z.literal('applyMerge'), a: z.number().int(), b: z.number().int(), answer: Answer }),
  z.object({ op: z.literal('undoMerge'), mergedId: z.string() }),
  z.object({ op: z.literal('findDuplicates') }),
])

/** What the UI must send — the schema's INPUT type, so an optional/defaulted key stays optional. */
export type ActionStructureRequest = z.input<typeof ActionStructureBody>
export type ActionStructureOp = ActionStructureRequest['op']

/** The words the user knows each control by, for the rejection sentence. */
export const OP_WORDS: Record<ActionStructureOp, string> = {
  createHeading: '“Add heading”', updateHeading: 'Editing the heading', deleteHeading: '“Delete heading”',
  assignHeading: '“Assign to heading”', setTitle: '“Save title”', acceptTitles: 'Accepting the proposed titles',
  dismissTitles: 'Dismissing the proposed title', proposeTitles: '“Title these for me”', reorder: 'Saving the new order',
  park: '“Later phase”', unpark: '“Bring back”', ruleOut: '“Rule out”', restore: '“Restore”', setFacets: 'Saving the classification',
  acceptFacets: 'Accepting the proposed classification', dismissFacets: 'Dismissing the proposed classification',
  proposeFacets: '“Classify with Lex”', suggestHeadings: '“Suggest headings from my guiding policy”',
  judgeMerge: '“Compare”', applyMerge: '“Merge”', undoMerge: '“Undo merge”', findDuplicates: '“Find duplicates”',
}

/** And the words for the inputs those controls send. */
export const INPUT_WORDS: Record<string, string> = {
  actionIds: 'the selected actions', ids: 'the selected actions', actionId: 'the action', headingId: 'the heading',
  name: 'the heading name', colourKey: 'the colour', title: 'the title', reason: 'the reason', order: 'the new order',
  patch: 'the classification', answer: 'Lex’s answer', mergedId: 'the merged action', a: 'the first action number', b: 'the second action number',
  op: 'the control',
}
