/**
 * gemini-batch.ts — the ONLY module that touches the Gemini Batch API. All batch-API
 * surface (Files upload, asyncBatchEmbedContent, job polling, result download) is
 * quarantined here behind embedShardViaBatch() + two pure helpers, so:
 *   - if the batch JSONL/response shape differs in practice, it's a ONE-FILE fix;
 *   - build-vector-index.ts stays a clean orchestrator (shard → embed → write).
 *
 * WHY the Batch API (not the pilot's synchronous batchEmbedContents): the async batch
 * path is billed at HALF the standard rate ($0.075 vs $0.15 / 1M tokens for
 * gemini-embedding-001) — the 50% discount the brief mandates. It is non-real-time
 * indexing work with a ≤24h SLA, so async is the right tool.
 *
 * SHAPE NOTES (verified against @google/genai 1.52 typedefs + the REST surface, but the
 * exact per-line JSONL is validated LIVE by the --canary in build-vector-index.ts —
 * external-API behaviour is advisory until run for real, per docs/CLAUDE.md §0/§13):
 *   - Input: a JSONL file uploaded via files.upload; one request per line. Each line is
 *     {"key", "request": EmbedContentRequest}. EmbedContentRequest = {content, taskType,
 *     outputDimensionality} (model is the job-level param, not per-line).
 *   - Job: batches.createEmbeddings({model, src:{fileName}, config:{displayName}}).
 *   - Output: dest.fileName → a JSONL file, ONE response per line, IN INPUT ORDER
 *     (per BatchJobDestination docs) → we correlate positionally (robust), asserting the
 *     echoed key when present. Small jobs may instead return dest.inlinedEmbedContentResponses.
 *
 * Offline self-test (no network — validates the pure JSONL build + response parse):
 *   npx tsx search/gemini-batch.ts --selftest
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { GoogleGenAI } from '@google/genai'
import { VECTOR_MODEL, VECTOR_DIMS, TASK_DOCUMENT, estTokens } from './vector-common'

const POLL_MS = parseInt(process.env.VECTOR_BATCH_POLL_MS ?? '30000', 10)
const POLL_MAX = parseInt(process.env.VECTOR_BATCH_POLL_MAX ?? '2880', 10) // 2880×30s = 24h SLA ceiling
const UPLOAD_MIME = process.env.VECTOR_BATCH_MIME ?? 'application/jsonl'
const TERMINAL = new Set(['JOB_STATE_SUCCEEDED', 'JOB_STATE_FAILED', 'JOB_STATE_CANCELLED', 'JOB_STATE_EXPIRED'])
// Per-JOB est-token budget (2026-07-07): the Batch tier caps ENQUEUED TOKENS across
// active jobs (T1 500k / T2 5M / T3 10M — probed + docs). A count-sized shard can't
// guarantee this (sorted chunkIds group corpora contiguously; caselaw/debate regions
// run ~800 tok/chunk vs the ~310 corpus average), so any over-budget shard is split
// into SEQUENTIAL sub-jobs here at submission time, where the bodies are in hand.
// Default 4.5M = Tier-2 cap × 0.9. Set 0 to disable (single job per shard).
const JOB_TOKENS = parseInt(process.env.VECTOR_BATCH_JOB_TOKENS ?? '4500000', 10)
// Job CREATION 429s are the quota's normal pacing signal, not an error (observed live:
// the Tier-2 quota behaves as a ~5M-token bucket refilling over ~10-15 min — creations
// 429 with an EMPTY queue until it refills). Waiting patiently HERE is essential: if a
// 429 escapes to the shard-level retry, already-billed sub-jobs get re-run. 90s × 30
// waits ≥ 45 min through any refill cycle.
const CREATE_RETRY_MS = parseInt(process.env.VECTOR_BATCH_CREATE_RETRY_MS ?? '90000', 10)
const CREATE_RETRY_MAX = parseInt(process.env.VECTOR_BATCH_CREATE_RETRY_MAX ?? '30', 10)

export interface ChunkForEmbed { chunkId: string; body: string }

let _client: GoogleGenAI | null = null
function client(): GoogleGenAI {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY not set')
    _client = new GoogleGenAI({ apiKey })
  }
  return _client
}

// ── pure helpers (unit-testable offline) ──────────────────────────────────────

/** One JSONL input line for the embeddings batch. taskType = RETRIEVAL_DOCUMENT (docs). */
export function buildEmbedRequestLine(key: string, text: string): string {
  return JSON.stringify({
    key,
    request: {
      content: { parts: [{ text }] },
      taskType: TASK_DOCUMENT,
      outputDimensionality: VECTOR_DIMS,
    },
  })
}

/** Parse one output JSONL line → {key?, values|null}. Tolerant of the wrapper the
 *  batch service uses (response|inline; embedding|embeddings; values under either),
 *  and of a per-request error line (→ values:null). */
export function parseEmbedResponseLine(line: string): { key: string | null; values: number[] | null } {
  const t = line.trim()
  if (!t) return { key: null, values: null }
  let o: any
  try { o = JSON.parse(t) } catch { return { key: null, values: null } }
  const key = o.key ?? o.metadata?.key ?? null
  if (o.error || o.status || o.response?.error) return { key, values: null }
  const resp = o.response ?? o
  const emb = resp.embedding ?? resp.embeddings?.[0] ?? resp.predictions?.[0]?.embeddings ?? null
  const values = emb?.values ?? emb?.value ?? (Array.isArray(emb) ? emb : null)
  return { key, values: Array.isArray(values) ? values : null }
}

// ── the one batch call ─────────────────────────────────────────────────────────

/** Pure: match response lines to input chunks (2026-07-07 fix). File-based output is
 *  NOT in input order at scale — the first real 4.5M-token job returned key-shuffled
 *  lines (the docs' in-order claim held only for small jobs' INLINE responses, which is
 *  all the canary exercised). Every request line carries our chunkId as `key` and the
 *  service echoes it, so correlate by key whenever keys are present; positional only for
 *  the keyless inline path. Silent drops stay impossible: unknown/duplicate keys throw,
 *  absent keys return null (counted as misses by the caller). */
export function correlateResponses(chunks: ChunkForEmbed[], lines: string[], tag: string): (number[] | null)[] {
  const parsed = lines.map((line) => parseEmbedResponseLine(line))
  const keyed = parsed.filter((p) => p.key !== null)
  if (keyed.length > 0 && keyed.length < parsed.length) {
    throw new Error(`batch ${tag}: ${keyed.length}/${parsed.length} response lines carry keys (mixed shape — cannot correlate safely)`)
  }
  if (keyed.length === parsed.length && parsed.length > 0) {
    const byKey = new Map<string, number[] | null>()
    for (const p of parsed) {
      if (byKey.has(p.key!)) throw new Error(`batch ${tag}: duplicate response key '${p.key}'`)
      byKey.set(p.key!, p.values)
    }
    const inputKeys = new Set(chunks.map((c) => c.chunkId))
    for (const k of byKey.keys()) { if (!inputKeys.has(k)) throw new Error(`batch ${tag}: response key '${k}' not in this job's input`) }
    if (byKey.size !== chunks.length) console.warn(`[gemini-batch] ${tag}: ${byKey.size} responses for ${chunks.length} requests — ${chunks.length - byKey.size} absent (counted as misses)`)
    return chunks.map((c) => byKey.get(c.chunkId) ?? null)
  }
  // keyless (inline path) — positional, which requires exact 1:1
  if (lines.length !== chunks.length) {
    throw new Error(`batch ${tag}: got ${lines.length} keyless responses for ${chunks.length} requests (positional correlation needs 1:1)`)
  }
  return parsed.map((p) => p.values)
}

/** Pure: split a shard into consecutive sub-job groups of ≤JOB_TOKENS est tokens
 *  (order preserved; a single over-budget chunk still ships alone). Exported for
 *  the offline --selftest. */
export function splitForJobTokens(chunks: ChunkForEmbed[], budget = JOB_TOKENS): ChunkForEmbed[][] {
  if (!budget || budget <= 0) return [chunks]
  const groups: ChunkForEmbed[][] = []
  let group: ChunkForEmbed[] = []
  let tokens = 0
  for (const c of chunks) {
    const t = estTokens(c.body)
    if (group.length && tokens + t > budget) { groups.push(group); group = []; tokens = 0 }
    group.push(c); tokens += t
  }
  if (group.length) groups.push(group)
  return groups
}

/**
 * Embed one shard via the Batch API. Returns one vector per input chunk, IN INPUT
 * ORDER; a chunk the service couldn't embed (e.g. over the token cap) comes back as
 * null (the caller records a miss and moves on). A shard whose estimated tokens
 * exceed the per-job budget is transparently split into SEQUENTIAL sub-jobs (keeps
 * the deterministic shard plan while never over-filling the tier's enqueued-token
 * queue). Deletes uploaded input files as it goes so Files storage stays bounded.
 *
 * @param tag  a short label for logs + the batch displayName (e.g. "shard-000123").
 */
export async function embedShardViaBatch(chunks: ChunkForEmbed[], tag: string): Promise<(number[] | null)[]> {
  const groups = splitForJobTokens(chunks)
  if (groups.length === 1) return embedJob(chunks, tag)
  console.log(`[gemini-batch] ${tag}: ~${estTokens(chunks.map((c) => c.body).join('')).toLocaleString()} est tok > job budget — ${groups.length} sequential sub-jobs`)
  const out: (number[] | null)[] = []
  for (let g = 0; g < groups.length; g++) out.push(...await embedJob(groups[g], `${tag}.${g}`))
  return out
}

/** One shard-or-sub-job → one batch job (upload → create → poll → collect). */
async function embedJob(chunks: ChunkForEmbed[], tag: string): Promise<(number[] | null)[]> {
  const ai = client()
  const tmp = path.join(os.tmpdir(), `vec-${tag}-${process.pid}.jsonl`)
  fs.writeFileSync(tmp, chunks.map((c) => buildEmbedRequestLine(c.chunkId, c.body)).join('\n') + '\n', 'utf8')

  let uploadedName: string | undefined
  let outName: string | undefined
  const outTmp = path.join(os.tmpdir(), `vec-${tag}-out-${process.pid}.jsonl`)
  try {
    const uploaded = await ai.files.upload({ file: tmp, config: { mimeType: UPLOAD_MIME, displayName: `vec-${tag}` } })
    uploadedName = uploaded.name
    if (!uploadedName) throw new Error('files.upload returned no name')

    // create with patient 429 pacing (quota bucket refill — see CREATE_RETRY_MS note)
    let job: Awaited<ReturnType<typeof ai.batches.createEmbeddings>> | undefined
    for (let attempt = 0; ; attempt++) {
      try {
        job = await ai.batches.createEmbeddings({
          model: VECTOR_MODEL,
          src: { fileName: uploadedName },
          config: { displayName: `vec-${tag}` },
        })
        break
      } catch (e) {
        const msg = (e as Error).message ?? String(e)
        if (!/429|RESOURCE_EXHAUSTED/.test(msg) || attempt >= CREATE_RETRY_MAX) throw e
        if (attempt === 0 || (attempt + 1) % 5 === 0) console.log(`[gemini-batch] ${tag}: create 429 (quota bucket) — waiting ${CREATE_RETRY_MS / 1000}s (attempt ${attempt + 1}/${CREATE_RETRY_MAX})`)
        await new Promise((r) => setTimeout(r, CREATE_RETRY_MS))
      }
    }

    for (let i = 0; i < POLL_MAX && job.name && !TERMINAL.has(job.state ?? ''); i++) {
      await new Promise((r) => setTimeout(r, POLL_MS))
      job = await ai.batches.get({ name: job.name })
    }
    if (job.state !== 'JOB_STATE_SUCCEEDED') {
      throw new Error(`batch ${tag} ended ${job.state ?? 'UNKNOWN'}${job.error ? ': ' + JSON.stringify(job.error) : ''}`)
    }

    // Collect result lines — inline (small jobs) or a downloaded result file.
    const dest: any = (job as any).dest ?? {}
    let lines: string[]
    if (Array.isArray(dest.inlinedEmbedContentResponses)) {
      lines = dest.inlinedEmbedContentResponses.map((r: any) => JSON.stringify(r))
    } else {
      outName = dest.fileName
      if (!outName) throw new Error(`batch ${tag} SUCCEEDED but no dest.fileName / inline responses`)
      await ai.files.download({ file: outName, downloadPath: outTmp })
      const text = fs.readFileSync(outTmp, 'utf8')
      lines = text.split('\n').filter((l) => l.trim())
    }

    return correlateResponses(chunks, lines, tag)
  } finally {
    try { fs.unlinkSync(tmp) } catch { /* ignore */ }
    try { fs.unlinkSync(outTmp) } catch { /* ignore */ }
    // best-effort remote cleanup (files also auto-expire in 48h)
    if (uploadedName) { try { await ai.files.delete({ name: uploadedName }) } catch { /* ignore */ } }
    if (outName) { try { await ai.files.delete({ name: outName }) } catch { /* ignore */ } }
  }
}

// ── offline self-test ──────────────────────────────────────────────────────────
function selftest() {
  const line = buildEmbedRequestLine('uksi:2017/701:regulation-4#0', 'A firm must take reasonable steps.')
  const parsed = JSON.parse(line)
  const ok1 = parsed.key === 'uksi:2017/701:regulation-4#0'
    && parsed.request.content.parts[0].text.startsWith('A firm')
    && parsed.request.taskType === TASK_DOCUMENT
    && parsed.request.outputDimensionality === VECTOR_DIMS
  // response-parse tolerance across plausible wrappers
  const samples = [
    JSON.stringify({ key: 'x', response: { embedding: { values: [0.1, 0.2, 0.3] } } }),
    JSON.stringify({ embedding: { values: [0.4, 0.5] } }),
    JSON.stringify({ response: { embeddings: [{ values: [0.6] }] } }),
    JSON.stringify({ key: 'e', error: { code: 3, message: 'too long' } }),
  ]
  const parses = samples.map(parseEmbedResponseLine)
  const ok2 = parses[0].values?.length === 3 && parses[1].values?.length === 2 && parses[2].values?.length === 1 && parses[3].values === null
  // job splitting: 12k chunks of 3,200 chars (800 est tok) = 9.6M tok → sub-jobs each
  // ≤ budget, order + count preserved; small shard stays one group; oversize chunk ships alone
  const dense = Array.from({ length: 12000 }, (_, i) => ({ chunkId: `d#${i}`, body: 'x'.repeat(3200) }))
  const g1 = splitForJobTokens(dense, 4_500_000)
  const ok3 = g1.length === 3 && g1.every((g) => g.reduce((a, c) => a + Math.ceil(c.body.length / 4), 0) <= 4_500_000)
    && g1.flat().length === 12000 && g1.flat()[0].chunkId === 'd#0' && g1.flat()[11999].chunkId === 'd#11999'
  const ok4 = splitForJobTokens(dense.slice(0, 100), 4_500_000).length === 1
    && splitForJobTokens([{ chunkId: 'big', body: 'x'.repeat(40_000_000) }], 4_500_000).length === 1
  // key-based correlation: SHUFFLED keyed lines (the live failure) must land in input
  // order; absent key → null miss; unknown key / mixed keyed-keyless / dup keys → throw
  const cIn: ChunkForEmbed[] = ['a#0', 'b#1', 'c#2'].map((id) => ({ chunkId: id, body: 'x' }))
  const L = (key: string, v: number[]) => JSON.stringify({ key, response: { embedding: { values: v } } })
  const shuffled = [L('c#2', [3]), L('a#0', [1]), L('b#1', [2])]
  const r1 = correlateResponses(cIn, shuffled, 't')
  const ok5 = r1[0]?.[0] === 1 && r1[1]?.[0] === 2 && r1[2]?.[0] === 3
  const r2 = correlateResponses(cIn, [L('c#2', [3]), L('a#0', [1])], 't') // b#1 absent → miss
  const ok6 = r2[0]?.[0] === 1 && r2[1] === null && r2[2]?.[0] === 3
  const threw = (fn: () => void) => { try { fn(); return false } catch { return true } }
  const ok7 = threw(() => correlateResponses(cIn, [L('zz#9', [9]), L('a#0', [1]), L('b#1', [2])], 't'))
    && threw(() => correlateResponses(cIn, [L('a#0', [1]), JSON.stringify({ embedding: { values: [5] } }), L('b#1', [2])], 't'))
    && threw(() => correlateResponses(cIn, [L('a#0', [1]), L('a#0', [1]), L('b#1', [2])], 't'))
  // keyless inline path stays positional
  const inline = [1, 2, 3].map((n) => JSON.stringify({ embedding: { values: [n] } }))
  const r3 = correlateResponses(cIn, inline, 't')
  const ok8 = r3[0]?.[0] === 1 && r3[2]?.[0] === 3 && threw(() => correlateResponses(cIn, inline.slice(0, 2), 't'))
  console.log(`buildEmbedRequestLine: ${ok1 ? 'PASS' : 'FAIL'}  (${line.slice(0, 90)}…)`)
  console.log(`parseEmbedResponseLine: ${ok2 ? 'PASS' : 'FAIL'}  (${JSON.stringify(parses.map((p) => p.values?.length ?? null))})`)
  console.log(`splitForJobTokens dense: ${ok3 ? 'PASS' : 'FAIL'} (${g1.length} sub-jobs for 9.6M est tok)`)
  console.log(`splitForJobTokens edge:  ${ok4 ? 'PASS' : 'FAIL'}`)
  console.log(`correlate shuffled-keys: ${ok5 ? 'PASS' : 'FAIL'}`)
  console.log(`correlate absent→miss:   ${ok6 ? 'PASS' : 'FAIL'}`)
  console.log(`correlate guards throw:  ${ok7 ? 'PASS' : 'FAIL'}`)
  console.log(`correlate keyless 1:1:   ${ok8 ? 'PASS' : 'FAIL'}`)
  console.log(`model=${VECTOR_MODEL} dims=${VECTOR_DIMS} mime=${UPLOAD_MIME} jobTokens=${JOB_TOKENS}`)
  if (!ok1 || !ok2 || !ok3 || !ok4 || !ok5 || !ok6 || !ok7 || !ok8) process.exit(1)
}

if (process.argv.includes('--selftest')) selftest()
