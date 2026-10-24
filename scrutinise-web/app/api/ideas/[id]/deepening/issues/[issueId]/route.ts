// PATCH /api/ideas/[id]/deepening/issues/[issueId] — triage one issue.
//
// address · defer · dismiss (reason REQUIRED) · reopen.
//
// ⚠ The dismissal reason is enforced at the API, not only in the form. A dismissal
// without a stated reason is an unaccountable veto, and a dismissed issue stays VISIBLE
// with its reason attached — what was considered and set aside is a strength, so it is
// never deleted and never hidden.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIdea } from '@/lib/lex/authz'
import { enterSpendFor } from '@/lib/lex/build-context'
import { triageIssue, DismissalNeedsAReason } from '@/lib/lex/deepening'
import { describeIssues } from '@/lib/api-rejection'
import { LIMITS } from '@/lib/lex/input-limits'

type Params = { params: Promise<{ id: string; issueId: string }> }

const BodySchema = z.object({
  action: z.enum(['address', 'defer', 'dismiss', 'reopen']),
  // 26-V2d: the numbers live in LIMITS, which the Risks view's counters read too (§30.1)
  note: z.string().max(LIMITS.issueNote).optional(),
  reason: z.string().max(LIMITS.issueDismissReason).optional(),
  /** An EvidenceItem the resolution rests on, when the user attaches one. */
  evidenceId: z.string().optional(),
})

export async function PATCH(req: Request, { params }: Params) {
  const { id, issueId } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  enterSpendFor(authz.user, authz.idea) // cost dashboard: attribute this request's spend

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    const { message, rejected } = describeIssues(parsed.error.issues, { action: 'Answering that issue', labels: { action: 'the answer', note: 'how it was dealt with', reason: 'the reason for dismissing it', evidenceId: 'the evidence' } })
    return NextResponse.json({ error: message, rejected }, { status: 422 })
  }

  try {
    const updated = await triageIssue(id, issueId, parsed.data.action, {
      note: parsed.data.note, reason: parsed.data.reason, evidenceId: parsed.data.evidenceId,
    })
    if (!updated) return NextResponse.json({ error: 'That issue is not on this idea, so nothing was changed.' }, { status: 404 })
    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof DismissalNeedsAReason) {
      return NextResponse.json({ error: 'Not dismissed: dismissing an issue needs a reason, and it stays on the record. Nothing was changed.' }, { status: 422 })
    }
    throw err
  }
}
