// ─────────────────────────────────────────────────────────────────────────────
// WHAT LEX IS TOLD THE USER HAS ALREADY ACCEPTED (§19-E Task 1).
//
// ONE COPY. This existed twice — in `orchestrator.ts` for conductor turns and again
// in `app/api/ideas/[id]/lex/route.ts` for chat turns — as two identical `.slice(0,
// 80)` expressions. Both carried the truncation defect, and fixing one would have
// left the other producing mid-word summaries on exactly the path Charlie was using.
//
// // Two copies of CHILD_ENTITY_FIELDS had already drifted once (§19-D Task 9a).
// // A rule that lives in two files is a rule that will hold in one of them.
//
// TWO BLOCKS, TWO PURPOSES, AND THE DISTINCTION IS THE FIX:
//
//   · THE LEDGER (`acceptedSummary`) is an INVENTORY — "these things exist and this
//     is roughly what they say". Long values are abridged, on a boundary, and each
//     abridged entry says so and forbids quotation.
//
//   · THE SOURCE VALUES (`sourceValuesFor`) are the MATERIAL — the complete text of
//     the fields a composed field is written from, marked complete, never shortened.
//     A field instructed to "ground it strictly in what the user accepted" is given
//     the whole of what the user accepted, which is what stops it reproducing a
//     stump as though it were a finished clause.
// ─────────────────────────────────────────────────────────────────────────────

import type { CanonicalState, CanonicalField } from './page1-config'
import { ledgerEntry, sourceValuesBlock } from './text-integrity'

function allFields(state: CanonicalState): CanonicalField[] {
  return state.pages.flatMap((p) => p.fields)
}

/** The inventory line — every accepted field, abridged on a boundary and marked. */
export function acceptedSummary(state: CanonicalState): string {
  return allFields(state)
    .filter((f) => f.status === 'ACCEPTED' && f.value)
    .map((f) => ledgerEntry(f.label, f.value))
    .join(' · ')
}

/**
 * Which fields each COMPOSED field is written from.
 *
 * These are the three summaries plus the guiding policy's own composed field. They
 * are the fields whose instruction says "ground it strictly in what the user
 * accepted" — i.e. exactly the fields that will reproduce whatever rendering of the
 * accepted values they are shown. Nothing else needs the full block, and giving it
 * to everything would put the whole kernel in every prompt.
 */
export const COMPOSED_FROM: Record<string, string[]> = {
  summaryDiagnosis: [
    'challenge', 'whoAffectedImpactCost', 'rootCause', 'legalLandscape', 'pivotalObstacle',
  ],
  summaryGuidingPolicy: [
    'chosenApproach', 'leverage', 'whatItRulesOut', 'anticipatedResponses', 'conditionsForSuccess',
  ],
  summaryCoherentActions: [
    'chosenApproach', 'coherenceCheck', 'costSummary', 'summaryDiagnosis',
  ],
  coherenceCheck: ['chosenApproach', 'rootCause', 'pivotalObstacle'],
}

export function isComposedField(key: string | null | undefined): boolean {
  return !!key && key in COMPOSED_FROM
}

/**
 * The complete text of the fields `fieldKey` is composed from, or null when this is
 * not a composed field (or none of its sources is accepted yet).
 *
 * Values are passed through UNTOUCHED. `check:text-integrity` asserts that with a
 * synthetic 3,000-character value, so a later "let's keep the prompt tidy" cannot
 * quietly reintroduce the cut.
 */
export function sourceValuesFor(fieldKey: string | null | undefined, state: CanonicalState): string | null {
  if (!fieldKey) return null
  const sources = COMPOSED_FROM[fieldKey]
  if (!sources) return null
  const fields = allFields(state)
  const values = sources
    .map((key) => fields.find((f) => f.key === key))
    .filter((f): f is CanonicalField => !!f && f.status === 'ACCEPTED' && !!f.value)
    .map((f) => ({ label: f.label, value: f.value }))
  return sourceValuesBlock(values)
}
