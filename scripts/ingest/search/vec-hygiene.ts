/**
 * vec-hygiene.ts — reconcile `corpus_vec` + `corpus_chunks` against `corpus_sections`.
 *
 * WHY: `corpus_fts` was cleaned on 5 Aug (fts-hygiene.ts — 13,575 duplicates, 5,586 orphans).
 * `corpus_vec` was built 22 Jul and has never been reconciled, so it carries the SAME drift:
 * sampling on 5 Aug found section ids deleted from `corpus_fts` still resolving in both
 * `corpus_vec` and `corpus_chunks`. Concretely, vector search can still surface superseded
 * TheyWorkForYou scrapeversions that keyword search no longer can — a worse failure than the
 * FTS one, because a user cannot tell a semantically-similar stale hit from a live one.
 *
 * WHAT MAKES THIS DIFFERENT FROM fts-hygiene
 * ------------------------------------------
 *  - Two tables, and they must agree. `corpus_vec` (chunkId, sectionId, corpus, tier, vector)
 *    is the ANN index; `corpus_chunks` (…, sectionTitle, body) is what it was embedded from.
 *    A chunk in one and not the other is its own defect, so parity is checked explicitly.
 *  - The grain is a CHUNK, not a section: one section fans out to N chunks (21.8M chunks over
 *    ~16.5M sections). So "orphan" means the chunk's `sectionId` no longer exists in
 *    `corpus_sections` — the id to reconcile is a foreign key, not the row's own key.
 *  - `corpus_vec` predates a lot of ingest, so rows MISSING from it are expected and are NOT
 *    drift. They are reported separately because they bound vector recall for the legislation
 *    stream, which is the live question this sprint — but they are not something to delete.
 *
 * ORDER OF OPERATIONS, as with fts-hygiene: prove the audit is exhaustive, back up whole rows
 * before deleting anything, dry-run, then apply. `rows NOT reached` must be 0 or the audit did
 * not see the whole table and must not be deleted on.
 *
 * NOTE ON REBUILD COST — read before deleting. Removing rows from `corpus_vec` invalidates part
 * of the IVF_PQ index. LanceDB filters deleted rows at query time, so results stay CORRECT
 * without a rebuild; the cost is recall/latency drift, not wrong answers. The vector rebuild is
 * the 64 GB-class `vector-index` heavy job, an order of magnitude dearer than the FTS one — so
 * decide deliberately whether the deletion warrants it rather than reflexively rebuilding.
 *
 * USAGE
 *   npx tsx search/vec-hygiene.ts audit [--corpus=X] [--tier=legislation]
 *   npx tsx search/vec-hygiene.ts export
 *   npx tsx search/vec-hygiene.ts delete-orphans [--apply]
 *
 * Env: NEON_DATABASE_URL + CLOUDFLARE_R2_* (same as build-vector-index.ts).
 */
import fs from 'fs'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { Pool } from 'pg'
import { connectLance } from './lance'
import { VEC_TABLE, CHUNKS_TABLE } from './vector-common'
import { r2Put, r2List } from '../shared/r2-client'

const CMD = process.argv[2] ?? 'audit'
const APPLY = process.argv.includes('--apply')
const arg = (n: string) => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`))
  return a ? a.split('=')[1] : null
}
const CORPUS_ARG = arg('corpus')

const STATE_DIR = path.join(__dirname, '.vec-hygiene')
const MANIFEST_PATH = path.join(STATE_DIR, 'manifest.json')
/**
 * Ids per `IN (…)` predicate.
 *
 * ⚠ MEASURED 11 Aug 2026: the cost of a delete is per-PREDICATE, not per-row. `corpus_chunks` and
 * `corpus_vec` have no scalar index on `chunkId`, so every `delete(chunkId IN (…))` scans the
 * whole 22.5M-row table — **~22.5 seconds per batch whatever the batch holds.** At 400 that made
 * 89,377 orphans × 2 tables = 448 scans = 138 minutes. Raising the batch cuts the number of scans
 * proportionally; the predicate string is the only thing that grows (~45 bytes per id, so 2,000
 * ids ≈ 90 KB, which DataFusion parses without complaint).
 *
 * Env-tunable rather than simply raised, because the safe ceiling depends on the predicate parser
 * and nobody has probed where it breaks. 400 stays the default so existing behaviour is unchanged.
 */
const ID_CHUNK = parseInt(process.env.VEC_HYGIENE_ID_CHUNK ?? '400', 10)
const PART_BYTES = 32 * 1024 * 1024

const log = (m: string) => console.log(`[vec-hygiene] ${m}`)
const esc = (s: string) => s.replace(/'/g, "''")
const inList = (col: string, ids: string[]) => `${col} IN (${ids.map((i) => `'${esc(i)}'`).join(',')})`

function chunk<T>(a: T[], n: number): T[][] {
  const o: T[][] = []
  for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n))
  return o
}

interface OrphanChunk { chunkId: string; sectionId: string; corpus: string; tier: string }
interface Manifest {
  auditedAt: string
  vecRows: number
  chunkRows: number
  unreachedVec: number
  unreachedChunks: number
  corporaAudited: number
  /** chunk rows whose sectionId is absent from corpus_sections entirely — deletable drift */
  orphans: OrphanChunk[]
  /** sectionId exists but is no longer status='compiled' — reported, NOT deleted */
  stale: OrphanChunk[]
  /** chunkIds appearing more than once within corpus_vec */
  duplicateChunkIds: { chunkId: string; corpus: string; copies: number }[]
  /** in corpus_chunks but not corpus_vec, and vice versa — the two must agree */
  parityChunksOnly: number
  parityVecOnly: number
  /** compiled sections with NO chunk at all — expected (index predates ingest), not drift */
  sectionsUnvectored: { corpus: string; tier: string; sections: number }[]
  perCorpus: {
    corpus: string; tier: string; compiledSections: number; vectoredSections: number
    vecChunks: number; chunkChunks: number; orphans: number; stale: number; dupChunkIds: number
  }[]
}

function readManifest(): Manifest {
  if (!fs.existsSync(MANIFEST_PATH)) throw new Error(`no manifest — run \`vec-hygiene.ts audit\` first`)
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
}

function newPool(): Pool {
  return new Pool({
    connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false },
    max: 4, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 20_000,
    statement_timeout: 600_000, query_timeout: 600_000, keepAlive: true,
  })
}

async function audit(): Promise<void> {
  const pool = newPool()
  await pool.query('SELECT 1')
  const conn = await connectLance()
  const vec = await conn.openTable(VEC_TABLE)
  const chunks = await conn.openTable(CHUNKS_TABLE)

  const vecRows = await vec.countRows()
  const chunkRows = await chunks.countRows()
  log(`${VEC_TABLE}=${vecRows.toLocaleString()} rows  ${CHUNKS_TABLE}=${chunkRows.toLocaleString()} rows`)

  const corpora = CORPUS_ARG
    ? [CORPUS_ARG]
    : (await pool.query<{ corpus: string }>(`SELECT DISTINCT corpus FROM corpus_sections ORDER BY corpus`)).rows.map((r) => r.corpus)
  log(`auditing ${corpora.length} corpora…`)

  const orphans: OrphanChunk[] = []
  const stale: OrphanChunk[] = []
  const duplicateChunkIds: Manifest['duplicateChunkIds'] = []
  const sectionsUnvectored: Manifest['sectionsUnvectored'] = []
  const perCorpus: Manifest['perCorpus'] = []
  let scannedVec = 0, scannedChunks = 0, parityChunksOnly = 0, parityVecOnly = 0

  for (const corpus of corpora) {
    const compiled = new Set<string>(
      (await pool.query<{ id: string }>(
        `SELECT id FROM corpus_sections WHERE corpus=$1 AND status='compiled'`, [corpus])).rows.map((r) => r.id))
    const notCompiled = new Set<string>(
      (await pool.query<{ id: string }>(
        `SELECT id FROM corpus_sections WHERE corpus=$1 AND status IS DISTINCT FROM 'compiled'`, [corpus])).rows.map((r) => r.id))

    const vArrow = await vec.query().where(`corpus = '${esc(corpus)}'`).select(['chunkId', 'sectionId', 'tier']).toArrow()
    const cArrow = await chunks.query().where(`corpus = '${esc(corpus)}'`).select(['chunkId']).toArrow()
    scannedVec += vArrow.numRows
    scannedChunks += cArrow.numRows

    if (vArrow.numRows === 0 && cArrow.numRows === 0) {
      if (compiled.size) sectionsUnvectored.push({ corpus, tier: '(none)', sections: compiled.size })
      perCorpus.push({ corpus, tier: '(none)', compiledSections: compiled.size, vectoredSections: 0, vecChunks: 0, chunkChunks: 0, orphans: 0, stale: 0, dupChunkIds: 0 })
      continue
    }

    const vChunkId = vArrow.getChild('chunkId')!
    const vSectionId = vArrow.getChild('sectionId')!
    const vTier = vArrow.getChild('tier')
    const seenChunk = new Set<string>()
    const dupCount = new Map<string, number>()
    const vectoredSections = new Set<string>()
    let tier = '(none)'
    let nOrphan = 0, nStale = 0

    for (let i = 0; i < vArrow.numRows; i++) {
      const chunkId = vChunkId.get(i) as string
      const sectionId = vSectionId.get(i) as string
      if (tier === '(none)' && vTier) tier = (vTier.get(i) as string) ?? '(none)'
      if (seenChunk.has(chunkId)) { dupCount.set(chunkId, (dupCount.get(chunkId) ?? 1) + 1); continue }
      seenChunk.add(chunkId)
      vectoredSections.add(sectionId)
      if (!compiled.has(sectionId) && !notCompiled.has(sectionId)) {
        orphans.push({ chunkId, sectionId, corpus, tier }); nOrphan++
      } else if (!compiled.has(sectionId)) {
        stale.push({ chunkId, sectionId, corpus, tier }); nStale++
      }
    }
    for (const [chunkId, copies] of dupCount) duplicateChunkIds.push({ chunkId, corpus, copies })

    // Parity: the embedded set and the source-of-embedding set must be the same chunks.
    const cChunkId = cArrow.getChild('chunkId')!
    const chunkSet = new Set<string>()
    for (let i = 0; i < cArrow.numRows; i++) chunkSet.add(cChunkId.get(i) as string)
    for (const id of chunkSet) if (!seenChunk.has(id)) parityChunksOnly++
    for (const id of seenChunk) if (!chunkSet.has(id)) parityVecOnly++

    const unvectored = compiled.size - [...vectoredSections].filter((s) => compiled.has(s)).length
    if (unvectored > 0) sectionsUnvectored.push({ corpus, tier, sections: unvectored })

    perCorpus.push({
      corpus, tier, compiledSections: compiled.size, vectoredSections: vectoredSections.size,
      vecChunks: vArrow.numRows, chunkChunks: cArrow.numRows, orphans: nOrphan, stale: nStale,
      dupChunkIds: dupCount.size,
    })
    if (nOrphan || nStale || dupCount.size) {
      log(`  ${corpus} [${tier}]: vec=${vArrow.numRows.toLocaleString()} orphans=${nOrphan} stale=${nStale} dupChunkIds=${dupCount.size}`)
    }
  }
  await pool.end()

  const m: Manifest = {
    auditedAt: new Date().toISOString(), vecRows, chunkRows,
    unreachedVec: vecRows - scannedVec, unreachedChunks: chunkRows - scannedChunks,
    corporaAudited: corpora.length, orphans, stale, duplicateChunkIds,
    parityChunksOnly, parityVecOnly, sectionsUnvectored, perCorpus,
  }
  fs.mkdirSync(STATE_DIR, { recursive: true })
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2))

  const unvecTotal = sectionsUnvectored.reduce((a, s) => a + s.sections, 0)
  const legis = perCorpus.filter((p) => p.tier === 'legislation')
  log('')
  log('================ VECTOR AUDIT ================')
  log(`corpus_vec rows        ${vecRows.toLocaleString()}   scanned ${scannedVec.toLocaleString()}   NOT reached ${m.unreachedVec.toLocaleString()}${m.unreachedVec === 0 ? ' ✓' : ' ⚠ INCOMPLETE'}`)
  log(`corpus_chunks rows     ${chunkRows.toLocaleString()}   scanned ${scannedChunks.toLocaleString()}   NOT reached ${m.unreachedChunks.toLocaleString()}${m.unreachedChunks === 0 ? ' ✓' : ' ⚠ INCOMPLETE'}`)
  log(`ORPHAN chunks          ${orphans.length.toLocaleString()}  (sectionId gone from corpus_sections — deletable drift)`)
  log(`stale chunks           ${stale.length.toLocaleString()}  (section exists, not 'compiled' — NOT deleted)`)
  log(`duplicate chunkIds     ${duplicateChunkIds.length.toLocaleString()}`)
  log(`parity: chunks-only    ${parityChunksOnly.toLocaleString()}   vec-only ${parityVecOnly.toLocaleString()}`)
  log(`compiled sections with NO vector  ${unvecTotal.toLocaleString()}  (expected — index predates ingest; NOT drift)`)
  log(`  of which legislation-tier: ${sectionsUnvectored.filter((s) => s.tier === 'legislation').reduce((a, s) => a + s.sections, 0).toLocaleString()}`)
  log(`legislation tier: ${legis.reduce((a, p) => a + p.vecChunks, 0).toLocaleString()} chunks over ${legis.reduce((a, p) => a + p.compiledSections, 0).toLocaleString()} compiled sections`)
  log(`manifest               ${MANIFEST_PATH}`)
  log('==============================================')
}

/** Full rows to R2 before any deletion. The vector column is dropped — it is 768 floats per row
 *  and is re-derivable by embedding the chunk body, which IS saved. */
async function exportSafetyRecord(): Promise<void> {
  const m = readManifest()
  const conn = await connectLance()
  const chunks = await conn.openTable(CHUNKS_TABLE)
  const fields = (await chunks.schema()).fields.map((f) => f.name)
  const ids = m.orphans.map((o) => o.chunkId)
  if (!ids.length) { log('nothing to export'); return }

  const stamp = m.auditedAt.replace(/[:.]/g, '-')
  let part = 0, rowsOut = 0, bytesOut = 0, bufBytes = 0
  let buf: string[] = []
  const keys: string[] = []
  const flush = async () => {
    if (!buf.length) return
    const key = `_search/vec-hygiene-backup/${stamp}/orphan-chunks.part-${String(++part).padStart(4, '0')}.jsonl`
    const body = buf.join('\n')
    await r2Put(key, body, 'application/x-ndjson')
    keys.push(key); bytesOut += Buffer.byteLength(body); buf = []; bufBytes = 0
  }
  for (const c of chunk(ids, ID_CHUNK)) {
    const rows = (await chunks.query().where(inList('chunkId', c)).select(fields).toArray()) as Record<string, unknown>[]
    for (const r of rows) {
      const plain: Record<string, unknown> = {}
      for (const f of fields) { const v = r[f]; plain[f] = typeof v === 'bigint' ? Number(v) : v }
      const line = JSON.stringify(plain)
      buf.push(line); bufBytes += line.length; rowsOut++
      if (bufBytes >= PART_BYTES) await flush()
    }
    process.stdout.write(`\r  ${rowsOut} rows collected, ${part} parts…`)
  }
  await flush()
  process.stdout.write('\n')
  await r2Put(`_search/vec-hygiene-backup/${stamp}/manifest.json`, JSON.stringify(m, null, 2), 'application/json')
  fs.writeFileSync(path.join(STATE_DIR, 'export.json'), JSON.stringify({ stamp, keys, rows: rowsOut }, null, 2))
  log(`exported ${rowsOut} orphan chunk rows in ${part} parts (${(bytesOut / 1024 / 1024).toFixed(1)} MB) → _search/vec-hygiene-backup/${stamp}/`)
}

/**
 * The safety export must belong to THE AUDIT BEING DELETED AGAINST, and must be complete.
 *
 * ⚠ This guard used to be `fs.existsSync(export.json)` and nothing more. `export.json` is not
 * stamped per run, so a marker left by ANY previous export satisfied it. On 10 Aug 2026 a 6 Aug
 * marker (stamp 2026-08-06T05-22-55-495Z, 6,464 rows) sat on disk while a 89,377-row export was
 * still four parts from finishing — existence-as-proof would have authorised an irreversible
 * delete of 89,377 rows backed by a safety record of 6,464 unrelated ones. The guard was exactly
 * as strong as no guard at the one moment it mattered.
 *
 * Same family as docs/CLAUDE.md §18/§19: a signal that looks like a measurement but carries no
 * provenance. Three things are checked, not one — whose export it is, whether it covers every row,
 * and whether the objects it names are really in R2.
 */
async function assertSafetyExport(m: Manifest): Promise<void> {
  const markerPath = path.join(STATE_DIR, 'export.json')
  if (!fs.existsSync(markerPath)) {
    throw new Error('no safety export — run `vec-hygiene.ts export` first')
  }
  let marker: { stamp?: string; rows?: number; keys?: string[] }
  try { marker = JSON.parse(fs.readFileSync(markerPath, 'utf8')) } catch (e) {
    throw new Error(`safety export marker is unreadable (${(e as Error).message}) — re-run \`export\``)
  }
  const wantStamp = m.auditedAt.replace(/[:.]/g, '-')
  if (marker.stamp !== wantStamp) {
    throw new Error(
      `safety export is for a DIFFERENT audit: marker stamp ${marker.stamp ?? '(none)'}, ` +
      `this manifest ${wantStamp}. Re-run \`vec-hygiene.ts export\` — refusing to delete ` +
      `${m.orphans.length.toLocaleString()} rows against someone else's backup.`)
  }
  if (marker.rows !== m.orphans.length) {
    throw new Error(
      `safety export is INCOMPLETE: it records ${Number(marker.rows ?? 0).toLocaleString()} rows, ` +
      `the manifest has ${m.orphans.length.toLocaleString()} orphans. Re-run \`export\`.`)
  }
  const named = marker.keys ?? []
  if (!named.length) throw new Error('safety export names no objects — re-run `export`')
  const present = new Set(await r2List(`_search/vec-hygiene-backup/${wantStamp}/`))
  const missing = named.filter((k) => !present.has(k))
  if (missing.length) {
    throw new Error(
      `safety export names ${named.length} objects but ${missing.length} are NOT in R2 ` +
      `(e.g. ${missing[0]}). Re-run \`export\`.`)
  }
  log(`safety export verified: stamp ${marker.stamp}, ${Number(marker.rows).toLocaleString()} rows, ${named.length}/${named.length} objects present in R2`)
}

async function deleteOrphans(): Promise<void> {
  const m = readManifest()
  if (APPLY) await assertSafetyExport(m)
  const conn = await connectLance()
  const ids = m.orphans.map((o) => o.chunkId)
  log(`orphan chunks to remove: ${ids.length.toLocaleString()} (from BOTH ${VEC_TABLE} and ${CHUNKS_TABLE})`)
  if (!ids.length) { log('nothing to do.'); return }

  if (!APPLY) {
    const byCorpus = new Map<string, number>()
    for (const o of m.orphans) byCorpus.set(o.corpus, (byCorpus.get(o.corpus) ?? 0) + 1)
    log('DRY RUN — no writes. Per corpus:')
    for (const [c, n] of [...byCorpus].sort((a, b) => b[1] - a[1])) log(`  ${c}: ${n}`)
    log('re-run with --apply to execute.')
    return
  }

  for (const tableName of [VEC_TABLE, CHUNKS_TABLE]) {
    const tbl = await conn.openTable(tableName)
    const before = await tbl.countRows()
    let done = 0
    for (const c of chunk(ids, ID_CHUNK)) {
      await tbl.delete(inList('chunkId', c))
      done += c.length
      process.stdout.write(`\r  ${tableName}: deleted ${done}/${ids.length}…`)
    }
    process.stdout.write('\n')
    const after = await tbl.countRows()
    log(`${tableName}: ${before.toLocaleString()} → ${after.toLocaleString()} (removed ${(before - after).toLocaleString()})`)
  }
  log('NOTE: corpus_vec ANN index now has deleted rows filtered at query time — results stay')
  log('correct. A rebuild is the 64 GB-class `vector-index` heavy job; decide deliberately.')
}

async function main() {
  switch (CMD) {
    case 'audit': return audit()
    case 'export': return exportSafetyRecord()
    case 'delete-orphans': return deleteOrphans()
    default: console.error(`unknown command "${CMD}"`); process.exit(1)
  }
}
main().catch((e) => { console.error('[vec-hygiene] FATAL', e instanceof Error ? e.stack ?? e.message : e); process.exit(1) })
