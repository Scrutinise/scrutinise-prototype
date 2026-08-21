/**
 * positions.ts — GRAPH 3A §5. The read API over the position graph.
 *
 * `positionsFor(targets, opts)` answers one question: **given these concrete things (divisions,
 * EDMs, inquiries, organisations), which actors have a recorded position, how strong is the
 * record, and what exactly is it?**
 *
 * Owned by CC-Graph. Design: `docs/POSITION_GRAPH_DESIGN.md` §6.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT THIS DELIBERATELY WILL NOT DO
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * · It will not return an actor with no signals. Design §6: *"an actor with no signals is absent,
 *   not neutral — 'no recorded signal' is a different fact from 'score 0'."* There is no row to
 *   filter out, because none is ever produced; a caller cannot accidentally render absence as a
 *   view.
 * · It will not hand the caller a bare number to describe in their own words. `confidenceWording`
 *   and `stanceWording` come from the fixed vocabulary in position-math.ts, so two screens cannot
 *   invent two different adjectives for 0.42.
 * · It will not hide an unresolved actor, and it will not let one pass as an identified one.
 *   Every row carries the identity tier and its statement from `graph_entity_identity`, which is
 *   the wording defined once in SQL for exactly this reason (design §3, Amendment 2 §3).
 * · It will not claim a *topic* stance. Targets are concrete artefacts; the mapping from an idea
 *   to its relevant divisions and bills is search's job, not this module's.
 *
 * ⚠ NOT WIRED INTO THE DEEPENING IN THIS SPRINT. GRAPH 3A §0 holds the one-line registration of
 * the political-risk hook back until SEARCH S8's commit lands, because S8 is editing the deepening
 * pass configuration in the same repository today. The snippet is in `docs/GRAPH_3A_REPORT.md`.
 */
import { getNeonPool } from '@/lib/pg-pool'
import { POSITION_CONFIG } from './position-config'
import {
  aggregate, composeClaim, describeConfidence, describeStance, SignalForMath,
} from './position-math'

export { describeConfidence, describeStance, composeClaim }

/** The concrete things an actor can have taken a position on. */
export type TargetType = 'division' | 'edm' | 'inquiry' | 'organisation' | 'bill' | 'instrument'

export interface PositionTarget {
  type: TargetType
  /** `commons:2071` for a division, the motion id for an EDM, the inquiry ref, the entity id. */
  id: string
}

/** One displayable citation: what the actor did, when, and what it can be drilled to. */
export interface Ground {
  targetType: TargetType
  targetId: string
  /** Human-readable: the division title, the EDM's subject line, the inquiry name. */
  targetLabel: string | null
  date: string
  signalType: string
  /** The versioned method, where the signal is a classification rather than a plain fact. */
  derivation: string | null
  direction: number
  weight: number
  sourceUrl: string | null
  /** `corpus_sections.id` values — what a drill-down fetches. Never empty. */
  evidenceIds: string[]
}

export interface ActorPosition {
  actorId: string
  name: string
  kind: 'person' | 'organisation' | 'publication'
  /** 'Stable external key' / 'Name match, corroborated' / 'Mention only' — from graph_identity_tier. */
  identityTier: string
  /** The sentence the user is shown about how well we know who this is. */
  identityStatement: string
  identityCaveat: string | null
  /** Parliament's member id where we hold one — the drill-down key for a member. */
  parlMemberId: number | null

  /**
   * Rolled up across every requested target this actor has a signal for. (-1, +1).
   * GRAPH 3C: direction × strength of evidence — the RANKING number. Fifty consistent votes score
   * higher than one; they used to score identically. Never render this as a verdict on its own.
   */
  stanceScore: number
  /**
   * [-1, +1]. How consistently the record points one way, independent of its size. This is the
   * number every form of words is derived from, and it is what 3A/3B called `stanceScore`.
   */
  consistency: number
  /** [0, 1]. Saturates on the NET evidence, so a contradictory record is not a confident one. */
  confidence: number
  /** The only permitted wording for that number. */
  confidenceWording: string
  /** 'supported' | 'opposed' | 'divided record'. */
  stanceWording: string
  /** Per signal type: how many, and what they were worth after decay and discount. */
  signalCounts: Record<string, { n: number; weight: number }>
  /**
   * GRAPH 3B §1 — the stance word WITH the thing it is a stance toward, in one string. Never
   * render `stanceWording` on its own; see `composeClaim()` for why that is a false statement
   * rather than a terse one.
   */
  claim: string
  /** Non-null whenever more than one target contributed. Must be shown with the claim. */
  claimCaveat: string | null
  /**
   * GRAPH 3B §4.2 — per target, SEPARATELY LABELLED AND NEVER SUMMED. Charlie's decision on
   * Bill-level aggregation: voting for a Bill and against an amendment to it cancel out, so the
   * breakdown is the honest object and the rollup is the convenience.
   *
   * ⚠ Computed from the SIGNALS with the same `aggregate()`, not read out of `position_estimate`.
   * Two reasons: an estimate row goes slightly stale every day because decay is baked into it,
   * and a target with no precomputed estimate would silently drop out of the breakdown.
   */
  byTarget: Array<{
    targetType: string
    targetId: string
    /** The division's title / the motion's subject line. Null only when we hold no label at all. */
    targetLabel: string | null
    date: string
    stanceScore: number
    consistency: number
    confidence: number
    stanceWording: string
    /** The one-line claim for this target alone. */
    claim: string
  }>
  /**
   * TRUE when this actor's signals do not all point the same way across the requested targets.
   * The rolled-up `stanceScore` is near zero in that case and means "divided record", NOT
   * "neutral" — and on a Bill it usually means the targets are a mixture of the Bill and
   * amendments to it, which is a fact about the question asked, not about the member.
   */
  divided: boolean
  /** How many signals contributed. The second sort key, and printed beside the ranking. */
  signalCount: number
  /** Every signal, as a citation. Most recent first. */
  grounds: Ground[]
}

/**
 * GRAPH 3B §1 — WHAT THE ORDER MEANS, SHIPPED WITH THE ORDER.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * A RANKING THAT CANNOT RANK IS THE SAME FAILURE CLASS AS A METRIC THAT CANNOT FAIL
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * `/admin/positions` said *"showing the top 40"* over a list in alphabetical order, because 135 of
 * the 555 actors carried an identical score and the sort had nothing left to separate them. It
 * looked like a result and was not one.
 *
 * The fix is NOT a livelier tie-break — that would hide the finding. It is to say what the sort key
 * is, and to say so out loud when the key has run out. `tiedAtTop` is computed over the actors
 * MATCHED, not the ones shown, so the sentence stays true when `limit` is raised or lowered.
 */
export interface Ranking {
  /** The sort key in words, for printing verbatim on the page. */
  key: string
  /** How many of the matched actors share the top actor's key exactly. */
  tiedAtTop: number
  /** How many actors matched in total (before `limit`). */
  ofMatched: number
  /** How many are being shown. */
  shown: number
  /** True when every actor SHOWN is tied — i.e. the visible order is the name order and nothing else. */
  shownOrderIsNameOrderOnly: boolean
  /** The sentence the page must print. Null when the ranking genuinely ranks the visible rows. */
  note: string | null
}

export interface PositionsOptions {
  /** Drop actors below this confidence. Default 0 — the caller decides, and absence is not a score. */
  minConfidence?: number
  /** Cap the number of actors returned, after ranking. Default 50. */
  limit?: number
  /** Only people, or only organisations. Default: both. */
  actorKind?: 'person' | 'organisation'
  /** Decay reference date, `YYYY-MM-DD`. Default today. Pass a fixed date to reproduce a result. */
  asOf?: string
  /** Cap the citations kept per actor, newest first. Default 12. */
  maxGroundsPerActor?: number
}

export interface PositionsResult {
  /** Ordered by `ranking.key`. Read `ranking` before believing the order means anything. */
  actors: ActorPosition[]
  /** What the order is, and whether it separates the rows it is shown over. */
  ranking: Ranking
  /** Targets that resolved to no signal at all. Naming them is the never-claim rule (design §6). */
  targetsWithNoSignals: PositionTarget[]
  /** How many actors matched before `limit` and `minConfidence` were applied. */
  actorsMatched: number
  asOf: string
  configVersion: string | null
  elapsedMs: number
}

/**
 * The sort key, in the words the page prints. Defined once, here, so the page cannot describe an
 * order the code does not implement — which is how "showing the top 40" came to sit over a list
 * that was in alphabetical order.
 */
export const RANK_KEY_WORDING =
  'confidence (descending), then number of contributing signals (descending), then name (A–Z)'

/** `division:commons:2071` → `{ type: 'division', id: 'commons:2071' }`. */
export function parseTarget(s: string): PositionTarget | null {
  const i = s.indexOf(':')
  if (i <= 0) return null
  const type = s.slice(0, i) as TargetType
  const id = s.slice(i + 1)
  if (!id) return null
  if (!['division', 'edm', 'inquiry', 'organisation', 'bill', 'instrument'].includes(type)) return null
  return { type, id }
}

interface SignalRow {
  actor_id: string
  name: string
  kind: ActorPosition['kind']
  identity_tier: string
  identity_statement: string
  identity_caveat: string | null
  parl_member_id: number | null
  target_type: TargetType
  target_id: string
  target_label: string | null
  source_url: string | null
  signal_ref: string
  signal_type: string
  direction: number
  derivation: string | null
  raw_weight: number
  observed_at: string
  evidence_ids: string[]
}

/**
 * The one query. Signals for the requested targets, with the actor's identity and a displayable
 * label for the target resolved in the same pass — because a citation the caller has to go and
 * look up separately is a citation that will eventually be rendered without one.
 */
//
// ⚠ The target list arrives as TWO parallel arrays joined through `unnest`, not as an array of
// (type, id) pairs. Postgres refuses the obvious `= ANY($1::record[])` form outright — "input of
// anonymous composite types is not implemented" — and it fails at execution, not at parse, so it
// looks like a data problem rather than a syntax one. Found by running it.
//
// ⚠⚠ GRAPH 3B §1 — THE SOURCE IS `position_signal_for(...)`, A FUNCTION, NOT THE `position_signal`
// VIEW. This is the 9,048 ms Charlie saw, and it was neither a missing index nor an inherently
// heavy query. The view derives `target_id` as `house || ':' || division_id`, a COMPUTED column,
// so the target filter arrived as a hash join against a two-row function scan and Postgres could
// not push it down: the plan materialised all 2,317,523 signals and threw away 2,316,542 of them.
// A view cannot take a parameter; a set-returning function can, and inside it the predicate
// decomposes to (house, division_id) and reaches the `idx_dv_div` index that already existed.
//
//     view      4,397 ms          function      57 ms          77×
//
// The function shares `position_vote_class()` with the view, so the classification ladder still
// has one home, and `check-3b.ts` asserts the two return identical rows target-type by
// target-type — because "one definition" is a claim, and a claim about two code paths agreeing
// needs something that would notice if they stopped.
const SIGNAL_SQL = `
  SELECT s.actor_id::text,
         i.canonical_name       AS name,
         i.kind,
         i.identity_tier,
         i.identity_statement,
         i.identity_caveat,
         i.parl_member_id,
         s.target_type, s.target_id, s.signal_ref, s.signal_type,
         s.direction, s.derivation, s.raw_weight, s.observed_at::text, s.evidence_ids,
         COALESCE(d.title, cs."sectionTitle", ge.object_label, org.canonical_name) AS target_label,
         COALESCE(d.source_url, cs."sourceUrl", don.source_url)                    AS source_url
    FROM position_signal_for($1::text[], $2::text[]) s
    JOIN graph_entity_identity i ON i.entity_id = s.actor_id
    -- ⚠ Every numeric cast below is wrapped in a CASE that tests the string first. A plain
    -- \`AND s.target_type='division' AND ...::int\` reads as safe and is not: the planner is free to
    -- evaluate the cast before the type guard, so an EDM id in the same result set blows the whole
    -- query up with "invalid input syntax for type bigint". CASE is the one construct that
    -- guarantees the branch is not evaluated. Found by running it, not by reading it.
    LEFT JOIN divisions d
      ON d.house = (CASE WHEN s.target_type = 'division' THEN split_part(s.target_id, ':', 1) END)
     AND d.division_id = (CASE WHEN s.target_type = 'division'
                                AND split_part(s.target_id, ':', 2) ~ '^[0-9]+$'
                               THEN split_part(s.target_id, ':', 2)::int END)
    LEFT JOIN corpus_sections cs
      ON s.target_type = 'edm'
     AND cs.id = 'early-day-motions:' || s.target_id || ':1'
    LEFT JOIN LATERAL (
      SELECT object_label FROM graph_edge
       WHERE s.target_type = 'inquiry' AND predicate = 'gave-evidence-to' AND object_ref = s.target_id
       LIMIT 1
    ) ge ON TRUE
    LEFT JOIN graph_entity org
      ON org.id = (CASE WHEN s.target_type = 'organisation' AND s.target_id ~ '^[0-9]+$'
                        THEN s.target_id::bigint END)
    -- GRAPH 3B §2.2. A donation signal's evidence is an Electoral Commission reference, and a
    -- citation the reader cannot open is a citation that will eventually be shown without one.
    LEFT JOIN LATERAL (
      SELECT dn.source_url FROM position_donation dn
       WHERE s.signal_type = 'political_donation'
         AND ('ec-donation:' || dn.ec_ref) = s.evidence_ids[1]
       LIMIT 1
    ) don ON TRUE
   WHERE ($3::text IS NULL OR i.kind = $3)`

/**
 * Positions held toward a set of concrete targets.
 *
 * ⚠ The rollup across targets uses the SAME `aggregate()` the estimate engine uses. That is the
 * point of the shared module: a person who rebelled on one division and voted with the whip on
 * four others gets one honest number, computed the one way.
 */
export async function positionsFor(
  targets: PositionTarget[],
  opts: PositionsOptions = {},
): Promise<PositionsResult> {
  const t0 = Date.now()
  const asOf = opts.asOf ?? new Date().toISOString().slice(0, 10)
  const limit = opts.limit ?? 50
  const minConfidence = opts.minConfidence ?? 0
  const maxGrounds = opts.maxGroundsPerActor ?? 12

  const emptyRanking: Ranking = {
    key: RANK_KEY_WORDING, tiedAtTop: 0, ofMatched: 0, shown: 0,
    shownOrderIsNameOrderOnly: false, note: null,
  }
  const empty: PositionsResult = {
    actors: [], ranking: emptyRanking, targetsWithNoSignals: targets, actorsMatched: 0, asOf,
    configVersion: null, elapsedMs: Date.now() - t0,
  }
  if (!targets.length) return { ...empty, targetsWithNoSignals: [] }

  const pool = getNeonPool()
  const types = targets.map((t) => t.type)
  const ids = targets.map((t) => t.id)
  const { rows } = await pool.query<SignalRow>(SIGNAL_SQL, [types, ids, opts.actorKind ?? null])
  if (!rows.length) return empty

  const seenTargets = new Set(rows.map((r) => `${r.target_type}:${r.target_id}`))
  const targetsWithNoSignals = targets.filter((t) => !seenTargets.has(`${t.type}:${t.id}`))

  // Group by actor.
  const byActor = new Map<string, SignalRow[]>()
  for (const r of rows) {
    const list = byActor.get(r.actor_id)
    if (list) list.push(r)
    else byActor.set(r.actor_id, [r])
  }

  // `config_version` is read for display only. It is the version that built the STORED estimates;
  // every number returned here is computed live from signals with the CURRENT config, so if the
  // two ever disagree the page is showing a stale label. One row is enough to name it.
  const { rows: cfgRows } = await pool.query<{ config_version: string }>(
    `SELECT config_version FROM position_estimate_meta ORDER BY id DESC LIMIT 1`)

  const toMath = (s: SignalRow): SignalForMath => ({
    id: s.signal_ref,
    signalType: s.signal_type as SignalForMath['signalType'],
    derivation: s.derivation,
    direction: s.direction,
    rawWeight: s.raw_weight,
    observedAt: s.observed_at,
  })

  const actors: ActorPosition[] = []
  for (const [actorId, sigs] of byActor) {
    const agg = aggregate(sigs.map(toMath), asOf, POSITION_CONFIG)
    if (agg.confidence < minConfidence) continue
    const head = sigs[0]

    // ── §4.2: per target, separately labelled, never summed ────────────────────────────────────
    const perTarget = new Map<string, SignalRow[]>()
    for (const s of sigs) {
      const k = `${s.target_type}:${s.target_id}`
      const l = perTarget.get(k); if (l) l.push(s); else perTarget.set(k, [s])
    }
    const byTarget = [...perTarget.values()]
      .map((rows) => {
        const a = aggregate(rows.map(toMath), asOf, POSITION_CONFIG)
        const label = rows[0].target_label
        const date = rows.map((r) => r.observed_at).sort().at(-1)!
        const wording = describeStance(a)
        return {
          targetType: rows[0].target_type,
          targetId: rows[0].target_id,
          targetLabel: label,
          date,
          stanceScore: a.stanceScore,
          consistency: a.consistency,
          confidence: a.confidence,
          stanceWording: wording,
          claim: composeClaim(wording, [{
            label: label ?? `${rows[0].target_type}:${rows[0].target_id}`,
            date,
            direction: rows[0].direction,
          }]).claim,
        }
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

    // "Divided" is a fact about the requested SET, not about the person — which is exactly why it
    // is reported as its own flag rather than left to be inferred from a score near zero.
    const directions = new Set(sigs.filter((s) => s.direction !== 0).map((s) => s.direction))
    const divided = directions.size > 1

    const { claim, caveat } = composeClaim(
      describeStance(agg),
      byTarget.map((t) => ({
        label: t.targetLabel ?? `${t.targetType}:${t.targetId}`,
        date: t.date,
        // ⚠ `consistency`, not `stanceScore` — the side this target came out on, independent of
        // how strong the evidence for it was. `for`/`against` is a fact about direction; the
        // strength is carried elsewhere and must not leak into the word.
        direction: t.consistency > 0 ? 1 : t.consistency < 0 ? -1 : 0,
      })),
    )

    const grounds: Ground[] = sigs
      .slice()
      .sort((a, b) => (a.observed_at < b.observed_at ? 1 : a.observed_at > b.observed_at ? -1 : 0))
      .slice(0, maxGrounds)
      .map((s) => ({
        targetType: s.target_type,
        targetId: s.target_id,
        targetLabel: s.target_label,
        date: s.observed_at,
        signalType: s.signal_type,
        derivation: s.derivation,
        direction: s.direction,
        weight: s.raw_weight,
        sourceUrl: s.source_url,
        evidenceIds: s.evidence_ids,
      }))

    actors.push({
      actorId,
      name: head.name,
      kind: head.kind,
      identityTier: head.identity_tier,
      identityStatement: head.identity_statement,
      identityCaveat: head.identity_caveat,
      parlMemberId: head.parl_member_id,
      stanceScore: agg.stanceScore,
      consistency: agg.consistency,
      confidence: agg.confidence,
      confidenceWording: describeConfidence(agg.confidence),
      stanceWording: describeStance(agg),
      signalCounts: agg.signalCounts,
      claim,
      claimCaveat: caveat,
      byTarget,
      divided,
      signalCount: sigs.length,
      grounds,
    })
  }

  // ── THE ORDER, AND WHAT IT MEANS ───────────────────────────────────────────────────────────
  //
  // ⚠ 3A ranked by |stance| × confidence. That key is WORSE than it looks on a small target set:
  // stance is `signed / mass`, a ratio, so it is exactly ±1 for anyone who voted consistently
  // however many times they did it — which makes the product collapse to `confidence` for almost
  // everybody, and makes a genuinely divided record sort to the bottom on a key of exactly 0.
  // Brief §1: order by confidence, then by the number of contributing signals, then by name — and
  // PRINT THE KEY, so a reader can see what the order is claiming and what it is not.
  //
  // ⚠⚠ GRAPH 3C CLOSES D-7 BY CHANGING THE NUMBER, NOT THE KEY. 3B flagged that both available
  // keys were biased in opposite directions: confidence-first put the LEAST decided members at the
  // top, because contradictory signals escaped the harmonic discount and accumulated more mass
  // than agreeing ones. That is fixed in `aggregate()` — confidence now saturates on the NET
  // evidence — so confidence-first no longer promotes the ambivalent; it demotes them, which is
  // what a reader who knows the subject expects. The key is unchanged and so is this wording;
  // what changed is that the number under it now means conviction rather than turnout.
  actors.sort((a, b) =>
    b.confidence - a.confidence ||
    b.signalCount - a.signalCount ||
    (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))

  const shown = actors.slice(0, limit)
  const tieKey = (a: ActorPosition) => `${a.confidence.toFixed(6)}|${a.signalCount}`
  const tiedAtTop = actors.length ? actors.filter((a) => tieKey(a) === tieKey(actors[0])).length : 0
  const shownAllTied = shown.length > 1 && shown.every((a) => tieKey(a) === tieKey(shown[0]))

  const ranking: Ranking = {
    key: RANK_KEY_WORDING,
    tiedAtTop,
    ofMatched: actors.length,
    shown: shown.length,
    shownOrderIsNameOrderOnly: shownAllTied,
    note: shownAllTied
      // The sentence the brief asks for, verbatim in shape: say that there is no ranking here.
      ? `${shown.length} of ${actors.length.toLocaleString()} actors, tied at this confidence ` +
        `(${shown[0].confidence.toFixed(3)}, ${shown[0].signalCount} signal${shown[0].signalCount === 1 ? '' : 's'}) ` +
        `— ordered by name. This is not a ranking.`
      : tiedAtTop > 1
        ? `${tiedAtTop} actors are tied at the top of this order (confidence ` +
          `${actors[0].confidence.toFixed(3)}, ${actors[0].signalCount} signal${actors[0].signalCount === 1 ? '' : 's'}); ` +
          `among those the order is by name.`
        : null,
  }

  return {
    actors: shown,
    ranking,
    targetsWithNoSignals,
    actorsMatched: actors.length,
    asOf,
    configVersion: cfgRows[0]?.config_version ?? null,
    elapsedMs: Date.now() - t0,
  }
}

/**
 * Free text → candidate targets, using the divisions and EDMs we hold.
 *
 * Deliberately simple and deliberately NOT the search gateway: the gateway belongs to the search
 * stream and this module must not reach into it (GRAPH 3A §0). Its job is to let the admin surface
 * find a division to look at; the deepening will pass targets that `runSearch` has already found.
 */
export async function findTargets(query: string, limit = 20): Promise<Array<PositionTarget & { label: string; date: string | null }>> {
  const q = query.trim()
  if (q.length < 3) return []
  const pool = getNeonPool()
  const { rows } = await pool.query<{ type: string; id: string; label: string; date: string | null }>(`
    (SELECT 'division' AS type, house || ':' || division_id AS id, title AS label,
            division_date::text AS date
       FROM divisions
      WHERE title ILIKE '%' || $1 || '%' OR bill_title ILIKE '%' || $1 || '%'
      ORDER BY division_date DESC
      LIMIT $2)
    UNION ALL
    (SELECT 'edm', s.motion_id::text, COALESCE(cs."sectionTitle", 'EDM ' || s.uin),
            s.date_tabled::text
       FROM edm_sponsor s
       JOIN corpus_sections cs ON cs.id = 'early-day-motions:' || s.motion_id || ':1'
      WHERE cs."sectionTitle" ILIKE '%' || $1 || '%'
      ORDER BY s.date_tabled DESC
      LIMIT $2)`, [q, limit])
  return rows.map((r) => ({ type: r.type as TargetType, id: r.id, label: r.label, date: r.date }))
}
