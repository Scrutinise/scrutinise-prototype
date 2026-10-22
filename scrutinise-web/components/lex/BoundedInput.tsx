'use client'

// 26-S browser pass — a text box that SHOWS its limit, COUNTS what is left, STOPS at the limit, and SAYS when it cut something.
// ⚠ Never a bare `maxLength`: a browser cuts a paste without a word, which is how a long reason looked "not saved".
// The counter is a WORD ("12 left", "limit reached (600)") beside the box — never a colour alone (docs/CLAUDE.md §21).

import { useState } from 'react'
import { clampToLimit, remainingWords } from '@/lib/lex/input-limits'

interface Props {
  value: string
  onChange: (v: string) => void
  max: number
  placeholder?: string
  className?: string
  'aria-label'?: string
  multiline?: boolean
  rows?: number
  onBlur?: () => void
  onEnter?: () => void
  disabled?: boolean
  autoFocus?: boolean
  /** Classes for the wrapper that holds the box and its counter (e.g. `w-full`). */
  wrapperClassName?: string
  /** Hide the "N left" until the user has typed this fraction of the limit. 0 = always show. */
  showFrom?: number
}

export default function BoundedInput({ value, onChange, max, placeholder, className, multiline, rows, onBlur, onEnter, disabled, autoFocus, wrapperClassName, showFrom = 0, ...rest }: Props) {
  const [cutNote, setCutNote] = useState('')
  // ⚠⚠ 26-U §2 (decision 227) — EDITING NEVER TRUNCATES. Clamping every change cut an over-limit statement (#38, 3,196 characters) to its
  // first 1,000 the moment one word was deleted: 90% gone, no undo but Cancel. Text already in the box is never removed by the box; a box
  // already over its limit takes any edit that shortens it and refuses one that lengthens it, and its Save refuses (the caller's job), with
  // the text intact. Only NEW text typed or pasted into a box within its limit stops at the limit, said in words (decision 168).
  const set = (raw: string) => {
    if (raw.length <= max) { setCutNote(''); onChange(raw); return }
    if (value.length > max) {
      if (raw.length <= value.length) { setCutNote(''); onChange(raw); return }
      setCutNote(`Not added — this is already over the limit of ${max}; shorten it first.`)
      return
    }
    const c = clampToLimit(raw, max)
    setCutNote(c.note)
    onChange(c.text)
  }
  const over = value.length > max
  const show = over || value.length >= Math.floor(max * showFrom)
  const common = {
    value, placeholder, disabled, onBlur, autoFocus, 'aria-label': rest['aria-label'],
    onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => set(e.target.value),
    className,
  }
  return (
    <span className={`inline-flex flex-col gap-0.5 min-w-0 align-top ${wrapperClassName ?? ''}`}>
      {multiline
        ? <textarea {...common} rows={rows ?? 2} />
        : <input {...common} onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter() } }} />}
      {(show || cutNote) && (
        <span className={`text-[10px] tabular-nums ${over ? 'text-red-700 font-semibold' : 'text-zinc-600'}`} aria-live="polite">
          {/* Over the limit is said in WORDS ("N over the limit"), with a ⚠ — colour is never the only cue (§21). */}
          <span data-limit-counter data-over-limit={over ? 'true' : undefined}>{over ? '⚠ ' : ''}{remainingWords(value.length, max)}</span>
          {cutNote && <span className="font-semibold text-zinc-900"> — {cutNote}</span>}
        </span>
      )}
    </span>
  )
}
