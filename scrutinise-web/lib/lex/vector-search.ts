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
import { isPoliticalCorpus, politicalTitle } from './political-title'
// §19-D Task 5 — one shared derivation with fts-search.ts. It used to be copied into
// both files, so the 404 bug was present twice and fixable only twice.
import { gidFromId, refFromId, refToCitation, resolveResultUrl } from './legislation-url'
import { decodeForDisplay, decodeMaybe } from '@/lib/html-entities'
import { attributionFor } from './attribution'

// S13 §3 — `chunkId` is WHICH chunk the ANN matched, and `snippetMatched`/`snippetLocation` are
// the provenance of `snippet`. All three are optional: a `vector-serve` build older than this
// sprint sends none of them, and that state must stay distinguishable from "sent, and false".
interface VecHit {
  id: string; corpus: string; tier: string; score: number; snippet: string
  snippetMatched?: boolean; snippetLocation?: string | null; chunkId?: string
}

const VECTOR_URL = process.env.VECTOR_SEARCH_URL

/**
 * ⚠⚠ A COLD-START ALLOWANCE, NOT A LATENCY TARGET. See `FTS_COLD_START_MS` for the full
 * reasoning; the same rule applies here and the measurement is worse.
 *
 * Restart → first SERVED QUERY on `vector-serve` was **13.5 s** (27 Aug 2026), and
 * `/health` answered at **6.7 s** — a **6.8 second gap** in which the container is up, the
 * health check is green, and a search still fails. Nearly half the wait happens after the
 * thing most people would have measured. Sizing from `/health` would have set this budget
 * at half what it needs to be.
 *
 * 75 s is ~5.5× the measured figure, because a restart is a proxy for a wake and a wake
 * schedules a container from cold.
 */
export const VECTOR_COLD_START_MS = 75_000
const VECTOR_TIMEOUT_MS = parseInt(process.env.VECTOR_TIMEOUT_MS ?? String(VECTOR_COLD_START_MS), 10)

/** Server-side stream scope — the dense twin of fts-search.ts's FtsScope. */
export interface VectorScope { tier?: string; corpora?: string[]; excludeCorpora?: string[] }

/**
 * ⚠⚠ S15 §3 — WHY A DENSE FAILURE NOW HAS A NAME.
 *
 * S14 §0's sharpest finding was that this layer left no mark: `mergeLegs` returned the BM25 list
 * and every hit kept `scorer: 'bm25'`, which is byte-for-byte what a stream with no dense leg
 * produces. So *"dense retrieval is off"* and *"dense retrieval timed out on every call"* were
 * indistinguishable from the result object — and a result object is where a measurement reads
 * them. Four streams all returning at the 25 s client timeout looked exactly like four streams
 * that were never configured for dense at all.
 *
 * `overloaded` is separated from `timeout` and from `error` deliberately, and it is the one that
 * matters for `SEARCH_CONTRACT.md` §6's never-claim rule: a saturated service is a **stated gap**
 * — we could not look — whereas a genuine empty result is a finding. `CLAUDE.md` §18's corollary
 * says a degradation must announce itself with its cause attached; this is the cause.
 */
export type VectorFailureReason = 'overloaded' | 'timeout' | 'unreachable' | 'error' | 'unscoped'
export interface VectorFailure { reason: VectorFailureReason; detail: string }

/** Thrown by `callVector` so the reason survives the boundary instead of becoming `[]`. */
class VectorCallError extends Error {
  constructor(readonly reason: VectorFailureReason, message: string) { super(message) }
}

async function callVector(query: string, limit: number, scope: VectorScope = {}): Promise<VecHit[]> {
  if (!VECTOR_URL) throw new VectorCallError('unreachable', 'VECTOR_SEARCH_URL not set')
  const { tier, corpora, excludeCorpora } = scope
  const ctrl = new AbortController()
  // ⚠ S15 — the abort is recorded rather than inferred. `AbortError` on the fetch could come
  // from our own deadline or from the caller's request being cancelled, and only the first is
  // a `timeout` worth telling the user about.
  let timedOut = false
  const t = setTimeout(() => { timedOut = true; ctrl.abort() }, VECTOR_TIMEOUT_MS)
  try {
    const res = await fetch(`${VECTOR_URL.replace(/\/$/, '')}/vector-search`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query, limit,
        ...(tier ? { tier } : {}),
        ...(corpora?.length ? { corpora } : {}),
        ...(excludeCorpora?.length ? { excludeCorpora } : {}),
      }), signal: ctrl.signal,
    }).catch((e) => {
      if (timedOut) throw new VectorCallError('timeout', `vector search timed out after ${VECTOR_TIMEOUT_MS} ms`)
      throw new VectorCallError('unreachable', (e as Error).message)
    })
    if (!res.ok) {
      const text = await res.text()
      // ⚠ 503 IS NOT AN ERROR — IT IS THE SERVICE REFUSING HONESTLY (§3). The bounded queue
      // sheds rather than admitting a request whose wait would outlive the caller, and that
      // refusal is information. Treating it as a generic failure would throw the information
      // away at the one boundary that can still act on it.
      if (res.status === 503) throw new VectorCallError('overloaded', `vector service saturated: ${text.slice(0, 200)}`)
      throw new VectorCallError('error', `vector ${res.status}: ${text.slice(0, 200)}`)
    }
    const json = (await res.json()) as { results?: VecHit[]; tier?: string | null; corpora?: string[] | null; excludeCorpora?: string[] | null }
    // A service too old to know about `tier` would ignore it and return the whole corpus,
    // which would silently widen a stream-scoped search into an unscoped one. Fail closed:
    // a scoped call that cannot be proven scoped returns nothing and the BM25 path stands.
    if (tier && json.tier !== tier) {
      throw new VectorCallError('unscoped', `vector service did not honour tier="${tier}" (echoed ${JSON.stringify(json.tier)}) — refusing unscoped results`)
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
    // The dense twin of the decode in fts-search.ts, and it is here for the same reason the title
    // derivation is duplicated: a document found by the ANN half must not READ differently from
    // the same document found by BM25. One unscoped probe of the live vector service returned 1
    // contaminated snippet in 50. Only `snippet` is text — `id`/`corpus`/`tier` are keys.
    return (json.results ?? []).map((h) => ({ ...h, snippet: decodeForDisplay(h.snippet ?? '') }))
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
): Promise<{ results: SearchResult[]; failure?: VectorFailure }> {
  const query = keywords.map((k) => k.trim()).filter(Boolean).join(' ')
  // ⚠ NOT CONFIGURED IS NOT FAILED. An unset `VECTOR_SEARCH_URL` means dense retrieval was
  // never attempted, which is a configuration state and not a gap to tell a user about —
  // exactly the distinction CLAUDE.md §18's corollary is about, one layer up from the router.
  if (!query || !VECTOR_URL) return { results: [] }
  const sc: VectorScope = typeof scope === 'string' ? { tier: scope } : (scope ?? {})
  try {
    const hits = await callVector(query, Math.max(limit * 3, 30), sc)
    return { results: await hydrateVecHits(hits, limit) }
  } catch (err) {
    // ⚠ STILL FALLS BACK TO BM25 — the ranking is unchanged and no user loses a result they
    // would otherwise have had. What changes is that the fallback now CARRIES ITS REASON, so
    // the caller can distinguish a stream that had no dense leg from one whose dense leg was
    // refused. S14 §0 is what the silent version cost.
    const reason: VectorFailureReason = err instanceof VectorCallError ? err.reason : 'error'
    const detail = err instanceof Error ? err.message : String(err)
    console.warn(`[vector-search] dense leg DEGRADED (${reason}) — falling back to BM25:`, detail)
    return { results: [], failure: { reason, detail } }
  }
}

/**
 * Wire hits → the canonical `SearchResult[]`: typing, title/citation derivation, URL, date and
 * attribution.
 *
 * ⚠ S15 §4 — EXTRACTED SO THE BATCH PATH CANNOT DRIFT FROM THE SOLO PATH. There is exactly one
 * construction site for a dense `SearchResult`, which is the same reasoning that keeps
 * `political-title.ts` one file: a document found through the batch endpoint must not be titled,
 * dated or attributed differently from the same document found through a single call, or the
 * batch would be a ranking change wearing a transport change's clothes.
 */
async function hydrateVecHits(hits: VecHit[], limit: number): Promise<SearchResult[]> {
  {
    if (!hits.length) return []
    const typed = hits
      .map((h) => ({ h, type: corpusToType(h.corpus, h.tier, h.id) }))
      .filter((x): x is { h: VecHit; type: NonNullable<ReturnType<typeof corpusToType>> } => x.type !== null)
    if (!typed.length) return []

    const ids = typed.map((x) => x.h.id)
    // Same two-source union as fts-search.ts, and for the same reason: the dense path is LIVE on
    // the legislation stream (LEX_VECTOR_STREAMS=legislation), so an annotation found by the ANN
    // half must not be titled differently from the same row found by BM25.
    const gids = Array.from(new Set([
      ...typed.map((x) => gidFromId(x.h.id)),
      ...typed.map((x) => (isAnnotationCorpus(x.h.corpus) ? annotatedGidFromId(x.h.id) : null)),
    ].filter((g): g is string => !!g)))
    const [hydrateRows, actRows] = await Promise.all([
      // The S2C6 §1 columns, identical to fts-search.ts's hydrate — see the note there. Kept in
      // step deliberately: a division found by the ANN half must not be titled differently from
      // the same row found by BM25, which is the whole reason political-title.ts is one file.
      // ⚠ `speaker` added for S8 §2, in step with fts-search.ts. The dense half is live on
      // whichever streams `LEX_VECTOR_STREAMS` names, so a debate found by the ANN half must
      // not lose the speaker the same row keeps when BM25 finds it.
      prisma.$queryRaw<Array<{ id: string; sourceUrl: string | null; itemDate: string | null; sectionTitle: string | null; attribution: string | null; speaker: string | null; parentTitle: string | null }>>`
        SELECT s.id, s."sourceUrl", s."itemDate"::text AS "itemDate", s."sectionTitle",
               s.attribution, s.speaker, a.title AS "parentTitle"
        FROM corpus_sections s
        LEFT JOIN corpus_acts a ON a.gid = s."parentDocId" AND a.title IS NOT NULL
        WHERE s.id IN (${Prisma.join(ids)})`,
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
    // Kept in step with fts-search.ts's hydrate decode, deliberately — see the note there.
    const hydrate = new Map(hydrateRows.map((r) => [r.id, {
      ...r,
      sectionTitle: decodeMaybe(r.sectionTitle),
      attribution: decodeMaybe(r.attribution),
      speaker: decodeMaybe(r.speaker),
      parentTitle: decodeMaybe(r.parentTitle),
    }]))
    const actTitle = new Map(actRows.flatMap((r) => (r.title ? [[r.gid, decodeForDisplay(r.title)] as const] : [])))

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
      } else if (isPoliticalCorpus(h.corpus)) {
        const named = politicalTitle(h.corpus, meta?.sectionTitle ?? corpusDisplayName(h.corpus), {
          parentTitle: meta?.parentTitle, attribution: meta?.attribution, date: meta?.itemDate,
        })!
        title = named.title
        citation = named.citation
      } else {
        title = meta?.sectionTitle ?? corpusDisplayName(h.corpus)
        citation = meta?.sectionTitle ?? ''
      }
      // §19-D Task 5 — derived wins for legislation; see legislation-url.ts.
      const url = resolveResultUrl(type, h.id, meta?.sourceUrl)
      const date = meta?.itemDate ?? ''
      // `scorer: 'vector'` — cosine similarity (0..1), not BM25 and not RRF. Distinct from
      // 'bm25' because a 0.83 and a 12.4 are not two views of the same quantity.
      // S8 §2 — same single construction site as the sparse adapter, columns only.
      const attribution = attributionFor(h.corpus, { speaker: meta?.speaker, attribution: meta?.attribution })
      return {
        id: h.id, type, title, citation, snippet: h.snippet, score: h.score, scorer: 'vector' as const,
        url, date, attribution,
        snippetMatched: h.snippetMatched, snippetLocation: h.snippetLocation,
      }
    })
    return results.slice(0, limit * 3)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// S15 §4 — ONE REQUEST CARRYING EVERY STREAM'S QUERY
// ═══════════════════════════════════════════════════════════════════════════════════════════
//
// `fusedStream` issues one dense request per routed stream, so a search over four dense-enabled
// streams puts four requests into a service that is four wide IN TOTAL, FOR EVERYBODY. This is
// the client half of `POST /vector-search-batch`.
//
// ⚠ WHAT IT SAVES, MEASURED, AND WHAT IT DOES NOT. The saving is NOT the round trips — it is
// that the service performs ONE scan of `corpus_chunks` for the whole batch instead of one per
// stream. Measured against the live dataset (S15 §1.2), four sequential ANN+snippet pairs took
// 565,670 ms and the batched form took 135,267 ms, a 76% saving, which is the 4→1 scan reduction
// almost exactly. ⚠ That figure was taken with `corpus_chunks.sectionId_idx` STALE (1,478,964
// rows outside it); once the index covers every row the scan stops dominating and this saving
// shrinks. The queue-pressure saving — four queue entries becoming one — does not shrink, and
// that is the `4 ×` term in §1.4's width arithmetic.
//
// ⚠⚠ PER-STREAM FAILURE, NEVER `Promise.all`. One stream erroring must not fail the other three.
// Each entry carries its own outcome and a failed entry becomes that stream's `failure`, so it
// degrades exactly as a solo call would.
export interface VectorBatchRequest { stream: string; query: string; limit: number; scope: VectorScope }
export interface VectorBatchOutcome { stream: string; results: SearchResult[]; failure?: VectorFailure }

export async function runVectorSearchBatch(reqs: VectorBatchRequest[]): Promise<VectorBatchOutcome[]> {
  if (!reqs.length) return []
  if (!VECTOR_URL) return reqs.map((r) => ({ stream: r.stream, results: [] }))

  let timedOut = false
  const ctrl = new AbortController()
  const t = setTimeout(() => { timedOut = true; ctrl.abort() }, VECTOR_TIMEOUT_MS)
  // A whole-batch failure hits every stream the same way, so it is expressed per stream rather
  // than thrown — the caller's contract is one outcome per request, always.
  const allFail = (reason: VectorFailureReason, detail: string): VectorBatchOutcome[] =>
    reqs.map((r) => ({ stream: r.stream, results: [], failure: { reason, detail } }))
  try {
    const res = await fetch(`${VECTOR_URL.replace(/\/$/, '')}/vector-search-batch`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        queries: reqs.map((r) => ({
          query: r.query,
          limit: Math.max(r.limit * 3, 30),
          ...(r.scope.tier ? { tier: r.scope.tier } : {}),
          ...(r.scope.corpora?.length ? { corpora: r.scope.corpora } : {}),
          ...(r.scope.excludeCorpora?.length ? { excludeCorpora: r.scope.excludeCorpora } : {}),
        })),
      }),
      signal: ctrl.signal,
    }).catch((e) => {
      if (timedOut) throw new VectorCallError('timeout', `vector batch timed out after ${VECTOR_TIMEOUT_MS} ms`)
      throw new VectorCallError('unreachable', (e as Error).message)
    })
    if (!res.ok) {
      const text = await res.text()
      // ⚠ 404 means the service predates this endpoint. That is NOT a gap to report to a user —
      // it is a version skew, and the caller must fall back to four single calls rather than
      // tell somebody the corpus could not be searched.
      if (res.status === 404) throw new VectorCallError('unreachable', 'vector service has no /vector-search-batch — redeploy it (S15 §7)')
      if (res.status === 503) throw new VectorCallError('overloaded', `vector service saturated: ${text.slice(0, 200)}`)
      throw new VectorCallError('error', `vector batch ${res.status}: ${text.slice(0, 200)}`)
    }
    const json = await res.json() as { queries?: Array<{ ok: boolean; tier: string | null; error?: string | null; results?: VecHit[] }> }
    const rows = json.queries ?? []
    if (rows.length !== reqs.length) {
      throw new VectorCallError('error', `vector batch returned ${rows.length} outcomes for ${reqs.length} queries`)
    }
    // ⚠⚠ NOT `Promise.all` OVER THROWING WORK — AND THIS IS THE BRIEF'S EXPLICIT WARNING, CAUGHT
    // BY ITS OWN CHECK. Hydration touches Prisma, so it CAN throw; with a bare `Promise.all`
    // one stream's database hiccup rejects the whole array and converts a single stream's fault
    // into a total search failure, which is the opposite of what §3 exists for. Watched failing:
    // `check-dense-degraded.ts` reported `legislation:error caselaw:error` from ONE Prisma fault
    // before this catch existed. Every entry resolves, always.
    return await Promise.all(reqs.map(async (r, i) => {
      try {
        const row = rows[i]
        if (!row?.ok) return { stream: r.stream, results: [], failure: { reason: 'error' as const, detail: row?.error ?? 'no outcome' } }
        // The tier echo is checked per entry, for the same reason it is checked on the solo path:
        // a service that silently ignored the scope would put another stream's content in front
        // of a user with no backstop at all.
        if (r.scope.tier && row.tier !== r.scope.tier) {
          return { stream: r.stream, results: [], failure: { reason: 'unscoped' as const, detail: `batch entry ${i} echoed tier ${JSON.stringify(row.tier)}, expected ${r.scope.tier}` } }
        }
        // Hydration is shared with the solo path rather than reimplemented — a document found
        // through the batch must not be TITLED differently from the same document found solo.
        return { stream: r.stream, results: await hydrateVecHits(row.results ?? [], r.limit) }
      } catch (e) {
        return { stream: r.stream, results: [], failure: { reason: 'error' as const, detail: `hydrate failed: ${(e as Error).message}` } }
      }
    }))
  } catch (err) {
    const reason: VectorFailureReason = err instanceof VectorCallError ? err.reason : 'error'
    const detail = err instanceof Error ? err.message : String(err)
    console.warn(`[vector-search] BATCH degraded (${reason}) — every stream falls back to BM25:`, detail)
    return allFail(reason, detail)
  } finally { clearTimeout(t) }
}
