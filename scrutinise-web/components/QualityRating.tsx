'use client'

import { useState } from 'react'
import { ThumbsUp } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// QualityRating
// Shared 1–5 quality rating component.
// Idle: thumbs-up icon (muted if unrated, filled if rated) + average beside it.
// Expanded: 1–5 slider with labelMin / labelMax + promptText.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  /** Current authenticated user's rating, or null if not yet rated */
  rating: number | null
  /** Average rating to display beside the icon */
  avgRating: number | null
  /** Called with the chosen 1–5 value when the user submits */
  onRate: (value: number) => Promise<void>
  labelMin?: string
  labelMax?: string
  promptText?: string
  size?: 'sm' | 'md'
}

export default function QualityRating({
  rating,
  avgRating,
  onRate,
  labelMin = 'Low quality',
  labelMax = 'High quality',
  promptText,
  size = 'sm',
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [localValue, setLocalValue] = useState<number>(rating ?? 3)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(rating != null)

  const iconSize = size === 'sm' ? 'size-4' : 'size-5'

  async function handleSubmit(value: number) {
    setSubmitting(true)
    try {
      await onRate(value)
      setSubmitted(true)
      setExpanded(false)
    } finally {
      setSubmitting(false)
    }
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        title={submitted ? `Your rating: ${rating}/5 — click to change` : 'Rate quality'}
      >
        <ThumbsUp
          className={[
            iconSize,
            submitted ? 'fill-foreground text-foreground' : 'text-muted-foreground/50',
          ].join(' ')}
        />
        {avgRating != null && (
          <span className="tabular-nums">{avgRating.toFixed(1)}</span>
        )}
      </button>
    )
  }

  return (
    <div className="rounded-lg border bg-background p-3 shadow-sm space-y-3 min-w-[220px]">
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{labelMin}</span>
          <span>{labelMax}</span>
        </div>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={localValue}
          onChange={e => setLocalValue(Number(e.target.value))}
          onMouseUp={e => handleSubmit(Number((e.target as HTMLInputElement).value))}
          onTouchEnd={e => handleSubmit(Number((e.target as HTMLInputElement).value))}
          className="w-full accent-foreground cursor-pointer"
          disabled={submitting}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
          {[1, 2, 3, 4, 5].map(n => (
            <span key={n} className={localValue === n ? 'font-semibold text-foreground' : ''}>
              {n}
            </span>
          ))}
        </div>
      </div>
      {promptText && (
        <p className="text-[11px] text-muted-foreground leading-snug">{promptText}</p>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleSubmit(localValue)}
          disabled={submitting}
          className="rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background hover:opacity-80 disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Confirm'}
        </button>
        <button
          onClick={() => setExpanded(false)}
          disabled={submitting}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
