/**
 * V.3-B Phase 3 — UKSI bulk ingest (NEW_TO_RAILWAY)
 *
 * Creates LegislationItem + LegislationSection rows for UKSI from the Best Collection bulk ZIP.
 * All UKSI are NEW_TO_RAILWAY — no pre-existing Railway rows to patch.
 *
 * Modes:
 *   --pilot   Process the 100-UKSI stratified pilot sample (default in this file)
 *   --full    Process all 61,179 UKSI in manifest-uksi.json (Phase 3 — requires separate approval)
 *
 * Output:
 *   progress: phase3-uksi-progress.json (checkpoint/resume)
 *   log:      pilot-log.csv             (per-UKSI outcome, pilot mode only)
 */
import * as fs from 'fs'
import * as path from 'path'
import { spawnSync } from 'child_process'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { prisma } from '../../../scrutinise-web/lib/prisma'
import { CompilationStatus, LegislationType, LegislationTier } from '@prisma/client'
import { r2Put } from '../r2-client'
import { getR2KeyForSection, decodeEntities, ManifestVersion } from './key-helper'

const DIR           = __dirname
const ZIP_PATH      = path.join(DIR, '../v276-bulk/best-collection-xml.zip')
const MANIFEST_PATH = path.join(DIR, 'manifest-uksi.json')
const HELPER_PS1    = path.join(DIR, 'zip-helper-uksi.ps1')
// Progress and log on D: to avoid filling the C: system drive during the long full ingest.
// The pilot progress file (on C:) is a separate file — full run writes here.
const PROGRESS_FILE = process.argv.includes('--full')
  ? 'D:\\uksi-phase3-progress.json'
  : path.join(DIR, 'phase3-uksi-progress.json')
const LOG_FILE      = process.argv.includes('--full')
  ? 'D:\\uksi-phase3-log.csv'
  : path.join(DIR, 'pilot-log.csv')

interface ManifestEntry {
  actId: string
  zipPath: string
  compressedSize: number
  uncompressedSize: number
  version: ManifestVersion
}

interface P1groupResult {
  sectionNumber: string
  xml: string
}

interface ZipHelperResult {
  title: string
  p1groups: P1groupResult[]
}

interface Progress {
  completed: string[]
  skipped: string[]
  errors: Record<string, string>
  stats: {
    created: number
    sectionsCreated: number
    r2Writes: number
    tnaKeyWrites: number
    originalKeyWrites: number
    zeroSection: number
    normalized: number
    elapsed: number
  }
}

// ── Pilot sample selection ────────────────────────────────────────────────────

function selectPilotSample(manifest: ManifestEntry[]): ManifestEntry[] {
  const revised    = manifest.filter(m => m.version === 'revised-current')
  const year      = (m: ManifestEntry) => parseInt(m.actId.split('/')[1], 10)
  const made1990  = manifest.filter(m => m.version === 'made' && year(m) >= 1990 && year(m) <= 2010)
  const made2015  = manifest.filter(m => m.version === 'made' && year(m) >= 2015 && year(m) <= 2024)

  // Sort each band by uncompressed size for deterministic size-stratified selection
  const bySize = (a: ManifestEntry, b: ManifestEntry) => a.uncompressedSize - b.uncompressedSize

  // Take n entries uniformly spaced across a size-sorted array
  function stratify(arr: ManifestEntry[], n: number): ManifestEntry[] {
    if (arr.length <= n) return [...arr]
    const sorted = [...arr].sort(bySize)
    const step = sorted.length / n
    return Array.from({ length: n }, (_, i) => sorted[Math.floor(i * step)])
  }

  const sample = [
    ...stratify(revised, 50),   // 50 revised-current
    ...stratify(made1990, 30),  // 30 enacted 1990-2010
    ...stratify(made2015, 20),  // 20 enacted 2015-2024
  ]

  console.log(`Pilot sample: ${sample.length} UKSI`)
  console.log(`  Revised-current: ${sample.filter(m => m.version === 'revised-current').length}`)
  console.log(`  Made (enacted):  ${sample.filter(m => m.version === 'made').length}`)
  const yearArr = sample.map(m => parseInt(m.actId.split('/')[1], 10))
  console.log(`  Year range: ${Math.min(...yearArr)}–${Math.max(...yearArr)}`)
  const sizes = sample.map(m => m.uncompressedSize)
  console.log(`  Size range: ${Math.round(Math.min(...sizes)/1024)}KB–${Math.round(Math.max(...sizes)/1024)}KB`)
  return sample
}

// ── ZIP extraction ────────────────────────────────────────────────────────────

function extractFromZip(entryPath: string): ZipHelperResult {
  const req = JSON.stringify({ zipPath: ZIP_PATH, entryPath })
  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-File', HELPER_PS1], {
      input: req, maxBuffer: 100 * 1024 * 1024, timeout: 120_000,
    })
    if (result.status !== 0) throw new Error(`PS helper failed: ${(result.stderr as Buffer|null)?.toString('utf8') ?? ''}`)
    const raw = (result.stdout as Buffer | null)?.toString('utf8').trim() ?? ''
    if (!raw || raw === 'null') return { title: '', p1groups: [] }
    try {
      const parsed = JSON.parse(raw) as ZipHelperResult
      const p1groups = parsed.p1groups
        ? (Array.isArray(parsed.p1groups) ? parsed.p1groups : [parsed.p1groups as unknown as P1groupResult])
        : []
      return { title: parsed.title ?? '', p1groups }
    } catch {
      if (attempt < 3) { console.log(`  [retry ${attempt}/3 — parse failure for ${entryPath}]`); continue }
      throw new Error(`Cannot parse PS helper JSON: ${raw.slice(0, 200)}`)
    }
  }
  throw new Error('extractFromZip: retry loop exhausted')
}

// ── ActId parsing ─────────────────────────────────────────────────────────────

function parseActId(actId: string): { yearStr: string; yearInt: number; num: number } {
  const parts = actId.split('/')  // ['uksi', '2021', '100']
  const yearStr = parts[1]
  const yearInt = parseInt(yearStr, 10)
  const num = parseInt(parts[2], 10)
  if (isNaN(yearInt) || isNaN(num)) throw new Error(`Cannot parse actId: ${actId}`)
  return { yearStr, yearInt, num }
}

// ── Progress ──────────────────────────────────────────────────────────────────

function loadProgress(): Progress {
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8')) } catch {
    return { completed: [], skipped: [], errors: {}, stats: { created: 0, sectionsCreated: 0, r2Writes: 0, tnaKeyWrites: 0, originalKeyWrites: 0, zeroSection: 0, normalized: 0, elapsed: 0 } }
  }
}
function saveProgress(p: Progress) { fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2)) }

// ── CSV log ───────────────────────────────────────────────────────────────────

function initCsv() {
  fs.writeFileSync(LOG_FILE, 'actId,version,sectionCount,r2KeyType,titleDecoded,notes\n', 'utf-8')
}
function appendCsv(row: { actId: string; version: string; sectionCount: number; r2KeyType: string; titleDecoded: boolean; notes: string }) {
  const line = [row.actId, row.version, row.sectionCount, row.r2KeyType, row.titleDecoded, `"${row.notes.replace(/"/g, '""')}"`].join(',') + '\n'
  fs.appendFileSync(LOG_FILE, line, 'utf-8')
}

// ── Throttle ──────────────────────────────────────────────────────────────────

class AdaptiveThrottle {
  private delay = 200
  async wait() { await new Promise(r => setTimeout(r, this.delay)) }
  onError() { this.delay = Math.min(this.delay * 2, 5000); console.log(`  [throttle → ${this.delay}ms]`) }
  onSuccess() { this.delay = Math.max(Math.floor(this.delay * 0.9), 100) }
}

// ── Main ingest function ──────────────────────────────────────────────────────

async function ingestUksi(entry: ManifestEntry, progress: Progress, throttle: AdaptiveThrottle, idx: number, total: number): Promise<void> {
  const { actId, zipPath, version } = entry
  const prefix = `[${idx}/${total}]`

  // ISBN-draft filter: numbers > Int32 max are 13-digit ISBNs — pre-publication drafts
  // superseded by properly numbered SIs (already ingested). Skip without any DB write.
  const numberSegment = actId.split('/')[2]
  if (parseInt(numberSegment, 10) > 2_147_483_647) {
    console.log(`${prefix} SKIPPED_ISBN_DRAFT: ${actId}`)
    progress.skipped.push(actId)
    appendCsv({ actId, version, sectionCount: 0, r2KeyType: 'N/A', titleDecoded: false, notes: 'SKIPPED_ISBN_DRAFT' })
    return
  }

  // Check idempotency
  const existing = await prisma.legislationItem.findUnique({ where: { legislationGovUkId: actId } })
  if (existing) {
    console.log(`${prefix} SKIP (exists): ${actId}`)
    progress.skipped.push(actId)
    appendCsv({ actId, version, sectionCount: 0, r2KeyType: 'N/A', titleDecoded: false, notes: 'already in Railway' })
    return
  }

  process.stdout.write(`${prefix} ${actId} (${version}, ${Math.round(entry.uncompressedSize/1024)}KB) ... `)

  // Extract from ZIP
  const { title: rawTitle, p1groups } = extractFromZip(zipPath)
  const title = decodeEntities(rawTitle) || `SI ${actId.split('/')[1]}/${actId.split('/')[2]}`
  const titleDecoded = rawTitle !== title

  // Parse actId
  const { yearStr, yearInt, num } = parseActId(actId)

  // Create LegislationItem
  const item = await prisma.legislationItem.create({
    data: {
      legislationType: LegislationType.UKSI,
      tier: LegislationTier.TIER_3,
      title,
      year: yearInt,
      yearRaw: yearStr,
      number: num,
      jurisdiction: 'UK',
      legislationGovUkId: actId,
      clmlUrl: `https://www.legislation.gov.uk/${actId}/data.xml`,
      compilationStatus: CompilationStatus.PENDING,
    }
  })

  // Ingest sections — deduplicate section numbers (some UKSI have duplicate P1groups)
  const validP1groups = p1groups.filter(p => p.sectionNumber)
  let tnaWrites = 0, originalWrites = 0
  const seenSectionNumbers = new Set<string>()

  for (const { sectionNumber: rawSectionNumber, xml } of validP1groups) {
    // Normalise: trim whitespace and strip trailing dots (e.g. "3." → "3")
    // Only sectionNumber is a dedup/join key — sectionTitle and title are display strings
    const sectionNumber = rawSectionNumber.trim().replace(/\.+$/, '')
    if (rawSectionNumber !== sectionNumber) {
      console.log(`  [normalize] ${actId} Pnumber "${rawSectionNumber}" -> "${sectionNumber}"`)
      progress.stats.normalized++
    }
    if (seenSectionNumbers.has(sectionNumber)) continue  // first occurrence wins
    seenSectionNumbers.add(sectionNumber)
    const { key, field } = getR2KeyForSection(actId, sectionNumber, version)

    await r2Put(key, xml, 'application/xml')
    if (field === 'tnaXmlKey') tnaWrites++; else originalWrites++

    const sectionTitle = decodeEntities(
      (xml.match(/<Title[^>]*>(.*?)<\/Title>/)?.[1] ?? '').replace(/<[^>]+>/g, '').trim()
    )
    const originalText = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 10000)

    await prisma.legislationSection.create({
      data: {
        legislationItemId: item.id,
        sectionNumber,
        sectionTitle: sectionTitle || null,
        ...(field === 'tnaXmlKey' ? { tnaXmlKey: key } : { originalXmlKey: key }),
        originalText,
        compilationStatus: CompilationStatus.PENDING,
      }
    })
  }

  const sectionCount = seenSectionNumbers.size
  if (sectionCount === 0) {
    progress.stats.zeroSection++
    console.log(`ZERO-SECTION`)
  } else {
    console.log(`✓ sections=${sectionCount} r2=${tnaWrites}tna+${originalWrites}orig`)
  }

  // Update sectionCount
  await prisma.legislationItem.update({ where: { id: item.id }, data: { sectionCount } })

  // Update stats
  progress.stats.created++
  progress.stats.sectionsCreated += sectionCount
  progress.stats.r2Writes += tnaWrites + originalWrites
  progress.stats.tnaKeyWrites += tnaWrites
  progress.stats.originalKeyWrites += originalWrites

  const r2KeyType = version === 'revised-current' ? 'tna' : 'original'
  appendCsv({ actId, version, sectionCount, r2KeyType, titleDecoded, notes: p1groups.length === 0 ? 'zero-section' : '' })

  throttle.onSuccess()
  await throttle.wait()
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const isPilot = !process.argv.includes('--full')
  const isResume = process.argv.includes('--resume')

  // Verify pwsh (PowerShell 7+) is available — required for ConvertTo-Json to correctly escape " in strings
  const pwshCheck = spawnSync('pwsh', ['--version'])
  if (pwshCheck.error || pwshCheck.status !== 0) {
    throw new Error('pwsh (PowerShell 7+) required but not found in PATH. Install from https://aka.ms/powershell.')
  }

  console.log(`\n=== V.3-B UKSI INGEST — ${isPilot ? 'PILOT (100 UKSI)' : 'FULL (61,179 UKSI)'} ===`)
  if (!fs.existsSync(ZIP_PATH)) { console.error(`ZIP not found: ${ZIP_PATH}`); process.exit(1) }

  const manifest: ManifestEntry[] = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8').replace(/^﻿/, ''))
  console.log(`Manifest loaded: ${manifest.length} UKSI`)

  const entries = isPilot ? selectPilotSample(manifest) : manifest
  console.log(`Processing: ${entries.length} UKSI\n`)

  const progress = isResume ? loadProgress() : loadProgress()
  const completed = new Set([...progress.completed, ...progress.skipped])

  if (isPilot && !isResume) {
    initCsv()
    console.log(`Pilot log: ${LOG_FILE}`)
  }

  const throttle = new AdaptiveThrottle()
  const startTime = Date.now()
  let i = 0

  for (const entry of entries) {
    i++
    if (completed.has(entry.actId)) {
      process.stdout.write(`[${i}/${entries.length}] SKIP (done): ${entry.actId}\r`)
      continue
    }
    try {
      await ingestUksi(entry, progress, throttle, i, entries.length)
      progress.completed.push(entry.actId)
      completed.add(entry.actId)
      // Clear any stale error entry for this actId on successful completion
      if (progress.errors[entry.actId]) delete progress.errors[entry.actId]
    } catch (err: any) {
      console.error(`\n[${i}/${entries.length}] ERROR ${entry.actId}: ${err.message}`)
      progress.errors[entry.actId] = err.message
      appendCsv({ actId: entry.actId, version: entry.version, sectionCount: 0, r2KeyType: 'N/A', titleDecoded: false, notes: `ERROR: ${err.message.slice(0, 80)}` })
      throttle.onError()
      await throttle.wait()
    }

    if (i % 10 === 0) {
      progress.stats.elapsed = Date.now() - startTime
      saveProgress(progress)
      console.log(`  [checkpoint ${i}/${entries.length} — ${progress.stats.created} created, ${progress.stats.sectionsCreated} sections]`)
    }
  }

  progress.stats.elapsed = Date.now() - startTime
  saveProgress(progress)

  const elapsed = Math.round(progress.stats.elapsed / 1000)
  console.log(`\n=== ${isPilot ? 'PILOT' : 'FULL'} INGEST COMPLETE ===`)
  console.log(`Items created:      ${progress.stats.created}`)
  console.log(`Sections created:   ${progress.stats.sectionsCreated}`)
  console.log(`R2 writes total:    ${progress.stats.r2Writes}`)
  console.log(`  → tnaXmlKey:      ${progress.stats.tnaKeyWrites}`)
  console.log(`  → originalXmlKey: ${progress.stats.originalKeyWrites}`)
  console.log(`Zero-section items: ${progress.stats.zeroSection}`)
  console.log(`Normalisations:     ${progress.stats.normalized}`)
  console.log(`Skipped (exists):   ${progress.skipped.length}`)
  console.log(`Errors:             ${Object.keys(progress.errors).length}`)
  console.log(`Elapsed:            ${elapsed}s`)
  if (Object.keys(progress.errors).length > 0) {
    console.log('Error acts:', Object.keys(progress.errors).slice(0, 10))
  }

  await prisma.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
