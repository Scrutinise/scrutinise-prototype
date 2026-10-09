'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-E §3 (built in 26-R) — THE "SOURCES" SECTION: a numbered list, and "Add source".
//
//   · Every source carries a number, and anything in the draft that rests on one shows [Ref: n] pointing here.
//   · "Add source": a title; a web address, or a "+" to attach a document; a snippet box; and "Create snippet" — Lex reads the page or
//     the document and writes a tight 20–80 word snippet.
//   · WHERE A PAGE CANNOT BE READ (parliament.uk and paywalls answer 403), the form SAYS SO and lets the user write the snippet:
//     a source must never look read when it was not. A snippet the user wrote is saved as NOT READ, with the reason.
//   · "Remove" ARCHIVES: the number stays taken, and a [Ref: 7] that is already in a document never becomes a different source.
// ⚠ A fetched page is data, never instruction (the snippet writer fences it). ⚠ Rejections arrive worded (CLAUDE.md §30).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import { explainFailure } from '@/lib/api-rejection'
import { REGISTRY_OP_WORDS, type RegistryRequest } from '@/lib/lex/research-notebook-schema'
import type { RegistrySource } from '@/lib/lex/source-registry'

export default function SourcesRegistry({ ideaId, onChanged }: { ideaId: string; onChanged?: () => void }) {
  const [sources, setSources] = useState<RegistrySource[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/source-registry`)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(explainFailure(j, res.status, 'Loading the sources')); return }
      setSources(j.sources as RegistrySource[]); setError(null)
    } catch (e) { setError(`Loading the sources could not reach the server (${e instanceof Error ? e.message : 'network error'}).`) }
  }, [ideaId])
  useEffect(() => { void load() }, [load])

  const call = useCallback(async (req: RegistryRequest): Promise<{ ok: boolean; result?: any }> => {
    setBusy(REGISTRY_OP_WORDS[req.op]); setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/source-registry`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.ok) { setError(explainFailure(j, res.status, REGISTRY_OP_WORDS[req.op])); return { ok: false } }
      return { ok: true, result: j.result }
    } catch (e) { setError(`${REGISTRY_OP_WORDS[req.op]} could not reach the server (${e instanceof Error ? e.message : 'network error'}). Nothing was changed.`); return { ok: false } } finally { setBusy(null) }
  }, [ideaId])

  if (!sources) return <p className="text-xs text-zinc-500">{error ?? 'Loading the sources…'}</p>
  const shown = showAll ? sources : sources.slice(0, 25)

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-zinc-500">
        {sources.length} source{sources.length === 1 ? '' : 's'}, each with a number. Anything in your draft that rests on one shows <strong>[Ref: n]</strong>. Removing a source archives it — its number is never reused.
      </p>
      {error && <p role="alert" className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">⚠ {error}</p>}
      {busy && <p role="status" className="text-[11px] text-zinc-600">Working: {busy}…</p>}

      <button type="button" onClick={() => setAdding((a) => !a)} aria-expanded={adding}
        className={`text-xs font-medium px-3 py-1 rounded-full border-2 ${adding ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50'}`}>
        {adding ? '− Close' : '+ Add source'}
      </button>
      {adding && <AddSource ideaId={ideaId} call={call} onAdded={() => { setAdding(false); void load(); onChanged?.() }} />}

      <ol className="space-y-1.5">
        {shown.map((s) => (
          <li key={s.id} className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs">
            <div className="flex items-start gap-2">
              <span className="font-semibold text-zinc-900 shrink-0">[Ref: {s.number}]</span>
              <div className="flex-1 min-w-0">
                {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-zinc-900 underline break-words">{s.title}</a> : <span className="text-zinc-900 break-words">{s.title}</span>}
                <div className="text-[11px] text-zinc-500">
                  {[s.sourceType, s.author, s.publishedAt].filter(Boolean).join(' · ')}
                  {s.readStatus === 'NOT_READ' && <span className="font-semibold text-zinc-700">{[s.sourceType, s.author, s.publishedAt].some(Boolean) ? ' · ' : ''}not read{s.readNote ? ` — ${s.readNote}` : ''}</span>}
                </div>
                {s.snippet && <p className="mt-0.5 text-[11px] italic text-zinc-600">{s.snippet}</p>}
              </div>
              {s.kind !== 'OWN_OBSERVATION' && (
                <button type="button" disabled={!!busy} onClick={() => void call({ op: 'archiveSource', sourceId: s.id }).then((r) => { if (r.ok) { void load(); onChanged?.() } })} className="text-[11px] text-zinc-400 hover:text-zinc-700 shrink-0">Remove</button>
              )}
            </div>
          </li>
        ))}
      </ol>
      {sources.length > 25 && !showAll && <button type="button" onClick={() => setShowAll(true)} className="text-xs underline text-zinc-600">Show all {sources.length}</button>}
    </div>
  )
}

function AddSource({ ideaId, call, onAdded }: { ideaId: string; call: (r: RegistryRequest) => Promise<{ ok: boolean; result?: any }>; onAdded: () => void }) {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [snippet, setSnippet] = useState('')
  const [fromLex, setFromLex] = useState(false)
  const [pasted, setPasted] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [rights, setRights] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [working, setWorking] = useState(false)

  async function createSnippet() {
    setNote(null)
    if (file) { setNote({ ok: false, text: 'Lex writes the snippet once the document is added — press Add source, then “Create snippet” on its line. Or write it yourself now.' }); return }
    if (!url.trim() && !pasted.trim()) { setNote({ ok: false, text: 'Give a web address, or paste the text, for Lex to read.' }); return }
    setWorking(true)
    try {
      const r = await call({ op: 'createSnippet', url: url.trim() || undefined, text: pasted.trim() || undefined, title: title.trim() || undefined })
      if (r.ok && r.result?.snippet) { setSnippet(String(r.result.snippet)); setFromLex(true); setNote({ ok: true, text: `Lex read ${r.result.readFrom === 'fetched' ? 'the page' : 'the text'} and wrote ${r.result.words} words. Edit it if you like.` }) }
    } finally { setWorking(false) }
  }

  async function add() {
    setWorking(true); setNote(null)
    try {
      if (file) {
        if (!rights) { setNote({ ok: false, text: 'Tick “I may share this” to keep a document’s text — it is your assertion that you are allowed to. Nothing was added.' }); return }
        const fd = new FormData(); fd.append('file', file); fd.append('label', title.trim()); fd.append('rightsConfirmed', 'true')
        const res = await fetch(`/api/ideas/${ideaId}/material`, { method: 'POST', body: fd })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) { setNote({ ok: false, text: explainFailure(j, res.status, `Adding “${file.name}”`) }); return }
        onAdded(); return
      }
      const r = await call({
        op: 'addSource',
        source: {
          kind: 'URL', title: title.trim() || url.trim() || 'Untitled source', url: url.trim() || null, snippet: snippet.trim() || null,
          // READ only if Lex wrote the snippet FROM the page; a snippet the user typed does not make the page read.
          readStatus: fromLex ? 'READ' : 'NOT_READ',
          readNote: fromLex ? null : snippet.trim() ? 'the snippet was written by hand; the page itself was not read' : 'the address was saved; the page itself was not read',
        },
      })
      if (r.ok) onAdded()
    } finally { setWorking(false) }
  }

  return (
    <div className="rounded-xl border-2 border-zinc-300 bg-white p-3 space-y-2" role="group" aria-label="Add source">
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} placeholder="Title" aria-label="Title" className="w-full border border-zinc-300 rounded px-2 py-1 text-xs" />
      <div className="flex flex-wrap gap-2 items-center">
        <input value={url} onChange={(e) => setUrl(e.target.value)} maxLength={2000} placeholder="A web address" aria-label="Web address" className="flex-1 min-w-[10rem] border border-zinc-300 rounded px-2 py-1 text-xs" />
        <label className="text-xs text-zinc-600 inline-flex items-center gap-1" title="Attach a document instead">
          <span aria-hidden className="font-bold text-sm">+</span> a document
          <input type="file" accept=".pdf,.docx,.txt,.md,.html" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-[11px] w-44" />
        </label>
      </div>
      {file && (
        <label className="flex items-start gap-1.5 text-xs text-zinc-700">
          <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-0.5 accent-zinc-900" />
          <span>I may share this. <span className="text-zinc-500">({file.name}: we keep the text, never the file.)</span></span>
        </label>
      )}
      <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={2} placeholder="Optional — paste the page’s text if the address cannot be fetched (parliament.uk and paywalls refuse us)" aria-label="Pasted text" className="w-full border border-zinc-300 rounded px-2 py-1 text-xs" />
      <textarea value={snippet} onChange={(e) => { setSnippet(e.target.value); setFromLex(false) }} rows={3} maxLength={2000} placeholder="A snippet — 20 to 80 words on what this says" aria-label="Snippet" className="w-full border border-zinc-300 rounded px-2 py-1 text-xs" />
      {note && <p role="status" className={`text-xs rounded px-2 py-1 border ${note.ok ? 'bg-zinc-50 border-zinc-200 text-zinc-700' : 'bg-amber-50 border-amber-200 text-amber-900 font-medium'}`}>{note.ok ? '✓ ' : '✗ '}{note.text}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={working} onClick={() => void createSnippet()} className="text-xs font-medium px-2.5 py-1 rounded border border-zinc-300 disabled:opacity-40">{working ? 'Working…' : 'Create snippet'}</button>
        <button type="button" disabled={working || (!title.trim() && !url.trim() && !file)} onClick={() => void add()} className="text-xs font-medium px-3 py-1 rounded bg-zinc-900 text-white disabled:opacity-40">Add source</button>
      </div>
    </div>
  )
}
