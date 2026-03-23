import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ userId: string }> }

const PatchSchema = z.object({
  role: z.enum(['CITIZEN', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN']),
})

// PATCH /api/admin/users/[userId]/role
// SUPER_ADMIN can set any role. ADMIN can set CITIZEN or MODERATOR only.
export async function PATCH(req: Request, { params }: Params) {
  const { error, user: authUser } = await getAuthenticatedUser()
  if (error) return error

  if (!['ADMIN', 'SUPER_ADMIN'].includes(authUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { role } = parsed.data

  // ADMIN can only assign CITIZEN or MODERATOR
  if (authUser.role === 'ADMIN' && !['CITIZEN', 'MODERATOR'].includes(role)) {
    return NextResponse.json(
      { error: 'Admins can only assign CITIZEN or MODERATOR roles' },
      { status: 403 },
    )
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  })

  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Log the role change
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { role },
    }),
    prisma.activityLog.create({
      data: {
        userId: authUser.id,
        activityType: 'ROLE_CHANGE',
        entityType: 'User',
        entityId: userId,
        description: `Role changed from ${target.role} to ${role}`,
        accessType: 'ADMIN_ACCESS',
        accessedByUserId: authUser.id,
      },
    }),
  ])

  return NextResponse.json({ success: true, role })
}
