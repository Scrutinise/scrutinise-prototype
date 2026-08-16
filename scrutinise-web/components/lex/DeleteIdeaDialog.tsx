'use client'

// ─────────────────────────────────────────────────────────────────────────────
// DELETE AN IDEA (§19-E Task 6) — the confirmation.
//
// There was no way to delete an idea at all, and Charlie has pre-rebuild ideas that
// cannot exercise the current flow and are polluting his testing.
//
// THE DIALOG NAMES THE IDEA, and that is the whole design of it. A generic "Are you
// sure?" is a button people press without reading; a dialog that says *Delete "Civil
// Service Decision Paralysis"?* is one they read, because the only way to know whether
// the answer is yes is to look at the name. It is the cheapest possible guard against
// deleting the wrong thing from a list of similar things — which is precisely the
// situation Charlie is in.
//
// It also says plainly that the delete is RECOVERABLE, because that is true and because
// a user who believes deletion is final will keep clutter rather than risk it.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'

export default function DeleteIdeaDialog({
  ideaId, title, onDeleted, onCancel,
}: {
  ideaId: string
  title: string
  /** Called after a successful delete — the caller navigates away. */
  onDeleted: () => void
  onCancel: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const shown = title?.trim() || 'Untitled idea'

  async function remove() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}`, { method: 'DELETE' })
      if (res.ok) { onDeleted(); return }
      // The 409 carries a real reason (the idea is public and carries other people's
      // work). Showing the server's own sentence beats a generic failure, because the
      // user's next action differs: withdraw rather than retry.
      const body = await res.json().catch(() => null) as { error?: string } | null
      setError(body?.error ?? 'The idea could not be deleted. Please try again.')
    } catch {
      setError('The idea could not be deleted. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-base font-semibold text-zinc-900">Delete this idea?</h2>
        {/* The name, quoted and prominent — this is the guard. */}
        <p className="mt-2 text-sm text-zinc-700">
          You are about to delete <span className="font-semibold">“{shown}”</span>.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          It will disappear from your ideas straight away. Nothing is destroyed — if you delete
          it by mistake, we can put it back.
        </p>

        {error && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
          >
            Keep it
          </button>
          <button
            onClick={remove}
            disabled={busy}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Deleting…' : `Delete “${shown.length > 28 ? shown.slice(0, 28).trimEnd() + '…' : shown}”`}
          </button>
        </div>
      </div>
    </div>
  )
}
