// ─────────────────────────────────────────────────────────────────────────────
// TEXT INTEGRITY (§19-E Task 1) — never truncate user-facing prose silently.
//
// THE BUG THIS EXISTS TO REMOVE, and it is worth stating exactly because the
// diagnosis was not where anyone would have looked first.
//
// Charlie's guiding-policy summary came back with three clauses ending MID-WORD:
//
//   "…ruling out a direct mandate f."
//   "…where an individual in the bureaucracy."
//   "…senior civil servants will seek to define 'major policy initiatives'
//     narrowly, or break th"
//
// It was not the model writing badly, not a VarChar limit, and not maxOutputTokens.
// Every one of those clauses is EXACTLY the first 80 characters of a stored field:
//
//   whatItRulesOut          len 579   first 80 = "By establishing a decision-making
//                                                 charter, you are ruling out a
//                                                 direct mandate f"
//   leverage                len 200   first 80 = "It closes the gate on the pivotal
//                                                 point: where an individual in the
//                                                 bureaucracy "
//   conditionsForSuccessLex len 1282  first 80 = "For this to work, the 'decision-
//                                                 making charter' must be legally
//                                                 robust and clear"
//
// `acceptedSummary()` rendered every accepted field as `value.slice(0, 80)` (and
// `JSON.stringify(value).slice(0, 120)` for objects) and joined them with " · " into
// the prompt's `already captured:` line. That line was the ONLY place the accepted
// values appeared, and the field instruction says "Ground it strictly in what the
// user accepted" — so Lex did exactly as it was told and reproduced the stumps,
// full stop and all. The values in the database were never damaged.
//
// // A silently truncated sentence is a claim the user cannot tell is incomplete.
// // It is the never-claim invariant applied to text integrity, and it belongs in
// // the same family as the silent stub and the invisible fail-open (CLAUDE.md §18):
// // a degradation that does not announce itself is a bug with a good disguise.
//
// THE RULE THIS FILE ENFORCES:
//   1. Prose handed to a model, or shown to a user, is either COMPLETE or visibly
//      ABRIDGED. There is no third state.
//   2. An abridgement cuts at a sentence boundary where one exists, otherwise at a
//      word boundary — NEVER inside a word — and always carries a marker.
//   3. Anything a model is asked to COMPOSE FROM is supplied in full. Abridged text
//      is for orientation ("this exists"), never for quotation.
//
// `npm run check:text-integrity` asserts all three against the compose path.
// ─────────────────────────────────────────────────────────────────────────────

/** The marker an abridged value always carries. One character, unmistakable. */
export const ABRIDGED_MARK = '…'

export interface Abridged {
  /** The text as it may safely be shown — complete, or cut on a boundary and marked. */
  text: string
  /** True when anything was removed. Callers MUST render this fact, not hide it. */
  abridged: boolean
  /** Characters in the original, so a caller can say how much is missing. */
  originalLength: number
}

/**
 * Shorten prose without ever cutting inside a word.
 *
 * Preference order, and the reason for it:
 *   1. The last SENTENCE boundary at or before the cap — a whole sentence reads as
 *      finished writing, so the reader is not left guessing whether a thought was
 *      completed.
 *   2. Failing that, the last WORD boundary — a truncated sentence is obvious as
 *      such once the marker is attached; a truncated word looks like a typo in the
 *      source, which is exactly how this defect hid.
 *   3. Failing even that (one very long token), the whole token is dropped rather
 *      than split. `cap` is a target, not a hard ceiling on correctness.
 *
 * A cap that the text already fits inside returns the text untouched with
 * `abridged: false` — so "short enough to be complete" and "cut" are distinguishable
 * by the caller, not merely by eye.
 */
export function abridge(raw: string | null | undefined, cap: number): Abridged {
  const text = (raw ?? '').trim()
  if (!text) return { text: '', abridged: false, originalLength: 0 }
  if (cap <= 0) return { text: '', abridged: true, originalLength: text.length }
  if (text.length <= cap) return { text, abridged: false, originalLength: text.length }

  // 1. A sentence boundary. Requires at least a third of the cap so we don't return
  //    a stub. ⚠ The lookahead is taken in the FULL text, not in the window — reading
  //    it from the window makes the window's own last character look like the end of a
  //    sentence, which cuts "e.g." into "e." and reintroduces the exact defect.
  const sentence = lastSentenceEnd(text, cap)
  if (sentence >= Math.floor(cap / 3)) {
    return { text: text.slice(0, sentence).trim() + ' ' + ABRIDGED_MARK, abridged: true, originalLength: text.length }
  }

  // 2. A word boundary. `text[cap]` being whitespace means the window itself ended
  //    cleanly — that is a word boundary, and slicing at the last space inside the
  //    window would needlessly drop a whole word.
  const window = text.slice(0, cap)
  const boundary = /\s/.test(text[cap] ?? '') ? cap : window.lastIndexOf(' ')
  if (boundary > 0) {
    return { text: window.slice(0, boundary).trimEnd() + ABRIDGED_MARK, abridged: true, originalLength: text.length }
  }

  // 3. One token longer than the cap. Dropping it whole is honest; splitting it is
  //    the defect this file exists to prevent.
  return { text: ABRIDGED_MARK, abridged: true, originalLength: text.length }
}

/** The index just past the last sentence terminator at or before `cap` in `text`, or -1. */
function lastSentenceEnd(text: string, cap: number): number {
  for (let i = Math.min(cap, text.length) - 1; i >= 0; i--) {
    if (!'.!?'.includes(text[i])) continue
    // A terminator followed by whitespace, or by the end of the WHOLE text, ends a
    // sentence. "e.g." and "£3.2m" are followed by a letter or a digit, so they do
    // not qualify — the conservative reading, because a wrong sentence break here
    // produces exactly the symptom this file exists to remove.
    const next = text[i + 1]
    if (next === undefined || /\s/.test(next)) return i + 1
  }
  return -1
}

/**
 * One accepted field, rendered for the `already captured:` ledger.
 *
 * The label is never abridged (it is short and it is what makes the entry findable),
 * only the value. `LEDGER_VALUE_CAP` is deliberately an order of magnitude above the
 * 80 that caused the defect: this block is an inventory, and an inventory that
 * amputates its entries is worse than a longer prompt. Output tokens are what is
 * billed; a longer prompt costs input tokens, which are a fraction of the price and
 * are cached (CLAUDE.md §18 rule 5, the same argument one level up).
 */
export const LEDGER_VALUE_CAP = 600

export function ledgerEntry(label: string, value: unknown): string {
  const raw = typeof value === 'string' ? value : renderObject(value)
  const { text, abridged, originalLength } = abridge(raw, LEDGER_VALUE_CAP)
  // The abridgement ANNOUNCES ITSELF, with its cause attached — so a model reading
  // this can never mistake a shortened entry for the whole of what the user wrote.
  return abridged
    ? `${label}: ${text} [ABRIDGED — ${originalLength} characters in full; do not quote this entry]`
    : `${label}: ${text}`
}

/** A structured field's slots as prose, so the ledger never shows raw JSON braces. */
function renderObject(value: unknown): string {
  if (value == null) return ''
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string').join(', ')
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => typeof v === 'string' && v.trim())
      .map(([k, v]) => `${k} — ${String(v).trim()}`)
      .join('; ')
  }
  return String(value)
}

/**
 * The COMPLETE text of the fields a composed field is written from.
 *
 * This is the other half of the fix, and the more important half. Capping the ledger
 * at a bigger number only makes the defect rarer; what removes it is that a field
 * asked to be "grounded strictly in what the user accepted" is handed those values
 * IN FULL, in their own block, marked complete. Nothing here is ever shortened —
 * `check:text-integrity` asserts that a 3,000-character value survives whole.
 */
export function sourceValuesBlock(values: Array<{ label: string; value: unknown }>): string | null {
  const lines = values
    .map(({ label, value }) => {
      const text = typeof value === 'string' ? value.trim() : renderObject(value)
      return text ? `${label}:\n${text}` : ''
    })
    .filter(Boolean)
  if (!lines.length) return null
  return [
    'SOURCE VALUES — THE COMPLETE TEXT OF WHAT THE USER ACCEPTED.',
    'These are whole, not extracts. Compose from them; you may quote or paraphrase any of it.',
    'If any value below appears to end mid-word or mid-thought, that is the user\'s own text as',
    'written — say so plainly rather than reproducing the break as though it were a finished clause.',
    '',
    lines.join('\n\n'),
  ].join('\n')
}

/**
 * THE EXACT TEST, for when the original is available: is `shown` a prefix of
 * `original` that stops inside a word?
 *
 * This is not a heuristic — it is the definition — and it is what the check uses to
 * assert `abridge`'s central property. Where the original is in hand, always use
 * this; `endsMidWord` below is the lossy fallback for when it is not.
 */
export function cutsMidWord(original: string, shown: string): boolean {
  if (!original.startsWith(shown) || shown.length >= original.length) return false
  return /\w/.test(original[shown.length] ?? '') && /\w/.test(shown[shown.length - 1] ?? '')
}

/**
 * The SIGNATURE of a mid-word cut in a standalone string, for when the original is
 * not available — `[lex-diag]` on a stored proposal, or a check over rendered prose.
 *
 * Deliberately narrow, and it is worth being explicit about what it does NOT catch,
 * because an over-eager version of this was the first thing I wrote and it flagged
 * "Establish a decision-making charter" (a perfectly good value with no full stop).
 *
 *   CAUGHT:     "…ruling out a direct mandate f."   a terminator glued to a stub
 *               "…narrowly, or break th"            a trailing one/two-letter non-word
 *   NOT CAUGHT: "…where an individual in the bureaucracy."   cut at a WORD boundary
 *
 * That second example is from the same defect and reads as a finished sentence, which
 * is precisely why the fix is the marker and the complete source block rather than a
 * detector: a cut that lands on a word boundary is undetectable after the fact, and
 * the only way to know it happened is for the abridging code to say so at the time.
 */
export function endsMidWord(text: string): boolean {
  const t = (text ?? '').trimEnd()
  if (!t) return false
  const m = t.match(/(?:^|\s)([A-Za-z]{1,2})[.!?]?$/)
  if (!m) return false
  return !REAL_SHORT_WORDS.has(m[1].toLowerCase())
}

/** Words a British-English sentence may legitimately end on, one or two letters. */
const REAL_SHORT_WORDS = new Set([
  'a', 'i', 'am', 'an', 'as', 'at', 'be', 'by', 'do', 'go', 'he', 'if', 'in', 'is',
  'it', 'me', 'my', 'no', 'of', 'on', 'or', 'so', 'to', 'up', 'us', 'we',
])
