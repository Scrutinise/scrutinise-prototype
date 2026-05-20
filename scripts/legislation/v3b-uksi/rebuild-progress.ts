/**
 * Rebuilds D:\uksi-phase3-progress.json from Railway.
 * Run this once before resuming Phase 3 when the progress file was lost.
 * Queries all LegislationType.UKSI rows in Railway and writes them to
 * the progress file as "completed", so --resume skips them efficiently.
 */
import * as fs from 'fs'
import dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { prisma } from '../../../scrutinise-web/lib/prisma'
import { LegislationType } from '@prisma/client'

const PROGRESS_FILE = 'D:\\uksi-phase3-progress.json'

async function main() {
  console.log('Querying Railway for all ingested UKSI...')
  const items = await prisma.legislationItem.findMany({
    where: { legislationType: LegislationType.UKSI },
    select: {
      legislationGovUkId: true,
      sectionCount: true,
      _count: { select: { sections: true } }
    }
  })
  console.log(`Found: ${items.length} UKSI in Railway`)

  const totalSections = items.reduce((s, i) => s + i._count.sections, 0)
  console.log(`Total sections: ${totalSections}`)

  const progress = {
    completed: items.map(i => i.legislationGovUkId),
    skipped:   [] as string[],
    errors:    {} as Record<string, string>,
    stats: {
      created:          items.length,
      sectionsCreated:  totalSections,
      r2Writes:         totalSections,   // approximate — R2 and sections should be equal
      tnaKeyWrites:     0,               // not tracked from DB; use 0
      originalKeyWrites: 0,              // not tracked from DB; use 0
      zeroSection:      items.filter(i => i._count.sections === 0).length,
      normalized:       0,               // not tracked from DB; will accumulate on resume
      elapsed:          0,
    }
  }

  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2))
  const sizeMB = (fs.statSync(PROGRESS_FILE).size / 1024 / 1024).toFixed(1)
  console.log(`Written to ${PROGRESS_FILE} (${sizeMB} MB)`)
  console.log(`\nNow run Phase 3 resume from a PowerShell terminal:`)
  console.log(`  cd C:\\Code\\scrutinise-prototype\\scrutinise-web`)
  console.log(`  $env:NODE_PATH = 'C:\\Code\\scrutinise-prototype\\scrutinise-web\\node_modules'`)
  console.log(`  $env:TEMP = 'D:\\Temp'`)
  console.log(`  $env:TMP  = 'D:\\Temp'`)
  console.log(`  npx ts-node --project ..\\scripts\\tsconfig.json ..\\scripts\\legislation\\v3b-uksi\\phase3-uksi-ingest.ts --full --resume 2>&1 | Tee-Object D:\\uksi-phase3-run.log`)

  await prisma.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
