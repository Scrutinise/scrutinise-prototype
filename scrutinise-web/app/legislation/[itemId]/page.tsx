import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CompilationStatus } from '@prisma/client'
import LegislationItemClient from './LegislationItemClient'

interface Props {
  params: { itemId: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = await prisma.legislationItem.findUnique({
    where: { id: params.itemId },
    select: { title: true, year: true },
  })
  if (!item) return { title: 'Legislation | Scrutinise' }
  return {
    title: `${item.title} ${item.year} | Scrutinise`,
    description: `AI-compiled text of ${item.title} ${item.year}. Not a legal authority — verify on legislation.gov.uk.`,
  }
}

export default async function LegislationItemPage({ params }: Props) {
  const item = await prisma.legislationItem.findUnique({
    where: { id: params.itemId },
    include: {
      sections: {
        where: { compilationStatus: { in: [CompilationStatus.COMPILED, CompilationStatus.NEEDS_REVIEW] } },
        orderBy: { sectionNumber: 'asc' },
        include: { amendments: { orderBy: { orderIndex: 'asc' } } },
      },
    },
  })

  if (!item) notFound()

  return <LegislationItemClient item={item as any} />
}
