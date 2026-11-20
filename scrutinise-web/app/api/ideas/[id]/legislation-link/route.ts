import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { archiveLawLink, restoreLawLink, ARCHIVE_CLEARED } from '@/lib/lex/archive'

// 26-AA item 1 (183/196) — DELETE ARCHIVES the link (with the owner's proposed wording); PATCH { coherentActionSectionId, restore: true }
// brings it back. Both are scoped to an action on the idea in the URL (26-AA A3).

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

const RestoreSchema = z.object({
  coherentActionSectionId: z.string().min(1),
  restore: z.literal(true),
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

  // Upsert: update if link already exists, create otherwise.
  // ⚠ 26-AA item 1 — a removed (archived) link for the same section counts as existing: re-adding it restores that row with the new
  // wording, rather than leaving an archived twin behind it. Live first, so a live row always wins.
  const existing = await prisma.coherentActionSection.findFirst({
    where: { coherentActionId, legislationSectionId, archivedAt: undefined },
    orderBy: [{ archivedAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
  })

  const record = existing
    ? await prisma.coherentActionSection.update({
        where: { id: existing.id },
        data: { proposedWording: proposedWording ?? null, changeType, ...ARCHIVE_CLEARED },
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

  // ⚠ 26-AA item 1 — ARCHIVED, not deleted. The same idea scope is on the write itself.
  await archiveLawLink(ideaId, row.id, user.id)

  return NextResponse.json({ ok: true, archived: row.id })
}

export async function PATCH(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: ideaId } = await params

  const idea = await prisma.idea.findFirst({ where: { id: ideaId, creatorId: user.id } })
  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = RestoreSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Send { coherentActionSectionId, restore: true }.' }, { status: 400 })

  const ok = await restoreLawLink(ideaId, parsed.data.coherentActionSectionId)
  if (!ok) return NextResponse.json({ error: 'That law link is not among the removed ones on this idea.' }, { status: 404 })
  return NextResponse.json({ ok: true, restored: parsed.data.coherentActionSectionId })
}
