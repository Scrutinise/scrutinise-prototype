'use client'
// ─────────────────────────────────────────────────────────────────────────────
// LEX Z2 (BRIEF_26Z §6.3; decisions 361–363) — OFFLINE, ON SCREEN. One strip at the top of an idea's page:
//   · "Offline — last updated 14:02" when there is no connection (the time the page on screen was fetched: the worker's kept copy, or
//     this load);
//   · how many changes made offline are waiting;
//   · on reconnection, THE QUEUE GOES FIRST (363): the waiting edits are sent in order, and only then is the page refreshed;
//   · a conflict, with both versions, until the owner chooses; a refusal, in its words, until dismissed. Nothing is dropped silently;
//   · queued Lex messages are not sent until the owner taps once, with the estimate (362).
// It also registers the worker (scope /ideas/), clears what is kept when the user changes or signs out (361), and answers every other Lex
// write made offline in words ("this needs the connection"), so no control fails as a bare "Failed to fetch".
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react'
import { OFFLINE_UI } from '@/lib/lex/screen-labels'
import { registerLexWorker, keepForUser, clearLexOffline, cachedAtOf, clockWords, installOfflineWrites, refusedOffline } from '@/lib/lex/offline'
import { readQueue, onQueueChange, flushEdits, resolveConflict, removeQueued, type Queued, type QueuedEdit, type QueuedLex } from '@/lib/lex/offline-queue'

export interface OfflineStripProps {
  ideaId: string | null
  /** The signed-in user; null = signed out; undefined = not known yet (nothing is cleared on a guess). */
  userId: string | null | undefined
  /** After the queue has gone (or a conflict is settled with "use mine"): re-read the page's state from the server. */
  onRefresh: () => void
  /** The estimate shown before queued Lex messages are sent ("about 4p each, this conversation's average"). */
  lexEstimate: string
  /** Send one queued Lex message as an ordinary Lex message (its id kept, so a retry is not acted on twice). */
  sendLex: (text: string, clientTurnId: string) => Promise<void>
}

export default function OfflineStrip({ ideaId, userId, onRefresh, lexEstimate, sendLex }: OfflineStripProps) {
  const [online, setOnline] = useState(true)
  const [cachedAt, setCachedAt] = useState<Date | null>(null)
  const [loadedAt] = useState(() => new Date())
  const [queue, setQueue] = useState<Queued[]>([])
  const [note, setNote] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const flushing = useRef(false)
  const refreshRef = useRef(onRefresh)
  refreshRef.current = onRefresh

  // 361 first: a different user (or none) clears what this device kept, before anything is read from it
  // ⚠ NOTHING IS SENT UNTIL THIS HAS RUN: a queue kept by another user on this device is cleared, never sent as this one
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (userId === undefined) return
    void keepForUser(userId).then(() => { setQueue(ideaId ? readQueue(ideaId) : []); setReady(true) })
  }, [userId, ideaId])
  useEffect(() => { void registerLexWorker() }, [])
  useEffect(() => installOfflineWrites(async () => refusedOffline(OFFLINE_UI.needsConnection)), [])
  useEffect(() => { setCachedAt(cachedAtOf(document)); setOnline(typeof navigator === 'undefined' ? true : navigator.onLine !== false) }, [])
  useEffect(() => onQueueChange(() => setQueue(ideaId ? readQueue(ideaId) : [])), [ideaId])

  // 363 — the queue goes first: every waiting edit, in order, then (and only then) the page is refreshed
  const flush = useCallback(async () => {
    if (!ideaId || !ready || flushing.current) return
    if (!readQueue(ideaId).some((q) => q.kind === 'edit' && q.status === 'waiting')) return
    flushing.current = true; setSending(true); setNote(null)
    try {
      const r = await flushEdits(ideaId)
      if (r.sent) setNote(OFFLINE_UI.sent(r.sent))
      if (r.sent || r.conflicts || r.refused) refreshRef.current()
    } finally { flushing.current = false; setSending(false); setQueue(readQueue(ideaId)) }
  }, [ideaId, ready])

  useEffect(() => {
    // back online: the queue first; then a page that came from the kept copy is loaded fresh (the worker fetches it from the network)
    const up = async () => { setOnline(true); await flush(); if (cachedAtOf(document)) window.location.reload() }
    const down = () => setOnline(false)
    const onUp = () => { void up() }
    window.addEventListener('online', onUp); window.addEventListener('offline', down)
    if (navigator.onLine !== false) void flush() // a reload once back online: what is waiting goes before anything else
    return () => { window.removeEventListener('online', onUp); window.removeEventListener('offline', down) }
  }, [flush])

  const edits = queue.filter((q): q is QueuedEdit => q.kind === 'edit')
  const waiting = edits.filter((q) => q.status === 'waiting')
  const conflicts = edits.filter((q) => q.status === 'conflict')
  const refused = edits.filter((q) => q.status === 'refused')
  const lex = queue.filter((q): q is QueuedLex => q.kind === 'lex')
  const offline = !online || !!cachedAt

  const choose = async (id: string, choice: 'mine' | 'theirs') => {
    const r = await resolveConflict(id, choice)
    if (!r.ok) setNote(r.error ?? null)
    else onRefresh()
    setQueue(ideaId ? readQueue(ideaId) : [])
  }
  const sendQueuedLex = async () => {
    for (const m of lex) { removeQueued(m.id); await sendLex(m.text, m.clientTurnId) }
    setQueue(ideaId ? readQueue(ideaId) : [])
  }

  if (!offline && !waiting.length && !conflicts.length && !refused.length && !(online && lex.length) && !note && !sending) return null
  return (
    <div data-offline-strip className="mx-auto w-full max-w-[1400px] px-3 py-2 space-y-2 text-sm text-zinc-900">
      {offline && (
        <p role="status" data-offline-state className="rounded-md border-2 border-zinc-900 bg-amber-50 px-3 py-1.5 font-semibold">
          <span aria-hidden>⚠ </span>{OFFLINE_UI.lastUpdated(clockWords(cachedAt ?? loadedAt))}
          {waiting.length > 0 && <span data-offline-waiting className="ml-2 font-normal">· {OFFLINE_UI.waiting(waiting.length)}</span>}
        </p>
      )}
      {!offline && waiting.length > 0 && <p role="status" data-offline-waiting className="rounded-md border border-zinc-400 px-3 py-1.5">{OFFLINE_UI.waiting(waiting.length)}</p>}
      {sending && <p role="status" data-offline-sending className="rounded-md border border-zinc-400 px-3 py-1.5">{OFFLINE_UI.sending}</p>}
      {note && <p role="status" data-offline-note className="rounded-md border border-zinc-400 px-3 py-1.5">{note}</p>}
      {conflicts.map((c) => (
        <div key={c.id} data-offline-conflict={c.id} role="alert" className="rounded-md border-2 border-zinc-900 bg-white p-2 space-y-1">
          <p className="font-semibold"><span aria-hidden>⚠ </span>{OFFLINE_UI.conflictHead}: {c.words}</p>
          {(c.conflict ?? []).map((x) => (
            <div key={x.field} className="grid gap-2 md:grid-cols-2 text-xs">
              <div data-conflict-server><p className="font-semibold">{OFFLINE_UI.server} ({x.words})</p><p className="whitespace-pre-wrap border border-zinc-300 rounded p-1">{x.server || '—'}</p></div>
              <div data-conflict-mine><p className="font-semibold">{OFFLINE_UI.mine} ({x.words})</p><p className="whitespace-pre-wrap border border-zinc-300 rounded p-1">{x.mine || '—'}</p></div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button type="button" data-conflict-use-mine onClick={() => void choose(c.id, 'mine')} className="min-h-[36px] px-3 rounded-full bg-zinc-900 text-white font-semibold">{OFFLINE_UI.useMine}</button>
            <button type="button" data-conflict-keep-server onClick={() => void choose(c.id, 'theirs')} className="min-h-[36px] px-3 rounded-full border-2 border-zinc-900 bg-white font-semibold">{OFFLINE_UI.keepServer}</button>
          </div>
        </div>
      ))}
      {refused.map((r) => (
        <div key={r.id} data-offline-refused={r.id} role="alert" className="rounded-md border-2 border-zinc-900 bg-white p-2">
          <p className="font-semibold">{OFFLINE_UI.refusedHead}: {r.words}</p>
          <p className="text-xs">{r.refusal}</p>
          <button type="button" onClick={() => removeQueued(r.id)} className="mt-1 min-h-[32px] px-3 rounded-full border border-zinc-400 text-xs">{OFFLINE_UI.dismiss}</button>
        </div>
      ))}
      {online && !cachedAt && lex.length > 0 && (
        <div data-offline-lex-ask role="alert" className="rounded-md border-2 border-zinc-900 bg-white p-2 flex flex-wrap items-center gap-2">
          <span className="font-semibold">{OFFLINE_UI.lexAsk(lex.length, lexEstimate)}</span>
          <button type="button" data-offline-lex-send onClick={() => void sendQueuedLex()} className="min-h-[36px] px-3 rounded-full bg-zinc-900 text-white font-semibold">{OFFLINE_UI.lexSend}</button>
          <button type="button" data-offline-lex-keep onClick={() => setQueue([...queue.filter((q) => q.kind !== 'lex')])} className="min-h-[36px] px-3 rounded-full border-2 border-zinc-900 bg-white font-semibold">{OFFLINE_UI.lexKeep}</button>
        </div>
      )}
    </div>
  )
}

export { clearLexOffline }
