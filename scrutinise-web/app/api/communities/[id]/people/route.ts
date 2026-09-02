import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { requireCommunityAdmin } from '@/lib/community'
import { listCommunityPeople } from '@/lib/community-invitations'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/communities/[id]/people
 *
 * CENTRAL 25-A §2 — everyone this node has invited, everyone who arrived
 * through one of its links, and what each of them is now. Manage rights, the
 * same gate as the Members and Requests panels: an invitation list is a
 * management surface.
 *
 * ⚠ It returns what `listCommunityPeople` computes and adds nothing of its own,
 * so the page, the check and this route are all reading one derivation of the
 * statuses rather than three (docs/CLAUDE.md §25.3).
 */
export async function GET(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId } = await params

  const denied = await requireCommunityAdmin(user.id, communityId)
  if (denied) return denied

  return NextResponse.json(await listCommunityPeople(communityId))
}
