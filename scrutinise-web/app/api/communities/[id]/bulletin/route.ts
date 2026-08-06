import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import {
  requireCommunityRole,
  getBoardScopeFilter,
  categoriesFor,
  BULLETIN_CATEGORY_DESCRIPTIONS,
  BULLETIN_SCOPES,
} from '@/lib/community'

type Params = { params: Promise<{ id: string }> }

const ALL_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const

// GET /api/communities/[id]/bulletin?category=&q=
// Thread list for this board — this node's own posts plus Community-wide posts
// from anywhere in the same tree (Stage 1.1 display rule). Never a
// cross-Community feed. Members only.
// Keyword search is plain ILIKE over title+body (deliberately not the corpus
// FTS stack — different scale, different problem).
export async function GET(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId } = await params

  const roleCheck = await requireCommunityRole(user.id, communityId, [...ALL_ROLES])
  if (roleCheck.error) return roleCheck.error

  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: { id: true, name: true, bulletinCategories: true, parentCommunityId: true },
  })
  if (!community) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') ?? undefined
  const q = searchParams.get('q')?.trim() ?? undefined

  const scopeFilter = await getBoardScopeFilter(communityId)

  const threads = await prisma.bulletinPost.findMany({
    where: {
      AND: [
        scopeFilter,
        { parentId: null },
        ...(category ? [{ category }] : []),
        ...(q
          ? [{
              OR: [
                { title: { contains: q, mode: 'insensitive' as const } },
                { body: { contains: q, mode: 'insensitive' as const } },
              ],
            }]
          : []),
      ],
    },
    include: {
      author: { select: { id: true, name: true, username: true } },
      community: { select: { id: true, name: true } },
      // The caller's own vote, so the list renders active up/down state without
      // needing the thread to be expanded first.
      votes: { where: { userId: user.id }, select: { value: true } },
      _count: { select: { replies: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json({
    threads: threads.map(({ votes, ...t }) => ({
      ...t,
      myVote: votes[0]?.value ?? 0,
      // Tagged in the UI whenever the post's reach is the whole Community, or
      // it was written on another node in the tree.
      isCommunityWide: t.scope === 'COMMUNITY',
      fromOtherBranch: t.communityId !== communityId,
    })),
    categories: categoriesFor(community),
    categoryDescriptions: BULLETIN_CATEGORY_DESCRIPTIONS,
    board: { id: community.id, name: community.name, isBranch: community.parentCommunityId !== null },
  })
}

const CreateThreadSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  body: z.string().min(1).max(10_000),
  // Defaults to the board being viewed — "this branch" — per the Stage 1.1
  // brief; the composer sends it explicitly.
  scope: z.enum(BULLETIN_SCOPES).default('BRANCH'),
})

// POST /api/communities/[id]/bulletin
// Create a root thread on this board. Members only. A COMMUNITY-scope post
// stays owned by this node and becomes visible across the whole tree.
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId } = await params

  const roleCheck = await requireCommunityRole(user.id, communityId, [...ALL_ROLES])
  if (roleCheck.error) return roleCheck.error

  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: { bulletinCategories: true },
  })
  if (!community) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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

  // Categories are per-Community data now, so the allowed set is checked
  // against the row rather than a compile-time enum.
  if (!categoriesFor(community).includes(parsed.data.category)) {
    return NextResponse.json({ error: 'Unknown category for this Community' }, { status: 422 })
  }

  const thread = await prisma.bulletinPost.create({
    data: { communityId, authorId: user.id, ...parsed.data },
    include: {
      author: { select: { id: true, name: true, username: true } },
      community: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ thread }, { status: 201 })
}
