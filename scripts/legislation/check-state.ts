import * as path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { prisma } from '../../scrutinise-web/lib/prisma'

async function main() {
  console.log('=== Railway DB state ===')

  const [
    itemTotal,
    itemsWithSections,
    sectionTotal,
    bothKeys,
    tnaOnly,
    originalOnly,
    neither,
  ] = await Promise.all([
    prisma.legislationItem.count(),
    prisma.legislationSection.findMany({ select: { legislationItemId: true }, distinct: ['legislationItemId'] }).then(r => r.length),
    prisma.legislationSection.count(),
    prisma.legislationSection.count({ where: { originalXmlKey: { not: null }, tnaXmlKey: { not: null } } }),
    prisma.legislationSection.count({ where: { originalXmlKey: null, tnaXmlKey: { not: null } } }),
    prisma.legislationSection.count({ where: { originalXmlKey: { not: null }, tnaXmlKey: null } }),
    prisma.legislationSection.count({ where: { originalXmlKey: null, tnaXmlKey: null } }),
  ])

  console.log(`LegislationItem total:          ${itemTotal}`)
  console.log(`Items with section data:        ${itemsWithSections}`)
  console.log(`Total LegislationSection rows:  ${sectionTotal}`)
  console.log(`  both originalXml + tnaXml:    ${bothKeys}`)
  console.log(`  tnaXml only:                  ${tnaOnly}`)
  console.log(`  originalXml only:             ${originalOnly}`)
  console.log(`  NEITHER key:                  ${neither}`)

  // Also check compilationStatus breakdown
  const statusCounts = await prisma.legislationSection.groupBy({
    by: ['compilationStatus'],
    _count: { id: true },
  })
  console.log('\nCompilationStatus breakdown:')
  for (const row of statusCounts) {
    console.log(`  ${row.compilationStatus}: ${row._count.id}`)
  }

  // Check item types (using legislationType)
  const typeCounts = await prisma.legislationItem.groupBy({
    by: ['legislationType'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  })
  console.log('\nLegislationItem by legislationType:')
  for (const row of typeCounts.slice(0, 10)) {
    console.log(`  ${row.legislationType}: ${row._count.id}`)
  }

  await prisma.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
