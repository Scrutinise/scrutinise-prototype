import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

const AlertSchema = z.object({
  alertType: z.enum(['VOTE_OPEN', 'STAGE_CHANGE']),
})

// POST /api/ideas/[id]/alerts
// Upserts an IdeaAlert. Available at Stage 2+.
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: ideaId } = await params

  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: { id: true, stage: true },
  })

  if (!idea) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const allowedStages = ['STAGE_2', 'STAGE_3', 'STAGE_4', 'STAGE_5']
  if (!allowedStages.includes(idea.stage)) {
    return NextResponse.json(
      { error: 'Alerts are available at Stage 2 and above' },
      { status: 422 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = AlertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { alertType } = parsed.data

  const alert = await prisma.ideaAlert.upsert({
    where: {
      userId_ideaId_alertType: { userId: user.id, ideaId, alertType },
    },
    update: {},
    create: { userId: user.id, ideaId, alertType },
    select: { id: true, alertType: true },
  })

  return NextResponse.json(alert)
}
