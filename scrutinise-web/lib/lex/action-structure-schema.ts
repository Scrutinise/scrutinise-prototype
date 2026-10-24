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
import { HEADING_KINDS } from './action-documents-pure'

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

const RELATION_NAMES = ['amends', 'repeals', 'relies_on', 'constrains', 'modifies', 'precedent'] as const
const INSTRUMENT_NAMES = ['NEW_ACT', 'AMENDING_ACT', 'STATUTORY_CODE', 'STATUTORY_INSTRUMENT', 'MANAGEMENT_CODE', 'GUIDANCE'] as const
const DraftInstructionBody = z.object({
  instrument: z.enum(INSTRUMENT_NAMES).nullable(),
  provisions: z.array(z.object({ docUri: z.string().min(3).max(60), provisionPath: z.string().max(LIMITS.provisionPath).nullable(), relation: z.enum(RELATION_NAMES), note: z.string().max(300) })).max(30),
  dutyOnWhom: z.string().max(LIMITS.instructionLine), enforcedHow: z.string().max(LIMITS.instructionLine), commencement: z.string().max(LIMITS.instructionLine),
  extent: z.array(z.enum(['England and Wales', 'Scotland', 'Northern Ireland', 'UK'])).max(4),
  precedents: z.array(z.object({ docUri: z.string().min(3).max(60), provisionPath: z.string().max(LIMITS.provisionPath).nullable(), how: z.string().max(300) })).max(10),
  clause: z.string().max(12000), plainWording: z.string().max(4000), purpose: z.string().max(LIMITS.instructionPurpose), citations: z.array(z.string().max(200)).max(40).default([]),
})

export const ActionStructureBody = z.discriminatedUnion('op', [
  z.object({ op: z.literal('createHeading'), name: z.string().min(1).max(LIMITS.headingName), colourKey: z.string().max(30).optional() }),
  z.object({ op: z.literal('updateHeading'), headingId: z.string(), name: z.string().min(1).max(LIMITS.headingName).optional(), colourKey: z.string().max(30).optional(), hidden: z.boolean().optional(), kind: z.enum(HEADING_KINDS).nullable().optional() }),
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
  // 26-S2 188 - the conditions facet: the idea's list (owner's words), Lex's proposed additions, and what each action delivers.
  z.object({ op: z.literal('addCondition'), text: z.string().min(1).max(LIMITS.conditionText) }),
  z.object({ op: z.literal('editCondition'), conditionId: z.string(), text: z.string().min(1).max(LIMITS.conditionText) }),
  z.object({ op: z.literal('retireCondition'), conditionId: z.string(), retired: z.boolean() }),
  z.object({ op: z.literal('moveCondition'), conditionId: z.string(), dir: z.enum(['up', 'down']) }),
  z.object({ op: z.literal('acceptConditionProposal'), proposalId: z.string() }),
  z.object({ op: z.literal('dismissConditionProposal'), proposalId: z.string() }),
  // `support: true` marks the actions support (delivers none directly); `conditionIds` sets (or, with mode 'add', adds to) what they deliver.
  z.object({ op: z.literal('assignConditions'), actionIds: ids, conditionIds: z.array(z.string()).max(40).optional(), support: z.boolean().optional(), mode: z.enum(['set', 'add']).optional() }),
  // 26-S2 190 - Re-sort into headings (plan, one batch at a time so each is applied as it completes, finish, undo) and Consolidate this heading.
  z.object({ op: z.literal('resortPlan') }),
  z.object({ op: z.literal('resortBatch'), ids }),
  z.object({ op: z.literal('resortFinish') }),
  z.object({ op: z.literal('undoResort') }),
  z.object({ op: z.literal('consolidatePlan'), headingId: z.string() }),
  z.object({ op: z.literal('consolidate'), headingId: z.string() }),
  z.object({ op: z.literal('setHeadingsHidden'), hidden: z.boolean() }),
  // restore a heading the Re-sort archived (it is kept, never deleted)
  z.object({ op: z.literal('restoreHeading'), headingId: z.string() }),
  // 26-U §3 (148, 228) — the drafting instruction: the user's own version (a NEW version every save), Lex's draft (a proposal beside it),
  // accept / dismiss that proposal; §4 — "What this touches", computed from the current version (read-only).
  z.object({ op: z.literal('saveDraft'), actionId: z.string(), instruction: DraftInstructionBody }),
  z.object({ op: z.literal('draftAction'), actionId: z.string() }),
  z.object({ op: z.literal('acceptDraft'), actionId: z.string() }),
  z.object({ op: z.literal('dismissDraft'), actionId: z.string() }),
  z.object({ op: z.literal('touches'), actionId: z.string() }),
  // 26-V1b §7b (262) — step 4, Order by dependency only: `actionId` must come after `afterId` (on), or no longer (off); `because` optional.
  z.object({ op: z.literal('setAfter'), actionId: z.string(), afterId: z.string(), on: z.boolean(), because: z.string().max(LIMITS.orderBecause).nullable().optional() }),
  // 26-V2c (268, revised) — Lex proposes a kind for each heading with none (asked first, at the measured price); the owner answers each.
  z.object({ op: z.literal('proposeHeadingKinds'), agreedPence: z.number().min(0).max(500) }),
  z.object({ op: z.literal('answerKindProposal'), headingId: z.string(), accept: z.boolean() }),
])

/** What the UI must send — the schema's INPUT type, so an optional/defaulted key stays optional. */
export type ActionStructureRequest = z.input<typeof ActionStructureBody>
export type ActionStructureOp = ActionStructureRequest['op']

/** The words the user knows each control by, for the rejection sentence. */
export const OP_WORDS: Record<ActionStructureOp, string> = {
  createHeading: '“Add heading”', updateHeading: 'Editing the heading', deleteHeading: '“Retire heading”',
  assignHeading: '“Assign to heading”', assignToNewHeading: '“+ New heading…”', setTitle: '“Save title”', acceptTitles: 'Accepting the proposed titles',
  dismissTitles: 'Dismissing the proposed title', proposeTitles: '“Title these for me”', reorder: 'Saving the new order',
  park: '“Later phase”', unpark: '“Bring back”', ruleOut: '“Rule out”', restore: '“Restore”', setFacets: 'Saving the classification',
  acceptFacets: 'Accepting the proposed classification', dismissFacets: 'Dismissing the proposed classification',
  proposeFacets: '“Classify with Lex”', suggestHeadings: '“Suggest headings from my guiding policy”',
  judgeMerge: '“Compare”', applyMerge: '“Merge”', undoMerge: '“Undo merge”', findDuplicates: '“Find duplicates”',
  setStep: 'Moving to that step', keepConflict: '“Keep it, with a note”', testPolicy: '“Test against the policy”',
  setSlot: 'Saving the answer', acceptSlot: 'Using Lex’s proposed answer', dismissSlot: 'Dismissing Lex’s proposed answer',
  proposeSlots: '“Classify with Lex” / “Ask Lex”', dismissSlots: 'Dismissing Lex’s proposed answers',
  addCondition: '“Add condition”', editCondition: 'Editing the condition', retireCondition: '“Retire condition”', moveCondition: 'Moving the condition',
  acceptConditionProposal: 'Accepting Lex’s proposed condition', dismissConditionProposal: 'Dismissing Lex’s proposed condition', assignConditions: 'Saving what the action delivers',
  resortPlan: '“Re-sort into headings”', resortBatch: '“Re-sort into headings”', resortFinish: '“Re-sort into headings”', undoResort: '“Undo the re-sort”',
  consolidatePlan: '“Consolidate this heading”', consolidate: '“Consolidate this heading”', restoreHeading: '“Bring the heading back”', setHeadingsHidden: '“Hide all / Show all headings”',
  saveDraft: 'Saving the drafting instruction', draftAction: '“Draft this clause”', acceptDraft: 'Using Lex’s draft', dismissDraft: 'Dismissing Lex’s draft', touches: '“What this touches”',
  setAfter: 'Saving what this action must come after',
  proposeHeadingKinds: '“Ask Lex to propose kinds”', answerKindProposal: 'Answering Lex’s proposed kind',
}

/** And the words for the inputs those controls send. */
export const INPUT_WORDS: Record<string, string> = {
  actionIds: 'the selected actions', ids: 'the selected actions', actionId: 'the action', headingId: 'the heading',
  name: 'the heading name', colourKey: 'the colour', title: 'the title', reason: 'the reason', order: 'the new order',
  patch: 'the classification', answer: 'Lex’s answer', mergedId: 'the merged action', a: 'the first action number', b: 'the second action number',
  conditionId: 'the condition', proposalId: 'the proposed condition', conditionIds: 'the conditions', support: 'the support mark', dir: 'the direction (up or down)', retired: 'retired or not',
  instruction: 'the drafting instruction', provisions: 'the provisions it amends, repeals or relies on', docUri: 'the Act’s id (for example ukpga/2010/25)', provisionPath: 'the provision (for example section/5)', clause: 'the clause', extent: 'the extent', instrument: 'the instrument', precedents: 'the precedents',
  op: 'the control', step: 'the step (1 to 4)', note: 'the note', slot: 'the question being answered', text: 'the answer', direction: 'the direction (with, against, indifferent)', linkActionId: 'the linked action', replace: 'the choice to replace your answer',
  afterId: 'the action it must come after', on: 'whether it must come after', because: 'the reason (“because …”)',
  kind: 'the kind of heading', agreedPence: 'the price you agreed', accept: 'accept or not',
}
