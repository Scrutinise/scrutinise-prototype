'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-T1 §3 — THE "BY WHO" VIEW OF STEP 2 (decisions 152, 203).
//
// Rows = implementers, as written in Who. Columns = actions. A cell is the direction the owner recorded in Incentive now, as a SHAPE and a
// WORD: ▲ with · ▼ against · ○ indifferent · — not answered (never colour alone, docs/CLAUDE.md §21). A row's summary is a sentence:
// "Cabinet Office — 9 actions: 3 with, 5 against, 1 unanswered". The second grouping, "What changes it", lists each AGAINST cell with the
// action relied on to turn it - or "AGAINST — nothing changes this" in words.
//
// ⚠ THIS VIEW STORES NOTHING (decision 203): it reads what step 2 already records. Its one write is accepting a spelling merge ("HMT" and
//   "HM Treasury"), which is a new Who on the actions concerned, through the same writer as the screen.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react'
import type { CanonicalAction } from '@/lib/lex/page1-config'
import { explainFailure } from '@/lib/api-rejection'
import {
  buildIncentiveMap, proposeSpellingMerges, changerWords, INCENTIVE_GLYPH, INCENTIVE_WORD, NO_IMPLEMENTER_KEY,
  type CellDirection, type MapRow,
} from '@/lib/lex/incentive-map'

const DIRS: CellDirection[] = ['WITH', 'AGAINST', 'INDIFFERENT', 'UNANSWERED']

export default function IncentiveMap({ ideaId, actions, onOpenAction, onChanged, disabled }: {
  ideaId: string
  actions: CanonicalAction[]
  onOpenAction?: (n: number) => void
  onChanged: () => void | Promise<boolean | void>
  disabled: boolean
}) {
  const [grouping, setGrouping] = useState<'who' | 'changes'>('who')
  const [left, setLeft] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [said, setSaid] = useState<string | null>(null)

  const rows = useMemo(() => buildIncentiveMap(actions), [actions])
  const merges = useMemo(() => proposeSpellingMerges(rows).filter((m) => !left.has(`${m.keep}|${m.from[0].key}`)), [rows, left])
  const cols = useMemo(() => [...actions].filter((a) => a.number != null).sort((a, b) => (a.number ?? 0) - (b.number ?? 0)), [actions])
  const against = rows.reduce((n, r) => n + r.counts.against, 0)
  const totalNothing = new Set(rows.flatMap((r) => r.nothingChanges)).size

  const merge = async (keep: string, fromKeys: string[]) => {
    setBusy(true); setError(null); setSaid(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/incentive-map`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'mergeSpellings', fromKeys, to: keep }) })
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: { changed: number; numbers: number[] }; error?: unknown }
      if (j.error || !res.ok) { setError(`Not saved: ${explainFailure(j, res.status, '“Use this spelling”')}`); return }
      const fresh = await onChanged()
      setSaid(`Saved: Who now reads “${keep}” on ${j.result?.changed ?? 0} action${j.result?.changed === 1 ? '' : 's'} (${(j.result?.numbers ?? []).map((n) => `#${n}`).join(', ')}).${fresh === false ? ' The list could not be re-read, so reload the page to see it.' : ''}`)
    } catch (e) { setError(`Not saved: “Use this spelling” could not reach the server (${e instanceof Error ? e.message : 'network error'}). Nothing was changed.`) } finally { setBusy(false) }
  }

  if (!actions.length) return <p className="text-[11px] text-zinc-400">No actions yet.</p>

  return (
    <section aria-label="Incentives, by who" className="space-y-2" data-incentive-map>
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Grouping" className="inline-flex rounded-lg border border-zinc-300 overflow-hidden">
          {([['who', 'By who'], ['changes', 'What changes it']] as const).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={grouping === k} onClick={() => setGrouping(k)}
              className={`text-xs px-2.5 py-1 ${grouping === k ? 'bg-zinc-900 text-white font-semibold' : 'bg-white text-zinc-700 hover:bg-zinc-50'}`}>{grouping === k ? '● ' : '○ '}{label}</button>
          ))}
        </div>
        <span className="text-[11px] text-zinc-600" data-incentive-legend>
          {DIRS.map((d) => <span key={d} className="mr-2"><span aria-hidden className="font-semibold">{INCENTIVE_GLYPH[d]}</span> {INCENTIVE_WORD[d]}</span>)}
        </span>
      </div>
      <p className="text-[11px] text-zinc-600">
        This is read from what you recorded in “Incentive now” and “What changes it” on each action; it keeps nothing of its own. An action that names two implementers shows the same answer under both, because the record holds one answer for the action.
        {against > 0 && <> <span className="font-semibold" data-incentive-nothing>{totalNothing} {totalNothing === 1 ? 'action is' : 'actions are'} against with nothing changing {totalNothing === 1 ? 'it' : 'them'}.</span></>}
      </p>

      {error && <p className="text-xs font-semibold border-2 border-zinc-900 rounded px-2 py-1" role="alert">⚠ {error} <button type="button" onClick={() => setError(null)} className="ml-1 px-2 py-0.5 rounded border border-zinc-900 bg-zinc-100">OK</button></p>}
      {said && <p className="text-xs border border-zinc-400 rounded px-2 py-1" role="status">✓ {said} <button type="button" onClick={() => setSaid(null)} className="underline ml-1">OK</button></p>}

      {merges.length > 0 && (
        <div className="rounded-lg border border-zinc-300 bg-white p-2 space-y-1" data-merge-proposals>
          <p className="text-[11px] font-semibold text-zinc-800">Lex thinks {merges.length === 1 ? 'this may be one body' : 'these may be single bodies'} spelt two ways. Nothing changes until you press.</p>
          {merges.map((m) => (
            <p key={`${m.keep}|${m.from[0].key}`} className="text-[11px] flex flex-wrap items-center gap-1.5">
              <span>{m.why}</span>
              <button type="button" disabled={disabled || busy} onClick={() => void merge(m.keep, m.from.map((f) => f.key))} className="font-medium px-1.5 py-0.5 rounded border border-zinc-900" data-merge-accept>Write “{m.keep}” on the {m.from[0].actions} {m.from[0].actions === 1 ? 'action' : 'actions'} that say “{m.from[0].spelling}”</button>
              <button type="button" onClick={() => setLeft((s) => new Set(s).add(`${m.keep}|${m.from[0].key}`))} className="underline text-zinc-600">Leave them as they are</button>
            </p>
          ))}
        </div>
      )}

      {grouping === 'who' && (
        <div className="overflow-x-auto rounded-lg border border-zinc-200" data-map-scroll>
          <table className="text-[11px] border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white text-left align-bottom px-2 py-1 border-b border-zinc-300 min-w-[16rem]">Who</th>
                {cols.map((a) => (
                  <th key={a.id} className="px-1 py-1 border-b border-zinc-300 font-medium text-zinc-600 tabular-nums">
                    <button type="button" onClick={() => onOpenAction?.(a.number!)} title={a.title?.trim() || a.practicalStep.slice(0, 120)} className="underline" aria-label={`Open action ${a.number}`}>#{a.number}</button>
                  </th>))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => <Row key={r.key} r={r} cols={cols} />)}
            </tbody>
          </table>
        </div>
      )}

      {grouping === 'changes' && (
        <div className="space-y-2" data-changes-view>
          {rows.filter((r) => r.counts.against > 0).length === 0
            ? <p className="text-[11px] text-zinc-700">No action is recorded as against anyone’s incentive, so there is nothing for “What changes it” to answer yet.</p>
            : rows.filter((r) => r.counts.against > 0).map((r) => (
              <div key={r.key} className="rounded-lg border border-zinc-200 bg-white p-2" data-changes-row>
                <p className="text-xs font-semibold text-zinc-900">{r.summary}</p>
                <ul className="mt-1 space-y-1">
                  {r.cells.filter((c) => c.direction === 'AGAINST').sort((a, b) => Number(!!b.changer && (b.changer.kind === 'NONE' || b.changer.kind === 'LINK_GONE')) - Number(!!a.changer && (a.changer.kind === 'NONE' || a.changer.kind === 'LINK_GONE'))).map((c) => {
                    const nothing = c.changer?.kind === 'NONE' || c.changer?.kind === 'LINK_GONE'
                    return (
                      <li key={c.id} className={`text-[11px] rounded px-1.5 py-1 ${nothing ? 'border-2 border-zinc-900' : 'border border-zinc-200'}`} data-against-cell data-nothing-changes={nothing ? 'true' : undefined}>
                        <button type="button" onClick={() => onOpenAction?.(c.action)} className="underline font-medium">#{c.action}</button> {c.label}
                        <span className="block"><span aria-hidden className="font-semibold">{INCENTIVE_GLYPH.AGAINST}</span> {nothing ? <span className="font-semibold">{changerWords(c.changer)}</span> : changerWords(c.changer)}</span>
                        {c.why && <span className="block text-zinc-600">Why their incentive is against: {c.why.length > 220 ? `${c.why.slice(0, 219)}…` : c.why}</span>}
                      </li>)
                  })}
                </ul>
              </div>))}
        </div>
      )}
    </section>
  )
}

function Row({ r, cols }: { r: MapRow; cols: CanonicalAction[] }) {
  const byAction = new Map(r.cells.map((c) => [c.action, c]))
  return (
    <tr className="border-b border-zinc-100 align-middle" data-map-row={r.key}>
      <th scope="row" className="sticky left-0 bg-white text-left font-normal px-2 py-1 min-w-[16rem] max-w-[22rem]">
        <span className={`block ${r.key === NO_IMPLEMENTER_KEY ? 'font-semibold' : 'font-medium'} text-zinc-900`}>{r.summary}</span>
        {r.inside != null && <span className="text-zinc-500">{r.inside ? 'inside government' : 'outside government'}</span>}
        {r.nothingChanges.length > 0 && <span className="block font-semibold" data-row-nothing>{INCENTIVE_GLYPH.AGAINST} against with nothing changing it: {r.nothingChanges.map((n) => `#${n}`).join(', ')}</span>}
        {r.spellings.length > 1 && <span className="block text-zinc-500">written as: {r.spellings.map((s) => `“${s.spelling}” (${s.count})`).join(', ')}</span>}
      </th>
      {cols.map((a) => {
        const c = byAction.get(a.number!)
        if (!c) return <td key={a.id} className="px-1 py-1 text-center text-zinc-200" aria-hidden>·</td>
        const word = INCENTIVE_WORD[c.direction]
        return (
          <td key={a.id} className={`px-1 py-1 text-center ${c.direction === 'AGAINST' ? 'font-bold' : ''}`} title={`#${c.action} ${c.label} — ${r.name}: ${word}${c.direction === 'AGAINST' ? ` — ${changerWords(c.changer)}` : ''}`} data-map-cell={c.direction}>
            <span aria-hidden>{INCENTIVE_GLYPH[c.direction]}</span><span className="sr-only">{`#${c.action}: ${word}`}</span>
          </td>
        )
      })}
    </tr>
  )
}
