/**
 * argument-recall.ts — ARGUMENT 1A §4's recall half. CROSS-ARM, NOT LEAVE-ONE-OUT.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * TWO HELD-OUT SETS, AND WHY LEAVE-ONE-OUT WOULD HAVE FLATTERED US
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * The obvious recall test is to hold out some verified seeds and see whether propagation from the
 * rest finds them. It is also nearly worthless here: **every dense seed was found by the same three
 * probe queries**, so a held-out dense seed is a near neighbour of the propagation seeds BY
 * CONSTRUCTION. It would come back, the number would look excellent, and it would be measuring the
 * draw rather than the method.
 *
 * So two independent held-out sets are used instead:
 *
 *   **A. THE TAGGED RANDOM CONTROLS — the clean measurement.** Sixty passages were drawn
 *   `ORDER BY md5(id)` with no probe anywhere near them, and nineteen of them were judged by hand
 *   to make one of the ten moves. Those nineteen are argument-carrying passages that the method
 *   has never seen and could not have influenced. *"Of the arguments a random draw turns up, how
 *   many does propagation find?"* is the question §4 actually asks, and this answers it.
 *
 *   **B. CROSS-ARM.** Keyword seeds were found by a literal phrase in BM25 and confirmed by a
 *   regex — a different mechanism from the dense probes, with no shared vocabulary requirement.
 *   Propagating from one arm and testing on the other is a weaker independence claim than A, and
 *   it runs only where both arms have at least two verified seeds; where they do not, it is
 *   SKIPPED and says so rather than quietly reporting a number over two examples.
 *
 * ⚠ RECALL MATTERS MORE THAN PRECISION HERE AND THE BRIEF SAYS WHY: *"a tag that fires rarely and
 * correctly is WORSE than one that fires often and roughly, because the filter is what protects
 * the answer-writing model from having to read 15 million paragraphs."*
 *
 * ⚠ EVERY FIGURE STATES ITS DENOMINATOR AND ITS CUT-OFF. Recall is measured at top-K, and K is
 * printed beside every number, because "not retrieved" at K=50 and at K=500 are different claims.
 *
 * Usage:
 *   VECTOR_SEARCH_URL=… npm run argument:recall [--k 200]
 */
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '../lib/prisma'
import { TAGS, PARLIAMENTARY_CORPORA, type Tag } from './argument/taxonomy'
import { SEEDS } from './argument/seeds'
import { CONTROL_LABELS } from './argument/controls'

const V = (process.env.VECTOR_SEARCH_URL ?? '').replace(/\/$/, '')
const OUT = path.join(__dirname, '../../docs/census/argument-1a-recall.json')
const arg = (k: string, d: number) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? parseInt(process.argv[i + 1], 10) : d }
const K = arg('k', 200)

async function vectorBatch(queries: string[], limit: number): Promise<any[][]> {
  const out: any[][] = []
  for (let i = 0; i < queries.length; i += 6) {
    const res = await fetch(`${V}/vector-search-batch`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queries: queries.slice(i, i + 6).map((q) => ({ query: q, limit, corpora: PARLIAMENTARY_CORPORA })) }),
    })
    if (!res.ok) throw new Error(`vector batch ${res.status}`)
    const j = await res.json() as any
    for (const q of (j.queries ?? [])) out.push(q.ok ? (q.results ?? []) : [])
  }
  return out
}

async function main() {
  if (!V) { console.error('VECTOR_SEARCH_URL required'); process.exit(2) }
  console.log('── ARGUMENT 1A §4 · CROSS-ARM RECALL ──')
  console.log(`  propagate from one arm's verified seeds; ask whether the OTHER arm's verified`)
  console.log(`  passages come back. Cut-off: top-${K} per seed, unioned.\n`)

  // ══ A. THE TAGGED RANDOM CONTROLS ═════════════════════════════════════════════════════════════
  const tagged = CONTROL_LABELS.filter((c) => c.tags.length > 0)
  console.log(`  ── A. tagged random controls: ${tagged.length} of ${CONTROL_LABELS.length} control passages carry a move ──`)
  const controlRows: any[] = []
  let cHeld = 0, cFound = 0
  for (const tag of TAGS) {
    const held = tagged.filter((c) => c.tags.includes(tag))
    if (!held.length) continue
    const props = SEEDS.filter((s) => s.tag === tag)
    if (props.length < 2) { console.log(`    ${tag.padEnd(18)} ⚠ SKIPPED: ${props.length} seeds`); continue }
    const hits = (await vectorBatch(props.map((s) => s.text), K)).flat()
      .filter((h: any) => PARLIAMENTARY_CORPORA.includes(h.corpus))
    const found = new Set(hits.map((h: any) => h.chunkId ?? `${h.id}#0`))
    const got = held.filter((h) => found.has(h.chunkId))
    cHeld += held.length; cFound += got.length
    console.log(`    ${tag.padEnd(18)} ${got.length} of ${held.length} retrieved from ${props.length} seeds` +
      ` (${found.size} distinct candidates at top-${K})`)
    controlRows.push({ tag, held: held.length, found: got.length, seeds: props.length, candidates: found.size })
  }
  console.log(`    TOTAL ${cFound} of ${cHeld} hand-tagged random passages retrieved (${((100 * cFound) / (cHeld || 1)).toFixed(1)}%) at top-${K}`)
  console.log('    ⚠ n is small and stated. These are the only argument-carrying passages in this sprint')
  console.log('      that the method had no hand in choosing.\n')

  console.log('  ── B. cross-arm ──')
  const results: any[] = []
  let totalHeld = 0, totalFound = 0
  for (const tag of TAGS) {
    for (const [from, to] of [['dense', 'keyword'], ['keyword', 'dense']] as const) {
      const props = SEEDS.filter((s) => s.tag === tag && s.arm === from)
      const held = SEEDS.filter((s) => s.tag === tag && s.arm === to)
      if (props.length < 2 || held.length < 2) {
        console.log(`  ${tag.padEnd(18)} ${from} → ${to.padEnd(8)} ⚠ SKIPPED: ${props.length} propagation seeds, ${held.length} held out (need 2 of each)`)
        results.push({ tag, from, to, skipped: true, props: props.length, held: held.length })
        continue
      }
      const hits = (await vectorBatch(props.map((s) => s.text), K)).flat()
        .filter((h: any) => PARLIAMENTARY_CORPORA.includes(h.corpus))
      const found = new Set(hits.map((h: any) => h.chunkId ?? `${h.id}#0`))
      const bestRank = new Map<string, number>()
      hits.forEach((h: any, i) => { const c = h.chunkId ?? `${h.id}#0`; if (!bestRank.has(c)) bestRank.set(c, i + 1) })
      const hitIds = held.filter((h) => found.has(h.chunkId))
      totalHeld += held.length; totalFound += hitIds.length
      console.log(`  ${tag.padEnd(18)} ${from} → ${to.padEnd(8)} ${hitIds.length} of ${held.length} held-out passages retrieved` +
        ` (${((100 * hitIds.length) / held.length).toFixed(0)}%) from ${props.length} seeds, ${found.size} distinct candidates`)
      results.push({ tag, from, to, props: props.length, held: held.length, found: hitIds.length, candidates: found.size })
    }
  }
  console.log(`\n  TOTAL: ${totalFound} of ${totalHeld} held-out passages retrieved (${((100 * totalFound) / (totalHeld || 1)).toFixed(1)}%) at top-${K}`)
  console.log('  ⚠ This is recall of passages a HUMAN confirmed carry the move, found by a different')
  console.log('    mechanism. It is not recall over the corpus, which is unmeasurable without a full scan.')

  fs.writeFileSync(OUT, JSON.stringify({ takenAt: new Date().toISOString(), k: K, controlArm: { rows: controlRows, held: cHeld, found: cFound }, crossArm: results, totalHeld, totalFound }, null, 2))
  console.log(`\n  wrote ${OUT}`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error('FAILED', e); await prisma.$disconnect(); process.exit(1) })
