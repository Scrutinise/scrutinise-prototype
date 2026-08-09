'use client'

// ─────────────────────────────────────────────────────────────────────────────
// The expert-correction form for "Reading legislation: a working guide".
//
// Everything here is shaped by who we are asking. A practising lawyer giving us
// fifteen minutes will not create an account first, will not hunt for a contact
// page, and will not write an essay — so the form opens where the criticism was
// made, arrives with the right section already chosen, and asks for four things
// of which one is optional.
//
// An email address IS required, and the form says why rather than just marking it
// with an asterisk: we want to be able to write back and ask a follow-up. That is
// the whole point of a draft published for correction.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import { SECTION_OPTIONS, GENERAL_SECTION_KEY } from '@/lib/reading-legislation-content'

export default function SuggestImprovementDialog({
  open,
  initialSectionKey,
  onClose,
}: {
  open: boolean
  /** Pre-selected when opened from a section's own link. */
  initialSectionKey?: string
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [credentials, setCredentials] = useState('')
  const [sectionKey, setSectionKey] = useState(initialSectionKey ?? GENERAL_SECTION_KEY)
  const [suggestion, setSuggestion] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const firstFieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setSectionKey(initialSectionKey ?? GENERAL_SECTION_KEY)
      setError(null)
      firstFieldRef.current?.focus()
    }
  }, [open, initialSectionKey])

  // Escape closes — a modal a keyboard user cannot dismiss is a trap.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const canSend = name.trim() && email.trim() && suggestion.trim().length >= 10 && !sending

  async function submit() {
    if (!canSend) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/legislation-guide/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          credentials: credentials.trim() || undefined,
          sectionKey,
          suggestion: suggestion.trim(),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(
          typeof body?.error === 'string'
            ? body.error
            : res.status === 422
              ? 'Please check the fields — we need a name, a working email address, and at least a sentence or two.'
              : 'Something went wrong sending that. You can also email cl@scrutinise.org directly.',
        )
        return
      }
      setSent(true)
    } catch {
      setError('Network error. You can also email cl@scrutinise.org directly.')
    } finally {
      setSending(false)
    }
  }

  function reset() {
    setSent(false)
    setSuggestion('')
    setCredentials('')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Suggest an improvement to the legislation guide"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-xl border border-border bg-background p-6 shadow-lg">
        {sent ? (
          <div className="space-y-4">
            <h2 className="text-base font-semibold">Thank you — that has reached us.</h2>
            <p className="text-sm text-muted-foreground">
              It goes straight to Charlie Leach at cl@scrutinise.org, and we may write back to ask a
              follow-up. If we use your correction and you would like to be credited when this comes
              out of draft, say so in a reply.
            </p>
            <div className="flex justify-end">
              <button
                onClick={reset}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold">Suggest an improvement</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                This guide is a draft written by a non-lawyer and published so that people who know
                the material can correct it. Blunt is useful. Nothing here is published under your
                name without asking you first.
              </p>
            </div>

            <label className="block space-y-1">
              <span className="text-sm font-medium">Your name</span>
              <input
                ref={firstFieldRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={320}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
              <span className="block text-xs text-muted-foreground">
                Required, so we can write back and ask a follow-up. Not published, not added to any
                mailing list.
              </span>
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">
                Role or credentials <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              <input
                type="text"
                value={credentials}
                onChange={(e) => setCredentials(e.target.value)}
                maxLength={300}
                placeholder="e.g. barrister, public law; or 20 years in-house at a regulator"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
              <span className="block text-xs text-muted-foreground">
                It helps us weigh a correction. We take it as given and do not verify it.
              </span>
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">Which part does this relate to?</span>
              <select
                value={sectionKey}
                onChange={(e) => setSectionKey(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                {SECTION_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">Your suggestion</span>
              <textarea
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
                rows={6}
                maxLength={10000}
                placeholder="What is wrong, what is missing, or what you would say instead."
                className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </label>

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!canSend}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
              >
                {sending ? 'Sending…' : 'Send suggestion'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
