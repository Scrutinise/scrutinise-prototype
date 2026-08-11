import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { CommunityRuleError, getRootCommunityId, getSubtreeIds } from '@/lib/community'
import {
  listQuestions,
  requireLibraryAccess,
  QUESTION_SCOPES,
  SORT_MODES,
  type SortMode,
} from '@/lib/question-library'

type Params = { params: Promise<{ id: string }> }

// GET /api/communities/[id]/questions?search=&context=&topic=&side=&sort=
// The library list, scoped to what this viewer may see from where they stand.
export async function GET(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id } = await params
  try {
    await requireLibraryAccess(user.id, id)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const sp = new URL(req.url).searchParams
  const rawSort = sp.get('sort') ?? 'top-month'
  const sort = (SORT_MODES as readonly string[]).includes(rawSort) ? (rawSort as SortMode) : 'top-month'
  const rawSide = sp.get('side')

  const questions = await listQuestions(id, user.id, {
    search: sp.get('search')?.trim() || undefined,
    context: sp.get('context')?.trim() || undefined,
    topic: sp.get('topic')?.trim() || undefined,
    side: rawSide === 'internal' ? 'internal' : rawSide === 'external' ? 'external' : undefined,
    sort,
  })

  return NextResponse.json({ questions, count: questions.length })
}

const CreateSchema = z.object({
  text: z.string().min(5).max(500),
  scope: z.enum(QUESTION_SCOPES).default('COMMUNITY'),
  contextTags: z.array(z.string().max(64)).max(8).default([]),
  topicTags: z.array(z.string().max(64)).max(8).default([]),
})

// POST /api/communities/[id]/questions
// Post a question. Defaults to COMMUNITY scope and is always tagged with the
// author's branch — recorded even on a Community-scoped question, so "which
// branch is asking this" stays answerable for filtering and the admin view.
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
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  // The branch the author is posting from: the node they are standing on if it
  // is a branch, otherwise their first branch membership in this Community.
  let branchId: string | null = null
  const standingOn = await prisma.community.findUnique({
    where: { id },
    select: { id: true, parentCommunityId: true },
  })
  if (standingOn?.parentCommunityId) {
    branchId = standingOn.id
  } else {
    const nodeIds = await getSubtreeIds(rootId)
    const membership = await prisma.communityMember.findFirst({
      where: {
        userId: user.id,
        communityId: { in: nodeIds },
        community: { parentCommunityId: { not: null } },
      },
      orderBy: { joinedAt: 'asc' },
      select: { communityId: true },
    })
    branchId = membership?.communityId ?? null
  }

  if (parsed.data.scope === 'BRANCH' && !branchId) {
    return NextResponse.json(
      { error: 'You are not in a branch yet, so this can only be posted to the whole Community.' },
      { status: 422 },
    )
  }

  try {
    const question = await prisma.question.create({
      data: {
        communityId: rootId,
        authorId: user.id,
        text: parsed.data.text.trim(),
        scope: parsed.data.scope,
        branchId,
        contextTags: parsed.data.contextTags,
        topicTags: parsed.data.topicTags,
      },
    })
    return NextResponse.json({ question }, { status: 201 })
  } catch (e) {
    if (e instanceof CommunityRuleError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
