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
  // V35/S2C6 §1 — an impact assessment is the government's own case for a PROVISION: what
  // problem it was solving, what it expected to cost, what it predicted would happen. 17,769 of
  // its 18,756 sections (94.7%) carry a `parentDocId` naming the instrument they assess, which is
  // the evidence for putting them here rather than under `guidance`: they are attached to a
  // specific piece of law the way an explanatory note is, and they answer the same question the
  // legislation stream serves. Consultations are the deliberate contrast — see below.
  'impact-assessments': 'legislation',

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
  'uk-treaties-fcdo': 'parliamentary', // V31 STEP 1 — same family as uk-treaties
  'parliament-treaties': 'parliamentary', // V31 STEP 2 — CRaG 2010 scrutiny layer
  // V35/S2C6 §1 — roll-calls. Parliamentary by tier and DIVISION by display type, which is not
  // the same decision: the tier is retrieval scope (the debates stream is the only parliamentary
  // stream the router addresses), the type is what a reader is told they are looking at. A Lords
  // division's stored `sectionTitle` is the bare bill name — "Employment Rights Bill" — so under
  // the DEBATE label it would be indistinguishable from a Lords debate on that bill.
  'commons-divisions-votes': 'parliamentary',
  'lords-divisions-votes': 'parliamentary',

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
  // V35/S2C6 §1 — a consultation is the record of who was asked and what they said BEFORE the law
  // existed. It sits here rather than under `legislation` on the evidence: 0 of its 7,448 sections
  // carry a `parentDocId`, against 94.7% of impact assessments. They are not attached to an
  // instrument, and the guidance tier is where the corpus already keeps government material that
  // is ABOUT policy rather than being law (NAO, inquiry reports, the law commissions).
  // ⚠ The tier is not the label. Consultations display as CONSULTATION, never GUIDANCE — the
  // "Guidance & regulators" heading would tell a reader they have a regulator's soft law in front
  // of them when they have a department asking the public a question. That is exactly the error
  // the tenth type was created to fix (S2C2 §1).
  'consultations': 'guidance',
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
