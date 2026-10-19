// ─────────────────────────────────────────────────────────────────────────────
// WHAT A RECORDED EFFECT DOES TO THE TEXT — AND WHERE THE RECORD COMES FROM.
//
// Pure: no imports, no database. `statutory-graph.ts` reads the rows; this file says what
// they mean. It is separate so a check can call it on every distinct `sub_type` the table
// holds, and so the client bundle could import it without reaching `lib/prisma.ts` (§28).
//
// ⚠⚠ `edge_type` IS NOT WHAT HAPPENED. TNA files every effect under one of four types and
// keeps the real statement in `sub_type`. Counting on `edge_type` alone says "705 amendments"
// of an Act where some of those rows are `excluded`, `applied by S.I. …` or `power to amend
// conferred` — none of which changes a word of the Act. Presenting them as textual change
// overstates what a repeal or amendment knocks on to (SEARCH_S27_REPORT §2, "read these counts
// carefully"). `sub_type` therefore travels to the screen VERBATIM, and `changeKind` is an
// ADDITIVE reading of it — never a replacement, never a collapse.
//
// ⚠⚠ THREE ANSWERS, NOT TWO, AND NO DEFAULT ARM. `textual` and `not-textual` are claims, so a
// value this file does not recognise is `unclassified` and is COUNTED AS SUCH. A default of
// either kind would be the else-branch flattening `detectionOf` exists to prevent. The
// vocabulary is large (tens of thousands of distinct strings for `amends` alone) and the rules
// are an allow-list of leading phrases for exactly that reason: a guess in either direction is
// a confident wrong answer.
//
// ⚠ THE ORDER OF THE RULES IS THE WHOLE LOGIC. `applied (with modifications)`, `excluded` and
// `amendment to earlier affecting provision` each contain, or start like, a textual verb. The
// non-textual tests run FIRST, exactly as `splitInbound` tests the kind before the provision.
// ─────────────────────────────────────────────────────────────────────────────

export type ChangeKind = 'textual' | 'not-textual' | 'unclassified'

export interface EffectReading {
  kind: ChangeKind
  /** Which rule decided it. Stable, so a check can say how many rows each rule read. */
  rule: string
  /** In a reader's words: what this row does, and — for not-textual — what it does NOT do. */
  reason: string
  /**
   * ⚠ A prospective effect is recorded but NOT YET IN FORCE. Reading one as current is the same
   * overstatement as reading `excluded` as an amendment, so it is carried, not buried in the
   * `sub_type` string.
   */
  prospective: boolean
  /** A temporary effect (`(temp.)`). */
  temporary: boolean
}

export interface EffectRule { id: string; re: RegExp; kind: ChangeKind; reason: string }
type Rule = EffectRule

const NOT_WORDS = 'the words of the Act are not changed'

/**
 * Ordered. First match wins. Tested against the lower-cased, entity-decoded `sub_type`.
 * ⚠ Every pattern is anchored to the START: TNA's types lead with the verb, and an unanchored
 * `amended` would also catch `applied … (as amended)` — the HRA s.3 / EqA SI rows themselves.
 */
const RULES: Rule[] = [ // exported read-only as EFFECT_RULES, so a check can MUTATE a copy (reorder it) and watch it fail
  // ── NOT a change to the words ───────────────────────────────────────────────
  { id: 'power-conferred', re: /^power to /, kind: 'not-textual',
    reason: `confers a power to amend, repeal or modify; ${NOT_WORDS} by this row` },
  { id: 'excluded', re: /^(excluded|disapplied)\b/, kind: 'not-textual',
    reason: `the provision is carved out or disapplied in some respect; ${NOT_WORDS}` },
  // ⚠ UNANCHORED ON PURPOSE, and placed before the textual rules: `words substituted in earlier
  // amending provision` starts with a textual phrase and is a change to the AMENDING provision.
  { id: 'earlier-provision', re: /\bearlier (affecting|amending|commencement|appointed)\b|\baffecting provision\b/, kind: 'not-textual',
    reason: `concerns an earlier amending or affecting provision, not this Act’s own words` },
  { id: 'application', re: /^(applied|incorporated|restricted|extended|validity extended|extended validity|saved|continued|superseded|derogation|modified|transfer of functions|functions made exercisable)\b/, kind: 'not-textual',
    reason: `changes how, where or by whom the provision applies; ${NOT_WORDS}` },
  { id: 'lapse', re: /^(ceases? to have effect|expires?|expiry)\b/, kind: 'not-textual',
    reason: `the provision lapses by its own terms; it is not repealed` },
  { id: 'implicit', re: /^implicit repeal/, kind: 'not-textual',
    reason: `a repeal by implication, not an express change to the words` },

  // ⚠⚠ MIXED WORDING IS NOT A CHANGE WE CAN VOUCH FOR. Found by `check:effects` A2 on its first run:
  // `revoked (excluded art.3, 4, 4A, Sch.1)`, `repealed and superseded` and `amendment by S.I. … applied
  // to W.` all START with a textual verb and then say something that is not one. The leading verb alone
  // read them as textual; the live vocabulary says part of each string is an exclusion, an application or a
  // saving. Neither answer is safe, so they are `unclassified` and shown with their wording.
  { id: 'mixed', re: /\b(excluded|disapplied|applied|superseded|restricted|saved|power to)\b/, kind: 'unclassified',
    reason: 'the recorded wording mixes a change with an exclusion, an application or a saving, so we do not call it a textual change' },

  // ── a change to the words ───────────────────────────────────────────────────
  // ⚠ ALLOW-LIST OF VERBS. `sum confirmed`, `sum maintained` and `sum specified` are deliberately
  // NOT here: a sum that is confirmed is not a sum that changed.
  { id: 'textual-qualified',
    re: /^(words?|sums?|figures?|entr(?:y|ies)|texts?|headings?|definitions?|paragraphs?|full stop|comma|numbers?)\s+(inserted|substituted|omitted|added|repealed|revoked|deleted|replaced|amended)\b/,
    kind: 'textual', reason: 'changes the words of the Act' },
  { id: 'textual-bare',
    re: /^(inserted|substituted|omitted|added|repealed|revoked|repeal|replaced|replacement|amended|amendment|partial repeal)\b/,
    kind: 'textual', reason: 'changes the words of the Act' },
]

export const EFFECT_RULES: readonly EffectRule[] = RULES

/**
 * How the stored effect should be read. `commences` is never a change to the words, whatever
 * its sub_type says; every other type is read from `sub_type`.
 */
export function readEffect(edgeType: string, subType: string): EffectReading {
  const s = (subType ?? '').replace(/&amp;/g, '&').trim().toLowerCase()
  const prospective = /\(prosp\.?\)/.test(s)
  const temporary = /\(temp\.?\)/.test(s)

  if (edgeType === 'commences') {
    return { kind: 'not-textual', rule: 'commencement', prospective, temporary,
      reason: `a commencement: it brings provisions into force; ${NOT_WORDS}` }
  }
  // ⚠ `made-under` and `cites` are not effects on the text at all, and the empty string is
  // the stored value for them. They never reach the rules below.
  if (edgeType === 'made-under' || edgeType === 'cites') {
    return { kind: 'not-textual', rule: 'relationship', prospective: false, temporary: false,
      reason: edgeType === 'made-under'
        ? `an instrument made under this Act; ${NOT_WORDS}`
        : `a reference to this Act; ${NOT_WORDS}` }
  }
  if (s === '') {
    return { kind: 'unclassified', rule: 'empty', prospective, temporary,
      reason: 'the record states no effect type, so we cannot say whether the words changed' }
  }
  for (const r of RULES) {
    if (r.re.test(s)) return { kind: r.kind, rule: r.id, reason: r.reason, prospective, temporary }
  }
  return { kind: 'unclassified', rule: 'unrecognised', prospective, temporary,
    reason: 'an effect type we have not classified: read the recorded wording, and do not call it a textual change' }
}

export const RULE_IDS: string[] = [
  'commencement', 'relationship', 'empty', ...RULES.map((r) => r.id), 'unrecognised',
]

// ── WHERE THE ROW CAME FROM ─────────────────────────────────────────────────────

/**
 * ⚠⚠ TWO KINDS OF EVIDENCE, AND THE DIFFERENCE IS WHAT A CALLER MAY QUOTE.
 *
 *   · `official`  — legislation.gov.uk's own record (the TNA effects feed and the in-force
 *     dataset). Structured data. ⚠ CARRIES NO QUOTABLE TEXT: its `detail`, where it has one,
 *     is a date, a qualification and a flag. A caller must not present it as a sentence.
 *   · `extracted` — OUR parse of the document's prose. Where it kept words, they are the
 *     words that produced the edge, and they are ours to show — as ours.
 *
 * A caller that cannot tell them apart will either claim a quotation it does not have, or
 * discard one it does.
 */
export type EdgeOrigin = 'official' | 'extracted'

export const EDGE_SOURCES: Record<string, { origin: EdgeOrigin; what: string }> = {
  'tna-bulk-amendments': {
    origin: 'official',
    what: 'legislation.gov.uk’s own record of effects (the bulk changes feed)',
  },
  'tna-inforce-dataset': {
    origin: 'official',
    what: 'legislation.gov.uk’s own in-force dataset',
  },
  'clml-si-preamble': {
    origin: 'extracted',
    what: 'our own reading of the enacting words in an instrument’s preamble',
  },
  'clml-body-citation': {
    origin: 'extracted',
    what: 'our own reading of a citation marked up in the body of a document',
  },
}

/**
 * The origin of a stored `source`, or null.
 * ⚠ NULL, NOT A DEFAULT. A fifth source arrives as a COUNTED UNKNOWN, never as whichever
 * origin an else-branch happened to name — the same rule as `detectionOf`.
 */
export function originOf(source: string): EdgeOrigin | null {
  const e = Object.prototype.hasOwnProperty.call(EDGE_SOURCES, source) ? EDGE_SOURCES[source] : undefined
  return e ? e.origin : null
}
