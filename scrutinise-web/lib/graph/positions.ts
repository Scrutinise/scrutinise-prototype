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
import { aggregate, describeConfidence, describeStance, SignalForMath } from './position-math'

export { describeConfidence, describeStance }

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

  /** Rolled up across every requested target this actor has a signal for. [-1, +1]. */
  stanceScore: number
  /** [0, 1]. */
  confidence: number
  /** The only permitted wording for that number. */
  confidenceWording: string
  /** 'supported' | 'opposed' | 'divided record'. */
  stanceWording: string
  /** Per signal type: how many, and what they were worth after decay and discount. */
  signalCounts: Record<string, { n: number; weight: number }>
  /** The precomputed per-target estimates, where `position_estimate` holds one. */
  byTarget: Array<{ targetType: string; targetId: string; stanceScore: number; confidence: number }>
  /** Every signal, as a citation. Most recent first. */
  grounds: Ground[]
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
  /** Ranked: the strongest, best-evidenced records first. */
  actors: ActorPosition[]
  /** Targets that resolved to no signal at all. Naming them is the never-claim rule (design §6). */
  targetsWithNoSignals: PositionTarget[]
  /** How many actors matched before `limit` and `minConfidence` were applied. */
  actorsMatched: number
  asOf: string
  configVersion: string | null
  elapsedMs: number
}

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
         COALESCE(d.source_url, cs."sourceUrl")                                    AS source_url
    FROM unnest($1::text[], $2::text[]) AS want(target_type, target_id)
    JOIN position_signal s
      ON s.target_type = want.target_type AND s.target_id = want.target_id
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

  const empty: PositionsResult = {
    actors: [], targetsWithNoSignals: targets, actorsMatched: 0, asOf,
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

  // The per-target precomputed estimates, for the same actors and targets.
  const { rows: estRows } = await pool.query<{
    actor_id: string; target_type: string; target_id: string
    stance_score: number; confidence: number; config_version: string
  }>(`SELECT e.actor_id::text, e.target_type, e.target_id, e.stance_score, e.confidence, e.config_version
        FROM unnest($1::text[], $2::text[]) AS want(target_type, target_id)
        JOIN position_estimate e
          ON e.target_type = want.target_type AND e.target_id = want.target_id
       WHERE e.actor_id = ANY($3::bigint[])`,
    [types, ids, [...byActor.keys()]])
  const estByActor = new Map<string, PositionsResult['actors'][number]['byTarget']>()
  for (const e of estRows) {
    const list = estByActor.get(e.actor_id) ?? []
    list.push({ targetType: e.target_type, targetId: e.target_id, stanceScore: e.stance_score, confidence: e.confidence })
    estByActor.set(e.actor_id, list)
  }

  const actors: ActorPosition[] = []
  for (const [actorId, sigs] of byActor) {
    const forMath: SignalForMath[] = sigs.map((s) => ({
      id: s.signal_ref,
      signalType: s.signal_type as SignalForMath['signalType'],
      derivation: s.derivation,
      direction: s.direction,
      rawWeight: s.raw_weight,
      observedAt: s.observed_at,
    }))
    const agg = aggregate(forMath, asOf, POSITION_CONFIG)
    if (agg.confidence < minConfidence) continue
    const head = sigs[0]
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
      confidence: agg.confidence,
      confidenceWording: describeConfidence(agg.confidence),
      stanceWording: describeStance(agg.stanceScore),
      signalCounts: agg.signalCounts,
      byTarget: estByActor.get(actorId) ?? [],
      grounds,
    })
  }

  // Rank by how much there is to say and how firmly: |stance| × confidence. An actor with a strong
  // record either way outranks one with a thin one, and a divided record does not float to the top
  // just because it has many signals.
  actors.sort((a, b) =>
    Math.abs(b.stanceScore) * b.confidence - Math.abs(a.stanceScore) * a.confidence ||
    b.confidence - a.confidence ||
    (a.name < b.name ? -1 : 1))

  return {
    actors: actors.slice(0, limit),
    targetsWithNoSignals,
    actorsMatched: actors.length,
    asOf,
    configVersion: estRows[0]?.config_version ?? null,
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
