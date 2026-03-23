import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { checkStage2to3Gate, advanceStage2to3, checkStage3to4Gate, advanceStage3to4 } from '@/lib/stage-gates'

type Params = { params: Promise<{ id: string }> }

const ProgressSchema = z.object({
  toStage: z.enum(['STAGE_3', 'STAGE_4', 'STAGE_5']),
})

// POST /api/ideas/[id]/progress — manually advance to next stage
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id } = await params

  const idea = await prisma.idea.findUnique({ where: { id } })

  if (!idea) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (idea.creatorId !== user.id) {
    return NextResponse.json({ error: 'Forbidden — only the owner can advance an idea' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ProgressSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { toStage } = parsed.data

  // Stage 2 → 3
  if (idea.stage === 'STAGE_2' && toStage === 'STAGE_3') {
    const gateError = await checkStage2to3Gate(id)
    if (gateError) {
      return NextResponse.json({ error: gateError, blocked: true }, { status: 422 })
    }
    await advanceStage2to3(id, user.id)
    return NextResponse.json({ stage: 'STAGE_3' })
  }

  // Stage 3 → 4
  if (idea.stage === 'STAGE_3' && toStage === 'STAGE_4') {
    const gateError = await checkStage3to4Gate(id)
    if (gateError) {
      return NextResponse.json({ error: gateError, blocked: true }, { status: 422 })
    }
    await advanceStage3to4(id, user.id)
    return NextResponse.json({ stage: 'STAGE_4' })
  }

  return NextResponse.json(
    { error: `Cannot advance from ${idea.stage} to ${toStage}` },
    { status: 422 }
  )
}
