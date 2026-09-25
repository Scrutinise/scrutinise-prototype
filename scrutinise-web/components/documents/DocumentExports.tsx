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
//
// ⚠ PILOT FEEDBACK (Angus Barry, 16 Sep 2026) — THE CARD IS THE DOCUMENT, NAMED. It was
// headed "Downloads", and the only word saying WHAT could be downloaded was in the small
// print, which disappeared once the file existed. He said the briefing was the most valuable
// thing in the product and could not find it. The heading is now the document's own name, from
// the same constant the file's title uses, and the one-line description stays on the card in
// every state.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import {
  INITIAL_BACKGROUND_NAME, INITIAL_BACKGROUND_BLURB, INITIAL_QUESTIONS_NAME, INITIAL_QUESTIONS_BLURB,
} from '@/lib/documents/initial-background-name'
// ⚠ BRIEF_26G — the two documents that leave the building, same one-card-per-kind pattern.
import {
  COMMITTEE_EVIDENCE_NAME, COMMITTEE_EVIDENCE_BLURB, ONE_PAGE_SUMMARY_NAME, ONE_PAGE_SUMMARY_BLURB,
} from '@/lib/documents/lex-26g-document-names'

/** 17 Sep 2026 — the pair; 26-G added two more. One card component, four documents; the name
 *  and the one-line description come from the same constants the files' own titles use. */
export type ExportCardKind = 'INITIAL_BACKGROUND' | 'INITIAL_QUESTIONS' | 'COMMITTEE_EVIDENCE' | 'ONE_PAGE_SUMMARY'
const CARD: Record<ExportCardKind, { name: string; blurb: string; index: number }> = {
  INITIAL_BACKGROUND: { name: INITIAL_BACKGROUND_NAME, blurb: INITIAL_BACKGROUND_BLURB, index: 0 },
  INITIAL_QUESTIONS: { name: INITIAL_QUESTIONS_NAME, blurb: INITIAL_QUESTIONS_BLURB, index: 1 },
  COMMITTEE_EVIDENCE: { name: COMMITTEE_EVIDENCE_NAME, blurb: COMMITTEE_EVIDENCE_BLURB, index: 2 },
  ONE_PAGE_SUMMARY: { name: ONE_PAGE_SUMMARY_NAME, blurb: ONE_PAGE_SUMMARY_BLURB, index: 3 },
}

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
  buildVersion?: number | null
}

function stamp(iso: string | null): string | null {
  if (!iso) return null
  return `${new Date(iso).toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

export default function DocumentExports({
  ideaId,
  variant = 'panel',
  kind = 'INITIAL_BACKGROUND',
}: {
  ideaId: string
  /** `panel` = the narrow legislation column; `page` = the Exports tab. */
  variant?: 'panel' | 'page'
  /** Which of the pair this card is. */
  kind?: ExportCardKind
}) {
  const card = CARD[kind]
  const [status, setStatus] = useState<ExportStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/documents`)
      if (!res.ok) throw new Error(`documents ${res.status}`)
      const data = await res.json()
      const list: ExportStatus[] = Array.isArray(data.documents) ? data.documents : []
      setStatus(list.find((d) => d.kind === kind) ?? list[card.index] ?? null)
    } catch {
      setError('Couldn’t read the export status just now.')
    } finally {
      setLoading(false)
    }
  }, [ideaId, kind, card.index])

  useEffect(() => { void load() }, [load])

  const generate = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', force: true, kind }),
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
  }, [ideaId, kind])

  const compact = variant === 'panel'
  const title = compact ? 'text-xs font-semibold uppercase tracking-wide text-zinc-700' : 'text-base font-semibold text-zinc-900'
  const body = compact ? 'text-xs text-zinc-500' : 'text-sm text-zinc-600'
  const btn = compact
    ? 'text-xs font-medium px-3 py-1.5 rounded-lg'
    : 'text-sm font-medium px-3 py-2 rounded-lg'

  if (loading) {
    return <p className={body}>Checking for {card.name}…</p>
  }

  // Nothing to export yet — say which of the two reasons it is, never an empty box.
  if (!status || !status.available) {
    return (
      <div className={compact ? 'rounded-xl border border-zinc-200 p-3' : 'rounded-xl border border-zinc-200 p-4'}>
        <div className={title}>{card.name}</div>
        <p className={`${body} mt-1.5`}>
          {status?.unavailableReason ?? 'There is no briefing on this idea yet, so there is nothing to download.'}
        </p>
      </div>
    )
  }

  const generatedStamp = stamp(status.generatedAt)

  return (
    <div className={compact ? 'rounded-xl border border-zinc-200 p-3' : 'rounded-xl border border-zinc-200 p-4'}>
      <div className={title}>{card.name}</div>
      <p className={`${body} mt-1`}>{card.blurb}</p>

      {error && (
        <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {!status.generated ? (
        <>
          <p className={`${body} mt-1.5`}>
            Not prepared yet — it takes a moment, and comes with its sources and citations.
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
            {/* 17 Sep 2026 — frozen, and says so. Regenerating re-renders the same stored
                material; it never searches again. */}
            {' '}A record of one build, not a live view; regenerating re-renders the same material.
          </p>

          {status.stale && (
            <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              The stored document has changed since this was made — a newer build, or a newer layout — so
              these files are out of date. Generate them again to get the current version.
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
