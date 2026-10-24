'use client'

// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-V2b (decision 243, BRIEF_26V §5) — "DRAFT WHAT THIS HEADING NEEDS" ON THE SCREEN.
//
//   DraftPlanDialog — lists the missing documents by action and kind, each with its MEASURED price (or "free" for a generated one), and the
//                     ones left out with why; one button, "Draft these — about Np", which is the ask (§0: asks first). Spends nothing until
//                     pressed; the server re-reckons the price and refuses if it rose.
//   DraftRunLine    — the run's progress in words at the top of the tree, polled while anything is waiting or drafting; a run already going
//                     when the page opens is picked up (the drafting is on the worker, so closing the tab loses nothing).
// ⚠ Colour is never the only cue (docs/CLAUDE.md §21): every row carries a shape and its state in words.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react'
import { KIND_WORD } from '@/lib/lex/action-documents-pure'
import { JOB_SHAPE, priceWords, type DraftPlan } from '@/lib/lex/document-drafting-pure'
import type { DraftRunView } from '@/lib/lex/document-drafting'
import { explainFailure } from '@/lib/api-rejection'
import FocusDialog from './FocusDialog'

export type DraftScopeInput = { headingId: string | null; label: string } | { actionId: string; label: string }

async function postDocs(ideaId: string, payload: Record<string, unknown>, label: string): Promise<{ data: unknown } | { error: string }> {
  const res = await fetch(`/api/ideas/${ideaId}/action-documents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  const body = await res.json().catch(() => null)
  if (!res.ok) return { error: explainFailure(body, res.status, label) }
  return { data: (body as { data: unknown }).data }
}

export function DraftPlanDialog({ ideaId, scope, onClose, onQueued }: { ideaId: string; scope: DraftScopeInput; onClose: () => void; onQueued: (runId: string, said: string) => void }) {
  const [plan, setPlan] = useState<(DraftPlan & { scope: string }) | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const where = 'actionId' in scope ? { actionId: scope.actionId } : { headingId: scope.headingId }

  useEffect(() => {
    void (async () => {
      const r = await postDocs(ideaId, { op: 'draftPlan', ...where }, 'Listing what needs drafting')
      if ('error' in r) setError(r.error); else setPlan(r.data as DraftPlan & { scope: string })
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ideaId])

  const go = async () => {
    if (!plan) return
    setBusy(true); setError(null)
    try {
      const r = await postDocs(ideaId, { op: 'draftQueue', ...where, agreedPence: plan.pence }, 'Starting the drafting')
      if ('error' in r) { setError(r.error); return }
      const d = r.data as { runId: string; queued: number; alreadyWaiting: number }
      onQueued(d.runId, `Started: ${d.queued} document${d.queued === 1 ? '' : 's'} queued for Lex${d.alreadyWaiting ? ` (${d.alreadyWaiting} already waiting from an earlier run)` : ''}. Each is saved as a proposal as it finishes; you can close this page.`)
    } finally { setBusy(false) }
  }

  const title = 'actionId' in scope ? `Draft what ${scope.label} needs` : `Draft what “${scope.label}” needs`
  return (
    <FocusDialog title={title} onClose={onClose} wide
      footer={plan && plan.items.length ? (
        <button type="button" disabled={busy} onClick={() => void go()} data-draft-go className="px-3 py-1 rounded bg-zinc-900 text-white text-sm disabled:opacity-40">
          {busy ? 'Starting…' : `Draft these — about ${priceWords(plan.pence)}`}
        </button>
      ) : undefined}>
      <div className="space-y-2 text-sm" data-draft-plan>
        {error && <p role="alert" className="border border-zinc-400 rounded px-2 py-1">Not done: {error}</p>}
        {!plan && !error && <p className="text-zinc-500">Listing what is missing…</p>}
        {plan && (
          <>
            <p className="font-semibold">{plan.line}</p>
            {plan.items.length > 0 && (
              <ul className="space-y-0.5">{plan.items.map((i) => (
                <li key={`${i.actionId}:${i.kind}`} className="text-xs" data-draft-item={i.kind}>
                  <span aria-hidden>○</span> #{i.number ?? '?'} — {KIND_WORD[i.kind]} — {i.free ? 'generated, free' : `about ${priceWords(i.pence ?? 0)} (measured, n=${i.n})`}
                </li>
              ))}</ul>
            )}
            {plan.leftOut.length > 0 && (
              <details className="text-xs"><summary className="cursor-pointer">Not in this run: {plan.leftOut.length}</summary>
                <ul className="mt-1 space-y-0.5">{plan.leftOut.map((l) => (
                  <li key={`${l.actionId}:${l.kind}`} data-draft-left-out={l.kind}><span aria-hidden>–</span> #{l.number ?? '?'} — {KIND_WORD[l.kind]}: {l.why}</li>
                ))}</ul>
              </details>
            )}
            <p className="text-xs text-zinc-600">Lex drafts on the server, one document at a time. Every result is a proposal beside the document: nothing is written over what is there. The price is the average of measured runs; the run shows what each one actually cost.</p>
          </>
        )}
      </div>
    </FocusDialog>
  )
}

export function DraftRunLine({ ideaId, runId, onProgress }: { ideaId: string; runId: string | null; onProgress: () => void }) {
  const [view, setView] = useState<DraftRunView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [said, setSaid] = useState<string | null>(null)
  const settled = useRef(-1)

  const read = useCallback(async () => {
    const r = await postDocs(ideaId, { op: 'draftRun', ...(runId ? { runId } : {}) }, 'Reading the drafting run')
    if ('error' in r) { setError(r.error); return null }
    const v = r.data as DraftRunView | null
    setView(v); setError(null)
    const n = v ? v.items.filter((i) => i.status !== 'QUEUED' && i.status !== 'RUNNING').length : 0
    if (settled.current >= 0 && n !== settled.current) onProgress()
    settled.current = n
    return v
  }, [ideaId, runId, onProgress])

  useEffect(() => {
    let stop = false
    let t: ReturnType<typeof setTimeout> | null = null
    const tick = async () => { const v = await read(); if (!stop && v && !v.finished) t = setTimeout(() => void tick(), 5000) }
    void tick()
    return () => { stop = true; if (t) clearTimeout(t) }
  }, [read])

  if (error) return <p className="text-xs" role="alert">The drafting run could not be read: {error}</p>
  if (!view) return null
  // an old, finished run is not news: show it only when this page started it
  if (view.finished && !runId) return null
  const stop = async () => {
    const r = await postDocs(ideaId, { op: 'draftStop', runId: view.runId }, 'Stopping the drafting run')
    setSaid('error' in r ? `Not done: ${r.error}` : `Stopped: ${(r.data as { stopped: number }).stopped} waiting document(s) will not be drafted. The one drafting now finishes.`)
    void read()
  }
  return (
    <div className="border-2 border-zinc-900 rounded px-2 py-1.5 text-xs space-y-1" data-draft-run role="status">
      <p className="font-semibold">Drafting what is needed — {view.line}</p>
      <details><summary className="cursor-pointer">Each document</summary>
        <ul className="mt-1 space-y-0.5">{view.items.map((i) => (
          <li key={i.id} data-draft-run-item={i.status}>
            <span aria-hidden>{JOB_SHAPE[i.status]}</span> #{i.number ?? '?'} {KIND_WORD[i.kind]} — <span className="font-semibold">{i.word}</span>
            {i.pence != null && i.pence > 0 ? ` · cost ${priceWords(i.pence)}` : ''}{i.outcome ? ` · ${i.outcome}` : ''}
          </li>
        ))}</ul>
      </details>
      {!view.finished && <button type="button" className="underline" onClick={() => void stop()}>Stop the waiting ones</button>}
      {said && <p>{said}</p>}
    </div>
  )
}
