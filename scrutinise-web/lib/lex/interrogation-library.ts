// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-B §3 — THE INTERROGATION LIBRARY, AS CONFIGURATION.
//
// "Adding a question is one array entry, never a code change." `check:build-25b`
// asserts it the only way that claim can be asserted: no question id may appear anywhere
// outside this file. That is why the engine keys off FLAGS declared here (`leads`,
// `retiresTheInstrument`) rather than off `id === 'EXISTING_POWER'` — an engine that
// names a question is an engine that has to change when a question is added.
//
// ═════════════════════════════════════════════════════════════════════════════
// ⚠ THE FINDING THAT SHAPED THIS FILE, AND IT CONTRADICTS THE BRIEF.
//
// §3 says four of these intents "are new to Search and may not be routed yet", and asks
// that a question whose intent is unavailable render as a stated gap. The audit found
// something broader and it changes the design:
//
//   `intent` NEVER SELECTS STREAMS. Not for these questions — for ANY caller. There is
//   not one `intent ===` branch in lib/lex, and `query-router.ts` is never handed the
//   intent at all. SEARCH_CONTRACT.md §2 says PRECEDENT, CAUSAL_EVIDENCE and
//   DEVOLUTION_SCOPE are "descriptive"; measured against the code, EVERY intent is.
//
// So an `intents[]` field would have been decoration — a question with a "routed" intent
// and one with a "new" intent produce identical retrieval, and reporting the first as
// well-served would be a claim about machinery that does not exist.
//
// WHAT ACTUALLY CHANGES RETRIEVAL IS THE QUERY TEXT. The router rewrites per stream from
// the terms it is given, so the terms ARE the lever. Every question therefore owns a
// `terms()` builder, and that is the part of an entry worth thinking hardest about.
//
// `intents[]` is kept, because it is what the run RECORDS about itself and what the
// search side reads when deciding what to route next — but it is typed against the real
// union so it cannot name a string that does not exist, and `wantedIntent` is where a
// question says which retrieval mode it would want if Search built one. That gap is
// reported to the user as a gap in OUR TOOLING, never as an absence of evidence.
// ═════════════════════════════════════════════════════════════════════════════

import type { SearchIntent } from './search-gateway'
import { termsFrom } from './build-config'
import type { HeadingKey } from './question-headings'

export type QuestionKind = 'CORPUS' | 'DOMAIN_TRANSFER'

/**
 * What `firesWhen` and `terms` are allowed to look at: the pass-2 draft, reduced to
 * facts. Deliberately small and deliberately not the raw model output — a predicate that
 * can read anything is a predicate nobody can reason about, and these run on every build.
 */
export interface DraftFacts {
  /** The whole drafted kernel as prose. The base for term extraction. */
  text: string
  /** The instrument the approach pass named, verbatim, or '' when it named none. */
  instrument: string
  /** Did the draft settle on primary legislation (or fail to name an instrument at all)? */
  instrumentIsPrimary: boolean
  /** What the draft says about devolution: the approach pass's own word. */
  devolution: 'reserved' | 'devolved' | 'unknown'
  /** Does the draft name any existing law, rule or regulator? */
  namesExistingLaw: boolean
  /** Did pass 2 draft any causes to test? */
  hasCauses: boolean
  /** Did pass 2 commit to an approach? */
  hasChosenApproach: boolean
}

export interface InterrogationQuestion {
  /** ⚠ MUST NOT APPEAR OUTSIDE THIS FILE. check:build-25b enforces it. */
  id: string
  /** The question, as it is put to the corpus and shown to the user. */
  question: string
  kind: QuestionKind
  /**
   * What the run RECORDS it was searching for. Typed against the real union, so an entry
   * cannot name an intent that does not exist. See the header: this is a label, not a
   * routing instruction, and the panel says so.
   */
  intents: SearchIntent[]
  /**
   * A retrieval mode this question WOULD want and Search has not built. Present ⇒ the
   * question runs on `intents` and declares the shortfall. Naming it here is not
   * scheduling it — SEARCH_CONTRACT.md §3 is where that conversation happens.
   */
  wantedIntent?: string
  /** Relevance, decided from the draft. §3: "a question about devolution does not fire
   *  on a reserved matter." */
  firesWhen: (d: DraftFacts) => boolean
  /** Questions this must answer or declare unanswerable. Drives the known unknowns. */
  mustAnswer: string[]
  /**
   * 25-D §3 — WHICH §25.5 PANEL HEADING THIS QUESTION ANSWERS.
   *
   * ⚠ THE QUESTION DECLARES THE HEADING; THE PANEL NEVER GUESSES THE QUESTION. That direction
   * is forced and is the right way round anyway: `check:build-25b` forbids a question id from
   * appearing outside this file, so a panel that mapped ids to headings would have to name
   * them. More importantly it is the 25-C known-unknowns lesson — the producer that writes a
   * row knows what it answers, and anything downstream that works it out from the wording is
   * guessing on a proposal a Bill may rest on.
   *
   * Several questions may share a heading. That is intended: "what the law says now" is
   * answered both by the standing legal map AND by whether a power already exists, and the
   * user wants those together. `panelHeading` below keeps them apart WITHIN the heading.
   */
  heading: HeadingKey
  /** The question's own sub-heading — the finer label, shown inside `heading`. */
  panelHeading: string
  /** The method block handed to the sift and the gather. What counts as a finding here. */
  method: string
  /**
   * THE LEVER. What this question actually sends to retrieval, built from the draft.
   * The engine adds nothing; a question that returns the bare draft terms is a question
   * that will retrieve what every other question retrieved.
   */
  terms: (d: DraftFacts) => string[]
  /**
   * §4 — "The instrument question comes first and can short-circuit the rest." Sorted on,
   * so the ordering is configuration rather than an array-index assumption.
   */
  leads?: boolean
  /**
   * §4/§9 — a positive finding here must visibly change the instrument fork, and pass 4
   * must reconsider it. The engine keys off THIS, never off the question's id.
   */
  retiresTheInstrument?: boolean
}

/** Terms added to the draft's own, per question. Kept short: the router rewrites from
 *  these, and a query stuffed with boilerplate retrieves the boilerplate. */
const withTerms = (d: DraftFacts, extra: string[], cap = 14): string[] => {
  const base = termsFrom(d.text, cap)
  const seen = new Set(base)
  return [...base, ...extra.filter((t) => !seen.has(t))]
}

export const INTERROGATION_LIBRARY: InterrogationQuestion[] = [
  // ── The one that can retire the whole legislative route ────────────────────
  {
    id: 'question:EXISTING_POWER',
    question: 'Is there already a delegated power that removes the need for primary legislation?',
    kind: 'CORPUS',
    intents: ['LEGAL_LANDSCAPE'],
    wantedIntent: 'EXISTING_POWER',
    leads: true,
    retiresTheInstrument: true,
    // §3: "It should fire on every idea whose drafted instrument is primary legislation."
    // It ALSO fires when no instrument was named, because an unnamed instrument is the
    // case where the user is most likely to end up drafting a Bill by default.
    firesWhen: (d) => d.instrumentIsPrimary,
    // An existing delegated power IS part of what the law says now — and it is the half a
    // user is least likely to look for, which is why it shares the heading rather than
    // getting a quieter one of its own.
    heading: 'LAW_NOW',
    panelHeading: 'Whether a power to do this already exists',
    mustAnswer: [
      'Which enactment, if any, already confers power to make this change?',
      'Would that power have to be exercised by regulations, an order, or a direction?',
      'Is there a limit in the enabling provision that this change would exceed?',
    ],
    method: [
      'You are answering ONE question, and a YES to it can retire this proposal\'s entire legislative',
      'route: IS THERE ALREADY A POWER TO DO THIS?',
      '',
      'Look for an ENABLING PROVISION — a section conferring power on a Minister, a department or a',
      'regulator to make regulations, an order, a scheme, a direction or a code. Where you find one:',
      '  · NAME IT EXACTLY — Act, year, section, and the words that confer the power.',
      '  · Say WHO may exercise it and by what procedure (affirmative, negative, or none).',
      '  · Say whether its LIMITS cover what this proposal actually wants to do. A power that nearly',
      '    reaches is the most consequential finding of all, and "nearly" must be stated as nearly.',
      '',
      'A finding that NO such power exists is a real finding and is worth reporting as one — but only',
      'if you looked. Do not report absence from a search that returned nothing about enabling powers',
      'at all; that is a gap in the search, and the two are not the same statement.',
    ].join('\n'),
    terms: (d) => withTerms(d, [
      'power', 'regulations', 'order', 'may by regulations', 'Secretary of State',
      'confer', 'delegated', 'enabling',
    ]),
  },

  // ── The standing legal map ────────────────────────────────────────────────
  {
    id: 'question:LEGAL_LANDSCAPE',
    question: 'What law governs this today, and which provisions would have to move together?',
    kind: 'CORPUS',
    intents: ['LEGAL_LANDSCAPE'],
    firesWhen: () => true,
    heading: 'LAW_NOW',
    panelHeading: 'The law as it stands',
    mustAnswer: [
      'Which Act or instrument governs this today?',
      'Which provisions would have to be amended together for the change to work?',
      'What definitions would have to change, and what else uses them?',
    ],
    method: [
      'You are mapping the law this proposal touches, from the retrieved material only.',
      '  · The INTERLOCKING PROVISIONS: which Act confers the duty or power, which instrument',
      '    exercises it, and which provisions would have to move together.',
      '  · The DEFINITIONS doing the work, and what else depends on them. A definition amended in one',
      '    place and relied on in three others is the commonest drafting failure there is.',
      '  · CONSEQUENTIALS and commencement, where the material shows them.',
      'Where the retrieved material does not settle something, say so rather than filling it in.',
    ].join('\n'),
    terms: (d) => withTerms(d, ['Act', 'section', 'duty', 'regulations']),
  },

  // ── How the courts have read it ───────────────────────────────────────────
  {
    id: 'question:CASE_INTERPRETATION',
    question: 'How have the courts read the provisions this turns on?',
    kind: 'CORPUS',
    intents: ['LEGAL_LANDSCAPE'],
    wantedIntent: 'CASE_INTERPRETATION',
    // Only worth asking once the draft has named a legal hook. Against a proposal that
    // names no law, this question retrieves case law about the general subject, which
    // reads as authority and is not.
    firesWhen: (d) => d.namesExistingLaw,
    heading: 'COURTS',
    panelHeading: 'How the courts have read it',
    mustAnswer: [
      'Has a court construed the provision this proposal would change?',
      'Did that construction narrow or widen it, and does the proposal depend on which?',
    ],
    method: [
      'You are reporting JUDICIAL CONSTRUCTION of the provisions this proposal turns on.',
      '  · Name the case and what it decided about the WORDS, not about the policy.',
      '  · Say whether the construction NARROWS or WIDENS the provision, and whether this proposal',
      '    depends on which way it went.',
      '  · A case that merely mentions the subject is not a construction of the provision. Do not',
      '    report it as one — a proposal that cites a case for something the case did not decide is',
      '    worse off than one that cites nothing.',
    ].join('\n'),
    terms: (d) => withTerms(d, ['judgment', 'held', 'construction', 'interpretation', 'court']),
  },

  // ── Why the rule reads the way it does ────────────────────────────────────
  {
    id: 'question:LINEAGE',
    question: 'How did the current rule come to be written this way, and what was it meant to fix?',
    kind: 'CORPUS',
    intents: ['LEGAL_LANDSCAPE', 'CAUSE_SEEDING'],
    wantedIntent: 'LINEAGE',
    firesWhen: (d) => d.namesExistingLaw,
    // ⚠ LINEAGE FILES UNDER "what was tried before", and the mapping is worth defending:
    // THE CURRENT PROVISION IS ITSELF A PREVIOUS ATTEMPT. What it was enacted to fix, and
    // whether the complained-of feature was a deliberate compromise, is exactly "what was
    // tried and what happened" — it just happens to be the attempt that is still in force.
    heading: 'TRIED_BEFORE',
    panelHeading: 'Why the rule reads the way it does',
    mustAnswer: [
      'What was the current provision enacted to fix?',
      'Was the thing this proposal complains about a deliberate choice at the time?',
    ],
    method: [
      'You are establishing the LINEAGE of the rule this proposal would change: what it was for when',
      'it was written, and whether the feature being complained about was DELIBERATE.',
      '',
      'This is the question that most often reverses a proposal. A gap that looks like an oversight is',
      'frequently a compromise somebody fought for, and a proposal that closes it without knowing that',
      'walks into the same argument unprepared. Explanatory notes and the debates at the time are',
      'where this lives.',
      'If the material does not say, the honest answer is that the intention is not on the record.',
    ].join('\n'),
    terms: (d) => withTerms(d, ['explanatory', 'introduced', 'purpose', 'amendment', 'second reading']),
  },

  // ── Has it been tried ─────────────────────────────────────────────────────
  {
    id: 'question:PRECEDENT',
    question: 'Has a comparable measure been tried — what was it for, what was predicted, and what happened?',
    kind: 'CORPUS',
    intents: ['PRECEDENT'],
    firesWhen: (d) => d.hasChosenApproach,
    heading: 'TRIED_BEFORE',
    panelHeading: 'Whether this has been tried before',
    mustAnswer: [
      'Has a comparable measure been tried in the UK, and what was it for?',
      'What was it predicted to cost and achieve?',
      'What did a post-implementation review or evaluation find actually happened?',
    ],
    method: [
      'You are finding PRECEDENTS, and for each one triangulating three separate things — naming which',
      'of the three you actually found:',
      '     • what the measure was FOR      — explanatory notes / memoranda',
      '     • what it was PREDICTED to do   — impact assessments',
      '     • what actually HAPPENED        — post-implementation reviews, evaluations, NAO reports',
      'The triangulation is the artefact. A precedent with only one leg is still worth reporting, but',
      'say which legs are missing — that is a known unknown, not a defect in the precedent.',
      '',
      'A document that discusses the same subject is NOT a precedent. A comparable measure has to have',
      'been ACTUALLY TRIED. A false precedent is worse than a missing one: the user takes it into a',
      'committee room and is asked what happened, and nothing did.',
    ].join('\n'),
    terms: (d) => withTerms(d, ['impact assessment', 'evaluation', 'review', 'scheme', 'pilot']),
  },

  // ── Is the problem real ───────────────────────────────────────────────────
  {
    id: 'question:CAUSAL_EVIDENCE',
    question: 'Is the problem real and measured, and does the evidence support or contradict the diagnosis?',
    kind: 'CORPUS',
    intents: ['CAUSAL_EVIDENCE'],
    firesWhen: (d) => d.hasCauses,
    // "The numbers" is where a user looks to find out whether the problem is real at the
    // scale claimed, and that is what this question tests.
    heading: 'NUMBERS',
    panelHeading: 'Whether the diagnosis holds up',
    mustAnswer: [
      'Is the scale of the problem measured anywhere, and by whom?',
      'Does anything retrieved CONTRADICT the stated causes?',
      'Is the causal claim in the diagnosis supported, or merely plausible?',
    ],
    method: [
      'You are testing the DIAGNOSIS against the record. The proposal states causes; your job is',
      'whether they survive contact with what was actually measured.',
      '  · Is the problem QUANTIFIED anywhere, and by whom?',
      '  · Does anything CONTRADICT a stated cause? Type those CONTRADICTS, and never suppress one.',
      '    A contradiction found now is worth more than a supporting citation, because it is the one',
      '    the proposal can still do something about.',
      '  · Distinguish a MEASURED causal claim from a plausible one. "X is associated with Y" and',
      '    "X causes Y" are different findings and the proposal may be resting on the wrong one.',
    ].join('\n'),
    terms: (d) => withTerms(d, ['evidence', 'data', 'estimated', 'survey', 'statistics']),
  },

  // ── Where it has been examined ────────────────────────────────────────────
  {
    id: 'question:CAUSE_SEEDING',
    question: 'Where has this problem been examined before, and what was said?',
    kind: 'CORPUS',
    intents: ['CAUSE_SEEDING'],
    firesWhen: () => true,
    heading: 'ARGUED',
    panelHeading: 'Where this has been examined before',
    mustAnswer: [
      'Has a committee or a debate examined this problem?',
      'What did anyone conclude, and was anything recommended and not done?',
    ],
    method: [
      'You are finding where this problem has already been EXAMINED — select committees, debates,',
      'inquiries, regulator reviews.',
      '  · What was concluded, and by whom.',
      '  · ⚠ A RECOMMENDATION MADE AND NOT ACTED ON is the single most useful thing this question can',
      '    find: it tells the user the argument is already won on the record and the obstacle is',
      '    elsewhere, which usually changes the proposal.',
      '  · Where a debate shows the argument being made AGAINST a comparable measure, type it',
      '    CONTRADICTS. That is what the user is walking into.',
    ].join('\n'),
    terms: (d) => withTerms(d, ['committee', 'inquiry', 'recommendation', 'report', 'evidence']),
  },

  // ── Reserved or devolved ──────────────────────────────────────────────────
  {
    id: 'question:DEVOLUTION_SCOPE',
    question: 'Is this reserved or devolved, and what follows for the vehicle?',
    kind: 'CORPUS',
    intents: ['DEVOLUTION_SCOPE'],
    // §3's own example, executed: "a question about devolution does not fire on a
    // reserved matter". If the draft has already established the subject is reserved,
    // asking again produces a paragraph confirming what the draft said, which reads as
    // corroboration and is not.
    firesWhen: (d) => d.devolution !== 'reserved',
    heading: 'DEVOLVED',
    panelHeading: 'Whether this is Westminster’s to change',
    mustAnswer: [
      'Is the subject reserved or devolved, and to which legislature?',
      'Would the same change need a different vehicle in each nation?',
    ],
    method: [
      'You are establishing EXTENT and COMPETENCE.',
      '  · Reserved or devolved, and under which schedule or provision. Name the provision that',
      '    decides it rather than asserting the conclusion.',
      '  · If devolved, say what follows: the same change needs a different vehicle in each nation,',
      '    and a UK-wide claim for an England-only measure is the error a committee finds first.',
      '  · Where the retrieved material does not settle it, say which schedule would settle it. A',
      '    named next step is worth more than a confident guess.',
    ].join('\n'),
    terms: (d) => withTerms(d, ['Scotland', 'Wales', 'Northern Ireland', 'reserved', 'devolved', 'extent']),
  },

  // ── The one no corpus can answer ──────────────────────────────────────────
  {
    id: 'question:DOMAIN_TRANSFER',
    question: 'Who else has this problem, outside this sector, and what have they built to deal with it?',
    kind: 'DOMAIN_TRANSFER',
    // No retrieval of its own. It is answered by REASONING and labelled as reasoning;
    // the follow-up corpus question it generates is asked through LEGAL_LANDSCAPE.
    intents: [],
    firesWhen: () => true,
    heading: 'ELSEWHERE',
    panelHeading: 'What other sectors built for the same problem',
    mustAnswer: [
      'Who outside this sector has a problem of the same shape?',
      'What did they actually build, and does UK legislation use that shape anywhere?',
    ],
    method: [
      'You are answering the highest-yield question we have, and NO CORPUS CAN ANSWER IT — which is',
      'exactly why it is worth asking.',
      '',
      '⚠ THIS IS REASONING, NOT RETRIEVAL, AND YOUR ANSWER MUST SAY SO IN ITS OWN FIRST CLAUSE.',
      '',
      '  · Name TWO OR THREE CONCRETE ANALOGUES from other sectors, industries or countries — a problem',
      '    of the same SHAPE, not the same subject. Say what each of them actually BUILT.',
      '  · Then ask the follow-up, and it is the half that turns this into something usable: HAS UK',
      '    LEGISLATION EVER USED THAT SHAPE? Name where, if you know of it, and say plainly that you',
      '    are reasoning rather than citing.',
      '  · Vagueness here wastes the question. "Other sectors face similar challenges" is not an',
      '    answer; "aviation solved anonymous incident reporting with a statutory no-blame channel,',
      '    and the UK built one in the CAA scheme" is.',
    ].join('\n'),
    terms: (d) => withTerms(d, ['scheme', 'model', 'framework'], 10),
  },
]

export const QUESTION_IDS = INTERROGATION_LIBRARY.map((q) => q.id)

export function questionById(id: string): InterrogationQuestion | undefined {
  return INTERROGATION_LIBRARY.find((q) => q.id === id)
}

/**
 * The questions that fire on this draft, in the order they run — leaders first.
 *
 * ⚠ Sorted on the `leads` FLAG, not on array position and not on an id. §4's "the
 * instrument question comes first and can short-circuit the rest" is therefore a
 * property of the entry, and a later question can claim the lead by setting the flag.
 */
export function questionsFor(d: DraftFacts): InterrogationQuestion[] {
  const firing = INTERROGATION_LIBRARY.filter((q) => {
    try {
      return q.firesWhen(d)
    } catch (err) {
      // A predicate that throws must not take the build down, and must not silently
      // exclude its question either — an unasked question that nobody knows was unasked
      // is the absence-of-evidence failure this library exists to avoid.
      console.error('[25b:library] firesWhen threw — treating as FIRING', {
        id: q.id, error: err instanceof Error ? err.message : err,
      })
      return true
    }
  })
  return [...firing].sort((a, b) => Number(!!b.leads) - Number(!!a.leads))
}

/**
 * What a question can honestly say about its own retrieval.
 *
 * Three states, and they must not share a sentence:
 *   · `reasoned`   — no corpus is asked at all (the domain-transfer question).
 *   · `unrouted`   — Search has no dedicated mode for this; it ran on a general one.
 *   · `general`    — it ran on a named intent, which is a label rather than a route.
 *
 * ⚠ There is deliberately NO 'routed' state. Adding one would require a caller whose
 * retrieval actually changes with the intent, and there is none — see the header.
 */
export type RetrievalStanding = 'reasoned' | 'unrouted' | 'general'

export function retrievalStanding(q: InterrogationQuestion): RetrievalStanding {
  if (q.kind === 'DOMAIN_TRANSFER' || !q.intents.length) return 'reasoned'
  return q.wantedIntent ? 'unrouted' : 'general'
}

/** The sentence the panel shows about how well this question could be asked. */
export function retrievalNote(q: InterrogationQuestion): string | null {
  switch (retrievalStanding(q)) {
    case 'reasoned':
      return 'Answered by reasoning, not by searching the corpus — no corpus can answer it, which is why it is asked.'
    case 'unrouted':
      return `Search has no dedicated ${q.wantedIntent} retrieval mode, so this was asked through ` +
        `${q.intents.join(' and ')} instead. That is a limit in our search, not a statement about what exists.`
    case 'general':
      return null
  }
}
