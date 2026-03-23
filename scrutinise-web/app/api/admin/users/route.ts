import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

// GET /api/admin/users
// Paginated user list. Admin+.
export async function GET(req: Request) {
  const { error, user: authUser } = await getAuthenticatedUser()
  if (error) return error

  if (!['ADMIN', 'SUPER_ADMIN'].includes(authUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const parsed = QuerySchema.safeParse({
    page: url.searchParams.get('page'),
    limit: url.searchParams.get('limit'),
  })

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { page, limit } = parsed.data
  const skip = (page - 1) * limit

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip,
      take: limit,
      orderBy: { joinDate: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        joinDate: true,
        credibilityScore: { select: { totalScore: true } },
        _count: { select: { ideas: true } },
      },
    }),
    prisma.user.count(),
  ])

  const result = users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    joinDate: u.joinDate.toISOString(),
    credibilityScore: u.credibilityScore?.totalScore?.toString() ?? null,
    ideaCount: u._count.ideas,
  }))

  return NextResponse.json({
    users: result,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  })
}
