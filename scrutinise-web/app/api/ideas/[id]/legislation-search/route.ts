import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

const BodySchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(10).optional().default(5),
})

export async function POST(req: Request, { params }: Params) {
  const { error } = await getAuthenticatedUser()
  if (error) return error

  const { id: ideaId } = await params
  if (!ideaId) return NextResponse.json({ error: 'Missing ideaId' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const { query, limit } = parsed.data

  type RawResult = {
    id: string
    sectionNumber: string
    sectionTitle: string | null
    compiledText: string | null
    tnaCompiledText: string | null
    lexSummary: string | null
    actTitle: string
    year: number
    legislationGovUkId: string
    amendmentCount: number
    confidence: string | null
    tags: string[]
  }

  const results = await prisma.$queryRaw<RawResult[]>`
    SELECT
      ls.id,
      ls."sectionNumber",
      ls."sectionTitle",
      ls."compiledText",
      ls."tnaCompiledText",
      ls."lexSummary",
      li.title as "actTitle",
      li.year,
      li."legislationGovUkId",
      ls."amendmentCount",
      ls.confidence::text,
      ls.tags
    FROM "LegislationSection" ls
    JOIN "LegislationItem" li ON ls."legislationItemId" = li.id
    WHERE ls."compilationStatus" = 'COMPILED'
      AND ls."compiledText" IS NOT NULL
      AND to_tsvector('english',
          coalesce(ls."tnaCompiledText", ls."compiledText", '') || ' ' ||
          coalesce(ls."sectionTitle", '') || ' ' ||
          coalesce(ls."policyArea", ''))
        @@ plainto_tsquery('english', ${query})
    ORDER BY
      ts_rank(
        to_tsvector('english',
          coalesce(ls."tnaCompiledText", ls."compiledText", '') || ' ' ||
          coalesce(ls."sectionTitle", '')),
        plainto_tsquery('english', ${query})
      ) DESC,
      ls."amendmentCount" ASC
    LIMIT ${limit}
  `

  return NextResponse.json({ results })
}
