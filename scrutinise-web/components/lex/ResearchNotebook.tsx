'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-R — THE RESEARCH NOTEBOOK: a titles-only list, regroupable, open in place, with a team underneath it from the first row.
//
//   · DEFAULT VIEW IS THE USER'S OWN NOTES. Lex's findings are labelled Lex's and are a toggle away (decision 129).
//   · Group by source · by what it bears on · by stance (the for and the against side by side) · timeline · by author.
//   · A note opens in place: its quote and where it is from, the comment, the source, replies beneath it. NOBODY EDITS ANOTHER PERSON'S
//     COMMENT — others reply (the server refuses otherwise, in words).
//   · Select several: set a stance, add tags, set aside with a reason. NOTHING DELETES; a set-aside note keeps its reason, which is
//     itself research, and comes back with one press.
//   · A STANCE IS A WORD AND A SHAPE, never colour alone (CLAUDE.md §21). Status is a word. Private ("mine only") is a word.
// ⚠ Every rejection arrives worded by the server (CLAUDE.md §30); `explainFailure` words anything it did not.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'
import AddResearch from './AddResearch'
import { groupNotes, noteTitle, noteMatches, VIEW_MODES, VIEW_LABEL, type ViewMode } from '@/lib/lex/research-notebook-views'
import {
  STANCES, STANCE_LABEL, STANCE_GLYPH, STATUS_LABEL, BEARS_ON_LABEL, OP_WORDS, type NotebookRequest, type Stance,
} from '@/lib/lex/research-notebook-schema'
import { explainFailure } from '@/lib/api-rejection'
import type { NoteView } from '@/lib/lex/research-notes'

interface Payload { notes: NoteView[]; lexCount: number; ownCount: number; setAsideCount: number; viewer: { id: string; isOwner: boolean } }

export default function ResearchNotebook({ ideaId, compact = false }: { ideaId: string; compact?: boolean }) {
  const [data, setData] = useState<Payload | null>(null)
  const [mode, setMode] = useState<ViewMode>('source')
  const [showLex, setShowLex] = useState(false)
  const [showAside, setShowAside] = useState(false)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [tagInput, setTagInput] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/research-notebook?lex=${showLex ? 1 : 0}&setAside=${showAside ? 1 : 0}`)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(explainFailure(j, res.status, 'Loading the notebook')); return }
      setData(j as Payload); setError(null)
    } catch (e) { setError(`Loading the notebook could not reach the server (${e instanceof Error ? e.message : 'network error'}).`) }
  }, [ideaId, showLex, showAside])
  useEffect(() => { void load() }, [load])

  const call = useCallback(async (req: NotebookRequest, label?: string): Promise<boolean> => {
    setBusy(label ?? OP_WORDS[req.op]); setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/research-notebook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.ok) { setError(explainFailure(j, res.status, OP_WORDS[req.op])); return false }
      await load(); return true
    } catch (e) { setError(`${OP_WORDS[req.op]} could not reach the server (${e instanceof Error ? e.message : 'network error'}). Nothing was changed.`); return false } finally { setBusy(null) }
  }, [ideaId, load])

  const notes = useMemo(() => (data?.notes ?? []).filter((n) => noteMatches(n, q)), [data, q])
  const groups = useMemo(() => groupNotes(notes, mode), [notes, mode])
  const toggle = (set: Set<string>, id: string) => { const n = new Set(set); n.has(id) ? n.delete(id) : n.add(id); return n }
  const selIds = [...sel].filter((id) => !id.startsWith('lex:') && (data?.notes ?? []).some((n) => n.id === id))

  if (!data) return <p className="text-xs text-zinc-500">{error ?? 'Loading the notebook…'}</p>

  const NoteRow = (n: NoteView) => {
    const isOpen = open.has(n.id)
    return (
      <li key={`${n.id}`} className={`rounded-lg border bg-white ${n.status === 'SET_ASIDE' ? 'border-dashed border-zinc-300' : 'border-zinc-200'}`}>
        <div className="flex items-start gap-1.5 px-2 py-1.5">
          {!n.lex && <input type="checkbox" checked={sel.has(n.id)} onChange={() => setSel(toggle(sel, n.id))} aria-label="Select note" className="mt-1 w-4 h-4 accent-zinc-900 shrink-0" />}
          <div className="flex-1 min-w-0">
            <button type="button" onClick={() => setOpen(toggle(open, n.id))} aria-expanded={isOpen} className="text-left w-full">
              <span className="text-sm text-zinc-900">{noteTitle(n)}</span>
              <span className="text-[11px] text-zinc-400 ml-1.5">{isOpen ? 'close −' : 'open +'}</span>
            </button>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-zinc-500 items-center">
              {n.source && <span className="font-medium text-zinc-700">[Ref: {n.source.number}]</span>}
              <span><span aria-hidden>{STANCE_GLYPH[n.stance]}</span> {STANCE_LABEL[n.stance]}</span>
              {n.lex ? <span className="font-semibold text-zinc-700">Lex’s finding</span> : n.authorKind === 'LEX' ? <span className="font-semibold text-zinc-700">written by Lex</span> : <span>{n.mine ? 'you' : n.authorName}</span>}
              {!n.lex && n.status !== 'IN_RECORD' && <span className="font-semibold text-zinc-700">{STATUS_LABEL[n.status]}</span>}
              {n.mineOnly && <span className="font-semibold">mine only</span>}
              {n.tags.map((t) => <span key={t} className="border border-zinc-200 rounded px-1">#{t}</span>)}
              {n.replies.length > 0 && <span>{n.replies.length} repl{n.replies.length === 1 ? 'y' : 'ies'}</span>}
            </div>
          </div>
        </div>
        {isOpen && <OpenNote n={n} call={call} disabled={!!busy} isOwner={data.viewer.isOwner} />}
      </li>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <AddResearch ideaId={ideaId} onSaved={() => void load()} compact={compact} />
        <div role="tablist" aria-label="Group the notebook" className="inline-flex flex-wrap rounded-lg border border-zinc-300 overflow-hidden mb-2">
          {VIEW_MODES.map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
              className={`text-[11px] px-2 py-1 ${mode === m ? 'bg-zinc-900 text-white font-semibold' : 'bg-white text-zinc-700 hover:bg-zinc-50'}`}>{mode === m ? '● ' : '○ '}{VIEW_LABEL[m]}</button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-600">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the notebook" aria-label="Search the notebook" className="border border-zinc-300 rounded px-2 py-1 text-xs w-44" />
        <label className="inline-flex items-center gap-1"><input type="checkbox" checked={showLex} onChange={(e) => setShowLex(e.target.checked)} className="accent-zinc-900" /> Show Lex’s findings{showLex ? ` (${data.lexCount})` : ''}</label>
        <label className="inline-flex items-center gap-1"><input type="checkbox" checked={showAside} onChange={(e) => setShowAside(e.target.checked)} className="accent-zinc-900" /> Show set aside{data.setAsideCount ? ` (${data.setAsideCount})` : ''}</label>
        <span>{data.ownCount} of {data.viewer.isOwner ? 'your team’s' : 'the team’s'} note{data.ownCount === 1 ? '' : 's'}</span>
      </div>
      <BookmarkletHelp ideaId={ideaId} />
      {busy && <p role="status" className="text-[11px] text-zinc-600">Working: {busy}…</p>}
      {error && <p role="alert" className="text-[11px] font-semibold text-amber-800">⚠ {error}</p>}

      {selIds.length > 0 && (
        <div className="sticky top-0 z-10 rounded-lg border-2 border-zinc-900 bg-white p-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold">{selIds.length} selected</span>
          <select defaultValue="" disabled={!!busy} aria-label="Set the stance of the selected notes"
            onChange={(e) => { if (e.target.value) void call({ op: 'setStance', noteIds: selIds, stance: e.target.value as Stance }).then((ok) => ok && setSel(new Set())); e.target.value = '' }}
            className="text-xs border border-zinc-300 rounded px-1 py-0.5">
            <option value="">Set stance…</option>
            {STANCES.map((s) => <option key={s} value={s}>{STANCE_GLYPH[s]} {STANCE_LABEL[s]}</option>)}
          </select>
          <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} maxLength={40} placeholder="Tag" aria-label="Tag to add" className="text-xs border border-zinc-300 rounded px-1.5 py-0.5 w-24" />
          <button disabled={!!busy || !tagInput.trim()} onClick={() => void call({ op: 'addTags', noteIds: selIds, tags: [tagInput.trim()] }).then((ok) => { if (ok) { setTagInput(''); setSel(new Set()) } })}
            className="text-xs font-medium px-2 py-0.5 rounded border border-zinc-300 disabled:opacity-40">Add tag</button>
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={600} placeholder="Reason (to set aside)" aria-label="Reason to set aside" className="text-xs border border-zinc-300 rounded px-1.5 py-0.5 w-40" />
          <button disabled={!!busy || reason.trim().length < 3} onClick={() => void call({ op: 'setAside', noteIds: selIds, reason }).then((ok) => { if (ok) { setReason(''); setSel(new Set()) } })}
            title={reason.trim().length < 3 ? 'Give a reason first — it is kept, because why it was set aside is itself research.' : undefined}
            className="text-xs font-medium px-2 py-0.5 rounded border border-zinc-300 disabled:opacity-40">Set aside</button>
          <button disabled={!!busy} onClick={() => void call({ op: 'restore', noteIds: selIds }).then((ok) => ok && setSel(new Set()))} className="text-xs font-medium px-2 py-0.5 rounded border border-zinc-300">Bring back</button>
          <button onClick={() => setSel(new Set())} className="text-xs underline text-zinc-500 ml-auto">Clear</button>
        </div>
      )}

      {notes.length === 0 && (
        <p className="text-xs text-zinc-500">
          {data.ownCount === 0 && !showLex
            ? 'No research notes yet. Press “Add research” — a quote, a link, a file, or just a thought — and it is kept here with its source.'
            : 'Nothing matches that. Try clearing the search, or showing Lex’s findings or the set-aside notes.'}
        </p>
      )}

      <div className={mode === 'stance' ? 'grid gap-3 sm:grid-cols-2' : 'space-y-3'}>
        {groups.map((g) => (
          <section key={g.key} aria-label={g.label}>
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600 mb-1">
              {mode === 'stance' ? `${STANCE_GLYPH[g.key.slice(3) as Stance] ?? ''} ` : ''}{g.label} <span className="font-normal text-zinc-400">· {g.notes.length}</span>
            </h4>
            {g.notes.length === 0
              ? <p className="text-[11px] text-zinc-400 pl-1">{mode === 'stance' ? 'Nothing here yet.' : 'Empty.'}</p>
              : <ul className="space-y-1">{g.notes.map((n) => NoteRow(n))}</ul>}
          </section>
        ))}
      </div>
    </div>
  )
}

/**
 * 26-R §3 (decision 132) — the bookmarklet, explained where it is used. On a desktop browser the link is dragged to the bookmarks
 * bar. ⚠ It is rendered as raw HTML on purpose: React will not put a `javascript:` URL in an `href`.
 * ⚠ iPad / iPhone Safari cannot drag a link to a bar, so the code is shown to copy into a bookmark's address by hand. That route is
 * described from how Safari bookmarks work and has NOT been tried on a device — the text says so rather than promising.
 */
function BookmarkletHelp({ ideaId }: { ideaId: string }) {
  const [open, setOpen] = useState(false)
  const [href, setHref] = useState('')
  useEffect(() => { if (open && typeof window !== 'undefined') void import('@/lib/lex/bookmarklet').then((m) => setHref(m.bookmarkletHref(window.location.origin, ideaId))) }, [open, ideaId])
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  return (
    <div className="text-[11px] text-zinc-600">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="underline">{open ? 'Hide' : 'Save from any web page'}</button>
      {open && (
        <div className="mt-1 rounded border border-zinc-200 bg-zinc-50 p-2 space-y-1.5">
          <p><strong>On a computer:</strong> drag this to your bookmarks bar —{' '}
            {href && <span dangerouslySetInnerHTML={{ __html: `<a href="${esc(href)}" class="font-semibold underline" draggable="true" onclick="return false">Add to Scrutinise</a>` }} />}
            . Then, on any page, select the passage you want and press the bookmark: “Add research” opens with the address, title and your selection filled in.</p>
          <p><strong>On an iPad or iPhone:</strong> bookmark any page, then edit that bookmark and replace its address with the code below. Press it from the bookmarks as you would any bookmark. <em>This route has not been tried on a device yet; if the bookmark does nothing on a particular site, paste the page’s address into “Add research” instead.</em></p>
          {href && <textarea readOnly value={href} rows={3} onFocus={(e) => e.currentTarget.select()} aria-label="Bookmarklet code" className="w-full border border-zinc-300 rounded px-2 py-1 text-[10px] font-mono" />}
        </div>
      )}
    </div>
  )
}

function OpenNote({ n, call, disabled, isOwner }: { n: NoteView; call: (r: NotebookRequest, label?: string) => Promise<boolean>; disabled: boolean; isOwner: boolean }) {
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)
  const [comment, setComment] = useState(n.comment ?? '')
  return (
    <div className="border-t border-zinc-100 px-2.5 py-2 space-y-2 bg-zinc-50/50 text-sm">
      {n.quote && (
        <blockquote className="border-l-4 border-zinc-400 pl-2 text-zinc-800 whitespace-pre-wrap">
          {n.quote}
          {n.quoteLocation && <footer className="text-[11px] text-zinc-500 mt-0.5">— {n.quoteLocation}</footer>}
        </blockquote>
      )}
      {n.comment && !editing && (
        <p className="whitespace-pre-wrap text-zinc-800"><span className="text-[11px] font-semibold text-zinc-500">{n.lex ? 'Lex’s finding: ' : `${n.mine ? 'Your' : `${n.authorName}’s`} comment: `}</span>{n.comment}</p>
      )}
      {editing && (
        <div className="space-y-1">
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={8000} className="w-full border border-zinc-300 rounded px-2 py-1 text-xs" aria-label="Your comment" />
          <button disabled={disabled} onClick={() => void call({ op: 'updateNote', noteId: n.id, comment }).then((ok) => ok && setEditing(false))} className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-900 text-white">Save comment</button>
        </div>
      )}
      <div className="text-[11px] text-zinc-600 space-y-0.5">
        {n.source && (
          <p>Source: <strong>[Ref: {n.source.number}]</strong> {n.source.url ? <a href={n.source.url} target="_blank" rel="noopener noreferrer" className="underline">{n.source.title}</a> : n.source.title}
            {n.source.readStatus === 'NOT_READ' ? <span className="font-semibold text-zinc-700"> · not read{n.source.readNote ? ` (${n.source.readNote})` : ''}</span> : null}</p>
        )}
        {n.bearsOn.length > 0 && <p>Bears on: {n.bearsOn.map((b) => `${BEARS_ON_LABEL[b.kind]} — ${b.label ?? b.id}`).join(' · ')}</p>}
        {n.status === 'SET_ASIDE' && <p className="font-semibold text-zinc-700">Set aside: {n.setAsideReason ?? 'no reason recorded'}</p>}
      </div>

      {!n.lex && (
        <div className="space-y-1 border-t border-zinc-200 pt-1.5">
          {n.replies.map((r) => (
            <p key={r.id} className="text-xs text-zinc-700"><span className="font-semibold">{r.authorName}:</span> {r.text}</p>
          ))}
          <div className="flex gap-1.5">
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} placeholder={n.mine ? 'Add to the discussion' : 'Reply beneath this note'} aria-label="Reply" className="flex-1 border border-zinc-300 rounded px-2 py-1 text-xs" />
            <button disabled={disabled || !text.trim()} onClick={() => void call({ op: 'reply', noteId: n.id, text }).then((ok) => ok && setText(''))} className="text-xs font-medium px-2 py-1 rounded border border-zinc-300 disabled:opacity-40">Reply</button>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            {n.mine && <button disabled={disabled} onClick={() => setEditing((e) => !e)} className="underline">{editing ? 'Cancel editing' : 'Edit my comment'}</button>}
            {n.mine && (n.mineOnly
              ? <button disabled={disabled} onClick={() => void call({ op: 'share', noteIds: [n.id] })} className="underline">Share with the team</button>
              : <button disabled={disabled} onClick={() => void call({ op: 'makeMineOnly', noteIds: [n.id] })} className="underline">Make mine only</button>)}
            {n.status === 'SET_ASIDE' && <button disabled={disabled} onClick={() => void call({ op: 'restore', noteIds: [n.id] })} className="underline">Bring back into the record</button>}
            {isOwner && n.status === 'UNREVIEWED' && <button disabled={disabled} onClick={() => void call({ op: 'putInRecord', noteIds: [n.id] })} className="underline font-semibold">Put in the record</button>}
          </div>
        </div>
      )}
    </div>
  )
}
