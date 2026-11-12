'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-X §3b (decision 317) — THE DEEPENING'S LOCK.
//
// The Deepening opens when every live action is Accepted or Needs no draft. Until then its page is reachable but shows ONLY the count and
// the list of actions still to go, each a link to its Drafting record (`/ideas/[id]/drafting#38`) — and nothing in the Deepening mounts,
// so nothing in it runs (the pass route refuses too: app/api/ideas/[id]/deepening/[passKey]/run).
//
// The OWNER may override with a reason ("Deepen now — 13 actions are minor"): recorded (appended, never replacing one), shown at the top of
// this page, and printed on every output the Deepening produces ("Deepened with 13 actions undrafted — reason: …", the stage banner).
//
// ⚠ Shape and word, never colour alone (CLAUDE.md §21): the lock is 🔒 AND the word "locked"; the override line is bold in a 2px box.
// ⚠ Every limit has its counter (decision 168): the reason is a BoundedInput at LIMITS.deepenOverrideReason.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { explainFailure } from '@/lib/api-rejection'
import { LIMITS } from '@/lib/lex/input-limits'
import { CHECKLIST_WORD, DEEPENING_LOCK_UI, DRAFTING_FILTER_WORD } from '@/lib/lex/screen-labels'
import { draftingLine, type DraftingCounts, type DraftingStage } from '@/lib/lex/action-progress-pure'
import { draftingHref } from '@/lib/lex/stages'
import BoundedInput from './BoundedInput'

export interface Lock {
  counts: DraftingCounts
  parked: number
  deepeningOpen: boolean
  toGo: Array<{ id: string; number: number | null; title: string | null; statement: string; stage: DraftingStage }>
  overrideLine: string | null
}

/**
 * 26-X X3b (CCh-Lex 7 Nov (2), 1) — `children` may be a function of the lock: `open` is true only when the Deepening is open. A section
 * that opens WHATEVER the lock says ("Who delivers and who resists": it reads the actions, not the drafts) is rendered for both values;
 * everything else is rendered only for `open`. A plain node is the old contract: shown only when open.
 */
export type GateChildren = ReactNode | ((open: boolean) => ReactNode)

export default function DeepeningGate({ ideaId, children, initial }: { ideaId: string; children: GateChildren; /** a check's read */ initial?: Lock }) {
  const [lock, setLock] = useState<Lock | null>(initial ?? null)
  const [error, setError] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const read = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/development`)
      const body = await res.json().catch(() => null)
      if (!res.ok) { setError(explainFailure(body, res.status, 'Reading how many actions are still to go')); return }
      setLock(body as Lock); setError(null)
    } catch (e) { setError(`Reading how many actions are still to go could not reach the server (${e instanceof Error ? e.message : 'network error'}).`) }
  }, [ideaId])
  useEffect(() => { void read() }, [read])

  const override = async () => {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/development`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'override', reason: reason.trim() }) })
      const body = await res.json().catch(() => null)
      if (!res.ok) { setError(`Not saved: ${explainFailure(body, res.status, `“${DEEPENING_LOCK_UI.deepenNow}”`)}`); return }
      setAsking(false); setReason(''); await read()
    } catch (e) { setError(`Not saved: “${DEEPENING_LOCK_UI.deepenNow}” could not reach the server (${e instanceof Error ? e.message : 'network error'}). Nothing was changed.`) }
    finally { setBusy(false) }
  }

  const alert = error && (
    <p className="text-xs font-semibold text-zinc-900 bg-white border-2 border-zinc-900 rounded px-2 py-1.5" role="alert">⚠ {error}{' '}
      <button type="button" onClick={() => setError(null)} className="ml-1 px-2 py-0.5 rounded border border-zinc-900 bg-zinc-100 font-semibold">OK</button></p>
  )
  if (!lock) return <div className="pt-3 space-y-2">{alert}{!error && <p className="text-xs text-zinc-600" role="status">Reading how many actions are still to go…</p>}</div>

  if (lock.deepeningOpen) return (
    <>
      {lock.overrideLine && <p className="mt-2 text-xs font-bold text-zinc-900 bg-white border-2 border-zinc-900 rounded px-2 py-1.5" data-deepened-early>{lock.overrideLine}</p>}
      {typeof children === 'function' ? children(true) : children}
    </>
  )

  const n = lock.counts.toGo
  return (
    <>
    <section className="pt-3 space-y-2" data-deepening-locked aria-label={`${CHECKLIST_WORD.deepening} — ${CHECKLIST_WORD.locked}`}>
      {alert}
      <h3 className="text-sm font-bold text-zinc-900"><span aria-hidden>🔒</span> {CHECKLIST_WORD.deepening} — {CHECKLIST_WORD.locked}</h3>
      <p className="text-sm text-zinc-800" data-lock-count>
        It opens when every live action is accepted or needs no draft. <span className="font-semibold">{n} {n === 1 ? 'action is' : 'actions are'} still to go</span> ({draftingLine(lock.counts)}{lock.parked ? `; ${lock.parked} in Later phase are not counted` : ''}).
      </p>
      <ul className="space-y-1" data-lock-list>
        {lock.toGo.map((a) => (
          <li key={a.id} className="text-xs" data-lock-action={a.number ?? ''}>
            <a href={draftingHref(ideaId, a.number)} className="underline font-medium">#{a.number ?? '?'} {a.title?.trim() || (a.statement.length > 90 ? `${a.statement.slice(0, 89)}…` : a.statement)}</a>
            <span className="text-zinc-600"> — {DRAFTING_FILTER_WORD[a.stage]}</span>
          </li>
        ))}
      </ul>
      {asking ? (
        <div className="flex flex-wrap items-start gap-1.5 rounded border-2 border-zinc-900 bg-white p-2" data-override-box>
          <BoundedInput value={reason} onChange={setReason} max={LIMITS.deepenOverrideReason} placeholder={`e.g. the ${n} still to go are minor`} aria-label={DEEPENING_LOCK_UI.overrideReason}
            className="flex-1 min-w-[16rem] text-xs border border-zinc-300 rounded px-1.5 py-1" />
          <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => void override()} data-override-save
            className="text-xs font-medium px-2 py-1 rounded bg-zinc-900 text-white disabled:opacity-40">{DEEPENING_LOCK_UI.recordOverride}</button>
          <button type="button" onClick={() => { setAsking(false); setReason('') }} className="text-xs underline text-zinc-700 mt-1">Cancel</button>
          <p className="basis-full text-[11px] text-zinc-600">The reason is recorded with your name and the time, and every output the Deepening produces will say “Deepened with {n} action{n === 1 ? '' : 's'} undrafted — reason: …”.</p>
        </div>
      ) : (
        <p><button type="button" onClick={() => setAsking(true)} data-override-open className="text-xs font-medium px-2 py-1 rounded border border-zinc-300 bg-white">{DEEPENING_LOCK_UI.deepenNow}</button> <span className="text-[11px] text-zinc-600">— the owner only, with a reason</span></p>
      )}
    </section>
    {typeof children === 'function' ? children(false) : null}
    </>
  )
}
