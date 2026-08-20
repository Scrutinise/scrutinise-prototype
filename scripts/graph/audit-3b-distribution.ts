/**
 * audit-3b-distribution.ts — GRAPH 3B §1. THE AUDIT, RUN BEFORE ANYTHING IS BUILT.
 *
 * Charlie's observation on `/admin/positions`: two assisted-dying divisions selected, 555 actors
 * with a signal, "showing the top 40", and the top 40 in ALPHABETICAL ORDER — every one of them at
 * stance exactly ±1.00 and confidence exactly 0.671.
 *
 * Brief §1: audit first, report before building, and do NOT fix it by changing the tie-break.
 *
 * Read-only. Usage (from scripts/graph):
 *     npx tsx audit-3b-distribution.ts
 *     npx tsx audit-3b-distribution.ts --explain     (adds EXPLAIN ANALYZE of the page's query)
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * PREDICTIONS, WRITTEN BEFORE THE FIRST RUN (standing rule: predict, then measure, then report both)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * These are derived from READING position-math.ts, not from having run anything:
 *
 *   P1  Distinct `stance_score` values in the whole 2.3M-row table: **3** — exactly +1, 0 and -1.
 *       Reason: `stanceScore = signed / mass`. A per-division estimate aggregates exactly ONE vote,
 *       so signed/mass is +1 or -1 identically; an EDM estimate aggregates one +1 signature; an
 *       inquiry/organisation estimate is all direction-0, so mass=0 and the function returns 0.
 *       There is no arithmetic path to any other value at one signal per target.
 *   P2  Fraction of ALL estimates at exactly ±1.00: **92.87%** ((2,080,585 + 59,925) / 2,304,748).
 *   P3  Fraction at exactly 0.00: **7.13%** (162,733 inquiry + 1,505 organisation).
 *   P4  Distinct `confidence` values in the whole table: ~**10,000** — confidence varies only with
 *       (weight class × observed date), and there are 5 vote classes over ~2,000 division dates.
 *   P5  In the two-division assisted-dying case: distinct stance values **2** (+1, -1) plus a
 *       handful of 0s for anyone who voted both ways; distinct confidence values **under 10**.
 *   P6  The 9,048 ms is NOT a missing index. `position_signal` is a view whose vote arm joins
 *       `division_votes` -> `graph_entity` -> `position_division_class` -> `position_division_party`,
 *       and the target filter arrives through `unnest`, so the planner has no selective index to
 *       reach for on the union arm. Predicting: a sequential scan of division_votes.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'

export {}

const EXPLAIN = process.argv.includes('--explain')

/**
 * The two divisions Charlie had selected. IDENTIFIED, not assumed: `probe-3b-pair.ts` scores all 55
 * pairs of the 11 assisted-dying divisions against the two numbers the brief reports (555 actors,
 * confidence 0.671) and exactly one pair produces both.
 *
 * ⚠ My first guess was Amendment 12 + Third Reading, which gives 607 actors and 0.6227. Diagnosing
 * the wrong case would have produced a true-sounding explanation of something Charlie never saw.
 */
const PAIR = ['commons:2051', 'commons:2068']

const PREDICTIONS: Record<string, string | number> = {
  distinct_stance_all: 3,
  pct_at_exactly_one: 92.87,
  pct_at_exactly_zero: 7.13,
  distinct_confidence_all: 10000,
  distinct_confidence_pair: '<10',
}

function report(name: string, predicted: string | number, measured: string | number) {
  const hit = String(predicted) === String(measured)
  console.log(`   ${hit ? '✓' : '✗'} ${name.padEnd(28)} predicted ${String(predicted).padStart(10)}   measured ${String(measured).padStart(12)}`)
}

// ── the arithmetic, reimplemented here from position-math.ts so the worked numbers in the report
//    are computed rather than asserted. If these two ever disagree, that is itself the finding.
const SATURATION = 0.9
const conf = (mass: number) => 1 - Math.pow(2, -mass / SATURATION)
const harmonic = (n: number) => { let s = 0; for (let i = 1; i <= n; i++) s += 1 / i; return s }

async function main() {
  const pool = getNeonPool()
  try {
    // ══════════════════════════════════════════════════════════════════════════════════════
    console.log('\n════ §1.1a  THE WHOLE ESTIMATE TABLE — what fraction of it says anything')
    const { rows: [all] } = await pool.query<Record<string, string>>(`
      SELECT COUNT(*)::text                                            AS n,
             COUNT(DISTINCT stance_score)::text                        AS distinct_stance,
             COUNT(DISTINCT confidence)::text                          AS distinct_conf,
             COUNT(*) FILTER (WHERE ABS(stance_score) = 1)::text       AS at_one,
             COUNT(*) FILTER (WHERE stance_score = 0)::text            AS at_zero,
             COUNT(*) FILTER (WHERE ABS(stance_score) < 1
                                AND stance_score <> 0)::text           AS strictly_between,
             MIN(confidence)::text                                     AS min_conf,
             MAX(confidence)::text                                     AS max_conf
        FROM position_estimate`)
    const n = Number(all.n)
    console.log(`   estimates                    ${Number(all.n).toLocaleString()}`)
    console.log(`   distinct stance_score        ${all.distinct_stance}`)
    console.log(`   distinct confidence          ${Number(all.distinct_conf).toLocaleString()}`)
    console.log(`   at exactly ±1.00             ${Number(all.at_one).toLocaleString()}   = ${(100 * Number(all.at_one) / n).toFixed(2)}% OF ALL ESTIMATES`)
    console.log(`   at exactly 0.00              ${Number(all.at_zero).toLocaleString()}   = ${(100 * Number(all.at_zero) / n).toFixed(2)}% OF ALL ESTIMATES`)
    console.log(`   strictly between, non-zero   ${Number(all.strictly_between).toLocaleString()}   = ${(100 * Number(all.strictly_between) / n).toFixed(4)}% OF ALL ESTIMATES`)
    console.log(`   confidence range             ${all.min_conf} … ${all.max_conf}`)

    console.log('\n   PREDICTED vs MEASURED')
    report('distinct stance (all)', PREDICTIONS.distinct_stance_all, all.distinct_stance)
    report('% at exactly ±1.00', PREDICTIONS.pct_at_exactly_one, (100 * Number(all.at_one) / n).toFixed(2))
    report('% at exactly 0.00', PREDICTIONS.pct_at_exactly_zero, (100 * Number(all.at_zero) / n).toFixed(2))
    report('distinct confidence (all)', PREDICTIONS.distinct_confidence_all, all.distinct_conf)

    console.log('\n   stance_score histogram (every distinct value, there are few enough to print)')
    const { rows: sh } = await pool.query<{ v: string; n: string }>(`
      SELECT stance_score::text AS v, COUNT(*)::text AS n
        FROM position_estimate GROUP BY 1 ORDER BY 2::bigint DESC LIMIT 30`)
    for (const r of sh) console.log(`      ${String(r.v).padStart(12)}  ${Number(r.n).toLocaleString().padStart(12)}  ${(100 * Number(r.n) / n).toFixed(2)}%`)

    console.log('\n   by target_type — which layer contributes which values')
    const { rows: bt } = await pool.query<Record<string, string>>(`
      SELECT target_type,
             COUNT(*)::text                                      AS n,
             COUNT(DISTINCT stance_score)::text                   AS d_stance,
             COUNT(DISTINCT confidence)::text                     AS d_conf,
             COUNT(*) FILTER (WHERE ABS(stance_score) = 1)::text  AS at_one,
             ROUND(AVG(confidence)::numeric, 4)::text             AS mean_conf,
             MAX(confidence)::text                                AS max_conf
        FROM position_estimate GROUP BY 1 ORDER BY 2::bigint DESC`)
    console.log('      target_type    rows        d.stance  d.conf   at ±1.00      mean conf  max conf')
    for (const r of bt) {
      console.log(`      ${r.target_type.padEnd(13)} ${Number(r.n).toLocaleString().padStart(11)} ${r.d_stance.padStart(9)} ${Number(r.d_conf).toLocaleString().padStart(7)} ${Number(r.at_one).toLocaleString().padStart(11)} ${r.mean_conf.padStart(14)} ${r.max_conf.padStart(9)}`)
    }

    console.log('\n   confidence histogram, 0.05 buckets, ALL estimates')
    const { rows: ch } = await pool.query<{ b: string; n: string }>(`
      SELECT (FLOOR(confidence * 20) / 20)::text AS b, COUNT(*)::text AS n
        FROM position_estimate GROUP BY 1 ORDER BY 1::numeric`)
    for (const r of ch) {
      const pct = 100 * Number(r.n) / n
      console.log(`      ${Number(r.b).toFixed(2)}–${(Number(r.b) + 0.05).toFixed(2)}  ${Number(r.n).toLocaleString().padStart(12)}  ${pct.toFixed(2).padStart(6)}%  ${'█'.repeat(Math.max(0, Math.round(pct / 2)))}`)
    }

    // ══════════════════════════════════════════════════════════════════════════════════════
    console.log(`\n════ §1.1b  THE TWO-TARGET CASE — ${PAIR.join(' + ')}`)
    // Reproduce exactly what the page does: roll the per-division signals up per actor.
    const { rows: pairSig } = await pool.query<{
      actor_id: string; name: string; target_id: string; direction: number
      derivation: string; raw_weight: number; observed_at: string
    }>(`
      SELECT s.actor_id::text, i.canonical_name AS name, s.target_id, s.direction,
             s.derivation, s.raw_weight, s.observed_at::text
        FROM position_signal s
        JOIN graph_entity_identity i ON i.entity_id = s.actor_id
       WHERE s.target_type = 'division' AND s.target_id = ANY($1::text[])`, [PAIR])
    console.log(`   signal rows returned         ${pairSig.length.toLocaleString()}`)

    const byActor = new Map<string, typeof pairSig>()
    for (const r of pairSig) {
      const l = byActor.get(r.actor_id); if (l) l.push(r); else byActor.set(r.actor_id, [r])
    }
    console.log(`   distinct actors              ${byActor.size.toLocaleString()}`)

    // The page's asOf is "today". Fix it so the report's numbers are reproducible.
    const asOf = new Date().toISOString().slice(0, 10)
    console.log(`   as-of                        ${asOf}`)

    const { aggregate } = await import('../../scrutinise-web/lib/graph/position-math')
    const { POSITION_CONFIG } = await import('../../scrutinise-web/lib/graph/position-config')

    const rolled = [...byActor.entries()].map(([id, sigs]) => {
      const a = aggregate(sigs.map((s, k) => ({
        id: `${id}:${k}`, signalType: 'vote' as const, derivation: s.derivation,
        direction: s.direction, rawWeight: s.raw_weight, observedAt: s.observed_at,
      })), asOf, POSITION_CONFIG)
      return { id, name: sigs[0].name, nSignals: sigs.length, ...a }
    })

    const dStance = new Set(rolled.map((r) => r.stanceScore.toFixed(6)))
    const dConf = new Set(rolled.map((r) => r.confidence.toFixed(6)))
    console.log(`   distinct stance values       ${dStance.size}   -> ${[...dStance].sort().join(', ')}`)
    console.log(`   distinct confidence values   ${dConf.size}   -> ${[...dConf].sort().join(', ')}`)
    report('distinct confidence (pair)', PREDICTIONS.distinct_confidence_pair, dConf.size < 10 ? '<10' : String(dConf.size))

    console.log('\n   the (stance, confidence) pairs actually produced, with how many actors sit on each')
    const cell = new Map<string, { n: number; example: string; sig: number }>()
    for (const r of rolled) {
      const k = `${r.stanceScore.toFixed(3)} / ${r.confidence.toFixed(4)}`
      const c = cell.get(k)
      if (c) c.n += 1
      else cell.set(k, { n: 1, example: r.name, sig: r.nSignals })
    }
    for (const [k, v] of [...cell.entries()].sort((a, b) => b[1].n - a[1].n)) {
      console.log(`      stance/conf ${k.padEnd(20)} ${String(v.n).padStart(4)} actors   (${v.sig} signal(s), e.g. ${v.example})`)
    }

    console.log('\n   ⚠ THE FAILURE, STATED AS A NUMBER: how many actors the ranking can separate')
    const topSlice = rolled
      .slice()
      .sort((a, b) => Math.abs(b.stanceScore) * b.confidence - Math.abs(a.stanceScore) * a.confidence
        || b.confidence - a.confidence || (a.name < b.name ? -1 : 1))
    const topKey = (r: typeof topSlice[number]) => `${Math.abs(r.stanceScore) * r.confidence}`
    const tiedWithFirst = topSlice.filter((r) => topKey(r) === topKey(topSlice[0])).length
    console.log(`      actors tied with the #1 rank key: ${tiedWithFirst} of ${rolled.length}`)
    console.log(`      the page shows 40. ${tiedWithFirst >= 40 ? 'ALL FORTY ARE TIED — the order is the name order and nothing else.' : 'The top 40 are NOT all tied.'}`)
    console.log(`      first five as the page orders them: ${topSlice.slice(0, 5).map((r) => r.name).join(', ')}`)

    // ══════════════════════════════════════════════════════════════════════════════════════
    // Why 0.671 and not 0.5546: the two divisions fall in DIFFERENT weight classes, so the harmonic
    // discount never applies and both signals count in full. 2051 is not tagged free-vote-like, so
    // its signals are rebellion:v1 (0.9) / whipped-with:v1 (0.2); 2068 is, so its signals are
    // free-vote-heuristic:v1 (0.7).
    console.log('\n════ §1.1c  WHY THE HEURISTIC MISSING ONE DIVISION MATTERS MORE THAN IT LOOKS')
    const { rows: cls } = await pool.query<{ target_id: string; fv: boolean; derivation: string; n: string; w: string }>(`
      SELECT s.target_id, c.free_vote_like AS fv, s.derivation, COUNT(*)::text AS n,
             MAX(s.raw_weight)::text AS w
        FROM position_signal s
        JOIN position_division_class c
          ON c.house = split_part(s.target_id, ':', 1)
         AND c.division_id = split_part(s.target_id, ':', 2)::int
       WHERE s.target_type = 'division' AND s.target_id = ANY($1::text[])
       GROUP BY 1,2,3 ORDER BY 1,3`, [PAIR])
    for (const r of cls) console.log(`   ${r.target_id}  free_vote_like=${String(r.fv).padEnd(5)}  ${r.derivation.padEnd(28)} n=${String(r.n).padStart(4)}  weight ${r.w}`)

    console.log('\n   ⚠ 3A\'s report says a missed free vote "is scored at the whipped weight (0.2), which')
    console.log('     understates rather than overstates". Test that claim across ALL 11 divisions on this')
    console.log('     Bill — every one of which is a free vote as a matter of public record:')
    const { rows: missed } = await pool.query<Record<string, string>>(`
      WITH ad AS (SELECT house, division_id, house || ':' || division_id AS tid FROM divisions
                   WHERE title ILIKE '%Terminally Ill Adults%' OR bill_title ILIKE '%Terminally Ill Adults%')
      SELECT c.free_vote_like::text AS fv, s.derivation, COUNT(*)::text AS signals,
             MAX(s.raw_weight)::text AS weight
        FROM position_signal s
        JOIN ad ON ad.tid = s.target_id
        JOIN position_division_class c ON c.house = ad.house AND c.division_id = ad.division_id
       WHERE s.target_type = 'division'
       GROUP BY 1,2 ORDER BY 1,3::bigint DESC`)
    for (const r of missed) console.log(`      free_vote_like=${r.fv.padEnd(5)}  ${r.derivation.padEnd(28)} ${Number(r.signals).toLocaleString().padStart(6)} signals at weight ${r.weight}`)

    // ══════════════════════════════════════════════════════════════════════════════════════
    console.log('\n════ §1.2  THE SATURATING FUNCTION, WITH THE ARITHMETIC WRITTEN OUT')
    console.log(`   confidence(mass) = 1 - 2^(-mass / ${SATURATION})`)
    console.log('   mass for N signals of ONE class in ONE direction = weight × H(N)  (harmonic discount)')
    console.log('\n   N      H(N)     free vote w=0.7          rebellion w=0.9         whipped w=0.2')
    console.log('                    mass    conf   Δ         mass    conf   Δ        mass    conf   Δ')
    let prev = { f: 0, r: 0, w: 0 }
    for (const N of [1, 2, 3, 5, 10, 20, 50]) {
      const H = harmonic(N)
      const f = conf(0.7 * H), r = conf(0.9 * H), w = conf(0.2 * H)
      console.log(`   ${String(N).padStart(2)}   ${H.toFixed(4)}   ${(0.7 * H).toFixed(3).padStart(6)} ${f.toFixed(4)} ${(f - prev.f >= 0 ? '+' : '') + (f - prev.f).toFixed(4)}   ${(0.9 * H).toFixed(3).padStart(6)} ${r.toFixed(4)} ${(r - prev.r >= 0 ? '+' : '') + (r - prev.r).toFixed(4)}   ${(0.2 * H).toFixed(3).padStart(6)} ${w.toFixed(4)} ${(w - prev.w >= 0 ? '+' : '') + (w - prev.w).toFixed(4)}`)
      prev = { f, r, w }
    }
    console.log('\n   the same, WITHOUT the harmonic discount (mass = weight × N), for comparison')
    console.log('   N      free vote   rebellion   whipped')
    for (const N of [1, 2, 3, 5, 10, 20, 50]) {
      console.log(`   ${String(N).padStart(2)}     ${conf(0.7 * N).toFixed(4)}      ${conf(0.9 * N).toFixed(4)}      ${conf(0.2 * N).toFixed(4)}`)
    }

    // ══════════════════════════════════════════════════════════════════════════════════════
    console.log('\n════ §1.3  WHAT WOULD DISCRIMINATE — the evidence for each candidate')
    const { rows: [spread] } = await pool.query<Record<string, string>>(`
      WITH per_actor AS (
        SELECT actor_id, COUNT(*) AS n_signals,
               COUNT(DISTINCT derivation) AS n_classes,
               COUNT(DISTINCT direction) AS n_directions,
               MAX(observed_at) - MIN(observed_at) AS day_spread
          FROM position_signal
         WHERE target_type = 'division' AND target_id = ANY($1::text[])
         GROUP BY actor_id)
      SELECT COUNT(*)::text AS actors,
             COUNT(*) FILTER (WHERE n_signals = 1)::text AS one_signal,
             COUNT(*) FILTER (WHERE n_signals = 2)::text AS two_signals,
             COUNT(*) FILTER (WHERE n_directions > 1)::text AS inconsistent,
             COUNT(*) FILTER (WHERE n_classes > 1)::text AS mixed_class,
             ROUND(AVG(day_spread)::numeric, 1)::text AS mean_day_spread
        FROM per_actor`, [PAIR])
    console.log('   on the two-division case:', JSON.stringify(spread))

    console.log('\n   the same shape over the WHOLE assisted-dying bill (all 11 divisions) — the case')
    console.log('   where a discriminating score would actually have something to discriminate on')
    const { rows: allAd } = await pool.query<Record<string, string>>(`
      WITH ad AS (SELECT house || ':' || division_id AS tid FROM divisions
                   WHERE title ILIKE '%Terminally Ill Adults%' OR bill_title ILIKE '%Terminally Ill Adults%'),
      per_actor AS (
        SELECT s.actor_id, COUNT(*) AS n_signals,
               COUNT(DISTINCT s.derivation) AS n_classes,
               COUNT(DISTINCT s.direction) AS n_directions
          FROM position_signal s JOIN ad ON ad.tid = s.target_id
         WHERE s.target_type = 'division' GROUP BY s.actor_id)
      SELECT n_signals::text, COUNT(*)::text AS actors,
             COUNT(*) FILTER (WHERE n_directions = 1)::text AS all_one_way,
             COUNT(*) FILTER (WHERE n_classes > 1)::text AS mixed_class
        FROM per_actor GROUP BY 1 ORDER BY 1::int`)
    console.log('      n signals   actors   all one way   mixed class')
    for (const r of allAd) console.log(`      ${r.n_signals.padStart(9)} ${r.actors.padStart(8)} ${r.all_one_way.padStart(13)} ${r.mixed_class.padStart(13)}`)

    console.log('\n   signal-type mix across the WHOLE graph — how often an actor has more than votes')
    const { rows: mix } = await pool.query<{ n_types: string; actors: string }>(`
      SELECT n_types::text, COUNT(*)::text AS actors FROM (
        SELECT actor_id, COUNT(DISTINCT signal_type) AS n_types
          FROM position_signal GROUP BY actor_id) t
      GROUP BY 1 ORDER BY 1::int`)
    for (const r of mix) console.log(`      ${r.n_types} signal type(s): ${Number(r.actors).toLocaleString()} actors`)

    // ══════════════════════════════════════════════════════════════════════════════════════
    if (EXPLAIN) {
      console.log('\n════ §1.4  WHERE THE 9,048 ms GOES')
      const t0 = Date.now()
      await pool.query(`
        SELECT s.actor_id FROM unnest($1::text[], $2::text[]) AS want(target_type, target_id)
          JOIN position_signal s ON s.target_type = want.target_type AND s.target_id = want.target_id`,
        [PAIR.map(() => 'division'), PAIR])
      console.log(`   bare signal join, no identity/label joins: ${Date.now() - t0} ms`)

      const { rows: plan } = await pool.query<{ 'QUERY PLAN': string }>(
        `EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
         SELECT s.actor_id FROM unnest($1::text[], $2::text[]) AS want(target_type, target_id)
           JOIN position_signal s ON s.target_type = want.target_type AND s.target_id = want.target_id`,
        [PAIR.map(() => 'division'), PAIR])
      for (const p of plan) console.log('      ' + p['QUERY PLAN'])
    } else {
      console.log('\n   (rerun with --explain for the query plan of the page\'s query)')
    }
  } finally {
    await endNeonPool()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
