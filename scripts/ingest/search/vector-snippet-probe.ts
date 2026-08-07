/**
 * vector-snippet-probe.ts — where does a /vector-search request actually spend its time?
 *
 * WHY. The handle-pool probe measures the ANN search alone and finds it fast (~1-1.6s p50
 * locally). But a real /vector-search round-trip measured ~8.2s on the same machine, of
 * which the Gemini embed is ~0.4s. Something between those two numbers is doing most of
 * the work, and optimising the part that is already fast would be wasted effort.
 *
 * The suspect is snippets() in vector-query-service.ts:
 *     chunksTbl.query().where(`sectionId IN (...)`)
 * against corpus_chunks — 21.8M rows. If sectionId carries no scalar index, that predicate
 * is a full scan of the chunk bodies on R2 for EVERY query, which would make snippet
 * hydration, not vector search, the thing that governs latency and the thing a cache is
 * really saving.
 *
 * This prints the three phases separately, and lists the table's indices, so the split is
 * evidence rather than inference.
 *
 * Usage: tsx search/vector-snippet-probe.ts
 */
import { connectLance } from './lance'
import { CHUNKS_TABLE, VEC_TABLE } from './vector-common'
import { embedQuery, vectorSearchSections } from './vector-core'

const QUERIES: Array<{ q: string; tier?: string }> = [
  { q: 'landlord eviction no fault', tier: 'legislation' },
  { q: 'water company pollution enforcement', tier: 'parliamentary' },
  { q: 'noise nuisance neighbours enforcement', tier: 'caselaw' },
  { q: 'data protection subject access request', tier: 'legislation' },
]

function stat(name: string, xs: number[]) {
  const s = [...xs].sort((a, b) => a - b)
  const p = (q: number) => s[Math.min(s.length - 1, Math.floor((q / 100) * s.length))]
  const mean = Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)
  console.log(`  ${name.padEnd(22)} mean ${String(mean).padStart(6)}ms   p50 ${String(p(50)).padStart(6)}ms   max ${String(Math.max(...xs)).padStart(6)}ms`)
}

async function main() {
  const conn = await connectLance()
  const vecTbl = await conn.openTable(VEC_TABLE)
  const chunksTbl = await conn.openTable(CHUNKS_TABLE)

  // What indices actually exist? The whole hypothesis turns on whether sectionId has one.
  for (const [name, tbl] of [[VEC_TABLE, vecTbl], [CHUNKS_TABLE, chunksTbl]] as const) {
    try {
      const idx = await tbl.listIndices()
      console.log(`[probe] ${name} indices: ${idx.length ? idx.map((i: any) => `${i.name}(${i.indexType ?? '?'}) on [${(i.columns ?? []).join(',')}]`).join(', ') : 'NONE'}`)
    } catch (e) { console.log(`[probe] ${name} listIndices failed: ${(e as Error).message}`) }
  }
  console.log(`[probe] corpus_chunks rows = ${await chunksTbl.countRows()}`)
  console.log('')

  // Warm BOTH paths, not just the ANN one.
  //
  // ⚠ This warm-up used to touch only corpus_vec, which was harmless while corpus_chunks
  // was unindexed — a full scan has no index pages to warm, so every query paid the same.
  // Once the BTREE on sectionId exists that stops being true: its pages come from R2 on
  // first touch, and the first few snippet lookups pay for warming it. Leaving the warm-up
  // one-sided would therefore charge the index for its own cold start and UNDERSTATE the
  // improvement it was built to deliver — measured 4,883 → 3,821 → 1,693 → 1,308 ms across
  // four consecutive queries on a cold process.
  console.log('[probe] warm-up (ANN + snippet index)…')
  const wv = await embedQuery('warm up')
  const wh = await vectorSearchSections(vecTbl, wv, 20)
  if (wh.length) {
    const ids = wh.map((h) => h.sectionId)
    const inList = ids.map((s) => `'${s.replace(/'/g, "''")}'`).join(',')
    // Two touches: the first pulls index pages, the second proves they are resident.
    for (let i = 0; i < 2; i++) {
      const t = Date.now()
      await chunksTbl.query().where(`sectionId IN (${inList})`).select(['sectionId', 'chunkId']).limit(ids.length * 4).toArray()
      console.log(`  snippet warm-up pass ${i + 1}: ${Date.now() - t}ms`)
    }
  }
  console.log('[probe] warm.\n')

  const embedT: number[] = [], annT: number[] = [], snipT: number[] = []
  for (const { q, tier } of QUERIES) {
    let t = Date.now()
    const qv = await embedQuery(q)
    embedT.push(Date.now() - t)

    t = Date.now()
    const hits = await vectorSearchSections(vecTbl, qv, 20, tier)
    annT.push(Date.now() - t)

    t = Date.now()
    const ids = hits.map((h) => h.sectionId)
    if (ids.length) {
      const inList = ids.map((s) => `'${s.replace(/'/g, "''")}'`).join(',')
      await chunksTbl.query().where(`sectionId IN (${inList})`).select(['sectionId', 'chunkId', 'body', 'sectionTitle']).limit(ids.length * 4).toArray()
    }
    snipT.push(Date.now() - t)
    console.log(`  "${q}" tier=${tier} → ${hits.length} hits | embed ${embedT.at(-1)}ms  ann ${annT.at(-1)}ms  snippets ${snipT.at(-1)}ms`)
  }

  console.log('\n[probe] phase breakdown across all queries:')
  stat('embed (Gemini)', embedT)
  stat('ANN (corpus_vec)', annT)
  stat('snippets (chunks)', snipT)
  const tot = embedT.concat().map((_, i) => embedT[i] + annT[i] + snipT[i])
  const share = (xs: number[]) => Math.round((xs.reduce((a, b) => a + b, 0) / tot.reduce((a, b) => a + b, 0)) * 100)
  console.log(`\n[probe] share of total: embed ${share(embedT)}%  ANN ${share(annT)}%  snippets ${share(snipT)}%`)
}

main().catch((e) => { console.error('[probe] FATAL', e); process.exit(1) })
