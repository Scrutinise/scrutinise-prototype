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

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // S11 §1 — THE SEVEN COLLECTIONS NO QUERY COULD RETURN. Added 2026-08-21.
  // ══════════════════════════════════════════════════════════════════════════════════════════
  // Every one of these was display-typed GUIDANCE by `corpusToType` and indexed under tier
  // `other`, which no `StreamScope` names — so they were retrievable in the index and
  // unreachable in the product, exactly the state S10 found `cps-guidance` in. Confirmed
  // ONE AT A TIME against the live service rather than inferred from the pattern
  // (`scrutinise-web/scripts/probe-s11-reachability.ts`): each returns at rank 0–4 scoped to its
  // own corpus, and NO router stream returns it when the same query is issued with that stream's
  // real scope. 8 of 8 probed, 8 of 8 confirmed; the ninth (`lgsco`) is included on the tier
  // evidence because it has no title long enough to probe with — see the report.
  //
  // ⚠ THEY ARE ALL REGULATORS OR REVIEWERS, WHICH IS WHY THEY GO TO ONE PLACE AND NOT SEVEN.
  // The guidance tier is already defined as "government material that is ABOUT policy rather
  // than being law" (see `consultations` above, and NAO / inquiry reports / the law commissions).
  // A competition decision, an energy licence condition, an ombudsman finding and a statutory
  // review are all that. Their DISPLAY type already said GUIDANCE; only the retrieval scope
  // disagreed.
  //
  // ⚠⚠ AND THE BRIEF'S WARNING AGAINST THIS WAS TESTED RATHER THAN ACCEPTED, BECAUSE IT IS ABOUT
  // A DIFFERENT MECHANISM. BRIEF_SEARCH_S11 §1 says widening a stream is zero-sum, citing S10:
  // admitting `cps-guidance` cost consultations two answers. That measurement is of the EXTRA-LEG
  // path, where `mergeLegs` slices two rankings into one fixed budget — a quota, so a gain is
  // taken from somewhere. A tier move has no second leg and no budget to divide: the rows join
  // the MAIN leg and have to earn their place on score.
  //
  // Measured before building (`scrutinise-web/scripts/measure-s11-tier.ts`), in-stream recall@20
  // on Charlie's validated set, dense off, arms differing ONLY in which rows are eligible:
  //
  //     guidance        3/10  →  8/10     (+5: Q22, Q23, Q25, Q26, Q27 recovered)
  //     consultations   4/9   →  4/9      (unchanged — not one question lost, not one rank moved)
  //
  // So the trade S10 measured is a property of the extra leg, not of the collection. That is what
  // makes this the durable fix `stream-scopes.ts` said it would be, and it is measured rather
  // than asserted.
  //
  // ⚠ THE TIER IS NOT THE LABEL, and this changes only the tier. Each keeps the display type
  // `corpusToType` already gives it.
  'cma-cases': 'guidance',            // 22,898 — CMA competition and merger decisions
  'ofgem': 'guidance',                // 17,161 — energy regulator decisions, licence conditions
  'ofcom': 'guidance',                //  4,169 — communications regulator (carries gold question GD4)
  'independent-reviews': 'guidance',  //    667 — statutory and independent reviews
  'cps-guidance': 'guidance',         //    270 — S10 §1's finding; the flag it shipped behind retires with this
  'inquiry-evidence': 'guidance',     //     90 — public inquiry evidence (`inquiry-reports` is already here)
  'lgsco': 'guidance',                //     40 — Local Government and Social Care Ombudsman

  // ⚠⚠ `uk-treaties` (3,264) AND `tax-treaties-dta` (324) ARE DELIBERATELY NOT LISTED, AND THEY
  // ARE STILL UNREACHABLE. Their mechanism is different and a tier entry would not fix them:
  // both are already in the `parliamentary` tier, and they are excluded twice over — named in
  // `NON_DEBATE_PARLIAMENTARY`, and display-typed TREATY, which neither `debates`
  // (`types: ['DEBATE','DIVISION']`) nor `committees` (`['COMMITTEE']`) admits. Fixing them means
  // admitting a type to a stream or building a sixth, and BRIEF_SEARCH_S11 §1 makes that Charlie's
  // decision with the latency cost stated.
  //
  // ⚠ It cannot be measured today either: the validated set has ZERO debates questions (S10 §7
  // Q5), so a change to what the debates stream returns has nothing to score against. Changing it
  // blind would break the rule that a scope change ships with a before-and-after. Reported, not
  // done — with the sharp version in the report: `uk-treaties-fcdo` (23,372 sections) IS reachable
  // because it happens to be typed DEBATE, so the corpus answers treaty questions from one
  // collection and not from its sibling, on a type distinction no user made.
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
