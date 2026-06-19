/**
 * corpus-map.ts — the single source of truth for tier + jurisdiction labels
 * written into the Lance FTS dataset at index time (Search S1b).
 *
 * Both maps are derived from `corpus_sections.corpus` ONLY (no DB column for
 * either exists — see FTS_BUILD_S1b §1.2). They are pure functions so the
 * indexer, query service, and scoring harness all agree.
 *
 * tier  — used for query-time per-tier filtering + the scoring archetype split.
 * jurisdiction — brief addition #2. Devolved corpora map to their nation;
 *   everything else defaults to 'uk'. `jurisdiction` is NOT a corpus_sections
 *   column, so this map is the only thing that prevents ~700k devolved rows
 *   being wrongly stamped 'uk'. No gold query filters on jurisdiction, so an
 *   unmapped corpus defaulting to 'uk' is a label-quality issue, not a scoring
 *   one.
 */

export type Tier = 'legislation' | 'caselaw' | 'parliamentary' | 'guidance' | 'other'

// Exact corpus → tier. Prefix families (pwdata-*, hmrc-*, lda-*) handled in
// tierFor() so a newly-seeded sibling corpus inherits the right tier for free.
const TIER_EXACT: Record<string, Tier> = {
  // legislation
  'primary-acts-pre-2000': 'legislation',
  'primary-acts-2000plus': 'legislation',
  'si-pre-2010': 'legislation',
  'si-2010plus': 'legislation',
  'regional': 'legislation',
  'retained-eu': 'legislation',
  'eur-lex': 'legislation',
  'explanatory-notes': 'legislation',
  'explanatory-memoranda': 'legislation',

  // caselaw  (tax-tribunals→caselaw, flagged debatable in the build doc)
  'tna-caselaw': 'caselaw',
  'et-decisions': 'caselaw',
  'echr-hudoc': 'caselaw',
  'ni-judgments': 'caselaw',
  'tax-tribunals': 'caselaw',
  'scottish-courts': 'caselaw', // V27

  // parliamentary  (uk-treaties / bills→parliamentary, flagged debatable)
  'historic-hansard': 'parliamentary',
  'written-answers': 'parliamentary',
  'written-statements': 'parliamentary',
  'niassembly-hansard': 'parliamentary',
  'senedd-cofnod': 'parliamentary',
  'scottish-parliament': 'parliamentary', // V27 (gated; harmless if unseeded)
  'committees-reports': 'parliamentary',
  'committees-evidence': 'parliamentary',
  'bills-api': 'parliamentary',
  'uk-treaties': 'parliamentary',
  'tax-treaties-dta': 'parliamentary',

  // guidance  (law-commission reports→guidance, flagged debatable)
  'fca-handbook': 'guidance',
  'college-of-policing': 'guidance',
  'sentencing-council': 'guidance',
  'quangos-govuk': 'guidance',
  'govuk-core-docs': 'guidance',
  'nao-reports': 'guidance',
  'ots-reports': 'guidance',
  'oecd': 'guidance',
  'inquiry-reports': 'guidance',
  'lawcom': 'guidance',
  'scotlawcom': 'guidance',
  'nilawcom': 'guidance',
  'building-regs': 'guidance',
  'planning-policy': 'guidance',
  'ico': 'guidance', // V27
}

export function tierFor(corpus: string): Tier {
  const exact = TIER_EXACT[corpus]
  if (exact) return exact
  if (corpus.startsWith('pwdata-')) return 'parliamentary'
  if (corpus.startsWith('lda-')) return 'parliamentary'
  if (corpus.startsWith('hmrc-')) return 'guidance'
  return 'other'
}

export type Jurisdiction = 'uk' | 'wales' | 'scotland' | 'ni'

export function jurisdictionFor(corpus: string): Jurisdiction {
  if (corpus.startsWith('senedd')) return 'wales'
  if (corpus.startsWith('scottish') || corpus === 'scotlawcom') return 'scotland'
  if (corpus === 'niassembly-hansard' || corpus === 'ni-judgments' || corpus === 'nilawcom') return 'ni'
  return 'uk'
}
