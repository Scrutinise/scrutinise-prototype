import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

// GET /api/admin/ideas/search?q=[title or id]
// Auth: ADMIN or SUPER_ADMIN. Returns max 5 results.
export async function GET(req: Request) {
  const { error, user: authUser } = await getAuthenticatedUser()
  if (error) return error

  if (!['ADMIN', 'SUPER_ADMIN'].includes(authUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''
  if (!q) return NextResponse.json([])

  const ideas = await prisma.idea.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { id: q },
      ],
    },
    select: {
      id: true,
      title: true,
      creator: { select: { id: true, name: true, email: true } },
    },
    take: 5,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(ideas)
}
