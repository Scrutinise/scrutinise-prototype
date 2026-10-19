'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-T2 §4a — PRINTING THE ACTIONS PACK FROM THE COHERENT ACTIONS SCREEN.
//   · "Print selected as an Actions Pack" (the bulk bar) · "Print this heading" (a heading row) · "Print all" (the toolbar)
// Each posts the selection to the document route and shows the Word and PDF links when the file is ready. No model is called, so there is no
// price to ask about: it arranges what the record holds. ⚠ A refusal reads "Not saved: ..." in the screen's own strip, in words (§30).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useState } from 'react'
import { explainFailure } from '@/lib/api-rejection'

export interface PackSelectionBody { actionIds?: string[]; headingId?: string }
export interface PackReady { label: string; docxUrl: string | null; pdfUrl: string | null; generatedAt: string | null }

export function usePackPrint(ideaId: string) {
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState<PackReady | null>(null)
  const [error, setError] = useState<string | null>(null)
  const print = useCallback(async (selection: PackSelectionBody | undefined, label: string) => {
    setBusy(true); setError(null); setReady(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/document`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        // force: the selection is part of the request, so a cached file for a different selection must never answer it
        body: JSON.stringify({ action: 'generate', kind: 'ACTIONS_PACK', force: true, ...(selection ? { selection } : {}) }),
      })
      const j = (await res.json().catch(() => ({}))) as { document?: { docxUrl: string | null; pdfUrl: string | null; generatedAt: string | null; lastError: string | null }; error?: unknown; message?: string }
      if (!res.ok || !j.document) {
        setError(`Not saved: ${j.message ?? explainFailure(j, res.status, '“Print as an Actions Pack”')}`)
        return
      }
      setReady({ label, docxUrl: j.document.docxUrl, pdfUrl: j.document.pdfUrl, generatedAt: j.document.generatedAt })
    } catch (e) {
      setError(`Not saved: “Print as an Actions Pack” could not reach the server (${e instanceof Error ? e.message : 'network error'}). Nothing was changed.`)
    } finally { setBusy(false) }
  }, [ideaId])
  return { busy, ready, error, print, clear: () => { setReady(null); setError(null) } }
}

export function PackStatus({ s }: { s: ReturnType<typeof usePackPrint> }) {
  if (s.busy) return <p className="text-[11px] text-zinc-700 bg-white border border-zinc-300 rounded px-2 py-1" role="status" data-pack-busy>Building the Actions Pack…</p>
  if (s.error) return <p className="text-xs font-semibold border-2 border-zinc-900 rounded px-2 py-1.5 bg-white" role="alert" data-pack-error>⚠ {s.error} <button type="button" onClick={s.clear} className="ml-1 px-2 py-0.5 rounded border border-zinc-900 bg-zinc-100">OK</button></p>
  if (!s.ready) return null
  return (
    <p className="text-xs border border-zinc-400 rounded px-2 py-1 bg-white flex flex-wrap items-center gap-2" role="status" data-pack-ready>
      <span>✓ The Actions Pack for {s.ready.label} is ready. Every paragraph is numbered.</span>
      {s.ready.docxUrl && <a href={s.ready.docxUrl} className="font-semibold underline">Word</a>}
      {s.ready.pdfUrl && <a href={s.ready.pdfUrl} className="font-semibold underline">PDF</a>}
      <button type="button" onClick={s.clear} className="underline text-zinc-600">OK</button>
    </p>
  )
}
