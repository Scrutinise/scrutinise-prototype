// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-K — the update pass over accumulated new material.
//
// GET  → how many items are pending since the last comparison, and when that last ran
//        (§4c: "the offer accumulates... 3 new items since your last comparison").
// POST → run the comparison over ALL pending material in one pass (§4c: "one pass over
//        all of them", never one per upload — extraction already ran automatically when
//        each document was added; this is only the comparison, and it is offered, not run).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { authorizeIdea } from '@/lib/lex/authz'
import { pendingMaterialSince, runUpdatePass, listProposedChanges, recentNewPolicyOptions } from '@/lib/lex/update-pass'

export const maxDuration = 120

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error

  const [pending, proposedChanges, newPolicyOptions] = await Promise.all([
    pendingMaterialSince(id),
    listProposedChanges(id),
    recentNewPolicyOptions(id),
  ])
  return NextResponse.json({ ...pending, proposedChanges, newPolicyOptions })
}

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const { user } = authz

  const pending = await pendingMaterialSince(id)
  if (!pending.count) {
    return NextResponse.json({ error: 'There is nothing new to compare since the last run.' }, { status: 409 })
  }

  const result = await runUpdatePass(id, user?.id ?? null, { materialIds: pending.materialIds })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 })
  return NextResponse.json(result)
}
