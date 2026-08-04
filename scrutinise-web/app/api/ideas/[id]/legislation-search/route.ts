import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { r2Get } from '@/lib/r2'
import { getAuthenticatedUser } from '@/lib/auth'
import { searchPanelViaGateway } from '@/lib/lex/gateway-legacy'

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

  // SPRINT §1 — the panel is served by the corpus index through the search gateway.
  // Before this it ran raw SQL against the legacy LegislationSection table; the V26
  // note below (kept for history) describes the last time this query was improved,
  // but even index-served it only ever saw 914k of the corpus's 17.7M sections.
  const gateway = await searchPanelViaGateway(query, limit).catch((err) => {
    console.error('[legislation-search] gateway threw — legacy fallback:', err)
    return { results: [], failed: true, failureReason: String(err) }
  })
  if (!gateway.failed) {
    return NextResponse.json({ results: gateway.results, degraded: false, path: 'gateway' })
  }
  console.error('[legislation-search] gateway search FAILED — legacy fallback:', gateway.failureReason)

  type RawResult = {
    id: string
    sectionNumber: string
    sectionTitle: string | null
    compiledTextKey: string | null
    lexSummaryKey: string | null
    compiledBy: string | null
    actTitle: string
    year: number
    legislationGovUkId: string
    amendmentCount: number
    confidence: string | null
    tags: string[]
  }

  // FTS over the GIN-indexed ftsVector column (V26: previously a per-query
  // sequential scan that recomputed to_tsvector on every row). The ftsVector
  // trigger builds from sectionTitle(A) || originalText(B) — same source text as
  // the old expression, minus policyArea (negligible, ~null). Now Neon-backed and
  // index-served. compiledText lives in R2; compiledTextKey may be null.
  const results = await prisma.$queryRaw<RawResult[]>`
    SELECT
      ls.id,
      ls."sectionNumber",
      ls."sectionTitle",
      ls."compiledTextKey",
      ls."lexSummaryKey",
      ls."compiledBy",
      li.title as "actTitle",
      li.year,
      li."legislationGovUkId",
      ls."amendmentCount",
      ls.confidence::text,
      ls.tags
    FROM "LegislationSection" ls
    JOIN "LegislationItem" li ON ls."legislationItemId" = li.id
    WHERE ls."ftsVector" @@ plainto_tsquery('english', ${query})
    ORDER BY
      ts_rank(ls."ftsVector", plainto_tsquery('english', ${query})) DESC,
      ls."amendmentCount" ASC
    LIMIT ${limit}
  `

  // Fetch compiled text and lexSummary from R2 for each result
  const withText = await Promise.all(results.map(async r => {
    const [compiledText, lexSummary] = await Promise.all([
      r.compiledTextKey ? r2Get(r.compiledTextKey) : Promise.resolve(null),
      r.lexSummaryKey   ? r2Get(r.lexSummaryKey)   : Promise.resolve(null),
    ])
    return {
      id: r.id,
      sectionNumber: r.sectionNumber,
      sectionTitle: r.sectionTitle,
      compiledText,
      lexSummary,
      isTnaVerified: r.compiledBy === 'tna-direct',
      actTitle: r.actTitle,
      year: r.year,
      legislationGovUkId: r.legislationGovUkId,
      amendmentCount: r.amendmentCount,
      confidence: r.confidence,
      tags: r.tags,
    }
  }))

  return NextResponse.json({ results: withText, degraded: true, path: 'legacy-fallback' })
}
