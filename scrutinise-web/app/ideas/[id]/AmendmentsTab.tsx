'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AmendmentAuthor {
  id: string
  name: string
  username: string
}

interface Amendment {
  id: string
  sectionChanged: string
  currentText: string
  proposedText: string
  rationale: string
  changesProposed: string | null
  status: string
  mode: string | null
  rejectionReason: string | null
  revisionGuidance: string | null
  isCounterProposal: boolean
  parentAmendmentId: string | null
  createdAt: string
  author: AmendmentAuthor
  counterProposals: Amendment[]
}

interface Props {
  ideaId: string
  stage: string
  isOwner: boolean
  currentUserId: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  CONSULTING: 'bg-blue-100 text-blue-700',
  REVISION_REQUESTED: 'bg-orange-100 text-orange-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  CONSULTING: 'Consulting',
  REVISION_REQUESTED: 'Revision Requested',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
}

// ─────────────────────────────────────────────────────────────────────────────
// Propose Amendment form
// ─────────────────────────────────────────────────────────────────────────────

function ProposeAmendmentForm({
  ideaId,
  onSuccess,
}: {
  ideaId: string
  onSuccess: (amendment: Amendment) => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    sectionChanged: '',
    currentText: '',
    proposedText: '',
    rationale: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/amendments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Something went wrong')
        return
      }
      onSuccess(data.amendment)
      setForm({ sectionChanged: '', currentText: '', proposedText: '', rationale: '' })
      setOpen(false)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Propose Amendment
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <h3 className="text-sm font-semibold">Propose an Amendment</h3>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Section being changed
        </label>
        <input
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          placeholder="e.g. Guiding Policy, Coherent Action 2…"
          value={form.sectionChanged}
          onChange={e => setForm(f => ({ ...f, sectionChanged: e.target.value }))}
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Current wording (paste from the idea)
        </label>
        <textarea
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          rows={2}
          value={form.currentText}
          onChange={e => setForm(f => ({ ...f, currentText: e.target.value }))}
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Proposed wording
        </label>
        <textarea
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          rows={3}
          value={form.proposedText}
          onChange={e => setForm(f => ({ ...f, proposedText: e.target.value }))}
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Rationale
        </label>
        <textarea
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          rows={2}
          placeholder="Why is this change needed?"
          value={form.rationale}
          onChange={e => setForm(f => ({ ...f, rationale: e.target.value }))}
          required
        />
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? 'Submitting…' : 'Submit Amendment'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(false)}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner action panel
// ─────────────────────────────────────────────────────────────────────────────

type OwnerAction = 'accept' | 'circulate' | 'request_revision' | 'reject' | 'counter' | null

function OwnerActionPanel({
  ideaId,
  amendment,
  onUpdated,
}: {
  ideaId: string
  amendment: Amendment
  onUpdated: (updated: Amendment) => void
}) {
  const [activeAction, setActiveAction] = useState<OwnerAction>(null)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Counter-proposal form state
  const [counterProposed, setCounterProposed] = useState('')
  const [counterRationale, setCounterRationale] = useState('')

  async function handleAction(action: 'accept' | 'circulate' | 'request_revision' | 'reject') {
    setLoading(true)
    setError(null)
    try {
      const body: Record<string, string> = { action }
      if (action === 'request_revision') body.revisionGuidance = text
      if (action === 'reject') body.rejectionReason = text

      const res = await fetch(`/api/ideas/${ideaId}/amendments/${amendment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Something went wrong')
        return
      }
      onUpdated({ ...amendment, ...data.amendment })
      setActiveAction(null)
      setText('')
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  async function handleCounter(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/amendments/${amendment.id}/counter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposedText: counterProposed, rationale: counterRationale }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Something went wrong')
        return
      }
      onUpdated({
        ...amendment,
        counterProposals: [...amendment.counterProposals, data.amendment],
      })
      setActiveAction(null)
      setCounterProposed('')
      setCounterRationale('')
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  if (activeAction === null) {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => handleAction('accept')} disabled={loading}>
          Accept (Binding)
        </Button>
        <Button
          size="sm"
          variant="outline"
          title="Send this amendment out to all those who have voted on your idea so far, for their opinion"
          onClick={() => handleAction('circulate')}
          disabled={loading}
        >
          Consult First
        </Button>
        <Button
          size="sm"
          variant="outline"
          title="Send back to the proposer with your suggestion for a compromise wording"
          onClick={() => setActiveAction('request_revision')}
          disabled={loading}
        >
          Request Revision
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setActiveAction('counter')}
          disabled={loading}
        >
          Counter-Propose
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-red-600 hover:text-red-700"
          onClick={() => setActiveAction('reject')}
          disabled={loading}
        >
          Reject
        </Button>
        {error && <p className="w-full text-xs text-red-600">{error}</p>}
      </div>
    )
  }

  if (activeAction === 'request_revision' || activeAction === 'reject') {
    const label = activeAction === 'request_revision' ? 'Revision guidance' : 'Rejection reason'
    const submitLabel = activeAction === 'request_revision' ? 'Request Revision' : 'Reject'

    return (
      <div className="mt-3 space-y-2">
        <textarea
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          rows={2}
          placeholder={label}
          value={text}
          onChange={e => setText(e.target.value)}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => handleAction(activeAction)}
            disabled={loading || !text.trim()}
          >
            {loading ? 'Saving…' : submitLabel}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setActiveAction(null); setText('') }}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  if (activeAction === 'counter') {
    return (
      <form onSubmit={handleCounter} className="mt-3 space-y-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Your proposed wording
          </label>
          <textarea
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            rows={3}
            value={counterProposed}
            onChange={e => setCounterProposed(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Rationale</label>
          <textarea
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            rows={2}
            value={counterRationale}
            onChange={e => setCounterRationale(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={loading}>
            {loading ? 'Submitting…' : 'Submit Counter-Proposal'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setActiveAction(null)}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </form>
    )
  }

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Single amendment card
// ─────────────────────────────────────────────────────────────────────────────

function AmendmentCard({
  amendment,
  ideaId,
  isOwner,
  onUpdated,
}: {
  amendment: Amendment
  ideaId: string
  isOwner: boolean
  onUpdated: (updated: Amendment) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const statusClass = STATUS_STYLES[amendment.status] ?? 'bg-muted text-muted-foreground'
  const statusLabel = STATUS_LABELS[amendment.status] ?? amendment.status

  return (
    <div className="rounded-lg border">
      <button
        className="flex w-full items-start justify-between gap-3 p-4 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>
              {statusLabel}
            </span>
            <span className="text-xs text-muted-foreground">
              {amendment.sectionChanged}
            </span>
          </div>
          <p className="text-sm font-medium truncate">
            {amendment.proposedText.slice(0, 100)}
            {amendment.proposedText.length > 100 ? '…' : ''}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Proposed by {amendment.author.name} ·{' '}
            {new Date(amendment.createdAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="mt-1 size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Current wording
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">{amendment.currentText}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Proposed wording
            </p>
            <p className="text-sm leading-relaxed">{amendment.proposedText}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Rationale
            </p>
            <p className="text-sm leading-relaxed">{amendment.rationale}</p>
          </div>

          {amendment.rejectionReason && (
            <div className="rounded-md bg-red-50 px-3 py-2">
              <p className="text-xs font-semibold text-red-700">Rejection reason</p>
              <p className="text-sm text-red-700">{amendment.rejectionReason}</p>
            </div>
          )}

          {amendment.revisionGuidance && (
            <div className="rounded-md bg-orange-50 px-3 py-2">
              <p className="text-xs font-semibold text-orange-700">Revision guidance</p>
              <p className="text-sm text-orange-700">{amendment.revisionGuidance}</p>
            </div>
          )}

          {/* Counter-proposals */}
          {amendment.counterProposals.length > 0 && (
            <div className="border-l-2 border-muted pl-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Counter-proposal from owner
              </p>
              {amendment.counterProposals.map(cp => (
                <div key={cp.id} className="rounded-md border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                      Counter-proposal
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[cp.status] ?? 'bg-muted text-muted-foreground'}`}>
                      {STATUS_LABELS[cp.status] ?? cp.status}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed">{cp.proposedText}</p>
                  <p className="text-xs text-muted-foreground">Rationale: {cp.rationale}</p>
                </div>
              ))}
            </div>
          )}

          {/* Owner actions — only on PENDING amendments */}
          {isOwner && amendment.status === 'PENDING' && (
            <OwnerActionPanel
              ideaId={ideaId}
              amendment={amendment}
              onUpdated={onUpdated}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function AmendmentsTab({ ideaId, stage, isOwner, currentUserId }: Props) {
  const [amendments, setAmendments] = useState<Amendment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/ideas/${ideaId}/amendments`)
      .then(r => r.json())
      .then(data => setAmendments(data.amendments ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [ideaId])

  function handleNewAmendment(amendment: Amendment) {
    setAmendments(prev => [amendment, ...prev])
  }

  function handleAmendmentUpdated(updated: Amendment) {
    setAmendments(prev => prev.map(a => (a.id === updated.id ? updated : a)))
  }

  const canPropose =
    !!currentUserId && ['STAGE_3', 'STAGE_4', 'STAGE_5'].includes(stage)

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading amendments…</p>
  }

  return (
    <div className="space-y-4">
      {canPropose && (
        <ProposeAmendmentForm ideaId={ideaId} onSuccess={handleNewAmendment} />
      )}

      {!canPropose && !currentUserId && (
        <p className="text-sm text-muted-foreground">
          Sign in to propose an amendment.
        </p>
      )}

      {amendments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No amendments yet.</p>
      ) : (
        <div className="space-y-3">
          {amendments.map(amendment => (
            <AmendmentCard
              key={amendment.id}
              amendment={amendment}
              ideaId={ideaId}
              isOwner={isOwner}
              onUpdated={handleAmendmentUpdated}
            />
          ))}
        </div>
      )}
    </div>
  )
}
