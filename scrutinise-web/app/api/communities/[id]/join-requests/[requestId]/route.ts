import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { CommunityRuleError, decideJoinRequest } from '@/lib/community'

type Params = { params: Promise<{ id: string; requestId: string }> }

const DecisionSchema = z.object({ decision: z.enum(['APPROVED', 'DECLINED']) })

// PATCH /api/communities/[id]/join-requests/[requestId]
// Approve or decline. Authorisation is checked inside decideJoinRequest against
// the REQUEST's own node, so a request id from another branch cannot be decided
// by pointing this route at a node the caller happens to manage.
export async function PATCH(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { requestId } = await params

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
    const request = await decideJoinRequest(requestId, user.id, parsed.data.decision)
    return NextResponse.json({ request })
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
