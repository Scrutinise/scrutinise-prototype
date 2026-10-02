'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * ══ 26-N §8 — "CHECK FOR GAPS", IN COHERENT ACTIONS ═════════════════════════════════════════
 *
 * Free gaps first (no model — and labelled as a keyword match, because there is no recorded link between an
 * action and a cause), then what four models say is missing, each with WHAT FAILS WITHOUT IT, which models
 * raised it, and how it tests against the guiding policy. Accept adds it to the actions list; Dismiss ends it.
 * Nothing is added until Accept.
 *
 * ⚠ THE VERDICT IS A WORD AND A GLYPH OF A DIFFERENT SHAPE, NEVER COLOUR ALONE (docs/CLAUDE.md §21).
 * ⚠ THE COST OF A RUN IS SHOWN AFTER IT.
 */

type Verdict = 'FITS' | 'DOES_NOT_FIT' | 'CONFLICTS' | 'NOT_TESTED'
interface Suggestion {
  id: string; text: string; verdict: Verdict; reason: string | null; whatFails: string
  category: string; addressesCauseNumber: number | null; models: string[]; raisedBy: string
}
interface Free {
  heuristic: true
  causesWithoutAction: Array<{ number: number; cause: string; reason: string }>
  emptyCategories: Array<{ category: string; reason: string }>
}
interface RunResult {
  ok: boolean; error?: string; written: number; droppedNoWhatFails: number; mergedDuplicates: number; alreadyInList: number
  models: Array<{ model: string; ok: boolean; raised: number; error?: string }>; costPence: number; calls: number; unpriced: boolean
}

const VERDICT_UI: Record<Verdict, { glyph: string; word: string; border: string }> = {
  CONFLICTS: { glyph: '✕', word: 'Conflicts', border: 'border-2 border-zinc-900' },
  DOES_NOT_FIT: { glyph: '○', word: 'Does not fit', border: 'border border-zinc-400' },
  NOT_TESTED: { glyph: '?', word: 'Not tested', border: 'border border-dashed border-zinc-400' },
  FITS: { glyph: '✓', word: 'Fits', border: 'border border-zinc-200' },
}

export default function ActionGapCheck({ ideaId, onChanged }: { ideaId: string; onChanged?: () => void }) {
  const [free, setFree] = useState<Free | null>(null)
  const [items, setItems] = useState<Suggestion[]>([])
  const [lastCost, setLastCost] = useState<number | null>(null)
  const [run, setRun] = useState<RunResult | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const apply = useCallback((b: { free?: Free; suggestions?: Suggestion[]; lastCostPence?: number | null }) => {
    if (b.free) setFree(b.free)
    setItems(b.suggestions ?? [])
    setLastCost(b.lastCostPence ?? null)
  }, [])

  const load = useCallback(async () => {
    const res = await fetch(`/api/ideas/${ideaId}/gap-check`)
    if (res.ok) apply(await res.json())
  }, [ideaId, apply])

  useEffect(() => { void load() }, [load])

  const check = useCallback(async () => {
    setBusy('run'); setError(null); setRun(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/gap-check`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (body?.result) setRun(body.result as RunResult)
      if (!res.ok) { setError(typeof body?.error === 'string' ? body.error : 'The check did not complete.') }
      apply(body)
    } catch {
      setError('The connection dropped before the check finished. Nothing was added — reload to see whether it arrived.')
    } finally { setBusy(null) }
  }, [ideaId, apply])

  const act = useCallback(async (id: string, op: 'accept' | 'dismiss') => {
    setBusy(id); setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/gap-check`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op, id }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setError(typeof body?.error === 'string' ? body.error : 'That did not work.'); return }
      apply(body)
      // An accepted suggestion is now a real action: the list above must redraw.
      if (op === 'accept') onChanged?.()
    } finally { setBusy(null) }
  }, [ideaId, apply, onChanged])

  const hasFree = !!free && (free.causesWithoutAction.length > 0 || free.emptyCategories.length > 0)

  return (
    <div className="rounded-lg border border-zinc-300 p-3 mb-3" id="action-gap-check">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-700 flex-1">Check for gaps</p>
        <button type="button" disabled={!!busy} onClick={() => void check()}
          className="text-xs font-semibold px-3 py-1 rounded-full bg-zinc-900 text-white disabled:opacity-40">
          {busy === 'run' ? 'Checking… (a few minutes)' : 'Check for gaps'}
        </button>
      </div>
      <p className="text-[11px] text-zinc-600 mt-0.5">
        Looks for actions the guiding policy cannot do without. A free read comes first; then four models are asked what is
        missing, and each suggestion has to say what fails without it. Nothing is added to your actions until you accept it.
      </p>

      {hasFree && free && (
        <div className="mt-2 rounded-lg border border-zinc-200 p-2.5">
          <p className="text-[11px] font-semibold text-zinc-800">Found without a model (a keyword match — it may be covered in other words)</p>
          <ul className="mt-1 space-y-1 text-[11px] text-zinc-700 list-disc pl-4">
            {free.causesWithoutAction.map((g) => (
              <li key={`c${g.number}`}><span className="font-medium">Cause {g.number} may have no action:</span> {g.cause}</li>
            ))}
            {free.emptyCategories.map((g) => (
              <li key={g.category}><span className="font-medium">Nothing {g.category}:</span> {g.reason}</li>
            ))}
          </ul>
        </div>
      )}

      {run && (
        <p className="text-[11px] text-zinc-800 mt-2">
          {run.ok ? (
            <>
              This check cost about <span className="font-semibold">{run.costPence.toFixed(1)}p</span> across {run.calls} model call{run.calls === 1 ? '' : 's'}
              {run.unpriced ? ' (at least one call had no price on file, so this is a floor)' : ''}. {run.written} suggestion{run.written === 1 ? '' : 's'} added below
              {run.droppedNoWhatFails ? `; ${run.droppedNoWhatFails} dropped for not saying what fails without them` : ''}
              {run.mergedDuplicates ? `; ${run.mergedDuplicates} duplicate${run.mergedDuplicates === 1 ? '' : 's'} merged` : ''}
              {run.alreadyInList ? `; ${run.alreadyInList} already in your list` : ''}.
            </>
          ) : null}
          {run.models.some((m) => !m.ok) && (
            <span className="block mt-0.5">
              Did not answer: {run.models.filter((m) => !m.ok).map((m) => m.model).join(', ')}. The rest are combined.
            </span>
          )}
        </p>
      )}
      {!run && lastCost != null && items.length > 0 && (
        <p className="text-[11px] text-zinc-500 mt-2">The last check cost about {lastCost.toFixed(1)}p.</p>
      )}

      {items.length > 0 && (
        <ul className="mt-2 space-y-2">
          {items.map((s) => {
            const v = VERDICT_UI[s.verdict]
            return (
              <li key={s.id} className={`rounded-lg p-2.5 ${v.border}`}>
                <p className="text-sm text-zinc-900">{s.text}</p>
                <p className="text-[11px] mt-1 text-zinc-800">
                  <span className="font-semibold">Fails without it:</span> {s.whatFails}
                </p>
                <p className="text-[11px] mt-0.5 text-zinc-800">
                  <span className="font-semibold"><span aria-hidden>{v.glyph}</span> {v.word}.</span> {s.reason}
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {s.category}{s.addressesCauseNumber != null ? ` · addresses cause ${s.addressesCauseNumber}` : ''} · {s.raisedBy}
                </p>
                <div className="flex gap-2 mt-2">
                  <button type="button" disabled={!!busy} onClick={() => void act(s.id, 'accept')}
                    className="text-xs font-semibold px-3 py-1 rounded-full bg-zinc-900 text-white disabled:opacity-40">Accept</button>
                  <button type="button" disabled={!!busy} onClick={() => void act(s.id, 'dismiss')}
                    className="text-xs font-medium px-3 py-1 rounded-full border border-zinc-300 text-zinc-700 disabled:opacity-40">Dismiss</button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {error && <p className="text-[11px] text-red-700 mt-2">{error}</p>}
    </div>
  )
}
