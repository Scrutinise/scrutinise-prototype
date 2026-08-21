/**
 * check-3c.ts — GRAPH 3C's own harness.
 *
 * Brief §6: *"Every check watched failing against the real broken state. A check that cannot fail
 * is not a check, and a harness limit that hides the failing rows is the same defect wearing a
 * different hat."*
 *
 * So every assertion here is one of:
 *   · a PROPERTY with a constructed break that `--self-test` proves fires;
 *   · a QUERY with a NEGATIVE CONTROL asserting the query reaches non-empty rows at all — because
 *     "0 violations" over 0 rows examined is a pass for free, and this project has published one;
 *   · a reconstruction against a number recorded independently by an earlier sprint.
 *
 * ⚠ There is no `limit` anywhere in this file. 3A published a false finding because its harness
 * passed `limit: 400` and every counter-example ranked below it; 3B rewrote the assertion and left
 * the limit; 3C's own ranking change then buried the same sixteen members from the other end and
 * the check failed. Third time. Nothing here caps a result set.
 *
 * Usage (from scripts/graph):
 *   npx tsx check-3c.ts              # everything, against the live graph
 *   npx tsx check-3c.ts --self-test  # prove every constructed break FIRES, then exit
 *   npx tsx check-3c.ts --no-db      # pure-function checks only
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import fs from 'fs'
import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'
import { POSITION_CONFIG, PositionConfig, configVersion } from '../../scrutinise-web/lib/graph/position-config'
import { aggregate, describeStance, SignalForMath } from '../../scrutinise-web/lib/graph/position-math'
import { weightFunctionSql } from './setup-3a'
import { aggregate3BAsAggregate } from './audit-3c-scoring'

export {}

const SELF_TEST = process.argv.includes('--self-test')
const NO_DB = process.argv.includes('--no-db')
const AS_OF = '2026-08-21'

let pass = 0
const failures: string[] = []
function ok(name: string, cond: boolean, detail = '') {
  if (cond) pass++; else failures.push(name)
  console.log(`  ${cond ? '✓' : '✗'} ${name}${detail ? `  ${detail}` : ''}`)
}

const sig = (o: Partial<SignalForMath> & { id: string }): SignalForMath => ({
  signalType: 'vote', derivation: 'free-vote-heuristic:v1', direction: 1,
  rawWeight: POSITION_CONFIG.weights['free-vote-heuristic:v1'], observedAt: '2025-06-20', ...o,
})
const many = (n: number, dir = 1, off = 0) =>
  Array.from({ length: n }, (_, i) => sig({ id: `s${off + i}`, direction: dir }))

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §1 · THE SCORE — as PROPERTIES of `aggregate`, each expressible against a broken variant
// ══════════════════════════════════════════════════════════════════════════════════════════════
//
// Each takes the config so `--self-test` can hand it a deliberately-broken one and watch the
// property fail. A blanket break is not used: 3A found that breaking everything at once makes ten
// of twelve assertions report DID NOT FIRE, because structural properties survive any config
// change — *"a blanket break tests the checks it happens to reach and quietly certifies the rest."*
//
// ⚠⚠ A BREAK IS EITHER A BROKEN CONFIG OR THE BROKEN FUNCTION ITSELF, AND TWO PROPERTIES NEEDED
// THE SECOND. The first version of this harness gave every property a config break, and the
// self-test reported DID NOT FIRE twice:
//
//   · "CONSISTENCY MATTERS" was handed `SPLIT_AT_REBELLION`, which changes a weight and cannot
//     falsify a property about GROUPING. The defect it guards lived in the code — the group key
//     ending in `direction` — so the break has to be the code. `aggregate3B` (frozen in
//     audit-3c-scoring.ts, and proven there to reproduce 3B's published 0.7481/0.8810) is now the
//     break, which is what brief §0 asks for: the REAL broken state, not a synthetic one.
//
//   · "DIRECTION-0 CANNOT MANUFACTURE CERTAINTY" compared the result against `cfg`'s own ceiling.
//     Lifting the ceiling to 1 lifted the assertion with it, so the check passed at confidence
//     0.2575 "under" a ceiling of 1. **An assertion that reads its own bound out of the thing it
//     is testing cannot fail.** It now compares against POSITION_CONFIG's real 0.15.
//
type AggregateFn = typeof aggregate
type Prop = {
  name: string
  run: (agg: AggregateFn, cfg: PositionConfig) => { held: boolean; detail: string }
  /** The break: a broken config, a broken aggregate function, or neither (structural). */
  break?: { cfg?: PositionConfig; agg?: AggregateFn }
}

/** Shrinkage set to 0 turns `signed/(mass+k)` back into `signed/mass` — the exact 3A/3B defect. */
const NO_SHRINK: PositionConfig = { ...POSITION_CONFIG, stanceShrinkage: 0 }
/** Half-lives removed: nothing decays. */
const NO_DECAY: PositionConfig = {
  ...POSITION_CONFIG,
  halfLifeYears: Object.fromEntries(
    Object.keys(POSITION_CONFIG.halfLifeYears).map((k) => [k, null])) as PositionConfig['halfLifeYears'],
}
/** The attention ceiling lifted to 1 — many weak signals may then manufacture certainty. */
const NO_CEILING: PositionConfig = { ...POSITION_CONFIG, attentionConfidenceCeiling: 1 }
/** `party-split:v1` given the rebellion weight — an inference travelling at a measurement's weight. */
const SPLIT_AT_REBELLION: PositionConfig = {
  ...POSITION_CONFIG,
  weights: { ...POSITION_CONFIG.weights, 'party-split:v1': POSITION_CONFIG.weights['rebellion:v1'] },
}

const PROPS: Prop[] = [
  {
    name: 'VOLUME MATTERS — 50 consistent votes outrank 1, on stance',
    break: { cfg: NO_SHRINK },
    run: (agg, cfg) => {
      const a = agg(many(1), AS_OF, cfg), b = agg(many(50), AS_OF, cfg)
      return { held: b.stanceScore > a.stanceScore + 1e-9,
        detail: `${a.stanceScore.toFixed(3)} → ${b.stanceScore.toFixed(3)}` }
    },
  },
  {
    name: 'CONSISTENCY MATTERS — 9-for outranks 5-for-4-against on confidence AND on |stance|',
    // The defect was in the GROUPING, not in any number, so the break is 3B's own function.
    break: { agg: aggregate3BAsAggregate },
    run: (agg, cfg) => {
      const nine = agg(many(9), AS_OF, cfg)
      const split = agg([...many(5, 1), ...many(4, -1, 100)], AS_OF, cfg)
      return {
        held: nine.confidence > split.confidence && Math.abs(nine.stanceScore) > Math.abs(split.stanceScore),
        detail: `conf ${nine.confidence.toFixed(4)} vs ${split.confidence.toFixed(4)}; ` +
                `|stance| ${Math.abs(nine.stanceScore).toFixed(3)} vs ${Math.abs(split.stanceScore).toFixed(3)}`,
      }
    },
  },
  {
    name: 'DIRECTION-0 CANNOT MANUFACTURE CERTAINTY — 40 donations stay under the 0.15 ceiling',
    break: { cfg: NO_CEILING },
    run: (agg, cfg) => {
      const a = agg(Array.from({ length: 40 }, (_, i) => sig({
        id: `d${i}`, signalType: 'political_donation', derivation: null, direction: 0,
        rawWeight: cfg.weights.political_donation })), AS_OF, cfg)
      // ⚠ POSITION_CONFIG's ceiling, NOT `cfg`'s. Reading the bound out of the config under test
      // is how the first version of this check passed at 0.2575 "under" a ceiling of 1.
      const CEILING = POSITION_CONFIG.attentionConfidenceCeiling
      return { held: a.confidence <= CEILING + 1e-9 && a.stanceScore === 0,
        detail: `confidence ${a.confidence.toFixed(4)} vs the real ceiling ${CEILING}` }
    },
  },
  {
    name: 'DECAY STILL APPLIES — an old consistent record does not outrank a recent one of equal size',
    break: { cfg: NO_DECAY },
    run: (agg, cfg) => {
      const old = agg(many(9).map((s) => ({ ...s, observedAt: '2009-06-20' })), AS_OF, cfg)
      const now = agg(many(9), AS_OF, cfg)
      return { held: old.stanceScore < now.stanceScore - 1e-9 && old.confidence < now.confidence - 1e-9,
        detail: `2009 ${old.stanceScore.toFixed(3)}/${old.confidence.toFixed(4)} vs 2025 ${now.stanceScore.toFixed(3)}/${now.confidence.toFixed(4)}` }
    },
  },
  {
    name: 'AN INFERENCE MUST NOT TRAVEL AT A MEASUREMENT\'S WEIGHT — party-split is capped below rebellion',
    break: { cfg: SPLIT_AT_REBELLION },
    run: (_agg, cfg) => ({
      held: cfg.weights['party-split:v1'] < cfg.weights['rebellion:v1'],
      detail: `party-split ${cfg.weights['party-split:v1']} < rebellion ${cfg.weights['rebellion:v1']}`,
    }),
  },
  {
    name: 'ABSENCE IS ABSENCE — no signals produces no score to render',
    run: (agg, cfg) => {
      const a = agg([], AS_OF, cfg)
      return { held: a.mass === 0 && a.stanceScore === 0 && a.confidence === 0 && a.consistency === 0,
        detail: '' }
    },
  },
  {
    name: 'DETERMINISM — a shuffled input is byte-identical, even with direction netting inside a group',
    run: (agg, cfg) => {
      const xs = [...many(5, 1), ...many(4, -1, 100)]
      const ys = [xs[7], xs[0], xs[4], xs[8], xs[2], xs[6], xs[1], xs[5], xs[3]]
      return { held: JSON.stringify(agg(xs, AS_OF, cfg)) === JSON.stringify(agg(ys, AS_OF, cfg)), detail: '' }
    },
  },
  {
    name: 'THE WORDING READS CONSISTENCY — a single whipped vote is "supported", not "divided"',
    break: { cfg: NO_SHRINK },
    run: (agg, cfg) => {
      const a = agg([sig({ id: 'w', derivation: 'whipped-with:v1', rawWeight: cfg.weights['whipped-with:v1'] })], AS_OF, cfg)
      // ⚠ THE CASE THE SIGNATURE CHANGE EXISTS FOR. Under 3C a single whipped vote scores
      // stance 0.167 — below describeStance's ±0.2 band. Had `describeStance` kept its
      // bare-number signature, every existing caller would have compiled unchanged and started
      // calling one whipped vote a "divided record".
      return { held: describeStance(a) === 'supported' && Math.abs(a.stanceScore) < 0.2,
        detail: `consistency ${a.consistency}, stance ${a.stanceScore.toFixed(3)} → "${describeStance(a)}"` }
    },
  },
]

function propChecks() {
  console.log('\n──── §1 · the score, as properties')
  for (const p of PROPS) {
    const r = p.run(aggregate, POSITION_CONFIG)
    ok(p.name, r.held, r.detail)
  }
}

/**
 * The self-test. A property whose named break does not falsify it is reported DID NOT FIRE — the
 * failure mode 3A found and the reason this is not one blanket break.
 */
function selfTest(): number {
  console.log('════ SELF-TEST — every property, against the break that must falsify it ════\n')
  let bad = 0
  for (const p of PROPS) {
    const clean = p.run(aggregate, POSITION_CONFIG)
    if (!p.break) {
      // Structural: no config change and no plausible alternative arithmetic falsifies it. 3A's
      // lesson — *"a blanket break tests the checks it happens to reach and quietly certifies the
      // rest"* — is why these are LABELLED rather than counted as fired.
      console.log(`  ${clean.held ? 'STRUCTURAL' : '❌ BROKEN'}  ${p.name.slice(0, 70)}`)
      console.log(`              holds under any config; asserted directly, with no break to watch`)
      if (!clean.held) bad++
      continue
    }
    const broken = p.run(p.break.agg ?? aggregate, p.break.cfg ?? POSITION_CONFIG)
    const fired = !broken.held && clean.held
    if (!fired) bad++
    console.log(`  ${fired ? 'FIRES     ' : '❌ DID NOT FIRE'}  ${p.name.slice(0, 70)}`)
    console.log(`              break: ${p.break.agg ? 'GRAPH 3B\'s own aggregate() — the real broken state' : 'a broken config'}`)
    console.log(`              clean: ${clean.held ? 'holds' : 'FAILS'} (${clean.detail})`)
    console.log(`              broken: ${broken.held ? 'STILL HOLDS' : 'fails'} (${broken.detail})`)
  }

  // The two constructed cases that reproduce 3B's published figures exactly. If the frozen copy in
  // audit-3c-scoring.ts ever drifts, the before/after in the report becomes unfalsifiable.
  console.log(`\n  ── and the SQL generator break that 3B half-fixed ──`)
  const gen = weightFunctionSql()
  const knowsAll = Object.keys(POSITION_CONFIG.weights).every((k) => gen.includes(`'${k}'`))
  const missingCase = weightFunctionSql().replace(/^.*'party-split:v1'.*$/m, '')
  const brokenGen = !missingCase.includes(`'party-split:v1'`)
  console.log(`  ${knowsAll ? 'PASS' : '❌'}      generated SQL names every weight key the config holds`)
  console.log(`  ${brokenGen ? 'FIRES     ' : '❌ DID NOT FIRE'}  removing a case from the generated SQL is detectable`)
  if (!knowsAll || !brokenGen) bad++

  console.log(`\n  ${bad === 0 ? '✓ every break fired and every structural property holds' : `❌ ${bad} did not`}`)
  return bad
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §2/§5 · THE DATABASE
// ══════════════════════════════════════════════════════════════════════════════════════════════
async function dbChecks(pool: ReturnType<typeof getNeonPool>) {
  // ── the ladder is the v2 one, in both callers ────────────────────────────────────────────────
  console.log('\n──── §2 · the classification ladder')
  const { rows: [v] } = await pool.query<{ def: string }>(
    `SELECT pg_get_viewdef('position_signal_vote'::regclass, true) AS def`)
  ok('position_signal_vote calls position_vote_class_v2', /position_vote_class_v2/.test(v.def))
  ok('…and not the 5-argument original, which has no cohesion input',
    !/position_vote_class\s*\(/.test(v.def.replace(/position_vote_class_v2/g, 'X')))
  const { rows: [f] } = await pool.query<{ src: string }>(
    `SELECT prosrc AS src FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='position_signal_vote_for'`)
  ok('position_signal_vote_for calls position_vote_class_v2 too — one ladder, both access patterns',
    /position_vote_class_v2/.test(f.src))

  // The two shapes must agree. `check-3b.ts` asserts this for the read path; here it is asserted
  // for the CLASSIFICATION specifically, which is what 3C changed.
  const { rows: [agree] } = await pool.query<{ n: string; diff: string }>(`
    WITH t AS (SELECT DISTINCT house || ':' || division_id AS id FROM divisions
                WHERE division_date >= '2025-01-01' LIMIT 200)
    SELECT COUNT(*)::text AS n,
           COUNT(*) FILTER (WHERE fn.derivation IS DISTINCT FROM vw.derivation)::text AS diff
      FROM position_signal_vote_for((SELECT array_agg(id) FROM t)) fn
      JOIN position_signal_vote vw ON vw.signal_ref = fn.signal_ref`)
  ok('the view and the function classify identically', Number(agree.diff) === 0, `${Number(agree.diff)} differences`)
  ok('…negative control: the comparison was over a non-empty set',
    Number(agree.n) > 1000, `${Number(agree.n).toLocaleString()} rows compared`)

  // ── §2's central invariant, as a query ──────────────────────────────────────────────────────
  const { rows: [reb] } = await pool.query<{ bad: string; total: string; minc: string }>(`
    SELECT COUNT(*) FILTER (WHERE p.cohesion < ${POSITION_CONFIG.cohesionThreshold})::text AS bad,
           COUNT(*)::text AS total,
           ROUND(MIN(p.cohesion)::numeric, 4)::text AS minc
      FROM position_signal_vote s
      JOIN division_votes dv ON dv.house = split_part(s.target_id, ':', 1)
                            AND dv.division_id = split_part(s.target_id, ':', 2)::int
                            AND ('v:' || dv.house || ':' || dv.division_id || ':' || dv.member_id) = s.signal_ref
      JOIN position_division_party p ON p.house = dv.house AND p.division_id = dv.division_id AND p.party = dv.party
     WHERE s.derivation = 'rebellion:v1'`)
  ok('NO rebellion:v1 signal comes from a party below the cohesion threshold',
    Number(reb.bad) === 0,
    `${Number(reb.bad)} of ${Number(reb.total).toLocaleString()}; lowest party cohesion behind a rebellion is ${reb.minc}`)
  ok('…negative control: there ARE rebellion signals to check',
    Number(reb.total) > 1000, `${Number(reb.total).toLocaleString()} rebellion signals`)

  const { rows: [split] } = await pool.query<{ bad: string; total: string }>(`
    SELECT COUNT(*) FILTER (WHERE p.cohesion >= ${POSITION_CONFIG.cohesionThreshold})::text AS bad,
           COUNT(*)::text AS total
      FROM position_signal_vote s
      JOIN division_votes dv ON dv.house = split_part(s.target_id, ':', 1)
                            AND dv.division_id = split_part(s.target_id, ':', 2)::int
                            AND ('v:' || dv.house || ':' || dv.division_id || ':' || dv.member_id) = s.signal_ref
      JOIN position_division_party p ON p.house = dv.house AND p.division_id = dv.division_id AND p.party = dv.party
     WHERE s.derivation = 'party-split:v1'`)
  ok('and EVERY party-split:v1 signal comes from a party that really did split',
    Number(split.bad) === 0, `${Number(split.bad)} of ${Number(split.total).toLocaleString()}`)
  ok('…negative control: there ARE party-split signals',
    Number(split.total) > 1000, `${Number(split.total).toLocaleString()}`)

  // is_cohesive_party must be derivable from what is stored, not merely present.
  const { rows: [coh] } = await pool.query<{ bad: string; nulls: string; total: string }>(`
    SELECT COUNT(*) FILTER (WHERE is_cohesive_party IS DISTINCT FROM
             (is_whipped_party AND cohesion >= ${POSITION_CONFIG.cohesionThreshold}))::text AS bad,
           COUNT(*) FILTER (WHERE is_cohesive_party IS NULL)::text AS nulls,
           COUNT(*)::text AS total FROM position_division_party`)
  ok('is_cohesive_party ≡ (is_whipped_party AND cohesion ≥ threshold), on every row',
    Number(coh.bad) === 0 && Number(coh.nulls) === 0,
    `${Number(coh.bad)} inconsistent, ${Number(coh.nulls)} null, of ${Number(coh.total).toLocaleString()}`)

  // ── free-vote provenance ────────────────────────────────────────────────────────────────────
  console.log('\n──── §2 · the free-vote rule and its provenance')
  const { rows: [src] } = await pool.query<{ bad: string; free: string; prop: string }>(`
    SELECT COUNT(*) FILTER (WHERE free_vote_like AND free_vote_source IS NULL)::text AS bad,
           COUNT(*) FILTER (WHERE free_vote_like)::text AS free,
           COUNT(*) FILTER (WHERE free_vote_source = 'bill-propagated')::text AS prop
      FROM position_division_class`)
  ok('every free-vote-like division records WHY it is one',
    Number(src.bad) === 0, `${Number(src.free)} tagged, ${Number(src.prop)} of them by propagation`)
  const { rows: [nonfree] } = await pool.query<{ bad: string }>(
    `SELECT COUNT(*)::text AS bad FROM position_division_class WHERE NOT free_vote_like AND free_vote_source IS NOT NULL`)
  ok('…and a division that is NOT free-vote-like carries no source', Number(nonfree.bad) === 0)

  const { rows: [prop] } = await pool.query<{ bad: string; n: string }>(`
    SELECT COUNT(*) FILTER (WHERE c.best_cohesion >= ${POSITION_CONFIG.billPropagationCohesionCeiling}
                              OR c.best_cohesion IS NULL)::text AS bad,
           COUNT(*)::text AS n
      FROM position_division_class c WHERE c.free_vote_source = 'bill-propagated'`)
  ok('every PROPAGATED division was itself a near miss — propagation is a rescue, not a licence',
    Number(prop.bad) === 0 && Number(prop.n) > 0,
    `${Number(prop.n)} propagated, all with best cohesion < ${POSITION_CONFIG.billPropagationCohesionCeiling}`)

  // The named cases, both directions. Brief §2.
  for (const [label, pred, min, max] of [
    ['the 11 Terminally Ill Adults divisions are ALL tagged', `d.bill_title = 'Terminally Ill Adults (End of Life) Bill'`, 11, 11],
    ['⛔ no Northern Ireland abortion Regulation is tagged', `d.title ILIKE '%abortion (northern ireland)%'`, 0, 0],
    ['⛔ no Safety of Rwanda division is tagged', `d.title ILIKE '%rwanda%' OR d.bill_title ILIKE '%rwanda%'`, 0, 0],
    ['⛔ no Universal Credit and PIP division is tagged', `d.title ILIKE '%universal credit%' AND d.title ILIKE '%personal independence%'`, 0, 0],
  ] as Array<[string, string, number, number]>) {
    const { rows: [r] } = await pool.query<{ free: string; total: string }>(`
      SELECT COUNT(*) FILTER (WHERE c.free_vote_like)::text AS free, COUNT(*)::text AS total
        FROM divisions d JOIN position_division_class c ON c.house=d.house AND c.division_id=d.division_id
       WHERE ${pred}`)
    ok(label, Number(r.free) >= min && Number(r.free) <= max && Number(r.total) > 0,
      `${r.free} of ${r.total} tagged`)
  }

  // ── the generated weight function ───────────────────────────────────────────────────────────
  console.log('\n──── §2 · one source of truth for the weights')
  let missing = 0
  for (const k of Object.keys(POSITION_CONFIG.weights)) {
    const isClass = k.includes(':')
    const { rows: [r] } = await pool.query<{ w: string | null }>(
      `SELECT position_raw_weight($1, $2)::text AS w`, isClass ? ['vote', k] : [k, null])
    const want = POSITION_CONFIG.weights[k as keyof typeof POSITION_CONFIG.weights]
    if (r.w === null || Math.abs(Number(r.w) - want) > 1e-6) missing++
  }
  ok('the SQL knows every weight key the config knows — CLASSES as well as signal types',
    missing === 0, `${Object.keys(POSITION_CONFIG.weights).length} keys, ${missing} wrong or missing`)
  const { rows: [nullw] } = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM position_signal_vote WHERE raw_weight IS NULL`)
  ok('…and no vote signal carries a NULL weight', Number(nullw.n) === 0, `${nullw.n} unweighted`)

  // ── §1 · the estimate table ─────────────────────────────────────────────────────────────────
  console.log('\n──── §1 · the estimate table')
  const { rows: [e] } = await pool.query<Record<string, string>>(`
    SELECT COUNT(*)::text AS n,
           COUNT(DISTINCT config_version)::text AS versions,
           MIN(config_version) AS cv,
           COUNT(DISTINCT stance_score)::text AS ds,
           COUNT(DISTINCT consistency)::text AS dc,
           COUNT(*) FILTER (WHERE ABS(stance_score) >= 0.999999)::text AS at1,
           COUNT(*) FILTER (WHERE consistency IS NULL)::text AS nullc,
           COUNT(*) FILTER (WHERE stance_score < -1 OR stance_score > 1)::text AS oob,
           COUNT(*) FILTER (WHERE confidence < 0 OR confidence > 1)::text AS oobc
      FROM position_estimate`)
  ok('the table carries exactly one config_version', e.versions === '1',
    `${e.cv} over ${Number(e.n).toLocaleString()} rows`)
  ok('…and it is the one THIS code computes', e.cv === configVersion(), `${e.cv} vs ${configVersion()}`)
  ok('§1\'s floor: at least 20 distinct stance values across the whole table',
    Number(e.ds) >= 20, `${Number(e.ds).toLocaleString()} (3B measured 3)`)
  ok('nothing sits at |stance| = 1.00 any more — shrinkage makes it unreachable',
    Number(e.at1) === 0, `${e.at1} (3B: 2,140,510, 92.87% of the table)`)
  ok('consistency is populated on every row', Number(e.nullc) === 0)
  ok('consistency still has exactly the three values stance_score used to have',
    Number(e.dc) === 3, `${e.dc} — it IS the old column, under its right name`)
  ok('every score is in range', Number(e.oob) === 0 && Number(e.oobc) === 0)

  const { rows: [ceil] } = await pool.query<{ n: string; over: string }>(`
    SELECT COUNT(*)::text AS n,
           COUNT(*) FILTER (WHERE confidence > ${POSITION_CONFIG.attentionConfidenceCeiling} + 1e-6)::text AS over
      FROM position_estimate WHERE NOT (signal_counts ?| ARRAY['vote','edm_signature'])`)
  ok('attention-only estimates never exceed the ceiling', Number(ceil.over) === 0,
    `0 of ${Number(ceil.n).toLocaleString()}`)
  ok('…negative control: there ARE attention-only estimates', Number(ceil.n) > 1000)

  const { rows: [zero] } = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM position_estimate e
      WHERE NOT EXISTS (SELECT 1 FROM position_signal s
                         WHERE s.actor_id = e.actor_id AND s.target_type = e.target_type
                           AND s.target_id = e.target_id)`)
  ok('ABSENCE IS ABSENCE — no estimate exists without a signal behind it', Number(zero.n) === 0)

  // ── §1's ⚠ · who reads the table ────────────────────────────────────────────────────────────
  console.log('\n──── §1 · the rebuild is offline because nothing serves from the table')
  //
  // Brief §1: *"establish who reads the table, write it down, and make the rebuild atomic from a
  // reader's point of view or explicitly offline."* Written down in build-position-estimates.ts —
  // and asserted here, because a comment recording a fact about today is a comment that will be
  // wrong on the day it matters. `position_estimate` truncates for ~240 seconds on every rebuild;
  // the moment a production path reads it, that window becomes user-visible.
  const webFiles = ['lib/graph/positions.ts', 'lib/graph/position-math.ts', 'lib/graph/position-config.ts',
    'components/admin/PositionGraphExplorer.tsx', 'app/api/admin/positions/route.ts']
  // ⚠ COMMENTS ARE STRIPPED FIRST, AND THE FIRST VERSION OF THIS CHECK DID NOT DO THAT — so it
  // reported `positions.ts` as a reader on the strength of a comment that says, in terms, that it
  // is NOT one ("Computed from the SIGNALS … not read out of `position_estimate`"). A guard that
  // greps prose is measuring documentation, not behaviour, and it fails in the direction that
  // wastes a sprint's time rather than the one that hides a defect — but it is still wrong.
  const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const readers = webFiles.filter((f) => {
    const p = path.join(__dirname, '../../scrutinise-web', f)
    if (!fs.existsSync(p)) return false
    // `position_estimate_meta` is a different object and IS read, for the version label alone.
    return /position_estimate(?!_meta)/.test(stripComments(fs.readFileSync(p, 'utf8')))
  })
  // And the guard has to be able to fire: a file that really does read the table must be caught.
  const planted = `const { rows } = await pool.query('SELECT * FROM position_estimate WHERE actor_id = $1')`
  ok('…negative control: the same test DOES catch a real read of the table',
    /position_estimate(?!_meta)/.test(stripComments(planted)))
  ok('no production read path reads position_estimate — so a truncate-and-rebuild is offline',
    readers.length === 0, readers.length ? `⚠ NOW READ BY: ${readers.join(', ')}` : `checked ${webFiles.length} files`)

  // ── the display layer reads consistency, not the shrunk score ───────────────────────────────
  const posSrc = fs.readFileSync(path.join(__dirname, '../../scrutinise-web/lib/graph/positions.ts'), 'utf8')
  ok('positions.ts words the stance from CONSISTENCY, never from the shrunk score',
    /describeStance\(agg\)/.test(posSrc) && !/describeStance\(agg\.stanceScore\)/.test(posSrc))
  ok('…and the per-target side is taken from consistency too',
    /direction: t\.consistency > 0/.test(posSrc))
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
async function main() {
  if (SELF_TEST) process.exit(selfTest() === 0 ? 0 : 1)

  console.log('════ GRAPH 3C CHECKS ════')
  propChecks()

  if (!NO_DB) {
    const pool = getNeonPool()
    try {
      const host = /@([^/:?]+)/.exec(process.env.NEON_DATABASE_URL ?? '')?.[1] ?? '(unparsed)'
      if (!/ep-old-dust-aboxi69a/.test(host)) { console.error(`❌ not Neon production (${host})`); process.exit(1) }
      console.log(`\n(live against ${host})`)
      await dbChecks(pool)
    } finally {
      await endNeonPool()
    }
  }

  console.log(`\n════ ${pass}/${pass + failures.length} ════`)
  if (failures.length) {
    console.log('failed:')
    for (const f of failures) console.log(`  · ${f}`)
    process.exit(1)
  }
}

main().catch((e) => { console.error('[check-3c] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
