/**
 * pilot-chunk.ts — chunk the pilot subset + build the subset BM25 baseline.
 *
 * Reads the validated subset (R2 `_search/pilot/subset.json`), pulls each section's
 * body, chunks it, and writes the `pilot_chunks` Lance table + a native FTS index.
 *
 * WHY chunks (brief §Chunking): keep short sections whole; split long sections into
 * ~512–1,024-token windows with ~15% overlap, carrying the PARENT section id on each
 * chunk (a chunk hit maps back to its section for scoring + citation). Chunk width is
 * a pilot variable with a default — tune via env.
 *
 * WHY bodies come from corpus_fts: the live BM25 dataset already carries the exact
 * body text the production engine indexes — INCLUDING the archetype-A citation
 * backfill (act title/section-ref prepended to legislation bodies). Reading from it
 * keeps the pilot's text identical to production. Subset ids absent from Lance (Neon
 * has ~1.1M compiled rows not yet in the 16.5M Lance build) fall back to R2, where the
 * SAME citation backfill is applied — so every row is consistent regardless of source.
 *
 * `pilot_chunks` doubles as the subset BM25 baseline AND the manifest the embed step
 * reads (chunkId + body). Everything downstream (vector, hybrid) is measured on THIS
 * exact chunk set, so BM25 / vector / hybrid see one identical candidate universe —
 * the only valid way to ask "does the vector layer help".
 *
 * Run: tsx search/pilot-chunk.ts
 * Env: PILOT_WHOLE_CHARS(4096) PILOT_WINDOW_CHARS(3200) PILOT_OVERLAP_CHARS(480)
 *      PILOT_MAX_CHUNKS(8) PILOT_R2_CONCURRENCY(48)
 */
import { Pool } from 'pg'
import { Schema, Field, Utf8, Int32 } from 'apache-arrow'
import { connectLance, lancedb } from './lance'
import { tierFor } from './corpus-map'
import { gidFromId, buildCitation, applyCitationToBody } from './citation'
import { r2Get } from '../shared/r2-client'
import { PILOT_CHUNKS } from './pilot-common'

const SUBSET_KEY = '_search/pilot/subset.json'

const WHOLE_CHARS = parseInt(process.env.PILOT_WHOLE_CHARS ?? '4096', 10)   // ≤ this → one whole chunk (~1024 tok)
const WINDOW_CHARS = parseInt(process.env.PILOT_WINDOW_CHARS ?? '3200', 10) // window width (~800 tok)
const OVERLAP_CHARS = parseInt(process.env.PILOT_OVERLAP_CHARS ?? '480', 10) // ~15% overlap (~120 tok)
const MAX_CHUNKS = parseInt(process.env.PILOT_MAX_CHUNKS ?? '8', 10)         // cap runaway (long debate) sections
const R2_CONCURRENCY = parseInt(process.env.PILOT_R2_CONCURRENCY ?? '48', 10)

const SCHEMA = new Schema([
  new Field('chunkId', new Utf8(), false),
  new Field('sectionId', new Utf8(), false),
  new Field('corpus', new Utf8(), false),
  new Field('tier', new Utf8(), false),
  new Field('sectionTitle', new Utf8(), true),
  new Field('body', new Utf8(), false),
  new Field('isGold', new Int32(), true),
])

/** short whole; long → overlapping windows, snapped to word boundaries, capped. */
function chunkBody(raw: string): string[] {
  const text = (raw ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return []
  if (text.length <= WHOLE_CHARS) return [text]
  const out: string[] = []
  let start = 0
  while (start < text.length && out.length < MAX_CHUNKS) {
    let end = Math.min(start + WINDOW_CHARS, text.length)
    if (end < text.length) {
      const sp = text.indexOf(' ', end)
      if (sp !== -1 && sp - end < 200) end = sp // snap forward to a space
    }
    out.push(text.slice(start, end).trim())
    if (end >= text.length) break
    start = end - OVERLAP_CHARS
  }
  return out
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  async function worker() { while (true) { const i = next++; if (i >= items.length) return; out[i] = await fn(items[i]) } }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return out
}

type Row = { id: string; corpus: string; tier: string; sectionTitle: string | null; body: string; isGold: number }

async function main() {
  console.log(`[pilot-chunk] whole≤${WHOLE_CHARS} window=${WINDOW_CHARS} overlap=${OVERLAP_CHARS} maxChunks=${MAX_CHUNKS}`)
  const subsetRaw = await r2Get(SUBSET_KEY)
  if (!subsetRaw) throw new Error(`subset not found at R2 ${SUBSET_KEY} — run pilot-subset.ts first`)
  const subset = JSON.parse(subsetRaw) as { goldAnswerIds: string[]; distractorIds: string[] }
  const goldSet = new Set(subset.goldAnswerIds)
  const allIds = [...new Set([...subset.goldAnswerIds, ...subset.distractorIds])]
  console.log(`[pilot-chunk] subset: ${allIds.length} sections (${goldSet.size} gold)`)

  const conn = await connectLance()

  // ── fetch bodies from R2 (authoritative source; mirrors build-fts-index) ──────
  // Neon r2Key lookup is PK-indexed (id = ANY(batch)) → fast; R2 fetch is
  // concurrent. This replicates the production index text exactly: raw R2 body +
  // the archetype-A citation backfill on legislation rows. Sourcing from R2 (not
  // the 16.5M Lance build) also means the ~1.1M Neon-compiled rows absent from
  // Lance are handled uniformly — no coverage gap.
  const rowMap = new Map<string, Row>()
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 4, statement_timeout: 120_000 })
  const titleMap = new Map<string, string>()
  { const { rows } = await pool.query<{ gid: string; title: string }>(`SELECT "legislationGovUkId" AS gid, title FROM "LegislationItem" WHERE "legislationGovUkId" IS NOT NULL AND title IS NOT NULL`)
    for (const r of rows) titleMap.set(r.gid, r.title)
    console.log(`[pilot-chunk] citation title map: ${titleMap.size} gid→title`) }

  type Meta = { id: string; corpus: string; sectionTitle: string | null; r2Key: string | null }
  const metas: Meta[] = []
  for (let i = 0; i < allIds.length; i += 1000) {
    const b = allIds.slice(i, i + 1000)
    const { rows } = await pool.query<Meta>(
      `SELECT id, corpus, "sectionTitle", "r2Key" FROM corpus_sections WHERE id = ANY($1::text[])`, [b])
    metas.push(...rows)
  }
  await pool.end()
  console.log(`[pilot-chunk] metadata for ${metas.length}/${allIds.length} ids — fetching bodies from R2 (conc=${R2_CONCURRENCY})…`)

  let fetched = 0
  const bodies = await mapPool(metas, R2_CONCURRENCY, async (m) => {
    const body = m.r2Key ? await r2Get(m.r2Key) : null
    if (++fetched % 5000 === 0) console.log(`  ${fetched}/${metas.length} bodies…`)
    return body
  })
  metas.forEach((m, i) => {
    const rawBody = bodies[i]
    if (rawBody == null) return
    const tier = tierFor(m.corpus)
    let sectionTitle = m.sectionTitle; let body = rawBody
    if (tier === 'legislation') {
      const gid = gidFromId(m.id)
      const cit = buildCitation(m.id, gid ? titleMap.get(gid) ?? null : null, m.sectionTitle)
      if (cit) { sectionTitle = cit.sectionTitle; body = applyCitationToBody(cit.bodyHeader, body) }
    }
    rowMap.set(m.id, { id: m.id, corpus: m.corpus, tier, sectionTitle, body, isGold: goldSet.has(m.id) ? 1 : 0 })
  })
  console.log(`[pilot-chunk] bodies fetched: ${rowMap.size}`)

  // report gold coverage of the final body set (must be ~100%)
  const goldWithBody = subset.goldAnswerIds.filter((id) => rowMap.has(id) && rowMap.get(id)!.body.length > 0).length
  console.log(`[pilot-chunk] gold sections with body: ${goldWithBody}/${subset.goldAnswerIds.length}`)

  // ── chunk ─────────────────────────────────────────────────────────────────────
  const records: any[] = []
  let totalChars = 0
  let bodiless = 0
  for (const r of rowMap.values()) {
    const chunks = chunkBody(r.body)
    if (chunks.length === 0) { bodiless++; continue }
    chunks.forEach((c, k) => {
      totalChars += c.length
      records.push({ chunkId: `${r.id}#${k}`, sectionId: r.id, corpus: r.corpus, tier: r.tier, sectionTitle: r.sectionTitle, body: c, isGold: r.isGold })
    })
  }
  const estTokens = Math.round(totalChars / 4)
  console.log(`[pilot-chunk] ${records.length} chunks from ${rowMap.size - bodiless} sections (${bodiless} empty-body). est tokens=${estTokens.toLocaleString()} (~${(records.length / Math.max(1, rowMap.size - bodiless)).toFixed(2)} chunks/section)`)

  // ── write pilot_chunks + FTS index ──────────────────────────────────────────
  try { await conn.dropTable(PILOT_CHUNKS) } catch { /* absent */ }
  const tbl = await conn.createEmptyTable(PILOT_CHUNKS, SCHEMA, { mode: 'create' })
  const ADD_BATCH = 2000
  for (let i = 0; i < records.length; i += ADD_BATCH) {
    await tbl.add(records.slice(i, i + ADD_BATCH))
    if (i % (ADD_BATCH * 10) === 0) console.log(`  wrote ${Math.min(i + ADD_BATCH, records.length)}/${records.length}…`)
  }
  console.log('[pilot-chunk] building FTS index on body…')
  await tbl.createIndex('body', {
    config: lancedb.Index.fts({
      withPosition: true, baseTokenizer: 'simple', stem: true, language: 'English',
      removeStopWords: false, asciiFolding: true, maxTokenLength: 40, lowercase: true,
    }),
  })
  const n = await tbl.countRows()
  console.log(`[pilot-chunk] DONE — ${PILOT_CHUNKS}: ${n} chunks indexed. est embed tokens/model ≈ ${estTokens.toLocaleString()}`)
}

main().catch((e) => { console.error('[pilot-chunk] FATAL', e); process.exit(1) })
