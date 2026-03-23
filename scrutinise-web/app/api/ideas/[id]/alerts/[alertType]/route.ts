import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string; alertType: string }> }

const AlertTypeSchema = z.enum(['VOTE_OPEN', 'STAGE_CHANGE'])

// DELETE /api/ideas/[id]/alerts/[alertType]
// Removes an IdeaAlert for the current user.
export async function DELETE(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: ideaId, alertType: rawAlertType } = await params

  const parsed = AlertTypeSchema.safeParse(rawAlertType)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid alertType' }, { status: 422 })
  }

  const alertType = parsed.data

  await prisma.ideaAlert.deleteMany({
    where: { userId: user.id, ideaId, alertType },
  })

  return new NextResponse(null, { status: 204 })
}
