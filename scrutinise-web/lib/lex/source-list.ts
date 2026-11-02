// ─────────────────────────────────────────────────────────────────────────────
// 299 (CCh-Lex 2 Nov (1) E) — THE SOURCES LIST'S RULES, IN ONE PURE MODULE.
//
// Read by the Sources list on the research panel AND by 298's "further note" picker in Add research — one component, one set of rules,
// so a filter or a duplicate can never mean two things. ⚠ PURE: it imports nothing, so a client component may import it (CLAUDE.md §28).
// The server fills `ListedSource`'s extra fields (lib/lex/source-registry.ts `listRegistryDetail`); everything here is arithmetic on them.
//
// KINDS (one per source, so the counts add up to the list):
//   Documents · a file the user filed, or a document's text kept as research
//   Web pages · a page the user filed by its address
//   Pasted text · text the user pasted (filed from 2 Nov; earlier pasted text was stored exactly like a file and counts as a Document)
//   My own notes · "My own observation" and the user's own notes-as-sources
//   Found by Lex · everything the corpus searches and builds brought in, and pages Lex's web searches found
// POSSIBLE DUPLICATES — a source is in a group with another when they are the same DOCUMENT: the same corpus document (a publication
//   page and its PDF, or two passages of one report), the same web address, the same title, or the same held text (sha-256). They are
//   only shown together; nothing is merged, and a number is never reused.
// ─────────────────────────────────────────────────────────────────────────────

export type SourceFacet = 'document' | 'web' | 'pasted' | 'own' | 'lex'
export const SOURCE_FACETS: SourceFacet[] = ['document', 'web', 'pasted', 'own', 'lex']
export const FACET_LABEL: Record<SourceFacet, string> = {
  document: 'Documents', web: 'Web pages', pasted: 'Pasted text', own: 'My own notes', lex: 'Found by Lex',
}
/** The three quick-filter pills, in the brief's order. */
export const QUICK_FACETS: SourceFacet[] = ['document', 'web', 'lex']

/** What the filed-text path stores for pasted text from 2 Nov (`IdeaSource.sourceType`). */
export const PASTED_SOURCE_TYPE = 'pasted text'

/** A registry source, as the list needs it. The base fields are `RegistrySource`'s (lib/lex/source-registry.ts); the rest are computed. */
export interface ListedSource {
  id: string
  number: number
  kind: 'CORPUS' | 'URL' | 'DOCUMENT' | 'OWN_OBSERVATION'
  title: string
  url: string | null
  sourceType: string | null
  author: string | null
  publishedAt: string | null
  snippet: string | null
  readStatus: 'READ' | 'NOT_READ'
  readNote: string | null
  corpusKey: string | null
  materialId: string | null
  createdAt: string
  /** Who filed it; null for a source the platform registered from Lex's own searches. */
  addedBy: string | null
  facet: SourceFacet
  /** Action numbers this source bears on: a note on it bears on the action, or the action's own text cites its [Ref: n]. */
  bearsOn: number[]
  /** sha-256 of the held text, for a source with a document's text; null otherwise. */
  textHash: string | null
  noteCount: number
}

export function facetOf(s: { kind: ListedSource['kind']; sourceType: string | null; addedBy: string | null; materialId: string | null }): SourceFacet {
  if (s.kind === 'OWN_OBSERVATION') return 'own'
  if (s.kind === 'CORPUS') return 'lex'
  if (s.kind === 'URL') return s.addedBy ? 'web' : 'lex'
  if ((s.sourceType ?? '').toLowerCase() === PASTED_SOURCE_TYPE) return 'pasted'
  return 'document'
}

/** A web address reduced to the page: no scheme, no www, no fragment, no trailing slash. (The query is kept: ?id=1 and ?id=2 differ.) */
export function pageKey(url: string | null | undefined): string | null {
  if (!url || !url.trim()) return null
  try {
    const u = new URL(url.trim())
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}${u.search}`.toLowerCase()
  } catch { return url.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/#.*$/, '').replace(/\/+$/, '') }
}

/** The corpus DOCUMENT a passage belongs to: "quangos-govuk:government/publications/x:2" → "quangos-govuk:government/publications/x". */
export function corpusDocKey(corpusKey: string | null | undefined): string | null {
  if (!corpusKey || corpusKey.startsWith('url:')) return null
  // ⚠ Hansard (pwdata-*) is keyed by DAY ("debates1994-07-13a:131"): one "document" is a whole sitting of unrelated debates, so two speeches from
  // the same day are not the same document. Measured on 452c5ade (2 Nov): 5 groups of 2–10 speeches joined only by their day. Same title still
  // catches repeats within one debate.
  if (/^pwdata-/.test(corpusKey)) return null
  const parts = corpusKey.split(':')
  // ⚠ Two SECTIONS of one Act are two provisions, not one document cited twice (452c5ade: ten sections of CRAG 2010 grouped as one).
  if (/^(?:section|article|regulation|rule|schedule|paragraph|part)-/i.test(parts[parts.length - 1] ?? '')) return null
  return parts.length >= 3 ? parts.slice(0, -1).join(':') : corpusKey
}

/** A title reduced to its words, without a site suffix (" - GOV.UK") or a file extension. Very short titles are not compared. */
export function titleKey(title: string | null | undefined): string | null {
  const t = (title ?? '').toLowerCase().replace(/\s*[-–|]\s*gov\.uk\s*$/i, '').replace(/\.(?:pdf|docx?|txt|md|html?)$/i, '').replace(/[^a-z0-9]+/g, ' ').trim()
  return t.split(' ').length >= 2 && t.length >= 8 ? t : null
}

/** Why two sources are grouped, in words. */
export type DupReason = 'same document' | 'same web address' | 'same title' | 'same text'

/**
 * The possible-duplicate groups: union-find over the four keys, so 12 ~ 13 by document and 13 ~ 40 by title make one group of three.
 * Each group is sorted by number and carries every reason that joined it. Groups of one are not returned.
 */
export function duplicateGroups(sources: ListedSource[]): Array<{ numbers: number[]; reasons: DupReason[] }> {
  const parent = new Map<string, string>()
  const find = (x: string): string => { let p = parent.get(x) ?? x; if (p !== x) { p = find(p); parent.set(x, p) } return p }
  const union = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb) }
  const reasonsOf = new Map<string, Set<DupReason>>() // keyed by source id; merged into the root at the end
  const keys: Array<[DupReason, (s: ListedSource) => string | null]> = [
    ['same document', (s) => corpusDocKey(s.corpusKey)],
    // A Hansard passage's address is its whole SITTING's file, so the address says no more than the day does (see corpusDocKey).
    ['same web address', (s) => (/^pwdata-/.test(s.corpusKey ?? '') ? null : pageKey(s.url))],
    // A Hansard title is a debate's HEADING ("Cabinet Office — Civil Service" recurs for years), so it matches only within one sitting.
    ['same title', (s) => {
      if (s.kind === 'OWN_OBSERVATION') return null
      const t = titleKey(s.title)
      return t && /^pwdata-/.test(s.corpusKey ?? '') ? `${s.corpusKey!.split(':')[1]}|${t}` : t
    }],
    ['same text', (s) => s.textHash],
  ]
  for (const [reason, key] of keys) {
    const first = new Map<string, ListedSource>()
    for (const s of sources) {
      const k = key(s); if (!k) continue
      const f = first.get(k)
      if (!f) { first.set(k, s); continue }
      union(s.id, f.id)
      for (const id of [s.id, f.id]) reasonsOf.set(id, (reasonsOf.get(id) ?? new Set()).add(reason))
    }
  }
  const groups = new Map<string, { numbers: number[]; reasons: Set<DupReason> }>()
  for (const s of sources) {
    if (!reasonsOf.has(s.id)) continue
    const r = find(s.id)
    const g = groups.get(r) ?? { numbers: [], reasons: new Set<DupReason>() }
    g.numbers.push(s.number); for (const x of reasonsOf.get(s.id)!) g.reasons.add(x)
    groups.set(r, g)
  }
  return [...groups.values()].filter((g) => g.numbers.length > 1)
    .map((g) => ({ numbers: g.numbers.sort((a, b) => a - b), reasons: [...g.reasons] }))
    .sort((a, b) => a.numbers[0] - b.numbers[0])
}

/** 298 — is what is being added already a source? By the page's address, or by the held text's hash. The first match by number. */
export function alreadyAdded(sources: ListedSource[], probe: { url?: string | null; textHash?: string | null }): { source: ListedSource; by: 'web address' | 'text' } | null {
  const pk = pageKey(probe.url)
  const byUrl = pk ? sources.filter((s) => pageKey(s.url) === pk).sort((a, b) => a.number - b.number)[0] : undefined
  if (byUrl) return { source: byUrl, by: 'web address' }
  const byText = probe.textHash ? sources.filter((s) => s.textHash === probe.textHash).sort((a, b) => a.number - b.number)[0] : undefined
  return byText ? { source: byText, by: 'text' } : null
}

export type SourceSort = 'added' | 'az' | 'ref'
export const SORT_LABEL: Record<SourceSort, string> = { added: 'Date added (newest first)', az: 'A–Z', ref: 'Ref number' }

export interface SourceFilter {
  facets: SourceFacet[] // empty = every kind
  bearsOn: number | null
  duplicatesOnly: boolean
  /** Source ids the server's search matched (titles and held text); null = no search. */
  searchIds: Set<string> | null
}

export function applySourceFilter(sources: ListedSource[], f: SourceFilter, sort: SourceSort, dupNumbers?: Set<number>): ListedSource[] {
  const dups = dupNumbers ?? new Set(duplicateGroups(sources).flatMap((g) => g.numbers))
  const out = sources.filter((s) =>
    (!f.facets.length || f.facets.includes(s.facet))
    && (f.bearsOn == null || s.bearsOn.includes(f.bearsOn))
    && (!f.duplicatesOnly || dups.has(s.number))
    && (!f.searchIds || f.searchIds.has(s.id)))
  const cmp: Record<SourceSort, (a: ListedSource, b: ListedSource) => number> = {
    added: (a, b) => b.createdAt.localeCompare(a.createdAt) || b.number - a.number,
    az: (a, b) => a.title.localeCompare(b.title, 'en-GB', { sensitivity: 'base' }) || a.number - b.number,
    ref: (a, b) => a.number - b.number,
  }
  return out.sort(cmp[sort])
}

/** Counts per kind over the WHOLE list (not the filtered one), so a pill says how many it would show. */
export function facetCounts(sources: ListedSource[]): Record<SourceFacet, number> {
  const c = { document: 0, web: 0, pasted: 0, own: 0, lex: 0 } as Record<SourceFacet, number>
  for (const s of sources) c[s.facet]++
  return c
}
