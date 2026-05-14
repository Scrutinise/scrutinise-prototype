/**
 * V2.76-B Phase 3A — Mark 9,043 print-only acts in Railway.
 * Sets compilationStatus = PRINT_ONLY on LegislationItem rows that have
 * no XML in the bulk ZIP (i.e., not present in manifest-ukpga.json).
 */
import * as fs from 'fs'
import * as path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { prisma } from '../../../scrutinise-web/lib/prisma'
import { CompilationStatus } from '@prisma/client'

interface ManifestEntry { actId: string }

async function main() {
  const manifest: ManifestEntry[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'manifest-ukpga.json'), 'utf-8')
  )

  const bulkActIds = new Set(manifest.map(m => m.actId))
  console.log(`Bulk manifest actIds: ${bulkActIds.size}`)

  // All Railway LegislationItem
  const allItems = await prisma.legislationItem.findMany({
    select: { id: true, legislationGovUkId: true, compilationStatus: true },
  })
  console.log(`Railway total: ${allItems.length}`)

  // Find items NOT in bulk and not already PRINT_ONLY
  const toPrintOnly = allItems.filter(
    i => !bulkActIds.has(i.legislationGovUkId) && i.compilationStatus !== CompilationStatus.PRINT_ONLY
  )
  console.log(`To mark PRINT_ONLY: ${toPrintOnly.length}`)

  if (toPrintOnly.length === 0) {
    console.log('Nothing to do.')
    await prisma.$disconnect()
    return
  }

  // Batch update in chunks of 500
  const BATCH = 500
  let updated = 0
  for (let i = 0; i < toPrintOnly.length; i += BATCH) {
    const chunk = toPrintOnly.slice(i, i + BATCH).map(r => r.id)
    const result = await prisma.legislationItem.updateMany({
      where: { id: { in: chunk } },
      data: { compilationStatus: CompilationStatus.PRINT_ONLY },
    })
    updated += result.count
    process.stdout.write(`\r  Updated ${updated}/${toPrintOnly.length}...`)
  }

  console.log(`\nDone. Marked ${updated} acts as PRINT_ONLY.`)
  await prisma.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
