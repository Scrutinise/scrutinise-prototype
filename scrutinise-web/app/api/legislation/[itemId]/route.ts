import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CompilationStatus } from '@prisma/client'

// GET /api/legislation/[itemId] — retrieve a LegislationItem with its compiled sections
// Public — no auth required
export async function GET(req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params
  const item = await prisma.legislationItem.findUnique({
    where: { id: itemId },
    include: {
      sections: {
        where: { compilationStatus: { in: [CompilationStatus.COMPILED, CompilationStatus.NEEDS_REVIEW] } },
        orderBy: { sectionNumber: 'asc' },
        include: { amendments: { orderBy: { orderIndex: 'asc' } } },
      },
    },
  })

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(item)
}
