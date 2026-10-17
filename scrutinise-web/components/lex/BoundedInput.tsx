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
  const set = (raw: string) => {
    const c = clampToLimit(raw, max)
    setCutNote(c.note)
    onChange(c.text)
  }
  const show = value.length >= Math.floor(max * showFrom)
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
        <span className="text-[10px] text-zinc-600 tabular-nums" aria-live="polite">
          <span data-limit-counter>{remainingWords(value.length, max)}</span>
          {cutNote && <span className="font-semibold text-zinc-900"> — {cutNote}</span>}
        </span>
      )}
    </span>
  )
}
