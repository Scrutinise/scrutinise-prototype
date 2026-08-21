// ─────────────────────────────────────────────────────────────────────────────
// THE DEEPENING — the four Pilot A passes, as CONFIGURATION.
//
// §22's claim is that the nine passes are one mechanism and nine configurations.
// This file is the test of that claim: a pass is a method block, an intent set, and
// a set of issue templates. Adding a fifth pass must be an entry in PASSES and
// nothing else — no new route, no new component, no new engine branch. If a future
// pass cannot be expressed here, the mechanism has not been built, and the honest
// response is to say so rather than to special-case it in deepening.ts.
//
// WHAT A PASS IS NOT: a section Lex writes. It is a background gather that produces
// FINDINGS (evidence the user judges) and ISSUES (gaps the user works through). Lex
// does the heavy lifting; the user does the judging.
// ─────────────────────────────────────────────────────────────────────────────

import type { SearchIntent } from './search-gateway'
import type { SearchResultType } from './page1-config'
import type { JobKey } from './deepening-jobs'
import type { HeadingKey } from './question-headings'

export type PassKey = 'EVIDENCE_PRECEDENT' | 'LEGAL' | 'FINANCIAL' | 'POLITICAL_RISK'

export interface PassDef {
  key: PassKey
  /** Card heading. */
  label: string
  /**
   * 25-D §3 — WHICH §25.5 PANEL HEADING THIS PASS'S FINDINGS APPEAR UNDER.
   *
   * ⚠ DECLARED BY THE PASS, exactly as a question declares its own. The panel groups by
   * heading and knows no pass key, which is the same contract `deepening.ts` already keeps
   * with `jobs` and `intents`: the engine iterates configuration and names nothing in it.
   *
   * A pass and a build question may share a heading — LEGAL and the standing legal map both
   * answer "what the law says now", and a user reading that heading wants both.
   */
  heading: HeadingKey
  /** One line under the heading — what this pass is for, before it is opened. */
  strapline: string
  /**
   * §2.6 training-panel copy, VERBATIM from the brief. Teaching, concrete, and honest
   * about what the pass will fail to find — "expect it to find gaps" is doing real work,
   * because a user who is surprised by a gap reads it as the tool failing rather than as
   * the finding it is.
   */
  training: string
  /** The gather's retrieval intents, in the order they run. */
  intents: SearchIntent[]
  /**
   * S8 §1 — STRUCTURED RETRIEVAL JOBS this pass runs, beside the intents.
   *
   * ⚠ A SECOND AXIS, NOT A LONGER `intents` LIST, and the difference is what S8's audit found.
   * An INTENT takes keywords, goes through `runSearch()`, and produces candidates for the sift.
   * A JOB takes an instrument or a query and produces a RENDERED BLOCK — a group, an ordering, a
   * refusal — that a flat candidate list would destroy. `retrievePrecedent()` does not touch the
   * gateway at all; it is a keyed `$queryRaw` over three collections. Expressing it as an intent
   * would run a general search and call it a precedent.
   *
   * ⚠ AND `PRECEDENT` / `DEVOLUTION_SCOPE` APPEAR IN BOTH LISTS ON PURPOSE. The intent makes the
   * pass's general retrieval legible in the logs and in what it records it searched (they are
   * DESCRIPTIVE at the gateway and select no streams); the job is what actually assembles the
   * artefact. Removing the intent would change no retrieval; removing the job would silently
   * restore the built-but-unwired state S8 §1 exists to end.
   *
   * Jobs are configuration in the same sense passes are: `deepening.ts` iterates this array and
   * knows no job key, exactly as it iterates `PASSES` and knows no pass key.
   */
  jobs?: JobKey[]
  /**
   * The method block handed to the model for this pass — what to look for, what counts
   * as a finding, and what counts as an issue. The engine adds the never-claim rules and
   * the output contract; a pass never restates them, so they cannot drift per-pass.
   */
  method: string
  /**
   * Questions this pass MUST be able to answer or declare unanswerable. Every one that
   * retrieval cannot support becomes a known unknown — which is why they are written as
   * questions and not as topics. §2.1.2: a pass that omits its gaps has failed.
   */
  mustAnswer: string[]
  /**
   * Issue templates. The model may raise issues of its own; these are the ones whose
   * ABSENCE is itself a defect, so they are checked deterministically after the gather
   * rather than left to the model to remember.
   *
   * `when` is evaluated against the run's own outcome, so a template only fires on
   * evidence — never as boilerplate attached to every idea.
   */
  issueTemplates: Array<{
    id: string
    text: string
    when: (ctx: IssueContext) => boolean
  }>
  /** Result types this pass most wants; used only to order the right-hand panel. */
  emphasise: SearchResultType[]
}

/** What an issue template gets to look at. Deliberately small: counts, not prose. */
export interface IssueContext {
  /** Findings the gather produced, by kind. */
  countsByKind: Record<string, number>
  /** Total findings persisted this run. */
  findingCount: number
  /** Retrieval result types actually returned, with counts. */
  typesReturned: Record<string, number>
  /** Known unknowns the run declared. */
  knownUnknownCount: number
  /** The idea's own state — only what a template legitimately needs. */
  hasCostLines: boolean
  hasChosenApproach: boolean
  jurisdictionMentioned: boolean
}

/**
 * ⚠ The four passes. Reconciles Charlie's "Legal, Financial, Political first" with the
 * search thread's Pilot A: because the mechanism makes a pass cheap, four ship rather
 * than three. Mechanism analogues and the full claims check are explicitly NOT here.
 */
export const PASSES: PassDef[] = [
  {
    key: 'EVIDENCE_PRECEDENT',
    // Its own strapline is the heading, near enough: "has anything like this been tried?"
    heading: 'TRIED_BEFORE',
    label: 'Evidence & precedents',
    strapline: 'Is the problem real and measured — and has anything like this been tried?',
    training:
      'This pass checks whether the problem is real and measured, and whether anything like your ' +
      'proposal has been tried. For each precedent it assembles three things almost nobody compares: ' +
      'what the measure was for, what it was predicted to cost and achieve, and what actually ' +
      'happened. Expect it to find gaps — a gap named is a strength, not a failure.',
    intents: ['CAUSAL_EVIDENCE', 'PRECEDENT', 'LEGAL_LANDSCAPE'],
    // S8 §1. This pass's own method already asks for the triangulation — "what the measure was
    // FOR / what it was PREDICTED to do / what actually HAPPENED" — and until now it asked the
    // MODEL to assemble it out of a flat candidate list. The job assembles it deterministically
    // from the collections that hold each leg, which is the difference between a comparison and
    // three documents that happen to be adjacent.
    jobs: ['PRECEDENT'],
    method: [
      'You are assembling EVIDENCE and PRECEDENTS for a UK policy proposal.',
      '',
      'Two jobs, in this order:',
      '1. EVIDENCE THE DIAGNOSIS. Is the problem real, how big is it, and who measured it? A finding',
      '   that the evidence CONTRADICTS the stated problem is as valuable as one that supports it —',
      '   type those SUPPORTS and CONTRADICTS respectively, and never suppress a CONTRADICTS.',
      '2. FIND PRECEDENTS, and for each one triangulate three separate things, naming which of the',
      '   three you actually found:',
      '     • what the measure was FOR      — explanatory notes / memoranda',
      '     • what it was PREDICTED to do   — impact assessments',
      '     • what actually HAPPENED        — post-implementation reviews, evaluations, NAO reports',
      '   The triangulation is the artefact. A precedent with only one leg is still worth reporting,',
      '   but say which legs are missing — that is a known unknown, not a defect in the precedent.',
    ].join('\n'),
    mustAnswer: [
      'Is the scale of the problem measured anywhere, and by whom?',
      'Has a comparable measure been tried in the UK, and what was it for?',
      'What was the comparable measure predicted to cost and achieve?',
      'What did a post-implementation review or evaluation find actually happened?',
    ],
    issueTemplates: [
      {
        id: 'no-quantified-scale',
        text:
          'No retrieved source quantifies the scale of the problem. A proposal that cannot state how big ' +
          'the problem is will be asked to at the first committee sitting — find a number and cite it, or ' +
          'say plainly that none exists.',
        when: (c) => (c.countsByKind.SUPPORTS ?? 0) === 0,
      },
      {
        id: 'precedent-outcome-unknown',
        text:
          'Precedents were found, but nothing retrieved says what actually happened after they took effect. ' +
          'The prediction and the outcome are different claims; citing only the prediction invites the ' +
          'question of whether it came true.',
        when: (c) => (c.countsByKind.PRECEDENT ?? 0) > 0 && (c.typesReturned.GUIDANCE ?? 0) === 0,
      },
      {
        id: 'no-contradicting-evidence-sought',
        text:
          'Every finding supports the diagnosis and none contradicts it. That is possible, but it is also ' +
          'what a one-sided search looks like — worth a deliberate look for the strongest evidence against.',
        when: (c) => c.findingCount >= 3 && (c.countsByKind.CONTRADICTS ?? 0) === 0,
      },
    ],
    emphasise: ['IMPACT_ASSESSMENT', 'EXPLANATORY_NOTE', 'GUIDANCE', 'COMMITTEE'],
  },
  {
    key: 'LEGAL',
    heading: 'LAW_NOW',
    label: 'Legal',
    strapline: 'What law this touches, how it interlocks, and whether you need an Act at all.',
    training:
      'This pass maps the law your idea touches: which Acts and rules interlock, how courts have read ' +
      'the key provisions, whether the subject is devolved, and whether your change needs primary ' +
      'legislation or could be done by regulation. The last question matters most — if a Minister can ' +
      'already act, your proposal may not need a new law at all.',
    intents: ['LEGAL_LANDSCAPE', 'DEVOLUTION_SCOPE'],
    // S8 §1. `mustAnswer` already carries "Is the subject reserved or devolved, and to which
    // legislature?", and the honest answer to it is not one this retrieval can give — so the job
    // shows WHO HAS LEGISLATED, jurisdiction-labelled from each document's own identifier, and
    // names the three schedules that actually decide the question. Extending this pass rather
    // than adding a fifth: splitting "what law does this touch" from "which parliament can make
    // it" would give the user two cards for one question they experience as one.
    jobs: ['DEVOLUTION_SCOPE'],
    method: [
      'You are mapping the LEGAL LANDSCAPE of a UK policy proposal.',
      '',
      'Report, from the retrieved material only:',
      '  • the interlocking provisions — which Act confers the power, which instrument exercises it,',
      '    and which provisions would have to move together;',
      '  • how courts have read the key sections, where case law was retrieved;',
      '  • DEVOLVED OR RESERVED, and what follows for the vehicle;',
      '  • PRIMARY OR SECONDARY. If an existing delegated power already permits the change, that is the',
      '    single most valuable finding this pass can produce — a proposal that needs no new Act is a',
      '    proposal that can actually happen. State the enabling provision.',
      '  • drafting hurdles: definitions that would have to change, consequentials, commencement.',
    ].join('\n'),
    mustAnswer: [
      'Which provision confers the power to make this change?',
      'Is the subject reserved or devolved, and to which legislature?',
      'Could this be done by regulation under an existing power, without primary legislation?',
      'How have the courts read the key provisions?',
    ],
    issueTemplates: [
      {
        id: 'vehicle-undetermined',
        text:
          'Nothing retrieved settles whether this needs primary legislation or could be done by ' +
          'regulation under an existing power. This determines the whole route to Parliament and should ' +
          'be answered before drafting proceeds.',
        when: (c) => (c.typesReturned.PRIMARY_LEGISLATION ?? 0) === 0 || (c.typesReturned.STATUTORY_INSTRUMENT ?? 0) === 0,
      },
      {
        id: 'devolution-unaddressed',
        text:
          'The proposal does not say whether it applies across the UK. If the subject is devolved, the ' +
          'same change needs a different vehicle in each nation — and a UK-wide claim for a ' +
          'England-only measure is the kind of error a committee finds first.',
        when: (c) => !c.jurisdictionMentioned,
      },
      {
        id: 'no-case-law',
        text:
          'No case law was retrieved on the key provisions. That may mean none exists, or that the ' +
          'provisions are not yet identified precisely enough to search for — worth establishing which.',
        when: (c) => (c.typesReturned.CASE_LAW ?? 0) === 0,
      },
    ],
    emphasise: ['PRIMARY_LEGISLATION', 'STATUTORY_INSTRUMENT', 'CASE_LAW', 'EXPLANATORY_NOTE'],
  },
  {
    key: 'FINANCIAL',
    heading: 'NUMBERS',
    label: 'Financial',
    strapline: 'Stress-test the costing the way the Treasury would.',
    training:
      "This pass stress-tests your numbers the way the Treasury would: are the benchmarks the right " +
      "ones, what's missing, which assumption moves the total most, and what similar interventions " +
      'actually cost. Ranges with stated sources beat confident points.',
    intents: ['PRECEDENT'],
    method: [
      'You are scrutinising the COSTING of a UK policy proposal, as a Treasury or RPC analyst would.',
      '',
      'Work mostly over the cost lines and benchmarks the user has already entered:',
      '  • BENCHMARK FIT, line by line — is each figure derived from something comparable?',
      '  • MISSING CATEGORIES — enforcement, monitoring, transition, IT, the cost to business of',
      '    complying. Omission is the most common costing defect and the easiest to find.',
      '  • SENSITIVITY — which single assumption moves the total most? Say which, and by how much if',
      '    the numbers allow it.',
      '  • THE EANDCB POSITION — does this impose a net direct cost on business, and has it been stated?',
      '  • PRECEDENT COSTS from impact assessments, where any were retrieved.',
      '',
      'A range with a stated basis is better than a point estimate. Never invent a figure, and never',
      'restate the user\'s own number back to them as though it were corroboration.',
    ].join('\n'),
    mustAnswer: [
      'What did comparable interventions actually cost?',
      'Which assumption moves the total most?',
      'Is there a net direct cost to business, and is the EANDCB position stated?',
      'Which cost categories are absent altogether?',
    ],
    issueTemplates: [
      {
        id: 'no-cost-lines',
        text:
          'There are no cost lines to scrutinise yet. This pass can only stress-test numbers that exist — ' +
          'enter even rough figures with their basis and re-run it.',
        when: (c) => !c.hasCostLines,
      },
      {
        id: 'no-precedent-costs',
        text:
          'No impact assessment or comparable costing was retrieved, so the figures stand on their own ' +
          'stated basis alone. That is not fatal, but it is the weakest form a costing can take.',
        when: (c) => (c.typesReturned.IMPACT_ASSESSMENT ?? 0) === 0,
      },
    ],
    emphasise: ['IMPACT_ASSESSMENT', 'GUIDANCE', 'COMMITTEE'],
  },
  {
    key: 'POLITICAL_RISK',
    // ⚠ NOT "who has taken a position". This pass produces the ATTACK LINES in their
    // strongest form and what killed a comparable measure — an argument, not a register of
    // who voted which way. Filing it under POSITIONS would let an empty positions heading
    // look answered while the thing it is actually for (the voting record) stays unread.
    heading: 'AGAINST',
    label: 'Political risk',
    strapline: 'Who resists, on what grounds, and what killed the last attempt.',
    training:
      'This pass anticipates the opposition: who loses from your proposal, the strongest form of the ' +
      'attacks it invites, and what killed similar attempts before. A proposal that has answered the ' +
      'hostile case in advance is what survives committee.',
    intents: ['CAUSE_SEEDING', 'PRECEDENT'],
    method: [
      'You are mapping the POLITICAL RISK to a UK policy proposal, grounded in what was actually said',
      'in Parliament and in committee.',
      '',
      '  • WHO RESISTS, and on what grounds — named interests, sectors, departments, where the retrieved',
      '    material names them. Do not invent opponents.',
      '  • THE ATTACK LINES, each in its STRONGEST form. A strawman version of the opposing case is worse',
      '    than none: it tells the user they have answered something they have not.',
      '  • WHAT KILLED SIMILAR ATTEMPTS — the specific objection that stopped a comparable measure, with',
      '    the debate or committee report it came from.',
      '',
      'Where a debate shows an argument being made against a comparable measure, that is a CONTRADICTS',
      'finding, not a neutral one. Type it honestly.',
    ].join('\n'),
    mustAnswer: [
      'Who loses from this proposal, and has anyone said so on the record?',
      'What is the strongest argument against it that has actually been made?',
      'What stopped a comparable measure before?',
    ],
    issueTemplates: [
      {
        id: 'no-opposition-found',
        text:
          'No opposing argument was retrieved. Every proposal worth making has one — an empty opposition ' +
          'map usually means the search has not found the debate, not that there is no debate.',
        when: (c) => (c.countsByKind.CONTRADICTS ?? 0) === 0,
      },
      {
        id: 'no-debate-retrieved',
        text:
          'No parliamentary debate was retrieved on this subject, so the political reading rests on ' +
          'inference rather than on the record.',
        when: (c) => (c.typesReturned.DEBATE ?? 0) === 0,
      },
    ],
    emphasise: ['DEBATE', 'COMMITTEE', 'DIVISION'],
  },
]

export const PASS_KEYS = PASSES.map((p) => p.key)

export function passDef(key: string): PassDef | undefined {
  return PASSES.find((p) => p.key === key)
}

export function isPassKey(key: string): key is PassKey {
  return PASS_KEYS.includes(key as PassKey)
}
