// 25-W §A — diagnose the missing build-complete email.
// Read-only. Prints the build rows, their notifyEmail flag, the creator's address,
// the remembered default, and any suppression row.
import { prisma } from '../lib/prisma'

async function main() {
  const builds = await prisma.ideaBuild.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 30) } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, ideaId: true, version: true, status: true, notifyEmail: true,
      startedAt: true, completedAt: true, createdAt: true, passesComplete: true,
      failureReason: true, estCostPence: true, mode: true,
      idea: { select: { title: true, creator: { select: { id: true, email: true, name: true, emailOnBuildComplete: true } } } },
    },
  })
  console.log(`\n=== IdeaBuild rows in the last 30h: ${builds.length} ===`)
  for (const b of builds) {
    console.log([
      `  ${b.id}`,
      `    idea=${b.ideaId} v${b.version} "${b.idea?.title ?? ''}"`,
      `    status=${b.status} mode=${b.mode} passes=${b.passesComplete} cost=${b.estCostPence}p`,
      `    created=${b.createdAt.toISOString()} started=${b.startedAt?.toISOString() ?? 'null'} completed=${b.completedAt?.toISOString() ?? 'null'}`,
      `    notifyEmail=${b.notifyEmail}`,
      `    creator=${b.idea?.creator?.email ?? 'none'} emailOnBuildComplete=${b.idea?.creator?.emailOnBuildComplete}`,
      `    failureReason=${b.failureReason ?? 'null'}`,
    ].join('\n'))
  }

  // How often has notifyEmail EVER been true?
  const trueCount = await prisma.ideaBuild.count({ where: { notifyEmail: true } })
  const total = await prisma.ideaBuild.count()
  console.log(`\n=== notifyEmail=true on ${trueCount} of ${total} IdeaBuild rows ever ===`)

  const optedIn = await prisma.user.findMany({
    where: { emailOnBuildComplete: true },
    select: { id: true, email: true },
  })
  console.log(`=== users with emailOnBuildComplete=true: ${optedIn.length} ===`)
  for (const u of optedIn) console.log(`  ${u.email}`)

  const cl = await prisma.user.findFirst({
    where: { email: { in: ['cl@scrutinise.org', 'charles@scalablefinance.com'] } },
    select: { id: true, email: true, emailOnBuildComplete: true },
  })
  console.log(`\n=== Charlie's row: ${JSON.stringify(cl)} ===`)

  const supp = await prisma.emailSuppression.findMany({ select: { email: true, reason: true, suppressedAt: true } })
  console.log(`\n=== EmailSuppression rows: ${supp.length} ===`)
  for (const s of supp) console.log(`  ${s.email} ${s.reason} ${s.suppressedAt?.toISOString?.() ?? ""}`)
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e); await prisma.$disconnect(); process.exit(1)
})
