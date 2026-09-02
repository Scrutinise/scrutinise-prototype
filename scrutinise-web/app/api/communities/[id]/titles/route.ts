import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { canManageCommunity, getRootCommunityId } from '@/lib/community'

type Params = { params: Promise<{ id: string }> }

/**
 * CENTRAL 25-A §7e — the titles a Community defines for itself.
 *
 * ⚠⚠ NOTHING HERE TOUCHES `User.role`. A title is a name a Community gives one
 * of its own members and it grants rights only inside that Community. Platform
 * roles and community titles must not share a namespace: everyone is an
 * ordinary platform member unless separately granted otherwise, and no route in
 * this file can change that.
 *
 * Titles live on the ROOT, like every other Community-wide setting, and are
 * managed by anyone with manage rights over it.
 */
const TitleSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(240).optional(),
  grantsInvite: z.boolean().default(false),
})

export async function GET(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id } = await params
  const rootId = await getRootCommunityId(id)
  if (!(await canManageCommunity(user.id, rootId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    titles: await prisma.communityTitle.findMany({
      where: { communityId: rootId },
      orderBy: { name: 'asc' },
    }),
  })
}

export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id } = await params
  const rootId = await getRootCommunityId(id)
  if (!(await canManageCommunity(user.id, rootId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const parsed = TitleSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: `That title could not be read — ${parsed.error.issues.map((i) => i.message).join('; ')}` },
      { status: 422 },
    )
  }

  const existing = await prisma.communityTitle.findFirst({
    where: { communityId: rootId, name: parsed.data.name },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json({ error: 'This Community already has a title with that name' }, { status: 409 })
  }

  return NextResponse.json(
    {
      title: await prisma.communityTitle.create({
        data: {
          communityId: rootId,
          name: parsed.data.name,
          description: parsed.data.description || null,
          grantsInvite: parsed.data.grantsInvite,
        },
      }),
    },
    { status: 201 },
  )
}

const PatchSchema = TitleSchema.partial().extend({ titleId: z.string().min(1) })

export async function PATCH(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id } = await params
  const rootId = await getRootCommunityId(id)
  if (!(await canManageCommunity(user.id, rootId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Unknown change' }, { status: 422 })

  const { titleId, ...rest } = parsed.data
  const title = await prisma.communityTitle.findUnique({ where: { id: titleId } })
  if (!title || title.communityId !== rootId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    title: await prisma.communityTitle.update({
      where: { id: titleId },
      data: {
        ...(rest.name !== undefined && { name: rest.name }),
        ...(rest.description !== undefined && { description: rest.description || null }),
        ...(rest.grantsInvite !== undefined && { grantsInvite: rest.grantsInvite }),
      },
    }),
  })
}

const DeleteSchema = z.object({ titleId: z.string().min(1) })

export async function DELETE(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id } = await params
  const rootId = await getRootCommunityId(id)
  if (!(await canManageCommunity(user.id, rootId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const parsed = DeleteSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Which title?' }, { status: 422 })

  const title = await prisma.communityTitle.findUnique({ where: { id: parsed.data.titleId } })
  if (!title || title.communityId !== rootId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // ⚠ Take the title off everyone who holds it FIRST. A delete that left the
  // pointer behind would fail on the foreign key, and one that cascaded would
  // be a surprise; unhooking it says plainly what happened to those members.
  const { count } = await prisma.communityMember.updateMany({
    where: { titleId: title.id },
    data: { titleId: null },
  })
  await prisma.communityTitle.delete({ where: { id: title.id } })

  return NextResponse.json({ deleted: true, removedFrom: count })
}
