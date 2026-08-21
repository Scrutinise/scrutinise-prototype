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
  // ⚠⚠⚠ `limit` WAS 400, AND GRAPH 3C WATCHED IT HIDE THE COUNTER-EXAMPLES A SECOND TIME.
  //
  // 3B rewrote the assertion below to require the 16 members who changed side to be VISIBLE — and
  // left the limit at 400, because under 3B's ranking key those 16 sorted to ranks 1–23 and were
  // comfortably inside it. 3C's whole §1 is that the key was pointing the wrong way: a
  // contradictory record is now correctly a LOW-confidence one, so the same 16 sorted to the
  // bottom, fell below 400 again, and the check reported **"400 the same way twice, 0 changed
  // side"** — the identical false sentence 3A published, arrived at from the opposite direction.
  //
  // It FAILED rather than passing, which is the whole value of 3B's rewrite and is why this is a
  // paragraph rather than an incident. But the lesson is narrower than "assert the mechanism":
  // **3B fixed the assertion and not the harness limit that had defeated it**, so the fix survived
  // exactly as long as the ranking key it was written against. The limit is now larger than the
  // matched set, and the harness ASSERTS it is not truncating — a bound that cannot bite cannot
  // hide anything, whatever the next key turns out to be.
  const both = await positionsFor(ASSISTED_DYING.map((t) => parseTarget(t)!), { asOf: AS_OF, limit: 5000 })
  check(both.actors.length === both.actorsMatched,
    'the harness sees EVERY matched actor — no ranking key can hide a counter-example below the limit',
    `${both.actors.length} shown of ${both.actorsMatched} matched`)
  const twoSignals = both.actors.filter((a) => a.grounds.length === 2)
  check(twoSignals.length > 100, 'hundreds of members voted in BOTH divisions',
    `${twoSignals.length} of ${both.actorsMatched}`)

  // ⚠⚠ CORRECTED BY GRAPH 3B. This assertion used to read *"across the two readings, every member
  // who voted twice voted the same way twice"*, and it passed — 23/23 — and it was WRONG. The raw
  // rows say 587 members voted in both readings and **16 of them changed side**.
  //
  // It passed because of the SORT KEY, not because of the data. 3A ranked by |stance| × confidence;
  // a member who changed their mind has stance ≈ 0, so the product is ≈ 0 and they sort last. All
  // 16 landed at ranks 612–627 of 627, and this harness passes `limit: 400` — so every single
  // counter-example was below the cut-off and the assertion could not have failed. Measured by
  // `scripts/graph/probe-3b-rank.ts`.
  //
  // 3A's report repeated it as a fact about the world: *"All 400 who voted in both voted the same
  // way both times — a settled conscience position, not a bug."* That sentence is false, and it is
  // exactly the shape this project keeps getting caught by: **a check that could only pass, whose
  // passing was then written down as a finding.**
  //
  // Rewritten to assert the mechanism — that both shapes exist and the rollup tells them apart —
  // and to REQUIRE the counter-examples to be visible, so a future ranking change that buries them
  // again fails here instead of producing another confident sentence.
  const changedSide = both.actors.filter((a) => a.grounds.length === 2 && Math.abs(a.consistency) < 1)
  const heldFirm = both.actors.filter((a) => a.grounds.length === 2 && Math.abs(a.consistency) === 1)
  check(heldFirm.length > 100 && changedSide.length > 0,
    'across the two readings, most members held firm and SOME changed side — both are present',
    `${heldFirm.length} the same way twice, ${changedSide.length} changed side` +
    (changedSide.length ? ` (e.g. ${changedSide.slice(0, 3).map((a) => a.name).join(', ')})` : ''))
  check(changedSide.every((a) => a.divided && a.stanceWording === 'divided record'),
    'a member who changed side is flagged divided and worded "divided record", never averaged away')
  check(changedSide.every((a) => a.byTarget.length === 2 && a.byTarget[0].stanceWording !== a.byTarget[1].stanceWording),
    'and their two readings are shown SEPARATELY, with opposite sides — §4.2, never summed')

  // The divided record, on the full set where a member can back the Bill and resist an amendment.
  //
  // ⚠ `limit` raised from 500 to 700 by GRAPH 3B, and the reason is the same lesson as above.
  // Under 3B's sort key a MIXED record outranked a consistent one — signals that disagreed landed
  // in different harmonic-discount groups, so each counted in full and the mass was larger. On
  // this Bill only ONE of 426 members with 9+ votes is entirely consistent, and at limit 500 of
  // ~630 matched they fell off the bottom, making `consistent.length > 0` fail.
  //
  // ⚠⚠ GRAPH 3C FIXED THE CAUSE, AND THE LIMIT STAYS AT 700 ANYWAY. That member now ranks **1 of
  // 426** rather than 426 of 426 (`audit-3c-scoring.ts`), so 500 would pass again — which is
  // exactly why the limit is not being lowered back. The assertion is about the DATA containing
  // both shapes; making it depend on where today's ranking puts them is how 3A came to publish a
  // finding that could not fail. A limit generous enough to hold every matched actor keeps the
  // check honest under whatever the next ranking key turns out to be.
  const full = await positionsFor(ASSISTED_DYING_FULL.map((t) => parseTarget(t)!), { asOf: AS_OF, limit: 700, maxGroundsPerActor: 9 })
  const many = full.actors.filter((a) => a.grounds.length >= 3)
  const consistent = many.filter((a) => Math.abs(a.consistency) === 1)
  const divided = many.filter((a) => Math.abs(a.consistency) < 1)
  check(consistent.length > 0 && divided.length > 0,
    'the rollup separates a consistent record from a divided one, rather than averaging both away',
    `of ${many.length} members with 3+ votes on the Bill: ${consistent.length} entirely consistent, ${divided.length} divided`)
  check(divided.every((a) => a.stanceWording === 'divided record' || Math.abs(a.consistency) >= 0.2),
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
  check(inquiryTargets.actors.every((a) => a.stanceScore === 0 && a.consistency === 0),
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

  // ── 7. the order is the order it says it is, and it says when it has run out ───────────────
  // GRAPH 3B §1. 3A asserted `|stance| × confidence` DESC. That key is replaced (brief §1) and,
  // more to the point, an assertion that the rows come back in the order the code sorted them in
  // is a check that cannot fail. What can fail — and is what actually broke on the live page — is
  // the page claiming a ranking when every row shown carries the same key.
  const conf = both.actors.map((a) => a.confidence)
  check(conf.every((c, i) => i === 0 || conf[i - 1] >= c - 1e-9),
    'actors come back in descending confidence, the key the page prints')
  check(both.ranking.key.startsWith('confidence'), 'the result names its own sort key', both.ranking.key)
  check(both.ranking.ofMatched === both.actorsMatched, 'the tie count is over the actors MATCHED, not the ones shown')

  // The case Charlie hit: two divisions where the top of the list is a large tied block.
  const tied = await positionsFor(
    [{ type: 'division', id: 'commons:2051' }, { type: 'division', id: 'commons:2068' }],
    { asOf: AS_OF, limit: 40, actorKind: 'person' })
  check(tied.ranking.tiedAtTop > 40,
    'Charlie\'s case really is a tied block bigger than the page',
    `${tied.ranking.tiedAtTop} tied of ${tied.ranking.ofMatched} matched`)
  check(tied.ranking.shownOrderIsNameOrderOnly === true,
    'and the page is told the visible order is name order, not a ranking')
  check(tied.ranking.note !== null && /not a ranking/i.test(tied.ranking.note!),
    'and given the sentence to print', tied.ranking.note ?? '(none)')

  // ── 8. GRAPH 3B §1 — the stance word never travels without its target ──────────────────────
  check(one.actors.every((a) => a.claim.includes('Terminally Ill Adults')),
    'every claim names the division it is a claim about',
    one.actors[0]?.claim?.slice(0, 96))
  check(one.actors.every((a) => a.claimCaveat === null),
    'a single-target claim carries no multi-target caveat')
  // ⚠ GRAPH 3C — THIS IS THE THIRD ASSERTION IN THIS FILE THAT `limit: 400` WAS PROPPING UP.
  // It read `both.actors.every(a => a.claimCaveat !== null)` and passed, because the top 400 under
  // the old key happened to be all two-division voters. Raising the limit to show every matched
  // actor brought in the 40 members who voted in only ONE of the two divisions — whose caveat is
  // correctly null, since there is nothing to warn about combining. The assertion was measuring
  // "the sample contains no single-target actors", not the property it names. Now it says which
  // actors it is about, and the complementary case is asserted rather than assumed.
  const multi = both.actors.filter((a) => a.byTarget.length > 1)
  const single = both.actors.filter((a) => a.byTarget.length === 1)
  check(multi.length > 100 && multi.every((a) => a.claimCaveat !== null),
    'a multi-target claim always carries the do-not-read-this-as-the-subject caveat',
    `${multi.length} multi-target actors, all caveated`)
  check(single.length > 0 && single.every((a) => a.claimCaveat === null),
    'and a single-target claim never carries it — there is nothing to warn about combining',
    `${single.length} single-target actors, none caveated`)
  check(both.actors.every((a) => a.byTarget.length === a.grounds.length),
    'every requested target the actor has a signal for appears separately in byTarget')
  check(both.actors.every((a) => a.byTarget.every((t) => t.targetLabel && t.targetLabel.length > 3)),
    'and each one is labelled with something a human can read',
    both.actors[0]?.byTarget?.[0]?.targetLabel ?? '(none)')

  console.log(`\n──── a real answer, printed so it can be argued with ────`)
  for (const a of both.actors.slice(0, 6)) {
    console.log(`  ${a.name.padEnd(28)} ${a.confidenceWording.padEnd(22)} ${a.confidence.toFixed(3)}  ${a.divided ? '[divided]' : ''}`)
    console.log(`      ${a.claim}`)
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
