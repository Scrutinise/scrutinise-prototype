// SPRINT 25-A — remove the throwaway ideas the harnesses create.
//
// The framing harness and the two verification scripts each create ideas titled
// `[25-A …]` and clean up after themselves. This exists for the case where one of them
// dies between creating and cleaning — which happened on the first framing run, when the
// report write threw ENOENT after all six builds had finished.
//
// Hard delete, not soft: these are test artefacts, never proposals. Cascade takes the
// builds, forks and elicitation rows with them.
//
// Usage: npx tsx --env-file=.env scripts/cleanup-25a-artefacts.ts [--dry-run]

import { prisma } from '../lib/prisma'

async function main() {
  const dry = process.argv.includes('--dry-run')
  const rows = await prisma.idea.findMany({
    where: { title: { startsWith: '[25-A ' } },
    select: { id: true, title: true, deletedAt: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  console.log(`found ${rows.length} harness idea(s)`)
  for (const r of rows) {
    console.log(` - ${r.id}  ${r.title.slice(0, 64)}  softDeleted=${!!r.deletedAt}`)
  }
  if (!rows.length || dry) {
    if (dry) console.log('\n--dry-run: nothing deleted')
    await prisma.$disconnect()
    return
  }
  const res = await prisma.idea.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } })
  console.log(`\nhard-deleted ${res.count}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
