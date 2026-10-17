// 26-S §8e (decision 143) — rule out #10 (ECHR) on Charlie's idea 452c5ade, with the reason verbatim from BRIEF_26S §8e.
// Reversible (Restore on the screen). Same function the "Rule out" button calls. Plan by default; `--write` does it; reads back either way.
//   npx tsx --env-file=.env scripts/data-26s-8e.ts [--write]
import { prisma } from '../lib/prisma'
import { ruleOut } from '../lib/lex/action-structure'

const REASON = 'Outside the scope of this idea. Dismissal for poor performance is lawful under existing employment law; the problem is practice, not the Convention. The ECHR question belongs to the Restoration Programme.'

async function main() {
  const idea = await prisma.idea.findFirst({ where: { id: { startsWith: '452c5ade' }, deletedAt: null }, select: { id: true } })
  if (!idea) throw new Error('idea 452c5ade not found')
  const row = await prisma.lexCoherentAction.findFirst({ where: { ideaId: idea.id, number: 10 }, select: { id: true, title: true, status: true, ruleOutReason: true } })
  console.log('BEFORE', JSON.stringify(row))
  const live = (await prisma.lexCoherentAction.count({ where: { ideaId: idea.id, status: 'LIVE' } }))
  console.log('live actions before:', live)
  if (!row) throw new Error('#10 not found')
  if (!process.argv.includes('--write')) { console.log('PLAN ONLY — re-run with --write'); return }
  if (row.status !== 'LIVE') { console.log('already not live — nothing to do'); return }
  const r = await ruleOut(idea.id, [row.id], REASON)
  console.log('ruleOut:', JSON.stringify(r))
  const after = await prisma.lexCoherentAction.findUnique({ where: { id: row.id }, select: { status: true, ruleOutReason: true } })
  console.log('AFTER ', JSON.stringify(after), 'verbatim:', after?.ruleOutReason === REASON)
  console.log('live actions after:', await prisma.lexCoherentAction.count({ where: { ideaId: idea.id, status: 'LIVE' } }))
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
