/**
 * backfill-citations.ts — Search S1b archetype-A RETRIEVAL fix, applied IN PLACE
 * to the existing (gated, non-prod) corpus_fts Lance dataset.
 *
 * Why in-place: the canonical fix is in build-fts-index.ts (bakes the citation at
 * load time) — but a from-scratch rebuild re-fetches 16.5M bodies from R2 (~36h).
 * The bodies are ALREADY in the Lance table, so we rewrite only the ~1.6M
 * legislation rows in place (read pinned to the pre-backfill version so
 * mergeInsert's fragment rewrites can't disturb the ordered scan), then rebuild
 * the FTS index. Reversible: `tbl.restore(<ver0>)` rolls the data back.
 *
 * For each legislation row: gid = id middle segment → LegislationItem.title →
 * buildCitation() → prepend a citation header to `body` (BM25-searchable) and
 * fold the act citation into `sectionTitle` (title-boost match). See citation.ts.
 *
 * Usage:
 *   tsx search/backfill-citations.ts --dry-run     # coverage only, no writes
 *   tsx search/backfill-citations.ts               # backfill + reindex
 *   tsx search/backfill-citations.ts --no-reindex  # backfill only
 *   tsx search/backfill-citations.ts --reindex-only # skip backfill, just rebuild index
 * Env: NEON_DATABASE_URL (title map) + R2 creds (Lance). BF_BATCH (default 5000).
 */
import fs from 'fs'
import path from 'path'
import { Pool } from 'pg'
import { connectLance, FTS_TABLE, lancedb } from './lance'
import { gidFromId, buildCitation, applyCitationToBody } from './citation'

const BATCH = parseInt(process.env.BF_BATCH ?? '5000', 10)
const DRY = process.argv.includes('--dry-run')
const NO_REINDEX = process.argv.includes('--no-reindex')
const REINDEX_ONLY = process.argv.includes('--reindex-only')
const CKPT = path.join(__dirname, '.citation-backfill.checkpoint.json')

// legislation corpora (mirrors corpus-map tier==='legislation'); caselaw is
// excluded — its ids already carry the neutral citation inline.
const LEG_CORPORA = [
  'primary-acts-pre-2000', 'primary-acts-2000plus', 'si-pre-2010', 'si-2010plus',
  'regional', 'retained-eu', 'eur-lex', 'explanatory-notes', 'explanatory-memoranda',
]

const SCHEMA_COLS = ['id', 'corpus', 'tier', 'jurisdiction', 'sectionTitle', 'body',
  'itemDate', 'speaker', 'parentDocId', 'availability_status', 'wordCount'] as const

type Row = Record<(typeof SCHEMA_COLS)[number], any>

/**
 * gid → act title.
 *
 * ⚠ Repointed from the legacy `LegislationItem` to `corpus_acts` (V33 §3b). This was the LAST
 * reference to `LegislationItem` outside `scrutinise-web/`, and `V26_LEGACY_DROP_RECHECK.md`
 * named it as one of the two things blocking the legacy DROP. The three search-side reads
 * (`fts-search.ts`, `vector-search.ts`, `citation-resolver.ts`) moved on 7 Aug; this one did not,
 * because it is build-time rather than serve-time and nobody was looking at it.
 *
 * `corpus_acts` is a verified drop-in, measured whole-table: `LegislationItem` has 135,531
 * distinct gid→title, `corpus_acts` has 135,531 titled rows (of 250,808 — a SUPERSET), 0 gids
 * missing and 0 titles differing. The column is `gid` rather than `legislationGovUkId`.
 */
async function loadTitleMap(): Promise<Map<string, string>> {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2, statement_timeout: 120_000 })
  const { rows } = await pool.query<{ gid: string; title: string }>(
    `SELECT gid, title FROM corpus_acts WHERE gid IS NOT NULL AND title IS NOT NULL`)
  await pool.end()
  const m = new Map<string, string>()
  for (const r of rows) m.set(r.gid, r.title)
  console.log(`[backfill] title map: ${m.size} gid→title entries`)
  return m
}

function loadCkpt(): { cursor: string; updated: number; skipped: number } {
  try { return JSON.parse(fs.readFileSync(CKPT, 'utf8')) } catch { return { cursor: '', updated: 0, skipped: 0 } }
}
function saveCkpt(c: any) { fs.writeFileSync(CKPT, JSON.stringify(c, null, 2)) }

async function reindex(tbl: lancedb.Table) {
  console.log('[backfill] optimize() before reindex…')
  try { const s = await tbl.optimize(); console.log('[backfill] optimize:', JSON.stringify(s?.compaction ?? s)) }
  catch (e) { console.warn('[backfill] optimize warning:', (e as Error).message) }
  // Match the v1 (no-positions) index config exactly — positions are PARKED (v2/Hetzner).
  console.log('[backfill] rebuilding FTS index on `body` (withPosition=false)…')
  const t0 = Date.now()
  await tbl.createIndex('body', {
    replace: true,
    config: lancedb.Index.fts({
      withPosition: false, baseTokenizer: 'simple', stem: true, language: 'English',
      removeStopWords: false, asciiFolding: true, maxTokenLength: 40, lowercase: true,
    }),
  })
  console.log(`[backfill] FTS index rebuilt in ${((Date.now() - t0) / 1000 / 60).toFixed(1)} min`)
}

async function main() {
  const conn = await connectLance()
  const writeTbl = await conn.openTable(FTS_TABLE)
  const ver0 = await writeTbl.version()
  console.log(`[backfill] table=${FTS_TABLE} rows=${await writeTbl.countRows()} version=${ver0} batch=${BATCH}${DRY ? ' DRY-RUN' : ''}`)

  if (REINDEX_ONLY) { await reindex(writeTbl); console.log('[backfill] reindex-only done.'); return }

  const titleMap = await loadTitleMap()

  // Read handle pinned to the pre-backfill version: a stable, id-ordered snapshot
  // (the table was loaded ORDER BY id ASC) so mergeInsert fragment rewrites can't
  // perturb the ongoing cursor scan.
  const readTbl = await conn.openTable(FTS_TABLE)
  await readTbl.checkout(ver0)

  const inList = LEG_CORPORA.map((x) => `'${x}'`).join(',')
  const ck = loadCkpt()
  if (ck.cursor) console.log(`[backfill] resuming from cursor=${ck.cursor} (updated=${ck.updated} skipped=${ck.skipped})`)
  const missingGids = new Set<string>()
  const t0 = Date.now()

  while (true) {
    const rows = (await readTbl.query()
      .where(`corpus IN (${inList}) AND id > '${ck.cursor.replace(/'/g, "''")}'`)
      .limit(BATCH)
      .toArray()) as any[]
    if (rows.length === 0) break
    rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

    const updates: Row[] = []
    for (const r of rows) {
      const gid = gidFromId(r.id)
      const title = gid ? titleMap.get(gid) ?? null : null
      const cit = buildCitation(r.id, title, r.sectionTitle ?? null)
      if (!cit) { ck.skipped++; if (gid) missingGids.add(gid); continue }
      const rec: Row = {} as Row
      for (const c of SCHEMA_COLS) rec[c] = r[c] ?? null
      rec.body = applyCitationToBody(cit.bodyHeader, r.body ?? '')
      rec.sectionTitle = cit.sectionTitle
      updates.push(rec)
      ck.updated++
    }

    if (!DRY && updates.length) {
      await writeTbl.mergeInsert('id').whenMatchedUpdateAll().execute(updates)
    }

    ck.cursor = rows[rows.length - 1].id
    if (!DRY) saveCkpt(ck)
    const el = (Date.now() - t0) / 1000
    const done = ck.updated + ck.skipped
    console.log(`[backfill] cursor=${ck.cursor.slice(0, 48)} | updated=${ck.updated} skipped=${ck.skipped} | ${(done / Math.max(el, 0.001)).toFixed(0)} rows/s`)

    if (DRY && done >= 60000) { console.log('[backfill] dry-run sample cap (60k) reached — stopping early.'); break }
  }

  console.log(`\n[backfill] PASS DONE: updated=${ck.updated} skipped=${ck.skipped} (missing-gid distinct acts=${missingGids.size})`)
  if (missingGids.size) console.log('[backfill] sample missing gids:', [...missingGids].slice(0, 15).join(', '))

  if (DRY) { console.log('[backfill] dry-run: no writes, no reindex.'); return }
  if (!NO_REINDEX) await reindex(writeTbl)
  else console.log('[backfill] --no-reindex: index NOT rebuilt (stale until reindex).')
  console.log(`[backfill] DONE. ver0=${ver0} (restore with tbl.restore(${ver0}) to roll back the data).`)
}

main().catch((e) => { console.error('[backfill] FATAL', e); process.exit(1) })
