// ─────────────────────────────────────────────────────────────────────────────
// 25-Q §1 — THE BRIDGE FROM THE CHAT TO THE MIDDLE PANEL.
//
// Charlie's walkthrough, verbatim: *"I tried to get Lex to edit this and the result was helpful
// but no interaction with the Middle Panel."* He asked Lex to rewrite a candidate guiding policy.
// Lex produced a good rewrite, in the chat, and he copied it across by hand.
//
// ══ §1a — WHAT THE DIAGNOSIS FOUND, BECAUSE IT DECIDES THE SHAPE OF EVERYTHING BELOW ══
//
// The chat is NOT read-only by construction. `POST /api/ideas/[id]/lex` already writes: a valid
// proposal for the CURRENT field goes to `setProposal`, and `causes` and `rootCause` have bespoke
// handlers. **But it cannot reach the fields the middle panel actually renders**, and there are
// three independent reasons, any one of which is sufficient:
//
//   1. ⚠⚠ `validateProposal` HAS NO SCHEMA FOR THEM. `FIELD_VALUE_SCHEMAS` covers the text and
//      structured fields and stops. `policyOptions`, `chosenApproach` and `actions` are absent,
//      so `validateProposal` returns null — "not a proposable field" — and the rewrite is dropped
//      with no sign to the user at all.
//   2. ⚠⚠ EVEN A SUCCESSFUL WRITE WOULD BE INVISIBLE. `setProposal` writes
//      `IdeaFieldState.proposal`, and the loop fields do not render from it — they render their
//      CHILD ROWS (`PolicyOption`, `DiagnosisCause`, `LexCoherentAction`) directly. This is
//      already written down in field-machine.ts's §6a note: *"the panel does not read this
//      value"*.
//   3. It writes immediately rather than offering, which is not what §1b asks for.
//
// **Measured on Charlie's own idea (452c5ade) rather than reasoned about:** `currentField` is
// `policyOptions`, status `AWAITING_CONFIRMATION` — precisely the field with no schema. So the
// mechanism above is what happened to him, not a plausible story about what might have.
//
// ══ WHAT THIS FILE IS ═══════════════════════════════════════════════════════════════
//
// The pure half of the bridge: which fields a chat rewrite may target, how a target is named,
// and how a name is resolved to a row. No I/O, no model call, no Prisma — so the checks can run
// the real resolver over real shapes.
//
// ⚠ THE WRITE ITSELF GOES THROUGH THE FIELD'S OWN WRITER, never a second one. A chat edit to a
// policy option calls what the panel's edit control calls. Two writers for one row is how the
// two drift, and 25-P's whole §1.11 argument rests on there being exactly one.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The fields a chat rewrite may target.
 *
 * ⚠⚠ AN ALLOW-LIST, NOT A DENY-LIST, AND IT IS SHORT ON PURPOSE. Lex writing anywhere it likes
 * is not the feature; the feature is the user watching a specific rewrite land in a specific
 * box. Anything not named here produces no offer, which is the same as today and therefore
 * cannot regress anything.
 */
export type EditableKind =
  /** A `PolicyOption` row, addressed by its 25-P stable number. */
  | 'POLICY_OPTION'
  /** A `DiagnosisCause` row, addressed by its display number. */
  | 'CAUSE'
  /** A whole field whose value is one piece of text on `IdeaFieldState`. */
  | 'TEXT_FIELD'

export interface EditTarget {
  kind: EditableKind
  /** The field key the user and the panel both know it by. */
  fieldKey: string
  /** For a row target: the number the user reads off the screen. Null for a whole field. */
  number: number | null
}

/**
 * ⚠ ADDRESSED BY NUMBER, WHICH IS WHY 25-P §1.1 HAD TO COME FIRST. The user says "rewrite 4";
 * `PolicyOption.number` is stable, never renumbered, and survives a merge or a restore — so the
 * number Lex names in a turn still means the same row when the user presses Accept a minute
 * later. Addressing by position would have made this feature quietly unsafe.
 */
export const EDITABLE_TEXT_FIELDS: ReadonlySet<string> = new Set([
  'challenge', 'pivotalObstacle', 'summaryDiagnosis', 'whatItRulesOut', 'leverage',
  'conditionsForSuccess', 'summaryGuidingPolicy', 'coherenceCheck', 'costSummary',
  'summaryCoherentActions', 'ideaNarrative', 'aboutYou',
])

/** Labels for the offer card, so the card names the box the user is looking at. */
export const EDIT_TARGET_LABELS: Record<string, string> = {
  policyOptions: 'guiding policy',
  causes: 'cause',
  challenge: 'the problem',
  pivotalObstacle: 'the pivotal obstacle',
  summaryDiagnosis: 'the diagnosis summary',
  whatItRulesOut: 'what it rules out',
  leverage: 'the leverage',
  conditionsForSuccess: 'the conditions for success',
  summaryGuidingPolicy: 'the guiding policy summary',
  coherenceCheck: 'the coherence check',
  costSummary: 'the cost summary',
  summaryCoherentActions: 'the actions summary',
  ideaNarrative: 'your description of the idea',
  aboutYou: 'about you',
}

export interface EditOffer {
  target: EditTarget
  /** The rewrite itself — what will be written if the user accepts. */
  text: string
  /**
   * ⚠ THE SENTENCE THE USER READS, BUILT HERE SO EVERY SURFACE ASKS THE SAME QUESTION.
   * §1b gives its shape: *"Shall I put that in as the guiding policy? You can edit it after."*
   */
  question: string
  /** What is there now — shown beside the rewrite so the user is comparing, not guessing. */
  currentText: string | null
}

/** Ambiguity is refused, never guessed. Same discipline as `matchCause`. */
export const AMBIGUOUS_TARGET = Symbol('AMBIGUOUS_TARGET')

/**
 * ══ RESOLVE WHAT LEX NAMED TO A ROW THAT EXISTS ═══════════════════════════════════
 *
 * ⚠⚠ IT RESOLVES AGAINST THE ROWS, NOT AGAINST THE MODEL'S CLAIM. Lex naming "policy 9" on an
 * idea with seven policies is a mistake, and the only safe response is no offer. Writing to the
 * nearest one would be the product choosing which policy to rewrite, which is the single most
 * consequential thing on that screen.
 *
 * ⚠ AND A NUMBER THAT IS NOT LIVE IS NOT A TARGET. A rejected or superseded policy keeps its
 * number (25-P §1.1) and must not be silently edited back into the proposal by a chat turn.
 */
export function resolvePolicyTarget(
  number: number | null | undefined,
  rows: Array<{ number: number | null; live: boolean }>,
): { number: number } | typeof AMBIGUOUS_TARGET | null {
  if (number == null) {
    // No number given. If exactly ONE live policy exists there is no ambiguity to resolve —
    // "rewrite the guiding policy" means the only one there is. Two or more, and we refuse.
    const live = rows.filter((r) => r.live && r.number != null)
    if (live.length === 1) return { number: live[0].number! }
    return live.length > 1 ? AMBIGUOUS_TARGET : null
  }
  const hit = rows.find((r) => r.number === number)
  if (!hit) return null
  if (!hit.live) return null
  return { number }
}

/**
 * Is this text plainly a REPLACEMENT for the field, rather than commentary about it?
 *
 * ⚠⚠ THE GUARD THAT KEEPS THIS FROM BECOMING ANNOYING. §1b says "when Lex produces text that is
 * plainly a replacement" — an offer attached to every paragraph Lex writes would train the user
 * to ignore the card, and an ignored card is worse than no card because it also costs a click to
 * dismiss.
 *
 * Deliberately conservative, and its limits stated rather than hidden: it requires a rewrite
 * long enough to be a field value and short enough not to be an essay, and it refuses anything
 * that reads as a question back to the user. It will miss some genuine rewrites. Missing one
 * leaves the product exactly where it is today; offering on a non-rewrite is a new annoyance.
 */
export function looksLikeAReplacement(text: string, opts: { min?: number; max?: number } = {}): boolean {
  const t = (text ?? '').trim()
  const min = opts.min ?? 40
  const max = opts.max ?? 1500
  if (t.length < min || t.length > max) return false
  // A question is Lex asking, not Lex drafting.
  if (t.endsWith('?')) return false
  // A rewrite is prose or a single clause, not a conversation.
  if (/^(shall|would you|do you|should i)\b/i.test(t)) return false
  return true
}

/** The card's sentence. One place, so chat and any later surface ask identically. */
export function offerQuestion(fieldKey: string, number: number | null): string {
  const label = EDIT_TARGET_LABELS[fieldKey] ?? fieldKey
  const named = number != null ? `${label} ${number}` : label
  return `Shall I put that in as ${named}? You can edit it after.`
}
