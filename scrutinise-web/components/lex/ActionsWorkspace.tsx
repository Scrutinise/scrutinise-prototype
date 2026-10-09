'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-Q — THE COHERENT-ACTIONS LIST, MADE WORKABLE AT FIFTY OR A HUNDRED ROWS.
//
//   §1  a title on every action (editable; Lex drafts them as PROPOSALS)         §5 merge · compare · find duplicates
//   §2  a titles-only list: open in place, drag, bulk select, a heading dropdown   §6 the coverage grid · the sequence view
//   §3  the user's headings — a colour trim AND the name AND a shape               §7 park (Later phase) · rule out (restorable)
//   §4  facets, regroupable with one control
//
// ⚠ NOTHING IS SIGNALLED BY COLOUR ALONE (docs/CLAUDE.md §21; Charlie is colour blind): a heading is its NAME, a SHAPE glyph
// that differs per colour, a palette spread down a lightness ladder, and only then the colour. Every state is also a word.
// ⚠ EVERY MODEL OUTPUT HERE IS A PROPOSAL the user accepts, edits or dismisses; nothing deletes (rule-out and merge keep the row).
// ⚠ The full action card is passed in (`renderFull`) so this file does not import FieldsPanel (no cycle) and the existing
// editing, costing and cost lines are reused as they are.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { CanonicalAction, CanonicalActionHeading, CanonicalCause } from '@/lib/lex/page1-config'
import { HEADING_PALETTE, colourFor } from '@/lib/lex/action-headings'
import { POLICY_VERDICT_UI } from '@/lib/lex/action-facets'
import type { ActionStructureRequest, ActionStructureOp } from '@/lib/lex/action-structure-schema'
import { OP_WORDS } from '@/lib/lex/action-structure-schema'
import { explainFailure } from '@/lib/api-rejection'
import {
  AVENUES, AVENUE_LABEL, SEQUENCES, SEQUENCE_LABEL, GROUP_MODES, GROUP_MODE_LABEL,
  actionLabel, specificEnough, groupActions, coverageGrid, sequenceLayout, type GroupMode,
} from '@/lib/lex/action-facets'

// ── talking to the route ─────────────────────────────────────────────────────────────────────────────────

interface OpResult<T = unknown> { ok: boolean; result: T | null; error: string | null }

/** The body of a call, typed against the route's own schema: `ids` where the route wants `actionIds` is a compile error. */
type Bodies = { [R in ActionStructureRequest as R['op']]: Omit<R, 'op'> }

function useOps(ideaId: string, onChanged: () => void) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  // `K` is inferred from `op`, so `body` is checked against THAT op's schema. The result is untyped (`any`); the few callers
  // that read it annotate it where they use it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const run = useCallback(async <K extends keyof Bodies>(op: K, body: Bodies[K], label?: string): Promise<OpResult<any>> => {
    type T = any // eslint-disable-line @typescript-eslint/no-explicit-any
    setBusy(label ?? op); setError(null)
    const url = `/api/ideas/${ideaId}/action-structure`
    const sent = { op, ...body }
    const control = OP_WORDS[op]
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sent) })
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; error?: unknown }
      // §30 — every rejection says which input and why. `explainFailure` words even an old-shape body.
      const err = j.error || !res.ok ? explainFailure(j, res.status, control) : null
      if (err) { setError(err); return { ok: false, result: null, error: err } }
      onChanged()
      return { ok: true, result: (j.result ?? null) as T | null, error: null }
    } catch (e) {
      const m = `${control} could not reach the server (${e instanceof Error ? e.message : 'network error'}). Nothing was changed.`
      setError(m); return { ok: false, result: null, error: m }
    } finally { setBusy(null) }
  }, [ideaId, onChanged])
  return { run, busy, error, note, setNote, clearError: () => setError(null) }
}

const FACET_WORD = { avenue: 'Avenue', sequence: 'Sequence', link: 'Link', causes: 'Causes', before: 'Comes before' }

// ── the heading mark: name + shape + colour, together ───────────────────────────────────────────────────

function HeadingMark({ h, withName = true }: { h: Pick<CanonicalActionHeading, 'name' | 'colourKey'>; withName?: boolean }) {
  const c = colourFor(h.colourKey)
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-800" title={`${h.name} (${c.name})`}>
      <span aria-hidden style={{ color: c.hex }} className="leading-none">{c.glyph}</span>
      {withName && <span>{h.name}</span>}
    </span>
  )
}

interface Props {
  ideaId: string
  actions: CanonicalAction[]
  setAside: CanonicalAction[]
  headings: CanonicalActionHeading[]
  causes: CanonicalCause[]
  busy: boolean
  onChanged: () => void
  /** The full existing action card (edit, costs, cost lines) — shown in place when a title is opened. */
  renderFull: (a: CanonicalAction) => ReactNode
  /** Ids of rows to render already open. Used by the render checks, so that what an OPENED row shows is read from the output. */
  initiallyOpen?: string[]
}

type View = 'list' | 'coverage' | 'sequence'

export default function ActionsWorkspace({ ideaId, actions, setAside, headings, causes, busy: parentBusy, onChanged, renderFull, initiallyOpen }: Props) {
  const ops = useOps(ideaId, onChanged)
  const [view, setView] = useState<View>('list')
  const [mode, setMode] = useState<GroupMode>('heading')
  const [open, setOpen] = useState<Set<string>>(new Set(initiallyOpen ?? []))
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [newHeading, setNewHeading] = useState('')
  const [suggestions, setSuggestions] = useState<Array<{ name: string; why: string }> | null>(null)
  const [dupes, setDupes] = useState<null | { pairs: Array<{ a: string; b: string; aNumber: number | null; bNumber: number | null; aLabel: string; bLabel: string; score: number; sharedCauseIds: string[] }>; ignoredUniversalCauses: Array<{ number: number; cause: string }> }>(null)
  const [pair, setPair] = useState<null | { a: number; b: number; mode: 'merge' | 'compare' }>(null)
  const [reason, setReason] = useState('')
  const [showParked, setShowParked] = useState(false)
  const [showSetAside, setShowSetAside] = useState(false)
  const disabled = parentBusy || !!ops.busy

  const live = actions
  const unparked = useMemo(() => live.filter((a) => !a.parked), [live])
  const parked = useMemo(() => live.filter((a) => a.parked), [live])
  const causeLite = useMemo(() => causes.map((c) => ({ id: c.id, number: c.number ?? null, cause: c.cause })), [causes])
  const groups = useMemo(() => groupActions(unparked, mode, { headings, causes: causeLite }), [unparked, mode, headings, causeLite])
  const untitled = live.filter((a) => !a.title?.trim() && !a.titleProposal).length
  const titleProposals = live.filter((a) => a.titleProposal).length
  const facetProposals = live.filter((a) => a.facetProposal).length
  const byId = useMemo(() => new Map(live.map((a) => [a.id, a])), [live])
  const headingById = useMemo(() => new Map(headings.map((h) => [h.id, h])), [headings])

  const toggleOpen = (id: string) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selIds = [...selected].filter((id) => byId.has(id))
  const selNums = selIds.map((id) => byId.get(id)!.number).filter((n): n is number => n != null)

  // ── drag to reorder (pointer events — the ideas list's mechanism; touch-safe) ──
  const [order, setOrder] = useState<string[] | null>(null)
  const orderRef = useRef<string[]>([])
  const [dragging, setDragging] = useState<string | null>(null)
  const displayed = useMemo(() => {
    if (!order) return groups
    const pos = new Map(order.map((id, i) => [id, i]))
    return groups.map((g) => ({ ...g, actions: [...g.actions].sort((x, y) => (pos.get(x.id) ?? 0) - (pos.get(y.id) ?? 0)) }))
  }, [groups, order])
  const persist = useCallback(async (ids: string[]) => { await ops.run('reorder', { order: ids }, 'saving the order'); setOrder(null) }, [ops])
  const onPointerDownDrag = (id: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    orderRef.current = live.map((a) => a.id)
    setOrder(orderRef.current); setDragging(id)
    const onMove = (ev: PointerEvent) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null
      const target = el?.closest('[data-action-id]') as HTMLElement | null
      const tid = target?.dataset.actionId
      if (!tid || tid === id) return
      const cur = [...orderRef.current]
      const from = cur.indexOf(id), to = cur.indexOf(tid)
      if (from < 0 || to < 0) return
      cur.splice(from, 1); cur.splice(to, 0, id)
      orderRef.current = cur; setOrder(cur)
    }
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove); handle.removeEventListener('pointerup', onUp); handle.removeEventListener('pointercancel', onUp)
      setDragging(null); void persist(orderRef.current)
    }
    handle.addEventListener('pointermove', onMove); handle.addEventListener('pointerup', onUp); handle.addEventListener('pointercancel', onUp)
  }
  const nudge = (id: string, dir: -1 | 1) => {
    const ids = live.map((a) => a.id); const from = ids.indexOf(id), to = from + dir
    if (from < 0 || to < 0 || to >= ids.length) return
    const [x] = ids.splice(from, 1); ids.splice(to, 0, x); void persist(ids)
  }

  // ── bulk ──
  // Typed per control (no generic `bulk(op, extra)`: a helper that spreads `{ ids }` into every op is exactly how the
  // bulk "Assign to heading" came to send `ids` where the route wants `actionIds`).
  const clearIfDone = (r: { ok: boolean }) => { if (r.ok) setSelected(new Set()) }
  const bulkAssign = (headingId: string | null) => ops.run('assignHeading', { actionIds: selIds, headingId }).then(clearIfDone)
  const bulkPark = () => ops.run('park', { ids: selIds, reason: reason.trim() || null }).then(clearIfDone)
  const bulkRuleOut = () => ops.run('ruleOut', { ids: selIds, reason: reason.trim() }).then(clearIfDone)

  // ── one line ──
  const renderRow = (a: CanonicalAction) => {
    const h = a.headingId ? headingById.get(a.headingId) : undefined
    const c = h ? colourFor(h.colourKey) : null
    const isOpen = open.has(a.id)
    const originals = setAside.filter((s) => s.mergedIntoId === a.id)
    return (
      <li key={a.id} data-action-id={a.id} className={`rounded-lg border bg-white ${dragging === a.id ? 'border-zinc-900 shadow' : 'border-zinc-200'}`} style={c ? { borderLeft: `6px solid ${c.hex}` } : undefined}>
        <div className="flex items-start gap-1.5 px-2 py-1.5">
          <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleSel(a.id)} aria-label={`Select action ${a.number ?? ''}`} className="mt-1 w-4 h-4 accent-zinc-900 shrink-0" />
          <button type="button" disabled={disabled} onPointerDown={onPointerDownDrag(a.id)}
            onKeyDown={(e) => { if (e.key === 'ArrowUp') { e.preventDefault(); nudge(a.id, -1) } if (e.key === 'ArrowDown') { e.preventDefault(); nudge(a.id, 1) } }}
            title="Drag to reorder — or use the arrow keys" aria-label={`Reorder action ${a.number ?? ''}`}
            className="shrink-0 cursor-grab active:cursor-grabbing text-zinc-300 hover:text-zinc-500 disabled:opacity-30 touch-none px-0.5" style={{ touchAction: 'none' }}>
            <span aria-hidden className="text-base leading-none">⠿</span>
          </button>
          <span className="text-[11px] text-zinc-400 tabular-nums mt-0.5 w-7 shrink-0">#{a.number ?? '?'}</span>
          <div className="flex-1 min-w-0">
            <button type="button" onClick={() => toggleOpen(a.id)} aria-expanded={isOpen} className="text-left w-full">
              <span className={`text-sm ${a.title ? 'font-medium text-zinc-900' : 'text-zinc-700'}`}>{actionLabel(a)}</span>
              <span className="text-[11px] text-zinc-400 ml-1.5">{isOpen ? 'close −' : 'open +'}</span>
            </button>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-zinc-500 items-center">
              {h && <HeadingMark h={h} />}
              {a.avenue && <span>{AVENUE_LABEL[a.avenue]}</span>}
              {a.sequence && <span>{SEQUENCE_LABEL[a.sequence]}</span>}
              {a.targetCauseIds.length > 0 && <span>{a.targetCauseIds.length} cause{a.targetCauseIds.length === 1 ? '' : 's'}</span>}
              {a.link && <span>link: {a.link}</span>}
              {a.whoImplements && <span title={a.whoImplements}>by {a.whoImplements.length > 40 ? `${a.whoImplements.slice(0, 39)}…` : a.whoImplements}</span>}
              <span>{specificEnough(a) ? 'specific enough' : 'not yet specific'}</span>
              {a.mergedFrom.length > 0 && <span>merged from #{a.mergedFrom.join(', #')}</span>}
              {/* DECISION 138 — the policy test, in the one list: a WORD AND A SHAPE (✗ ○ ? ✓), never colour alone. A conflict is boxed. */}
              {a.policyTest && (
                <span title={a.policyTest.reason ?? undefined}
                  className={`font-semibold text-zinc-800 ${a.policyTest.verdict === 'CONFLICTS' ? 'border-2 border-zinc-900 rounded px-1' : ''}`}>
                  <span aria-hidden>{POLICY_VERDICT_UI[a.policyTest.verdict].glyph}</span> {POLICY_VERDICT_UI[a.policyTest.verdict].word}
                </span>
              )}
              {a.facetProposal && <span className="font-semibold text-zinc-700">Lex has proposed facets</span>}
            </div>
            {a.titleProposal && (
              <p className="mt-1 text-[11px] text-zinc-700 bg-zinc-50 border border-zinc-200 rounded px-1.5 py-1">
                <span className="font-semibold">Lex suggests the title:</span> “{a.titleProposal}”{' '}
                <button disabled={disabled} onClick={() => void ops.run('acceptTitles', { ids: [a.id] })} className="underline font-medium ml-1">Use it</button>
                <button disabled={disabled} onClick={() => { toggleOpen(a.id) }} className="underline ml-2">Edit</button>
                <button disabled={disabled} onClick={() => void ops.run('dismissTitles', { ids: [a.id] })} className="underline ml-2 text-zinc-500">No</button>
              </p>
            )}
          </div>
          <select value={a.headingId ?? ''} disabled={disabled} aria-label={`Heading for action ${a.number ?? ''}`}
            onChange={(e) => void ops.run('assignHeading', { actionIds: [a.id], headingId: e.target.value || null })}
            className="text-[11px] border border-zinc-300 rounded px-1 py-0.5 max-w-[9rem] shrink-0">
            <option value="">No heading</option>
            {headings.map((x) => <option key={x.id} value={x.id}>{colourFor(x.colourKey).glyph} {x.name}</option>)}
          </select>
        </div>
        {isOpen && <OpenAction a={a} originals={originals} ctx={{ live, byId, causeLite, disabled, ops, renderFull }} />}
      </li>
    )
  }

  // ── the toolbar ──
  const Toolbar = (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <div role="tablist" aria-label="View" className="inline-flex rounded-lg border border-zinc-300 overflow-hidden">
          {([['list', 'List'], ['coverage', 'Coverage grid'], ['sequence', 'Sequence']] as Array<[View, string]>).map(([v, l]) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
              className={`text-xs px-2.5 py-1 ${view === v ? 'bg-zinc-900 text-white font-semibold' : 'bg-white text-zinc-700 hover:bg-zinc-50'}`}>{view === v ? '● ' : '○ '}{l}</button>
          ))}
        </div>
        {view === 'list' && (
          <label className="text-[11px] text-zinc-600 flex items-center gap-1">Group
            <select value={mode} onChange={(e) => setMode(e.target.value as GroupMode)} className="border border-zinc-300 rounded px-1 py-0.5 text-xs">
              {GROUP_MODES.map((m) => <option key={m} value={m}>{GROUP_MODE_LABEL[m]}</option>)}
            </select></label>
        )}
        <button disabled={disabled || untitled === 0} onClick={async () => {
          const r = await ops.run('proposeTitles', {}, 'Lex is writing titles')
          if (r.ok && r.result) ops.setNote(`Lex proposed ${r.result.proposed} title${r.result.proposed === 1 ? '' : 's'}${r.result.skipped ? `; ${r.result.skipped} it could not title` : ''}${r.result.asTopics ? `; ${r.result.asTopics} read like a topic rather than an action — worth a look` : ''}. Nothing is saved until you accept.`)
        }} className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-800 hover:bg-zinc-50 disabled:opacity-40">Title these for me{untitled ? ` (${untitled})` : ''}</button>
        {titleProposals > 0 && <button disabled={disabled} onClick={() => void ops.run('acceptTitles', {})} className="text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-900 text-white">Use all {titleProposals} proposed titles</button>}
        <button disabled={disabled || live.length === 0} onClick={async () => {
          const r = await ops.run('proposeFacets', {}, 'Lex is classifying')
          if (r.ok && r.result) ops.setNote(`Lex proposed a classification for ${r.result.proposed} action${r.result.proposed === 1 ? '' : 's'}${r.result.links.length ? ` and read ${r.result.links.length} binding link${r.result.links.length === 1 ? '' : 's'} from your guiding policy` : ''}. Open an action to correct it, or accept the lot.`)
        }} className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-800 hover:bg-zinc-50 disabled:opacity-40">Classify with Lex</button>
        {facetProposals > 0 && <button disabled={disabled} onClick={() => void ops.run('acceptFacets', {})} className="text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-900 text-white">Accept all {facetProposals} proposed classifications</button>}
        <button disabled={disabled || live.length < 2} onClick={async () => {
          const r = await ops.run('findDuplicates', {}, 'finding duplicates')
          if (r.ok) setDupes(r.result)
        }} className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-800 hover:bg-zinc-50 disabled:opacity-40">Find duplicates</button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <input value={newHeading} onChange={(e) => setNewHeading(e.target.value)} placeholder="New heading — e.g. legislation, practical…" maxLength={60}
          onKeyDown={(e) => { if (e.key === 'Enter' && newHeading.trim()) { void ops.run('createHeading', { name: newHeading }); setNewHeading('') } }}
          className="text-xs p-1.5 rounded border border-zinc-300 w-60 focus:outline-none focus:border-blue-400" />
        <button disabled={disabled || !newHeading.trim()} onClick={() => { void ops.run('createHeading', { name: newHeading }); setNewHeading('') }} className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 disabled:opacity-40">Add heading</button>
        <button disabled={disabled} onClick={async () => {
          const r = await ops.run('suggestHeadings', {}, 'Lex is reading your guiding policy')
          if (r.ok && r.result) setSuggestions(r.result.suggestions)
        }} className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 hover:bg-zinc-50">Suggest headings from my guiding policy</button>
      </div>

      {suggestions && (
        <div className="rounded-lg border border-zinc-200 bg-white p-2">
          <p className="text-[11px] font-semibold text-zinc-700">Starting headings from your guiding policy — add, rename later, or ignore.</p>
          <ul className="mt-1 space-y-1">
            {suggestions.map((s) => {
              const have = headings.some((h) => h.name.toLowerCase() === s.name.toLowerCase())
              return (
                <li key={s.name} className="flex items-start gap-2 text-[11px]">
                  <button disabled={disabled || have} onClick={() => void ops.run('createHeading', { name: s.name })} className="shrink-0 font-medium px-1.5 py-0.5 rounded border border-zinc-300 disabled:opacity-40">{have ? 'Added' : 'Add'}</button>
                  <span><span className="font-semibold">{s.name}</span> — {s.why}</span>
                </li>
              )
            })}
          </ul>
          <button onClick={() => setSuggestions(null)} className="mt-1 text-[11px] underline text-zinc-500">Ignore these</button>
        </div>
      )}

      {ops.busy && <p className="text-[11px] text-zinc-600" role="status">Working: {ops.busy}…</p>}
      {ops.error && (
        <p className="text-[11px] font-semibold text-amber-800" role="alert">⚠ {ops.error}{' '}
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('scrutinise:report-bug'))} className="underline font-medium ml-1">Report this problem</button>
        </p>
      )}
      {ops.note && <p className="text-[11px] text-zinc-700 bg-zinc-50 border border-zinc-200 rounded px-2 py-1">{ops.note} <button onClick={() => ops.setNote(null)} className="underline ml-1">dismiss</button></p>}
    </div>
  )

  // ── bulk bar ──
  const BulkBar = selIds.length > 0 && (
    <div className="sticky top-0 z-10 rounded-lg border-2 border-zinc-900 bg-white p-2 flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-semibold">{selIds.length} selected</span>
      <select disabled={disabled} defaultValue="" onChange={(e) => { if (e.target.value !== '__') void bulkAssign(e.target.value === '' ? null : e.target.value); e.target.value = '__' }} aria-label="Assign selected to a heading" className="text-xs border border-zinc-300 rounded px-1 py-0.5">
        <option value="__">Assign to heading…</option><option value="">No heading</option>
        {headings.map((h) => <option key={h.id} value={h.id}>{colourFor(h.colourKey).glyph} {h.name}</option>)}
      </select>
      <button disabled={disabled} onClick={() => void bulkPark()} className="text-xs font-medium px-2 py-0.5 rounded border border-zinc-300">Later phase</button>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (to rule out)" maxLength={600} className="text-xs border border-zinc-300 rounded px-1.5 py-0.5 w-44" />
      <button disabled={disabled || reason.trim().length < 3} onClick={() => void bulkRuleOut()} className="text-xs font-medium px-2 py-0.5 rounded border border-zinc-300 disabled:opacity-40">Rule out</button>
      <button disabled={disabled || selNums.length !== 2} onClick={() => setPair({ a: selNums[0], b: selNums[1], mode: 'merge' })} title={selNums.length === 2 ? undefined : 'Select exactly two actions'} className="text-xs font-medium px-2 py-0.5 rounded border border-zinc-300 disabled:opacity-40">Merge</button>
      <button disabled={disabled || selNums.length !== 2} onClick={() => setPair({ a: selNums[0], b: selNums[1], mode: 'compare' })} title={selNums.length === 2 ? undefined : 'Select exactly two actions'} className="text-xs font-medium px-2 py-0.5 rounded border border-zinc-300 disabled:opacity-40">Compare</button>
      <button onClick={() => setSelected(new Set())} className="text-xs underline text-zinc-500 ml-auto">Clear</button>
    </div>
  )

  return (
    <div className="space-y-2">
      {Toolbar}
      <HeldFromConsolidation ideaId={ideaId} onChanged={onChanged} />
      {BulkBar}
      {pair && <PairPanel key={`${pair.a}-${pair.b}-${pair.mode}`} ideaId={ideaId} a={pair.a} b={pair.b} mode={pair.mode} ops={ops} onClose={() => { setPair(null); setSelected(new Set()) }} byNumber={(n) => live.find((x) => x.number === n)} />}
      {dupes && <DuplicatesPanel data={dupes} onClose={() => setDupes(null)} onMerge={(a, b) => setPair({ a, b, mode: 'merge' })} causes={causeLite} />}

      {view === 'list' && (
        <>
          {live.length === 0 && <p className="text-[11px] text-zinc-400">No actions yet.</p>}
          <div className="space-y-2.5">
            {displayed.map((g) => {
              const h = g.key.startsWith('h:') ? headingById.get(g.key.slice(2)) : undefined
              return (
                <section key={g.key} aria-label={g.label}>
                  <GroupHeader g={g} h={h} ops={ops} disabled={disabled} />
                  {!g.hidden && <ul className="space-y-1">{g.actions.map((a) => renderRow(a))}</ul>}
                  {g.hidden && <p className="text-[11px] text-zinc-400 pl-2">Hidden — {g.actions.length} action{g.actions.length === 1 ? '' : 's'} not shown.</p>}
                </section>
              )
            })}
          </div>
          {parked.length > 0 && (
            <CollapsedBlock title="Later phase" count={parked.length} open={showParked} onToggle={() => setShowParked((v) => !v)} hint="Parked for later — still yours, still in the proposal.">
              <ul className="space-y-1">{parked.map((a) => (
                <li key={a.id} className="flex items-start gap-2 text-[11px] rounded border border-zinc-200 bg-white px-2 py-1">
                  <span className="text-zinc-400">#{a.number}</span><span className="flex-1">{actionLabel(a)}{a.parkedReason ? <span className="text-zinc-500"> — {a.parkedReason}</span> : null}</span>
                  <button disabled={disabled} onClick={() => void ops.run('unpark', { ids: [a.id] })} className="underline font-medium">Bring back</button>
                </li>))}</ul>
            </CollapsedBlock>
          )}
        </>
      )}

      {view === 'coverage' && <CoverageView actions={unparked} causes={causeLite} headings={headings} />}
      {view === 'sequence' && <SequenceView actions={unparked} />}

      {setAside.length > 0 && (
        <CollapsedBlock title="Ruled out and merged away" count={setAside.length} open={showSetAside} onToggle={() => setShowSetAside((v) => !v)} hint="Kept, with the reason. Nothing here is deleted.">
          <ul className="space-y-1">{setAside.map((a) => (
            <li key={a.id} className="flex items-start gap-2 text-[11px] rounded border border-zinc-200 bg-white px-2 py-1">
              <span className="text-zinc-400">#{a.number}</span>
              <span className="flex-1">{actionLabel(a)}<span className="text-zinc-500"> — {a.status === 'ARCHIVED' ? 'merged away' : 'ruled out'}{a.ruleOutReason ? `: ${a.ruleOutReason}` : ''}</span></span>
              <button disabled={disabled} onClick={() => void ops.run('restore', { ids: [a.id] })} className="underline font-medium">Restore</button>
            </li>))}</ul>
        </CollapsedBlock>
      )}
    </div>
  )
}

interface OpenCtx {
  live: CanonicalAction[]
  byId: Map<string, CanonicalAction>
  causeLite: Array<{ id: string; number: number | null; cause: string }>
  disabled: boolean
  ops: ReturnType<typeof useOps>
  renderFull: (a: CanonicalAction) => ReactNode
}

function OpenAction({ a, originals, ctx }: { a: CanonicalAction; originals: CanonicalAction[]; ctx: OpenCtx }) {
  const { live, byId, causeLite, disabled, ops, renderFull } = ctx
  const [title, setTitle] = useState(a.titleProposal ?? a.title ?? '')
  const [link, setLink] = useState(a.link ?? '')
  const [why, setWhy] = useState('')
  const [seeOriginal, setSeeOriginal] = useState<string | null>(null)
  const others = live.filter((x) => x.id !== a.id)
  const facetSet = (patch: Record<string, unknown>) => void ops.run('setFacets', { actionId: a.id, patch })
  return (
    <div className="border-t border-zinc-100 px-2.5 py-2 space-y-2 bg-zinc-50/50">
      <div className="flex gap-1.5">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A short title saying what this action does" maxLength={110}
          className="flex-1 text-sm p-1.5 rounded border border-zinc-300 focus:outline-none focus:border-blue-400" />
        <button disabled={disabled} onClick={() => void ops.run('setTitle', { actionId: a.id, title: title.trim() || null })} className="text-xs font-medium px-2 py-1 rounded bg-zinc-900 text-white disabled:opacity-40">Save title</button>
      </div>

      {/* DECISION 138 — WHY IT IS IN THE LIST, when the row is opened: what the policy test said and where the action came from. */}
      {a.policyTest && (
        <div className={`rounded bg-white p-2 text-xs ${a.policyTest.verdict === 'CONFLICTS' ? 'border-2 border-zinc-900' : 'border border-zinc-200'}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Policy test</p>
          <p className="mt-0.5 text-zinc-900">
            <span className="font-semibold"><span aria-hidden>{POLICY_VERDICT_UI[a.policyTest.verdict].glyph}</span> {POLICY_VERDICT_UI[a.policyTest.verdict].word}.</span>{' '}
            {a.policyTest.reason ?? <span className="text-zinc-500">No reason was recorded.</span>}
          </p>
          {a.policyTest.from.length > 0 && <p className="mt-0.5 text-[11px] text-zinc-500">From: {a.policyTest.from.join('; ')}</p>}
        </div>
      )}

      <div className="rounded border border-zinc-200 bg-white p-2 space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">How this action is classified {a.facetProposal && '— Lex has proposed some of it'}</p>
        {a.facetProposal && <FacetProposal a={a} causes={causeLite} others={others} onAccept={() => void ops.run('acceptFacets', { ids: [a.id] })} onDismiss={() => void ops.run('dismissFacets', { ids: [a.id] })} />}
        <div className="flex flex-wrap gap-2 items-center text-[11px]">
          <label className="flex items-center gap-1">{FACET_WORD.avenue}
            <select value={a.avenue ?? ''} onChange={(e) => facetSet({ avenue: e.target.value || null })} disabled={disabled} className="border border-zinc-300 rounded px-1 py-0.5">
              <option value="">not assigned</option>{AVENUES.map((v) => <option key={v} value={v}>{AVENUE_LABEL[v]}</option>)}
            </select></label>
          <label className="flex items-center gap-1">{FACET_WORD.sequence}
            <select value={a.sequence ?? ''} onChange={(e) => facetSet({ sequence: e.target.value || null })} disabled={disabled} className="border border-zinc-300 rounded px-1 py-0.5">
              <option value="">not placed</option>{SEQUENCES.map((v) => <option key={v} value={v}>{SEQUENCE_LABEL[v]}</option>)}
            </select></label>
          <label className="flex items-center gap-1">{FACET_WORD.link}
            <input value={link} onChange={(e) => setLink(e.target.value)} onBlur={() => link.trim() !== (a.link ?? '') && facetSet({ link: link.trim() || null })} placeholder="which binding link it protects" maxLength={200}
              className="border border-zinc-300 rounded px-1 py-0.5 w-48" /></label>
        </div>
        <details className="text-[11px]">
          <summary className="cursor-pointer text-zinc-600">{FACET_WORD.causes}: {a.targetCauseIds.length ? a.targetCauseIds.map((id) => `#${causeLite.find((c) => c.id === id)?.number ?? '?'}`).join(', ') : 'none recorded'} — change</summary>
          <ul className="mt-1 space-y-0.5 max-h-40 overflow-y-auto">
            {causeLite.map((c) => (
              <li key={c.id}><label className="flex items-start gap-1.5">
                <input type="checkbox" checked={a.targetCauseIds.includes(c.id)} disabled={disabled} className="mt-0.5 accent-zinc-900"
                  onChange={(e) => facetSet({ targetCauseIds: e.target.checked ? [...a.targetCauseIds, c.id] : a.targetCauseIds.filter((x) => x !== c.id) })} />
                <span><span className="font-medium">#{c.number}</span> {c.cause}</span></label></li>
            ))}
          </ul>
        </details>
        <details className="text-[11px]">
          <summary className="cursor-pointer text-zinc-600">{FACET_WORD.before}: {a.beforeIds.length ? a.beforeIds.map((id) => `#${byId.get(id)?.number ?? '?'}`).join(', ') : 'nothing'} — change</summary>
          <ul className="mt-1 space-y-0.5 max-h-40 overflow-y-auto">
            {others.map((o) => (
              <li key={o.id}><label className="flex items-start gap-1.5">
                <input type="checkbox" checked={a.beforeIds.includes(o.id)} disabled={disabled} className="mt-0.5 accent-zinc-900"
                  onChange={(e) => facetSet({ beforeIds: e.target.checked ? [...a.beforeIds, o.id] : a.beforeIds.filter((x) => x !== o.id) })} />
                <span><span className="font-medium">#{o.number}</span> {actionLabel(o, 70)}</span></label></li>
            ))}
          </ul>
        </details>
      </div>

      {renderFull(a)}

      {originals.length > 0 && (
        <div className="rounded border border-zinc-200 bg-white p-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">The originals this was made from — kept</p>
          <ul className="mt-1 space-y-1">
            {originals.map((o) => (
              <li key={o.id} className="text-[11px]">
                <button type="button" onClick={() => setSeeOriginal(seeOriginal === o.id ? null : o.id)} aria-expanded={seeOriginal === o.id} className="text-left underline decoration-dotted">
                  #{o.number} — {actionLabel(o, 80)}
                </button>
                {seeOriginal === o.id && <p className="mt-1 text-zinc-700 whitespace-pre-wrap">{o.practicalStep}{o.whoImplements ? ` — ${o.whoImplements}` : ''}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <button disabled={disabled} onClick={() => void ops.run('park', { ids: [a.id], reason: why || null })} className="text-[11px] font-medium px-2 py-0.5 rounded border border-zinc-300 text-zinc-700">Later phase</button>
        <button disabled={disabled || why.trim().length < 3} onClick={() => void ops.run('ruleOut', { ids: [a.id], reason: why })} title={why.trim().length < 3 ? 'Give a reason first — it is kept so you can bring the action back.' : undefined}
          className="text-[11px] font-medium px-2 py-0.5 rounded border border-zinc-300 text-zinc-700 disabled:opacity-40">Rule out</button>
        <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Reason (needed to rule out)" maxLength={600} className="flex-1 min-w-[10rem] text-[11px] border border-zinc-300 rounded px-1.5 py-0.5" />
      </div>
    </div>
  )
}

// ── pieces ───────────────────────────────────────────────────────────────────────────────────────────────

function GroupHeader<T>({ g, h, ops, disabled }: { g: { key: string; label: string; colourKey?: string; hidden?: boolean; actions: T[] }; h?: CanonicalActionHeading; ops: ReturnType<typeof useOps>; disabled: boolean }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(g.label)
  const c = g.colourKey ? colourFor(g.colourKey) : null
  return (
    <div className="flex flex-wrap items-center gap-2 mb-1 pb-0.5 border-b border-zinc-200" style={c ? { borderBottom: `3px solid ${c.hex}` } : undefined}>
      {c && <span aria-hidden style={{ color: c.hex }} className="text-base leading-none">{c.glyph}</span>}
      {editing && h ? (
        <>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="text-sm border border-zinc-300 rounded px-1.5 py-0.5" />
          <button disabled={disabled || !name.trim()} onClick={async () => { await ops.run('updateHeading', { headingId: h.id, name }); setEditing(false) }} className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-zinc-900 text-white">Save</button>
          <button onClick={() => { setName(g.label); setEditing(false) }} className="text-[11px] underline">Cancel</button>
        </>
      ) : (
        <h4 className="text-sm font-semibold text-zinc-900">{g.label}</h4>
      )}
      <span className="text-[11px] text-zinc-500">{g.actions.length} action{g.actions.length === 1 ? '' : 's'}{c ? ` · ${c.name}` : ''}</span>
      {h && !editing && (
        <span className="ml-auto flex flex-wrap gap-2 items-center text-[11px]">
          <button onClick={() => setEditing(true)} className="underline text-zinc-600">Rename</button>
          <select value={h.colourKey} disabled={disabled} onChange={(e) => void ops.run('updateHeading', { headingId: h.id, colourKey: e.target.value })} aria-label={`Colour for ${h.name}`} className="border border-zinc-300 rounded px-1 py-0.5">
            {HEADING_PALETTE.map((p) => <option key={p.key} value={p.key}>{p.glyph} {p.name}</option>)}
          </select>
          <button disabled={disabled} onClick={() => void ops.run('updateHeading', { headingId: h.id, hidden: !h.hidden })} className="underline text-zinc-600">{h.hidden ? 'Show' : 'Hide'}</button>
          <button disabled={disabled} onClick={() => { if (g.actions.length === 0 || window.confirm(`Delete the heading “${h.name}”? Its ${g.actions.length} action(s) stay, with no heading.`)) void ops.run('deleteHeading', { headingId: h.id }) }} className="underline text-zinc-500">Delete heading</button>
        </span>
      )}
    </div>
  )
}

function CollapsedBlock({ title, count, hint, open, onToggle, children }: { title: string; count: number; hint: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-200">
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full flex items-baseline gap-2 px-2.5 py-1.5 text-left">
        <span className="text-sm font-semibold text-zinc-800">{title}</span><span className="text-[11px] text-zinc-500">{count}</span>
        <span className="text-[11px] text-zinc-400 flex-1">{hint}</span><span className="text-[11px] text-zinc-500">{open ? 'hide −' : 'show +'}</span>
      </button>
      {open && <div className="px-2.5 pb-2">{children}</div>}
    </section>
  )
}

function FacetProposal({ a, causes, others, onAccept, onDismiss }: { a: CanonicalAction; causes: Array<{ id: string; number: number | null }>; others: CanonicalAction[]; onAccept: () => void; onDismiss: () => void }) {
  const p = a.facetProposal!
  const bits: string[] = []
  if (p.targetCauseIds?.length) bits.push(`causes ${p.targetCauseIds.map((id) => `#${causes.find((c) => c.id === id)?.number ?? '?'}`).join(', ')}`)
  if (p.avenue) bits.push(`avenue ${AVENUE_LABEL[p.avenue as keyof typeof AVENUE_LABEL] ?? p.avenue}`)
  if (p.link) bits.push(`link “${p.link}”`)
  if (p.sequence) bits.push(`sequence ${SEQUENCE_LABEL[p.sequence as keyof typeof SEQUENCE_LABEL] ?? p.sequence}`)
  if (p.beforeIds?.length) bits.push(`comes before ${p.beforeIds.map((id) => `#${others.find((o) => o.id === id)?.number ?? '?'}`).join(', ')}`)
  return (
    <p className="text-[11px] bg-zinc-50 border border-zinc-200 rounded px-1.5 py-1">
      <span className="font-semibold">Lex proposes:</span> {bits.join(' · ') || 'nothing more than is already set'}.{' '}
      <button onClick={onAccept} className="underline font-medium ml-1">Accept</button><button onClick={onDismiss} className="underline ml-2 text-zinc-500">Dismiss</button>
    </p>
  )
}

function PairPanel({ ideaId, a, b, mode, ops, onClose, byNumber }: { ideaId: string; a: number; b: number; mode: 'merge' | 'compare'; ops: ReturnType<typeof useOps>; onClose: () => void; byNumber: (n: number) => CanonicalAction | undefined }) {
  void ideaId
  type Answer = { verdict: 'MERGE' | 'ONE_CONTAINS_THE_OTHER' | 'SEQUENCE' | 'CONTRADICTORY'; reasoning: string; merged: { title: string; practicalStep: string } | null; subordinateNumber: number | null }
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [edited, setEdited] = useState<{ title: string; practicalStep: string } | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const A = byNumber(a), B = byNumber(b)
  const judge = async () => {
    const r = await ops.run('judgeMerge', { a, b }, 'Lex is comparing them')
    if (r.ok && r.result) { setAnswer(r.result.answer); setEdited(r.result.answer.merged) }
  }
  const apply = async () => {
    if (!answer) return
    const r = await ops.run('applyMerge', { a, b, answer: { ...answer, merged: edited ?? answer.merged } }, 'merging')
    if (r.ok && r.result) setDone(r.result.kind === 'MERGED' ? `Merged into #${r.result.resultNumber}. The originals are kept beneath it.` : `Folded into #${r.result.resultNumber}. The other is kept, marked merged away.`)
  }
  const VERDICT: Record<string, string> = {
    MERGE: 'Merge — parts of one thing to do', ONE_CONTAINS_THE_OTHER: 'One contains the other', SEQUENCE: 'Sequence — separate; one goes first', CONTRADICTORY: 'Contradictory — they cannot both be done',
  }
  return (
    <section className="rounded-lg border-2 border-zinc-900 bg-white p-2.5 space-y-2" aria-label={mode === 'merge' ? 'Merge two actions' : 'Compare two actions'}>
      <div className="flex items-center gap-2"><h4 className="text-sm font-semibold">{mode === 'merge' ? 'Merge' : 'Compare'} #{a} and #{b}</h4><button onClick={onClose} className="ml-auto text-xs underline">Close</button></div>
      <div className="grid sm:grid-cols-2 gap-2">
        {[A, B].map((x, i) => (
          <div key={i} className="rounded border border-zinc-200 p-2 text-[11px] text-zinc-800">
            <p className="font-semibold">#{x?.number} {x?.title ?? ''}</p>
            <p className="mt-0.5 whitespace-pre-wrap">{x?.practicalStep}</p>
            {x?.whoImplements && <p className="mt-0.5 text-zinc-500">Who: {x.whoImplements}</p>}
          </div>
        ))}
      </div>
      {!answer && !done && <button disabled={!!ops.busy} onClick={judge} className="text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-900 text-white disabled:opacity-40">{mode === 'merge' ? 'Ask Lex how they relate' : 'Compare them'}</button>}
      {answer && (
        <div className="space-y-1.5">
          <p className="text-xs"><span className="font-semibold">Lex’s verdict:</span> {VERDICT[answer.verdict] ?? answer.verdict}</p>
          <p className="text-[11px] text-zinc-700 whitespace-pre-wrap">{answer.reasoning}</p>
          {(answer.verdict === 'MERGE' || answer.verdict === 'ONE_CONTAINS_THE_OTHER') && answer.merged && edited && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold">{answer.verdict === 'MERGE' ? 'The merged action' : `The containing action, restated (#${answer.subordinateNumber === a ? b : a})`} — edit it if you like:</p>
              <input value={edited.title} onChange={(e) => setEdited({ ...edited, title: e.target.value })} className="w-full text-sm p-1.5 rounded border border-zinc-300" />
              <textarea value={edited.practicalStep} onChange={(e) => setEdited({ ...edited, practicalStep: e.target.value })} rows={3} className="w-full text-xs p-1.5 rounded border border-zinc-300" />
            </div>
          )}
          {mode === 'merge' && (answer.verdict === 'MERGE' || answer.verdict === 'ONE_CONTAINS_THE_OTHER') && !done && (
            <button disabled={!!ops.busy} onClick={apply} className="text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-900 text-white disabled:opacity-40">{answer.verdict === 'MERGE' ? 'Merge them' : `Fold #${answer.subordinateNumber} into #${answer.subordinateNumber === a ? b : a}`}</button>
          )}
          {mode === 'merge' && answer.verdict === 'SEQUENCE' && answer.subordinateNumber != null && <p className="text-[11px] text-zinc-600">Nothing is merged. Open #{answer.subordinateNumber} and set its sequence to Later, with the other coming before it.</p>}
          {mode === 'merge' && answer.verdict === 'CONTRADICTORY' && <p className="text-[11px] text-zinc-600">Nothing is merged. Rule one of them out, with a reason, or keep both and say why.</p>}
        </div>
      )}
      {done && <p className="text-xs font-semibold text-zinc-800" role="status">✓ {done}</p>}
    </section>
  )
}

function DuplicatesPanel({ data, onClose, onMerge, causes }: { data: { pairs: Array<{ a: string; b: string; aNumber: number | null; bNumber: number | null; aLabel: string; bLabel: string; score: number; sharedCauseIds: string[] }>; ignoredUniversalCauses: Array<{ number: number; cause: string }> }; onClose: () => void; onMerge: (a: number, b: number) => void; causes: Array<{ id: string; number: number | null }> }) {
  return (
    <section className="rounded-lg border border-zinc-300 bg-white p-2.5 space-y-1.5" aria-label="Possible duplicates">
      <div className="flex items-center gap-2"><h4 className="text-sm font-semibold">Possible duplicates — closest first</h4><button onClick={onClose} className="ml-auto text-xs underline">Close</button></div>
      {data.pairs.length === 0 && <p className="text-[11px] text-zinc-600">No two actions read as close enough to be duplicates.</p>}
      <ul className="space-y-1">
        {data.pairs.map((p) => (
          <li key={`${p.a}-${p.b}`} className="flex items-start gap-2 text-[11px] border border-zinc-200 rounded px-2 py-1">
            <span className="shrink-0 font-semibold tabular-nums w-10">{Math.round(p.score * 100)}%</span>
            <span className="flex-1"><span className="font-medium">#{p.aNumber}</span> {p.aLabel}<br /><span className="font-medium">#{p.bNumber}</span> {p.bLabel}
              {p.sharedCauseIds.length > 0 && <span className="text-zinc-500"> · both attack cause{p.sharedCauseIds.length === 1 ? '' : 's'} {p.sharedCauseIds.map((id) => `#${causes.find((c) => c.id === id)?.number ?? '?'}`).join(', ')}</span>}</span>
            <button onClick={() => p.aNumber != null && p.bNumber != null && onMerge(p.aNumber, p.bNumber)} className="shrink-0 font-medium px-1.5 py-0.5 rounded border border-zinc-300">Merge?</button>
          </li>
        ))}
      </ul>
      {data.ignoredUniversalCauses.length > 0 && <p className="text-[11px] text-zinc-500">Ignored as evidence of similarity — nearly every action attacks {data.ignoredUniversalCauses.length === 1 ? 'this cause' : 'these causes'}: {data.ignoredUniversalCauses.map((c) => `#${c.number}`).join(', ')}.</p>}
    </section>
  )
}

export function CoverageView({ actions, causes, headings }: { actions: CanonicalAction[]; causes: Array<{ id: string; number: number | null; cause: string }>; headings: CanonicalActionHeading[] }) {
  const grid = coverageGrid(actions, causes)
  const cols = useMemo(() => {
    const out: Array<{ a: CanonicalAction; heading: CanonicalActionHeading | null }> = []
    for (const h of headings) for (const a of actions.filter((x) => x.headingId === h.id)) out.push({ a, heading: h })
    for (const a of actions.filter((x) => !x.headingId || !headings.some((h) => h.id === x.headingId))) out.push({ a, heading: null })
    return out
  }, [actions, headings])
  return (
    <section aria-label="Coverage grid: causes by actions" className="space-y-1.5">
      <p className="text-[11px] text-zinc-600">Each row is a cause; each column an action. <span className="font-semibold">●</span> means the action attacks that cause. <span className="font-semibold">An empty row is a cause with no action against it.</span>{' '}
        {grid.recorded.linked} of {grid.recorded.total} actions have a recorded cause{grid.recorded.linked < grid.recorded.total ? ' — use “Classify with Lex” to propose the rest' : ''}.</p>
      {grid.uncovered.length > 0 && (
        <div className="rounded border-2 border-zinc-900 bg-white p-2 text-[11px]">
          <p className="font-semibold">{grid.uncovered.length} cause{grid.uncovered.length === 1 ? ' has' : 's have'} no action against {grid.uncovered.length === 1 ? 'it' : 'them'}:</p>
          <ul className="list-disc pl-4">{grid.uncovered.map((u) => <li key={u.id}><span className="font-medium">Cause {u.number}</span> — {u.cause}</li>)}</ul>
        </div>
      )}
      <div className="overflow-x-auto rounded border border-zinc-200">
        <table className="text-[11px] border-collapse">
          <thead>
            <tr><th className="sticky left-0 bg-white border-b border-zinc-200 px-2 py-1 text-left min-w-[14rem]">Cause</th>
              {cols.map(({ a, heading }) => (
                <th key={a.id} className="border-b border-zinc-200 px-1 py-1 font-medium align-bottom" title={`${actionLabel(a)}${heading ? ` — ${heading.name}` : ''}`} style={heading ? { borderBottom: `4px solid ${colourFor(heading.colourKey).hex}` } : undefined}>
                  <div className="tabular-nums">#{a.number}</div>{heading && <div className="text-[9px] text-zinc-500 max-w-[4rem] truncate">{colourFor(heading.colourKey).glyph} {heading.name}</div>}
                </th>))}</tr>
          </thead>
          <tbody>
            {grid.causes.map((r) => (
              <tr key={r.id} className={r.actionIds.length === 0 ? 'bg-zinc-100' : ''}>
                <th scope="row" className="sticky left-0 bg-inherit border-b border-zinc-100 px-2 py-1 text-left font-normal">
                  <span className="font-semibold">{r.number}.</span> {r.cause.length > 90 ? `${r.cause.slice(0, 89)}…` : r.cause}
                  {r.actionIds.length === 0 && <span className="ml-1 font-semibold text-zinc-900">— NO ACTION</span>}
                </th>
                {cols.map(({ a }) => <td key={a.id} className="border-b border-zinc-100 text-center px-1">{r.actionIds.includes(a.id) ? <span aria-label="attacks this cause">●</span> : <span className="text-zinc-200" aria-hidden>·</span>}</td>)}
              </tr>))}
          </tbody>
        </table>
      </div>
      {grid.unlinkedActionIds.length > 0 && <p className="text-[11px] text-zinc-500">{grid.unlinkedActionIds.length} action{grid.unlinkedActionIds.length === 1 ? ' has' : 's have'} no recorded cause, so the grid cannot place {grid.unlinkedActionIds.length === 1 ? 'it' : 'them'}: {grid.unlinkedActionIds.map((id) => `#${actions.find((a) => a.id === id)?.number}`).join(', ')}.</p>}
    </section>
  )
}

export function SequenceView({ actions }: { actions: CanonicalAction[] }) {
  const L = sequenceLayout(actions)
  const num = (id: string) => `#${actions.find((a) => a.id === id)?.number ?? '?'}`
  const cols: Array<[keyof typeof L.columns, string]> = [['NOW', 'Now'], ['NEXT', 'Next'], ['LATER', 'Later'], ['UNPLACED', 'Not placed yet']]
  return (
    <section aria-label="Sequence view" className="space-y-1.5">
      <p className="text-[11px] text-zinc-600">What is achievable first <span className="font-semibold">and unlocks the rest</span> goes first. “Before” links are shown as text beside each action, with how many others it unlocks.</p>
      {L.startWith.length > 0 && (
        <div className="rounded border-2 border-zinc-900 bg-white p-2 text-[11px]"><p className="font-semibold">Start with</p>
          <ul className="list-disc pl-4">{L.startWith.slice(0, 5).map((id) => <li key={id}>{num(id)} {actionLabel(actions.find((a) => a.id === id)!, 80)} — unlocks {L.unlocks[id]} other{L.unlocks[id] === 1 ? '' : 's'}</li>)}</ul></div>
      )}
      {L.onCycle.length > 0 && <p className="text-[11px] font-semibold text-amber-800">⚠ An impossible order: {L.onCycle.map(num).join(', ')} each have to come before another that has to come before them.</p>}
      {L.contradictions.length > 0 && <p className="text-[11px] font-semibold text-amber-800">⚠ Against the columns: {L.contradictions.map((e) => `${num(e.from)} must come before ${num(e.to)}, but sits later`).join('; ')}.</p>}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {cols.map(([k, label]) => (
          <div key={k} className="rounded-lg border border-zinc-200 p-1.5">
            <h4 className="text-xs font-semibold text-zinc-800 mb-1">{label} <span className="font-normal text-zinc-500">({L.columns[k].length})</span></h4>
            <ul className="space-y-1">
              {L.columns[k].map((a) => {
                const after = L.edges.filter((e) => e.to === a.id).map((e) => num(e.from))
                return (
                  <li key={a.id} className="rounded border border-zinc-200 bg-white px-1.5 py-1 text-[11px]">
                    <span className="font-semibold tabular-nums">#{a.number}</span> {actionLabel(a, 70)}
                    <div className="text-zinc-500">
                      {a.beforeIds.length > 0 && <span>comes before {a.beforeIds.filter((id) => L.edges.some((e) => e.from === a.id && e.to === id)).map(num).join(', ')}</span>}
                      {after.length > 0 && <span>{a.beforeIds.length > 0 ? ' · ' : ''}after {after.join(', ')}</span>}
                      {L.unlocks[a.id] > 0 && <span> · unlocks {L.unlocks[a.id]}</span>}
                    </div>
                  </li>)
              })}
            </ul>
          </div>))}
      </div>
    </section>
  )
}


/**
 * DECISION 138 — the one thing the old "Added from the consolidation" box did that is not a property of an action: the RETRY. Ideas
 * lifted from the drafts are HELD until the settled guiding policy has tested them; if the step did not complete, they stay held and
 * this says so, with the button to run it again. It shows nothing when nothing is held. (The added actions themselves are in the
 * list above, each with its verdict.)
 */
function HeldFromConsolidation({ ideaId, onChanged }: { ideaId: string; onChanged: () => void }) {
  const [held, setHeld] = useState(0)
  const [settled, setSettled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/action-ideas`)
      if (!res.ok) return
      const j = await res.json()
      setHeld(Number(j.held) || 0); setSettled(!!j.settledPolicyId)
    } catch { /* a notice that cannot load simply does not show */ }
  }, [ideaId])
  useEffect(() => { void load() }, [load])
  if (!(held > 0 && settled)) return msg ? <p role="alert" className="text-[11px] font-semibold text-amber-800">⚠ {msg}</p> : null
  return (
    <p className="text-[11px] text-zinc-800 rounded border border-zinc-300 bg-zinc-50 px-2 py-1.5">
      {held} idea{held === 1 ? '' : 's'} from the consolidation {held === 1 ? 'is' : 'are'} being held and not yet in your list.{' '}
      <button type="button" disabled={busy} className="underline font-medium disabled:opacity-40"
        onClick={async () => {
          setBusy(true); setMsg(null)
          try {
            const res = await fetch(`/api/ideas/${ideaId}/action-ideas`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'test' }) })
            const j = await res.json().catch(() => ({}))
            if (!res.ok) { setMsg(explainFailure(j, res.status, 'Testing the held ideas')); return }
            await load(); onChanged()
          } finally { setBusy(false) }
        }}>
        {busy ? 'Adding…' : 'Test and add them now'}
      </button>
      {msg && <span role="alert" className="block font-semibold text-amber-800 mt-1">⚠ {msg}</span>}
    </p>
  )
}