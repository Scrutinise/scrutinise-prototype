// ─────────────────────────────────────────────────────────────────────────────
// THE REQUEST CONTRACT OF /api/ideas/[id]/action-import — ONE DEFINITION, READ BY THE ROUTE AND TYPED INTO THE PANEL.
// Same reason as action-structure-schema.ts (docs/CLAUDE.md §30): the client types every call against this with `import type`
// (erased, no zod in the bundle), so a wrong key is a compile error, and the route words any rejection.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod'

const ProposalKind = z.enum(['NEW', 'ADDS_TO', 'PART_OF', 'POLICY', 'NOT_ACTION', 'UNPLACED'])

/** One row's edit. Every key is optional; only what the user changed is sent. */
const ItemPatch = z.object({
  title: z.string().max(300).optional(),
  summary: z.string().max(600).optional(),
  implementer: z.string().max(200).nullable().optional(),
  proposal: ProposalKind.optional(),
  headingName: z.string().max(80).nullable().optional(),
  actionNumber: z.number().int().min(1).nullable().optional(),
  struck: z.boolean().optional(),
})

export const ActionImportBody = z.discriminatedUnion('op', [
  z.object({ op: z.literal('start'), sourceNumber: z.number().int().min(1) }),
  z.object({ op: z.literal('advance'), passId: z.string().min(1) }),
  // 26-S2 §10.3 — after the automatic split, a part that still fails waits for this; every part already read is kept.
  z.object({ op: z.literal('retryPart'), passId: z.string().min(1), chunkIndex: z.number().int().min(0) }),
  z.object({
    op: z.literal('edit'), passId: z.string().min(1),
    items: z.array(z.object({ itemId: z.string().min(1), patch: ItemPatch })).max(300).optional(),
    existing: z.array(z.object({ actionId: z.string().min(1), proposedHeading: z.string().max(80).nullable() })).max(300).optional(),
    headings: z.array(z.object({ name: z.string().min(1).max(80), purpose: z.string().max(1200).optional(), struck: z.boolean().optional() })).max(40).optional(),
  }),
  z.object({ op: z.literal('confirm'), passId: z.string().min(1) }),
  z.object({ op: z.literal('discard'), passId: z.string().min(1) }),
])

export type ActionImportRequest = z.input<typeof ActionImportBody>
export type ActionImportOp = ActionImportRequest['op']

// The words live in `action-import-types.ts` (no imports), so the panel can use them WITHOUT pulling zod into the browser bundle.
export { IMPORT_OP_WORDS, IMPORT_INPUT_WORDS } from './action-import-types'
