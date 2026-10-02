// ─────────────────────────────────────────────────────────────────────────────
// 26-N §8 — CHECK FOR GAPS (lib/lex/gap-check.ts).
//
// GET   → the free gaps (computed live, no model), the suggestions waiting, the last check's cost.
// POST  → run one check: free gaps, then four models, then one test call. Reports its cost.
// PATCH → { op: 'accept' | 'dismiss', id }  one suggestion
//
// ⚠ Nothing is accepted automatically: accept is the only thing here that writes a `LexCoherentAction`.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIdea } from '@/lib/lex/authz'
import { enterSpendFor } from '@/lib/lex/build-context'
import { assertWritableField } from '@/lib/lex/stage'
import { listGapSuggestions, runGapCheck, acceptGapSuggestion, dismissGapSuggestion } from '@/lib/lex/gap-check'

/** Four premium models in parallel (up to 150s) and then one test call (up to 90s). */
export const maxDuration = 300

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  return NextResponse.json(await listGapSuggestions(id))
}

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  enterSpendFor(authz.user, authz.idea) // cost dashboard: attribute this request's spend

  const result = await runGapCheck(id, authz.user?.id ?? null)
  // A refusal (one already running, no settled policy) is a 409 with its reason; a check that ran is a 200
  // whatever it found, with the cost in the body.
  if (!result.ok) return NextResponse.json({ error: result.error, result, ...(await listGapSuggestions(id)) }, { status: result.models.length ? 502 : 409 })
  return NextResponse.json({ result, ...(await listGapSuggestions(id)) })
}

const PatchSchema = z.object({ op: z.enum(['accept', 'dismiss']), id: z.string().min(1) })

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error

  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 422 })
  const body = parsed.data

  if (body.op === 'accept') {
    // Same write guard as the actions loop: nothing lands on a page the user has not reached.
    const blocked = await assertWritableField(id, 'actions')
    if (blocked) return NextResponse.json({ error: 'You haven’t started the Coherent Actions yet.' }, { status: 409 })
  }
  const out = body.op === 'accept' ? await acceptGapSuggestion(id, body.id) : await dismissGapSuggestion(id, body.id)
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 409 })
  return NextResponse.json({ ok: true, ...(await listGapSuggestions(id)) })
}
