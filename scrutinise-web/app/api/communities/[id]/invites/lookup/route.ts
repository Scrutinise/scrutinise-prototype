import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { lookupInviteCandidates } from '@/lib/community'
import { requireInviteCreateRight } from '@/lib/community-permissions'

type Params = { params: Promise<{ id: string }> }

const QuerySchema = z.object({ q: z.string().min(2).max(200) })

// GET /api/communities/[id]/invites/lookup?q=
// Person lookup for the Community invite panel. OWNER/ADMIN only.
// Matching rules and why they are what they are: lookupInviteCandidates().
export async function GET(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId } = await params

  // ⚠ 25-C §1d — the lookup offers the address the CREATE will use, so it
  // follows the create gate. Offering a name the next call refuses is how the
  // zero-width-space bug in ../route.ts happened.
  const denied = await requireInviteCreateRight(user.id, communityId)
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const parsed = QuerySchema.safeParse({ q: searchParams.get('q') ?? '' })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Query parameter q must be at least 2 characters' }, { status: 422 })
  }

  return NextResponse.json(await lookupInviteCandidates(communityId, parsed.data.q.trim()))
}
