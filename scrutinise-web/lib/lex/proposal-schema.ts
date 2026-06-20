// Per-field proposal validation (§4, server-side handling step 1).
// A proposal whose value fails its field schema is discarded — the chatText is
// still shown, and the field state never advances. Lex can never half-advance.

import { z } from 'zod'

const titleSchema = z.string().trim().min(3).max(160)

const keywordsSchema = z
  .array(z.string().trim().min(1).max(60))
  .min(1)
  .max(12)

// Map of fieldKey → zod schema for the proposal's `value`.
const FIELD_VALUE_SCHEMAS: Record<string, z.ZodTypeAny> = {
  title: titleSchema,
  keywords: keywordsSchema,
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
