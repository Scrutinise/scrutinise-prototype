'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * ══ 26-M ADDENDUM — WHAT THE CONSOLIDATION ADDED, ABOVE THE CANDIDATE LIST ═════════════════
 *
 * Coherent-action ideas from the four drafts, from the user's own comments on them, and from actions
 * parked with the policy this one replaced — tested against the final guiding policy, and WRITTEN into
 * the Coherent Actions list below as candidates. This panel is the record of why each is there: where it
 * came from and how it tested. Nothing is confirmed (that is "These are my actions", the user's own act).
 *
 * ⚠ THE VERDICT IS A WORD AND A GLYPH OF A DIFFERENT SHAPE, NEVER COLOUR ALONE (docs/CLAUDE.md §21 —
 * Charlie is colour blind): ✓ Fits / ○ Does not fit / ✕ Conflicts. ⚠ A CONFLICT IS LISTED FIRST AND ITS REASON
 * IS ON THE LINE, not behind a click.
 */

interface Added {
  id: string
  actionId: string
  text: string
  verdict: 'FITS' | 'DOES_NOT_FIT' | 'CONFLICTS' | 'NOT_TESTED'
  reason: string | null
  from: string[]
}

const VERDICT_UI: Record<Added['verdict'], { glyph: string; word: string; border: string }> = {
  CONFLICTS: { glyph: '✕', word: 'Conflicts', border: 'border-2 border-zinc-900' },
  DOES_NOT_FIT: { glyph: '○', word: 'Does not fit', border: 'border border-zinc-400' },
  NOT_TESTED: { glyph: '?', word: 'Not tested', border: 'border border-dashed border-zinc-400' },
  FITS: { glyph: '✓', word: 'Fits', border: 'border border-zinc-200' },
}

export default function ActionSuggestions({ ideaId, onChanged }: { ideaId: string; onChanged?: () => void }) {
  const [items, setItems] = useState<Added[]>([])
  const [held, setHeld] = useState(0)
  const [settled, setSettled] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const apply = useCallback((b: { added?: Added[]; held?: number; settledPolicyId?: string | null }) => {
    setItems(b.added ?? [])
    setHeld(b.held ?? 0)
    setSettled(!!b.settledPolicyId)
  }, [])

  const load = useCallback(async () => {
    const res = await fetch(`/api/ideas/${ideaId}/action-ideas`)
    if (res.ok) apply(await res.json())
  }, [ideaId, apply])

  useEffect(() => { void load() }, [load])

  const send = useCallback(async (key: string, payload: Record<string, string>) => {
    setBusy(key); setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/action-ideas`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setError(typeof body?.error === 'string' ? body.error : 'That did not work.'); return }
      apply(body)
      // The candidate list above changed (an action was removed, or the step wrote some): redraw it.
      onChanged?.()
    } finally { setBusy(null) }
  }, [ideaId, apply, onChanged])

  if (!items.length && !(held > 0 && settled)) return null

  return (
    <div className="rounded-lg border-2 border-zinc-900 p-3 mb-3" id="action-suggestions">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-700">
        Added from the consolidation ({items.length})
      </p>
      <p className="text-[11px] text-zinc-600 mt-0.5">
        These are things to <span className="font-medium">do</span>, taken from the four drafts, from your comments on
        them, and from actions that were waiting with the policy you replaced. They are in your list below as
        candidates, tested against your final guiding policy. Nothing is confirmed until you say so.
      </p>

      {held > 0 && settled && (
        <p className="text-[11px] text-zinc-800 mt-1.5">
          {held} idea{held === 1 ? ' is' : 's are'} being held and not yet added.{' '}
          <button type="button" disabled={!!busy} onClick={() => void send('test', { op: 'test' })} className="underline font-medium disabled:opacity-40">
            {busy === 'test' ? 'Adding…' : 'Test and add them now'}
          </button>
        </p>
      )}

      <ul className="mt-2 space-y-2">
        {items.map((s) => {
          const v = VERDICT_UI[s.verdict]
          return (
            <li key={s.id} className={`rounded-lg p-2.5 ${v.border}`}>
              <p className="text-sm text-zinc-900">{s.text}</p>
              <p className="text-[11px] mt-1 text-zinc-800">
                <span className="font-semibold"><span aria-hidden>{v.glyph}</span> {v.word}.</span>{' '}
                {s.reason}
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5">From: {s.from.join('; ')}</p>
              <div className="mt-2">
                <button type="button" disabled={!!busy} onClick={() => void send(s.id, { op: 'remove', id: s.id })}
                  className="text-xs font-medium px-3 py-1 rounded-full border border-zinc-300 text-zinc-700 disabled:opacity-40">
                  Remove from my actions
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      {error && <p className="text-[11px] text-red-700 mt-2">{error}</p>}
    </div>
  )
}
