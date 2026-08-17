// V26 unification: app DB + search tables now share one Neon instance, so a
// single client serves both legislation and operational FTS (previously split
// across prismaSearch=Neon / prisma=Railway).
import { prisma } from '@/lib/prisma'
import { decodeForDisplay, decodeMaybe } from '@/lib/html-entities'

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

// ─────────────────────────────────────────────────────────────────────────────
// Prefix-aware tsquery builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the tsquery function name and query string for a given input.
 *
 * When the input ends with a space, all tokens are complete — use plainto_tsquery
 * which handles stemming, stop words, and spacing correctly.
 *
 * When the input does NOT end with a space, the last token may be mid-word.
 * Use to_tsquery with :* on the final token to enable prefix matching.
 * :* suffix enables prefix matching on final token — catches mid-word input without breaking completed queries
 *
 * Examples:
 *   "data protection "  → plainto_tsquery('english', 'data protection')
 *   "data prot"         → to_tsquery('english', 'data & prot:*')
 *   "employ"            → to_tsquery('english', 'employ:*')
 *
 * Note: to_tsquery with :* does not handle stop words in the completed tokens
 * as gracefully as plainto_tsquery. For the legislation search context (policy
 * and legal terms), single stop-word queries are unlikely. If a completed token
 * is a stop word it will be silently removed from the tsquery by PostgreSQL.
 */
function buildTsQuery(rawQ: string): { fn: 'plainto_tsquery' | 'to_tsquery'; queryStr: string } {
  // Completed input: ends with space — use plainto_tsquery
  if (rawQ.endsWith(' ')) {
    return { fn: 'plainto_tsquery', queryStr: rawQ.trim() }
  }

  const trimmed = rawQ.trim()

  // Sanitize: remove to_tsquery operator chars from individual tokens.
  // Prevents injection via special characters in the query string.
  const sanitize = (t: string) => t.replace(/[&|!():<>*\\]/g, '').trim()
  const tokens = trimmed.split(/\s+/).map(sanitize).filter(Boolean)

  if (tokens.length === 0) {
    return { fn: 'plainto_tsquery', queryStr: trimmed }
  }

  // :* suffix enables prefix matching on final token — catches mid-word input without breaking completed queries
  const tsQueryStr = tokens
    .map((tok, i) => (i === tokens.length - 1 ? `${tok}:*` : tok))
    .join(' & ')

  return { fn: 'to_tsquery', queryStr: tsQueryStr }
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
 * Prefix matching: when the raw query doesn't end with a space, the final token
 * gets :* appended for prefix matching (e.g. "data prot" matches "data protection").
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

  // Build prefix-aware tsquery (fn = 'plainto_tsquery' or 'to_tsquery')
  const { fn: tsqFn, queryStr: tsqStr } = buildTsQuery(q)

  // ── Legislation sections (rank-then-headline CTE) ────────────────────────
  if (type !== 'operational') {
    const params: unknown[] = [tsqStr]
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
          ts_rank_cd(ls."ftsVector", ${tsqFn}('english', $1)) AS rank
        FROM "LegislationSection" ls
        JOIN "LegislationItem" li ON ls."legislationItemId" = li.id
        WHERE ls."ftsVector" @@ ${tsqFn}('english', $1)
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
          ${tsqFn}('english', $1),
          'MaxFragments=2,MinWords=10,MaxWords=30,StartSel=<<,StopSel=>>'
        ) AS snippet
      FROM ranked
      WHERE rank >= ${minRank}
      ORDER BY rank DESC
    `

    // statement_timeout is a stall-guard: normal queries complete in <2s;
    // 8s only trips on a genuinely stuck DB or pathological query.
    // Legislation + operational both on Neon (V26 unification) — single client.
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '8000ms'`
      return tx.$queryRawUnsafe<LegRow[]>(sql, ...params)
    })
    // ⚠ THE LEGACY TABLES WERE NEVER IN THE 17 AUG REPAIR, AND THEY ARE DIRTIER THAN THE CORPUS.
    // That repair rewrote `corpus_sections`; these two tables were not touched, and measure
    // (17 Aug): `LegislationSection.sectionTitle` 1,838 rows, `originalText` 4,874,
    // `LegislationItem.title` 57 — mostly `&amp;c.`, the old statutory "&c." abbreviation, so a
    // section reads `Docks, &amp;c.` where the Act says `Docks, &c.`. `originalText` reaches a
    // user only through `ts_headline`, so decoding the SNIPPET covers it without rewriting the
    // column the FTS vector is derived from. Decoding stored text in place is a separate
    // decision — see the report.
    for (const r of rows) {
      results.push({
        type:          r.legislationType.toLowerCase(),
        actId:         r.actId,
        actTitle:      decodeForDisplay(r.actTitle),
        sectionId:     r.sectionId,
        sectionNumber: r.sectionNumber,
        title:         decodeMaybe(r.sectionTitle),
        snippet:       decodeForDisplay(r.snippet),
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
          ts_rank_cd(os."ftsVector", ${tsqFn}('english', $1)) AS rank
        FROM "OperationalSection" os
        JOIN "OperationalDocument" od ON os."operationalDocumentId" = od.id
        WHERE os."ftsVector" @@ ${tsqFn}('english', $1)
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
          ${tsqFn}('english', $1),
          'MaxFragments=2,MinWords=10,MaxWords=30,StartSel=<<,StopSel=>>'
        ) AS snippet
      FROM ranked
      WHERE rank >= ${minRank}
      ORDER BY rank DESC
    `

    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '8000ms'`
      return tx.$queryRawUnsafe<OpRow[]>(sql, tsqStr)
    })
    // Operational is the same shape and much smaller: `pageTitle` 2 rows, `extractedText` 12 —
    // `&#xA3;5,000` for `£5,000` in a sentencing-guideline page title, which is exactly the kind
    // of value a user reads as a number.
    for (const r of rows) {
      results.push({
        type:          'operational',
        actId:         r.docSlug,
        actTitle:      decodeForDisplay(`${r.publisherName} — ${r.docTitle}`),
        sectionId:     r.sectionId,
        sectionNumber: r.pageSlug,
        title:         decodeMaybe(r.pageTitle),
        snippet:       decodeForDisplay(r.snippet),
        rank:          Number(r.rank),
      })
    }
  }

  results.sort((a, b) => b.rank - a.rank)
  const page = results.slice(offset, offset + limit)
  return { results: page, totalMatches: results.length }
}
