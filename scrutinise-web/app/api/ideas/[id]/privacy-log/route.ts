import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

function formatAccessorName(firstName: string, lastName: string): string {
  const lastInitial = lastName ? lastName.charAt(0).toUpperCase() + '.' : ''
  return [firstName, lastInitial].filter(Boolean).join(' ')
}

// GET /api/ideas/[id]/privacy-log
// Owner-only. Returns ActivityLog records where accessType=ADMIN_ACCESS for this idea.
export async function GET(_req: Request, { params }: Params) {
  const { error, user: authUser } = await getAuthenticatedUser()
  if (error) return error

  const { id: ideaId } = await params

  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: { creatorId: true },
  })

  if (!idea) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (idea.creatorId !== authUser.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const logs = await prisma.activityLog.findMany({
    where: { ideaId, accessType: 'ADMIN_ACCESS' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      accessReason: true,
      createdAt: true,
      accessedBy: {
        select: { firstName: true, lastName: true },
      },
    },
  })

  const result = logs.map(log => ({
    id: log.id,
    accessorName: log.accessedBy
      ? formatAccessorName(log.accessedBy.firstName, log.accessedBy.lastName)
      : 'A team member',
    accessReason: log.accessReason ?? null,
    createdAt: log.createdAt.toISOString(),
  }))

  return NextResponse.json(result)
}
