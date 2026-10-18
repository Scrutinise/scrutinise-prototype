'use client'

// 26-S2 §5 (decision 177) — STEP 2 OF A RECORD: THE SEVEN SLOTS. "Who, how and against."
//
//   Who · Incentive now · What changes it · Skill · How · Against · What tells us it worked
//
// Each slot reads "Not yet answered" until it is; every one is editable by hand; Lex's proposal sits BESIDE the answer (use it, or dismiss
// it) and never overwrites one the user wrote — "Replace mine with this" is a separate, explicit choice. Each answer says who wrote it and
// when. The tag ("specific enough" / "not yet specific — Against unanswered") is computed here and shown in step 2 only.
// The writes go through the workspace's own `ops.run` (the one route behind the list), so a refusal reads "Not saved: …" like every other.

import { useState } from 'react'
import type { CanonicalAction } from '@/lib/lex/page1-config'
import BoundedInput from './BoundedInput'
import { LIMITS } from '@/lib/lex/input-limits'
import {
  ALL_SLOTS, SLOT_UI, DIRECTIONS, DIRECTION_UI, parseRecord, slotAnswered, slotText, slotWriter, slotProposal, specificEnough, specificTag, writerWords, proposalCount,
  type AnySlot, type Direction,
} from '@/lib/lex/action-record'
import { actionLabel } from '@/lib/lex/action-facets'

type Run = (op: 'setSlot' | 'acceptSlot' | 'dismissSlot' | 'proposeSlots' | 'dismissSlots', body: Record<string, unknown>, label?: string, said?: (r: never) => string | null) => Promise<{ ok: boolean }>

interface Props { a: CanonicalAction; others: CanonicalAction[]; disabled: boolean; run: Run }

export default function ActionSlots({ a, others, disabled, run }: Props) {
  const [editing, setEditing] = useState<AnySlot | null>(null)
  const [text, setText] = useState('')
  const [direction, setDirection] = useState<Direction | ''>('')
  const [link, setLink] = useState('')
  const rec = parseRecord(a.record)
  const n = a.number ?? '?'
  const specific = specificEnough(a)
  const waiting = proposalCount(a)

  const open = (slot: AnySlot) => {
    setEditing(slot); setText(slotText(a, slot)); setDirection(slot === 'incentiveNow' ? rec.incentiveNow?.direction ?? '' : ''); setLink(slot === 'whatChangesIt' ? rec.whatChangesIt?.linkActionId ?? '' : '')
  }
  const save = async (slot: AnySlot, clear = false) => {
    const r = await run('setSlot', { actionId: a.id, slot, text: clear ? '' : text, direction: slot === 'incentiveNow' && direction ? direction : null, linkActionId: slot === 'whatChangesIt' && link ? link : null },
      undefined, () => (clear ? `Saved: “${SLOT_UI[slot].label}” on #${n} is cleared.` : `Saved: “${SLOT_UI[slot].label}” on #${n}.`))
    if (r.ok) setEditing(null)
  }
  const linked = (id: string | null | undefined) => (id ? others.find((o) => o.id === id) : undefined)

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-2 space-y-2" data-slots data-slots-for={a.id}>
      <div className="flex flex-wrap items-center gap-2">
        {/* "specific enough" is computed here and shown in step 2 only — a word AND a shape, the missing slots named */}
        <span className={`text-[11px] ${specific ? 'text-zinc-700' : 'font-semibold text-zinc-900 border-2 border-zinc-900 rounded px-1'}`} data-specific-tag>
          <span aria-hidden>{specific ? '✓' : '○'}</span> {specificTag(a)}
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          {waiting > 0 && (
            <button type="button" disabled={disabled} onClick={() => void run('dismissSlots', { ids: [a.id] }, undefined, () => `Saved: Lex’s proposed answers on #${n} are dismissed.`)}
              className="text-[11px] underline text-zinc-600 disabled:opacity-40">Dismiss all of Lex’s proposals</button>
          )}
          <button type="button" disabled={disabled} onClick={() => void run('proposeSlots', { ids: [a.id] }, `Lex is proposing answers for #${n}`, (r: never) => { const x = r as { proposed?: number }; return `Lex proposed ${x?.proposed ?? 0} answer${x?.proposed === 1 ? '' : 's'} for #${n}. Each sits beside the slot: use it, edit it or dismiss it.` })}
            className="text-[11px] font-medium px-2 py-0.5 rounded border border-zinc-300 disabled:opacity-40" data-ask-lex>Ask Lex</button>
        </span>
      </div>

      <ul className="space-y-2">
        {ALL_SLOTS.map((slot) => {
          const ui = SLOT_UI[slot]
          const answer = slotText(a, slot)
          const writer = slotWriter(a, slot)
          const p = slotProposal(a, slot)
          const s = slot === 'who' ? null : rec[slot]
          const isEditing = editing === slot
          const userWrote = !!answer && writer?.by !== 'LEX'
          const to = slot === 'whatChangesIt' ? linked(s?.linkActionId) : undefined
          const pTo = slot === 'whatChangesIt' && p?.linkNumber ? others.find((o) => o.number === p.linkNumber) : undefined
          return (
            <li key={slot} data-slot={slot} className="rounded border border-zinc-200 p-1.5">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[11px] font-semibold text-zinc-900">{ui.label}</span>
                <span className="text-[10px] text-zinc-500">{ui.asks}</span>
              </div>
              {!isEditing && (
                <div className="mt-0.5 text-xs text-zinc-800">
                  {answer ? (
                    <>
                      {slot === 'incentiveNow' && s?.direction && <span className="font-semibold mr-1" data-direction><span aria-hidden>{DIRECTION_UI[s.direction].glyph}</span> {DIRECTION_UI[s.direction].word}.</span>}
                      <span className="whitespace-pre-wrap">{answer}</span>
                      {to && <span className="ml-1 text-zinc-700">→ changed by <span className="font-medium">#{to.number}</span> {actionLabel(to, 60)}</span>}
                      <span className="ml-1.5 text-[10px] text-zinc-500" data-writer>({writerWords(writer)})</span>
                    </>
                  ) : <span className="font-semibold" data-unanswered>Not yet answered</span>}
                  <button type="button" disabled={disabled} onClick={() => open(slot)} className="ml-2 text-[11px] text-zinc-500 hover:text-zinc-800 underline disabled:opacity-40">{answer ? 'Edit' : 'Answer'}</button>
                </div>
              )}
              {isEditing && (
                <div className="mt-1 space-y-1" data-slot-editor>
                  {slot === 'incentiveNow' && (
                    <fieldset className="flex flex-wrap gap-2 text-[11px]" aria-label="Does the implementer’s present incentive pull with the action?">
                      {DIRECTIONS.map((d) => (
                        <label key={d} className={`flex items-center gap-1 rounded px-1.5 py-0.5 ${direction === d ? 'border-2 border-zinc-900 font-semibold' : 'border border-zinc-300'}`}>
                          <input type="radio" name={`dir-${a.id}`} checked={direction === d} onChange={() => setDirection(d)} className="accent-zinc-900" />
                          <span aria-hidden>{DIRECTION_UI[d].glyph}</span> {DIRECTION_UI[d].word}
                        </label>
                      ))}
                      {direction && <button type="button" onClick={() => setDirection('')} className="underline text-zinc-500">no direction</button>}
                    </fieldset>
                  )}
                  <BoundedInput multiline rows={slot === 'who' ? 2 : 3} value={text} onChange={setText} max={slot === 'who' ? LIMITS.whoAnswer : LIMITS.slotAnswer} placeholder={ui.placeholder} aria-label={`${ui.label} for action ${n}`}
                    wrapperClassName="w-full" className="w-full text-xs p-1.5 rounded border border-zinc-300 focus:outline-none focus:border-blue-400" />
                  {slot === 'whatChangesIt' && (
                    <label className="block text-[11px] text-zinc-600">Link it to the action that changes it (if it is one)
                      <select value={link} onChange={(e) => setLink(e.target.value)} className="ml-1 border border-zinc-300 rounded px-1 py-0.5 max-w-[16rem]">
                        <option value="">not linked</option>
                        {others.map((o) => <option key={o.id} value={o.id}>#{o.number} {actionLabel(o, 50)}</option>)}
                      </select>
                    </label>
                  )}
                  <div className="flex flex-wrap gap-2 items-center">
                    <button type="button" disabled={disabled} onClick={() => void save(slot)} className="text-[11px] font-medium px-2 py-0.5 rounded bg-zinc-900 text-white disabled:opacity-40">Save</button>
                    <button type="button" onClick={() => setEditing(null)} className="text-[11px] underline text-zinc-600">Cancel</button>
                    {answer && <button type="button" disabled={disabled} onClick={() => void save(slot, true)} className="text-[11px] underline text-zinc-600 disabled:opacity-40">Clear this answer</button>}
                  </div>
                </div>
              )}
              {p && (
                <div className="mt-1 rounded border border-dashed border-zinc-500 bg-zinc-50 p-1.5 text-xs" data-proposal={slot}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">Lex proposes{answer ? ' (beside your answer — yours is kept)' : ''}</p>
                  <p className="mt-0.5 text-zinc-900">
                    {slot === 'incentiveNow' && p.direction && <span className="font-semibold mr-1"><span aria-hidden>{DIRECTION_UI[p.direction].glyph}</span> {DIRECTION_UI[p.direction].word}.</span>}
                    <span className="whitespace-pre-wrap">{p.text}</span>
                    {pTo && <span className="ml-1">→ changed by <span className="font-medium">#{pTo.number}</span> {actionLabel(pTo, 60)}</span>}
                  </p>
                  {(p.reason || p.source) && <p className="mt-0.5 text-[11px] text-zinc-600">Why: {p.reason || '—'}{p.source ? ` [Ref: ${p.source}]` : ''}</p>}
                  <div className="mt-1 flex flex-wrap gap-2 items-center">
                    {userWrote
                      ? <button type="button" disabled={disabled} onClick={() => void run('acceptSlot', { actionId: a.id, slot, replace: true }, undefined, () => `Saved: Lex’s answer replaced yours for “${ui.label}” on #${n}.`)} className="text-[11px] font-medium px-2 py-0.5 rounded border border-zinc-400 disabled:opacity-40">Replace mine with this</button>
                      : <button type="button" disabled={disabled} onClick={() => void run('acceptSlot', { actionId: a.id, slot }, undefined, () => `Saved: “${ui.label}” on #${n} now uses Lex’s answer.`)} className="text-[11px] font-medium px-2 py-0.5 rounded bg-zinc-900 text-white disabled:opacity-40">Use it</button>}
                    <button type="button" disabled={disabled} onClick={() => { open(slot); setText(p.text); if (slot === 'incentiveNow') setDirection(p.direction ?? ''); if (slot === 'whatChangesIt') setLink(pTo?.id ?? '') }} className="text-[11px] underline text-zinc-700 disabled:opacity-40">Edit it first</button>
                    <button type="button" disabled={disabled} onClick={() => void run('dismissSlot', { actionId: a.id, slot }, undefined, () => `Saved: Lex’s proposal for “${ui.label}” on #${n} is dismissed.`)} className="text-[11px] underline text-zinc-500 disabled:opacity-40">Dismiss</button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
