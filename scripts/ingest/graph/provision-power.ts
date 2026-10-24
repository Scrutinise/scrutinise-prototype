/**
 * provision-power.ts — GRAPH 9 §2: does a PROVISION confer a power to make subordinate legislation?
 *
 * Decision 271 reads the INSTRUMENT's enacting words ("in exercise of the powers conferred by…"). This reads the
 * other end: the provision named. The two are independent, so agreement is evidence and disagreement is a flag.
 *
 * Two instruments here, both read from the same CLML (best-collection-xml.zip):
 *
 *   1. THE PUBLISHER'S FLAG. legislation.gov.uk marks a provision `ConfersPower="true"` on its `<P1group>` or `<P1>`
 *      (found 24 Oct 2026: CRaG 2010 carries six — ss.45, 46, 51, 52, Sch 6 paras 21 and 44 — and s.20 none). It is
 *      the publisher's own determination, not ours. ⚠ Absence is only evidence of "no" where the publisher has marked
 *      the DOCUMENT at all; a document with no flag anywhere has simply not been marked (`documentMarked`).
 *   2. THE TEXT RULE. `POWER_FAMILIES`: phrase families that confer a power ("may by regulations", "power to make
 *      an order", …). ⚠ The list is a CANDIDATE list; which families are used is decided by
 *      audit-g9-confers-power.ts against the publisher's flag (train half), and scored on the other half. The chosen
 *      families are `TEXT_RULE_FAMILIES`, written from that audit's JSON, never by hand.
 *
 * Pure: no database, no zip. The audit and the extractor import it.
 */

export interface Provision {
  /** The CLML id: section-20, article-3, regulation-12, schedule-6-paragraph-44. */
  ref: string
  /** `ConfersPower="true"` on the P1 or on the P1group around it. */
  flagged: boolean
  /** Plain text of the provision, heading included. */
  text: string
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
export function plain(x: string): string {
  return x
    .replace(/<(Commentary|Footnote)Ref\b[^>]*\/>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, e) => ENTITIES[e])
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/\s+/g, ' ')
    .trim()
}
const flat = (s: string) => Buffer.from(s, 'utf8').toString('utf8')

/** A top-level provision id — what an enabling row names. Sub-levels (section-20-1) are P2s, never P1 ids. */
const TOP_REF = /^(?:section|article|regulation|rule|paragraph|schedule-[0-9A-Za-z]+-paragraph)-[0-9A-Za-z]+$/

/** Every top-level provision in a CLML document, with the publisher's flag and its text. */
export function provisionsOf(xml: string): { provisions: Provision[]; documentMarked: boolean } {
  const out: Provision[] = []
  const documentMarked = /\sConfersPower="true"/.test(xml)
  for (const m of xml.matchAll(/<P1\b[^>]*\sid="([^"]+)"[^>]*>/g)) {
    const ref = m[1]
    if (!TOP_REF.test(ref)) continue
    const start = m.index!
    const end = xml.indexOf('</P1>', start)
    if (end < 0) continue
    // The P1group around it, if any: the nearest group opened before this P1 and not closed since.
    const g = xml.lastIndexOf('<P1group', start)
    const gClosed = g >= 0 ? xml.indexOf('</P1group>', g) : -1
    const inGroup = g >= 0 && (gClosed < 0 || gClosed > start)
    const groupTag = inGroup ? xml.slice(g, xml.indexOf('>', g) + 1) : ''
    const flagged = /\sConfersPower="true"/.test(m[0]) || /\sConfersPower="true"/.test(groupTag)
    // ⚠ Text INSERTED INTO ANOTHER ENACTMENT is not this provision's power. "In the 1997 Order, after Article 5 insert —
    // … the Department may by regulations …" confers the power in the 1997 Order; an SI made under it cites the 1997
    // Order. Measured: the commonest false positive of the first candidate run (audit-g9-confers-power.json, first run).
    const text = plain(xml.slice(inGroup ? g : start, end).replace(/<BlockAmendment\b[\s\S]*?<\/BlockAmendment>/g, ' [inserted text] '))
    out.push({ ref: flat(ref), flagged, text: flat(text) })
  }
  return { provisions: out, documentMarked }
}

/**
 * CANDIDATE phrase families, before any measurement. Written to be broad; the audit keeps only those the publisher's
 * flag supports. Each is tested on lower-cased plain text.
 */
export const POWER_FAMILIES: Readonly<Record<string, RegExp>> = {
  // "regulations" is always legislation; "order" is often a COURT's, so the order families are kept apart and
  // must earn their place on the data like every other.
  by_regulations: /\b(?:may|must|shall),? (?:\w+ ){0,2}by regulations\b/,
  by_order_in_council: /\border in council\b/,
  by_statutory_instrument: /\b(?:by|made by|exercisable by|contained in) (?:a )?statutory instrument\b/,
  by_order_minister: /\b(?:secretary of state|ministers?|treasury|lord chancellor|department|majesty|commissioners|lord advocate|first minister)\b[^.;]{0,80}?\b(?:may|must|shall),? (?:\w+ ){0,2}by order\b/,
  by_order_any: /\b(?:may|must|shall),? (?:\w+ ){0,2}by order\b/,
  by_rules: /\b(?:may|must|shall),? (?:\w+ ){0,2}by rules\b/,
  by_scheme_or_byelaws: /\b(?:may|must|shall),? (?:\w+ ){0,2}by (?:scheme|byelaws?)\b/,
  make_regulations: /\b(?:may|must|shall) make (?:regulations|rules|an order in council|byelaws)\b/,
  make_order: /\b(?:may|must|shall) make (?:an order|orders)\b/,
  regulations_may: /\bregulations (?:(?:made )?under [^.;]{0,60} )?(?:may|must|shall)\b/,
  in_regulations: /\b(?:specified|prescribed|made|provided|set out|determined) (?:by [^.;]{0,40} )?in regulations\b/,
  power_to_make: /\bpower to make (?:regulations|rules|orders?|an order|byelaws|subordinate legislation)\b/,
  appointed_day: /\bappoint(?:ed)? by (?:order|regulations)\b|\bday (?:appointed|specified) by (?:order|regulations)\b/,
  prescribed: /\bprescribed\b/,
  may_direct: /\bmay (?:give|issue) (?:directions|guidance)\b/,
  may_by_notice: /\bmay,? by notice\b/,
}

/**
 * The families that would make the text rule a DETERMINATION. ⚠ Written from audit-g9-confers-power.json's `selected`
 * list (precision against the flag ≥ 0.8 on the train half, with support), not chosen by eye — and it is EMPTY: on
 * 24 Oct 2026 no family reached the floor (best: by_regulations 0.76). So the text rule is not a determination
 * anywhere, and `provisionPowerState` labels every state it returns low confidence.
 */
export const TEXT_RULE_FAMILIES: readonly string[] = []

/**
 * The families counted as the text SAYING power, for the low-confidence state: every candidate at ≥ 0.6 precision
 * against the flag on the train half (audit-g9-confers-power.json `per_family`). Not a determination — see above.
 */
export const TEXT_EVIDENCE_FAMILIES: readonly string[] = [
  'by_regulations', 'by_statutory_instrument', 'by_order_minister', 'by_order_any', 'make_regulations', 'regulations_may',
  'power_to_make', 'appointed_day',
]

/**
 * ⚠ THE BULK FILE HOLDS THE CURRENT TEXT. A provision repealed since an SI was made under it reads "23 . . . . . ." —
 * and that is most of the SI-confirmed powers whose text is silent (audit-g9-confers-power.json, samples). Reading
 * today's words cannot say what the power was when the instrument was made, so a repealed provision is `unknown`.
 */
export function repealedText(text: string): boolean {
  const dots = (text.match(/(?:\.\s){8,}/g) ?? []).join('').length
  const letters = text.replace(/(?:\.\s){8,}/g, '').replace(/[^A-Za-z]/g, '').length
  return dots > 0 && letters < 120
}

/** The families that match a provision's text (all candidates, for the audit). */
export function familiesIn(text: string): string[] {
  const t = text.toLowerCase()
  return Object.entries(POWER_FAMILIES).filter(([, rx]) => rx.test(t)).map(([k]) => k)
}

/**
 * ⚠ THREE STATES, NEVER TWO (§2.3) — and ALL LOW CONFIDENCE, because neither instrument was calibrated to the floor
 * (TEXT_RULE_FAMILIES is empty; the flag agrees with SI-confirmed powers 71.2% of the time). Of one provision:
 *   power    the publisher flags it, or the text says power (TEXT_EVIDENCE_FAMILIES) — positive evidence from either
 *   none     the publisher MARKED this document and did not flag this provision, AND no candidate family at all
 *            fires on its text, AND the text is not repealed — both instruments silent where both could have spoken
 *   unknown  we hold no text; the text is repealed; the document is unmarked and the text silent; or only a weak family fires
 * Absence of data is never absence of power: an unmarked document with silent text is `unknown`, not `none`.
 *
 * ⚠ HOW IT IS USED (onward.ts): it can only WITHHOLD a made-under verdict — an instrument whose words name this as the
 * power exercised, on a provision that is `none`, is shown as unresolved for a human. It never makes a row a power.
 */
export type ProvisionPowerState = 'power' | 'none' | 'unknown'
export const PROVISION_POWER_STATES: readonly ProvisionPowerState[] = ['power', 'none', 'unknown']
export type PowerBasis =
  | 'flag-and-text' | 'flag-only' | 'text-only' | 'no-flag-no-text'
  | 'repealed-text' | 'unmarked-and-silent' | 'weak-text-only' | 'not-held'
export const POWER_BASES: readonly PowerBasis[] = [
  'flag-and-text', 'flag-only', 'text-only', 'no-flag-no-text', 'repealed-text', 'unmarked-and-silent', 'weak-text-only', 'not-held',
]
export function provisionPowerState(p: { flagged: boolean; text: string; documentMarked: boolean } | null): { state: ProvisionPowerState; basis: PowerBasis; words: string | null } {
  if (!p) return { state: 'unknown', basis: 'not-held', words: null }
  if (repealedText(p.text)) return { state: 'unknown', basis: 'repealed-text', words: null }
  const fams = familiesIn(p.text)
  const t = p.text.toLowerCase()
  const strong = TEXT_EVIDENCE_FAMILIES.filter((f) => fams.includes(f))
  const words = strong.length ? t.match(POWER_FAMILIES[strong[0]])![0] : null
  if (p.flagged && strong.length) return { state: 'power', basis: 'flag-and-text', words }
  if (p.flagged) return { state: 'power', basis: 'flag-only', words: null }
  if (strong.length) return { state: 'power', basis: 'text-only', words }
  if (p.documentMarked && !fams.length) return { state: 'none', basis: 'no-flag-no-text', words: null }
  return { state: 'unknown', basis: fams.length ? 'weak-text-only' : 'unmarked-and-silent', words: null }
}
