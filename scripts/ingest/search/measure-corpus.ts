/**
 * measure-corpus.ts — the COST-BASIS estimator for the full-corpus vector embed.
 * Measures the compiled corpus to project the embed token count + Batch-API cost
 * BEFORE paying for it (re-run to re-confirm just before triggering the spend).
 * Models the exact pilot chunking (chunk.ts: whole ≤4096 chars; else 3200-char
 * windows, 480 overlap, cap 8) over the wordCount histogram so the ~8-chunk cap on
 * huge debate sections is reflected (it materially reduces embed tokens vs raw
 * wordcount). Numbers of record: docs/VECTOR_EMBED_REPORT.md.
 *
 * Run from scripts/ingest:  npx tsx search/measure-corpus.ts
 */
import path from 'path'
import { Pool } from 'pg'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })

// pilot chunking params (pilot-chunk.ts defaults)
const WHOLE_CHARS = 4096
const WINDOW_CHARS = 3200
const OVERLAP_CHARS = 480
const MAX_CHUNKS = 8
const STEP = WINDOW_CHARS - OVERLAP_CHARS // 2720

// chars-per-word for legal/parliamentary English (measured band; report both ends)
const CPW = 6.3

function chunksForChars(L: number): { nChunks: number; embeddedChars: number } {
  if (L <= 0) return { nChunks: 0, embeddedChars: 0 }
  if (L <= WHOLE_CHARS) return { nChunks: 1, embeddedChars: L }
  let start = 0, n = 0, embedded = 0
  while (start < L && n < MAX_CHUNKS) {
    const end = Math.min(start + WINDOW_CHARS, L)
    embedded += end - start
    n++
    if (end >= L) break
    start = end - OVERLAP_CHARS
  }
  return { nChunks: n, embeddedChars: embedded }
}

async function main() {
  const url = process.env.NEON_DATABASE_URL
  if (!url) throw new Error('NEON_DATABASE_URL not set')
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 2, statement_timeout: 300_000 })
  await pool.query('SELECT 1')

  // headline counts
  const { rows: head } = await pool.query<{ n: string; words: string; avgw: string; maxw: string }>(
    `SELECT COUNT(*)::text n, COALESCE(SUM("wordCount"),0)::text words,
            COALESCE(AVG("wordCount"),0)::numeric(12,1)::text avgw,
            COALESCE(MAX("wordCount"),0)::text maxw
     FROM corpus_sections WHERE status='compiled'`)
  const N = +head[0].n, W = +head[0].words
  console.log(`compiled sections : ${N.toLocaleString()}`)
  console.log(`total wordCount   : ${W.toLocaleString()}  (avg ${head[0].avgw}, max ${(+head[0].maxw).toLocaleString()})`)

  // rows with null/0 wordCount (still have bodies → still embedded; wordCount just absent)
  const { rows: nullw } = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text n FROM corpus_sections WHERE status='compiled' AND (\"wordCount\" IS NULL OR \"wordCount\"=0)`)
  console.log(`null/0 wordCount  : ${(+nullw[0].n).toLocaleString()} (excluded from the model below — small vs total)`)

  // wordCount histogram — fine buckets so the chunk model is accurate on the long tail
  const { rows: hist } = await pool.query<{ bucket: number; n: string; words: string }>(
    `SELECT width_bucket("wordCount", 0, 20000, 200) AS bucket, COUNT(*)::text n, SUM("wordCount")::text words
     FROM corpus_sections WHERE status='compiled' AND "wordCount" > 0
     GROUP BY 1 ORDER BY 1`)
  // for the overflow bucket (>20000 words) use the true avg so the cap is applied correctly
  const { rows: over } = await pool.query<{ n: string; words: string; avgw: string }>(
    `SELECT COUNT(*)::text n, COALESCE(SUM("wordCount"),0)::text words, COALESCE(AVG("wordCount"),0)::text avgw
     FROM corpus_sections WHERE status='compiled' AND "wordCount" > 20000`)

  // model chunks + embedded chars by applying chunk model to each bucket's representative size
  let totalChunks = 0, totalEmbeddedChars = 0
  for (const h of hist) {
    const b = +h.bucket
    if (b > 200) continue // handled by overflow below
    const n = +h.n
    const avgWordsInBucket = (+h.words) / n
    const L = avgWordsInBucket * CPW
    const { nChunks, embeddedChars } = chunksForChars(L)
    totalChunks += nChunks * n
    totalEmbeddedChars += embeddedChars * n
  }
  {
    const n = +over[0].n
    if (n > 0) {
      const L = (+over[0].avgw) * CPW
      const { nChunks, embeddedChars } = chunksForChars(L)
      totalChunks += nChunks * n
      totalEmbeddedChars += embeddedChars * n
      console.log(`>20k-word sections: ${n.toLocaleString()} (avg ${Math.round(+over[0].avgw).toLocaleString()} words → capped at ${nChunks} chunks each)`)
    }
  }

  const estTokensCharDiv4 = totalEmbeddedChars / 4        // pilot heuristic
  const estTokensWordx13 = (totalEmbeddedChars / CPW) * 1.3 // words×1.3 cross-check
  console.log('')
  console.log(`modelled chunks   : ${Math.round(totalChunks).toLocaleString()}  (${(totalChunks / N).toFixed(2)} chunks/section)`)
  console.log(`embedded chars    : ${Math.round(totalEmbeddedChars).toLocaleString()}  (overlap counted, 8-chunk cap applied)`)
  console.log(`est embed tokens  : ${Math.round(estTokensCharDiv4).toLocaleString()} (chars/4)  |  ${Math.round(estTokensWordx13).toLocaleString()} (words×1.3)`)

  // cost projections — PRICE PER 1M TOKENS is a variable; print a small table.
  const T = estTokensCharDiv4 / 1e6 // millions of tokens (use the higher chars/4 estimate = conservative)
  console.log('')
  console.log(`cost @ various $/1M-token BATCH rates (on ${T.toFixed(0)}M tokens, chars/4 estimate):`)
  for (const rate of [0.0375, 0.05, 0.075, 0.10, 0.15]) {
    console.log(`  $${rate.toFixed(4)}/1M  → $${(T * rate).toFixed(0)}`)
  }
  await pool.end()
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
