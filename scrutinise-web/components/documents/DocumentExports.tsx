'use client'

// ─────────────────────────────────────────────────────────────────────────────
// §8.2 — the download affordance, shared by the legislation panel and the idea's
// Exports tab so both tell the same story.
//
// What it must never do is offer a download that quietly hands over an old file.
// The status endpoint reports `stale` whenever the stored pair no longer matches
// the state it was rendered from, and in that case the buttons say so, offer
// regeneration first, and only give the old file when the user asks for it in
// full knowledge. What it was generated FROM and WHEN is always on screen.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'

export interface ExportStatus {
  documentId: string | null
  kind: string
  available: boolean
  unavailableReason: string | null
  generated: boolean
  generatedAt: string | null
  sourceLabel: string | null
  stale: boolean
  docxUrl: string | null
  pdfUrl: string | null
  lastError: string | null
}

function stamp(iso: string | null): string | null {
  if (!iso) return null
  return `${new Date(iso).toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

export default function DocumentExports({
  ideaId,
  variant = 'panel',
}: {
  ideaId: string
  /** `panel` = the narrow legislation column; `page` = the Exports tab. */
  variant?: 'panel' | 'page'
}) {
  const [status, setStatus] = useState<ExportStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/documents`)
      if (!res.ok) throw new Error(`documents ${res.status}`)
      const data = await res.json()
      setStatus(data.documents?.[0] ?? null)
    } catch {
      setError('Couldn’t read the export status just now.')
    } finally {
      setLoading(false)
    }
  }, [ideaId])

  useEffect(() => { void load() }, [load])

  const generate = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', force: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.message ?? 'The document couldn’t be generated. Nothing has been changed.')
        return
      }
      setStatus(data.document ?? null)
    } catch {
      setError('The document couldn’t be generated. Nothing has been changed.')
    } finally {
      setBusy(false)
    }
  }, [ideaId])

  const compact = variant === 'panel'
  const title = compact ? 'text-xs font-semibold uppercase tracking-wide text-zinc-700' : 'text-base font-semibold text-zinc-900'
  const body = compact ? 'text-xs text-zinc-500' : 'text-sm text-zinc-600'
  const btn = compact
    ? 'text-xs font-medium px-3 py-1.5 rounded-lg'
    : 'text-sm font-medium px-3 py-2 rounded-lg'

  if (loading) {
    return <p className={body}>Checking for downloads…</p>
  }

  // Nothing to export yet — say which of the two reasons it is, never an empty box.
  if (!status || !status.available) {
    return (
      <div className={compact ? 'rounded-xl border border-zinc-200 p-3' : 'rounded-xl border border-zinc-200 p-4'}>
        <div className={title}>Downloads</div>
        <p className={`${body} mt-1.5`}>
          {status?.unavailableReason ?? 'There is no briefing on this idea yet, so there is nothing to download.'}
        </p>
      </div>
    )
  }

  const generatedStamp = stamp(status.generatedAt)

  return (
    <div className={compact ? 'rounded-xl border border-zinc-200 p-3' : 'rounded-xl border border-zinc-200 p-4'}>
      <div className={title}>Downloads</div>

      {error && (
        <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {!status.generated ? (
        <>
          <p className={`${body} mt-1.5`}>
            The Initial Background can be prepared as a Word document and a PDF, with its sources and
            citations.
          </p>
          <button onClick={generate} disabled={busy}
            className={`${btn} mt-2.5 bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40`}>
            {busy ? 'Preparing…' : 'Prepare the document'}
          </button>
        </>
      ) : (
        <>
          {/* Provenance, always visible — the file is only meaningful with it. */}
          <p className={`${body} mt-1.5`}>
            {generatedStamp ? `Generated ${generatedStamp}` : 'Generated'}
            {status.sourceLabel ? ` from ${status.sourceLabel}.` : '.'}
          </p>

          {status.stale && (
            <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              The briefing has changed since this was made, so these files are out of date. Generate them
              again to get the current version.
            </p>
          )}

          <div className="flex flex-wrap gap-2 mt-2.5">
            {!status.stale && (
              <>
                <a href={status.docxUrl ?? '#'}
                  className={`${btn} border border-zinc-300 text-zinc-700 hover:bg-zinc-50`}>
                  Word (.docx)
                </a>
                <a href={status.pdfUrl ?? '#'}
                  className={`${btn} border border-zinc-300 text-zinc-700 hover:bg-zinc-50`}>
                  PDF
                </a>
              </>
            )}
            <button onClick={generate} disabled={busy}
              className={`${btn} ${status.stale ? 'bg-zinc-900 text-white hover:opacity-90' : 'text-zinc-500 hover:bg-zinc-50'} disabled:opacity-40`}>
              {busy ? 'Preparing…' : status.stale ? 'Generate the current version' : 'Regenerate'}
            </button>
          </div>

          {status.stale && (
            // Offered, but only as a deliberate choice and never as the default.
            <div className="flex flex-wrap gap-3 mt-2">
              <a href={`${status.docxUrl}&allowStale=1`} className="text-[11px] text-zinc-400 hover:text-zinc-700 underline">
                Download the old Word file anyway
              </a>
              <a href={`${status.pdfUrl}&allowStale=1`} className="text-[11px] text-zinc-400 hover:text-zinc-700 underline">
                Download the old PDF anyway
              </a>
            </div>
          )}

          {status.lastError && (
            <p className="mt-2 text-[11px] text-zinc-400">
              Last generation attempt reported: {status.lastError}
            </p>
          )}
        </>
      )}
    </div>
  )
}
