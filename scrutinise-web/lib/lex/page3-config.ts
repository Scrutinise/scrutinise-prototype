// ─────────────────────────────────────────────────────────────────────────────
// Lex rebuild — Page 3 (Guiding Policy) field configuration (design §17).
//
// A designed CHOICE, not a questionnaire: orient → evaluate options → choose &
// rule out → crystallise. The policy is an approach to the pivotal obstacle, and
// what it rules out (the residue of choosing) is a first-class output.
//
// Imports only TYPES from page1-config, so page1-config can aggregate this page
// (PAGE_SEQUENCE) without a runtime import cycle.
// ─────────────────────────────────────────────────────────────────────────────

import type { FieldDef, PageDef } from './page1-config'

// Structured slots for anticipatedResponses (§17 field 5).
export const ANTICIPATED_RESPONSE_SLOTS = [
  'avoidance', 'gaming', 'enforcementBurden', 'legalChallenge', 'politicalAttack',
] as const

// The mechanism toolkit Lex draws candidate approaches from (§17 field 1).
export const MECHANISM_TYPES = [
  'incentives', 'rules', 'transparency', 'market-design', 'institutional',
] as const

export const GUIDING_POLICY_FIELDS: FieldDef[] = [
  {
    key: 'policyOptions',
    label: 'Candidate approaches',
    type: 'loop',
    scope: 'idea',
    origin: 'box', // curated in the panel; Lex seeds candidates per material cause
    // §19-D Task 2b — this is a FALLBACK question, and a fallback fires precisely when
    // something failed. It must therefore not promise seeding: on 10 Aug it announced
    // "I'll seed a few candidates per material cause" over an empty options list. What
    // was actually seeded is said by the conductor, which counts the rows first.
    question:
      'Let’s weigh the approaches — add them, edit them, and argue each side. An approach is a way at the obstacle, not a goal and not an action list.',
  },
  {
    key: 'chosenApproach',
    label: 'Chosen approach',
    type: 'reference', // select one option → CHOSEN; the rest → RULED_OUT
    scope: 'idea',
    origin: 'box',
    required: true,
    question: 'Which single approach do you commit to? Choosing it rules the others out — that’s the point.',
  },
  {
    key: 'whatItRulesOut',
    label: 'What it rules out',
    type: 'text',
    scope: 'idea',
    origin: 'proposed', // Lex composes from the RULED_OUT options + reasons; inline confirm
    question: 'Here’s what choosing this approach deliberately rules out, and why.',
  },
  {
    key: 'leverage',
    label: 'Leverage',
    type: 'narrative',
    scope: 'idea',
    origin: 'box',
    required: true,
    question:
      'Why does this approach hit the pivotal obstacle specifically — what asymmetry or pivot point does it exploit?',
    hints: ['the asymmetry it exploits', 'why it concentrates effort on the obstacle', 'the pivot point'],
  },
  {
    key: 'anticipatedResponses',
    label: 'Anticipated responses',
    type: 'structured',
    scope: 'idea',
    origin: 'box',
    slots: [...ANTICIPATED_RESPONSE_SLOTS],
    question:
      'How will people respond? Avoidance, gaming, enforcement burden, legal challenge, and political attack vectors — I’ll propose some; you sharpen them.',
    hints: ['avoidance', 'gaming', 'enforcement burden', 'legal challenge', 'political attack vectors'],
  },
  {
    key: 'conditionsForSuccess',
    label: 'Conditions for success',
    type: 'text',
    scope: 'idea',
    origin: 'proposed', // Lex proposes testable bets from the evaluation; inline confirm
    question: 'For this to work, what must be true? Testable bets, not hopes.',
  },
  {
    key: 'summaryGuidingPolicy',
    label: 'Guiding-policy summary',
    type: 'inferred',
    scope: 'idea',
    origin: 'proposed', // Lex generates when the page's other fields are terminal
    question: 'Here’s the guiding policy — the approach, its leverage, what it rules out, and the conditions.',
  },
]

export const GUIDING_POLICY_PAGE: PageDef = {
  key: 'GUIDING_POLICY',
  label: 'Guiding policy',
  fields: GUIDING_POLICY_FIELDS,
}
