import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { LegislationType } from '@prisma/client'

// GET /api/legislation/search?q=...&type=...&year=...&jurisdiction=...&page=1
// Public — no auth required
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const type = searchParams.get('type')
  const year = searchParams.get('year')
  const jurisdiction = searchParams.get('jurisdiction')
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = 20

  // compilationStatus filter removed — all items are PENDING or PRINT_ONLY at
  // this stage (compile pipeline not yet run). Browse page shows all ingested
  // legislation; compiledSectionCount/sectionCount in the response indicate
  // compilation progress to the UI.
  const items = await prisma.legislationItem.findMany({
    where: {
      ...(type ? { legislationType: type as LegislationType } : {}),
      ...(year ? { year: parseInt(year) } : {}),
      ...(jurisdiction ? { jurisdiction } : {}),
      ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
    },
    select: {
      id: true,
      title: true,
      year: true,
      number: true,
      legislationType: true,
      jurisdiction: true,
      compiledSectionCount: true,
      sectionCount: true,
    },
    orderBy: [{ year: 'desc' }, { title: 'asc' }],
    skip: (page - 1) * limit,
    take: limit,
  })

  return NextResponse.json({ items, page })
}
