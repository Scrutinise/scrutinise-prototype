'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Direction = 'FOR' | 'AGAINST' | 'UNDECIDED'

interface VoteCounts {
  for: number
  against: number
  undecided: number
  total: number
}

interface UserVote {
  direction: Direction
  strength: number
  qualityFlags: string[]
}

export interface VoteWidgetProps {
  ideaId: string
  currentUserId: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STRENGTH_LABELS: Record<number, string> = {
  0:   'No strong view',
  0.5: 'Very slight',
  1:   'Slight',
  1.5: 'Mild',
  2:   'Moderate',
  2.5: 'Moderately strong',
  3:   'Quite strongly',
  3.5: 'Strong',
  4:   'Very strong',
  4.5: 'Extremely strong',
  5:   'Maximum conviction',
}

const QUALITY_FLAGS = [
  "It doesn't go far enough",
  "It goes too far",
  "It's poorly worded",
]

// ─────────────────────────────────────────────────────────────────────────────
// Vote bars
// ─────────────────────────────────────────────────────────────────────────────

function VoteBars({ counts }: { counts: VoteCounts }) {
  const total = counts.total || 1
  const forPct = Math.round((counts.for / total) * 100)
  const againstPct = Math.round((counts.against / total) * 100)
  const undecidedPct = Math.round((counts.undecided / total) * 100)

  return (
    <div className="space-y-2 border-t pt-3">
      {([
        { label: 'For', count: counts.for, pct: forPct, barClass: 'bg-green-500' },
        { label: 'Against', count: counts.against, pct: againstPct, barClass: 'bg-destructive' },
        { label: 'Undecided', count: counts.undecided, pct: undecidedPct, barClass: 'bg-muted-foreground/40' },
      ] as const).map(row => (
        <div key={row.label} className="flex items-center gap-2 text-xs">
          <span className="w-16 shrink-0 text-right text-muted-foreground">{row.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-500 ${row.barClass}`}
              style={{ width: `${row.pct}%` }}
            />
          </div>
          <span className="w-8 text-right tabular-nums text-muted-foreground">{row.count}</span>
        </div>
      ))}
      <p className="pt-1 text-right text-xs text-muted-foreground">
        {counts.total} vote{counts.total !== 1 ? 's' : ''} cast
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main widget
// ─────────────────────────────────────────────────────────────────────────────

export default function VoteWidget({ ideaId, currentUserId }: VoteWidgetProps) {
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState<VoteCounts>({ for: 0, against: 0, undecided: 0, total: 0 })
  const [userVote, setUserVote] = useState<UserVote | null>(null)

  // Form state
  const [selected, setSelected] = useState<Direction | null>(null)
  const [strength, setStrength] = useState(3)
  const [qualityFlags, setQualityFlags] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showChangeForm, setShowChangeForm] = useState(false)

  useEffect(() => {
    fetch(`/api/ideas/${ideaId}/vote`)
      .then(r => r.json())
      .then(data => {
        setCounts(data.counts ?? { for: 0, against: 0, undecided: 0, total: 0 })
        if (data.userVote) {
          setUserVote(data.userVote)
          setSelected(data.userVote.direction)
          setStrength(data.userVote.strength)
          setQualityFlags(data.userVote.qualityFlags ?? [])
        }
      })
      .catch(() => {/* non-critical */})
      .finally(() => setLoading(false))
  }, [ideaId])

  async function handleVote() {
    if (!selected) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: selected, strength, qualityFlags }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        return
      }
      const newVote: UserVote = { direction: data.direction, strength: data.strength, qualityFlags: data.qualityFlags ?? [] }
      setUserVote(newVote)
      setShowChangeForm(false)

      // Update local counts optimistically
      setCounts(prev => {
        const next = { ...prev }
        // Remove old vote from counts
        if (userVote) {
          const old = userVote.direction.toLowerCase() as 'for' | 'against' | 'undecided'
          next[old] = Math.max(0, next[old] - 1)
          next.total = Math.max(0, next.total - 1)
        }
        // Add new vote
        const dir = data.direction.toLowerCase() as 'for' | 'against' | 'undecided'
        next[dir]++
        next.total++
        return next
      })
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  function toggleFlag(flag: string) {
    setQualityFlags(prev =>
      prev.includes(flag) ? prev.filter(f => f !== flag) : [...prev, flag]
    )
  }

  if (loading) {
    return (
      <div className="rounded-xl border p-4">
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }

  // Not signed in — sign-in prompt
  if (!currentUserId) {
    return (
      <div className="rounded-xl border p-4 space-y-3">
        <VoteBars counts={counts} />
        <p className="text-sm text-muted-foreground text-center pt-1">
          <Link href="/sign-in" className="font-medium text-foreground underline underline-offset-2">
            Sign in
          </Link>{' '}
          to cast your vote.
        </p>
      </div>
    )
  }

  // User has voted and is not in "change" mode
  if (userVote && !showChangeForm) {
    const dirLabel = userVote.direction === 'FOR' ? 'For' : userVote.direction === 'AGAINST' ? 'Against' : 'Undecided'
    const dirClass = userVote.direction === 'FOR'
      ? 'text-green-700'
      : userVote.direction === 'AGAINST'
      ? 'text-destructive'
      : 'text-muted-foreground'

    return (
      <div className="rounded-xl border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="text-muted-foreground">Your vote: </span>
            <strong className={dirClass}>{dirLabel}</strong>
            <span className="text-muted-foreground">
              {' '}— {STRENGTH_LABELS[userVote.strength] ?? `${userVote.strength}/5`}
            </span>
          </div>
          <button
            onClick={() => setShowChangeForm(true)}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Change
          </button>
        </div>
        <VoteBars counts={counts} />
      </div>
    )
  }

  // Vote form (new vote or changing existing)
  const directionButtons: { value: Direction; label: string; active: string; inactive: string }[] = [
    {
      value: 'FOR',
      label: 'For',
      active: 'border-green-600 bg-green-50 text-green-800',
      inactive: 'border-border bg-background text-muted-foreground hover:border-green-400',
    },
    {
      value: 'AGAINST',
      label: 'Against',
      active: 'border-destructive bg-red-50 text-red-800',
      inactive: 'border-border bg-background text-muted-foreground hover:border-destructive/50',
    },
    {
      value: 'UNDECIDED',
      label: 'Undecided',
      active: 'border-foreground bg-muted text-foreground',
      inactive: 'border-border bg-background text-muted-foreground hover:border-foreground/40',
    },
  ]

  return (
    <div className="rounded-xl border p-4 space-y-4">
      {/* Direction buttons */}
      <div className="flex gap-2">
        {directionButtons.map(btn => (
          <button
            key={btn.value}
            onClick={() => setSelected(btn.value)}
            className={[
              'flex-1 rounded-lg border-2 py-2.5 text-sm font-medium transition-all',
              selected === btn.value ? btn.active : btn.inactive,
            ].join(' ')}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {selected && (
        <>
          {/* Strength slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">How strongly?</span>
              <span className="font-medium text-foreground">
                {STRENGTH_LABELS[strength] ?? `${strength}/5`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={5}
              step={0.5}
              value={strength}
              onChange={e => setStrength(Number(e.target.value))}
              className="w-full accent-foreground"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>None</span>
              <span>Maximum</span>
            </div>
          </div>

          {/* Quality flags */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Optional feedback (select any that apply):</p>
            <div className="flex flex-col gap-1.5">
              {QUALITY_FLAGS.map(flag => (
                <label key={flag} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={qualityFlags.includes(flag)}
                    onChange={() => toggleFlag(flag)}
                    className="rounded accent-foreground"
                  />
                  {flag}
                </label>
              ))}
            </div>
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            {showChangeForm && (
              <Button variant="outline" size="sm" onClick={() => setShowChangeForm(false)} disabled={submitting}>
                Cancel
              </Button>
            )}
            <Button size="sm" onClick={handleVote} disabled={submitting} className="flex-1">
              {submitting
                ? 'Submitting…'
                : userVote
                ? 'Update vote'
                : 'Submit vote'}
            </Button>
          </div>
        </>
      )}

      <VoteBars counts={counts} />
    </div>
  )
}
