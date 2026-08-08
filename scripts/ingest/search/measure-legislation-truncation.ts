/**
 * measure-legislation-truncation.ts — does the MAX_CHUNKS=8 cap materially damage the
 * LEGISLATION tier, i.e. is the chunking fix a hard precondition for flipping vector
 * serving on for legislation first?
 *
 * The corpus-wide figure (V32_COMMITTEES_AUDIT §4: 59.4% of body words reach the vector
 * index, 242,957 sections truncated) is a MODEL over the wordCount histogram at a measured
 * chars-per-word. This script reports the legislation tier two ways so the comparison is
 * like-for-like AND the answer does not rest on the model:
 *
 *   (A) MODEL      — same method as the corpus-wide 59.4%, so the two numbers are comparable.
 *   (B) MEASURED   — every legislation section that could possibly be truncated has its real
 *                    R2 body read and run through the REAL chunkBody. No modelling.
 *
 * Why (B) is affordable here and was not corpus-wide: only ~15k legislation sections are
 * anywhere near the cap, and only the HEAD of each body is needed (the first 8 chunks span
 * ≤ 22,240 chars + snap), so this is a ranged read, not a corpus download.
 *
 * HARNESS FIDELITY. The covered span is computed by an offset-tracking copy of the chunker,
 * which is asserted to reproduce the REAL exported chunkBody byte-for-byte on every single
 * body measured. A mismatch is fatal — the whole point is to measure what the chunker does,
 * not what a second implementation of it does.
 *
 * Read-only: no rows written, no index touched.
 *
 * Usage:
 *   tsx search/measure-legislation-truncation.ts
 *   tsx search/measure-legislation-truncation.ts --calibrate 400   # re-measure CPW first
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })

import { Pool } from 'pg'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import { Agent as HttpsAgent } from 'node:https'
import { WHOLE_CHARS, WINDOW_CHARS, OVERLAP_CHARS, MAX_CHUNKS, chunkBody } from './chunk'
import { countWords } from '../shared/db-metadata'
import { tierFor } from './corpus-map'

export {}

/** The legislation tier, taken from corpus-map.ts rather than hand-listed — the tier is what
 *  `LEX_VECTOR_STREAMS=legislation` actually scopes to, so a hand-list could measure a
 *  different set from the one the flag switches on. */
const LEG_CORPORA_ALL = [
  'primary-acts-pre-2000', 'primary-acts-2000plus', 'si-pre-2010', 'si-2010plus',
  'regional', 'retained-eu', 'eur-lex', 'explanatory-notes', 'explanatory-memoranda',
].filter((c) => tierFor(c) === 'legislation')

/** The brief's narrower framing: "primary + SI + retained EU". Reported separately because
 *  it excludes eur-lex, which turns out to dominate the tier's word count. */
const BRIEF_CORPORA = ['primary-acts-pre-2000', 'primary-acts-2000plus', 'si-pre-2010', 'si-2010plus', 'retained-eu']

/** Rows below this cannot reach the 22,240-char cap unless chars/word exceeds ~14.8, which no
 *  legislation corpus comes close to. Deliberately ~4x the real CPW as a safety margin, and
 *  the margin is asserted at the end rather than assumed. */
const CANDIDATE_MIN_WORDS = parseInt(process.env.TRUNC_MIN_WORDS ?? '1500', 10)
const HEAD_BYTES = parseInt(process.env.TRUNC_HEAD_BYTES ?? '65536', 10)
const CONC = parseInt(process.env.TRUNC_CONCURRENCY ?? '24', 10)
const CALIBRATE = (() => { const i = process.argv.indexOf('--calibrate'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : 0 })()

// ── R2 (ranged) ───────────────────────────────────────────────────────────────
let _s3: S3Client | null = null
function s3(): S3Client {
  if (_s3) return _s3
  _s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
    },
    requestHandler: new NodeHttpHandler({ httpsAgent: new HttpsAgent({ keepAlive: true, maxSockets: 256 }), requestTimeout: 120_000 }),
  })
  return _s3
}
const BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME ?? 'scrutinise-legislation'

async function r2Head(key: string, bytes: number | null): Promise<string | null> {
  try {
    const res = await s3().send(new GetObjectCommand({
      Bucket: BUCKET, Key: key, ...(bytes ? { Range: `bytes=0-${bytes - 1}` } : {}),
    }))
    return (await res.Body?.transformToString()) ?? null
  } catch { return null }
}

// ── the chunker, with offsets ─────────────────────────────────────────────────
/**
 * Byte-identical re-implementation of chunkBody that also returns the END OFFSET of the last
 * chunk — i.e. how far into the normalised text the embedded span reaches. Chunks are
 * contiguous-with-overlap, so the union of chunks 0..n-1 is exactly text.slice(0, endOffset).
 * `assertFidelity` proves this copy against the real exported function on every body.
 */
function chunkWithOffsets(raw: string, cap = MAX_CHUNKS): { chunks: string[]; endOffset: number; normLen: number } {
  const text = (raw ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return { chunks: [], endOffset: 0, normLen: 0 }
  if (text.length <= WHOLE_CHARS) return { chunks: [text], endOffset: text.length, normLen: text.length }
  const out: string[] = []
  let start = 0
  let end = 0
  while (start < text.length && out.length < cap) {
    end = Math.min(start + WINDOW_CHARS, text.length)
    if (end < text.length) {
      const sp = text.indexOf(' ', end)
      if (sp !== -1 && sp - end < 200) end = sp
    }
    out.push(text.slice(start, end).trim())
    if (end >= text.length) break
    start = end - OVERLAP_CHARS
  }
  return { chunks: out, endOffset: end, normLen: text.length }
}

function assertFidelity(raw: string, id: string): void {
  const mine = chunkWithOffsets(raw).chunks
  const real = chunkBody(raw)
  if (mine.length !== real.length) throw new Error(`FIDELITY: ${id} chunk count ${mine.length} != ${real.length}`)
  for (let i = 0; i < real.length; i++) {
    if (mine[i] !== real[i]) throw new Error(`FIDELITY: ${id} chunk ${i} differs from chunk.ts`)
  }
}

async function mapPool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    for (;;) { const k = i++; if (k >= items.length) return; out[k] = await fn(items[k], k) }
  }))
  return out
}

function pool(): Pool {
  const url = process.env.NEON_DATABASE_URL
  if (!url) throw new Error('NEON_DATABASE_URL not set')
  return new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 4, statement_timeout: 1_800_000 })
}

const pct = (a: number, b: number) => b ? `${((100 * a) / b).toFixed(1)}%` : 'n/a'
const n = (v: number | bigint) => Number(v).toLocaleString('en-GB')

// ── (A) the MODEL, matching the corpus-wide method ────────────────────────────
/** Covered span in chars for a body of L chars under the cap (overlap not double counted). */
function coveredChars(L: number, cap = MAX_CHUNKS): number {
  if (L <= WHOLE_CHARS) return L
  return Math.min(L, WINDOW_CHARS + (cap - 1) * (WINDOW_CHARS - OVERLAP_CHARS))
}

async function calibrateCpw(p: Pool, sample: number): Promise<number> {
  const { rows } = await p.query<{ r2Key: string; wordCount: number }>(
    `SELECT "r2Key", "wordCount" FROM corpus_sections
      WHERE corpus = ANY($1) AND status='compiled' AND "r2Key" IS NOT NULL AND "wordCount" > 2000
      ORDER BY md5(id) LIMIT $2`, [LEG_CORPORA_ALL, sample])
  const bodies = await mapPool(rows, CONC, (r) => r2Head(r.r2Key, null))
  let chars = 0, words = 0
  for (let i = 0; i < rows.length; i++) {
    const b = bodies[i]; if (!b || !rows[i].wordCount) continue
    chars += b.replace(/\s+/g, ' ').trim().length
    words += rows[i].wordCount
  }
  return words ? chars / words : 0
}

async function main() {
  const p = pool()
  console.log(`chunker: WHOLE=${WHOLE_CHARS} WINDOW=${WINDOW_CHARS} OVERLAP=${OVERLAP_CHARS} MAX_CHUNKS=${MAX_CHUNKS}`)
  console.log(`covered span at the cap = ${n(coveredChars(1e9))} chars (before word-boundary snap)`)
  console.log(`legislation tier = ${LEG_CORPORA_ALL.join(', ')}\n`)

  const CPW = CALIBRATE ? await calibrateCpw(p, CALIBRATE) : parseFloat(process.env.TRUNC_CPW ?? '6.05')
  console.log(`chars/word in use: ${CPW.toFixed(3)}${CALIBRATE ? ` (measured on ${CALIBRATE} real legislation bodies)` : ' (default — pass --calibrate N to measure)'}`)
  const capWords = coveredChars(1e9) / CPW
  console.log(`=> the cap is ~${capWords.toFixed(0)} words of legislation text\n`)

  // ── tier totals (the denominator) ───────────────────────────────────────────
  const { rows: totals } = await p.query<{ corpus: string; rows: string; words: string }>(
    `SELECT corpus, count(*)::bigint AS rows, coalesce(sum("wordCount"),0)::bigint AS words
       FROM corpus_sections WHERE corpus = ANY($1) AND status='compiled' GROUP BY corpus`, [LEG_CORPORA_ALL])
  const totalWordsBy = new Map(totals.map((t) => [t.corpus, Number(t.words)]))
  const totalRowsBy = new Map(totals.map((t) => [t.corpus, Number(t.rows)]))
  const TIER_WORDS = [...totalWordsBy.values()].reduce((a, b) => a + b, 0)
  const TIER_ROWS = [...totalRowsBy.values()].reduce((a, b) => a + b, 0)

  // ── (A) MODEL over the full histogram ───────────────────────────────────────
  console.log('=== (A) MODEL — same method as the corpus-wide 59.4% ===')
  const { rows: hist } = await p.query<{ corpus: string; wc: number; c: string }>(
    `SELECT corpus, "wordCount" AS wc, count(*)::bigint AS c
       FROM corpus_sections WHERE corpus = ANY($1) AND status='compiled' AND "wordCount" IS NOT NULL
      GROUP BY corpus, "wordCount"`, [LEG_CORPORA_ALL])
  const modelBy = new Map<string, { cov: number; tot: number; trunc: number }>()
  for (const h of hist) {
    const cnt = Number(h.c), L = h.wc * CPW
    const cov = (coveredChars(L) / (L || 1)) * h.wc
    const m = modelBy.get(h.corpus) ?? { cov: 0, tot: 0, trunc: 0 }
    m.cov += cov * cnt; m.tot += h.wc * cnt; if (L > coveredChars(1e9)) m.trunc += cnt
    modelBy.set(h.corpus, m)
  }
  let mCov = 0, mTot = 0, mTrunc = 0
  for (const [c, m] of [...modelBy.entries()].sort((a, b) => b[1].tot - a[1].tot)) {
    mCov += m.cov; mTot += m.tot; mTrunc += m.trunc
    console.log(`  ${c.padEnd(24)} words=${n(m.tot).padStart(12)}  embedded=${pct(m.cov, m.tot).padStart(7)}  truncated=${n(m.trunc).padStart(7)} of ${n(totalRowsBy.get(c) ?? 0)}`)
  }
  console.log(`  ${'LEGISLATION TIER'.padEnd(24)} words=${n(mTot).padStart(12)}  embedded=${pct(mCov, mTot).padStart(7)}  truncated=${n(mTrunc)}`)
  console.log(`  (corpus-wide comparator: 59.4% embedded, 242,957 truncated)\n`)

  // ── (B) MEASURED against real bodies ────────────────────────────────────────
  console.log(`=== (B) MEASURED — real R2 bodies through the real chunkBody ===`)
  const { rows: cands } = await p.query<{ id: string; corpus: string; r2Key: string; wordCount: number }>(
    `SELECT id, corpus, "r2Key", "wordCount" FROM corpus_sections
      WHERE corpus = ANY($1) AND status='compiled' AND "r2Key" IS NOT NULL AND "wordCount" > $2
      ORDER BY id`, [LEG_CORPORA_ALL, CANDIDATE_MIN_WORDS])
  console.log(`candidates (>${n(CANDIDATE_MIN_WORDS)} words): ${n(cands.length)} of ${n(TIER_ROWS)} tier rows`)

  type M = { id: string; corpus: string; wordCount: number; normLen: number; coveredWords: number; truncated: boolean }
  let fetched = 0, missing = 0, refetched = 0, t0 = Date.now()
  const measured = await mapPool(cands, CONC, async (r) => {
    let body = await r2Head(r.r2Key, HEAD_BYTES)
    if (!body) { missing++; return null }
    let { chunks, endOffset, normLen } = chunkWithOffsets(body)
    // The head must contain more normalised text than the cap can span, or "truncated" would
    // be an artefact of the ranged read rather than a fact about the body. Re-read in full if not.
    if (chunks.length >= MAX_CHUNKS && normLen < coveredChars(1e9) + 400) {
      const full = await r2Head(r.r2Key, null)
      if (full) { body = full; refetched++; ({ chunks, endOffset, normLen } = chunkWithOffsets(body)) }
    }
    assertFidelity(body, r.id)
    const text = body.replace(/\s+/g, ' ').trim()
    const truncated = chunks.length >= MAX_CHUNKS && endOffset < text.length
    if (++fetched % 2000 === 0) console.log(`   … ${n(fetched)}/${n(cands.length)} (${Math.round((Date.now() - t0) / 1000)}s)`)
    return { id: r.id, corpus: r.corpus, wordCount: r.wordCount, normLen,
             coveredWords: countWords(text.slice(0, endOffset)), truncated } as M
  })
  const ms = measured.filter((m): m is M => m !== null)
  console.log(`read ${n(ms.length)} bodies (${n(missing)} missing in R2, ${n(refetched)} re-read in full) in ${Math.round((Date.now() - t0) / 1000)}s`)
  console.log(`harness fidelity: chunkWithOffsets reproduced chunk.ts on all ${n(ms.length)} bodies\n`)

  // safety margin on the candidate threshold: nothing just under it should be near the cap
  const minTruncWords = Math.min(...ms.filter((m) => m.truncated).map((m) => m.wordCount))
  console.log(`smallest TRUNCATED section: ${n(minTruncWords)} words (candidate floor was ${n(CANDIDATE_MIN_WORDS)}) — margin ${(minTruncWords / CANDIDATE_MIN_WORDS).toFixed(2)}x`)

  const byCorpus = new Map<string, { trunc: number; lost: number; candWords: number }>()
  let truncTotal = 0, lostTotal = 0
  for (const m of ms) {
    const b = byCorpus.get(m.corpus) ?? { trunc: 0, lost: 0, candWords: 0 }
    b.candWords += m.wordCount
    if (m.truncated) { b.trunc++; const lost = Math.max(0, m.wordCount - m.coveredWords); b.lost += lost; truncTotal++; lostTotal += lost }
    byCorpus.set(m.corpus, b)
  }
  console.log('\ncorpus                    tier words     truncated   words lost   % of tier words embedded')
  let embTot = 0
  for (const c of LEG_CORPORA_ALL) {
    const tw = totalWordsBy.get(c) ?? 0; const b = byCorpus.get(c) ?? { trunc: 0, lost: 0, candWords: 0 }
    embTot += tw - b.lost
    console.log(`  ${c.padEnd(23)} ${n(tw).padStart(12)} ${n(b.trunc).padStart(11)} ${n(b.lost).padStart(12)}   ${pct(tw - b.lost, tw)}`)
  }
  console.log(`  ${'LEGISLATION TIER'.padEnd(23)} ${n(TIER_WORDS).padStart(12)} ${n(truncTotal).padStart(11)} ${n(lostTotal).padStart(12)}   ${pct(TIER_WORDS - lostTotal, TIER_WORDS)}`)

  // the brief's narrower set
  const bw = BRIEF_CORPORA.reduce((a, c) => a + (totalWordsBy.get(c) ?? 0), 0)
  const bl = BRIEF_CORPORA.reduce((a, c) => a + (byCorpus.get(c)?.lost ?? 0), 0)
  const bt = BRIEF_CORPORA.reduce((a, c) => a + (byCorpus.get(c)?.trunc ?? 0), 0)
  const br = BRIEF_CORPORA.reduce((a, c) => a + (totalRowsBy.get(c) ?? 0), 0)
  console.log(`\n  brief's set (primary + SI + retained EU): ${n(bw)} words, ${n(bt)} truncated of ${n(br)} rows, ${pct(bw - bl, bw)} embedded`)

  // ── long-form instruments: the worst cases ──────────────────────────────────
  console.log('\n=== long-form instruments — the cases that matter more than the mean ===')
  const gidOf = (id: string) => { const parts = id.split(':'); return parts.length >= 2 ? parts[1] : '' }
  const gids = Array.from(new Set(ms.map((m) => gidOf(m.id)).filter(Boolean)))
  const { rows: acts } = await p.query<{ gid: string; title: string }>(
    `SELECT gid, title FROM corpus_acts WHERE gid = ANY($1) AND title IS NOT NULL`, [gids])
  const title = new Map(acts.map((a) => [a.gid, a.title]))

  const GROUPS: Array<{ label: string; test: (m: M) => boolean }> = [
    { label: 'Finance Acts',                 test: (m) => /\bfinance act\b/i.test(title.get(gidOf(m.id)) ?? '') },
    { label: 'Taxation / TCGA / ITEPA etc.', test: (m) => /(taxation|income tax|corporation tax|capital gains|value added tax)/i.test(title.get(gidOf(m.id)) ?? '') },
    { label: 'Companies / Insolvency',       test: (m) => /(companies act|insolvency)/i.test(title.get(gidOf(m.id)) ?? '') },
    { label: 'Schedules (any instrument)',   test: (m) => /schedule/i.test(m.id.split(':').slice(2).join(':')) },
    { label: 'Explanatory notes/memoranda',  test: (m) => m.corpus.startsWith('explanatory-') },
    { label: 'EU (eur-lex + retained-eu)',   test: (m) => m.corpus === 'eur-lex' || m.corpus === 'retained-eu' },
  ]
  for (const g of GROUPS) {
    const set = ms.filter(g.test)
    if (!set.length) { console.log(`  ${g.label.padEnd(32)} (no sections in the candidate set)`); continue }
    const tr = set.filter((s) => s.truncated)
    const words = set.reduce((a, s) => a + s.wordCount, 0)
    const cov = set.reduce((a, s) => a + Math.min(s.wordCount, s.coveredWords), 0)
    console.log(`  ${g.label.padEnd(32)} sections=${n(set.length).padStart(6)}  truncated=${n(tr.length).padStart(6)} (${pct(tr.length, set.length)})  words embedded=${pct(cov, words)}`)
  }

  console.log('\n  worst 15 individual sections by words lost:')
  for (const m of [...ms].filter((x) => x.truncated).sort((a, b) => (b.wordCount - b.coveredWords) - (a.wordCount - a.coveredWords)).slice(0, 15)) {
    console.log(`    ${pct(m.coveredWords, m.wordCount).padStart(6)} embedded  ${n(m.wordCount).padStart(8)} words  ${(title.get(gidOf(m.id)) ?? m.corpus).slice(0, 52).padEnd(52)} ${m.id.slice(0, 60)}`)
  }

  // ── model vs measurement ────────────────────────────────────────────────────
  console.log(`\n=== model vs measurement ===`)
  console.log(`  model:    ${pct(mCov, mTot)} of tier words embedded, ${n(mTrunc)} sections truncated`)
  console.log(`  measured: ${pct(TIER_WORDS - lostTotal, TIER_WORDS)} of tier words embedded, ${n(truncTotal)} sections truncated`)
  await p.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
