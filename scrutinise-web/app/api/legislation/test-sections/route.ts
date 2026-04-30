import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { r2Get } from '@/lib/r2'
import { CompilationStatus } from '@prisma/client'

// GET /api/legislation/test-sections
// Public — no auth required (research tool)
// Returns up to 20 compiled sections with text fetched from R2
export async function GET() {
  const sections = await prisma.legislationSection.findMany({
    where: {
      compilationStatus: { in: [CompilationStatus.COMPILED, CompilationStatus.NEEDS_REVIEW] },
      compiledTextKey: { not: null },
    },
    include: {
      legislationItem: { select: { title: true, year: true, legislationGovUkId: true } },
      amendments: { orderBy: { orderIndex: 'asc' }, select: {
        sourceInstrument: true,
        amendmentType: true,
        instruction: true,
        targetedText: true,
        substitutedText: true,
        effectDate: true,
      }},
    },
    take: 20,
    orderBy: { createdAt: 'asc' },
  })

  const withText = await Promise.all(sections.map(async s => {
    const [compiledText, lexSummary] = await Promise.all([
      s.compiledTextKey ? r2Get(s.compiledTextKey) : Promise.resolve(null),
      s.lexSummaryKey   ? r2Get(s.lexSummaryKey)   : Promise.resolve(null),
    ])

    return {
      id: s.id,
      sectionNumber: s.sectionNumber,
      sectionTitle: s.sectionTitle,
      originalText: s.originalText,
      compiledText,
      lexSummary,
      isTnaVerified: s.compiledBy === 'tna-direct',
      actTitle: s.legislationItem.title,
      year: s.legislationItem.year,
      legislationGovUkId: s.legislationItem.legislationGovUkId,
      amendments: s.amendments.map(a => ({
        sourceInstrument: a.sourceInstrument,
        amendmentType: a.amendmentType,
        instruction: a.instruction,
        targetedText: a.targetedText,
        substitutedText: a.substitutedText,
        effectDate: a.effectDate ? a.effectDate.toISOString().split('T')[0] : null,
      })),
    }
  }))

  return NextResponse.json({ sections: withText })
}
