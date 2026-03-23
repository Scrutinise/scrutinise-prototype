import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

const GroupSchema = z.object({
  groupType: z.enum(['MY_TEAM', 'COMMUNICATIONS', 'POLICY_DEVELOPMENT']),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
})

// GET /api/ideas/[id]/groups
// Returns groups for the idea. Owner and collaborators only.
export async function GET(_req: Request, { params }: Params) {
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id: ideaId } = await params

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  })
  if (!dbUser) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: { id: true, creatorId: true },
  })
  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOwner = idea.creatorId === dbUser.id
  if (!isOwner) {
    const collab = await prisma.ideaCollaborator.findFirst({
      where: { ideaId, userId: dbUser.id },
      select: { id: true },
    })
    if (!collab) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const groups = await prisma.group.findMany({
    where: { ideaId },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, username: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ groups })
}

// POST /api/ideas/[id]/groups
// Creates a group for the idea. Owner only.
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: ideaId } = await params

  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: { id: true, creatorId: true },
  })

  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (idea.creatorId !== user.id) {
    return NextResponse.json({ error: 'Only the owner can create groups' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = GroupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { groupType, name, description } = parsed.data

  // Generate a simple unique invite code
  const inviteCode = `${ideaId.slice(0, 8)}-${groupType.toLowerCase()}-${Date.now().toString(36)}`

  const group = await prisma.group.create({
    data: {
      ownerId: user.id,
      ideaId,
      groupType,
      name,
      description,
      inviteCode,
    },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, username: true } },
        },
      },
    },
  })

  return NextResponse.json(group, { status: 201 })
}
