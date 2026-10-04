// 26-P ADDENDUM §8c — GET /api/ideas/[id]/lex-activity
//
// OWNER-ONLY, exactly as the Privacy Log beside it: only `idea.creatorId` may read what Lex has done on this idea. A
// collaborator, an admin or another user gets 403 — Lex acts only for the owner (§3a), so the record is the owner's.
// Read-only. Returns newest first.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { listToolCalls } from '@/lib/lex/agent/tool-log'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error
  const { id: ideaId } = await params

  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { creatorId: true } })
  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (idea.creatorId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json({ calls: await listToolCalls(ideaId) })
}
