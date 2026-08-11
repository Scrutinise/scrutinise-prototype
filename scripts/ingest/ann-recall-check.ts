/**
 * ann-recall-check.ts — DOES THE ANN INDEX ACTUALLY RETRIEVE WELL? (BRIEF_SEARCH_S2C4 §1)
 *
 * The lead this settles, handed over by the ingest thread rather than acted on: the 11 Aug ANN
 * rebuild logged repeated `KMeans: clusters are empty / too small (1529 < 4096)` warnings, and the
 * 4,096-partition setting has never been re-tuned against a corpus that has since grown. If the
 * index is mis-partitioned, dense recall is degraded, §2's ordering baseline will look poor, and we
 * could spend a sprint building a reranker to compensate for a clustering parameter.
 *
 * WHAT IS MEASURED, and why this shape
 * ------------------------------------
 * Production probes 24 of 4,096 IVF partitions (`VECTOR_NPROBES` default 24, VERIFIED unset on the
 * live service — see the report). Probing ALL 4,096 is exhaustive over the index by construction:
 * every vector lives in exactly one partition, so nprobes=4096 cannot miss a candidate the index
 * holds. That is the brief's own second option ("the same query with nprobes raised far enough that
 * the result is effectively exhaustive"), and it isolates ONE variable — probe count — because
 * every other knob (cosine, refineFactor=2, the ×5 chunk overscan) is held identical across rungs.
 *
 * ⚠ Two things it therefore does NOT measure, stated here so no number travels further than it
 * should:
 *   1. PQ QUANTISATION loss. Both rungs read the same 96-subvector codes. `--exact N` adds a true
 *      `bypassVectorIndex()` scan for a few queries, which is the only way to see that loss; it
 *      reads the whole 768-d vector column (~69 GB) per query, so it is opt-in and time-capped.
 *   2. Whether the LIVE SERVICE agrees with this box. That is not assumed either: `--live N`
 *      re-asks the production endpoint the same queries and reports the overlap with rung 24.
 *
 * THREE CONTROLS, because a check that cannot fail is not a check (docs/CLAUDE.md, and the three
 * that could not fail on 11 Aug):
 *   · rung 1  — one partition probed. Overlap here MUST be materially below rung 24, or the
 *               comparison is not sensitive to probe count at all and no rung means anything.
 *   · shuffle — query i's rung-24 hits scored against query j's exhaustive hits. MUST be ~0.
 *   · mirror  — the query this file builds is asserted, at runtime, against the constants and the
 *               builder chain in search/vector-core.ts. A silent divergence there would have this
 *               script measuring a system nobody serves.
 *
 * Usage (from scripts/ingest; needs GEMINI_API_KEY + the R2 creds):
 *   npx tsx ann-recall-check.ts                       # full run: ladder + all controls
 *   npx tsx ann-recall-check.ts --queries 12          # fewer queries, for a smoke test
 *   npx tsx ann-recall-check.ts --ladder 1,24,4096    # custom probe ladder
 *   npx tsx ann-recall-check.ts --exact 2 --live 6    # PQ-loss and live-service cross-checks
 *   npx tsx ann-recall-check.ts --self-test           # prove the mirror guard can fail. No Lance.
 *
 * Read-only throughout: it opens the table, queries it, and writes nothing anywhere.
 */
import fs from 'fs'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { connectLance, lancedb } from './search/lance'
import { VEC_TABLE } from './search/vector-common'
import { embedQuery } from './search/vector-core'
import { GOLD } from './search/gold-queries'
import { PREFERENCE_QUERIES } from '../../scrutinise-web/scripts/gold-preferences'

export {}

// ── production retrieval parameters, MIRRORED from search/vector-core.ts ─────────────────────
// Copied rather than imported because they are module-level `parseInt(process.env…)` constants
// there: one process can only hold one value, and this script must vary nprobes within a run.
// `assertMirrorsProduction()` below is what keeps the copy honest.
const PROD_NPROBES = 24
const PROD_OVERSCAN = 5
const PROD_REFINE = 2
const TOP_K = 20

const argv = process.argv.slice(2)
const has = (f: string) => argv.includes(`--${f}`)
const num = (f: string, d: number) => {
  const i = argv.indexOf(`--${f}`)
  if (i < 0) return d
  const v = parseInt(argv[i + 1] ?? '', 10)
  return Number.isFinite(v) ? v : d
}
const str = (f: string, d: string) => {
  const i = argv.indexOf(`--${f}`)
  const v = i >= 0 ? argv[i + 1] : undefined
  return v && !v.startsWith('--') ? v : d
}

const LADDER = str('ladder', '1,24,64,256,1024,4096').split(',').map((s) => parseInt(s.trim(), 10)).filter(Number.isFinite)
const EXHAUSTIVE = Math.max(...LADDER)
const LIVE_URL = (process.env.VECTOR_SEARCH_URL ?? 'https://vector-serve-production.up.railway.app').replace(/\/$/, '')
const GATE = parseFloat(str('gate', '0.9'))

const pctS = (x: number) => `${(100 * x).toFixed(1)}%`
const n = (v: number) => Number(v).toLocaleString('en-GB')

// ── the mirror guard ────────────────────────────────────────────────────────────────────────
/**
 * Parse search/vector-core.ts and assert this file still describes the same retrieval. Checks the
 * three defaults AND the builder chain, because a change to either (a switched distance metric, a
 * dropped refine, a different overscan formula) would make every number below describe a system
 * that is not in production. Exported and given its own `--self-test` so it can be watched failing
 * before it is trusted to pass.
 */
export function assertMirrorsProduction(source: string): string[] {
  const problems: string[] = []
  const want: Array<[string, RegExp, number]> = [
    ['VECTOR_NPROBES default', /VECTOR_NPROBES\s*\?\?\s*'(\d+)'/, PROD_NPROBES],
    ['VECTOR_CHUNK_OVERSCAN default', /VECTOR_CHUNK_OVERSCAN\s*\?\?\s*'(\d+)'/, PROD_OVERSCAN],
    ['VECTOR_REFINE_FACTOR default', /VECTOR_REFINE_FACTOR\s*\?\?\s*'(\d+)'/, PROD_REFINE],
  ]
  for (const [label, re, mine] of want) {
    const m = re.exec(source)
    if (!m) problems.push(`${label}: not found in vector-core.ts — the constant was renamed or removed`)
    else if (parseInt(m[1], 10) !== mine) problems.push(`${label}: vector-core says ${m[1]}, this script mirrors ${mine}`)
  }
  const chain: Array<[string, RegExp]> = [
    ['cosine distance', /\.distanceType\('cosine'\)/],
    ['nprobes applied', /\.nprobes\(NPROBES\)/],
    ['refineFactor applied', /\.refineFactor\(REFINE\)/],
    ['overscan limit formula', /\.limit\(Math\.max\(limit \* CHUNK_OVERSCAN, 60\)\)/],
    ['section collapse keeps best per section', /sim > cur\.score/],
  ]
  for (const [label, re] of chain) if (!re.test(source)) problems.push(`${label}: not found in vector-core.ts — the query this script imitates has changed`)
  return problems
}

function mirrorGuard() {
  const src = fs.readFileSync(path.join(__dirname, 'search/vector-core.ts'), 'utf8')
  const problems = assertMirrorsProduction(src)
  if (problems.length) {
    console.error('[ann-recall] ❌ MIRROR GUARD FAILED — this script no longer describes production retrieval:')
    for (const p of problems) console.error(`   · ${p}`)
    process.exit(1)
  }
  console.log(`[ann-recall] mirror guard ✓ — nprobes=${PROD_NPROBES} overscan=×${PROD_OVERSCAN} refine=×${PROD_REFINE}, cosine, collapse-best-per-section`)
}

/** `--self-test`: the guard, watched failing on four planted defects and passing on the real file. */
function selfTest() {
  const real = fs.readFileSync(path.join(__dirname, 'search/vector-core.ts'), 'utf8')
  const cases: Array<[string, string]> = [
    ['nprobes default changed 24 → 48', real.replace(/VECTOR_NPROBES \?\? '24'/, "VECTOR_NPROBES ?? '48'")],
    ['overscan default changed 5 → 3', real.replace(/VECTOR_CHUNK_OVERSCAN \?\? '5'/, "VECTOR_CHUNK_OVERSCAN ?? '3'")],
    ['distance metric switched to l2', real.replace(/\.distanceType\('cosine'\)/, ".distanceType('l2')")],
    // ⚠ `\r?\n` is not defensive dressing: the first version of this mutation used `\n` alone,
    // silently failed to apply against this CRLF tree, and reported 4/5 — a planted defect that
    // was never planted reads exactly like a guard with a hole in it.
    ['refine dropped from the chain', real.replace(/\.refineFactor\(REFINE\)\r?\n\s*/, '')],
    ['overscan formula rewritten', real.replace(/\.limit\(Math\.max\(limit \* CHUNK_OVERSCAN, 60\)\)/, '.limit(limit * 3)')],
  ]
  let caught = 0
  for (const [label, mutated] of cases) {
    if (mutated === real) { console.log(`  ⚠ ${label}: the mutation did not apply — the pattern it targets is gone`); continue }
    const problems = assertMirrorsProduction(mutated)
    console.log(`  ${problems.length ? '✓ caught' : '✗ MISSED'}  ${label}${problems.length ? ` — ${problems[0]}` : ''}`)
    if (problems.length) caught++
  }
  const clean = assertMirrorsProduction(real)
  console.log(`  ${clean.length === 0 ? '✓' : '✗'} the real vector-core.ts passes (${clean.length} problems)`)
  const ok = caught === cases.length && clean.length === 0
  console.log(`\n[ann-recall] self-test ${ok ? 'PASSED' : 'FAILED'} — ${caught}/${cases.length} planted defects caught`)
  process.exit(ok ? 0 : 1)
}

// ── the query, at an arbitrary probe count ──────────────────────────────────────────────────
interface Row { chunkId: string; sectionId: string; corpus: string; dist: number }

async function annRows(tbl: lancedb.Table, qvec: number[], opts: { nprobes?: number; exact?: boolean; tier?: string }): Promise<Row[]> {
  let q = tbl.vectorSearch(Float32Array.from(qvec))
    .distanceType('cosine')
    .limit(Math.max(TOP_K * PROD_OVERSCAN, 60)) // production's overscan, identical on every rung
  // `bypassVectorIndex` is a full exact KNN — no partitions, no PQ codes, no refine step to apply.
  if (opts.exact) q = q.bypassVectorIndex()
  else q = q.nprobes(opts.nprobes ?? PROD_NPROBES).refineFactor(PROD_REFINE)
  if (opts.tier) q = q.where(`tier = '${opts.tier.replace(/'/g, "''")}'`)
  const rows = await q.select(['chunkId', 'sectionId', 'corpus', 'tier']).toArray() as any[]
  return rows
    .map((r) => ({ chunkId: r.chunkId as string, sectionId: r.sectionId as string, corpus: r.corpus as string, dist: typeof r._distance === 'number' ? r._distance : 1 }))
    .sort((a, b) => a.dist - b.dist)
}

/** Production's collapse: best cosine similarity per section, top-k sections. */
function collapse(rows: Row[]): string[] {
  const best = new Map<string, number>()
  for (const r of rows) {
    const sim = 1 - r.dist
    const cur = best.get(r.sectionId)
    if (cur === undefined || sim > cur) best.set(r.sectionId, sim)
  }
  return [...best.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_K).map(([id]) => id)
}

const chunkTop = (rows: Row[]) => rows.slice(0, TOP_K).map((r) => r.chunkId)

/** |A ∩ B| / |B| — B is the reference (the exhaustive list), so a short A is penalised, not excused. */
function overlap(a: string[], b: string[]): number {
  if (!b.length) return NaN
  const set = new Set(a)
  return b.filter((x) => set.has(x)).length / b.length
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN)

// ── queries: everything we have that a person actually typed ────────────────────────────────
function queries(limit: number): Array<{ id: string; query: string }> {
  const out: Array<{ id: string; query: string }> = []
  const seen = new Set<string>()
  for (const g of GOLD) {
    const k = g.query.toLowerCase().trim()
    if (seen.has(k)) continue
    seen.add(k); out.push({ id: g.id, query: g.query })
  }
  let i = 0
  for (const q of PREFERENCE_QUERIES) {
    i++
    const k = q.toLowerCase().trim()
    if (seen.has(k)) continue
    seen.add(k); out.push({ id: `P${i}`, query: q })
  }
  return limit > 0 ? out.slice(0, limit) : out
}

async function embedAll(qs: Array<{ id: string; query: string }>): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>()
  for (const q of qs) {
    let last: Error | null = null
    for (let attempt = 0; attempt < 4; attempt++) {
      try { out.set(q.id, await embedQuery(q.query)); last = null; break } catch (e) {
        last = e as Error
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
      }
    }
    if (last) throw new Error(`embed failed for ${q.id} after 4 attempts: ${last.message}`)
    process.stdout.write(`\r[ann-recall] embedded ${out.size}/${qs.length}`)
  }
  console.log('')
  return out
}

/** Ask the LIVE production service the same question, so "this box measured it" is not the claim. */
async function liveSections(query: string): Promise<string[] | null> {
  try {
    const res = await fetch(`${LIVE_URL}/vector-search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, limit: TOP_K, noCache: true }),
    })
    if (!res.ok) { console.log(`   live-service ${res.status} for "${query.slice(0, 40)}"`); return null }
    const j = await res.json() as { results?: Array<{ id: string }> }
    return (j.results ?? []).map((r) => r.id)
  } catch (e) { console.log(`   live-service unreachable: ${(e as Error).message}`); return null }
}

async function main() {
  if (has('self-test')) return selfTest()
  mirrorGuard()

  const qs = queries(num('queries', 0))
  console.log(`[ann-recall] ${qs.length} distinct queries (gold set + ordering-preference queries)`)
  console.log(`[ann-recall] ladder: ${LADDER.join(', ')} probes of 4,096 — reference rung = ${EXHAUSTIVE}`)

  const conn = await connectLance()
  const tbl = await conn.openTable(VEC_TABLE)
  const rows = await tbl.countRows()
  console.log(`[ann-recall] ${VEC_TABLE}: ${n(rows)} rows`)
  for (const idx of await tbl.listIndices()) {
    const name = (idx as unknown as { name: string }).name
    try {
      const st = await tbl.indexStats(name) as { numIndexedRows?: number; numUnindexedRows?: number; indexType?: string; numPartitions?: number }
      console.log(`[ann-recall]   ${name} (${st.indexType ?? '?'}): indexed=${n(st.numIndexedRows ?? 0)} unindexed=${n(st.numUnindexedRows ?? 0)}`)
      if ((st.numUnindexedRows ?? 0) > 0) console.log('[ann-recall]   ⚠ unindexed rows are brute-force scanned, which FLATTERS the ANN rung — say so if this is not 0')
    } catch { /* stats are a nicety here, not the measurement */ }
  }

  const vecs = await embedAll(qs)

  // ── the ladder ────────────────────────────────────────────────────────────────────────────
  const chunkOv: Record<number, number[]> = {}
  const sectOv: Record<number, number[]> = {}
  // Latency per rung, because the decision this feeds is a TRADE-OFF, not a target. nprobes is a
  // query-time env var on vector-serve — no rebuild — so recall and milliseconds are the two halves
  // of the same choice and reporting one without the other would hide the price.
  const rungMs: Record<number, number[]> = {}
  for (const p of LADDER) { chunkOv[p] = []; sectOv[p] = []; rungMs[p] = [] }
  const refChunks = new Map<string, string[]>()
  const refSects = new Map<string, string[]>()
  const perQuery: Array<{ id: string; query: string; chunk: number; sect: number }> = []

  for (const q of qs) {
    const qv = vecs.get(q.id)!
    const byRung = new Map<number, Row[]>()
    for (const p of LADDER) {
      const t0 = Date.now()
      byRung.set(p, await annRows(tbl, qv, { nprobes: p }))
      rungMs[p].push(Date.now() - t0)
    }
    process.stdout.write(`  ${q.id.padEnd(4)} ${LADDER.map((p) => `${p}:${rungMs[p].at(-1)}ms`).join(' ')}`)
    const ref = byRung.get(EXHAUSTIVE)!
    refChunks.set(q.id, chunkTop(ref))
    refSects.set(q.id, collapse(ref))
    for (const p of LADDER) {
      const c = overlap(chunkTop(byRung.get(p)!), refChunks.get(q.id)!)
      const s = overlap(collapse(byRung.get(p)!), refSects.get(q.id)!)
      chunkOv[p].push(c); sectOv[p].push(s)
      if (p === PROD_NPROBES) perQuery.push({ id: q.id, query: q.query, chunk: c, sect: s })
    }
    console.log(`   chunk@${PROD_NPROBES} ${pctS(chunkOv[PROD_NPROBES].at(-1)!)}  section@${PROD_NPROBES} ${pctS(sectOv[PROD_NPROBES].at(-1)!)}`)
  }

  console.log('\n════ THE LADDER ════  (overlap of each rung with the exhaustive rung, mean over queries)')
  console.log('  probes   chunk top-20   section top-20   mean ms   p95 ms')
  const p95 = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(0.95 * s.length))] }
  for (const p of LADDER) {
    console.log(`  ${String(p).padStart(6)}   ${pctS(mean(chunkOv[p])).padStart(12)}   ${pctS(mean(sectOv[p])).padStart(14)}   ${String(Math.round(mean(rungMs[p]))).padStart(7)}   ${String(p95(rungMs[p])).padStart(6)}`)
  }
  console.log('  ⚠ these ms are THIS box against R2, not user-facing latency: no query cache, no')
  console.log('    concurrency, and a different network path from vector-serve. Read them as the SHAPE')
  console.log('    of the recall/latency trade-off, not as a production number.')

  // ── controls ──────────────────────────────────────────────────────────────────────────────
  /** Collected rather than only printed, so the R2 artefact carries them too. */
  const controls: Record<string, unknown> = {}
  console.log('\n════ CONTROLS ════')
  const lowRung = LADDER.filter((p) => p < PROD_NPROBES).sort((a, b) => a - b)[0]
  if (lowRung !== undefined) {
    const lo = mean(chunkOv[lowRung]), prod = mean(chunkOv[PROD_NPROBES])
    const sensitive = lo < prod - 0.05
    controls.sensitivity = { lowRung, lowOverlap: lo, prodOverlap: prod, pass: sensitive }
    console.log(`  sensitivity  rung ${lowRung} = ${pctS(lo)} vs rung ${PROD_NPROBES} = ${pctS(prod)} → ${sensitive ? '✓ the comparison responds to probe count' : '✗ NO RESPONSE — the ladder is measuring nothing'}`)
  } else console.log('  sensitivity  not run (no rung below production in the ladder)')

  // ⚠ Needs at least 2 queries or "query j" IS query i and the control reports the headline back
  // at itself as a failure. Seen on the first smoke run at --queries 1.
  if (qs.length < 2) {
    console.log('  shuffle      not run — needs ≥2 queries (with one, query j is query i)')
  } else {
    const shuffled: number[] = []
    for (let i = 0; i < qs.length; i++) {
      const mine = chunkTop(await annRows(tbl, vecs.get(qs[i].id)!, { nprobes: PROD_NPROBES }))
      shuffled.push(overlap(mine, refChunks.get(qs[(i + 1) % qs.length].id)!))
    }
    const sh = mean(shuffled)
    controls.shuffle = { overlap: sh, pass: sh < 0.05 }
    console.log(`  shuffle      query i's rung-${PROD_NPROBES} hits vs query j's exhaustive hits = ${pctS(sh)} → ${sh < 0.05 ? '✓ ~0, as it must be' : '✗ NOT ~0 — the overlap metric is not discriminating'}`)
  }

  // ── live-service cross-check ──────────────────────────────────────────────────────────────
  const liveN = num('live', 6)
  if (liveN > 0) {
    const agree: number[] = []
    for (const q of qs.slice(0, liveN)) {
      const live = await liveSections(q.query)
      if (!live?.length) continue
      const boxProd = collapse(await annRows(tbl, vecs.get(q.id)!, { nprobes: PROD_NPROBES }))
      agree.push(overlap(boxProd, live))
    }
    controls.liveService = { n: agree.length, meanOverlap: agree.length ? mean(agree) : null }
    console.log(`  live service ${agree.length} queries re-asked at ${LIVE_URL} → mean overlap with this box's rung-${PROD_NPROBES} sections = ${agree.length ? pctS(mean(agree)) : 'n/a'}`)
    console.log('               (a low number here means the box and production are not the same measurement — read it before reading anything else)')
  }

  // ── PQ quantisation, opt-in and time-capped ───────────────────────────────────────────────
  const exactN = num('exact', 2)
  if (exactN > 0) {
    const capMs = num('exact-cap-s', 900) * 1000
    const t0 = Date.now()
    const vsProd: number[] = [], vsExhaustive: number[] = []
    for (const q of qs.slice(0, exactN)) {
      if (Date.now() - t0 > capMs) { console.log(`  exact scan   time cap hit after ${vsProd.length} queries — stopping (this is a report, not a failure)`); break }
      const t1 = Date.now()
      const ex = await annRows(tbl, vecs.get(q.id)!, { exact: true })
      const exTop = chunkTop(ex)
      vsProd.push(overlap(chunkTop(await annRows(tbl, vecs.get(q.id)!, { nprobes: PROD_NPROBES })), exTop))
      vsExhaustive.push(overlap(refChunks.get(q.id)!, exTop))
      console.log(`  exact scan   ${q.id} in ${((Date.now() - t1) / 1000).toFixed(0)}s: rung-${PROD_NPROBES} ${pctS(vsProd.at(-1)!)}, rung-${EXHAUSTIVE} ${pctS(vsExhaustive.at(-1)!)} of the true top-${TOP_K}`)
    }
    controls.exactScan = { n: vsProd.length, prodVsTrue: vsProd.length ? mean(vsProd) : null, exhaustiveVsTrue: vsExhaustive.length ? mean(vsExhaustive) : null }
    if (vsProd.length) {
      console.log(`  exact scan   n=${vsProd.length}: production ${pctS(mean(vsProd))} of true top-${TOP_K}; all-partitions ${pctS(mean(vsExhaustive))}`)
      console.log('               (the gap between these two is PQ quantisation, which no probe count can recover)')
    }
  }

  // ── the verdict the brief asks for ─────────────────────────────────────────────────────────
  const headline = mean(chunkOv[PROD_NPROBES])
  const headlineSect = mean(sectOv[PROD_NPROBES])

  // ⚠ WRITE THE RESULT SOMEWHERE DURABLE BEFORE PRINTING IT. The first run computed every number
  // here and then lost the whole block: the heavy-job runner followed a SLIDING 96 KB log tail by
  // line index, so once Lance's deprecation warnings pushed the log past the window, nothing further
  // was ever shown. The runner is fixed, but a measurement that exists only in a log tail is a
  // measurement that can be lost, and this one costs €0.10 and 38 minutes to repeat.
  try {
    const { r2Put } = require(path.join(__dirname, 'shared/r2-client')) as { r2Put: (k: string, b: string | Buffer, ct?: string) => Promise<unknown> }
    const key = `_ops/ann-recall/result-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    await r2Put(key, JSON.stringify({
      measuredAt: new Date().toISOString(),
      table: VEC_TABLE, rows, queries: qs.length, ladder: LADDER, exhaustiveRung: EXHAUSTIVE,
      production: { nprobes: PROD_NPROBES, overscan: PROD_OVERSCAN, refine: PROD_REFINE, topK: TOP_K },
      meanChunkOverlap: Object.fromEntries(LADDER.map((p) => [p, mean(chunkOv[p])])),
      meanSectionOverlap: Object.fromEntries(LADDER.map((p) => [p, mean(sectOv[p])])),
      meanMs: Object.fromEntries(LADDER.map((p) => [p, mean(rungMs[p])])),
      perQuery: perQuery.map((q) => ({ id: q.id, query: q.query, chunk: q.chunk, section: q.sect })),
      controls, gate: GATE, headline, headlineSect,
    }, null, 1), 'application/json')
    console.log(`
[ann-recall] result artefact → r2://${key}`)
  } catch (e) { console.log(`
[ann-recall] ⚠ could not write the R2 artefact (${(e as Error).message}) — the log is the only record`) }
  console.log('\n════ §1 VERDICT ════')
  console.log(`  queries                       ${qs.length}`)
  console.log(`  mean overlap, chunk top-20    ${pctS(headline)}   ← ANN recall proper`)
  console.log(`  mean overlap, section top-20  ${pctS(headlineSect)}   ← what the product ranks on`)
  console.log(`  gate                          ${pctS(GATE)}`)
  const worst = [...perQuery].sort((a, b) => a.chunk - b.chunk).slice(0, 8)
  console.log('  weakest queries (chunk overlap):')
  for (const w of worst) console.log(`    ${pctS(w.chunk).padStart(6)}  ${w.id.padEnd(4)} ${w.query.slice(0, 78)}`)
  console.log(headline >= GATE
    ? `\n  → ≥ ${pctS(GATE)}. The index retrieves what an exhaustive probe would. §2 may proceed.`
    : `\n  → BELOW ${pctS(GATE)}. STOP and report: partition retuning is a separate decision with a cost, and it belongs to Charlie and the ingest thread, not to this sprint.`)
}

main().catch((e) => { console.error('[ann-recall] FATAL', e); process.exit(1) })
