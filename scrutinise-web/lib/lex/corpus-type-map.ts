// corpus-type-map.ts — the ONLY place native FTS corpus/tier → Lex SearchResultType
// is decided. Isolated so the mapping can be confirmed/changed in one file.
//
// The Lex enum (page1-config.ts) was extended (Charlie, 24 Jun 2026) so every corpus
// family has a home: the original 5 (PRIMARY_LEGISLATION / STATUTORY_INSTRUMENT /
// DEBATE / COMMITTEE / CASE_LAW) plus GUIDANCE, EU_LEGISLATION, BILL, TREATY.
//
// ⚠ A `null` FROM HERE IS A DELETION, NOT A DEMOTION. The FTS adapter drops the hit
// before any caller sees it, so a collection whose every row maps to null is indexed,
// searched, retrieved, paid for and discarded — invisible to every measurement taken
// through the app. docs/CORPUS_REACHABILITY.md counted the cost on 2026-08-09: four
// collections in that state, two of which (explanatory-notes, explanatory-memoranda)
// had 24,987 vectors built for them six hours earlier.
//
// ⚠ THAT IS WHY DELIBERATE EXCLUSIONS LIVE IN `EXCLUDED_BY_DESIGN` BELOW AND NOWHERE
// ELSE. Falling off the end of a switch and being deliberately excluded produced the
// same `null` and were indistinguishable from outside — so the one collection we mean
// to exclude looked exactly like the three we had lost by accident, and a sweep that
// "fixed the nulls" would have wired it in without anyone deciding to.

import type { SearchResultType } from './page1-config'

/**
 * Collections DELIBERATELY kept out of general search, with the reason attached.
 *
 * Checked FIRST, before tier and before every override, so the exclusion cannot be undone by
 * a re-tier or by a name-prefix rule added later. Exported so the reachability matrix can
 * report these as `excluded-by-design` rather than `UNREACHABLE` — a collection nobody can
 * reach ON PURPOSE and one nobody can reach BY MISTAKE must not print the same word.
 *
 * Adding an entry here is a product decision, not a mapping decision. Removing one is too.
 */
export const EXCLUDED_BY_DESIGN: Record<string, string> = {
  // SEARCH_STRATEGY.md §3.1: "a political-risk and people-graph input, not searched for its
  // own sake." The rows are named individuals against declared financial interests — 3,448 of
  // them, every one titled `{Member} — {category}`. Surfacing those in a policy research panel
  // would put a named person's finances next to an unrelated Act because both matched a word.
  // It is a people-graph join, and it should arrive through a people-graph surface or not at all.
  'members-interests': 'political-risk / people-graph input, not general search (SEARCH_STRATEGY.md §3.1)',
}

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

// ⚠ `PARLIAMENTARY_NON_DEBATE_NULL = ['members-interests', 'erskine-may']` used to live here
// and was DEAD CODE THAT LOOKED LIVE. Both collections carry tier `other` in the built index
// (3,448 and 1,873 rows), never `parliamentary`, so this branch was never reached for either —
// they were excluded by the `default:` case at the bottom, for a reason nobody had chosen.
// members-interests is now excluded explicitly (EXCLUDED_BY_DESIGN) and erskine-may is mapped
// (below), so nothing needs the set. Its deletion is the point: a reason recorded in a branch
// that cannot execute is a reason nobody is applying.

// ── Corpus-name overrides (taxonomy reconciliation, SEARCH_STRATEGY §10.2) ──────
// The FTS `tier` is BAKED INTO THE INDEX at build time (scripts/ingest corpus-map
// tierFor). Several sizeable corpora were seeded AFTER that map last covered them,
// so they carry tier:'other' in the live index and fell through to null → the panel
// HID them entirely (audit 2026-07-03: scottish-parliament-or = 1.04M sections lost,
// plus cma-cases/ofgem/ofcom/independent-reviews/cps-guidance/inquiry-evidence/lgsco,
// early-day-motions, petitions). Fixing tierFor only helps a FUTURE reindex, so the
// display layer corrects by CORPUS NAME here — effective on the live index now.
//   - scottish-parliament-or / EDMs / petitions → DEBATE (parliamentary business a
//     reformer cites; no dedicated motion/petition bucket exists).
//   - regulators + reviews + ombudsmen + inquiry material → GUIDANCE (matches the
//     "Guidance & regulators" bucket that already holds ico/fca/nao/inquiry-reports).
//
// ── S2C additions (2026-08-10, BRIEF_SEARCH_S2C §1a/§1b) ──────────────────────
// Three collections that the matrix found returning null, mapped here rather than in the
// tier switch because the override runs BEFORE it and so does not depend on the tier the
// index happens to carry — which is precisely what went wrong with erskine-may.
//
//   - explanatory-notes / explanatory-memoranda → GUIDANCE. The plain-English statements of
//     what a provision was FOR, published alongside Acts and SIs. They sit under the
//     `legislation` tier in the index, and the `legislation` router stream selects that tier
//     with no type filter, so typing them non-null is the whole fix: a query about an Act can
//     now surface the note explaining it. ⚠ They are deliberately NOT typed as
//     PRIMARY_LEGISLATION / STATUTORY_INSTRUMENT — those are `isLeg` in fts-search.ts and
//     vector-search.ts, which rewrites the title to the Act's title and the URL to a
//     legislation.gov.uk PROVISION link, i.e. it would present the annotation as the enacted
//     text. GUIDANCE keeps the note's own title and its own `/notes` URL.
//     ⚠ GUIDANCE IS AN INTERIM AND IS RECORDED AS ONE. The type's contract is "regulator +
//     soft-law" and its panel label is "Guidance & regulators"; an explanatory note is
//     departmental material laid alongside a Bill, not a regulator's. It is the least wrong
//     of the nine existing types (official, non-binding, explanatory, and free of the isLeg
//     rewrite), not a good fit. A tenth type — EXPLANATORY_NOTE — is proposed for Charlie in
//     the S2C report; adding one silently would change every panel's grouping.
//   - erskine-may → GUIDANCE. Parliamentary procedure: what the House can and cannot do with
//     a proposal. Typing it is necessary but NOT sufficient — it carries tier `other`, which
//     no stream selects, so stream-scopes.ts also lists it in the guidance stream's
//     `extraCorpora`. See that file for why the tier cannot simply be corrected here.
const CORPUS_DISPLAY_OVERRIDE: Record<string, SearchResultType> = {
  'explanatory-notes': 'GUIDANCE',
  'explanatory-memoranda': 'GUIDANCE',
  'erskine-may': 'GUIDANCE',
  'scottish-parliament-or': 'DEBATE',
  'early-day-motions': 'DEBATE',
  'petitions': 'DEBATE',
  'cma-cases': 'GUIDANCE',
  'ofgem': 'GUIDANCE',
  'ofcom': 'GUIDANCE',
  'independent-reviews': 'GUIDANCE',
  'cps-guidance': 'GUIDANCE',
  'inquiry-evidence': 'GUIDANCE',
  'lgsco': 'GUIDANCE',
}

/**
 * Map one FTS hit → a Lex SearchResultType, or null when the corpus family has no
 * agreed home (the adapter drops nulls). `tier` + `corpus` come from the FTS
 * response; `id` carries the gid. Corpus-name overrides run FIRST because the live
 * index's `tier` is stale for corpora seeded after the tier map last changed.
 */
export function corpusToType(corpus: string, tier: string, id: string): SearchResultType | null {
  // A DECIDED exclusion, ahead of everything — including the tier switch and the overrides —
  // so that re-tiering a collection or adding a prefix rule cannot quietly undo it.
  if (corpus in EXCLUDED_BY_DESIGN) return null
  const override = CORPUS_DISPLAY_OVERRIDE[corpus]
  if (override) return override
  switch (tier) {
    case 'caselaw':
      return 'CASE_LAW'
    case 'legislation': {
      // Backstop for an UNKNOWN `explanatory-*` collection only. The two we have are typed
      // GUIDANCE by the override above and never reach here; a future one must be a deliberate
      // entry there rather than falling into the doctype rules below, which would read
      // `explanatory-notes:en:ukpga/…` as the Act itself and mislabel an annotation as enacted
      // law. Excluded-until-decided, not excluded-for-good.
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
      // ⚠ The `PARLIAMENTARY_NON_DEBATE_NULL` test that stood here has been DELETED, not moved.
      // It named `members-interests` and `erskine-may`, and it never ran for either: both carry
      // tier `other` in the built index, so this case is unreachable for them. What excluded
      // them was the `default:` below — for no stated reason at all. `members-interests` is now
      // excluded at the top of this function with its reason attached, and `erskine-may` is
      // mapped. Anything genuinely parliamentary and genuinely not a debate belongs in one of
      // the explicit tests above, not in a catch-all set.
      // hansard / pwdata-* / lda-* / written-answers / written-statements / EDMs → DEBATE
      return 'DEBATE'
    case 'guidance':
      return 'GUIDANCE' // the whole tier
    default:
      return null // 'other' / unmapped → excluded
  }
}
