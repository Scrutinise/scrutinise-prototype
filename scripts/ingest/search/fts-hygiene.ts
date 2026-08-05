/**
 * fts-hygiene.ts — remove DUPLICATE and ORPHANED rows from `corpus_fts`.
 *
 * WHY THIS EXISTS
 * ---------------
 * The 4 Aug id-level reconciliation (docs/SPRINT.md §1) found three drift modes between
 * `corpus_sections` and `corpus_fts`. A COUNT-based audit missed all but one of them,
 * because five pwdata corpora hold MORE rows in the index than in the source table, so the
 * per-corpus counts show a *negative* gap and the three modes cancel out:
 *
 *   1. ~13,575 DUPLICATES — the same section id present more than once. Every copy is its
 *      own document to BM25, so it distorts scoring (term/document frequencies) and can
 *      surface the same result twice in one result set.
 *   2. ~1,030+ ORPHANS — superseded Hansard day-files whose `corpus_sections` row no longer
 *      exists. Still searchable, still returned to users, backed by nothing.
 *   3. 268 MISSING — fixed already; `fts-catchup.ts` handles this mode and only this mode.
 *
 * `fts-catchup.ts` cannot fix 1 or 2: it only ever APPENDS ids present in the source and
 * absent from the index. Removal needs its own tool, which is this one.
 *
 * THE ASYMMETRY THAT DRIVES THE DESIGN
 * ------------------------------------
 * Duplicates are recoverable: the surviving copy stays, and any copy is re-derivable from
 * `corpus_sections` + R2 in any case. Orphans are NOT — their source rows are already gone,
 * so the index row is the last remaining record of what they were. So:
 *   - EVERY row this tool removes is exported to R2 IN FULL (body included) BEFORE deletion,
 *     not just its id. For orphans that export is the only surviving copy, which is the whole
 *     point; ids alone would preserve nothing recoverable.
 *   - Orphan deletion is a separate command from duplicate deletion, so the irreversible half
 *     is never a side effect of running the reversible half.
 *   - Nothing deletes without `--apply`. The default is a dry run.
 *
 * A THIRD CATEGORY THIS TOOL DELIBERATELY DOES NOT DELETE
 * -------------------------------------------------------
 * A row can also be in the index while its source row exists but is no longer `status =
 * 'compiled'` (withdrawn, superseded, re-queued). That is NOT the "source row no longer
 * exists" case, and it is not what was measured on 4 Aug. It is reported as `stale` and left
 * alone: deciding whether a de-compiled section should stay searchable is a policy question,
 * not index hygiene. If the audit shows a large `stale` count, raise it rather than folding
 * it into a delete.
 *
 * AFTER ANY DELETION, THE INDEX MUST BE REBUILT
 * ---------------------------------------------
 * A LanceDB delete leaves the FTS index describing rows that are gone, exactly the
 * inconsistent state a backfill leaves in the other direction (INGEST_PLAYBOOK §20).
 * Rebuild via the Heavy Job Runner — peak RSS 19.8 GB, so never Railway (docs/CLAUDE.md §17):
 *     cd scripts/ingest && npx tsx ../ops/heavy-job/run.ts run fts-index
 * then RESTART `fts-serve`, which calls openTable() once at boot and otherwise keeps serving
 * the old snapshot.
 *
 * USAGE
 *   npx tsx search/fts-hygiene.ts audit                      # read-only; writes the manifest
 *   npx tsx search/fts-hygiene.ts export                     # full rows → R2 safety record
 *   npx tsx search/fts-hygiene.ts delete-duplicates [--apply]
 *   npx tsx search/fts-hygiene.ts delete-orphans    [--apply]
 *   npx tsx search/fts-hygiene.ts verify                     # counts + sample queries
 *
 *   --corpus=X   limit the audit to one corpus (debugging)
 *
 * Env: NEON_DATABASE_URL + CLOUDFLARE_R2_* (same as build-fts-index.ts / fts-catchup.ts).
 */
import fs from 'fs'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { Pool } from 'pg'
import { connectLance, FTS_TABLE } from './lance'
import { r2Put } from '../shared/r2-client'

const CMD = process.argv[2] ?? 'audit'
const APPLY = process.argv.includes('--apply')
const CORPUS_ARG = (() => {
  const a = process.argv.find((x) => x.startsWith('--corpus='))
  return a ? a.split('=')[1] : null
})()

const STATE_DIR = path.join(__dirname, '.fts-hygiene')
const MANIFEST_PATH = path.join(STATE_DIR, 'manifest.json')
/** Chunk size for `id IN (...)` predicates — keeps the filter string well inside limits. */
const ID_CHUNK = 400
/** Flush a backup part at roughly this size, so peak memory is one part, not one category. */
const PART_BYTES = 32 * 1024 * 1024

const log = (m: string) => console.log(`[fts-hygiene] ${m}`)
const esc = (s: string) => s.replace(/'/g, "''")
const inList = (ids: string[]) => `id IN (${ids.map((i) => `'${esc(i)}'`).join(',')})`

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

interface DupEntry {
  id: string
  corpus: string
  /** How many copies are in the index. Excess to delete = copies - 1. */
  copies: number
}
interface OrphanEntry {
  id: string
  corpus: string
}
interface Manifest {
  auditedAt: string
  table: string
  totalRowsBefore: number
  /** Rows the per-corpus scan did not reach. Must be 0 or the audit is not exhaustive. */
  unreachedRows: number
  corporaAudited: number
  duplicates: DupEntry[]
  /** Sum of (copies - 1) — the number of rows duplicate removal will delete. */
  duplicateExcessRows: number
  orphans: OrphanEntry[]
  /** Source row exists but is no longer status='compiled'. Reported, NOT deleted. */
  stale: OrphanEntry[]
  perCorpus: {
    corpus: string
    sections: number
    fts: number
    dupIds: number
    dupExcess: number
    orphans: number
    stale: number
  }[]
}

function readManifest(): Manifest {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(`no manifest at ${MANIFEST_PATH} — run \`fts-hygiene.ts audit\` first`)
  }
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
}

function newPool(): Pool {
  return new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 4,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 20_000,
    statement_timeout: 600_000,
    query_timeout: 600_000,
    keepAlive: true,
  })
}

/* ------------------------------------------------------------------ audit */

async function audit(): Promise<void> {
  const pool = newPool()
  await pool.query('SELECT 1')
  const conn = await connectLance()
  const tbl = await conn.openTable(FTS_TABLE)

  const totalRowsBefore = await tbl.countRows()
  log(`table=${FTS_TABLE} rows=${totalRowsBefore.toLocaleString()}`)

  const corpora = CORPUS_ARG
    ? [CORPUS_ARG]
    : (
        await pool.query<{ corpus: string }>(
          // Enumerate from BOTH sides is impossible cheaply on the Lance side, so enumerate
          // every corpus the source has EVER had (no status filter) and prove exhaustiveness
          // afterwards by reconciling the scanned row count against countRows().
          `SELECT DISTINCT corpus FROM corpus_sections ORDER BY corpus`,
        )
      ).rows.map((r) => r.corpus)

  log(`auditing ${corpora.length} corpora…`)

  const duplicates: DupEntry[] = []
  const orphans: OrphanEntry[] = []
  const stale: OrphanEntry[] = []
  const perCorpus: Manifest['perCorpus'] = []
  let scannedFtsRows = 0

  for (const corpus of corpora) {
    // MEMORY NOTE. The biggest corpus here is 6.39M rows (pwdata-debates) and this runs on a
    // 16 GB box that already OOMs on a full reindex (docs/CLAUDE.md §17). Two choices keep the
    // per-corpus peak near ~2 GB instead of ~6 GB:
    //   1. Fetch the compiled and the not-compiled id sets SEPARATELY rather than pulling
    //      (id, status) for every row. "Not compiled" is tiny — 4,041 of 6.39M on the worst
    //      corpus — so this avoids a second full-size Set and 6.39M status strings.
    //   2. Read the index side as an ARROW table, not as JS objects. Arrow keeps the ids in
    //      packed buffers (~400 MB at 6.39M) where `.toArray()` would materialise 6.39M
    //      JS objects (~1.5 GB) before we even start counting.
    const compiled = new Set<string>(
      (await pool.query<{ id: string }>(
        `SELECT id FROM corpus_sections WHERE corpus = $1 AND status = 'compiled'`, [corpus],
      )).rows.map((r) => r.id),
    )
    const notCompiled = new Set<string>(
      (await pool.query<{ id: string }>(
        `SELECT id FROM corpus_sections WHERE corpus = $1 AND status IS DISTINCT FROM 'compiled'`, [corpus],
      )).rows.map((r) => r.id),
    )

    // Index side.
    const arrow = await tbl.query().where(`corpus = '${esc(corpus)}'`).select(['id']).toArrow()
    const idCol = arrow.getChild('id')
    const ftsRowCount = arrow.numRows
    scannedFtsRows += ftsRowCount

    if (ftsRowCount === 0 || !idCol) {
      perCorpus.push({ corpus, sections: compiled.size, fts: 0, dupIds: 0, dupExcess: 0, orphans: 0, stale: 0 })
      continue
    }

    let dupIds = 0
    let dupExcess = 0
    let orphanCount = 0
    let staleCount = 0

    // One pass. `seen` carries every id already met, so a repeat is a duplicate; `dupCount`
    // only ever holds the ids that actually repeat, which is thousands, not millions.
    const seen = new Set<string>()
    const dupCount = new Map<string, number>()
    for (let i = 0; i < ftsRowCount; i++) {
      const id = idCol.get(i) as string | null
      if (id == null) continue
      if (seen.has(id)) {
        dupCount.set(id, (dupCount.get(id) ?? 1) + 1)
        continue // orphan/stale classification happens once per distinct id, below
      }
      seen.add(id)
      if (!compiled.has(id) && !notCompiled.has(id)) {
        orphans.push({ id, corpus })
        orphanCount++
      } else if (!compiled.has(id)) {
        stale.push({ id, corpus })
        staleCount++
      }
    }
    for (const [id, copies] of dupCount) {
      duplicates.push({ id, corpus, copies })
      dupIds++
      dupExcess += copies - 1
    }
    perCorpus.push({
      corpus,
      sections: compiled.size,
      fts: ftsRowCount,
      dupIds,
      dupExcess,
      orphans: orphanCount,
      stale: staleCount,
    })

    if (dupIds || orphanCount || staleCount) {
      log(
        `  ${corpus}: sections=${compiled.size.toLocaleString()} fts=${ftsRowCount.toLocaleString()} ` +
          `dupIds=${dupIds} dupExcess=${dupExcess} orphans=${orphanCount} stale=${staleCount}`,
      )
    }
  }

  await pool.end()

  const duplicateExcessRows = duplicates.reduce((a, d) => a + d.copies - 1, 0)
  // Exhaustiveness proof. Rows sitting under a `corpus` value the source table no longer
  // knows about would never be scanned above, and would be invisible orphans. Any non-zero
  // value here means the audit did NOT see the whole table — do not delete on it.
  const unreachedRows = totalRowsBefore - scannedFtsRows

  const manifest: Manifest = {
    auditedAt: new Date().toISOString(),
    table: FTS_TABLE,
    totalRowsBefore,
    unreachedRows,
    corporaAudited: corpora.length,
    duplicates,
    duplicateExcessRows,
    orphans,
    stale,
    perCorpus,
  }
  fs.mkdirSync(STATE_DIR, { recursive: true })
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2))

  log('')
  log('================ AUDIT ================')
  log(`rows in table         ${totalRowsBefore.toLocaleString()}`)
  log(`rows scanned          ${scannedFtsRows.toLocaleString()}`)
  log(`rows NOT reached      ${unreachedRows.toLocaleString()}${unreachedRows === 0 ? '  ✓ audit is exhaustive' : '  ⚠ AUDIT INCOMPLETE — investigate before deleting'}`)
  log(`duplicate ids         ${duplicates.length.toLocaleString()}`)
  log(`  → rows to delete    ${duplicateExcessRows.toLocaleString()}  (keeping one copy each)`)
  log(`orphan rows           ${orphans.length.toLocaleString()}  (source row gone — IRREVERSIBLE)`)
  log(`stale rows            ${stale.length.toLocaleString()}  (source exists, not 'compiled' — NOT deleted)`)
  log(`manifest              ${MANIFEST_PATH}`)
  log('=======================================')
}

/* ----------------------------------------------------------------- export */

/**
 * Write the full content of every row that will be removed to R2, before anything is
 * deleted. For orphans this is the only copy that will exist afterwards, so it stores
 * whole rows — body included — not just ids.
 */
async function exportSafetyRecord(): Promise<void> {
  const m = readManifest()
  const conn = await connectLance()
  const tbl = await conn.openTable(FTS_TABLE)

  const fields = (await tbl.schema()).fields.map((f) => f.name)
  log(`exporting full rows (${fields.length} columns: ${fields.join(', ')})`)

  const stamp = m.auditedAt.replace(/[:.]/g, '-')
  const results: { category: string; key: string; rows: number }[] = []

  for (const [category, ids] of [
    ['duplicates', m.duplicates.map((d) => d.id)],
    ['orphans', m.orphans.map((o) => o.id)],
  ] as [string, string[]][]) {
    if (ids.length === 0) {
      log(`  ${category}: nothing to export`)
      continue
    }
    // Written in PARTS. These rows carry full bodies — Hansard day-files among them — so
    // accumulating all of them into one string to PUT would both spike memory and risk a
    // single oversized object. Each part is flushed to R2 and dropped from memory, so peak
    // stays at one part regardless of how many rows a future run has to save.
    let part = 0
    let rowsOut = 0
    let bytesOut = 0
    let buf: string[] = []
    let bufBytes = 0
    const keys: string[] = []

    const flush = async () => {
      if (buf.length === 0) return
      const key = `_search/hygiene-backup/${stamp}/${category}.part-${String(++part).padStart(4, '0')}.jsonl`
      const body = buf.join('\n')
      await r2Put(key, body, 'application/x-ndjson')
      keys.push(key)
      bytesOut += Buffer.byteLength(body)
      buf = []
      bufBytes = 0
    }

    for (const c of chunk(ids, ID_CHUNK)) {
      const rows = (await tbl.query().where(inList(c)).select(fields).toArray()) as Record<string, unknown>[]
      for (const r of rows) {
        // Arrow values (BigInt, typed vectors) are not JSON-serialisable as-is.
        const plain: Record<string, unknown> = {}
        for (const f of fields) {
          const v = (r as Record<string, unknown>)[f]
          plain[f] = typeof v === 'bigint' ? Number(v) : v
        }
        const line = JSON.stringify(plain)
        buf.push(line)
        bufBytes += line.length
        rowsOut++
        if (bufBytes >= PART_BYTES) await flush()
      }
      process.stdout.write(`\r  ${category}: ${rowsOut} rows collected, ${part} parts written…`)
    }
    await flush()
    process.stdout.write('\n')

    log(`  ${category}: ${rowsOut} rows in ${part} parts → s3://${process.env.CLOUDFLARE_R2_BUCKET_NAME}/_search/hygiene-backup/${stamp}/ (${(bytesOut / 1024 / 1024).toFixed(1)} MB)`)
    results.push({ category, key: keys.join(','), rows: rowsOut })
  }

  // The manifest itself goes alongside, so the backup is self-describing.
  const manifestKey = `_search/hygiene-backup/${stamp}/manifest.json`
  await r2Put(manifestKey, JSON.stringify({ ...m, exported: results }, null, 2), 'application/json')
  log(`  manifest → ${manifestKey}`)

  fs.writeFileSync(
    path.join(STATE_DIR, 'export.json'),
    JSON.stringify({ stamp, manifestKey, results }, null, 2),
  )
  log('export complete — safety record is on R2, outside the repo.')
}

/* ---------------------------------------------------------------- deletes */

function requireExport(): void {
  const p = path.join(STATE_DIR, 'export.json')
  if (!fs.existsSync(p)) {
    throw new Error('no safety export found — run `fts-hygiene.ts export` before deleting anything')
  }
}

/**
 * Duplicate removal. LanceDB has no "delete all but one" predicate, so this deletes every
 * copy of each duplicated id and re-adds exactly one — taken from the rows already read out
 * of the table, so the surviving row is byte-identical to a copy that was there, rather than
 * re-derived from R2 and possibly differing (a citation backfill, say, changes the body).
 * Where copies differ, the LONGEST body wins: the differences seen here come from a body
 * enrichment applied to some copies and not others, so longest = most enriched.
 */
async function deleteDuplicates(): Promise<void> {
  const m = readManifest()
  if (APPLY) requireExport()
  const conn = await connectLance()
  const tbl = await conn.openTable(FTS_TABLE)
  const fields = (await tbl.schema()).fields.map((f) => f.name)

  const before = await tbl.countRows()
  const ids = m.duplicates.map((d) => d.id)
  log(`duplicates: ${ids.length} ids, ${m.duplicateExcessRows} excess rows to remove`)
  log(`rows before: ${before.toLocaleString()}  →  expected after: ${(before - m.duplicateExcessRows).toLocaleString()}`)

  if (ids.length === 0) { log('nothing to do.'); return }

  if (!APPLY) {
    const sample = m.duplicates.slice(0, 10)
    log('DRY RUN — no writes. First 10 duplicate ids:')
    for (const d of sample) log(`  ${d.copies}× ${d.corpus}  ${d.id}`)
    const byCorpus = new Map<string, number>()
    for (const d of m.duplicates) byCorpus.set(d.corpus, (byCorpus.get(d.corpus) ?? 0) + d.copies - 1)
    log('rows to remove per corpus:')
    for (const [c, n] of [...byCorpus].sort((a, b) => b[1] - a[1])) log(`  ${c}: ${n}`)
    log('re-run with --apply to execute.')
    return
  }

  let deleted = 0
  let readded = 0
  for (const c of chunk(ids, ID_CHUNK)) {
    const rows = (await tbl.query().where(inList(c)).select(fields).toArray()) as Record<string, unknown>[]
    // Keep one row per id — the longest body among the copies.
    const keep = new Map<string, Record<string, unknown>>()
    for (const r of rows) {
      const id = r.id as string
      const cur = keep.get(id)
      const len = typeof r.body === 'string' ? r.body.length : 0
      const curLen = cur && typeof cur.body === 'string' ? cur.body.length : -1
      if (!cur || len > curLen) keep.set(id, r)
    }
    await tbl.delete(inList(c))
    deleted += rows.length
    const survivors = [...keep.values()].map((r) => {
      const plain: Record<string, unknown> = {}
      for (const f of fields) {
        const v = r[f]
        plain[f] = typeof v === 'bigint' ? Number(v) : v
      }
      return plain
    })
    await tbl.add(survivors)
    readded += survivors.length
    process.stdout.write(`\r  deleted ${deleted}, re-added ${readded}…`)
  }
  process.stdout.write('\n')

  const after = await tbl.countRows()
  log(`rows: ${before.toLocaleString()} → ${after.toLocaleString()} (removed ${(before - after).toLocaleString()}, expected ${m.duplicateExcessRows.toLocaleString()})`)
  if (before - after !== m.duplicateExcessRows) {
    log('!! removal count does not match the audit — investigate before rebuilding the index.')
    process.exitCode = 1
  }
}

/** Orphan removal. Irreversible from our data — the export on R2 is the only remaining copy. */
async function deleteOrphans(): Promise<void> {
  const m = readManifest()
  if (APPLY) requireExport()
  const conn = await connectLance()
  const tbl = await conn.openTable(FTS_TABLE)

  const before = await tbl.countRows()
  const ids = m.orphans.map((o) => o.id)
  log(`orphans: ${ids.length} rows whose corpus_sections source row no longer exists`)
  log(`rows before: ${before.toLocaleString()}  →  expected after: ${(before - ids.length).toLocaleString()}`)

  if (ids.length === 0) { log('nothing to do.'); return }

  if (!APPLY) {
    const byCorpus = new Map<string, number>()
    for (const o of m.orphans) byCorpus.set(o.corpus, (byCorpus.get(o.corpus) ?? 0) + 1)
    log('DRY RUN — no writes. Rows to remove per corpus:')
    for (const [c, n] of [...byCorpus].sort((a, b) => b[1] - a[1])) log(`  ${c}: ${n}`)
    log('Every id that would be deleted:')
    for (const o of m.orphans) log(`  ${o.corpus}  ${o.id}`)
    log(`THIS IS IRREVERSIBLE — ${ids.length} rows. Review the list above, then re-run with --apply.`)
    return
  }

  let deleted = 0
  for (const c of chunk(ids, ID_CHUNK)) {
    await tbl.delete(inList(c))
    deleted += c.length
    process.stdout.write(`\r  deleted ${deleted}/${ids.length}…`)
  }
  process.stdout.write('\n')

  const after = await tbl.countRows()
  log(`rows: ${before.toLocaleString()} → ${after.toLocaleString()} (removed ${(before - after).toLocaleString()}, expected ${ids.length.toLocaleString()})`)
  if (before - after !== ids.length) {
    log('!! removal count does not match the audit — investigate before rebuilding the index.')
    process.exitCode = 1
  }
}

/* ----------------------------------------------------------------- verify */

async function verify(): Promise<void> {
  const conn = await connectLance()
  const tbl = await conn.openTable(FTS_TABLE)
  const rows = await tbl.countRows()
  log(`rows: ${rows.toLocaleString()}`)
  for (const idx of await tbl.listIndices()) {
    const name = (idx as unknown as { name: string }).name
    const st = (await tbl.indexStats(name)) as unknown as { numIndexedRows?: number; numUnindexedRows?: number }
    log(`  ${name}: indexed=${(st.numIndexedRows ?? 0).toLocaleString()} unindexed=${(st.numUnindexedRows ?? 0).toLocaleString()}`)
  }
  for (const q of ['data protection', 'landlord repairs obligations', 'corporation tax relief']) {
    const t0 = Date.now()
    const res = (await tbl.search(q, 'fts', 'body').limit(5).toArray()) as { id: string; corpus: string }[]
    log(`  "${q}" → ${res.length} hits in ${Date.now() - t0}ms; top: ${res[0]?.id ?? '(none)'} [${res[0]?.corpus ?? '-'}]`)
  }
}

/* ------------------------------------------------------------------- main */

async function main() {
  switch (CMD) {
    case 'audit': return audit()
    case 'export': return exportSafetyRecord()
    case 'delete-duplicates': return deleteDuplicates()
    case 'delete-orphans': return deleteOrphans()
    case 'verify': return verify()
    default:
      console.error(`unknown command "${CMD}" — one of: audit, export, delete-duplicates, delete-orphans, verify`)
      process.exit(1)
  }
}

main().catch((e) => {
  console.error('[fts-hygiene] FATAL', e instanceof Error ? e.stack ?? e.message : e)
  process.exit(1)
})
