// 26-C addendum §20 — Delete is recoverable via a reachable "Deleted" view, not a
// time-boxed toast. Restore is the other half of DELETE /api/ideas/[id]: it clears
// `deletedAt`, the same column the delete route sets, so the two are exact inverses.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(_req: Request, { params }: Params) {
  const { id } = await params
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const idea = await prisma.idea.findUnique({
    where: { id },
    select: { id: true, creatorId: true, deletedAt: true, title: true },
  })
  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (idea.creatorId !== user.id) {
    return NextResponse.json({ error: 'Only the owner can restore an idea' }, { status: 403 })
  }
  if (!idea.deletedAt) return NextResponse.json({ ok: true, id, alreadyActive: true, title: idea.title })

  await prisma.idea.update({ where: { id }, data: { deletedAt: null } })
  console.log('[idea] restored', { id, by: user.id })

  return NextResponse.json({ ok: true, id, title: idea.title })
}
