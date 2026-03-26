/**
 * One-off backfill: add the missing CoherentAction for the FSU idea.
 * Run with: npx tsx scripts/seed-fsu-coherent-action.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const ideaId = '1c0bd9b7-1628-4b2e-8ea9-f7450f6e71fe'

  // Verify the idea exists
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { id: true, title: true } })
  if (!idea) {
    console.error(`Idea ${ideaId} not found`)
    process.exit(1)
  }
  console.log(`Found idea: ${idea.title}`)

  // Check if the CoherentAction already exists
  const existing = await prisma.coherentAction.findFirst({
    where: { ideaId, orderIndex: 0 },
    select: { id: true, title: true },
  })
  if (existing) {
    console.log(`CoherentAction already exists: ${existing.title} (${existing.id})`)
    process.exit(0)
  }

  const action = await prisma.coherentAction.create({
    data: {
      ideaId,
      title: 'Amend section 43 of the Education (No. 2) Act 1986',
      detailedDescription:
        "Replace 'reasonably practicable' with 'all reasonable steps' and add subsection (3A) extending the duty to students unions and their officers.",
      orderIndex: 0,
    },
  })

  console.log(`Created CoherentAction: ${action.id}`)
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
