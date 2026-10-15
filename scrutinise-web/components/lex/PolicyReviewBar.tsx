'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-S §6 (decision 150) — "4 proposals and 2 of your notes bear on this policy · Review"
//
// On the Guiding Policy header. Opens a list of what bears on the policy: update-pass findings (contradicts first, boxed and marked —
// never by colour alone) and notebook notes whose bears-on includes the policy. Each can be accepted; or dismissed, or set aside,
// and BOTH of those need a reason (kept — why something was not taken is itself research). A set-aside item leaves the default list,
// keeps its reason, shows in the notebook as "considered, not taken", and can be brought back from here.
//
// ⚠ No value import of the server library (docs/CLAUDE.md §28): the sentence comes from the route (`headerSentence`), so the words
// this prints are the words the check reads.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import type { PolicyReviewRequest } from '@/lib/lex/policy-review-schema'
import { explainFailure } from '@/lib/api-rejection'

interface Finding { id: string; kind: string; title: string; body: string; target: string | null; citation: string | null; url: string | null }
interface Note { id: string; title: string; quote: string | null; comment: string | null; ref: number | null; stance: string; status: string; mine: boolean; authorName: string; setAsideReason: string | null }
interface SetAsideFinding { id: string; kind: string; title: string; reason: string }
interface Review {
  findings: Finding[]; notes: Note[]
  setAside: { findings: SetAsideFinding[]; notes: Note[] }
  counts: { proposals: number; notes: number }
  sentence: string | null
  viewer?: { id: string; isOwner: boolean }
}

const KIND: Record<string, string> = { CONTRADICTS: 'Contradicts', SUPPORTS: 'Supports', NEW_CAUSE: 'Suggests a new cause', NEW_POLICY_OPTION: 'Suggests a new approach' }
const MIN = 3

export default function PolicyReviewBar({ ideaId, onChanged }: { ideaId: string; onChanged?: () => void }) {
  const [data, setData] = useState<Review | null>(null)
  const [open, setOpen] = useState(false)
  const [showAside, setShowAside] = useState(false)
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/ideas/${ideaId}/policy-review`).catch(() => null)
    if (res?.ok) setData(await res.json())
  }, [ideaId])
  useEffect(() => { void load() }, [load])

  const call = async (body: PolicyReviewRequest, control: string) => {
    setBusy(control); setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/policy-review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = (await res.json().catch(() => ({}))) as { error?: unknown; review?: Review }
      if (j.error || !res.ok) { setError(explainFailure(j, res.status, control)); return }
      if (j.review) setData(j.review)
      setReasons({})
      onChanged?.()
    } catch (e) {
      setError(`${control} could not reach the server (${e instanceof Error ? e.message : 'network error'}). Nothing was changed.`)
    } finally { setBusy(null) }
  }

  if (!data) return null
  const asideCount = data.setAside.findings.length + data.setAside.notes.length
  if (!data.sentence && asideCount === 0) return null
  const reasonFor = (k: string) => reasons[k] ?? ''
  const reasonOk = (k: string) => reasonFor(k).trim().length >= MIN
  const setReason = (k: string, v: string) => setReasons((r) => ({ ...r, [k]: v }))
  const isOwner = !!data.viewer?.isOwner

  return (
    <div className="mt-2 rounded-lg border border-zinc-300 bg-zinc-50" id="policy-review">
      <div className="px-3 py-2 flex flex-wrap items-center gap-2">
        {data.sentence
          ? <p className="text-xs font-semibold text-zinc-900" role="status">{data.sentence} · <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="underline">{open ? 'Close' : 'Review'}</button></p>
          : <p className="text-xs text-zinc-700">Nothing now bears on this policy. <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="underline">{open ? 'Close' : `Considered, not taken (${asideCount})`}</button></p>}
      </div>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-zinc-200 pt-2">
          {error && <p className="text-xs font-semibold text-amber-800" role="alert">⚠ {error}</p>}
          {busy && <p className="text-[11px] text-zinc-600" role="status">Working: {busy}…</p>}

          {data.findings.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Proposals from your documents and research</p>
              {data.findings.map((f) => {
                const k = `f:${f.id}`
                const contra = f.kind === 'CONTRADICTS'
                return (
                  <div key={f.id} className={`rounded-lg bg-white p-2.5 ${contra ? 'border-2 border-zinc-900' : 'border border-zinc-200'}`} data-finding-id={f.id}>
                    <p className="text-[11px] font-semibold text-zinc-800">{contra ? '⚠ ' : ''}{KIND[f.kind] ?? f.kind}{f.target ? <span className="font-normal text-zinc-500"> — {f.target}</span> : null}</p>
                    <p className="text-sm font-medium text-zinc-900 mt-0.5">{f.title}</p>
                    <p className="text-xs text-zinc-700 mt-0.5 whitespace-pre-wrap">{f.body}</p>
                    {f.citation && <p className="text-[11px] text-zinc-500 mt-0.5">Source: {f.citation}</p>}
                    <ReasonRow k={k} value={reasonFor(k)} onChange={(v) => setReason(k, v)} />
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      <button type="button" disabled={!!busy} onClick={() => void call({ op: 'accept', evidenceId: f.id }, 'Accept')} className="text-xs font-semibold px-3 py-1 rounded-full bg-zinc-900 text-white disabled:opacity-40">Accept</button>
                      <button type="button" disabled={!!busy || !reasonOk(k)} title={reasonOk(k) ? undefined : 'Give a reason first — it is kept.'} onClick={() => void call({ op: 'dismiss', evidenceId: f.id, reason: reasonFor(k) }, 'Dismiss')} className="text-xs font-medium px-3 py-1 rounded-full border border-zinc-300 disabled:opacity-40">Dismiss</button>
                      <button type="button" disabled={!!busy || !reasonOk(k)} title={reasonOk(k) ? undefined : 'Give a reason first — it is kept.'} onClick={() => void call({ op: 'setAside', evidenceId: f.id, reason: reasonFor(k) }, 'Set aside')} className="text-xs font-medium px-3 py-1 rounded-full border border-zinc-300 disabled:opacity-40">Set aside</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {data.notes.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Notes from your notebook that bear on the policy</p>
              {data.notes.map((n) => {
                const k = `n:${n.id}`
                return (
                  <div key={n.id} className="rounded-lg border border-zinc-200 bg-white p-2.5" data-note-id={n.id}>
                    <p className="text-[11px] text-zinc-500">{n.mine ? 'Your note' : `${n.authorName}’s note`}{n.ref ? ` · [Ref: ${n.ref}]` : ''} · {n.stance.toLowerCase()} · {n.status === 'IN_RECORD' ? 'in the record' : 'not yet in the record'}</p>
                    <p className="text-sm text-zinc-900 mt-0.5">{n.quote ? `“${n.quote}”` : n.comment}</p>
                    {n.quote && n.comment && <p className="text-xs text-zinc-700 mt-0.5">{n.comment}</p>}
                    <ReasonRow k={k} value={reasonFor(k)} onChange={(v) => setReason(k, v)} />
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {n.status === 'UNREVIEWED' && isOwner && <button type="button" disabled={!!busy} onClick={() => void call({ op: 'noteAccept', noteId: n.id }, 'Put in the record')} className="text-xs font-semibold px-3 py-1 rounded-full bg-zinc-900 text-white disabled:opacity-40">Accept — put in the record</button>}
                      <button type="button" disabled={!!busy || !reasonOk(k)} title={reasonOk(k) ? undefined : 'Give a reason first — it is kept beneath the note.'} onClick={() => void call({ op: 'noteNotOnPolicy', noteId: n.id, reason: reasonFor(k) }, 'Dismiss')} className="text-xs font-medium px-3 py-1 rounded-full border border-zinc-300 disabled:opacity-40">Dismiss — it does not bear on the policy</button>
                      <button type="button" disabled={!!busy || !reasonOk(k)} title={reasonOk(k) ? undefined : 'Give a reason first — it is kept.'} onClick={() => void call({ op: 'noteSetAside', noteId: n.id, reason: reasonFor(k) }, 'Set aside')} className="text-xs font-medium px-3 py-1 rounded-full border border-zinc-300 disabled:opacity-40">Set aside</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {asideCount > 0 && (
            <div>
              <button type="button" onClick={() => setShowAside(!showAside)} aria-expanded={showAside} className="text-xs font-semibold underline">Considered, not taken ({asideCount})</button>
              {showAside && (
                <ul className="mt-1 space-y-1.5">
                  {data.setAside.findings.map((f) => (
                    <li key={f.id} className="text-xs text-zinc-800 flex flex-wrap items-start gap-2">
                      <span className="flex-1 min-w-[12rem]"><strong>{f.title}</strong> — <span className="text-zinc-600">{f.reason}</span></span>
                      <button type="button" disabled={!!busy} onClick={() => void call({ op: 'restore', evidenceId: f.id }, 'Bring back')} className="underline">Bring back</button>
                    </li>
                  ))}
                  {data.setAside.notes.map((n) => (
                    <li key={n.id} className="text-xs text-zinc-800 flex flex-wrap items-start gap-2">
                      <span className="flex-1 min-w-[12rem]"><strong>{n.title}</strong> — <span className="text-zinc-600">{n.setAsideReason ?? 'no reason recorded'}</span></span>
                      <button type="button" disabled={!!busy} onClick={() => void call({ op: 'noteRestore', noteId: n.id }, 'Bring back')} className="underline">Bring back</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ReasonRow({ k, value, onChange }: { k: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mt-1.5">
      <label className="sr-only" htmlFor={`why-${k}`}>Reason (needed to dismiss or set aside)</label>
      <input id={`why-${k}`} value={value} maxLength={600} onChange={(e) => onChange(e.target.value)} placeholder="Reason (needed to dismiss or set aside — it is kept)"
        className="w-full text-xs border border-zinc-300 rounded px-2 py-1" />
    </div>
  )
}
