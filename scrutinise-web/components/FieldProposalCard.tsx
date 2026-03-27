'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type CardState = 'pending' | 'editing' | 'saved' | 'discussed'

interface Props {
  fieldKey: string
  fieldLabel: string
  proposedValue: string
  onAccept: (value: string) => void
  onEdit: (editedValue: string) => void
  onDiscuss: () => void
  autoAcceptSeconds?: number
}

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
  const [editValue, setEditValue] = useState(proposedValue)
  const [countdown, setCountdown] = useState(autoAcceptSeconds)
  const [isPaused, setIsPaused] = useState(false)
  const [savedValue, setSavedValue] = useState(proposedValue)
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

  // ── Auto-accept countdown ───────────────────────────────────────────────

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
  }, [])

  // ── Action handlers (declared before useEffects that reference them) ────

  const handleAccept = useCallback(() => {
    clearCountdown()
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

  // ── Auto-accept countdown ───────────────────────────────────────────────

  useEffect(() => {
    if (state !== 'pending' || isPaused) return

    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearCountdown()
          setState('saved')
          setSavedValue(proposedValue)
          onAccept(proposedValue)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return clearCountdown
  }, [state, isPaused, proposedValue, onAccept, clearCountdown])

  // ── Global keyboard shortcut — Enter accepts, Escape edits ─────────────
  // Only fires when no textarea/input is focused (i.e. no card is mid-edit)

  useEffect(() => {
    if (state !== 'pending') return

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT') return

      if (e.key === 'Enter') {
        e.preventDefault()
        handleAccept()
      } else if (e.key === 'Escape') {
        clearCountdown()
        setState('editing')
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [state, handleAccept, clearCountdown])

  // ── Keyboard shortcuts (when card div is focused) ────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (state !== 'pending') return
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAccept()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      clearCountdown()
      setState('editing')
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      handleDiscuss()
    }
  }

  // ── Touch / swipe ───────────────────────────────────────────────────────

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    setIsPaused(true)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (state !== 'pending') return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    const isHorizontal = Math.abs(dx) > Math.abs(dy)

    if (isHorizontal && Math.abs(dx) >= 80) {
      if (dx > 0) {
        // Swipe right → Accept
        handleAccept()
      } else {
        // Swipe left → Edit
        clearCountdown()
        setState('editing')
      }
    } else {
      // Not a swipe — resume countdown
      setIsPaused(false)
    }
  }

  const handleSaveEdit = () => {
    clearCountdown()
    setState('saved')
    setSavedValue(editValue)
    onEdit(editValue)
  }

  const handleDiscuss = () => {
    clearCountdown()
    setState('discussed')
    onDiscuss()
  }

  const handleCancelEdit = () => {
    setState('pending')
    setEditValue(proposedValue)
    setCountdown(autoAcceptSeconds)
  }

  // ── Saved state ─────────────────────────────────────────────────────────

  if (state === 'saved') {
    return (
      <div
        className="flex items-center gap-2 py-1.5 px-3 my-1 rounded-lg text-xs"
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

  // ── Editing state ───────────────────────────────────────────────────────

  if (state === 'editing') {
    return (
      <div
        className="rounded-xl border-l-[3px] bg-[#f0fafa] border-[#2da8a8] p-4 my-3"
        style={{ borderLeftColor: '#2da8a8', backgroundColor: '#f0fafa' }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-2">
          {fieldLabel}
        </p>
        <textarea
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          rows={3}
          className="w-full text-sm text-zinc-800 bg-white border border-zinc-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#2da8a8]/40"
          autoFocus
        />
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleSaveEdit}
            className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Save edit
          </button>
          <button
            onClick={handleCancelEdit}
            className="px-4 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // ── Pending state (default) ─────────────────────────────────────────────

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
      className="rounded-xl border-l-[3px] bg-[#f0fafa] p-4 my-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2da8a8]/50 cursor-default select-none"
      style={{ borderLeftColor: '#2da8a8', backgroundColor: '#f0fafa' }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-2">
        {fieldLabel}
      </p>
      <p className="text-sm text-zinc-800 leading-relaxed">
        {proposedValue}
      </p>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <button
          onClick={handleAccept}
          className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 transition-colors"
        >
          ✓ Accept
        </button>
        <button
          onClick={() => { clearCountdown(); setState('editing') }}
          className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
        >
          ✎ Edit
        </button>
        <button
          onClick={handleDiscuss}
          className="px-4 py-2 text-sm font-medium text-zinc-500 rounded-lg hover:bg-zinc-100 transition-colors"
        >
          ↩ Discuss
        </button>
        {!isPaused && countdown < autoAcceptSeconds && (
          <span className="text-xs text-zinc-400 ml-auto">
            Auto-saving in {countdown}s
          </span>
        )}
      </div>
      {showSwipeHint && (
        <p className="lg:hidden mt-2 text-xs text-zinc-400 text-center select-none">
          ← Swipe to edit&nbsp;&nbsp;|&nbsp;&nbsp;Swipe to accept →
        </p>
      )}
    </div>
  )
}
