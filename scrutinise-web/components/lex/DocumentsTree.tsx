'use client'

// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-V1 §3 (decision 242) — THE DOCUMENTS TREE: heading → action → document → part, every row with its number, its kind as a SHAPE
// (action ■, document ●, part ▸), its state in WORDS, and for an action "needs N: M drafted". Counts at the top; filters (missing · drafted,
// not accepted · accepted); a find box over titles and numbers. A document opens IN PLACE: current version, versions, sources, parts, and
// Accept / Edit / Ask Lex to redraft. `readOnly` (the Overview's Documents tab) shows the same tree with no controls.
// ⚠ Colour is never the only cue (docs/CLAUDE.md §21): shapes and words carry every state; the open row has a 2px border and "open".
// ⚠ Plain words (§0): document, part, kind, drafted / accepted / no document yet.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DocumentTree, TreeActionRow, TreeDocument } from '@/lib/lex/action-documents'
import { KIND_WORD, GENERATED_KINDS, documentNumber, needsLine, partNumber, treeCounts, type DocumentKind } from '@/lib/lex/action-documents-pure'
import { explainFailure } from '@/lib/api-rejection'
import { LIMITS } from '@/lib/lex/input-limits'
import FocusDialog from './FocusDialog'
import DocumentView from './DocumentView'
import { statusWords } from '@/lib/lex/document-view-pure'
import BoundedInput from './BoundedInput'
import { DraftPlanDialog, DraftRunLine, type DraftScopeInput } from './DraftNeedsPanel'

type Filter = 'all' | 'missing' | 'drafted' | 'accepted'
const FILTER_WORD: Record<Filter, string> = { all: 'All', missing: 'Missing', drafted: 'Drafted, not accepted', accepted: 'Accepted' }


export default function DocumentsTree({ ideaId, readOnly = false }: { ideaId: string; readOnly?: boolean }) {
  const [tree, setTree] = useState<DocumentTree | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [said, setSaid] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [find, setFind] = useState('')
  const [closed, setClosed] = useState<Set<string>>(new Set())
  const [opened, setOpened] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState<{ action: TreeActionRow; kind: DocumentKind } | null>(null)
  // 26-V2b §5 — "Draft what this heading needs": the plan dialog, and the run this page started (null = pick up one already going)
  const [drafting, setDrafting] = useState<DraftScopeInput | null>(null)
  const [runId, setRunId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/ideas/${ideaId}/action-documents`)
    const body = await res.json().catch(() => null)
    if (!res.ok) { setError(explainFailure(body, res.status, 'Reading the documents')); return }
    setTree(body as DocumentTree); setError(null)
  }, [ideaId])
  useEffect(() => { void load() }, [load])

  const post = useCallback(async (payload: Record<string, unknown>, label: string) => {
    setBusy(true); setSaid(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/action-documents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const body = await res.json().catch(() => null)
      if (!res.ok) { setSaid(`Not done: ${explainFailure(body, res.status, label)}`); return null }
      return (body as { data: unknown }).data
    } finally { setBusy(false) }
  }, [ideaId])

  // 26-V1b §3 — a document opens the ONE document view (the same as from the record), which reads its own data
  const open = (doc: TreeDocument) => setOpened(opened === doc.id ? null : doc.id)

  const allActions = useMemo(() => tree?.headings.flatMap((h) => h.actions) ?? [], [tree])
  const counts = useMemo(() => treeCounts(allActions.map((a) => ({ needs: a.needs, documents: a.documents.map((d) => ({ kind: d.kind, status: d.status })) }))), [allActions])

  const q = find.trim().toLowerCase()
  const matches = (a: TreeActionRow) => {
    const live = a.documents.filter((d) => d.status !== 'SUPERSEDED')
    if (filter === 'missing' && !a.missing.length) return false
    if (filter === 'drafted' && !live.some((d) => d.status === 'DRAFTED')) return false
    if (filter === 'accepted' && !live.some((d) => d.status === 'ACCEPTED')) return false
    if (!q) return true
    const hay = [`#${a.number}`, `${a.number}`, a.title ?? '', a.statement, ...a.documents.flatMap((d) => [d.d, documentNumber(a.number, d.number), d.title, KIND_WORD[d.kind]])].join(' ').toLowerCase()
    return hay.includes(q)
  }
  const toggle = (k: string) => setClosed((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })

  if (error) return <p className="text-sm text-zinc-700" role="alert">Not read: {error}</p>
  if (!tree) return <p className="text-sm text-zinc-500">Reading the documents…</p>

  return (
    <div className="space-y-2" data-documents-tree>
      <p className="text-sm font-semibold text-zinc-900" data-tree-counts>{counts.line}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {(Object.keys(FILTER_WORD) as Filter[]).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f} data-tree-filter={f}
            className={`text-xs px-2.5 py-0.5 rounded-full border-2 ${filter === f ? 'font-bold border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-700'}`}>
            {filter === f ? '● ' : '○ '}{FILTER_WORD[f]}
          </button>
        ))}
        <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a title or a number (38, 38.2, D.38.2)" aria-label="Find in the documents"
          className="ml-auto w-72 max-w-full text-xs border border-zinc-300 rounded px-2 py-1" />
      </div>
      {!readOnly && <DraftRunLine key={runId ?? 'latest'} ideaId={ideaId} runId={runId} onProgress={() => void load()} />}
      {said && <p className="text-xs border border-zinc-300 rounded px-2 py-1" role="status">{said} <button type="button" className="underline ml-1" onClick={() => setSaid(null)}>OK</button></p>}

      {tree.headings.map((h) => {
        const rows = h.actions.filter(matches)
        if (!rows.length) return null
        const hk = `h:${h.id ?? 'none'}`
        const hOpen = !closed.has(hk)
        return (
          <section key={hk} className="border border-zinc-200 rounded">
            <div className="flex items-center bg-zinc-50">
              <button type="button" onClick={() => toggle(hk)} aria-expanded={hOpen} className="flex-1 flex items-center gap-2 px-2 py-1 text-left">
                <span aria-hidden>{hOpen ? '▾' : '▸'}</span><span className="text-sm font-semibold">{h.name}</span>
                <span className="text-[11px] text-zinc-500">{rows.length} action{rows.length === 1 ? '' : 's'}</span>
              </button>
              {!readOnly && h.actions.some((a) => a.missing.length) && (
                <button type="button" className="text-xs underline px-2 shrink-0" data-draft-heading onClick={() => setDrafting({ headingId: h.id, label: h.name })}>Draft what this heading needs</button>
              )}
            </div>
            {hOpen && <ul className="divide-y divide-zinc-100">{rows.map((a) => (
              <ActionRow key={a.id} ideaId={ideaId} a={a} readOnly={readOnly} busy={busy} opened={opened} closed={closed} toggle={toggle} onOpen={open} onChanged={() => void load()}
                onGenerate={async (what) => { const r = await post({ op: 'generate', what, actionId: a.id }, 'Generating the collision report') as { d?: string; rows?: number; unchanged?: boolean } | null; if (r) { setSaid(r.unchanged ? `Unchanged: ${r.d} already matches the clause and the effects data.` : `Saved: ${r.d} generated, ${r.rows} row${r.rows === 1 ? '' : 's'}.`); await load() } }}
                onAdd={(kind) => setAdding({ action: a, kind })}
                onDraftNeeds={() => setDrafting({ actionId: a.id, label: `#${a.number ?? '?'}` })}
                onNeeds={async (mode, kinds, reason) => { const r = await post({ op: 'setNeeds', actionId: a.id, mode, kinds, reason }, `Changing what #${a.number} needs`); if (r) { setSaid(`Saved: what #${a.number} needs.`); await load() } }}
              />
            ))}</ul>}
          </section>
        )
      })}

      {drafting && (
        <DraftPlanDialog ideaId={ideaId} scope={drafting} onClose={() => setDrafting(null)}
          onQueued={(id, line) => { setRunId(id); setDrafting(null); setSaid(line) }} />
      )}

      {adding && (
        <AddDialog action={adding.action} kind={adding.kind} busy={busy} onClose={() => setAdding(null)}
          onSave={async (title, body) => { const r = await post({ op: 'addByHand', actionId: adding.action.id, kind: adding.kind, title, body }, 'Adding the document') as { d?: string } | null; if (r) { setSaid(`Saved: ${r.d} added.`); setAdding(null); await load() } }} />
      )}
    </div>
  )
}

function ActionRow({ ideaId, a, readOnly, busy, opened, closed, toggle, onOpen, onChanged, onGenerate, onAdd, onNeeds, onDraftNeeds }: {
  ideaId: string; a: TreeActionRow; readOnly: boolean; busy: boolean; opened: string | null; closed: Set<string>; toggle: (k: string) => void
  onOpen: (d: TreeDocument) => void; onChanged: () => void; onGenerate: (what: 'collision') => void; onAdd: (k: DocumentKind) => void
  onNeeds: (mode: 'derived' | 'nothing' | 'set', kinds: DocumentKind[] | undefined, reason: string) => void
  onDraftNeeds: () => void
}) {
  const ak = `a:${a.id}`
  const isOpen = !closed.has(ak)
  const live = a.documents.filter((d) => d.status !== 'SUPERSEDED')
  const [needsOpen, setNeedsOpen] = useState(false)
  return (
    <li className="px-2 py-1.5" data-tree-action={a.number ?? ''}>
      <div className="flex items-start gap-2">
        <button type="button" onClick={() => toggle(ak)} aria-expanded={isOpen} className="text-xs mt-0.5" aria-label={`${isOpen ? 'Close' : 'Open'} #${a.number}`}>{isOpen ? '▾' : '▸'}</button>
        <span aria-hidden className="text-xs mt-0.5">■</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm"><span className="font-semibold">#{a.number}</span> {a.title ?? a.statement.slice(0, 120)}</p>
          <p className="text-[11px] text-zinc-600" data-needs-line>
            {needsLine(a.needs.kinds.length, live.filter((d) => a.needs.kinds.includes(d.kind)).length, live.filter((d) => a.needs.kinds.includes(d.kind) && d.status === 'ACCEPTED').length)}
            {' · '}{a.needs.why}{a.needs.overridden ? ' (set by hand)' : ''}
            {!readOnly && <button type="button" className="underline ml-1" onClick={() => setNeedsOpen(!needsOpen)}>Change what this needs</button>}
            {!readOnly && a.missing.length > 0 && <button type="button" className="underline ml-1" data-draft-action onClick={onDraftNeeds}>Draft what this action needs</button>}
          </p>
          {needsOpen && !readOnly && <NeedsForm busy={busy} onSave={(m, k, r) => { onNeeds(m, k, r); setNeedsOpen(false) }} />}
        </div>
      </div>
      {isOpen && (
        <ul className="ml-8 mt-1 space-y-1">
          {a.documents.map((d) => (
            <li key={d.id} data-tree-document={d.d}>
              <button type="button" onClick={() => onOpen(d)} aria-expanded={opened === d.id}
                className={`w-full text-left text-xs rounded px-1.5 py-1 ${opened === d.id ? 'border-2 border-zinc-900' : 'border border-zinc-200'}`}>
                <span aria-hidden>●</span> <span className="font-semibold">{documentNumber(a.number, d.number)}</span> {d.title}
                <span className="text-zinc-600"> — {KIND_WORD[d.kind]} · <span data-doc-status>{statusWords(d.status, d.acceptedV, d.current?.v ?? null)}</span>{d.stale ? ' · out of date' : ''}{d.proposalWaiting ? ' · Lex’s proposal waiting' : ''} · {d.d}</span>
                {opened === d.id && <span className="ml-1 font-semibold">open</span>}
              </button>
              {opened === d.id && <div className="ml-5 mt-1"><DocumentView ideaId={ideaId} documentId={d.id} readOnly={readOnly} onChanged={onChanged} /></div>}
              {opened !== d.id && d.parts.length > 1 && (
                <ul className="ml-5 mt-0.5">{d.parts.map((p) => <li key={p.n} className="text-[11px] text-zinc-600"><span aria-hidden>▸</span> {partNumber(a.number, d.number, p.n)} {p.title}</li>)}</ul>
              )}
            </li>
          ))}
          {a.missing.map((k) => (
            <li key={k} className="text-xs text-zinc-700" data-tree-missing={k}>
              <span aria-hidden>○</span> {KIND_WORD[k]} — <span className="font-semibold">no document yet</span>
              {!readOnly && (GENERATED_KINDS.has(k)
                ? k === 'COLLISION_REPORT' && <button type="button" disabled={busy} className="underline ml-1 disabled:opacity-40" onClick={() => onGenerate('collision')}>Generate it (free)</button>
                : <button type="button" disabled={busy} className="underline ml-1 disabled:opacity-40" onClick={() => onAdd(k)}>Write it</button>)}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function NeedsForm({ busy, onSave }: { busy: boolean; onSave: (mode: 'derived' | 'nothing' | 'set', kinds: DocumentKind[] | undefined, reason: string) => void }) {
  const [mode, setMode] = useState<'derived' | 'nothing' | 'set'>('nothing')
  const [kinds, setKinds] = useState<DocumentKind[]>([])
  const [reason, setReason] = useState('')
  return (
    <div className="mt-1 border border-zinc-200 rounded p-1.5 space-y-1 text-xs" data-needs-form>
      <fieldset className="flex flex-wrap gap-2"><legend className="sr-only">What this action needs</legend>
        {([['derived', 'Work it out from the avenue and instrument'], ['nothing', 'Needs no document'], ['set', 'Needs exactly these']] as const).map(([m, w]) => (
          <label key={m}><input type="radio" name="needs-mode" checked={mode === m} onChange={() => setMode(m)} /> {w}</label>
        ))}
      </fieldset>
      {mode === 'set' && <div className="flex flex-wrap gap-2">{(Object.keys(KIND_WORD) as DocumentKind[]).map((k) => (
        <label key={k}><input type="checkbox" checked={kinds.includes(k)} onChange={(e) => setKinds(e.target.checked ? [...kinds, k] : kinds.filter((x) => x !== k))} /> {KIND_WORD[k]}</label>
      ))}</div>}
      {mode !== 'derived' && <BoundedInput value={reason} onChange={setReason} max={LIMITS.ruleOutReason} placeholder="Why — recorded with the choice" aria-label="Why this action needs what it needs" className="w-full text-xs border border-zinc-300 rounded px-1.5 py-0.5" wrapperClassName="w-full" />}
      <button type="button" disabled={busy} onClick={() => onSave(mode, mode === 'set' ? kinds : undefined, reason)} className="px-2 py-0.5 rounded bg-zinc-900 text-white disabled:opacity-40">Save</button>
    </div>
  )
}

export function AddDialog({ action, kind, busy, onClose, onSave }: { action: TreeActionRow; kind: DocumentKind; busy: boolean; onClose: () => void; onSave: (title: string, body: string) => void }) {
  const [title, setTitle] = useState(`${KIND_WORD[kind][0].toUpperCase()}${KIND_WORD[kind].slice(1)} for #${action.number}`)
  const [body, setBody] = useState('')
  return (
    <FocusDialog title={`Write the ${KIND_WORD[kind]} for #${action.number}`} onClose={onClose}
      footer={<button type="button" disabled={busy || !title.trim()} onClick={() => onSave(title, body)} className="px-3 py-1 rounded bg-zinc-900 text-white text-sm disabled:opacity-40">Save the document</button>}>
      <div className="space-y-2 text-sm">
        <label className="block">Title<BoundedInput value={title} onChange={setTitle} max={LIMITS.documentTitle} aria-label="The document’s title" className="w-full border border-zinc-300 rounded px-2 py-1" wrapperClassName="w-full" /></label>
        <label className="block">The text — use “## ” to start each numbered part<BoundedInput multiline rows={12} value={body} onChange={setBody} max={LIMITS.documentText} aria-label="The document’s text" className="w-full border border-zinc-300 rounded px-2 py-1 text-xs" wrapperClassName="w-full" /></label>
      </div>
    </FocusDialog>
  )
}
