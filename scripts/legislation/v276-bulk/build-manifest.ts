/**
 * V2.76-B — Manifest builder
 * Scans the extracted Best Collection XML archive and builds a per-act manifest
 * for UKPGA acts, recording path, section count (P1group elements), and version type.
 *
 * Run AFTER extraction:
 *   Expand-Archive best-collection-xml.zip extracted\
 *   NODE_PATH=...scrutinise-web/node_modules npx ts-node --transpile-only build-manifest.ts
 */

import * as fs from 'fs'
import * as path from 'path'

const EXTRACTED_DIR = path.join(__dirname, 'extracted')
const MANIFEST_OUT  = path.join(__dirname, 'manifest-ukpga.json')

interface ManifestEntry {
  actId: string              // e.g. ukpga/2010/15
  filePath: string           // relative path within extracted dir
  fileSizeBytes: number
  p1groupCount: number       // number of <P1group or <P1 elements (sections)
  datasetType: 'revised-current' | 'enacted-epublished' | 'best-collection' | 'unknown'
}

function countP1groups(xml: string): number {
  // Count <P1group or <P1 elements — each represents a numbered section
  const matches = xml.match(/<P1group[^>]*/g)
  if (matches) return matches.length
  // Fallback: count <P1 opening tags (some old acts use P1 not P1group)
  const p1matches = xml.match(/<P1\b[^>]*/g)
  return p1matches ? p1matches.length : 0
}

function detectDatasetType(xml: string, filePath: string): ManifestEntry['datasetType'] {
  if (filePath.includes('revised-current') || filePath.includes('revised_current')) return 'revised-current'
  if (filePath.includes('enacted-epublished') || filePath.includes('enacted_epublished')) return 'enacted-epublished'
  if (filePath.includes('best-collection') || filePath.includes('best_collection')) return 'best-collection'
  // Try to detect from CLML metadata
  if (xml.includes('DocumentStatus Value="draft"') || xml.includes('status="enacted"')) return 'enacted-epublished'
  if (xml.includes('DocumentStatus Value="revised"')) return 'revised-current'
  return 'unknown'
}

function extractActId(filePath: string): string | null {
  // Expected patterns from TNA bulk archive:
  // ukpga/2010/15/... or ukpga-2010-15.xml
  const match = filePath.match(/ukpga[\/\\-](\w+)[\/\\-](\d+)/i)
  if (!match) return null
  const [, yearOrReg, num] = match
  return `ukpga/${yearOrReg}/${num}`
}

async function walkDir(dir: string, files: string[] = []): Promise<string[]> {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await walkDir(fullPath, files)
    } else if (entry.name.endsWith('.xml')) {
      files.push(fullPath)
    }
  }
  return files
}

async function main() {
  if (!fs.existsSync(EXTRACTED_DIR)) {
    console.error(`Extracted directory not found: ${EXTRACTED_DIR}`)
    console.error('Run Expand-Archive best-collection-xml.zip extracted\\ first.')
    process.exit(1)
  }

  console.log(`Scanning ${EXTRACTED_DIR} for XML files...`)
  const allFiles = await walkDir(EXTRACTED_DIR)
  console.log(`Found ${allFiles.length} total XML files.`)

  // Show top-level directory structure
  const topLevel = fs.readdirSync(EXTRACTED_DIR, { withFileTypes: true })
  console.log('\nTop-level structure:')
  for (const entry of topLevel) {
    console.log(`  ${entry.isDirectory() ? '[dir]' : '[file]'} ${entry.name}`)
  }

  // Filter to UKPGA files
  const ukpgaFiles = allFiles.filter(f => f.toLowerCase().includes('ukpga'))
  console.log(`\nUKPGA XML files: ${ukpgaFiles.length}`)

  if (ukpgaFiles.length === 0) {
    console.log('\nNo UKPGA files found. Dumping first 20 file paths to understand structure:')
    for (const f of allFiles.slice(0, 20)) {
      console.log(' ', path.relative(EXTRACTED_DIR, f))
    }
    return
  }

  const manifest: ManifestEntry[] = []
  let processed = 0

  for (const filePath of ukpgaFiles) {
    const relPath = path.relative(EXTRACTED_DIR, filePath)
    const actId = extractActId(relPath)
    if (!actId) {
      console.warn(`  Could not extract actId from: ${relPath}`)
      continue
    }

    const stat = fs.statSync(filePath)
    const xml = fs.readFileSync(filePath, 'utf-8')
    const p1count = countP1groups(xml)
    const dsType = detectDatasetType(xml, relPath)

    manifest.push({
      actId,
      filePath: relPath,
      fileSizeBytes: stat.size,
      p1groupCount: p1count,
      datasetType: dsType,
    })

    processed++
    if (processed % 500 === 0) {
      process.stdout.write(`\r  Processed ${processed}/${ukpgaFiles.length}...`)
    }
  }

  console.log(`\n\nManifest built: ${manifest.length} UKPGA acts.`)

  // Summary stats
  const withSections = manifest.filter(m => m.p1groupCount > 0)
  const zeroSections = manifest.filter(m => m.p1groupCount === 0)
  const totalSections = manifest.reduce((acc, m) => acc + m.p1groupCount, 0)

  console.log(`  Acts with at least 1 P1group (section): ${withSections.length}`)
  console.log(`  Acts with 0 P1groups: ${zeroSections.length}`)
  console.log(`  Total P1group count across all acts: ${totalSections}`)

  // Dataset type breakdown
  const byType: Record<string, number> = {}
  for (const m of manifest) {
    byType[m.datasetType] = (byType[m.datasetType] || 0) + 1
  }
  console.log('\nDataset type breakdown:')
  for (const [t, c] of Object.entries(byType)) {
    console.log(`  ${t}: ${c}`)
  }

  fs.writeFileSync(MANIFEST_OUT, JSON.stringify(manifest, null, 2))
  console.log(`\nManifest saved: ${MANIFEST_OUT}`)
}

main().catch(err => { console.error(err); process.exit(1) })
