/**
 * audit-3c-scoring.ts — GRAPH 3C §1. The old formula and the new one, over the same real signals.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THE OLD FORMULA IS RE-IMPLEMENTED HERE INSTEAD OF BEING IMPORTED
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * The point of this file is to show 3C's checks failing against the REAL broken state (brief §0),
 * and the real broken state is a function that no longer exists in the repository. Two ways to
 * produce it: run the audit before the change and quote the numbers, or keep the old arithmetic
 * beside the new one and run both on every invocation.
 *
 * The second is better and not by a little. A quoted number cannot be re-checked, cannot be
 * re-run against different rows, and quietly becomes a claim about the past. `aggregate3B()` below
 * is 3A/3B's function, copied byte-for-byte from git and marked as frozen — it is never called by
 * anything that writes, and `check-3c.ts` asserts it still reproduces 3B's two published figures
 * (0.7481 and 0.8810) so that a copying error in it would fail rather than flatter the new one.
 *
 * Usage (from scripts/graph):
 *   npx tsx audit-3c-scoring.ts              # the constructed cases and the real Bill
 *   npx tsx audit-3c-scoring.ts --no-db      # constructed cases only, no database
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'
import { POSITION_CONFIG, PositionConfig } from '../../scrutinise-web/lib/graph/position-config'
import { aggregate, decay, SignalForMath } from '../../scrutinise-web/lib/graph/position-math'

export {}

const NO_DB = process.argv.includes('--no-db')
// ⚠ 3B's own as-of date (`probe-3b-rank.ts:30`), fixed rather than "today", and found by reading
// that file rather than guessing at it. The first run of this audit used today's date and reported
// 0.7480/0.8808 against 3B's published 0.7481/0.8810; the second used 2026-08-20 and still missed
// the second figure by 0.0001. Both times the failure read exactly like a copying error in the
// frozen function, and both times it was the clock. **A comparison against a published number has
// to hold every input still, including the one nobody thinks of as an input.**
const AS_OF = '2026-08-19'
const BILL = 'Terminally Ill Adults (End of Life) Bill'

/**
 * ⚠ FROZEN. GRAPH 3A/3B's `aggregate()`, exactly as it stood at commit 8a6ee81. Do not "improve"
 * it and do not call it from anything that writes — its only job is to be the thing the new
 * arithmetic is compared against. The two defects are both visible in six lines:
 *   · the group key ends in `d.s.direction`, so disagreeing signals never discount each other;
 *   · `stanceScore = signed / mass`, so volume and consistency both divide out;
 *   · `cDirectional` saturates on `mass`, the gross turnout, not on the net evidence.
 */
export function aggregate3B(
  signals: SignalForMath[],
  asOf: string,
  cfg: PositionConfig = POSITION_CONFIG,
): { stanceScore: number; confidence: number; mass: number } {
  const decayed = signals.map((s) => ({ s, w: s.rawWeight * decay(s.signalType, s.observedAt, asOf, cfg) }))
  const groups = new Map<string, { s: SignalForMath; w: number }[]>()
  for (const d of decayed) {
    const key = `${d.s.signalType}|${d.s.derivation ?? ''}|${d.s.direction}`
    const list = groups.get(key)
    if (list) list.push(d); else groups.set(key, [d])
  }
  let signed = 0, mass = 0, attentionMass = 0
  for (const key of [...groups.keys()].sort()) {
    const list = groups.get(key)!
    list.sort((a, b) => (b.w - a.w) || (a.s.id < b.s.id ? -1 : a.s.id > b.s.id ? 1 : 0))
    list.forEach((d, i) => {
      const contribution = d.w / (i + 1)
      if (d.s.direction === 0) attentionMass += contribution
      else { mass += contribution; signed += d.s.direction * contribution }
    })
  }
  const stanceScore = mass > 0 ? signed / mass : 0
  const cDirectional = mass > 0 ? 1 - Math.pow(2, -mass / cfg.confidenceSaturation) : 0
  const cAttentionRaw = attentionMass > 0 ? 1 - Math.pow(2, -attentionMass / cfg.confidenceSaturation) : 0
  const cAttention = Math.min(cfg.attentionConfidenceCeiling, cAttentionRaw)
  return {
    stanceScore: Math.round(stanceScore * 1e6) / 1e6,
    confidence: Math.round((1 - (1 - cDirectional) * (1 - cAttention)) * 1e6) / 1e6,
    mass: Math.round(mass * 1e6) / 1e6,
  }
}

const fv = POSITION_CONFIG.weights['free-vote-heuristic:v1']

/** N free votes, `k` of them aye, all dated the same day so decay is not the variable under test. */
function votes(n: number, ayes: number, date = '2025-06-20'): SignalForMath[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `s${String(i).padStart(3, '0')}`,
    signalType: 'vote' as const,
    derivation: 'free-vote-heuristic:v1',
    direction: i < ayes ? 1 : -1,
    rawWeight: fv,
    observedAt: date,
  }))
}

function row(label: string, sigs: SignalForMath[]) {
  const o = aggregate3B(sigs, AS_OF)
  const n = aggregate(sigs, AS_OF)
  console.log(
    `  ${label.padEnd(34)}` +
    `│ ${o.stanceScore.toFixed(3).padStart(7)} ${o.confidence.toFixed(4).padStart(7)} ` +
    `│ ${n.consistency.toFixed(3).padStart(7)} ${n.stanceScore.toFixed(3).padStart(7)} ${n.confidence.toFixed(4).padStart(7)}`)
  return { o, n }
}

function head() {
  console.log(`  ${''.padEnd(34)}│ ${'GRAPH 3A/3B'.padStart(15)} │ ${'GRAPH 3C'.padStart(23)}`)
  console.log(`  ${''.padEnd(34)}│ ${'stance'.padStart(7)} ${'conf'.padStart(7)} │ ${'consist'.padStart(7)} ${'stance'.padStart(7)} ${'conf'.padStart(7)}`)
  console.log(`  ${''.padEnd(34)}┼${''.padEnd(17, '─')}┼${''.padEnd(25, '─')}`)
}

async function main() {
  let bad = 0
  const must = (name: string, cond: boolean, detail = '') => {
    if (!cond) bad++
    console.log(`  ${cond ? '✓' : '❌'} ${name}${detail ? `  — ${detail}` : ''}`)
  }

  // ══ 1 · THE CONSTRUCTED CASES §1 NAMES ═══════════════════════════════════════════════════════
  console.log(`════ 1 · THE PROPERTIES §1 REQUIRES, EACH WITH ITS CONSTRUCTED CASE ════`)
  console.log(`   (free votes at weight ${fv}, all on 2025-06-20, as-of ${AS_OF})\n`)
  head()
  const one = row('1 vote', votes(1, 1))
  const five = row('5 votes, all one way', votes(5, 5))
  const fifty = row('50 votes, all one way', votes(50, 50))
  const nine = row('9 votes, all one way', votes(9, 9))
  const split = row('5 one way + 4 the other', votes(9, 5))
  const even = row('4 one way + 4 the other', votes(8, 4))
  const oldNine = row('9 votes, all one way, 2009', votes(9, 9, '2009-06-20'))

  console.log(`\n  ── VOLUME MUST MATTER ──`)
  must('fifty consistent votes outrank one, on stance',
    fifty.n.stanceScore > one.n.stanceScore,
    `${one.n.stanceScore.toFixed(3)} → ${fifty.n.stanceScore.toFixed(3)}`)
  must('… and did NOT under the old function (this is the defect)',
    fifty.o.stanceScore === one.o.stanceScore && one.o.stanceScore === 1,
    `both exactly ${one.o.stanceScore.toFixed(3)}`)
  must('fifty consistent votes outrank one, on confidence too',
    fifty.n.confidence > one.n.confidence,
    `${one.n.confidence.toFixed(4)} → ${fifty.n.confidence.toFixed(4)}`)

  console.log(`\n  ── CONSISTENCY MUST MATTER, AND IN THE RIGHT DIRECTION ──`)
  must('9-for beats 5-for-4-against on CONFIDENCE',
    nine.n.confidence > split.n.confidence,
    `${nine.n.confidence.toFixed(4)} vs ${split.n.confidence.toFixed(4)}`)
  must('9-for beats 5-for-4-against on |stance|',
    Math.abs(nine.n.stanceScore) > Math.abs(split.n.stanceScore),
    `${nine.n.stanceScore.toFixed(3)} vs ${split.n.stanceScore.toFixed(3)}`)
  must('THE OLD FUNCTION HAD IT BACKWARDS — the split record scored HIGHER',
    split.o.confidence > nine.o.confidence,
    `9-for ${nine.o.confidence.toFixed(4)} vs 5-4 ${split.o.confidence.toFixed(4)} — 3B published 0.7481 / 0.8810`)
  must('3B\'s two published figures reproduce exactly from the frozen copy',
    nine.o.confidence.toFixed(4) === '0.7481' && split.o.confidence.toFixed(4) === '0.8810',
    `${nine.o.confidence.toFixed(4)} / ${split.o.confidence.toFixed(4)}`)
  must('a perfectly even record is near-zero confidence, not high confidence',
    even.n.confidence < 0.001 && even.o.confidence > 0.8,
    `3C ${even.n.confidence.toFixed(4)} vs 3A/3B ${even.o.confidence.toFixed(4)}`)

  console.log(`\n  ── DECAY STILL APPLIES ──`)
  must('an old consistent record does not outrank a recent one of equal size',
    oldNine.n.stanceScore < nine.n.stanceScore && oldNine.n.confidence < nine.n.confidence,
    `2009: stance ${oldNine.n.stanceScore.toFixed(3)} conf ${oldNine.n.confidence.toFixed(4)} vs 2025: ${nine.n.stanceScore.toFixed(3)} / ${nine.n.confidence.toFixed(4)}`)
  must('… and the old function could not tell them apart on stance either',
    oldNine.o.stanceScore === nine.o.stanceScore,
    `both ${nine.o.stanceScore.toFixed(3)}`)

  console.log(`\n  ── WHERE THE WORDING MOVES, AND WHY ──`)
  //
  // ⚠⚠ MY FIRST VERSION OF THIS BLOCK ASSERTED "consistency reproduces the old stance score on
  // every case" AND IT FAILED, CORRECTLY. `consistency` reproduces it exactly on a CONSISTENT
  // record, and deliberately does not on a split one: the old ratio was
  // (H(k) − H(n−k)) / (H(k) + H(n−k)) — a number that depends on which side happened to get the
  // undiscounted rank — while the new one is the plain net share (2k − n)/n. That IS the defect
  // being fixed, so claiming the wording never moves would have been claiming the fix did nothing.
  //
  // What is true, and is what gets asserted:
  const consistentCases = [one, five, fifty, nine, oldNine]
  must('on a CONSISTENT record, consistency is exactly the old stance score',
    consistentCases.every((c) => Math.abs(c.n.consistency - c.o.stanceScore) <= 1e-6),
    'so nothing a user reads about a settled record changes')
  must('on a SPLIT record the two differ, because the direction-grouping artefact is gone',
    Math.abs(split.n.consistency - split.o.stanceScore) > 1e-3,
    `5-4: old ${split.o.stanceScore.toFixed(3)} (a harmonic-rank artefact) → new ${split.n.consistency.toFixed(3)} = 1/9, the plain net share`)
  // And the honest cost, named rather than glossed: for some splits the WORD changes too.
  console.log(`\n     ── every n≤11 split where describeStance's word actually moves ──`)
  const moved: string[] = []
  for (let n = 2; n <= 11; n++) {
    for (let k = 0; k <= n; k++) {
      const s = votes(n, k)
      const o = aggregate3B(s, AS_OF).stanceScore
      const x = aggregate(s, AS_OF).consistency
      const word = (v: number) => (v >= 0.2 ? 'supported' : v <= -0.2 ? 'opposed' : 'divided record')
      if (word(o) !== word(x)) moved.push(`${k}-${n - k}: "${word(o)}" → "${word(x)}"`)
    }
  }
  console.log(`     ${moved.length ? moved.join('  ·  ') : '(none)'}`)
  console.log(`     Every move is toward describing a leaning record as leaning. A 6-3 record read`)
  console.log(`     "divided record" before and reads "supported" now, and 6-3 is not divided.`)

  console.log(`\n  ── DESIGN §5's OWN PROPERTY MUST SURVIVE ──`)
  const rebel = aggregate([{ id: 'r', signalType: 'vote', derivation: 'rebellion:v1',
    direction: 1, rawWeight: POSITION_CONFIG.weights['rebellion:v1'], observedAt: AS_OF }], AS_OF)
  const tenWhipped = aggregate(Array.from({ length: 10 }, (_, i) => ({
    id: `w${i}`, signalType: 'vote' as const, derivation: 'whipped-with:v1',
    direction: -1, rawWeight: POSITION_CONFIG.weights['whipped-with:v1'], observedAt: AS_OF })), AS_OF)
  const both = aggregate([{ id: 'r', signalType: 'vote', derivation: 'rebellion:v1',
      direction: 1, rawWeight: POSITION_CONFIG.weights['rebellion:v1'], observedAt: AS_OF },
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `w${i}`, signalType: 'vote' as const, derivation: 'whipped-with:v1',
      direction: -1, rawWeight: POSITION_CONFIG.weights['whipped-with:v1'], observedAt: AS_OF }))], AS_OF)
  must('one rebellion outweighs ten whipped votes',
    both.stanceScore > 0 && rebel.confidence > tenWhipped.confidence,
    `net stance ${both.stanceScore.toFixed(3)}; rebellion alone ${rebel.confidence.toFixed(4)} vs ten whipped ${tenWhipped.confidence.toFixed(4)}`)

  console.log(`\n  ── ATTENTION HAS NO SIDE, AND CANNOT MANUFACTURE CERTAINTY ──`)
  const att = aggregate(Array.from({ length: 40 }, (_, i) => ({
    id: `d${i}`, signalType: 'political_donation' as const, derivation: null,
    direction: 0, rawWeight: POSITION_CONFIG.weights.political_donation, observedAt: AS_OF })), AS_OF)
  must('40 direction-0 signals give stance 0 and stay under the ceiling',
    att.stanceScore === 0 && att.consistency === 0 &&
    att.confidence <= POSITION_CONFIG.attentionConfidenceCeiling + 1e-9,
    `stance ${att.stanceScore}, confidence ${att.confidence.toFixed(4)} vs ceiling ${POSITION_CONFIG.attentionConfidenceCeiling}`)

  console.log(`\n  ── ABSENCE IS ABSENCE ──`)
  const none = aggregate([], AS_OF)
  must('no signals → mass 0, and the caller must render that as absence',
    none.mass === 0 && none.stanceScore === 0 && none.confidence === 0)

  console.log(`\n  ── ORDER-INDEPENDENCE SURVIVES THE NEW GROUPING ──`)
  const mixedSet = votes(9, 5)
  const shuffled = [mixedSet[4], mixedSet[8], mixedSet[0], mixedSet[3], mixedSet[7],
    mixedSet[1], mixedSet[6], mixedSet[2], mixedSet[5]]
  must('a shuffled input produces a byte-identical aggregate',
    JSON.stringify(aggregate(mixedSet, AS_OF)) === JSON.stringify(aggregate(shuffled, AS_OF)))
  // ⚠ The property that made this non-trivial: the net direction is taken over GROSS weights and
  // applied to the discounted mass. Summing per-signal signed contributions instead would make a
  // 5-4 split depend on which side held rank 1 within the group.
  must('a 5-4 split nets exactly 1/9 of its own mass, whatever the ordering',
    Math.abs(aggregate(shuffled, AS_OF).signed / aggregate(shuffled, AS_OF).mass - 1 / 9) < 1e-6,
    `${(aggregate(shuffled, AS_OF).signed / aggregate(shuffled, AS_OF).mass).toFixed(6)}`)

  // ══ 2 · THE REAL BILL ════════════════════════════════════════════════════════════════════════
  if (!NO_DB) {
    const pool = getNeonPool()
    try {
      const host = /@([^/:?]+)/.exec(process.env.NEON_DATABASE_URL ?? '')?.[1] ?? '(unparsed)'
      if (!/ep-old-dust-aboxi69a/.test(host)) { console.error(`❌ not Neon production (${host})`); process.exit(1) }
      console.log(`\n════ 2 · THE REAL BILL — ${BILL} ════`)
      console.log(`   host ${host}; every member's whole record on the Bill, rolled up both ways.`)

      const { rows } = await pool.query<{
        actor_id: string; signal_ref: string; derivation: string; direction: number
        raw_weight: number; observed_at: string }>(`
        SELECT s.actor_id::text, s.signal_ref, s.derivation, s.direction,
               s.raw_weight, s.observed_at::text
          FROM position_signal_vote s
          JOIN divisions d ON d.house = split_part(s.target_id, ':', 1)
                          AND d.division_id = split_part(s.target_id, ':', 2)::int
         WHERE d.bill_title = $1`, [BILL])
      console.log(`   ${rows.length.toLocaleString()} vote signals`)

      const byActor = new Map<string, SignalForMath[]>()
      for (const r of rows) {
        const s: SignalForMath = {
          id: r.signal_ref, signalType: 'vote', derivation: r.derivation,
          direction: r.direction, rawWeight: r.raw_weight, observedAt: r.observed_at,
        }
        const l = byActor.get(r.actor_id); if (l) l.push(s); else byActor.set(r.actor_id, [s])
      }

      const scored = [...byActor.entries()]
        .map(([id, sigs]) => ({ id, n: sigs.length, o: aggregate3B(sigs, AS_OF), x: aggregate(sigs, AS_OF) }))
        .filter((a) => a.n >= 9)
      const consistent = scored.filter((a) => Math.abs(a.o.stanceScore) === 1)
      const mixed = scored.filter((a) => Math.abs(a.o.stanceScore) < 1)
      const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)

      console.log(`\n   members with 9 or more votes on this Bill: ${scored.length}`)
      console.log(`   ${''.padEnd(24)}${'n'.padStart(5)}  ${'3A/3B conf'.padStart(11)}  ${'3C conf'.padStart(9)}  ${'3C |stance|'.padStart(11)}`)
      console.log(`   ${'entirely consistent'.padEnd(24)}${String(consistent.length).padStart(5)}  ` +
        `${mean(consistent.map((a) => a.o.confidence)).toFixed(4).padStart(11)}  ` +
        `${mean(consistent.map((a) => a.x.confidence)).toFixed(4).padStart(9)}  ` +
        `${mean(consistent.map((a) => Math.abs(a.x.stanceScore))).toFixed(4).padStart(11)}`)
      console.log(`   ${'mixed record'.padEnd(24)}${String(mixed.length).padStart(5)}  ` +
        `${mean(mixed.map((a) => a.o.confidence)).toFixed(4).padStart(11)}  ` +
        `${mean(mixed.map((a) => a.x.confidence)).toFixed(4).padStart(9)}  ` +
        `${mean(mixed.map((a) => Math.abs(a.x.stanceScore))).toFixed(4).padStart(11)}`)

      const oldInverted = consistent.length > 0 && mixed.length > 0 &&
        mean(mixed.map((a) => a.o.confidence)) > mean(consistent.map((a) => a.o.confidence))
      const newRight = consistent.length > 0 && mixed.length > 0 &&
        mean(consistent.map((a) => a.x.confidence)) > mean(mixed.map((a) => a.x.confidence))
      must('ON REAL DATA: the old function scored the mixed records HIGHER', oldInverted)
      must('ON REAL DATA: the new function scores the consistent records higher', newRight)

      // ── WHERE DOES THE ONE CONSISTENT MEMBER RANK? ────────────────────────────────────────
      //
      // This is the property brief §6's ▶ asks Charlie to confirm on the page — *"the ordering now
      // separates the committed from the ambivalent"* — so it is measured here rather than left to
      // the eye. Both keys are confidence-first, as shipped.
      const rankOf = (key: (a: typeof scored[number]) => number) => {
        const sorted = [...scored].sort((p, q) => key(q) - key(p))
        return sorted.findIndex((a) => Math.abs(a.o.stanceScore) === 1) + 1
      }
      const rOld = rankOf((a) => a.o.confidence)
      const rNew = rankOf((a) => a.x.confidence)
      console.log(`\n   rank of the ONE entirely-consistent member, of ${scored.length}, ordered by confidence:`)
      console.log(`      under 3A/3B  ${rOld}`)
      console.log(`      under 3C     ${rNew}`)
      must('3C puts the entirely-consistent member at the top', rNew === 1)
      must('3A/3B buried them — which is the defect, stated as a rank', rOld > scored.length / 2,
        `${rOld} of ${scored.length}`)

      // ⚠ The distinct-value count is reported and NOT asserted here, deliberately. My first
      // version asserted the rollup gained distinct values and it FAILED at 58 → 58, correctly:
      // over ONE bill whose eleven divisions all carry the same class and near-identical decay,
      // the number of distinguishable records is bounded by combinatorics, not by the formula. The
      // "is it a distribution" question is about the 2.3M-row estimate table (3 → 13,448, see
      // audit-3c-distribution.ts) and asking it of a single bill's rollup was the wrong question
      // asked of the right data.
      const dOld = new Set(scored.map((a) => a.o.stanceScore.toFixed(6)))
      const dNew = new Set(scored.map((a) => a.x.stanceScore.toFixed(6)))
      console.log(`\n   distinct rolled-up stance values over these ${scored.length} members:` +
        `  3A/3B ${dOld.size}   →   3C ${dNew.size}   (reported, not asserted — see the comment)`)
    } finally {
      await endNeonPool()
    }
  }

  console.log(`\n════ ${bad === 0 ? '✓ every property holds' : `❌ ${bad} FAILED`} ════`)
  process.exit(bad === 0 ? 0 : 1)
}

/**
 * ⚠ Guarded, because `check-3c.ts` imports `aggregate3B` from here to use as a BREAK — the real
 * broken state rather than a config knob. An unguarded `main()` would run the whole audit, and its
 * `process.exit()`, on import.
 */
if (require.main === module) {
  main().catch((e) => { console.error('[audit-3c-scoring] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
}

/**
 * `aggregate3B` in the shape `aggregate()` returns, so it can be swapped in as a drop-in break.
 *
 * ⚠ `consistency: stanceScore` is not a fudge — under 3A/3B the stance score WAS the consistency
 * ratio (`signed / mass`). That identity is the whole reason 3C could rename it and leave every
 * form of words untouched.
 */
export function aggregate3BAsAggregate(
  signals: SignalForMath[], asOf: string, cfg: PositionConfig = POSITION_CONFIG,
) {
  const a = aggregate3B(signals, asOf, cfg)
  return {
    stanceScore: a.stanceScore, consistency: a.stanceScore, confidence: a.confidence,
    mass: a.mass, signed: a.stanceScore * a.mass, attentionMass: 0,
    signalCounts: {} as Record<string, { n: number; weight: number }>,
  }
}
