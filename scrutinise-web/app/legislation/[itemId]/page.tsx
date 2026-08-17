import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CompilationStatus } from '@prisma/client'
import LegislationItemClient from './LegislationItemClient'
import { repealsForItem } from '@/lib/lex/repeal-status'

interface Props {
  params: Promise<{ itemId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { itemId } = await params
  const item = await prisma.legislationItem.findUnique({
    where: { id: itemId },
    select: { title: true, year: true },
  })
  if (!item) return { title: 'Legislation | Scrutinise' }
  return {
    title: `${item.title} ${item.year} | Scrutinise`,
    description: `AI-compiled text of ${item.title} ${item.year}. Not a legal authority — verify on legislation.gov.uk.`,
  }
}

export default async function LegislationItemPage({ params }: Props) {
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

  if (!item) notFound()

  // ── SURFACE 1 — the highest-exposure surface, because there is no search step here ──
  // This page lists every compiled section of an Act in full. A repealed one would otherwise appear
  // with its text, its citation and a working legislation.gov.uk link and nothing to say it is dead.
  // ⚠ Joined on (gid, section_ref) because this page reads the LEGACY table, whose ids are not
  // corpus_sections ids. An unmatched section carries NO status rather than a reassuring one.
  const repeals = await repealsForItem(
    item.legislationGovUkId ?? '',
    item.sections.map((s: { sectionNumber: string }) => s.sectionNumber),
  )
  const repealBySection = Object.fromEntries(repeals)

  return <LegislationItemClient item={item as any} repealBySection={repealBySection} />
}
