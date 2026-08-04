import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/legislation/search?q=...&type=...&year=...&jurisdiction=...&page=1
// Public — no auth required
//
// SPRINT §1 — served by `corpus_acts` (the Act-level metadata table) instead of a
// `title contains` scan of LegislationItem.
//
// What changed: the query. `title: { contains: q, mode: 'insensitive' }` compiles to
// ILIKE '%q%', which no btree can serve — it was a full scan of 135,531 rows on every
// keystroke of a 300 ms-debounced search box. corpus_acts carries a trigram GIN index
// on title, so the same substring semantics become index-served.
//
// What deliberately did NOT change: the population and the ids. Rows are filtered to
// `in_legislation_item`, so this returns exactly the set it returned before, and `id`
// is still the LegislationItem uuid — because /legislation/[itemId] resolves only by
// that uuid and renders only legacy compiled sections. Widening browse to the 115,277
// corpus-only instruments would have shipped links that 404. That widening is the
// follow-on, and it needs the detail page to learn to resolve a gid first — see
// docs/ACT_METADATA.md.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const type = searchParams.get('type')
  const year = searchParams.get('year')
  const jurisdiction = searchParams.get('jurisdiction')
  const pageRaw = parseInt(searchParams.get('page') ?? '1')
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1
  const limit = 20

  const yearNum = year ? parseInt(year) : null
  const conditions: string[] = ['in_legislation_item']
  const params: unknown[] = []
  let p = 1

  if (type) { conditions.push(`legislation_type = $${p++}`); params.push(type) }
  if (yearNum !== null && Number.isFinite(yearNum)) { conditions.push(`year = $${p++}`); params.push(yearNum) }
  if (jurisdiction) { conditions.push(`jurisdiction = $${p++}`); params.push(jurisdiction) }
  // ILIKE '%q%' — same semantics as the old Prisma `contains`, now trigram-indexed.
  if (q) { conditions.push(`title ILIKE $${p++}`); params.push(`%${q}%`) }

  params.push(limit, (page - 1) * limit)

  const items = await prisma.$queryRawUnsafe<Array<{
    id: string
    title: string | null
    year: number | null
    number: string | null
    legislationType: string | null
    jurisdiction: string | null
    compiledSectionCount: number | null
    sectionCount: number | null
    corpusSectionCount: number
    inCorpus: boolean
  }>>(
    `SELECT legislation_item_id            AS id,
            title,
            year,
            number,
            legislation_type               AS "legislationType",
            jurisdiction,
            item_compiled_count            AS "compiledSectionCount",
            item_section_count             AS "sectionCount",
            -- NEW, additive: how many sections of this instrument are actually in
            -- the search corpus. The pair above counts the legacy compile pipeline;
            -- this counts what a search can currently find. They are different
            -- numbers and conflating them would overstate coverage.
            section_count                  AS "corpusSectionCount",
            in_corpus                      AS "inCorpus"
     FROM corpus_acts
     WHERE ${conditions.join(' AND ')}
     -- gid is the tie-break, and it is not cosmetic. (year, title) is NOT unique:
     -- 107 groups / 215 rows share both, e.g. two 2026 rows both titled "The Boiler
     -- Upgrade Scheme (England and Wales)". Without a unique final sort key, the
     -- order within a tie is whatever the plan happens to produce, so a tied pair
     -- straddling a page boundary can show the same instrument on two pages and
     -- drop another entirely. The old endpoint had this bug too; it is fixed here
     -- rather than carried across.
     ORDER BY year DESC NULLS LAST, title ASC, gid ASC
     LIMIT $${p++} OFFSET $${p++}`,
    ...params,
  )

  return NextResponse.json({ items, page })
}
