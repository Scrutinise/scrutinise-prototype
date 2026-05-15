/**
 * V2.76-B Phase 3B — COUNT_DIFF additive top-up
 *
 * For each of the 1,146 COUNT_DIFF acts (bulk has more P1groups than Railway has sections):
 *   - Extract all P1groups from the bulk ZIP
 *   - For each P1group:
 *       skip  — if Railway row already has tnaXmlKey
 *       update — if Railway row exists but has no tnaXmlKey
 *       create — if no Railway row exists for this sectionNumber
 *   - Update LegislationItem.sectionCount if new rows were created
 *
 * Never overwrites an existing tnaXmlKey (additive only).
 * Saves progress to phase3b-progress.json for resume.
 */
import * as fs from 'fs'
import * as path from 'path'
import { spawnSync } from 'child_process'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { prisma } from '../../../scrutinise-web/lib/prisma'
import { CompilationStatus } from '@prisma/client'
import { r2Put, tnaXmlKey as makeTnaKey } from '../../legislation/r2-client'

const DIR           = __dirname
const ZIP_PATH      = path.join(DIR, 'best-collection-xml.zip')
const HELPER_PS1    = path.join(DIR, 'phase3a-zip-helper.ps1')
const PROGRESS_FILE = path.join(DIR, 'phase3b-progress.json')
const MANIFEST_PATH = path.join(DIR, 'manifest-ukpga.json')
const PHASE2_PATH   = path.join(DIR, 'phase2-results.json')

interface ManifestEntry {
  actId: string
  zipPath: string
}

interface Phase2Act {
  actId: string
  category: string
  bulkP1groups: number
  dbSections: number
}

interface P1groupResult {
  sectionNumber: string
  xml: string
}

interface Progress {
  completed: string[]
  errors: Record<string, string>
  stats: {
    actsProcessed: number
    r2Writes: number
    railwayUpdates: number
    railwayCreates: number
    skippedAlreadyKeyed: number
  }
}

function loadProgress(): Progress {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'))
  } catch {
    return {
      completed: [],
      errors: {},
      stats: { actsProcessed: 0, r2Writes: 0, railwayUpdates: 0, railwayCreates: 0, skippedAlreadyKeyed: 0 },
    }
  }
}

function saveProgress(p: Progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2))
}

function extractAllP1groups(entryPath: string): P1groupResult[] {
  const req = JSON.stringify({ zipPath: ZIP_PATH, entryPath, sectionNumbers: [] })
  const result = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-File', HELPER_PS1], {
    input: req,
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024,
    timeout: 120_000,
  })
  if (result.status !== 0) throw new Error(`PowerShell helper failed: ${result.stderr}`)
  const raw = result.stdout.trim()
  if (!raw || raw === 'null' || raw === '[]') return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    throw new Error(`Could not parse P1group JSON: ${raw.slice(0, 200)}`)
  }
}

async function processCountDiff(actId: string, zipEntryPath: string, progress: Progress) {
  const item = await prisma.legislationItem.findUnique({
    where: { legislationGovUkId: actId },
    select: { id: true, sectionCount: true },
  })
  if (!item) {
    console.warn(`  SKIP: LegislationItem not found for ${actId}`)
    return
  }

  const existingSections = await prisma.legislationSection.findMany({
    where: { legislationItemId: item.id },
    select: { id: true, sectionNumber: true, tnaXmlKey: true },
  })
  const existingMap = new Map(existingSections.map(s => [s.sectionNumber, s]))

  const p1groups = extractAllP1groups(zipEntryPath)
  if (p1groups.length === 0) {
    console.log(`  ${actId}: no P1groups extracted from ZIP`)
    return
  }

  let skipped = 0, updated = 0, created = 0

  for (const { sectionNumber, xml } of p1groups) {
    if (!sectionNumber) continue

    const existing = existingMap.get(sectionNumber)

    if (existing?.tnaXmlKey) {
      skipped++
      continue
    }

    const key = makeTnaKey(actId, sectionNumber)
    await r2Put(key, xml, 'application/xml')

    const title = (xml.match(/<Title[^>]*>(.*?)<\/Title>/)?.[1] ?? '').replace(/<[^>]+>/g, '').trim()
    const text  = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 10000)

    if (existing) {
      await prisma.legislationSection.update({
        where: { id: existing.id },
        data: { tnaXmlKey: key, sectionTitle: title || undefined },
      })
      updated++
    } else {
      await prisma.legislationSection.create({
        data: {
          legislationItemId: item.id,
          sectionNumber,
          sectionTitle: title || null,
          tnaXmlKey: key,
          originalText: text,
          compilationStatus: CompilationStatus.PENDING,
        },
      })
      created++
      // Track in-run creates so duplicate P1groups in bulk XML fall into update path
      existingMap.set(sectionNumber, { id: 'new', sectionNumber, tnaXmlKey: key })
    }
  }

  if (created > 0) {
    await prisma.legislationItem.update({
      where: { id: item.id },
      data: { sectionCount: existingSections.length + created },
    })
  }

  progress.stats.r2Writes        += updated + created
  progress.stats.railwayUpdates  += updated
  progress.stats.railwayCreates  += created
  progress.stats.skippedAlreadyKeyed += skipped
  progress.stats.actsProcessed++

  const parts = [`updated=${updated}`, `created=${created}`, `skipped=${skipped}`]
  console.log(`  ${actId}: ${parts.join(', ')}`)
}

async function main() {
  if (!fs.existsSync(ZIP_PATH)) {
    console.error(`ZIP not found: ${ZIP_PATH}`)
    process.exit(1)
  }

  const manifest: ManifestEntry[] = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
  const zipPathMap = new Map(manifest.map(m => [m.actId, m.zipPath]))

  const phase2Acts: Phase2Act[] = JSON.parse(fs.readFileSync(PHASE2_PATH, 'utf-8')).acts
  const countDiffActs = phase2Acts.filter(a => a.category === 'COUNT_DIFF')

  console.log(`COUNT_DIFF acts to process: ${countDiffActs.length}`)

  const progress = loadProgress()
  const completed = new Set(progress.completed)

  let i = 0
  for (const { actId, bulkP1groups, dbSections } of countDiffActs) {
    i++
    if (completed.has(actId)) {
      process.stdout.write(`[${i}/${countDiffActs.length}] SKIP (done): ${actId}\r`)
      continue
    }

    const zipEntry = zipPathMap.get(actId)
    if (!zipEntry) {
      console.warn(`[${i}/${countDiffActs.length}] No ZIP entry for ${actId} — skipping`)
      progress.errors[actId] = 'No ZIP entry in manifest'
      continue
    }

    process.stdout.write(`[${i}/${countDiffActs.length}] ${actId} (bulk=${bulkP1groups} db=${dbSections})\n`)

    try {
      await processCountDiff(actId, zipEntry, progress)
      progress.completed.push(actId)
      completed.add(actId)
    } catch (err: any) {
      console.error(`[${i}/${countDiffActs.length}] ERROR ${actId}: ${err.message}`)
      progress.errors[actId] = err.message
    }

    if (i % 20 === 0) {
      saveProgress(progress)
      console.log(`  [checkpoint — ${i}/${countDiffActs.length} acts, ${progress.stats.railwayCreates} created, ${progress.stats.railwayUpdates} updated]`)
    }
  }

  saveProgress(progress)

  console.log('\n=== PHASE 3B COUNT_DIFF COMPLETE ===')
  console.log(`Acts processed:        ${progress.stats.actsProcessed}`)
  console.log(`R2 writes:             ${progress.stats.r2Writes}`)
  console.log(`Railway row updates:   ${progress.stats.railwayUpdates}`)
  console.log(`Railway row creates:   ${progress.stats.railwayCreates}`)
  console.log(`Skipped (keyed):       ${progress.stats.skippedAlreadyKeyed}`)
  console.log(`Errors:                ${Object.keys(progress.errors).length}`)
  if (Object.keys(progress.errors).length > 0) {
    console.log('Error acts:', Object.keys(progress.errors).slice(0, 10))
  }

  await prisma.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
