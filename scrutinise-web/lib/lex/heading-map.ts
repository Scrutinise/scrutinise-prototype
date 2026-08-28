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

import { questionById, INTERROGATION_LIBRARY } from './interrogation-library'
import { passDef, PASSES } from './deepening-config'
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
 * ══ 25-L §3b — WHICH HEADINGS SOMETHING CAN ACTUALLY WRITE UNDER, COMPUTED ══════
 *
 * §3b: the contents list is "driven from the passes, not a hardcoded list, so a new pass
 * appears without a code change."
 *
 * ⚠ THE PRODUCERS ALREADY DECLARE THEIR HEADING — every interrogation question and every
 * deepening pass carries `heading` in its config, and 25-D put it there so a stored row
 * could be resolved without guessing. Nothing had ever read them the other way round, so
 * `HEADINGS_WITH_NO_PRODUCER` was maintained by hand and could only be right by accident.
 *
 * ⚠ A HEADING NOT IN THIS SET IS `no-producer`, WHICH IS OUR GAP AND SAYS SO. That is the
 * one empty-state that must never be reported as "we looked and found nothing" — blaming
 * the record for a hole in our tooling is the failure the whole heading system exists to
 * prevent.
 *
 * ⚠ IT IS A CAPABILITY, NOT A RESULT. This says a producer EXISTS for the heading, not
 * that it ran on this draft or found anything. `question-panel.ts` decides between
 * `not-asked` and `asked-found-nothing` from the run record; this only rules out the third.
 */
export function headingsWithProducers(): Set<HeadingKey> {
  const out = new Set<HeadingKey>()
  for (const q of INTERROGATION_LIBRARY) out.add(q.heading)
  for (const p of PASSES) out.add(p.heading)
  for (const h of Object.values(BUILD_PASS_HEADINGS)) out.add(h)
  // §25.6 — the user's own material is its own producer, and the user is the one who runs it.
  out.add('YOUR_MATERIAL')
  // 25-L §3c — the smart pass writes both of these directly (`recordPrognosis`), which is
  // why they are named here rather than read from a config array: `SMART` is not an entry
  // in either library, exactly like `ADVERSARIAL` above it.
  out.add('HOW_HARD')
  out.add('KEY_SOURCES')
  return out
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
