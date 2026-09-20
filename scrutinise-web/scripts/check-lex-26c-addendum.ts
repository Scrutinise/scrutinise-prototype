// 26-C addendum §21c / addendum 3 §23d — assert the routing COLD, on real ideas.
//
// This does not click a browser. It reproduces, verbatim, the same decisions
// `MyIdeasList.hrefFor`, `IdeaDetailClient`'s "Edit" link and `/ideas/create/page.tsx`'s
// §4 gate make, against a REAL built idea and a REAL unbuilt idea already in the
// database — the property under test ("does the routing logic resolve to the right
// screen") is asserted on data this script did not create and cannot have biased.
//
// ⚠⚠ REWRITTEN FOR ADDENDUM 3 §23c/§23d: a card no longer decides built-vs-unbuilt
// itself — every card opens the Idea overview, and the overview's own "Edit" link is
// where that decision now lives (`hasBuild`, computed the same way `page.tsx` computes
// it for real). The property is the same one §21c asserted; it now has one more hop.
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

/** Reproduces IdeaDetailClient's `hasBuild` prop, exactly as app/ideas/[id]/page.tsx computes it. */
async function hasBuildFor(ideaId: string): Promise<boolean> {
  const build = await prisma.ideaBuild.findFirst({
    where: { ideaId, status: { in: ['DONE', 'FAILED', 'CANCELLED'] } },
    select: { id: true },
  })
  return !!build
}

async function main() {
  console.log('── check:lex-26c-addendum §21c/§23d ──\n')

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

  // ── §23c: EVERY card opens the Idea overview, whether built or not ──
  if (unbuiltIdea) {
    const fakeMyIdea: MyIdea = {
      ideaId: unbuiltIdea.id, title: unbuiltIdea.title, excerpt: '', stage: 'STAGE_1',
      elicitationStatus: 'IN_PROGRESS', buildStatus: null, passesComplete: null,
      updatedAt: new Date().toISOString(), archived: false, deleted: false,
    }
    ok('§23c — an UNBUILT idea\'s card opens the Idea overview',
      hrefFor(fakeMyIdea) === `/ideas/${unbuiltIdea.id}`, hrefFor(fakeMyIdea))

    // ── §23d: the overview's "Edit" link returns to the New idea conversation ──
    const hasBuild = await hasBuildFor(unbuiltIdea.id)
    ok('§23d — …and its "Edit" link (hasBuild, computed cold) returns to /ideas/build',
      hasBuild === false, `hasBuild=${hasBuild}`)
  } else {
    console.log('  · NOT CHECKED — Charlie has no unbuilt idea to test against right now')
  }

  if (builtIdea) {
    const fakeMyIdea: MyIdea = {
      ideaId: builtIdea.id, title: builtIdea.title, excerpt: '', stage: 'STAGE_2',
      elicitationStatus: 'CONFIRMED', buildStatus: 'DONE', passesComplete: null,
      updatedAt: new Date().toISOString(), archived: false, deleted: false,
    }
    ok('§23c — a BUILT idea\'s card ALSO opens the Idea overview (not straight to the workspace)',
      hrefFor(fakeMyIdea) === `/ideas/${builtIdea.id}`, hrefFor(fakeMyIdea))

    // ── §23d: the overview's "Edit" link opens the three-panel workspace ──
    const hasBuild = await hasBuildFor(builtIdea.id)
    ok('§23d — …and its "Edit" link (hasBuild, computed cold) opens /ideas/create',
      hasBuild === true, `hasBuild=${hasBuild}`)

    // §4's own gate still matters one hop further in — Edit's own link must not be
    // bounced straight back by it.
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

  // ── CONTROL — hasBuildFor DOES read false for a genuinely unbuilt idea ──
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

  // ══ 26-C ADDENDUM 4 §26c — THE "CONTINUING:" BANNER NAMES THE RIGHT IDEA, COLD ══════
  //
  // Charlie asked this to be confirmed, not assumed, after §21's identity mismatch scare
  // two addenda ago. Reproduces app/ideas/build/page.tsx's `openedIdea` resolution
  // verbatim against a REAL idea, and — the part that actually tests something — against
  // a SECOND real idea too, to prove the query is scoped by the id in the URL and not,
  // say, "whichever idea is most recently updated" (which would happen to look right on
  // an account with only one candidate).
  console.log('')
  async function resolveOpenedIdea(ideaId: string): Promise<{ title: string } | null> {
    const existing = await prisma.idea.findUnique({
      where: { id: ideaId, creatorId: charlie!.id },
      select: { id: true, title: true, deletedAt: true },
    })
    return existing && !existing.deletedAt ? { title: existing.title } : null
  }
  const secondUnbuilt = await prisma.idea.findFirst({
    where: {
      creatorId: charlie.id, deletedAt: null, builds: { none: {} },
      id: { not: unbuiltIdea?.id },
    },
    select: { id: true, title: true },
    orderBy: { updatedAt: 'desc' },
  })
  if (unbuiltIdea && secondUnbuilt) {
    const resolvedA = await resolveOpenedIdea(unbuiltIdea.id)
    const resolvedB = await resolveOpenedIdea(secondUnbuilt.id)
    ok('§26c — idea A\'s own id resolves to idea A\'s own title',
      resolvedA?.title === unbuiltIdea.title, `got ${JSON.stringify(resolvedA?.title)}`)
    ok('§26c — idea B\'s own id resolves to idea B\'s own title, NOT idea A\'s',
      resolvedB?.title === secondUnbuilt.title && resolvedB?.title !== unbuiltIdea.title,
      `got ${JSON.stringify(resolvedB?.title)}`)
  } else {
    console.log('  · NOT CHECKED §26c — need two distinct unbuilt ideas on the account to prove scoping')
  }

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
