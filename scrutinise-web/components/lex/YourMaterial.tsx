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
  ideaId, onChanged,
}: {
  ideaId: string
  onChanged?: () => void
}) {
  const [rows, setRows] = useState<MaterialRow[]>([])
  const [remaining, setRemaining] = useState<number>(0)
  const [maxBytes, setMaxBytes] = useState<number>(0)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/ideas/${ideaId}/material`)
    if (!res.ok) return
    const body = await res.json()
    setRows(body.material ?? [])
    setRemaining(body.remaining ?? 0)
    setMaxBytes(body.maxBytes ?? 0)
  }, [ideaId])

  useEffect(() => { void load() }, [load])

  const after = useCallback(async (res: Response) => {
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(typeof body?.error === 'string' ? body.error : 'That could not be added.')
      return
    }
    setRows(body.material ?? [])
    setRemaining(body.remaining ?? 0)
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
