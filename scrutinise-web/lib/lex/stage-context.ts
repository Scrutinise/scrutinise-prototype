// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-K §1 — WHAT IS ON EACH STAGE, COUNTED.
//
// ⚠⚠ SPLIT OUT OF `stages.ts` BECAUSE A CLIENT COMPONENT IMPORTS THAT ONE. `CreateIdeaClient`
// needs the stage NAMES; putting the prisma query beside them dragged `lib/prisma` →
// `@prisma/adapter-pg` → `pg` → `require('tls')` into the browser bundle and broke
// `next build`. ⚠ `tsc --noEmit` was clean throughout — a package-boundary fault is
// invisible to the type checker (docs/CLAUDE.md §20, check 0, the same shape one level
// down). The vocabulary is pure and shared; the reads live here and are server-only.
//
// ⚠ THE COUNTS ARE WHAT MAKE THE BAR AN INVITATION RATHER THAN A LABEL. "The Strategy" tells
// a user where a link goes; "The Strategy — 23 fields, 10 decisions waiting" tells them
// whether to press it.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { LEX_STAGES, stageHref, type LexStage, type LexStageKey } from './stages'

export interface LexStageView extends LexStage {
  href: string
  /** Counted, never a label. Null when there is nothing yet to count. */
  detail: string | null
  /** False in exactly one case: no idea exists, so this stage has nothing in it. */
  available: boolean
  /** Why not, in words. Null when it is available. An inert control that says nothing
   *  is the defect this sprint exists to remove, one level up. */
  unavailableReason: string | null
}

export interface StageContext {
  ideaId: string | null
  /** Which stage the user is looking at RIGHT NOW. */
  here: LexStageKey
  /** All three, in order, always — the indicator is persistent (§1). */
  stages: LexStageView[]
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

/**
 * Stage 2's counts.
 *
 * ⚠ "DECISIONS WAITING" IS UNRESOLVED FORKS PLUS OPEN ISSUES, and both belong in it (25-G
 * §2, kept): 25-C turns a fork into a decision and the verification passes put their
 * failures on the same list, so a user with four forks and eleven issues has fifteen
 * things waiting whatever the internal table is called. Counting only the forks told the
 * second build's user there were four when there were twenty-one.
 */
async function strategyCounts(ideaId: string): Promise<{ fields: number; waiting: number }> {
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

/** Stage 1's counts — what the user has actually handed over. */
async function ideaCounts(ideaId: string): Promise<{ material: number; runs: number }> {
  const [material, runs] = await Promise.all([
    prisma.ideaUserMaterial.count({ where: { ideaId } }),
    prisma.ideaBuild.count({ where: { ideaId } }),
  ])
  return { material, runs }
}

/** Stage 3's counts — how much deepening has actually happened. */
async function deepeningCounts(ideaId: string): Promise<{ run: number; open: number }> {
  const [run, open] = await Promise.all([
    prisma.deepeningPass.count({ where: { ideaId, status: 'RUN' } }),
    prisma.deepeningIssue.count({ where: { ideaId, status: 'OPEN' } }),
  ])
  return { run, open }
}

/**
 * The whole bar, for one screen.
 *
 * ⚠ THREE ROWS, ALWAYS. The old switch returned null when the other surface had nothing on
 * it, so a user at stage 1 saw no indication that stages 2 and 3 existed — which is half of
 * "I don't know where I am". A stage with nothing in it says so; it does not vanish.
 *
 * ⚠ ONE ROUND TRIP OF READS, ALL COUNTS. No model call, nothing written. This runs on every
 * render of both surfaces, so it has to stay a handful of indexed counts.
 */
export async function stageContext(ideaId: string | null, here: LexStageKey): Promise<StageContext> {
  if (!ideaId) {
    return {
      ideaId: null,
      here,
      stages: LEX_STAGES.map((s) => ({
        ...s,
        href: stageHref(s.key, null),
        detail: null,
        available: s.key === 'idea',
        unavailableReason: s.key === 'idea' ? null : 'Opens once you’ve told me the idea.',
      })),
    }
  }

  const [idea, strategy, deepening] = await Promise.all([
    ideaCounts(ideaId), strategyCounts(ideaId), deepeningCounts(ideaId),
  ])

  const detailFor = (key: LexStageKey): string | null => {
    switch (key) {
      case 'idea':
        return idea.runs
          ? `${plural(idea.runs, 'run')}${idea.material ? `, ${plural(idea.material, 'document')}` : ''}`
          : idea.material ? plural(idea.material, 'document') : 'nothing built yet'
      case 'strategy':
        if (!strategy.fields) return 'nothing drafted yet'
        return strategy.waiting
          ? `${plural(strategy.fields, 'field')}, ${plural(strategy.waiting, 'decision')} waiting`
          : `${plural(strategy.fields, 'field')} — nothing waiting on you`
      case 'deepening':
        if (!deepening.run) return 'no passes run yet'
        return deepening.open
          ? `${plural(deepening.run, 'pass', 'passes')} run, ${plural(deepening.open, 'issue')} open`
          : `${plural(deepening.run, 'pass', 'passes')} run — nothing open`
    }
  }

  return {
    ideaId,
    here,
    stages: LEX_STAGES.map((s) => ({
      ...s,
      href: stageHref(s.key, ideaId),
      detail: detailFor(s.key),
      // Once an idea exists every stage is reachable. §1: "Nothing is locked behind
      // completion." An empty stage 3 is a stage that says it is empty, not one you
      // cannot open.
      available: true,
      unavailableReason: null,
    })),
  }
}
