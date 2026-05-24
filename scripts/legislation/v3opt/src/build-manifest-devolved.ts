/**
 * V.3-D — Devolved corpus manifest builder
 *
 * Scans best-collection-xml.zip for devolved legislation entries and outputs
 * two manifest JSON files consumed by main.ts / the v3opt ingest pipeline:
 *
 *   manifest-devolved-secondary.json  — SSI + NISR + WSI + NISI
 *   manifest-devolved-primary.json    — ASP + NIA + ANAW
 *
 * Dedup rule (matches production ingest mandate):
 *   - If both revised-current and made exist for the same actId, keep revised-current only.
 *   - If only made (or enacted) exists, keep it.
 *   - Never include both versions of the same item.
 *
 * Usage (from v3opt directory, after tsc build):
 *   node dist/build-manifest-devolved.js
 *
 * Or with ts-node (development):
 *   npx ts-node --transpile-only src/build-manifest-devolved.ts
 */

import * as path from 'path'
import * as fs from 'fs'
import AdmZip from 'adm-zip'
import type { ManifestEntry } from './manifest'
import type { ManifestVersion } from './r2keys'

const DIR = __dirname
const ZIP_PATH = path.resolve(DIR, '../../v276-bulk/best-collection-xml.zip')
const OUT_SECONDARY = path.resolve(DIR, '../manifest-devolved-secondary.json')
const OUT_PRIMARY   = path.resolve(DIR, '../manifest-devolved-primary.json')

// ---------------------------------------------------------------------------
// Type configuration
// ---------------------------------------------------------------------------

interface TypeConfig {
  prefix: string          // filename prefix, e.g. 'ssi'
  legislationType: string // LegislationType enum value, e.g. 'SSI'
  jurisdiction: string    // stored on LegislationItem
  group: 'secondary' | 'primary'
}

const TYPE_CONFIGS: TypeConfig[] = [
  // Devolved secondary (same P1group XML structure as UKSI)
  { prefix: 'ssi',  legislationType: 'SSI',  jurisdiction: 'Scotland',         group: 'secondary' },
  { prefix: 'nisr', legislationType: 'NISR', jurisdiction: 'Northern Ireland',  group: 'secondary' },
  { prefix: 'wsi',  legislationType: 'WSI',  jurisdiction: 'Wales',             group: 'secondary' },
  { prefix: 'nisi', legislationType: 'NISI', jurisdiction: 'Northern Ireland',  group: 'secondary' },
  // Devolved primary (also P1group — confirmed in Step 3 structural check)
  { prefix: 'asp',  legislationType: 'ASP',  jurisdiction: 'Scotland',          group: 'primary' },
  { prefix: 'nia',  legislationType: 'NIA',  jurisdiction: 'Northern Ireland',  group: 'primary' },
  { prefix: 'anaw', legislationType: 'ANAW', jurisdiction: 'Wales',             group: 'primary' },
]

// ---------------------------------------------------------------------------
// Filename parser
// Matches: {yearDir}/{prefix}-{year}-{num}-{versionWord}-data.xml
// ---------------------------------------------------------------------------

function parseEntry(fullName: string, config: TypeConfig): ManifestEntry | null {
  const p = config.prefix
  // Regex: optional year-dir prefix, then the canonical filename segment
  const re = new RegExp(`^(?:\\d+/)?(${p})-(\\d+)-(\\d+)-([\\w]+)-data\\.xml$`, 'i')
  const m = fullName.match(re)
  if (!m) return null
  const [, , yearStr, numStr, versionWord] = m
  const actId = `${p}/${yearStr}/${numStr}`
  // Map version words: 'revised' → 'revised-current', anything else → 'made'
  const version: ManifestVersion = versionWord.toLowerCase() === 'revised'
    ? 'revised-current'
    : 'made'
  return {
    actId,
    zipPath: fullName,
    compressedSize: 0,    // filled in after parsing
    uncompressedSize: 0,
    version,
    legislationType: config.legislationType,
    jurisdiction: config.jurisdiction,
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function buildManifests(): void {
  if (!fs.existsSync(ZIP_PATH)) {
    console.error(`ZIP not found: ${ZIP_PATH}`)
    process.exit(1)
  }

  console.log(`Opening ZIP: ${ZIP_PATH}`)
  const zip = new AdmZip(ZIP_PATH)
  const entries = zip.getEntries()
  console.log(`Total ZIP entries: ${entries.length}`)

  // Build a lookup map: config prefix → TypeConfig
  const prefixMap = new Map(TYPE_CONFIGS.map(c => [c.prefix, c]))

  // Intermediate: actId → { revised?: candidate, made?: candidate }
  type Candidate = { entry: ManifestEntry; compressedSize: number; uncompressedSize: number }
  const byActId = new Map<string, { revised?: Candidate; made?: Candidate }>()

  let totalMatched = 0

  for (const zipEntry of entries) {
    const fullName = zipEntry.entryName
    if (zipEntry.header.size === 0) continue   // directory entry

    // Extract type prefix from filename
    const prefixMatch = fullName.match(/^(?:\d+\/)?([a-z]+)-\d+/i)
    if (!prefixMatch) continue
    const prefix = prefixMatch[1].toLowerCase()

    const config = prefixMap.get(prefix)
    if (!config) continue

    const parsed = parseEntry(fullName, config)
    if (!parsed) continue

    parsed.compressedSize   = zipEntry.header.compressedSize
    parsed.uncompressedSize = zipEntry.header.size

    totalMatched++

    const key  = parsed.actId
    const slot = byActId.get(key) ?? {}
    const candidate: Candidate = { entry: parsed, compressedSize: parsed.compressedSize, uncompressedSize: parsed.uncompressedSize }

    if (parsed.version === 'revised-current') {
      slot.revised = candidate
    } else {
      // Only store made if no made already seen (first occurrence wins for same-type dupes)
      if (!slot.made) slot.made = candidate
    }

    byActId.set(key, slot)
  }

  console.log(`Matched entries (before dedup): ${totalMatched}`)

  // Dedup: prefer revised-current, fall back to made
  const secondary: ManifestEntry[] = []
  const primary:   ManifestEntry[] = []
  let dedupRevised = 0, dedupMadeOnly = 0, dedupDropped = 0

  for (const [actId, slot] of byActId) {
    const chosen: Candidate = slot.revised ?? slot.made!
    if (slot.revised && slot.made) dedupDropped++   // made was superseded by revised

    const entry: ManifestEntry = {
      ...chosen.entry,
      actId,
      compressedSize:   chosen.compressedSize,
      uncompressedSize: chosen.uncompressedSize,
    }

    if (chosen.entry.version === 'revised-current') {
      dedupRevised++
    } else {
      dedupMadeOnly++
    }

    const config = prefixMap.get(actId.split('/')[0])!
    if (config.group === 'secondary') {
      secondary.push(entry)
    } else {
      primary.push(entry)
    }
  }

  // Sort by actId for deterministic output
  secondary.sort((a, b) => a.actId < b.actId ? -1 : 1)
  primary.sort((a, b) => a.actId < b.actId ? -1 : 1)

  // Write outputs
  fs.writeFileSync(OUT_SECONDARY, JSON.stringify(secondary, null, 2), 'utf8')
  fs.writeFileSync(OUT_PRIMARY,   JSON.stringify(primary,   null, 2), 'utf8')

  // Stats
  console.log('\n=== Dedup summary ===')
  console.log(`  revised-current kept:    ${dedupRevised}`)
  console.log(`  made-only kept:          ${dedupMadeOnly}`)
  console.log(`  made dropped (had revised): ${dedupDropped}`)

  console.log('\n=== Secondary manifest (SSI + NISR + WSI + NISI) ===')
  for (const lt of ['SSI', 'NISR', 'WSI', 'NISI']) {
    const items = secondary.filter(e => e.legislationType === lt)
    const revised = items.filter(e => e.version === 'revised-current').length
    const made    = items.filter(e => e.version === 'made').length
    console.log(`  ${lt.padEnd(6)}: ${String(items.length).padStart(6)} total  (${revised} revised-current, ${made} made)`)
  }
  console.log(`  TOTAL  : ${secondary.length}`)
  console.log(`  Saved  : ${OUT_SECONDARY}`)

  console.log('\n=== Primary manifest (ASP + NIA + ANAW) ===')
  for (const lt of ['ASP', 'NIA', 'ANAW']) {
    const items = primary.filter(e => e.legislationType === lt)
    const revised = items.filter(e => e.version === 'revised-current').length
    const made    = items.filter(e => e.version === 'made').length
    console.log(`  ${lt.padEnd(6)}: ${String(items.length).padStart(6)} total  (${revised} revised-current, ${made} made)`)
  }
  console.log(`  TOTAL  : ${primary.length}`)
  console.log(`  Saved  : ${OUT_PRIMARY}`)
}

buildManifests()
