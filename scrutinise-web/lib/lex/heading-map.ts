// ─────────────────────────────────────────────────────────────────────────────
// 25-D §3 — RESOLVING A STORED ROW TO ITS §25.5 HEADING.
//
// From this sprint on, every producer TAGS its rows: `EvidenceItem.headingKey` is written at
// creation by the code that knows the answer. This module exists for the other two cases,
// and it is careful to keep them apart:
//
//   1. ROWS WRITTEN BEFORE 25-D have a null `headingKey`. Their `passKey` still identifies
//      the producer, and each producer NOW DECLARES its heading in configuration — so the
//      heading can be recovered for an old row without anything here guessing. That is a
//      lookup, not a classification.
//
//   2. THE TWO BUILD PASSES THAT ARE NOT IN EITHER LIBRARY. `REVISE` and `ADVERSARIAL` are
//      written by `build.ts` directly rather than by an entry in a config array.
//
// ⚠ WHAT THIS FILE MUST NEVER BECOME: a place that reads a finding's TEXT and decides what
// it is about. That is the failure 25-C's known-unknowns collapse was built to avoid, and
// on a document a Bill may rest on it is worse than leaving the row unclassified. Anything
// this module cannot resolve comes back `null`, and `null` renders as "not classified" —
// visible, and no claim made.
//
// ⚠ AND THE PRECEDENCE IS FIXED: THE STORED TAG ALWAYS WINS. If a question is later moved
// to a different heading, rows written under the old one keep it, because the tag records
// what the producer meant at the time and this lookup would silently rewrite history.
// ─────────────────────────────────────────────────────────────────────────────

import { questionById } from './interrogation-library'
import { passDef } from './deepening-config'
import { isHeadingKey, type HeadingKey } from './question-headings'

/**
 * The build's own pass keys, which are not entries in either configuration array.
 *
 * ⚠ `REVISE` IS DELIBERATELY ABSENT, and this is the one judgement call in the file. A
 * REVISE row is a CONTRADICTION — "I first concluded X; the evidence says Y" — and it is
 * the single most valuable sentence a build produces. It already leads the review agenda
 * (25-C §3b). Giving it a panel heading as well would file the headline finding among the
 * source cards, where §3b found it buried in the first place. It resolves to null and the
 * mapping report says so, rather than being quietly dropped.
 */
const BUILD_PASS_HEADINGS: Record<string, HeadingKey> = {
  ADVERSARIAL: 'AGAINST',
}

/** §25.6 — the user's own documents and links. One prefix, one heading. */
export const USER_MATERIAL_PASS_PREFIX = 'material:'

export function isUserMaterialPass(passKey: string): boolean {
  return passKey.startsWith(USER_MATERIAL_PASS_PREFIX)
}

/**
 * The heading a stored row belongs under: its own tag first, then its producer's declared
 * heading, then nothing.
 */
export function resolveHeading(row: { headingKey?: string | null; passKey: string }): HeadingKey | null {
  if (isHeadingKey(row.headingKey)) return row.headingKey
  return headingForPassKey(row.passKey)
}

/**
 * The heading a producer declares, looked up from configuration. Null where the producer
 * declares none — which is a fact worth reporting, not one to paper over.
 */
export function headingForPassKey(passKey: string): HeadingKey | null {
  if (isUserMaterialPass(passKey)) return 'YOUR_MATERIAL'
  const q = questionById(passKey)
  if (q) return q.heading
  const p = passDef(passKey)
  if (p) return p.heading
  return BUILD_PASS_HEADINGS[passKey] ?? null
}
