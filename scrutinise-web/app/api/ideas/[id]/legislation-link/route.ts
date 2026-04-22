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

  await prisma.coherentActionSection.delete({ where: { id: parsed.data.coherentActionSectionId } })

  return NextResponse.json({ ok: true })
}
