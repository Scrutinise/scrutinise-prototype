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
import type { MyIdea } from '@/components/lex/MyIdeasList'
import { surfaceContext } from '@/lib/lex/surfaces'
import { blankElicitationState } from '@/lib/lex/elicitation'

interface Props {
  /**
   * `fresh=1` — 25-E §2: the explicit opt-out from resuming. See below.
   * `build=1`  — 25-G §2: "I meant to come to the BUILD screen." See `landOnProposal`.
   */
  searchParams: Promise<{ ideaId?: string; fresh?: string; build?: string }>
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
  if (params.ideaId && dbUser && params.build !== '1') {
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
  let resumed = false
  if (params.ideaId && dbUser) {
    const existing = await prisma.idea.findUnique({
      where: { id: params.ideaId, creatorId: dbUser.id },
      select: { id: true, deletedAt: true },
    })
    if (existing && !existing.deletedAt) initialIdeaId = existing.id
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 25-E §2 — RESUME, RATHER THAN MINTING A NEW IDEA ON EVERY VISIT.
  //
  // ⚠⚠ THIS IS THE DEFECT CHARLIE HIT, AND THE BRIEF'S DESCRIPTION OF IT IS KIND.
  // He reported that refreshing "lost everything he had entered". It did not: every
  // answer was in the database the whole time and is there now — idea
  // 452c5ade…, 2,934 characters of problem, 690 of his own knowledge, CONFIRMED at
  // 01:56:52 on 22 Aug. `answerStep` has always persisted each answer on the turn it
  // was given.
  //
  // What was lost was the PAGE. Landing here without `?ideaId=` made the client POST
  // `/api/ideas` and mint a BRAND NEW idea, and the id was never written to the URL —
  // so a refresh minted another one and orphaned the first. The user sees an empty
  // form and correctly concludes their writing is gone.
  //
  // The litter proves it: 10 of the 11 elicitation rows in production are empty
  // "Untitled idea" shells, three of them created within EIGHT SECONDS of each other.
  //
  // So: an unfinished elicitation is RESUMED. Which also stops the litter at source —
  // a returning user reopens their row instead of adding to the pile.
  //
  // ⚠⚠ "UNFINISHED" MEANS *NO BUILD HAS BEEN STARTED*, NOT "NOT CONFIRMED". This
  // distinction is not pedantic — it is the difference between Charlie getting his work
  // back and not. His idea is CONFIRMED with no build: he answered all four questions,
  // agreed to the reading, and was then stopped by the greyed-out button. A rule that
  // resumed only IN_PROGRESS rows would hand him a blank page and leave 2,934 characters
  // stranded, having just fixed the bug that stranded them.
  //
  // A CONFIRMED elicitation with a build is finished work and is NOT resumed: reopening it
  // would trap someone who came back to start something new.
  // ═══════════════════════════════════════════════════════════════════════════
  // ⚠ `fresh=1` IS THE WAY OUT, AND IT HAS TO EXIST. Resuming by default is right — it is
  // what the user almost always wants — but a default with no override is a trap for the
  // person who came here to start something else, and they would have no way to say so.
  if (!initialIdeaId && dbUser && params.fresh !== '1') {
    // ⚠⚠ THE "HAS SOMETHING IN IT" TEST IS IN THE QUERY, NOT AFTER IT, AND THE FIRST VERSION
    // OF THIS CODE GOT IT WRONG IN A WAY THAT WOULD HAVE SHIPPED.
    //
    // `findFirst` is `ORDER BY … LIMIT 1`. Filtering for content AFTER it means the newest row
    // wins the ordering and is then thrown away for being empty — so ONE empty shell hides
    // every real row behind it. Measured against production: the query landed on a blank row
    // created at 00:29 today, and Charlie's own CONFIRMED idea — 2,934 characters, last
    // touched 22 Aug — never came back at all, because it is older. The fix for losing his
    // work would have failed to find it.
    //
    // Same shape as GRAPH 3B: a property asserted over a RANKED, TRUNCATED result set is only
    // a property of the top of the ranking. If the condition decides which row you want, it
    // belongs in the WHERE clause.
    const unfinished = await prisma.ideaElicitation.findFirst({
      where: {
        idea: { creatorId: dbUser.id, deletedAt: null, builds: { none: {} } },
        OR: [
          { problem: { not: null } },
          { goalKind: { not: null } },
          { ownKnowledge: { not: null } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      select: { ideaId: true, status: true, problem: true, goalKind: true, ownKnowledge: true },
    })
    // Belt and braces: a row storing an EMPTY STRING rather than null would satisfy the SQL
    // and still be nothing to resume. Announcing a resumption of nothing is its own defect.
    if (unfinished && (unfinished.problem?.trim() || unfinished.goalKind || unfinished.ownKnowledge?.trim())) {
      initialIdeaId = unfinished.ideaId
      resumed = true
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMPORARY (Charlie, 24 Aug 2026) — A WAY TO SEE IDEAS MADE ON THIS PATH.
  //
  // There is no UI anywhere that lists ideas created through `/ideas/build`, so a
  // finished build is reachable only by someone pasting its id into a URL. This is a
  // stopgap list, not a feature: no paging, no search, no delete, owner-only, and it
  // reads rows that already exist rather than storing anything new.
  //
  // ⚠ IT CANNOT BE A LIST OF TITLES. Every idea on this path is called "Untitled idea"
  // until the user accepts the title Lex proposed — 11 of 11 in production right now —
  // so a title list would render eleven identical rows. The excerpt below is what makes
  // the entries tellable apart, and it comes from the problem the USER wrote.
  //
  // ⚠ THE EMPTY SHELLS ARE HIDDEN, AND THE COUNT OF THEM IS SHOWN. 10 of the 11
  // elicitation rows in production are blank shells minted by the pre-25-E bug. Dropping
  // them silently would make this list lie about what is in the database, so the client
  // prints how many were hidden.
  // ═══════════════════════════════════════════════════════════════════════════
  let recent: MyIdea[] = []
  let hiddenEmpty = 0
  if (dbUser) {
    const rows = await prisma.ideaElicitation.findMany({
      where: { idea: { creatorId: dbUser.id, deletedAt: null } },
      orderBy: { updatedAt: 'desc' },
      take: 40,
      select: {
        ideaId: true, status: true, problem: true, goalDetail: true, ownKnowledge: true,
        updatedAt: true,
        idea: {
          select: {
            title: true,
            // 25-J §2 — the hub lists the stage, so it is selected rather than derived.
            stage: true,
            builds: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { status: true, passesComplete: true, completedAt: true },
            },
          },
        },
      },
    })
    for (const r of rows) {
      const excerpt = (r.problem || r.goalDetail || r.ownKnowledge || '').trim()
      if (!excerpt) { hiddenEmpty++; continue }
      const b = r.idea.builds[0]
      recent.push({
        ideaId: r.ideaId,
        title: r.idea.title,
        // ⚠ 25-J §2 — SHORTER THAN THE STOPGAP'S 180. This is a list row now, not a
        // diagnostic paragraph: a line the eye can scan is what makes an untitled idea
        // recognisable, and 180 characters wraps to four lines and stops being scannable.
        excerpt: excerpt.length > 110 ? excerpt.slice(0, 110).trimEnd() + '…' : excerpt,
        stage: r.idea.stage,
        elicitationStatus: r.status,
        buildStatus: b?.status ?? null,
        passesComplete: b?.passesComplete ?? null,
        updatedAt: r.updatedAt.toISOString(),
      })
    }
  }

  // 25-G §2 — what the OTHER surface holds, so this screen can offer it specifically.
  const surface = initialIdeaId ? await surfaceContext(initialIdeaId, 'build') : null

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
  const ideaCount = dbUser ? await prisma.idea.count({ where: { creatorId: dbUser.id } }) : 0
  const displayName = dbUser?.preferredName?.trim() || dbUser?.firstName?.trim() || null

  return (
    <BuildIdeaClient
      initialIdeaId={initialIdeaId}
      resumed={resumed}
      recent={recent}
      hiddenEmpty={hiddenEmpty}
      surface={surface}
      isFirstIdea={ideaCount === 0}
      displayName={displayName}
      blankState={blankState}
    />
  )
}
