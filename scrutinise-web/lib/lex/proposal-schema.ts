// Per-field proposal validation (§4, server-side handling step 1).
// A proposal whose value fails its field schema is discarded — the chatText is
// still shown, and the field state never advances. Lex can never half-advance.

import { z } from 'zod'

const titleSchema = z.string().trim().min(3).max(160)

const keywordsSchema = z
  .array(z.string().trim().min(1).max(60))
  .min(1)
  .max(12)

// Narrative boxes are now proposable too: Lex tidies a chat answer into the
// box's content (§13). Any non-trivial string is valid.
const narrativeSchema = z.string().trim().min(1).max(10000)

// ── Page 2 (Diagnosis) ───────────────────────────────────────────────────────
// Short Lex-proposed statements (inline confirm in chat).
const sentenceSchema = z.string().trim().min(3).max(2000)
const summarySchema = z.string().trim().min(3).max(6000)

// Structured slot objects (edited in the panel). Every slot is an optional trimmed
// string; unknown keys are stripped. An all-empty object is still allowed (the user
// may Skip instead), but at least the shape is enforced.
const whoAffectedImpactCostSchema = z
  .object({
    affectedGroups: z.string().trim().max(4000).optional(),
    impact: z.string().trim().max(4000).optional(),
    cost: z.string().trim().max(4000).optional(),
    evidence: z.string().trim().max(4000).optional(),
  })
  .strip()
const legalLandscapeSchema = z
  .object({
    currentLaw: z.string().trim().max(4000).optional(),
    whereItFails: z.string().trim().max(4000).optional(),
  })
  .strip()

// ── Page 3 (Guiding Policy) ──────────────────────────────────────────────────
const anticipatedResponsesSchema = z
  .object({
    avoidance: z.string().trim().max(4000).optional(),
    gaming: z.string().trim().max(4000).optional(),
    enforcementBurden: z.string().trim().max(4000).optional(),
    legalChallenge: z.string().trim().max(4000).optional(),
    politicalAttack: z.string().trim().max(4000).optional(),
  })
  .strip()

// Map of fieldKey → zod schema for the proposal's `value`.
// (causes = loop and rootCause = reference are handled by dedicated route actions,
//  not through this generic proposal/accept validator.)
const FIELD_VALUE_SCHEMAS: Record<string, z.ZodTypeAny> = {
  ideaNarrative: narrativeSchema,
  youAndIdeaNarrative: narrativeSchema,
  aboutYou: narrativeSchema,
  title: titleSchema,
  keywords: keywordsSchema,
  // Page 2
  challenge: sentenceSchema,
  pivotalObstacle: sentenceSchema,
  summaryDiagnosis: summarySchema,
  whoAffectedImpactCost: whoAffectedImpactCostSchema,
  legalLandscape: legalLandscapeSchema,
  // Page 3 (Guiding Policy)
  whatItRulesOut: summarySchema,
  leverage: narrativeSchema,
  anticipatedResponses: anticipatedResponsesSchema,
  conditionsForSuccess: summarySchema,
  summaryGuidingPolicy: summarySchema,
  // Page 4 (Coherent Actions)
  coherenceCheck: summarySchema,
  costSummary: summarySchema,
  summaryCoherentActions: summarySchema,
}

export interface ValidatedProposal {
  fieldKey: string
  value: unknown
  rationale?: string
}

/** Returns the normalised proposal if valid for the target field, else null. */
export function validateProposal(input: {
  fieldKey?: unknown
  value?: unknown
  rationale?: unknown
}): ValidatedProposal | null {
  if (typeof input.fieldKey !== 'string') return null
  const schema = FIELD_VALUE_SCHEMAS[input.fieldKey]
  if (!schema) return null // not a proposable field
  const parsed = schema.safeParse(input.value)
  if (!parsed.success) return null
  const rationale =
    typeof input.rationale === 'string' && input.rationale.trim().length > 0
      ? input.rationale.trim()
      : undefined
  return { fieldKey: input.fieldKey, value: parsed.data, rationale }
}

/** Validate an externally-supplied accept value (e.g. a user edit) for a field. */
export function validateFieldValue(fieldKey: string, value: unknown): unknown | undefined {
  const schema = FIELD_VALUE_SCHEMAS[fieldKey]
  if (!schema) {
    // Box (narrative) fields: accept any non-empty string.
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
    return undefined
  }
  const parsed = schema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}
