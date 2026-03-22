import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import crypto from 'crypto'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  // ── SuperAdmin ─────────────────────────────────────────────────────────────
  const superAdmin = await prisma.user.upsert({
    where: { email: 'cl@scrutinise.org' },
    update: {},
    create: {
      clerkId: 'user_3BIGzFJCth6bdtHpXmwCcXPuYVR',
      email: 'cl@scrutinise.org',
      username: 'charlie',
      firstName: 'Charlie',
      lastName: 'Lyne',
      preferredName: 'Charlie',
      name: 'Charlie Lyne',
      role: 'SUPER_ADMIN',
      referralCode: crypto.randomUUID(),
      ageConfirmed: true,
    },
  })

  console.log(`SuperAdmin: ${superAdmin.email}`)

  // ── CredibilityScore for SuperAdmin ────────────────────────────────────────
  await prisma.credibilityScore.upsert({
    where: { userId: superAdmin.id },
    update: {},
    create: { userId: superAdmin.id },
  })

  // ── PlatformConfig defaults ────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const configs: { key: string; value: any }[] = [
    { key: 'credibilityWeightingActive', value: false },
    { key: 'peerReviewRequired', value: false },
    { key: 'minReviewersForStage4', value: 12 },
    { key: 'minRatingForStage4', value: 2.5 },
    { key: 'stage1Label', value: 'Create' },
    { key: 'stage2Label', value: 'Draft' },
    { key: 'stage3Label', value: 'Develop' },
    { key: 'stage4Label', value: 'Campaign' },
    { key: 'stage5Label', value: 'Legislate' },
  ]

  for (const config of configs) {
    await prisma.platformConfig.upsert({
      where: { key: config.key },
      update: {},
      create: {
        key: config.key,
        value: config.value,
        updatedByUserId: superAdmin.id,
      },
    })
  }

  console.log(`PlatformConfig: ${configs.length} records seeded`)
  console.log('Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
