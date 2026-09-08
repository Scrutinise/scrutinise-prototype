/**
 * treatment-patterns.ts — BRIEF_GRAPH_5 §3.1. HOW COURTS HAVE TREATED IT.
 *
 * ── WHY PATTERNS, AND NOT SIMILARITY ─────────────────────────────────────────
 *
 * ARGUMENT 1A tested finding a rhetorical move by similarity to hand-picked examples and scored
 * **0 of 20** on held-out passages, against **90%** for literal phrase patterns. The control that
 * decides what that zero means was run: all 19 held-out passages came back at RANK 1 when probed
 * with their own words, so they ARE in the dense index and propagation simply never reaches them.
 *
 * ⚠⚠ **AND THE REASON APPLIES WITH EXTRA FORCE HERE. Judicial treatment turns entirely on
 * polarity, and polarity is what meaning-based matching is worst at.** *"We decline to follow"* and
 * *"we follow"* sit almost on top of each other in meaning-space and mean opposite things. A
 * cosine-similarity citator would report a case as followed when the court refused to follow it —
 * a wrong answer of the exact kind §0 exists to prevent.
 *
 * Judicial treatment language is formulaic, which is precisely the condition patterns need.
 *
 * ── THE POLARITY TRAP IS STRUCTURAL HERE, NOT A COMMENT ──────────────────────
 *
 * ⚠⚠ A naive /follow/ matches "we follow", "we decline to follow" and "should not be followed"
 * alike. So:
 *   1. Patterns are tested in `PRECEDENCE` order and **the negative-polarity treatments run
 *      FIRST**. `not-followed` claims the span of "decline to follow" before `followed` is ever
 *      offered it.
 *   2. Every match is then passed through `negated()`, which rejects it when the words immediately
 *      before it reverse its sense — "we do not doubt", "it is not distinguishable", "I would not
 *      overrule". A negation is not the opposite treatment; it is NO treatment, and the citation
 *      goes out unclassified.
 *
 * ── DIRECTION, WHICH IS A SECOND TRAP AND A WORSE ONE ────────────────────────
 *
 * ⚠⚠ "*We decline to follow Smith*" and "*Smith was overruled in Jones*" put the subject on
 * OPPOSITE SIDES of the phrase. Take the nearest citation in both cases and half your rows name
 * the wrong case — and in the second example you would record JONES as overruled when Jones is the
 * case that did the overruling. That is a published legal conclusion about the wrong authority.
 * So every pattern declares `direction`, and where the subject is not on the declared side the
 * match is REFUSED and counted, never satisfied from the other side.
 *
 * ── WHAT IS DELIBERATELY NOT HERE ────────────────────────────────────────────
 *
 * ⚠ **"Considered" and "mentioned" are not treatments.** §3.2 is explicit, and the pull to classify
 * everything is exactly what produces a citator returning a hundred references where two matter.
 * **An unclassified citation is an honest result and most citations are exactly that.**
 */

export type Treatment =
  | 'followed' | 'applied' | 'distinguished' | 'doubted' | 'not-followed'
  | 'overruled' | 'disapproved' | 'read-down' | 'per-incuriam'

/** Which side of the phrase the subject sits on. */
export type Direction = 'after' | 'before'

export type Pattern = {
  id: string
  treatment: Treatment
  rx: RegExp
  /**
   * 'after'  — the phrase governs what follows it: "we decline to follow X".
   * 'before' — the phrase is predicated of what precedes it: "X was overruled".
   */
  direction: Direction
  /** why this phrase is in the list, and what it must not catch */
  note: string
}

/**
 * ⚠⚠ ORDER IS LOAD-BEARING. Negative polarity first. A pattern earlier in this list claims its
 * characters and no later pattern is offered them.
 */
export const PATTERNS: Pattern[] = [
  // ── negative polarity, FIRST ───────────────────────────────────────────────
  {
    id: 'not-followed.decline', treatment: 'not-followed', direction: 'after',
    rx: /\b(?:decline[sd]?|declining|refus(?:e[sd]?|ing))\s+to\s+follow\b/gi,
    note: 'MUST claim this span before `followed.we` is offered it — the single most important ordering in this file',
  },
  {
    id: 'not-followed.should-not', treatment: 'not-followed', direction: 'before',
    rx: /\b(?:should|ought|must|can|will|shall)\s+not\s+(?:now\s+)?be\s+followed\b/gi,
    note: '"…is a decision that should not be followed" — the subject PRECEDES',
  },
  {
    id: 'not-followed.do-not', treatment: 'not-followed', direction: 'after',
    rx: /\b(?:we|I|the\s+court)\s+(?:do|does|did)\s+not\s+follow\b/gi,
    note: 'explicit refusal in the first person',
  },
  {
    id: 'overruled.passive', treatment: 'overruled', direction: 'before',
    rx: /\b(?:is|are|was|were|has\s+been|have\s+been|must\s+be|should\s+be|stands?)\s+(?:now\s+|expressly\s+|accordingly\s+)?overruled\b/gi,
    note: '⚠ "X was overruled in Y" — the subject is X, which PRECEDES. Taking the nearest citation would record Y.',
  },
  {
    id: 'overruled.active', treatment: 'overruled', direction: 'after',
    rx: /\b(?:we|I|the\s+court)\s+(?:would\s+|hereby\s+|accordingly\s+|therefore\s+)?overrule\b/gi,
    note: 'the court doing the overruling itself',
  },
  {
    id: 'disapproved', treatment: 'disapproved', direction: 'before',
    rx: /\b(?:is|are|was|were|has\s+been|have\s+been|must\s+be|should\s+be)\s+(?:expressly\s+)?disapproved\b|\b(?:we|I)\s+disapprove\s+(?:of\s+)?/gi,
    note: 'disapproval short of overruling — a different fact and kept as one',
  },
  {
    id: 'doubted', treatment: 'doubted', direction: 'before',
    // ⚠⚠ TIGHTENED AFTER READING THE REFUSALS. The first version admitted the bare NOUN "doubt"
    // via `(?:is|are)\s+doubt\b`, and courts write that constantly about FACTS, not authorities:
    // "There is doubt as to when the claimant applied for transfer", "where there is doubt about
    // the underlying facts", "I have doubts as to the existence of his common-law wife". Three of
    // the first four sampled refusals were this pattern mis-firing — caught only because no
    // citation happened to sit on the declared side. **A false positive that survives only by
    // luck of adjacency is a false positive.** So: the participle, or doubt expressly directed at
    // an authority's correctness.
    rx: /\b(?:is|are|was|were|must\s+be|may\s+be|has\s+been|have\s+been)\s+(?:seriously\s+|gravely\s+)?doubted\b|\b(?:we|I)\s+(?:respectfully\s+|with\s+respect,?\s+)?doubt\s+(?:the\s+correctness|the\s+authority|whether\s+that\s+(?:case|decision|approach))\b|\b(?:we|I)\s+(?:have\s+)?doubts?\s+(?:about|as\s+to)\s+(?:the\s+)?(?:correctness|authority|soundness|status)\b|\bmust\s+(?:now\s+)?be\s+(?:regarded\s+as\s+)?open\s+to\s+(?:serious\s+)?doubt\b/gi,
    note: '⚠ `negated()` must still reject "we do not doubt"; the noun form is deliberately excluded',
  },
  {
    id: 'per-incuriam', treatment: 'per-incuriam', direction: 'before',
    rx: /\bper\s+incuriam\b/gi,
    note: 'a term of art with no polarity ambiguity; the subject is the decision so described',
  },
  // ── distinguishing ─────────────────────────────────────────────────────────
  {
    id: 'distinguished.passive', treatment: 'distinguished', direction: 'before',
    rx: /\b(?:is|are|was|were|can\s+be|must\s+be|should\s+be|falls?\s+to\s+be)\s+distinguish(?:ed|able)\b/gi,
    note: '⚠ `negated()` must reject "is not distinguishable", which asserts the case DOES apply',
  },
  {
    id: 'distinguished.active', treatment: 'distinguished', direction: 'after',
    rx: /\b(?:we|I|the\s+court)\s+(?:would\s+|therefore\s+|accordingly\s+)?distinguish\b/gi,
    note: 'the court distinguishing it itself',
  },
  // ── positive polarity, LAST, so the negatives have already claimed their spans ──
  {
    id: 'followed.we', treatment: 'followed', direction: 'after',
    // ⚠ The modal forms are admitted ("this court should follow", "we must follow") because courts
    // write them constantly — the check caught their absence. The negative twin cannot slip in:
    // "should NOT be followed" is `not-followed.should-not` and runs first, and "should not follow"
    // does not match here at all because `not` is not one of the permitted adverbs. `negated()` is
    // the second line, not the first.
    rx: /\b(?:we|I|(?:this|the)\s+court)\s+(?:should\s+|must\s+|shall\s+|ought\s+to\s+|would\s+|therefore\s+|accordingly\s+|respectfully\s+){0,2}follow\b/gi,
    note: '⚠⚠ only ever reached for text `not-followed.decline` did not already claim',
  },
  {
    id: 'followed.bound', treatment: 'followed', direction: 'after',
    rx: /\b(?:we|I)\s+(?:am|are)\s+bound\s+(?:by|to\s+follow)\b/gi,
    note: 'being bound is following, and courts say it this way constantly',
  },
  {
    id: 'applied.applying', treatment: 'applied', direction: 'after',
    // ⚠⚠ THE QUALIFIER IS MANDATORY. The first version made the whole
    // `(?:the (?:principles?|test|…) (?:in|of|…) )?` group OPTIONAL, so it reduced to
    // `\bapplying\s+` and fired on "applying for permission", "applying the statutory formula",
    // "applying that reasoning to the facts" — 8 of the first 14 pilot rows were this pattern
    // matching prose with no treatment in it. **A pattern whose narrowing clause is optional is
    // not narrowed**, and the comment claiming it was narrow made it harder to see, not easier.
    rx: /\bapplying\s+(?:the\s+)?(?:principles?|test|approach|reasoning|ratio|dictum|dicta|guidance|analysis)\s+(?:in|of|from|laid\s+down\s+in|set\s+out\s+in|adopted\s+in)\s+/gi,
    note: 'narrow BY CONSTRUCTION: "applying" alone is overwhelmingly a non-treatment sense',
  },
  {
    id: 'applied.passive', treatment: 'applied', direction: 'before',
    // ⚠ "must be applied" is very often a statement about how a PRINCIPLE operates rather than a
    // treatment of the authority that stated it — the pilot attributed Lord Reid's own words
    // ("all estoppels … must be applied so as to work justice") to the case being quoted.
    // Requiring an explicit anaphor keeps it to sentences that point at a named authority.
    rx: /\b(?:that\s+(?:case|decision|authority|approach|test|principle)|it)\s+(?:is|was|must\s+be|should\s+be|falls?\s+to\s+be)\s+applied\b/gi,
    note: '⚠ the subject PRECEDES; the anaphor is required because a bare "must be applied" is usually not a treatment at all',
  },
  // ── the Human Rights Act s.3 move, which is about a PROVISION, not a case ──
  {
    id: 'read-down', treatment: 'read-down', direction: 'before',
    rx: /\b(?:read\s+down|read(?:ing)?\s+(?:it\s+)?in\s+conformity|read\s+and\s+given\s+effect)\b/gi,
    note: '⚠ a treatment of a PROVISION. `subject_type` will be provision, and the check asserts it.',
  },
]

/**
 * ⚠⚠ NEGATION. A phrase whose sense is reversed by the words in front of it is NOT the opposite
 * treatment — it is NO treatment, and the citation goes out unclassified.
 *
 * "we do not doubt the correctness of X"     — X is not doubted
 * "this case is not distinguishable"          — the case APPLIES; recording 'distinguished' inverts it
 * "I would not overrule"                      — nothing is overruled
 * "there is no doubt that"                    — an intensifier, not a doubt
 */
const NEGATORS = /\b(?:not|never|no|nor|neither|cannot|can't|don't|doesn't|didn't|hardly|without)\b/i
/** How far back a negator can reach. Beyond this it belongs to a different clause. */
const NEGATION_WINDOW = 34

export function negated(text: string, matchIndex: number): boolean {
  const before = text.slice(Math.max(0, matchIndex - NEGATION_WINDOW), matchIndex)
  // ⚠ a negator on the FAR side of a clause boundary does not govern this phrase
  const clause = before.split(/[;:,]|\b(?:but|although|though|whereas|because|since)\b/i).pop() ?? before
  return NEGATORS.test(clause)
}

export type Hit = {
  patternId: string
  treatment: Treatment
  direction: Direction
  /** the literal characters the pattern fired on — stored on every edge */
  phrase: string
  index: number
  length: number
}

/**
 * Every treatment phrase in `text`, with overlapping matches resolved by PRECEDENCE
 * (earlier pattern wins the characters) and negated matches dropped.
 */
export function findTreatments(text: string): Hit[] {
  const claimed: Array<[number, number]> = []
  const hits: Hit[] = []
  const overlaps = (a: number, b: number) => claimed.some(([s, e]) => a < e && b > s)

  for (const p of PATTERNS) {
    p.rx.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = p.rx.exec(text)) !== null) {
      if (m[0].length === 0) { p.rx.lastIndex++; continue }
      const start = m.index, end = m.index + m[0].length
      // ⚠ PRECEDENCE: a later pattern is never offered characters an earlier one took.
      if (overlaps(start, end)) continue
      if (negated(text, start)) { claimed.push([start, end]); continue }
      claimed.push([start, end])
      hits.push({ patternId: p.id, treatment: p.treatment, direction: p.direction, phrase: m[0], index: start, length: m[0].length })
    }
  }
  return hits.sort((a, b) => a.index - b.index)
}
