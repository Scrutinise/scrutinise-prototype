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
/**
 * Collections whose destination is a DIFFERENT CONSUMER — the position graph — rather than a
 * retrieval stream. Recorded 2026-08-10 (BRIEF_SEARCH_S2C3 §2).
 *
 * ⚠ THIS REGISTRY IS DOCUMENTATION, NOT ENFORCEMENT, and the difference from `EXCLUDED_BY_DESIGN`
 * above is deliberate. That one is checked by `corpusToType` and makes a collection unreachable.
 * This one changes NOTHING at runtime: these collections keep their display type, keep whatever
 * reachability they have, and are still delivered by the unrouted/fail-open path today. It exists
 * so the reachability matrix can print a third word.
 *
 * WHY A THIRD WORD. `excluded-by-design` was added because a collection nobody can reach ON
 * PURPOSE must not print the same word as one nobody can reach BY MISTAKE. A collection routed to
 * a different consumer entirely is a third case: it is not a defect, and it is not a decision that
 * it should never be seen — it is a decision that retrieval is the wrong door for it.
 *
 * An EDM is thin as a document to read and dense as DATA: a named list of members who endorsed a
 * specific proposition on a specific date, with no inference required. That is a position edge of
 * the highest confidence tier. Petitions are the same shape for public salience.
 *
 * The design lives in `docs/POSITION_GRAPH_DESIGN.md` §3 ("Nodes and edges"). ⚠ That file did not
 * exist in this working tree when the deferral was made on 2026-08-10 and arrived shortly after;
 * the original note said so rather than citing a document nobody here could open (docs/CLAUDE.md
 * §19). It is "design only, nothing built", with implementation slated for Stage 2D.
 *
 * ⚠ As of 2026-08-11 its §3 edge list does NOT name an EDM-derived edge — it carries
 * `declared-interest`, `voted`, `gave-evidence-to` and others. So the destination is real but the
 * specific edge these two collections are being held for is not yet written down there. If that
 * is still true when Stage 2D starts, one of the two documents is wrong and this is the seam.
 */
export const DEFERRED_TO_GRAPH: Record<string, string> = {
  'early-day-motions': 'a named list of members endorsing a proposition on a date — a high-confidence position-graph edge, not a document to retrieve and read',
  'petitions': 'the same shape as an EDM but for public salience rather than parliamentary position',
}

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
//   - explanatory-notes / explanatory-memoranda → EXPLANATORY_NOTE. The plain-English
//     statements of what a provision was FOR, published alongside Acts and SIs. They sit under
//     the `legislation` tier in the index, and the `legislation` router stream selects that tier
//     with no type filter, so typing them non-null is the whole reachability fix: a query about
//     an Act can now surface the note explaining it. ⚠ They are deliberately NOT typed as
//     PRIMARY_LEGISLATION / STATUTORY_INSTRUMENT — those are `isLeg` in fts-search.ts and
//     vector-search.ts, which rewrites the title to the Act's title and the URL to a
//     legislation.gov.uk PROVISION link, i.e. it would present the annotation as the enacted
//     text. `check:corpus-types` asserts that property so a later refactor cannot restore it.
//     ⚠ THE INTERIM IS OVER. S2C typed these GUIDANCE and recorded it as the least-wrong of the
//     nine types rather than a fit; Charlie approved the tenth type on 2026-08-10 (S2C2 §1) for
//     the reason the interim note gave — "Guidance & regulators" tells a reader they have a
//     regulator's soft law in front of them when they have a statement of legislative intent.
//   - erskine-may → GUIDANCE. Parliamentary procedure: what the House can and cannot do with
//     a proposal. Typing it is necessary but NOT sufficient — it carries tier `other`, which
//     no stream selects, so stream-scopes.ts also lists it in the guidance stream's
//     `extraCorpora`. See that file for why the tier cannot simply be corrected here.
const CORPUS_DISPLAY_OVERRIDE: Record<string, SearchResultType> = {
  'explanatory-notes': 'EXPLANATORY_NOTE',
  'explanatory-memoranda': 'EXPLANATORY_NOTE',
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

  // ── S2C6 §1 additions (2026-08-12) — the four V34 political-evidence corpora ────
  // Mapped HERE rather than in the tier switch below, even though this is the one time the
  // indexed tier will be right from day one (the FTS/vector build that carries them is being
  // run in the same sprint as this map, so `tierFor()` and the index agree). The override is
  // still the right home: it is the axis that does not depend on the tier the index happens to
  // hold, and every previous collection that relied on the switch eventually drifted off it.
  //
  // Reasoning per collection is in page1-config.ts beside the type declarations; the one-line
  // version is that each of the three labels answers a different question — DIVISION is what
  // Parliament DID, IMPACT_ASSESSMENT is what the government PREDICTED, CONSULTATION is what
  // the public SAID — and collapsing any of them into DEBATE or GUIDANCE tells a reader
  // something false about the document in front of them.
  'commons-divisions-votes': 'DIVISION',
  'lords-divisions-votes': 'DIVISION',
  'impact-assessments': 'IMPACT_ASSESSMENT',
  'consultations': 'CONSULTATION',
}

/**
 * Last-resort display name for a collection, used when a row has no `sectionTitle` at all and
 * the adapters would otherwise put the raw corpus KEY in front of a user.
 *
 * ⚠ ADDED FOR A CORRECTNESS REQUIREMENT, NOT FOR TIDINESS (S2C2 §3). A reader must be able to
 * tell Holyrood from Westminster at a glance — someone reading a Scottish Parliament Official
 * Report believing it to be a Commons debate is a worse outcome than never finding it. 1,043,264
 * of the 1,044,188 `scottish-parliament-or` rows already carry a `sectionTitle` beginning
 * "Scottish Parliament: …", so the requirement is met by the data for 99.91% of them; this closes
 * the 924 that carry no title and would have rendered as the literal string
 * `scottish-parliament-or`.
 *
 * Deliberately a NAMED map with no generic prettifier: a rule that turned any key into title case
 * would silently rename 70 collections on the strength of a regex. Unnamed collections keep
 * exactly the behaviour they have today.
 */
const CORPUS_DISPLAY_NAME: Record<string, string> = {
  'scottish-parliament-or': 'Scottish Parliament — Official Report',
  'explanatory-notes': 'Explanatory Notes',
  'explanatory-memoranda': 'Explanatory Memorandum',
  'erskine-may': 'Erskine May — parliamentary procedure',
  // S2C6 §1. The last-resort floor for the V34 corpora; the real naming is in
  // political-title.ts, which never returns one of these unless the row has no title at all.
  'commons-divisions-votes': 'House of Commons division',
  'lords-divisions-votes': 'House of Lords division',
  'impact-assessments': 'Impact Assessment',
  'consultations': 'Government consultation',
}

export function corpusDisplayName(corpus: string): string {
  return CORPUS_DISPLAY_NAME[corpus] ?? corpus
}

/**
 * Collections whose `sectionTitle` in **Neon** supersedes the one baked into the **FTS index**.
 *
 * ⚠ WHY THIS IS NEEDED AT ALL. `corpus_fts` carries `sectionTitle` as it stood at index-build
 * time, and `fts-search.ts` reads the title off the FTS hit — so a title corrected in the database
 * afterwards is invisible to BM25 until the next full index build, while the DENSE path (which
 * hydrates from Neon) shows the corrected one immediately. The same row would then be titled
 * differently depending on which retriever found it. This is the tier-staleness problem
 * (`CORPUS_DISPLAY_OVERRIDE`, `extraCorpora`) appearing on a third axis.
 *
 * ⚠ AN EXPLICIT LIST, NEVER "always prefer the DB". Preferring Neon everywhere would silently
 * re-title any collection where the two have drifted for any reason, which is precisely the
 * byte-identity guarantee `check:annotation-titles` was built to hold. Naming the collection makes
 * it a decision.
 *
 * `bills-api` is here because v34-bills-metadata.ts rewrote all 6,574 titles on 2026-08-10: they
 * had been `Bill 2518 — publication 17` (an internal numeric id and an ordinal) and are now
 * `Abortion Bill — 2nd reading (last updated 2019)`. Remove this entry after the next full FTS
 * rebuild, at which point the index carries the corrected titles itself.
 */
const TITLE_FROM_DB = new Set(['bills-api'])

export function dbTitleSupersedesIndex(corpus: string): boolean {
  return TITLE_FROM_DB.has(corpus)
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
