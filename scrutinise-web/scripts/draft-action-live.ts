// Draft ONE action on a real idea with Lex (26-U §3), exactly as the "Draft this clause" button does: the result is a PROPOSAL beside the
// owner's version, never over it. Spends money (about 10.8p, measured n=6); on the ledger.
//
//   npx tsx --env-file=.env scripts/draft-action-live.ts <idea id or prefix> <action number>

import { prisma } from '../lib/prisma'
import { draftWithLex, draftOf } from '../lib/lex/action-draft'
import { touchesFor } from '../lib/lex/action-touches'
import { STATE_WORDS } from '../lib/lex/action-touches-pure'

async function main() {
  const [prefix, num] = process.argv.slice(2)
  if (!prefix || !num) throw new Error('usage: <idea id or prefix> <action number>')
  const ideas = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Idea" WHERE id LIKE ${prefix + '%'}`
  if (ideas.length !== 1) throw new Error(`expected one idea ${prefix}…, found ${ideas.length}`)
  const idea = await prisma.idea.findUniqueOrThrow({ where: { id: ideas[0].id }, select: { id: true, creatorId: true } })
  const a = await prisma.lexCoherentAction.findFirstOrThrow({ where: { ideaId: idea.id, number: Number(num), status: 'LIVE' }, select: { id: true, title: true } })
  const r = await draftWithLex(idea.id, a.id, idea.creatorId)
  if (!r.ok) { console.log(`#${num}: FAILED — ${r.error}`); return }
  const d = draftOf(await prisma.lexCoherentAction.findUniqueOrThrow({ where: { id: a.id }, select: { record: true } }))!
  const p = d.proposal!
  console.log(`══ #${num} ${a.title ?? ''} — ${r.data.pence?.toFixed(2)}p, ${r.data.seconds}s; owner versions kept: ${d.versions.length}${r.data.notes.length ? `; notes: ${r.data.notes.join('; ')}` : ''}`)
  console.log(`instrument ${p.instrument} · duty on ${p.dutyOnWhom} · enforced ${p.enforcedHow} · commencement ${p.commencement} · extent ${p.extent.join(', ')}`)
  console.log('provisions:', p.provisions.map((x) => `${x.relation} ${x.docUri}${x.provisionPath ? ` ${x.provisionPath}` : ''}`).join(' | '))
  console.log('precedents:', p.precedents.map((x) => `${x.docUri}${x.provisionPath ? ` ${x.provisionPath}` : ''} (${x.how})`).join(' | '))
  console.log('reason:', p.reason)
  console.log('CLAUSE:\n' + p.clause)
  const t = await touchesFor(p)
  console.log('touches:', t.touches.map((x) => `${x.line.docUri}${x.line.provisionPath ? ` ${x.line.provisionPath}` : ''} → ${STATE_WORDS[x.state]}`).join(' | '))
}
main().finally(() => prisma.$disconnect())
