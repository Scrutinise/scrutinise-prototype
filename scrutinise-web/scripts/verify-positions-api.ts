/**
 * verify-positions-api.ts — GRAPH 3A §5, exercised against the live Neon graph.
 *
 * `check-3a.ts` (scripts/graph) proves the arithmetic and the database invariants. This proves the
 * thing the admin surface and, later, the deepening actually call: that `positionsFor()` returns
 * real actors with real citations on real targets, that the rollup across several targets does what
 * the per-target estimates cannot, and that an absence stays an absence.
 *
 * ⚠ It asserts CONTENT, not just shape. A harness that only checked "an array came back" would
 * have passed on an empty array, which is the exact failure this project has been bitten by.
 *
 * Usage (from scrutinise-web):
 *   npx tsx --env-file=.env --tsconfig tsconfig.json scripts/verify-positions-api.ts
 */
import { positionsFor, findTargets, parseTarget } from '../lib/graph/positions'
import { describeConfidence } from '../lib/graph/position-math'
import { endPools } from '../lib/pg-pool'

export {}

let pass = 0
let fail = 0
const failures: string[] = []
const check = (ok: boolean, name: string, detail = '') => {
  if (ok) pass++
  else { fail++; failures.push(name) }
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`)
}

/**
 * The Terminally Ill Adults (End of Life) Bill divisions. Chosen because it is the clearest free
 * vote in the corpus, so a reader can check the answer against what they already know: the
 * supporters and opponents are a matter of public record and cut across every party.
 */
const ASSISTED_DYING = [
  'division:commons:1877', // Second Reading, 29 Nov 2024
  'division:commons:2071', // Third Reading, 20 Jun 2025
]

/**
 * The same Bill's report-stage amendments as well as its two readings.
 *
 * ⚠ This list exists because the first version of the divided-record check was WRONG ABOUT THE
 * WORLD, not about the code: across the two readings alone, all 400 members who voted in both
 * voted the same way both times — which is what a settled conscience position looks like, and is
 * a fact about assisted dying rather than a bug. Asserting that somebody must have changed their
 * mind was asserting something the record does not owe us. Across the amendments a member can
 * support the Bill and oppose a particular amendment to it, so both shapes really are present.
 */
const ASSISTED_DYING_FULL = [
  'division:commons:1877', 'division:commons:2029', 'division:commons:2052',
  'division:commons:2066', 'division:commons:2067', 'division:commons:2068',
  'division:commons:2069', 'division:commons:2070', 'division:commons:2071',
]

const AS_OF = '2026-08-19'

async function main() {
  console.log('════ §5 READ API, AGAINST THE LIVE GRAPH ════')

  // ── 1. a single division returns real people with real citations ──────────────────────────
  const one = await positionsFor([{ type: 'division', id: 'commons:2071' }], { asOf: AS_OF, limit: 10 })
  check(one.actorsMatched > 300, 'a Commons division returns hundreds of actors',
    `${one.actorsMatched} actors, ${one.elapsedMs} ms`)
  check(one.actors.every((a) => a.grounds.length > 0), 'every actor carries at least one citation')
  check(one.actors.every((a) => a.grounds.every((g) => g.evidenceIds.length > 0)),
    'every citation carries an evidence id that can be drilled to')
  check(one.actors.every((a) => a.grounds.every((g) => g.targetLabel && g.targetLabel.length > 3)),
    'every citation carries a displayable label, not just an id',
    one.actors[0]?.grounds[0]?.targetLabel ?? '(none)')
  check(one.actors.every((a) => a.identityStatement.length > 0),
    'every actor states how well we know who they are',
    one.actors[0]?.identityStatement)
  check(one.actors.every((a) => a.grounds.every((g) => g.derivation === 'free-vote-heuristic:v1')),
    'Third Reading of the assisted dying Bill classifies as free-vote-like throughout')

  // ── 2. the rollup across targets does what one target cannot ──────────────────────────────
  const both = await positionsFor(ASSISTED_DYING.map((t) => parseTarget(t)!), { asOf: AS_OF, limit: 400 })
  const twoSignals = both.actors.filter((a) => a.grounds.length === 2)
  check(twoSignals.length > 100, 'hundreds of members voted in BOTH divisions',
    `${twoSignals.length} of ${both.actorsMatched}`)
  check(twoSignals.every((a) => Math.abs(a.stanceScore) === 1),
    'across the two readings, every member who voted twice voted the same way twice',
    `${twoSignals.length} members, none divided — a settled conscience position, not a bug`)

  // The divided record, on the full set where a member can back the Bill and resist an amendment.
  const full = await positionsFor(ASSISTED_DYING_FULL.map((t) => parseTarget(t)!), { asOf: AS_OF, limit: 500, maxGroundsPerActor: 9 })
  const many = full.actors.filter((a) => a.grounds.length >= 3)
  const consistent = many.filter((a) => Math.abs(a.stanceScore) === 1)
  const divided = many.filter((a) => Math.abs(a.stanceScore) < 1)
  check(consistent.length > 0 && divided.length > 0,
    'the rollup separates a consistent record from a divided one, rather than averaging both away',
    `of ${many.length} members with 3+ votes on the Bill: ${consistent.length} entirely consistent, ${divided.length} divided`)
  check(divided.every((a) => a.stanceWording === 'divided record' || Math.abs(a.stanceScore) >= 0.2),
    'a divided record is described as divided, never as neutral and never as absent')
  const bestOne = Math.max(...one.actors.map((a) => a.confidence))
  const bestTwo = Math.max(...both.actors.map((a) => a.confidence))
  check(bestTwo > bestOne,
    'two consistent votes carry more confidence than one — the whole point of the rollup',
    `${bestOne.toFixed(3)} → ${bestTwo.toFixed(3)}`)

  // ⚠ The finding worth stating rather than hiding: at the per-target grain nothing can reach the
  // "strong recorded record" band, because a division holds exactly one vote per member. It takes
  // several targets to get there, which is what the deepening will always pass.
  check(describeConfidence(bestOne) === 'weak indication' || describeConfidence(bestOne) === 'some recorded signals',
    'one free vote alone never reads as a strong record',
    `${bestOne.toFixed(3)} → "${describeConfidence(bestOne)}"`)

  // ── 3. absence is an absence ───────────────────────────────────────────────────────────────
  const none = await positionsFor([{ type: 'division', id: 'commons:99999999' }], { asOf: AS_OF })
  check(none.actors.length === 0 && none.actorsMatched === 0,
    'a target with no signals returns no actors at all — never a zero-score row')
  check(none.targetsWithNoSignals.length === 1,
    'and the target is NAMED as having no record, so the caller can say so specifically')

  // ── 4. attention signals never manufacture a stance ────────────────────────────────────────
  const inquiryTargets = await positionsFor([{ type: 'inquiry', id: '6260' }], { asOf: AS_OF, limit: 20 })
  check(inquiryTargets.actorsMatched > 0, 'an inquiry returns its witnesses',
    `${inquiryTargets.actorsMatched} actors`)
  check(inquiryTargets.actors.every((a) => a.stanceScore === 0),
    'a witness appearance records attention, never a side')
  check(inquiryTargets.actors.every((a) => a.confidence <= 0.15 + 1e-9),
    'and never exceeds the attention confidence ceiling',
    `max ${Math.max(...inquiryTargets.actors.map((a) => a.confidence)).toFixed(3)}`)
  check(inquiryTargets.actors.every((a) => a.stanceWording === 'divided record'),
    'its wording is never "supports" or "opposes"')

  // ── 5. the admin surface's target finder works on plain words ──────────────────────────────
  const found = await findTargets('Terminally Ill Adults', 25)
  check(found.length > 0, 'free-text target search finds the assisted dying divisions',
    `${found.length} candidates, first "${found[0]?.label?.slice(0, 60)}"`)
  check(found.every((f) => f.label && f.label.length > 3), 'every candidate has a label a human can read')

  // ── 6. per-target estimates are attached and agree with the table ──────────────────────────
  check(both.actors.every((a) => a.byTarget.length === a.grounds.length),
    'each actor carries one precomputed per-target estimate for each signal it has')
  check(both.configVersion !== null, 'the result names the config version that produced the estimates',
    both.configVersion ?? '(none)')

  // ── 7. ranking puts the strongest record first ─────────────────────────────────────────────
  const scores = both.actors.map((a) => Math.abs(a.stanceScore) * a.confidence)
  check(scores.every((s, i) => i === 0 || scores[i - 1] >= s - 1e-9),
    'actors are ranked by how strong and how well-evidenced the record is')

  console.log(`\n──── a real answer, printed so it can be argued with ────`)
  for (const a of both.actors.slice(0, 6)) {
    console.log(`  ${a.name.padEnd(28)} ${a.stanceWording.padEnd(15)} ${a.stanceScore.toFixed(2).padStart(5)}  ${a.confidenceWording.padEnd(22)} ${a.confidence.toFixed(3)}`)
    for (const g of a.grounds) {
      console.log(`      ${g.date}  ${g.direction > 0 ? 'for    ' : 'against'}  ${g.derivation}  ${(g.targetLabel ?? '').slice(0, 58)}`)
    }
  }

  console.log(`\n════ ${pass}/${pass + fail} ════`)
  if (fail) { console.log('FAILED:'); for (const f of failures) console.log(`  · ${f}`) }
  await endPools()
  process.exit(fail === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error('[verify-positions-api] FATAL', e instanceof Error ? e.stack : e)
  await endPools().catch(() => {})
  process.exit(1)
})
