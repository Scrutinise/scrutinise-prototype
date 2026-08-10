// vector-search.ts — PLATFORM-SIDE adapter for DENSE (vector) retrieval. The vector
// analogue of fts-search.ts: POSTs to the vector serve endpoint (vector-query-service
// on Railway/Hetzner), maps hits → the Lex SearchResult contract (page1-config §8.3),
// and hydrates title/citation/url/date the same way fts-search does.
//
// INERT by construction: gated behind the OFF-by-default LEX_SEARCH_VECTOR flag in the
// gateway AND `VECTOR_SEARCH_URL` being unset → returns [] so the flow is unchanged.
// Resilient: any failure returns [] (the gateway still has the BM25 path).
//
// Fusion with BM25 is NOT done here — the gateway owns it (the pilot showed naive
// equal-weight RRF hurts strong models; the weighting must be tuned on the gold set
// before the flag is flipped). This adapter returns vector-alone results.

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { SearchResult } from './page1-config'
import { corpusToType, corpusDisplayName } from './corpus-type-map'
import { annotatedGidFromId, annotationTitle, isAnnotationCorpus } from './annotation-title'

interface VecHit { id: string; corpus: string; tier: string; score: number; snippet: string }

const VECTOR_URL = process.env.VECTOR_SEARCH_URL
const VECTOR_TIMEOUT_MS = parseInt(process.env.VECTOR_TIMEOUT_MS ?? '25000', 10)

// ── citation/url derivation (identical to fts-search.ts) ──────────────────────
function gidFromId(id: string): string | null {
  const parts = id.split(':')
  const gid = parts.length >= 2 ? parts[1] : null
  return gid && gid.includes('/') ? gid : null
}
function refFromId(id: string): string {
  const parts = id.split(':')
  if (parts.length < 3) return ''
  const ref = parts.slice(2).join(':').trim()
  return !ref || ref === 'full' ? '' : ref.replace(/[.\s]+$/g, '')
}
const REF_ABBR: Record<string, string> = { section: 's.', regulation: 'reg.', article: 'art.', schedule: 'sch.', paragraph: 'para.' }
function refToCitation(ref: string): string {
  if (!ref) return ''
  const segs = ref.split('-')
  const out: string[] = []
  for (let i = 0; i < segs.length; i++) {
    const abbr = REF_ABBR[segs[i].toLowerCase()]
    if (abbr && i + 1 < segs.length) { out.push(abbr + segs[i + 1]); i++ }
  }
  return out.join(' ')
}
function legislationUrl(gid: string, ref: string): string {
  const base = `https://www.legislation.gov.uk/${gid}`
  return ref ? `${base}/${ref.replace(/-/g, '/')}` : base
}

/** Server-side stream scope — the dense twin of fts-search.ts's FtsScope. */
export interface VectorScope { tier?: string; corpora?: string[]; excludeCorpora?: string[] }

async function callVector(query: string, limit: number, scope: VectorScope = {}): Promise<VecHit[]> {
  if (!VECTOR_URL) throw new Error('VECTOR_SEARCH_URL not set')
  const { tier, corpora, excludeCorpora } = scope
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), VECTOR_TIMEOUT_MS)
  try {
    const res = await fetch(`${VECTOR_URL.replace(/\/$/, '')}/vector-search`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query, limit,
        ...(tier ? { tier } : {}),
        ...(corpora?.length ? { corpora } : {}),
        ...(excludeCorpora?.length ? { excludeCorpora } : {}),
      }), signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`vector ${res.status}: ${await res.text()}`)
    const json = (await res.json()) as { results?: VecHit[]; tier?: string | null; corpora?: string[] | null; excludeCorpora?: string[] | null }
    // A service too old to know about `tier` would ignore it and return the whole corpus,
    // which would silently widen a stream-scoped search into an unscoped one. Fail closed:
    // a scoped call that cannot be proven scoped returns nothing and the BM25 path stands.
    if (tier && json.tier !== tier) {
      throw new Error(`vector service did not honour tier="${tier}" (echoed ${JSON.stringify(json.tier)}) — refusing unscoped results`)
    }
    // The CORPUS scope degrades rather than failing, unlike the tier check above. Same reasoning
    // as fts-search.ts: query-router.ts still applies the `types` post-filter to the dense half,
    // so an unscoped response costs recall, not correctness — whereas an unhonoured TIER can put
    // another tier's content in front of a user with no backstop at all. Keeping the two
    // different is deliberate; collapsing them would either weaken the tier guarantee or turn a
    // service-version skew into an outage.
    const sameList = (a?: string[] | null, b?: string[]) =>
      JSON.stringify([...(a ?? [])].sort()) === JSON.stringify([...(b ?? [])].sort())
    if (corpora?.length && !sameList(json.corpora, corpora)) {
      console.warn(`[vector-search] service did not honour corpora=${JSON.stringify(corpora)} (echoed ${JSON.stringify(json.corpora)}) — dense half is tier-scoped only; redeploy the vector service`)
    }
    if (excludeCorpora?.length && !sameList(json.excludeCorpora, excludeCorpora)) {
      console.warn(`[vector-search] service did not honour excludeCorpora=${JSON.stringify(excludeCorpora)} — dense half is tier-scoped only; redeploy the vector service`)
    }
    return json.results ?? []
  } finally { clearTimeout(t) }
}

/**
 * Dense search → SearchResult[]. Returns [] on any failure or if the flag/URL is unset.
 *
 * `tier` scopes the search to one stream. It is a server-side PREfilter over corpus_vec, not a
 * filter applied to the results here — filtering after the fact would return whatever fraction
 * of an unscoped ANN result happened to be in-tier (legislation is 8.6% of the index), which
 * reads as weak recall rather than as a mistake.
 */
export async function runVectorSearch(
  keywords: string[],
  limit = 12,
  /** string = tier only (the original signature); object = full server-side stream scope. */
  scope?: string | VectorScope,
): Promise<{ results: SearchResult[] }> {
  const query = keywords.map((k) => k.trim()).filter(Boolean).join(' ')
  if (!query || !VECTOR_URL) return { results: [] }
  const sc: VectorScope = typeof scope === 'string' ? { tier: scope } : (scope ?? {})
  try {
    const hits = await callVector(query, Math.max(limit * 3, 30), sc)
    if (!hits.length) return { results: [] }
    const typed = hits
      .map((h) => ({ h, type: corpusToType(h.corpus, h.tier, h.id) }))
      .filter((x): x is { h: VecHit; type: NonNullable<ReturnType<typeof corpusToType>> } => x.type !== null)
    if (!typed.length) return { results: [] }

    const ids = typed.map((x) => x.h.id)
    // Same two-source union as fts-search.ts, and for the same reason: the dense path is LIVE on
    // the legislation stream (LEX_VECTOR_STREAMS=legislation), so an annotation found by the ANN
    // half must not be titled differently from the same row found by BM25.
    const gids = Array.from(new Set([
      ...typed.map((x) => gidFromId(x.h.id)),
      ...typed.map((x) => (isAnnotationCorpus(x.h.corpus) ? annotatedGidFromId(x.h.id) : null)),
    ].filter((g): g is string => !!g)))
    const [hydrateRows, actRows] = await Promise.all([
      prisma.$queryRaw<Array<{ id: string; sourceUrl: string | null; itemDate: string | null; sectionTitle: string | null }>>`
        SELECT id, "sourceUrl", "itemDate"::text AS "itemDate", "sectionTitle"
        FROM corpus_sections WHERE id IN (${Prisma.join(ids)})`,
      // Act titles come from `corpus_acts`, NOT the legacy `LegislationItem`
      // (V26 §6: that table is to be dropped, and this path is about to go live —
      // pointing it at LegislationItem would add a new caller to a doomed table).
      // Verified zero-gap drop-in: 135,531 titled corpus_acts rows vs 135,531
      // distinct LegislationItem gid→title, 0 gids missing, 0 titles differing.
      // corpus_acts is a SUPERSET (250,808 rows) whose extra rows carry title NULL,
      // so `title: { not: null }` reproduces exactly the old result set — the
      // untitled rows would otherwise arrive as nulls and fall through to the
      // sectionTitle branch anyway, but filtering keeps the map's type honest.
      gids.length
        ? prisma.corpusAct.findMany({ where: { gid: { in: gids }, title: { not: null } }, select: { gid: true, title: true } })
        : Promise.resolve([] as Array<{ gid: string; title: string | null }>),
    ])
    const hydrate = new Map(hydrateRows.map((r) => [r.id, r]))
    const actTitle = new Map(actRows.flatMap((r) => (r.title ? [[r.gid, r.title] as const] : [])))

    const results: SearchResult[] = typed.map(({ h, type }) => {
      const meta = hydrate.get(h.id)
      const gid = gidFromId(h.id)
      const ref = refFromId(h.id)
      const isLeg = type === 'PRIMARY_LEGISLATION' || type === 'STATUTORY_INSTRUMENT' || type === 'EU_LEGISLATION'
      let title: string
      let citation: string
      if (isLeg && gid && actTitle.get(gid)) {
        const act = actTitle.get(gid)!
        title = act
        const abbr = refToCitation(ref)
        citation = abbr ? `${act}, ${abbr}` : act
      } else if (isAnnotationCorpus(h.corpus)) {
        const annGid = annotatedGidFromId(h.id)
        const named = annotationTitle(h.corpus, annGid ? actTitle.get(annGid) : null, meta?.sectionTitle ?? corpusDisplayName(h.corpus))
        title = named.title
        citation = named.citation
      } else {
        title = meta?.sectionTitle ?? corpusDisplayName(h.corpus)
        citation = meta?.sectionTitle ?? ''
      }
      const url = meta?.sourceUrl ?? (isLeg && gid ? legislationUrl(gid, ref) : '')
      const date = meta?.itemDate ?? ''
      // `scorer: 'vector'` — cosine similarity (0..1), not BM25 and not RRF. Distinct from
      // 'bm25' because a 0.83 and a 12.4 are not two views of the same quantity.
      return { id: h.id, type, title, citation, snippet: h.snippet, score: h.score, scorer: 'vector' as const, url, date }
    })
    return { results: results.slice(0, limit * 3) }
  } catch (err) {
    console.warn('[vector-search] returning empty (fallback to BM25):', err instanceof Error ? err.message : err)
    return { results: [] }
  }
}
