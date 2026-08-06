import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { CommunityRuleError, leaveCommunity } from '@/lib/community'

type Params = { params: Promise<{ id: string }> }

// POST /api/communities/[id]/leave
// Always self-serve — nobody needs permission to leave. The rules (an OWNER
// must hand over first; leaving the root leaves the whole Community) live in
// leaveCommunity().
export async function POST(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId } = await params

  try {
    const result = await leaveCommunity(user.id, communityId)
    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
