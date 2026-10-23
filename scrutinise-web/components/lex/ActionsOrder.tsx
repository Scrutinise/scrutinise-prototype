'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-V1b §7b (decision 262) — STEP 4, ORDER BY DEPENDENCY ONLY.
//
//   OrderSection — on an opened record: "Must come after: #59 (the Code must exist before the duty bites)", each with its optional
//                  because line (300 characters, with its counter) and Remove; and "Add: must come after #…, because …".
//   OrderView    — the step's view: the DERIVED order as a numbered list with the reasons; actions caught in a circle are named apart.
//
// Now / Next / Later is gone from the screen; `sequence` stays in the data, unshown. A circle is refused by the server in words naming
// both actions (lib/lex/action-order-pure.ts), and that refusal is what the strip shows.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import type { CanonicalAction } from '@/lib/lex/page1-config'
import { actionLabel } from '@/lib/lex/action-facets'
import { afterOf, becauseOf, derivedOrder, afterWords } from '@/lib/lex/action-order-pure'
import { LIMITS } from '@/lib/lex/input-limits'
import BoundedInput from './BoundedInput'
import type { OpsLike } from './ActionsStructureTools'

/** The because line for "later must come after earlier", read off the LATER action's record. */
export const becauseFor = (actions: readonly CanonicalAction[]) => (laterId: string, earlierId: string): string | null =>
  becauseOf(actions.find((a) => a.id === laterId)?.record ?? null)[earlierId] ?? null

export function OrderSection({ a, live, ops, disabled }: { a: CanonicalAction; live: CanonicalAction[]; ops: OpsLike; disabled: boolean }) {
  const after = afterOf(live, a.id, becauseFor(live))
  const before = a.beforeIds.map((id) => live.find((x) => x.id === id)).filter((x): x is CanonicalAction => !!x)
  const others = live.filter((o) => o.id !== a.id && !after.some((x) => x.id === o.id))
  const [pick, setPick] = useState('')
  const [because, setBecause] = useState('')
  const [edits, setEdits] = useState<Record<string, string>>({})
  const name = (n: number | null) => `#${n ?? '?'}`
  const save = (earlierId: string, on: boolean, text: string | null, earlierNumber: number | null) =>
    ops.run('setAfter', { actionId: a.id, afterId: earlierId, on, because: text?.trim() || null }, undefined,
      () => on ? `Saved: ${name(a.number)} must come after ${name(earlierNumber)}${text?.trim() ? `, because ${text.trim()}` : ''}.` : `Saved: ${name(a.number)} no longer has to come after ${name(earlierNumber)}.`)
  return (
    <div className="rounded border border-zinc-200 bg-white p-2 space-y-1.5 text-[11px]" data-order-section>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Order — what this must come after, and why</p>
      {after.length === 0 && <p data-order-none>Nothing it must come after yet.</p>}
      {after.length > 0 && (
        <ul className="space-y-1">
          {after.map((x) => {
            const text = edits[x.id] ?? x.because ?? ''
            return (
              <li key={x.id} className="rounded border border-zinc-200 px-1.5 py-1 space-y-0.5" data-order-after={x.number ?? '?'}>
                <p><span className="font-semibold">Must come after {name(x.number)}</span> {actionLabel(live.find((o) => o.id === x.id)!, 70)}</p>
                <div className="flex flex-wrap items-start gap-1">
                  <BoundedInput value={text} onChange={(v) => setEdits({ ...edits, [x.id]: v })} max={LIMITS.orderBecause} placeholder="because … (optional)" aria-label={`Why ${name(a.number)} must come after ${name(x.number)}`}
                    className="flex-1 min-w-[12rem] border border-zinc-300 rounded px-1.5 py-0.5" wrapperClassName="flex-1 min-w-[12rem]" />
                  <button type="button" disabled={disabled || text.trim() === (x.because ?? '')} onClick={() => void save(x.id, true, text, x.number)} className="px-2 py-0.5 rounded border border-zinc-300 disabled:opacity-40">Save the reason</button>
                  <button type="button" disabled={disabled} onClick={() => void save(x.id, false, null, x.number)} className="underline text-zinc-700">Remove</button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-start gap-1" data-order-add>
        <label className="flex items-center gap-1">Must come after
          <select value={pick} onChange={(e) => setPick(e.target.value)} disabled={disabled} aria-label={`An action ${name(a.number)} must come after`} className="border border-zinc-300 rounded px-1 py-0.5 max-w-[16rem]">
            <option value="">choose an action…</option>
            {others.map((o) => <option key={o.id} value={o.id}>{name(o.number)} {actionLabel(o, 60)}</option>)}
          </select></label>
        <BoundedInput value={because} onChange={setBecause} max={LIMITS.orderBecause} placeholder="because … (optional)" aria-label={`Why ${name(a.number)} must come after it`}
          className="flex-1 min-w-[12rem] border border-zinc-300 rounded px-1.5 py-0.5" wrapperClassName="flex-1 min-w-[12rem]" />
        <button type="button" disabled={disabled || !pick} onClick={async () => { const r = await save(pick, true, because, live.find((o) => o.id === pick)?.number ?? null); if (r.ok) { setPick(''); setBecause('') } }}
          className="px-2 py-0.5 rounded border border-zinc-300 font-medium disabled:opacity-40">Add</button>
      </div>
      {before.length > 0 && <p className="text-zinc-600">Must come before: {before.map((b) => name(b.number)).join(', ')} (set on {before.length === 1 ? 'that action' : 'those actions'}).</p>}
    </div>
  )
}

/** The order is derived from the "must come after" lines, never typed; independent actions keep the list's own order. */
export function OrderView({ actions }: { actions: CanonicalAction[] }) {
  const { rows, unplaced } = derivedOrder(actions, becauseFor(actions))
  const byId = new Map(actions.map((a) => [a.id, a]))
  return (
    <section aria-label="The order, derived from what each action must come after" className="space-y-1.5" data-order-view>
      <p className="text-[11px] text-zinc-600">The order below is worked out from what each action must come after. Actions with nothing before them keep the list’s order. Open an action to say what it must come after, and why.</p>
      {unplaced.length > 0 && (
        <p className="text-[11px] font-semibold text-zinc-900 border-2 border-zinc-900 rounded px-1.5 py-1" role="alert" data-order-circle>⚠ Not placed — an impossible order: {unplaced.map((id) => `#${byId.get(id)?.number ?? '?'}`).join(', ')} each have to come after another in the same circle. Open one and remove a link.</p>
      )}
      <ol className="space-y-1">
        {rows.map((r) => (
          <li key={r.id} className="rounded border border-zinc-200 bg-white px-1.5 py-1 text-[11px]" data-order-row={r.number ?? '?'}>
            <span className="font-semibold tabular-nums">{r.place}.</span> <span className="font-semibold">#{r.number ?? '?'}</span> {actionLabel(byId.get(r.id)!, 80)}
            <span className="block text-zinc-600">{afterWords(r.after)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
