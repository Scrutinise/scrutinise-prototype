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
import type { SearchResult } from './page1-config'
import { corpusToType } from './corpus-type-map'
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
const FTS_TIMEOUT_MS = parseInt(process.env.FTS_TIMEOUT_MS ?? '8000', 10)

// ── citation/url derivation for legislation (mirrors scripts/ingest/search/citation.ts) ──

/** corpus_sections id `{corpus}:{gid}:{ref}` → gid (`ukpga/1988/52`) or null. */
function gidFromId(id: string): string | null {
  const parts = id.split(':')
  const gid = parts.length >= 2 ? parts[1] : null
  return gid && gid.includes('/') ? gid : null
}

/** id → section ref token, e.g. `section-21`, `regulation-4`, or '' for whole-act. */
function refFromId(id: string): string {
  const parts = id.split(':')
  if (parts.length < 3) return ''
  const ref = parts.slice(2).join(':').trim()
  return !ref || ref === 'full' ? '' : ref.replace(/[.\s]+$/g, '')
}

const REF_ABBR: Record<string, string> = { section: 's.', regulation: 'reg.', article: 'art.', schedule: 'sch.', paragraph: 'para.' }

/** `section-21` → "s.21"; `schedule-2-paragraph-12` → "sch.2 para.12"; '' → ''. */
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

/** gid + ref → legislation.gov.uk URL. `section-21` → /section/21. */
function legislationUrl(gid: string, ref: string): string {
  const base = `https://www.legislation.gov.uk/${gid}`
  return ref ? `${base}/${ref.replace(/-/g, '/')}` : base
}

// ── the adapter ──────────────────────────────────────────────────────────────

async function callFts(query: string, limit: number): Promise<FtsHit[]> {
  if (!FTS_URL) throw new Error('FTS_SEARCH_URL not set')
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), FTS_TIMEOUT_MS)
  try {
    const res = await fetch(`${FTS_URL.replace(/\/$/, '')}/fts-search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, limit }),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`FTS ${res.status}: ${await res.text()}`)
    const json = (await res.json()) as { results?: FtsHit[] }
    return json.results ?? []
  } finally {
    clearTimeout(t)
  }
}

/** Real FTS search → SearchResult[]. Falls back to the stub on any failure. */
export async function runFtsSearch(keywords: string[], limit = 12): Promise<{ results: SearchResult[] }> {
  const query = keywords.map((k) => k.trim()).filter(Boolean).join(' ')
  if (!query) return { results: [] }

  try {
    // Overscan: nulls (guidance/bill/treaty/EU) get dropped, so ask for more.
    const hits = await callFts(query, Math.max(limit * 3, 30))
    if (!hits.length) return { results: [] }

    // Keep only hits that map to a Lex type; remember the type per id.
    const typed = hits
      .map((h) => ({ h, type: corpusToType(h.corpus, h.tier, h.id) }))
      .filter((x): x is { h: FtsHit; type: NonNullable<ReturnType<typeof corpusToType>> } => x.type !== null)
    if (!typed.length) return { results: [] }

    const ids = typed.map((x) => x.h.id)
    const gids = Array.from(new Set(typed.map((x) => gidFromId(x.h.id)).filter((g): g is string => !!g)))

    // ONE batched hydrate (url + date) + the legislation act-title lookup.
    const [hydrateRows, actRows] = await Promise.all([
      prisma.$queryRaw<Array<{ id: string; sourceUrl: string | null; itemDate: string | null }>>`
        SELECT id, "sourceUrl", "itemDate"::text AS "itemDate"
        FROM corpus_sections WHERE id IN (${Prisma.join(ids)})`,
      gids.length
        ? prisma.legislationItem.findMany({
            where: { legislationGovUkId: { in: gids } },
            select: { legislationGovUkId: true, title: true },
          })
        : Promise.resolve([] as Array<{ legislationGovUkId: string; title: string }>),
    ])
    const hydrate = new Map(hydrateRows.map((r) => [r.id, r]))
    const actTitle = new Map(actRows.map((r) => [r.legislationGovUkId, r.title]))

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
      } else {
        title = h.sectionTitle ?? h.corpus
        citation = h.sectionTitle ?? ''
      }

      const url =
        meta?.sourceUrl ?? (isLeg && gid ? legislationUrl(gid, ref) : '')
      const date = meta?.itemDate ?? h.itemDate ?? ''

      return { id: h.id, type, title, citation, snippet: h.snippet, score: h.score, url, date }
    })

    return { results: results.slice(0, limit * 3) } // groupForPanel caps downstream
  } catch (err) {
    console.warn('[fts-search] falling back to stub:', err instanceof Error ? err.message : err)
    return runStubSearch(keywords, limit)
  }
}
