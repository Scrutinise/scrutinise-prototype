import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

const GuidingPolicySchema = z.object({
  guidingPolicyTitle: z.string().optional(),
  text: z.string().optional(),
  coreTheory: z.string().optional(),
  mechanismIncentives: z.string().optional(),
  mechanismRules: z.string().optional(),
  mechanismTransparency: z.string().optional(),
  mechanismMarketDesign: z.string().optional(),
  mechanismInstitutionalRestructuring: z.string().optional(),
  tradeOffs: z.string().optional(),
  competitiveIdeaAnalysis: z.string().optional(),
})

// POST /api/ideas/[id]/guiding-policy — upsert GuidingPolicy record (one per idea)
// Auth required. Owner or collaborator only.
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: ideaId } = await params

  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    include: { collaborators: { select: { userId: true } } },
  })

  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOwner = idea.creatorId === user.id
  const isCollaborator = idea.collaborators.some(c => c.userId === user.id)

  if (!isOwner && !isCollaborator) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = GuidingPolicySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const guidingPolicy = await prisma.guidingPolicy.upsert({
    where: { ideaId },
    create: { ideaId, ...parsed.data },
    update: parsed.data,
  })

  return NextResponse.json(guidingPolicy)
}
