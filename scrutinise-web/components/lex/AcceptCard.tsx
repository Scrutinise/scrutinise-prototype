'use client'

import { useState } from 'react'
import type { CanonicalField } from '@/lib/lex/page1-config'

// The confirmation card. Rendered IFF the current field is AWAITING_CONFIRMATION
// (the parent guarantees this). It is a pure function of server state — there is
// no timer and no local "is this still showing?" flag. On accept the server flips
// the status and returns new state, and the card disappears because the state no
// longer says to show it. (Was the root cause of the 20s revert bug — §12 Task 2.)
export default function AcceptCard({
  field,
  busy,
  onAccept,
  onDecline,
}: {
  field: CanonicalField
  busy: boolean
  onAccept: (value: string | string[]) => void
  onDecline: () => void
}) {
  const proposed = field.proposal?.value
  const isKeywords = field.type === 'structured'
  const initialText = isKeywords
    ? (Array.isArray(proposed) ? proposed.join(', ') : String(proposed ?? ''))
    : String(proposed ?? '')

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initialText)

  function accept() {
    const text = (editing ? draft : initialText).trim()
    if (isKeywords) {
      const list = text.split(',').map((s) => s.trim()).filter(Boolean)
      onAccept(list)
    } else {
      onAccept(text)
    }
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 my-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-700 mb-1.5">
        {field.label} — for your approval
      </div>

      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={isKeywords ? 2 : 3}
          autoFocus
          className="w-full text-sm p-2 rounded-lg border border-blue-200 bg-white resize-none"
        />
      ) : isKeywords ? (
        <div className="flex flex-wrap gap-1.5">
          {(Array.isArray(proposed) ? proposed : []).map((k, i) => (
            <span key={i} className="text-xs bg-white border border-blue-200 rounded-full px-2 py-0.5 text-zinc-700">
              {String(k)}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap">{initialText}</p>
      )}

      {field.proposal?.rationale && !editing && (
        <p className="text-xs text-zinc-500 mt-1.5 italic">{field.proposal.rationale}</p>
      )}

      <div className="flex gap-2 mt-2.5">
        <button
          onClick={accept}
          disabled={busy}
          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {editing ? 'Save & accept' : 'Accept'}
        </button>
        {!editing && (
          <button
            onClick={() => { setDraft(initialText); setEditing(true) }}
            disabled={busy}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Edit
          </button>
        )}
        <button
          onClick={onDecline}
          disabled={busy}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-300 text-zinc-500 hover:bg-zinc-50 disabled:opacity-50"
        >
          {editing ? 'Cancel' : 'Skip'}
        </button>
      </div>
    </div>
  )
}
