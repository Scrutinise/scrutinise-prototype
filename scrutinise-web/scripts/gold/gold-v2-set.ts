/**
 * gold-v2-set.ts — CHARLIE'S VALIDATED DEBATES AND LEGISLATION SET, as data.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * PROVENANCE, BECAUSE IT IS THE WHOLE POINT OF THIS FILE
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * Transcribed from `docs/GOLD_CANDIDATES_V2.md` on 2026-08-22, AFTER Charlie's validation pass:
 * **24 of 24 reviewed — 22 ACCEPT, 2 AMEND, 0 REJECT.** The markdown remains the source of record;
 * this is a mechanical transcription so a harness can score without parsing prose.
 * `npm run check:goldv2` re-reads the markdown and asserts this file agrees with it.
 *
 * ⚠ **THE TWO AMENDMENTS ARE APPLIED HERE, NOT RECORDED AS ACCEPTS.**
 *   Q6  "…bringing back hanging?"            → "…bringing back the death penalty?"
 *   Q12 "Can my landlord make me leave…?"    → "Can my landlord evict me…?"
 * Q6's amendment also **reclassifies** it: "the death penalty" IS the document's own wording, so it
 * is no longer one of the deliberately-vocabulary-avoided questions (9 → 8). Recorded rather than
 * quietly kept in the count.
 *
 * ⚠⚠ THE KEYS ARE NOT TAKEN FROM THE PROSE. They come from `verify-goldv2-keys.ts`, where all 27
 * were read back out of R2 and compared against a claim written down BEFORE the read. The markdown
 * abbreviates shared prefixes with an ellipsis (`…:78`), exactly as `GOLD_CANDIDATES_S8.md` did, so
 * a regex over the prose silently drops keys — it found 24 of 27 when tried. The verified list is
 * the authority and `check:goldv2` asserts this file matches it exactly.
 *
 * ⚠ THE THREE NEGATIVE CONTROLS ARE PRESENT AND CARRY NO KEYS. `scoring: 'negative-control'` — a 0%
 * retrieval score on these is a **PASS**. Any scorer that folds them into a recall average has
 * broken the instrument; `SCOREABLE_V2` excludes them for exactly that reason.
 */

export type GoldV2Scoring = 'recall' | 'negative-control'
export type GoldV2Collection = 'debates' | 'legislation'
/** Which sourcing direction produced the question (BRIEF_GOLD_V2 §2). Kept because if the two
 *  halves score differently that is itself a finding, and it cannot be seen unless it is recorded. */
export type GoldV2Sourcing = 'outside-in' | 'document-outward'

export interface GoldV2Question {
  /** Q1–Q21, N1–N3 — the numbering Charlie reviewed against. */
  id: string
  collection: GoldV2Collection | null
  /** The question as it will be sent to retrieval, AFTER Charlie's amendments. */
  query: string
  /** Document ids a correct top-20 must contain. Empty for negative controls, by design. */
  keys: string[]
  scoring: GoldV2Scoring
  sourced: GoldV2Sourcing | null
  /** Deliberately phrased in words the document does not use (§3 requires ≥3; 8 qualify). */
  vocabularyAvoided: boolean
  /** Which router stream OWNS the collection the keys sit in. A HINT for per-collection reporting
   *  — never passed to retrieval, because scoring a question only against the stream we expect to
   *  answer it would measure the scope table rather than the search. */
  streamsHint: string
  /** For a negative control: what the platform must DO. Scored on behaviour, not recall. */
  requiredBehaviour?: string
  verdict: 'ACCEPT' | 'AMEND'
}

export const GOLD_V2: GoldV2Question[] = [
  // ── DEBATES ─────────────────────────────────────────────────────────────────────────────────
  { id: 'Q1', collection: 'debates', scoring: 'recall', sourced: 'outside-in', vocabularyAvoided: true, streamsHint: 'debates', verdict: 'ACCEPT',
    query: 'Did MPs argue for or against letting terminally ill people choose to die?',
    keys: ['pwdata-debates:debates2024-11-29d:3', 'pwdata-debates:debates2024-11-29d:78'] },
  { id: 'Q2', collection: 'debates', scoring: 'recall', sourced: 'document-outward', vocabularyAvoided: false, streamsHint: 'debates', verdict: 'ACCEPT',
    query: 'Did peers back the assisted dying bill when it reached the Lords?',
    keys: ['pwdata-lords:daylord2025-09-12c:4'] },
  { id: 'Q3', collection: 'debates', scoring: 'recall', sourced: 'outside-in', vocabularyAvoided: true, streamsHint: 'debates', verdict: 'ACCEPT',
    query: 'What did ministers at Stormont say about the botched green energy scheme?',
    keys: ['niassembly-hansard:286438:151'] },
  { id: 'Q4', collection: 'debates', scoring: 'recall', sourced: 'outside-in', vocabularyAvoided: false, streamsHint: 'debates', verdict: 'ACCEPT',
    query: 'Has Parliament debated scrapping the benefit limit for families with more than two children?',
    keys: ['pwdata-westminster:westminster2022-04-21a:27', 'pwdata-westminster:westminster2018-11-27c:55'] },
  { id: 'Q5', collection: 'debates', scoring: 'recall', sourced: 'outside-in', vocabularyAvoided: true, streamsHint: 'debates', verdict: 'ACCEPT',
    query: "What did peers say about overturning the subpostmasters' convictions?",
    keys: ['pwdata-lords:daylord2024-05-13a:113'] },
  // ⚠ AMENDED by Charlie: "hanging" → "the death penalty". See the header — this also moves it out
  // of the vocabulary-avoided group, because it is now the document's own wording.
  { id: 'Q6', collection: 'debates', scoring: 'recall', sourced: 'document-outward', vocabularyAvoided: false, streamsHint: 'debates', verdict: 'AMEND',
    query: 'When did Parliament last seriously debate bringing back the death penalty?',
    keys: ['historic-hansard:S5LV0198P0:1798', 'historic-hansard:S5LV0306P0:1905'] },
  { id: 'Q7', collection: 'debates', scoring: 'recall', sourced: 'outside-in', vocabularyAvoided: false, streamsHint: 'debates', verdict: 'ACCEPT',
    query: 'What happened to the plan to make the House of Lords elected?',
    keys: ['pwdata-lords:daylord2012-04-30a:76'] },
  { id: 'Q8', collection: 'debates', scoring: 'recall', sourced: 'outside-in', vocabularyAvoided: true, streamsHint: 'debates', verdict: 'ACCEPT',
    query: 'What did MSPs say about making it easier to change your legal gender?',
    keys: ['scottish-parliament-or:14066:193'] },
  { id: 'Q9', collection: 'debates', scoring: 'recall', sourced: 'outside-in', vocabularyAvoided: true, streamsHint: 'debates', verdict: 'ACCEPT',
    query: 'Why were energy companies forcing people onto prepayment meters?',
    keys: ['pwdata-debates:debates2022-12-15b:298'] },
  { id: 'Q10', collection: 'debates', scoring: 'recall', sourced: 'outside-in', vocabularyAvoided: false, streamsHint: 'debates', verdict: 'ACCEPT',
    query: "What has the government promised to do about the Grenfell inquiry's findings?",
    keys: ['pwdata-debates:debates2024-12-02c:452'] },
  // ⚠ The deliberate CONTROL against the vocabulary-avoided questions: it uses the document's own
  // words on purpose, so that if it fails too the problem is not vocabulary.
  { id: 'Q11', collection: 'debates', scoring: 'recall', sourced: 'document-outward', vocabularyAvoided: false, streamsHint: 'debates', verdict: 'ACCEPT',
    query: 'What did the Chancellor announce in the Spring Statement?',
    keys: ['pwdata-debates:debates2025-03-26b:130'] },

  // ── LEGISLATION ─────────────────────────────────────────────────────────────────────────────
  // ⚠ AMENDED by Charlie: "make me leave" → "evict me". Still vocabulary-avoided — "evict" is the
  // everyday word; the provision is titled "Recovery of possession on expiry or termination…".
  { id: 'Q12', collection: 'legislation', scoring: 'recall', sourced: 'outside-in', vocabularyAvoided: true, streamsHint: 'legislation', verdict: 'AMEND',
    query: 'Can my landlord evict me without giving a reason?',
    keys: ['primary-acts-pre-2000:ukpga/1988/50:section-21'] },
  { id: 'Q13', collection: 'legislation', scoring: 'recall', sourced: 'outside-in', vocabularyAvoided: false, streamsHint: 'legislation', verdict: 'ACCEPT',
    query: 'Has the law on no-fault evictions actually changed?',
    keys: ['primary-acts-2000plus:ukpga/2025/26:section-146', 'primary-acts-2000plus:ukpga/2025/26:section-147'] },
  { id: 'Q14', collection: 'legislation', scoring: 'recall', sourced: 'outside-in', vocabularyAvoided: true, streamsHint: 'legislation', verdict: 'ACCEPT',
    query: "My employer won't make changes for my disability — what does the law require?",
    keys: ['primary-acts-2000plus:ukpga/2010/15:section-20'] },
  // ⚠ Also scored on BEHAVIOUR: returning the section without saying it is repealed is a wrong
  // answer that looks right.
  { id: 'Q15', collection: 'legislation', scoring: 'recall', sourced: 'outside-in', vocabularyAvoided: false, streamsHint: 'legislation', verdict: 'ACCEPT',
    query: 'Is the old law banning schools from promoting homosexuality still in force?',
    keys: ['primary-acts-pre-2000:ukpga/1988/9:section-28'] },
  { id: 'Q16', collection: 'legislation', scoring: 'recall', sourced: 'document-outward', vocabularyAvoided: false, streamsHint: 'legislation', verdict: 'ACCEPT',
    query: 'What exactly did the government ban when it banned plastic straws?',
    keys: ['si-2010plus:uksi/2020/971:regulation-2', 'si-2010plus:uksi/2020/971:regulation-20'] },
  { id: 'Q17', collection: 'legislation', scoring: 'recall', sourced: 'outside-in', vocabularyAvoided: false, streamsHint: 'legislation', verdict: 'ACCEPT',
    query: 'Does Scotland have a minimum price for alcohol?',
    keys: ['regional:ssi/2024/127:article-2'] },
  { id: 'Q18', collection: 'legislation', scoring: 'recall', sourced: 'outside-in', vocabularyAvoided: true, streamsHint: 'legislation', verdict: 'ACCEPT',
    query: "My flat is damp and mouldy and the landlord won't fix it — what does the law say?",
    keys: ['primary-acts-pre-2000:ukpga/1985/70:section-11'] },
  { id: 'Q19', collection: 'legislation', scoring: 'recall', sourced: 'outside-in', vocabularyAvoided: false, streamsHint: 'legislation', verdict: 'ACCEPT',
    query: 'When did they ban smoking in pubs, and what exactly does it cover?',
    keys: ['primary-acts-2000plus:ukpga/2006/28:section-2', 'primary-acts-2000plus:ukpga/2006/28:section-3'] },
  // ⚠ This row's sectionTitle in the corpus is "Serious Crime Act 2007" — WRONG (the body is the
  // children's safety duties). A miss here may be a data defect rather than a ranking one.
  { id: 'Q20', collection: 'legislation', scoring: 'recall', sourced: 'outside-in', vocabularyAvoided: false, streamsHint: 'legislation', verdict: 'ACCEPT',
    query: 'What does the law make social media companies do to protect children?',
    keys: ['primary-acts-2000plus:ukpga/2023/50:section-12'] },
  { id: 'Q21', collection: 'legislation', scoring: 'recall', sourced: 'outside-in', vocabularyAvoided: true, streamsHint: 'legislation', verdict: 'ACCEPT',
    query: 'How do I find out what a company holds about me?',
    keys: ['primary-acts-2000plus:ukpga/2018/12:section-45'] },

  // ── NEGATIVE CONTROLS — a 0% retrieval score here is a PASS ──────────────────────────────────
  { id: 'N1', collection: null, scoring: 'negative-control', sourced: null, vocabularyAvoided: false, streamsHint: '—', verdict: 'ACCEPT',
    query: 'How many people are on the NHS waiting list in my area right now?', keys: [],
    requiredBehaviour: 'Say the corpus cannot answer: it holds debates, legislation and official documents, not live operational statistics, and not constituency-level figures. FAILS if it returns a figure from a 2022 debate as though it were current.' },
  { id: 'N2', collection: null, scoring: 'negative-control', sourced: null, vocabularyAvoided: false, streamsHint: '—', verdict: 'ACCEPT',
    query: 'Is my landlord allowed to evict me next Tuesday?', keys: [],
    requiredBehaviour: 'Decline on the individual facts and say why — this is legal advice on a specific case. General information about the provision is fine; applying it to the user\'s Tuesday is not. FAILS if it gives a yes or a no. ⚠ Deliberately adjacent to Q12, to catch a system pattern-matching "landlord evict" to s.21.' },
  { id: 'N3', collection: null, scoring: 'negative-control', sourced: null, vocabularyAvoided: false, streamsHint: '—', verdict: 'ACCEPT',
    query: 'What will the Chancellor announce in the next Budget?', keys: [],
    requiredBehaviour: 'Say it cannot know — the corpus is a record of what HAS been said. Prior Budgets may be offered if labelled as past. FAILS if it presents Q11\'s Spring Statement, or any past statement, as forthcoming. ⚠ Deliberately adjacent to Q11.' },
]

/** The recall-scoreable half. ⚠ Negative controls are EXCLUDED — folding a deliberate 0% into a
 *  recall average is the one thing that breaks this instrument. */
export const SCOREABLE_V2 = GOLD_V2.filter((q) => q.scoring === 'recall')

/** The behaviour-scored half, kept addressable so it cannot be quietly forgotten either. */
export const NEGATIVE_CONTROLS_V2 = GOLD_V2.filter((q) => q.scoring === 'negative-control')

export function collectionCountsV2(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const q of SCOREABLE_V2) out[q.collection!] = (out[q.collection!] ?? 0) + 1
  return out
}
