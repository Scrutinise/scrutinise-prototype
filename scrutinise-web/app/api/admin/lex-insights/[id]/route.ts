import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

const PatchSchema = z.object({
  status: z.enum(['DRAFT', 'APPROVED', 'REJECTED']),
  approvedRule: z.string().optional(),
})

// PATCH /api/admin/lex-insights/[id]
// Update status and/or approvedRule for a LexInsight record.
// Auth: ADMIN or SUPER_ADMIN only.
export async function PATCH(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

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

  const { status, approvedRule } = parsed.data

  const insight = await prisma.lexInsight.findUnique({ where: { id } })
  if (!insight) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const updated = await prisma.lexInsight.update({
    where: { id },
    data: {
      status,
      ...(approvedRule !== undefined ? { approvedRule } : {}),
      reviewedByUserId: user.id,
      reviewedAt: new Date(),
    },
  })

  return NextResponse.json(updated)
}
