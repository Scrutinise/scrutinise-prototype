// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-K §4a/§4b — the user's judgment on one proposed change.
//
// ⚠ A SEPARATE ROUTE FROM THE GENERIC DEEPENING EVIDENCE ONE
// (`app/api/ideas/[id]/deepening/evidence/[evidenceId]/route.ts`), because the side
// effects genuinely differ: accepting a CONTRADICTS finding here marks dependants stale
// (§4b), and accepting a NEW_CAUSE creates the cause now, on acceptance, which the generic
// route's own contract explicitly forbids ("never touches a canonical field" — a cause is a
// child-entity table, not a canonical field, but the generic route still has no reason to
// know about this pass's five categories). One route, one job, rather than teaching the
// generic one a switch on `kind`.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIdea } from '@/lib/lex/authz'
import { judgeUpdateItem, dismissNewPolicyOption } from '@/lib/lex/update-pass'

type Params = { params: Promise<{ id: string; evidenceId: string }> }

const BodySchema = z.object({
  decision: z.enum(['ACCEPTED', 'REJECTED']),
  note: z.string().max(2000).optional(),
  /** True only for a NEW_POLICY_OPTION row — it is already live in the sort (§4a: "no
   *  separate path"), so "reject" here means rule it out, through the one existing rule-out
   *  implementation, never a second delete. */
  isPolicyOption: z.boolean().optional(),
})

export async function PATCH(req: Request, { params }: Params) {
  const { id, evidenceId } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 422 })
  const { decision, note, isPolicyOption } = parsed.data

  if (isPolicyOption && decision === 'REJECTED') {
    const result = await dismissNewPolicyOption(id, evidenceId, note ?? '')
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 })
    return NextResponse.json(result)
  }

  const result = await judgeUpdateItem(id, evidenceId, decision, note)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 })
  return NextResponse.json(result)
}
