/**
 * V2.76-B Phase 2 — Query Railway section counts for all in-bulk UKPGA acts.
 * Outputs phase2-db-counts.json for merge with bulk P1group counts.
 */
import * as fs from 'fs'
import * as path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { prisma } from '../../../scrutinise-web/lib/prisma'

interface ManifestEntry {
  actId: string
  zipPath: string
  compressedSize: number
  uncompressedSize: number
  version: string
}

interface ReconcileResults {
  notInDbActIds: string[]
  noSectionsActIds: string[]
}

async function main() {
  const manifest: ManifestEntry[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'manifest-ukpga.json'), 'utf-8')
  )
  const reconcile: ReconcileResults = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'reconcile-results.json'), 'utf-8')
  )

  const notInDb = new Set(reconcile.notInDbActIds)

  // All bulk acts that exist in Railway (in-both set)
  const inBothActIds = manifest.filter(m => !notInDb.has(m.actId)).map(m => m.actId)
  console.log(`In-both acts: ${inBothActIds.length}`)

  // Fetch items
  const dbItems = await prisma.legislationItem.findMany({
    where: { legislationGovUkId: { in: inBothActIds } },
    select: { id: true, legislationGovUkId: true, title: true },
  })
  console.log(`Matched in Railway: ${dbItems.length}`)

  const dbItemMap = new Map(dbItems.map(i => [i.legislationGovUkId, i]))
  const dbIds = dbItems.map(i => i.id)

  // Total section count per item
  const totalStats = await prisma.legislationSection.groupBy({
    by: ['legislationItemId'],
    _count: { id: true },
    where: { legislationItemId: { in: dbIds } },
  })
  const totalById = new Map(totalStats.map(s => [s.legislationItemId, s._count.id]))

  // Sections with at least one XML key
  const withKeysStats = await prisma.legislationSection.groupBy({
    by: ['legislationItemId'],
    _count: { id: true },
    where: {
      legislationItemId: { in: dbIds },
      OR: [{ originalXmlKey: { not: null } }, { tnaXmlKey: { not: null } }],
    },
  })
  const withKeysById = new Map(withKeysStats.map(s => [s.legislationItemId, s._count.id]))

  // Build output map: actId → counts
  const output: Record<string, {
    dbId: string
    title: string
    totalSections: number
    sectionsWithKeys: number
    neitherSections: number
  }> = {}

  for (const actId of inBothActIds) {
    const item = dbItemMap.get(actId)
    if (!item) continue
    const total = totalById.get(item.id) ?? 0
    const withKeys = withKeysById.get(item.id) ?? 0
    output[actId] = {
      dbId: item.id,
      title: item.title,
      totalSections: total,
      sectionsWithKeys: withKeys,
      neitherSections: total - withKeys,
    }
  }

  const outPath = path.join(__dirname, 'phase2-db-counts.json')
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2))

  const withSections = Object.values(output).filter(v => v.totalSections > 0).length
  const withNeither = Object.values(output).filter(v => v.neitherSections > 0).length
  console.log(`Saved ${Object.keys(output).length} acts → ${outPath}`)
  console.log(`  With sections:          ${withSections}`)
  console.log(`  With some neither-key:  ${withNeither}`)
  console.log(`  Zero sections (no rows): ${Object.keys(output).length - withSections}`)

  await prisma.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
