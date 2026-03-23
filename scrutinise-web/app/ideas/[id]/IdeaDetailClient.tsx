'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Circle, AlertCircle, Copy } from 'lucide-react'
import VoteWidget from '@/components/VoteWidget'
import ContributionsTab from './ContributionsTab'
import ResearchTab, { type ResearchItem } from './ResearchTab'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CoherentAction {
  id: string
  title: string
  summarySnippet: string | null
  orderIndex: number
}

interface Collaborator {
  id: string
  userId: string
  role: string
  user: { id: string; name: string; username: string }
}

interface Idea {
  id: string
  title: string
  summaryDescription: string
  stage: string
  visibility: string
  diagnosis: string | null
  guidingPolicy: string | null
  rootCause: string | null
  whoAffected: string | null
  commentCount: number
  referralLinkActive: boolean
  createdAt: string
  creator: {
    id: string
    name: string
    username: string
    referralCode: string
    credibilityScore: { totalScore: string | null; phase: string } | null
  }
  coherentActions: CoherentAction[]
  research: ResearchItem[]
  collaborators: Collaborator[]
}

interface Props {
  idea: Idea
  isOwner: boolean
  isCollaborator: boolean
  currentUserId: string | null
  currentUserReferralCode: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage config
// ─────────────────────────────────────────────────────────────────────────────

const STAGES = [
  { key: 'STAGE_1', label: 'Create' },
  { key: 'STAGE_2', label: 'Draft' },
  { key: 'STAGE_3', label: 'Develop' },
  { key: 'STAGE_4', label: 'Campaign' },
  { key: 'STAGE_5', label: 'Legislate' },
] as const

const STAGE_BADGE: Record<string, string> = {
  STAGE_1: 'bg-slate-100 text-slate-700',
  STAGE_2: 'bg-blue-100 text-blue-700',
  STAGE_3: 'bg-amber-100 text-amber-700',
  STAGE_4: 'bg-green-100 text-green-700',
  STAGE_5: 'bg-purple-100 text-purple-700',
  ARCHIVED: 'bg-neutral-100 text-neutral-600',
  WITHDRAWN: 'bg-red-100 text-red-600',
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage stepper
// ─────────────────────────────────────────────────────────────────────────────

function StageStepper({ currentStage }: { currentStage: string }) {
  const currentIndex = STAGES.findIndex(s => s.key === currentStage)

  return (
    <nav aria-label="Idea progress" className="flex items-center gap-0">
      {STAGES.map((stage, i) => {
        const isPast = i < currentIndex
        const isCurrent = i === currentIndex
        const isFuture = i > currentIndex

        return (
          <div key={stage.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={[
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
                  isPast ? 'bg-foreground text-background' : '',
                  isCurrent ? 'bg-foreground text-background ring-2 ring-foreground ring-offset-2' : '',
                  isFuture ? 'border-2 border-muted-foreground/30 text-muted-foreground/50' : '',
                ].join(' ')}
              >
                {isPast ? <CheckCircle2 className="size-4" /> : i + 1}
              </div>
              <span
                className={[
                  'mt-1 text-[10px] font-medium sm:text-xs',
                  isCurrent ? 'text-foreground' : 'text-muted-foreground',
                ].join(' ')}
              >
                {stage.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div
                className={[
                  'mx-1 mb-4 h-[2px] w-8 sm:w-12',
                  i < currentIndex ? 'bg-foreground' : 'bg-muted-foreground/20',
                ].join(' ')}
              />
            )}
          </div>
        )
      })}
    </nav>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 2→3 gate checklist
// ─────────────────────────────────────────────────────────────────────────────

function Stage2GateCard({ idea }: { idea: Idea }) {
  const checks = [
    { label: 'Challenge / diagnosis completed', met: !!idea.diagnosis?.trim() },
    { label: 'Guiding policy completed', met: !!idea.guidingPolicy?.trim() },
    { label: 'At least 1 Coherent Action added', met: idea.coherentActions.length >= 1 },
    {
      label: `Research: ${idea.research.length}/3 items added`,
      met: idea.research.length >= 3,
    },
  ]

  const allMet = checks.every(c => c.met)

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm">Requirements to Take Public</CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        <ul className="space-y-2">
          {checks.map(check => (
            <li key={check.label} className="flex items-center gap-2 text-sm">
              {check.met ? (
                <CheckCircle2 className="size-4 shrink-0 text-green-600" />
              ) : (
                <Circle className="size-4 shrink-0 text-muted-foreground/40" />
              )}
              <span className={check.met ? 'text-foreground' : 'text-muted-foreground'}>
                {check.label}
              </span>
            </li>
          ))}
        </ul>
        {allMet && (
          <p className="mt-3 text-xs text-green-700">
            All requirements met — you can take this idea public.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Take Public modal
// ─────────────────────────────────────────────────────────────────────────────

function TakePublicModal({
  ideaId,
  onClose,
  onSuccess,
}: {
  ideaId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStage: 'STAGE_3' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        return
      }
      onSuccess()
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-500" />
          <div>
            <h2 className="font-semibold">Take this idea public?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This will advance your idea to the <strong>Develop</strong> stage and make it
              visible to anyone with the link. Anyone will be able to read the full idea and
              leave Contributions.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              This action <strong>cannot be undone</strong> — once public, the idea cannot
              be made private again.
            </p>
            {error && (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="mt-4 flex gap-3">
              <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleConfirm} disabled={loading}>
                {loading ? 'Taking public…' : 'Yes, take public'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab components
// ─────────────────────────────────────────────────────────────────────────────

function OverviewTab({ idea }: { idea: Idea }) {
  return (
    <div className="space-y-6">
      {idea.diagnosis && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            The Challenge
          </h3>
          <p className="text-sm leading-relaxed sm:text-base">{idea.diagnosis}</p>
        </section>
      )}

      {idea.rootCause && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Root Cause
          </h3>
          <p className="text-sm leading-relaxed sm:text-base">{idea.rootCause}</p>
        </section>
      )}

      {idea.whoAffected && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Who Is Affected
          </h3>
          <p className="text-sm leading-relaxed sm:text-base">{idea.whoAffected}</p>
        </section>
      )}

      {idea.guidingPolicy && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Guiding Policy
          </h3>
          <p className="text-sm leading-relaxed sm:text-base">{idea.guidingPolicy}</p>
        </section>
      )}

      {idea.coherentActions.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Coherent Actions
          </h3>
          <ol className="space-y-3">
            {idea.coherentActions.map((action, i) => (
              <li key={action.id} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium">{action.title}</p>
                  {action.summarySnippet && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{action.summarySnippet}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {idea.coherentActions.length === 0 && !idea.diagnosis && !idea.guidingPolicy && (
        <p className="text-sm text-muted-foreground">
          This idea is still being developed. Check back later.
        </p>
      )}
    </div>
  )
}

function TeamTab({ idea }: { idea: Idea }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-lg border p-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
          {idea.creator.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-medium">{idea.creator.name}</p>
          <p className="text-xs text-muted-foreground">Owner</p>
        </div>
      </div>
      {idea.collaborators.map(c => (
        <div key={c.id} className="flex items-center gap-3 rounded-lg border p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {c.user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium">{c.user.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{c.role.toLowerCase()}</p>
          </div>
        </div>
      ))}
      {idea.collaborators.length === 0 && (
        <p className="text-sm text-muted-foreground">No collaborators yet.</p>
      )}
    </div>
  )
}

function AmendmentsTab() {
  return (
    <p className="text-sm text-muted-foreground">
      Amendments are available from the Campaign stage.
    </p>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Development History — owner-only, shows Stage 2 internal contributions
// grouped by contributor
// ─────────────────────────────────────────────────────────────────────────────

interface InternalContribution {
  id: string
  commentNumber: number | null
  content: string
  stance: string
  contributionType: string | null
  createdAt: string
  author: { id: string; name: string; username: string }
}

function DevelopmentHistory({ ideaId }: { ideaId: string }) {
  const [items, setItems] = useState<InternalContribution[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/ideas/${ideaId}/contributions`)
      .then(r => r.json())
      .then(data => {
        const internals = (data.contributions ?? []).filter(
          (c: InternalContribution & { isInternal: boolean }) => c.isInternal,
        )
        setItems(internals)
      })
      .catch(() => {/* non-critical */})
      .finally(() => setLoading(false))
  }, [ideaId])

  if (loading || items.length === 0) return null

  // Group by contributor
  const byAuthor = items.reduce<Record<string, { author: InternalContribution['author']; contributions: InternalContribution[] }>>(
    (acc, item) => {
      const key = item.author.id
      if (!acc[key]) acc[key] = { author: item.author, contributions: [] }
      acc[key].contributions.push(item)
      return acc
    },
    {},
  )

  const STANCE_STYLES: Record<string, string> = {
    SUPPORTIVE: 'bg-green-100 text-green-800',
    CRITICAL: 'bg-red-100 text-red-700',
    NEUTRAL: 'bg-muted text-muted-foreground',
    QUESTION: 'bg-blue-100 text-blue-700',
  }
  const STANCE_LABELS: Record<string, string> = {
    SUPPORTIVE: 'Supportive',
    CRITICAL: 'Critical',
    NEUTRAL: 'Neutral',
    QUESTION: 'Question',
  }

  return (
    <div className="mt-10 border-t pt-8">
      <h2 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Development History
      </h2>
      <p className="mb-5 text-xs text-muted-foreground">
        Internal contributions made during the Draft stage by your collaborators.
      </p>
      <div className="space-y-6">
        {Object.values(byAuthor).map(({ author, contributions }) => (
          <div key={author.id}>
            <p className="mb-2 text-sm font-medium">
              {author.name}{' '}
              <span className="text-xs font-normal text-muted-foreground">
                — {contributions.length} contribution{contributions.length !== 1 ? 's' : ''}
              </span>
            </p>
            <div className="space-y-2 border-l-2 border-muted pl-4">
              {contributions.map(c => (
                <div key={c.id} className="rounded-md border bg-muted/30 p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    {c.commentNumber != null && (
                      <span className="font-mono text-xs text-muted-foreground">#{c.commentNumber}</span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STANCE_STYLES[c.stance] ?? 'bg-muted text-muted-foreground'}`}>
                      {STANCE_LABELS[c.stance] ?? c.stance}
                    </span>
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                      Internal
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed">{c.content}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(c.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main client component
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'contributions' | 'research' | 'amendments' | 'team'

export default function IdeaDetailClient({
  idea: initialIdea,
  isOwner,
  isCollaborator,
  currentUserId,
  currentUserReferralCode,
}: Props) {
  const router = useRouter()
  const [idea, setIdea] = useState(initialIdea)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [showTakePublicModal, setShowTakePublicModal] = useState(false)
  const [referralLinkCopied, setReferralLinkCopied] = useState(false)
  const [commentCount, setCommentCount] = useState(initialIdea.commentCount)

  const stageLabel = STAGES.find(s => s.key === idea.stage)?.label ?? idea.stage
  const badgeClass = STAGE_BADGE[idea.stage] ?? 'bg-muted text-muted-foreground'

  const stage2GateMet =
    idea.stage === 'STAGE_2' &&
    isOwner &&
    !!idea.diagnosis?.trim() &&
    !!idea.guidingPolicy?.trim() &&
    idea.coherentActions.length >= 1 &&
    idea.research.length >= 3

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://scrutinise.co.uk'
  const referralLink = `${appUrl}/ideas/${idea.id}?ref=${currentUserReferralCode ?? idea.creator.referralCode}`

  function handleTakePublicSuccess() {
    setShowTakePublicModal(false)
    // Refresh the page to get updated idea data
    router.refresh()
    setIdea(prev => ({ ...prev, stage: 'STAGE_3', visibility: 'LINK_ONLY', referralLinkActive: true }))
  }

  function copyReferralLink() {
    navigator.clipboard.writeText(referralLink).then(() => {
      setReferralLinkCopied(true)
      setTimeout(() => setReferralLinkCopied(false), 2000)
    })
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'contributions', label: `Contributions${commentCount > 0 ? ` (${commentCount})` : ''}` },
    { key: 'research', label: `Research${idea.research.length > 0 ? ` (${idea.research.length})` : ''}` },
    { key: 'amendments', label: 'Amendments' },
    { key: 'team', label: 'Team' },
  ]

  return (
    <>
      {showTakePublicModal && (
        <TakePublicModal
          ideaId={idea.id}
          onClose={() => setShowTakePublicModal(false)}
          onSuccess={handleTakePublicSuccess}
        />
      )}

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Stage stepper */}
        <div className="mb-8 overflow-x-auto pb-1">
          <StageStepper currentStage={idea.stage} />
        </div>

        {/* Header */}
        <div className="mb-6">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}>
              {stageLabel}
            </span>
          </div>

          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {idea.title || 'Untitled idea'}
          </h1>

          {idea.summaryDescription && (
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              {idea.summaryDescription}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              by{' '}
              <Link
                href={`/user/${idea.creator.username}`}
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                {idea.creator.name}
              </Link>
            </span>
            <span>
              {new Date(idea.createdAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
            {idea.creator.credibilityScore?.totalScore && (
              <span>
                Credibility:{' '}
                <strong>{Number(idea.creator.credibilityScore.totalScore).toFixed(0)}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Stage 2 gate card — show to owner only */}
        {idea.stage === 'STAGE_2' && isOwner && (
          <div className="mb-6">
            <Stage2GateCard idea={idea} />
          </div>
        )}

        {/* Referral link — show to owner after Stage 3 */}
        {idea.referralLinkActive && isOwner && (
          <div className="mb-6 rounded-lg border bg-muted/40 p-4">
            <p className="mb-2 text-sm font-medium">Share this idea</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-hidden text-ellipsis rounded bg-background px-2 py-1 text-xs">
                {referralLink}
              </code>
              <Button variant="outline" size="sm" onClick={copyReferralLink}>
                <Copy className="mr-1 size-3" />
                {referralLinkCopied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>
        )}

        {/* Action button — stage-appropriate */}
        {isOwner && idea.stage === 'STAGE_2' && (
          <div className="mb-6">
            <Button
              onClick={() => setShowTakePublicModal(true)}
              disabled={!stage2GateMet}
              variant={stage2GateMet ? 'default' : 'outline'}
            >
              Take Public
            </Button>
            {!stage2GateMet && (
              <p className="mt-1 text-xs text-muted-foreground">
                Complete all requirements above to unlock.
              </p>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="border-b">
          <div className="-mb-px flex gap-0 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={[
                  'whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                  activeTab === tab.key
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Vote widget — Stage 4/5 only */}
        {(idea.stage === 'STAGE_4' || idea.stage === 'STAGE_5') && (
          <div className="mt-6">
            <VoteWidget ideaId={idea.id} currentUserId={currentUserId} />
          </div>
        )}

        <div className="py-6">
          {activeTab === 'overview' && <OverviewTab idea={idea} />}
          {activeTab === 'contributions' && (
            <ContributionsTab
              ideaId={idea.id}
              stage={idea.stage}
              isOwner={isOwner}
              currentUserId={currentUserId}
              onCommentAdded={() => setCommentCount(c => c + 1)}
            />
          )}
          {activeTab === 'research' && (
            <ResearchTab
              ideaId={idea.id}
              stage={idea.stage}
              isOwner={isOwner}
              isCollaborator={isCollaborator}
              currentUserId={currentUserId}
              initialResearch={idea.research}
              onResearchAdded={item =>
                setIdea(prev => ({ ...prev, research: [...prev.research, item] }))
              }
            />
          )}
          {activeTab === 'amendments' && <AmendmentsTab />}
          {activeTab === 'team' && <TeamTab idea={idea} />}
        </div>

        {/* Development History — owner only, Stage 3+ (internal contributions archived from Stage 2) */}
        {isOwner && ['STAGE_3', 'STAGE_4', 'STAGE_5'].includes(idea.stage) && (
          <DevelopmentHistory ideaId={idea.id} />
        )}
      </main>
    </>
  )
}
