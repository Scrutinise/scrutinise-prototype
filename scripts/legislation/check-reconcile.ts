/**
 * V2.76-B Phase 1 — Cross-check bulk manifest against Railway DB state.
 * Categorises each UKPGA act from the bulk ZIP.
 */
import * as fs from 'fs'
import * as path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { prisma } from '../../scrutinise-web/lib/prisma'

interface ManifestEntry {
  actId: string
  zipPath: string
  compressedSize: number
  uncompressedSize: number
  version: string
}

async function main() {
  const manifestPath = path.join(__dirname, 'v276-bulk/manifest-ukpga.json')
  const manifest: ManifestEntry[] = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  console.log(`Manifest: ${manifest.length} UKPGA acts from bulk ZIP`)

  // Load ALL Railway UKPGA items
  const dbItems = await prisma.legislationItem.findMany({
    select: {
      id: true,
      legislationGovUkId: true,
      sectionCount: true,
      compiledSectionCount: true,
      title: true,
    },
  })
  console.log(`Railway: ${dbItems.length} LegislationItem rows`)

  // Build lookup maps
  const dbById = new Map(dbItems.map(i => [i.legislationGovUkId, i]))

  // Load section counts per item from LegislationSection
  const sectionCounts = await prisma.legislationSection.groupBy({
    by: ['legislationItemId'],
    _count: { id: true },
    where: {
      OR: [
        { originalXmlKey: { not: null } },
        { tnaXmlKey: { not: null } },
      ],
    },
  })
  const sectionCountById = new Map(sectionCounts.map(s => [s.legislationItemId, s._count.id]))

  const neitherCounts = await prisma.legislationSection.groupBy({
    by: ['legislationItemId'],
    _count: { id: true },
    where: { originalXmlKey: null, tnaXmlKey: null },
  })
  const neitherById = new Map(neitherCounts.map(s => [s.legislationItemId, s._count.id]))

  // Categorise each bulk act
  const categories = {
    IN_DB_HAS_SECTIONS: [] as string[],   // In bulk + Railway + has section data
    IN_DB_NEITHER_ONLY: [] as string[],   // In bulk + Railway + only neither-key sections (202 failures)
    IN_DB_NO_SECTIONS: [] as string[],    // In bulk + Railway + NO section rows at all
    NOT_IN_DB: [] as string[],             // In bulk but NOT in Railway
  }

  for (const entry of manifest) {
    const dbItem = dbById.get(entry.actId)
    if (!dbItem) {
      categories.NOT_IN_DB.push(entry.actId)
      continue
    }
    const withKeys = sectionCountById.get(dbItem.id) ?? 0
    const neither = neitherById.get(dbItem.id) ?? 0
    const totalSections = withKeys + neither

    if (withKeys > 0) {
      categories.IN_DB_HAS_SECTIONS.push(entry.actId)
    } else if (neither > 0) {
      categories.IN_DB_NEITHER_ONLY.push(entry.actId)
    } else {
      categories.IN_DB_NO_SECTIONS.push(entry.actId)
    }
  }

  // Acts in Railway but NOT in bulk (should all be print-only)
  const bulkActIds = new Set(manifest.map(m => m.actId))
  const inDbNotInBulk = dbItems.filter(i => !bulkActIds.has(i.legislationGovUkId))

  console.log('\n=== CROSS-CHECK RESULTS ===')
  console.log(`In bulk + Railway + has section data:         ${categories.IN_DB_HAS_SECTIONS.length}`)
  console.log(`In bulk + Railway + neither-key sections only: ${categories.IN_DB_NEITHER_ONLY.length}`)
  console.log(`In bulk + Railway + NO sections at all:       ${categories.IN_DB_NO_SECTIONS.length}`)
  console.log(`In bulk but NOT in Railway:                   ${categories.NOT_IN_DB.length}`)
  console.log(`In Railway but NOT in bulk (print-only est.): ${inDbNotInBulk.length}`)

  // Sample NOT_IN_DB
  if (categories.NOT_IN_DB.length > 0) {
    console.log('\nNOT_IN_DB sample (first 10):')
    categories.NOT_IN_DB.slice(0, 10).forEach(id => console.log(`  ${id}`))
  }

  // Sample IN_DB_NEITHER_ONLY (202-failure class)
  if (categories.IN_DB_NEITHER_ONLY.length > 0) {
    console.log('\nIN_DB_NEITHER_ONLY sample (first 5 — these get patched by bulk):')
    categories.IN_DB_NEITHER_ONLY.slice(0, 5).forEach(id => console.log(`  ${id}`))
  }

  // Show IN_DB_NO_SECTIONS sample
  if (categories.IN_DB_NO_SECTIONS.length > 0) {
    console.log('\nIN_DB_NO_SECTIONS sample (first 5 — in bulk, in DB, but 0 section rows):')
    categories.IN_DB_NO_SECTIONS.slice(0, 5).forEach(id => {
      const item = dbById.get(id)
      console.log(`  ${id} — "${item?.title}"`)
    })
  }

  // Save results
  const resultsPath = path.join(__dirname, 'v276-bulk/reconcile-results.json')
  fs.writeFileSync(resultsPath, JSON.stringify({
    summary: {
      bulkTotal: manifest.length,
      railwayTotal: dbItems.length,
      inBulkAndDbWithSections: categories.IN_DB_HAS_SECTIONS.length,
      inBulkAndDbNeitherOnly: categories.IN_DB_NEITHER_ONLY.length,
      inBulkAndDbNoSections: categories.IN_DB_NO_SECTIONS.length,
      inBulkNotInDb: categories.NOT_IN_DB.length,
      inDbNotInBulk: inDbNotInBulk.length,
    },
    neitherActIds: categories.IN_DB_NEITHER_ONLY,
    noSectionsActIds: categories.IN_DB_NO_SECTIONS,
    notInDbActIds: categories.NOT_IN_DB,
    inDbNotInBulkSample: inDbNotInBulk.slice(0, 20).map(i => ({ id: i.legislationGovUkId, title: i.title })),
  }, null, 2))
  console.log(`\nResults saved: ${resultsPath}`)

  await prisma.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
