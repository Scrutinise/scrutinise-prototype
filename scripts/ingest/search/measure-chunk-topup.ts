/**
 * measure-chunk-topup.ts — the TRUE INCREMENTAL cost of raising MAX_CHUNKS.
 *
 * Charlie's addendum (7 Aug 2026) challenges a "~$600 full re-embed" figure: if chunk SIZE
 * and OVERLAP are unchanged, chunks 0-7 stay byte-identical and only chunks 8+ of the
 * truncated sections need embedding. `check-chunk-stability.ts` confirms the byte-identity
 * against the chunks actually stored in corpus_vec's manifest. This script prices what is
 * left over.
 *
 * METHOD — and its one modelling assumption, stated up front. It reuses
 * measure-corpus.ts's basis: the real `wordCount` histogram from Neon (fine buckets, plus
 * a true-average overflow bucket for the long tail), with words converted to characters at
 * CPW chars/word, because the chunker is character-based and corpus_sections stores words.
 * CPW is the ONE assumption, so this script does not inherit measure-corpus.ts's hardcoded
 * 6.3 — it MEASURES CPW from real bodies (--calibrate) and reports the cost across a band
 * so the answer is not hostage to a single constant.
 *
 * It prices the DELTA only:
 *     new chunks    = chunks(cap=NEW) - chunks(cap=8)
 *     new chars     = embedded_chars(cap=NEW) - embedded_chars(cap=8)
 * Existing vectors are untouched, so existing chars are NOT re-paid.
 *
 * Usage:
 *   tsx search/measure-chunk-topup.ts                 # model only
 *   tsx search/measure-chunk-topup.ts --calibrate 400 # measure CPW from 400 real bodies first
 */
import path from 'path'
import { Pool } from 'pg'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })

import { WHOLE_CHARS, WINDOW_CHARS, OVERLAP_CHARS, MAX_CHUNKS } from './chunk'
import { r2Get } from '../shared/r2-client'

export {}

const CAPS = (process.env.TOPUP_CAPS ?? '8,12,16,24,32,64,0').split(',').map((s) => parseInt(s.trim(), 10)) // 0 = uncapped
const CALIBRATE = (() => { const i = process.argv.indexOf('--calibrate'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : 0 })()
const BATCH_RATE = parseFloat(process.env.EMBED_RATE_PER_M ?? '0.075') // Gemini Batch API $/1M tokens
const SYNC_RATE = BATCH_RATE * 2

/** The chunker's geometry, counting CHUNKS and EMBEDDED CHARS (overlap counted, since
 *  overlapping text is embedded twice and is therefore paid for twice). cap 0 = uncapped. */
function model(L: number, cap: number): { nChunks: number; embeddedChars: number } {
  if (L <= 0) return { nChunks: 0, embeddedChars: 0 }
  if (L <= WHOLE_CHARS) return { nChunks: 1, embeddedChars: L }
  let start = 0, n = 0, embedded = 0
  while (start < L && (cap === 0 || n < cap)) {
    const end = Math.min(start + WINDOW_CHARS, L)
    embedded += end - start
    n++
    if (end >= L) break
    start = end - OVERLAP_CHARS
  }
  return { nChunks: n, embeddedChars: embedded }
}

async function mapPool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    for (;;) { const k = i++; if (k >= items.length) return; out[k] = await fn(items[k]) }
  }))
  return out
}

async function calibrateCPW(pool: Pool, n: number): Promise<{ cpw: number; p10: number; p90: number; sampled: number }> {
  // Sample across the size range — CPW is not constant, and the long sections are the ones
  // that drive this cost, so a sample skewed to short rows would mis-price the answer.
  const { rows } = await pool.query<{ r2Key: string; wordCount: number }>(
    `SELECT "r2Key", "wordCount" FROM corpus_sections
     WHERE status='compiled' AND "r2Key" IS NOT NULL AND "wordCount" > 2000
     ORDER BY md5(id) LIMIT $1`, [n])
  const bodies = await mapPool(rows, 24, async (r) => r2Get(r.r2Key).catch(() => null))
  const ratios: number[] = []
  let totChars = 0, totWords = 0
  for (let i = 0; i < rows.length; i++) {
    const b = bodies[i]
    if (!b) continue
    // Normalise exactly as chunkBody does before measuring — whitespace collapse changes
    // the character count, and it is the POST-normalisation length the chunker sees.
    const text = b.replace(/\s+/g, ' ').trim()
    if (!text || !rows[i].wordCount) continue
    ratios.push(text.length / rows[i].wordCount)
    totChars += text.length; totWords += rows[i].wordCount
  }
  ratios.sort((a, b) => a - b)
  return {
    cpw: totChars / totWords, // aggregate ratio (chars-weighted) — the right one for a total
    p10: ratios[Math.floor(ratios.length * 0.1)],
    p90: ratios[Math.floor(ratios.length * 0.9)],
    sampled: ratios.length,
  }
}

async function main() {
  const url = process.env.NEON_DATABASE_URL
  if (!url) throw new Error('NEON_DATABASE_URL not set')
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 2, statement_timeout: 300_000 })

  let CPW = 6.3, band: [number, number] = [5.8, 6.8]
  if (CALIBRATE > 0) {
    console.log(`calibrating chars-per-word from ${CALIBRATE} real bodies…`)
    const c = await calibrateCPW(pool, CALIBRATE)
    CPW = c.cpw; band = [c.p10, c.p90]
    console.log(`  measured CPW = ${CPW.toFixed(2)} (p10 ${c.p10.toFixed(2)}, p90 ${c.p90.toFixed(2)}, n=${c.sampled})`)
    console.log(`  (measure-corpus.ts assumes 6.30 — ${Math.abs(CPW - 6.3) / 6.3 < 0.05 ? 'consistent' : 'DIFFERENT, and the cost below moves with it'})\n`)
  } else {
    console.log(`using measure-corpus.ts's assumed CPW = 6.30 (run with --calibrate N to measure it)\n`)
  }

  const { rows: hist } = await pool.query<{ bucket: number; n: string; words: string }>(
    `SELECT width_bucket("wordCount", 0, 20000, 200) AS bucket, COUNT(*)::text n, SUM("wordCount")::text words
     FROM corpus_sections WHERE status='compiled' AND "wordCount" > 0 GROUP BY 1 ORDER BY 1`)
  // The >20k tail is where truncation bites hardest, so model it in finer strata than
  // measure-corpus.ts's single average bucket — one average over a heavy tail would
  // badly misprice exactly the sections this exercise is about.
  const { rows: tail } = await pool.query<{ lo: number; n: string; words: string }>(
    `SELECT CASE
        WHEN "wordCount" < 40000 THEN 20000 WHEN "wordCount" < 80000 THEN 40000
        WHEN "wordCount" < 160000 THEN 80000 WHEN "wordCount" < 320000 THEN 160000
        ELSE 320000 END AS lo,
       COUNT(*)::text n, SUM("wordCount")::text words
     FROM corpus_sections WHERE status='compiled' AND "wordCount" >= 20000 GROUP BY 1 ORDER BY 1`)

  type Strat = { n: number; avgWords: number }
  const strata: Strat[] = []
  for (const h of hist) { const b = +h.bucket; if (b > 200) continue; const n = +h.n; strata.push({ n, avgWords: (+h.words) / n }) }
  for (const t of tail) { const n = +t.n; strata.push({ n, avgWords: (+t.words) / n }) }
  console.log(`tail strata (>=20k words): ${tail.map((t) => `${(+t.n).toLocaleString()}@~${Math.round((+t.words) / (+t.n)).toLocaleString()}w`).join(', ')}\n`)

  function totalsAt(cap: number, cpw: number) {
    let chunks = 0, chars = 0, truncated = 0
    for (const s of strata) {
      const L = s.avgWords * cpw
      const m = model(L, cap)
      chunks += m.nChunks * s.n
      chars += m.embeddedChars * s.n
      // "truncated" = the uncapped model would produce more chunks than this cap allows
      if (cap !== 0 && model(L, 0).nChunks > cap) truncated += s.n
    }
    return { chunks, chars, truncated }
  }

  const base = totalsAt(MAX_CHUNKS, CPW)
  console.log(`CURRENT STATE (cap ${MAX_CHUNKS}):`)
  console.log(`  chunks in index      : ${Math.round(base.chunks).toLocaleString()}`)
  console.log(`  embedded chars       : ${Math.round(base.chars).toLocaleString()}`)
  console.log(`  sections truncated   : ${Math.round(base.truncated).toLocaleString()}`)
  const uncapped = totalsAt(0, CPW)
  console.log(`  body chars in corpus : ${Math.round(uncapped.chars).toLocaleString()} → ${(base.chars / uncapped.chars * 100).toFixed(1)}% of the corpus is embedded\n`)

  console.log('INCREMENTAL TOP-UP — cost of embedding ONLY the chunks that do not exist yet:')
  console.log('')
  console.log('  cap  |  total chunks  |   NEW chunks  |    NEW tokens  | still trunc |  BATCH $  |   SYNC $')
  console.log('  -----+----------------+---------------+----------------+-------------+-----------+---------')
  const results: any[] = []
  for (const cap of CAPS) {
    if (cap === MAX_CHUNKS) continue
    const t = totalsAt(cap, CPW)
    const newChunks = t.chunks - base.chunks
    const newChars = t.chars - base.chars
    const newTokens = newChars / 4 // same chars/4 basis as measure-corpus.ts (a slight over-estimate)
    const label = cap === 0 ? 'none' : String(cap)
    console.log(
      `  ${label.padStart(4)} | ${Math.round(t.chunks).toLocaleString().padStart(14)} | ${Math.round(newChunks).toLocaleString().padStart(13)} | ` +
      `${Math.round(newTokens).toLocaleString().padStart(14)} | ${Math.round(t.truncated).toLocaleString().padStart(11)} | ` +
      `$${(newTokens / 1e6 * BATCH_RATE).toFixed(2).padStart(8)} | $${(newTokens / 1e6 * SYNC_RATE).toFixed(2).padStart(7)}`)
    results.push({ cap, totalChunks: Math.round(t.chunks), newChunks: Math.round(newChunks), newTokens: Math.round(newTokens), batchUsd: +(newTokens / 1e6 * BATCH_RATE).toFixed(2) })
  }

  // The counterfactual the addendum is challenging.
  const fullReEmbedTokens = uncapped.chars / 4
  console.log('')
  console.log(`FOR CONTRAST — a FULL re-embed of everything at no cap would be`)
  console.log(`  ${Math.round(fullReEmbedTokens).toLocaleString()} tokens = $${(fullReEmbedTokens / 1e6 * BATCH_RATE).toFixed(2)} batch / $${(fullReEmbedTokens / 1e6 * SYNC_RATE).toFixed(2)} sync`)
  console.log(`  — and it would re-pay for ${Math.round(base.chars / 4).toLocaleString()} tokens of vectors that already exist and are still valid.`)

  // Sensitivity: the whole model rides on CPW, so show the band rather than hide it.
  console.log('')
  console.log(`SENSITIVITY to chars-per-word (the one modelling assumption):`)
  for (const cpw of [band[0], CPW, band[1]]) {
    const t = totalsAt(32, cpw), b = totalsAt(MAX_CHUNKS, cpw)
    const tok = (t.chars - b.chars) / 4
    console.log(`  CPW ${cpw.toFixed(2)} → cap-32 top-up = ${Math.round(tok).toLocaleString()} tokens = $${(tok / 1e6 * BATCH_RATE).toFixed(2)} batch`)
  }

  console.log('')
  console.log(JSON.stringify({ cpw: +CPW.toFixed(3), baseChunks: Math.round(base.chunks), results }))
  await pool.end()
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
