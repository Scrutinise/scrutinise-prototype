import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { CommunityRuleError } from '@/lib/community'
import { decideActivityClaim } from '@/lib/central-points'

type Params = { params: Promise<{ id: string; claimId: string }> }

const DecisionSchema = z.object({ decision: z.enum(['APPROVED', 'DECLINED']) })

// PATCH /api/communities/[id]/claims/[claimId]
// Approve (pays the tariff) or decline (pays nothing). Both are written into the
// Community activity log. Authorisation is checked inside decideActivityClaim
// against the CLAIM's own node, not the [id] in the URL, so a claim from one
// branch cannot be decided by aiming this route at another node the caller
// happens to manage.
export async function PATCH(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { claimId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = DecisionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  try {
    return NextResponse.json(await decideActivityClaim(claimId, user.id, parsed.data.decision))
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
