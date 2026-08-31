import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import CreateIdeaClient from './CreateIdeaClient'
import type { LexStageKey } from '@/lib/lex/stages'
// ⚠ THE COUNTS COME FROM A SEPARATE, SERVER-ONLY MODULE. See `stages.ts` — putting the
// prisma read beside the vocabulary put `pg` in the browser bundle.
import { stageContext } from '@/lib/lex/stage-context'
import { newIdeaDoor, doorPath } from '@/lib/lex/new-idea-door'
import { LIVE_IDEA } from '@/lib/lex/idea-visibility'

function getTimeOfDay(utcHour: number): string {
  if (utcHour >= 5 && utcHour < 12) return 'morning'
  if (utcHour >= 12 && utcHour < 18) return 'afternoon'
  return 'evening'
}

interface Props {
  /**
   * `stage=deepening` — 25-K §4. Stage 2 and Stage 3 share this route because they share
   * everything except the middle column; see `CreateIdeaClient`'s `stage` prop.
   *
   * ⚠ ANYTHING ELSE IS STAGE 2, silently. A typo in a pasted URL must land the user on a
   * working screen, not on an error about a query parameter they did not type.
   */
  searchParams: Promise<{ ideaId?: string; stage?: string }>
}

export default async function CreateIdeaPage({ searchParams }: Props) {
  const { userId } = await auth()
  if (!userId) {
    redirect('/sign-in?redirect_url=/ideas/create')
  }

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, preferredName: true, firstName: true, ageConfirmed: true, experienceLevel: true },
  })

  // Onboarding not completed — redirect to onboarding, then return here
  if (dbUser && !dbUser.ageConfirmed) {
    redirect('/onboarding?redirect_url=/ideas/create')
  }

  // Existing user who completed original onboarding but hasn't set experience level
  if (dbUser?.ageConfirmed && !dbUser.experienceLevel) {
    redirect('/onboarding?redirect_url=/ideas/create&from=create')
  }

  const params = await searchParams

  // ══ 25-I §1 — THE OLD DOOR MINTS TOO, AND THE SWEEP WOULD REFILL WITHOUT THIS ══
  //
  // `CreateIdeaClient`'s boot has the identical defect the build door had: no `ideaId`
  // means POST `/api/ideas` on mount, purely so `/state` has something to read. Fixing
  // only the flipped door would leave a second tap running into the bucket we are emptying.
  //
  // ⚠ THIS SURFACE IS NO LONGER A CREATION ENTRY. Since 25-G's cutover it is the PROPOSAL,
  // always reached with an `ideaId` — from the build hand-off, the surface switch, or a
  // link. Arriving bare is a stale entry point, so it goes to whatever the current door is
  // rather than manufacturing an idea to justify itself.
  //
  // ⚠ GUARDED AGAINST A LOOP, WHICH IS WHY IT TESTS THE RESOLVED PATH AND NOT THE FLAG.
  // If the door is ever flipped back to `create`, `doorPath()` returns `/ideas/create` and
  // redirecting here would bounce for ever. In that case this page IS the creation entry
  // and minting on boot is its correct behaviour — so the redirect only fires when the door
  // points somewhere else.
  if (!params.ideaId) {
    const door = doorPath(await newIdeaDoor())
    if (door !== '/ideas/create') redirect(door)
  }

  // Resume an existing idea session if ideaId param provided
  let initialIdeaId: string | undefined
  let initialMessages: unknown[] | undefined

  if (params.ideaId && dbUser) {
    const existingIdea = await prisma.idea.findUnique({
      where: { id: params.ideaId, creatorId: dbUser.id },
      select: { id: true, aiChatHistory: true },
    })
    if (existingIdea) {
      initialIdeaId = existingIdea.id
      initialMessages = Array.isArray(existingIdea.aiChatHistory)
        ? (existingIdea.aiChatHistory as unknown[])
        : undefined
    }
  }

  // §13 Task 5 — first idea: the full intro, then the first question as a SEPARATE
  // bubble immediately after. Verbatim. Returning users keep a short greeting.
  //
  // ⚠ 25-K §1 — REWRITTEN, because it taught the user the vocabulary this sprint
  // retires. It described "the proposal" as a panel, which is exactly the implementation
  // word a person then has to translate before they can find anything. It names the
  // columns by what is IN them, and the stage by what you DO there.
  const FIRST_IDEA_INTRO =
    "I'm here to help you develop and build support for a credible proposal for your idea, ready for " +
    'Parliamentary colleagues. This is Stage 2, the Strategy: working through what I drafted. On the left is '  +
    'what to do next, with the chat underneath it; in the middle is the draft as it stands; and on the right '  +
    'is the legislation and the findings, filed under the questions they answer. You can answer here in the '   +
    "chat, or type straight into the draft if you don't need my help. For a quick introduction if you don't "  +
    'know what to do, click “How this works” above.'
  const FIRST_QUESTION = "What's the problem you want to fix?"

  let openingBubbles: string[]
  let isFirstIdea = false

  // Address the user by what they go by: preferredName, falling back to firstName.
  // (The preferred name is now seeded correctly per user, so "Charles" → "Charlie".)
  const displayName = dbUser?.preferredName?.trim() || dbUser?.firstName?.trim() || ''
  const ideaCount = dbUser ? await prisma.idea.count({ where: { creatorId: dbUser.id , ...LIVE_IDEA } }) : 0

  if (!dbUser || ideaCount === 0) {
    isFirstIdea = true
    openingBubbles = [FIRST_IDEA_INTRO, FIRST_QUESTION]
  } else {
    const timeOfDay = getTimeOfDay(new Date().getUTCHours())
    openingBubbles = [
      `Good ${timeOfDay}${displayName ? ' ' + displayName : ''}. ${FIRST_QUESTION} For a quick introduction if you don't know what to do, click “How this works” above.`,
    ]
  }

  // 25-K §1 — the three stages, which one this is, and what is on the other two.
  const lexStage: LexStageKey = params.stage === 'deepening' ? 'deepening' : 'strategy'
  const stageCtx = await stageContext(initialIdeaId ?? null, lexStage)

  return (
    <CreateIdeaClient
      openingBubbles={openingBubbles}
      initialIdeaId={initialIdeaId}
      initialMessages={initialMessages}
      isFirstIdea={isFirstIdea}
      stageCtx={stageCtx}
      stage={lexStage}
    />
  )
}
