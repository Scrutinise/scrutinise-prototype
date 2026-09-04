'use client'

// ─────────────────────────────────────────────────────────────────────────────────────────
// 25-Z §5c — THE EVIDENCE-BASE DISCLOSURE, SHOWN ONCE, AT THE MOMENT IT IS ABOUT.
//
// It used to sit in THE RESEARCH's header on every render. Charlie: *too wordy for here.* A
// hundred words above a panel the user looks at fifty times a session is how a sentence that
// matters becomes furniture the eye skips — and this one is not furniture: it is the platform
// telling a proposer that refining the evidence base is their first task.
//
// ⚠⚠ THE TEXT IS NOT EDITED (§5d). It is `EVIDENCE_DISCLOSURE`, imported, the same constant
// the documents use. It was agreed word for word and this sprint moves it; it does not rewrite
// it. A local copy here would be the second copy, and the second copy is the one that drifts.
//
// ⚠ WHEN: the first time the user opens a SEARCH-DERIVED item in THE RESEARCH. Not on their own
// uploaded document — the disclosure is about what automated search returns, and showing it
// over a file they chose themselves would be telling them their own document might be
// off-topic.
//
// ⚠ ONCE PER USER, PER BROWSER, and it is `localStorage` rather than a column deliberately:
// this is a reading acknowledgement, not a consent record, and nothing downstream depends on
// it. ⚠ A read or write can throw (private windows, blocked site data), so both are wrapped
// and the failure mode is that it shows again — which is the harmless direction.
// ─────────────────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { EVIDENCE_DISCLOSURE } from '@/lib/lex/beta-disclosure'

const SEEN_KEY = 'lex.betaSearchNotice.seen.v1'

/** Has this browser already been shown it? ⚠ Any failure answers "no" — see the header. */
export function betaNoticeSeen(): boolean {
  try { return window.localStorage.getItem(SEEN_KEY) === '1' } catch { return false }
}

export function markBetaNoticeSeen(): void {
  try { window.localStorage.setItem(SEEN_KEY, '1') } catch { /* shows again; harmless */ }
}

export default function BetaSearchNotice({ onClose }: { onClose: () => void }) {
  const [closing, setClosing] = useState(false)

  // ⚠ ESCAPE CLOSES IT. A modal that can only be dismissed by finding its button is a modal
  // that traps a user who opened an item and wants to read the item.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setClosing(true); onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (closing) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="About this evidence base"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-zinc-900/40 p-4"
      onClick={() => { setClosing(true); onClose() }}
    >
      {/* ⚠ The backdrop closes it, and the panel does not — a click inside the text must not
          dismiss the thing the user is reading. */}
      <div
        className="w-full max-w-md rounded-xl border-2 border-zinc-300 bg-white p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ⚠ NOT A COLOUR (docs/CLAUDE.md §21 — Charlie is colour blind). The cues are the
            2px border, the heading word and the position; hue carries nothing here. */}
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          About this evidence base
        </p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-800">{EVIDENCE_DISCLOSURE}</p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => { setClosing(true); onClose() }}
            className="rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
