/**
 * transfer-to-neon.ts — Transfer LegislationItem + LegislationSection
 * from Railway (source) to Neon (destination).
 *
 * ── GATED ────────────────────────────────────────────────────────────────────
 * Do NOT run until Charlie confirms the HMRC full ingest is complete.
 * Gate confirmed open: 27 May 2026.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Strategy:
 *   - Source: Railway pg Pool (with SSL)
 *   - Destination: Neon pg Pool (with SSL)
 *   - Cursor-based pagination on `id` — no OFFSET (degrades at scale)
 *   - Multi-row batched INSERT (BATCH_SIZE rows per statement)
 *   - ON CONFLICT (id) DO NOTHING — idempotent; safe to re-run
 *   - ftsVector NOT transferred — Neon trigger repopulates from sectionTitle
 *     + originalText using legislation_english config on INSERT
 *   - embedding NOT inserted — Neon-only column, populated in V.4-FTS-2
 *
 * Checkpoint/resume:
 *   Writes neon-transfer-checkpoint.json every CHECKPOINT_EVERY rows.
 *   Re-run to resume from last saved cursor after a dropped connection.
 *
 * Run:
 *   cd scrutinise-web
 *   npx tsx --tsconfig ../scripts/tsconfig.json ../scripts/legislation/transfer-to-neon.ts
 */

import * as path from 'path'
import * as fs   from 'fs'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import { getRailwayPool, getNeonPool, endPools } from '../../scrutinise-web/lib/pg-pool'

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const BATCH_SIZE       = 200   // rows per SELECT + per multi-row INSERT
const CHECKPOINT_EVERY = 5_000 // write checkpoint every N rows
const CHECKPOINT_PATH  = path.join(__dirname, 'neon-transfer-checkpoint.json')

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Checkpoint = {
  startedAt:             string
  lastUpdatedAt:         string
  legItemCursor:         string | null
  legItemDone:           boolean
  legSectionCursor:      string | null
  legSectionDone:        boolean
  legItemTotal:          number
  legSectionTotal:       number
  legItemTransferred:    number
  legSectionTransferred: number
}

function ts() { return new Date().toISOString().replace('T', ' ').slice(0, 19) }
function log(msg: string) { console.log(`[${ts()}] ${msg}`) }

// ─────────────────────────────────────────────────────────────────────────────
// Checkpoint helpers
// ─────────────────────────────────────────────────────────────────────────────

function loadCheckpoint(): Checkpoint | null {
  if (!fs.existsSync(CHECKPOINT_PATH)) return null
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf8'))
  } catch {
    log('Warning: checkpoint file unreadable — starting from scratch')
    return null
  }
}

function saveCheckpoint(cp: Checkpoint) {
  cp.lastUpdatedAt = new Date().toISOString()
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp, null, 2))
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-row INSERT builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a multi-row parameterised INSERT for the given table.
 * colDefs: [{ name, cast? }] where cast is a PostgreSQL type name for explicit
 *   casting — required for enum columns so NULL casts work correctly.
 * rows: array of arrays (each inner array = one row's values in column order)
 */
function buildBulkInsert(
  table: string,
  colDefs: { name: string; cast?: string }[],
  rows:    unknown[][]
): { sql: string; params: unknown[] } {
  const params: unknown[] = []
  const valueGroups: string[] = []

  for (const row of rows) {
    const placeholders = colDefs.map((col, i) => {
      params.push(row[i])
      const idx = params.length
      return col.cast ? `$${idx}::${col.cast}` : `$${idx}`
    })
    valueGroups.push(`(${placeholders.join(', ')})`)
  }

  const colList = colDefs.map(c => `"${c.name}"`).join(', ')
  const sql = `
    INSERT INTO "${table}" (${colList})
    VALUES ${valueGroups.join(',\n    ')}
    ON CONFLICT (id) DO NOTHING
  `
  return { sql, params }
}

// ─────────────────────────────────────────────────────────────────────────────
// Column definitions
// ─────────────────────────────────────────────────────────────────────────────

const ITEM_COLS: { name: string; cast?: string }[] = [
  { name: 'id' },
  { name: 'legislationType', cast: '"LegislationType"' },
  { name: 'tier',            cast: '"LegislationTier"' },
  { name: 'title' },
  { name: 'year' },
  { name: 'yearRaw' },
  { name: 'number' },
  { name: 'jurisdiction' },
  { name: 'sourceType',      cast: '"DocumentSourceType"' },
  { name: 'legislationGovUkId' },
  { name: 'clmlUrl' },
  { name: 'r2Key' },
  { name: 'compilationStatus', cast: '"CompilationStatus"' },
  { name: 'compilationProvider' },
  { name: 'compiledAt' },
  { name: 'sectionCount' },
  { name: 'compiledSectionCount' },
  { name: 'shortTitle' },
  { name: 'longTitle' },
  { name: 'enactmentDate' },
  { name: 'inForce' },
  { name: 'subjectArea' },
  { name: 'policyArea' },
  { name: 'feedUrl' },
  { name: 'effectsKey' },
  { name: 'effectsFetchedAt' },
  { name: 'createdAt' },
  { name: 'updatedAt' },
]

const SECTION_COLS: { name: string; cast?: string }[] = [
  { name: 'id' },
  { name: 'legislationItemId' },
  { name: 'sectionNumber' },
  { name: 'sectionTitle' },
  { name: 'sourceType',        cast: '"DocumentSourceType"' },
  { name: 'originalText' },
  { name: 'originalXmlKey' },
  { name: 'tnaXmlKey' },
  { name: 'compiledTextKey' },
  { name: 'lexSummaryKey' },
  { name: 'confidence',        cast: '"CompilationConfidence"' },
  { name: 'confidenceReason' },
  { name: 'compilationVersion' },
  { name: 'compilationNotes' },
  { name: 'unappliedAmendments', cast: 'jsonb' },
  { name: 'commencementNote' },
  { name: 'compiledAt' },
  { name: 'compiledBy' },
  { name: 'compilationStatus', cast: '"CompilationStatus"' },
  { name: 'isRepealed' },
  { name: 'needsReview' },
  { name: 'createdAt' },
  { name: 'updatedAt' },
  { name: 'tags' },
  { name: 'amendmentCount' },
  { name: 'complexityScore' },
  { name: 'inForce' },
  { name: 'jurisdiction' },
  { name: 'policyArea' },
  // NOTE: ftsVector excluded — Neon trigger populates from originalText + sectionTitle
  // NOTE: embedding excluded — Neon-only vector column (V.4-FTS-2)
]

// Convert a DB row (from pg Pool query) to the values array matching colDefs
function itemToRow(r: Record<string, unknown>): unknown[] {
  return ITEM_COLS.map(c => r[c.name] ?? null)
}

function sectionToRow(r: Record<string, unknown>): unknown[] {
  return SECTION_COLS.map(c => {
    if (c.name === 'unappliedAmendments') {
      // pg returns JSONB as a JS object; pass as JSON string for ::jsonb cast
      const v = r[c.name]
      if (v === null || v === undefined) return null
      return typeof v === 'string' ? v : JSON.stringify(v)
    }
    return r[c.name] ?? null
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Transfer: LegislationItem
// ─────────────────────────────────────────────────────────────────────────────

async function transferLegislationItems(cp: Checkpoint): Promise<void> {
  if (cp.legItemDone) {
    log('LegislationItem: checkpoint shows done — skipping')
    return
  }

  const src  = getRailwayPool()
  const dest = getNeonPool()

  const countRes = await src.query('SELECT COUNT(*) AS count FROM "LegislationItem"')
  cp.legItemTotal = Number(countRes.rows[0].count)
  log(`LegislationItem: ${cp.legItemTotal.toLocaleString()} source rows on Railway`)

  if (cp.legItemCursor) log(`  Resuming from cursor: ${cp.legItemCursor}`)

  const colNames = ITEM_COLS.map(c => `"${c.name}"`).join(', ')
  let cursor         = cp.legItemCursor
  let transferred    = cp.legItemTransferred
  let sinceCheckpoint = 0
  const t0 = Date.now()

  while (true) {
    const query = cursor
      ? `SELECT ${colNames} FROM "LegislationItem" WHERE id > $1 ORDER BY id LIMIT $2`
      : `SELECT ${colNames} FROM "LegislationItem" ORDER BY id LIMIT $1`
    const params = cursor ? [cursor, BATCH_SIZE] : [BATCH_SIZE]
    const res = await src.query(query, params)

    if (res.rows.length === 0) break

    const rows = res.rows.map(itemToRow)
    const { sql, params: insertParams } = buildBulkInsert('LegislationItem', ITEM_COLS, rows)
    await dest.query(sql, insertParams)

    cursor           = res.rows[res.rows.length - 1].id as string
    transferred     += res.rows.length
    sinceCheckpoint += res.rows.length
    cp.legItemCursor      = cursor
    cp.legItemTransferred = transferred

    const pct     = ((transferred / cp.legItemTotal) * 100).toFixed(1)
    const elapsed = ((Date.now() - t0) / 1000).toFixed(0)
    const rate    = (transferred / ((Date.now() - t0) / 1000)).toFixed(0)
    log(`  LegislationItem: ${transferred.toLocaleString()} / ${cp.legItemTotal.toLocaleString()} (${pct}%) — ${elapsed}s @ ${rate}/s`)

    if (sinceCheckpoint >= CHECKPOINT_EVERY) {
      saveCheckpoint(cp)
      sinceCheckpoint = 0
    }

    if (res.rows.length < BATCH_SIZE) break
  }

  cp.legItemDone = true
  saveCheckpoint(cp)
  log(`LegislationItem complete: ${transferred.toLocaleString()} rows in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Transfer: LegislationSection
// ─────────────────────────────────────────────────────────────────────────────

async function transferLegislationSections(cp: Checkpoint): Promise<void> {
  if (cp.legSectionDone) {
    log('LegislationSection: checkpoint shows done — skipping')
    return
  }
  if (!cp.legItemDone) throw new Error('LegislationItem must be done before LegislationSection')

  const src  = getRailwayPool()
  const dest = getNeonPool()

  const countRes = await src.query('SELECT COUNT(*) AS count FROM "LegislationSection"')
  cp.legSectionTotal = Number(countRes.rows[0].count)
  log(`LegislationSection: ${cp.legSectionTotal.toLocaleString()} source rows on Railway`)

  if (cp.legSectionCursor) log(`  Resuming from cursor: ${cp.legSectionCursor}`)

  // Select all needed columns except ftsVector and embedding
  const colNames = SECTION_COLS.map(c => `"${c.name}"`).join(', ')

  let cursor          = cp.legSectionCursor
  let transferred     = cp.legSectionTransferred
  let sinceCheckpoint = 0
  const t0 = Date.now()

  while (true) {
    const query = cursor
      ? `SELECT ${colNames} FROM "LegislationSection" WHERE id > $1 ORDER BY id LIMIT $2`
      : `SELECT ${colNames} FROM "LegislationSection" ORDER BY id LIMIT $1`
    const params = cursor ? [cursor, BATCH_SIZE] : [BATCH_SIZE]
    const res = await src.query(query, params)

    if (res.rows.length === 0) break

    const rows = res.rows.map(sectionToRow)
    const { sql, params: insertParams } = buildBulkInsert('LegislationSection', SECTION_COLS, rows)
    await dest.query(sql, insertParams)

    cursor          = res.rows[res.rows.length - 1].id as string
    transferred    += res.rows.length
    sinceCheckpoint += res.rows.length
    cp.legSectionCursor      = cursor
    cp.legSectionTransferred = transferred

    const pct     = ((transferred / cp.legSectionTotal) * 100).toFixed(1)
    const elapsed = ((Date.now() - t0) / 1000).toFixed(0)
    const rate    = (transferred / ((Date.now() - t0) / 1000)).toFixed(0)

    if (transferred % 10_000 < BATCH_SIZE) {
      log(`  LegislationSection: ${transferred.toLocaleString()} / ${cp.legSectionTotal.toLocaleString()} (${pct}%) — ${elapsed}s @ ${rate}/s`)
    }

    if (sinceCheckpoint >= CHECKPOINT_EVERY) {
      saveCheckpoint(cp)
      log(`  Checkpoint saved at ${transferred.toLocaleString()} rows`)
      sinceCheckpoint = 0
    }

    if (res.rows.length < BATCH_SIZE) break
  }

  cp.legSectionDone = true
  saveCheckpoint(cp)
  log(`LegislationSection complete: ${transferred.toLocaleString()} rows in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Verification
// ─────────────────────────────────────────────────────────────────────────────

async function verifyTransfer(): Promise<boolean> {
  log('Verification: Railway vs Neon row counts by legislationType')

  const src  = getRailwayPool()
  const dest = getNeonPool()

  const typeQuery = `
    SELECT li."legislationType"::text AS type, COUNT(*) AS sections
    FROM "LegislationSection" ls
    JOIN "LegislationItem" li ON ls."legislationItemId" = li.id
    GROUP BY li."legislationType" ORDER BY sections DESC
  `
  const [rCounts, nCounts] = await Promise.all([
    src.query(typeQuery),
    dest.query(typeQuery),
  ])

  const neonMap    = new Map<string, number>(nCounts.rows.map((r: { type: string; sections: string }) => [r.type, Number(r.sections)]))
  const railwayMap = new Map<string, number>(rCounts.rows.map((r: { type: string; sections: string }) => [r.type, Number(r.sections)]))

  let allMatch = true
  log('  Type     Railway    Neon       Match')
  log('  ──────────────────────────────────────')

  for (const [type, rCount] of railwayMap) {
    const nCount = neonMap.get(type) ?? 0
    const match  = rCount === nCount
    if (!match) allMatch = false
    log(`  ${type.padEnd(8)} ${String(rCount).padStart(8)}   ${String(nCount).padStart(8)}   ${match ? '✓' : '✗ MISMATCH'}`)
  }

  for (const [type, nCount] of neonMap) {
    if (!railwayMap.has(type)) {
      allMatch = false
      log(`  ${type.padEnd(8)}        0   ${String(nCount).padStart(8)}   ✗ EXTRA ON NEON`)
    }
  }

  // LegislationItem totals
  const [ri, ni] = await Promise.all([
    src.query('SELECT COUNT(*) AS count FROM "LegislationItem"'),
    dest.query('SELECT COUNT(*) AS count FROM "LegislationItem"'),
  ])
  const rItems = Number(ri.rows[0].count)
  const nItems = Number(ni.rows[0].count)
  const itemMatch = rItems === nItems
  if (!itemMatch) allMatch = false
  log(`\n  LegislationItem total:`)
  log(`    Railway: ${rItems.toLocaleString()}   Neon: ${nItems.toLocaleString()}   ${itemMatch ? '✓' : '✗ MISMATCH'}`)

  log(allMatch
    ? '\n  ✓ ALL COUNTS MATCH — transfer verified'
    : '\n  ✗ DISCREPANCIES — investigate before switching search to Neon'
  )
  return allMatch
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  log('V.4-FTS-3 Part 3: Railway → Neon transfer')
  log(`Source: Railway (${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] ?? '?'})`)
  log(`Dest:   Neon    (${process.env.NEON_DATABASE_URL?.split('@')[1]?.split('/')[0] ?? '?'})`)

  let cp = loadCheckpoint()

  // If both tables are already done, skip straight to verification
  if (cp?.legItemDone && cp?.legSectionDone) {
    log('Both tables already transferred — running verification only')
    const verified = await verifyTransfer()
    await endPools()
    process.exit(verified ? 0 : 1)
  }

  const isResume = cp !== null && (!cp.legItemDone || !cp.legSectionDone)

  if (isResume) {
    log(`Resuming from checkpoint (started: ${cp!.startedAt})`)
    log(`  LegislationItem: ${cp!.legItemTransferred.toLocaleString()} rows, done: ${cp!.legItemDone}`)
    log(`  LegislationSection: ${cp!.legSectionTransferred.toLocaleString()} rows, done: ${cp!.legSectionDone}`)
  } else {
    cp = {
      startedAt:             new Date().toISOString(),
      lastUpdatedAt:         new Date().toISOString(),
      legItemCursor:         null,
      legItemDone:           false,
      legSectionCursor:      null,
      legSectionDone:        false,
      legItemTotal:          0,
      legSectionTotal:       0,
      legItemTransferred:    0,
      legSectionTransferred: 0,
    }
    saveCheckpoint(cp)
  }

  const t0 = Date.now()

  await transferLegislationItems(cp)
  await transferLegislationSections(cp)

  const elapsed = ((Date.now() - t0) / 1000 / 60).toFixed(1)
  log(`\nTransfer finished in ${elapsed} minutes`)

  const verified = await verifyTransfer()

  await endPools()

  if (!verified) {
    log('\nDo not switch search to Neon until discrepancies are resolved.')
    process.exit(1)
  }

  log('\nPart 3 complete ✓')
  log('Ready for Part 4: switch search.ts + route.ts to use prismaSearch (Neon)')
}

main().catch(async err => {
  console.error(`[${ts()}] Transfer error:`, err.message || err)
  await endPools().catch(() => {})
  process.exit(1)
})
