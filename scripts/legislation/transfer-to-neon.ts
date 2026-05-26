/**
 * transfer-to-neon.ts — Transfer LegislationItem + LegislationSection from
 * Railway (source) to Neon (destination) in batches of 1,000 rows.
 *
 * ── GATED ────────────────────────────────────────────────────────────────────
 * Do NOT run until Charlie confirms the HMRC full ingest (CC-C terminal) has
 * completed successfully. This script reads from Railway and writes to Neon;
 * running mid-ingest would transfer a partial dataset.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Transfer order:
 *   1. LegislationItem (parent — must exist before child FK rows)
 *   2. LegislationSection (child — FK to LegislationItem)
 *
 * Pagination: cursor-based on `id` (UUID, UUID-ordered). OFFSET is not used
 * as it degrades at scale with large offsets.
 *
 * Checkpoint/resume: progress is written to neon-transfer-checkpoint.json
 * every 10,000 rows. A dropped connection resumes from the last checkpoint.
 *
 * Verification: after transfer, row counts on Railway vs Neon are compared
 * by legislationType. Discrepancies are reported before declaring success.
 *
 * Run:
 *   cd scrutinise-web
 *   npx tsx --tsconfig ../scripts/tsconfig.json ../scripts/legislation/transfer-to-neon.ts
 *
 * To resume a dropped transfer:
 *   (same command — checkpoint file is detected automatically)
 */

import * as path from 'path'
import * as fs from 'fs'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import { prisma }       from '../../scrutinise-web/lib/prisma'
import { prismaSearch } from '../../scrutinise-web/lib/prisma-search'

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const BATCH_SIZE        = 1_000   // rows per INSERT batch
const CHECKPOINT_EVERY  = 10_000  // write checkpoint file every N rows
const CHECKPOINT_PATH   = path.join(__dirname, 'neon-transfer-checkpoint.json')

type Checkpoint = {
  startedAt:          string
  lastUpdatedAt:      string
  legItemCursor:      string | null  // last LegislationItem.id transferred
  legItemDone:        boolean
  legSectionCursor:   string | null  // last LegislationSection.id transferred
  legSectionDone:     boolean
  legItemTotal:       number
  legSectionTotal:    number
  legItemTransferred: number
  legSectionTransferred: number
}

function ts() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}
function log(msg: string) { console.log(`[${ts()}] ${msg}`) }

// ─────────────────────────────────────────────────────────────────────────────
// Checkpoint helpers
// ─────────────────────────────────────────────────────────────────────────────

function loadCheckpoint(): Checkpoint | null {
  if (!fs.existsSync(CHECKPOINT_PATH)) return null
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf8')) as Checkpoint
  } catch {
    log('Warning: checkpoint file corrupt — starting from scratch')
    return null
  }
}

function saveCheckpoint(cp: Checkpoint) {
  cp.lastUpdatedAt = new Date().toISOString()
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp, null, 2))
}

// ─────────────────────────────────────────────────────────────────────────────
// Transfer: LegislationItem
// ─────────────────────────────────────────────────────────────────────────────

async function transferLegislationItems(cp: Checkpoint): Promise<void> {
  if (cp.legItemDone) {
    log('LegislationItem: already complete per checkpoint — skipping')
    return
  }

  log('LegislationItem: counting source rows on Railway...')
  const countResult = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) AS count FROM "LegislationItem"
  `
  cp.legItemTotal = Number(countResult[0].count)
  log(`LegislationItem: ${cp.legItemTotal.toLocaleString()} source rows`)

  if (cp.legItemCursor) {
    log(`LegislationItem: resuming from cursor ${cp.legItemCursor}`)
  }

  let cursor = cp.legItemCursor
  let transferred = cp.legItemTransferred
  let sinceCheckpoint = 0

  while (true) {
    // Cursor-based pagination: fetch rows with id > cursor, ordered by id
    // LegislationItem is small enough that all fields are transferred
    type RawItem = {
      id: string
      legislationType: string
      tier: string
      title: string
      year: number
      yearRaw: string | null
      number: number
      jurisdiction: string
      sourceType: string
      legislationGovUkId: string
      clmlUrl: string
      r2Key: string | null
      compilationStatus: string
      compilationProvider: string | null
      compiledAt: Date | null
      sectionCount: number
      compiledSectionCount: number
      shortTitle: string | null
      longTitle: string | null
      enactmentDate: Date | null
      inForce: boolean
      subjectArea: string | null
      policyArea: string | null
      feedUrl: string | null
      effectsKey: string | null
      effectsFetchedAt: Date | null
      createdAt: Date
      updatedAt: Date
    }

    const rows = cursor
      ? await prisma.$queryRaw<RawItem[]>`
          SELECT * FROM "LegislationItem"
          WHERE id > ${cursor}
          ORDER BY id
          LIMIT ${BATCH_SIZE}
        `
      : await prisma.$queryRaw<RawItem[]>`
          SELECT * FROM "LegislationItem"
          ORDER BY id
          LIMIT ${BATCH_SIZE}
        `

    if (rows.length === 0) break

    // Upsert batch to Neon — ON CONFLICT DO NOTHING for idempotent re-runs
    // Use raw SQL for the batch insert to avoid N round-trips
    for (const row of rows) {
      await prismaSearch.$executeRaw`
        INSERT INTO "LegislationItem" (
          id, "legislationType", tier, title, year, "yearRaw", number,
          jurisdiction, "sourceType", "legislationGovUkId", "clmlUrl", "r2Key",
          "compilationStatus", "compilationProvider", "compiledAt",
          "sectionCount", "compiledSectionCount", "shortTitle", "longTitle",
          "enactmentDate", "inForce", "subjectArea", "policyArea",
          "feedUrl", "effectsKey", "effectsFetchedAt", "createdAt", "updatedAt"
        ) VALUES (
          ${row.id}, ${row.legislationType}::"LegislationType",
          ${row.tier}::"LegislationTier", ${row.title}, ${row.year},
          ${row.yearRaw}, ${row.number}, ${row.jurisdiction},
          ${row.sourceType}::"DocumentSourceType",
          ${row.legislationGovUkId}, ${row.clmlUrl}, ${row.r2Key},
          ${row.compilationStatus}::"CompilationStatus",
          ${row.compilationProvider}, ${row.compiledAt}, ${row.sectionCount},
          ${row.compiledSectionCount}, ${row.shortTitle}, ${row.longTitle},
          ${row.enactmentDate}, ${row.inForce}, ${row.subjectArea},
          ${row.policyArea}, ${row.feedUrl}, ${row.effectsKey},
          ${row.effectsFetchedAt}, ${row.createdAt}, ${row.updatedAt}
        )
        ON CONFLICT (id) DO NOTHING
      `
    }

    cursor = rows[rows.length - 1].id
    transferred += rows.length
    sinceCheckpoint += rows.length
    cp.legItemCursor      = cursor
    cp.legItemTransferred = transferred

    const pct = ((transferred / cp.legItemTotal) * 100).toFixed(1)
    log(`  LegislationItem: ${transferred.toLocaleString()} / ${cp.legItemTotal.toLocaleString()} (${pct}%)`)

    if (sinceCheckpoint >= CHECKPOINT_EVERY) {
      saveCheckpoint(cp)
      log(`  Checkpoint saved (cursor: ${cursor})`)
      sinceCheckpoint = 0
    }

    if (rows.length < BATCH_SIZE) break
  }

  cp.legItemDone = true
  saveCheckpoint(cp)
  log(`LegislationItem transfer complete: ${transferred.toLocaleString()} rows`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Transfer: LegislationSection
// ─────────────────────────────────────────────────────────────────────────────

async function transferLegislationSections(cp: Checkpoint): Promise<void> {
  if (cp.legSectionDone) {
    log('LegislationSection: already complete per checkpoint — skipping')
    return
  }

  if (!cp.legItemDone) {
    throw new Error('LegislationItem must be transferred before LegislationSection')
  }

  log('LegislationSection: counting source rows on Railway...')
  const countResult = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) AS count FROM "LegislationSection"
  `
  cp.legSectionTotal = Number(countResult[0].count)
  log(`LegislationSection: ${cp.legSectionTotal.toLocaleString()} source rows`)

  if (cp.legSectionCursor) {
    log(`LegislationSection: resuming from cursor ${cp.legSectionCursor}`)
  }

  let cursor = cp.legSectionCursor
  let transferred = cp.legSectionTransferred
  let sinceCheckpoint = 0

  while (true) {
    // Fetch section metadata only — do NOT transfer ftsVector (will be rebuilt
    // by the trigger when originalText / sectionTitle are written).
    // Transfer originalText and sectionTitle so the trigger fires on insert.
    type RawSection = {
      id: string
      legislationItemId: string
      sectionNumber: string
      sectionTitle: string | null
      sourceType: string
      originalText: string | null
      originalXmlKey: string | null
      tnaXmlKey: string | null
      compiledTextKey: string | null
      lexSummaryKey: string | null
      confidence: string | null
      confidenceReason: string | null
      compilationVersion: number
      compilationNotes: string | null
      unappliedAmendments: unknown
      commencementNote: string | null
      compiledAt: Date | null
      compiledBy: string | null
      compilationStatus: string
      isRepealed: boolean
      needsReview: boolean
      createdAt: Date
      updatedAt: Date
      tags: string[]
      amendmentCount: number
      complexityScore: number
      inForce: boolean
      jurisdiction: string
      policyArea: string | null
    }

    const rows = cursor
      ? await prisma.$queryRaw<RawSection[]>`
          SELECT
            id, "legislationItemId", "sectionNumber", "sectionTitle",
            "sourceType", "originalText", "originalXmlKey", "tnaXmlKey",
            "compiledTextKey", "lexSummaryKey", confidence, "confidenceReason",
            "compilationVersion", "compilationNotes", "unappliedAmendments",
            "commencementNote", "compiledAt", "compiledBy", "compilationStatus",
            "isRepealed", "needsReview", "createdAt", "updatedAt",
            tags, "amendmentCount", "complexityScore", "inForce",
            jurisdiction, "policyArea"
          FROM "LegislationSection"
          WHERE id > ${cursor}
          ORDER BY id
          LIMIT ${BATCH_SIZE}
        `
      : await prisma.$queryRaw<RawSection[]>`
          SELECT
            id, "legislationItemId", "sectionNumber", "sectionTitle",
            "sourceType", "originalText", "originalXmlKey", "tnaXmlKey",
            "compiledTextKey", "lexSummaryKey", confidence, "confidenceReason",
            "compilationVersion", "compilationNotes", "unappliedAmendments",
            "commencementNote", "compiledAt", "compiledBy", "compilationStatus",
            "isRepealed", "needsReview", "createdAt", "updatedAt",
            tags, "amendmentCount", "complexityScore", "inForce",
            jurisdiction, "policyArea"
          FROM "LegislationSection"
          ORDER BY id
          LIMIT ${BATCH_SIZE}
        `

    if (rows.length === 0) break

    // Insert batch to Neon. ON CONFLICT DO NOTHING for idempotent re-runs.
    // The FTS trigger fires on INSERT and populates ftsVector automatically
    // from sectionTitle + originalText using the legislation_english config.
    for (const row of rows) {
      await prismaSearch.$executeRaw`
        INSERT INTO "LegislationSection" (
          id, "legislationItemId", "sectionNumber", "sectionTitle",
          "sourceType", "originalText", "originalXmlKey", "tnaXmlKey",
          "compiledTextKey", "lexSummaryKey", confidence, "confidenceReason",
          "compilationVersion", "compilationNotes", "unappliedAmendments",
          "commencementNote", "compiledAt", "compiledBy", "compilationStatus",
          "isRepealed", "needsReview", "createdAt", "updatedAt",
          tags, "amendmentCount", "complexityScore", "inForce",
          jurisdiction, "policyArea"
        ) VALUES (
          ${row.id}, ${row.legislationItemId}, ${row.sectionNumber},
          ${row.sectionTitle}, ${row.sourceType}::"DocumentSourceType",
          ${row.originalText}, ${row.originalXmlKey}, ${row.tnaXmlKey},
          ${row.compiledTextKey}, ${row.lexSummaryKey},
          ${row.confidence}::"CompilationConfidence",
          ${row.confidenceReason}, ${row.compilationVersion},
          ${row.compilationNotes}, ${row.unappliedAmendments},
          ${row.commencementNote}, ${row.compiledAt}, ${row.compiledBy},
          ${row.compilationStatus}::"CompilationStatus",
          ${row.isRepealed}, ${row.needsReview}, ${row.createdAt},
          ${row.updatedAt}, ${row.tags}, ${row.amendmentCount},
          ${row.complexityScore}, ${row.inForce}, ${row.jurisdiction},
          ${row.policyArea}
        )
        ON CONFLICT (id) DO NOTHING
      `
    }

    cursor = rows[rows.length - 1].id
    transferred += rows.length
    sinceCheckpoint += rows.length
    cp.legSectionCursor      = cursor
    cp.legSectionTransferred = transferred

    const pct = ((transferred / cp.legSectionTotal) * 100).toFixed(1)
    log(`  LegislationSection: ${transferred.toLocaleString()} / ${cp.legSectionTotal.toLocaleString()} (${pct}%)`)

    if (sinceCheckpoint >= CHECKPOINT_EVERY) {
      saveCheckpoint(cp)
      log(`  Checkpoint saved (cursor: ${cursor})`)
      sinceCheckpoint = 0
    }

    if (rows.length < BATCH_SIZE) break
  }

  cp.legSectionDone = true
  saveCheckpoint(cp)
  log(`LegislationSection transfer complete: ${transferred.toLocaleString()} rows`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Verification: compare row counts by legislationType
// ─────────────────────────────────────────────────────────────────────────────

async function verifyTransfer(): Promise<boolean> {
  log('Verification: comparing row counts Railway vs Neon by legislationType')

  type TypeCount = { legislationType: string; count: bigint }

  const railwayCounts = await prisma.$queryRaw<TypeCount[]>`
    SELECT li."legislationType"::text AS "legislationType", COUNT(*) AS count
    FROM "LegislationSection" ls
    JOIN "LegislationItem" li ON ls."legislationItemId" = li.id
    GROUP BY li."legislationType"
    ORDER BY count DESC
  `

  const neonCounts = await prismaSearch.$queryRaw<TypeCount[]>`
    SELECT li."legislationType"::text AS "legislationType", COUNT(*) AS count
    FROM "LegislationSection" ls
    JOIN "LegislationItem" li ON ls."legislationItemId" = li.id
    GROUP BY li."legislationType"
    ORDER BY count DESC
  `

  const neonMap = new Map(neonCounts.map(r => [r.legislationType, Number(r.count)]))
  const railwayMap = new Map(railwayCounts.map(r => [r.legislationType, Number(r.count)]))

  let allMatch = true
  const rows: string[] = []

  for (const [type, railwayCount] of railwayMap) {
    const neonCount = neonMap.get(type) ?? 0
    const match = railwayCount === neonCount
    if (!match) allMatch = false
    rows.push(`  ${type.padEnd(8)} Railway: ${String(railwayCount).padStart(8)} | Neon: ${String(neonCount).padStart(8)} ${match ? '✓' : '✗ MISMATCH'}`)
  }

  // Types on Neon but not Railway (unexpected)
  for (const [type, neonCount] of neonMap) {
    if (!railwayMap.has(type)) {
      allMatch = false
      rows.push(`  ${type.padEnd(8)} Railway:        0 | Neon: ${String(neonCount).padStart(8)} ✗ EXTRA ON NEON`)
    }
  }

  rows.forEach(r => log(r))

  // LegislationItem total comparison
  const railwayItemCount = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) AS count FROM "LegislationItem"`
  const neonItemCount    = await prismaSearch.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) AS count FROM "LegislationItem"`
  const ri = Number(railwayItemCount[0].count)
  const ni = Number(neonItemCount[0].count)
  const itemMatch = ri === ni
  if (!itemMatch) allMatch = false
  log(`  LegislationItem total: Railway ${ri.toLocaleString()} | Neon ${ni.toLocaleString()} ${itemMatch ? '✓' : '✗ MISMATCH'}`)

  if (allMatch) {
    log('Verification: ALL COUNTS MATCH ✓')
  } else {
    log('Verification: DISCREPANCIES FOUND — do not switch search to Neon until resolved')
  }

  return allMatch
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  log('V.4-FTS-3 Transfer to Neon starting')
  log('Source: Railway (DATABASE_URL)')
  log('Destination: Neon (NEON_DATABASE_URL)')

  // Load or initialise checkpoint
  let cp = loadCheckpoint()
  const isResume = cp !== null && (!cp.legItemDone || !cp.legSectionDone)
  if (isResume) {
    log(`Resuming from checkpoint (started: ${cp!.startedAt})`)
    log(`  LegislationItem: ${cp!.legItemTransferred.toLocaleString()} transferred, done: ${cp!.legItemDone}`)
    log(`  LegislationSection: ${cp!.legSectionTransferred.toLocaleString()} transferred, done: ${cp!.legSectionDone}`)
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
    log('Fresh transfer — checkpoint initialised')
  }

  const t0 = Date.now()

  await transferLegislationItems(cp)
  await transferLegislationSections(cp)

  const elapsed = ((Date.now() - t0) / 1000 / 60).toFixed(1)
  log(`Transfer finished in ${elapsed} minutes`)

  const verified = await verifyTransfer()

  if (verified) {
    log('\nTransfer verified ✓')
    log('Next step (Part 4): update search.ts to query Neon via prisma-search.ts')
    log('  Search query client switch is documented in the sprint brief.')
  } else {
    log('\nTransfer verification FAILED — investigate discrepancies above')
    process.exit(1)
  }

  await prisma.$disconnect()
  await prismaSearch.$disconnect()
}

main().catch(async err => {
  console.error(`[${ts()}] Transfer failed:`, err)
  await prisma.$disconnect().catch(() => {})
  await prismaSearch.$disconnect().catch(() => {})
  process.exit(1)
})
