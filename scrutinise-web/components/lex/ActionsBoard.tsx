'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-V1b §7a (decision 255) — THE CARD BOARD: step 1's second view, beside the List.
//
//   Columns = the idea's headings in list order, then "Unsorted". Cards = the live actions the list shows (ruled-out and Later-phase
//   actions are not on the board, as they are not in the list; the find box filters the cards). Each card: number, title,
//   "needs N documents: M drafted", and the conditions it delivers as small chips.
//
//   Drag a card to another column  → re-head: the EXISTING `assignHeading`, with its worded refusal.
//   Drag a card onto another card  → the EXISTING merge dialogue opens with both (nothing is merged until the owner confirms there).
//   Beside the board, the existing "possible merges" list (Find duplicates); clicking one OUTLINES both cards — a thick border AND the word
//   "pair" on each (never colour alone, §21) — and brings them into view.
//
// ⚠ No new write path: every change goes through `ops.run`, which re-reads the list and says what happened (or why not) in the strip.
// ⚠ Drag is pointer events (touch-safe, as the list's reorder). Each card also has a "Move to…" menu, so nothing needs a drag to be done.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CanonicalAction, CanonicalActionHeading } from '@/lib/lex/page1-config'
import { colourFor } from '@/lib/lex/action-headings'
import { actionLabel } from '@/lib/lex/action-facets'
import { activeConditions, type ConditionsDoc } from '@/lib/lex/action-conditions'
import { needsLine } from '@/lib/lex/action-documents-pure'
import type { DocumentTree } from '@/lib/lex/action-documents'
import type { OpsLike } from './ActionsStructureTools'

export interface MergePair { a: string; b: string; aNumber: number | null; bNumber: number | null; aLabel: string; bLabel: string; score: number }

const UNSORTED = '__unsorted'

/** "needs 2 documents: 1 drafted", per action, from the documents tree (one read for the whole board). */
function useNeeds(ideaId: string, sig: string) {
  const [needs, setNeeds] = useState<Map<string, string> | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    fetch(`/api/ideas/${ideaId}/action-documents`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`the server answered ${r.status}`)))).then((t: DocumentTree) => {
      if (!live) return
      const m = new Map<string, string>()
      for (const h of t.headings) for (const a of h.actions) {
        const docs = a.documents.filter((d) => d.status !== 'SUPERSEDED' && a.needs.kinds.includes(d.kind))
        m.set(a.id, needsLine(a.needs.kinds.length, docs.filter((d) => d.current).length, docs.filter((d) => d.status === 'ACCEPTED').length))
      }
      setNeeds(m); setFailed(null)
    }).catch((e: unknown) => { if (live) setFailed(e instanceof Error ? e.message : 'could not be read') })
    return () => { live = false }
  }, [ideaId, sig])
  return { needs, failed }
}

export default function ActionsBoard({ ideaId, actions, headings, conditions, ops, disabled, onMerge, pairs, onFindPairs, headingName }: {
  ideaId: string
  /** The cards: the list's live, un-parked actions after the find box. */
  actions: CanonicalAction[]
  headings: CanonicalActionHeading[]
  conditions: ConditionsDoc
  ops: OpsLike
  disabled: boolean
  /** Opens the existing merge dialogue with both actions (by number). */
  onMerge: (a: number, b: number) => void
  /** The "possible merges" list (Find duplicates); null = not run since the board opened. */
  pairs: MergePair[] | null
  onFindPairs: () => void
  headingName: (id: string | null) => string | null
}) {
  const sig = useMemo(() => actions.map((a) => a.id).join('|'), [actions])
  const { needs, failed } = useNeeds(ideaId, sig)
  const [pair, setPair] = useState<[string, string] | null>(null)
  const [drag, setDrag] = useState<{ id: string; over: { kind: 'card' | 'column'; key: string } | null } | null>(null)
  const dragRef = useRef(drag)
  dragRef.current = drag
  const box = useRef<HTMLDivElement>(null)
  const active = activeConditions(conditions)
  const known = new Set(headings.map((h) => h.id))
  const columns = [
    ...headings.map((h) => ({ key: h.id, name: h.name, h, cards: actions.filter((a) => a.headingId === h.id) })),
    { key: UNSORTED, name: 'Unsorted', h: null as CanonicalActionHeading | null, cards: actions.filter((a) => !a.headingId || !known.has(a.headingId)) },
  ]
  const byId = useMemo(() => new Map(actions.map((a) => [a.id, a])), [actions])

  // ── the two writes: both are the list's own paths ──
  const rehead = useCallback((a: CanonicalAction, to: string | null) => {
    if ((a.headingId ?? null) === to || (!to && (!a.headingId || !known.has(a.headingId)))) return
    void ops.run('assignHeading', { actionIds: [a.id], headingId: to }, undefined,
      () => `Saved: #${a.number ?? '?'} ${to ? `is now under “${headingName(to)}”` : 'now has no heading (Unsorted)'}.`)
  }, [ops, headingName]) // eslint-disable-line react-hooks/exhaustive-deps
  const mergeOnto = (a: CanonicalAction, b: CanonicalAction) => {
    if (a.number == null || b.number == null) { ops.setNote(`#${a.number ?? '?'} and #${b.number ?? '?'} cannot be merged from the board: one has no number yet.`); return }
    onMerge(a.number, b.number)
  }

  // ── drag: pointer events; what is under the pointer decides — a card (merge) or a column (re-head) ──
  const onPointerDown = (id: string) => (e: React.PointerEvent<HTMLElement>) => {
    if (disabled || e.button !== 0) return
    e.preventDefault()
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    setDrag({ id, over: null })
    const target = (ev: PointerEvent) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null
      const card = el?.closest('[data-board-card]') as HTMLElement | null
      if (card && card.dataset.boardCard !== id) return { kind: 'card' as const, key: card.dataset.boardCard! }
      const col = el?.closest('[data-board-column]') as HTMLElement | null
      return col ? { kind: 'column' as const, key: col.dataset.boardColumn! } : null
    }
    const onMove = (ev: PointerEvent) => setDrag({ id, over: target(ev) })
    const onUp = (ev: PointerEvent) => {
      handle.removeEventListener('pointermove', onMove); handle.removeEventListener('pointerup', onUp); handle.removeEventListener('pointercancel', onCancel)
      const over = target(ev)
      setDrag(null)
      const a = byId.get(id)
      if (!a || !over) return
      if (over.kind === 'card') { const b = byId.get(over.key); if (b) mergeOnto(a, b) }
      else rehead(a, over.key === UNSORTED ? null : over.key)
    }
    const onCancel = () => { handle.removeEventListener('pointermove', onMove); handle.removeEventListener('pointerup', onUp); handle.removeEventListener('pointercancel', onCancel); setDrag(null) }
    handle.addEventListener('pointermove', onMove); handle.addEventListener('pointerup', onUp); handle.addEventListener('pointercancel', onCancel)
  }

  // ── a possible merge, clicked: both cards outlined and named "pair", and brought into view ──
  const showPair = (p: MergePair) => {
    setPair([p.a, p.b])
    setTimeout(() => {
      const els = [p.a, p.b].map((id) => box.current?.querySelector<HTMLElement>(`[data-board-card="${id}"]`)).filter((x): x is HTMLElement => !!x)
      els[0]?.scrollIntoView?.({ block: 'center', inline: 'center', behavior: 'smooth' })
    }, 0)
  }
  const livePairs = (pairs ?? []).filter((p) => byId.has(p.a) && byId.has(p.b))

  const card = (a: CanonicalAction) => {
    const inPair = !!pair?.includes(a.id)
    const isTarget = drag?.over?.kind === 'card' && drag.over.key === a.id
    const chips = a.supportOnly ? ['support'] : active.map((c, i) => (a.conditionIds.includes(c.id) ? `condition ${i + 1}` : null)).filter((x): x is string => !!x)
    return (
      <li key={a.id} data-board-card={a.id} data-board-pair={inPair ? 'true' : undefined}
        className={`rounded bg-white px-1.5 py-1 text-[11px] ${inPair ? 'border-4 border-zinc-900' : isTarget ? 'border-2 border-dashed border-zinc-900' : drag?.id === a.id ? 'border-2 border-zinc-500 opacity-60' : 'border border-zinc-300'}`}>
        <div className="flex items-start gap-1">
          <button type="button" disabled={disabled} onPointerDown={onPointerDown(a.id)} aria-label={`Drag action ${a.number ?? ''} to another heading, or onto another card to merge`}
            title="Drag to another column to move it under that heading; drag onto another card to merge the two (you confirm the merge)" className="shrink-0 cursor-grab text-zinc-400 touch-none px-0.5 disabled:opacity-30" style={{ touchAction: 'none' }}>
            <span aria-hidden className="text-sm leading-none">⠿</span>
          </button>
          <div className="flex-1 min-w-0">
            <p><span className="font-semibold tabular-nums">#{a.number ?? '?'}</span> {actionLabel(a, 90)}
              {inPair && <span className="ml-1 font-bold uppercase tracking-wide" data-board-pair-word>pair</span>}
              {isTarget && <span className="ml-1 font-semibold">— drop to merge</span>}</p>
            <p className="text-zinc-600" data-board-needs>{needs?.get(a.id) ?? (failed ? 'documents not read' : 'reading documents…')}</p>
            {chips.length > 0 && <p className="mt-0.5 flex flex-wrap gap-1" data-board-conditions>{chips.map((c) => <span key={c} className="rounded border border-zinc-400 px-1 text-[10px]">{c}</span>)}</p>}
          </div>
        </div>
        <label className="mt-0.5 flex items-center gap-1 text-[10px] text-zinc-600">Move to
          <select value={a.headingId && known.has(a.headingId) ? a.headingId : UNSORTED} disabled={disabled} aria-label={`Move action ${a.number ?? ''} to a heading`}
            onChange={(e) => rehead(a, e.target.value === UNSORTED ? null : e.target.value)} className="border border-zinc-300 rounded px-0.5 max-w-[9rem]">
            {headings.map((h) => <option key={h.id} value={h.id}>{colourFor(h.colourKey).glyph} {h.name}</option>)}
            <option value={UNSORTED}>Unsorted</option>
          </select></label>
      </li>
    )
  }

  return (
    <div ref={box} className="flex flex-col lg:flex-row gap-2 items-start" data-board>
      <div className="flex-1 min-w-0 overflow-x-auto">
        {failed && <p className="text-[11px]" role="alert">The document counts on the cards could not be read ({failed}); the board still works.</p>}
        <div className="flex gap-2 items-start pb-1">
          {columns.map((col) => {
            const c = col.h ? colourFor(col.h.colourKey) : null
            const over = drag?.over?.kind === 'column' && drag.over.key === col.key
            return (
              <section key={col.key} data-board-column={col.key} aria-label={`${col.name}: ${col.cards.length} action${col.cards.length === 1 ? '' : 's'}`}
                className={`w-56 shrink-0 rounded-lg bg-zinc-50 p-1.5 ${over ? 'border-2 border-dashed border-zinc-900' : 'border border-zinc-200'}`} style={c ? { borderTop: `4px solid ${c.hex}` } : undefined}>
                <h4 className="text-xs font-semibold text-zinc-900 mb-1">{c && <span aria-hidden style={{ color: c.hex }}>{c.glyph} </span>}{col.name} <span className="font-normal text-zinc-500">({col.cards.length})</span>{over && <span className="font-semibold"> — drop to move here</span>}</h4>
                <ul className="space-y-1 min-h-[2rem]">{col.cards.map(card)}</ul>
                {col.cards.length === 0 && <p className="text-[10px] text-zinc-500">No action here{drag ? ' — drop one to move it here' : ''}.</p>}
              </section>
            )
          })}
        </div>
      </div>
      <aside className="w-full lg:w-64 shrink-0 rounded-lg border border-zinc-300 bg-white p-1.5 space-y-1 text-[11px]" aria-label="Possible merges" data-board-merges>
        <p className="text-xs font-semibold">Possible merges</p>
        {pairs == null
          ? <p>Not looked for yet. <button type="button" disabled={disabled} onClick={onFindPairs} className="underline font-medium disabled:opacity-40">Find duplicates</button> (free: no model is called)</p>
          : livePairs.length === 0 ? <p>No two actions on the board read as close enough to be duplicates.</p>
          : <ul className="space-y-1">{livePairs.map((p) => {
              const on = !!pair && pair.includes(p.a) && pair.includes(p.b)
              return (
                <li key={`${p.a}-${p.b}`} className={`rounded px-1 py-0.5 ${on ? 'border-2 border-zinc-900' : 'border border-zinc-200'}`}>
                  <button type="button" onClick={() => (on ? setPair(null) : showPair(p))} aria-pressed={on} data-board-merge-pair={`${p.aNumber}-${p.bNumber}`} className="text-left w-full">
                    <span className="font-semibold">{Math.round(p.score * 100)}%</span> #{p.aNumber} and #{p.bNumber}{on ? ' — shown as “pair”' : ' — show them'}
                  </button>
                  <button type="button" disabled={disabled} onClick={() => p.aNumber != null && p.bNumber != null && onMerge(p.aNumber, p.bNumber)} className="underline">Merge?</button>
                </li>
              )
            })}</ul>}
        {pair && <button type="button" onClick={() => setPair(null)} className="underline">Clear the outline</button>}
        <p className="text-zinc-500">Drag a card onto another to open the merge for those two. Nothing is merged until you confirm it there.</p>
      </aside>
    </div>
  )
}
