'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-V2d (BRIEF_26V §7, decision 225) — THE RISKS VIEW: every issue on the idea, grouped BY DOCUMENT, then by action, then the proposal
// as a whole, and answered here (addressed with a note · deferred · dismissed with a reason · reopened). It reads the route's 'risks' op
// and answers through the same triage route the pass cards use.
//
// ⚠ A document is listed even with no issue, with what each pass has read — so "not yet reviewed" and "reviewed, nothing raised" differ.
// ⚠ An answered issue stays on screen, under "answered", with its note or reason — nothing is hidden or deleted.
// ⚠ Shape + word on every state (§21): ● open, ✓ addressed, ◐ deferred, ✕ dismissed, each with its word. Plain words (§0).
// ⚠ Imports only pure modules, types and client components (§28).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import type { RiskIssue, RisksView as RisksData } from '@/lib/lex/document-review'
import { countsLine } from '@/lib/lex/issue-attach-pure'
import { explainFailure } from '@/lib/api-rejection'
import { LIMITS } from '@/lib/lex/input-limits'
import BoundedInput from './BoundedInput'
import { ISSUES_CHANGED_EVENT } from '@/lib/lex/document-review-pure'

const STATE: Record<string, { mark: string; word: string }> = {
  OPEN: { mark: '●', word: 'open' }, ADDRESSED: { mark: '✓', word: 'addressed' }, DEFERRED: { mark: '◐', word: 'deferred' }, DISMISSED: { mark: '✕', word: 'dismissed' },
}
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

export default function RisksView({ ideaId, readOnly = false }: { ideaId: string; readOnly?: boolean }) {
  const [data, setData] = useState<RisksData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [said, setSaid] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await fetch(`/api/ideas/${ideaId}/action-documents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'risks' }) })
    const b = await r.json().catch(() => null)
    if (!r.ok) { setError(explainFailure(b, r.status, 'Reading the risks')); return }
    setData((b as { data: RisksData }).data); setError(null)
  }, [ideaId])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const on = () => void load()
    window.addEventListener(ISSUES_CHANGED_EVENT, on)
    return () => window.removeEventListener(ISSUES_CHANGED_EVENT, on)
  }, [load])

  const answer = useCallback(async (i: RiskIssue, action: 'address' | 'defer' | 'dismiss' | 'reopen', extra: { note?: string; reason?: string } = {}) => {
    setBusyId(i.id); setSaid(null)
    try {
      const r = await fetch(`/api/ideas/${ideaId}/deepening/issues/${i.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }) })
      const b = await r.json().catch(() => null)
      const name = `“${i.title ?? i.text.slice(0, 50)}”`
      if (!r.ok) { setSaid(`Not saved: ${explainFailure(b, r.status, `Answering ${name}`)}`); return false }
      setSaid(`Saved: ${name} is now ${STATE[action === 'address' ? 'ADDRESSED' : action === 'defer' ? 'DEFERRED' : action === 'dismiss' ? 'DISMISSED' : 'OPEN'].word}.`)
      await load()
      window.dispatchEvent(new Event(ISSUES_CHANGED_EVENT))
      return true
    } catch (e) { setSaid(`Not saved: the answer could not reach the server (${e instanceof Error ? e.message : 'network error'}). Nothing was changed.`); return false }
    finally { setBusyId(null) }
  }, [ideaId, load])

  if (error) return <p className="text-xs" role="alert" data-risks-error>Not read: {error} <button type="button" className="underline" onClick={() => void load()}>Read again</button></p>
  if (!data) return <p className="text-xs text-zinc-500">Reading the risks…</p>

  const list = (issues: RiskIssue[], where: 'document' | 'other') => {
    const open = issues.filter((i) => i.status === 'OPEN')
    const done = issues.filter((i) => i.status !== 'OPEN')
    return (
      <>
        {open.length ? <ul className="space-y-1">{open.map((i) => <IssueRow key={i.id} i={i} where={where} busy={busyId === i.id} readOnly={readOnly} answer={answer} />)}</ul>
          : <p className="text-zinc-600">No open issue.</p>}
        {done.length > 0 && (
          <details className="mt-1"><summary className="cursor-pointer text-zinc-700">Answered ({done.length})</summary>
            <ul className="space-y-1 mt-1">{done.map((i) => <IssueRow key={i.id} i={i} where={where} busy={busyId === i.id} readOnly={readOnly} answer={answer} />)}</ul>
          </details>
        )}
      </>
    )
  }

  return (
    <div className="space-y-2 text-xs" data-risks-view>
      <p data-risks-counts>{countsLine(data.counts)}.</p>
      {said && <p className="border border-zinc-300 rounded px-2 py-1" role="status" data-risks-said>{said} <button type="button" className="underline ml-1" onClick={() => setSaid(null)}>OK</button></p>}

      <section className="space-y-1.5" data-risks-group="documents">
        <h4 className="font-bold">By document</h4>
        {!data.documents.length && <p>No document yet. Documents are written or drafted from the tree above.</p>}
        {data.documents.map((d) => (
          <div key={d.id} className="border border-zinc-200 rounded p-1.5 space-y-1" data-risks-document={d.d}>
            <p><span aria-hidden>●</span> <span className="font-semibold">{d.d}</span> {d.title} <span className="text-zinc-600">— {d.kind} · {d.status}{d.v != null ? ` · version ${d.v}` : ' · no version yet'}</span>
              {' · '}<span className="font-semibold">{d.issues.filter((i) => i.status === 'OPEN').length} open</span></p>
            <p className="text-zinc-700" data-risks-reviews={d.reviews.length}>
              {d.reviews.length
                ? <>Reviewed by: {d.reviews.map((r, k) => <span key={r.passKey}>{k ? ' · ' : ''}{r.status === 'RUN' ? '●' : '⚠'} {r.label} (version {r.v}, {day(r.at)}: {r.status === 'RUN' ? `${r.issues} raised` : 'failed'})</span>)}
                  {d.reviews.length < 5 ? ` · ${5 - d.reviews.length} pass${5 - d.reviews.length === 1 ? '' : 'es'} not yet run` : ''}</>
                : 'Not yet reviewed — open the document in the tree above and press “Review this document”.'}
            </p>
            {list(d.issues, 'document')}
          </div>
        ))}
      </section>

      <section className="space-y-1" data-risks-group="actions">
        <h4 className="font-bold">On an action, not on one of its documents</h4>
        {!data.actions.length && <p>None.</p>}
        {data.actions.map((a) => {
          const open = a.issues.filter((i) => i.status === 'OPEN').length
          return (
            <details key={a.id} className="border border-zinc-200 rounded p-1.5" data-risks-action={a.number ?? ''}>
              <summary className="cursor-pointer"><span aria-hidden>■</span> <span className="font-semibold">#{a.number ?? '?'}</span> {a.title.slice(0, 140)} <span className="font-semibold">— {open} open</span>{a.issues.length > open ? `, ${a.issues.length - open} answered` : ''}</summary>
              <div className="mt-1">{list(a.issues, 'other')}</div>
            </details>
          )
        })}
      </section>

      <section data-risks-group="proposal">
        <details className="border border-zinc-200 rounded p-1.5">
          <summary className="cursor-pointer font-bold">The proposal as a whole — {data.proposal.filter((i) => i.status === 'OPEN').length} open{data.proposal.some((i) => i.status !== 'OPEN') ? `, ${data.proposal.filter((i) => i.status !== 'OPEN').length} answered` : ''}</summary>
          <div className="mt-1">{list(data.proposal, 'other')}</div>
        </details>
      </section>
    </div>
  )
}

function IssueRow({ i, where, busy, readOnly, answer }: {
  i: RiskIssue; where: 'document' | 'other'; busy: boolean; readOnly: boolean
  answer: (i: RiskIssue, action: 'address' | 'defer' | 'dismiss' | 'reopen', extra?: { note?: string; reason?: string }) => Promise<boolean>
}) {
  const [mode, setMode] = useState<null | 'address' | 'dismiss'>(null)
  const [text, setText] = useState('')
  const s = STATE[i.status] ?? { mark: '○', word: i.status.toLowerCase() }
  return (
    <li className={`rounded p-1.5 ${i.status === 'OPEN' ? 'border-2 border-zinc-300' : 'border border-zinc-200'}`} data-risk-issue={i.status} data-risk-part={i.part ?? 'whole'}>
      <p><span aria-hidden>{s.mark}</span> <span className="font-semibold">{i.title ?? 'An issue'}</span>
        {where === 'document' && <span> · on {i.part ? `part ${i.part}` : 'the document as a whole'}</span>}
        <span className="text-zinc-600"> · {s.word}</span></p>
      <p className="whitespace-pre-wrap">{i.text}</p>
      <p className="text-zinc-600">Raised by {i.by}{i.olderVersion ? ` · ⚠ ${i.olderVersion}` : ''}{i.placed && !i.placed.startsWith('Raised by') ? ` · placed here: ${i.placed}` : ''}</p>
      {i.status === 'ADDRESSED' && i.resolutionNote && <p>Addressed: {i.resolutionNote}</p>}
      {i.status === 'DISMISSED' && <p>Dismissed: {i.dismissReason}</p>}
      {!readOnly && mode && (
        <div className="space-y-1 mt-1">
          <BoundedInput multiline rows={2} value={text} onChange={setText} max={mode === 'address' ? LIMITS.issueNote : LIMITS.issueDismissReason}
            placeholder={mode === 'address' ? 'How was it dealt with?' : 'Why is this not an issue? (required — it stays on the record)'}
            aria-label={mode === 'address' ? 'How it was dealt with' : 'Why it is dismissed'} className="w-full border border-zinc-300 rounded p-1" wrapperClassName="w-full" />
          <div className="flex gap-2">
            <button type="button" disabled={busy || !text.trim()} className="px-2 py-0.5 rounded bg-zinc-900 text-white disabled:opacity-40"
              onClick={() => void answer(i, mode, mode === 'address' ? { note: text.trim() } : { reason: text.trim() }).then((ok) => { if (ok) { setMode(null); setText('') } })}>
              {mode === 'address' ? 'Save as addressed' : 'Dismiss it'}</button>
            <button type="button" className="underline" onClick={() => { setMode(null); setText('') }}>Cancel</button>
          </div>
        </div>
      )}
      {!readOnly && !mode && (
        <div className="flex flex-wrap gap-2 mt-1">
          {i.status === 'OPEN' ? <>
            <button type="button" disabled={busy} onClick={() => setMode('address')} className="px-2 py-0.5 rounded border border-zinc-300 disabled:opacity-40" data-risk-address>Mark addressed</button>
            <button type="button" disabled={busy} onClick={() => void answer(i, 'defer')} className="px-2 py-0.5 rounded border border-zinc-300 disabled:opacity-40" data-risk-defer>Defer</button>
            <button type="button" disabled={busy} onClick={() => setMode('dismiss')} className="px-2 py-0.5 rounded border border-zinc-300 disabled:opacity-40" data-risk-dismiss>Dismiss…</button>
          </> : <button type="button" disabled={busy} onClick={() => void answer(i, 'reopen')} className="underline disabled:opacity-40" data-risk-reopen>Reopen</button>}
        </div>
      )}
    </li>
  )
}
