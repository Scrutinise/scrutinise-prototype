'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type CardState = 'pending' | 'saved' | 'discussed'

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
const SWIPE_HORIZONTAL_THRESHOLD = 50   // minimum horizontal pixels
const SWIPE_DIRECTION_RATIO = 2.5       // horizontal must be 2.5× the vertical

// ─────────────────────────────────────────────────────────────────────────────
// FieldProposalCard
// ─────────────────────────────────────────────────────────────────────────────

export default function FieldProposalCard({
  fieldLabel,
  proposedValue,
  onAccept,
  onEdit,
  onDiscuss,
  autoAcceptSeconds = 30,
}: Props) {
  const [state, setState] = useState<CardState>('pending')
  const [countdown, setCountdown] = useState(autoAcceptSeconds)
  const [isPaused, setIsPaused] = useState(false)
  const [savedValue, setSavedValue] = useState(proposedValue)
  const [isPulsing, setIsPulsing] = useState(false)
  const [showSwipeHint, setShowSwipeHint] = useState(false)

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number>(0)
  const touchStartY = useRef<number>(0)

  // Show swipe hint on mobile only if not yet dismissed
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

  // ── Accept handler ───────────────────────────────────────────────────────

  const handleAccept = useCallback(() => {
    clearCountdown()
    setIsPulsing(true)
    setState('saved')
    setSavedValue(proposedValue)
    onAccept(proposedValue)
    // Dismiss swipe hint after first acceptance
    if (typeof window !== 'undefined' && !localStorage.getItem('hasSeenSwipeHint')) {
      localStorage.setItem('hasSeenSwipeHint', '1')
      setShowSwipeHint(false)
    }
    // Signal the chat input to refocus after card acceptance
    window.dispatchEvent(new CustomEvent('lex-field-accepted'))
  }, [clearCountdown, proposedValue, onAccept])

  // ── Edit handler — copies text to chat input, dismisses card ────────────

  const handleEdit = useCallback(() => {
    clearCountdown()
    setState('discussed')
    onEdit(proposedValue)
  }, [clearCountdown, proposedValue, onEdit])

  // ── Discuss handler ───────────────────────────────────────────────────────

  const handleDiscuss = useCallback(() => {
    clearCountdown()
    setState('discussed')
    onDiscuss()
  }, [clearCountdown, onDiscuss])

  // ── Auto-accept countdown ───────────────────────────────────────────────

  useEffect(() => {
    if (state !== 'pending' || isPaused) return

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
  }, [state, isPaused, handleAccept, clearCountdown])

  // ── Global keyboard shortcut — Enter accepts, Escape edits ──────────────

  useEffect(() => {
    if (state !== 'pending') return

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
  }, [state, handleAccept, handleEdit])

  // ── Card keyboard shortcuts ──────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (state !== 'pending') return
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

  // ── Touch / swipe — improved threshold to avoid scroll conflicts ─────────

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    setIsPaused(true)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (state !== 'pending') return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    // Only register as a swipe if horizontal movement dominates
    if (absDx > SWIPE_HORIZONTAL_THRESHOLD && absDx > absDy * SWIPE_DIRECTION_RATIO) {
      if (dx > 0) {
        // Swipe right → Accept
        handleAccept()
      } else {
        // Swipe left → Edit (copy to input)
        handleEdit()
      }
    } else {
      // Not a directional swipe — resume countdown
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

  // ── Pending state ───────────────────────────────────────────────────────

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
