'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-V1b §2–§3h — THE OPENED ACTION RECORD'S NEW PIECES:
//
//   useRecordFacts   — one read per opened record: its documents (the tree's row for this action), its live law rows, its comment count.
//   JumpBand         — 256: one row of buttons under the statement, each naming its section AND its state in words ("Documents · 1 needed,
//                      1 drafted"); the heading menu at the right; what does not fit goes under "≡ More". Sticky, so it is also the way up.
//   DocumentsSection — 3h: one line per document (number, kind, status in words, version, law rows), the "needs" lines, Add a document,
//                      and V2's "Draft what this action needs", shown disabled until it lands. Each line opens the document view.
//   LawSection       — the action's own live law rows, each with the version that wrote it; the idea's whole panel is on the Overview.
//
// ⚠ Colour is never the only cue (§21): ● a document, ○ a missing one, the open one with a 2px border and the word "open".
// ⚠ Imports only pure modules and client components (§28).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { TreeActionRow } from '@/lib/lex/action-documents'
import type { LawRowWords } from '@/lib/lex/document-view'
import { KIND_WORD, GENERATED_KINDS, DOCUMENT_KINDS, needsLine, type DocumentKind } from '@/lib/lex/action-documents-pure'
import { statusWords } from '@/lib/lex/document-view-pure'
import { RELATION_WORD } from '@/lib/lex/law-panel-words'
import { RECORD_SECTIONS, bandFits, type RecordSection } from '@/lib/lex/record-layout-pure'
import { draftPrice, DRAFT_CONFIRM_ABOVE_PENCE, EMPTY_INSTRUCTION } from '@/lib/lex/action-draft-pure'
import { explainFailure } from '@/lib/api-rejection'
import DocumentView, { noteAskWords } from './DocumentView'
import { notePrice } from '@/lib/lex/explanatory-note-pure'
import { AddDialog } from './DocumentsTree'
import { Editor } from './ActionDraftSection'

export type RecordDocuments = TreeActionRow & { lawRows: number; law: Array<LawRowWords & { version: number | null }> }

export function useRecordFacts(ideaId: string, actionId: string) {
  const [docs, setDocs] = useState<RecordDocuments | null>(null)
  const [docsError, setDocsError] = useState<string | null>(null)
  const [comments, setComments] = useState<number | null>(null)
  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/action-documents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'forAction', actionId }) })
      const body = await res.json().catch(() => null)
      if (!res.ok) { setDocsError(explainFailure(body, res.status, 'Reading this action’s documents')); return }
      setDocs((body as { data: RecordDocuments }).data); setDocsError(null)
    } catch (e) { setDocsError(`could not reach the server (${e instanceof Error ? e.message : 'network error'})`) }
  }, [ideaId, actionId])
  useEffect(() => {
    void reload()
    fetch(`/api/ideas/${ideaId}/action-thread?actionId=${encodeURIComponent(actionId)}`).then((r) => r.json()).then((j: { notes?: unknown[] }) => setComments(Array.isArray(j.notes) ? j.notes.length : null)).catch(() => setComments(null))
  }, [ideaId, actionId, reload])
  return { docs, docsError, comments, reload }
}

// ── the jump band (2b) ───────────────────────────────────────────────────────────────────────────────────────
export function JumpBand({ states, onJump, headingSelect }: { states: Record<RecordSection, string>; onJump: (s: RecordSection) => void; headingSelect?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [fits, setFits] = useState<number>(RECORD_SECTIONS.length)
  const [more, setMore] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setFits(bandFits(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const shown = RECORD_SECTIONS.slice(0, fits), rest = RECORD_SECTIONS.slice(fits)
  const button = (s: (typeof RECORD_SECTIONS)[number], inMenu = false) => (
    <button key={s.key} type="button" onClick={() => { setMore(false); onJump(s.key) }} data-band={s.key}
      className={`text-[11px] px-2 py-0.5 rounded border border-zinc-300 bg-white text-left ${inMenu ? 'w-full' : ''}`}>
      <span className="font-semibold">{s.label}</span> · <span data-band-state>{states[s.key]}</span>
    </button>
  )
  return (
    <div ref={ref} className="sticky top-0 z-10 bg-white border-y border-zinc-200 py-1 flex flex-wrap items-center gap-1" data-jump-band aria-label="Jump to a part of this record">
      {shown.map((s) => button(s))}
      {rest.length > 0 && (
        <div className="relative">
          <button type="button" onClick={() => setMore(!more)} aria-expanded={more} data-band-more className="text-[11px] px-2 py-0.5 rounded border border-zinc-300 bg-white font-semibold">≡ More ({rest.length})</button>
          {more && <div className="absolute left-0 mt-1 z-20 w-64 bg-white border-2 border-zinc-900 rounded p-1 space-y-1" data-band-menu>{rest.map((s) => button(s, true))}</div>}
        </div>
      )}
      {headingSelect && <div className="ml-auto shrink-0">{headingSelect}</div>}
    </div>
  )
}

// ── Documents (3h) ───────────────────────────────────────────────────────────────────────────────────────────
export function DocumentsSection({ ideaId, a, facts, disabled, onChanged }: {
  ideaId: string; a: { id: string; number: number | null; avenue: string | null }; facts: ReturnType<typeof useRecordFacts>; disabled: boolean; onChanged: () => void
}) {
  const { docs, docsError, reload } = facts
  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState<DocumentKind | null>(null)
  const [pick, setPick] = useState<DocumentKind>('BACKGROUND_NOTE')
  const [writing, setWriting] = useState(false)
  const [asking, setAsking] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const legislative = a.avenue === 'LEGISLATIVE'
  const price = draftPrice()
  const changed = async () => { await reload(); onChanged() }
  const post = async (url: string, payload: Record<string, unknown>, label: string, ok: (r: Record<string, unknown> | null) => string) => {
    setBusy(true); setSaid(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const body = await res.json().catch(() => null) as { ok?: boolean; result?: Record<string, unknown>; data?: Record<string, unknown>; error?: unknown } | null
      if (!res.ok || body?.ok === false) { setSaid(`Not done: ${explainFailure(body, res.status, label)}`); return false }
      setSaid(ok(body?.result ?? body?.data ?? null)); await changed(); return true
    } finally { setBusy(false) }
  }
  const [askingNote, setAskingNote] = useState(false)
  const draftNote = () => { setAskingNote(false); void post('action-documents', { op: 'draftNote', actionId: a.id }, `Drafting #${a.number ?? '?'}’s explanatory note`, (r) => `Saved: Lex’s explanatory note for #${a.number ?? '?'} is waiting as a proposal — open ${String(r?.d ?? 'the note')} to use it or set it aside${r?.pence != null ? ` (it cost ${Number(r.pence).toFixed(1)}p)` : ''}.`) }
  const draftWithLex = () => { setAsking(false); void post('action-structure', { op: 'draftAction', actionId: a.id }, `Drafting #${a.number ?? '?'}`, (r) => `Saved: Lex’s proposal for #${a.number ?? '?'} is waiting — open the drafting instruction to compare it${r?.pence != null ? ` (it cost ${Number(r.pence).toFixed(1)}p)` : ''}.`) }

  if (docsError) return <p className="text-xs" role="alert">Not read: {docsError}</p>
  if (!docs) return <p className="text-xs text-zinc-500">Reading this action’s documents…</p>
  const live = docs.documents.filter((d) => d.status !== 'SUPERSEDED')
  const needed = docs.needs.kinds
  return (
    <div className="space-y-1.5 text-xs" data-record-documents>
      <p data-needs-line>{needsLine(needed.length, live.filter((d) => needed.includes(d.kind)).length, live.filter((d) => needed.includes(d.kind) && d.status === 'ACCEPTED').length)} · {docs.needs.why}{docs.needs.overridden ? ' (set by hand)' : ''}</p>
      <ul className="space-y-1">
        {live.map((d) => (
          <li key={d.id} data-record-document={d.d}>
            <button type="button" onClick={() => setOpen(open === d.id ? null : d.id)} aria-expanded={open === d.id}
              className={`w-full text-left rounded px-1.5 py-1 ${open === d.id ? 'border-2 border-zinc-900' : 'border border-zinc-200'}`}>
              <span aria-hidden>●</span> <span className="font-semibold">{d.d}</span> {d.title} — {KIND_WORD[d.kind]} · <span className="font-semibold" data-doc-status>{statusWords(d.status, d.acceptedV, d.current?.v ?? null)}</span>
              {d.current ? ` · version ${d.current.v}` : ''}{d.kind === 'DRAFT_CLAUSE' ? ` · ${docs.lawRows} law row${docs.lawRows === 1 ? '' : 's'}` : ''}{d.stale ? ' · out of date' : ''}{d.proposalWaiting ? ' · Lex’s proposal waiting' : ''}
              {open === d.id && <span className="ml-1 font-semibold">open</span>}
            </button>
            {open === d.id && <div className="mt-1"><DocumentView ideaId={ideaId} documentId={d.id} readOnly={disabled} onChanged={() => void changed()} /></div>}
          </li>
        ))}
        {docs.missing.map((k) => (
          <li key={k} data-record-missing={k}>
            <span aria-hidden>○</span> {KIND_WORD[k]} — <span className="font-semibold">none yet</span>
            {!disabled && (GENERATED_KINDS.has(k)
              ? k === 'COLLISION_REPORT' && <> · <button type="button" disabled={busy} className="underline disabled:opacity-40" onClick={() => void post('action-documents', { op: 'generate', what: 'collision', actionId: a.id }, 'Generating the collision report', (r) => `Saved: ${String(r?.d ?? 'the collision report')} generated, ${String(r?.rows ?? 0)} rows.`)}>generate (free)</button></>
              : k === 'DRAFT_CLAUSE'
                ? <> · <button type="button" disabled={busy} className="underline disabled:opacity-40" onClick={() => setWriting(true)}>write the instruction</button>
                    {' · '}{asking
                      ? <span data-draft-confirm>This spends about {price.pence}p ({price.measured ? `measured, n=${price.n}` : 'an estimate'}). <button type="button" onClick={draftWithLex} className="font-semibold underline">Draft it</button> · <button type="button" onClick={() => setAsking(false)} className="underline">Not now</button></span>
                      : <button type="button" disabled={busy} data-draft-button className="underline disabled:opacity-40" onClick={() => (price.pence > DRAFT_CONFIRM_ABOVE_PENCE ? setAsking(true) : draftWithLex())}>draft it with Lex (about {price.pence}p)</button>}</>
                : k === 'EXPLANATORY_NOTE'
                  // 26-V1b §5 — the note: write it by hand, or Lex drafts it as a proposal; asks first, always, at the measured price
                  ? <> · <button type="button" disabled={busy} className="underline disabled:opacity-40" onClick={() => setAdding(k)}>write it</button>
                      {' · '}{askingNote
                        ? <span data-note-confirm>{noteAskWords(notePrice())} <button type="button" onClick={draftNote} className="font-semibold underline">Draft it</button> · <button type="button" onClick={() => setAskingNote(false)} className="underline">Not now</button></span>
                        : <button type="button" disabled={busy} data-note-button className="underline disabled:opacity-40" onClick={() => setAskingNote(true)}>draft it with Lex{notePrice().pence != null ? ` (about ${notePrice().pence}p)` : ''}</button>}</>
                  : <> · <button type="button" disabled={busy} className="underline disabled:opacity-40" onClick={() => setAdding(k)}>write it</button></>)}
          </li>
        ))}
      </ul>
      {writing && <Editor start={EMPTY_INSTRUCTION} legislative={legislative} disabled={busy} onCancel={() => setWriting(false)}
        onSave={async (v) => { if (await post('action-structure', { op: 'saveDraft', actionId: a.id, instruction: v }, `Saving the instruction for #${a.number ?? '?'}`, (r) => `Saved: version ${String(r?.version ?? 1)} of the drafting instruction for #${a.number ?? '?'}.`)) setWriting(false) }} />}
      {!disabled && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1">Add a document
            <select value={pick} onChange={(e) => setPick(e.target.value as DocumentKind)} className="border border-zinc-300 rounded px-1 py-0.5" aria-label="The kind of document to add">
              {DOCUMENT_KINDS.filter((k) => !GENERATED_KINDS.has(k) && k !== 'DRAFT_CLAUSE').map((k) => <option key={k} value={k}>{KIND_WORD[k]}</option>)}
            </select></label>
          <button type="button" disabled={busy} onClick={() => setAdding(pick)} className="px-2 py-0.5 rounded border border-zinc-300 disabled:opacity-40">Add</button>
          <button type="button" disabled aria-disabled="true" data-draft-needs className="px-2 py-0.5 rounded border border-zinc-200 text-zinc-500">Draft what this action needs</button>
          <span className="text-zinc-600">— coming in the next sprint</span>
        </div>
      )}
      {said && <p className="border border-zinc-300 rounded px-2 py-1" role="status">{said} <button type="button" className="underline ml-1" onClick={() => setSaid(null)}>OK</button></p>}
      {adding && <AddDialog action={docs} kind={adding} busy={busy} onClose={() => setAdding(null)}
        onSave={async (title, body) => { if (await post('action-documents', { op: 'addByHand', actionId: a.id, kind: adding, title, body }, 'Adding the document', (r) => `Saved: ${String(r?.d ?? 'the document')} added.`)) setAdding(null) }} />}
    </div>
  )
}

// ── Law: this action's own rows ──────────────────────────────────────────────────────────────────────────────
export function LawSection({ facts, number }: { facts: ReturnType<typeof useRecordFacts>; number: number | null }) {
  const { docs, docsError } = facts
  if (docsError) return <p className="text-xs" role="alert">Not read: {docsError}</p>
  if (!docs) return <p className="text-xs text-zinc-500">Reading…</p>
  return (
    <div className="text-xs space-y-1" data-record-law>
      {docs.law.length
        ? <ul className="space-y-0.5">{docs.law.map((l, i) => <li key={i}><span className="font-semibold">{RELATION_WORD[l.relation]}</span> {l.target}{l.version != null ? ` — from #${number ?? '?'}’s drafting instruction, version ${l.version}` : ''}</li>)}</ul>
        : <p>No law rows yet. They are written when a version of the drafting instruction is saved or Lex’s proposal is used.</p>}
      <p className="text-zinc-600">The idea’s whole law, with the rows attached by hand, is on the Overview’s Law tab.</p>
    </div>
  )
}
