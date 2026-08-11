import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import {
  buildPack,
  requireLibraryAccess,
  OUTPUT_FORMATS,
  SORT_MODES,
  PACK_DISCLAIMER,
} from '@/lib/question-library'

type Params = { params: Promise<{ id: string }> }

const FilterSchema = z.object({
  search: z.string().max(200).optional(),
  context: z.string().max(64).optional(),
  topic: z.string().max(64).optional(),
  side: z.enum(['external', 'internal']).optional(),
  sort: z.enum(SORT_MODES).optional(),
})

const BuildSchema = z.object({
  filter: FilterSchema.default({}),
  size: z.union([z.literal(10), z.literal(25), z.literal(50)]).default(10),
  pinnedQuestionIds: z.array(z.string()).max(200).default([]),
  removedQuestionIds: z.array(z.string()).max(200).default([]),
  includeFavourites: z.boolean().default(true),
  outputFormat: z.enum(OUTPUT_FORMATS).default('GLANCE'),
  /** Present to persist the pack; omit for a live preview. */
  name: z.string().min(1).max(120).optional(),
})

// POST /api/communities/[id]/packs
// Builds the pack contents. With a `name`, also saves it.
//
// The response always carries the disclaimer, because every output format has
// to print it and the safest place to guarantee that is the one code path they
// all read from.
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id } = await params
  let rootId: string
  try {
    rootId = await requireLibraryAccess(user.id, id)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const parsed = BuildSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const built = await buildPack({
    viewerCommunityId: id,
    viewerId: user.id,
    filter: parsed.data.filter,
    size: parsed.data.size,
    pinnedQuestionIds: parsed.data.pinnedQuestionIds,
    removedQuestionIds: parsed.data.removedQuestionIds,
    includeFavourites: parsed.data.includeFavourites,
  })

  let pack = null
  if (parsed.data.name) {
    pack = await prisma.pack.create({
      data: {
        ownerId: user.id,
        communityId: rootId,
        name: parsed.data.name,
        filter: parsed.data.filter,
        size: parsed.data.size,
        pinnedQuestionIds: parsed.data.pinnedQuestionIds,
        removedQuestionIds: parsed.data.removedQuestionIds,
        outputFormat: parsed.data.outputFormat,
      },
    })
  }

  return NextResponse.json({ ...built, pack, disclaimer: PACK_DISCLAIMER })
}

// GET /api/communities/[id]/packs — the caller's own saved packs.
export async function GET(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id } = await params
  let rootId: string
  try {
    rootId = await requireLibraryAccess(user.id, id)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const packs = await prisma.pack.findMany({
    where: { communityId: rootId, ownerId: user.id },
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json({ packs })
}
