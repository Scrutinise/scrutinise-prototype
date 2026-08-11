// fts-search.ts — PLATFORM-SIDE adapter: the platform calls FTS (Lex never does).
//
// Joins keywords[] → a query, calls the FTS serving endpoint (POST /fts-search,
// fts-serve on Railway), and maps native FTS hits → the Lex SearchResult contract
// (page1-config.ts §8.3) so the field-machine swap is one line:
//     const { results } = runStubSearch(keywords, 12)
//   → const { results } = await runFtsSearch(keywords, 12)
//
// Mapping (per the brief):
//   id, snippet, score → direct
//   type   → corpusToType(corpus, tier, id)  [corpus-type-map.ts; nulls dropped]
//   title, citation → legislation: act title from the id's gid → LegislationItem.title;
//                     everything else: the FTS sectionTitle
//   url, date → ONE batched `WHERE id IN` over corpus_sections (sourceUrl + itemDate);
//               legislation url also derivable from the id (gid + section ref).
//
// Resilient: any failure (endpoint unset/down, bad payload) falls back to the stub so
// the Lex create flow never breaks. The swap stays one line regardless.

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { flagEnabled } from '@/lib/env-flags'
import type { SearchResult } from './page1-config'
import { corpusToType, corpusDisplayName, dbTitleSupersedesIndex } from './corpus-type-map'
import { annotatedGidFromId, annotationTitle, isAnnotationCorpus } from './annotation-title'
import { gidFromId, refFromId, refToCitation, resolveResultUrl } from './legislation-url'
import { runStubSearch } from './search-stub'

// Native shape returned by fts-query-service.ts (body stripped on the wire).
interface FtsHit {
  id: string
  corpus: string
  tier: string
  jurisdiction: string
  sectionTitle: string | null
  itemDate: string | null
  speaker: string | null
  parentDocId: string | null
  score: number
  snippet: string
}

const FTS_URL = process.env.FTS_SEARCH_URL // e.g. https://fts-serve-production-xxxx.up.railway.app
// 25s default: the FIRST query after a serve-service (re)deploy is cold — LanceDB
// fetches the FTS index files from R2 on first touch (~15s observed), which blew the
// old 8s budget and silently fell back to the stub. The service now self-warms at
// boot (fts-query-service.ts) so this is belt-and-braces for the redeploy window.
const FTS_TIMEOUT_MS = parseInt(process.env.FTS_TIMEOUT_MS ?? '25000', 10)

// ── citation/url derivation for legislation ──────────────────────────────────
// §19-D Task 5: this moved to lib/lex/legislation-url.ts, shared with
// vector-search.ts and covered by `npm run check:legislation-urls`. The stored
// `sourceUrl` on the legislation corpora 404s (it pastes the hyphenated ref token
// straight onto the act URL), so for those types the DERIVED url now wins.

// ── the adapter ──────────────────────────────────────────────────────────────

/** Server-side stream scope. `corpora` restricts, `excludeCorpora` removes; both are
 *  PREfilters applied at the query, not filters applied to the response. */
export interface FtsScope { tier?: string; corpora?: string[]; excludeCorpora?: string[] }

async function callFts(query: string, limit: number, scope: FtsScope = {}): Promise<FtsHit[]> {
  if (!FTS_URL) throw new Error('FTS_SEARCH_URL not set')
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), FTS_TIMEOUT_MS)
  try {
    const res = await fetch(`${FTS_URL.replace(/\/$/, '')}/fts-search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query, limit,
        ...(scope.tier ? { tier: scope.tier } : {}),
        ...(scope.corpora?.length ? { corpora: scope.corpora } : {}),
        ...(scope.excludeCorpora?.length ? { excludeCorpora: scope.excludeCorpora } : {}),
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`FTS ${res.status}: ${await res.text()}`)
    const json = (await res.json()) as { results?: FtsHit[]; corpora?: string[] | null; excludeCorpora?: string[] | null }

    // DEGRADE, DO NOT FAIL, on an unhonoured CORPUS scope — deliberately unlike the tier check
    // in vector-search.ts, and the difference is worth stating because the two look alike.
    //
    // `fts-serve` deploys independently of this app, so between shipping this and redeploying
    // the service there is a window where the service ignores `corpora` and returns the whole
    // tier. Failing closed there would take the committees AND debates streams down to zero
    // results for the length of that window — a self-inflicted outage to prevent a defect that
    // is merely today's behaviour.
    //
    // It is safe to degrade because correctness does not rest on this filter: query-router.ts
    // still applies the `types` post-filter to whatever comes back, so an unscoped response
    // yields correctly-typed results, just fewer of them — exactly what shipped before this
    // change. The prefilter is a RECALL improvement, not a correctness guarantee, so its
    // absence should cost recall and nothing else. (The vector tier check must stay fail-closed:
    // for legislation there is no `types` backstop, so an unscoped ANN result really would put
    // another tier's content in front of a user.)
    const sameList = (a?: string[] | null, b?: string[]) =>
      JSON.stringify([...(a ?? [])].sort()) === JSON.stringify([...(b ?? [])].sort())
    if (scope.corpora?.length && !sameList(json.corpora, scope.corpora)) {
      console.warn(`[fts-search] service did not honour corpora=${JSON.stringify(scope.corpora)} (echoed ${JSON.stringify(json.corpora)}) — falling back to client-side type filtering; REDEPLOY fts-serve to restore the prefilter`)
    }
    if (scope.excludeCorpora?.length && !sameList(json.excludeCorpora, scope.excludeCorpora)) {
      console.warn(`[fts-search] service did not honour excludeCorpora=${JSON.stringify(scope.excludeCorpora)} — falling back to client-side type filtering; REDEPLOY fts-serve`)
    }
    return json.results ?? []
  } finally {
    clearTimeout(t)
  }
}

/**
 * Real FTS search → SearchResult[].
 *
 * §19-C Task 1a — NO SILENT STUB IN PRODUCTION. This used to fall back to
 * `runStubSearch` on any failure, which is how a data-protection idea ended up with
 * Road Traffic Act 1988 in its panel, in its briefing prose ("the law … is anchored
 * by Road Traffic Act 1988") and in its seeded causes. The fixture is indistinguishable
 * from real research to the reader.
 *
 * // An honest "no answer" is always safer than plausible wrong law.
 *
 * A failure now returns `{ results: [], failed: true, reason }` and every caller is
 * responsible for saying so. The stub survives only for local development, behind an
 * explicit opt-in (`LEX_SEARCH_STUB=true`), and refuses to arm itself in production.
 */
const STUB_ENABLED = flagEnabled('LEX_SEARCH_STUB') && process.env.VERCEL_ENV !== 'production'

export interface FtsSearchOutcome {
  results: SearchResult[]
  /** True when the search could not be completed — NOT the same as "no matches". */
  failed?: boolean
  reason?: string
}

export async function runFtsSearch(
  keywords: string[],
  limit = 12,
  /** string = tier only (the original signature, still used by every unscoped caller);
   *  object = full server-side stream scope. */
  scope?: string | FtsScope,
): Promise<FtsSearchOutcome> {
  const query = keywords.map((k) => k.trim()).filter(Boolean).join(' ')
  if (!query) return { results: [] }
  const sc: FtsScope = typeof scope === 'string' ? { tier: scope } : (scope ?? {})

  try {
    // Overscan: nulls (guidance/bill/treaty/EU) get dropped, so ask for more.
    const hits = await callFts(query, Math.max(limit * 3, 30), sc)
    if (!hits.length) return { results: [] }

    // Keep only hits that map to a Lex type; remember the type per id.
    const typed = hits
      .map((h) => ({ h, type: corpusToType(h.corpus, h.tier, h.id) }))
      .filter((x): x is { h: FtsHit; type: NonNullable<ReturnType<typeof corpusToType>> } => x.type !== null)
    if (!typed.length) return { results: [] }

    const ids = typed.map((x) => x.h.id)
    // Two sources of gid, kept apart on purpose. `gidFromId` reads segment 1 and is what every
    // ordinary legislation result uses; `annotatedGidFromId` reads segment 2 and fires ONLY for
    // the annotation corpora (S2C2 §2). They are unioned for the single batched title lookup, so
    // the extra titles cost no extra round-trip — but the two are consumed by different branches
    // below, and an annotation never takes the `isLeg` path.
    const gids = Array.from(new Set([
      ...typed.map((x) => gidFromId(x.h.id)),
      ...typed.map((x) => (isAnnotationCorpus(x.h.corpus) ? annotatedGidFromId(x.h.id) : null)),
    ].filter((g): g is string => !!g)))

    // ONE batched hydrate (url + date) + the legislation act-title lookup.
    const [hydrateRows, actRows] = await Promise.all([
      // `sectionTitle` is selected as well as the url/date this hydrate has always fetched: for
      // a few collections the DB title supersedes the one baked into the FTS index
      // (dbTitleSupersedesIndex — see corpus-type-map.ts). Same query, one more column, no extra
      // round-trip.
      prisma.$queryRaw<Array<{ id: string; sourceUrl: string | null; itemDate: string | null; sectionTitle: string | null }>>`
        SELECT id, "sourceUrl", "itemDate"::text AS "itemDate", "sectionTitle"
        FROM corpus_sections WHERE id IN (${Prisma.join(ids)})`,
      // Act titles come from `corpus_acts`, not the legacy `LegislationItem` (V26 §6 —
      // that table is slated for DROP). Verified zero-gap drop-in: 135,531 titled
      // corpus_acts rows vs 135,531 distinct LegislationItem gid→title, 0 missing,
      // 0 differing. corpus_acts is a SUPERSET (250,808 rows) whose extra rows carry
      // title NULL, so `title: { not: null }` reproduces the old result set exactly.
      gids.length
        ? prisma.corpusAct.findMany({
            where: { gid: { in: gids }, title: { not: null } },
            select: { gid: true, title: true },
          })
        : Promise.resolve([] as Array<{ gid: string; title: string | null }>),
    ])
    const hydrate = new Map(hydrateRows.map((r) => [r.id, r]))
    const actTitle = new Map(actRows.flatMap((r) => (r.title ? [[r.gid, r.title] as const] : [])))

    const results: SearchResult[] = typed.map(({ h, type }) => {
      const meta = hydrate.get(h.id)
      const gid = gidFromId(h.id)
      const ref = refFromId(h.id)
      // gid-bearing legislation types: derive title/citation/url from the gid + ref.
      const isLeg =
        type === 'PRIMARY_LEGISLATION' || type === 'STATUTORY_INSTRUMENT' || type === 'EU_LEGISLATION'

      let title: string
      let citation: string
      if (isLeg && gid && actTitle.get(gid)) {
        const act = actTitle.get(gid)!
        title = act
        const abbr = refToCitation(ref)
        citation = abbr ? `${act}, ${abbr}` : act
      } else if (isAnnotationCorpus(h.corpus)) {
        // Name the Act the note explains, not the gid. Falls back to what this branch would
        // otherwise have produced, so an unresolved gid costs nothing.
        const annGid = annotatedGidFromId(h.id)
        const named = annotationTitle(h.corpus, annGid ? actTitle.get(annGid) : null, h.sectionTitle ?? corpusDisplayName(h.corpus))
        title = named.title
        citation = named.citation
      } else {
        // The DB title wins ONLY for the named collections; everything else reads the index
        // exactly as it always did, which is what keeps this function byte-identical for every
        // other corpus (asserted by check:annotation-titles).
        const preferred = dbTitleSupersedesIndex(h.corpus)
          ? (meta?.sectionTitle ?? h.sectionTitle)
          : h.sectionTitle
        title = preferred ?? corpusDisplayName(h.corpus)
        citation = preferred ?? ''
      }

      // §19-D Task 5 — for legislation the derived URL WINS over the stored one.
      // `sourceUrl` is non-null on 100% of legislation rows and 404s on ~92% of
      // them (measured), so the old `sourceUrl ?? derived` could never reach the
      // working form. Every other corpus keeps its stored url untouched.
      const url = resolveResultUrl(type, h.id, meta?.sourceUrl)
      const date = meta?.itemDate ?? h.itemDate ?? ''

      // `scorer: 'bm25'` — raw BM25 from the FTS service, comparable only with other BM25
      // scores from the same index. score-scope.ts is what stops it being compared with an
      // RRF score three orders of magnitude smaller.
      return { id: h.id, type, title, citation, snippet: h.snippet, score: h.score, scorer: 'bm25' as const, url, date }
    })

    return { results: results.slice(0, limit * 3) } // groupForPanel caps downstream
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    if (STUB_ENABLED) {
      console.warn('[fts-search] DEV stub fallback (LEX_SEARCH_STUB=true):', reason)
      return { ...runStubSearch(keywords, limit), failed: false }
    }
    // Honest failure. The caller must surface this, never paper over it.
    console.error('[fts-search] search failed — returning empty, NOT a stub:', reason)
    return { results: [], failed: true, reason }
  }
}
