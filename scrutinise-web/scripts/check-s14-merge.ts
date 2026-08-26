/**
 * check-s14-merge.ts — SEARCH S14. THE INVARIANTS, AND EVERY ONE OF THEM WATCHED FAILING.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * ⚠⚠ EVERY ASSERTION HERE HAS A NEGATIVE CONTROL THAT MUST FIRE. This codebase's standing rule
 * exists because it has shipped nine shapes of check that could not fail — including one that
 * passed only because the ranking put every counter-example below the `limit`, and a production
 * route probe that a Clerk redirect satisfied for the control as well as the subject. A check
 * whose failure has never been observed is a claim, not a test. Each `control()` below plants the
 * real broken state and REQUIRES the assertion to reject it; a control that passes is itself a
 * failure of this script.
 *
 * ⚠ NO NETWORK, NO DATABASE, NO MODEL. Every case is constructed, so this runs anywhere and its
 * result cannot be a comment on the weather. What it CANNOT prove is anything about live
 * retrieval — that is `scripts/measure-s14-merge.ts`, and the two are deliberately separate.
 *
 * Usage:  npx tsx --env-file=.env scripts/check-s14-merge.ts
 */
import { interleaveStreams, STREAM_FLOOR } from '../lib/lex/interleave'
import { mergeJudged } from '../lib/lex/merge-judged'
import { coverageSignalPresent, contentTerms, coverageOf } from '../lib/lex/term-coverage'
import { capRoundRobin, applyOrdering, estimatePence, rerankCandidates, RERANK_CANDIDATES, RERANK_SNIPPET_CHARS, RERANK_MAX_PENCE, type RerankCandidate } from '../lib/lex/reranker'
import { modelFor } from '../lib/lex/model-registry'
import { rankWeight, CONFIDENCE_DECAY_DEFAULT } from '../lib/lex/query-expansion'
import { RRF_K } from '../lib/lex/fusion'
import type { SearchResult } from '../lib/lex/page1-config'

export {}

let passed = 0
let failed = 0
let controlsFired = 0
let controlsMissed = 0

function ok(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`) }
  else { failed++; console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`) }
}

/** Plant the real broken state and REQUIRE the assertion to reject it. */
function control(name: string, brokenCondPasses: boolean) {
  if (!brokenCondPasses) { controlsFired++; console.log(`  🔥 control FIRED — ${name}`) }
  else { controlsMissed++; console.error(`  ⚠⚠ control DID NOT FIRE — ${name}. The assertion above cannot fail; it proves nothing.`) }
}

// ── constructed corpora ────────────────────────────────────────────────────────────────────────
const TERMS = 'sewage discharge water companies storm overflow permit'
/** A result containing ALL of the query's content terms — coverage 1.0. */
const strong = (id: string): SearchResult => ({
  id, type: 'GUIDANCE' as any, title: 'Storm overflow permit', citation: '',
  snippet: 'sewage discharge by water companies through a storm overflow under an environmental permit',
  score: 1, scorer: 'bm25', url: '', date: '', snippetMatched: true,
})
/** A result containing NONE of them — coverage 0. */
const weak = (id: string): SearchResult => ({
  id, type: 'DEBATE' as any, title: 'Business of the House', citation: '',
  snippet: 'the honourable member will know that further time has been allocated for this matter',
  score: 1, scorer: 'bm25', url: '', date: '', snippetMatched: true,
})
const ids = (rs: SearchResult[]) => rs.map((r) => r.id)
const streamsOf = (rs: SearchResult[]) => rs.map((r) => r.id.split('-')[0])

function build(nStreams: number, perStream: number, make: (s: number, k: number) => SearchResult): SearchResult[][] {
  return Array.from({ length: nStreams }, (_, s) => Array.from({ length: perStream }, (_, k) => make(s, k)))
}

async function main() {
  console.log('═'.repeat(110))
  console.log('SEARCH S14 — MERGE, GATE AND RERANKER INVARIANTS. Constructed cases only; no network, no DB.')
  console.log('═'.repeat(110))

  // ══════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n§A — THE DEGENERATE CASE IS TODAY\'S BEHAVIOUR, ID FOR ID')
  // ⚠ This is the assertion that makes every arm interpretable. If the judged merge with a floor
  // of 2, uniform confidence and no gate did NOT reproduce `interleaveStreams`, then a measured
  // difference between the arms could be the merge having been rewritten rather than a switch
  // having been thrown, and nothing downstream would be attributable.
  {
    const per = build(5, 12, (s, k) => (k % 3 === 0 ? strong(`s${s}-${k}`) : weak(`s${s}-${k}`)))
    const total = per.flat().length
    const rr = interleaveStreams(per, total, { names: ['a', 'b', 'c', 'd', 'e'] })
    const jd = mergeJudged(per, { streamNames: ['a', 'b', 'c', 'd', 'e'], query: TERMS, budget: total, floor: STREAM_FLOOR })
    ok('judged(floor=2, uniform, no gate) === interleaveStreams, id for id',
      JSON.stringify(ids(rr)) === JSON.stringify(ids(jd.results)), `${rr.length} results compared`)

    // NEGATIVE CONTROL 1 — non-uniform confidence MUST change the order. If it did not, (b) is
    // wired to nothing and every confidence arm would report "no effect" while having none.
    const weighted = mergeJudged(per, {
      streamNames: ['a', 'b', 'c', 'd', 'e'], query: TERMS, budget: total, floor: STREAM_FLOOR,
      confidence: { a: 0.2, b: 0.25, c: 0.3, d: 0.4, e: 1 },
    })
    control('confidence weights change the order (if this passes, (b) is inert)',
      JSON.stringify(ids(rr)) === JSON.stringify(ids(weighted.results)))

    // NEGATIVE CONTROL 2 — the SHIPPED floor of 0 must NOT reproduce round-robin, or the whole
    // point of §2 (a source may fill the window) is unreachable.
    const noFloor = mergeJudged(per, { streamNames: ['a', 'b', 'c', 'd', 'e'], query: TERMS, budget: total, relevanceFloor: 0.5 })
    control('floor 0 + a gate departs from round-robin (if this passes, §2 changes nothing)',
      JSON.stringify(ids(rr)) === JSON.stringify(ids(noFloor.results)))
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n§B — A SINGLE SOURCE MAY OCCUPY ALL TWENTY SLOTS (the brief\'s constructed case)')
  // "A design that cannot do this has not implemented the brief."
  {
    const names = ['legislation', 'debates', 'committees', 'caselaw', 'guidance']
    // Stream 2 (`committees`) holds the entire answer set; nothing else contains a query term.
    const per = build(5, 25, (s, k) => (s === 2 ? strong(`s${s}-${k}`) : weak(`s${s}-${k}`)))
    const total = per.flat().length

    const rr = interleaveStreams(per, total, { names })
    const rrShare = streamsOf(rr.slice(0, 20)).filter((x) => x === 's2').length
    ok('round-robin CANNOT show more than floor(20/5)=4 of the answering stream',
      rrShare === 4, `round-robin gave the answering stream ${rrShare} of 20`)

    const jd = mergeJudged(per, { streamNames: names, query: TERMS, budget: total, relevanceFloor: 0.5 })
    const jdShare = streamsOf(jd.results.slice(0, 20)).filter((x) => x === 's2').length
    ok('the judged merge gives the answering stream ALL TWENTY slots',
      jdShare === 20, `judged gave it ${jdShare} of 20 (report.takenInWindow=${JSON.stringify(jd.report.takenInWindow)})`)

    // NEGATIVE CONTROL — with the gate OFF and uniform weights there is nothing to judge on, so the
    // window must fall back to the equal share. If it did not, the gate is not what is doing the
    // work and the §B result above would be attributing a win to the wrong mechanism.
    const ungated = mergeJudged(per, { streamNames: names, query: TERMS, budget: total })
    const ungatedShare = streamsOf(ungated.results.slice(0, 20)).filter((x) => x === 's2').length
    control('the GATE is what fills the window (if this passes, §B\'s 20 came from somewhere else)',
      ungatedShare === 20)
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n§C — ADDING A SOURCE NEVER REDUCES WHAT ANOTHER SOURCE CONTRIBUTES')
  // ⚠ Charlie's rule, and the acceptance criterion. Tested as a WINDOW property, because the
  // retrieval half is already true by construction (`limit` is per-stream) and the display half is
  // the half that was broken.
  {
    const four = ['legislation', 'debates', 'caselaw', 'guidance']
    const five = [...four, 'committees']
    const strongFirst = (s: number, k: number) => (s === 0 ? strong(`s${s}-${k}`) : weak(`s${s}-${k}`))
    const per4 = build(4, 25, strongFirst)
    // The fifth source contributes NOTHING relevant — the case Charlie's rule is about.
    const per5 = [...per4.map((s) => s.map((r) => ({ ...r }))), Array.from({ length: 25 }, (_, k) => weak(`s4-${k}`))]

    const w4 = mergeJudged(per4, { streamNames: four, query: TERMS, budget: per4.flat().length, relevanceFloor: 0.5 })
    const w5 = mergeJudged(per5, { streamNames: five, query: TERMS, budget: per5.flat().length, relevanceFloor: 0.5 })
    ok('judged: adding a fifth (irrelevant) source leaves the first source\'s window share unchanged',
      w4.report.takenInWindow[0] === w5.report.takenInWindow[0],
      `${w4.report.takenInWindow[0]} → ${w5.report.takenInWindow[0]} of 20`)

    // NEGATIVE CONTROL — the round-robin on the SAME input must lose share, which is the defect.
    const r4 = interleaveStreams(per4, per4.flat().length, { names: four }).slice(0, 20)
    const r5 = interleaveStreams(per5, per5.flat().length, { names: five }).slice(0, 20)
    const rs4 = streamsOf(r4).filter((x) => x === 's0').length
    const rs5 = streamsOf(r5).filter((x) => x === 's0').length
    control(`round-robin DOES lose share when a source is added (${rs4} → ${rs5} of 20) — if this passes, the defect is not reproduced`,
      rs4 === rs5)
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n§D — NOTHING IS EVER DROPPED; THE GATE DEMOTES')
  {
    const names = ['a', 'b', 'c']
    const per = build(3, 10, (s, k) => (k < 3 ? strong(`s${s}-${k}`) : weak(`s${s}-${k}`)))
    const total = per.flat().length
    const jd = mergeJudged(per, { streamNames: names, query: TERMS, budget: total, relevanceFloor: 0.5 })
    ok('budget = total ⇒ the merge is a pure reordering: every input id is present exactly once',
      jd.results.length === total && new Set(ids(jd.results)).size === total, `${jd.results.length} of ${total}`)

    const terms = contentTerms(TERMS)
    const firstFail = jd.results.findIndex((r) => coverageOf(r, terms) < 0.5)
    const lastPass = jd.results.map((r) => coverageOf(r, terms) >= 0.5).lastIndexOf(true)
    ok('every gated-in candidate sorts ahead of every gated-out one (demotion, not deletion)',
      firstFail > lastPass, `last passing at ${lastPass}, first failing at ${firstFail}`)
    ok('the gate counts what it demoted, per stream',
      jd.report.gated.reduce((a, b) => a + b, 0) === total - 9, `gated=${JSON.stringify(jd.report.gated)}`)

    // NEGATIVE CONTROL — a merge that dropped the gated candidates would return fewer than `total`.
    control('a gated candidate is not removed from the list', jd.results.length < total)
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n§E — THE COVERAGE SIGNAL CHECK (S13 §3\'s snippet, without which the gate measures nothing)')
  {
    const withSignal = build(2, 3, (s, k) => strong(`s${s}-${k}`))
    const noSignal = withSignal.map((s) => s.map((r) => { const c = { ...r }; delete (c as any).snippetMatched; return c }))
    ok('the signal is detected when the services send `snippetMatched`', coverageSignalPresent(withSignal))
    ok('the signal is reported ABSENT on a pre-S13 §3 service (undefined everywhere)', !coverageSignalPresent(noSignal))
    // NEGATIVE CONTROL — `false` is a MEASURED state and must NOT read as absent. Conflating the
    // two is exactly the `?? false` defect the field was created to prevent.
    const measuredFalse = withSignal.map((s) => s.map((r) => ({ ...r, snippetMatched: false })))
    control('`snippetMatched: false` is treated as PRESENT, not as absent', !coverageSignalPresent(measuredFalse))
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n§F — THE RERANKER MAY REORDER. IT MAY NOT INVENT, DUPLICATE OR DROP SILENTLY.')
  {
    const cands: RerankCandidate[] = Array.from({ length: 6 }, (_, i) => ({
      id: `c${i}`, stream: 'legislation', title: `t${i}`, citation: '', snippet: 's',
    }))
    // A deliberately misbehaving answer: reorders, invents 99 and 0, duplicates 3, omits 5 and 6.
    const misbehaving = [4, 2, 99, 3, 0, 3, 1]
    const r = applyOrdering(misbehaving, cands)
    ok('an INVENTED candidate number is discarded and counted', r.invented === 2, `invented=${r.invented}`)
    ok('a DUPLICATED candidate number is counted, first occurrence wins', r.duplicated === 1, `duplicated=${r.duplicated}`)
    ok('OMITTED candidates are counted', r.omitted === 2, `omitted=${r.omitted} (c4, c5 never named)`)
    ok('no invented id ever reaches the priority map',
      [...r.priority.keys()].every((id) => cands.some((c) => c.id === id)), `${r.priority.size} ranked`)

    // ⚠ AND THE OMITTED ONES ARE STILL IN THE RESULT — behind the ranked ones, not gone. This is
    // the assertion that matters most: "a model that quietly drops the right answer is
    // indistinguishable from retrieval that never found it."
    const per = [cands.map((c) => ({ ...strong(c.id) }))]
    const merged = mergeJudged(per, { streamNames: ['legislation'], query: TERMS, budget: 6, priority: r.priority })
    ok('every omitted candidate survives the merge, ordered BEHIND the ranked ones',
      merged.results.length === 6 && ids(merged.results).slice(4).sort().join() === 'c4,c5',
      ids(merged.results).join(' '))

    // NEGATIVE CONTROL — the reranker's ordering must actually be used. If the merged order equals
    // the input order, `priority` is wired to nothing.
    control('the reranker\'s ordering changes the merged order',
      ids(merged.results).join() === cands.map((c) => c.id).join())

    // The cap is taken round-robin, so every stream is represented in what the model reads.
    const pools = Array.from({ length: 5 }, (_, s) =>
      Array.from({ length: 20 }, (_, k) => ({ id: `p${s}-${k}`, stream: `st${s}`, title: '', citation: '', snippet: '' })))
    const capped = capRoundRobin(pools, 12)
    const perStreamInCap = new Set(capped.map((c) => c.stream))
    ok('the candidate cap is taken ROUND-ROBIN — every stream is represented in what the model reads',
      capped.length === 12 && perStreamInCap.size === 5, `${capped.length} candidates from ${perStreamInCap.size} streams`)
    // NEGATIVE CONTROL — a merged-order cap would take 12 from the first stream only, which is the
    // rationing defect one layer up.
    control('a cap that took the first 12 in pool order would starve four streams',
      new Set(pools.flat().slice(0, 12).map((c) => c.stream)).size === 5)
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n§G — THE COST CEILING REFUSES BEFORE THE CALL, AND AN UNPRICED MODEL IS NOT FREE')
  {
    const big: RerankCandidate[][] = [Array.from({ length: 200 }, (_, i) => ({
      id: `x${i}`, stream: 'legislation', title: 'A long statutory title of the ordinary kind', citation: '',
      snippet: 'x'.repeat(400),
    }))]
    const saved = process.env.SEARCH_RERANK_MAX_PENCE
    process.env.SEARCH_RERANK_MAX_PENCE = '0.0001'
    const out = await rerankCandidates('does the ceiling fire', big, { label: 'check' })
    if (saved === undefined) delete process.env.SEARCH_RERANK_MAX_PENCE; else process.env.SEARCH_RERANK_MAX_PENCE = saved
    ok('a per-query cost ceiling refuses the call and names the reason',
      !out.applied && out.reason === 'over-cost-ceiling', `${out.reason}: ${out.detail}`)
    ok('nothing was spent when the ceiling refused', out.usage === null && out.pence === null)
    // NEGATIVE CONTROL — a ceiling that never fires is not a ceiling.
    control('the ceiling actually refused (a model call would have been made otherwise)', out.applied)

    ok('an UNPRICED model estimates NULL, not 0 — so the ceiling refuses rather than waving it through',
      estimatePence([{ id: 'a', stream: 's', title: 't', citation: '', snippet: 's' }], 'no-such-model-9000') === null)

    // ⚠⚠ AND THE CEILING MUST NOT REFUSE THE SHIPPED CONFIGURATION. This assertion exists because
    // the first value of `SEARCH_RERANK_MAX_PENCE` (1.5p) did exactly that: at the default model,
    // cap and snippet budget the estimate is ~4.3p, most of it the thinking allowance, so every
    // call would have been refused and the log would have read "the reranker never helped".
    // A guard that refuses the configuration it guards is the mirror image of a guard that cannot
    // fire, and this project has shipped nine of the latter.
    const shipped: RerankCandidate[] = Array.from({ length: RERANK_CANDIDATES() }, (_, i) => ({
      id: `d${i}`, stream: 'legislation', title: 'A statutory title of the ordinary length', citation: 'c',
      snippet: 'x'.repeat(RERANK_SNIPPET_CHARS()),
    }))
    const shippedEst = estimatePence(shipped, modelFor('search.reranker'))
    ok('the SHIPPED configuration fits inside the SHIPPED ceiling (a ceiling that refuses its own defaults is an off switch)',
      shippedEst !== null && shippedEst <= RERANK_MAX_PENCE(),
      `${modelFor('search.reranker')} × ${RERANK_CANDIDATES()} candidates ⇒ est ${shippedEst?.toFixed(3)}p vs ceiling ${RERANK_MAX_PENCE()}p`)
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n§H — THE CONFIDENCE WEIGHT SCALE STILL MEANS WHAT THE COMMENT SAYS IT MEANS')
  // ⚠⚠ THIS ASSERTION EXISTS BECAUSE THE FIRST VALUE OF THE DECAY WAS WRONG AND NOTHING CAUGHT IT
  // UNTIL A LIVE RUN. `merge-judged.ts` orders by w/(k+rank), so the dial says exactly one thing:
  // how many ranks a stream's priority is worth. At 0.35 that was 21 ranks — the top stream's
  // whole top-20 outranking every other stream's best — and one source took the entire window on
  // 40 of 40 multi-stream questions. The constant and the sentence describing it are now checked
  // against each other, so a future edit to one without the other fails here rather than in
  // production.
  {
    const PROMISED_RANKS = 4
    // The top stream's rank-r beats the next stream's rank-0 exactly when w(0)/(k+r+1) > w(1)/(k+1).
    const beats = (r: number) => rankWeight(0) / (RRF_K + r + 1) > rankWeight(1) / (RRF_K + 1)
    let worth = 0
    while (worth < 100 && beats(worth + 1)) worth++
    ok(`a stream's priority is worth about ${PROMISED_RANKS} ranks, as the comment claims`,
      worth >= PROMISED_RANKS - 1 && worth <= PROMISED_RANKS + 1,
      `measured ${worth} ranks at decay ${CONFIDENCE_DECAY_DEFAULT} (weights ${[0, 1, 2, 3, 4].map((i) => rankWeight(i).toFixed(3)).join(' ')})`)
    // NEGATIVE CONTROL — the value that was actually shipped first must FAIL this, or the check
    // could not have caught the defect it was written for.
    const saved = process.env.LEX_ROUTER_CONFIDENCE_DECAY
    process.env.LEX_ROUTER_CONFIDENCE_DECAY = '0.35'
    let worthBad = 0
    while (worthBad < 100 && rankWeight(0) / (RRF_K + worthBad + 2) > rankWeight(1) / (RRF_K + 1)) worthBad++
    if (saved === undefined) delete process.env.LEX_ROUTER_CONFIDENCE_DECAY; else process.env.LEX_ROUTER_CONFIDENCE_DECAY = saved
    control(`the original 0.35 would FAIL this check (it is worth ${worthBad} ranks, i.e. the whole window)`,
      worthBad >= PROMISED_RANKS - 1 && worthBad <= PROMISED_RANKS + 1)
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n' + '─'.repeat(110))
  console.log(`  ${passed} passed, ${failed} failed · ${controlsFired} negative controls fired, ${controlsMissed} did NOT`)
  if (controlsMissed) console.error('  ⚠⚠ A CONTROL THAT DID NOT FIRE MEANS THE ASSERTION ABOVE IT CANNOT FAIL. Treat this run as failed.')
  console.log('─'.repeat(110))
  process.exit(failed || controlsMissed ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
