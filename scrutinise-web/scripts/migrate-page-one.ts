// 25-H §1 — "Migrate any content in existing ideas across; report the count."
//
// ⚠ Additive and idempotent: it writes `yourKnowledge` only where the retired blob has
// content, the idea has NO elicitation to project from, and nothing is there already.
// An idea WITH an elicitation gets a better page one from the projection than the blob
// ever held, so copying the blob over it would be a downgrade.
import { prisma } from '../lib/prisma'
import { migrateLegacyPageOne, RETIRED_PAGE_ONE_FIELD } from '../lib/lex/page-one'

async function main() {
  const before = await prisma.ideaFieldState.count({
    where: { fieldKey: RETIRED_PAGE_ONE_FIELD, value: { not: null } },
  })
  const withElicitation = await prisma.ideaFieldState.count({
    where: { fieldKey: RETIRED_PAGE_ONE_FIELD, value: { not: null }, idea: { elicitation: { isNot: null } } },
  })
  console.log(`rows in "${RETIRED_PAGE_ONE_FIELD}" with content: ${before}`)
  console.log(`  of those, ideas WITH an elicitation (projected instead): ${withElicitation}`)

  if (!process.argv.includes('--execute')) {
    console.log('\n⚠ DRY RUN — pass --execute to migrate.')
    await prisma.$disconnect(); return
  }
  const r = await migrateLegacyPageOne()
  console.log(`\nexamined ${r.examined}  migrated ${r.migrated}  skipped ${r.skipped}`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
