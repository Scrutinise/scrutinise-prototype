/**
 * taxonomy.ts — ARGUMENT 1A. THE TEN MOVES, THEIR PROBE QUERIES AND THEIR PHRASE PATTERNS.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE REFRAMING EVERYTHING HERE RESTS ON, FROM THE BRIEF, BECAUSE IT DECIDES EVERY TRADE-OFF
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * **An argument tag is a retrieval FILTER, not a published claim.** It is never shown to a user as
 * a fact. Its only job is to narrow ~13.7 million parliamentary passages to a few dozen worth
 * reading, after which the model writing the answer reads the actual words.
 *
 * ⚠ **So these patterns want high RECALL and may have poor precision.** Over-inclusion costs a
 * little compute; under-inclusion loses the argument entirely. That risk profile is the OPPOSITE
 * of the position graph's, where a wrong estimate was displayed to a user as a claim about a named
 * person. **Do not import the position graph's caution here and cripple recall with it.**
 *
 * ⚠⚠ AND THEREFORE: A PATTERN THAT OVER-FIRES IS NOT A BUG, BUT AN UNCOUNTED ONE IS. Every hit is
 * attributed to the pattern that produced it, and every report prints hits per pattern, so a
 * runaway (`human rights`, which appears in ordinary neutral speech constantly) is visible in the
 * numbers rather than hidden inside a tag total.
 *
 * ── WHAT IS DELIBERATELY NOT HERE ───────────────────────────────────────────────────────────────
 * No polarity handling. *"Nobody will enforce this"* and *"the enforcement regime is working well"*
 * sit close together in meaning-space — same subject, same vocabulary, opposite claim — and
 * similarity WILL return both. The brief is explicit: report the rate, do not chase it. Tuning an
 * embedding for polarity is a known-hard problem and the wrong place to spend this sprint.
 */

export const TAGS = [
  'COST', 'ENFORCEMENT', 'UNINTENDED', 'EVIDENCE_GAP', 'WRONG_VEHICLE',
  'RIGHTS', 'PRECEDENT', 'SCOPE', 'IMPLEMENTATION', 'SUPPORT_EVIDENCE',
] as const
export type Tag = (typeof TAGS)[number]

export const TAG_MOVE: Record<Tag, string> = {
  COST: 'this will cost more than claimed, or the costing is wrong',
  ENFORCEMENT: 'nobody will enforce it / the enforcer lacks capacity',
  UNINTENDED: 'it will produce this specific consequence nobody wants',
  EVIDENCE_GAP: 'the problem is not established, or the data does not show it',
  WRONG_VEHICLE: 'this belongs in guidance, or in secondary legislation, not here',
  RIGHTS: 'it conflicts with a right, a convention, or the rule of law',
  PRECEDENT: 'this was tried before, here is what happened',
  SCOPE: 'it catches things it should not, or misses things it should',
  IMPLEMENTATION: 'it cannot be operated as drafted',
  SUPPORT_EVIDENCE: 'affirmative: here is why it will work, with evidence',
}

/**
 * Deterministic phrase patterns. `pattern:v1`.
 *
 * ⚠ WRITTEN AS THE WORDS A SPEAKER USES TO MAKE THE MOVE, not as words about the topic. The
 * difference decides whether the pattern is a filter or noise: *"enforcement"* is a topic and fires
 * on every mention of a regulator; *"who is going to enforce"* is a MOVE and fires on the argument.
 *
 * ⚠ Anchored loosely on purpose (no word boundaries at the ends of multi-word phrases) so
 * inflections survive. Case-insensitive everywhere.
 */
export const PATTERNS: Record<Tag, RegExp[]> = {
  COST: [
    /who (?:is going to|will) pay for/i,
    /where (?:is|will) the money com/i,
    /cost(?:s)? (?:far )?more than/i,
    /underestimat\w* the cost/i,
    /the impact assessment assumes/i,
    /unfunded (?:burden|mandate|commitment|pressure)/i,
    /burden on (?:business|small business|taxpayers)/i,
    /cost to the taxpayer/i,
    /no money (?:has been )?(?:attached|allocated|provided)/i,
  ],
  ENFORCEMENT: [
    /who (?:is going to|will) enforce/i,
    /how (?:will|is) (?:it|this|that) (?:be )?enforced/i,
    /(?:will|would) (?:not|never) be enforced/i,
    /unenforceable/i,
    /(?:a|remain a|become a) dead letter/i,
    /(?:lack|lacks|without) the (?:resources|capacity|officers|staff) to enforce/i,
    /no (?:officers|inspectors|staff) to (?:inspect|enforce)/i,
    /the duty will sit unused/i,
  ],
  UNINTENDED: [
    /unintended consequence/i,
    /perverse incentive/i,
    /the opposite effect/i,
    /counter-?productive/i,
    /drive (?:it|them|this) (?:underground|offshore)/i,
    /law of unintended/i,
    /a cliff edge/i,
  ],
  EVIDENCE_GAP: [
    /there is (?:simply )?no evidence/i,
    /the evidence (?:does not|doesn't) (?:show|support|bear)/i,
    /where is the evidence/i,
    /no data to support/i,
    /has not been demonstrated/i,
    /the evidence base is (?:thin|weak|absent|non-existent)/i,
    /(?:based on|nothing but) anecdote/i,
  ],
  WRONG_VEHICLE: [
    /belongs? in guidance/i,
    /a matter for guidance/i,
    /should be (?:in|left to) secondary legislation/i,
    /not a matter for (?:primary )?legislation/i,
    /on the face of the bill/i,
    /the wrong vehicle/i,
    /by regulation rather than/i,
    /skeleton bill/i,
    /henry viii/i,
  ],
  RIGHTS: [
    /incompatible with the convention/i,
    /contrary to the rule of law/i,
    /article \d+ of the (?:european )?convention/i,
    /natural justice/i,
    /due process/i,
    /disproportionate interference/i,
    /chilling effect/i,
    /presumption of innocence/i,
  ],
  PRECEDENT: [
    /(?:we|they) tried (?:this|that) before/i,
    /when (?:this|that) was tried/i,
    /the last time (?:we|the government|parliament)/i,
    /the experience of (?:the|other)/i,
    /history (?:shows|teaches)/i,
    /(?:learn|learned|learnt) nothing from/i,
    /the same mistake/i,
  ],
  SCOPE: [
    /(?:too widely|too broadly) drawn/i,
    /drawn (?:too widely|too broadly)/i,
    /(?:catch|catches|sweep|sweeps) (?:up )?(?:people|those|those who|things)/i,
    /the definition is too/i,
    /a loophole/i,
    /(?:does|will) not (?:catch|cover) the/i,
    /disproportionately (?:affect|hit)/i,
  ],
  IMPLEMENTATION: [
    /unworkable/i,
    /cannot be operated/i,
    /impossible to administer/i,
    /how (?:in practice|on earth) (?:will|would|is)/i,
    /(?:will|would) not work in practice/i,
    /practical difficult/i,
    /administratively (?:impossible|burdensome)/i,
  ],
  SUPPORT_EVIDENCE: [
    /the evidence (?:shows|demonstrates|is clear)/i,
    /research (?:shows|demonstrates)/i,
    /has been shown to (?:work|reduce|improve)/i,
    /(?:worked|works) well in/i,
    /the pilot (?:showed|demonstrated)/i,
    /evidence from (?:scotland|wales|other countries|abroad)/i,
  ],
}

/**
 * ⚠ THE CONFOUND, COUNTED SEPARATELY AND NEVER FOLDED IN. Procedural closers concentrate at the
 * end of a speech, which is exactly where §1.1 is looking. If they were allowed to count as
 * argument markers they would manufacture Charlie's peroration effect out of parliamentary
 * etiquette. Measured beside the markers so the reader can see whether they explain anything.
 */
/**
 * ⚠⚠ A SECOND INSTRUMENT, AND IT IS NOT THE SAME MEASUREMENT — added after the first run showed
 * why one was not enough.
 *
 * The ten tags' patterns are deliberately narrow: they name a MOVE, not a topic. Measured over 416
 * stratified speeches they fire **0.058 times per 1,000 words** — roughly once in every seventeen
 * thousand words. That is a fine property for a filter and a useless one for a position experiment:
 * at that base rate a per-fifth count is three or four hits, which is noise wearing a decimal point.
 *
 * So position is measured with a second, deliberately broader set: the constructions with which a
 * speaker ASSERTS rather than narrates. It does not identify which of the ten moves is being made
 * and it is never used to tag anything — it exists to answer "where in a speech does the arguing
 * happen", which is a question about rhetoric rather than taxonomy.
 *
 * ⚠ THE TWO ARE REPORTED SEPARATELY AND NEVER SUMMED. An average of a narrow instrument and a
 * broad one measures neither.
 */
export const STANCE_MARKERS: RegExp[] = [
  /\bthe (?:real |simple |plain )?(?:fact|truth|question|problem|difficulty|danger|reality) is\b/i,
  /\bI (?:do not|don't|cannot|can't) (?:believe|accept|see how|understand how)\b/i,
  /\bit is (?:simply )?(?:wrong|absurd|unacceptable|indefensible|nonsense|not good enough)\b/i,
  /\bsurely\b/i,
  /\bwhy (?:should|would|on earth|is it that)\b/i,
  /\bno(?:body| one) (?:has|will|can|is going to)\b/i,
  /\bunless (?:and until|the government|we)\b/i,
  /\bfar too (?:much|many|little|few|wide|narrow|late)\b/i,
  /\bin (?:my|our) view\b/i,
  /\bI put it to\b/i,
  /\bthe (?:whole|entire) point\b/i,
  /\blet me be (?:clear|blunt|frank)\b/i,
  /\bmakes? no sense\b/i,
  /\bthere is (?:simply )?no\b/i,
  /\bwe (?:were|are) told\b/i,
]

export const PROCEDURAL_CLOSERS: RegExp[] = [
  /I beg to move/i,
  /beg leave to withdraw/i,
  /I commend (?:the|this|these)/i,
  /question (?:be )?put/i,
  /I (?:therefore )?urge (?:the|my|hon)/i,
  /on that basis,? I/i,
  /I look forward to (?:the|hearing)/i,
  /I support the amendment/i,
]

/**
 * Probe queries for the SEED draw. These are sent to the meaning-based index as text and the
 * service embeds them; they are how candidates are found, NOT how anything is labelled.
 *
 * ⚠ Written in a SPEAKER'S voice, not a librarian's, because that is what the passages look like.
 * A query phrased as a category name ("enforcement objections") retrieves documents ABOUT
 * enforcement; a query phrased as the sentence somebody said retrieves the sentence.
 */
export const PROBES: Record<Tag, string[]> = {
  COST: [
    'this will cost far more than the government has admitted and the impact assessment is wrong',
    'where is the money coming from, no funding has been attached to this new duty',
    'the burden on small businesses will be far greater than ministers claim',
  ],
  ENFORCEMENT: [
    'nobody will enforce this, the local authority has no officers to inspect',
    'who is going to enforce it? the regulator has neither the staff nor the powers',
    'this will be a dead letter because there is no enforcement capacity',
  ],
  UNINTENDED: [
    'this will have the opposite effect and drive the activity underground',
    'the perverse incentive it creates will make the problem worse not better',
    'an unintended consequence nobody in this House has thought through',
  ],
  EVIDENCE_GAP: [
    'there is simply no evidence that this problem exists on the scale claimed',
    'where is the evidence? we are legislating on anecdote rather than data',
    'the evidence base for this measure is thin and has not been published',
  ],
  WRONG_VEHICLE: [
    'this belongs in guidance, not on the face of the Bill',
    'these matters should be left to secondary legislation rather than primary',
    'a skeleton bill that leaves everything to regulations made by ministers',
  ],
  RIGHTS: [
    'this is incompatible with the European Convention and interferes disproportionately',
    'it offends against the rule of law and the presumption of innocence',
    'the chilling effect on free expression has not been considered',
  ],
  PRECEDENT: [
    'we tried this before and it failed, and the government has learned nothing',
    'the last time Parliament legislated in this way the result was a disaster',
    'the experience of other countries that have done this is instructive',
  ],
  SCOPE: [
    'the definition is drawn far too widely and will catch people it was never meant to catch',
    'there is a loophole here that will be exploited immediately',
    'it does not cover the very people the Bill is supposed to protect',
  ],
  IMPLEMENTATION: [
    'this is simply unworkable and cannot be operated as drafted',
    'how in practice is a small authority supposed to administer this',
    'the practical difficulties of making this work have been brushed aside',
  ],
  SUPPORT_EVIDENCE: [
    'the evidence shows this works, the pilot reduced the problem substantially',
    'research demonstrates that this approach has been effective elsewhere',
    'it has worked well in Scotland and there is no reason it cannot work here',
  ],
}

/**
 * Literal phrases for the KEYWORD arm of the seed draw. The dense arm finds passages that MEAN the
 * same thing; this one finds passages that SAY it, and the two miss different things — which is the
 * whole reason for running both rather than picking one.
 *
 * ⚠ FTS PROPOSES, THE REGEX DISPOSES. A BM25 hit on these words is a candidate, not a match: the
 * body is fetched and the tag's own pattern re-applied before anything is called a hit. Otherwise
 * "who is going to enforce" would admit every passage containing "enforce".
 */
export const FTS_PHRASES: Record<Tag, string[]> = {
  COST: ['who is going to pay for', 'where is the money coming from', 'cost far more than'],
  ENFORCEMENT: ['who is going to enforce', 'will be a dead letter', 'no officers to inspect'],
  UNINTENDED: ['unintended consequence', 'perverse incentive', 'have the opposite effect'],
  EVIDENCE_GAP: ['there is no evidence', 'where is the evidence', 'the evidence base is thin'],
  WRONG_VEHICLE: ['belongs in guidance', 'on the face of the Bill', 'skeleton bill regulations'],
  RIGHTS: ['incompatible with the convention', 'contrary to the rule of law', 'presumption of innocence'],
  PRECEDENT: ['we tried this before', 'the last time we legislated', 'the experience of other countries'],
  SCOPE: ['drawn too widely', 'a loophole', 'the definition is too wide'],
  IMPLEMENTATION: ['simply unworkable', 'impossible to administer', 'will not work in practice'],
  SUPPORT_EVIDENCE: ['the evidence shows', 'the pilot showed', 'has worked well in'],
}

/** Which corpora count as parliamentary for this sprint. Named, not derived from a tier, so the
 *  population any figure is a proportion of is stated rather than implied. */
export const PARLIAMENTARY_CORPORA = [
  'pwdata-debates', 'pwdata-lords', 'pwdata-westminster',
  'historic-hansard', 'niassembly-hansard', 'scottish-parliament-or',
  'committees-evidence', 'committees-reports',
]

export interface PatternHit { tag: Tag; pattern: string }

/** Every pattern hit in a passage, attributed to its pattern. Never a bare tag list. */
export function patternHits(text: string): PatternHit[] {
  const out: PatternHit[] = []
  for (const tag of TAGS) {
    for (const p of PATTERNS[tag]) if (p.test(text)) out.push({ tag, pattern: String(p) })
  }
  return out
}

export function proceduralHits(text: string): string[] {
  return PROCEDURAL_CLOSERS.filter((p) => p.test(text)).map(String)
}
