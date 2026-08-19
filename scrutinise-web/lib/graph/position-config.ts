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

export interface PositionConfig {
  /** `raw_weight` per weight class and signal type. Design §5's table. */
  weights: {
    'rebellion:v1': number
    'free-vote-heuristic:v1': number
    'unwhipped-group:v1': number
    'whipped-with:v1': number
    'small-party-unclassified:v1': number
    edm_signature: number
    amendment_sponsorship: number
    witness_appearance: number
    committee_membership: number
    declared_interest: number
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
   * Groups that carry no whip, so "rebellion" is undefined for their members and "whipped-with" is
   * a false description. Matched against `division_votes.party` exactly.
   */
  unwhippedParties: string[]
  /** Saturation constant for confidence: summed effective weight of this size gives confidence 0.5. */
  confidenceSaturation: number
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
  return `3a.${h}`
}
