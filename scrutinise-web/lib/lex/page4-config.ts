// ─────────────────────────────────────────────────────────────────────────────
// Lex rebuild — Page 4 (Coherent Actions + the costing shell) field config (§18).
//
// Actions must be COORDINATED, not merely listed: consistent with the policy and
// each other, resources concentrated. Each action carries the §18.2 three-way cost
// structure (implementation / enforcement / regulatory friction) as ranges-with-
// basis, then the page aggregates them against the Page 2 problem cost.
//
// Imports only TYPES from page1-config (no runtime import cycle).
// ─────────────────────────────────────────────────────────────────────────────

import type { FieldDef, PageDef } from './page1-config'

// Benefit slots captured per action (§18.1).
export const BENEFIT_SLOTS = ['financial', 'social', 'ongoing'] as const

// The three §18.2 cost categories, with who bears each (used by the estimator UI).
export const COST_CATEGORIES = [
  { key: 'implementationCost', label: 'Implementation (one-off)', fallsOn: 'Government' },
  { key: 'enforcementCost', label: 'Enforcement (ongoing)', fallsOn: 'Regulator / state' },
  { key: 'regulatoryFriction', label: 'Regulatory friction (ongoing)', fallsOn: 'The economy' },
] as const

export const COHERENT_ACTIONS_FIELDS: FieldDef[] = [
  {
    key: 'actions',
    label: 'Coherent actions',
    type: 'loop',
    scope: 'idea',
    origin: 'box', // the actions + costing editor in the panel
    question:
      'Now the coordinated steps that execute the policy. For each: the step, who implements it, and its costs and benefits — I’ll help you estimate with sourced ranges.',
  },
  {
    key: 'coherenceCheck',
    label: 'Coherence check',
    type: 'inferred',
    scope: 'idea',
    origin: 'proposed', // Lex-run commentary; user accepts inline. No new user labour.
    question: 'Here’s my read on how these actions hang together — consistency, concentration, and sequencing.',
  },
  {
    key: 'costSummary',
    label: 'Cost summary',
    type: 'inferred',
    scope: 'idea',
    origin: 'proposed', // the platform aggregates the per-action costs vs the Page 2 problem cost
    question: 'Here are the aggregated costs set against what the problem costs — the cost-benefit spine.',
  },
  {
    key: 'summaryCoherentActions',
    label: 'Coherent-actions summary',
    type: 'inferred',
    scope: 'idea',
    origin: 'proposed', // Lex generates when the page's other fields are terminal
    question: 'Here’s the coherent-actions summary — the plan and its cost-benefit case.',
  },
]

export const COHERENT_ACTIONS_PAGE: PageDef = {
  key: 'COHERENT_ACTIONS',
  label: 'Coherent actions',
  fields: COHERENT_ACTIONS_FIELDS,
}
