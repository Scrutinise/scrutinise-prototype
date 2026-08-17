import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decodeForDisplay, decodeMaybe } from '@/lib/html-entities'
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
  // The JSON twin of app/legislation/[itemId]/page.tsx — same tables, same repair. A consumer of
  // this endpoint should not get a different reading of the Act from the page that renders it.
  return NextResponse.json({
    ...item,
    title: decodeForDisplay(item.title),
    sections: item.sections.map((s) => ({
      ...s,
      sectionTitle: decodeMaybe(s.sectionTitle),
      originalText: decodeMaybe(s.originalText),
    })),
  })
}
