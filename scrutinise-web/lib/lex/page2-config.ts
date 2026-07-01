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

// Human labels for the structured slots (panel + summary rendering).
export const SLOT_LABELS: Record<string, string> = {
  affectedGroups: 'Who’s affected',
  impact: 'Impact',
  cost: 'Cost',
  evidence: 'Evidence',
  currentLaw: 'Current law',
  whereItFails: 'Where it falls short',
}

export const DIAGNOSIS_FIELDS: FieldDef[] = [
  {
    key: 'challenge',
    label: 'Challenge',
    type: 'text',
    scope: 'idea',
    origin: 'proposed', // Lex proposes a one-sentence statement; inline confirm in chat
    required: true,
    question: 'In one sentence, what exactly is the challenge?',
  },
  {
    key: 'whoAffectedImpactCost',
    label: 'Who’s affected, impact & cost',
    type: 'structured',
    scope: 'idea',
    origin: 'box', // structured editor in the panel; seeded (carried forward) by the conductor
    slots: [...WHO_AFFECTED_SLOTS],
    // Kept visibly distinct because affectedGroups is the MP/constituency hook (§7.1).
    question:
      'Who is affected (keep the groups visible), what is the impact, and what does it cost? Add any evidence you have.',
    hints: ['who is affected', 'the impact', 'the cost', 'any evidence you have'],
  },
  {
    key: 'causes',
    label: 'Causes',
    type: 'loop',
    scope: 'idea',
    origin: 'box', // the causes loop editor in the panel (add / edit / remove)
    question:
      'What are the causes of this problem, and why has each persisted? I’ll seed a few that others have identified.',
  },
  {
    key: 'rootCause',
    label: 'Root cause',
    type: 'reference', // the user selects one cause from the loop as the main driver
    scope: 'idea',
    origin: 'box',
    required: true,
    question: 'Of those causes, which is the main driver of the problem — the root cause?',
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
