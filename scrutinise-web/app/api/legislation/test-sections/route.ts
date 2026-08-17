import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { r2Get } from '@/lib/r2'
import { decodeForDisplay, decodeMaybe } from '@/lib/html-entities'
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

    // Render-side entity decode. `originalText` is included: this route is a research tool that
    // shows the stored text next to the compiled text, and a reader comparing the two should not
    // have to mentally decode one of them.
    return {
      id: s.id,
      sectionNumber: s.sectionNumber,
      sectionTitle: decodeMaybe(s.sectionTitle),
      originalText: decodeMaybe(s.originalText),
      compiledText: decodeMaybe(compiledText),
      lexSummary: decodeMaybe(lexSummary),
      isTnaVerified: s.compiledBy === 'tna-direct',
      actTitle: decodeForDisplay(s.legislationItem.title),
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
