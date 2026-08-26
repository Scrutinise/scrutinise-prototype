import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import {
  CommunityRuleError,
  createCommunityInvite,
  requireCommunityAdmin,
} from '@/lib/community'

type Params = { params: Promise<{ id: string }> }

const CreateInviteSchema = z.object({
  // Invite a specific existing account. Their address is resolved server-side
  // so the panel never has to see (or send back) somebody's email.
  userId: z.string().min(1).optional(),
  email: z.string().email().optional(),
  maxUses: z.number().int().min(1).max(10_000).default(1),
  expiresInDays: z.number().int().min(1).max(365).optional(),
})

// GET /api/communities/[id]/invites
// List invite codes for this community. OWNER/ADMIN only.
export async function GET(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId } = await params

  const denied = await requireCommunityAdmin(user.id, communityId)
  if (denied) return denied

  const invites = await prisma.communityInvite.findMany({
    where: { communityId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ invites })
}

// POST /api/communities/[id]/invites
//
// A thin wrapper. The work is `createCommunityInvite` in lib/community.ts, where
// a check can reach it without a Clerk session — see the note there.
//
// ⚠ EVERY FAILURE RESPONSE FROM THIS ROUTE CARRIES A PLAIN STRING `error`.
//   It used to return `parsed.error.flatten()` — an OBJECT — for a validation
//   failure, which the invite panel could not render, so it fell back to a
//   generic "Could not create the invite" that named nothing. A caller that
//   cannot tell you what went wrong is how a diagnosable fault becomes an
//   undiagnosable one.
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId } = await params

  const denied = await requireCommunityAdmin(user.id, communityId)
  if (denied) return denied

  let body: unknown
  try {
    body = await req.json()
  } catch {
    // Empty body is fine — every field is optional/defaulted.
    body = {}
  }

  const parsed = CreateInviteSchema.safeParse(body)
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
      .join('; ')
    return NextResponse.json(
      { error: `That invite could not be read — ${detail}` },
      { status: 422 },
    )
  }

  try {
    const issued = await createCommunityInvite({
      communityId,
      createdByUserId: user.id,
      createdByName: user.name,
      ...parsed.data,
    })
    return NextResponse.json(issued, { status: 201 })
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    // Anything else is a real fault. Say what it was rather than returning a
    // shape the caller has to guess at — the panel prints this verbatim.
    console.error('[invites] createCommunityInvite failed', e)
    return NextResponse.json(
      { error: `The invite could not be created — ${e instanceof Error ? e.message : 'unknown server error'}` },
      { status: 500 },
    )
  }
}
