/**
 * V2.76-B Phase 2 — Merge DB section counts + bulk P1group counts → categorise all UKPGA acts.
 * Outputs phase2-results.json and sample-comparison.md.
 */
import * as fs from 'fs'
import * as path from 'path'

interface ManifestEntry {
  actId: string
  zipPath: string
  compressedSize: number
  uncompressedSize: number
  version: string
}

interface DbCount {
  dbId: string
  title: string
  totalSections: number
  sectionsWithKeys: number
  neitherSections: number
}

interface ActResult {
  actId: string
  title: string
  category: string
  bulkP1groups: number
  dbSections: number
  dbWithKeys: number
  dbNeither: number
  version: string
  notes: string
}

// Action categories (Phase 3 plan)
// SKIP          — fully processed, no gaps
// PATCH_GAPS    — has sections but some neither-key (fill missing XML keys from bulk)
// FULL_INGEST   — 0 Railway sections, fully in bulk (extract all sections)
// COUNT_DIFF    — bulk P1group count ≠ Railway section count (investigate)
// NEW_TO_RAILWAY — in bulk but not in Railway (create item + sections)
// PRINT_ONLY    — in Railway but not in bulk (mark permanently excluded)

function main() {
  const dir = __dirname
  const manifest: ManifestEntry[] = JSON.parse(fs.readFileSync(path.join(dir, 'manifest-ukpga.json'), 'utf-8'))
  const reconcile = JSON.parse(fs.readFileSync(path.join(dir, 'reconcile-results.json'), 'utf-8'))
  const dbCounts: Record<string, DbCount> = JSON.parse(fs.readFileSync(path.join(dir, 'phase2-db-counts.json'), 'utf-8'))
  const bulkP1: Record<string, number> = JSON.parse(fs.readFileSync(path.join(dir, 'phase2-bulk-p1groups.json'), 'utf-8'))

  const notInDb = new Set<string>(reconcile.notInDbActIds)
  const inDbNotInBulkSampleIds = new Set<string>(reconcile.inDbNotInBulkSample.map((i: any) => i.id))

  const manifestMap = new Map(manifest.map(m => [m.actId, m]))

  const results: ActResult[] = []

  // Process bulk acts
  for (const entry of manifest) {
    const { actId, version } = entry

    if (notInDb.has(actId)) {
      // In bulk but not in Railway
      results.push({
        actId, title: '', category: 'NEW_TO_RAILWAY',
        bulkP1groups: bulkP1[actId] ?? -1,
        dbSections: 0, dbWithKeys: 0, dbNeither: 0,
        version,
        notes: 'Bulk XML available; no Railway item yet',
      })
      continue
    }

    const db = dbCounts[actId]
    if (!db) {
      // In manifest but missing from db-counts (25-item discrepancy)
      results.push({
        actId, title: '?', category: 'COUNT_DIFF',
        bulkP1groups: bulkP1[actId] ?? -1,
        dbSections: 0, dbWithKeys: 0, dbNeither: 0,
        version,
        notes: 'actId not matched in phase2-db-counts (possible duplicate legislationGovUkId)',
      })
      continue
    }

    const p1 = bulkP1[actId] ?? -1

    if (db.totalSections === 0) {
      results.push({
        actId, title: db.title, category: 'FULL_INGEST',
        bulkP1groups: p1, dbSections: 0, dbWithKeys: 0, dbNeither: 0,
        version,
        notes: `0 Railway sections; bulk has ${p1} P1groups`,
      })
      continue
    }

    // Has sections in Railway
    if (db.neitherSections === 0 && p1 === db.sectionsWithKeys) {
      results.push({
        actId, title: db.title, category: 'SKIP',
        bulkP1groups: p1, dbSections: db.totalSections,
        dbWithKeys: db.sectionsWithKeys, dbNeither: 0,
        version,
        notes: 'Fully processed; counts match',
      })
    } else if (db.neitherSections > 0 && p1 === db.totalSections) {
      // Gap exactly matches neither count — clean patch candidate
      results.push({
        actId, title: db.title, category: 'PATCH_GAPS',
        bulkP1groups: p1, dbSections: db.totalSections,
        dbWithKeys: db.sectionsWithKeys, dbNeither: db.neitherSections,
        version,
        notes: `${db.neitherSections} neither-key sections; bulk P1groups match total — clean patch`,
      })
    } else if (db.neitherSections > 0) {
      // Gaps + count mismatch
      results.push({
        actId, title: db.title, category: 'COUNT_DIFF',
        bulkP1groups: p1, dbSections: db.totalSections,
        dbWithKeys: db.sectionsWithKeys, dbNeither: db.neitherSections,
        version,
        notes: `${db.neitherSections} neither-key; bulk P1groups=${p1} vs DB total=${db.totalSections}`,
      })
    } else {
      // No gaps but count differs
      results.push({
        actId, title: db.title, category: 'COUNT_DIFF',
        bulkP1groups: p1, dbSections: db.totalSections,
        dbWithKeys: db.sectionsWithKeys, dbNeither: 0,
        version,
        notes: `bulk P1groups=${p1} vs DB sections=${db.sectionsWithKeys} (no neither-key gaps)`,
      })
    }
  }

  // Add PRINT_ONLY from inDbNotInBulk sample (representative)
  for (const item of reconcile.inDbNotInBulkSample) {
    results.push({
      actId: item.id, title: item.title, category: 'PRINT_ONLY',
      bulkP1groups: 0, dbSections: 0, dbWithKeys: 0, dbNeither: 0,
      version: 'none',
      notes: 'In Railway but no XML in bulk; permanently excluded',
    })
  }

  // Tally categories
  const tally: Record<string, number> = {}
  for (const r of results) {
    tally[r.category] = (tally[r.category] ?? 0) + 1
  }

  console.log('\n=== PHASE 2 CATEGORISATION ===')
  for (const [cat, count] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat.padEnd(20)} ${count}`)
  }
  // Add full PRINT_ONLY count from reconcile summary
  const fullPrintOnly = reconcile.summary.inDbNotInBulk
  console.log(`\n  Full PRINT_ONLY total (all Railway items not in bulk): ${fullPrintOnly}`)

  // Save full results
  const phase2Results = {
    summary: {
      ...tally,
      PRINT_ONLY_FULL: fullPrintOnly,
      NEW_TO_RAILWAY_full: reconcile.summary.inBulkNotInDb,
    },
    acts: results,
  }
  fs.writeFileSync(path.join(dir, 'phase2-results.json'), JSON.stringify(phase2Results, null, 2))
  console.log(`\nSaved: phase2-results.json`)

  // 10-act sample comparison
  const sampleActIds = [
    'ukpga/2010/15',   // Equality Act 2010 — large modern
    'ukpga/2006/46',   // Companies Act 2006 — FULL_INGEST target
    'ukpga/2007/3',    // Income Tax Act 2007
    'ukpga/1968/60',   // Theft Act 1968
    'ukpga/2024/3',    // Finance Act 2024
    'ukpga/1851/Vict', // Victorian era (try)
    'ukpga/1998/42',   // Human Rights Act 1998
    'ukpga/2020/1',    // Coronavirus Act 2020
    'ukpga/2023/55',   // Autumn Finance Act 2023 (try)
    'ukpga/1985/51',   // Companies Act 1985 (pre-bulk era)
  ]

  const sampleRows = sampleActIds.map(id => results.find(r => r.actId === id)).filter(Boolean) as ActResult[]
  // Also add top 2 PATCH_GAPS acts (by neither count)
  const topPatches = results
    .filter(r => r.category === 'PATCH_GAPS')
    .sort((a, b) => b.dbNeither - a.dbNeither)
    .slice(0, 3)
  const sampleFull = [...sampleRows, ...topPatches.filter(p => !sampleActIds.includes(p.actId))]

  const mdLines = [
    '# V2.76-B Phase 2 — Sample Comparison Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    '| Category | Count |',
    '|----------|-------|',
    ...Object.entries(tally).sort((a, b) => b[1] - a[1]).map(
      ([cat, count]) => `| ${cat} | ${count} |`
    ),
    `| PRINT_ONLY (full corpus) | ${fullPrintOnly} |`,
    '',
    '### Category definitions',
    '- **SKIP** — fully processed, no gaps, counts match; no Phase 3 action needed',
    '- **PATCH_GAPS** — has sections but some have neither-key (fetch XML key from bulk)',
    '- **FULL_INGEST** — 0 Railway sections, XML exists in bulk (extract all P1groups)',
    '- **COUNT_DIFF** — bulk P1group count ≠ Railway section count (needs investigation)',
    '- **NEW_TO_RAILWAY** — in bulk but no Railway item yet (create item + ingest sections)',
    '- **PRINT_ONLY** — in Railway but no XML in bulk (mark permanently excluded)',
    '',
    '## 10-act sample',
    '',
    '| Act | Category | Bulk P1groups | DB sections | DB with keys | DB neither | Version |',
    '|-----|----------|--------------|-------------|-------------|------------|---------|',
    ...sampleFull.map(r =>
      `| ${r.actId} | ${r.category} | ${r.bulkP1groups} | ${r.dbSections} | ${r.dbWithKeys} | ${r.dbNeither} | ${r.version} |`
    ),
    '',
    '## Top PATCH_GAPS acts (by neither-key count)',
    '',
    '| Act | Title | Neither-key sections | Bulk P1groups | Total DB sections |',
    '|-----|-------|---------------------|--------------|------------------|',
    ...results
      .filter(r => r.category === 'PATCH_GAPS')
      .sort((a, b) => b.dbNeither - a.dbNeither)
      .slice(0, 10)
      .map(r => `| ${r.actId} | ${r.title.substring(0, 50)} | ${r.dbNeither} | ${r.bulkP1groups} | ${r.dbSections} |`),
    '',
    '## NEW_TO_RAILWAY sample (first 10)',
    '',
    '| Act | Bulk P1groups | Version |',
    '|-----|--------------|---------|',
    ...results
      .filter(r => r.category === 'NEW_TO_RAILWAY')
      .slice(0, 10)
      .map(r => `| ${r.actId} | ${r.bulkP1groups} | ${r.version} |`),
    '',
    '## Phase 3 action plan',
    '',
    `- **FULL_INGEST** (${tally['FULL_INGEST'] ?? 0} act${(tally['FULL_INGEST'] ?? 0) === 1 ? '' : 's'}): Extract P1groups from bulk XML, write to R2, create Railway LegislationSection rows`,
    `- **PATCH_GAPS** (${tally['PATCH_GAPS'] ?? 0} acts): For each neither-key section, find matching P1group in bulk XML, write to R2, update Railway key fields`,
    `- **NEW_TO_RAILWAY** (${reconcile.summary.inBulkNotInDb} acts): Create LegislationItem + LegislationSection rows from bulk XML — requires schema decision`,
    `- **PRINT_ONLY** (${fullPrintOnly} acts): Set compilationStatus = 'PRINT_ONLY' (or new field) — no R2 writes`,
    `- **COUNT_DIFF** (${tally['COUNT_DIFF'] ?? 0} acts): Manual investigation before Phase 3`,
    `- **SKIP** (${tally['SKIP'] ?? 0} acts): No action`,
    '',
  ]

  fs.writeFileSync(path.join(dir, 'sample-comparison.md'), mdLines.join('\n'))
  console.log('Saved: sample-comparison.md')
}

main()
