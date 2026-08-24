/**
 * audit-s13-merge.ts — SEARCH S13 §1. WHERE DOES EACH LOST ANSWER DIE?
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THIS SCRIPT CHANGES NOTHING. It is the §1 audit, and §1 reports before §2 builds.
 *
 * The deliverable is one row per validated question recording TWO ranks:
 *
 *   · `inStream` — the rank the correct document held inside ITS OWN stream's list, i.e. what
 *                  retrieval actually found. Read off `runRoutedSearch`'s `perStream`, which is
 *                  each stream's own ranking before anything is merged.
 *   · `merged`   — the rank the same document holds after the five lists are interleaved and the
 *                  gateway's hollow-repeal suppression has run. This is what a caller sees.
 *
 * A question with `inStream: 6, merged: -1` is a document retrieval FOUND and the merge DISCARDED.
 * That is the distinction the brief asks for and the one a single recall number cannot express.
 *
 * ── WHY IT MEASURES `runRoutedSearch` AND NOT A COPY OF IT ──────────────────────────────────────
 * The merge under audit is `interleaveStreams`, called from `runRoutedSearch`. This harness calls
 * that function, not a reimplementation of it. It then applies the gateway's two post-merge steps
 * — `lookupRepeals` + the `isHollowRepeal` filter — from the same modules the gateway imports, so
 * `merged` is the rank a caller taking a prefix of `runSearch().results` would actually see.
 * A harness that rebuilt the pipeline would be auditing its own copy (stream-scopes.ts records
 * what a copy costs).
 *
 * ── ROUTES ARE CACHED, AND THAT IS LOAD-BEARING ─────────────────────────────────────────────────
 * Routing is an LLM decision. Two runs of the same question can route differently, so an A/B in
 * §2 that re-routed would be comparing two different searches and calling the difference a merge
 * effect. Routes are rolled once into `scripts/gold/s13-routes.json` and reused by every arm.
 * ⚠ Keys are the GLOBALLY-UNIQUE question ids (`S10-Q1`, `V2-Q1`) — the S10 set numbers 1..60 and
 * GOLD V2 numbers Q1..Q21 starting again at 1, so a bare number would collide and silently
 * dispatch one question's routing for another. `measure-s12-baseline.ts`'s header records that
 * exact trap.
 *
 * ── WHAT ELSE IT RECORDS, AND WHY ───────────────────────────────────────────────────────────────
 * §1.3 length: the `wordCount` of every key document and of every document occupying a merged
 *   top-20 slot, read from `corpus_sections`. If long documents systematically win or lose, that
 *   is a normalisation defect and a DIFFERENT fix from a round-robin defect.
 * §1.4 displacement: for a key excluded from the merged top-20 at in-stream rank r, how many
 *   top-20 slots went to results whose OWN stream ranked them at r or worse. Those are documents
 *   their own stream considered less relevant than the correct answer, shown instead of it. That
 *   is the round-robin's cost stated without needing a relevance model.
 *
 * ⚠ CUT-OFF, STATED. Every rank in this file is measured over the WHOLE returned population, not
 * a top-N slice: `inStream` searches the entire per-stream list and `merged` the entire merged
 * list. `TOP` (20) is used only to CLASSIFY a rank, never to bound the search for one — so a key
 * at merged rank 240 is recorded as 240 and not as "absent". CLAUDE.md's standing rule: a check
 * asserting over a ranked set must assert over the whole population or print its own cut-off.
 *
 * Usage (from scrutinise-web):
 *   FTS_SEARCH_URL=… LEX_QUERY_ROUTER=true LEX_VECTOR_STREAMS=legislation \
 *     npx tsx --env-file=.env scripts/audit-s13-merge.ts --json ../docs/census/s13-merge-audit.json
 *   flags: --reroute  roll fresh routes instead of reusing the cache
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { prisma } from '../lib/prisma'
import { routeQuery } from '../lib/lex/query-expansion'
import { runRoutedSearch } from '../lib/lex/query-router'
import { lookupRepeals, annotate, isHollowRepeal } from '../lib/lex/repeal-status'
import { SCOREABLE, type GoldQuestion } from './gold/s10-gold-set'
import { SCOREABLE_V2 } from './gold/gold-v2-set'
import { capabilityLine } from '../lib/env-flags'
import type { SearchResult } from '../lib/lex/page1-config'
import type { RouteResult } from '../lib/lex/query-expansion'

export {}

const TOP = 20
const LIMIT = 20
const DIR = path.join(__dirname, 'gold')
const ROUTES = path.join(DIR, 's13-routes.json')
const JSON_OUT = (() => { const i = process.argv.indexOf('--json'); return i >= 0 ? process.argv[i + 1] : null })()
const REROUTE = process.argv.includes('--reroute')

interface Q { id: string; query: string; keys: string[]; collection: string; owner: string; set: 'S10' | 'V2' }

/** Smoke-test cut-off. ⚠ When set, EVERY figure below is over that subset and the header says so —
 *  a partial run must never be able to look like the full one. */
const ONLY = (() => { const i = process.argv.indexOf('--only'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : null })()

const ALL_QUESTIONS: Q[] = [
  ...SCOREABLE.map((q: GoldQuestion): Q => ({
    id: `S10-Q${q.n}`, query: q.question, keys: q.keys, collection: q.collection,
    owner: String((q as any).streamsHint ?? q.collection), set: 'S10',
  })),
  ...SCOREABLE_V2.map((q): Q => ({
    id: `V2-${q.id}`, query: q.query, keys: q.keys, collection: q.collection!,
    owner: q.streamsHint, set: 'V2',
  })),
]
const QUESTIONS: Q[] = ONLY ? ALL_QUESTIONS.slice(0, ONLY) : ALL_QUESTIONS

const matches = (id: string, keys: string[]) => keys.some((k) => id === k || id.startsWith(k))
const pct = (a: number, b: number) => (b === 0 ? '—' : `${((a / b) * 100).toFixed(0)}%`)

/**
 * The index version this run describes, read by SPAWNING the ingest package's own reporter.
 *
 * ⚠ NOT AN IMPORT. `index-state.ts` pulls in `@lancedb/lancedb`, which is installed in the INGEST
 * package's node_modules and not the web app's; importing it from a file under `scrutinise-web`
 * is the exact package-boundary crossing that failed every Vercel build for two days (CLAUDE.md
 * §20 check 0). A child process has no such constraint. Returns null rather than throwing — a
 * missing stamp is worth reporting, not worth losing the measurement over.
 */
function indexStamp(): string[] | null {
  try {
    const cwd = path.join(__dirname, '..', '..', 'scripts', 'ingest')
    // `node <tsx cli.mjs>` rather than the `.bin` shim: on Windows the shim is a `.cmd` and
    // `execFileSync` refuses it with EINVAL unless a shell is spawned. Invoking the CLI through
    // the current node binary needs no shell and no quoting.
    const out = execFileSync(process.execPath, [path.join(cwd, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'search/index-state.ts'], {
      cwd, encoding: 'utf8', timeout: 180_000, windowsHide: true,
    })
    // ⚠ THE `index state @ <ISO timestamp>` HEADER LINE IS DROPPED. It differs on every call, so
    // comparing the raw output before-and-after reported THE INDEX MOVED on every run — a check
    // that always fires is worth exactly as little as one that never does, and the first version
    // of this function did fire, on a run where corpus_fts/corpus_vec/corpus_chunks were all
    // byte-identical at versions 7308 / 4011 / 18447. What identifies the state is the VERSION,
    // which is the whole reason index-state.ts records one.
    return out.trim().split(/\r?\n/).filter((l) => !/^\s*index state @/.test(l))
  } catch (e) {
    console.warn(`  ⚠ index stamp unavailable: ${(e as Error).message}`)
    return null
  }
}

function readRoutes(): Record<string, RouteResult> | null {
  if (!fs.existsSync(ROUTES)) return null
  try { return JSON.parse(fs.readFileSync(ROUTES, 'utf8')) } catch { return null }
}

async function buildRoutes(): Promise<Record<string, RouteResult>> {
  const cached = readRoutes()
  if (cached && !REROUTE) {
    const missing = QUESTIONS.filter((q) => !cached[q.id])
    if (!missing.length) {
      console.log(`  routes: reusing all ${Object.keys(cached).length} cached decisions (${path.relative(process.cwd(), ROUTES)})`)
      return cached
    }
    console.log(`  routes: cache has ${Object.keys(cached).length}, ${missing.length} missing — rolling those`)
  }
  const out: Record<string, RouteResult> = cached && !REROUTE ? { ...cached } : {}
  let rolled = 0
  for (const q of QUESTIONS) {
    if (out[q.id] && !REROUTE) continue
    const route = await routeQuery(q.query.split(/\s+/), '')
    // ⚠ A null route is the router failing or being disabled. Recording it as `{}` would make a
    // dead router look like a router that chose no streams, which is CLAUDE.md §18's corollary
    // exactly. It is left ABSENT and the run below reports it as ROUTER-FAILED rather than as a
    // retrieval miss.
    if (route) { out[q.id] = route; rolled++ }
    else console.warn(`  ⚠ ${q.id}: routeQuery returned null — NOT cached, will report ROUTER-FAILED`)
  }
  fs.mkdirSync(DIR, { recursive: true })
  fs.writeFileSync(ROUTES, JSON.stringify(out, null, 2))
  console.log(`  routes: rolled ${rolled}, cached ${Object.keys(out).length} to ${path.relative(process.cwd(), ROUTES)}`)
  return out
}

interface Row {
  q: Q
  routed: string[]
  ownerRouted: boolean
  /** Which stream's own list the key was found in, if any. Not assumed to be the owner. */
  foundInStream: string | null
  /** Rank inside that stream's own list. -1 = retrieval never found it in ANY routed stream. */
  inStream: number
  /** Rank in the merged list a caller sees. -1 = absent from the whole merged population. */
  merged: number
  /** Length of the merged population — the cut-off `merged: -1` is measured against. */
  mergedLen: number
  perStreamLen: Record<string, number>
  /** §1.4 — top-20 occupants whose own stream ranked them at `inStream` or worse. */
  displacedBy: number
  /** §1.3 — wordCount of the key document (the first key that retrieval found, else the first key). */
  keyWords: number | null
  /** wordCounts of the merged top-20 occupants. */
  topWords: number[]
  verdict: 'HIT@5' | 'HIT@20' | 'DILUTED' | 'NOT-RETRIEVED' | 'NOT-ROUTED' | 'ROUTER-FAILED'
}

async function wordCounts(ids: string[]): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>()
  if (!ids.length) return out
  const uniq = [...new Set(ids)]
  for (let i = 0; i < uniq.length; i += 500) {
    const batch = uniq.slice(i, i + 500)
    const rows = await prisma.corpusSection.findMany({
      where: { id: { in: batch } }, select: { id: true, wordCount: true },
    })
    for (const r of rows) out.set(r.id, r.wordCount)
  }
  return out
}

/** The gateway's two post-merge steps, from the gateway's own modules — so `merged` is the rank a
 *  caller sees and not the rank before suppression. */
async function asCallerSeesIt(results: SearchResult[]): Promise<{ list: SearchResult[]; suppressed: number }> {
  const { statuses, ok } = await lookupRepeals(results.map((r) => r.id))
  const annotated = annotate(results, statuses, ok)
  const list = annotated.filter((r) => !isHollowRepeal(r.repeal))
  return { list, suppressed: annotated.length - list.length }
}

async function main() {
  console.log('═'.repeat(118))
  console.log('SEARCH S13 §1 — MERGE AUDIT. IN-STREAM RANK vs MERGED RANK, PER QUESTION. NOTHING IS CHANGED.')
  console.log('═'.repeat(118))
  console.log(`  config: ${capabilityLine()}`)
  console.log(`  FTS_SEARCH_URL      ${process.env.FTS_SEARCH_URL ? process.env.FTS_SEARCH_URL : '⚠⚠ NOT SET — this run searches NOTHING and reports zeros that look like a regression'}`)
  console.log(`  VECTOR_SEARCH_URL   ${process.env.VECTOR_SEARCH_URL ?? '(unset — BM25 only)'}`)
  console.log(`  LEX_VECTOR_STREAMS  ${process.env.LEX_VECTOR_STREAMS ?? '(unset — no dense leg on any stream)'}`)
  console.log(`  limit               ${LIMIT} per stream (the gateway's per-stream budget, not a total)`)
  console.log(`  ⚠ ranks are searched over the WHOLE returned population; ${TOP} is used only to classify one.`)
  console.log(`  questions            ${QUESTIONS.length} of ${ALL_QUESTIONS.length}${ONLY ? `  ⚠⚠ --only ${ONLY}: THIS IS A SMOKE TEST, every figure below is over the subset` : '  (the full validated set)'}\n`)
  const before = indexStamp()
  before?.forEach((l) => console.log(l))
  console.log()

  const routes = await buildRoutes()
  const rows: Row[] = []
  let totalSuppressed = 0

  for (const q of QUESTIONS) {
    const route = routes[q.id]
    if (!route) {
      rows.push({ q, routed: [], ownerRouted: false, foundInStream: null, inStream: -1, merged: -1,
        mergedLen: 0, perStreamLen: {}, displacedBy: 0, keyWords: null, topWords: [], verdict: 'ROUTER-FAILED' })
      console.log(`  ${q.id.padEnd(9)} ${q.collection.padEnd(16)} ROUTER-FAILED`)
      continue
    }
    let routed: Awaited<ReturnType<typeof runRoutedSearch>>
    try {
      routed = await runRoutedSearch(route, LIMIT)
    } catch (e) {
      console.log(`  ${q.id.padEnd(9)} ERROR ${(e as Error).message}`)
      continue
    }
    const { list: merged, suppressed } = await asCallerSeesIt(routed.results)
    totalSuppressed += suppressed

    // In-stream rank: the BEST rank the key holds in ANY routed stream's own list. Deliberately
    // not restricted to the owning stream — a key found by a stream we did not expect is still a
    // key retrieval found, and calling that NOT-RETRIEVED would be scoring the scope table.
    let foundInStream: string | null = null
    let inStream = -1
    for (const s of routed.perStream) {
      const i = s.ids.findIndex((id) => matches(id, q.keys))
      if (i >= 0 && (inStream < 0 || i < inStream)) { inStream = i; foundInStream = s.stream }
    }
    const mergedRank = merged.findIndex((r) => matches(r.id, q.keys))
    const routedNames = routed.perStream.map((s) => s.stream)
    const ownerRouted = routedNames.some((s) => q.owner.includes(s))

    // §1.4 — of the merged top-20, how many occupants did their OWN stream rank at `inStream` or
    // worse? Each is a document its own stream considered less relevant than the correct answer,
    // shown in its place. Zero when the key was never retrieved (nothing to displace).
    let displacedBy = 0
    if (inStream >= 0 && (mergedRank < 0 || mergedRank >= TOP)) {
      const rankIn = new Map<string, number>()
      for (const s of routed.perStream) s.ids.forEach((id, i) => { if (!rankIn.has(id)) rankIn.set(id, i) })
      for (const r of merged.slice(0, TOP)) {
        const own = rankIn.get(r.id)
        if (own !== undefined && own >= inStream) displacedBy++
      }
    }

    const wc = await wordCounts([...q.keys, ...merged.slice(0, TOP).map((r) => r.id)])
    // The key document whose length matters is the one retrieval actually found; fall back to the
    // first key so a never-retrieved question still contributes a length.
    const foundKeyId = inStream >= 0
      ? routed.perStream.find((s) => s.stream === foundInStream)!.ids.find((id) => matches(id, q.keys))!
      : q.keys[0]
    const keyWords = wc.get(foundKeyId) ?? (await wordCounts([foundKeyId])).get(foundKeyId) ?? null

    const verdict: Row['verdict'] =
      mergedRank >= 0 && mergedRank < 5 ? 'HIT@5'
      : mergedRank >= 0 && mergedRank < TOP ? 'HIT@20'
      : inStream >= 0 ? 'DILUTED'
      : !ownerRouted ? 'NOT-ROUTED'
      : 'NOT-RETRIEVED'

    rows.push({
      q, routed: routedNames, ownerRouted, foundInStream, inStream, merged: mergedRank,
      mergedLen: merged.length,
      perStreamLen: Object.fromEntries(routed.perStream.map((s) => [s.stream, s.ids.length])),
      displacedBy, keyWords, topWords: merged.slice(0, TOP).map((r) => wc.get(r.id) ?? 0).filter((n) => n > 0),
      verdict,
    })
    console.log(
      `  ${q.id.padEnd(9)} ${q.collection.padEnd(16)} ${verdict.padEnd(14)} ` +
      `inStream=${String(inStream).padStart(3)}${foundInStream ? `(${foundInStream})` : ''}`.padEnd(24) +
      ` merged=${String(mergedRank).padStart(4)}/${String(merged.length).padEnd(4)} routed=[${routedNames.join(',')}]`)
  }

  // ── THE §1 DELIVERABLE: THE TABLE ───────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(118))
  console.log('  §1.2 — WHERE EACH LOST ANSWER DIES. In-stream rank is what retrieval found; merged is what a caller sees.')
  console.log('  ' + 'question'.padEnd(10) + 'collection'.padEnd(17) + 'in-stream'.padEnd(11) + 'stream'.padEnd(14) + 'merged'.padEnd(9) + 'of'.padEnd(7) + 'verdict'.padEnd(15) + 'displaced-by')
  for (const r of rows) {
    console.log('  ' + r.q.id.padEnd(10) + r.q.collection.padEnd(17) +
      (r.inStream < 0 ? '—' : String(r.inStream)).padEnd(11) +
      (r.foundInStream ?? '—').padEnd(14) +
      (r.merged < 0 ? 'absent' : String(r.merged)).padEnd(9) +
      String(r.mergedLen).padEnd(7) + r.verdict.padEnd(15) +
      (r.displacedBy || ''))
  }

  // ── the four-way split, per collection, n beside every number ────────────────────────────────
  console.log('\n' + '─'.repeat(118))
  console.log('  collection            n   merged@20      merged@5      IN-STREAM@20   DILUTED  NOT-RETR  NOT-ROUTED')
  const collections = [...new Set(rows.map((r) => r.q.collection))].sort()
  const perCollection: any[] = []
  for (const c of collections) {
    const qs = rows.filter((r) => r.q.collection === c)
    const m20 = qs.filter((r) => r.merged >= 0 && r.merged < TOP).length
    const m5 = qs.filter((r) => r.merged >= 0 && r.merged < 5).length
    const i20 = qs.filter((r) => r.inStream >= 0 && r.inStream < TOP).length
    const dil = qs.filter((r) => r.verdict === 'DILUTED').length
    const nr = qs.filter((r) => r.verdict === 'NOT-RETRIEVED').length
    const nrt = qs.filter((r) => r.verdict === 'NOT-ROUTED').length
    perCollection.push({ collection: c, n: qs.length, merged20: m20, merged5: m5, inStream20: i20, diluted: dil, notRetrieved: nr, notRouted: nrt })
    console.log(`  ${c.padEnd(20)} ${String(qs.length).padStart(2)}  ` +
      `${String(m20).padStart(2)}/${String(qs.length).padEnd(2)} ${pct(m20, qs.length).padStart(5)}  ` +
      `${String(m5).padStart(2)}/${String(qs.length).padEnd(2)} ${pct(m5, qs.length).padStart(5)}  ` +
      `${String(i20).padStart(2)}/${String(qs.length).padEnd(2)} ${pct(i20, qs.length).padStart(5)}  ` +
      `${String(dil).padStart(7)} ${String(nr).padStart(8)} ${String(nrt).padStart(11)}`)
  }
  const n = rows.length
  const M20 = rows.filter((r) => r.merged >= 0 && r.merged < TOP).length
  const I20 = rows.filter((r) => r.inStream >= 0 && r.inStream < TOP).length
  const IANY = rows.filter((r) => r.inStream >= 0).length
  console.log('─'.repeat(118))
  console.log(`  ${'ALL'.padEnd(20)} ${String(n).padStart(2)}  ${String(M20).padStart(2)}/${String(n).padEnd(2)} ${pct(M20, n).padStart(5)}` +
    `${''.padEnd(16)}${String(I20).padStart(2)}/${String(n).padEnd(2)} ${pct(I20, n).padStart(5)}`)
  console.log(`\n  ⚠ THE GAP IS THE MERGE. in-stream@20 ${I20}/${n} (${pct(I20, n)}) → merged@20 ${M20}/${n} (${pct(M20, n)}).`)
  console.log(`     Retrieval found the answer somewhere in a stream's own list for ${IANY}/${n} (${pct(IANY, n)}) questions.`)
  console.log(`  ⚠ ${totalSuppressed} row(s) were suppressed across all runs by the gateway's hollow-repeal filter (counted, not inferred).`)

  // ── §1.3 length ──────────────────────────────────────────────────────────────────────────────
  const med = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }
  const survivors = rows.filter((r) => r.merged >= 0 && r.merged < TOP && r.keyWords != null).map((r) => r.keyWords!)
  const discarded = rows.filter((r) => r.verdict === 'DILUTED' && r.keyWords != null).map((r) => r.keyWords!)
  const occupants = rows.flatMap((r) => r.topWords)
  console.log('\n' + '─'.repeat(118))
  console.log('  §1.3 — IS LENGTH THE MECHANISM? wordCount of the correct answer, surviving vs discarded by the merge.')
  console.log(`    correct answers that SURVIVED into merged top-${TOP}   n=${survivors.length}  median ${med(survivors) ?? '—'}  min ${survivors.length ? Math.min(...survivors) : '—'}  max ${survivors.length ? Math.max(...survivors) : '—'}`)
  console.log(`    correct answers DISCARDED by the merge (DILUTED)     n=${discarded.length}  median ${med(discarded) ?? '—'}  min ${discarded.length ? Math.min(...discarded) : '—'}  max ${discarded.length ? Math.max(...discarded) : '—'}`)
  console.log(`    every document occupying a merged top-${TOP} slot       n=${occupants.length}  median ${med(occupants) ?? '—'}`)
  console.log('    ⚠ A difference here is a NORMALISATION defect and a different fix from a round-robin defect.')
  // ⚠⚠ THE HEADLINE COMPARISON IS CONFOUNDED BY COLLECTION AND MUST NOT BE READ ALONE.
  // A legislation section is a few hundred words; a Hansard speech is a few thousand. The
  // collections that fail are the long-document collections, so "discarded answers are longer"
  // is partly just "debates and committees fail". Split by collection, the question becomes
  // answerable: WITHIN one collection, are the discarded keys longer than the surviving ones?
  console.log('\n    within collection — median wordCount of the correct answer, n stated (⚠ the comparison above is confounded by collection):')
  console.log(`      ${'collection'.padEnd(20)} ${'survived'.padEnd(18)} discarded`)
  for (const c of collections) {
    const qs = rows.filter((r) => r.q.collection === c)
    const sv = qs.filter((r) => r.merged >= 0 && r.merged < TOP && r.keyWords != null).map((r) => r.keyWords!)
    const dc = qs.filter((r) => r.verdict === 'DILUTED' && r.keyWords != null).map((r) => r.keyWords!)
    console.log(`      ${c.padEnd(20)} ${`${med(sv) ?? '—'} (n=${sv.length})`.padEnd(18)} ${med(dc) ?? '—'} (n=${dc.length})`)
  }
  console.log('      ⚠ n is 0–5 in every cell. These are counts, not evidence of a trend; they are printed so the')
  console.log('        confounding is visible rather than so a conclusion can be drawn from them.')

  // ── §1.4 round-robin cost ────────────────────────────────────────────────────────────────────
  const displacedRows = rows.filter((r) => r.displacedBy > 0)
  const totalDisplaced = displacedRows.reduce((s, r) => s + r.displacedBy, 0)
  console.log('\n' + '─'.repeat(118))
  console.log('  §1.4 — WHAT IS THE ROUND-ROBIN COSTING?')
  console.log(`    questions where the correct answer was retrieved but excluded from merged top-${TOP}: ${rows.filter((r) => r.verdict === 'DILUTED').length}`)
  console.log(`    of those, ${displacedRows.length} had top-${TOP} slots taken by results their OWN stream ranked at or below the key.`)
  console.log(`    total such slots across all questions: ${totalDisplaced}  (mean ${displacedRows.length ? (totalDisplaced / displacedRows.length).toFixed(1) : '—'} per affected question, of ${TOP})`)
  // The arithmetic ceiling: with S streams and a floor of 2, a top-20 window can only ever show
  // the first floor(20/S) of each stream. Printed because it is the mechanism, not a symptom.
  // ⚠ A REAL MODE, COMPUTED FROM A TALLY. The first version sorted the DISTINCT counts by their
  // frequency and took [0] — which returns whichever distinct value the comparator happened to
  // leave first, and reported "1 streams routed most often" for a set whose modal fan-out is 5.
  // A derived number that is never checked against the data it summarises is how a wrong figure
  // reaches a report looking exactly like a right one.
  const tally = new Map<number, number>()
  for (const r of rows) if (r.routed.length) tally.set(r.routed.length, (tally.get(r.routed.length) ?? 0) + 1)
  console.log(`    fan-out tally: ${[...tally.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k} stream(s)×${v}q`).join('  ')}`)
  // ⚠ NO MODAL FAN-OUT IS QUOTED, and the first version of this block quoted one. The tally above
  // is multi-modal (1×18, 3×15, 5×14, 4×12, 2×6), so "the modal fan-out is 1" was true and
  // useless — it described 28% of the set and implied a top-20 window could show 20 results per
  // stream, which is the opposite of the finding. The ceiling is a PER-QUESTION fact and is
  // computed per question below.
  const withStreams = rows.filter((r) => r.routed.length)
  const capFor = (r: Row) => Math.floor(TOP / r.routed.length)
  const found = withStreams.filter((r) => r.inStream >= 0)
  const beyondOwnCap = found.filter((r) => r.inStream >= capFor(r))
  console.log(`    ⚠ THE ARITHMETIC, PER QUESTION: with S streams routed, a top-${TOP} window can show at most the`)
  console.log(`      first floor(${TOP}/S) of EACH stream. An in-stream rank at or beyond that cannot appear in it,`)
  console.log(`      whatever its score. That ceiling IS the merge, stated as arithmetic rather than as a symptom.`)
  console.log(`      of the ${found.length} questions where retrieval found the answer in some stream's own list,`)
  console.log(`      ${beyondOwnCap.length} sit at or beyond their own question's ceiling — unreachable without changing the merge;`)
  console.log(`      ${found.length - beyondOwnCap.length} sit inside it.`)
  // The relation the round-robin implies, CHECKED against the data rather than asserted: for a
  // key found at in-stream rank r with S streams routed, merged rank should be ≈ r×S.
  const checkable = rows.filter((r) => r.inStream >= 0 && r.merged >= 0 && r.routed.length)
  const agree = checkable.filter((r) => Math.abs(r.merged - r.inStream * r.routed.length) <= r.routed.length).length
  console.log(`    ⚠ merged ≈ in-stream × streams holds for ${agree}/${checkable.length} of the keys found AND merged`)
  console.log(`      (tolerance ± one full round). That relation IS the round-robin; it is not an approximation of it.`)

  const after = indexStamp()
  // ⚠ THREE OUTCOMES, NOT TWO. Two nulls compare equal, so `before === after` would print
  // "the corpus did not move" on a run where the stamp was never taken — a check that cannot
  // fail, dressed as one that passed. UNSTAMPED is named separately and exits non-zero, exactly
  // as a moved index does.
  const stamped = !!before && !!after
  const moved = stamped && JSON.stringify(before) !== JSON.stringify(after)
  if (!stamped) {
    console.log('\n  ⚠⚠ NO INDEX STAMP — this run does not say which index it describes, so it cannot be compared to anything later.')
  } else if (moved) {
    console.log('\n  ⚠⚠ THE INDEX CHANGED DURING THIS RUN — these figures describe neither state. Re-take it.')
    after!.forEach((l) => console.log(l))
  } else {
    console.log('\n  ✅ index stamps match either side of the run — the corpus did not move.')
  }

  if (JSON_OUT) {
    fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true })
    fs.writeFileSync(JSON_OUT, JSON.stringify({
      takenAt: new Date().toISOString(),
      indexStampBefore: before, indexStampAfter: after, indexMoved: moved,
      config: {
        fts: process.env.FTS_SEARCH_URL ?? null, vector: process.env.VECTOR_SEARCH_URL ?? null,
        vectorStreams: process.env.LEX_VECTOR_STREAMS ?? null, limit: LIMIT, top: TOP,
      },
      hollowSuppressed: totalSuppressed,
      perCollection,
      rows: rows.map((r) => ({
        id: r.q.id, collection: r.q.collection, set: r.q.set, query: r.q.query, keys: r.q.keys,
        routed: r.routed, foundInStream: r.foundInStream, inStream: r.inStream,
        merged: r.merged, mergedLen: r.mergedLen, perStreamLen: r.perStreamLen,
        displacedBy: r.displacedBy, keyWords: r.keyWords, verdict: r.verdict,
      })),
      length: {
        survivorsWordCount: survivors, discardedWordCount: discarded,
        occupantMedian: med(occupants), survivorMedian: med(survivors), discardedMedian: med(discarded),
      },
    }, null, 2))
    console.log(`\n  wrote ${JSON_OUT}`)
  }
  await prisma.$disconnect()
  process.exit(moved || !stamped ? 1 : 0)
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
