'use client'

// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-K — THE UPDATE PASS, IN THE WORKING AREA.
//
// ⚠ DELIBERATELY NOT INSIDE `DeepeningPanel.tsx`. That panel is gated shut until
// `kernelComplete` (26-F's own decision) — but new material can arrive from Stage 1
// onward, and §4c is explicit: "the offer must be visible where the material was added
// AND in the working area." This is its own always-reachable surface, mounted twice
// (Research tab, working area) against the same endpoint.
//
// §2 step 4 / §4a: proposed changes, one by one, accept or dismiss. CONTRADICTS is never
// collapsed — it renders first, in its own un-collapsible block, per §2's own instruction
// that it "must be the most prominent" category.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'

interface ProposedChange {
  id: string
  kind: string
  title: string
  body: string
  fieldRef: string | null
  citation: string | null
  url: string | null
  status: string
  note: string | null
  createdAt: string
}

interface UpdatePassState {
  count: number
  materialIds: string[]
  lastRunAt: string | null
  proposedChanges: ProposedChange[]
  newPolicyOptions: Array<{ number: number | null; title: string }>
}

const KIND_LABEL: Record<string, string> = {
  CONTRADICTS: 'Contradicts your kernel',
  SUPPORTS: 'Supports something you already have',
  NEW_CAUSE: 'Suggests a new cause',
}

function targetLabel(fieldRef: string | null): string | null {
  if (!fieldRef) return null
  const [kind, ref] = fieldRef.split(':')
  if (kind === 'causes') return `cause ${ref}`
  if (kind === 'policyOptions') return `policy option ${ref}`
  if (kind === 'actions') return 'a coherent action'
  return fieldRef // a scalar field key, e.g. "pivotalObstacle"
}

function ChangeCard({ item, onJudge, busy }: { item: ProposedChange; onJudge: (decision: 'ACCEPTED' | 'REJECTED') => void; busy: boolean }) {
  const target = targetLabel(item.fieldRef)
  return (
    <div className={`rounded-lg border p-3 ${item.kind === 'CONTRADICTS' ? 'border-2 border-amber-400 bg-amber-50/40' : 'border-zinc-200'}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-wide ${item.kind === 'CONTRADICTS' ? 'text-amber-800' : 'text-zinc-500'}`}>
        {KIND_LABEL[item.kind] ?? item.kind}
        {target && <span className="font-normal normal-case text-zinc-500"> — {target}</span>}
      </p>
      <p className="text-sm text-zinc-900 mt-1 font-medium">{item.title}</p>
      <p className="text-sm text-zinc-700 mt-1">{item.body}</p>
      {(item.citation || item.url) && (
        <p className="text-[11px] text-zinc-500 mt-1.5">
          Source: {item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-800">{item.citation || item.url}</a> : item.citation}
        </p>
      )}
      <div className="flex gap-2 mt-2.5">
        <button onClick={() => onJudge('ACCEPTED')} disabled={busy}
          className="text-xs font-semibold px-3 py-1.5 rounded-full bg-zinc-900 text-white disabled:opacity-40">
          Accept
        </button>
        <button onClick={() => onJudge('REJECTED')} disabled={busy}
          className="text-xs font-medium px-3 py-1.5 rounded-full border border-zinc-300 text-zinc-700 disabled:opacity-40">
          Dismiss
        </button>
      </div>
    </div>
  )
}

export default function UpdatePassPanel({ ideaId, canEdit, showResearchAngle = true }: {
  ideaId: string
  canEdit: boolean
  /**
   * ⚠⚠ 26-L §10c — REMOVED FROM THE MIDDLE PANEL. "Two entry points on one page doing the same
   * thing": asking Lex to research an angle here duplicates asking Lex the same question in the
   * left-panel chat. §11 (report-only) sizes making the left-panel Lex do this for real, so
   * removing the box here is not a loss of the capability, only of the duplicate entry point.
   * Defaults true so the Research tab mount (`ResearchTab.tsx`, the right-hand RESEARCH panel,
   * not the middle DRAFT STRATEGY one the brief names) is unaffected.
   */
  showResearchAngle?: boolean
}) {
  const [state, setState] = useState<UpdatePassState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [angle, setAngle] = useState('')
  const [lastCounts, setLastCounts] = useState<Record<string, number> | null>(null)
  const [lastCost, setLastCost] = useState<{ pence: number | null; ms: number } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/update-pass`)
      if (res.ok) setState(await res.json())
    } catch { /* the offer just doesn't show this load — nothing to block on */ }
  }, [ideaId])
  useEffect(() => { void load() }, [load])

  const runComparison = useCallback(async () => {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/update-pass`, { method: 'POST' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(typeof j?.error === 'string' ? j.error : 'The comparison did not complete.'); return }
      setLastCounts(j.counts ?? null)
      setLastCost({ pence: j.costPence ?? null, ms: j.ms ?? 0 })
      await load()
    } finally { setBusy(false) }
  }, [ideaId, load])

  const runAngle = useCallback(async () => {
    const text = angle.trim()
    if (!text) return
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/update-pass/angle`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ angle: text }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(typeof j?.error === 'string' ? j.error : 'That could not be researched.'); return }
      setLastCounts(j.counts ?? null)
      setLastCost({ pence: j.costPence ?? null, ms: j.ms ?? 0 })
      setAngle('')
      await load()
    } finally { setBusy(false) }
  }, [angle, ideaId, load])

  const judge = useCallback(async (evidenceId: string, decision: 'ACCEPTED' | 'REJECTED') => {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/update-pass/${evidenceId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision }),
      })
      if (!res.ok) { const j = await res.json().catch(() => ({})); setError(typeof j?.error === 'string' ? j.error : 'That did not save.'); return }
      await load()
    } finally { setBusy(false) }
  }, [ideaId, load])

  if (!state) return null

  const contradicts = state.proposedChanges.filter((c) => c.kind === 'CONTRADICTS')
  const others = state.proposedChanges.filter((c) => c.kind !== 'CONTRADICTS')
  const pence = (p: number | null | undefined) => (p == null ? '(cost unknown)' : `£${(p / 100).toFixed(2)}`)

  return (
    <section className="rounded-2xl border border-zinc-200 mt-3" aria-label="Update pass">
      <div className="px-4 py-3 border-b border-zinc-100">
        <h3 className="text-sm font-semibold text-zinc-900">Compare new material with your kernel</h3>
        <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
          New material only touches what it bears on — nothing in your kernel changes until you accept it.
        </p>
      </div>

      {error && <p className="px-4 py-2 text-xs text-amber-800 bg-amber-50 border-b border-amber-200">{error}</p>}

      {canEdit && (
        <div className="px-4 py-3 border-b border-zinc-100">
          {state.count > 0 ? (
            <>
              <p className="text-sm text-zinc-800">
                {state.count} new item{state.count === 1 ? '' : 's'} since your last comparison
                {state.lastRunAt ? '' : ' — nothing has been compared yet'}.
              </p>
              <button onClick={() => void runComparison()} disabled={busy}
                className="mt-2 text-sm font-semibold px-4 py-2 rounded-full bg-zinc-900 text-white disabled:opacity-40">
                {busy ? 'Comparing…' : 'Compare them with your kernel'}
              </button>
            </>
          ) : (
            <p className="text-xs text-zinc-500">Nothing new since your last comparison.</p>
          )}
          {lastCounts && (
            <p className="text-[11px] text-zinc-500 mt-2">
              Last run: {lastCounts.CONTRADICTS ?? 0} contradiction{(lastCounts.CONTRADICTS ?? 0) === 1 ? '' : 's'},{' '}
              {lastCounts.SUPPORTS ?? 0} supporting, {lastCounts.NEW_CAUSE ?? 0} new cause{(lastCounts.NEW_CAUSE ?? 0) === 1 ? '' : 's'},{' '}
              {lastCounts.NEW_POLICY_OPTION ?? 0} new candidate{(lastCounts.NEW_POLICY_OPTION ?? 0) === 1 ? '' : 's'},{' '}
              {lastCounts.NOTHING ?? 0} with no bearing — {pence(lastCost?.pence)}, {lastCost ? Math.round(lastCost.ms / 1000) : 0}s.
            </p>
          )}
        </div>
      )}

      {/* §3 — research an angle, instead of researching elsewhere and uploading the result.
          ⚠ 26-L §10c — gone from the middle panel (`showResearchAngle=false` there); kept on
          the Research tab's own mount, the right-hand panel this box has always belonged to. */}
      {canEdit && showResearchAngle && (
        <div className="px-4 py-3 border-b border-zinc-100">
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Or ask Lex to research an angle
          </label>
          <div className="flex gap-2 mt-1.5">
            <input
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void runAngle() }}
              placeholder="How does the private sector handle this?"
              className="flex-1 text-sm rounded-lg border border-zinc-300 px-2.5 py-1.5"
            />
            <button onClick={() => void runAngle()} disabled={busy || !angle.trim()}
              className="text-sm font-semibold px-4 py-1.5 rounded-full bg-zinc-900 text-white disabled:opacity-40">
              Research
            </button>
          </div>
        </div>
      )}

      {/* §2 — "contradicts" is never folded into a count or collapsed by default. */}
      {contradicts.length > 0 && (
        <div className="px-4 py-3 border-b border-zinc-100 space-y-2.5">
          <p className="text-xs font-semibold text-amber-800">⚠ {contradicts.length} contradiction{contradicts.length === 1 ? '' : 's'} with your kernel</p>
          {contradicts.map((c) => (
            <ChangeCard key={c.id} item={c} busy={busy} onJudge={(d) => void judge(c.id, d)} />
          ))}
        </div>
      )}

      {others.length > 0 && (
        <div className="px-4 py-3 border-b border-zinc-100 space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            {others.length} other proposed change{others.length === 1 ? '' : 's'}
          </p>
          {others.map((c) => (
            <ChangeCard key={c.id} item={c} busy={busy} onJudge={(d) => void judge(c.id, d)} />
          ))}
        </div>
      )}

      {/* §4a — a new policy option has "no separate path": it is already live in the sort. */}
      {state.newPolicyOptions.length > 0 && (
        <div className="px-4 py-3">
          <p className="text-[11px] text-zinc-500">
            New candidates already in the Guiding Policy sort: {state.newPolicyOptions
              .map((p) => p.number != null ? `#${p.number}` : p.title).join(', ')}.
          </p>
        </div>
      )}
    </section>
  )
}
