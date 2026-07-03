/**
 * pilot-embed.ts — embed the pilot chunks with one candidate model → its own
 * Lance vector table (`pilot_vec_<slug>`). Resumable + idempotent.
 *
 * The full-corpus embed is the sticky cost (switching models = re-embed the whole
 * corpus, since vectors from different models are incompatible), so we pilot each
 * candidate on the SAME chunk set and compare before paying it. This step is the
 * per-model embed of that shared chunk set.
 *
 * Vectors are stored RAW (no manual normalisation); the score step searches with
 * COSINE distance. No ANN index is built — the score step does an exact/brute-force
 * scan so ANN recall loss can't confound the model comparison (subset scale makes
 * exact search cheap).
 *
 * RESUMABLE: chunks processed in stable chunkId order; a cursor (last embedded
 * chunkId) is checkpointed to R2 after every batch, so a long embed survives an
 * interruption or a rate-limit stall and resumes with `WHERE chunkId > cursor`.
 *
 * Run: tsx search/pilot-embed.ts [--model gemini|voyage|e5] [--reset] [--limit N]
 *   default = every enabled provider, in turn.
 * Env: PILOT_EMBED_CONCURRENCY(4) — concurrent in-flight API batches per model.
 */
import { Schema, Field, Utf8, Float32, FixedSizeList } from 'apache-arrow'
import { connectLance, lancedb } from './lance'
import { PILOT_CHUNKS, vecTable, embedCheckpointKey as checkpointKey } from './pilot-common'
import { Provider, enabledProviders, providerBySlug } from './pilot-providers'
import { r2Get, r2Put } from '../shared/r2-client'

const CONCURRENCY = parseInt(process.env.PILOT_EMBED_CONCURRENCY ?? '4', 10)
const RESET = process.argv.includes('--reset')
const LIMIT = (() => { const i = process.argv.indexOf('--limit'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : Infinity })()
const MAX_CHUNKS_READ = 500_000 // > any pilot chunk count; single-shot read

function vecSchema(dims: number): Schema {
  return new Schema([
    new Field('chunkId', new Utf8(), false),
    new Field('sectionId', new Utf8(), false),
    new Field('corpus', new Utf8(), false),
    new Field('tier', new Utf8(), false),
    new Field('vector', new FixedSizeList(dims, new Field('item', new Float32(), true)), false),
  ])
}

type Checkpoint = { cursor: string; rows: number; updatedAt: string }

async function loadCp(slug: string): Promise<Checkpoint> {
  if (RESET) return { cursor: '', rows: 0, updatedAt: '' }
  const raw = await r2Get(checkpointKey(slug))
  if (!raw) return { cursor: '', rows: 0, updatedAt: '' }
  try { return JSON.parse(raw) } catch { return { cursor: '', rows: 0, updatedAt: '' } }
}
async function saveCp(slug: string, cp: Checkpoint) { cp.updatedAt = new Date().toISOString(); await r2Put(checkpointKey(slug), JSON.stringify(cp), 'application/json') }

/** run async fns with bounded concurrency, preserving order */
async function pmap<T, R>(items: T[], concurrency: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length); let next = 0
  async function w() { while (true) { const i = next++; if (i >= items.length) return; out[i] = await fn(items[i], i) } }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, w))
  return out
}

async function embedOne(conn: lancedb.Connection, chunksTbl: lancedb.Table, p: Provider) {
  console.log(`\n[pilot-embed] === ${p.slug} (${p.model}, ${p.dims}d) ===`)
  const cp = await loadCp(p.slug)
  console.log(`[pilot-embed] checkpoint: cursor=${cp.cursor || '(start)'} rows=${cp.rows}`)

  // (re)create the vec table on a fresh start
  const name = vecTable(p.slug)
  let tbl: lancedb.Table
  const exists = (await conn.tableNames()).includes(name)
  if (RESET || !exists || !cp.cursor) {
    try { await conn.dropTable(name) } catch { /* absent */ }
    tbl = await conn.createEmptyTable(name, vecSchema(p.dims), { mode: 'create' })
    cp.cursor = ''; cp.rows = 0
    await saveCp(p.slug, cp)
  } else {
    tbl = await conn.openTable(name)
    // clear any appended-but-un-checkpointed tail from a prior crash
    await tbl.delete(`chunkId > '${cp.cursor.replace(/'/g, "''")}'`)
  }

  // Single-shot load of the whole chunk set, sorted by chunkId (Lance scans are
  // unordered, so we sort in memory — this makes the resume cursor correct: pages
  // are contiguous in chunkId order and none can be skipped). ~80k rows fits easily.
  const allChunks = await chunksTbl.query()
    .select(['chunkId', 'sectionId', 'corpus', 'tier', 'body']).limit(MAX_CHUNKS_READ).toArray() as any[]
  allChunks.sort((a, b) => (a.chunkId < b.chunkId ? -1 : a.chunkId > b.chunkId ? 1 : 0))
  const total = allChunks.length
  // resume: first index strictly after the cursor
  let startIdx = 0
  if (cp.cursor) { while (startIdx < total && allChunks[startIdx].chunkId <= cp.cursor) startIdx++ }
  const todo = allChunks.slice(startIdx, Number.isFinite(LIMIT) ? startIdx + LIMIT : undefined)
  console.log(`[pilot-embed] ${total} chunks, resuming at ${startIdx}, ${todo.length} to embed`)

  const PAGE = Math.max(p.batchSize * CONCURRENCY, p.batchSize) * 5 // write cadence
  const t0 = Date.now()
  let done = 0
  for (let pStart = 0; pStart < todo.length; pStart += PAGE) {
    const page = todo.slice(pStart, pStart + PAGE)
    const batches: any[][] = []
    for (let i = 0; i < page.length; i += p.batchSize) batches.push(page.slice(i, i + p.batchSize))
    const vecBatches = await pmap(batches, CONCURRENCY, async (b) => p.embed(b.map((r) => r.body), 'document'))

    const records: any[] = []
    batches.forEach((b, bi) => {
      const vecs = vecBatches[bi]
      b.forEach((r, ri) => records.push({ chunkId: r.chunkId, sectionId: r.sectionId, corpus: r.corpus, tier: r.tier, vector: vecs[ri] }))
    })
    await tbl.add(records)

    cp.cursor = page[page.length - 1].chunkId
    cp.rows += records.length
    done += records.length
    await saveCp(p.slug, cp)
    const el = (Date.now() - t0) / 1000
    console.log(`  ${cp.rows}/${total} (+${records.length}) ${(done / Math.max(el, 0.001)).toFixed(0)}/s cursor=…${cp.cursor.slice(-24)}`)
  }
  console.log(`[pilot-embed] ${p.slug} DONE — ${await tbl.countRows()} vectors`)
}

async function main() {
  const modelArg = (() => { const i = process.argv.indexOf('--model'); return i >= 0 ? process.argv[i + 1] : null })()
  const providers = modelArg ? [providerBySlug(modelArg)] : enabledProviders()
  const usable = providers.filter((p) => p.enabled)
  if (!usable.length) throw new Error('no enabled providers (check API keys)')
  console.log(`[pilot-embed] providers: ${usable.map((p) => p.slug).join(', ')}${RESET ? ' RESET' : ''}`)

  const conn = await connectLance()
  const chunksTbl = await conn.openTable(PILOT_CHUNKS)
  for (const p of usable) await embedOne(conn, chunksTbl, p)
  console.log('\n[pilot-embed] ALL DONE')
}

main().catch((e) => { console.error('[pilot-embed] FATAL', e); process.exit(1) })
