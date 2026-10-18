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

import { useCallback, useEffect, useRef, useState } from 'react'
import { explainFailure } from '@/lib/api-rejection'
import { REGISTRY_OP_WORDS, type RegistryRequest } from '@/lib/lex/research-notebook-schema'
import type { RegistrySource } from '@/lib/lex/source-registry'
import type { PanelEntry } from '@/lib/lex/question-panel'
import { useMaterialViewer } from './YourMaterial'

/**
 * 26-S2 sec 9a (decision 173) - ONE LIST. A document the user filed used to show twice on the research panel: as a Sources card (number, read status, the caveat,
 * Add to report / Set aside) and again under "Your material" (Open / Remove). The panel now shows each ONCE, here: the numbered card carries what the second list
 * carried - **Open** - and "Remove" is gone. What it did (archive the document and delete the findings read from it) was not what the word said; **Set aside** says what it
 * does - the document stays on the record, out of the report, WITH THE REASON KEPT - and **Put back** undoes it. The decisions are the panel's own (`/sources`, keyed by the
 * document), so the Evidence Pack prints them as before.
 */
export interface DocumentCards {
  /** The panel's own entries for the user's documents (the old "Your material" rows), found here by `materialId`. */
  entries: PanelEntry[]
  busy: boolean
  onExclude: (entry: PanelEntry, reason: string) => void
  onInclude: (entry: PanelEntry) => void
  onPrioritise: (entry: PanelEntry, on: boolean) => void
}

export default function SourcesRegistry({ ideaId, onChanged, documents, highlightRef, reloadKey }: { ideaId: string; onChanged?: () => void; documents?: DocumentCards; highlightRef?: number | null; reloadKey?: number }) {
  const viewer = useMaterialViewer(ideaId)
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
  // reloadKey: the panel bumps it when research was added from OUTSIDE this list ("+ Add research" on the contents home), so the new card is here to be found
  useEffect(() => { void load() }, [load, reloadKey])

  const call = useCallback(async (req: RegistryRequest): Promise<{ ok: boolean; result?: any }> => {
    setBusy(REGISTRY_OP_WORDS[req.op]); setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/source-registry`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.ok) { setError(explainFailure(j, res.status, REGISTRY_OP_WORDS[req.op])); return { ok: false } }
      return { ok: true, result: j.result }
    } catch (e) { setError(`${REGISTRY_OP_WORDS[req.op]} could not reach the server (${e instanceof Error ? e.message : 'network error'}). Nothing was changed.`); return { ok: false } } finally { setBusy(null) }
  }, [ideaId])

  const scrolled = useRef<number | null>(null)
  useEffect(() => {
    if (highlightRef == null || scrolled.current === highlightRef || !sources) return
    const el = document.getElementById(`source-${highlightRef}`)
    if (el) { scrolled.current = highlightRef; el.scrollIntoView?.({ block: 'center', behavior: 'smooth' }) }
  }, [highlightRef, sources])

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

      {viewer.node}
      <ol className="space-y-1.5">
        {shown.map((s) => {
          const doc = s.materialId ? documents?.entries.find((e) => e.id === s.materialId) : undefined
          const fresh = highlightRef != null && s.number === highlightRef
          return (
          <li key={s.id} id={`source-${s.number}`} data-source-number={s.number} data-just-added={fresh ? 'true' : undefined}
            className={`rounded-lg bg-white px-2.5 py-1.5 text-xs ${fresh ? 'border-2 border-zinc-900' : 'border border-zinc-200'}`}>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-zinc-900 shrink-0">[Ref: {s.number}]</span>
              <div className="flex-1 min-w-0">
                {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-zinc-900 underline break-words">{s.title}</a> : <span className="text-zinc-900 break-words">{s.title}</span>}
                <div className="text-[11px] text-zinc-500">
                  {[s.sourceType, s.author, s.publishedAt].filter(Boolean).join(' · ')}
                  {s.readStatus === 'NOT_READ' && <span className="font-semibold text-zinc-700">{[s.sourceType, s.author, s.publishedAt].some(Boolean) ? ' · ' : ''}not read{s.readNote ? ` — ${s.readNote}` : ''}</span>}
                </div>
                {s.snippet && <p className="mt-0.5 text-[11px] italic text-zinc-600">{s.snippet}</p>}
                {fresh && <p className="mt-0.5 text-[11px] font-semibold text-zinc-900" role="status">✓ Just added — this is [Ref: {s.number}]</p>}
                {doc && <DocumentLine doc={doc} cards={documents!} onOpen={() => void viewer.open(doc.id)} openBusy={viewer.busy} />}
              </div>
              {s.kind !== 'OWN_OBSERVATION' && !doc && (
                <button type="button" disabled={!!busy} onClick={() => void call({ op: 'archiveSource', sourceId: s.id }).then((r) => { if (r.ok) { void load(); onChanged?.() } })} className="text-[11px] text-zinc-400 hover:text-zinc-700 shrink-0">Remove</button>
              )}
            </div>
          </li>
          )
        })}
      </ol>
      {/* A document that has no numbered source yet (it was filed a moment ago and the list has not been re-read) is still shown, once, here. */}
      {documents && (() => {
        const numbered = new Set(sources.map((x) => x.materialId).filter(Boolean))
        const loose = documents.entries.filter((e) => !numbered.has(e.id))
        return loose.length ? (
          <ul className="space-y-1.5" data-unnumbered-documents>
            {loose.map((e) => (
              <li key={e.id} className="rounded-lg border border-dashed border-zinc-300 bg-white px-2.5 py-1.5 text-xs">
                <span className="text-zinc-900">{e.title}</span> <span className="text-[11px] text-zinc-500">(not numbered yet)</span>
                <DocumentLine doc={e} cards={documents} onOpen={() => void viewer.open(e.id)} openBusy={viewer.busy} />
              </li>
            ))}
          </ul>
        ) : null
      })()}
      {sources.length > 25 && !showAll && <button type="button" onClick={() => setShowAll(true)} className="text-xs underline text-zinc-600">Show all {sources.length}</button>}
    </div>
  )
}

/** What a numbered card carries for a document the user filed: its status, the short caveat (ONCE), Open, Add to report, and Set aside - with a reason - / Put back. */
function DocumentLine({ doc, cards, onOpen, openBusy }: { doc: PanelEntry; cards: DocumentCards; onOpen: () => void; openBusy: boolean }) {
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')
  return (
    <div className="mt-1 space-y-1" data-document-line>
      <p className="text-[11px] text-zinc-600">{doc.why}</p>
      {/* 9b - the caveat, ONCE on the card and SHORT; the long form is in the Evidence Pack */}
      <p className="text-[11px] text-zinc-700 font-medium" data-caveat>{doc.standingLabel}</p>
      {doc.priority && !doc.excluded && <span className="text-[10px] px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-800 text-white">★ In the report</span>}
      {doc.excluded && <p className="text-[11px] text-zinc-700"><span className="font-semibold">Set aside:</span> {doc.exclusionReason || 'no reason recorded'}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onOpen} disabled={openBusy} className="text-[11px] font-medium text-blue-700 hover:text-blue-900 disabled:opacity-40">Open</button>
        {!doc.excluded ? (
          <>
            <button type="button" onClick={() => cards.onPrioritise(doc, !doc.priority)} disabled={cards.busy} aria-pressed={doc.priority}
              className={`text-[11px] rounded border-2 px-1.5 py-0.5 disabled:opacity-40 whitespace-nowrap ${doc.priority ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50'}`}>
              <span aria-hidden>{doc.priority ? '★' : '☆'}</span> {doc.priority ? 'Remove from report' : 'Add to report'}
            </button>
            <button type="button" onClick={() => setAsking((v) => !v)} disabled={cards.busy} className="text-[11px] text-zinc-500 hover:text-zinc-800 disabled:opacity-40">Set aside</button>
          </>
        ) : (
          <button type="button" onClick={() => cards.onInclude(doc)} disabled={cards.busy} className="text-[11px] text-zinc-600 hover:text-zinc-900 disabled:opacity-40">Put back</button>
        )}
      </div>
      {asking && !doc.excluded && (
        <div className="space-y-1">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you setting this aside?" aria-label="Why this document is set aside" className="w-full text-xs rounded border border-zinc-300 px-2 py-1.5" />
          <div className="flex gap-2">
            <button type="button" disabled={cards.busy || !reason.trim()} onClick={() => { cards.onExclude(doc, reason.trim()); setAsking(false); setReason('') }} className="text-[11px] px-2 py-1 rounded bg-zinc-900 text-white disabled:opacity-40">Set aside</button>
            <button type="button" onClick={() => { setAsking(false); setReason('') }} className="text-[11px] px-2 py-1 rounded border border-zinc-300 text-zinc-600">Cancel</button>
          </div>
          <p className="text-[11px] text-zinc-500">It stays on the record and in your evidence pack, marked as considered and set aside, with your reason. Nothing is deleted. “Put back” undoes it.</p>
        </div>
      )}
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
