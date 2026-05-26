'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type CardState = 'pending' | 'saved' | 'discussed'

interface LegislationCandidate {
  actTitle: string
  sectionNumber?: string
  sectionTitle?: string
  legislationGovUkId?: string
}

interface InitialThoughtsOption {
  id: number
  routeType: string
  summary: string
}

interface Props {
  fieldKey: string
  fieldLabel: string
  proposedValue: string
  /** Called with the proposedValue when user accepts (swipe right or Accept button) */
  onAccept: (value: string) => void
  /** Called with the proposedValue when user wants to edit (swipe left or Edit button).
   *  Parent should copy this value into the chat input and close the card. */
  onEdit: (proposedValue: string) => void
  onDiscuss: () => void
  autoAcceptSeconds?: number
}

// Swipe detection constants
const SWIPE_HORIZONTAL_THRESHOLD = 50
const SWIPE_DIRECTION_RATIO = 2.5

const ROUTE_TYPE_LABELS: Record<string, string> = {
  legislation: 'Changing legislation',
  enforcement: 'Changing enforcement',
  organisational: 'Changing organisational practice',
  funding: 'Raising money',
}

// ─────────────────────────────────────────────────────────────────────────────
// FieldProposalCard
// ─────────────────────────────────────────────────────────────────────────────

export default function FieldProposalCard({
  fieldKey,
  fieldLabel,
  proposedValue,
  onAccept,
  onEdit,
  onDiscuss,
  autoAcceptSeconds = 30,
}: Props) {
  const isComplex = fieldKey === 'ideaLegislation' || fieldKey === 'initialThoughts'

  const [state, setState] = useState<CardState>('pending')
  const [countdown, setCountdown] = useState(autoAcceptSeconds)
  const [isPaused, setIsPaused] = useState(false)
  const [savedValue, setSavedValue] = useState(proposedValue)
  const [isPulsing, setIsPulsing] = useState(false)
  const [showSwipeHint, setShowSwipeHint] = useState(false)

  // Parsed values for complex fields (stable across renders)
  const legCandidates = useMemo<LegislationCandidate[]>(() => {
    if (fieldKey !== 'ideaLegislation') return []
    try {
      const parsed = JSON.parse(proposedValue)
      return Array.isArray(parsed) ? parsed : []
    } catch { return [] }
  }, [fieldKey, proposedValue])

  const thoughtsData = useMemo<{ options: InitialThoughtsOption[]; chosen: number[] }>(() => {
    if (fieldKey !== 'initialThoughts') return { options: [], chosen: [] }
    try {
      const parsed = JSON.parse(proposedValue)
      if (parsed && Array.isArray(parsed.options)) {
        return { options: parsed.options, chosen: Array.isArray(parsed.chosen) ? parsed.chosen : [] }
      }
    } catch { /* ignore */ }
    return { options: [], chosen: [] }
  }, [fieldKey, proposedValue])

  // Opt-in not opt-out: FTS candidates are keyword-matched and may be wrong (v6.0 §7); the user's tick is the verification step.
  const [selectedLeg, setSelectedLeg] = useState<Set<string>>(() => new Set())

  // Option selection state for initialThoughts — nothing pre-selected
  const [selectedThoughts, setSelectedThoughts] = useState<Set<number>>(new Set())

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number>(0)
  const touchStartY = useRef<number>(0)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const seen = localStorage.getItem('hasSeenSwipeHint')
      if (!seen) setShowSwipeHint(true)
    }
  }, [])

  // ── Countdown helpers ───────────────────────────────────────────────────

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
  }, [])

  // ── Accept handlers ──────────────────────────────────────────────────────

  const handleAccept = useCallback(() => {
    clearCountdown()
    setIsPulsing(true)
    setState('saved')
    setSavedValue(proposedValue)
    onAccept(proposedValue)
    if (typeof window !== 'undefined' && !localStorage.getItem('hasSeenSwipeHint')) {
      localStorage.setItem('hasSeenSwipeHint', '1')
      setShowSwipeHint(false)
    }
    window.dispatchEvent(new CustomEvent('lex-field-accepted'))
  }, [clearCountdown, proposedValue, onAccept])

  const handleAcceptLegislation = useCallback(() => {
    const selected = legCandidates.filter(
      c => c.legislationGovUkId && selectedLeg.has(c.legislationGovUkId)
    )
    clearCountdown()
    setIsPulsing(true)
    setState('saved')
    setSavedValue(`${selected.length} legislation item${selected.length !== 1 ? 's' : ''} saved`)
    onAccept(JSON.stringify(selected))
    window.dispatchEvent(new CustomEvent('lex-field-accepted'))
  }, [clearCountdown, legCandidates, selectedLeg, onAccept])

  // Skip handler for legislation field when no candidates found — advances without writing any rows
  const handleSkipLegislation = useCallback(() => {
    clearCountdown()
    setIsPulsing(true)
    setState('saved')
    setSavedValue('Skipped — can be added later')
    onAccept('[]')
    window.dispatchEvent(new CustomEvent('lex-field-accepted'))
  }, [clearCountdown, onAccept])

  const handleAcceptThoughts = useCallback(() => {
    const updated = { ...thoughtsData, chosen: Array.from(selectedThoughts) }
    clearCountdown()
    setIsPulsing(true)
    setState('saved')
    const n = selectedThoughts.size
    setSavedValue(`${n} route${n !== 1 ? 's' : ''} selected`)
    onAccept(JSON.stringify(updated))
    window.dispatchEvent(new CustomEvent('lex-field-accepted'))
  }, [clearCountdown, thoughtsData, selectedThoughts, onAccept])

  // ── Edit / Discuss handlers ──────────────────────────────────────────────

  const handleEdit = useCallback(() => {
    clearCountdown()
    setState('discussed')
    onEdit(proposedValue)
  }, [clearCountdown, proposedValue, onEdit])

  const handleDiscuss = useCallback(() => {
    clearCountdown()
    setState('discussed')
    onDiscuss()
  }, [clearCountdown, onDiscuss])

  // ── Auto-accept countdown — disabled for complex fields ─────────────────

  useEffect(() => {
    if (isComplex || state !== 'pending' || isPaused) return

    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearCountdown()
          handleAccept()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return clearCountdown
  }, [isComplex, state, isPaused, handleAccept, clearCountdown])

  // ── Global keyboard shortcut — Enter accepts, Escape edits (standard only) ─

  useEffect(() => {
    if (state !== 'pending' || isComplex) return

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT') return

      if (e.key === 'Enter') {
        e.preventDefault()
        handleAccept()
      } else if (e.key === 'Escape') {
        handleEdit()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [state, isComplex, handleAccept, handleEdit])

  // ── Card keyboard shortcuts ──────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (state !== 'pending' || isComplex) return
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAccept()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleEdit()
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      handleDiscuss()
    }
  }

  // ── Touch / swipe (standard fields only) ─────────────────────────────────

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    setIsPaused(true)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (state !== 'pending' || isComplex) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    if (absDx > SWIPE_HORIZONTAL_THRESHOLD && absDx > absDy * SWIPE_DIRECTION_RATIO) {
      if (dx > 0) handleAccept()
      else handleEdit()
    } else {
      setIsPaused(false)
    }
  }

  // ── Saved state ─────────────────────────────────────────────────────────

  if (state === 'saved') {
    return (
      <div
        className={`flex items-center gap-2 py-1.5 px-3 my-1 rounded-lg text-xs ${isPulsing ? 'proposal-pulse-animation' : ''}`}
        style={{ backgroundColor: '#f0fafa', borderLeft: '2px solid #2da8a8' }}
      >
        <span
          className="shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center"
          style={{ backgroundColor: '#2da8a8' }}
        >
          <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <span className="font-semibold uppercase tracking-wide text-zinc-400 shrink-0">
          {fieldLabel}
        </span>
        <span className="text-zinc-600 truncate">{savedValue}</span>
      </div>
    )
  }

  // ── Discussed state ─────────────────────────────────────────────────────

  if (state === 'discussed') {
    return null
  }

  // ── Complex field: ideaLegislation ──────────────────────────────────────

  if (fieldKey === 'ideaLegislation') {
    const hasNoCandidates = legCandidates.length === 0

    return (
      <div className="rounded-lg border-l-4 border-teal-500 bg-teal-50 dark:bg-teal-950/30 p-4 my-3">
        <p className="text-sm font-medium text-teal-800 dark:text-teal-200 mb-3">
          {hasNoCandidates
            ? 'No legislation found for this idea — you can skip for now or tell Lex a specific Act to search for:'
            : 'Proposed legislation references — uncheck any to exclude:'}
        </p>
        <div className="space-y-2 mb-4">
          {legCandidates.map((c, i) => (
            <label
              key={c.legislationGovUkId ?? i}
              className="flex items-start gap-2.5 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={!!(c.legislationGovUkId && selectedLeg.has(c.legislationGovUkId))}
                onChange={() => {
                  if (!c.legislationGovUkId) return
                  setSelectedLeg(prev => {
                    const next = new Set(prev)
                    if (next.has(c.legislationGovUkId!)) next.delete(c.legislationGovUkId!)
                    else next.add(c.legislationGovUkId!)
                    return next
                  })
                }}
                className="mt-0.5 accent-teal-600"
              />
              <span className="text-sm text-gray-800 dark:text-gray-200">
                <span className="font-medium">{c.actTitle}</span>
                {c.sectionNumber && (
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {' — '}s.{c.sectionNumber}{c.sectionTitle ? `: ${c.sectionTitle}` : ''}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {!hasNoCandidates && (
            <button
              onClick={handleEdit}
              className="text-xs px-3 py-1.5 rounded border border-teal-400 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900 transition-colors"
            >
              Edit
            </button>
          )}
          {hasNoCandidates ? (
            <button
              onClick={handleSkipLegislation}
              className="text-xs px-3 py-1.5 rounded bg-teal-600 text-white hover:bg-teal-700 transition-colors"
            >
              Skip for now →
            </button>
          ) : (
            <button
              onClick={handleAcceptLegislation}
              disabled={selectedLeg.size === 0}
              className="text-xs px-3 py-1.5 rounded bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Accept{selectedLeg.size > 0 ? ` (${selectedLeg.size})` : ''}
            </button>
          )}
          <button
            onClick={handleDiscuss}
            className="text-xs text-zinc-500 hover:text-zinc-700 ml-auto transition-colors"
          >
            Discuss instead
          </button>
        </div>
      </div>
    )
  }

  // ── Complex field: initialThoughts ──────────────────────────────────────

  if (fieldKey === 'initialThoughts') {
    return (
      <div className="rounded-lg border-l-4 border-teal-500 bg-teal-50 dark:bg-teal-950/30 p-4 my-3">
        <p className="text-sm font-medium text-teal-800 dark:text-teal-200 mb-3">
          Choose a route forward — select any that interest you:
        </p>
        <div className="space-y-2 mb-4">
          {thoughtsData.options.length === 0 && (
            <p className="text-sm text-zinc-500">No routes proposed.</p>
          )}
          {thoughtsData.options.map(opt => {
            const isSelected = selectedThoughts.has(opt.id)
            return (
              <button
                key={opt.id}
                onClick={() =>
                  setSelectedThoughts(prev => {
                    const next = new Set(prev)
                    if (next.has(opt.id)) next.delete(opt.id)
                    else next.add(opt.id)
                    return next
                  })
                }
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  isSelected
                    ? 'border-teal-500 bg-teal-100 dark:bg-teal-900/50'
                    : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-teal-300 dark:hover:border-teal-600'
                }`}
              >
                <span className="inline-block text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300 mb-1">
                  {ROUTE_TYPE_LABELS[opt.routeType] ?? opt.routeType}
                </span>
                <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">{opt.summary}</p>
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleEdit}
            className="text-xs px-3 py-1.5 rounded border border-teal-400 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={handleAcceptThoughts}
            disabled={selectedThoughts.size === 0}
            className="text-xs px-3 py-1.5 rounded bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Accept{selectedThoughts.size > 0
              ? ` (${selectedThoughts.size} route${selectedThoughts.size > 1 ? 's' : ''})`
              : ''}
          </button>
          <button
            onClick={handleDiscuss}
            className="text-xs text-zinc-500 hover:text-zinc-700 ml-auto transition-colors"
          >
            Discuss instead
          </button>
        </div>
      </div>
    )
  }

  // ── Standard pending state ───────────────────────────────────────────────

  return (
    <div
      ref={cardRef}
      tabIndex={0}
      role="region"
      aria-label={`Proposal for ${fieldLabel}`}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => { if (state === 'pending') setIsPaused(false) }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="rounded-lg border-l-4 border-teal-500 bg-teal-50 dark:bg-teal-950/30 p-4 my-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50 cursor-default select-none"
    >
      <p className="text-sm font-medium text-teal-800 dark:text-teal-200 mb-1">
        Proposed answer:
      </p>
      <p className="text-sm text-gray-800 dark:text-gray-200 mb-3 leading-relaxed">
        {proposedValue}
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleEdit}
          className="text-xs px-3 py-1.5 rounded border border-teal-400 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900 transition-colors"
        >
          Edit
        </button>
        <span className="text-xs text-muted-foreground hidden sm:inline">or swipe left</span>
        <button
          onClick={handleAccept}
          className="text-xs px-3 py-1.5 rounded bg-teal-600 text-white hover:bg-teal-700 transition-colors"
        >
          Accept
        </button>
        <span className="text-xs text-muted-foreground hidden sm:inline">or swipe right</span>
        <button
          onClick={handleDiscuss}
          className="text-xs text-zinc-500 hover:text-zinc-700 ml-auto transition-colors"
        >
          Discuss instead
        </button>
        {!isPaused && countdown < autoAcceptSeconds && (
          <span className="text-xs text-zinc-400">
            Auto-saving in {countdown}s
          </span>
        )}
      </div>
      {showSwipeHint && (
        <p className="lg:hidden mt-2 text-xs text-teal-600 text-center select-none">
          ← Swipe to edit&nbsp;&nbsp;|&nbsp;&nbsp;Swipe to accept →
        </p>
      )}
    </div>
  )
}
