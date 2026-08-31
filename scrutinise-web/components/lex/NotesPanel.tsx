'use client'

// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-N §3c — NOTES. The user's own working notes, in the working area.
//
// §3c: *"Notes — private to the user, saved with the idea, **never shared**. Notes can be
// titled, dragged under headings and sorted, each with show/hide."* And: *"The user's original
// idea moves here, under 'My original idea' — it should not be the first thing on the working
// page."*
//
// ⚠⚠ THE PRIVACY SENTENCE IS ON THE SCREEN, NOT IN A POLICY PAGE. A user deciding whether to
// write down something candid about a colleague, a constituency or their own doubts needs that
// answer at the moment they are deciding — the same rule §25.6 applies to uploading a
// document. It is the first line of the tab.
//
// ⚠ SAVED ON BLUR AND ON A PAUSE, NOT ON EVERY KEYSTROKE. A PATCH per character is a request
// storm; a note that only saves when you press a button is a note that gets lost when the tab
// closes. Both failure modes are avoided by the same debounce the rest of this surface uses.
//
// ⚠ DRAG IS HTML5 DRAG-AND-DROP, AND IT IS NOT THE ONLY WAY TO REORDER. A drag handle is the
// one control with no keyboard equivalent, so every note also carries ↑/↓ buttons and a
// heading box you can type into. §3c asks for dragging; it does not ask for dragging to be
// compulsory, and a user who cannot drag must not be locked out of their own filing.
//
// ⚠ HIDE IS NOT DELETE AND SAYS SO. `hidden` collapses the body and nothing else — the note
// stays in the list, keeps its title, and is one press from coming back. A control called
// "hide" that lost the text would be the worst kind of surprise on a private notebook.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react'

interface Note {
  id: string
  title: string
  body: string
  heading: string
  position: number
  hidden: boolean
  /** TRUE for the seeded "My original idea" note. */
  seeded: boolean
  updatedAt: string
}

/** How long after the last keystroke a note is written. */
const SAVE_AFTER_MS = 700

export default function NotesPanel({ ideaId }: { ideaId: string }) {
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/notes`)
      if (!res.ok) return
      const body = await res.json()
      setNotes(body.notes ?? [])
    } catch {
      // A notebook that cannot load says so rather than rendering as empty — an empty
      // notebook and an unreachable one look identical, and one of them is alarming.
      setError('Your notes could not be loaded just now. Nothing has been lost — try again.')
    }
  }, [ideaId])

  useEffect(() => { void load() }, [load])

  // ⚠ CLEAR EVERY PENDING SAVE ON UNMOUNT. A timer that fires after the component is gone
  // writes into a closed-over state setter — and, worse, a user who switched tabs mid-edit
  // would have their last keystrokes land after they had moved on.
  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout) }, [])

  const patch = useCallback(async (payload: Record<string, unknown>) => {
    setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { setError('That note could not be saved.'); return }
      // ⚠ THE SERVER'S LIST REPLACES OURS ONLY ON A STRUCTURAL CHANGE. Taking it back on every
      // keystroke-debounced body save would yank the cursor out of the textarea the user is
      // still typing in.
      const body = await res.json()
      if (payload.order || payload.hidden !== undefined || payload.heading !== undefined) {
        setNotes(body.notes ?? [])
      }
    } catch { setError('That note could not be saved.') }
  }, [ideaId])

  /** Edit locally now, write in a moment. See the header. */
  const edit = useCallback((id: string, field: 'title' | 'body' | 'heading', value: string) => {
    setNotes((cur) => cur?.map((n) => (n.id === id ? { ...n, [field]: value } : n)) ?? cur)
    if (timers.current[id]) clearTimeout(timers.current[id])
    timers.current[id] = setTimeout(() => { void patch({ noteId: id, [field]: value }) }, SAVE_AFTER_MS)
  }, [patch])

  const add = useCallback(async (heading = '') => {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heading }),
      })
      if (!res.ok) { setError('That note could not be added.'); return }
      setNotes((await res.json()).notes ?? [])
    } finally { setBusy(false) }
  }, [ideaId])

  const remove = useCallback(async (id: string) => {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/notes?noteId=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (res.ok) setNotes((await res.json()).notes ?? [])
    } finally { setBusy(false) }
  }, [ideaId])

  /**
   * Move `id` to sit where `targetId` is — by drag, or by the ↑/↓ buttons.
   *
   * ⚠ THE WHOLE ORDER IS SENT. See the route's `order` note: writing one row's position means
   * the client and the server have to agree about the others, and they will not the first time
   * two tabs are open.
   */
  const reorder = useCallback((id: string, targetId: string) => {
    setNotes((cur) => {
      if (!cur) return cur
      const from = cur.findIndex((n) => n.id === id)
      const to = cur.findIndex((n) => n.id === targetId)
      if (from < 0 || to < 0 || from === to) return cur
      const next = [...cur]
      const [moved] = next.splice(from, 1)
      // ⚠ A NOTE DROPPED ON ANOTHER TAKES ITS HEADING. §3c: "dragged under headings" — the
      // drop target IS the filing instruction, and a note that moved position but kept its old
      // group would look as though the drag had half worked.
      next.splice(to, 0, { ...moved, heading: cur[to].heading })
      void patch({ noteId: id, heading: cur[to].heading, order: next.map((n) => n.id) })
      return next
    })
  }, [patch])

  const nudge = useCallback((id: string, delta: -1 | 1) => {
    setNotes((cur) => {
      if (!cur) return cur
      const i = cur.findIndex((n) => n.id === id)
      const j = i + delta
      if (i < 0 || j < 0 || j >= cur.length) return cur
      const next = [...cur]
      ;[next[i], next[j]] = [next[j], next[i]]
      void patch({ noteId: id, order: next.map((n) => n.id) })
      return next
    })
  }, [patch])

  if (!notes) {
    return <p className="px-3 py-3 text-xs text-zinc-400">Opening your notes…</p>
  }

  // ⚠ GROUPED IN THE LIST'S OWN ORDER, not alphabetically. The user put them in this order;
  // sorting the groups would silently overrule the thing the drag is for. Ungrouped notes keep
  // their place rather than being swept to the end.
  const groups: Array<{ heading: string; notes: Note[] }> = []
  for (const n of notes) {
    const last = groups[groups.length - 1]
    if (last && last.heading === n.heading) last.notes.push(n)
    else groups.push({ heading: n.heading, notes: [n] })
  }

  return (
    <div className="h-full overflow-y-auto px-3 py-3 space-y-3">
      {/* §3c — the privacy answer, where the decision to write is made. */}
      <p className="text-[11px] text-zinc-500 leading-snug">
        Your own notes, saved with this idea. <span className="font-medium text-zinc-700">Private to
        you — never shared</span>, not with your team, not with anyone you invite, and not with Lex.
      </p>

      <button
        onClick={() => void add()}
        disabled={busy}
        className="text-xs font-semibold px-3 py-1.5 rounded-full bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40"
      >
        + Add a note
      </button>

      {error && (
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-1.5">{error}</p>
      )}

      {notes.length === 0 && (
        <p className="text-xs text-zinc-500">
          Nothing here yet. This is the one place on the page that is only for you — half-formed
          thoughts, who to ask, what you do not believe yet.
        </p>
      )}

      {groups.map((g, gi) => (
        <div key={`${g.heading}-${gi}`} className="space-y-2">
          {g.heading && (
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 pt-1">
              {g.heading}
            </h3>
          )}
          {g.notes.map((n) => (
            <div
              key={n.id}
              draggable
              onDragStart={() => setDragId(n.id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (dragId && dragId !== n.id) reorder(dragId, n.id)
                setDragId(null)
              }}
              className={`rounded-lg border bg-white p-2.5 ${
                dragId === n.id ? 'border-blue-400 opacity-60' : 'border-zinc-200'
              }`}
            >
              <div className="flex items-center gap-1.5">
                {/* The drag affordance is a shape, not a colour (docs/CLAUDE.md §21). */}
                <span aria-hidden className="text-zinc-300 cursor-grab select-none text-xs leading-none">⠿</span>
                <input
                  value={n.title}
                  onChange={(e) => edit(n.id, 'title', e.target.value)}
                  placeholder="Untitled note"
                  className="flex-1 min-w-0 text-xs font-semibold text-zinc-800 bg-transparent border-0 p-0 focus:outline-none focus:ring-0 placeholder:font-normal placeholder:text-zinc-400"
                />
                {/* ⚠ "HIDE" COLLAPSES; IT DOES NOT DELETE, AND THE TWO WORDS ARE DIFFERENT
                    CONTROLS. Two characters and two words, never one glyph recoloured. */}
                <button
                  onClick={() => void patch({ noteId: n.id, hidden: !n.hidden })}
                  aria-expanded={!n.hidden}
                  className="text-[11px] text-zinc-400 hover:text-zinc-700 whitespace-nowrap"
                >
                  {n.hidden ? 'show +' : 'hide −'}
                </button>
              </div>

              {!n.hidden && (
                <>
                  <textarea
                    value={n.body}
                    onChange={(e) => edit(n.id, 'body', e.target.value)}
                    onBlur={() => void patch({ noteId: n.id, body: n.body })}
                    rows={n.seeded ? 6 : 3}
                    placeholder="Write anything."
                    className="mt-1.5 w-full text-xs text-zinc-700 leading-relaxed rounded border border-zinc-200 px-2 py-1.5 resize-y"
                  />
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <input
                      value={n.heading}
                      onChange={(e) => edit(n.id, 'heading', e.target.value)}
                      placeholder="Under a heading…"
                      className="text-[11px] rounded border border-zinc-200 px-1.5 py-0.5 text-zinc-600 w-36"
                    />
                    {/* §3c asks for dragging. These are what make it reachable without a
                        pointer — the same reasoning as the keyboard-operable panel dividers. */}
                    <button onClick={() => nudge(n.id, -1)} aria-label="Move up"
                      className="text-[11px] text-zinc-400 hover:text-zinc-700 px-1">↑</button>
                    <button onClick={() => nudge(n.id, 1)} aria-label="Move down"
                      className="text-[11px] text-zinc-400 hover:text-zinc-700 px-1">↓</button>
                    <span className="flex-1" />
                    {/* ⚠ THE SEEDED NOTE CAN BE DELETED LIKE ANY OTHER, and it says what it is.
                        It is a COPY of the idea's summary (see the route) — deleting it does not
                        touch the idea, and a user who has rewritten it should not be stuck with
                        the original underneath. */}
                    {n.seeded && (
                      <span className="text-[10px] text-zinc-400">
                        copied from your idea — editing this note does not change the idea
                      </span>
                    )}
                    <button onClick={() => void remove(n.id)} disabled={busy}
                      className="text-[11px] text-zinc-400 hover:text-red-600 disabled:opacity-40">
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
