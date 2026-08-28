'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 25-D §4 / §25.6 — adding a document or a link.
//
// ⚠ WHAT HAPPENS TO IT IS SAID BEFORE IT IS ASKED FOR, not in a policy page. The user is
// handing over a document; the two facts they need are that we keep the text and not the
// file, and that we read it once rather than carrying it around. Both are stated on the
// control itself.
//
// ⚠ AND A FAILED READ IS SHOWN AS ONE. A document stored but not read, a document read that
// yielded nothing, and a document that could not be read at all are three different states
// and the panel names each — the same rule §18 sets for a degraded model call.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react'

/** 25-L §2 — something we were given and could not read. */
interface RejectedRow {
  id: string
  kind: string
  target: string
  detail: string
  createdAt: string
}

/**
 * ⚠ THE ONES THE USER CAN DO SOMETHING ABOUT ARE SEPARATED FROM THE ONES THEY CANNOT.
 * A video needs a transcript and a paywalled page needs the text pasted — both are an
 * invitation. A mistyped address is a failed attempt and does not belong on a list of gaps
 * in the evidence, which would make the list look worse than the idea is.
 */
const ACTIONABLE = new Set(['video', 'paywalled', 'no-text'])

interface MaterialRow {
  id: string
  kind: 'FILE' | 'LINK'
  status: string
  label: string
  url: string | null
  charCount: number
  findingsAt: string | null
  findingCount: number
  failureReason: string | null
}

export default function YourMaterial({
  ideaId, onChanged, onCount,
}: {
  ideaId: string
  onChanged?: () => void
  /**
   * 25-K §2 — how many things are attached, reported upward so the composer's "+" can
   * carry a count.
   *
   * ⚠ CALLED ON EVERY LOAD AND EVERY MUTATION, from the ONE place that knows. A parent
   * counting for itself would need a second fetch of the same endpoint, and the two
   * numbers would disagree the moment one of them was stale.
   */
  onCount?: (n: number) => void
}) {
  const [rows, setRows] = useState<MaterialRow[]>([])
  const [rejected, setRejected] = useState<RejectedRow[]>([])
  const [remaining, setRemaining] = useState<number>(0)
  const [maxBytes, setMaxBytes] = useState<number>(0)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  /**
   * ⚠⚠ THE CALLBACK LIVES IN A REF, AND THAT IS NOT TIDINESS.
   *
   * `load` is a `useCallback` whose result drives a `useEffect`. Put `onCount` in its
   * dependency array and any caller passing an inline arrow — the normal way to write one —
   * gives a new identity on every render, so `load` changes, the effect re-runs, the fetch
   * sets state, and the component re-renders: an infinite request loop against
   * `/api/ideas/[id]/material`, in production, triggered by a caller that looks correct.
   * The ref keeps the latest callback without making it a dependency of anything.
   */
  const countRef = useRef(onCount)
  countRef.current = onCount

  const load = useCallback(async () => {
    const res = await fetch(`/api/ideas/${ideaId}/material`)
    if (!res.ok) return
    const body = await res.json()
    setRows(body.material ?? [])
    setRemaining(body.remaining ?? 0)
    setMaxBytes(body.maxBytes ?? 0)
    setRejected(body.rejected ?? [])
    countRef.current?.((body.material ?? []).length)
  }, [ideaId])

  useEffect(() => { void load() }, [load])

  const after = useCallback(async (res: Response) => {
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(typeof body?.error === 'string' ? body.error : 'That could not be added.')
      // ⚠ 25-L §2 — RELOAD ON A REFUSAL. The refusal has just been recorded against the
      // idea, and the list below is where it becomes a visible gap rather than a toast the
      // user scrolls past. Without this the record exists and the screen does not show it.
      void load()
      return
    }
    setRows(body.material ?? [])
    setRemaining(body.remaining ?? 0)
    setRejected(body.rejected ?? [])
    countRef.current?.((body.material ?? []).length)
    // Truncation and "nothing useful" are both reported, because both are things the user
    // would otherwise assume did not happen.
    setNote([
      body.truncated ? 'That was longer than we store, so only the first part was read.' : null,
      typeof body.note === 'string' ? body.note : null,
      body.findingsWritten ? `${body.findingsWritten} finding${body.findingsWritten === 1 ? '' : 's'} filed under the questions they answer.` : null,
    ].filter(Boolean).join(' ') || null)
    onChanged?.()
  }, [onChanged])

  const addFile = useCallback(async (file: File) => {
    setBusy(true); setError(null); setNote(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('rightsConfirmed', 'true')
      await after(await fetch(`/api/ideas/${ideaId}/material`, { method: 'POST', body: form }))
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }, [ideaId, after])

  const addLink = useCallback(async () => {
    if (!link.trim()) return
    setBusy(true); setError(null); setNote(null)
    try {
      await after(await fetch(`/api/ideas/${ideaId}/material`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link.trim(), rightsConfirmed: true }),
      }))
      setLink('')
    } finally { setBusy(false) }
  }, [ideaId, link, after])

  const remove = useCallback(async (id: string) => {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/material?materialId=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (res.ok) {
        const body = await res.json()
        setRows(body.material ?? [])
        setRemaining(body.remaining ?? 0)
        countRef.current?.((body.material ?? []).length)
        onChanged?.()
      }
    } finally { setBusy(false) }
  }, [ideaId, onChanged])

  return (
    <div className="space-y-2">
      {rows.length > 0 && (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.id} className="flex items-start gap-2 text-xs">
              <div className="flex-1 min-w-0">
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noopener noreferrer"
                    className="text-zinc-800 hover:underline break-words">{r.label}</a>
                ) : (
                  <span className="text-zinc-800 break-words">{r.label}</span>
                )}
                <div className="text-[11px] text-zinc-400">
                  {r.status === 'FAILED'
                    ? (r.failureReason ?? 'Could not be read.')
                    : r.findingsAt === null
                      ? 'Stored — not yet read.'
                      : r.findingCount > 0
                        ? `${r.findingCount} finding${r.findingCount === 1 ? '' : 's'}`
                        : 'Read — nothing in it bore on this.'}
                  {' · '}{Math.round(r.charCount / 1000)}k characters kept
                </div>
              </div>
              <button onClick={() => void remove(r.id)} disabled={busy}
                className="text-[11px] text-zinc-400 hover:text-red-600 disabled:opacity-40 shrink-0">
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ══ 25-L §2 — WHAT WE COULD NOT READ ═══════════════════════════════════
          §2: "never silently drop it, always say why at the time, always record it."
          The sentence at the time is the error banner below; this is the record, and it
          is what makes the gap survive the moment.

          ⚠ IT IS NOT AN ERROR LIST. A video we cannot watch is a fact about us, not a
          mistake the user made, so it is styled as a note with an invitation rather than
          as a warning. */}
      {rejected.length > 0 && (
        <div className="rounded border border-zinc-200 bg-zinc-50/70 p-2 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Given to me, and not read ({rejected.length})
          </p>
          {rejected.slice(0, 6).map((r) => (
            <div key={r.id} className="text-[11px]">
              <span className="text-zinc-800 break-all">{r.target}</span>
              <span className="ml-1.5 rounded border border-zinc-300 bg-white px-1 py-0.5 text-[10px] uppercase tracking-wide text-zinc-600">
                {r.kind}
              </span>
              <span className="block text-zinc-500">{r.detail}</span>
            </div>
          ))}
          {rejected.length > 6 && (
            <p className="text-[11px] text-zinc-400">…and {rejected.length - 6} more.</p>
          )}
          {rejected.some((r) => ACTIONABLE.has(r.kind)) && (
            <p className="text-[11px] text-zinc-600">
              These are on the record as gaps. Paste the text or upload a transcript and I’ll read it.
            </p>
          )}
        </div>
      )}

      {error && <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-1.5">{error}</p>}
      {note && <p className="text-[11px] text-zinc-600 bg-zinc-50 border border-zinc-200 rounded p-1.5">{note}</p>}

      {remaining > 0 ? (
        <>
          <div className="flex gap-1.5">
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void addLink() }}
              placeholder="Paste a link"
              disabled={busy}
              className="flex-1 min-w-0 text-xs rounded border border-zinc-300 px-2 py-1.5 disabled:opacity-50"
            />
            <button onClick={() => void addLink()} disabled={busy || !link.trim()}
              className="text-[11px] px-2 py-1 rounded bg-zinc-900 text-white disabled:opacity-40 shrink-0">
              Add
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.docx,.txt,.md,.html"
              disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void addFile(f) }}
              className="text-[11px] text-zinc-600 file:mr-2 file:text-[11px] file:px-2 file:py-1 file:rounded file:border file:border-zinc-300 file:bg-white"
            />
          </div>
          <p className="text-[11px] text-zinc-400">
            PDF, Word, text or a web page — up to {Math.round(maxBytes / 1048576)}MB, {remaining} more on this idea.
            We keep the <span className="font-medium">text</span>, never the file, and read it once into findings
            rather than carrying it into every conversation. It is deleted with the idea.
          </p>
        </>
      ) : (
        <p className="text-[11px] text-zinc-500">
          You’ve reached the limit for this idea. Remove something you no longer need to add another.
        </p>
      )}

      {busy && <p className="text-[11px] text-zinc-500">Reading it…</p>}
    </div>
  )
}
