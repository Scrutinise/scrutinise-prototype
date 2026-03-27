import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

// GET /api/admin/users/search?q=[email or username]
// Auth: ADMIN or SUPER_ADMIN. Returns max 5 results.
// Excludes isHistoricalAccount users — cannot transfer TO a seed account.
export async function GET(req: Request) {
  const { error, user: authUser } = await getAuthenticatedUser()
  if (error) return error

  if (!['ADMIN', 'SUPER_ADMIN'].includes(authUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''
  if (!q) return NextResponse.json([])

  const users = await prisma.user.findMany({
    where: {
      isHistoricalAccount: false,
      OR: [
        { email: { contains: q, mode: 'insensitive' } },
        { username: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, email: true, username: true },
    take: 5,
    orderBy: { joinDate: 'desc' },
  })

  return NextResponse.json(users)
}
