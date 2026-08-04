import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { searchLegislation } from '@/lib/search'
import { searchLegislationViaGateway } from '@/lib/lex/gateway-legacy'

const SearchSchema = z.object({
  q:       z.string().min(1).max(500),
  filters: z.object({
    type:  z.enum(['ukpga', 'uksi', 'operational']).nullable().optional(),
    year:  z.number().int().min(1800).max(2100).nullable().optional(),
    actId: z.string().max(100).nullable().optional(),
  }).optional(),
  limit:   z.number().int().min(1).max(100).default(20),
  offset:  z.number().int().min(0).default(0),
  minRank: z.number().min(0).default(0.05),  // ts_rank_cd is unbounded — no max(1)
})

// POST /api/search — Lex and future UI. Auth required.
export async function POST(req: Request) {
  const { error } = await getAuthenticatedUser()
  if (error) return error

  let body: unknown
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = SearchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { q, filters, limit, offset, minRank } = parsed.data

  // SPRINT §1 — served by the corpus index through the search gateway.
  //
  // The legacy `searchLegislation()` path is kept for two cases, and only two:
  //   1. A structured filter (type/year/actId). Those are SQL predicates on
  //      LegislationItem columns; the corpus index has no equivalent filter axis
  //      yet, so a filtered request would silently ignore its own filter. Filtered
  //      requests therefore stay on the legacy path until the Act-metadata table
  //      backs them (see docs/ACT_METADATA.md).
  //   2. `failed` — an FTS infrastructure failure (endpoint unset/down/timed out).
  //      Falling back to a real, if worse, index beats returning nothing. This is
  //      NOT the §19-C stub prohibition: that forbade substituting FIXTURE data
  //      that reads as real law. Legacy GIN over real legislation is a genuine
  //      answer, so the rule it must satisfy is "say so", not "refuse" — hence the
  //      `degraded` flag below and the error log.
  const hasFilters = !!(filters?.type || filters?.year || filters?.actId)
  if (hasFilters) {
    const { results, totalMatches } = await searchLegislation({ q, filters: filters ?? {}, limit, offset, minRank })
    return NextResponse.json({ query: q, totalMatches, results, degraded: false, path: 'legacy-filtered' })
  }

  const gateway = await searchLegislationViaGateway({ q, limit, intent: 'LEGISLATION_SEARCH' })
  if (gateway.failed) {
    console.error('[api/search] gateway search FAILED — falling back to legacy GIN index:', gateway.failureReason)
    const { results, totalMatches } = await searchLegislation({ q, filters: {}, limit, offset, minRank })
    return NextResponse.json({ query: q, totalMatches, results, degraded: true, path: 'legacy-fallback' })
  }

  return NextResponse.json({
    query: q,
    totalMatches: gateway.totalMatches,
    results: gateway.results,
    degraded: false,
    path: 'gateway',
  })
}
