import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

const linkSchema = z.object({
  ideaId: z.string(),
  legislationItemId: z.string(),
  linkType: z.enum(['target', 'relevant', 'precedent']),
  notes: z.string().optional(),
})

// POST /api/legislation/link — link a LegislationItem to an Idea
// Auth required
export async function POST(req: Request) {
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = linkSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const link = await prisma.ideaLegislation.upsert({
    where: {
      ideaId_legislationItemId: {
        ideaId: parsed.data.ideaId,
        legislationItemId: parsed.data.legislationItemId,
      },
    },
    create: { ...parsed.data, addedByUserId: clerkUserId },
    update: { linkType: parsed.data.linkType, notes: parsed.data.notes },
  })

  return NextResponse.json(link, { status: 201 })
}
