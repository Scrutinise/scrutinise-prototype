/**
 * v33-vec-delta.ts — V33 §2: exactly which `corpus_sections` rows have no vector, what it costs
 * to embed them, and the work list for the catch-up. **Read-only. Spends nothing.**
 *
 * The served vector index is the 21 Jul build (21,839,900 vectors). Everything added since is
 * unembedded: the V32 §1 committee rechunk, the V32 §2 archive backfill, the treaty extension,
 * the V33 §1 re-sectioning and the V33 §5 backlog. Vector serves nobody today (`VECTOR_SEARCH_URL`
 * is unset), but it has to be current before the flip or dense retrieval is blind to everything
 * since July.
 *
 * WHY A SEPARATE SCRIPT AND NOT `build-vector-index.ts`. That script shards `corpus_chunks`
 * sorted by `chunkId` and records DONE shard INDICES in its checkpoint — it states, and relies
 * on, `corpus_chunks` being immutable after the build. Appending to `corpus_chunks` renumbers
 * every shard boundary, so a resumed run would re-embed the whole 21.8M-chunk corpus. **That is a
 * four-figure mistake, not a slow one.** The delta therefore gets its own path, exactly as
 * `fts-catchup.ts` exists beside `build-fts-index.ts` for the same reason on the keyword side.
 *
 * THE COST MODEL, and its one assumption. Chunk count and embedded characters come from the real
 * chunker's geometry (`chunk.ts` constants), applied to each section's real `wordCount`. The one
 * modelled step is words→characters, so CPW is MEASURED from real bodies (`--calibrate N`) rather
 * than assumed, and the cost is reported across a CPW band so the answer is not hostage to one
 * constant. Overlap is counted: overlapping text is embedded twice and therefore paid for twice.
 *
 * ⚠ IT OVERWRITES `docs/v33_vec_delta.json` EVERY RUN, and the before/after runs are not versions
 * of one measurement — they are two different facts. The 9 Aug run is the PREDICTION the CHANGE_LOG
 * scores against (544,198 unvectored, 740,385 chunks, $35.73); the 11 Aug re-run is the ACCEPTANCE
 * measurement (227 unvectored, 0 chunks). Re-running post-embed silently replaced the first with
 * the second and left the repo asserting a number that had stopped being true. The acceptance copy
 * is kept as `docs/v33_vec_delta_acceptance.json`; if you re-run this, save the output under a
 * distinct name rather than letting it clobber a prediction someone is still scoring.
 *
 * Usage:
 *   tsx v33-vec-delta.ts --calibrate 300            # measure CPW, then report the delta + cost
 *   tsx v33-vec-delta.ts --calibrate 300 --write    # + write the work list for the catch-up
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import fs from 'fs'
import { Pool } from 'pg'
import { connectLance } from './search/lance'
import { VEC_TABLE, CHUNKS_TABLE } from './search/vector-common'
import { WHOLE_CHARS, WINDOW_CHARS, OVERLAP_CHARS, MAX_CHUNKS } from './search/chunk'
import { tierFor } from './search/corpus-map'
import { r2Get } from './shared/r2-client'

export {}

const CALIBRATE = (() => { const i = process.argv.indexOf('--calibrate'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : 0 })()
const WRITE = process.argv.includes('--write')
const OUT = path.join(__dirname, 'v33-vec-delta.jsonl')
const REPORT = path.join(__dirname, '../../docs/v33_vec_delta.json')
/** Gemini Batch API, gemini-embedding-001 @768-d. Sync is 2x. */
const BATCH_RATE = parseFloat(process.env.EMBED_RATE_PER_M ?? '0.075')
const n = (v: number) => Number(v).toLocaleString('en-GB')

/** The chunker's geometry: chunks emitted and characters actually embedded (overlap counted). */
function model(chars: number): { chunks: number; embeddedChars: number } {
  if (chars <= 0) return { chunks: 0, embeddedChars: 0 }
  if (chars <= WHOLE_CHARS) return { chunks: 1, embeddedChars: chars }
  let start = 0, k = 0, embedded = 0
  while (start < chars && k < MAX_CHUNKS) {
    const end = Math.min(start + WINDOW_CHARS, chars)
    embedded += end - start
    k++
    if (end >= chars) break
    start = end - OVERLAP_CHARS
  }
  return { chunks: k, embeddedChars: embedded }
}

async function calibrateCpw(p: Pool, sample: number): Promise<number> {
  const { rows } = await p.query<{ r2Key: string; wordCount: number }>(
    `SELECT "r2Key", "wordCount" FROM corpus_sections
      WHERE status='compiled' AND "r2Key" IS NOT NULL AND "wordCount" > 200
      ORDER BY md5(id) LIMIT $1`, [sample])
  let chars = 0, words = 0, got = 0
  const conc = 24
  let i = 0
  await Promise.all(Array.from({ length: conc }, async () => {
    for (;;) {
      const k = i++; if (k >= rows.length) return
      const b = await r2Get(rows[k].r2Key)
      if (!b || !rows[k].wordCount) continue
      chars += b.replace(/\s+/g, ' ').trim().length
      words += rows[k].wordCount
      got++
    }
  }))
  console.log(`  CPW measured on ${got} real bodies: ${(chars / words).toFixed(3)}`)
  return words ? chars / words : 6.05
}

async function main() {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 4, statement_timeout: 1_800_000 })
  const conn = await connectLance()
  const vec = await conn.openTable(VEC_TABLE)
  const chunks = await conn.openTable(CHUNKS_TABLE)
  console.log(`${VEC_TABLE}=${n(await vec.countRows())} rows   ${CHUNKS_TABLE}=${n(await chunks.countRows())} rows`)
  console.log(`chunker: WHOLE=${WHOLE_CHARS} WINDOW=${WINDOW_CHARS} OVERLAP=${OVERLAP_CHARS} MAX_CHUNKS=${MAX_CHUNKS}\n`)

  const CPW = CALIBRATE ? await calibrateCpw(pool, CALIBRATE) : parseFloat(process.env.DELTA_CPW ?? '6.05')
  console.log(`  chars/word in use: ${CPW.toFixed(3)}${CALIBRATE ? '' : ' (default — pass --calibrate N to measure)'}\n`)

  const { rows: corpora } = await pool.query<{ corpus: string }>(
    `SELECT DISTINCT corpus FROM corpus_sections WHERE status='compiled' ORDER BY corpus`)

  type Row = { corpus: string; tier: string; sections: number; missing: number; words: number; chunks: number; embChars: number }
  const per: Row[] = []
  let out: fs.WriteStream | null = WRITE ? fs.createWriteStream(OUT) : null
  let grandMissing = 0, grandWords = 0, grandChunks = 0, grandEmb = 0, grandSections = 0

  for (const { corpus } of corpora) {
    const { rows: secs } = await pool.query<{ id: string; wordCount: number }>(
      `SELECT id, coalesce("wordCount",0)::int AS "wordCount" FROM corpus_sections
        WHERE corpus=$1 AND status='compiled'`, [corpus])
    grandSections += secs.length
    if (secs.length === 0) continue

    // sectionIds already carrying at least one vector
    const arrow = await vec.query().where(`corpus = '${corpus.replace(/'/g, "''")}'`).select(['sectionId']).toArrow()
    const vectored = new Set<string>()
    if (arrow.numRows) {
      const col = arrow.getChild('sectionId')!
      for (let i = 0; i < arrow.numRows; i++) vectored.add(col.get(i) as string)
    }

    let missing = 0, words = 0, nChunks = 0, embChars = 0
    for (const s of secs) {
      if (vectored.has(s.id)) continue
      missing++
      words += s.wordCount
      const m = model(Math.round(s.wordCount * CPW))
      nChunks += m.chunks; embChars += m.embeddedChars
      out?.write(JSON.stringify({ id: s.id, corpus, wordCount: s.wordCount }) + '\n')
    }
    if (missing) {
      per.push({ corpus, tier: tierFor(corpus), sections: secs.length, missing, words, chunks: nChunks, embChars })
      grandMissing += missing; grandWords += words; grandChunks += nChunks; grandEmb += embChars
      console.log(`  ${corpus.padEnd(28)} ${n(missing).padStart(9)} of ${n(secs.length).padStart(9)} sections unvectored  ${n(words).padStart(12)} words  → ${n(nChunks).padStart(9)} chunks`)
    }
  }
  if (out) await new Promise<void>((r) => out!.end(r))

  // Cost. estTokens() is chars/4 — the same conservative basis gemini-batch.ts packs on, a slight
  // OVER-estimate for legal English at ~4.3 chars/token, so the budget errs safe.
  const tokens = Math.ceil(grandEmb / 4)
  const cost = (tokens / 1e6) * BATCH_RATE
  // And across a CPW band, because CPW is the one modelled step.
  const band = [CPW * 0.9, CPW, CPW * 1.1].map((c) => {
    let t = 0
    for (const r of per) t += Math.round((r.embChars * c) / CPW)
    return { cpw: c, cost: (Math.ceil(t / 4) / 1e6) * BATCH_RATE }
  })

  console.log('\n═══ DELTA ═══════════════════════════════════════════════════════════════════')
  console.log(`  compiled sections            ${n(grandSections)}`)
  console.log(`  WITH a vector                ${n(grandSections - grandMissing)}`)
  console.log(`  ⇒ UNVECTORED (the delta)     ${n(grandMissing)}  (${((100 * grandMissing) / grandSections).toFixed(2)}%)`)
  console.log(`  words to embed               ${n(grandWords)}`)
  console.log(`  chunks to embed              ${n(grandChunks)}`)
  console.log(`  characters embedded          ${n(grandEmb)}  (overlap counted — it is paid for twice)`)
  console.log(`  estimated tokens             ${n(tokens)}  (chars/4, a deliberate over-estimate)`)
  console.log(`\n  ⇒ PREDICTED COST at Batch $${BATCH_RATE}/M:  $${cost.toFixed(2)}`)
  console.log(`     sensitivity to CPW: ${band.map((b) => `${b.cpw.toFixed(2)}→$${b.cost.toFixed(2)}`).join('   ')}`)
  console.log(`     (sync transport would be 2x: $${(cost * 2).toFixed(2)})`)

  console.log('\n  by tier:')
  const byTier = new Map<string, { missing: number; chunks: number; embChars: number }>()
  for (const r of per) {
    const t = byTier.get(r.tier) ?? { missing: 0, chunks: 0, embChars: 0 }
    t.missing += r.missing; t.chunks += r.chunks; t.embChars += r.embChars
    byTier.set(r.tier, t)
  }
  for (const [t, v] of [...byTier.entries()].sort((a, b) => b[1].chunks - a[1].chunks)) {
    console.log(`    ${t.padEnd(18)} ${n(v.missing).padStart(9)} sections  ${n(v.chunks).padStart(9)} chunks  $${((Math.ceil(v.embChars / 4) / 1e6) * BATCH_RATE).toFixed(2)}`)
  }

  fs.writeFileSync(REPORT, JSON.stringify({
    measuredAt: new Date().toISOString(), cpw: CPW, rate: BATCH_RATE,
    totals: { compiledSections: grandSections, unvectored: grandMissing, words: grandWords, chunks: grandChunks, embeddedChars: grandEmb, tokens, cost },
    band, perCorpus: per,
  }, null, 2))
  console.log(`\n  report → docs/v33_vec_delta.json${WRITE ? `\n  work list → ${OUT}` : '   (pass --write for the catch-up work list)'}`)

  await pool.end()
}
main().catch((e) => { console.error(e); process.exit(1) })
