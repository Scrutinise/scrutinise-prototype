// ─────────────────────────────────────────────────────────────────────────────
// check:lex-26aa — LEX 26-AA (BRIEF_26AA; CCh's GOs of 20 Nov 07:40 and 07:57). Counts what RAN: ran, passed, controls fired,
// dead, not run.
//
//   A3 · the legislation-link DELETE is scoped to the idea in the URL: another idea's link is refused with a worded 404 and is
//        still there afterwards; the owner deletes their own (control); a stranger is refused (control).
//
// Everything here runs on SCRATCH copies of 452c5ade (scripts/lib/scratch-copy.ts), made and deleted here. Nothing writes to 452c5ade.
//
//   npm run check:lex-26aa
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

const SOURCE = '452c5ade'
let ran = 0, pass = 0, fail = 0, controls = 0, dead = 0, notRun = 0
const ok = (name: string, cond: boolean, detail?: unknown) => {
  ran++
  if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail === undefined ? '' : ` — ${String(detail).slice(0, 300)}`}`) }
}
/** A control: a case that MUST come out the other way, so the assertion beside it is known to be able to fail. */
const control = (name: string, cond: boolean, detail?: unknown) => { controls++; if (!cond) dead++; ok(`control: ${name}`, cond, detail) }
const section = (s: string) => console.log(`\n${s}`)
const setUser = (u: unknown) => { (globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = u }

async function partA3() {
  section('A3 · the legislation-link DELETE is scoped to the idea in the URL')
  const { DELETE } = await import('../app/api/ideas/[id]/legislation-link/route')
  const call = async (ideaId: string, rowId: string) => {
    const r = await DELETE(new Request('http://x', { method: 'DELETE', body: JSON.stringify({ coherentActionSectionId: rowId }) }), { params: Promise.resolve({ id: ideaId }) })
    return { status: r.status, json: await r.json() as { ok?: boolean; error?: string } }
  }
  // Two ideas: the victim (Y) holds the link; the caller's own idea (X) is the one in the URL. Both are scratch copies of 452c5ade.
  const Y = await scratchCopy(SOURCE, '26aa-a3-victim')
  const X = await scratchCopy(SOURCE, '26aa-a3-caller')
  const made: string[] = []
  try {
    const section1 = await prisma.legislationSection.findFirst({ select: { id: true } }) // read only: any held section will do
    if (!section1) throw new Error('no LegislationSection to link to')
    const caY = await prisma.coherentAction.create({ data: { ideaId: Y.id, title: 'ZZ-scratch 26aa A3 action (victim)' }, select: { id: true } })
    const caX = await prisma.coherentAction.create({ data: { ideaId: X.id, title: 'ZZ-scratch 26aa A3 action (caller)' }, select: { id: true } })
    made.push(caY.id, caX.id)
    const linkY = await prisma.coherentActionSection.create({ data: { coherentActionId: caY.id, legislationSectionId: section1.id, proposedWording: 'the victim’s wording' }, select: { id: true } })
    const linkX = await prisma.coherentActionSection.create({ data: { coherentActionId: caX.id, legislationSectionId: section1.id }, select: { id: true } })

    // The caller owns idea X (the URL) and knows the id of Y's link.
    const owner = await prisma.user.findUnique({ where: { id: X.userId } })
    setUser(owner)
    const attack = await call(X.id, linkY.id)
    ok('another idea’s link, sent through the caller’s own idea, is refused with a 404', attack.status === 404, JSON.stringify(attack))
    ok('…in words', attack.json.error === 'That law link is not on this idea.', attack.json.error)
    ok('…and the link is still there, with its wording', (await prisma.coherentActionSection.findUnique({ where: { id: linkY.id } }))?.proposedWording === 'the victim’s wording')

    // A stranger who owns neither idea is refused at the ownership step (unchanged behaviour).
    setUser({ ...owner!, id: 'zz-26aa-a3-stranger', clerkId: 'zz-26aa-a3-stranger' })
    const stranger = await call(Y.id, linkY.id)
    control('a stranger who owns neither idea is refused (404) and deletes nothing', stranger.status === 404 && !!(await prisma.coherentActionSection.findUnique({ where: { id: linkY.id } })), JSON.stringify(stranger))

    // The owner deletes their own link through their own idea: the fix must not refuse the legitimate case.
    setUser(owner)
    const own = await call(X.id, linkX.id)
    control('the owner deletes their own idea’s link (200, gone)', own.status === 200 && !(await prisma.coherentActionSection.findUnique({ where: { id: linkX.id } })), JSON.stringify(own))
    const ownY = await call(Y.id, linkY.id)
    control('…and Y’s link goes when sent through Y, its own idea', ownY.status === 200 && !(await prisma.coherentActionSection.findUnique({ where: { id: linkY.id } })), JSON.stringify(ownY))
  } finally {
    setUser(undefined)
    // CoherentAction → Idea has no cascade, so the rows made here go before the scratch ideas (their links cascade with them).
    if (made.length) await prisma.coherentAction.deleteMany({ where: { id: { in: made } } })
    console.log(`  (scratch copies deleted: ${await deleteScratch(X.id)}, ${await deleteScratch(Y.id)})`)
  }
}

async function main() {
  if (process.argv.includes('--pure')) { notRun++; console.log('  (A3 not run: --pure)') }
  else await partA3()
  console.log(`\n${ran} ran · ${pass} passed · ${fail} failed · ${controls} controls (${dead} dead) · ${notRun} not run`)
  process.exit(fail || dead ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
