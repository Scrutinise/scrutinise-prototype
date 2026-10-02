// ─────────────────────────────────────────────────────────────────────────────
// 26-M ADDENDUM — what the consolidation added to the Coherent Actions candidate list.
//
// GET   → the actions it added (verdict against the final policy, one-line reason, which draft /
//         comment / parked action each came from), and how many ideas are still held.
// PATCH → { op: 'remove', id }   take one added action back out of the list
//         { op: 'test' }         run the step again against the settled policy — the retry when the
//                                one at acceptance did not complete
//
// ⚠ Nothing here confirms an action: they are CANDIDATES in the list the user is already reviewing,
// and "These are my actions" is the user's own, separate act.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIdea } from '@/lib/lex/authz'
import { enterSpendFor } from '@/lib/lex/build-context'
import { prisma } from '@/lib/prisma'
import { listAddedActions, removeAddedAction, testHeldActions } from '@/lib/lex/action-ideas'

export const maxDuration = 120

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  return NextResponse.json(await listAddedActions(id))
}

const PatchSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('remove'), id: z.string().min(1) }),
  z.object({ op: z.literal('test') }),
])

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  enterSpendFor(authz.user, authz.idea) // cost dashboard: attribute this request's spend

  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 422 })
  const body = parsed.data

  if (body.op === 'test') {
    const settled = await prisma.policyOption.findFirst({ where: { ideaId: id, status: 'CHOSEN' }, select: { id: true } })
    if (!settled) return NextResponse.json({ error: 'There is no settled guiding policy to test against yet.' }, { status: 409 })
    // The latest consolidation's comments are read too, so a retry after a failure loses none of them.
    const latest = await prisma.guidingPolicyConsolidation.findFirst({ where: { ideaId: id }, orderBy: { createdAt: 'desc' }, select: { id: true } })
    const summary = await testHeldActions(id, settled.id, authz.user?.id ?? null, { consolidationId: latest?.id })
    if (!summary.ok) return NextResponse.json({ error: summary.error, summary }, { status: 502 })
    return NextResponse.json({ summary, ...(await listAddedActions(id)) })
  }

  const result = await removeAddedAction(id, body.id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 })
  return NextResponse.json({ ok: true, ...(await listAddedActions(id)) })
}
