'use client'

// ─────────────────────────────────────────────────────────────────────────────
// §20.5 — the consent flow, in three steps the user can always back out of:
//
//   write  → they say what's wrong, and pick which part it is about
//   review → the exact text that would be sent is shown VERBATIM, with Yes / Edit / No
//   done   → what actually happened, stated plainly (stored / stored but not emailed)
//
// The user sees the exact text before it leaves their control — consent is explicit, not implied. Nothing is stored or sent
// until they press Yes: the summarise call writes nothing, attached files stay in the browser until the Yes, and No simply
// closes this dialog.
//
// 8 Oct 2026 (Charlie's walkthrough, item 4):
//   · "Bug / error report" is a choice in "What is this about?" — the form used to offer only "what Lex got wrong";
//   · a screenshot or file can be attached (held here until the Yes);
//   · for a bug report the TECHNICAL DETAIL is captured automatically (lib/client-fault-capture.ts), shown in full on the review
//     step and sent exactly as shown — and the user's words are NOT summarised by a model;
//   · DECISION 137 — the review step says who the report is from: "User 435", a number, not a name.
//
// Purely additive: it holds its own local state and touches no canonical state.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import {
  FEEDBACK_SURFACES, SURFACE_LABELS, FEEDBACK_ATTACHMENT_MAX_BYTES, FEEDBACK_ATTACHMENT_MAX_FILES, FEEDBACK_ATTACHMENT_TYPES,
  type FeedbackSurfaceKey, type FeedbackAttachment,
} from '@/lib/lex/feedback-types'
import { getTechnicalDetail } from '@/lib/client-fault-capture'
import { explainFailure } from '@/lib/api-rejection'

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
  const [verbatim, setVerbatim] = useState(false)
  const [technical, setTechnical] = useState<Record<string, unknown> | null>(null)
  const [userRef, setUserRef] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<{ stored: boolean; sent: boolean; message: string } | null>(null)

  const isBug = surface === 'BUG_REPORT'
  // Captured the moment the dialog opens (the fault has just happened), and again if the user switches to a bug report.
  const [captured, setCaptured] = useState<Record<string, unknown>>({})
  useEffect(() => { setCaptured(getTechnicalDetail()) }, [])

  const redactionLine = redactions.length
    ? `Personal details removed: ${redactions.map((r) => `${r.kind}${r.count > 1 ? ` ×${r.count}` : ''}`).join(', ')}.`
    : null

  const addFiles = (list: FileList | null) => {
    if (!list) return
    const next = [...files]
    const problems: string[] = []
    for (const f of Array.from(list)) {
      if (next.length >= FEEDBACK_ATTACHMENT_MAX_FILES) { problems.push(`Only ${FEEDBACK_ATTACHMENT_MAX_FILES} files can be attached; “${f.name}” was not added.`); continue }
      if (f.size > FEEDBACK_ATTACHMENT_MAX_BYTES) { problems.push(`“${f.name}” is ${(f.size / 1048576).toFixed(1)} MB; the limit is ${FEEDBACK_ATTACHMENT_MAX_BYTES / 1048576} MB, so it was not added.`); continue }
      if (!(FEEDBACK_ATTACHMENT_TYPES as readonly string[]).includes(f.type)) { problems.push(`“${f.name}” is not an image, pdf or plain-text file, so it was not added.`); continue }
      next.push(f)
    }
    setFiles(next)
    setError(problems.length ? problems.join(' ') : null)
  }

  async function prepare() {
    const text = original.trim()
    if (!text || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'summarise', text, surface, stage, ...(isBug ? { technicalDetail: captured } : {}) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(explainFailure(data, res.status, 'Preparing your report'))
      setSummary(data.summarisedText ?? '')
      setRedactions(Array.isArray(data.redactions) ? data.redactions : [])
      setUsedFallback(Boolean(data.usedFallback))
      setVerbatim(Boolean(data.verbatim))
      setTechnical(data.technicalDetail && typeof data.technicalDetail === 'object' ? data.technicalDetail : null)
      setUserRef(typeof data.userRef === 'string' ? data.userRef : null)
      setEditing(false)
      setStep('review')
    } catch (e) {
      setError(`${e instanceof Error ? e.message : 'That didn’t go through'} Nothing has been sent.`)
    } finally {
      setBusy(false)
    }
  }

  async function send() {
    if (busy || !summary.trim()) return
    setBusy(true)
    setError(null)
    try {
      // Files go up only now, at the Yes. If one fails, nothing is submitted and the user is told which.
      const uploaded: FeedbackAttachment[] = []
      for (const f of files) {
        const fd = new FormData()
        fd.append('file', f)
        const up = await fetch(`/api/ideas/${ideaId}/feedback/attachment`, { method: 'POST', body: fd })
        const upData = await up.json().catch(() => ({}))
        if (!up.ok || !upData.attachment) throw new Error(explainFailure(upData, up.status, `Attaching “${f.name}”`))
        uploaded.push(upData.attachment as FeedbackAttachment)
      }
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
          ...(isBug && technical ? { technicalDetail: technical } : {}),
          ...(uploaded.length ? { attachments: uploaded } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      // 409: the edit put personal content back in. Nothing was sent; show the
      // corrected text and ask again rather than sending something unseen.
      if (res.status === 409 && data?.summarisedText) {
        setSummary(data.summarisedText)
        if (data.technicalDetail && typeof data.technicalDetail === 'object') setTechnical(data.technicalDetail)
        setRedactions(Array.isArray(data.redactions) ? data.redactions : [])
        setEditing(false)
        setError(data.message ?? 'That still had personal details in it, so nothing has been sent.')
        return
      }
      if (!res.ok) throw new Error(explainFailure(data, res.status, 'Sending your report'))
      setOutcome({ stored: Boolean(data.stored), sent: Boolean(data.sent), message: data.message ?? '' })
      setStep('done')
    } catch (e) {
      setError(`${e instanceof Error ? e.message : 'That didn’t go through.'} Nothing has been sent.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={isBug ? 'Report a bug' : 'Give feedback on Lex'}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-start gap-3">
          <h2 className="text-base font-semibold text-zinc-900 flex-1">{isBug ? 'Report a bug' : 'Pass this back to Scrutinise'}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-sm" aria-label="Close">✕</button>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{error}</p>
        )}

        {step === 'write' && (
          <>
            <p className="text-sm text-zinc-600 mt-1.5">
              {isBug
                ? 'Tell us what you were doing and what happened instead. The error you saw, the control you pressed and the request that failed are captured for you — you will see all of it before anything is sent.'
                : 'Tell us what Lex got wrong. Nothing is stored or sent until you’ve seen the exact wording and said yes.'}
            </p>

            <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mt-4 mb-1">
              What is this about?
            </label>
            <select
              value={surface}
              onChange={(e) => { setSurface(e.target.value as FeedbackSurfaceKey); if (e.target.value === 'BUG_REPORT') setCaptured(getTechnicalDetail()) }}
              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              {FEEDBACK_SURFACES.map((s) => (
                <option key={s} value={s}>{SURFACE_LABELS[s]}</option>
              ))}
            </select>

            <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mt-4 mb-1">
              {isBug ? 'What happened?' : 'What’s wrong with it?'}
            </label>
            <textarea
              value={original}
              onChange={(e) => setOriginal(e.target.value)}
              rows={5}
              autoFocus
              maxLength={4000}
              placeholder={isBug
                ? 'e.g. I selected two actions, chose a heading from “Assign to heading…”, and it said the request was not valid. I expected them to move under that heading.'
                : 'e.g. the cost range is far too low for a scheme this size, and it doesn’t say where the figure came from.'}
              className="w-full resize-y border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />

            <div className="mt-3">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-1">
                A screenshot or file (optional)
              </label>
              <input
                type="file"
                multiple
                accept={FEEDBACK_ATTACHMENT_TYPES.join(',')}
                onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
                className="block w-full text-xs text-zinc-600 file:mr-3 file:rounded-lg file:border file:border-zinc-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium"
              />
              {files.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {files.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-xs text-zinc-700">
                      <span className="truncate">{f.name} · {Math.max(1, Math.round(f.size / 1024))} KB</span>
                      <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="underline text-zinc-500">remove</button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[11px] text-zinc-400 mt-1">
                Up to {FEEDBACK_ATTACHMENT_MAX_FILES} files, {FEEDBACK_ATTACHMENT_MAX_BYTES / 1048576} MB each: images, pdf, plain text. A picture is sent exactly as it is — personal details in it cannot be removed automatically, so check it first.
              </p>
            </div>

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
            {userRef && (
              <p className="text-[11px] text-zinc-500 mt-1">
                From: <span className="font-semibold text-zinc-700">{userRef}</span> — a number, not your name. It lets the team connect your reports without knowing who you are.
              </p>
            )}

            {usedFallback && (
              <p className="mt-3 text-xs text-zinc-500 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2">
                Lex couldn’t shorten this just now, so this is your own wording with personal details
                removed. It’s still fine to send.
              </p>
            )}
            {verbatim && (
              <p className="mt-3 text-xs text-zinc-500 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2">
                Your words are sent as you wrote them (personal details removed). A bug report is never summarised.
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

            {isBug && technical && (
              <details open className="mt-3 rounded-xl border border-zinc-200 bg-white p-3">
                <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-zinc-600">Technical detail — sent exactly as shown</summary>
                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-snug text-zinc-700">{JSON.stringify(technical, null, 2)}</pre>
              </details>
            )}

            {files.length > 0 && (
              <p className="text-[11px] text-zinc-600 mt-2">
                Attached: {files.map((f) => f.name).join(', ')} — sent as they are.
              </p>
            )}

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
                {editing ? 'Done editing' : 'Edit my words'}
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
