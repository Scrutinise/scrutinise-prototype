// ─────────────────────────────────────────────────────────────────────────────
// Lex rebuild — Page 2 (Diagnosis) field configuration (design §7).
//
// Same field machine as Page 1; new fields. Purpose: name the pivotal obstacle —
// capturing the two distinct things Rumelt separates: the ROOT CAUSE (why the
// problem happens) and the PIVOTAL OBSTACLE (why a solution has not stuck).
//
// Imports only TYPES from page1-config, so page1-config can aggregate this page
// (PAGE_SEQUENCE) without a runtime import cycle.
// ─────────────────────────────────────────────────────────────────────────────

import type { FieldDef, PageDef } from './page1-config'

// Slot keys for the two structured fields — the panel renders one input per slot.
export const WHO_AFFECTED_SLOTS = ['affectedGroups', 'impact', 'cost', 'evidence'] as const
export const LEGAL_LANDSCAPE_SLOTS = ['currentLaw', 'whereItFails'] as const

// Human labels for the structured slots (panel + summary rendering). Aggregates the
// slots across all pages' structured fields (Page 2 diagnosis + Page 3 responses + …).
export const SLOT_LABELS: Record<string, string> = {
  // Page 2
  affectedGroups: 'Who is most acutely affected',
  impact: 'Impact',
  cost: 'Cost',
  evidence: 'Evidence',
  currentLaw: 'Current law',
  whereItFails: 'Where it falls short',
  // Page 3 — anticipatedResponses
  avoidance: 'Avoidance',
  gaming: 'Gaming',
  enforcementBurden: 'Enforcement burden',
  legalChallenge: 'Legal challenge',
  politicalAttack: 'Political attack vectors',
  // Page 4 — per-action benefits
  financial: 'Financial benefit',
  social: 'Social benefit',
  ongoing: 'Ongoing benefit',
}

export const DIAGNOSIS_FIELDS: FieldDef[] = [
  {
    // §19-D Task 1a — the STORED key stays `challenge` (it is mirrored onto
    // `Idea.challenge`, referenced by the search-query builder and by every stored
    // field-state row; renaming it would be a migration for no user-visible gain).
    // Everything the user reads says "The problem", here and everywhere else.
    //
    // // A vague label invites a vague answer. "Challenge" let a solution in.
    key: 'challenge',
    label: 'The problem',
    type: 'text',
    scope: 'idea',
    origin: 'proposed', // Lex proposes a one-sentence statement; inline confirm in chat
    required: true,
    question:
      'In one sentence, what is the problem — what is going wrong, for whom, and why does it matter?',
  },
  {
    key: 'whoAffectedImpactCost',
    label: 'Who’s affected, impact & cost',
    type: 'structured',
    scope: 'idea',
    origin: 'box', // structured editor in the panel; seeded (carried forward) by the conductor
    slots: [...WHO_AFFECTED_SLOTS],
    // §16.1: the discriminating question is who is MOST ACUTELY affected (specific
    // groups — the MP/constituency hook), not "who's affected" (answer: everyone).
    question:
      'Who is most acutely affected — the specific groups, not everyone — and what is the impact and cost on them? Add any evidence you have.',
    hints: ['the specific groups most acutely affected', 'the impact on them', 'the cost', 'any evidence you have'],
  },
  {
    key: 'causes',
    label: 'Causes',
    type: 'loop',
    scope: 'idea',
    origin: 'box', // the causes loop editor in the panel (add / edit / remove)
    // §19-D Task 2/8 — no promise of seeding here either. This text is the fallback,
    // and the conductor reports the actual number of candidates it managed to seed.
    question: 'What are the causes of this problem, and why has each one persisted?',
  },
  {
    key: 'rootCause',
    label: 'Root cause',
    type: 'reference', // the user selects one cause from the loop as the main driver
    scope: 'idea',
    origin: 'box',
    required: true,
    // §16.1: choose the root cause among the MATERIAL causes (not the contributory ones).
    question: 'Of the material causes, which is the main driver of the problem — the root cause?',
  },
  {
    key: 'legalLandscape',
    label: 'Legal landscape',
    type: 'structured',
    scope: 'idea',
    origin: 'box',
    slots: [...LEGAL_LANDSCAPE_SLOTS],
    // Placed BEFORE pivotalObstacle: knowing the existing law usually reveals the real
    // obstacle (e.g. "it's already illegal → the obstacle is enforcement, not law").
    question: 'What law currently governs this, and where does it fall short?',
    hints: ['what law currently governs this', 'where it falls short'],
  },
  {
    key: 'pivotalObstacle',
    label: 'Pivotal obstacle',
    type: 'text',
    scope: 'idea',
    origin: 'proposed', // Lex proposes; distinct from rootCause; inline confirm in chat
    required: true,
    question:
      'What is the critical thing blocking a solution — the pivotal obstacle? It is distinct from the root cause.',
  },
  {
    key: 'summaryDiagnosis',
    label: 'Diagnosis summary',
    type: 'inferred',
    scope: 'idea',
    origin: 'proposed', // Lex generates when the page's other fields are terminal; user accepts
    question: 'Here’s the diagnosis — does it capture both the root cause and the pivotal obstacle?',
  },
]

export const DIAGNOSIS_PAGE: PageDef = {
  key: 'DIAGNOSIS',
  label: 'Diagnosis',
  fields: DIAGNOSIS_FIELDS,
}
