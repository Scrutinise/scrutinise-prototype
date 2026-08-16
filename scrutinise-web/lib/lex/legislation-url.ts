// ─────────────────────────────────────────────────────────────────────────────
// legislation.gov.uk URL construction (§19-D Task 5).
//
// THE BUG THIS EXISTS TO REMOVE. Every legislation link in the background panel
// 404'd, while debates, committee reports and "anything else relevant" all worked.
// The cause was not the link renderer — it was which string we handed it.
//
// `corpus_sections.sourceUrl` for the legislation corpora is built by pasting the
// section id's ref token straight onto the act URL:
//
//   id  primary-acts-pre-2000:ukpga/1995/46:section-288AB
//   url https://www.legislation.gov.uk/ukpga/1995/46/section-288AB   → 404
//   ✓   https://www.legislation.gov.uk/ukpga/1995/46/section/288AB   → 200
//
// legislation.gov.uk addresses a provision with SLASH-separated keyword/number
// pairs, not the hyphenated token our ids use. Measured 2026-08-11: every form on
// the left 404s, every form on the right 200s. Whole-document rows carry the ref
// `full-doc-html`, which is not a provision at all and must resolve to the act.
//
// `runFtsSearch`/`runVectorSearch` already had a correct `legislationUrl` — but it
// sat behind `meta?.sourceUrl ?? …`, and sourceUrl is non-null on 100% of the
// 1.32M legislation rows. The fallback could never fire. So for the gid-bearing
// legislation types the DERIVED url now WINS and sourceUrl is the fallback, which
// is the opposite precedence to every other corpus (whose sourceUrl is a real,
// working page and whose ids carry no gid to derive from).
//
// // The stored sourceUrl is wrong at rest. This corrects it on the way out; the
// // ingest-side data defect is recorded in LEX_PLAYBOOK §16 for the ingest thread.
// ─────────────────────────────────────────────────────────────────────────────

import type { SearchResultType } from './page1-config'
import { committeeUrl } from './committee-url'

/** The three types whose ids carry a legislation.gov.uk gid we can address. */
const GID_BEARING: SearchResultType[] = ['PRIMARY_LEGISLATION', 'STATUTORY_INSTRUMENT', 'EU_LEGISLATION']

export function isGidBearingType(type: SearchResultType): boolean {
  return GID_BEARING.includes(type)
}

/** corpus_sections id `{corpus}:{gid}:{ref}` → gid (`ukpga/1988/52`) or null. */
export function gidFromId(id: string): string | null {
  const parts = id.split(':')
  const gid = parts.length >= 2 ? parts[1] : null
  return gid && gid.includes('/') ? gid : null
}

/**
 * Refs that address the WHOLE document rather than a provision within it. These
 * are ingest artefacts, not citations — `full-doc-html` is the name of the file
 * the section text was extracted from, and pasting it onto the act URL is a
 * guaranteed 404.
 */
const WHOLE_DOC_REFS = new Set(['', 'full', 'full-doc', 'full-doc-html', 'whole', 'introduction'])

/** id → section ref token, e.g. `section-21`, `schedule-24-paragraph-7`, or '' for whole-act. */
export function refFromId(id: string): string {
  const parts = id.split(':')
  if (parts.length < 3) return ''
  const ref = parts.slice(2).join(':').trim().replace(/[.\s]+$/g, '')
  return WHOLE_DOC_REFS.has(ref.toLowerCase()) ? '' : ref
}

// The provision keywords legislation.gov.uk addresses. A ref is a sequence of
// keyword/value pairs; anything that isn't one of these is not a level we can
// address and everything from it rightwards is dropped (see refToPath).
const REF_KEYWORDS = new Set([
  'part', 'chapter', 'crossheading', 'section', 'regulation', 'rule', 'article',
  'paragraph', 'subparagraph', 'schedule', 'annex', 'appendix', 'division', 'order', 'form', 'table',
])

const REF_ABBR: Record<string, string> = {
  section: 's.', regulation: 'reg.', article: 'art.', schedule: 'sch.',
  paragraph: 'para.', rule: 'r.', part: 'Pt.', chapter: 'Ch.',
}

/**
 * `section-21` → `section/21`; `schedule-24-paragraph-7` → `schedule/24/paragraph/7`;
 * `schedule-paragraph-2` → `schedule/paragraph/2` (an unnumbered schedule — a real
 * form, verified 200).
 *
 * Returns '' when nothing addressable can be built, which sends the caller to the
 * whole-act URL. That is the deliberate trade: a link one level broader than the
 * citation always opens, and a link that 404s is worse than no link at all when the
 * user is checking whether the law says what we claim it says.
 */
export function refToPath(ref: string): string {
  if (!ref) return ''
  const segs = ref.split('-').filter(Boolean)
  const out: string[] = []
  let i = 0
  while (i < segs.length) {
    const kw = segs[i].toLowerCase()
    if (!REF_KEYWORDS.has(kw)) break // unaddressable from here on — stop, don't guess
    const value = i + 1 < segs.length ? segs[i + 1] : null
    // A keyword with no value (or immediately followed by another keyword) addresses
    // the level itself: `schedule-paragraph-2` → schedule, then paragraph 2.
    if (value === null || REF_KEYWORDS.has(value.toLowerCase())) {
      out.push(kw)
      i += 1
    } else {
      out.push(kw, value)
      i += 2
    }
  }
  return out.join('/')
}

/** `section-21` → "s.21"; `schedule-2-paragraph-12` → "sch.2 para.12"; '' → ''. */
export function refToCitation(ref: string): string {
  if (!ref) return ''
  const segs = ref.split('-')
  const out: string[] = []
  for (let i = 0; i < segs.length; i++) {
    const abbr = REF_ABBR[segs[i].toLowerCase()]
    if (abbr && i + 1 < segs.length && !REF_KEYWORDS.has(segs[i + 1].toLowerCase())) {
      out.push(abbr + segs[i + 1])
      i++
    }
  }
  return out.join(' ')
}

/** gid + ref → a legislation.gov.uk URL that resolves. */
export function legislationUrl(gid: string, ref: string): string {
  const base = `https://www.legislation.gov.uk/${gid}`
  const path = refToPath(ref)
  return path ? `${base}/${path}` : base
}

/**
 * The URL for one search result. For the gid-bearing legislation types the derived
 * form WINS over the stored `sourceUrl` (see the header); for everything else the
 * stored url is the real page and is used as-is.
 */
export function resolveResultUrl(type: SearchResultType, id: string, sourceUrl: string | null | undefined): string {
  if (isGidBearingType(type)) {
    const gid = gidFromId(id)
    if (gid) return legislationUrl(gid, refFromId(id))
  }
  // §19-E Task 8 — committees.parliament.uk stores the bare `/{id}/` form, which 404s
  // for all three document families. Applied unconditionally rather than gated on
  // `type === 'COMMITTEE'`: the same host appears under COMMITTEE and GUIDANCE
  // depending on the corpus a row came from, and a repair that only fires for one of
  // them leaves the other broken for reasons nobody will remember. `committeeUrl` is
  // a no-op on any URL that is not the exact bare form.
  return committeeUrl(sourceUrl ?? '')
}

/**
 * The same repair for refs read back out of STORED state (`Idea.legislationRefs`,
 * `Idea.stageSearches`, an exported briefing) — where `type` is a loose string and
 * any field may be absent. Every ref stored before this fix holds a 404 URL; this
 * is what stops those ideas needing a data migration to become clickable.
 */
export function repairRefUrl(
  type: string | null | undefined,
  id: string | null | undefined,
  url: string | null | undefined,
): string {
  if (!id || !type) return committeeUrl(url ?? '')
  if (!GID_BEARING.includes(type as SearchResultType)) return committeeUrl(url ?? '')
  const gid = gidFromId(id)
  return gid ? legislationUrl(gid, refFromId(id)) : committeeUrl(url ?? '')
}
