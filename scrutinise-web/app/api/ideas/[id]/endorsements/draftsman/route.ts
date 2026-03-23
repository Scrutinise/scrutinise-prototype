import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

const DraftsmanEndorsementSchema = z.object({
  draftsmanName: z.string().min(1).max(200),
  organisation: z.string().min(1).max(300),
  qualifications: z.string().min(1).max(1000),
  statement: z.string().min(1).max(2000),
})

// POST /api/ideas/[id]/endorsements/draftsman
// Owner-only. Stage 4+. One per idea (409 on duplicate).
export async function POST(req: Request, { params }: Params) {
  const { error, user: authUser } = await getAuthenticatedUser()
  if (error) return error

  const { id: ideaId } = await params

  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: { id: true, stage: true, creatorId: true },
  })

  if (!idea) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (idea.creatorId !== authUser.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!['STAGE_4', 'STAGE_5'].includes(idea.stage)) {
    return NextResponse.json(
      { error: 'Draftsman endorsement requires Stage 4 or above' },
      { status: 422 },
    )
  }

  // Check for existing record (one per idea)
  const existing = await prisma.draftsmanEndorsement.findFirst({
    where: { ideaId, status: 'ACTIVE' },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'A Parliamentary Draftsman endorsement already exists for this idea' },
      { status: 409 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = DraftsmanEndorsementSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { draftsmanName, organisation, qualifications, statement } = parsed.data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [endorsement] = await prisma.$transaction([
    // Type cast required until `prisma generate` picks up the new schema fields
    // (draftsmanName, organisation, draftsmanEndorsementCount)
    (prisma.draftsmanEndorsement.create as any)({
      data: {
        ideaId,
        draftsmanName,
        organisation,
        draftsmanCredentials: qualifications,
        publicStatement: statement,
      },
    }),
    (prisma.idea.update as any)({
      where: { id: ideaId },
      data: { draftsmanEndorsementCount: { increment: 1 } },
    }),
  ])

  return NextResponse.json(endorsement, { status: 201 })
}
