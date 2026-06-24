// corpus-type-map.ts — the ONLY place native FTS corpus/tier → Lex SearchResultType
// is decided. Isolated so the mapping can be confirmed/changed in one file.
//
// The Lex enum (page1-config.ts) was extended (Charlie, 24 Jun 2026) so every corpus
// family has a home: the original 5 (PRIMARY_LEGISLATION / STATUTORY_INSTRUMENT /
// DEBATE / COMMITTEE / CASE_LAW) plus GUIDANCE, EU_LEGISLATION, BILL, TREATY. Only a
// few tiny procedural corpora (petitions, members-interests, erskine-may) and the
// legislation ANNOTATIONS (explanatory-notes/-memoranda — not the legislation itself)
// remain `null` → the adapter EXCLUDES them from results.

import type { SearchResultType } from './page1-config'

// gid doctype → type, for the legislation tier (corpus alone can't split acts vs SIs;
// `regional` mixes devolved acts AND devolved SIs, so we read the doctype off the gid).
const PRIMARY_DOCTYPES = new Set([
  'ukpga', 'ukla', 'apgb', 'aep', 'aip', 'apni', 'mnia', 'nia', 'ani', // UK/historic/NI primary
  'asp', 'anaw', 'asc', 'mwa', 'aosp', 'gbla', 'ukcm', 'gbppa', 'ukppa', // Scotland/Wales/Church/local
])
const SI_DOCTYPES = new Set([
  'uksi', 'ukmo', 'ukci', 'ukdsi', // UK SIs / orders
  'ssi', 'sdsi', 'wsi', 'wdsi', 'nisr', 'nisi', 'nidsr', 'nisro', // devolved SIs / NI rules & orders
])
// EU / retained-EU doctypes → EU_LEGISLATION.
const EU_DOCTYPES = new Set(['eur', 'eudr', 'eudn', 'eudc', 'eut', 'eudt'])

/** gid like "ukpga/1988/52" → doctype "ukpga". */
function doctypeFromGid(id: string): string | null {
  const parts = id.split(':')
  const gid = parts.length >= 2 ? parts[1] : null
  if (!gid || !gid.includes('/')) return null
  return gid.split('/')[0].toLowerCase()
}

// Parliamentary corpora that are NOT debates: committees → COMMITTEE; a few
// procedural/registry corpora have no debate home (PENDING) → null.
const PARLIAMENTARY_NON_DEBATE_NULL = new Set(['petitions', 'members-interests', 'erskine-may'])

/**
 * Map one FTS hit → a Lex SearchResultType, or null when the corpus family has no
 * agreed home in the current 5-enum (the adapter drops nulls).
 * `tier` + `corpus` come straight from the FTS response; `id` carries the gid.
 */
export function corpusToType(corpus: string, tier: string, id: string): SearchResultType | null {
  switch (tier) {
    case 'caselaw':
      return 'CASE_LAW'
    case 'legislation': {
      // Annotations, not the legislation itself → excluded (would mislabel as the Act/SI).
      if (corpus.startsWith('explanatory')) return null
      if (corpus === 'retained-eu' || corpus === 'eur-lex') return 'EU_LEGISLATION'
      const dt = doctypeFromGid(id)
      if (dt && EU_DOCTYPES.has(dt)) return 'EU_LEGISLATION'
      if (dt && PRIMARY_DOCTYPES.has(dt)) return 'PRIMARY_LEGISLATION'
      if (dt && SI_DOCTYPES.has(dt)) return 'STATUTORY_INSTRUMENT'
      // Fallback on corpus when the gid doctype is unknown/absent.
      if (corpus.startsWith('primary-acts')) return 'PRIMARY_LEGISLATION'
      if (corpus.startsWith('si-')) return 'STATUTORY_INSTRUMENT'
      return null
    }
    case 'parliamentary':
      if (corpus.startsWith('committees')) return 'COMMITTEE'
      if (corpus === 'bills-api') return 'BILL'
      if (corpus === 'uk-treaties' || corpus === 'tax-treaties-dta') return 'TREATY'
      // Tiny procedural/registry corpora with no debate home → excluded.
      if (PARLIAMENTARY_NON_DEBATE_NULL.has(corpus)) return null
      // hansard / pwdata-* / lda-* / written-answers / written-statements / EDMs → DEBATE
      return 'DEBATE'
    case 'guidance':
      return 'GUIDANCE' // the whole tier
    default:
      return null // 'other' / unmapped → excluded
  }
}
