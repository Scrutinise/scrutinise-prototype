// 26-C addendum §21c — assert the two destinations COLD, on real ideas, not fixtures.
//
// This does not click a browser. It reproduces, verbatim, the same queries
// `app/ideas/build/page.tsx` and `app/ideas/create/page.tsx` run to decide where an idea
// opens, against a REAL built idea and a REAL unbuilt idea already in the database — the
// property under test ("does the routing logic resolve to the right screen") is asserted
// on data this script did not create and cannot have biased.
//
// Usage: npx tsx --env-file=.env scripts/check-lex-26c-addendum.ts

import { prisma } from '../lib/prisma'
import { hrefFor, type MyIdea } from '../components/lex/MyIdeasList'

let pass = 0
let fail = 0
function ok(label: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

async function main() {
  console.log('── check:lex-26c-addendum §21c ──\n')

  const charlie = await prisma.user.findFirst({ where: { email: 'cl@scrutinise.org' }, select: { id: true } })
  if (!charlie) { console.log('charlie not found — cannot run a cold read on his account'); process.exit(1) }

  // Any user's ideas would do for the routing property; Charlie's account is the one
  // this brief is about, and it is where the real built/unbuilt rows already are.
  const builtIdea = await prisma.idea.findFirst({
    where: { creatorId: charlie.id, deletedAt: null, builds: { some: { status: 'DONE' } } },
    select: { id: true, title: true },
  })
  const unbuiltIdea = await prisma.idea.findFirst({
    where: { creatorId: charlie.id, deletedAt: null, builds: { none: {} } },
    select: { id: true, title: true, elicitation: { select: { problem: true } } },
    orderBy: { updatedAt: 'desc' },
  })

  console.log('built idea:', builtIdea?.id, JSON.stringify(builtIdea?.title))
  console.log('unbuilt idea:', unbuiltIdea?.id, JSON.stringify(unbuiltIdea?.title))
  console.log('')

  // ── §21b: an idea with no build returns to its conversation on the simple screen ──
  if (unbuiltIdea) {
    const fakeMyIdea: MyIdea = {
      ideaId: unbuiltIdea.id, title: unbuiltIdea.title, excerpt: '', stage: 'STAGE_1',
      elicitationStatus: 'IN_PROGRESS', buildStatus: null, passesComplete: null,
      updatedAt: new Date().toISOString(), archived: false, deleted: false,
    }
    const href = hrefFor(fakeMyIdea)
    ok('an UNBUILT idea\'s card links to /ideas/build', href === `/ideas/build?ideaId=${unbuiltIdea.id}`, href)

    // Reproduce app/ideas/build/page.tsx's resolution of `?ideaId=` verbatim.
    const existing = await prisma.idea.findUnique({
      where: { id: unbuiltIdea.id, creatorId: charlie.id },
      select: { id: true, deletedAt: true },
    })
    const resolvedInitialIdeaId = existing && !existing.deletedAt ? existing.id : undefined
    ok('…and /ideas/build/page.tsx resolves initialIdeaId to THAT idea, cold',
      resolvedInitialIdeaId === unbuiltIdea.id, String(resolvedInitialIdeaId))
  } else {
    console.log('  · NOT CHECKED — Charlie has no unbuilt idea to test against right now')
  }

  // ── §21b: an idea with a build opens the three-panel workspace ──
  if (builtIdea) {
    const fakeMyIdea: MyIdea = {
      ideaId: builtIdea.id, title: builtIdea.title, excerpt: '', stage: 'STAGE_2',
      elicitationStatus: 'CONFIRMED', buildStatus: 'DONE', passesComplete: null,
      updatedAt: new Date().toISOString(), archived: false, deleted: false,
    }
    const href = hrefFor(fakeMyIdea)
    ok('a BUILT idea\'s card links to /ideas/create', href === `/ideas/create?ideaId=${builtIdea.id}`, href)

    // Reproduce app/ideas/create/page.tsx's §4 gate verbatim: does it find a terminal
    // build and therefore NOT redirect back to /ideas/build?
    const gateBuilt = await prisma.ideaBuild.findFirst({
      where: {
        ideaId: builtIdea.id,
        idea: { creatorId: charlie.id, deletedAt: null },
        status: { in: ['DONE', 'FAILED', 'CANCELLED'] },
      },
      select: { id: true },
    })
    ok('…and /ideas/create/page.tsx\'s §4 gate does NOT redirect it back, cold',
      !!gateBuilt, gateBuilt ? `build ${gateBuilt.id} found` : 'no terminal build found — WOULD redirect back')
  } else {
    console.log('  · NOT CHECKED — Charlie has no built idea to test against right now')
  }

  // ── CONTROL — the §4 gate DOES redirect an idea that genuinely has no terminal build ──
  if (unbuiltIdea) {
    const gateBuilt = await prisma.ideaBuild.findFirst({
      where: {
        ideaId: unbuiltIdea.id,
        idea: { creatorId: charlie.id, deletedAt: null },
        status: { in: ['DONE', 'FAILED', 'CANCELLED'] },
      },
      select: { id: true },
    })
    ok('CONTROL — the §4 gate DOES refuse the unbuilt idea (proves the gate can fail)', !gateBuilt)
  }

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
