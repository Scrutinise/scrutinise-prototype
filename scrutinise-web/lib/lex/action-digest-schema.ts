// ─────────────────────────────────────────────────────────────────────────────
// THE REQUEST CONTRACT OF /api/ideas/[id]/action-digest — ONE DEFINITION, READ BY THE ROUTE AND TYPED INTO THE PANEL.
// Same reason as action-import-schema.ts (docs/CLAUDE.md §30): the client types every call against this with `import type` (erased, no zod
// in the bundle), so a wrong key is a compile error, and the route words any rejection.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod'

export const ActionDigestBody = z.discriminatedUnion('op', [
  // scope HEADING needs the heading; scope SET takes none. ONE `start` member (a discriminated union cannot hold two with the same `op`).
  z.object({ op: z.literal('start'), scope: z.enum(['HEADING', 'SET']), headingId: z.string().min(1).optional() })
    .superRefine((v, ctx) => { if (v.scope === 'HEADING' && !v.headingId) ctx.addIssue({ code: 'custom', path: ['headingId'], message: 'was missing: a digest of a heading needs the heading' }) }),
  z.object({ op: z.literal('advance'), digestId: z.string().min(1) }),
  z.object({ op: z.literal('retry'), digestId: z.string().min(1) }),
  // the gaps the judge named become SUGGESTIONS (never actions) - all not yet added, or the one at `index`
  z.object({ op: z.literal('suggestGaps'), digestId: z.string().min(1), index: z.number().int().min(0).max(200).optional() }),
])

export type ActionDigestRequest = z.input<typeof ActionDigestBody>
export type ActionDigestOp = ActionDigestRequest['op']

// The words live in `action-digest-types.ts` (no imports), so the panel can use them WITHOUT pulling zod into the browser bundle.
export { DIGEST_OP_WORDS, DIGEST_INPUT_WORDS } from './action-digest-types'
