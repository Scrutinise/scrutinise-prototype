/**
 * measure-s16-debates-dense.ts — S16 §3.2. SHOULD `debates` HAVE A DENSE LEG?
 *
 * `debates` is the only routed stream with no dense retrieval, on a June measurement that found it
 * 15 points worse. ⚠ **That measurement asked "does this find the right DEBATE?"** — where keyword
 * matching is nearly unbeatable, because a debate about e-scooters says "e-scooter" constantly. It
 * has never been asked "does this find the right ARGUMENT?", which is the question that matters.
 *
 * ⚠⚠ THIS DOES NOT RE-RUN THE WHOLE GOLD SET, AND THE REASON IS THE MEASUREMENT ITSELF.
 * Only the `debates` stream changes, so 53 of the 64 questions would contribute identical numbers
 * to both arms while adding two more full retrieval passes' worth of noise, cost and service load.
 * What is measured here is `debates`' own **in-stream** recall — the figure that is currently
 * **0 of 11** and the one a dense leg could move. A merged figure would fold in the round-robin's
 * window arithmetic and hide the retrieval effect this is trying to see.
 *
 * ⚠ BOTH ARMS RUN IN ONE PROCESS, ALTERNATING. `fusedStream` reads `vectorStreams()` **per call**
 * (deliberately — see stream-batch.ts's note on why a module-load constant made the 3-vs-4
 * experiment unfair), so flipping the env between arms uses the same warm services, the same
 * routing and the same index. Two processes would have compared two warm-ups.
 *
 * ⚠ THE QUERY IS THE ONE S15 ACTUALLY ISSUED, from the route cache — not a fresh routing call that
 * might differ, and not the raw question.
 *
 * Usage:
 *   tsx --env-file=.env --tsconfig tsconfig.json scripts/measure-s16-debates-dense.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { streams } from '../lib/lex/query-router'

const ARMS = path.join(__dirname, '../../docs/census/s15-arms.json')
const ROUTES = path.join(__dirname, 'gold/s14-routes.json')
const LIMIT = 20
const OVERFETCH = 60

const BASE_STREAMS = 'legislation,caselaw,guidance,committees'

async function rankOf(query: string, keys: string[]): Promise<{ rank: number; total: number; scorers: string[] }> {
  const s = streams().find((x) => x.name === 'debates')!
  const hits = await s.search(query, OVERFETCH).catch((e) => { console.log(`    ⚠ ${(e as Error).message}`); return [] as any[] })
  const rank = hits.findIndex((h: any) => keys.includes(h.id))
  return { rank, total: hits.length, scorers: Array.from(new Set(hits.slice(0, 5).map((h: any) => h.scorer))) }
}

async function main() {
  const arms = JSON.parse(fs.readFileSync(ARMS, 'utf8'))
  if (arms.degraded?.length) { console.error('⛔ source artefact is degraded:', arms.degraded); process.exit(2) }
  const routes = JSON.parse(fs.readFileSync(ROUTES, 'utf8'))
  const qs = (arms.rows as any[]).filter((r) => r.collection === 'debates')

  console.log('── S16 §3.2 — does `debates` deserve a dense leg? ──')
  console.log(`  source ${path.basename(ARMS)} · ${arms.config}`)
  console.log(`  n = ${qs.length} debates questions · in-stream rank over ${OVERFETCH} retrieved, scored @${LIMIT}\n`)

  const results: Array<{ id: string; off: number; on: number; words: number; q: string }> = []
  console.log('  id       BM25-only   +dense    key words   question')
  for (const r of qs) {
    const routed = routes[r.id]?.plain?.debates
    if (!routed) { console.log(`  ${r.id.padEnd(8)} ⚠ no cached debates query — the router did not select debates for it`); continue }

    // ARM A — debates has NO dense leg (today's production configuration).
    process.env.LEX_VECTOR_STREAMS = BASE_STREAMS
    const off = await rankOf(routed, r.keys)
    // ARM B — debates HAS a dense leg.
    process.env.LEX_VECTOR_STREAMS = `${BASE_STREAMS},debates`
    const on = await rankOf(routed, r.keys)

    const words = r.words ?? 0
    results.push({ id: r.id, off: off.rank, on: on.rank, words, q: r.query })
    const fmt = (n: number) => (n < 0 ? '  not found' : `  rank ${String(n + 1).padStart(3)}`)
    console.log(`  ${r.id.padEnd(8)}${fmt(off.rank)}${fmt(on.rank)}   ${String(words).padStart(9)}   ${r.query.slice(0, 44)}`)
    // ⚠⚠ POSITIVE VERIFICATION THAT THE ARMS DIFFER AT ALL — the S14 §0 failure, which was a
    // 0-vs-0 taken while dense retrieval was silently absent.
    //
    // ⚠ AND THE FIRST VERSION OF THIS ASSERTION WAS ITSELF WRONG, which is worth leaving on the
    // record. It looked for `scorer: 'fused'` or `'vector'` and reported "the dense leg did NOT
    // arrive" on all eleven questions — while three of them were simultaneously GAINING the
    // answer, which is impossible if no dense leg ran. `fuseWeightedRrf` OVERWRITES the scorer
    // with **`'rrf'`**: that string IS the arrival signal, and a stream with no dense leg returns
    // `'bm25'`. A positive check looking for the wrong token is a false alarm that would have
    // discredited a real result.
    const arrived = on.scorers.some((s) => s === 'rrf' || s === 'fused' || s === 'vector')
    if (!arrived) {
      console.log(`           ⚠ arm B top-5 scorers = [${on.scorers.join(',')}] — the dense leg did NOT arrive`)
    }
    // The control in the other direction: arm A must NOT be fused, or the arms are the same arm.
    if (off.scorers.some((s) => s === 'rrf' || s === 'fused' || s === 'vector')) {
      console.log(`           ⚠⚠ arm A top-5 scorers = [${off.scorers.join(',')}] — arm A is FUSED; the arms are not distinct`)
    }
  }

  const at20 = (k: 'off' | 'on') => results.filter((r) => r[k] >= 0 && r[k] < LIMIT).length
  const found = (k: 'off' | 'on') => results.filter((r) => r[k] >= 0).length
  console.log('')
  console.log(`  ── RESULT (n = ${results.length}) ──`)
  console.log(`  in-stream@${LIMIT}      BM25-only ${at20('off')}/${results.length}      +dense ${at20('on')}/${results.length}`)
  console.log(`  found anywhere in ${OVERFETCH}   BM25-only ${found('off')}/${results.length}      +dense ${found('on')}/${results.length}`)
  const gained = results.filter((r) => (r.on >= 0 && r.on < LIMIT) && !(r.off >= 0 && r.off < LIMIT))
  const lost = results.filter((r) => (r.off >= 0 && r.off < LIMIT) && !(r.on >= 0 && r.on < LIMIT))
  console.log(`  gained ${gained.length}${gained.length ? ': ' + gained.map((g) => g.id).join(', ') : ''}`)
  console.log(`  lost   ${lost.length}${lost.length ? ': ' + lost.map((g) => g.id).join(', ') : ''}`)
  const moved = results.filter((r) => r.off !== r.on).length
  console.log(`  ranks moved on ${moved} of ${results.length} questions`)
  console.log('')
  if (at20('on') === 0 && at20('off') === 0) {
    console.log('  ⚠⚠ BOTH ARMS ARE ZERO. This is NOT evidence that dense retrieval fails on debates —')
    console.log('     it is evidence that this question set cannot measure it. The debates keys are')
    console.log('     under review (GOLD_V2_DEBATES_REKEY.md) and 8 of 11 failures are long documents')
    console.log('     scored whole. The question that would settle it is the argument set.')
  }
}
main().catch((e) => { console.error('FAILED', e); process.exit(1) })
