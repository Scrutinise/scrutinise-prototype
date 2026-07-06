/**
 * gemini-tier-probe.ts — empirically determine the account's Gemini BATCH tier by
 * attempting batch-job CREATION at token sizes that bracket the per-tier enqueued-token
 * caps, cancelling each accepted job immediately. ACCEPTANCE is the signal; the cancel
 * keeps spend ≈ $0 and frees the queue for the next probe. Near-zero cost, safe to
 * re-run any time — this is the tool that detects the Tier-2 auto-flip after the
 * sync-slice spend crosses $100 (see docs/VECTOR_EMBED_REPORT.md §5).
 *
 * Documented caps (ai.google.dev/gemini-api/docs/rate-limits, "Batch enqueued tokens",
 * gemini-embedding-001): Tier 1 = 500k, Tier 2 = 5M, Tier 3 = 10M. Probe targets sit
 * inside each band: ~300k (any paid tier) / ~4M (Tier 2+) / ~8M (Tier 3).
 * 2026-07-06 result on this account: 182k ACCEPTED, 2.56M REJECTED → Tier 1.
 *
 * Usage: npx tsx search/gemini-tier-probe.ts
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { GoogleGenAI } from '@google/genai'
import { buildEmbedRequestLine } from './gemini-batch'
import { connectLance } from './lance'
import { CHUNKS_TABLE, VECTOR_MODEL, estTokens } from './vector-common'

const TARGETS: Array<{ tokens: number; means: string }> = [
  { tokens: 300_000, means: 'paid Tier 1+' },
  { tokens: 4_000_000, means: 'Tier 2+' },
  { tokens: 8_000_000, means: 'Tier 3' },
]

async function probe(ai: GoogleGenAI, chunks: Array<{ chunkId: string; body: string }>, target: { tokens: number; means: string }): Promise<boolean> {
  // token-targeted pack (chunk sizes vary ~170–1,000 est tok — counts are a bad proxy)
  const slice: typeof chunks = []
  let tok = 0
  for (const c of chunks) { if (tok >= target.tokens) break; slice.push(c); tok += estTokens(c.body) }
  if (tok < target.tokens) { console.log(`PROBE ~${target.tokens.toLocaleString()} tok: SKIPPED (only ${tok.toLocaleString()} tok of chunk data loaded)`); return false }
  const tmp = path.join(os.tmpdir(), `tier-probe-${target.tokens}-${process.pid}.jsonl`)
  fs.writeFileSync(tmp, slice.map((c) => buildEmbedRequestLine(c.chunkId, c.body)).join('\n') + '\n', 'utf8')
  let fileName: string | undefined
  try {
    const up = await ai.files.upload({ file: tmp, config: { mimeType: 'application/jsonl' } })
    fileName = up.name ?? undefined
    const job = await ai.batches.createEmbeddings({ model: VECTOR_MODEL, src: { fileName: up.name! }, config: { displayName: `tier-probe-${target.tokens}` } })
    console.log(`PROBE ~${tok.toLocaleString()} est tok (${slice.length} chunks): ACCEPTED → account is ${target.means} — cancelling…`)
    try { await ai.batches.cancel({ name: job.name! }); console.log('  cancelled ok') } catch (e) { console.log('  cancel failed (may bill a few cents):', (e as Error).message?.slice(0, 200)) }
    return true
  } catch (e) {
    const msg = (e as Error).message ?? String(e)
    const is429 = /429|RESOURCE_EXHAUSTED/.test(msg)
    console.log(`PROBE ~${tok.toLocaleString()} est tok: ${is429 ? `REJECTED 429 → NOT ${target.means}` : 'FAILED (non-429 — inspect)'} — ${msg.slice(0, 200)}`)
    return false
  } finally {
    try { fs.unlinkSync(tmp) } catch { /* ok */ }
    if (fileName) { try { await ai.files.delete({ name: fileName }) } catch { /* ok */ } }
  }
}

async function main() {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set')
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  const conn = await connectLance()
  const tbl = await conn.openTable(CHUNKS_TABLE)
  console.log('loading chunk data for probe payloads…')
  const rows = await tbl.query().select(['chunkId', 'body']).limit(60_000).toArray() as any[]
  const chunks = rows.map((r) => ({ chunkId: r.chunkId as string, body: r.body as string }))
  console.log(`loaded ${chunks.length} chunks (~${chunks.reduce((a, c) => a + estTokens(c.body), 0).toLocaleString()} est tok)`)
  for (const t of TARGETS) {
    const ok = await probe(ai, chunks, t)
    if (!ok) break // caps are nested — a rejected size means everything larger is too
    await new Promise((r) => setTimeout(r, 20_000)) // let the cancelled job release quota
  }
  console.log('probe complete')
}
main().catch((e) => { console.error('probe error:', (e as Error).message); process.exit(1) })
