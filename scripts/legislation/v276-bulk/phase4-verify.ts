/**
 * V2.76-B Phase 4 — Verification spot-checks.
 */
import * as path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { prisma } from '../../../scrutinise-web/lib/prisma'
import { r2Exists, tnaXmlKey as makeTnaKey } from '../../legislation/r2-client'
import { CompilationStatus } from '@prisma/client'

async function main() {
  // 1. PRINT_ONLY count
  const printOnlyCount = await prisma.legislationItem.count({
    where: { compilationStatus: CompilationStatus.PRINT_ONLY },
  })
  console.log(`\n=== PHASE 4 VERIFICATION ===`)
  console.log(`LegislationItem PRINT_ONLY: ${printOnlyCount} (expected: 9043)`)

  // 2. Companies Act 2006 spot-check
  const co2006 = await prisma.legislationItem.findUnique({
    where: { legislationGovUkId: 'ukpga/2006/46' },
    include: { _count: { select: { sections: true } } },
  })
  console.log(`\nCompanies Act 2006:`)
  console.log(`  Section rows: ${co2006?._count.sections} (expected: 1665)`)
  console.log(`  Compilation status: ${co2006?.compilationStatus}`)

  // Verify a few R2 keys exist for Companies Act 2006
  const sampleSections = ['1', '10', '100', '500', '1000']
  console.log(`  R2 spot-check (sections ${sampleSections.join(', ')}):`)
  for (const s of sampleSections) {
    const key = makeTnaKey('ukpga/2006/46', s)
    const exists = await r2Exists(key)
    console.log(`    ${key}: ${exists ? 'EXISTS' : 'MISSING'}`)
  }

  // 3. PATCH_GAPS verification — check one well-patched act
  const patchedActs = [
    { actId: 'ukpga/2015/21', expectPatched: 155 },  // Corporation Tax NI — patched 155/156
    { actId: 'ukpga/2000/6',  expectPatched: 10 },    // full patch
  ]
  for (const { actId, expectPatched } of patchedActs) {
    const item = await prisma.legislationItem.findUnique({ where: { legislationGovUkId: actId }, select: { id: true, title: true } })
    if (!item) continue
    const neither = await prisma.legislationSection.count({
      where: { legislationItemId: item.id, originalXmlKey: null, tnaXmlKey: null },
    })
    const withTna = await prisma.legislationSection.count({
      where: { legislationItemId: item.id, tnaXmlKey: { not: null } },
    })
    console.log(`\n${actId} (${item.title.substring(0, 40)}):`)
    console.log(`  Neither-key remaining: ${neither}`)
    console.log(`  Sections with tnaXmlKey: ${withTna}`)
  }

  // 4. Neither-key delta
  const neitherTotal = await prisma.legislationSection.count({
    where: { originalXmlKey: null, tnaXmlKey: null },
  })
  console.log(`\nTotal NEITHER-key sections remaining: ${neitherTotal} (was 21850, reduced by ${21850 - neitherTotal})`)

  // 5. Company Act 2006 section details (first 5)
  const co2006Sections = await prisma.legislationSection.findMany({
    where: { legislationItem: { legislationGovUkId: 'ukpga/2006/46' } },
    select: { sectionNumber: true, sectionTitle: true, tnaXmlKey: true },
    orderBy: { sectionNumber: 'asc' },
    take: 5,
  })
  console.log(`\nCompanies Act 2006 — first 5 sections:`)
  for (const s of co2006Sections) {
    console.log(`  s.${s.sectionNumber}: "${s.sectionTitle}" → ${s.tnaXmlKey}`)
  }

  await prisma.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
