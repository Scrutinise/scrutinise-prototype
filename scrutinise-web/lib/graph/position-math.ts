/**
 * position-math.ts — the aggregation the position graph runs on, written ONCE.
 *
 * GRAPH 3A. Spec: `docs/POSITION_GRAPH_DESIGN.md` §5 (aggregation), §6 (never-claim wording).
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS IS A SHARED MODULE AND NOT PART OF THE BUILD SCRIPT
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * The estimate engine aggregates signals for ONE target. The read API aggregates a person's
 * estimates ACROSS the several targets a search returned. Those are the same arithmetic, and if
 * they were written twice they would drift — and the drift would be invisible, because both halves
 * would keep returning plausible numbers. One function, two callers, one set of checks.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE ONE NON-OBVIOUS RULE: REPEATED SIGNALS OF THE SAME CLASS ARE SUB-ADDITIVE
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * Design §5 requires that **one rebellion outweighs ten whipped votes**. Under a plain weighted
 * mean it does not: 0.9 against 10 × 0.2 = 2.0, and the whip wins by more than two to one. That is
 * not a tuning problem, it is a modelling error — ten whipped votes are not ten observations of the
 * member, they are ten observations of the SAME WHIP. Correlated evidence must not accumulate like
 * independent evidence.
 *
 * So within one weight class and one direction, the signals are ranked by their decayed weight and
 * the i-th contributes `weight / i` (a harmonic discount). Ten whipped votes are then worth
 * 0.2 × (1 + 1/2 + … + 1/10) = 0.586, and one rebellion at 0.9 outweighs them — which is the
 * property the design asked for, arrived at by saying what the evidence actually is rather than by
 * choosing numbers until the test passed.
 *
 * ⚠ The discount is applied WITHIN a class, never across classes: a rebellion and a free vote are
 * different observations and both count in full.
 */
import { POSITION_CONFIG, PositionConfig, SignalType } from './position-config'

export interface SignalForMath {
  /** Stable tie-break so a rebuild is bit-identical. Any total order will do; ids are the obvious one. */
  id: string
  signalType: SignalType
  /** The weight class. `null` for signal types that have only one class. */
  derivation: string | null
  /** +1 / -1 / 0. 0 is an attention signal: it has no side. */
  direction: number
  rawWeight: number
  /** The date the event happened, `YYYY-MM-DD`. Never the ingest date. */
  observedAt: string
}

export interface Aggregate {
  /** [-1, +1]. 0 with `mass` 0 means NO SIGNALS, which callers must render as absence, not neutrality. */
  stanceScore: number
  /** [0, 1]. */
  confidence: number
  /** Summed effective weight of the DIRECTIONAL signals — the thing confidence saturates on. */
  mass: number
  /** Summed effective weight of the direction-0 signals, before the ceiling is applied. */
  attentionMass: number
  /** Per signal type: how many signals and what they were worth after decay and discount. */
  signalCounts: Record<string, { n: number; weight: number }>
}

/** Whole days between two ISO dates, positive when `later` is after `earlier`. */
function daysBetween(earlier: string, later: string): number {
  const a = Date.UTC(+earlier.slice(0, 4), +earlier.slice(5, 7) - 1, +earlier.slice(8, 10))
  const b = Date.UTC(+later.slice(0, 4), +later.slice(5, 7) - 1, +later.slice(8, 10))
  return Math.round((b - a) / 86_400_000)
}

/**
 * Exponential decay on a per-signal-type half-life. 1.0 for a type that does not decay.
 *
 * A signal dated AFTER `asOf` (a division tabled for next week, an interest declared today against
 * a build run for last month) returns 1.0 rather than a value above 1 — the future does not amplify
 * evidence, and a clamp here is cheaper than a mystery later.
 */
export function decay(
  signalType: SignalType,
  observedAt: string,
  asOf: string,
  cfg: PositionConfig = POSITION_CONFIG,
): number {
  const halfLife = cfg.halfLifeYears[signalType]
  if (halfLife == null) return 1
  const years = daysBetween(observedAt, asOf) / 365.2425
  if (years <= 0) return 1
  return Math.pow(2, -years / halfLife)
}

/**
 * Aggregate a set of signals about one thing into a score and a confidence.
 *
 * Deterministic: the only ordering used is (decayed weight DESC, id ASC), so two runs over the same
 * rows in any input order produce identical output. `check-3a.ts` asserts that by shuffling.
 */
export function aggregate(
  signals: SignalForMath[],
  asOf: string,
  cfg: PositionConfig = POSITION_CONFIG,
): Aggregate {
  const signalCounts: Record<string, { n: number; weight: number }> = {}

  // decay each signal once
  const decayed = signals.map((s) => ({
    s,
    w: s.rawWeight * decay(s.signalType, s.observedAt, asOf, cfg),
  }))

  // Group for the harmonic discount: same weight class AND same direction. Attention signals
  // (direction 0) are grouped by class too, so a hundred witness appearances cannot add up either.
  const groups = new Map<string, { s: SignalForMath; w: number }[]>()
  for (const d of decayed) {
    const key = `${d.s.signalType}|${d.s.derivation ?? ''}|${d.s.direction}`
    const list = groups.get(key)
    if (list) list.push(d)
    else groups.set(key, [d])
  }

  let signed = 0
  let mass = 0
  let attentionMass = 0

  // Iterate the group keys in sorted order so the arithmetic itself is order-independent —
  // floating-point addition is not associative, and "bit-identical rebuild" has to survive that.
  for (const key of [...groups.keys()].sort()) {
    const list = groups.get(key)!
    list.sort((a, b) => (b.w - a.w) || (a.s.id < b.s.id ? -1 : a.s.id > b.s.id ? 1 : 0))
    list.forEach((d, i) => {
      const contribution = d.w / (i + 1)
      if (d.s.direction === 0) {
        attentionMass += contribution
      } else {
        mass += contribution
        signed += d.s.direction * contribution
      }
      const c = (signalCounts[d.s.signalType] ??= { n: 0, weight: 0 })
      c.n += 1
      c.weight += contribution
    })
  }

  // Round the reported weights so a jsonb blob does not carry seventeen digits of noise.
  for (const k of Object.keys(signalCounts)) {
    signalCounts[k].weight = round6(signalCounts[k].weight)
  }

  const stanceScore = mass > 0 ? signed / mass : 0
  // Saturating in the summed evidence, never reaching 1: confidence is bounded by how much was
  // observed, so it can be high and still be wrong, which is what the §8 validation set measures.
  const cDirectional = mass > 0 ? 1 - Math.pow(2, -mass / cfg.confidenceSaturation) : 0
  const cAttentionRaw = attentionMass > 0 ? 1 - Math.pow(2, -attentionMass / cfg.confidenceSaturation) : 0
  const cAttention = Math.min(cfg.attentionConfidenceCeiling, cAttentionRaw)
  // Probabilistic OR: two independent-ish sources of confidence combine without ever exceeding 1,
  // and an actor with ONLY attention signals lands on cAttention, i.e. at or below the ceiling.
  const confidence = 1 - (1 - cDirectional) * (1 - cAttention)

  return {
    stanceScore: round6(stanceScore),
    confidence: round6(confidence),
    mass: round6(mass),
    attentionMass: round6(attentionMass),
    signalCounts,
  }
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6
}

/**
 * Confidence → the ONE permitted form of words.
 *
 * Design §6's never-claim rule, enforced at the vocabulary level: callers get a phrase, not licence
 * to invent an adjective, and nothing here rounds a score into a verdict. The wording describes the
 * RECORD, not the person — "strong recorded record" is a claim about how much we hold, and is true
 * even when the estimate turns out to be wrong.
 */
export function describeConfidence(confidence: number, cfg: PositionConfig = POSITION_CONFIG): string {
  if (confidence >= cfg.confidenceBands.strong) return 'strong recorded record'
  if (confidence >= cfg.confidenceBands.some) return 'some recorded signals'
  return 'weak indication'
}

/**
 * Stance score → wording. Deliberately refuses the middle: a score near zero is CONTESTED or
 * BALANCED, never "neutral", and never nothing.
 *
 * ⚠ There is no band here for "no signals". That case must not reach this function at all — design
 * §6: an actor with no signals is *absent*, and absence is the caller's to render.
 */
export function describeStance(stanceScore: number): 'supported' | 'opposed' | 'divided record' {
  if (stanceScore >= 0.2) return 'supported'
  if (stanceScore <= -0.2) return 'opposed'
  return 'divided record'
}
