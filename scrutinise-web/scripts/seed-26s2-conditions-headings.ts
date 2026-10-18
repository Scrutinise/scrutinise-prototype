// 26-S2 decisions 187 + 188 (CCh 18 Oct 2026 (5)) - put Charlie's ten conditions and his seven instrument headings on 452c5ade.
//   conditions   Idea.conditions  <- the ten, verbatim (existing identical texts keep their ids; nothing else on the list is touched)
//   headingPlan  Idea.headingPlan <- the seven (Legislation is renamed to Primary legislation by the Re-sort; nothing moves until Charlie presses it)
//
//   npx tsx --env-file=.env scripts/seed-26s2-conditions-headings.ts            (dry run)
//   npx tsx --env-file=.env scripts/seed-26s2-conditions-headings.ts --apply
//
// Writes configuration only: no action is moved, no heading is renamed or archived here.
import { prisma } from '../lib/prisma'
import { seedConditions, readConditions } from '../lib/lex/action-conditions-server'
import { readHeadingPlan, setHeadingPlan } from '../lib/lex/action-resort'
import { SEVEN_HEADINGS, CHARLIES_TEN, CONDITIONS_SOURCE } from './lib/seven-headings'

async function main() {
  const apply = process.argv.includes('--apply')
  const idea = await prisma.idea.findFirst({ where: { id: { startsWith: '452c5ade' }, deletedAt: null }, select: { id: true, creatorId: true } })
  if (!idea) throw new Error('452c5ade is not in this database')
  const [doc, plan] = await Promise.all([readConditions(idea.id), readHeadingPlan(idea.id)])
  console.log(`${apply ? 'APPLYING' : 'DRY RUN'} on ${idea.id}: conditions now ${doc.items.length}, plan now ${plan ? plan.targets.length + ' targets' : 'none'}`)
  console.log(`  -> ${CHARLIES_TEN.length} conditions, ${SEVEN_HEADINGS.targets.length} headings`)
  if (!apply) { console.log('Nothing changed. Add --apply to write.'); return }
  const r = await seedConditions(idea.id, idea.creatorId, CHARLIES_TEN, CONDITIONS_SOURCE)
  await setHeadingPlan(idea.id, SEVEN_HEADINGS)
  const after = await readConditions(idea.id)
  console.log(`conditions: ${r.ok ? r.data.count : (r as { error: string }).error} written; active ${after.items.filter((c) => !c.retired).length}; plan set`)
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
