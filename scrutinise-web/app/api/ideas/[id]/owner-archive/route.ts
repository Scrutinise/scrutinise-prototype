// 26-C §7b — archive and delete, on every card. Archive HIDES; it does not remove.
//
// ⚠ A SEPARATE COLUMN AND A SEPARATE ROUTE FROM `DELETE /api/ideas/[id]`, deliberately — see
// `ownerArchivedAt` on the schema. Archive is reversible with one PATCH and carries no
// confirmation dialogue; delete is a named, confirmed act with its own endpoint.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

const BodySchema = z.object({ archived: z.boolean() })

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'archived must be a boolean' }, { status: 422 })

  const idea = await prisma.idea.findUnique({
    where: { id },
    select: { id: true, creatorId: true, deletedAt: true, title: true },
  })
  if (!idea || idea.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Owner only — the same restriction as DELETE, for the same reason: this hides the idea
  // from the person whose list it is, not from a collaborator's.
  if (idea.creatorId !== user.id) {
    return NextResponse.json({ error: 'Only the owner can archive an idea' }, { status: 403 })
  }

  await prisma.idea.update({
    where: { id },
    data: { ownerArchivedAt: parsed.data.archived ? new Date() : null },
  })

  return NextResponse.json({ ok: true, id, archived: parsed.data.archived, title: idea.title })
}
