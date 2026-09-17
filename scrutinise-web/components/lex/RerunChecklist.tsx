'use client'

// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-B §6 — THE CHECKLIST THE RE-RUN SITS BENEATH.
//
// Rendered INSIDE the re-run box, above the button, so the sequence a user reads is: what to
// do next (§5b) → what of it is done (this) → the control → the allowance line (§6c). It is
// drawn from the idea's own state through the worklist route (`rerunChecklist`), never a
// fixed list; `lib/lex/rerun-checklist.ts` says what each row counts.
//
// ⚠ TWO KINDS OF ROW, AND THEY LOOK DIFFERENT AND SAY WHICH. A RECORDED row is a checkbox the
// user ticks (read the briefing). A DERIVED row is ticked by the work itself and cannot be
// clicked; it shows "2 of 5" beside it. A checkbox the user could tick to make a count look
// done would teach them exactly what §6a warns against.
//
// ⚠ NOTHING IS SIGNALLED BY COLOUR ALONE (docs/CLAUDE.md §21) — the state is the tick, the
// count and the word "done".
//
// ⚠ §6b — IT INFORMS, IT DOES NOT BLOCK. This component renders no control and disables
// nothing; the re-run button below it is untouched. If Charlie decides an unticked list should
// hold the re-run, `complete` is already on the response and the button is one prop away.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import { NEXT_STEPS_NOTE } from '@/lib/lex/elicitation-config'

interface Item {
  key: string
  kind: 'derived' | 'recorded'
  text: string
  done: boolean
  progress: { done: number; of: number } | null
}

export default function RerunChecklist({ ideaId, refreshKey }: { ideaId: string; refreshKey?: string | number | null }) {
  const [items, setItems] = useState<Item[] | null>(null)
  const [complete, setComplete] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/worklist`)
      if (!res.ok) return
      const data = await res.json()
      setItems(Array.isArray(data?.rerunChecklist?.items) ? data.rerunChecklist.items : [])
      setComplete(Boolean(data?.rerunChecklist?.complete))
    } catch { /* the list is informative; a failed read leaves it absent, never wrong */ }
  }, [ideaId])

  useEffect(() => { void load() }, [load, refreshKey])

  const tick = useCallback(async (key: string, ticked: boolean) => {
    setBusy(key)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/worklist`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemKey: key, ticked }),
      })
      if (res.ok) {
        const data = await res.json()
        setItems(Array.isArray(data?.rerunChecklist?.items) ? data.rerunChecklist.items : [])
        setComplete(Boolean(data?.rerunChecklist?.complete))
      }
    } finally { setBusy(null) }
  }, [ideaId])

  return (
    <div className="mt-2">
      {/* §5b — the same sentence the build ends on, where the control is. */}
      <p className="text-sm text-zinc-800">{NEXT_STEPS_NOTE}</p>

      {items && items.length > 0 && (
        <ul className="mt-2.5 space-y-1.5" aria-label="Before you re-run">
          {items.map((it) => (
            <li key={it.key} className="flex items-start gap-2 text-sm text-zinc-700">
              {it.kind === 'recorded' ? (
                <input
                  type="checkbox"
                  checked={it.done}
                  disabled={busy === it.key}
                  onChange={(e) => void tick(it.key, e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-zinc-400 accent-zinc-900"
                  aria-label={it.text}
                />
              ) : (
                // Derived: the work ticks it, not the user — shown, not clickable, and it says so.
                <input
                  type="checkbox"
                  checked={it.done}
                  readOnly
                  disabled
                  className="mt-0.5 w-4 h-4 rounded border-zinc-400 accent-zinc-900"
                  aria-label={`${it.text} — ticked by the work itself`}
                />
              )}
              <span>
                {it.text}
                {it.progress && (
                  <span className="text-zinc-500"> — {it.progress.done} of {it.progress.of}{it.done ? ', done' : ''}</span>
                )}
                {!it.progress && it.done && <span className="text-zinc-500"> — done</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {items && items.length > 0 && (
        <p className="text-[11px] text-zinc-500 mt-1.5">
          {complete
            ? 'Everything on the list is done.'
            : 'You can re-run before the list is done — it is here so you know what the next pass will and will not have.'}
        </p>
      )}
    </div>
  )
}
