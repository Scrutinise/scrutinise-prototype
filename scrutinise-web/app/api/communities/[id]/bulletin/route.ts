import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { requireCommunityRole, BULLETIN_CATEGORIES } from '@/lib/community'

type Params = { params: Promise<{ id: string }> }

const ALL_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const

// GET /api/communities/[id]/bulletin?category=&q=
// Thread list for this exact node — never a cross-Community feed. Members only.
// Keyword search is plain ILIKE over title+body (deliberately not the corpus
// FTS stack — different scale, different problem).
export async function GET(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId } = await params

  const roleCheck = await requireCommunityRole(user.id, communityId, [...ALL_ROLES])
  if (roleCheck.error) return roleCheck.error

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') ?? undefined
  const q = searchParams.get('q')?.trim() ?? undefined

  const threads = await prisma.bulletinPost.findMany({
    where: {
      communityId,
      parentId: null,
      ...(category ? { category } : {}),
      ...(q
        ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { body: { contains: q, mode: 'insensitive' } }] }
        : {}),
    },
    include: {
      author: { select: { id: true, name: true, username: true } },
      _count: { select: { replies: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json({ threads, categories: BULLETIN_CATEGORIES })
}

const CreateThreadSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.enum(BULLETIN_CATEGORIES),
  body: z.string().min(1).max(10_000),
})

// POST /api/communities/[id]/bulletin
// Create a root thread. Members only.
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId } = await params

  const roleCheck = await requireCommunityRole(user.id, communityId, [...ALL_ROLES])
  if (roleCheck.error) return roleCheck.error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateThreadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const thread = await prisma.bulletinPost.create({
    data: { communityId, authorId: user.id, ...parsed.data },
    include: { author: { select: { id: true, name: true, username: true } } },
  })

  return NextResponse.json({ thread }, { status: 201 })
}
