import { prisma } from '../scrutinise-web/lib/prisma'
import { recalculateCredibility } from '../scrutinise-web/lib/points'

async function main() {
  const users = await prisma.reputation.findMany({ select: { userId: true } })
  console.log(`Recalculating credibility for ${users.length} users...`)
  for (const { userId } of users) {
    await recalculateCredibility(userId)
    console.log(`  done: ${userId}`)
  }
  console.log('Done.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
