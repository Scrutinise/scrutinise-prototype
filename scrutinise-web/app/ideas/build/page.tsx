// SPRINT 25-A — the minimum-elicitation entry point.
//
// ⚠ A NEW ROUTE, NOT A REPLACEMENT (§0). `/ideas/create` is untouched and remains the
// way an idea is built today; this is the §25 path — the user decides, Lex writes —
// and it exists alongside it so Charlie can judge the premise against the real thing.
// When the build finishes, this hands off to `/ideas/create?ideaId=…`, so the kernel is
// presented in the existing panel exactly as §5 asks.
//
// Onboarding redirects mirror `/ideas/create` deliberately: a user who lands here
// without an age confirmation or an experience level must go through the same gate, and
// duplicating the two checks is cheaper than a shared helper that would have to be
// imported into a page another thread is editing this week.

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import BuildIdeaClient from './BuildIdeaClient'
import { stageContext } from '@/lib/lex/stage-context'
import { blankElicitationState } from '@/lib/lex/elicitation'
import { LIVE_IDEA } from '@/lib/lex/idea-visibility'

interface Props {
  /**
   * `fresh=1`      — 25-E §2: the explicit opt-out from resuming. See below.
   * `stage=idea`   — 25-K §1: "I pressed 1 · The Idea and I meant it." See the redirect below.
   * `build=1`      — the older spelling of `stage=idea`, kept so links already in the wild
   *                  (and the client's own `replaceState`) keep working.
   */
  searchParams: Promise<{ ideaId?: string; fresh?: string; build?: string; stage?: string }>
}

export default async function BuildIdeaPage({ searchParams }: Props) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/ideas/build')

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    // 25-G §3 (A3) — the name they go by, so this door can greet them as the old one does.
    select: {
      id: true, ageConfirmed: true, experienceLevel: true,
      preferredName: true, firstName: true,
    },
  })
  if (dbUser && !dbUser.ageConfirmed) redirect('/onboarding?redirect_url=/ideas/build')
  if (dbUser?.ageConfirmed && !dbUser.experienceLevel) redirect('/onboarding?redirect_url=/ideas/build&from=create')

  const params = await searchParams

  // ══ 25-G §2 — A RETURNING USER LANDS ON THE PROPOSAL, NOT THE BUILD ════════
  //
  // "The build is how it was made, the proposal is the work." Someone coming back to an
  // idea wants the work; the build screen is the making-of, and it is where they were
  // last time only because that is where the build ran.
  //
  // ⚠ `build=1` IS THE ESCAPE AND IT IS NOT OPTIONAL. Two things need it. A user watching
  // their build finish is on this URL with no flag, and a refresh must not throw them
  // somewhere else mid-run — so the client writes `build=1` into the URL as soon as a
  // build exists (`replaceState`, exactly as it does for `ideaId`). And the proposal's own
  // link back here carries it, or the two screens would bounce a user between them.
  //
  // ⚠ ONLY A FINISHED BUILD REDIRECTS. A build still QUEUED or RUNNING has nothing on the
  // proposal yet and everything on this screen.
  //
  // ⚠⚠ 25-K §1 — AND THE ESCAPE IS NOW LOAD-BEARING FOR A SECOND REASON. §1 says movement
  // between stages is free in both directions and nothing is locked. A stage indicator
  // whose "1 · The Idea" tile bounced the user straight back to Stage 2 would be a control
  // that visibly does nothing — the exact class of defect this sprint exists to remove. So
  // `stage=idea` (what `stageHref` writes) is the same escape as `build=1`, spelled in the
  // vocabulary the user now reads on the screen.
  if (params.ideaId && dbUser && params.build !== '1' && params.stage !== 'idea') {
    const built = await prisma.ideaBuild.findFirst({
      where: {
        ideaId: params.ideaId,
        idea: { creatorId: dbUser.id, deletedAt: null },
        status: { in: ['DONE', 'FAILED', 'CANCELLED'] },
      },
      select: { id: true },
    })
    if (built) redirect(`/ideas/create?ideaId=${params.ideaId}`)
  }

  let initialIdeaId: string | undefined
  // ⚠⚠ 26-C ADDENDUM §21 — WHICH IDEA THIS IS, SAID ON THE SCREEN ITSELF.
  //
  // §21: a click that opens the right idea still reads as "nothing happened" if the
  // destination gives no sign of which idea it is — exactly true of an idea with no
  // title (§5's gap on anything made before it shipped) and little or no text yet. This
  // is not a substitute for §5's real fix; it is what makes an EXPLICIT resume (§11)
  // legible even before a title exists.
  let openedIdea: { title: string; excerpt: string } | null = null
  if (params.ideaId && dbUser) {
    const existing = await prisma.idea.findUnique({
      where: { id: params.ideaId, creatorId: dbUser.id },
      select: {
        id: true, title: true, deletedAt: true,
        elicitation: { select: { problem: true, goalDetail: true, ownKnowledge: true } },
      },
    })
    if (existing && !existing.deletedAt) {
      initialIdeaId = existing.id
      const excerpt = (existing.elicitation?.problem || existing.elicitation?.goalDetail
        || existing.elicitation?.ownKnowledge || '').trim()
      openedIdea = { title: existing.title, excerpt: excerpt.slice(0, 140) }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ⚠⚠ 26-C ADDENDUM §11 — RETIRES 25-E §2's AUTO-RESUME, DELIBERATELY.
  //
  // 25-E §2 used to find the most recent unfinished, unbuilt elicitation and resume it
  // when the user landed here with NO `?ideaId=`, because at the time that was the only
  // way back to an idea whose page had been lost (before the id lived in the URL) or
  // whose litter shell had swallowed it. Both of those are now handled differently: the
  // id has lived in the URL since 25-E, and 26-C §7a's library lists EVERY idea, so a
  // returning user finds their unfinished work by looking at it and clicking it.
  //
  // Charlie, 19–20 Sep: *"we stay on this super-simple UI... the left column is always
  // empty and ready for a new idea; resuming is an explicit act — the user clicks the
  // idea in the right-hand list."* Auto-resuming a guess at "the" unfinished idea is
  // also the wrong choice when there are several — 25-E's rule cannot express which one
  // Charlie actually wants next, only which one was touched most recently.
  //
  // §11 is a refinement of §4b, not a reversal of it: EXIT-AND-RETURN from within a
  // specific idea's own page still returns to that idea (its `?ideaId=` is already in
  // the URL — see `BuildIdeaClient`'s own history-replace). Only a BARE landing on
  // `/ideas/build`, with no id at all, now always starts blank. `fresh=1` is therefore
  // retired too — a bare landing IS "fresh" now, unconditionally.
  // ═══════════════════════════════════════════════════════════════════════════

  // ⚠⚠ 26-C ADDENDUM 3 §23 — THE LIBRARY NO LONGER LIVES ON THIS PAGE.
  // §23 removes "the mixed page": this screen is "New idea", alone. The library ("Your
  // ideas") moved to its own route, `/ideas/mine` — see that page for the query this used
  // to run (§7a's fix, and §20's deleted-ideas view), unchanged in substance, only moved.

  // 25-K §1 — the three stages, which one this is, and what is on the other two.
  //
  // ⚠ COMPUTED EVEN WITH NO IDEA YET. The old switch returned null when there was nothing
  // on the other surface, so a user at the very start saw no sign that Stage 2 and Stage 3
  // existed at all — which is half of "I don't know where I am". An empty stage says it is
  // empty; it does not disappear.
  const stageCtx = await stageContext(initialIdeaId ?? null, 'idea')

  // 25-K §2 — how many documents and links are already attached, so the composer's "+"
  // carries a count on the first paint rather than only after the panel is opened.
  const materialCount = initialIdeaId
    ? await prisma.ideaUserMaterial.count({ where: { ideaId: initialIdeaId } })
    : 0

  // ══ 25-I §1 — THE FIRST QUESTION, DRAWN WITHOUT CREATING ANYTHING ══════════
  //
  // ⚠⚠ LOADING THIS PAGE USED TO CREATE AN IDEA. The client had nothing to render the
  // first question from, so it POSTed `/api/ideas` on mount purely to have a row — and
  // Charlie's list filled with drafts he never started. The one place he goes to find his
  // real work became unreliable, which is a worse fault than the litter.
  //
  // ⚠ 25-E's resume made this *less* visible without fixing it. A returning user with an
  // unfinished elicitation reopens that row, so the minting only happens to someone whose
  // rows are all empty or all built — which is to say, it kept happening and stopped being
  // obvious. Resume is not creation control.
  //
  // The blank state is computed here and passed down, so the client can draw the question
  // with no row behind it. The idea is created on the FIRST ANSWER (see `ensureIdea` in
  // BuildIdeaClient), which is the moment a person actually starts one.
  const blankState = !initialIdeaId && dbUser ? await blankElicitationState(dbUser.id) : null

  // ── 25-G §3 (A3) — the first-idea tour and the greeting by preferred name ──
  //
  // ⚠ THE SAME TEST THE OLD DOOR USES — `ideaCount === 0` — and not "has no elicitation".
  // A user whose first idea was made at `/ideas/create` is not a first-time user here, and
  // opening an unprompted walkthrough at them would be the product forgetting they exist.
  const ideaCount = dbUser ? await prisma.idea.count({ where: { creatorId: dbUser.id , ...LIVE_IDEA } }) : 0
  const displayName = dbUser?.preferredName?.trim() || dbUser?.firstName?.trim() || null

  return (
    <BuildIdeaClient
      initialIdeaId={initialIdeaId}
      openedIdea={openedIdea}
      // §23b — the prominent button to "Your ideas" is greyed out when there is nothing
      // there yet, which "ideaCount === 0" already answers precisely.
      hasOtherIdeas={ideaCount > 0}
      stageCtx={stageCtx}
      materialCount={materialCount}
      isFirstIdea={ideaCount === 0}
      displayName={displayName}
      blankState={blankState}
    />
  )
}
