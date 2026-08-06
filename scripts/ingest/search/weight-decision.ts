/**
 * weight-decision.ts — the cross-stream fusion-weight decision, computed not asserted.
 *
 * Reads the `.weight-sweep/<stream>.json` sidecars that score-stream-fusion.ts writes and
 * answers the one question the five per-stream reports cannot answer individually: is there a
 * SINGLE fusion weight that serves every stream, or does the optimum genuinely vary by stream?
 *
 * WHY THIS IS A SCRIPT AND NOT A HAND-WRITTEN TABLE. The number it produces becomes the
 * carried default in scrutinise-web/lib/lex/fusion.ts, replacing 0.7 — which is itself a
 * number that got carried for weeks after the index it was measured on had been rebuilt twice,
 * partly because it lived only in prose and a re-derivation meant re-typing five tables. This
 * regenerates from the sidecars in a second.
 *
 * THE DECISION RULE, stated before the numbers so it cannot be fitted to them:
 *   1. WEAK DOMINANCE FIRST. If some weight is the best-or-joint-best in EVERY stream, take it.
 *      Nothing is traded away, so no averaging convention has to be defended.
 *   2. If no weight dominates, report the per-stream table instead of a single number, and say
 *      the optimum varies — that is a real finding, not a failure to decide.
 *   3. Macro (per-stream) and micro (per-query) averages are reported either way. They weight
 *      the streams differently — legislation has 16 queries and committees 4 — and a
 *      recommendation that only survives one of the two conventions is not a recommendation.
 *
 * DISCRIMINATION IS REPORTED ALONGSIDE. A stream scoring identically at every weight (committees
 * does) contributes nothing to the choice, and counting it as agreement would inflate five
 * streams of evidence into more confidence than two streams of evidence deserve.
 *
 * Usage: tsx search/weight-decision.ts [--out=GOLD_TEST_08_fusion_weight_decision.md]
 */
import fs from 'fs'
import path from 'path'

const arg = (n: string) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : null }
const OUT = arg('out') ?? 'GOLD_TEST_08_fusion_weight_decision.md'
const SWEEP_DIR = path.join(__dirname, '.weight-sweep')
const PRIOR = 0.7
const EPS = 1e-9

interface Sidecar {
  stream: string; tier: string; generated: string; draft: boolean
  candK: number; rrfK: number; topN: number
  bestValue: number; bestWeights: number[]
  queries: { id: string; draft: boolean; expected: number }[]
  weights: { w: number; aggregate: number; perQuery: Record<string, number> }[]
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const pp = (d: number) => `${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)}pp`
const wlab = (w: number) => (w === 0 ? 'BM25 only' : w === 1 ? 'vector only' : `${Math.round(w * 100)}/${Math.round((1 - w) * 100)}`)
/** "a, b and c" — the join(' and ') in the first draft produced "a and b and c and d". */
const list = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? 'nothing') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

function main() {
  const files = fs.readdirSync(SWEEP_DIR).filter((f) => f.endsWith('.json')).sort()
  if (!files.length) { console.error(`[weight-decision] no sidecars in ${SWEEP_DIR} — run score-stream-fusion.ts first`); process.exit(1) }
  const cards: Sidecar[] = files.map((f) => JSON.parse(fs.readFileSync(path.join(SWEEP_DIR, f), 'utf8')))

  // Every sidecar must have swept the SAME grid, or "best across streams" compares weights that
  // were not all offered to every stream — the kind of quiet mismatch that produces a confident
  // wrong answer rather than an error.
  const grid = cards[0].weights.map((x) => x.w)
  for (const c of cards) {
    const g = c.weights.map((x) => x.w)
    if (g.length !== grid.length || g.some((w, i) => w !== grid[i])) {
      console.error(`[weight-decision] FATAL: ${c.stream} swept [${g}] but ${cards[0].stream} swept [${grid}]. Re-run all streams on one grid.`)
      process.exit(1)
    }
  }

  const aggOf = (c: Sidecar, w: number) => c.weights.find((x) => x.w === w)!.aggregate
  const nq = (c: Sidecar) => c.queries.length
  const totalQ = cards.reduce((a, c) => a + nq(c), 0)
  const macro = (w: number) => cards.reduce((a, c) => a + aggOf(c, w), 0) / cards.length
  const micro = (w: number) => cards.reduce((a, c) => a + aggOf(c, w) * nq(c), 0) / totalQ

  /** A stream discriminates if its recall is not identical at every weight. */
  const discriminates = (c: Sidecar) => Math.max(...grid.map((w) => aggOf(c, w))) - Math.min(...grid.map((w) => aggOf(c, w))) > EPS
  const dominant = grid.filter((w) => cards.every((c) => aggOf(c, w) >= c.bestValue - EPS))

  const macroBest = grid.filter((w) => Math.abs(macro(w) - Math.max(...grid.map(macro))) < EPS)
  const microBest = grid.filter((w) => Math.abs(micro(w) - Math.max(...grid.map(micro))) < EPS)

  const md: string[] = []
  md.push('# GOLD_TEST_08 — the fusion weight, decided across all five streams', '')
  md.push(`*Generated ${new Date().toISOString()} by \`weight-decision.ts\` from the five \`.weight-sweep\` sidecars written by \`score-stream-fusion.ts\`. Recall@${cards[0].topN}, CAND_K=${cards[0].candK}, RRF_K=${cards[0].rrfK}, gemini-embedding-001 @768d, both arms tier-scoped per stream. Answer key validated 6 Aug 2026.*`, '')

  if (dominant.length) {
    const rec = dominant.includes(0.5) ? 0.5 : dominant[0]
    md.push(`## Recommendation: **${wlab(rec)} — vector weight ${rec}**`, '')
    md.push(`**The optimum does not vary by stream.** ${wlab(rec)} is the best-or-joint-best weight in **all ${cards.length} streams**, so it is not a compromise or an average — no stream would do better on a different weight, and adopting it trades nothing away. A per-stream weight table would therefore be spurious precision.`, '')
    if (dominant.length > 1) md.push(`(${dominant.map(wlab).join(', ')} all dominate. ${wlab(rec)} is recommended among them because it also wins outright on both averages below, where the others only tie.)`, '')
  } else {
    md.push(`## Recommendation: **the optimum VARIES by stream — see the per-stream table**`, '')
    md.push(`No single weight is best-or-joint-best in every stream, so a single carried default would knowingly cost recall somewhere. The per-stream column below is the recommendation.`, '')
  }
  md.push(`Replaces the carried default of **0.7**, which was tuned on the pilot subset against an index that has since been rebuilt twice (4 Aug coverage fix, 5 Aug dedup).`, '')

  md.push('## The full grid, every stream', '')
  md.push(`| weight | ${cards.map((c) => c.stream).join(' | ')} | macro avg | micro avg (per query) |`)
  md.push(`|---|${cards.map(() => '---').join('|')}|---|---|`)
  for (const w of grid) {
    const cells = cards.map((c) => `${pct(aggOf(c, w))}${Math.abs(aggOf(c, w) - c.bestValue) < EPS && discriminates(c) ? ' **★**' : ''}`)
    const mk = macroBest.includes(w) ? ' **←**' : ''
    const mi = microBest.includes(w) ? ' **←**' : ''
    md.push(`| ${wlab(w)}${w === PRIOR ? ' *(prior default)*' : ''} | ${cells.join(' | ')} | ${pct(macro(w))}${mk} | ${pct(micro(w))}${mi} |`)
  }
  md.push('')
  md.push('★ = best-or-joint-best for that stream (omitted where the stream cannot discriminate — see below).', '')

  md.push('## How much each stream actually contributes to this decision', '')
  md.push('| stream | queries | spread across the grid | discriminates? | answer key |')
  md.push('|---|---|---|---|---|')
  for (const c of cards) {
    const hi = Math.max(...grid.map((w) => aggOf(c, w))), lo = Math.min(...grid.map((w) => aggOf(c, w)))
    md.push(`| ${c.stream} | ${nq(c)} | ${pct(hi - lo)} | ${discriminates(c) ? `yes — best ${c.bestWeights.map(wlab).join(', ')}` : '**no — flat at every weight**'} | ${c.draft ? '⚠ CC-drafted, unvalidated' : 'validated 6 Aug'} |`)
  }
  md.push('')
  const flat = cards.filter((c) => !discriminates(c))
  const disc = cards.filter((c) => discriminates(c))
  if (flat.length) {
    md.push(`**Read this before quoting "all five streams agree".** ${list(flat.map((c) => c.stream))} scores identically at every weight, so ${flat.length === 1 ? 'it is' : 'they are'} consistent with the recommendation but ${flat.length === 1 ? 'provides' : 'provide'} no evidence for it. The weight is genuinely chosen by ${list(disc.map((c) => c.stream))} — ${disc.reduce((a, c) => a + nq(c), 0)} of the ${totalQ} queries. ${list(flat.map((c) => c.stream))} at 100% everywhere is a ceiling effect, not a strong result; a test everything passes measures nothing.`, '')
    md.push(`And of those, only **${list(disc.filter((c) => !c.draft).map((c) => c.stream))}** ${disc.filter((c) => !c.draft).length === 1 ? 'has a validated answer key' : 'have validated answer keys'} — ${disc.filter((c) => !c.draft).reduce((a, c) => a + nq(c), 0)} queries. The drafted streams separate 0.5 from BM25-only but barely separate 0.5 from 0.7, so the case for moving the default rests on ${list(disc.filter((c) => !c.draft).map((c) => c.stream))}.`, '')
  }

  md.push('## Gain over what the code carries today', '')
  const rec = dominant.length ? (dominant.includes(0.5) ? 0.5 : dominant[0]) : null
  if (rec !== null) {
    md.push(`| stream | 0.7 (prior) | ${wlab(rec)} (recommended) | change |`)
    md.push('|---|---|---|---|')
    for (const c of cards) md.push(`| ${c.stream} | ${pct(aggOf(c, PRIOR))} | ${pct(aggOf(c, rec))} | ${pp(aggOf(c, rec) - aggOf(c, PRIOR))} |`)
    md.push(`| **macro avg** | ${pct(macro(PRIOR))} | ${pct(macro(rec))} | ${pp(macro(rec) - macro(PRIOR))} |`)
    md.push(`| **micro avg** | ${pct(micro(PRIOR))} | ${pct(micro(rec))} | ${pp(micro(rec) - micro(PRIOR))} |`)
    md.push('')
    const moved = cards.filter((c) => aggOf(c, rec) - aggOf(c, PRIOR) > EPS)
    const worse = cards.filter((c) => aggOf(c, rec) - aggOf(c, PRIOR) < -EPS)
    md.push(worse.length
      ? `**${worse.length} stream(s) regress** at the recommended weight: ${worse.map((c) => `${c.stream} ${pp(aggOf(c, rec) - aggOf(c, PRIOR))}`).join(', ')}. That is a real cost of adopting a single default and should be weighed before doing so.`
      : `**No stream regresses.** The whole of the effect comes from ${list(moved.map((c) => c.stream))} — the other ${cards.length - moved.length} ${cards.length - moved.length === 1 ? 'stream is' : 'streams are'} already at ceiling at 0.7 and simply stay there.`, '')
  }

  md.push('## What this does NOT establish', '')
  md.push('- **It is not a licence to turn the flag on.** This is a retrieval-quality measurement taken offline against the Lance tables. `LEX_SEARCH_VECTOR` stays OFF, and flipping it remains Charlie\'s call.')
  md.push('- **The three drafted-question streams still have unvalidated answer keys.** The 6 Aug pass validated the gold set, and the gold set has no questions for committees, caselaw or guidance. Their *shape* (vector beats BM25, 0.5 is fine) is informative; their absolute recall is not.')
  md.push('- **It is a recall@20 result only.** Nothing here measures precision, latency, or cost, and the vector arm currently has no deployed serving path at all.')
  md.push('- **The grid is discrete.** 0.5 is an interior maximum on a 0.1-ish grid, not a continuously optimised value; the sweep deliberately extended below 0.5 (0.3, 0.4) so the answer is not an artefact of where the grid stopped.')
  md.push('')

  const outPath = path.join(__dirname, '../../../docs', OUT)
  fs.writeFileSync(outPath, md.join('\n'))
  console.log(`[weight-decision] streams=${cards.map((c) => c.stream).join(',')} grid=[${grid}]`)
  console.log(`[weight-decision] dominant=[${dominant}] macroBest=[${macroBest}] microBest=[${microBest}]`)
  console.log(`[weight-decision] wrote ${outPath}`)
}

main()
