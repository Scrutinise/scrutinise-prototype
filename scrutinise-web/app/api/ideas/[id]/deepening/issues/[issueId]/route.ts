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
import { triageIssue, DismissalNeedsAReason } from '@/lib/lex/deepening'

type Params = { params: Promise<{ id: string; issueId: string }> }

const BodySchema = z.object({
  action: z.enum(['address', 'defer', 'dismiss', 'reopen']),
  note: z.string().max(4000).optional(),
  reason: z.string().max(2000).optional(),
  /** An EvidenceItem the resolution rests on, when the user attaches one. */
  evidenceId: z.string().optional(),
})

export async function PATCH(req: Request, { params }: Params) {
  const { id, issueId } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  try {
    const updated = await triageIssue(id, issueId, parsed.data.action, {
      note: parsed.data.note, reason: parsed.data.reason, evidenceId: parsed.data.evidenceId,
    })
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof DismissalNeedsAReason) {
      return NextResponse.json({ error: 'Dismissing an issue requires a reason' }, { status: 422 })
    }
    throw err
  }
}
