import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

const PostSchema = z.object({
  coherentActionId: z.string().min(1),
  legislationSectionId: z.string().min(1),
  proposedWording: z.string().optional(),
  changeType: z.enum(['AMEND', 'REPEAL', 'ADD']).optional().default('AMEND'),
})

const DeleteSchema = z.object({
  coherentActionSectionId: z.string().min(1),
})

export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: ideaId } = await params

  const idea = await prisma.idea.findFirst({ where: { id: ideaId, creatorId: user.id } })
  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const { coherentActionId, legislationSectionId, proposedWording, changeType } = parsed.data

  const ca = await prisma.coherentAction.findFirst({ where: { id: coherentActionId, ideaId } })
  if (!ca) return NextResponse.json({ error: 'Coherent action not found' }, { status: 404 })

  // Upsert: update if link already exists, create otherwise
  const existing = await prisma.coherentActionSection.findFirst({
    where: { coherentActionId, legislationSectionId },
  })

  const record = existing
    ? await prisma.coherentActionSection.update({
        where: { id: existing.id },
        data: { proposedWording: proposedWording ?? null, changeType },
      })
    : await prisma.coherentActionSection.create({
        data: { coherentActionId, legislationSectionId, proposedWording: proposedWording ?? null, changeType },
      })

  return NextResponse.json({ record })
}

export async function DELETE(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: ideaId } = await params

  const idea = await prisma.idea.findFirst({ where: { id: ideaId, creatorId: user.id } })
  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = DeleteSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  // ⚠ 26-AA A3 — SCOPED TO THE IDEA IN THE URL. Owning *an* idea used to be enough: the row was deleted by its id alone, so any idea
  // owner who knew another idea's link id could delete it. The row must hang off an action on THIS idea, or nothing is deleted.
  const row = await prisma.coherentActionSection.findFirst({
    where: { id: parsed.data.coherentActionSectionId, coherentAction: { ideaId } },
    select: { id: true },
  })
  if (!row) return NextResponse.json({ error: 'That law link is not on this idea.' }, { status: 404 })

  await prisma.coherentActionSection.delete({ where: { id: row.id } })

  return NextResponse.json({ ok: true })
}
