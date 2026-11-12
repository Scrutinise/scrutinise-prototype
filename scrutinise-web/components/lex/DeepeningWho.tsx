'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-X X3b §6a.6 (decision 315) — THE DEEPENING'S SECTION 6: "WHO DELIVERS AND WHO RESISTS".
//
//   the count   "N actions rely on an implementer whose incentive is against and nothing changes it" (incentive-map.ts, the same reader as
//               the map and the Actions Pack's annexe; never restated here)
//   per action  the seven slots (Who · Incentive now · What changes it · Skill · How · Against · What tells us it worked), edited here,
//               through the workspace's own `useOps` (the one route and rule behind every slot write; nothing copied)
//   the map     "By who" (26-T §3), unreachable since the step tabs went (308), mounted here
//
// ⚠ It OPENS WHATEVER THE LOCK SAYS (CCh-Lex 7 Nov (2), 1): it reads the actions, not the drafts, so DeepeningGate renders it whether the
//   Deepening is open or locked. Nothing else on the page does that.
// ⚠ It left each action's record (the record section and its band entry are gone), so this is the only editor of the slots on screen.
// ⚠ Never colour alone (§21): every state is a word and a glyph.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react'
import type { CanonicalAction } from '@/lib/lex/page1-config'
import { DEEPENING_UI } from '@/lib/lex/screen-labels'
import { draftingHref } from '@/lib/lex/stages'
import { ALL_SLOTS, answeredCount, specificEnough, specificTag, proposalCount } from '@/lib/lex/action-record'
import { actionsWithNothingChangingIt, incentiveChecklistLine, INCENTIVE_GLYPH } from '@/lib/lex/incentive-map'
import { actionLabel } from '@/lib/lex/action-facets'
import { useOps } from './ActionsWorkspace'
import ActionSlots from './ActionSlots'
import IncentiveMap from './IncentiveMap'
import { Section } from './DeepeningSections'

type Show = 'all' | 'notSpecific' | 'nothingChanges'
const SHOW_LABEL: Record<Show, string> = { all: DEEPENING_UI.whoShowAll, notSpecific: DEEPENING_UI.whoShowNotSpecific, nothingChanges: DEEPENING_UI.whoShowNothingChanges }

export default function DeepeningWho({ ideaId, actions, onChanged, disabled = false, open }: {
  ideaId: string; actions: CanonicalAction[]; onChanged: () => void | Promise<boolean | void>; disabled?: boolean
  /** Whether the rest of the Deepening is open — said in words, so a locked page does not read as if this section were locked too. */
  open: boolean
}) {
  const ops = useOps(ideaId, onChanged)
  const live = useMemo(() => actions.filter((a) => a.status === 'LIVE' && !a.parked).sort((x, y) => (x.number ?? 0) - (y.number ?? 0)), [actions])
  const nothing = useMemo(() => new Set(actionsWithNothingChangingIt(live)), [live])
  const line = incentiveChecklistLine(live)
  const [show, setShow] = useState<Show>('all')
  const counts: Record<Show, number> = { all: live.length, notSpecific: live.filter((a) => !specificEnough(a)).length, nothingChanges: nothing.size }
  const shown = live.filter((a) => show === 'all' || (show === 'notSpecific' ? !specificEnough(a) : a.number != null && nothing.has(a.number)))
  const openAction = (n: number) => { window.location.href = draftingHref(ideaId, n) }
  const off = disabled || !!ops.busy

  return (
    <Section id="who" title={DEEPENING_UI.who}>
      <div className="space-y-2" data-deepening-who>
        <p className="text-xs text-zinc-700">
          The seven answers on each action, the map of who carries which, and what turns an incentive that is against.{' '}
          {!open && <span className="font-semibold" data-who-open-anyway>Open while the rest of the Deepening is locked: it reads the actions, not the drafts.</span>}
        </p>
        {line && (
          <p className={`text-xs ${line.done ? 'text-zinc-800' : 'font-semibold text-zinc-900 border-2 border-zinc-900 rounded px-2 py-1'}`} data-who-count={nothing.size}>
            <span aria-hidden>{line.done ? '✓' : INCENTIVE_GLYPH.AGAINST}</span> {line.text}{nothing.size ? `: ${[...nothing].sort((a, b) => a - b).map((n) => `#${n}`).join(', ')}` : ''}.
          </p>
        )}

        {ops.error && <p className="text-xs font-semibold border-2 border-zinc-900 rounded px-2 py-1 bg-white" role="alert">⚠ {ops.error} <button type="button" onClick={ops.clearError} className="ml-1 px-2 py-0.5 rounded border border-zinc-900 bg-zinc-100">OK</button></p>}
        {ops.saved && <p className="text-xs border border-zinc-400 rounded px-2 py-1" role="status">✓ {ops.saved} <button type="button" onClick={() => ops.setSaved(null)} className="underline ml-1">OK</button></p>}
        {ops.busy && <p className="text-xs" role="status">{ops.busy}…</p>}

        {live.length === 0 ? <p className="text-xs text-zinc-600">No live actions yet.</p> : (
          <>
            <div role="group" aria-label="Which actions to list" className="flex flex-wrap gap-1.5 text-[11px]" data-who-filter>
              {(Object.keys(SHOW_LABEL) as Show[]).map((k) => (
                <button key={k} type="button" aria-pressed={show === k} onClick={() => setShow(k)} data-who-show={k}
                  className={`px-2 py-0.5 rounded ${show === k ? 'border-2 border-zinc-900 font-semibold bg-white' : 'border border-zinc-300 bg-white text-zinc-700'}`}>
                  <span aria-hidden>{show === k ? '● ' : '○ '}</span>{SHOW_LABEL[k]} ({counts[k]})
                </button>
              ))}
            </div>
            <ul className="space-y-1" data-who-list>
              {shown.map((a) => {
                const waiting = proposalCount(a)
                const against = a.number != null && nothing.has(a.number)
                return (
                  <li key={a.id} data-who-action={a.number ?? ''}>
                    <details className="rounded border border-zinc-200 bg-white">
                      <summary className="cursor-pointer px-2 py-1 text-[11px] text-zinc-800">
                        <span className="font-semibold">#{a.number ?? '?'}</span> {actionLabel(a, 90)}
                        {' · '}<span aria-hidden>{specificEnough(a) ? '✓' : '○'}</span> {specificTag(a)}
                        {' · '}{answeredCount(a)} of {ALL_SLOTS.length} answered
                        {waiting > 0 && <> · {waiting} proposed by Lex, waiting</>}
                        {against && <span className="font-semibold"> · {INCENTIVE_GLYPH.AGAINST} against, nothing changes it</span>}
                      </summary>
                      <div className="px-2 pb-2 pt-1">
                        <ActionSlots a={a} others={live.filter((o) => o.id !== a.id)} disabled={off} run={ops.run as never} />
                      </div>
                    </details>
                  </li>
                )
              })}
              {shown.length === 0 && <li className="text-xs text-zinc-600">None.</li>}
            </ul>
            <div className="pt-1" data-who-map>
              <IncentiveMap ideaId={ideaId} actions={live} onOpenAction={openAction} onChanged={onChanged} disabled={off} />
            </div>
          </>
        )}
      </div>
    </Section>
  )
}
