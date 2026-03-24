import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

const PREVIEW_LENGTH = 200

// GET /api/ideas/[id]/campaign-outputs
// Owner only. Returns all GeneratedOutput records for this idea.
export async function GET(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: ideaId } = await params

  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: { creatorId: true },
  })

  if (!idea) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (idea.creatorId !== user.id) {
    return NextResponse.json({ error: 'Forbidden — owner only' }, { status: 403 })
  }

  const outputs = await prisma.generatedOutput.findMany({
    where: { ideaId },
    select: {
      id: true,
      documentType: true,
      status: true,
      content: true,
      generatedAt: true,
      version: true,
      wordCount: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  const result = outputs.map(o => ({
    id: o.id,
    documentType: o.documentType,
    status: o.status,
    preview: o.content ? o.content.slice(0, PREVIEW_LENGTH) : null,
    hasMore: (o.content?.length ?? 0) > PREVIEW_LENGTH,
    content: o.content,
    generatedAt: o.generatedAt,
    version: o.version,
    wordCount: o.wordCount,
  }))

  return NextResponse.json({ outputs: result })
}
