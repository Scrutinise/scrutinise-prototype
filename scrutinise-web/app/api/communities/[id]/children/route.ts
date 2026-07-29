import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { requireCommunityRole } from '@/lib/community'

type Params = { params: Promise<{ id: string }> }

const CreateBranchSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
})

// POST /api/communities/[id]/children
// Create a branch (child Community) beneath [id]. OWNER/ADMIN of [id] only.
// The creator does NOT automatically become a member of the new branch —
// branch membership is separate from parent membership by design (no implicit
// cross-node access, mirrors the no-permission-crossover rule at the Idea
// boundary). The creator is added as OWNER of the branch they just made, since
// otherwise no one could manage it.
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: parentId } = await params

  const roleCheck = await requireCommunityRole(user.id, parentId)
  if (roleCheck.error) return roleCheck.error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateBranchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { name, description } = parsed.data

  const branch = await prisma.$transaction(async (tx) => {
    const created = await tx.community.create({
      data: { name, description, parentCommunityId: parentId },
    })
    await tx.communityMember.create({
      data: { communityId: created.id, userId: user.id, role: 'OWNER' },
    })
    return created
  })

  return NextResponse.json({ community: branch }, { status: 201 })
}
