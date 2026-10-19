'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-T2 §6 (decision 147) — "COMMENTS", at the foot of an action's record.
//
// A comment is a research-notebook note bearing on this action, so the notebook's own rules apply and nothing new is invented:
//   · nobody edits another person's words — you reply beneath;  · nothing here deletes;  · everyone who can see the idea sees the thread.
// ⚠ A comment from someone other than the owner waits, in words, to be put in the record; only the record reaches a document.
// ⚠ "Ask Lex to summarise" returns text to THIS SCREEN and stores nothing. Lex never writes into a thread unasked.
// ⚠ Every input shows its limit (BoundedInput); every refusal reads "Not saved: ..." (CLAUDE.md §30).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useState } from 'react'
import { explainFailure } from '@/lib/api-rejection'
import { LIMITS } from '@/lib/lex/input-limits'
import BoundedInput from './BoundedInput'
import type { NoteView } from '@/lib/lex/research-notes'

const when = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const STANCE: Record<string, string> = { SUPPORTS: 'supports', CONTRADICTS: 'contradicts', CONTEXT: 'context', UNDECIDED: 'undecided' }

export default function ActionComments({ ideaId, actionId, number }: { ideaId: string; actionId: string; number: number | null }) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState<NoteView[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [replies, setReplies] = useState<Record<string, string>>({})
  const [summary, setSummary] = useState<{ text: string; pence: number | null } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/action-thread?actionId=${encodeURIComponent(actionId)}`)
      const j = (await res.json().catch(() => ({}))) as { notes?: NoteView[]; error?: unknown }
      if (!res.ok || !j.notes) { setError(`Could not read the comments: ${explainFailure(j, res.status, 'Reading the comments').replace(/^Not saved: /, '')}`); return }
      setNotes(j.notes)
    } catch (e) { setError(`Could not read the comments: ${e instanceof Error ? e.message : 'network error'}.`) }
  }, [ideaId, actionId])

  const post = async (url: string, body: Record<string, unknown>, control: string): Promise<{ ok: boolean; result?: unknown }> => {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: unknown; error?: unknown }
      if (j.error || !res.ok) { setError(`Not saved: ${explainFailure(j, res.status, control)}`); return { ok: false } }
      return { ok: true, result: j.result }
    } catch (e) { setError(`Not saved: ${control} could not reach the server (${e instanceof Error ? e.message : 'network error'}). Nothing was changed.`); return { ok: false } }
  }

  const addComment = async () => {
    const text = draft.trim()
    if (!text) return
    setBusy('add'); setError(null)
    const r = await post(`/api/ideas/${ideaId}/research-notebook`, {
      op: 'addNote', ownObservation: true, comment: text, stance: 'CONTEXT', tags: ['comment'],
      bearsOn: [{ kind: 'action', id: actionId, label: `Action ${number ?? '?'}` }],
    }, '“Add comment”')
    if (r.ok) { setDraft(''); await load() }
    setBusy(null)
  }
  const sendReply = async (noteId: string) => {
    const text = (replies[noteId] ?? '').trim()
    if (!text) return
    setBusy(noteId); setError(null)
    const r = await post(`/api/ideas/${ideaId}/research-notebook`, { op: 'reply', noteId, text }, '“Reply”')
    if (r.ok) { setReplies((s) => ({ ...s, [noteId]: '' })); await load() }
    setBusy(null)
  }
  const summarise = async () => {
    setBusy('summary'); setError(null)
    const r = await post(`/api/ideas/${ideaId}/action-thread`, { op: 'summarise', actionId }, '“Ask Lex to summarise”')
    if (r.ok) { const x = r.result as { summary: string; pence: number | null }; setSummary({ text: x.summary, pence: x.pence }) }
    setBusy(null)
  }

  const count = notes?.length
  return (
    <details open={open} onToggle={(e) => { const o = (e.currentTarget as HTMLDetailsElement).open; setOpen(o); if (o && notes === null) void load() }} className="rounded border border-zinc-300 bg-white" data-action-comments={actionId}>
      <summary className="cursor-pointer px-2 py-1 text-[11px] font-semibold text-zinc-800">Comments{count != null ? ` (${count})` : ''} <span className="font-normal text-zinc-500">— on #{number ?? '?'}; everyone who can see this idea sees them</span></summary>
      <div className="px-2 pb-2 pt-1 space-y-2 text-xs">
        {error && <p className="font-semibold border-2 border-zinc-900 rounded px-2 py-1" role="alert">⚠ {error} <button type="button" onClick={() => setError(null)} className="ml-1 px-2 py-0.5 rounded border border-zinc-900 bg-zinc-100">OK</button></p>}
        {notes === null && !error && <p className="text-zinc-500">Reading the comments…</p>}
        {notes && notes.length === 0 && <p className="text-zinc-600">No comments yet. Write the first below.</p>}
        {notes && notes.map((n) => {
          const isComment = n.tags.some((t) => t.toLowerCase() === 'comment')
          return (
            <div key={n.id} className="rounded border border-zinc-200 p-1.5" data-comment>
              <p className="text-[11px] text-zinc-600"><span className="font-semibold text-zinc-900">{n.authorName}</span>, {when(n.createdAt)}
                {!isComment && n.source && <> · research note <span className="font-semibold">[Ref: {n.source.number}]</span> {STANCE[n.stance] ?? n.stance}</>}
                {' · '}{n.status === 'IN_RECORD' ? 'in the record' : n.status === 'UNREVIEWED' ? 'waiting for the owner to put it in the record' : 'set aside'}
              </p>
              {n.quote && <p className="italic mt-0.5">“{n.quote}”</p>}
              {n.comment && <p className="mt-0.5 whitespace-pre-wrap">{n.comment}</p>}
              {n.replies.length > 0 && (
                <ul className="mt-1 ml-3 pl-2 border-l-2 border-zinc-300 space-y-1">
                  {n.replies.map((r) => <li key={r.id}><span className="font-semibold">{r.authorName}</span>, {when(r.createdAt)}: <span className="whitespace-pre-wrap">{r.text}</span></li>)}
                </ul>
              )}
              <div className="mt-1 flex flex-wrap items-start gap-1.5">
                <BoundedInput value={replies[n.id] ?? ''} onChange={(v) => setReplies((s) => ({ ...s, [n.id]: v }))} max={LIMITS.actionReply} multiline rows={2} placeholder="Reply beneath (you cannot change what someone else wrote)" aria-label={`Reply to the comment by ${n.authorName}`} className="text-xs border border-zinc-300 rounded px-1.5 py-0.5 w-72 max-w-full" />
                <button type="button" disabled={busy != null || !(replies[n.id] ?? '').trim()} onClick={() => void sendReply(n.id)} className="text-[11px] font-medium px-2 py-0.5 rounded border border-zinc-300 disabled:opacity-40">Reply</button>
              </div>
            </div>
          )
        })}
        <div className="flex flex-wrap items-start gap-1.5" data-comment-add>
          <BoundedInput value={draft} onChange={setDraft} max={LIMITS.actionComment} multiline rows={3} placeholder="Add a comment on this action" aria-label={`Add a comment on action ${number ?? ''}`} className="text-xs border border-zinc-300 rounded px-1.5 py-0.5 w-96 max-w-full" />
          <button type="button" disabled={busy != null || !draft.trim()} onClick={() => void addComment()} className="text-[11px] font-medium px-2 py-1 rounded bg-zinc-900 text-white disabled:opacity-40" data-comment-save>Add comment</button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy != null || !notes?.length} onClick={() => void summarise()} title="Lex reads this thread and tells you what was said. It is shown here and stored nowhere; it is never written into the thread. Costs under 1p (estimate)." className="text-[11px] font-medium px-2 py-0.5 rounded border border-zinc-300 disabled:opacity-40">Ask Lex to summarise this thread</button>
          <span className="text-[10px] text-zinc-500">estimate: under 1p</span>
          {busy === 'summary' && <span className="text-[11px] font-semibold" role="status">Lex is reading the thread…</span>}
        </div>
        {summary && (
          <div className="rounded border border-zinc-400 bg-zinc-50 p-1.5" data-thread-summary>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Lex’s summary — not part of the thread; nothing was written{summary.pence != null ? ` · cost ${summary.pence < 1 ? summary.pence.toFixed(2) : summary.pence.toFixed(1)}p (measured on this run)` : ''}</p>
            <p className="mt-0.5 whitespace-pre-wrap">{summary.text}</p>
            <button type="button" onClick={() => setSummary(null)} className="mt-0.5 text-[11px] underline text-zinc-600">Dismiss</button>
          </div>
        )}
      </div>
    </details>
  )
}
