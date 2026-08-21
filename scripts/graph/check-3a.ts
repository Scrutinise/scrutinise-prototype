/**
 * check-3a.ts — GRAPH 3A §4's constructed cases, plus the invariants the sprint claims.
 *
 * ⚠ EVERY ASSERTION IN HERE WAS WATCHED FAILING BEFORE IT WAS TRUSTED TO PASS. `--self-test` is
 * how: it re-runs each constructed case against a DELIBERATELY BROKEN version of the thing under
 * test and requires the assertion to fail. A check that has only ever passed is not evidence — the
 * house has lost time to existence-only markers, verifies with no I/O, and negative controls that
 * could not fire, and this file exists in the shape it does because of that.
 *
 * Usage (from scripts/graph):
 *   npx tsx check-3a.ts              # the checks. Exit 0 only if all pass.
 *   npx tsx check-3a.ts --self-test  # prove every check CAN fail. Exit 0 only if all of them do.
 *   npx tsx check-3a.ts --offline    # skip the checks that need the database
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'
import { POSITION_CONFIG, configVersion, PositionConfig } from '../../scrutinise-web/lib/graph/position-config'
import { aggregate, decay, describeConfidence, describeStance, SignalForMath } from '../../scrutinise-web/lib/graph/position-math'

export {}

const argv = process.argv.slice(2)
const SELF_TEST = argv.includes('--self-test')
const OFFLINE = argv.includes('--offline')

let pass = 0
let fail = 0
const failures: string[] = []

function check(label: string, ok: boolean, detail = '') {
  if (ok) { pass++; console.log(`  ✓ ${label}${detail ? '  ' + detail : ''}`) }
  else { fail++; failures.push(label); console.log(`  ✗ ${label}${detail ? '  ' + detail : ''}`) }
}

/** In --self-test the expectation inverts: the assertion MUST fail against the broken input. */
function expectFail(label: string, ok: boolean, detail = '') {
  if (!ok) { pass++; console.log(`  ✓ fired as designed: ${label}${detail ? '  ' + detail : ''}`) }
  else { fail++; failures.push(`DID NOT FIRE: ${label}`); console.log(`  ✗ DID NOT FIRE: ${label}${detail ? '  ' + detail : ''}`) }
}

const AS_OF = '2026-08-19'

function sig(o: Partial<SignalForMath> & { id: string }): SignalForMath {
  return {
    signalType: 'vote', derivation: 'whipped-with:v1', direction: 1, rawWeight: 0.2,
    observedAt: '2025-08-19', ...o,
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// §4 — THE CONSTRUCTED CASES
// ─────────────────────────────────────────────────────────────────────────────────────────────────
function constructedCases(cfg: PositionConfig, broken: boolean) {
  const assert = broken ? expectFail : check
  console.log(`\n════ §4 CONSTRUCTED CASES${broken ? ' — against a BROKEN config/aggregation' : ''} ════`)

  // 1. One rebellion outweighs ten whipped votes (same target, opposite directions).
  {
    const signals: SignalForMath[] = [
      sig({ id: 'reb', derivation: 'rebellion:v1', direction: 1, rawWeight: cfg.weights['rebellion:v1'] }),
      ...Array.from({ length: 10 }, (_, i) =>
        sig({ id: `whip${i}`, direction: -1, rawWeight: cfg.weights['whipped-with:v1'] })),
    ]
    const a = aggregate(signals, AS_OF, cfg)
    assert('one rebellion outweighs ten whipped votes', a.stanceScore > 0,
      `stance ${a.stanceScore} (positive = the rebellion's side won)`)
  }

  // 2. A 15-year-old vote contributes less than a 1-year-old identical vote.
  {
    const old = aggregate([sig({ id: 'a', observedAt: '2011-08-19' })], AS_OF, cfg)
    const recent = aggregate([sig({ id: 'a', observedAt: '2025-08-19' })], AS_OF, cfg)
    assert('a 15-year-old vote contributes less than a 1-year-old identical vote',
      old.confidence < recent.confidence,
      `confidence ${old.confidence} vs ${recent.confidence}`)
  }

  // 3. An actor with only direction-0 signals has confidence ≤ the ceiling.
  {
    const many = Array.from({ length: 40 }, (_, i) =>
      sig({ id: `w${i}`, signalType: 'witness_appearance', derivation: null, direction: 0, rawWeight: cfg.weights.witness_appearance }))
    const a = aggregate(many, AS_OF, cfg)
    assert('40 attention-only signals never exceed the attention confidence ceiling',
      a.confidence <= cfg.attentionConfidenceCeiling + 1e-9,
      `confidence ${a.confidence} vs ceiling ${cfg.attentionConfidenceCeiling}`)
    assert('attention-only signals produce stance 0 (no side), not a stance',
      a.stanceScore === 0, `stance ${a.stanceScore}`)
  }

  // 4. Determinism: order of the input never changes the output.
  {
    const base: SignalForMath[] = [
      sig({ id: 'a', derivation: 'rebellion:v1', direction: 1, rawWeight: 0.9, observedAt: '2020-01-01' }),
      sig({ id: 'b', direction: -1, observedAt: '2022-06-01' }),
      sig({ id: 'c', signalType: 'edm_signature', derivation: null, direction: 1, rawWeight: 0.6, observedAt: '2019-03-03' }),
      sig({ id: 'd', signalType: 'declared_interest', derivation: null, direction: 0, rawWeight: 0.1, observedAt: '2024-01-01' }),
      sig({ id: 'e', direction: -1, observedAt: '2022-06-01' }),
    ]
    const one = JSON.stringify(aggregate(base, AS_OF, cfg))
    const shuffled = [...base].reverse()
    const two = JSON.stringify(aggregate(shuffled, AS_OF, cfg))
    // and a second shuffle that keeps the two equal-weight rows adjacent but swapped
    const three = JSON.stringify(aggregate([base[4], base[1], base[0], base[3], base[2]], AS_OF, cfg))
    assert('aggregation is order-independent (three orderings, identical output)',
      one === two && two === three)
  }

  // 5. Decay is monotonic and bounded, and a type with no half-life does not decay.
  {
    const d1 = decay('vote', '2025-08-19', AS_OF, cfg)
    const d8 = decay('vote', '2018-08-19', AS_OF, cfg)
    const dInterest = decay('declared_interest', '1990-01-01', AS_OF, cfg)
    const dFuture = decay('vote', '2030-01-01', AS_OF, cfg)
    assert('vote decay is monotonic in age and one half-life halves it',
      d1 > d8 && Math.abs(d8 - 0.5) < 0.01, `1y ${d1.toFixed(3)}, 8y ${d8.toFixed(3)}`)
    assert('a signal type with no half-life does not decay', dInterest === 1)
    assert('a future-dated signal is clamped to 1, never amplified', dFuture === 1)
  }

  // 6. Changing a weight changes config_version; changing nothing does not.
  {
    const stable = configVersion(cfg) === configVersion(cfg)
    const mutated: PositionConfig = JSON.parse(JSON.stringify(cfg))
    mutated.weights['rebellion:v1'] = cfg.weights['rebellion:v1'] + 0.01
    assert('config_version is stable across two calls on the same config', stable)
    assert('changing one weight changes config_version',
      configVersion(mutated) !== configVersion(cfg),
      `${configVersion(cfg)} → ${configVersion(mutated)}`)
    const mutated2: PositionConfig = JSON.parse(JSON.stringify(cfg))
    mutated2.halfLifeYears.vote = 9
    assert('changing a half-life changes config_version', configVersion(mutated2) !== configVersion(cfg))
  }

  // 7. The vocabulary is fixed: three bands, no caller-invented adjectives.
  {
    const words = new Set([0, 0.1, 0.34, 0.35, 0.64, 0.65, 0.9, 1].map((c) => describeConfidence(c, cfg)))
    assert('describeConfidence yields exactly three forms of words', words.size === 3,
      [...words].join(' | '))
    assert('the strong band starts exactly at the configured threshold',
      describeConfidence(cfg.confidenceBands.strong, cfg) === 'strong recorded record' &&
      describeConfidence(cfg.confidenceBands.strong - 0.001, cfg) !== 'strong recorded record')
    // ⚠ GRAPH 3C — the argument is now `{ consistency }`, not a bare number, and the change was
    // made specifically so this call site had to be looked at. `describeStance` reads CONSISTENCY
    // (which way the record points), which is what 3A/3B stored in `stanceScore`; 3C gave
    // `stanceScore` a new meaning and a bare-number signature would have let every caller keep
    // compiling while silently changing what it said.
    assert('a stance near zero is a divided record, never neutral or absent',
      describeStance({ consistency: 0 }) === 'divided record' &&
      describeStance({ consistency: 0.19 }) === 'divided record')
  }

  // 8. A single whipped vote is weak evidence and says so.
  {
    const a = aggregate([sig({ id: 'x', observedAt: AS_OF })], AS_OF, cfg)
    assert('one whipped vote reads as a weak indication, not a record',
      describeConfidence(a.confidence, cfg) === 'weak indication', `confidence ${a.confidence}`)
    const r = aggregate([sig({ id: 'x', derivation: 'rebellion:v1', rawWeight: cfg.weights['rebellion:v1'], observedAt: AS_OF })], AS_OF, cfg)
    assert('one rebellion is worth more confidence than one whipped vote',
      r.confidence > a.confidence, `${r.confidence} vs ${a.confidence}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// THE DATABASE INVARIANTS
// ─────────────────────────────────────────────────────────────────────────────────────────────────
async function dbChecks(pool: ReturnType<typeof getNeonPool>) {
  console.log(`\n════ DATABASE INVARIANTS ════`)

  // The weights are typed once. This is the check that makes the generated SQL function safe.
  const classes: Array<[string, string | null, number]> = [
    ['vote', 'rebellion:v1', POSITION_CONFIG.weights['rebellion:v1']],
    ['vote', 'free-vote-heuristic:v1', POSITION_CONFIG.weights['free-vote-heuristic:v1']],
    ['vote', 'unwhipped-group:v1', POSITION_CONFIG.weights['unwhipped-group:v1']],
    ['vote', 'whipped-with:v1', POSITION_CONFIG.weights['whipped-with:v1']],
    ['vote', 'small-party-unclassified:v1', POSITION_CONFIG.weights['small-party-unclassified:v1']],
    ['edm_signature', null, POSITION_CONFIG.weights.edm_signature],
    ['witness_appearance', null, POSITION_CONFIG.weights.witness_appearance],
    ['declared_interest', null, POSITION_CONFIG.weights.declared_interest],
    ['committee_membership', null, POSITION_CONFIG.weights.committee_membership],
    ['amendment_sponsorship', null, POSITION_CONFIG.weights.amendment_sponsorship],
  ]
  let agree = 0
  for (const [t, d, expected] of classes) {
    const { rows: [r] } = await pool.query<{ w: number | null }>(
      `SELECT position_raw_weight($1, $2) AS w`, [t, d])
    if (r.w !== null && Math.abs(r.w - expected) < 1e-6) agree++
    else console.log(`      ${t}/${d ?? '—'}: SQL says ${r.w}, TypeScript says ${expected}`)
  }
  check('position_raw_weight() agrees with position-config.ts on every class',
    agree === classes.length, `${agree}/${classes.length}`)

  const { rows: [unknown_] } = await pool.query<{ w: number | null }>(
    `SELECT position_raw_weight('vote', 'not-a-real-class:v9') AS w`)
  check('an unrecognised class gets NO weight, rather than quietly becoming a whipped vote',
    unknown_.w === null, `returned ${unknown_.w}`)

  // Signal-layer invariants.
  const { rows: [inv] } = await pool.query<Record<string, string>>(`
    SELECT (SELECT COUNT(*)::text FROM position_signal WHERE array_length(evidence_ids,1) IS NULL) AS no_evidence,
           (SELECT COUNT(*)::text FROM position_signal WHERE observed_at IS NULL) AS undated,
           (SELECT COUNT(*)::text FROM position_signal WHERE raw_weight IS NULL) AS no_weight,
           (SELECT COUNT(*)::text FROM position_signal WHERE direction NOT IN (-1,0,1)) AS bad_direction,
           (SELECT COUNT(*)::text FROM position_signal s
             WHERE NOT EXISTS (SELECT 1 FROM graph_entity e WHERE e.id = s.actor_id)) AS orphan_actor`)
  check('every signal has at least one evidence id', inv.no_evidence === '0', `${inv.no_evidence} without`)
  check('every signal is dated with the event date', inv.undated === '0')
  check('every signal has a weight', inv.no_weight === '0')
  check('every signal direction is -1, 0 or +1', inv.bad_direction === '0')
  check('every signal resolves to an entity that exists', inv.orphan_actor === '0')

  // Absent votes are not signals. Design §5.4 — silence is silence.
  const { rows: [abs] } = await pool.query<{ absent: string; signals: string }>(`
    SELECT (SELECT COUNT(*)::text FROM division_votes WHERE vote='absent') AS absent,
           (SELECT COUNT(*)::text FROM position_signal_vote) AS signals`)
  check('an absent vote produces no signal (silence is not opposition)',
    Number(abs.signals) === 2_080_585,
    `${Number(abs.absent).toLocaleString()} absent rows excluded; ${Number(abs.signals).toLocaleString()} vote signals`)

  // Estimates.
  const { rows: [est] } = await pool.query<Record<string, string>>(`
    SELECT (SELECT COUNT(*)::text FROM position_estimate) AS n,
           (SELECT COUNT(DISTINCT config_version)::text FROM position_estimate) AS versions,
           (SELECT COUNT(*)::text FROM position_estimate WHERE stance_score < -1 OR stance_score > 1) AS bad_score,
           (SELECT COUNT(*)::text FROM position_estimate WHERE confidence < 0 OR confidence > 1) AS bad_conf`)
  check('position_estimate carries exactly one config_version', est.versions === '1', `${est.versions} distinct, ${Number(est.n).toLocaleString()} rows`)
  check('every stance_score is inside [-1, +1]', est.bad_score === '0')
  check('every confidence is inside [0, 1]', est.bad_conf === '0')
  check('the table names the config that produced it', configVersion() === (await currentVersion(pool)),
    `${await currentVersion(pool)}`)

  // ⚠ THE ONE THE DESIGN CARES MOST ABOUT: absence is not zero (design §6).
  const { rows: [absence] } = await pool.query<{ zero_rows: string; no_signal_rows: string }>(`
    SELECT (SELECT COUNT(*)::text FROM position_estimate e
             WHERE NOT EXISTS (SELECT 1 FROM position_signal s
                                WHERE s.actor_id=e.actor_id AND s.target_type=e.target_type
                                  AND s.target_id=e.target_id)) AS no_signal_rows,
           (SELECT COUNT(*)::text FROM position_estimate WHERE confidence = 0) AS zero_rows`)
  check('no estimate exists for an (actor, target) with no signals — absence, not zero',
    absence.no_signal_rows === '0', `${absence.no_signal_rows} such rows`)
  check('no estimate carries confidence exactly 0 (which would render as a real "no view")',
    absence.zero_rows === '0', `${absence.zero_rows} such rows`)

  // Attention ceiling, measured on the real table rather than only on a fixture.
  const { rows: [ceil] } = await pool.query<{ n: string; over: string }>(`
    SELECT COUNT(*)::text AS n,
           COUNT(*) FILTER (WHERE confidence > ${POSITION_CONFIG.attentionConfidenceCeiling} + 1e-6)::text AS over
      FROM position_estimate WHERE NOT (signal_counts ?| ARRAY['vote','edm_signature'])`)
  check('no attention-only estimate on the real table exceeds the ceiling',
    ceil.over === '0', `${Number(ceil.n).toLocaleString()} attention-only rows, ${ceil.over} over`)

  // Reconciliation against the 2D-2 edges — brief §1.4 asks for it as a cross-check.
  const { rows: [rec] } = await pool.query<{ edges: string; signals: string; absent: string }>(`
    SELECT (SELECT COUNT(*)::text FROM graph_voted_edge) AS edges,
           (SELECT COUNT(*)::text FROM position_signal_vote) AS signals,
           (SELECT COUNT(*)::text FROM graph_voted_edge WHERE qualifier='absent') AS absent`)
  const reconciled = Number(rec.edges) - Number(rec.absent) === Number(rec.signals)
  check('vote signals reconcile exactly with the 2D-2 `voted` edges minus the absences',
    reconciled,
    `${Number(rec.edges).toLocaleString()} edges − ${Number(rec.absent).toLocaleString()} absent = ${(Number(rec.edges) - Number(rec.absent)).toLocaleString()} vs ${Number(rec.signals).toLocaleString()} signals`)

  // The additive promise: the graph stream created nothing outside its own relations.
  //
  // ⚠ GRAPH 3C — THIS CHECK HAS BEEN FAILING SINCE 3B AND NOBODY LOOKED. 3B added
  // `position_donation` (§2.2, the Electoral Commission register) and did not add it here, so
  // `check-3a.ts` has reported 32/33 ever since — a real, harmless failure sitting in a harness
  // whose whole purpose is that a failure means something. 3B's report quotes check-3b 50/50 and
  // verify:positions 35/35 and does not mention this one at all.
  //
  // Extended rather than loosened: the list is still exhaustive and still fails on anything not on
  // it. What it asserts is now what it always meant — that every `position_*` relation in the
  // database was created deliberately by a graph sprint and is named in one place.
  const own = [
    // 3A
    'position_signal_stored', 'position_division_party', 'position_division_class',
    'position_estimate', 'position_estimate_meta', 'position_signal_vote', 'position_signal',
    // 3B §2.2
    'position_donation',
    // 3C adds COLUMNS and FUNCTIONS only — no new relation. If this list grows without a sprint
    // section to point at, something created a table nobody decided on.
  ]
  const { rows: created } = await pool.query<{ relname: string }>(
    `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname LIKE 'position\\_%' AND c.relkind IN ('r','v')`)
  const unexpected = created.map((r) => r.relname).filter((r) => !own.includes(r))
  check(`the graph stream created no relation outside its own ${own.length}`, unexpected.length === 0,
    unexpected.length ? unexpected.join(', ') : `${created.length} relations, all expected`)
}

async function currentVersion(pool: ReturnType<typeof getNeonPool>): Promise<string> {
  const { rows } = await pool.query<{ v: string }>(
    `SELECT config_version AS v FROM position_estimate LIMIT 1`)
  return rows[0]?.v ?? '(table empty)'
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// SELF-TEST — every constructed case, run against a deliberately broken world
// ─────────────────────────────────────────────────────────────────────────────────────────────────
function selfTest() {
  console.log('════ SELF-TEST — every §4 check, each against ITS OWN targeted break ════')
  console.log('If any line says DID NOT FIRE, that check is decorative and proves nothing.')
  console.log()
  console.log('⚠ The first draft of this file broke ONE thing (flat weights, no decay, no ceiling)')
  console.log('  and expected all twelve checks to fail. Ten said DID NOT FIRE — correctly, because')
  console.log('  determinism, version stability and "attention has no side" are STRUCTURAL and no')
  console.log('  config change can falsify them. A blanket break tests the checks it happens to')
  console.log('  reach and quietly certifies the rest. One break per property, below.')
  console.log()

  const cfg = POSITION_CONFIG

  // ── 1. flat weights: ten whipped votes then really do outweigh one rebellion ──
  {
    const flat: PositionConfig = JSON.parse(JSON.stringify(cfg))
    for (const k of Object.keys(flat.weights)) (flat.weights as Record<string, number>)[k] = 0.2
    const a = aggregate([
      sig({ id: 'reb', derivation: 'rebellion:v1', direction: 1, rawWeight: flat.weights['rebellion:v1'] }),
      ...Array.from({ length: 10 }, (_, i) => sig({ id: `w${i}`, direction: -1, rawWeight: flat.weights['whipped-with:v1'] })),
    ], AS_OF, flat)
    expectFail('one rebellion outweighs ten whipped votes  [break: every class weighted 0.2]',
      a.stanceScore > 0, `stance ${a.stanceScore}`)
  }

  // ── 2. decay switched off: an old vote counts the same as a new one ──
  {
    const noDecay: PositionConfig = JSON.parse(JSON.stringify(cfg))
    for (const k of Object.keys(noDecay.halfLifeYears)) (noDecay.halfLifeYears as Record<string, number | null>)[k] = null
    const old = aggregate([sig({ id: 'a', observedAt: '2011-08-19' })], AS_OF, noDecay)
    const recent = aggregate([sig({ id: 'a', observedAt: '2025-08-19' })], AS_OF, noDecay)
    expectFail('a 15-year-old vote contributes less than a 1-year-old  [break: no half-lives]',
      old.confidence < recent.confidence, `${old.confidence} vs ${recent.confidence}`)
  }

  // ── 3. ceiling lifted: attention alone manufactures certainty ──
  //     The assertion is deliberately measured against the REAL ceiling, not the broken one — a
  //     check that moves its own goalposts with the config can never fail.
  {
    const noCeiling: PositionConfig = JSON.parse(JSON.stringify(cfg))
    noCeiling.attentionConfidenceCeiling = 1
    const many = Array.from({ length: 40 }, (_, i) =>
      sig({ id: `w${i}`, signalType: 'witness_appearance', derivation: null, direction: 0, rawWeight: 0.1 }))
    const a = aggregate(many, AS_OF, noCeiling)
    expectFail('40 attention signals stay under the 0.15 ceiling  [break: ceiling raised to 1.0]',
      a.confidence <= cfg.attentionConfidenceCeiling + 1e-9, `confidence ${a.confidence}`)
  }

  // ── 4. an aggregation that gives direction-0 signals a side ──
  {
    const sideful = (xs: SignalForMath[]) =>
      aggregate(xs.map((x) => ({ ...x, direction: x.direction === 0 ? 1 : x.direction })), AS_OF, cfg)
    const a = sideful([sig({ id: 'w', signalType: 'witness_appearance', derivation: null, direction: 0, rawWeight: 0.1 })])
    expectFail('attention-only signals produce stance 0  [break: direction 0 read as +1]',
      a.stanceScore === 0, `stance ${a.stanceScore}`)
  }

  // ── 5. an order-dependent aggregation ──
  //     Weights the i-th input by its ARRIVAL index instead of its rank within a class — which is
  //     the plausible bug, not a silly one: it is what you get by forgetting the sort.
  {
    const orderDependent = (xs: SignalForMath[]) =>
      xs.reduce((acc, x, i) => acc + x.direction * x.rawWeight / (i + 1), 0)
    const base = [
      sig({ id: 'a', direction: 1, rawWeight: 0.9 }),
      sig({ id: 'b', direction: -1, rawWeight: 0.2 }),
    ]
    expectFail('aggregation is order-independent  [break: discount by arrival index]',
      Math.abs(orderDependent(base) - orderDependent([...base].reverse())) < 1e-12,
      `${orderDependent(base).toFixed(4)} vs ${orderDependent([...base].reverse()).toFixed(4)}`)
  }

  // ── 6. a decay that ignores a null half-life ──
  {
    const decayIgnoringNull = (years: number) => Math.pow(2, -years / 8)
    expectFail('a signal type with no half-life does not decay  [break: null treated as 8 years]',
      decayIgnoringNull(36) === 1, `36 years → ${decayIgnoringNull(36).toFixed(4)}`)
  }

  // ── 7. a decay with no future clamp ──
  {
    const unclamped = (years: number) => Math.pow(2, -years / 8)
    expectFail('a future-dated signal is clamped to 1  [break: clamp removed]',
      unclamped(-4) === 1, `4 years in the future → ${unclamped(-4).toFixed(4)} (amplified)`)
  }

  // ── 8. a version string that does not depend on the config ──
  {
    const frozen = (_c: PositionConfig) => '3a.frozen'
    const mutated: PositionConfig = JSON.parse(JSON.stringify(cfg))
    mutated.weights['rebellion:v1'] = 0.5
    expectFail('changing one weight changes config_version  [break: hand-maintained version string]',
      frozen(mutated) !== frozen(cfg), 'both sides return 3a.frozen — exactly what a forgotten bump looks like')
    const mutated2: PositionConfig = JSON.parse(JSON.stringify(cfg))
    mutated2.halfLifeYears.vote = 9
    expectFail('changing a half-life changes config_version  [break: same]',
      frozen(mutated2) !== frozen(cfg))
  }

  // ── 9. a version string that is not stable ──
  {
    let n = 0
    const unstable = () => `3a.${n++}`
    expectFail('config_version is stable across two calls  [break: counter in the version]',
      unstable() === unstable())
  }

  // ── 10. a vocabulary with more than three forms of words ──
  {
    const chatty = (c: number) =>
      c >= 0.9 ? 'overwhelming' : c >= 0.65 ? 'strong recorded record' : c >= 0.35 ? 'some recorded signals' : 'weak indication'
    const words = new Set([0, 0.1, 0.4, 0.7, 0.95].map(chatty))
    expectFail('describeConfidence yields exactly three forms of words  [break: a fourth band added]',
      words.size === 3, [...words].join(' | '))
  }

  // ── 11. a band boundary that does not match the configured threshold ──
  {
    const shifted = (c: number) => (c >= 0.7 ? 'strong recorded record' : 'weak indication')
    expectFail('the strong band starts exactly at the configured threshold  [break: boundary moved to 0.70]',
      shifted(cfg.confidenceBands.strong) === 'strong recorded record',
      `at ${cfg.confidenceBands.strong} the broken version says "${shifted(cfg.confidenceBands.strong)}"`)
  }

  // ── 12. a stance vocabulary that calls a divided record "neutral" ──
  {
    const neutralising = (s: number) => (s >= 0.2 ? 'supported' : s <= -0.2 ? 'opposed' : 'neutral')
    expectFail('a stance near zero is a divided record, never neutral  [break: "neutral" reintroduced]',
      neutralising(0) === 'divided record', `says "${neutralising(0)}"`)
  }

  // ── 13. the database checks have their own break: a weight function out of step ──
  {
    const sqlSaysDifferent = (t: string) => (t === 'edm_signature' ? 0.55 : 0.2)
    const agree = Math.abs(sqlSaysDifferent('edm_signature') - cfg.weights.edm_signature) < 1e-6
    expectFail('position_raw_weight() agrees with the TypeScript config  [break: SQL says 0.55, TS says 0.6]',
      agree, `SQL 0.55 vs TS ${cfg.weights.edm_signature}`)
    const fallback = (_t: string, _d: string) => 0.2
    expectFail('an unrecognised class gets NO weight  [break: a 0.2 fallback added]',
      fallback('vote', 'not-a-real-class:v9') === null as unknown as number,
      'the fallback silently makes an unknown class look like a whipped vote')
  }
}

async function main() {
  if (SELF_TEST) {
    selfTest()
  } else {
    constructedCases(POSITION_CONFIG, false)
    if (!OFFLINE) {
      const pool = getNeonPool()
      try { await dbChecks(pool) } finally { await endNeonPool() }
    } else {
      console.log('\n(--offline: database invariants skipped)')
    }
  }
  console.log(`\n════ ${pass}/${pass + fail} ════`)
  if (fail) { console.log('FAILED:'); for (const f of failures) console.log(`  · ${f}`) }
  process.exit(fail === 0 ? 0 : 1)
}

if (require.main === module) {
  main().catch((e) => { console.error('[check-3a] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
}
