// Decision 138 — copy what the "Added from the consolidation" box carried (verdict, reason, where it came from) ONTO the actions,
// for every action that already exists. Idempotent: it only writes where the action has no verdict yet.
//
//   npx tsx --env-file=.env scripts/backfill-policy-test.ts            (DRY RUN)
//   npx tsx --env-file=.env scripts/backfill-policy-test.ts --apply
import { prisma } from '../lib/prisma'
import { describeSource, type IdeaSource } from '../lib/lex/action-ideas'

async function main() {
  const apply = process.argv.includes('--apply')
  const rows = await prisma.actionIdea.findMany({ where: { status: 'WRITTEN', acceptedActionId: { not: null } } })
  let would = 0, wrote = 0, gone = 0, already = 0
  for (const r of rows) {
    const a = await prisma.lexCoherentAction.findUnique({ where: { id: r.acceptedActionId! }, select: { id: true, policyTestVerdict: true } })
    if (!a) { gone++; continue }
    if (a.policyTestVerdict) { already++; continue }
    would++
    if (!apply) continue
    await prisma.lexCoherentAction.update({
      where: { id: a.id },
      data: {
        policyTestVerdict: r.verdict ?? 'NOT_TESTED', policyTestReason: r.reason,
        policyTestFrom: Array.from(new Set((r.sources as unknown as IdeaSource[]).map(describeSource))) as never,
      },
    })
    wrote++
  }
  console.log(`${apply ? 'APPLY' : 'DRY RUN'} — ActionIdea WRITTEN rows: ${rows.length} · would/did write ${apply ? wrote : would} · already had a verdict ${already} · action no longer exists ${gone}`)
  if (apply) {
    const stillMissing = await prisma.actionIdea.findMany({ where: { status: 'WRITTEN', acceptedActionId: { not: null } }, select: { acceptedActionId: true } })
    let miss = 0
    for (const s of stillMissing) {
      const a = await prisma.lexCoherentAction.findUnique({ where: { id: s.acceptedActionId! }, select: { policyTestVerdict: true } })
      if (a && !a.policyTestVerdict) miss++
    }
    console.log(`read back: actions that should carry a verdict and do not: ${miss} (must be 0)`)
  }
}
main().finally(() => prisma.$disconnect())
