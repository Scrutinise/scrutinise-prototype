'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import QualityRating from '@/components/QualityRating'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Reply {
  id: string
  content: string
  createdAt: string
  author: { id: string; name: string; username: string }
}

interface Contribution {
  id: string
  commentNumber: number | null
  contributionType: string | null
  stance: string
  content: string
  isInternal: boolean
  qualityRating: number | null
  createdAt: string
  author: {
    id: string
    name: string
    username: string
    credibilityScore: { totalScore: string | null } | null
  }
  replies: Reply[]
}

interface Props {
  ideaId: string
  stage: string
  isOwner: boolean
  currentUserId: string | null
  onCommentAdded: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Label maps
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  NEW_INFORMATION: 'New information',
  RED_TEAM_CHALLENGE: 'Red team challenge',
  MINOR_ADJUSTMENT: 'Minor adjustment',
  ADDITIONAL_COHERENT_ACTION: 'New coherent action',
  AMENDMENT: 'Amendment',
  OTHER: 'Other',
}

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

const CONTRIBUTION_TYPES = [
  { value: 'NEW_INFORMATION', label: 'New information' },
  { value: 'RED_TEAM_CHALLENGE', label: 'Red team challenge' },
  { value: 'MINOR_ADJUSTMENT', label: 'Minor adjustment' },
  { value: 'ADDITIONAL_COHERENT_ACTION', label: 'New coherent action' },
  { value: 'AMENDMENT', label: 'Amendment' },
  { value: 'OTHER', label: 'Other' },
]

const STANCES = [
  { value: 'SUPPORTIVE', label: 'Supportive' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'NEUTRAL', label: 'Neutral' },
  { value: 'QUESTION', label: 'Question' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Reply form (owner only)
// ─────────────────────────────────────────────────────────────────────────────

function ReplyForm({
  ideaId,
  commentId,
  onReplied,
  onCancel,
}: {
  ideaId: string
  commentId: string
  onReplied: (reply: Reply) => void
  onCancel: () => void
}) {
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!content.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/contributions/${commentId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        return
      }
      onReplied(data)
      setContent('')
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="ml-8 mt-3 space-y-2 border-l-2 border-muted pl-4">
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Write your reply…"
        rows={3}
        maxLength={5000}
        className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={submitting || !content.trim()}>
          {submitting ? 'Posting…' : 'Post reply'}
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Contribution card
// ─────────────────────────────────────────────────────────────────────────────

function ContributionCard({
  contribution,
  ideaId,
  isOwner,
  currentUserId,
}: {
  contribution: Contribution
  ideaId: string
  isOwner: boolean
  currentUserId: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)
  const [localReplies, setLocalReplies] = useState<Reply[]>(contribution.replies)
  const [avgRating, setAvgRating] = useState<number | null>(contribution.qualityRating)
  const [userRating, setUserRating] = useState<number | null>(null)

  async function handleRate(value: number) {
    const res = await fetch(`/api/ideas/${ideaId}/contributions/${contribution.id}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qualityRating: value }),
    })
    if (res.ok) {
      const data = await res.json()
      setUserRating(value)
      setAvgRating(data.avgRating)
    }
  }

  const isLong = contribution.content.length > 200
  const displayContent = expanded || !isLong
    ? contribution.content
    : contribution.content.slice(0, 200) + '…'

  const typeLabel = TYPE_LABELS[contribution.contributionType ?? 'OTHER'] ?? 'Other'
  const stanceStyle = STANCE_STYLES[contribution.stance] ?? 'bg-muted text-muted-foreground'
  const stanceLabel = STANCE_LABELS[contribution.stance] ?? contribution.stance

  const credScore = contribution.author.credibilityScore?.totalScore
    ? Math.round(Number(contribution.author.credibilityScore.totalScore))
    : null

  return (
    <Card>
      <CardContent className="pt-4">
        {/* Header row */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {contribution.commentNumber != null && (
            <span className="font-mono text-xs font-semibold text-muted-foreground">
              #{contribution.commentNumber}
            </span>
          )}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {typeLabel}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stanceStyle}`}>
            {stanceLabel}
          </span>
          {contribution.isInternal && (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
              Internal
            </span>
          )}
        </div>

        {/* Content */}
        <p className="text-sm leading-relaxed">
          {displayContent}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="mt-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}

        {/* Footer */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link
              href={`/user/${contribution.author.username}`}
              className="font-medium text-foreground hover:underline underline-offset-2"
            >
              {contribution.author.name}
            </Link>
            {credScore !== null && (
              <span>· Credibility {credScore}</span>
            )}
            <span>·</span>
            <span>
              {new Date(contribution.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {currentUserId && (
              <QualityRating
                rating={userRating}
                avgRating={avgRating}
                onRate={handleRate}
                labelMin="Unhelpful"
                labelMax="Helpful"
                promptText="This rating is for the quality of the contribution — is it helpful to the quality of the idea? Use the vote if you want to support or oppose the idea or its consequences"
              />
            )}
            {isOwner && !replyOpen && localReplies.length === 0 && (
              <button
                onClick={() => setReplyOpen(true)}
                className="font-medium text-foreground underline underline-offset-2 hover:text-muted-foreground"
              >
                Reply
              </button>
            )}
          </div>
        </div>

        {/* Owner replies */}
        {localReplies.length > 0 && (
          <div className="ml-6 mt-3 space-y-3 border-l-2 border-muted pl-4">
            {localReplies.map(reply => (
              <div key={reply.id}>
                <p className="text-sm leading-relaxed">{reply.content}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{reply.author.name}</span>
                  {' '}· Owner reply ·{' '}
                  {new Date(reply.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </p>
              </div>
            ))}
            {isOwner && !replyOpen && (
              <button
                onClick={() => setReplyOpen(true)}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Reply again
              </button>
            )}
          </div>
        )}

        {/* Reply form */}
        {replyOpen && (
          <ReplyForm
            ideaId={ideaId}
            commentId={contribution.id}
            onReplied={reply => {
              setLocalReplies(prev => [...prev, reply])
              setReplyOpen(false)
            }}
            onCancel={() => setReplyOpen(false)}
          />
        )}
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Contribution form
// ─────────────────────────────────────────────────────────────────────────────

function ContributionForm({
  ideaId,
  onSubmitted,
}: {
  ideaId: string
  onSubmitted: (contribution: Contribution) => void
}) {
  const [content, setContent] = useState('')
  const [contributionType, setContributionType] = useState('NEW_INFORMATION')
  const [stance, setStance] = useState('SUPPORTIVE')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!content.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/contributions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, contributionType, stance }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        return
      }
      onSubmitted(data)
      setContent('')
      setContributionType('NEW_INFORMATION')
      setStance('SUPPORTIVE')
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <h3 className="text-sm font-semibold">Leave a Contribution</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Type
          </label>
          <select
            value={contributionType}
            onChange={e => setContributionType(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {CONTRIBUTION_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Stance
          </label>
          <select
            value={stance}
            onChange={e => setStance(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {STANCES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Your contribution
        </label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Share your research, challenge an assumption, propose a tweak…"
          rows={5}
          maxLength={5000}
          className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="mt-0.5 text-right text-xs text-muted-foreground">
          {content.length}/5000
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <Button
        onClick={handleSubmit}
        disabled={submitting || !content.trim()}
        size="sm"
      >
        {submitting ? 'Submitting…' : 'Submit Contribution'}
      </Button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main tab component
// ─────────────────────────────────────────────────────────────────────────────

const PUBLIC_STAGES = ['STAGE_3', 'STAGE_4', 'STAGE_5']
const ALLOWED_STAGES = ['STAGE_2', 'STAGE_3', 'STAGE_4', 'STAGE_5']
const PAGE_SIZE = 10

export default function ContributionsTab({
  ideaId,
  stage,
  isOwner,
  currentUserId,
  onCommentAdded,
}: Props) {
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const isStage2 = stage === 'STAGE_2'
  // At Stage 2, only owner/collaborators can contribute (canAdd passed from parent via currentUserId
  // + the API enforces the collaborator gate)
  const canContribute = !!currentUserId && ALLOWED_STAGES.includes(stage)

  // Fetch contributions when this tab is first rendered
  useEffect(() => {
    if (loaded || !ALLOWED_STAGES.includes(stage)) return
    setLoading(true)
    fetch(`/api/ideas/${ideaId}/contributions`)
      .then(r => r.json())
      .then(data => {
        setContributions(data.contributions ?? [])
        setLoaded(true)
      })
      .catch(() => setFetchError('Failed to load contributions'))
      .finally(() => setLoading(false))
  }, [ideaId, stage, loaded])

  if (!ALLOWED_STAGES.includes(stage)) {
    return (
      <p className="text-sm text-muted-foreground">
        Contributions open at the Draft stage.
      </p>
    )
  }

  // At Stage 3+, public tab shows only non-internal contributions
  const visiblePool = PUBLIC_STAGES.includes(stage)
    ? contributions.filter(c => !c.isInternal)
    : contributions

  const visibleContributions = showAll ? visiblePool : visiblePool.slice(0, PAGE_SIZE)

  return (
    <div className="space-y-4">
      {/* Form toggle */}
      {canContribute && !showForm && (
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
          Leave a Contribution
        </Button>
      )}

      {!currentUserId && PUBLIC_STAGES.includes(stage) && (
        <p className="text-sm text-muted-foreground">
          <Link href="/sign-in" className="font-medium text-foreground underline underline-offset-2">
            Sign in
          </Link>{' '}
          to leave a Contribution.
        </p>
      )}

      {showForm && currentUserId && (
        <ContributionForm
          ideaId={ideaId}
          onSubmitted={contribution => {
            setContributions(prev => [...prev, contribution])
            setShowForm(false)
            onCommentAdded()
          }}
        />
      )}

      {/* List */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      )}

      {!loading && fetchError && (
        <p className="text-sm text-destructive">{fetchError}</p>
      )}

      {!loading && loaded && visiblePool.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No Contributions yet. Be the first to contribute.
        </p>
      )}

      {visibleContributions.map(c => (
        <ContributionCard
          key={c.id}
          contribution={c}
          ideaId={ideaId}
          isOwner={isOwner}
          currentUserId={currentUserId}
        />
      ))}

      {visiblePool.length > PAGE_SIZE && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Show all {visiblePool.length} contributions
        </button>
      )}
    </div>
  )
}
