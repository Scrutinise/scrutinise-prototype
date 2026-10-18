'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-S2 §9d (decision 172) — A FOCUSED DIALOG: the rest of the page dimmed, one task, ONE button at the foot.
//
// Why it exists: Charlie filed a document through an inline form and took the next section down on the page ("Decisions") to be part of the
// form — the save was missed. A task that has a beginning and a save belongs in a box that says so: the page behind it is dimmed and cannot be
// mistaken for part of it, the foot holds the one primary action, Escape and the ✕ close it, and nothing behind it scrolls.
//
// ⚠ THE FOOT IS THE CALLER'S (`footer`) so the single Save is always in view, never scrolled away with a long form.
// ⚠ NOTHING HERE IS SIGNALLED BY COLOUR ALONE (docs/CLAUDE.md §21): the dimming is a lightness difference, and the dialog carries a 2px border and
//    a title in words.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, type ReactNode } from 'react'

export default function FocusDialog({
  title, onClose, children, footer, wide = false,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  /** The one primary action, and anything beside it - always visible at the foot. */
  footer?: ReactNode
  wide?: boolean
}) {
  const box = useRef<HTMLDivElement | null>(null)
  // ⚠ onClose is held in a ref and the effect runs ONCE: a caller passing an inline arrow would otherwise re-run it on every keystroke and pull focus
  // back to the dialog box from the field being typed in.
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden' // nothing behind it scrolls
    box.current?.focus()
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [])
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-4" onClick={onClose} data-focus-dialog-overlay>
      <div
        ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} data-focus-dialog
        className={`bg-white rounded-2xl border-2 border-zinc-900 shadow-xl w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} max-h-[90vh] flex flex-col overflow-hidden outline-none`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200">
          <h2 className="flex-1 min-w-0 text-sm font-semibold text-zinc-900 break-words">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-zinc-500 hover:text-zinc-800 text-lg leading-none px-1">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>
        {footer && <div className="px-4 py-3 border-t border-zinc-200 bg-zinc-50 flex flex-wrap items-center gap-2" data-focus-dialog-foot>{footer}</div>}
      </div>
    </div>
  )
}
