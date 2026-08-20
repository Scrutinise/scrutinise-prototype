/**
 * s10-gold-set.ts — CHARLIE'S VALIDATED QUESTION SET, as data.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * PROVENANCE, BECAUSE IT IS THE WHOLE POINT OF THIS FILE
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * Transcribed from `docs/GOLD_CANDIDATES_S8.md` on 2026-08-20, AFTER Charlie's validation pass.
 * The markdown remains the source of record; this is a mechanical transcription of it so a harness
 * can score without parsing prose. `scripts/check-s10-gold.ts` re-reads the markdown and asserts
 * this file agrees with it — question text, key list and verdict — so the two cannot drift.
 *
 * ⚠ THE KEYS ARE NOT MINE AND ARE NOT EDITED HERE. Where the markdown wrote a key with an ellipsis
 * (`…-0002`, `…:165036`) the shared prefix is expanded, and nothing else. The four REJECTED
 * questions are PRESENT in this file with `verdict: 'REJECT'` — §5 requires them preserved, not
 * deleted, and a scorer that silently lacked them would be a scorer that had deleted them.
 *
 * ⚠ WHY `streamsHint` IS A HINT AND NOT A FILTER. It records which router stream OWNS the
 * collection a question's key sits in, so per-collection recall can be reported. It is NEVER passed
 * to retrieval: scoring a question only against the stream we expect to answer it would measure the
 * scope table rather than the search. Every question is asked of the whole gateway.
 *
 * ⚠ IMPACT ASSESSMENTS AND CONSULTATIONS DO NOT HAVE THEIR OWN STREAM unless
 * `LEX_ROUTER_STREAMS_V2` is on (stream-scopes.ts). With it off, Q31–Q39 are reachable only through
 * `legislation` and Q41–Q49 only through `guidance`, competing for those streams' interleave slots.
 * That is a fact about the configuration, not about the questions, and the harness reports which
 * arm produced every number.
 */

export type GoldVerdict = 'ACCEPT' | 'REJECT'

/** How a question is scored. Recall questions have a key; behaviour questions deliberately do not. */
export type GoldScoring =
  /** Standard: did a known-correct document come back in the top N. */
  | 'recall'
  /** §1.3 — a helpful answer is a FAILURE. Scored pass/fail on whether the gap is stated. */
  | 'negative-control'
  /** §1.3 — scored on recall, but flagged so a low score reads as a discoverability finding. */
  | 'recall-known-hard'

export type GoldCollection =
  | 'committees' | 'caselaw' | 'guidance'
  | 'impact-assessments' | 'consultations' | 'statistics'

export interface GoldQuestion {
  /** Q1–Q60, the running number Charlie reviewed against. */
  n: number
  /** The original S8 block code (C1, K7, I10 …). SEARCH_S8_REPORT.md and the change log cite these. */
  code: string
  collection: GoldCollection
  /** The question as written — what is actually sent to retrieval. */
  question: string
  /** corpus_sections ids that answer it. Empty for a negative control, BY DESIGN. */
  keys: string[]
  verdict: GoldVerdict
  scoring: GoldScoring
  /** Which router stream owns the collection. Reporting only — never passed to retrieval. */
  streamsHint: string
  /** Present on REJECT only: why, and what unblocks a re-key (§5). */
  rejectReason?: string
  /** Present on a negative control: what the platform is required to DO instead of answering. */
  requiredBehaviour?: string
}

// ── Q1–Q10 · COMMITTEES ─────────────────────────────────────────────────────────────────────────
// §1.4: "the one number that matters most". Committees has been unevaluable since S7 — at a 100%
// ceiling on questions CC wrote for itself, which is a ceiling and not a result.
const COMMITTEES: GoldQuestion[] = [
  { n: 1, code: 'C1', collection: 'committees', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'committees',
    question: 'What did the Lords say about how badly water and sewage regulation was failing?',
    keys: ['committees-reports:publication:34458:189872-0001', 'committees-reports:publication:34458:189872-0002'] },
  { n: 2, code: 'C2', collection: 'committees', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'committees',
    question: 'Has a committee looked at the Post Office Horizon compensation scheme?',
    keys: ['committees-reports:publication:48294:252814', 'committees-reports:publication:34605:190516'] },
  { n: 3, code: 'C3', collection: 'committees', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'committees',
    question: "What has Parliament been told about the government's response to the Grenfell Inquiry?",
    keys: ['committees-reports:publication:46883:241779'] },
  { n: 4, code: 'C4', collection: 'committees', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'committees',
    question: 'What did the committee say about moving people onto Universal Credit?',
    keys: ['committees-reports:publication:22289:164915', 'committees-reports:publication:22289:165036'] },
  { n: 5, code: 'C5', collection: 'committees', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'committees',
    question: 'Has anyone in Parliament raised leasehold reform with ministers?',
    keys: ['committees-reports:publication:34123:187763', 'committees-reports:publication:255:1142', 'committees-reports:publication:257:1111'] },
  { n: 6, code: 'C6', collection: 'committees', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'committees',
    question: 'What did people submitting evidence say about how AI should be governed?',
    keys: ['committees-evidence:writtenevidence:112256:179384', 'committees-evidence:writtenevidence:112257:175552'] },
  { n: 7, code: 'C7', collection: 'committees', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'committees',
    question: 'What evidence was submitted about net zero and trade?',
    keys: ['committees-evidence:writtenevidence:129871:220666', 'committees-evidence:writtenevidence:129872:220668'] },
  { n: 8, code: 'C8', collection: 'committees', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'committees',
    question: 'What did witnesses tell the committee about special educational needs?',
    keys: ['committees-evidence:writtenevidence:100004:146799', 'committees-evidence:writtenevidence:100008:145455'] },
  { n: 9, code: 'C9', collection: 'committees', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'committees',
    question: 'What was the committee told about serious violence?',
    keys: ['committees-evidence:writtenevidence:100005:145526'] },
  { n: 10, code: 'C10', collection: 'committees', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'committees',
    question: 'Has Parliament examined NHS waiting times for planned operations?',
    keys: ['committees-reports:publication:50376:272506', 'committees-reports:publication:22555:166025'] },
]

// ── Q11–Q20 · CASE LAW ──────────────────────────────────────────────────────────────────────────
// ⚠⚠ §0 DEPENDENCY 1: case law CANNOT be honestly measured in this sprint. CC-Ingest is re-compiling
// the stored text, which today is an Akoma Ntoso stylesheet preamble; every prior case-law
// measurement was taken over formatting code. Scores here are a PRE-FIX BASELINE, labelled as such,
// and no recommendation is made from them.
const CASELAW: GoldQuestion[] = [
  { n: 11, code: 'K1', collection: 'caselaw', scoring: 'recall', verdict: 'REJECT', streamsHint: 'caselaw',
    question: 'Can a public body be taken to court for failing to consider equality when making cuts?',
    keys: ['tna-caselaw:[2015] UKSC 21:1'],
    rejectReason: '[2015] UKSC 21 is R (Evans) v Attorney General — the "black spider memos" FOI case, not a public sector equality duty case. AWAITING RE-KEY: re-keying needs a subject-searchable case-law index, which does not exist until CC-Ingest\'s text fix lands.' },
  { n: 12, code: 'K2', collection: 'caselaw', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'caselaw',
    question: 'What did the Supreme Court decide about prorogation of Parliament?',
    keys: ['tna-caselaw:[2019] UKSC 41:1'] },
  { n: 13, code: 'K3', collection: 'caselaw', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'caselaw',
    question: 'Has the Supreme Court ruled on whether gig-economy workers are employees?',
    keys: ['tna-caselaw:[2021] UKSC 5:1'] },
  { n: 14, code: 'K4', collection: 'caselaw', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'caselaw',
    question: 'What has the Supreme Court said about deprivation of liberty in care settings?',
    keys: ['tna-caselaw:[2014] UKSC 19:1'] },
  { n: 15, code: 'K5', collection: 'caselaw', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'caselaw',
    question: 'Is there a Supreme Court case about employment tribunal fees?',
    keys: ['tna-caselaw:[2017] UKSC 51:1'] },
  { n: 16, code: 'K6', collection: 'caselaw', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'caselaw',
    question: 'What did the court decide about the duty to investigate deaths in custody?',
    keys: ['tna-caselaw:[2011] UKSC 20:1'] },
  { n: 17, code: 'K7', collection: 'caselaw', scoring: 'recall', verdict: 'REJECT', streamsHint: 'caselaw',
    question: 'Has the Supreme Court considered whether benefit caps discriminate?',
    keys: ['tna-caselaw:[2015] UKSC 21:1'],
    rejectReason: 'The SAME citation as Q11, and it is R (Evans) v Attorney General — an FOI case, not a benefit-cap discrimination case. AWAITING RE-KEY: needs a subject-searchable case-law index.' },
  { n: 18, code: 'K8', collection: 'caselaw', scoring: 'recall', verdict: 'REJECT', streamsHint: 'caselaw',
    question: 'What is the leading case on when a public authority owes a duty of care?',
    keys: ['tna-caselaw:[2018] UKSC 22:1'],
    rejectReason: '[2018] UKSC 22 is Newcastle upon Tyne Hospitals NHS FT v Haywood — an employment notice-period case, not a duty-of-care case. AWAITING RE-KEY: needs a subject-searchable case-law index.' },
  { n: 19, code: 'K9', collection: 'caselaw', scoring: 'recall', verdict: 'REJECT', streamsHint: 'caselaw',
    question: 'Has the Supreme Court ruled on the legality of a government policy on climate targets?',
    keys: ['tna-caselaw:[2020] UKSC 12:1'],
    rejectReason: '[2020] UKSC 12 is WM Morrison Supermarkets v Various Claimants — vicarious liability for a data breach, not a climate-targets case. AWAITING RE-KEY: needs a subject-searchable case-law index.' },
  // The exact-pin control. Charlie's own note: "a real user would NOT ask this" — it is a pure
  // citation lookup with no topical content, which retrieval should ace. If it does not, the
  // problem is the index rather than the question set.
  { n: 20, code: 'K10', collection: 'caselaw', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'caselaw',
    question: 'What did the Court of Appeal decide in [2003] EWCA Civ 1769?',
    keys: ['tna-caselaw:[2003] EWCA Civ 1769:1'] },
]

// ── Q21–Q30 · GUIDANCE ──────────────────────────────────────────────────────────────────────────
const GUIDANCE: GoldQuestion[] = [
  { n: 21, code: 'G1', collection: 'guidance', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'guidance',
    question: 'What does HMRC say about why the money laundering rules cover company formation agents?',
    keys: ['hmrc-manuals:hmrc-internal-manuals/economic-crime-supervision-handbook/ecsh52050:1'] },
  { n: 22, code: 'G2', collection: 'guidance', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'guidance',
    question: 'How do prosecutors decide whether to charge in a domestic abuse case?',
    keys: ['cps-guidance:prosecution-guidance/domestic-abuse:1'] },
  { n: 23, code: 'G3', collection: 'guidance', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'guidance',
    question: 'What happens when someone is accused of making a false allegation of rape?',
    keys: ['cps-guidance:prosecution-guidance/perverting-course-justice-and-wasting-police-time-cases-involving-allegedly:1'] },
  { n: 24, code: 'G4', collection: 'guidance', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'guidance',
    question: 'What are the rules police have to follow when stopping and searching someone?',
    keys: ['college-of-policing:app-content/stop-and-search:1'] },
  { n: 25, code: 'G5', collection: 'guidance', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'guidance',
    question: 'What is the CPS guidance on abuse of process?',
    keys: ['cps-guidance:prosecution-guidance/abuse-process:1'] },
  { n: 26, code: 'G6', collection: 'guidance', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'guidance',
    question: "How does a case get sent from the magistrates' court to the Crown Court?",
    keys: ['cps-guidance:prosecution-guidance/allocation-sending-and-committal-sentence:1'] },
  { n: 27, code: 'G7', collection: 'guidance', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'guidance',
    question: 'How do I appeal a decision to the Administrative Court?',
    keys: ['cps-guidance:prosecution-guidance/appeals-administrative-court:1'] },
  { n: 28, code: 'G8', collection: 'guidance', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'guidance',
    question: 'What guidance does HMRC give its own staff on money laundering compliance checks?',
    keys: ['hmrc-manuals:hmrc-internal-manuals/money-laundering-regulations-compliance/mlr3cupdate001:1'] },
  { n: 29, code: 'G9', collection: 'guidance', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'guidance',
    question: 'When can HMRC depart from the strict letter of the law?',
    keys: ['hmrc-manuals:hmrc-internal-manuals/admin-law-manual/adml4100:1'] },
  { n: 30, code: 'G10', collection: 'guidance', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'guidance',
    question: 'What happens if HMRC gives a taxpayer wrong advice?',
    keys: ['hmrc-manuals:hmrc-internal-manuals/admin-law-manual/adml1800:1', 'hmrc-manuals:hmrc-internal-manuals/admin-law-manual/adml1100:1'] },
]

// ── Q31–Q40 · IMPACT ASSESSMENTS ────────────────────────────────────────────────────────────────
const IMPACT: GoldQuestion[] = [
  { n: 31, code: 'I1', collection: 'impact-assessments', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'impact-assessments (V2) / legislation',
    question: 'What did the government think banning plastic straws would cost?',
    keys: ['impact-assessments:2020-57:1', 'impact-assessments:2020-57:2'] },
  { n: 32, code: 'I2', collection: 'impact-assessments', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'impact-assessments (V2) / legislation',
    question: 'What did the government predict the building safety levy scheme would do?',
    keys: ['impact-assessments:2023-77:1', 'impact-assessments:2023-77:2', 'impact-assessments:2023-77:3'] },
  { n: 33, code: 'I3', collection: 'impact-assessments', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'impact-assessments (V2) / legislation',
    question: 'What was the predicted cost of the residual waste reduction target?',
    keys: ['impact-assessments:2023-14:1', 'impact-assessments:2023-14:3'] },
  { n: 34, code: 'I4', collection: 'impact-assessments', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'impact-assessments (V2) / legislation',
    question: 'Did the Regulatory Policy Committee approve the tobacco products fees regulations?',
    keys: ['impact-assessments:2017-78:2'] },
  { n: 35, code: 'I5', collection: 'impact-assessments', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'impact-assessments (V2) / legislation',
    question: 'What did the government say the tobacco fee changes would cost business?',
    keys: ['impact-assessments:2017-78:3'] },
  { n: 36, code: 'I6', collection: 'impact-assessments', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'impact-assessments (V2) / legislation',
    question: 'What was the impact assessment for the environmental permitting changes?',
    keys: ['impact-assessments:2018-21:1', 'impact-assessments:2018-21:2', 'impact-assessments:2018-21:3'] },
  { n: 37, code: 'I7', collection: 'impact-assessments', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'impact-assessments (V2) / legislation',
    question: 'What did the government expect from the data adequacy decision for South Korea?',
    keys: ['impact-assessments:2022-92:1', 'impact-assessments:2022-92:2'] },
  { n: 38, code: 'I8', collection: 'impact-assessments', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'impact-assessments (V2) / legislation',
    question: "What was the justification for raising the Public Guardian's fees?",
    keys: ['impact-assessments:2017-92:4', 'impact-assessments:2017-92:3'] },
  { n: 39, code: 'I9', collection: 'impact-assessments', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'impact-assessments (V2) / legislation',
    question: 'What options did the government consider before setting the Public Guardian fee?',
    keys: ['impact-assessments:2017-92:6', 'impact-assessments:2017-92:7'] },
  // ⚠ NEGATIVE CONTROL. Charlie: "This question exists to test that the platform says nobody has
  // checked rather than substituting the prediction. A 'correct' answer here is an admission."
  { n: 40, code: 'I10', collection: 'impact-assessments', scoring: 'negative-control', verdict: 'ACCEPT', streamsHint: 'impact-assessments (V2) / legislation',
    question: 'Has anyone assessed whether the plastic straw ban actually worked?',
    keys: [],
    requiredBehaviour: 'State that no post-implementation review exists for this instrument. Returning the Q31 impact assessment as though it answered the question is the FAILURE this control exists to catch — a prediction substituted for an evaluation.' },
]

// ── Q41–Q50 · CONSULTATIONS ─────────────────────────────────────────────────────────────────────
const CONSULTATIONS: GoldQuestion[] = [
  { n: 41, code: 'N1', collection: 'consultations', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'consultations (V2) / guidance',
    question: 'What did the government consult on about reducing sewage discharges?',
    keys: ['consultations:government_consultations_storm-overflows-reducing-sewage-discharges:1', 'consultations:government_consultations_storm-overflows-discharge-reduction-plan:1'] },
  { n: 42, code: 'N2', collection: 'consultations', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'consultations (V2) / guidance',
    question: 'Was there a consultation on the smoking age ban?',
    keys: ['consultations:government_consultations_creating-a-smokefree-generation-and-tackling-youth-vaping:1'] },
  { n: 43, code: 'N3', collection: 'consultations', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'consultations (V2) / guidance',
    question: 'What did the government propose to change about building safety regulation?',
    keys: ['consultations:government_consultations_building-a-safer-future-proposals-for-reform-of-the-building-safety-regulatory-system:1'] },
  { n: 44, code: 'N4', collection: 'consultations', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'consultations (V2) / guidance',
    question: 'Has the government consulted on gambling sponsorship?',
    keys: ['consultations:government_consultations_consultation-on-banning-unlicensed-gambling-sponsorship:1'] },
  { n: 45, code: 'N5', collection: 'consultations', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'consultations (V2) / guidance',
    question: 'What has the government asked about AI and copyright?',
    keys: ['consultations:government_consultations_artificial-intelligence-and-ip-copyright-and-patents:1', 'consultations:government_consultations_artificial-intelligence-and-intellectual-property-call-for-views:1'] },
  { n: 46, code: 'N6', collection: 'consultations', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'consultations (V2) / guidance',
    question: 'What was consulted on for leasehold reform?',
    keys: ['consultations:government_consultations_implementing-reforms-to-the-leasehold-system:1'] },
  { n: 47, code: 'N7', collection: 'consultations', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'consultations (V2) / guidance',
    question: 'Is there guidance being consulted on for storm overflows?',
    keys: ['consultations:government_consultations_draft-information-and-guidance-on-storm-overflows:1'] },
  { n: 48, code: 'N8', collection: 'consultations', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'consultations (V2) / guidance',
    question: 'What did the government consult on for net zero aviation?',
    keys: ['consultations:government_consultations_achieving-net-zero-aviation-by-2050:1'] },
  // Deliberately OLD (2012) — tests whether the platform surfaces historic material or silently
  // favours the recent.
  { n: 49, code: 'N9', collection: 'consultations', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'consultations (V2) / guidance',
    question: 'Was there a consultation about electrical safety in building regulations?',
    keys: ['consultations:government_consultations_building-regulations-electrical-safety:1'] },
  // ⚠ NEGATIVE CONTROL. Charlie: "A question the corpus cannot answer is a finding about the
  // corpus, and the platform's required behaviour is to say so specifically."
  { n: 50, code: 'N10', collection: 'consultations', scoring: 'negative-control', verdict: 'ACCEPT', streamsHint: 'consultations (V2) / guidance',
    question: "What did respondents say about the renters' reform proposals?",
    keys: [],
    requiredBehaviour: 'State specifically that the corpus holds no renters\' reform consultation, rather than answering from general knowledge (SEARCH_CONTRACT.md §6).' },
]

/**
 * ── Q51–Q60 · STATISTICS ───────────────────────────────────────────────────────────────────────
 * ⚠ SCORED DIFFERENTLY, AND THE DIFFERENCE IS STRUCTURAL. A statistics answer is a series
 * DESCRIPTOR, never a value, and it travels on `GatewayResult.statistics` rather than in `results`
 * (search-gateway.ts). So a statistics question cannot be scored by looking for a corpus id in a
 * result list — there is no corpus id. The key is the series identity, matched on whichever handle
 * the markdown gave: the stable `seriesKey` prefix (`k=`), the `seriesId`, or the measure.
 */
export interface StatsKey {
  /** First 12 chars of the sha-256 `seriesKey`, as printed in the markdown. */
  keyPrefix?: string
  /** The dataset the series belongs to. */
  dataset?: string
  /** The measure code within the dataset. */
  measure?: string
  /** The source's own series id. */
  seriesId?: string
}

export interface GoldStatsQuestion extends Omit<GoldQuestion, 'keys' | 'collection'> {
  collection: 'statistics'
  keys: []
  statsKeys: StatsKey[]
}

const STATISTICS: GoldStatsQuestion[] = [
  { n: 51, code: 'S1', collection: 'statistics', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'statistics', keys: [],
    question: 'Does anyone publish how much the UK government spends on health compared to other things?',
    statsKeys: [{ keyPrefix: '00b9ceee9faf' }, { keyPrefix: 'c50836d2a796' }, { dataset: 'pesa-ch5-function', measure: 'public_expenditure_by_function' }] },
  { n: 52, code: 'S2', collection: 'statistics', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'statistics', keys: [],
    question: 'Is there a figure for how much tax goes uncollected each year?',
    statsKeys: [{ dataset: 'hmrc-tax-gap' }, { seriesId: 'tax_gap_pct_small_businesses' }, { seriesId: 'tax_gap_pct_beer_duty' }] },
  { n: 53, code: 'S3', collection: 'statistics', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'statistics', keys: [],
    question: 'Do we have numbers on how UK health spending compares with other countries?',
    statsKeys: [{ dataset: 'wb-wdi-comparative', measure: 'health_expenditure_pct_gdp' }, { dataset: 'wb-wdi-comparative', measure: 'health_expenditure_per_capita' }] },
  { n: 54, code: 'S4', collection: 'statistics', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'statistics', keys: [],
    question: 'Is there an official series for the unemployment rate?',
    statsKeys: [{ keyPrefix: '4ff24328fac3' }, { dataset: 'ons-cdid-headline', seriesId: 'unemployment_rate' }] },
  { n: 55, code: 'S5', collection: 'statistics', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'statistics', keys: [],
    question: 'Has anyone measured whether people in the UK are actually happier?',
    statsKeys: [{ keyPrefix: '79e90020ca0e' }, { dataset: 'ons-beta-wellbeing-quarterly' }] },
  // ⚠ KNOWN HARD, and Charlie flagged it as such: the OBR series are labelled with the OBR's own
  // column codes (PSNB, NICS, PCDebtint) rather than words. A low score here is the discoverability
  // finding, not a regression.
  { n: 56, code: 'S6', collection: 'statistics', scoring: 'recall-known-hard', verdict: 'ACCEPT', streamsHint: 'statistics', keys: [],
    question: 'What does the OBR forecast for government borrowing?',
    statsKeys: [{ dataset: 'obr-historical-forecasts', measure: 'psnb' }, { dataset: 'obr-historical-forecasts', measure: '_psnb' }, { dataset: 'obr-psf-databank', measure: 'public_sector_net_borrowing' }] },
  // ⚠ KNOWN HARD: tests a DERIVED heading — the department is inside the label and the function is
  // a bare COFOG number the catalogue index resolves to its name.
  { n: 57, code: 'S7', collection: 'statistics', scoring: 'recall-known-hard', verdict: 'ACCEPT', streamsHint: 'statistics', keys: [],
    question: 'Is there data on how much different government departments spend?',
    statsKeys: [{ keyPrefix: 'b9c5788195c9' }, { dataset: 'pesa-ch5-function', measure: 'dept_expenditure_by_function' }] },
  { n: 58, code: 'S8', collection: 'statistics', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'statistics', keys: [],
    question: 'Are there figures for how much alcohol duty raises?',
    statsKeys: [{ keyPrefix: '9deec8b2c2e1' }, { keyPrefix: '0b5b462452b0' }, { keyPrefix: '4d6d72ea8107' }, { keyPrefix: '8d7efa6bde65' }, { dataset: 'hmrc-receipts' }] },
  { n: 59, code: 'S9', collection: 'statistics', scoring: 'recall', verdict: 'ACCEPT', streamsHint: 'statistics', keys: [],
    question: 'Does anyone track income inequality in the UK over time?',
    statsKeys: [{ keyPrefix: 'b313325e32b3' }, { dataset: 'wb-wdi-comparative', measure: 'gini_index' }] },
  // ⚠ NEGATIVE CONTROL. Charlie: "A 'helpful' answer here is a failure. Pairs with Q40 and Q50."
  // Measured, not assumed: a search of every series label and measure for nhs/waiting/hospital
  // returns 0 rows. There is health SPENDING; there is no health ACTIVITY.
  { n: 60, code: 'S10', collection: 'statistics', scoring: 'negative-control', verdict: 'ACCEPT', streamsHint: 'statistics', keys: [],
    question: 'How many people are on an NHS waiting list?',
    statsKeys: [],
    requiredBehaviour: 'Return NO plausible series. Naming what IS held (fiscal/macroeconomic) is fine; returning health-spending series as though they answered a waiting-list question is the failure.' },
]

export const GOLD_CORPUS: GoldQuestion[] = [...COMMITTEES, ...CASELAW, ...GUIDANCE, ...IMPACT, ...CONSULTATIONS]
export const GOLD_STATS: GoldStatsQuestion[] = STATISTICS
export const GOLD_ALL: Array<GoldQuestion | GoldStatsQuestion> = [...GOLD_CORPUS, ...GOLD_STATS]

/** Scoreable = ACCEPT and keyed. Excludes the four REJECTs (§5) and the three negative controls. */
export const SCOREABLE = GOLD_CORPUS.filter((q) => q.verdict === 'ACCEPT' && q.scoring !== 'negative-control')
export const NEGATIVE_CONTROLS = GOLD_ALL.filter((q) => q.scoring === 'negative-control')
export const REJECTED = GOLD_ALL.filter((q) => q.verdict === 'REJECT')

/** Collections in report order, with the n that will be quoted beside every figure. */
export function collectionCounts(): Array<{ collection: string; scoreable: number; rejected: number; controls: number }> {
  const names: GoldCollection[] = ['committees', 'caselaw', 'guidance', 'impact-assessments', 'consultations', 'statistics']
  return names.map((c) => ({
    collection: c,
    scoreable: GOLD_ALL.filter((q) => q.collection === c && q.verdict === 'ACCEPT' && q.scoring !== 'negative-control').length,
    rejected: GOLD_ALL.filter((q) => q.collection === c && q.verdict === 'REJECT').length,
    controls: GOLD_ALL.filter((q) => q.collection === c && q.scoring === 'negative-control').length,
  }))
}
