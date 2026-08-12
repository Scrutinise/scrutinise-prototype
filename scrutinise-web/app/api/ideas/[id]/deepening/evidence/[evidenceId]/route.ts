// PATCH /api/ideas/[id]/deepening/evidence/[evidenceId] — the user's judgment on one finding.
//
// ⚠ ACCEPTING A FINDING DOES NOT WRITE THE FIELD IT REFERENCES. It flips this row to
// ACCEPTED, and the field card then renders it as read-only evidence beneath the value.
// Changing what the field SAYS goes through the normal save path (proposal →
// AWAITING_CONFIRMATION → the user's Save). `check:deepening` asserts that this route
// never touches a canonical field, because "accept" is exactly the verb that invites it.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIdea } from '@/lib/lex/authz'
import { setEvidenceStatus } from '@/lib/lex/deepening'

type Params = { params: Promise<{ id: string; evidenceId: string }> }

const BodySchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED']),
  /** Optional — why it was rejected. Never required: rejecting is normal and needs no defence. */
  note: z.string().max(2000).optional(),
})

export async function PATCH(req: Request, { params }: Params) {
  const { id, evidenceId } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const updated = await setEvidenceStatus(id, evidenceId, parsed.data.status, parsed.data.note)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}
