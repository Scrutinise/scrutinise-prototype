import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string; endorsementId: string }> }

// DELETE /api/ideas/[id]/endorsements/[endorsementId]
// Withdraws an endorsement. Only the endorser can withdraw their own.
export async function DELETE(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: ideaId, endorsementId } = await params

  const endorsement = await prisma.endorsement.findUnique({
    where: { id: endorsementId },
    select: { id: true, ideaId: true, userId: true, status: true },
  })

  if (!endorsement || endorsement.ideaId !== ideaId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (endorsement.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (endorsement.status === 'WITHDRAWN') {
    return NextResponse.json({ error: 'Already withdrawn' }, { status: 409 })
  }

  await prisma.$transaction([
    prisma.endorsement.update({
      where: { id: endorsementId },
      data: { status: 'WITHDRAWN', withdrawnAt: new Date() },
    }),
    prisma.idea.update({
      where: { id: ideaId },
      data: { endorsementCount: { decrement: 1 } },
    }),
  ])

  return new NextResponse(null, { status: 204 })
}
