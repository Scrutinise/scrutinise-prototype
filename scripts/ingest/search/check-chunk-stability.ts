/**
 * check-chunk-stability.ts — does raising MAX_CHUNKS leave the EXISTING chunks
 * byte-identical, so the fix is an incremental top-up rather than a full re-embed?
 *
 * THE CLAIM UNDER TEST (Charlie's addendum, 7 Aug 2026): raising MAX_CHUNKS while leaving
 * chunk SIZE and OVERLAP unchanged should mean chunks 0-7 of every section stay
 * byte-identical, so their existing vectors remain valid and only chunks 8+ need
 * embedding.
 *
 * WHY IT IS TESTED AGAINST THE STORED CHUNKS, not against a re-run of chunkBody().
 * Re-running chunkBody() at two caps and diffing would only prove the function is
 * internally consistent TODAY. It would not catch the thing that would actually invalidate
 * the claim: that the INPUT has drifted since the index was built. Comparing against what
 * is really sitting in `corpus_chunks` catches every drift source at once —
 *   - a changed R2 body,
 *   - a changed `LegislationItem.title` (the citation header is prepended BEFORE chunking,
 *     so a retitled act shifts every boundary in that section),
 *   - a changed chunker,
 * — because any of them shows up as a mismatch against the bytes that were stored.
 *
 * A PASS here means: chunks 0-7 as stored are reproducible today, and a higher cap
 * reproduces them exactly and appends. A FAIL tells us which sections cannot be topped up
 * and must be re-embedded whole.
 *
 * Usage:  tsx search/check-chunk-stability.ts [--sample N] [--cap N]
 */
import path from 'path'
import { Pool } from 'pg'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })

import { connectLance } from './lance'
import { CHUNKS_TABLE, chunkId } from './vector-common'
import { tierFor } from './corpus-map'
import { gidFromId, buildCitation, applyCitationToBody } from './citation'
import { chunkBody, MAX_CHUNKS, WHOLE_CHARS, WINDOW_CHARS, OVERLAP_CHARS } from './chunk'
import { r2Get } from '../shared/r2-client'

export {}

const arg = (name: string, dflt: number) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? parseInt(process.argv[i + 1], 10) : dflt
}
const SAMPLE = arg('--sample', 150)
const HIGH_CAP = arg('--cap', 64)

async function mapPool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    for (;;) { const k = i++; if (k >= items.length) return; out[k] = await fn(items[k]) }
  }))
  return out
}

async function main() {
  console.log(`chunker config: WHOLE=${WHOLE_CHARS} WINDOW=${WINDOW_CHARS} OVERLAP=${OVERLAP_CHARS} MAX_CHUNKS=${MAX_CHUNKS}`)
  console.log(`testing against a raised cap of ${HIGH_CAP}\n`)

  const url = process.env.NEON_DATABASE_URL
  if (!url) throw new Error('NEON_DATABASE_URL not set')
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 2, statement_timeout: 300_000 })

  // Sample deliberately spans the boundary: sections big enough to be TRUNCATED (the ones
  // the top-up would touch) and sections small enough not to be (the control — if these
  // mismatch, the drift is not about the cap at all).
  const TRUNC_WORDS = 3400 // ≈ the 8-chunk cap, ~22,240 chars at 6.3 chars/word
  const { rows: big } = await pool.query<{ id: string; corpus: string; sectionTitle: string | null; r2Key: string | null; wordCount: number }>(
    `SELECT id, corpus, "sectionTitle", "r2Key", "wordCount" FROM corpus_sections
     WHERE status='compiled' AND "r2Key" IS NOT NULL AND "wordCount" > $1
     ORDER BY md5(id) LIMIT $2`, [TRUNC_WORDS, SAMPLE])
  const { rows: small } = await pool.query<{ id: string; corpus: string; sectionTitle: string | null; r2Key: string | null; wordCount: number }>(
    `SELECT id, corpus, "sectionTitle", "r2Key", "wordCount" FROM corpus_sections
     WHERE status='compiled' AND "r2Key" IS NOT NULL AND "wordCount" BETWEEN 100 AND $1
     ORDER BY md5(id) LIMIT $2`, [TRUNC_WORDS, Math.floor(SAMPLE / 2)])
  const rows = [...big, ...small]
  console.log(`sampled ${big.length} likely-truncated (>${TRUNC_WORDS} words) + ${small.length} control sections`)

  // citation title map, exactly as build-corpus-chunks.ts builds it
  const titleMap = new Map<string, string>()
  {
    const { rows: t } = await pool.query<{ gid: string; title: string }>(
      `SELECT "legislationGovUkId" AS gid, title FROM "LegislationItem" WHERE "legislationGovUkId" IS NOT NULL AND title IS NOT NULL`)
    for (const r of t) titleMap.set(r.gid, r.title)
  }
  console.log(`citation title map: ${titleMap.size} gid→title`)

  // ONE scan of corpus_chunks for the whole sample (the table has no index on sectionId —
  // an IN-list of 225 costs the same single full scan as an IN-list of 1).
  const conn = await connectLance()
  const chunksTbl = await conn.openTable(CHUNKS_TABLE)
  const sql = (s: string) => `'${s.replace(/'/g, "''")}'`
  console.log('reading stored chunks (one full scan of corpus_chunks)…')
  const tScan = Date.now()
  const stored = await chunksTbl.query()
    .where(`sectionId IN (${rows.map((r) => sql(r.id)).join(',')})`)
    .select(['chunkId', 'sectionId', 'body'])
    .limit(rows.length * (HIGH_CAP + 4))
    .toArray() as Array<{ chunkId: string; sectionId: string; body: string }>
  console.log(`  ${stored.length} stored chunks in ${Date.now() - tScan}ms\n`)

  const bySection = new Map<string, Map<number, string>>()
  for (const c of stored) {
    const k = parseInt(c.chunkId.slice(c.chunkId.lastIndexOf('#') + 1), 10)
    if (!bySection.has(c.sectionId)) bySection.set(c.sectionId, new Map())
    bySection.get(c.sectionId)!.set(k, c.body)
  }

  console.log('fetching bodies from R2…')
  const bodies = await mapPool(rows, 24, async (r) => (r.r2Key ? r2Get(r.r2Key).catch(() => null) : null))

  let compared = 0, identical = 0, mismatched = 0, noStored = 0, noBody = 0, copyFidelityChecks = 0
  let truncatedSections = 0, existingChunks = 0, newChunks = 0
  let newChars = 0
  const mismatchExamples: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const rawBody = bodies[i]
    if (rawBody == null || !rawBody.trim()) { noBody++; continue }
    const have = bySection.get(r.id)
    if (!have || have.size === 0) { noStored++; continue }

    // Reproduce build-corpus-chunks.ts's body pipeline EXACTLY.
    const tier = tierFor(r.corpus)
    let body = rawBody
    if (tier === 'legislation') {
      const gid = gidFromId(r.id)
      const cit = buildCitation(r.id, gid ? titleMap.get(gid) ?? null : null, r.sectionTitle)
      if (cit) body = applyCitationToBody(cit.bodyHeader, body)
    }

    const atCurrentCap = chunkBody(body)                       // MAX_CHUNKS as configured (8)
    const atHighCap = chunkBodyWithCap(body, HIGH_CAP)         // the raised cap

    // Fidelity guard: chunkBodyWithCap is a copy of chunk.ts's algorithm with the cap
    // lifted to a parameter. If the copy has drifted, every result below is worthless —
    // so prove the copy agrees with the real chunker at the real cap, on real input,
    // before trusting it at any other cap.
    const copyAtSameCap = chunkBodyWithCap(body, MAX_CHUNKS)
    if (copyAtSameCap.length !== atCurrentCap.length || copyAtSameCap.some((c, k) => c !== atCurrentCap[k])) {
      console.error(`FATAL: chunkBodyWithCap has drifted from chunk.ts on ${r.id} — the test harness is wrong, not the corpus.`)
      process.exit(2)
    }
    copyFidelityChecks++

    // (1) Do the first N chunks at the RAISED cap match the CURRENT cap's output?
    const prefixStable = atCurrentCap.every((c, k) => atHighCap[k] === c)
    // (2) Do they match what is actually STORED? This is the claim that matters.
    let sectionIdentical = true
    for (let k = 0; k < atCurrentCap.length; k++) {
      const s = have.get(k)
      if (s === undefined) continue // not stored (partial write) — not a mismatch of content
      compared++
      if (s === atHighCap[k]) identical++
      else {
        mismatched++; sectionIdentical = false
        if (mismatchExamples.length < 5) {
          mismatchExamples.push(`${chunkId(r.id, k)} (corpus=${r.corpus}, tier=${tier}) stored ${s.length}ch vs recomputed ${atHighCap[k]?.length ?? 0}ch`)
        }
      }
    }

    if (!prefixStable && mismatchExamples.length < 8) {
      mismatchExamples.push(`${r.id}: raised cap CHANGED an existing boundary — this would refute the claim outright`)
    }

    if (atCurrentCap.length >= MAX_CHUNKS) {
      truncatedSections++
      existingChunks += atCurrentCap.length
      const extra = atHighCap.slice(atCurrentCap.length)
      newChunks += extra.length
      newChars += extra.reduce((a, c) => a + c.length, 0)
      if (sectionIdentical && extra.length === 0) {
        // exactly at the cap but nothing more to add — fine
      }
    }
  }

  console.log('')
  console.log('── RESULT ──')
  console.log(`sections examined            : ${rows.length}  (no body ${noBody}, no stored chunks ${noStored})`)
  console.log(`harness fidelity checks      : ${copyFidelityChecks} passed (copy agrees with chunk.ts at cap ${MAX_CHUNKS})`)
  console.log(`existing chunks compared     : ${compared}`)
  console.log(`  byte-identical at cap ${String(HIGH_CAP).padEnd(3)}  : ${identical}`)
  console.log(`  MISMATCHED                 : ${mismatched}`)
  if (mismatchExamples.length) {
    console.log('  examples:')
    for (const m of mismatchExamples) console.log(`    - ${m}`)
  }
  console.log('')
  console.log(`truncated sections in sample : ${truncatedSections}`)
  console.log(`  chunks they have now       : ${existingChunks}`)
  console.log(`  chunks a cap of ${HIGH_CAP} adds   : ${newChunks}  (${newChars.toLocaleString()} chars)`)
  console.log(`  → ratio new:existing       : ${existingChunks ? (newChunks / existingChunks).toFixed(2) : 'n/a'}`)
  console.log('')
  console.log(mismatched === 0
    ? '✅ CLAIM CONFIRMED on this sample: raising MAX_CHUNKS reproduces every stored chunk byte-for-byte and only APPENDS. An incremental top-up is valid.'
    : `❌ CLAIM REFUTED for ${mismatched} chunk(s): those sections cannot be topped up incrementally and would need re-embedding whole.`)

  await pool.end()
  if (mismatched > 0) process.exitCode = 1
}

/** chunkBody with an explicit cap — same algorithm, cap as a parameter rather than a
 *  module constant, so both caps can be exercised in ONE process. Kept in lockstep with
 *  chunk.ts by the identity assertion in the caller (at cap=MAX_CHUNKS it must agree). */
function chunkBodyWithCap(raw: string, cap: number): string[] {
  const text = (raw ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return []
  if (text.length <= WHOLE_CHARS) return [text]
  const out: string[] = []
  let start = 0
  while (start < text.length && out.length < cap) {
    let end = Math.min(start + WINDOW_CHARS, text.length)
    if (end < text.length) {
      const sp = text.indexOf(' ', end)
      if (sp !== -1 && sp - end < 200) end = sp
    }
    out.push(text.slice(start, end).trim())
    if (end >= text.length) break
    start = end - OVERLAP_CHARS
  }
  return out
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
