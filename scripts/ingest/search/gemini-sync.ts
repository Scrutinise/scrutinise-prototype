/**
 * gemini-sync.ts — the ONLY module that drives DOCUMENT embedding through the
 * SYNCHRONOUS embedContent path (the pilot's transport), at STANDARD rate
 * ($0.15/1M tokens — double the Batch API's $0.075). Exists for exactly one
 * scenario: the account is Batch Tier 1 (enqueued-token queue cap 500k — probed
 * 2026-07-06: 182k-token job accepted, 2.56M rejected), so a corpus slice is
 * sync-embedded to bank vectors AND accrue the ≥$100 actual usage that auto-flips
 * the account to Tier 2 (5M queue) — then the build resumes via gemini-batch.ts.
 * Vectors are transport-agnostic: same model/dims/taskType → same embedding space.
 *
 * VERIFIED LIMITS (2026-07-07):
 *   - per sync request: ≤250 texts, ≤20,000 total tokens (400 error above),
 *     ≤2,048 tokens per text (SILENTLY truncated — our chunks cap at ~1,024, safe).
 *     Source: ai.google.dev/api/embeddings + payload-size forum thread.
 *   - Tier-1 sync rate for gemini-embedding-001: 3,000 RPM / 1,000,000 TPM, no daily
 *     cap (Google AI forum, official reply — the rate-limits page doesn't publish
 *     per-model embedding rows; CONFIRM in AI Studio → rate-limit dashboard).
 *     Defaults below sit 5% under, and every call is paced through a GLOBAL
 *     minute-window limiter shared by all in-flight shards.
 *
 * Env: VECTOR_SYNC_TPM(950000) VECTOR_SYNC_RPM(2800) VECTOR_SYNC_CALL_TEXTS(100)
 *      VECTOR_SYNC_CALL_TOKENS(18000) VECTOR_SYNC_CALL_RETRIES(6)
 */
import { GoogleGenAI } from '@google/genai'
import { VECTOR_MODEL, VECTOR_DIMS, TASK_DOCUMENT, estTokens } from './vector-common'
import type { ChunkForEmbed } from './gemini-batch'

const SYNC_TPM = parseInt(process.env.VECTOR_SYNC_TPM ?? '950000', 10)
const SYNC_RPM = parseInt(process.env.VECTOR_SYNC_RPM ?? '2800', 10)
const CALL_TEXTS = Math.min(parseInt(process.env.VECTOR_SYNC_CALL_TEXTS ?? '100', 10), 250) // hard API cap 250
const CALL_TOKENS = Math.min(parseInt(process.env.VECTOR_SYNC_CALL_TOKENS ?? '18000', 10), 20000) // hard API cap 20k
const CALL_RETRIES = parseInt(process.env.VECTOR_SYNC_CALL_RETRIES ?? '6', 10)

let _client: GoogleGenAI | null = null
function client(): GoogleGenAI {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY not set')
    _client = new GoogleGenAI({ apiKey })
  }
  return _client
}

// ── global pacer — ONE minute-window across every shard worker in the process ──
// Serialised through a promise chain so concurrent acquire()s can't double-spend
// the window. If a call doesn't fit the remaining window, the whole chain sleeps
// to the window boundary (strictly-under-budget beats clever interleaving here;
// the 429 retry below is the safety net for client/server window drift).
let paceChain: Promise<void> = Promise.resolve()
let winStart = 0
let winTokens = 0
let winReqs = 0

function acquire(tokens: number): Promise<void> {
  paceChain = paceChain.then(async () => {
    while (true) {
      const now = Date.now()
      if (now - winStart >= 60_000) { winStart = now; winTokens = 0; winReqs = 0 }
      if (winReqs + 1 <= SYNC_RPM && winTokens + tokens <= SYNC_TPM) { winReqs++; winTokens += tokens; return }
      await new Promise((r) => setTimeout(r, winStart + 60_000 - now + 50))
    }
  })
  return paceChain
}

const RETRYABLE = /429|RESOURCE_EXHAUSTED|500|502|503|504|UNAVAILABLE|INTERNAL|ECONNRESET|ETIMEDOUT|fetch failed/i

/** One paced, retried embedContent call for a pack of texts. Returns vectors in input order. */
async function embedCall(texts: string[], tokens: number, tag: string): Promise<(number[] | null)[]> {
  await acquire(tokens)
  let lastErr: any
  for (let i = 0; i < CALL_RETRIES; i++) {
    try {
      const res: any = await client().models.embedContent({
        model: VECTOR_MODEL,
        contents: texts,
        config: { taskType: TASK_DOCUMENT, outputDimensionality: VECTOR_DIMS },
      })
      const embs: any[] = res.embeddings ?? []
      if (embs.length !== texts.length) throw new Error(`sync ${tag}: ${embs.length} embeddings for ${texts.length} texts (order correlation needs 1:1)`)
      return embs.map((e) => (Array.isArray(e?.values) && e.values.length === VECTOR_DIMS ? (e.values as number[]) : null))
    } catch (e) {
      lastErr = e
      const msg = (e as Error).message ?? String(e)
      if (!RETRYABLE.test(msg) && !/1:1/.test(msg)) throw e // non-transient, non-shape → surface now
      const wait = Math.min(60_000, 2000 * 2 ** i) + Math.floor(Math.random() * 1000)
      console.warn(`[sync] ${tag} call attempt ${i + 1}/${CALL_RETRIES} failed: ${msg.slice(0, 160)} — retrying in ${Math.round(wait / 1000)}s`)
      await new Promise((r) => setTimeout(r, wait))
    }
  }
  throw lastErr
}

/** Pure: pack a shard's chunks into API calls of ≤CALL_TEXTS texts / ≤CALL_TOKENS est
 *  tokens, preserving order. Exported for the offline --selftest. */
export function packChunks(chunks: ChunkForEmbed[]): Array<{ texts: string[]; tokens: number }> {
  const packs: Array<{ texts: string[]; tokens: number }> = []
  let texts: string[] = []
  let tokens = 0
  for (const c of chunks) {
    const t = estTokens(c.body)
    if (texts.length >= CALL_TEXTS || (texts.length && tokens + t > CALL_TOKENS)) { packs.push({ texts, tokens }); texts = []; tokens = 0 }
    texts.push(c.body); tokens += t
  }
  if (texts.length) packs.push({ texts, tokens })
  return packs
}

/**
 * Embed one shard through the sync path — the drop-in transport twin of
 * embedShardViaBatch(): same input, same "one vector per chunk IN INPUT ORDER,
 * null = miss" contract, so build-vector-index.ts orchestration (shard plan,
 * idempotent writes, checkpoints) is untouched.
 */
export async function embedShardViaSync(chunks: ChunkForEmbed[], tag: string): Promise<(number[] | null)[]> {
  const out: (number[] | null)[] = []
  for (const pack of packChunks(chunks)) {
    const vecs = await embedCall(pack.texts, pack.tokens, tag)
    out.push(...vecs)
  }
  if (out.length !== chunks.length) throw new Error(`sync ${tag}: assembled ${out.length} vectors for ${chunks.length} chunks`)
  return out
}

// ── offline self-test (no network — packing + pacer-window arithmetic) ─────────
function selftest() {
  const mk = (n: number, chars: number): ChunkForEmbed[] => Array.from({ length: n }, (_, i) => ({ chunkId: `s#${i}`, body: 'x'.repeat(chars) }))
  // 1. text-count cap: 250 × 400-char chunks (100 tok) → packs of CALL_TEXTS
  const p1 = packChunks(mk(250, 400))
  const ok1 = p1.every((p, i) => (i < p1.length - 1 ? p.texts.length === CALL_TEXTS : p.texts.length <= CALL_TEXTS))
    && p1.reduce((a, p) => a + p.texts.length, 0) === 250
  // 2. token cap: 4,000-char chunks (1,000 tok) → ≤ CALL_TOKENS per pack, order kept
  const p2 = packChunks(mk(50, 4000))
  const ok2 = p2.every((p) => p.tokens <= CALL_TOKENS) && p2.reduce((a, p) => a + p.texts.length, 0) === 50
  // 3. single oversize chunk still ships alone (never dropped)
  const p3 = packChunks(mk(1, 100_000))
  const ok3 = p3.length === 1 && p3[0].texts.length === 1
  // 4. throughput arithmetic sanity: packs of 18k tok at 950k TPM ≈ 52 calls/min
  const callsPerMin = Math.floor(SYNC_TPM / CALL_TOKENS)
  const ok4 = callsPerMin > 0 && callsPerMin <= SYNC_RPM
  console.log(`packChunks text-cap:  ${ok1 ? 'PASS' : 'FAIL'} (${p1.length} packs)`)
  console.log(`packChunks token-cap: ${ok2 ? 'PASS' : 'FAIL'} (${p2.length} packs, max ${Math.max(...p2.map((p) => p.tokens))} tok)`)
  console.log(`packChunks oversize:  ${ok3 ? 'PASS' : 'FAIL'}`)
  console.log(`pacing headroom:      ${ok4 ? 'PASS' : 'FAIL'} (${callsPerMin} calls/min ≤ RPM ${SYNC_RPM}; ~${(SYNC_TPM * 60).toLocaleString()} tok/hr)`)
  if (!ok1 || !ok2 || !ok3 || !ok4) process.exit(1)
}

if (process.argv.includes('--selftest')) selftest()
