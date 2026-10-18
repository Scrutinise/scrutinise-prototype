// 26-S2 decision 190 - QUALITY PROBE for "Consolidate this heading": run it on ONE heading of a scratch copy of Charlie's idea and PRINT what it folded, so a
// person can judge whether the folds are real components or over-reach. Real model spend (a few pence, labelled "measurement"); the copy is deleted.
//
//   npx tsx --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/probe-lex-consolidate.ts ["Heading name"]
import { prisma } from '../lib/prisma'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'
import { SEVEN_HEADINGS } from './lib/seven-headings'
import * as RS from '../lib/lex/action-resort'

const clip = (s: string, n: number) => s.replace(/\s+/g, ' ').trim().slice(0, n) + (s.length > n ? '…' : '')

async function main() {
  const want = process.argv[2] ?? 'Primary legislation'
  const copy = await scratchCopy('452c5ade', 'probe')
  try {
    await RS.setHeadingPlan(copy.id, SEVEN_HEADINGS)
    await RS.ensureTargetHeadings(copy.id, SEVEN_HEADINGS) // renames Charlie's short names in place; moves nothing
    const h = await prisma.actionHeading.findFirst({ where: { ideaId: copy.id, name: want } })
    if (!h) throw new Error(`no heading "${want}" - have ${(await prisma.actionHeading.findMany({ where: { ideaId: copy.id } })).map((x) => x.name).join(', ')}`)
    const members = await prisma.lexCoherentAction.findMany({ where: { ideaId: copy.id, headingId: h.id, status: 'LIVE' }, orderBy: { number: 'asc' } })
    console.log(`\n"${want}": ${members.length} live actions\n`)
    const r = await RS.consolidateHeading(copy.id, copy.userId, h.id)
    if (!r.ok) throw new Error((r as { error: string }).error)
    const byNum = new Map(members.map((m) => [m.number!, m]))
    const leads = new Map<number, number[]>()
    for (const f of r.data.folded) leads.set(f.intoNumber, [...(leads.get(f.intoNumber) ?? []), f.number])
    for (const [lead, comps] of leads) {
      const L = byNum.get(lead)!
      console.log(`MECHANISM #${lead}: ${clip(L.practicalStep, 220)}`)
      for (const c of comps) console.log(`    folded #${c}: ${clip(byNum.get(c)!.practicalStep, 200)}`)
      const after = await prisma.lexCoherentAction.findUnique({ where: { id: L.id }, select: { commentary: true } })
      console.log(`    reason on the quote: ${(after?.commentary ?? '').split('\n').find((l) => l.startsWith('• [#'))?.split(' — ').pop()}\n`)
    }
    for (const m of r.data.merged) console.log(`DUPLICATE #${m.number} merged into #${m.intoNumber}:\n    kept:    ${clip(byNum.get(m.intoNumber)!.practicalStep, 200)}\n    dropped: ${clip(byNum.get(m.number)!.practicalStep, 200)}\n`)
    console.log(`refused: ${JSON.stringify(r.data.refused)}\n${r.data.before} -> ${r.data.after} live; ${r.data.pence}p`)
  } finally { await deleteScratch(copy.id) }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
