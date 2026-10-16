'use client'

// 26-S decision 154 — the feedback admin list. Newest first; status (New / Looked at / Fixed / Not doing, a word AND a glyph) and
// notes per item; attachments open through a signed link; a bug report shows its technical block VERBATIM.

import { useCallback, useEffect, useState } from 'react'
import { FEEDBACK_STATUSES, FEEDBACK_STATUS_UI, type FeedbackItemRow, type FeedbackStatus } from '@/lib/lex/feedback-admin-types'
import { explainFailure } from '@/lib/api-rejection'

export default function FeedbackItemsAdmin() {
  const [items, setItems] = useState<FeedbackItemRow[] | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [filter, setFilter] = useState<FeedbackStatus | 'ALL'>('ALL')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/feedback-items').catch(() => null)
    if (!res?.ok) { setError(res ? explainFailure(await res.json().catch(() => ({})), res.status, 'Loading the feedback list') : 'The feedback list could not be reached.'); return }
    const j = await res.json(); setItems(j.items); setCounts(j.counts); setError(null)
  }, [])
  useEffect(() => { void load() }, [load])

  if (error) return <p className="text-sm font-semibold text-amber-800" role="alert">⚠ {error}</p>
  if (!items) return <p className="text-sm text-zinc-600">Loading…</p>
  const shown = filter === 'ALL' ? items : items.filter((i) => i.status === filter)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs" role="tablist" aria-label="Filter by status">
        {(['ALL', ...FEEDBACK_STATUSES] as const).map((s) => (
          <button key={s} role="tab" aria-selected={filter === s} onClick={() => setFilter(s)}
            className={`px-2.5 py-1 rounded-lg border ${filter === s ? 'bg-zinc-900 text-white font-semibold border-zinc-900' : 'border-zinc-300 bg-white'}`}>
            {s === 'ALL' ? `All (${items.length})` : `${FEEDBACK_STATUS_UI[s].glyph} ${FEEDBACK_STATUS_UI[s].word} (${counts[s] ?? 0})`}
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="text-sm text-zinc-600">{items.length === 0 ? 'No feedback has been sent yet.' : 'Nothing with that status.'}</p>}
      <ul className="space-y-3">{shown.map((i) => <Item key={i.id} item={i} onSaved={load} />)}</ul>
    </div>
  )
}

function Item({ item, onSaved }: { item: FeedbackItemRow; onSaved: () => Promise<void> }) {
  const [status, setStatus] = useState<FeedbackStatus>(item.status)
  const [notes, setNotes] = useState(item.adminNotes)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const dirty = status !== item.status || notes !== item.adminNotes

  const save = async () => {
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/admin/feedback-items', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, status, adminNotes: notes }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || j.error) { setMsg(explainFailure(j, res.status, 'Saving the feedback status')); return }
      setMsg('Saved.'); await onSaved()
    } finally { setBusy(false) }
  }

  return (
    <li className="rounded-lg border border-zinc-300 bg-white p-3" data-feedback-id={item.id}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-zinc-600">
        <span className="font-semibold text-zinc-900">{item.isBugReport ? '🐞 Bug / error report' : item.surface}</span>
        <span>{item.userRef}</span><span>{new Date(item.createdAt).toISOString().replace('T', ' ').slice(0, 16)} UTC</span>
        <span>on “{item.ideaTitle}” · {item.stage}</span>
        <span className="font-semibold text-zinc-900">{FEEDBACK_STATUS_UI[item.status].glyph} {FEEDBACK_STATUS_UI[item.status].word}</span>
      </div>
      <p className="mt-1.5 text-sm text-zinc-900 whitespace-pre-wrap">{item.summarisedText}</p>
      {item.userEdited && <p className="text-[11px] text-zinc-500">The sender edited this wording.</p>}
      <details className="mt-1 text-xs"><summary className="cursor-pointer underline">What they originally wrote</summary><p className="mt-1 whitespace-pre-wrap text-zinc-700">{item.originalText}</p></details>
      {item.isBugReport && (
        <div className="mt-1.5">
          <p className="text-[11px] font-semibold text-zinc-700">Technical detail (verbatim)</p>
          <pre className="mt-0.5 max-h-60 overflow-auto rounded bg-zinc-50 border border-zinc-200 p-2 text-[11px] whitespace-pre-wrap">{item.technicalDetail ? JSON.stringify(item.technicalDetail, null, 2) : '(none was sent with this report)'}</pre>
        </div>
      )}
      {item.attachments.length > 0 && (
        <p className="mt-1.5 text-xs">Attachments: {item.attachments.map((a, k) => (
          <a key={k} href={`/api/admin/feedback-items/attachment?id=${item.id}&index=${k}`} target="_blank" rel="noopener noreferrer" className="underline mr-3">{a.name} ({Math.round(a.bytes / 1024)} KB)</a>
        ))}</p>
      )}
      <p className="mt-1 text-[11px] text-zinc-500">{item.sentAt ? `Emailed ${new Date(item.sentAt).toISOString().slice(0, 16).replace('T', ' ')} UTC.` : 'Not emailed.'}{item.sendError ? ` Send error: ${item.sendError}` : ''}</p>
      <div className="mt-2 flex flex-wrap items-start gap-2">
        <label className="text-xs">Status
          <select value={status} onChange={(e) => setStatus(e.target.value as FeedbackStatus)} className="ml-1 border border-zinc-300 rounded px-1.5 py-1">
            {FEEDBACK_STATUSES.map((s) => <option key={s} value={s}>{FEEDBACK_STATUS_UI[s].glyph} {FEEDBACK_STATUS_UI[s].word}</option>)}
          </select>
        </label>
        <label className="text-xs flex-1 min-w-[14rem]">Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={4000} className="mt-0.5 w-full border border-zinc-300 rounded px-1.5 py-1" />
        </label>
        <button type="button" disabled={!dirty || busy} onClick={() => void save()} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-zinc-900 text-white disabled:opacity-40">Save</button>
      </div>
      {msg && <p className="mt-1 text-[11px] text-zinc-700" role="status">{msg}</p>}
    </li>
  )
}
