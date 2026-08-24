import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { CommunityRuleError } from '@/lib/community'
import { reverseActivityClaim } from '@/lib/central-points'

type Params = { params: Promise<{ id: string; claimId: string }> }

const ReverseSchema = z.object({ reason: z.string().min(1).max(1000) })

// PATCH /api/communities/[id]/claims/[claimId]
//
// ⚠ STAGE 2e: THIS NO LONGER APPROVES ANYTHING. Pre-approval is gone — a claim
// pays on submission — so the only decision left for a manager is to REVERSE
// one, and that needs a stated reason. Authorisation is checked inside
// reverseActivityClaim against the CLAIM's own node, not the [id] in the URL,
// so a claim from one branch cannot be acted on by aiming this route at another
// node the caller happens to manage.
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

  const parsed = ReverseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'A reversal needs a reason — the claimant is told what it says.' },
      { status: 422 },
    )
  }

  try {
    return NextResponse.json(await reverseActivityClaim(claimId, user.id, parsed.data.reason))
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
