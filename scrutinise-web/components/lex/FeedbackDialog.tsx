'use client'

// ─────────────────────────────────────────────────────────────────────────────
// §20.5 — the consent flow, in three steps the user can always back out of:
//
//   write  → they say what's wrong, and pick which part of Lex's output it is about
//   review → Lex's summary is shown VERBATIM, with Yes / Edit / No
//   done   → what actually happened, stated plainly (stored / stored but not emailed)
//
// The user sees the exact text before it leaves their control — consent is
// explicit, not implied. Nothing is stored or sent until they press Yes: the
// summarise call writes nothing, and No simply closes this dialog.
//
// Purely additive: it holds its own local state and touches no canonical state.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { FEEDBACK_SURFACES, SURFACE_LABELS, type FeedbackSurfaceKey } from '@/lib/lex/feedback-types'

interface Redaction { kind: string; count: number }

type Step = 'write' | 'review' | 'done'

export default function FeedbackDialog({
  ideaId,
  stage,
  initialSurface = 'OTHER',
  onClose,
}: {
  ideaId: string
  stage: string
  initialSurface?: FeedbackSurfaceKey
  onClose: () => void
}) {
  const [step, setStep] = useState<Step>('write')
  const [surface, setSurface] = useState<FeedbackSurfaceKey>(initialSurface)
  const [original, setOriginal] = useState('')
  const [summary, setSummary] = useState('')
  const [redactions, setRedactions] = useState<Redaction[]>([])
  const [usedFallback, setUsedFallback] = useState(false)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<{ stored: boolean; sent: boolean; message: string } | null>(null)

  const redactionLine = redactions.length
    ? `Personal details removed: ${redactions.map((r) => `${r.kind}${r.count > 1 ? ` ×${r.count}` : ''}`).join(', ')}.`
    : null

  async function prepare() {
    const text = original.trim()
    if (!text || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'summarise', text, surface, stage }),
      })
      if (!res.ok) throw new Error(`summarise ${res.status}`)
      const data = await res.json()
      setSummary(data.summarisedText ?? '')
      setRedactions(Array.isArray(data.redactions) ? data.redactions : [])
      setUsedFallback(Boolean(data.usedFallback))
      setEditing(false)
      setStep('review')
    } catch {
      setError('That didn’t go through — nothing has been sent. Try again?')
    } finally {
      setBusy(false)
    }
  }

  async function send() {
    if (busy || !summary.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          originalText: original.trim(),
          summarisedText: summary.trim(),
          surface,
          stage,
          userEdited: editing,
        }),
      })
      const data = await res.json().catch(() => ({}))
      // 409: the edit put personal content back in. Nothing was sent; show the
      // corrected text and ask again rather than sending something unseen.
      if (res.status === 409 && data?.summarisedText) {
        setSummary(data.summarisedText)
        setRedactions(Array.isArray(data.redactions) ? data.redactions : [])
        setEditing(false)
        setError(data.message ?? 'That still had personal details in it, so nothing has been sent.')
        return
      }
      if (!res.ok) throw new Error(`submit ${res.status}`)
      setOutcome({ stored: Boolean(data.stored), sent: Boolean(data.sent), message: data.message ?? '' })
      setStep('done')
    } catch {
      setError('That didn’t go through — nothing has been sent. Try again?')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Give feedback on Lex">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-start gap-3">
          <h2 className="text-base font-semibold text-zinc-900 flex-1">Pass this back to Scrutinise</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-sm" aria-label="Close">✕</button>
        </div>

        {error && (
          <p className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{error}</p>
        )}

        {step === 'write' && (
          <>
            <p className="text-sm text-zinc-600 mt-1.5">
              Tell us what Lex got wrong. Nothing is stored or sent until you’ve seen the exact wording
              and said yes.
            </p>

            <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mt-4 mb-1">
              What is this about?
            </label>
            <select
              value={surface}
              onChange={(e) => setSurface(e.target.value as FeedbackSurfaceKey)}
              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              {FEEDBACK_SURFACES.map((s) => (
                <option key={s} value={s}>{SURFACE_LABELS[s]}</option>
              ))}
            </select>

            <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mt-4 mb-1">
              What’s wrong with it?
            </label>
            <textarea
              value={original}
              onChange={(e) => setOriginal(e.target.value)}
              rows={5}
              autoFocus
              placeholder="e.g. the cost range is far too low for a scheme this size, and it doesn’t say where the figure came from."
              className="w-full resize-y border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />

            <div className="flex flex-wrap gap-2 mt-4">
              <button
                onClick={prepare}
                disabled={busy || !original.trim()}
                className="text-sm font-medium px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
              >
                {busy ? 'Preparing…' : 'Show me what would be sent'}
              </button>
              <button onClick={onClose} className="text-sm font-medium px-3 py-1.5 rounded-lg text-zinc-500 hover:bg-zinc-50">
                Cancel
              </button>
            </div>
          </>
        )}

        {step === 'review' && (
          <>
            <p className="text-sm text-zinc-600 mt-1.5">
              This is exactly what would be sent to the Scrutinise team — nothing else, and nothing has
              been stored yet.
            </p>

            {usedFallback && (
              <p className="mt-3 text-xs text-zinc-500 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2">
                Lex couldn’t shorten this just now, so this is your own wording with personal details
                removed. It’s still fine to send.
              </p>
            )}

            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              {editing ? (
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={6}
                  autoFocus
                  className="w-full resize-y bg-white border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              ) : (
                <p className="text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed">{summary}</p>
              )}
            </div>

            {redactionLine && <p className="text-[11px] text-zinc-500 mt-2">{redactionLine}</p>}
            <p className="text-[11px] text-zinc-400 mt-1">
              Your original wording stays on your idea and is not emailed.
            </p>

            <div className="flex flex-wrap gap-2 mt-4">
              <button
                onClick={send}
                disabled={busy || !summary.trim()}
                className="text-sm font-medium px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
              >
                {busy ? 'Sending…' : 'Yes, send this'}
              </button>
              <button
                onClick={() => setEditing((e) => !e)}
                disabled={busy}
                className="text-sm font-medium px-3 py-1.5 rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
              >
                {editing ? 'Done editing' : 'Edit'}
              </button>
              <button
                onClick={onClose}
                disabled={busy}
                className="text-sm font-medium px-3 py-1.5 rounded-lg text-zinc-500 hover:bg-zinc-50 disabled:opacity-40"
              >
                No, don’t send
              </button>
            </div>
          </>
        )}

        {step === 'done' && outcome && (
          <>
            <p className="text-sm text-zinc-700 mt-2">{outcome.message}</p>
            {!outcome.sent && (
              <p className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                To be exact: it is saved against this idea, but the email did not send. It hasn’t been lost.
              </p>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={onClose} className="text-sm font-medium px-3 py-1.5 rounded-lg bg-zinc-900 text-white hover:opacity-90">
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
