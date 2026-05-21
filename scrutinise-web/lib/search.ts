import { prisma } from '@/lib/prisma'

export type SearchResult = {
  type:          string        // legislationType lowercase or 'operational'
  actId:         string        // machine ID: legislationGovUkId or sourceSlug
  actTitle:      string        // human-readable title of the parent act / document
  sectionId:     string
  sectionNumber: string
  title:         string | null // section title
  // 10-30 word fragment from ts_headline. Phase-1 grounding signal only —
  // sufficient for Lex to know the section exists and its topic, not for quoting wording.
  snippet:       string
  rank:          number        // ts_rank_cd — NOT bounded to 0-1; higher = more relevant
}

export type SearchFilters = {
  type?:   'ukpga' | 'uksi' | 'operational' | null
  year?:   number | null
  actId?:  string | null
}

// Raw row types
type LegRow = {
  sectionId:       string
  sectionNumber:   string
  sectionTitle:    string | null
  originalText:    string | null
  actId:           string
  actTitle:        string
  legislationType: string
  year:            number
  rank:            number | string
  snippet:         string
}

type OpRow = {
  sectionId:     string
  pageSlug:      string
  pageTitle:     string | null
  extractedText: string | null
  docSlug:       string
  docTitle:      string
  publisherName: string
  rank:          number | string
  snippet:       string
}

/**
 * Core FTS search across LegislationSection and OperationalSection.
 * Uses pre-computed GIN-indexed ftsVector columns (built by fts-migration.ts).
 *
 * Query pattern: rank-then-headline CTE.
 *   Inner CTE: ts_rank_cd on all GIN matches, ORDER BY rank LIMIT fetchLimit
 *   Outer SELECT: ts_headline only on ≤fetchLimit rows
 * This keeps ts_headline (expensive) off the full match set for common terms.
 *
 * totalMatches caveat: reports the window size (≤fetchLimit), not a true corpus
 * count. Sufficient for Lex grounding; a future search UI would need COUNT(*) per
 * source to show accurate totals.
 */
export async function searchLegislation(opts: {
  q:        string
  filters?: SearchFilters
  limit?:   number
  offset?:  number
  minRank?: number
}): Promise<{ results: SearchResult[]; totalMatches: number }> {
  const {
    q,
    filters  = {},
    limit    = 20,
    offset   = 0,
    minRank  = 0.05,
  } = opts

  const { type, year, actId } = filters
  const results: SearchResult[] = []
  // Fetch enough rows pre-merge so we have headroom after offset
  const fetchLimit = limit + offset

  // ── Legislation sections (rank-then-headline CTE) ────────────────────────
  if (type !== 'operational') {
    const params: unknown[] = [q]
    let p = 2
    const extra: string[] = []

    if (type === 'ukpga') {
      extra.push(`li."legislationType"::text = $${p++}`)
      params.push('UKPGA')
    } else if (type === 'uksi') {
      extra.push(`li."legislationType"::text = $${p++}`)
      params.push('UKSI')
    }
    if (year) {
      extra.push(`li.year = $${p++}`)
      params.push(year)
    }
    if (actId) {
      extra.push(`li."legislationGovUkId" = $${p++}`)
      params.push(actId)
    }

    const extraWhere = extra.length ? 'AND ' + extra.join(' AND ') : ''

    // CTE ranks all GIN matches and limits to fetchLimit rows before ts_headline runs.
    // minRank and fetchLimit are Zod-validated numbers — safe to inline.
    const sql = `
      WITH ranked AS (
        SELECT
          ls.id                       AS "sectionId",
          ls."sectionNumber",
          ls."sectionTitle",
          ls."originalText",
          li."legislationGovUkId"     AS "actId",
          li.title                    AS "actTitle",
          li."legislationType"::text  AS "legislationType",
          li.year,
          ts_rank_cd(ls."ftsVector", plainto_tsquery('english', $1)) AS rank
        FROM "LegislationSection" ls
        JOIN "LegislationItem" li ON ls."legislationItemId" = li.id
        WHERE ls."ftsVector" @@ plainto_tsquery('english', $1)
          ${extraWhere}
        ORDER BY rank DESC
        LIMIT ${fetchLimit}
      )
      SELECT
        "sectionId",
        "sectionNumber",
        "sectionTitle",
        "actId",
        "actTitle",
        "legislationType",
        year,
        rank,
        ts_headline(
          'english',
          coalesce("sectionTitle", '') || ' ' || coalesce("originalText", ''),
          plainto_tsquery('english', $1),
          'MaxFragments=2,MinWords=10,MaxWords=30,StartSel=<<,StopSel=>>'
        ) AS snippet
      FROM ranked
      WHERE rank >= ${minRank}
      ORDER BY rank DESC
    `

    // statement_timeout is a stall-guard: normal queries complete in <2s;
    // 8s only trips on a genuinely stuck DB or pathological query.
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '8000ms'`
      return tx.$queryRawUnsafe<LegRow[]>(sql, ...params)
    })
    for (const r of rows) {
      results.push({
        type:          r.legislationType.toLowerCase(),
        actId:         r.actId,
        actTitle:      r.actTitle,
        sectionId:     r.sectionId,
        sectionNumber: r.sectionNumber,
        title:         r.sectionTitle,
        snippet:       r.snippet,
        rank:          Number(r.rank),
      })
    }
  }

  // ── Operational sections (rank-then-headline CTE) ────────────────────────
  if (!type || type === 'operational') {
    const sql = `
      WITH ranked AS (
        SELECT
          os.id               AS "sectionId",
          os."pageSlug",
          os."pageTitle",
          os."extractedText",
          od."sourceSlug"     AS "docSlug",
          od.title            AS "docTitle",
          od."publisherName",
          ts_rank_cd(os."ftsVector", plainto_tsquery('english', $1)) AS rank
        FROM "OperationalSection" os
        JOIN "OperationalDocument" od ON os."operationalDocumentId" = od.id
        WHERE os."ftsVector" @@ plainto_tsquery('english', $1)
        ORDER BY rank DESC
        LIMIT ${fetchLimit}
      )
      SELECT
        "sectionId",
        "pageSlug",
        "pageTitle",
        "docSlug",
        "docTitle",
        "publisherName",
        rank,
        ts_headline(
          'english',
          coalesce("pageTitle", '') || ' ' || coalesce("extractedText", ''),
          plainto_tsquery('english', $1),
          'MaxFragments=2,MinWords=10,MaxWords=30,StartSel=<<,StopSel=>>'
        ) AS snippet
      FROM ranked
      WHERE rank >= ${minRank}
      ORDER BY rank DESC
    `

    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '8000ms'`
      return tx.$queryRawUnsafe<OpRow[]>(sql, q)
    })
    for (const r of rows) {
      results.push({
        type:          'operational',
        actId:         r.docSlug,
        actTitle:      `${r.publisherName} — ${r.docTitle}`,
        sectionId:     r.sectionId,
        sectionNumber: r.pageSlug,
        title:         r.pageTitle,
        snippet:       r.snippet,
        rank:          Number(r.rank),
      })
    }
  }

  results.sort((a, b) => b.rank - a.rank)
  const page = results.slice(offset, offset + limit)
  return { results: page, totalMatches: results.length }
}
