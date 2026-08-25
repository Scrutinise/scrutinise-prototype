// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-G §2 — THERE ARE NOW TWO SURFACES AND THERE WAS NO WAY BETWEEN THEM.
//
// An idea built through `/ideas/build` lives on two screens:
//
//   THE BUILD     `/ideas/build?ideaId=…`   how it was made, what each pass found, what
//                                           I make of it, and the controls to run it again
//   THE PROPOSAL  `/ideas/create?ideaId=…`  the kernel itself — every field, the decisions
//                                           waiting, the evidence panel, the agenda
//
// ⚠ THE ONLY ROUTE BETWEEN THEM WAS ONE-WAY AND IT WAS A DEAD END. The build screen offered
// "Open the draft" once a build had finished, and the proposal offered nothing at all —
// no way back, no indication that a build screen existed, nothing naming what the user had
// just left. Charlie: *"we need to make sure both are clearly navigable."*
//
// ⚠ AND EACH SCREEN HAS TO SAY WHICH ONE IT IS. A link labelled "the proposal" tells a user
// where they are going; it does not tell them where they are. Both halves are needed
// because the two screens look similar at a glance — a transcript, a panel, some cards —
// and a user who cannot tell them apart concludes the platform lost their work.
//
// ⚠ WHAT THIS FILE IS NOT: a router. It computes the two COUNTS that make each link
// specific ("23 fields, 10 decisions waiting" rather than "the proposal"), because a
// number is the difference between a label and an invitation. The component that renders
// it is `components/lex/SurfaceSwitch.tsx`.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'

export type Surface = 'build' | 'proposal'

export interface SurfaceLink {
  /** Where this link goes. */
  href: string
  /** What the surface is called, in the user's words. */
  title: string
  /** What is over there, specifically. Counted, never "more detail". */
  detail: string
}

export interface SurfaceContext {
  /** Which surface the user is looking at RIGHT NOW. */
  here: Surface
  /** The one they are not looking at, with what it holds. */
  there: SurfaceLink
  /** What THIS surface is, so the screen can name itself. */
  hereTitle: string
}

/**
 * The two counts that make the proposal link specific.
 *
 * ⚠ "DECISIONS WAITING" IS UNRESOLVED FORKS PLUS OPEN ISSUES, and both belong in it: 25-C
 * turns a fork into a decision and the verification passes put their failures on the same
 * list, so a user with four forks and eleven issues has fifteen things waiting whatever
 * the internal table is called. Counting only the forks would have told the second build's
 * user there were four when there were twenty-one.
 */
async function proposalCounts(ideaId: string): Promise<{ fields: number; waiting: number }> {
  const [fields, forks, issues] = await Promise.all([
    prisma.ideaFieldState.count({
      where: { ideaId, status: { in: ['AWAITING_CONFIRMATION', 'ACCEPTED'] } },
    }),
    // Unresolved DECISION POINTS, not unresolved rows: a fork with two alternatives is one
    // decision and would otherwise be counted twice.
    prisma.buildFork.findMany({
      where: { ideaId, resolved: false }, select: { forkKey: true }, distinct: ['forkKey'],
    }),
    prisma.deepeningIssue.count({ where: { ideaId, status: 'OPEN' } }),
  ])
  return { fields, waiting: forks.length + issues }
}

/** How many passes a finished build ran, for the build link's own detail line. */
async function buildCounts(ideaId: string): Promise<{ passes: number; version: number } | null> {
  const row = await prisma.ideaBuild.findFirst({
    where: { ideaId, status: { in: ['DONE', 'FAILED', 'CANCELLED'] } },
    orderBy: { version: 'desc' },
    select: { passesComplete: true, version: true },
  })
  return row ? { passes: row.passesComplete, version: row.version } : null
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

/**
 * Both halves of §2's requirement for one screen: what this surface is, and what the other
 * one holds.
 *
 * ⚠ RETURNS NULL WHEN THERE IS NO OTHER SURFACE TO GO TO. An idea that has never been
 * built has no build screen worth visiting, and a link to an empty one is worse than no
 * link — it is a promise of something that is not there. The build side only appears once
 * a build exists.
 */
export async function surfaceContext(ideaId: string, here: Surface): Promise<SurfaceContext | null> {
  if (here === 'build') {
    const { fields, waiting } = await proposalCounts(ideaId)
    // Nothing drafted yet — the build is still the only surface with anything on it.
    if (!fields) return null
    return {
      here,
      hereTitle: 'The build',
      there: {
        href: `/ideas/create?ideaId=${ideaId}`,
        title: 'The proposal',
        detail: waiting
          ? `${plural(fields, 'field')}, ${plural(waiting, 'decision')} waiting`
          : `${plural(fields, 'field')} — nothing waiting on you`,
      },
    }
  }

  const build = await buildCounts(ideaId)
  if (!build) return null
  return {
    here,
    hereTitle: 'The proposal',
    there: {
      // ⚠ `build=1` — see `app/ideas/build/page.tsx`. Without it the build screen bounces
      // straight back here, because §2 also says a returning user lands on the proposal.
      // A link that returns you to where you came from is the navigation equivalent of a
      // disabled button that does not say why.
      href: `/ideas/build?ideaId=${ideaId}&build=1`,
      title: 'The build',
      detail: `how this was made — ${plural(build.passes, 'pass', 'passes')}, and what I make of it`,
    },
  }
}
