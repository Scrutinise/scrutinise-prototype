import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { searchLegislation } from '@/lib/search'

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
  const { results, totalMatches } = await searchLegislation({
    q,
    filters: filters ?? {},
    limit,
    offset,
    minRank,
  })

  return NextResponse.json({ query: q, totalMatches, results })
}
