/**
 * position-config.ts — every constant the position graph's estimate engine uses, in one place,
 * with the reason each number carries and a `config_version` derived FROM the numbers.
 *
 * GRAPH 3A. Spec: `docs/POSITION_GRAPH_DESIGN.md` §5 (weights, decay, aggregation) and §9
 * ("never survives a tuning change silently").
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY `configVersion()` IS A HASH AND NOT A STRING SOMEBODY REMEMBERS TO BUMP
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * Design §9's last line: *"weights and decay are versioned config, estimates name the version that
 * produced them, and history is reproducible from signals."* A hand-maintained version string makes
 * that true only for as long as everybody remembers, and the failure is silent: estimates rebuilt
 * with new weights carry the old version and a report's numbers can no longer be reproduced.
 *
 * So the version is a hash of the constants themselves. Change any number below and the version
 * changes; change nothing and it does not. `check-3a.ts` proves both directions by mutating a copy.
 *
 * ⚠ EVERY WEIGHT AND HALF-LIFE HERE IS PROVISIONAL UNTIL THE §8 VALIDATION SET MEASURES IT.
 * Design §5 says so in its first line, and nothing in 3A measures them — 3A builds the machine that
 * a later sprint will tune. Numbers taken from the design table are marked `[design §5]`; the two
 * that the design does not state are marked `[NOT IN DESIGN]` and are Charlie's to settle.
 */
import { createHash } from 'crypto'

/** Signal types P0 can produce. Extended by later sprints; the ladder is design §4. */
export type SignalType =
  | 'vote'
  | 'edm_signature'
  | 'amendment_sponsorship'
  | 'committee_membership'
  | 'declared_interest'
  | 'witness_appearance'
  // P1, added by GRAPH 3B §2.2. Direction 0 always — see the weight comment below.
  | 'political_donation'

/**
 * The weight class a vote falls into. This is the *derivation* — the classification — and it is
 * what is stored; the number it maps to is config and may change without re-deriving anything.
 */
export type VoteClass =
  | 'rebellion:v1'
  | 'free-vote-heuristic:v1'
  | 'unwhipped-group:v1'
  | 'whipped-with:v1'
  | 'small-party-unclassified:v1'
  // GRAPH 3C §2. The member's own party did not hold together in this division, so there was no
  // whip for them to be with or against — whichever side they took.
  | 'party-split:v1'

export interface PositionConfig {
  /** `raw_weight` per weight class and signal type. Design §5's table. */
  weights: {
    'rebellion:v1': number
    'free-vote-heuristic:v1': number
    'unwhipped-group:v1': number
    'whipped-with:v1': number
    'small-party-unclassified:v1': number
    'party-split:v1': number
    edm_signature: number
    amendment_sponsorship: number
    witness_appearance: number
    committee_membership: number
    declared_interest: number
    political_donation: number
  }
  /** Half-life in YEARS per signal type. `null` = does not decay. Design §5. */
  halfLifeYears: Record<SignalType, number | null>
  /**
   * A party is treated as WHIPPED in a division only if at least this many of its members voted
   * aye or no there. Below it, "the party's majority side" is a coin toss and calling the other
   * member a rebel would be noise presented as a finding.
   */
  minPartyVotersForCohesion: number
  /**
   * Cohesion = the larger side's share of a party's aye+no votes in one division. A division where
   * NO whipped party with enough voters reaches this is treated as free-vote-like.
   */
  cohesionThreshold: number
  /**
   * GRAPH 3C §2 — bill-level propagation. A division whose most-cohesive party sits BELOW this is
   * a near miss on `cohesionThreshold`, and may inherit the free-vote classification of the bill
   * it belongs to when a strict majority of that bill's divisions are already tagged.
   *
   * ⚠ It is a CEILING ON THE RESCUE, not a second threshold: it decides which divisions
   * propagation may reach, never which are tagged in the first place. Without it, propagation
   * across a generic `bill_title` (the corpus has one literally called "Ten Minute Rule Bill")
   * would carry a free-vote reading to a division whose parties were 99% cohesive. Measured: it is
   * exactly the guard that keeps commons:1079 (best cohesion 0.9899) out while letting
   * commons:2051, commons:2053 and lords:1886 in.
   */
  billPropagationCohesionCeiling: number
  /**
   * Groups that carry no whip, so "rebellion" is undefined for their members and "whipped-with" is
   * a false description. Matched against `division_votes.party` exactly.
   */
  unwhippedParties: string[]
  /**
   * GRAPH 3C §2. A party is treated as having applied a whip in a division only when its cohesion
   * reaches `cohesionThreshold`. Below that, its members' votes are classified `party-split:v1` —
   * neither `rebellion:v1` nor `whipped-with:v1`, because there was no whip to be on either side
   * of. ONE number, deliberately: `cohesionThreshold` is the definition of "whipped", and both the
   * division-level heuristic and the per-vote ladder now read it from the same place.
   */
  /** Saturation constant for confidence: NET directional evidence of this size gives confidence 0.5. */
  confidenceSaturation: number
  /**
   * GRAPH 3C §1. The prior mass the stance score is shrunk toward zero by:
   * `stance = signed / (mass + stanceShrinkage)`.
   *
   * ⚠ THIS IS THE WHOLE FIX TO "THE SCORE IS NOT A SPECTRUM". 3A/3B computed `signed / mass`, a
   * NORMALISED mean direction, which divides out both volume and consistency: one consistent vote
   * and fifty consistent votes both came out at exactly 1.00, and across 2,304,858 estimates there
   * were exactly three distinct values. Dividing by `mass + k` instead keeps the sign and the
   * consistency but lets the magnitude grow with the evidence, so the score is a spectrum again.
   *
   * Set equal to `confidenceSaturation` on purpose, so the sprint adds a SHAPE and no new number:
   * both say "this much summed evidence is worth half of what there is to know", and a single
   * undecayed rebellion therefore reads stance 0.5 and confidence 0.5 — one sentence to explain.
   * Provisional until §8 scores it, like every other number in this file.
   */
  stanceShrinkage: number
  /** The most confidence direction-0 (attention) signals may ever contribute on their own. */
  attentionConfidenceCeiling: number
  /** Confidence → fixed wording. Three bands, so callers cannot invent adjectives. */
  confidenceBands: { strong: number; some: number }
}

export const POSITION_CONFIG: PositionConfig = {
  weights: {
    // [design §5] "the member paid a price to record this" — voting against your own party's
    // majority is the single most informative thing in the whole corpus about an individual.
    'rebellion:v1': 0.9,
    // [design §5] "unwhipped, so the member's own view".
    'free-vote-heuristic:v1': 0.7,
    // [NOT IN DESIGN, added by 3A's audit] Crossbench peers, Lords Spiritual, Independents and the
    // Speakers sit under no whip at all, so EVERY vote they cast is their own view. The design's
    // table has no row for them and the alternative — calling them "whipped, with the whip" at 0.2
    // — would be a false description of the act, not a cautious one. Same number as a free vote
    // because it is the same fact: an unwhipped member voting. Charlie's to confirm (report §D-3).
    'unwhipped-group:v1': 0.7,
    // [design §5] "mostly measures the whip, not the member".
    'whipped-with:v1': 0.2,
    // [NOT IN DESIGN, added by 3A] A member of a party that put fewer than
    // `minPartyVotersForCohesion` members through the lobbies in that division. "Their party's
    // majority side" is a coin toss at n=3, so calling them a rebel would be noise sold as a
    // finding — and calling them "whipped-with" would be an assertion we cannot support either.
    // It carries the whipped weight (it can only ever understate) under its own name, so the
    // count is visible in the report rather than hidden inside the whipped total.
    'small-party-unclassified:v1': 0.2,
    // [NOT IN DESIGN, added by GRAPH 3C §2] The member's own party voted BOTH ways in this
    // division, below `cohesionThreshold`. Measured on the case that prompted the sprint: on
    // commons:2051 Labour split 126 aye / 181 no — cohesion 0.5896 — and every one of those 126
    // was recorded as `rebellion:v1` at 0.9, the highest weight in the config, for defying a whip
    // that plainly was not there. Across the whole graph, 8,773 of 18,999 minority-side votes
    // (46.2%) currently classed `rebellion:v1` come from a party below 0.85 cohesion.
    //
    // It carries the FREE VOTE weight because it is the same fact arrived at one level down: a
    // member voting where no whip held. Both sides of the split get it — the majority side of a
    // party that split 54/46 is not "voting with the whip" either, and 3A's 0.2 understated them
    // exactly as much as the 0.9 overstated the others.
    'party-split:v1': 0.7,
    // [design §5] "voluntary, costless but deliberate". Design §3 also calls an EDM signature the
    // highest-confidence position signal anywhere; 0.6 is the design's own number and stands.
    edm_signature: 0.6,
    // [design §5] "active effort". INERT IN 3A: no amendment sponsorship rows exist to weight yet
    // (audit §A-2), and direction stays 0 until 3B classifies strengthening vs wrecking.
    amendment_sponsorship: 0.7,
    // [design §5] "attention, not stance".
    witness_appearance: 0.1,
    committee_membership: 0.1,
    // [design §5] "alignment prior, not stance".
    declared_interest: 0.1,
    // [NOT IN DESIGN, added by GRAPH 3B §2.2] A donation recorded in the Electoral Commission's
    // register. Design §4 places it at P1 as "fact of the path" — the signal is the PATH
    // (member ← donor → sector), not a stance. Brief §2: *"Direction 0 means direction 0. A
    // donation is not a position. If the aggregation is tempted to convert a funding path into a
    // stance, that temptation is the thing this whole design exists to resist."*
    //
    // Same number as a declared interest because it is the same KIND of fact — an alignment prior
    // with a date and a counterparty — and giving it more would be asserting that money buys a
    // position, which is a claim about the world this graph is in no position to make. Charlie's
    // to settle; report §2.2, decision D-9.
    political_donation: 0.1,
  },
  halfLifeYears: {
    // [design §5] "votes 8 years".
    vote: 8,
    // [design §5] "EDMs 5".
    edm_signature: 5,
    // [design §5] "interests none while current". Every interest we hold is a dated declaration
    // rather than a currency flag, so it does not decay and its date is shown instead.
    declared_interest: null,
    // [NOT IN DESIGN] — 3A must not invent a why, so it borrows the one it can defend: a witness
    // appearance and a committee seat are dated past acts of the same era-sensitivity as a vote,
    // so they carry the vote half-life until measured. Numbered decision D-4 in the report.
    witness_appearance: 8,
    committee_membership: 8,
    // [NOT IN DESIGN] as above; inert in 3A because there are no rows.
    amendment_sponsorship: 8,
    // [NOT IN DESIGN, GRAPH 3B §2.2] A donation IS a dated event, unlike a declared interest, which
    // we hold as a standing relationship. So it decays, and it borrows the vote half-life for the
    // same reason D-4 gives: 3B must not invent a why, so it uses the one it can defend. A 2010
    // donation is a much weaker prior about a 2026 position than last year's.
    political_donation: 8,
  },
  // Sized off the data: 17,240 of 46,702 party×division groups have 20+ voters, and 5,634 of the
  // 5,645 divisions have at least one major party at that size — so 20 keeps essentially every
  // division classifiable while refusing to call a 3-voter split a whip.
  minPartyVotersForCohesion: 20,
  // [design §5] "e.g. neither party ≥ 85% on one side". Hand-checked on two real divisions before
  // this number was fixed: Terminally Ill Adults (End of Life) Bill 2R (Lab 61.6%, Con 80.2%,
  // LD 84.7% — free-vote-like, correct) and Universal Credit and PIP Bill 2R (Lab 87.2% — whipped,
  // correct, with its 49 rebels landing as rebels).
  cohesionThreshold: 0.85,
  // GRAPH 3C §2 — see the interface comment. The band immediately above `cohesionThreshold`;
  // propagation rescues near misses only. Chosen so the rescue set is small enough to print in
  // full in the report, which it is: three divisions.
  billPropagationCohesionCeiling: 0.90,
  unwhippedParties: [
    'Crossbench',
    'Bishops',
    'Independent',
    'Speaker',
    'Deputy Speaker',
    'Lord Speaker',
    'Non-affiliated',
    'Independent Labour',
    'Independent Liberal Democrat',
    'Independent Social Democrat',
    'Independent Socialist',
    'Independent Ulster Unionist',
    'Conservative Independent',
    'Labour Independent',
    'Independent Conservative',
    'Independent Democratic Unionist',
    'Independent Ulster Unionist Party',
  ],
  // One full-weight rebellion, undecayed (0.9), yields confidence 0.5. A single act — however
  // costly — is a coin-flip's worth of evidence about someone's stance; it takes a pattern to get
  // past 0.7. Chosen for that property, not fitted to anything, and provisional per §8.
  confidenceSaturation: 0.9,
  // GRAPH 3C §1 — see the interface comment. Deliberately the same number as the line above.
  stanceShrinkage: 0.9,
  // Design §5: "many weak signals never manufacture certainty — cap the contribution of any
  // 0-direction signal type to confidence at a low ceiling."
  attentionConfidenceCeiling: 0.15,
  confidenceBands: { strong: 0.65, some: 0.35 },
}

/**
 * The version string every estimate row carries. Derived from the constants, so it cannot fall out
 * of step with them.
 *
 * ⚠ `JSON.stringify` on a plain object preserves insertion order, which makes this stable across
 * runs but ALSO means reordering two keys without changing a value changes the version. That is
 * the safe direction to be wrong in (a spurious rebuild, never a silent one) and it is why the
 * check asserts stability across two calls rather than across two orderings.
 */
export function configVersion(cfg: PositionConfig = POSITION_CONFIG): string {
  const h = createHash('sha256').update(JSON.stringify(cfg)).digest('hex').slice(0, 12)
  // The prefix names the last sprint to change the SHAPE of this object (3C added
  // `stanceShrinkage` and `party-split:v1`); the hash is the identity. It moved 3a → 3c so that
  // "which build is production serving" is answerable at a glance on the admin page, which is the
  // only deployment marker available while every surface here is authenticated.
  return `3c.${h}`
}
