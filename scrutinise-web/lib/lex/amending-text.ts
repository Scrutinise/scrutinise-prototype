// ─────────────────────────────────────────────────────────────────────────────
// AMENDING-PROVISION TEXT — SEARCH-28 (the "consequential amendments" route Charlie approved).
//
// The question this answers: `legislation_edges` says Schedule 9 of the Constitutional Reform Act 2005 amends the
// Equality Act 2010 (or whatever Act you are drafting against). WHAT DOES THAT PROVISION SAY?
//
//   const t = await amendingText(row.otherEnd, { mentioning: ['Equality Act 2010'] })
//
// `row.otherEnd` is exactly `EffectRow['otherEnd']` from `effectsFor()` in statutory-graph.ts - { corpus, gid, provision,
// title } - so the statute_effects tool passes a row's other end straight in and needs no translation.
//
// ⚠⚠ THE EDGE TABLE RECORDS THE AMENDING PROVISION AT THE GRAIN OF THE EFFECTS FEED, WHICH IS COARSE. A row's `from_id`
// reads `primary-acts-2000plus:ukpga/2005/4:schedule-9` - the whole schedule, 100+ paragraphs - never `…-paragraph-36`
// (`detail` is null on every amends row; measured). So a provision as recorded usually resolves to MANY sections, and
// "paragraph 36" can only be found by reading them. That is what `mentioning` is for: read the held sections under the
// provision and keep the ones whose text names the thing being amended. Without it the first `maxSections` come back, in
// document order, and `truncated` says so.
//
// ⚠ A result is never silent about WHY it is empty (docs/CLAUDE.md §18/§19): `status` separates "this Act is not in the
// corpus" from "the Act is held but no section carries that provision id" from "held, but no text is stored".
//
// Reads corpus_sections for existence and r2Key, and R2 for text (the corpus keeps no text in Postgres). Read-only.
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from '@/lib/prisma'
import { r2Get } from '@/lib/r2'

/** The corpora whose section ids are `corpus:gid:provision` for legislation - tried in order when the caller did not say. */
export const LEGISLATION_CORPORA = [
  'primary-acts-2000plus', 'primary-acts-pre-2000', 'si-2010plus', 'si-pre-2010', 'regional', 'retained-eu',
] as const

export interface AmendingProvisionRef {
  /** e.g. 'primary-acts-2000plus'. null/undefined = try every legislation corpus. */
  corpus?: string | null
  /** legislation.gov.uk id as the edge stores it, e.g. 'ukpga/2005/4'. */
  gid: string
  /** e.g. 'schedule-9', 'article-9-3', 'section-121-2'. null = the Act as a whole (every section is a candidate). */
  provision?: string | null
  title?: string | null
}

export interface AmendingTextOptions {
  /** Keep only sections whose text names one of these (case/space-insensitive), e.g. the title of the Act being amended. */
  mentioning?: string[]
  /** Cap on sections whose TEXT is returned. Default 40. */
  maxSections?: number
  /** Cap on characters of text kept per section. Default 6000. */
  maxCharsPerSection?: number
  /** false = existence and status only; no R2 read. Used to count what resolves. Default true. */
  readText?: boolean
  /** Hard cap on R2 reads when narrowing by `mentioning`. Default 400. */
  maxReads?: number
}

export interface AmendingSection {
  id: string
  /** The provision part of the id, e.g. 'schedule-9-paragraph-36'. */
  provision: string
  wordCount: number | null
  /** null when readText was false, or the body could not be read. */
  text: string | null
  /** Which of `mentioning` this section's text names. */
  mentions: string[]
}

export type AmendingStatus =
  | 'text'             // sections found and their text returned
  | 'held-no-match'    // the provision is held but no section names any of `mentioning`
  | 'held-no-text'     // sections exist with no stored body (failed / unavailable / no r2Key) or the body would not read
  | 'provision-not-held' // the Act has sections in the corpus but none carries this provision id
  | 'act-not-held'     // no section of this Act is in the corpus at all

export interface AmendingTextResult {
  ref: AmendingProvisionRef
  status: AmendingStatus
  /** In words, for the reader. Never empty. */
  reason: string
  /** Sections under the provision that are held (before any narrowing). */
  heldSections: number
  sections: AmendingSection[]
  truncated: boolean
  narrowedBy: 'mentioning' | null
  /**
   * 'exact' = the provision as asked for (or sections beneath it) is held. 'parent' = the feed recorded a SUBSECTION or
   * lettered limb (`section-45-5`, `regulation-3-4-g`) and the corpus holds whole sections, so the nearest held ancestor
   * was read (`section-45`). The words you want are inside it; the caller should say "within section 45", not quote it as 45(5).
   * 'document' = the instrument is held only as ONE whole-document row (`full-doc-html`, some Welsh SIs); the provision cannot
   * be located inside it without reading all of it, so the whole row is returned.
   */
  matchedAt: 'exact' | 'parent' | 'document' | null
  /** The provision actually read, when it differs from the one asked for. */
  resolvedProvision?: string
  /** Provision ids of the same Act nearest to the one asked for, when it is not held - so a miss can be diagnosed. */
  nearby?: string[]
}

interface Row { id: string; corpus: string; r2Key: string | null; status: string | null; wordCount: number | null }

const like = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)
const squash = (s: string) => s.toLowerCase().replace(/[\s ]+/g, ' ').replace(/[‘’]/g, "'").trim()

function candidateCorpora(ref: AmendingProvisionRef): string[] {
  return ref.corpus ? [ref.corpus] : [...LEGISLATION_CORPORA]
}

/** Sections of the Act that sit under (or are) the provision, in document order. */
async function heldUnder(ref: AmendingProvisionRef): Promise<{ rows: Row[]; actHeld: boolean; nearby: string[]; matchedAt?: 'exact' | 'parent' | 'document'; resolvedProvision?: string }> {
  const corpora = candidateCorpora(ref)
  const gidPrefixes = corpora.map((c) => `${c}:${ref.gid}:`)
  const actRows = await prisma.$queryRaw<Row[]>`
    SELECT id, corpus, "r2Key", status, "wordCount" FROM corpus_sections
    WHERE corpus = ANY(${corpora}) AND id LIKE ANY(${gidPrefixes.map((p) => `${like(p)}%`)}) LIMIT 1`
  if (!actRows.length) return { rows: [], actHeld: false, nearby: [] }
  const prov = ref.provision?.trim()
  if (!prov) {
    const all = await prisma.$queryRaw<Row[]>`
      SELECT id, corpus, "r2Key", status, "wordCount" FROM corpus_sections
      WHERE corpus = ANY(${corpora}) AND id LIKE ANY(${gidPrefixes.map((p) => `${like(p)}%`)}) ORDER BY id LIMIT 2000`
    return { rows: all, actHeld: true, nearby: [], matchedAt: 'exact' }
  }
  // exact provision, or anything beneath it: `schedule-9` matches `schedule-9` and `schedule-9-paragraph-36`, never `schedule-90`.
  // If nothing is held at that grain, climb: the feed records `section-45-5`, the corpus holds `section-45`.
  const segs = prov.split('-')
  // A single-schedule instrument records its schedule as bare `schedule`; the corpus holds `schedule-paragraph-N`.
  const floor = prov === 'schedule' ? 1 : 2
  for (let n = segs.length; n >= floor; n--) {
    const p2 = segs.slice(0, n).join('-')
    const exact = gidPrefixes.map((p) => `${p}${p2}`)
    const below = gidPrefixes.map((p) => `${like(p)}${like(p2)}-%`)
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT id, corpus, "r2Key", status, "wordCount" FROM corpus_sections
      WHERE corpus = ANY(${corpora}) AND (id = ANY(${exact}) OR id LIKE ANY(${below}))
      ORDER BY length(id), id LIMIT 2000`
    if (rows.length) return { rows, actHeld: true, nearby: [], matchedAt: n === segs.length ? 'exact' : 'parent', resolvedProvision: p2 }
  }
  const whole = await prisma.$queryRaw<Row[]>`
    SELECT id, corpus, "r2Key", status, "wordCount" FROM corpus_sections
    WHERE corpus = ANY(${corpora}) AND id = ANY(${gidPrefixes.map((p) => `${p}full-doc-html`)})`
  if (whole.length) return { rows: whole, actHeld: true, nearby: [], matchedAt: 'document', resolvedProvision: 'full-doc-html' }
  // a miss: show what IS there for the same kind of provision, so "not held" can be told from "named differently".
  const kind = prov.split('-')[0]
  const near = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM corpus_sections WHERE corpus = ANY(${corpora}) AND id LIKE ANY(${gidPrefixes.map((p) => `${like(p)}${like(kind)}%`)})
    ORDER BY length(id), id LIMIT 8`
  return { rows: [], actHeld: true, nearby: near.map((n) => n.id.split(':').slice(2).join(':')) }
}

/** Run `fn` over `items` with at most `n` in flight. */
async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]) }
  }))
  return out
}

export async function amendingText(ref: AmendingProvisionRef, opts: AmendingTextOptions = {}): Promise<AmendingTextResult> {
  const maxSections = opts.maxSections ?? 40
  const maxChars = opts.maxCharsPerSection ?? 6000
  const wantText = opts.readText !== false
  const mentioning = (opts.mentioning ?? []).map((m) => m.trim()).filter(Boolean)
  const { rows, actHeld, nearby, matchedAt, resolvedProvision } = await heldUnder(ref)
  const base = {
    ref, narrowedBy: mentioning.length ? 'mentioning' as const : null,
    matchedAt: rows.length ? (matchedAt ?? 'exact') : null,
    ...(matchedAt === 'parent' || matchedAt === 'document' ? { resolvedProvision } : {}),
  }
  const via = matchedAt === 'parent' ? ` (the corpus holds “${resolvedProvision}”, not “${ref.provision}”; read within it)`
    : matchedAt === 'document' ? ` (the instrument is held only as one whole-document row; “${ref.provision}” is somewhere inside it)` : ''
  if (!rows.length) {
    return actHeld
      ? { ...base, status: 'provision-not-held', heldSections: 0, sections: [], truncated: false, nearby,
          reason: `${ref.title ?? ref.gid} is in the corpus, but no section carries the id “${ref.provision}”. ${nearby.length ? `Nearest held: ${nearby.join(', ')}.` : 'No provision of that kind is held for it.'}` }
      : { ...base, status: 'act-not-held', heldSections: 0, sections: [], truncated: false,
          reason: `No section of ${ref.title ?? ref.gid} (${ref.gid}) is in the corpus${ref.corpus ? ` collection ${ref.corpus}` : ''}.` }
  }
  const readable = rows.filter((r) => r.r2Key && r.status === 'compiled')
  if (!readable.length) {
    return { ...base, status: 'held-no-text', heldSections: rows.length, sections: [], truncated: false,
      reason: `${rows.length} section(s) under “${ref.provision ?? 'the Act'}” are held, but none has a stored body (status: ${[...new Set(rows.map((r) => r.status ?? 'null'))].join(', ')}).` }
  }
  const toSection = (r: Row, text: string | null, mentions: string[]): AmendingSection =>
    ({ id: r.id, provision: r.id.split(':').slice(2).join(':'), wordCount: r.wordCount, text, mentions })

  if (!wantText) {
    return { ...base, status: 'text', heldSections: rows.length, sections: readable.slice(0, maxSections).map((r) => toSection(r, null, [])),
      truncated: readable.length > maxSections, reason: `${readable.length} readable section(s) held under “${ref.provision ?? 'the Act'}”; text not read (readText=false).${via}` }
  }

  if (mentioning.length) {
    const cap = opts.maxReads ?? 400
    const toRead = readable.slice(0, cap)
    const needles = mentioning.map(squash)
    const read = await pool(toRead, 8, async (r) => ({ r, body: await r2Get(r.r2Key!).catch(() => null) }))
    const hits = read.flatMap(({ r, body }) => {
      if (!body) return []
      const s = squash(body)
      const m = mentioning.filter((_, i) => s.includes(needles[i]))
      return m.length ? [toSection(r, body.slice(0, maxChars), m)] : []
    })
    const unread = read.filter((x) => !x.body).length
    const capped = readable.length > cap
    if (!hits.length) {
      return { ...base, status: 'held-no-match', heldSections: rows.length, sections: [], truncated: capped,
        reason: `${rows.length} section(s) are held under “${ref.provision ?? 'the Act'}” and ${toRead.length - unread} were read, but none names ${mentioning.map((m) => `“${m}”`).join(' or ')}.${unread ? ` ${unread} would not read.` : ''}${capped ? ` Only the first ${cap} were read.` : ''}` }
    }
    return { ...base, status: 'text', heldSections: rows.length, sections: hits.slice(0, maxSections), truncated: hits.length > maxSections || capped,
      reason: `${hits.length} of ${rows.length} held section(s) under “${ref.provision ?? 'the Act'}” name ${mentioning.map((m) => `“${m}”`).join(' or ')}.${via}${capped ? ` Only the first ${cap} were read.` : ''}` }
  }

  const slice = readable.slice(0, maxSections)
  const read = await pool(slice, 8, async (r) => ({ r, body: await r2Get(r.r2Key!).catch(() => null) }))
  const got = read.filter((x) => x.body)
  if (!got.length) {
    return { ...base, status: 'held-no-text', heldSections: rows.length, sections: [], truncated: false, reason: `${slice.length} section(s) were held but none would read from storage.` }
  }
  return { ...base, status: 'text', heldSections: rows.length, sections: got.map(({ r, body }) => toSection(r, body!.slice(0, maxChars), [])),
    truncated: readable.length > maxSections,
    reason: `${got.length} of ${rows.length} held section(s) under “${ref.provision ?? 'the Act'}”, in document order.${via}${readable.length > maxSections ? ' Pass `mentioning` to find the paragraph that concerns a particular Act.' : ''}` }
}

/** Parse an edge id (`corpus:gid:provision`) into a ref - for callers holding a raw `from_id` rather than an EffectRow. */
export function refFromEdgeId(edgeId: string): AmendingProvisionRef | null {
  const p = edgeId.split(':')
  if (p.length < 2 || !p[1]) return null
  return { corpus: p[0] || null, gid: p[1], provision: p.length > 2 ? p.slice(2).join(':') : null }
}
