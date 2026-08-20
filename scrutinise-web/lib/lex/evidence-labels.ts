// ─────────────────────────────────────────────────────────────────────────────
// 25-C §2.3 — WHAT AN EVIDENCE ITEM IS CALLED, DERIVED FROM WHERE IT CAME FROM.
//
// ⚠⚠ THE DEFECT: TWO THINGS OF VERY DIFFERENT RELIABILITY WORE THE SAME BADGE.
//
//   · An ASSEMBLED PRECEDENT RECORD — built deterministically by `deepening-jobs.ts` around a
//     NAMED instrument, pulling the explanatory note, the impact assessment and the
//     post-implementation review from the collections that hold each. No model chose it, no model
//     ranked it, and the precedent test is satisfied BY CONSTRUCTION: the group exists only
//     because at least one leg was actually found for that instrument.
//
//   · A MODEL-WRITTEN SUMMARY of one retrieved document, which the gather decided to call a
//     precedent. Useful — the brief is explicit that these must NOT be removed — but it is one
//     model's reading of one document, and the sift can and does overrule it.
//
// Both rendered as the single word "Precedent". A user comparing them had no way to tell that one
// is a record and the other is an opinion, which is exactly the distinction this platform exists
// to keep.
//
// ⚠ THE LABEL IS DERIVED FROM `sourceType`, NOT SET AT THE CALL SITE. That is the brief's
// requirement and it is the right one: a label passed in by whoever creates the row is a label two
// creators will eventually disagree about, and the disagreement is invisible. `sourceType` is
// already written by exactly one place for each kind, so the provenance is a fact about the row
// rather than a decision repeated per writer.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `sourceType` values that mean "assembled by us, deterministically".
 *
 * ⚠ An explicit list, never a pattern. A prefix rule would one day promote a model-written row to
 * "assembled" because someone named a source type conveniently.
 */
const ASSEMBLED_SOURCE_TYPES: ReadonlySet<string> = new Set([
  // deepening-jobs.ts runPrecedent — one row per instrument, holding the whole group.
  'PRECEDENT_GROUP',
  // deepening-jobs.ts runDevolutionScope — the jurisdiction-led group.
  'DEVOLUTION_SCOPE',
])

export function isAssembled(sourceType: string | null | undefined): boolean {
  return !!sourceType && ASSEMBLED_SOURCE_TYPES.has(sourceType)
}

/**
 * The badge for one evidence item.
 *
 * ⚠ The two precedent labels are deliberately not "Precedent" and "Precedent (weak)". The
 * difference is not strength, it is KIND: one is a record we assembled and can show you the parts
 * of; the other is a reading of a single document. Saying which it is lets the user decide how much
 * weight to give it, which is the whole contract.
 */
export function evidenceLabel(kind: string, sourceType: string | null | undefined): string {
  if (kind === 'PRECEDENT') {
    return isAssembled(sourceType)
      ? 'Precedent — assembled record'
      : 'Precedent — read from one document'
  }
  if (isAssembled(sourceType)) {
    // A DEVOLUTION_SCOPE row is stored as a plain FINDING but is equally deterministic, and
    // deserves the same distinction rather than looking like a model's observation.
    return 'Assembled record'
  }
  switch (kind) {
    case 'FINDING': return 'Finding'
    case 'SUPPORTS': return 'Supports the diagnosis'
    case 'CONTRADICTS': return 'Contradicts the diagnosis'
    case 'COMPARISON': return 'Comparison'
    default: return kind
  }
}

/**
 * One line saying HOW the item was produced, for the panel to show under the badge.
 *
 * Returns null where there is nothing worth saying — a plain model-written finding already carries
 * its sift reason, and a second sentence repeating "a model wrote this" on every row is noise that
 * teaches the user to stop reading the ones that matter.
 */
export function provenanceNote(kind: string, sourceType: string | null | undefined): string | null {
  if (isAssembled(sourceType)) {
    return 'Assembled by us from the collections that hold each part — not ranked, and not judged by a model.'
  }
  if (kind === 'PRECEDENT') {
    return 'One document, read and summarised by Lex. Check it says what this says before you rely on it.'
  }
  return null
}
