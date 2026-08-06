import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { requireCommunityRole, findBoardPost, applyBulletinVote } from '@/lib/community'
import { checkRateLimit } from '@/lib/rateLimit'

type Params = { params: Promise<{ id: string; postId: string }> }

const ALL_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const

const VoteSchema = z.object({ value: z.union([z.literal(1), z.literal(-1)]) })

// POST /api/communities/[id]/bulletin/[postId]/vote
// Upvote/downvote a thread or reply. Voting the same value again toggles the
// vote off. 20/hr per IP (CLAUDE.md security rule #7 — same limit as the
// site-wide vote rule, mirroring app/api/ai/public/route.ts's IP-keyed limiter
// since app/api/ideas/[id]/vote/route.ts doesn't actually enforce it today).
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId, postId } = await params

  const roleCheck = await requireCommunityRole(user.id, communityId, [...ALL_ROLES])
  if (roleCheck.error) return roleCheck.error

  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
  if (!checkRateLimit(`bulletin-vote:${ip}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = VoteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  // Reachable from this board: this node's own posts and replies, plus
  // Community-wide posts from elsewhere in the same tree.
  const post = await findBoardPost(postId, communityId)
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(await applyBulletinVote(postId, user.id, parsed.data.value))
}
