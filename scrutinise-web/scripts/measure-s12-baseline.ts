/**
 * measure-s12-baseline.ts — THE NEW BASELINE, ON THE FULL VALIDATED SET. SEARCH S12 §3.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY A NEW RUNNER RATHER THAN AN EDIT TO `measure-s10-recall.ts`
 *
 * That harness is keyed on `s10-gold-set`'s `n: number` (1–60) — the routes cache, the stored legs
 * and the arm recomputation all index by `String(q.n)`. GOLD V2 numbers its questions `Q1`–`Q21`
 * **as strings starting again at 1**. Merging the two into that harness would have Q1 of the
 * debates set collide with Q1 of the committees set in `s10-routes.json`, and the second would
 * silently dispatch the first's cached router decision.
 *
 * ⚠ That is not a hypothetical: caching the route is the thing S10 introduced *specifically* so
 * that two arms of one query cannot be routed differently — a collision would turn that safeguard
 * into a way to score a question against another question's routing, and it would look completely
 * normal in the output. So the S10 harness is left exactly as it is (its numbers stay
 * reproducible) and the combined baseline gets its own runner.
 *
 * ── WHAT IT REPORTS, AND WHY EACH PART IS THERE ─────────────────────────────────────────────────
 *
 *  · recall@20 and recall@5, PER COLLECTION, with **n printed beside every figure** (§3).
 *  · the four-way split S10 introduced — hit · DILUTED · NOT-RETRIEVED · NOT-ROUTED — because a
 *    single recall number hid three different failures with three different fixes.
 *  · the INDEX STATE the number was taken against (`index-state.ts`), because S10's figures went
 *    void for the want of exactly this.
 *  · the retrieval configuration, printed, because a local run without `FTS_SEARCH_URL` searches
 *    nothing and reports zeros that look exactly like a regression.
 *
 * ⚠⚠ THIS SUPERSEDES NOTHING BY IMPLICATION. S10's per-collection absolute numbers are **void**
 * (the 20 Aug case-law re-compile moved document frequencies table-wide; S11 measured 0 of 5
 * rankings reproducing). This is a NEW baseline, not an improvement on 34%, and the output says so
 * rather than leaving a reader to infer a delta that does not exist.
 *
 * Usage (from scrutinise-web):
 *   FTS_SEARCH_URL=… LEX_QUERY_ROUTER=true LEX_VECTOR_STREAMS=… \
 *     npx tsx --env-file=.env scripts/measure-s12-baseline.ts [--json out.json]
 */
import fs from 'node:fs'
import { runSearch } from '../lib/lex/search-gateway'
import { SCOREABLE, type GoldQuestion } from './gold/s10-gold-set'
import { SCOREABLE_V2, NEGATIVE_CONTROLS_V2 } from './gold/gold-v2-set'
import { indexState, formatIndexState } from '../../scripts/ingest/search/index-state'
import { capabilityLine } from '../lib/env-flags'

export {}

const JSON_OUT = (() => { const i = process.argv.indexOf('--json'); return i >= 0 ? process.argv[i + 1] : null })()
const TOP = 20

interface Q { id: string; query: string; keys: string[]; collection: string; owner: string; set: 'S10' | 'V2' }

/** Both sets, normalised to one shape. The `set` field is kept so the two halves can be reported
 *  apart — they were written months apart by different processes and folding them into one number
 *  without being able to separate them again would be a step backwards. */
const QUESTIONS: Q[] = [
  ...SCOREABLE.map((q: GoldQuestion): Q => ({
    id: `S10-Q${q.n}`, query: q.question, keys: q.keys, collection: q.collection,
    owner: String((q as any).streamsHint ?? q.collection), set: 'S10',
  })),
  ...SCOREABLE_V2.map((q): Q => ({
    id: `V2-${q.id}`, query: q.query, keys: q.keys, collection: q.collection!,
    owner: q.streamsHint, set: 'V2',
  })),
]

const pct = (a: number, b: number) => (b === 0 ? '—' : `${((a / b) * 100).toFixed(0)}%`)

function rankOf(results: Array<{ id: string }>, keys: string[]): number {
  const i = results.findIndex((r) => keys.some((k) => r.id === k || r.id.startsWith(k)))
  return i
}

async function main() {
  console.log('═'.repeat(112))
  console.log('SEARCH S12 §3 — NEW BASELINE ON THE FULL VALIDATED SET')
  console.log('═'.repeat(112))

  const before = await indexState()
  formatIndexState(before).forEach((l) => console.log(l))
  console.log(`  config: ${capabilityLine()}`)
  console.log(`  FTS_SEARCH_URL      ${process.env.FTS_SEARCH_URL ? 'set' : '⚠⚠ NOT SET — a local run searches NOTHING and reports zeros that look like a regression'}`)
  console.log(`  VECTOR_SEARCH_URL   ${process.env.VECTOR_SEARCH_URL ? 'set' : 'not set (BM25 only)'}`)
  console.log(`  LEX_VECTOR_STREAMS  ${process.env.LEX_VECTOR_STREAMS ?? '(unset)'}`)
  console.log(`\n  questions: ${QUESTIONS.length}  (S10 set ${SCOREABLE.length} · GOLD V2 ${SCOREABLE_V2.length})`)
  console.log(`  ⚠ ${NEGATIVE_CONTROLS_V2.length} negative controls are NOT scored here — behaviour, not recall; a 0% is a PASS.\n`)

  interface Row { q: Q; hit20: boolean; hit5: boolean; rank: number; routed: string[]; ownerRouted: boolean; ownStreamHasKey: boolean }
  const rows: Row[] = []

  for (const q of QUESTIONS) {
    let res
    try {
      res = await runSearch({ keywords: q.query.split(/\s+/), intent: 'RESEARCH' as any, limit: TOP })
    } catch (e) {
      console.log(`  ${q.id.padEnd(10)} ERROR ${(e as Error).message}`)
      continue
    }
    const rank = rankOf(res.results, q.keys)
    const routed = res.meta.routedStreams ?? []
    const ownerRouted = routed.some((s) => q.owner.includes(s))
    // DILUTED vs NOT-RETRIEVED: was the key in the owning stream's OWN list, even though it did
    // not survive the interleave into the merged top-20? That distinction is the whole reason S10's
    // split existed — the two have different fixes.
    const own = res.meta.perStream?.find((s) => q.owner.includes(s.stream))
    const ownStreamHasKey = !!own && own.ids.some((id) => q.keys.some((k) => id === k || id.startsWith(k)))
    rows.push({ q, hit20: rank >= 0 && rank < 20, hit5: rank >= 0 && rank < 5, rank, routed, ownerRouted, ownStreamHasKey })
    const mark = rank >= 0 && rank < 5 ? '✅@5' : rank >= 0 && rank < 20 ? `✅@${rank}` : !ownerRouted ? 'NOT-ROUTED' : ownStreamHasKey ? 'DILUTED' : 'NOT-RETRIEVED'
    console.log(`  ${q.id.padEnd(10)} ${q.collection.padEnd(18)} ${mark.padEnd(14)} routed=[${routed.join(',')}] results=${res.results.length}`)
  }

  // ── per collection, n beside every number ───────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(112))
  console.log('  collection            set    n   recall@20      recall@5      hit  DILUTED  NOT-RETRIEVED  NOT-ROUTED')
  const collections = [...new Set(rows.map((r) => r.q.collection))].sort()
  const out: any[] = []
  for (const c of collections) {
    const qs = rows.filter((r) => r.q.collection === c)
    const set = qs[0].q.set
    const hit20 = qs.filter((r) => r.hit20).length
    const hit5 = qs.filter((r) => r.hit5).length
    const notRouted = qs.filter((r) => !r.hit20 && !r.ownerRouted).length
    const diluted = qs.filter((r) => !r.hit20 && r.ownerRouted && r.ownStreamHasKey).length
    const notRetrieved = qs.filter((r) => !r.hit20 && r.ownerRouted && !r.ownStreamHasKey).length
    out.push({ collection: c, set, n: qs.length, hit20, hit5, diluted, notRetrieved, notRouted })
    console.log(`  ${c.padEnd(20)} ${set.padEnd(5)} ${String(qs.length).padStart(3)}   ` +
      `${String(hit20).padStart(2)}/${String(qs.length).padEnd(2)} ${pct(hit20, qs.length).padStart(5)}   ` +
      `${String(hit5).padStart(2)}/${String(qs.length).padEnd(2)} ${pct(hit5, qs.length).padStart(5)}   ` +
      `${String(hit20).padStart(4)} ${String(diluted).padStart(7)} ${String(notRetrieved).padStart(13)} ${String(notRouted).padStart(11)}`)
  }
  const tot = { n: rows.length, hit20: rows.filter((r) => r.hit20).length, hit5: rows.filter((r) => r.hit5).length }
  console.log('─'.repeat(112))
  console.log(`  ${'ALL'.padEnd(20)} ${''.padEnd(5)} ${String(tot.n).padStart(3)}   ${String(tot.hit20).padStart(2)}/${String(tot.n).padEnd(2)} ${pct(tot.hit20, tot.n).padStart(5)}   ${String(tot.hit5).padStart(2)}/${String(tot.n).padEnd(2)} ${pct(tot.hit5, tot.n).padStart(5)}`)

  // The two sets apart, because they were written by different processes months apart.
  for (const s of ['S10', 'V2'] as const) {
    const qs = rows.filter((r) => r.q.set === s)
    if (!qs.length) continue
    console.log(`  ${(s === 'V2' ? 'GOLD V2 only' : 'S10 set only').padEnd(20)} ${''.padEnd(5)} ${String(qs.length).padStart(3)}   ` +
      `${String(qs.filter((r) => r.hit20).length).padStart(2)}/${String(qs.length).padEnd(2)} ${pct(qs.filter((r) => r.hit20).length, qs.length).padStart(5)}`)
  }

  console.log('\n  ⚠⚠ THIS IS A NEW BASELINE, NOT AN IMPROVEMENT ON S10\'s 34%. S10\'s per-collection absolute')
  console.log('     numbers are VOID — the 20 Aug case-law re-compile moved BM25 document frequencies')
  console.log('     table-wide and S11 measured 0 of 5 sampled rankings reproducing. Do not subtract.')

  const after = await indexState()
  if (JSON_OUT) {
    fs.writeFileSync(JSON_OUT, JSON.stringify({
      takenAt: new Date().toISOString(), indexStateBefore: before, indexStateAfter: after,
      config: { fts: !!process.env.FTS_SEARCH_URL, vector: !!process.env.VECTOR_SEARCH_URL, vectorStreams: process.env.LEX_VECTOR_STREAMS ?? null },
      questionSets: { s10: SCOREABLE.length, v2: SCOREABLE_V2.length, total: QUESTIONS.length },
      perCollection: out,
      rows: rows.map((r) => ({ id: r.q.id, collection: r.q.collection, set: r.q.set, rank: r.rank, routed: r.routed })),
    }, null, 2))
    console.log(`\n  wrote ${JSON_OUT}`)
  }
  // ⚠ Index state is taken BEFORE and AFTER; if they differ the corpus moved mid-run and the
  // number describes neither state.
  const moved = JSON.stringify(before.tables) !== JSON.stringify(after.tables)
  if (moved) {
    console.log('\n  ⚠⚠ THE INDEX CHANGED DURING THIS RUN — the figures above describe neither state. Re-take it.')
    formatIndexState(after).forEach((l) => console.log(l))
  }
  process.exit(moved ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
