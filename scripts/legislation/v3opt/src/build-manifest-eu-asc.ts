/**
 * V.3-E — Retained EU Law + Acts of the Senedd Cymru manifest builder
 *
 * Scans best-collection-xml.zip for EUR, EUDN, EUDR, and ASC entries and outputs
 * four separate manifest JSON files consumed by main.ts / the v3opt ingest pipeline:
 *
 *   manifest-eur.json   — Retained EU Regulations  (24,488 raw entries)
 *   manifest-eudn.json  — Retained EU Decisions     (13,173 raw entries)
 *   manifest-eudr.json  — Retained EU Directives    (2,035 raw entries)
 *   manifest-asc.json   — Acts of the Senedd Cymru  (32 raw entries)
 *
 * Dedup rule (matches production ingest mandate):
 *   - If both revised-current and enacted/adopted exist for the same actId, keep revised-current only.
 *   - If only enacted/adopted exists, keep it (mapped to 'made').
 *   - Never include both versions of the same item.
 *
 * Version word mapping:
 *   'revised'  → 'revised-current'
 *   'enacted'  → 'made'
 *   'adopted'  → 'made'
 *   anything else → 'made'
 *
 * Usage (from v3opt directory, after tsc build):
 *   node dist/build-manifest-eu-asc.js
 *
 * Or with ts-node (development):
 *   npx ts-node --transpile-only src/build-manifest-eu-asc.ts
 */

import * as path from 'path'
import * as fs from 'fs'
import AdmZip from 'adm-zip'
import type { ManifestEntry } from './manifest'
import type { ManifestVersion } from './r2keys'

const DIR = __dirname
const ZIP_PATH = path.resolve(DIR, '../../v276-bulk/best-collection-xml.zip')

const OUT_EUR  = path.resolve(DIR, '../manifest-eur.json')
const OUT_EUDN = path.resolve(DIR, '../manifest-eudn.json')
const OUT_EUDR = path.resolve(DIR, '../manifest-eudr.json')
const OUT_ASC  = path.resolve(DIR, '../manifest-asc.json')

// ---------------------------------------------------------------------------
// Type configuration
// ---------------------------------------------------------------------------

interface TypeConfig {
  prefix: string           // filename prefix, e.g. 'eur'
  legislationType: string  // LegislationType enum value, e.g. 'EUR'
  jurisdiction: string     // stored on LegislationItem
  outPath: string          // output manifest file path
}

const TYPE_CONFIGS: TypeConfig[] = [
  { prefix: 'eur',  legislationType: 'EUR',  jurisdiction: 'UK',    outPath: OUT_EUR  },
  { prefix: 'eudn', legislationType: 'EUDN', jurisdiction: 'UK',    outPath: OUT_EUDN },
  { prefix: 'eudr', legislationType: 'EUDR', jurisdiction: 'UK',    outPath: OUT_EUDR },
  { prefix: 'asc',  legislationType: 'ASC',  jurisdiction: 'Wales', outPath: OUT_ASC  },
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

    // Extract type prefix from filename (strip optional year-dir prefix first)
    const bn = fullName.split('/').pop() || fullName
    const prefixMatch = bn.match(/^([a-z]+)-\d+/i)
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
    const candidate: Candidate = {
      entry: parsed,
      compressedSize: parsed.compressedSize,
      uncompressedSize: parsed.uncompressedSize,
    }

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
  // Group by legislationType for per-type manifest output
  const perType = new Map<string, ManifestEntry[]>()
  for (const c of TYPE_CONFIGS) perType.set(c.legislationType, [])

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

    const lt = entry.legislationType!
    const group = perType.get(lt)
    if (group) group.push(entry)
  }

  // Sort each manifest by actId for deterministic output
  for (const arr of perType.values()) {
    arr.sort((a, b) => a.actId < b.actId ? -1 : 1)
  }

  // Write outputs
  console.log('\n=== Dedup summary ===')
  console.log(`  revised-current kept:          ${dedupRevised}`)
  console.log(`  made/enacted/adopted kept:      ${dedupMadeOnly}`)
  console.log(`  made dropped (revised exists):  ${dedupDropped}`)

  for (const config of TYPE_CONFIGS) {
    const items = perType.get(config.legislationType)!
    const revised  = items.filter(e => e.version === 'revised-current').length
    const made     = items.filter(e => e.version === 'made').length

    fs.writeFileSync(config.outPath, JSON.stringify(items, null, 2), 'utf8')

    console.log(`\n=== ${config.legislationType} ===`)
    console.log(`  Total:          ${items.length}`)
    console.log(`  revised-current: ${revised}`)
    console.log(`  made/enacted:    ${made}`)
    console.log(`  Saved → ${config.outPath}`)
  }
}

buildManifests()
