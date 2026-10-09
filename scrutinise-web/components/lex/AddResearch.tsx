'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-R §2 (DECISION 133) — "+ ADD RESEARCH": THE ONE DOOR, ON EVERY SURFACE.
//
// It replaces "+ Add a file or link" everywhere it appeared. One form takes a file, a link, pasted text of ANY length, a quote, or
// nothing but a thought:
//   · paste text of any length, OR choose a file, OR give a URL, OR write only a thought;
//   · for text or a document: SELECT THE PASSAGE THAT IS THE QUOTE — the rest is kept as the source's text and read into findings as
//     uploads are today;
//   · for a URL: fetch a readable view with select-to-quote. Where the page refuses (parliament.uk and paywalls answer 403) the
//     form SAYS SO and tells the user to paste the text — it never pretends a page was read;
//   · comment, tags, stance, bears-on: all optional, all addable later;
//   · SAVE CONFIRMS VISIBLY — with the note's source number — and nothing is asked twice.
// Four surfaces mount this same component: the research panel, the left panel beside Lex, the Overview page's Research tab, and the
// bookmarklet page. (Lex has a tool, `add_research_note`, that calls the same library.)
//
// ⚠ A NOTE CITES A REGISTRY SOURCE, ALWAYS: a new one (named here), one already on the list, or "My own observation".
// ⚠ A STANCE IS A WORD AND A SHAPE (✓ ✗ ○ ?), never colour alone. ⚠ Every rejection is worded by the server (CLAUDE.md §30).
// ⚠ FILING A DOCUMENT IS AN ASSERTION: the "I may share this" box is the user's, never defaulted on.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  STANCES, STANCE_LABEL, STANCE_GLYPH, BEARS_ON_LABEL, type Stance, type BearsOnRef, type NotebookRequest,
} from '@/lib/lex/research-notebook-schema'
import { explainFailure } from '@/lib/api-rejection'

interface SourceOption { id: string; number: number; title: string; kind: string }
interface Initial { url?: string; title?: string; text?: string }

export default function AddResearch({
  ideaId, onSaved, initial, defaultOpen = false, label = 'Add research', compact = false, bare = false,
}: {
  ideaId: string
  onSaved?: () => void
  initial?: Initial
  defaultOpen?: boolean
  label?: string
  compact?: boolean
  /** The form only, with no toggle button of its own — for a host that already opens and closes a panel (the cards, the Build page). */
  bare?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen || bare)
  const [sources, setSources] = useState<SourceOption[]>([])
  const [bearsOptions, setBearsOptions] = useState<BearsOnRef[]>([])

  // what is being added
  const [url, setUrl] = useState(initial?.url ?? '')
  const [fileName, setFileName] = useState<string | null>(null)
  const [sourceText, setSourceText] = useState('') // the text the quote is selected from (fetched / extracted / pasted)
  const [textLocked, setTextLocked] = useState(false) // fetched or extracted text is not edited, only selected from
  const [title, setTitle] = useState(initial?.title ?? '')
  const [author, setAuthor] = useState('')
  const [publishedAt, setPublishedAt] = useState('')
  const [fetchNote, setFetchNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [fetching, setFetching] = useState(false)
  const [rights, setRights] = useState(false)

  const [quote, setQuote] = useState(initial?.text ?? '')
  const [location, setLocation] = useState('')
  const [comment, setComment] = useState('')
  const [stance, setStance] = useState<Stance>('UNDECIDED')
  const [tags, setTags] = useState('')
  const [bears, setBears] = useState<BearsOnRef[]>([])
  const [mineOnly, setMineOnly] = useState(false)
  const [pick, setPick] = useState<string>('') // '' = decide below, 'own' = my own observation, else a registry source id

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ ref: number; title: string; status: string; noNote?: boolean } | null>(null)
  const textRef = useRef<HTMLTextAreaElement | null>(null)

  const hasDocument = !!(sourceText.trim() || url.trim() || fileName)
  const wantsNewSource = !pick && (hasDocument || !!title.trim())

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      try {
        const [s, n] = await Promise.all([
          fetch(`/api/ideas/${ideaId}/source-registry`).then((r) => r.json()),
          fetch(`/api/ideas/${ideaId}/research-notebook?options=1`).then((r) => r.json()),
        ])
        if (cancelled) return
        setSources(Array.isArray(s.sources) ? s.sources.filter((x: SourceOption & { kind: string }) => x.kind !== 'OWN_OBSERVATION') : [])
        setBearsOptions(Array.isArray(n.bearsOnOptions) ? n.bearsOnOptions : [])
      } catch { /* the form still works without the lists; the server words any problem */ }
    })()
    return () => { cancelled = true }
  }, [open, ideaId])

  const reset = useCallback(() => {
    setUrl(''); setFileName(null); setSourceText(''); setTextLocked(false); setTitle(''); setAuthor(''); setPublishedAt(''); setFetchNote(null)
    setRights(false); setQuote(''); setLocation(''); setComment(''); setStance('UNDECIDED'); setTags(''); setBears([]); setMineOnly(false); setPick(''); setError(null)
  }, [])

  async function fetchPage() {
    if (!url.trim() || fetching) return
    setFetching(true); setError(null); setFetchNote(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/research-notebook/fetch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url.trim() }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(explainFailure(j, res.status, 'Fetching the page'))
      if (j.refused) { setFetchNote({ ok: false, text: String(j.message) }); return }
      setSourceText(String(j.text ?? '')); setTextLocked(true)
      if (!title.trim() && j.title) setTitle(String(j.title))
      if (j.finalUrl) setUrl(String(j.finalUrl))
      setFetchNote({ ok: true, text: `Fetched a readable view${j.truncated ? ' (shortened — the page was longer than we keep)' : ''}. Select the passage you want as the quote.` })
    } catch (e) { setError(e instanceof Error ? e.message : 'The page could not be fetched.') } finally { setFetching(false) }
  }

  async function readFile(f: File | null) {
    if (!f) return
    setFetching(true); setError(null); setFetchNote(null); setFileName(f.name)
    try {
      const fd = new FormData(); fd.append('file', f)
      const res = await fetch(`/api/ideas/${ideaId}/research-notebook/extract`, { method: 'POST', body: fd })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(explainFailure(j, res.status, `Reading “${f.name}”`))
      if (j.refused) { setFetchNote({ ok: false, text: String(j.message) }); setFileName(null); return }
      setSourceText(String(j.text ?? '')); setTextLocked(true)
      if (!title.trim()) setTitle(String(j.title ?? f.name))
      setFetchNote({ ok: true, text: `Read “${f.name}”${j.truncated ? ' (shortened — it was longer than we keep)' : ''}. Select the passage you want as the quote.` })
    } catch (e) { setError(e instanceof Error ? e.message : 'The file could not be read.'); setFileName(null) } finally { setFetching(false) }
  }

  function useSelection() {
    const ta = textRef.current
    if (!ta) return
    const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd).trim()
    if (!sel) { setError('Select the passage in the text above first (drag across it), then press the button.'); return }
    setError(null); setQuote(sel.slice(0, 8000))
  }

  async function save() {
    if (saving) return
    setSaving(true); setError(null)
    try {
      const base = {
        quote: quote.trim() || null, quoteLocation: location.trim() || null, comment: comment.trim() || null, stance,
        bearsOn: bears, tags: tags.split(/[,;\n]/).map((t) => t.trim()).filter(Boolean), mineOnly,
      }
      const req: NotebookRequest = pick === 'own'
        ? { op: 'addNote', ownObservation: true, ...base }
        : pick
          ? { op: 'addNote', sourceId: pick, ...base }
          : {
              op: 'addNote',
              newSource: {
                kind: fileName || (!url.trim() && sourceText.trim()) ? 'DOCUMENT' : url.trim() ? 'URL' : 'OWN_OBSERVATION',
                title: title.trim() || (url.trim() ? url.trim() : 'Untitled'),
                url: url.trim() || null, author: author.trim() || null, publishedAt: publishedAt.trim() || null,
                sourceType: fileName ? 'document' : url.trim() ? 'web page' : null,
                ...(sourceText.trim() ? { fullText: sourceText, rightsConfirmed: rights, readStatus: 'READ' as const } : {}),
              },
              ...base,
            }
      const res = await fetch(`/api/ideas/${ideaId}/research-notebook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.ok) { setError(explainFailure(j, res.status, 'Saving the research')); return }
      const sel = sources.find((s) => s.id === pick)
      setSaved({ ref: j.result.ref, title: pick === 'own' ? 'My own observation' : sel?.title ?? (title.trim() || url.trim() || 'your source'), status: j.result.status, noNote: !j.result.noteId })
      reset(); onSaved?.()
    } catch (e) { setError(`Saving the research could not reach the server (${e instanceof Error ? e.message : 'network error'}). Nothing was saved.`) } finally { setSaving(false) }
  }

  const trigger = (
    <button
      type="button"
      onClick={() => { setOpen((o) => !o); setSaved(null) }}
      aria-expanded={open}
      title="Add a file, a link, pasted text, a quote or just a thought — to the notebook, with its source"
      className={`${compact ? 'text-[11px] px-2.5 py-1' : 'text-xs px-3 py-1.5'} font-medium rounded-full border-2 inline-flex items-center gap-1.5 ${
        open ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50'
      }`}
    >
      <span aria-hidden className="text-sm leading-none">{open ? '−' : '+'}</span>
      <span>{open ? 'Close' : label}</span>
    </button>
  )

  if (!open) return <div className="mb-2">{trigger}{saved && <SavedLine s={saved} />}</div>

  return (
    <div className="mb-2">
      {bare ? null : trigger}
      <div className={`${bare ? '' : 'mt-2 '}rounded-xl border-2 border-zinc-300 bg-white p-3 space-y-3 text-sm`} role="group" aria-label="Add research">
        {saved && <SavedLine s={saved} />}
        {error && <p role="alert" className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">⚠ {error}</p>}

        <fieldset className="space-y-2">
          <legend className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">1 · What are you adding? (any one — or nothing but a thought)</legend>
          <div className="flex flex-wrap gap-1.5 items-center">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="A web address" aria-label="Web address"
              className="flex-1 min-w-[12rem] border border-zinc-300 rounded px-2 py-1 text-xs" />
            <button type="button" onClick={() => void fetchPage()} disabled={!url.trim() || fetching} className="text-xs font-medium px-2.5 py-1 rounded border border-zinc-300 disabled:opacity-40">
              {fetching ? 'Fetching…' : 'Fetch a readable view'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 items-center text-xs text-zinc-600">
            <label className="inline-flex items-center gap-1.5">or a file
              <input type="file" onChange={(e) => { void readFile(e.target.files?.[0] ?? null); e.target.value = '' }} className="text-xs" /></label>
            {fileName && <span className="text-zinc-700">· {fileName}</span>}
          </div>
          {fetchNote && <p className={`text-xs rounded px-2 py-1 border ${fetchNote.ok ? 'bg-zinc-50 border-zinc-200 text-zinc-700' : 'bg-amber-50 border-amber-200 text-amber-900 font-medium'}`}>{fetchNote.ok ? '✓ ' : '✗ '}{fetchNote.text}</p>}
          <label className="block text-[11px] text-zinc-500">…or paste the text here, of any length{textLocked ? ' (this is the text we read — select a passage from it)' : ''}</label>
          <textarea ref={textRef} value={sourceText} onChange={(e) => !textLocked && setSourceText(e.target.value)} readOnly={textLocked} rows={sourceText ? 7 : 3}
            placeholder="Paste an article, a report, a passage — or leave this empty and just write a thought below."
            className={`w-full border border-zinc-300 rounded px-2 py-1.5 text-xs ${textLocked ? 'bg-zinc-50' : ''}`} />
          {sourceText.trim() && (
            <div className="flex flex-wrap gap-2 items-center">
              <button type="button" onClick={useSelection} className="text-xs font-medium px-2.5 py-1 rounded bg-zinc-900 text-white">Use the selected passage as the quote</button>
              {textLocked && <button type="button" onClick={() => { setSourceText(''); setTextLocked(false); setFileName(null); setFetchNote(null) }} className="text-xs underline text-zinc-500">Clear the text</button>}
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-1.5">
          <legend className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">2 · The quote (optional) and the comment (optional)</legend>
          <textarea value={quote} onChange={(e) => setQuote(e.target.value)} rows={3} maxLength={8000} placeholder="The quote — word for word, from the source" aria-label="Quote"
            className="w-full border border-zinc-300 rounded px-2 py-1.5 text-xs" />
          <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} placeholder="Where in the source (page, paragraph, section, timestamp)" aria-label="Where the quote is from"
            className="w-full border border-zinc-300 rounded px-2 py-1 text-xs" />
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={8000} placeholder="Your comment — in your own words" aria-label="Comment"
            className="w-full border border-zinc-300 rounded px-2 py-1.5 text-xs" />
        </fieldset>

        <fieldset className="space-y-1.5">
          <legend className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">3 · The source (every note has one)</legend>
          <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Which source" className="w-full border border-zinc-300 rounded px-2 py-1 text-xs">
            <option value="">{hasDocument || title.trim() ? 'A new source — named below' : 'Choose…'}</option>
            <option value="own">My own observation</option>
            {sources.map((s) => <option key={s.id} value={s.id}>[Ref: {s.number}] {s.title.slice(0, 90)}</option>)}
          </select>
          {!pick && (
            <div className="grid gap-1.5 sm:grid-cols-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} placeholder="Title of the source" aria-label="Title" className="sm:col-span-3 border border-zinc-300 rounded px-2 py-1 text-xs" />
              <input value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={200} placeholder="Author" aria-label="Author" className="border border-zinc-300 rounded px-2 py-1 text-xs" />
              <input value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} maxLength={80} placeholder="Date" aria-label="Date" className="border border-zinc-300 rounded px-2 py-1 text-xs" />
            </div>
          )}
          {!pick && sourceText.trim() && (
            <label className="flex items-start gap-1.5 text-xs text-zinc-700">
              <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-0.5 accent-zinc-900" />
              <span>I may share this. <span className="text-zinc-500">(Keeping a document’s text is your assertion that you are allowed to.)</span></span>
            </label>
          )}
        </fieldset>

        <fieldset className="space-y-1.5">
          <legend className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">4 · Optional — add them now or later</legend>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Stance">
            {STANCES.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={stance === s} onClick={() => setStance(s)}
                className={`text-xs px-2.5 py-1 rounded-full border-2 ${stance === s ? 'bg-zinc-900 border-zinc-900 text-white font-semibold' : 'bg-white border-zinc-300 text-zinc-700'}`}>
                <span aria-hidden>{STANCE_GLYPH[s]}</span> {STANCE_LABEL[s]}
              </button>
            ))}
          </div>
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags, separated by commas" aria-label="Tags" className="w-full border border-zinc-300 rounded px-2 py-1 text-xs" />
          <div className="space-y-1">
            <select value="" onChange={(e) => { const o = bearsOptions.find((x) => `${x.kind}:${x.id}` === e.target.value); if (o && !bears.some((b) => b.id === o.id)) setBears([...bears, o]) }}
              aria-label="Bears on" className="w-full border border-zinc-300 rounded px-2 py-1 text-xs">
              <option value="">Bears on… (a cause, the policy, an action, a challenge, a decision)</option>
              {bearsOptions.map((o) => <option key={`${o.kind}:${o.id}`} value={`${o.kind}:${o.id}`}>{BEARS_ON_LABEL[o.kind]} · {(o.label ?? '').slice(0, 80)}</option>)}
            </select>
            {bears.length > 0 && (
              <ul className="flex flex-wrap gap-1">
                {bears.map((b) => (
                  <li key={b.id} className="text-[11px] border border-zinc-300 rounded-full px-2 py-0.5 bg-zinc-50">
                    {BEARS_ON_LABEL[b.kind]}: {(b.label ?? b.id).slice(0, 40)} <button type="button" onClick={() => setBears(bears.filter((x) => x.id !== b.id))} aria-label="Remove" className="ml-1 text-zinc-500">×</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-zinc-700">
            <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} className="accent-zinc-900" /> Mine only until I share it
          </label>
        </fieldset>

        <div className="flex flex-wrap gap-2 items-center">
          <button type="button" onClick={() => void save()} disabled={saving || (!quote.trim() && !comment.trim() && !(wantsNewSource && !pick)) || (!pick && !wantsNewSource && !title.trim())}
            className="text-sm font-medium px-3 py-1.5 rounded-lg bg-zinc-900 text-white disabled:opacity-40">
            {saving ? 'Saving…' : 'Save'}
          </button>
          <span className="text-[11px] text-zinc-500">{!quote.trim() && !comment.trim() && !wantsNewSource ? 'Add a quote, a comment, or a file, link or text to save.' : ''}</span>
          <button type="button" onClick={() => { reset(); setSaved(null) }} className="text-xs underline text-zinc-500 ml-auto">Start again</button>
        </div>
      </div>
    </div>
  )
}

function SavedLine({ s }: { s: { ref: number; title: string; status: string; noNote?: boolean } }) {
  return (
    <p role="status" className="mt-2 text-xs font-medium text-zinc-900 border-2 border-zinc-800 rounded px-2 py-1.5 bg-zinc-50">
      ✓ Saved — cited as <strong>[Ref: {s.ref}]</strong> {s.title}.{' '}
      <span className="font-normal text-zinc-600">
        {s.noNote ? 'The source is on the list; no note was written (you can add one any time).' : s.status === 'UNREVIEWED' ? 'The note is waiting for the idea’s owner to put it in the record.' : 'The note is in the record.'}
      </span>
    </p>
  )
}
