import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import {
  canCreateBranchUnder,
  getCommunityMembership,
  joinCommunityAndRoot,
  seedQuestionTags,
  DEFAULT_BULLETIN_CATEGORIES,
} from '@/lib/community'

type Params = { params: Promise<{ id: string }> }

const CreateBranchSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
})

// POST /api/communities/[id]/children
// Create a branch beneath [id]. The creator becomes its OWNER — otherwise no
// one could manage what they just made.
//
// Who may do this (Stage 1.2): a TOP-LEVEL branch, i.e. a child of the
// Community root, is open to any member of that Community — the deliberate
// growth mechanic, an invitee whose town has no branch founds it. A SUB-branch
// under an existing branch stays manage-gated, because that is a structural
// decision belonging to that branch's admins. canCreateBranchUnder() is the
// rule; a root-admin approval gate can be added later if sprawl appears.
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: parentId } = await params

  if (!(await canCreateBranchUnder(user.id, parentId))) {
    // 404 rather than 403 for a caller with no standing here at all, so a
    // Community's shape isn't leaked to non-members.
    const membership = await getCommunityMembership(user.id, parentId)
    return membership
      ? NextResponse.json(
          { error: 'Only this branch’s admins can add a branch beneath it.' },
          { status: 403 },
        )
      : NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateBranchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { name, description } = parsed.data

  const branch = await prisma.community.create({
    data: {
      name,
      description,
      parentCommunityId: parentId,
      bulletinCategories: [...DEFAULT_BULLETIN_CATEGORIES],
    },
  })

  // The question-library tag set. Until 26 Aug 2026 this only ever came from a
  // migration, so anything created afterwards had none — see seedQuestionTags.
  await seedQuestionTags(branch.id)

  // OWNER of the new branch, and a member of the Community with it.
  await joinCommunityAndRoot(user.id, branch.id, 'OWNER')

  return NextResponse.json({ community: branch }, { status: 201 })
}
