// ─────────────────────────────────────────────────────────────────────────────
// 25-G §6 — THE CUTOVER. Set `PlatformConfig["newIdeaDoor"]`, and read it back.
//
// ⚠ THIS IS THE WRITE THE ADMIN ROUTE MAKES, MADE DIRECTLY. `PATCH /api/admin/config`
// is the surface Charlie uses; it needs a SUPER_ADMIN Clerk session, which a CC session
// does not have and cannot get. The row and the audit entry written here are the same
// ones that route writes — see `app/api/admin/config/route.ts`.
//
// ⚠ IT WRITES AN `ActivityLog` ENTRY, exactly as the route does. A change to what every
// user sees at the front door is not something that should be discoverable only by
// diffing a config table.
//
// Usage:
//   npx tsx --env-file=.env scripts/flip-new-idea-door.ts --to build
//   npx tsx --env-file=.env scripts/flip-new-idea-door.ts --to create
//   npx tsx --env-file=.env scripts/flip-new-idea-door.ts --read
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { newIdeaDoorState, isNewIdeaDoor, NEW_IDEA_DOOR_KEY } from '../lib/lex/new-idea-door'

async function main() {
  const to = process.argv[process.argv.indexOf('--to') + 1]
  const readOnly = process.argv.includes('--read')

  const before = await newIdeaDoorState()
  const row = await prisma.platformConfig.findUnique({ where: { key: NEW_IDEA_DOOR_KEY } })
  console.log(`row:      ${row ? JSON.stringify(row.value) : 'ABSENT'}`)
  console.log(`resolves: ${before.door}  →  ${before.path}${before.isDefault ? '  (the default)' : ''}`)

  if (readOnly) { await prisma.$disconnect(); return }
  if (!isNewIdeaDoor(to)) {
    console.error(`\n--to must be "create" or "build"; got ${JSON.stringify(to)}`)
    process.exit(1)
  }
  if (before.door === to) {
    console.log(`\nalready "${to}" — nothing to write.`)
    await prisma.$disconnect()
    return
  }

  // ⚠ THE ROW NAMES WHO CHANGED IT. `updatedByUserId` is required, and the honest value
  // is the SUPER_ADMIN whose decision this is — not a synthetic actor.
  const admin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' }, select: { id: true, email: true },
  })
  if (!admin) {
    console.error('no SUPER_ADMIN to attribute the change to — refusing to write an unattributed flip')
    process.exit(1)
  }

  await prisma.$transaction([
    prisma.platformConfig.upsert({
      where: { key: NEW_IDEA_DOOR_KEY },
      update: { value: to, updatedByUserId: admin.id },
      create: { key: NEW_IDEA_DOOR_KEY, value: to, updatedByUserId: admin.id },
    }),
    prisma.activityLog.create({
      data: {
        userId: admin.id,
        activityType: 'CONFIG_UPDATE',
        description: `New-idea door set to "${to}" (was "${before.door}")`,
        metadata: { [NEW_IDEA_DOOR_KEY]: to, previous: before.door },
        accessType: 'ADMIN_ACCESS',
        accessedByUserId: admin.id,
      },
    }),
  ])

  const after = await newIdeaDoorState()
  console.log(`\nwritten by ${admin.email}`)
  console.log(`resolves: ${after.door}  →  ${after.path}`)
  if (after.door !== to) {
    console.error('⚠ THE READ-BACK DISAGREES WITH THE WRITE. Do not trust the flip.')
    process.exit(1)
  }
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
