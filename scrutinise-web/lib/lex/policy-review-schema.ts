// THE REQUEST CONTRACT OF /api/ideas/[id]/policy-review — read by the route, typed into the panel with `import type` (docs/CLAUDE.md §30).
import { z } from 'zod'

const reason = z.string().max(600)

export const PolicyReviewBody = z.discriminatedUnion('op', [
  z.object({ op: z.literal('accept'), evidenceId: z.string().min(1) }),
  z.object({ op: z.literal('dismiss'), evidenceId: z.string().min(1), reason }),
  z.object({ op: z.literal('setAside'), evidenceId: z.string().min(1), reason }),
  z.object({ op: z.literal('restore'), evidenceId: z.string().min(1) }),
  z.object({ op: z.literal('noteAccept'), noteId: z.string().min(1) }),
  z.object({ op: z.literal('noteNotOnPolicy'), noteId: z.string().min(1), reason }),
  z.object({ op: z.literal('noteSetAside'), noteId: z.string().min(1), reason }),
  z.object({ op: z.literal('noteRestore'), noteId: z.string().min(1) }),
])

export type PolicyReviewRequest = z.input<typeof PolicyReviewBody>
export type PolicyReviewOp = PolicyReviewRequest['op']

export const REVIEW_OP_WORDS: Record<PolicyReviewOp, string> = {
  accept: '“Accept”', dismiss: '“Dismiss”', setAside: '“Set aside”', restore: '“Bring back”',
  noteAccept: '“Put in the record”', noteNotOnPolicy: '“Does not bear on the policy”', noteSetAside: '“Set aside”', noteRestore: '“Bring back”',
}
export const REVIEW_INPUT_WORDS: Record<string, string> = { evidenceId: 'the proposal', noteId: 'the note', reason: 'the reason', op: 'the control' }
