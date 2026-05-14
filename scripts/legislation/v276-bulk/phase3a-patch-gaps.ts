/**
 * V2.76-B Phase 3A — FULL_INGEST + PATCH_GAPS
 *
 * FULL_INGEST: Companies Act 2006 — create 1,677 LegislationSection rows, upload P1group XML to R2.
 * PATCH_GAPS:  316 acts — for each neither-key section, find matching P1group in bulk XML,
 *              upload to R2, update Railway tnaXmlKey.
 *
 * Uses phase3a-zip-helper.ps1 (one PowerShell subprocess per act) for ZIP reading.
 * Saves progress to phase3a-progress.json so it can resume after interruption.
 */
import * as fs from 'fs'
import * as path from 'path'
import { spawnSync } from 'child_process'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { prisma } from '../../../scrutinise-web/lib/prisma'
import { CompilationStatus } from '@prisma/client'
import { r2Put, tnaXmlKey as makeTnaKey } from '../../legislation/r2-client'

const DIR         = __dirname
const ZIP_PATH    = path.join(DIR, 'best-collection-xml.zip')
const HELPER_PS1  = path.join(DIR, 'phase3a-zip-helper.ps1')
const PROGRESS_FILE = path.join(DIR, 'phase3a-progress.json')
const MANIFEST_PATH = path.join(DIR, 'manifest-ukpga.json')
const PHASE2_PATH   = path.join(DIR, 'phase2-results.json')

interface ManifestEntry {
  actId: string
  zipPath: string
  compressedSize: number
  uncompressedSize: number
  version: string
}

interface P1groupResult {
  sectionNumber: string
  xml: string
}

interface Progress {
  completed: string[]
  errors: Record<string, string>
  stats: {
    r2Writes: number
    railwayUpdates: number
    railwayCreates: number
    sectionsMissedInBulk: number
  }
}

function loadProgress(): Progress {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'))
  } catch {
    return { completed: [], errors: {}, stats: { r2Writes: 0, railwayUpdates: 0, railwayCreates: 0, sectionsMissedInBulk: 0 } }
  }
}

function saveProgress(p: Progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2))
}

function extractP1groups(entryPath: string, sectionNumbers: string[]): P1groupResult[] {
  const req = JSON.stringify({ zipPath: ZIP_PATH, entryPath, sectionNumbers })
  const result = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-File', HELPER_PS1], {
    input: req,
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024,
    timeout: 120_000,
  })
  if (result.status !== 0) {
    throw new Error(`PowerShell helper failed: ${result.stderr}`)
  }
  const raw = result.stdout.trim()
  if (!raw || raw === 'null') return []
  try {
    const parsed = JSON.parse(raw)
    // PowerShell ConvertTo-Json wraps single items as object, not array
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    throw new Error(`Could not parse P1group JSON: ${raw.slice(0, 200)}`)
  }
}

async function processFullIngest(actId: string, zipEntryPath: string, progress: Progress) {
  console.log(`\nFULL_INGEST: ${actId}`)

  // Get the LegislationItem
  const item = await prisma.legislationItem.findUnique({
    where: { legislationGovUkId: actId },
    select: { id: true, title: true },
  })
  if (!item) throw new Error(`LegislationItem not found for ${actId}`)
  console.log(`  Title: ${item.title}`)

  // Extract ALL P1groups from bulk
  console.log(`  Extracting P1groups from ZIP...`)
  const p1groups = extractP1groups(zipEntryPath, [])  // empty = all
  console.log(`  Found ${p1groups.length} P1groups`)

  let r2Count = 0, dbCount = 0, skipped = 0
  for (const { sectionNumber, xml } of p1groups) {
    if (!sectionNumber) { skipped++; continue }

    const key = makeTnaKey(actId, sectionNumber)
    // Upload to R2
    await r2Put(key, xml, 'application/xml')
    r2Count++

    // Upsert Railway row
    const title = (xml.match(/<Title[^>]*>(.*?)<\/Title>/)?.[1] ?? '').replace(/<[^>]+>/g, '').trim()
    const text  = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 10000)

    await prisma.legislationSection.upsert({
      where: { legislationItemId_sectionNumber: { legislationItemId: item.id, sectionNumber } },
      create: {
        legislationItemId: item.id,
        sectionNumber,
        sectionTitle: title || null,
        tnaXmlKey: key,
        originalText: text,
        compilationStatus: CompilationStatus.PENDING,
      },
      update: {
        tnaXmlKey: key,
        sectionTitle: title || undefined,
        compilationStatus: CompilationStatus.PENDING,
      },
    })
    dbCount++
  }

  // Update item sectionCount
  await prisma.legislationItem.update({
    where: { id: item.id },
    data: { sectionCount: dbCount },
  })

  progress.stats.r2Writes += r2Count
  progress.stats.railwayCreates += dbCount
  console.log(`  Done: ${r2Count} R2 writes, ${dbCount} Railway rows, ${skipped} skipped (no section number)`)
}

async function processPatchGaps(actId: string, zipEntryPath: string, progress: Progress) {
  // Get Railway neither-key sections for this act
  const item = await prisma.legislationItem.findUnique({
    where: { legislationGovUkId: actId },
    select: { id: true },
  })
  if (!item) {
    console.warn(`  SKIP: LegislationItem not found for ${actId}`)
    return
  }

  const neitherSections = await prisma.legislationSection.findMany({
    where: {
      legislationItemId: item.id,
      originalXmlKey: null,
      tnaXmlKey: null,
    },
    select: { id: true, sectionNumber: true },
  })

  if (neitherSections.length === 0) {
    console.log(`  ${actId}: no neither-key sections (already patched?)`)
    return
  }

  const sectionNumbers = neitherSections.map(s => s.sectionNumber)

  // Extract matching P1groups from bulk
  const p1groups = extractP1groups(zipEntryPath, sectionNumbers)
  const p1ByNum = new Map(p1groups.map(p => [p.sectionNumber, p.xml]))

  let patched = 0, missed = 0
  for (const section of neitherSections) {
    const xml = p1ByNum.get(section.sectionNumber)
    if (!xml) {
      missed++
      continue
    }
    const key = makeTnaKey(actId, section.sectionNumber)
    await r2Put(key, xml, 'application/xml')
    await prisma.legislationSection.update({
      where: { id: section.id },
      data: { tnaXmlKey: key },
    })
    patched++
  }

  progress.stats.r2Writes += patched
  progress.stats.railwayUpdates += patched
  progress.stats.sectionsMissedInBulk += missed

  if (missed > 0) {
    console.log(`  ${actId}: patched=${patched}, MISSED=${missed}/${neitherSections.length}`)
  } else {
    console.log(`  ${actId}: patched=${patched}/${neitherSections.length}`)
  }
}

async function main() {
  const manifest: ManifestEntry[] = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
  const phase2 = JSON.parse(fs.readFileSync(PHASE2_PATH, 'utf-8'))

  const zipPathMap = new Map(manifest.map(m => [m.actId, m.zipPath]))

  // Acts to process
  const fullIngestActs = phase2.acts.filter((a: any) => a.category === 'FULL_INGEST') as Array<{actId: string}>
  const patchGapsActs  = phase2.acts.filter((a: any) => a.category === 'PATCH_GAPS')  as Array<{actId: string}>

  console.log(`FULL_INGEST acts: ${fullIngestActs.length}`)
  console.log(`PATCH_GAPS  acts: ${patchGapsActs.length}`)

  const progress = loadProgress()
  const completed = new Set(progress.completed)

  const allActs = [
    ...fullIngestActs.map(a => ({ actId: a.actId, type: 'FULL_INGEST' })),
    ...patchGapsActs.map(a => ({ actId: a.actId, type: 'PATCH_GAPS' })),
  ]

  let i = 0
  for (const { actId, type } of allActs) {
    i++
    if (completed.has(actId)) {
      console.log(`[${i}/${allActs.length}] SKIP (already done): ${actId}`)
      continue
    }

    const zipEntry = zipPathMap.get(actId)
    if (!zipEntry) {
      console.warn(`[${i}/${allActs.length}] No ZIP entry for ${actId} — skipping`)
      progress.errors[actId] = 'No ZIP entry in manifest'
      continue
    }

    try {
      if (type === 'FULL_INGEST') {
        await processFullIngest(actId, zipEntry, progress)
      } else {
        process.stdout.write(`[${i}/${allActs.length}] PATCH: ${actId} ... `)
        await processPatchGaps(actId, zipEntry, progress)
      }
      progress.completed.push(actId)
      completed.add(actId)
    } catch (err: any) {
      console.error(`[${i}/${allActs.length}] ERROR ${actId}: ${err.message}`)
      progress.errors[actId] = err.message
    }

    // Save checkpoint every 20 acts
    if (i % 20 === 0) {
      saveProgress(progress)
      console.log(`  [checkpoint saved — ${i}/${allActs.length} processed]`)
    }
  }

  saveProgress(progress)

  console.log('\n=== PHASE 3A PATCH COMPLETE ===')
  console.log(`R2 writes:          ${progress.stats.r2Writes}`)
  console.log(`Railway updates:    ${progress.stats.railwayUpdates}`)
  console.log(`Railway creates:    ${progress.stats.railwayCreates}`)
  console.log(`Sections missed:    ${progress.stats.sectionsMissedInBulk}`)
  console.log(`Errors:             ${Object.keys(progress.errors).length}`)
  if (Object.keys(progress.errors).length > 0) {
    console.log('Error acts:', Object.keys(progress.errors).slice(0, 10))
  }

  await prisma.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
