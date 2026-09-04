// ─────────────────────────────────────────────────────────────────────────────
// SURFACE 3 §4 — DONATIONS AS A GRADED, USER-CHECKABLE SIGNAL.
//
// ══ THE HARD LINE, AND IT IS ENFORCED BY A TYPE ══════════════════════════════
//
// §4: *"A party-level alignment CAN NEVER support a claim about a specific
// proposal. Trade unions donate to Labour and campaign against particular
// Labour policies; corporate donors frequently give for access rather than
// agreement. 'Likely sympathetic to this party's general direction' is
// defensible. 'Supports your bill' is not, and is the sentence that would be
// quoted back at Charlie."*
//
// ⚠⚠ AND: *"it must be enforced in code rather than in wording."*
//
// So the alignment this module produces is a `PartyAlignment`, and a
// `PartyAlignment` HAS NO DIRECTION FIELD AND NO TARGET FIELD. There is nothing
// on it a caller could hand to `aggregate()`, nothing to point at a division,
// and nothing that composes into a stance on a proposal. `directionForTarget()`
// exists and returns 0 for every input, with the reason attached, so that a
// caller who goes looking for a direction finds a refusal rather than a gap.
//
// A wording rule would have been a comment. This is a shape: the wrong sentence
// cannot be constructed because the value it needs does not exist.
//
// ══ AND THE THIRD TIER IS THE POINT OF THE DESIGN ════════════════════════════
//
// | pattern                       | what may be said                        | confidence |
// |-------------------------------|------------------------------------------|------------|
// | sole-party donor, over years  | likely sympathetic to that party's       | moderate   |
// |                               | general direction                        |            |
// | single one-off donation       | the same, weakly                         | low        |
// | donations to MORE THAN ONE    | ⚠⚠ NO DIRECTION AT ALL — and say so      | none       |
// | party                         | explicitly. A fact about seeking access, |            |
// |                               | not about belief.                        |            |
//
// ⚠ The third row is not "we are unsure". It is a POSITIVE FINDING about the
// donor, and it is stated as one: giving to opposing parties is evidence about
// access-seeking. Rendering it as an absence would throw away the most
// informative pattern in the register.
// ─────────────────────────────────────────────────────────────────────────────

import { getNeonPool } from '@/lib/pg-pool'
import { configVersion } from './position-config'

export type AlignmentTier = 'sustained-single-party' | 'one-off-single-party' | 'multi-party'

/** [0,1] never a stance; how much weight the PATTERN carries, not which way it points. */
export type AlignmentConfidence = 'moderate' | 'low' | 'none'

/**
 * One donation, as a fact. ⚠ Everything here is published by the Electoral Commission and is
 * quotable verbatim; there is no inference in this shape.
 */
export interface DonationFact {
  ecRef: string
  donorName: string
  /** The party or regulated donee that received it, exactly as published. */
  recipient: string
  recipientType: string
  /** Pence, as published. Rendered by the caller; never rounded here. */
  valuePence: number | null
  acceptedDate: string
  sourceUrl: string | null
}

/**
 * ⚠⚠ THE ALIGNMENT. READ THE FIELD LIST: there is no `direction`, no `stanceScore`, no
 * `targetId` and no `targetType`. That is not an omission.
 *
 * A caller holding one of these cannot say "supports this bill", because nothing on it refers to
 * a bill. It can say which parties were given to, over what period, and — separately, labelled —
 * what that pattern is worth as a prior. See the file header.
 */
export interface PartyAlignment {
  donorEntityId: string | null
  donorName: string
  /** ⚠ NON-EMPTY BY CONSTRUCTION. Same rule as a position: no claim without its evidence. */
  facts: [DonationFact, ...DonationFact[]]
  /** Distinct recipients, as published. The FACT the tier is derived from. */
  parties: string[]
  firstDonation: string
  lastDonation: string
  /** Calendar years the donations span. */
  yearsSpanned: number
  tier: AlignmentTier
  confidence: AlignmentConfidence
  /**
   * ⚠ THE ONLY SENTENCE THAT MAY BE PRINTED AS OUR READING, and it is composed here rather than
   * at the render site. A free adjective at the render site is how "expected to be sympathetic
   * to" becomes "supports".
   */
  inference: string
  /** ⚠ The fact, in words, to be printed ABOVE the inference. Never below it. */
  statement: string
  configVersion: string
}

/**
 * ⚠⚠ THE GUARD, CALLABLE, SO IT CAN BE ASSERTED.
 *
 * §4: *"Assert it: a donation-derived signal cannot contribute direction to a position on a
 * specific target. Construct the case and watch the check fail without the guard."*
 *
 * It always returns zero, and it returns the REASON with it, so a caller that logs its inputs
 * records why it got nothing. There is deliberately no parameter that could change the answer.
 */
export function directionForTarget(_alignment: PartyAlignment, _targetKey: string): {
  direction: 0
  refused: true
  reason: string
} {
  return {
    direction: 0,
    refused: true,
    reason: 'A donation is a funding path, not a position. A party-level alignment cannot support '
      + 'a claim about a specific proposal: trade unions donate to Labour and campaign against '
      + 'particular Labour policies, and corporate donors frequently give for access rather than '
      + 'agreement. This function exists so that asking for a direction returns a refusal rather '
      + 'than a silence.',
  }
}

/** How many calendar years a set of dates spans, inclusive. */
function yearsOf(dates: string[]): number {
  const years = dates.map((d) => Number(d.slice(0, 4))).filter(Number.isFinite)
  if (!years.length) return 0
  return Math.max(...years) - Math.min(...years) + 1
}

/**
 * The tier, from the pattern alone.
 *
 * ⚠ EXPORTED AND PURE, so the check can construct the three cases directly rather than through a
 * live query whose contents move.
 */
export function tierFor(parties: string[], dates: string[]): {
  tier: AlignmentTier
  confidence: AlignmentConfidence
} {
  const distinct = new Set(parties.filter(Boolean))
  // ⚠⚠ MULTI-PARTY IS TESTED FIRST AND IT IS ABSORBING. A donor who gave to two parties over ten
  // years is NOT a sustained single-party donor with a footnote; the sustained pattern does not
  // survive the second party, and testing volume first is how it would.
  if (distinct.size > 1) return { tier: 'multi-party', confidence: 'none' }
  if (dates.length > 1 && yearsOf(dates) >= 2) {
    return { tier: 'sustained-single-party', confidence: 'moderate' }
  }
  return { tier: 'one-off-single-party', confidence: 'low' }
}

/**
 * What may be said, per tier. ⚠ The vocabulary is fixed here, like `stanceWording`, so two screens
 * cannot invent two different adjectives for the same pattern.
 *
 * ⚠⚠ NOT ONE OF THESE SENTENCES NAMES A PROPOSAL, A BILL OR A DIVISION, and none of them can:
 * the function is not given one. `check-surface-3-donations.ts` asserts that no wording here
 * contains a second-person possessive ("your bill", "this proposal") and watches that fire.
 */
export function inferenceFor(tier: AlignmentTier, party: string, years: number): string {
  switch (tier) {
    case 'sustained-single-party':
      return `Our reading: a donor who has given only to ${party}, over ${years} calendar years, `
        + `is likely to be sympathetic to that party's general direction. That is a prior about a `
        + `party, not a view about any particular measure.`
    case 'one-off-single-party':
      return `Our reading: a single recorded donation, to ${party} and to no other party, weakly `
        + `suggests sympathy with that party's general direction. One donation is thin evidence `
        + `and this should be read as barely more than the fact itself.`
    case 'multi-party':
      // ⚠⚠ THE SENTENCE THE WHOLE DESIGN EXISTS FOR. It is a finding, not a hedge.
      return `Our reading: NO DIRECTION AT ALL. This donor has given to more than one party, `
        + `which tells us something about seeking access and nothing about belief. We will not `
        + `infer sympathy in either direction from this record.`
  }
}

/** The fact, in words, composed from published fields only. */
export function statementFor(facts: DonationFact[], parties: string[]): string {
  const total = facts.reduce((n, f) => n + (f.valuePence ?? 0), 0)
  const money = total > 0 ? `£${(total / 100).toLocaleString('en-GB', { maximumFractionDigits: 0 })}` : 'an undisclosed sum'
  const dates = facts.map((f) => f.acceptedDate).sort()
  const span = dates.length > 1 ? `between ${dates[0]} and ${dates[dates.length - 1]}` : `on ${dates[0]}`
  const to = parties.length === 1
    ? `to ${parties[0]}, and to no other party`
    : `to ${parties.length} different parties (${parties.join(', ')})`
  return `Donated ${money} ${to}, ${span}, across `
    + `${facts.length} recorded donation${facts.length === 1 ? '' : 's'}.`
}

/**
 * Every party donation a resolved organisation made, as one graded alignment.
 *
 * ⚠ RETURNS NULL WHERE THERE IS NO RECORD. Absence is the caller's to render, and an alignment
 * with no facts cannot be constructed — `facts` is a non-empty tuple.
 */
export async function alignmentForDonor(donorEntityId: string): Promise<PartyAlignment | null> {
  const pool = getNeonPool()
  const { rows } = await pool.query<{
    ec_ref: string; donor_name: string | null; recipient: string; recipient_type: string
    value_pence: string | null; accepted_date: string | null; source_url: string | null
  }>(`
    SELECT ec_ref, donor_name, regulated_entity_name AS recipient,
           regulated_entity_type AS recipient_type, value_pence::text,
           accepted_date::text, source_url
      FROM position_donation
     WHERE donor_entity_id = $1::bigint
       AND regulated_entity_type = 'Political Party'
       AND accepted_date IS NOT NULL
     ORDER BY accepted_date DESC`, [donorEntityId])
  if (!rows.length) return null

  const facts: DonationFact[] = rows.map((r) => ({
    ecRef: r.ec_ref,
    donorName: r.donor_name ?? '',
    recipient: r.recipient,
    recipientType: r.recipient_type,
    valuePence: r.value_pence === null ? null : Number(r.value_pence),
    acceptedDate: r.accepted_date!,
    sourceUrl: r.source_url,
  }))
  const parties = [...new Set(facts.map((f) => f.recipient))]
  const dates = facts.map((f) => f.acceptedDate)
  const { tier, confidence } = tierFor(facts.map((f) => f.recipient), dates)

  const { rows: [ent] } = await pool.query<{ canonical_name: string }>(
    `SELECT canonical_name FROM graph_entity WHERE id = $1::bigint`, [donorEntityId])

  return {
    donorEntityId,
    donorName: ent?.canonical_name ?? facts[0].donorName,
    facts: [facts[0], ...facts.slice(1)],
    parties,
    firstDonation: dates[dates.length - 1],
    lastDonation: dates[0],
    yearsSpanned: yearsOf(dates),
    tier,
    confidence,
    inference: inferenceFor(tier, parties[0] ?? 'that party', yearsOf(dates)),
    statement: statementFor(facts, parties),
    configVersion: configVersion(),
  }
}

/**
 * A donor worth showing, chosen by having a record rather than by being convenient.
 *
 * ⚠ IT PREFERS A MULTI-PARTY DONOR WHERE ONE EXISTS. That is the tier the design turns on and the
 * one a user's judgement is most valuable about — and if we only ever showed the flattering
 * single-party case, the measurement would never test the rule that matters.
 */
export async function pickDonorToReview(): Promise<string | null> {
  const pool = getNeonPool()
  const { rows } = await pool.query<{ donor_entity_id: string }>(`
    SELECT donor_entity_id::text, COUNT(DISTINCT regulated_entity_name)::int parties
      FROM position_donation
     WHERE donor_entity_id IS NOT NULL
       AND regulated_entity_type = 'Political Party'
       AND accepted_date IS NOT NULL
     GROUP BY 1
     ORDER BY parties DESC, COUNT(*) DESC
     LIMIT 1`)
  return rows[0]?.donor_entity_id ?? null
}
