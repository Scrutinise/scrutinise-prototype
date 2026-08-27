import { redirect, notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import PublicNav from '@/components/PublicNav'
import { canManageCommunity, getRootCommunityId } from '@/lib/community'
import {
  canPromoteQuestion,
  getQuestionVisibilityFilter,
  getRankedAnswers,
  requireLibraryAccess,
} from '@/lib/question-library'
import { approvalStampFor, getCommunityBranding, resolveApproverCaps } from '@/lib/approval'
import QuestionDetail from './QuestionDetail'
import type { Metadata } from 'next'

type Props = { params: Promise<{ id: string; questionId: string }> }

export const metadata: Metadata = { title: 'Question' }

export default async function QuestionPage({ params }: Props) {
  const { id, questionId } = await params
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) redirect(`/sign-in?redirect_url=/communities/${id}/questions/${questionId}`)

  const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId }, select: { id: true } })
  if (!user) redirect(`/sign-in?redirect_url=/communities/${id}/questions/${questionId}`)

  try {
    await requireLibraryAccess(user.id, id)
  } catch {
    notFound()
  }

  // A branch-scoped question is invisible from a sibling branch — the filter is
  // what enforces that, not the UI.
  const filter = await getQuestionVisibilityFilter(id)
  const question = await prisma.question.findFirst({
    where: { AND: [{ id: questionId }, filter] },
    include: {
      branch: { select: { id: true, name: true } },
      _count: { select: { votes: true, answers: true } },
    },
  })
  if (!question) notFound()

  const [answers, myVote, canManage, branding] = await Promise.all([
    getRankedAnswers(questionId, user.id),
    prisma.questionVote.findUnique({
      where: { questionId_userId: { questionId, userId: user.id } },
      select: { id: true },
    }),
    canManageCommunity(user.id, await getRootCommunityId(id)),
    getCommunityBranding(id),
  ])
  // ⚠ Resolved ONCE for the viewer: the approval mode is a Community setting,
  // so every answer on the page is decided by the same four booleans.
  const caps = await resolveApproverCaps(user.id, id, branding)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <QuestionDetail
          communityId={id}
          viewerId={user.id}
          question={{
            id: question.id,
            text: question.text,
            scope: question.scope,
            contextTags: question.contextTags,
            topicTags: question.topicTags,
            voteCount: question._count.votes,
            answerCount: question._count.answers,
            myVote: myVote !== null,
            branch: question.branch,
          }}
          answers={answers.map((a) => ({
            ...a,
            createdAt: a.createdAt.toISOString(),
            approval: {
              ...approvalStampFor(a, branding),
              approvedAt: a.approvedAt ? a.approvedAt.toISOString() : null,
            },
          }))}
          branding={{
            approvalMode: branding.approvalMode,
            approvalFeatureEnabled: branding.approvalFeatureEnabled,
            organisationName: branding.organisationName,
          }}
          caps={caps}
          canPromote={question.scope === 'BRANCH' && (await canPromoteQuestion(user.id, questionId))}
          canManage={canManage}
        />
      </main>
    </div>
  )
}
