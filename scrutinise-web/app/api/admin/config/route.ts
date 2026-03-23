import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

const ConfigUpdateSchema = z.object({
  credibilityWeightingActive: z.boolean().optional(),
  peerReviewRequired: z.boolean().optional(),
  minReviewersForStage4: z.number().int().min(1).optional(),
  minRatingForStage4: z.number().min(0).max(5).optional(),
})

// GET /api/admin/config — Admin+
export async function GET(_req: Request) {
  const { error, user: authUser } = await getAuthenticatedUser()
  if (error) return error

  if (!['ADMIN', 'SUPER_ADMIN'].includes(authUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const configs = await prisma.platformConfig.findMany({
    where: {
      key: {
        in: [
          'credibilityWeightingActive',
          'peerReviewRequired',
          'minReviewersForStage4',
          'minRatingForStage4',
        ],
      },
    },
  })

  const result: Record<string, unknown> = {}
  for (const c of configs) {
    result[c.key] = c.value
  }

  return NextResponse.json(result)
}

// PATCH /api/admin/config — SUPER_ADMIN only
export async function PATCH(req: Request) {
  const { error, user: authUser } = await getAuthenticatedUser()
  if (error) return error

  if (authUser.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden — SUPER_ADMIN only' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ConfigUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const updates = Object.entries(parsed.data).filter(([, v]) => v !== undefined)

  if (updates.length === 0) {
    return NextResponse.json({ error: 'No fields provided' }, { status: 400 })
  }

  await prisma.$transaction([
    ...updates.map(([key, value]) =>
      prisma.platformConfig.upsert({
        where: { key },
        update: { value: value as boolean | number, updatedByUserId: authUser.id },
        create: { key, value: value as boolean | number, updatedByUserId: authUser.id },
      }),
    ),
    prisma.activityLog.create({
      data: {
        userId: authUser.id,
        activityType: 'CONFIG_UPDATE',
        description: `Platform config updated: ${updates.map(([k]) => k).join(', ')}`,
        metadata: Object.fromEntries(updates),
        accessType: 'ADMIN_ACCESS',
        accessedByUserId: authUser.id,
      },
    }),
  ])

  return NextResponse.json({ success: true })
}
