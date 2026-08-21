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
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * GRAPH 3C — WHAT CHANGED, AND THE THREE MEASUREMENTS THAT FORCED EACH CHANGE
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * 3B audited this function against all 2,304,858 estimates and found three defects. They are
 * recorded here rather than in a report alone, because the next person to touch this file needs to
 * know which properties are load-bearing.
 *
 * 1 · **The discount was grouped BY DIRECTION, which rewarded an inconsistent record.**
 *     `(signalType, derivation, direction)` put agreeing and disagreeing signals in different
 *     groups, so neither discounted the other and both counted in full. Nine votes the same way
 *     scored confidence 0.748; five one way and four the other scored **0.881**. On the Terminally
 *     Ill Adults Bill the 425 members with a mixed record averaged 0.919 against the one entirely
 *     consistent member's 0.896. *Confidence was measuring turnout.*
 *     → The group key is now `(signalType, derivation, isAttention)`. Direction NETS inside the
 *       group instead of escaping it.
 *
 * 2 · **The stance score was not a spectrum.** `signed / mass` is a NORMALISED mean direction, so
 *     it divides out both volume and consistency: across the whole table there were exactly
 *     **three** distinct values (+1, 0, −1) and 92.87% sat at exactly ±1.00. One consistent vote
 *     and fifty consistent votes were identical.
 *     → `stanceScore` is now `signed / (mass + stanceShrinkage)` — sign and consistency preserved,
 *       magnitude grows with the evidence. The old ratio is kept, under the name it always
 *       deserved: `consistency`. Every wording function reads THAT, so no form of words changes.
 *
 * 3 · **Confidence saturated on GROSS evidence.** Two members with identical turnout and opposite
 *     records were equally well "known".
 *     → Confidence now saturates on `|signed|`, the NET directional evidence. A perfectly split
 *       record is, correctly, a record we cannot draw a position from — and it still says so out
 *       loud, because `consistency` and the `divided` flag both survive to the display layer.
 *
 * ⚠ THE ONE PROPERTY THAT DID NOT CHANGE, AND MUST NOT: attention (direction 0) signals never
 * acquire a side and never exceed `attentionConfidenceCeiling` on their own.
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
  /**
   * (-1, +1), open at both ends. Direction × evidence strength: `signed / (mass + shrinkage)`.
   *
   * ⚠ THIS IS THE RANKING NUMBER, NOT THE WORDING NUMBER. It is deliberately NOT a normalised mean
   * — a single whipped vote reads 0.17 and fifty consistent free votes read 0.76, and that gap is
   * the point. Never pass it to `describeStance()`; the type will not let you.
   *
   * 0 with `mass` 0 means NO SIGNALS, which callers must render as absence, not neutrality.
   */
  stanceScore: number
  /**
   * [-1, +1]. How consistently the directional signals point one way, independent of how many
   * there are: `signed / mass`. THIS IS WHAT 3A AND 3B CALLED `stanceScore`, and it is what every
   * form of words is derived from — so the wording is unchanged by 3C while the ranking is fixed.
   * 1.00 = every signal the same way, whether that is one signal or fifty. 0 = perfectly split.
   */
  consistency: number
  /** [0, 1]. Saturates on |signed| — the NET directional evidence, not the turnout. */
  confidence: number
  /** Summed effective weight of the DIRECTIONAL signals, gross, after decay and discount. */
  mass: number
  /** Net signed weight: `Σ direction × effective weight`. `|signed| ≤ mass`, equal when consistent. */
  signed: number
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

  // ⚠⚠ GRAPH 3C — THE GROUP KEY NO LONGER CARRIES `direction`. That single token was defect 1 in
  // the header: signals that DISAGREED landed in different groups, dodged each other's discount,
  // and accumulated more mass than signals that agreed. `isAttention` stays in the key because a
  // direction-0 signal is a different KIND of observation, not a different side of one.
  const groups = new Map<string, { s: SignalForMath; w: number }[]>()
  for (const d of decayed) {
    const key = `${d.s.signalType}|${d.s.derivation ?? ''}|${d.s.direction === 0 ? 'attention' : 'directional'}`
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

    let groupMass = 0
    let gross = 0
    let signedGross = 0
    list.forEach((d, i) => {
      const contribution = d.w / (i + 1)
      groupMass += contribution
      gross += d.w
      signedGross += d.s.direction * d.w
      const c = (signalCounts[d.s.signalType] ??= { n: 0, weight: 0 })
      c.n += 1
      c.weight += contribution
    })

    if (list[0].s.direction === 0) {
      attentionMass += groupMass
      continue
    }
    mass += groupMass
    // ⚠ The net direction is taken over the group's GROSS weights and then applied to its
    // DISCOUNTED mass. Doing it the other way — discounting each signal and then summing signed
    // contributions — would make the answer depend on which side happened to hold rank 1, since
    // the i-th signal is worth w/i. With equal weights that rank is decided by an id tie-break,
    // so a 5-4 split would score anywhere between +0.62 and −0.62 of its own mass depending on an
    // accident of ordering. This form is stable: five for and four against always nets 1/9.
    signed += groupMass * (gross > 0 ? signedGross / gross : 0)
  }

  // Round the reported weights so a jsonb blob does not carry seventeen digits of noise.
  for (const k of Object.keys(signalCounts)) {
    signalCounts[k].weight = round6(signalCounts[k].weight)
  }

  // How consistently the record points one way, scale-free. 3A/3B's `stanceScore`, renamed to what
  // it measures. Every form of words is derived from this, so 3C changes no wording.
  const consistency = mass > 0 ? signed / mass : 0
  // Direction × strength of evidence. `mass + shrinkage` instead of `mass`: see the config comment
  // on `stanceShrinkage`. Sign is identical to `consistency`; magnitude now grows with the record.
  const stanceScore = mass > 0 ? signed / (mass + cfg.stanceShrinkage) : 0
  // Saturating in the NET evidence, never reaching 1: confidence is bounded by how much was
  // observed AND by how well it agrees, so it can be high and still be wrong, which is what the
  // §8 validation set measures. Using |signed| rather than `mass` is defect 3 in the header —
  // turnout is not conviction.
  const cDirectional = mass > 0 ? 1 - Math.pow(2, -Math.abs(signed) / cfg.confidenceSaturation) : 0
  const cAttentionRaw = attentionMass > 0 ? 1 - Math.pow(2, -attentionMass / cfg.confidenceSaturation) : 0
  const cAttention = Math.min(cfg.attentionConfidenceCeiling, cAttentionRaw)
  // Probabilistic OR: two independent-ish sources of confidence combine without ever exceeding 1,
  // and an actor with ONLY attention signals lands on cAttention, i.e. at or below the ceiling.
  const confidence = 1 - (1 - cDirectional) * (1 - cAttention)

  return {
    stanceScore: round6(stanceScore),
    consistency: round6(consistency),
    confidence: round6(confidence),
    mass: round6(mass),
    signed: round6(signed),
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
 * CONSISTENCY → wording. Deliberately refuses the middle: a record near zero is CONTESTED or
 * BALANCED, never "neutral", and never nothing.
 *
 * ⚠ There is no band here for "no signals". That case must not reach this function at all — design
 * §6: an actor with no signals is *absent*, and absence is the caller's to render.
 *
 * ⚠⚠ GRAPH 3C — IT TAKES AN OBJECT, NOT A NUMBER, AND THAT IS THE WHOLE POINT OF THE SIGNATURE.
 * The number this reads is `consistency`, which is what 3A and 3B called `stanceScore`. 3C gave
 * `stanceScore` a different meaning (direction × evidence strength, shrunk toward zero), and under
 * the old signature every existing call site would have kept compiling while silently changing
 * what it said: a single whipped vote would read 0.167 and be described as a "divided record".
 * Taking `{ consistency }` makes every one of those call sites a compile error instead, which is
 * how they came to be reviewed. Do not relax it back to a number.
 */
export function describeStance(a: { consistency: number }): 'supported' | 'opposed' | 'divided record' {
  if (a.consistency >= 0.2) return 'supported'
  if (a.consistency <= -0.2) return 'opposed'
  return 'divided record'
}

/** One thing an actor's stance is a stance TOWARD. Enough to name it and date it, nothing more. */
export interface ClaimTarget {
  label: string
  date: string
  /** +1 / -1 / 0 as recorded on that specific target. */
  direction: number
}

/**
 * GRAPH 3B §1 — the never-claim rule at the display layer.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY A BARE STANCE WORD IS A FALSE STATEMENT AND NOT MERELY A TERSE ONE
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * `describeStance()` returns "supported". Rendered beside a name on a page headed *assisted dying*,
 * a reader completes the sentence themselves: **"supports assisted dying"**. What the graph knows
 * is narrower and different — *"voted aye on Amendment 12 to the Terminally Ill Adults (End of
 * Life) Bill on 20 June 2025"*. Amendment 12 was an amendment; voting for it is not the same act as
 * voting for the Bill, and on this Bill some members did one and not the other.
 *
 * So the stance word never travels alone. This function is the only way to render it, and it cannot
 * be called without the targets, because the type will not let you.
 *
 * ⚠ It deliberately does NOT summarise several targets into one phrase. Design §6 and 3A's D-2: a
 * vote for a Bill and a vote against an amendment to it are opposite directions once summed, and
 * 448 of 453 members read as "divided" on this Bill for that purely structural reason. The targets
 * are LISTED, each with its own side.
 */
export function composeClaim(
  stanceWording: string,
  targets: ClaimTarget[],
  maxNamed = 3,
): { claim: string; caveat: string | null } {
  if (!targets.length) {
    // Design §6: absence is the caller's to render, and it must never arrive here as a score.
    return { claim: 'no recorded signal', caveat: null }
  }

  const side = (d: number) => (d > 0 ? 'for' : d < 0 ? 'against' : 'engaged with, no side recorded')
  const named = targets.slice(0, maxNamed)
    .map((t) => `${side(t.direction)} “${t.label}” (${t.date})`)
    .join('; ')
  const rest = targets.length - named.length > 0 ? '' : ''
  const more = targets.length > maxNamed ? `; and ${targets.length - maxNamed} more` : rest

  if (targets.length === 1) {
    return { claim: `${stanceWording} — ${named}`, caveat: null }
  }
  return {
    claim: `${stanceWording}, across ${targets.length} things asked about — ${named}${more}`,
    // The caveat is not decoration. It is the difference between what was measured and what a
    // reader will otherwise infer, said in the same breath as the number.
    caveat:
      'A stance toward these specific divisions, not toward the Bill or the subject. ' +
      'Voting for a Bill and against an amendment to it are opposite directions once combined.',
  }
}
