import { NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { requireCommunityRole } from '@/lib/community'

type Params = { params: Promise<{ id: string }> }

const CreateInviteSchema = z.object({
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

  const roleCheck = await requireCommunityRole(user.id, communityId)
  if (roleCheck.error) return roleCheck.error

  const invites = await prisma.communityInvite.findMany({
    where: { communityId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ invites })
}

// POST /api/communities/[id]/invites
// Generate an invite code. OWNER/ADMIN only.
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId } = await params

  const roleCheck = await requireCommunityRole(user.id, communityId)
  if (roleCheck.error) return roleCheck.error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    // Empty body is fine — every field is optional/defaulted.
    body = {}
  }

  const parsed = CreateInviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { email, maxUses, expiresInDays } = parsed.data

  const invite = await prisma.communityInvite.create({
    data: {
      communityId,
      inviteCode: crypto.randomBytes(16).toString('hex'),
      email,
      maxUses,
      expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : undefined,
      createdByUserId: user.id,
    },
  })

  return NextResponse.json({ invite }, { status: 201 })
}
