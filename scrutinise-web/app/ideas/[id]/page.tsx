import { notFound, redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import PublicNav from '@/components/PublicNav'
import IdeaDetailClient from './IdeaDetailClient'
import { getStage3GateData, getStage4GateData } from '@/lib/stage-gates'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ id: string }>
}

/**
 * ⚠⚠ PRINCIPLE 7 — EVERY IDEA PAGE IS `noindex, nofollow`, WITHOUT EXCEPTION.
 *
 * The National Archives' computational analysis licence, principle 7:
 *
 *   "Licence holders must not index the contents of judgments and decisions on search engines…
 *    You should consider what you will do to prevent third party services from crawling or
 *    scraping either the text of the records or the data you have extracted from the records."
 *
 * There is no judgment PAGE on this site. Judgment text reaches a reader only as a short
 * Lex-written extract inside an idea — `EvidenceItem.body` (measured 26 Aug 2026: median 252
 * characters, max 776, against a median `tna-caselaw` section of ~37,575) or `Research.snippet`
 * (schema cap 500). So the idea page IS the surface principle 7 is about, and this is the control.
 *
 * ⚠ IT IS UNCONDITIONAL ON PURPOSE. A per-idea flag ("noindex only the ones that carry a judgment
 * extract") would keep ideas discoverable, and Charlie rejected it on 27 Aug for the right reason:
 * the licence application states this as a FACT, and a detector that silently stops firing turns a
 * legal claim false with nobody watching. A blanket rule cannot silently stop applying.
 *
 * ⚠ THE COST IS REAL AND WAS ACCEPTED: no idea page appears in any search engine. `sitemap.ts` no
 * longer lists them either.
 *
 * ⚠ THIS DOES NOT TOUCH RETRIEVAL. Lex's own search over the corpus — the licensed activity — runs
 * server-side through `fts-serve`/`vector-serve` and is unaffected by any robots directive.
 *
 * Paired with `X-Robots-Tag` in `next.config.js` (a crawler may honour either) and `Disallow` in
 * `public/robots.txt`. Evidence: `docs/PRINCIPLE_7_EVIDENCE.md`.
 */
const NOINDEX: Metadata['robots'] = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: { index: false, follow: false },
}

const PRIVATE_METADATA: Metadata = {
  title: 'Scrutinise — Policy Development Platform',
  description: 'A not-for-profit platform helping citizens develop policy ideas into Parliament-ready legislation.',
  robots: NOINDEX,
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const idea = await prisma.idea.findUnique({
    where: { id },
    select: { title: true, summaryDescription: true, stage: true, visibility: true, deletedAt: true },
  })
  if (!idea || idea.deletedAt) return PRIVATE_METADATA
  const isPublic = ['STAGE_3', 'STAGE_4', 'STAGE_5'].includes(idea.stage) &&
    ['LINK_ONLY', 'PLATFORM_LISTED'].includes(idea.visibility)
  if (!isPublic) return PRIVATE_METADATA
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://scrutinise.co.uk'
  const description = idea.summaryDescription ?? 'A policy idea developed on Scrutinise.'
  return {
    title: idea.title,
    description,
    // ⚠ A PUBLIC IDEA IS STILL noindex. See NOINDEX above — the openGraph/twitter cards below are
    //   for a human pasting a link into a message, which is a different thing from a search index.
    robots: NOINDEX,
    openGraph: {
      title: idea.title,
      description,
      url: `${appUrl}/ideas/${id}`,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: idea.title,
      description,
    },
  }
}

export default async function IdeaDetailPage({ params }: Props) {
  const { id } = await params
  const { userId: clerkUserId } = await auth()

  const idea = await prisma.idea.findUnique({
    where: { id },
    include: {
      creator: {
        select: {
          id: true,
          name: true,
          username: true,
          referralCode: true,
          credibilityScore: { select: { totalScore: true, phase: true } },
        },
      },
      coherentActions: { orderBy: { orderIndex: 'asc' } },
      research: { orderBy: { createdAt: 'asc' } },
      collaborators: {
        include: { user: { select: { id: true, name: true, username: true } } },
      },
      diagnoses: true,
      rootCauses: { orderBy: { createdAt: 'asc' } },
      guidingPolicies: true,
      evidence: { orderBy: { createdAt: 'asc' } },
    },
  })

  // §19-E Task 6 — a deleted idea 404s for everyone, its owner included. notFound()
  // rather than a "this was deleted" page: the owner deleted it deliberately, and a
  // tombstone in the place they removed something from is not a kindness.
  if (!idea || idea.deletedAt) notFound()

  // Ideas are publicly accessible only at Stage 3+ with LINK_ONLY or PLATFORM_LISTED visibility.
  // Stage 1 and Stage 2 ideas are always private regardless of the visibility field.
  const isPubliclyAccessible =
    ['STAGE_3', 'STAGE_4', 'STAGE_5'].includes(idea.stage) &&
    ['LINK_ONLY', 'PLATFORM_LISTED'].includes(idea.visibility)

  if (!isPubliclyAccessible) {
    if (!clerkUserId) {
      redirect(`/sign-in?redirect_url=/ideas/${id}`)
    }
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true, role: true },
    })
    if (!dbUser) redirect(`/sign-in?redirect_url=/ideas/${id}`)

    const isOwner = idea.creatorId === dbUser.id
    const isCollaborator = idea.collaborators.some(c => c.userId === dbUser.id)
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(dbUser.role)
    if (!isOwner && !isCollaborator && !isAdmin) notFound()
  }

  // Get current user context for UI decisions
  let currentUserId: string | null = null
  let currentUserReferralCode: string | null = null
  let currentUserCanEndorse = false

  if (clerkUserId) {
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true, referralCode: true, parliamentaryStatus: true, manualCredibilityOverride: true },
    })
    if (dbUser) {
      currentUserId = dbUser.id
      currentUserReferralCode = dbUser.referralCode
      currentUserCanEndorse =
        dbUser.parliamentaryStatus === 'MP' ||
        dbUser.parliamentaryStatus === 'PEER' ||
        dbUser.manualCredibilityOverride != null
    }
  }

  const isOwner = currentUserId === idea.creatorId
  const isCollaborator = idea.collaborators.some(c => c.userId === currentUserId)

  // Priority 3: Create IdeaReview(VIEWED) for authenticated visitors at Stage 3+
  if (currentUserId && ['STAGE_3', 'STAGE_4', 'STAGE_5'].includes(idea.stage)) {
    await prisma.ideaReview
      .upsert({
        where: { ideaId_userId: { ideaId: id, userId: currentUserId } },
        update: {},
        create: { ideaId: id, userId: currentUserId, outcome: 'VIEWED' },
      })
      .catch(() => {})
  }

  // Stage 3→4 gate data (owner-only, Stage 3 only)
  let ideaReviewCount = 0
  let avgQualityRating = 0
  if (idea.stage === 'STAGE_3' && isOwner) {
    const gateData = await getStage3GateData(id)
    ideaReviewCount = gateData.reviewCount
    avgQualityRating = gateData.avgQualityRating
  }

  // Stage 4→5 gate data (owner-only, Stage 4 only)
  let stage4GateData: { mpCount: number; peerCount: number; draftsmanCount: number; wordingComplete: boolean } | null = null
  if (idea.stage === 'STAGE_4' && isOwner) {
    stage4GateData = await getStage4GateData(id)
  }

  // Serialise for client (Prisma Decimal → string, Date → string)
  const serialised = {
    ...idea,
    maturityIndex: idea.maturityIndex.toString(),
    passionScore: idea.passionScore?.toString() ?? null,
    credibilityWeightedRating: idea.credibilityWeightedRating?.toString() ?? null,
    createdAt: idea.createdAt.toISOString(),
    updatedAt: idea.updatedAt.toISOString(),
    publishedAt: idea.publishedAt?.toISOString() ?? null,
    withdrawnAt: idea.withdrawnAt?.toISOString() ?? null,
    stageEligibleSince: idea.stageEligibleSince?.toISOString() ?? null,
    maturityLastUpdated: idea.maturityLastUpdated?.toISOString() ?? null,
    creator: {
      ...idea.creator,
      credibilityScore: idea.creator.credibilityScore
        ? {
            totalScore: idea.creator.credibilityScore.totalScore?.toString() ?? null,
            phase: idea.creator.credibilityScore.phase,
          }
        : null,
    },
    coherentActions: idea.coherentActions.map(a => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
    research: idea.research.map(r => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    collaborators: idea.collaborators.map(c => ({
      ...c,
      invitedAt: c.invitedAt.toISOString(),
      acceptedAt: c.acceptedAt?.toISOString() ?? null,
    })),
    diagnoses: idea.diagnoses.map(d => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })),
    rootCauses: idea.rootCauses.map(r => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
    guidingPolicies: idea.guidingPolicies.map(g => ({
      ...g,
      createdAt: g.createdAt.toISOString(),
    })),
    evidence: idea.evidence.map(e => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
    })),
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <IdeaDetailClient
        idea={serialised}
        isOwner={isOwner}
        isCollaborator={isCollaborator}
        currentUserId={currentUserId}
        currentUserReferralCode={currentUserReferralCode}
        currentUserCanEndorse={currentUserCanEndorse}
        ideaReviewCount={ideaReviewCount}
        avgQualityRating={avgQualityRating}
        stage4GateData={stage4GateData}
      />
    </div>
  )
}
