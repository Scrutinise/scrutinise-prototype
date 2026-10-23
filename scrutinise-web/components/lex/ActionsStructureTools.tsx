'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-S2 decisions 188 + 190 - the step-1 tools that sit beside the list:
//   ConditionsPanel          the idea's conditions (owner's words), Lex's proposed additions, and how many actions deliver each
//   ConditionsCoverageView   conditions x actions; a condition no action delivers reads "NO ACTION" IN WORDS
//   ConditionChooser         on an opened record: which conditions it delivers, or "support"
//   ResortTool               "Re-sort into headings" - one confirm with the price, batches applied as they complete, Undo
//   ConsolidateCard          "Consolidate this heading" - one confirm per heading, the result with an Undo
//
// ⚠ NOTHING DELETES. Every state is also a word (docs/CLAUDE.md §21; Charlie is colour blind). The ops object is the workspace's own.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import type { CanonicalAction, CanonicalActionHeading } from '@/lib/lex/page1-config'
import { activeConditions, conditionCoverage, conditionWords, type ConditionsDoc } from '@/lib/lex/action-conditions'
import { RESORT_CONFIRM_ABOVE_PENCE, type HeadingPlan } from '@/lib/lex/action-resort-pure'
import { actionLabel } from '@/lib/lex/action-facets'
import { colourFor } from '@/lib/lex/action-headings'
import { LIMITS } from '@/lib/lex/input-limits'
import BoundedInput from './BoundedInput'

/** The slice of the workspace's `useOps` these tools use. `run` is untyped here on purpose: the route's schema is the check. */
export interface OpsLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run: (op: any, body: any, label?: string, said?: (result: any) => string | null) => Promise<{ ok: boolean; result: any; error: string | null }>
  busy: string | null
  setNote: (s: string | null) => void
}

const pence = (p: number | null | undefined) => (p == null ? 'not recorded' : p < 1 ? `${p.toFixed(2)}p` : p < 100 ? `${p.toFixed(1)}p` : `£${(p / 100).toFixed(2)}`)

// ── the conditions list ─────────────────────────────────────────────────────────────────────────────────────
export function ConditionsPanel({ doc, actions, ops, disabled }: { doc: ConditionsDoc; actions: CanonicalAction[]; ops: OpsLike; disabled: boolean }) {
  const [text, setText] = useState('')
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const active = activeConditions(doc)
  const cov = conditionCoverage(doc, actions)
  const retired = doc.items.filter((c) => c.retired)
  if (!active.length && !doc.proposals.length && !retired.length && !doc.source) {
    return (
      <details className="rounded-lg border border-zinc-200 bg-white" data-conditions-panel>
        <summary className="cursor-pointer px-2.5 py-1.5 text-xs font-semibold text-zinc-800">Conditions the proposal must meet — none yet</summary>
        <div className="px-2.5 pb-2 space-y-1.5">
          <p className="text-[11px] text-zinc-600">Write the few conditions this proposal has to meet (for example “one named owner per task”). Each action then says which it delivers, and the coverage view shows any condition no action delivers.</p>
          <AddCondition text={text} setText={setText} ops={ops} disabled={disabled} />
        </div>
      </details>
    )
  }
  return (
    <details className="rounded-lg border border-zinc-200 bg-white" data-conditions-panel open={cov.uncovered.length > 0 || doc.proposals.length > 0 ? true : undefined}>
      <summary className="cursor-pointer px-2.5 py-1.5 text-xs font-semibold text-zinc-800">
        Conditions the proposal must meet — {active.length} condition{active.length === 1 ? '' : 's'}{cov.uncovered.length ? ` · ${cov.uncovered.length} with no action` : ' · every one has an action'}{doc.proposals.length ? ` · Lex has proposed ${doc.proposals.length} more` : ''}
      </summary>
      <div className="px-2.5 pb-2 space-y-1.5">
        {doc.source && <p className="text-[11px] text-zinc-600" data-conditions-source>From: {doc.source.label}.</p>}
        <ol className="space-y-1">
          {cov.rows.map((r, i) => (
            <li key={r.condition.id} className="rounded border border-zinc-200 px-2 py-1 text-[11px] flex flex-wrap items-start gap-x-2 gap-y-0.5" data-condition-row>
              <span className="font-semibold tabular-nums w-5">{r.number}.</span>
              {editing?.id === r.condition.id ? (
                <span className="flex flex-1 flex-wrap items-start gap-1 min-w-[12rem]">
                  <BoundedInput value={editing.text} onChange={(v) => setEditing({ id: r.condition.id, text: v })} max={LIMITS.conditionText} aria-label={`Condition ${r.number}`} className="flex-1 min-w-[12rem] text-xs p-1 rounded border border-zinc-300"
                    onEnter={() => void ops.run('editCondition', { conditionId: r.condition.id, text: editing.text }).then((x) => { if (x.ok) setEditing(null) })} />
                  <button type="button" disabled={disabled || !editing.text.trim()} onClick={() => void ops.run('editCondition', { conditionId: r.condition.id, text: editing.text }).then((x) => { if (x.ok) setEditing(null) })} className="font-medium px-1.5 py-0.5 rounded bg-zinc-900 text-white disabled:opacity-40">Save</button>
                  <button type="button" onClick={() => setEditing(null)} className="underline text-zinc-600">Cancel</button>
                </span>
              ) : (
                <span className="flex-1 min-w-[12rem] text-zinc-900">{r.condition.text}</span>
              )}
              <span className={r.actionIds.length ? 'text-zinc-600' : 'font-semibold text-zinc-900 border-2 border-zinc-900 rounded px-1'}>{r.actionIds.length ? `${r.actionIds.length} action${r.actionIds.length === 1 ? '' : 's'}` : 'NO ACTION'}</span>
              {editing?.id !== r.condition.id && (
                <span className="flex gap-2 text-zinc-600">
                  <button type="button" disabled={disabled} onClick={() => setEditing({ id: r.condition.id, text: r.condition.text })} className="underline">Edit</button>
                  <button type="button" disabled={disabled || i === 0} onClick={() => void ops.run('moveCondition', { conditionId: r.condition.id, dir: 'up' })} className="underline disabled:opacity-30" aria-label={`Move condition ${r.number} up`}>↑</button>
                  <button type="button" disabled={disabled || i === cov.rows.length - 1} onClick={() => void ops.run('moveCondition', { conditionId: r.condition.id, dir: 'down' })} className="underline disabled:opacity-30" aria-label={`Move condition ${r.number} down`}>↓</button>
                  <button type="button" disabled={disabled} onClick={() => void ops.run('retireCondition', { conditionId: r.condition.id, retired: true }, undefined, () => `Saved: condition ${r.number} is retired. It is kept; Bring back restores it.`)} className="underline">Retire</button>
                </span>
              )}
            </li>
          ))}
        </ol>
        {doc.proposals.length > 0 && (
          <div className="rounded border border-zinc-300 bg-zinc-50 p-1.5 space-y-1" data-condition-proposals>
            <p className="text-[11px] font-semibold text-zinc-800">Lex proposes {doc.proposals.length === 1 ? 'a condition' : `${doc.proposals.length} conditions`} to add — yours until you accept:</p>
            {doc.proposals.map((p) => (
              <p key={p.id} className="text-[11px] text-zinc-800">“{p.text}”{p.why ? <span className="text-zinc-600"> — {p.why}</span> : null}{' '}
                <button type="button" disabled={disabled} onClick={() => void ops.run('acceptConditionProposal', { proposalId: p.id })} className="underline font-medium ml-1">Add it to the list</button>
                <button type="button" disabled={disabled} onClick={() => void ops.run('dismissConditionProposal', { proposalId: p.id })} className="underline text-zinc-500 ml-2">Dismiss</button></p>
            ))}
          </div>
        )}
        {retired.length > 0 && (
          <p className="text-[11px] text-zinc-600">Retired (kept): {retired.map((c, i) => (
            <span key={c.id}>{i ? '; ' : ''}“{c.text.length > 60 ? `${c.text.slice(0, 59)}…` : c.text}” <button type="button" disabled={disabled} onClick={() => void ops.run('retireCondition', { conditionId: c.id, retired: false })} className="underline">Bring back</button></span>))}</p>
        )}
        <AddCondition text={text} setText={setText} ops={ops} disabled={disabled} />
        <p className="text-[11px] text-zinc-500">“Classify with Lex” in this step proposes which conditions each action delivers; you accept or correct. The coverage view shows the conditions against the actions.</p>
      </div>
    </details>
  )
}

function AddCondition({ text, setText, ops, disabled }: { text: string; setText: (s: string) => void; ops: OpsLike; disabled: boolean }) {
  const add = async () => { const r = await ops.run('addCondition', { text: text.trim() }, 'adding the condition', () => 'Saved: condition added.'); if (r.ok) setText('') }
  return (
    <div className="flex flex-wrap items-start gap-1.5">
      <BoundedInput value={text} onChange={setText} max={LIMITS.conditionText} placeholder="Add a condition — e.g. one named owner per task" aria-label="New condition" onEnter={() => void add()} disabled={disabled}
        className="text-xs p-1.5 rounded border border-zinc-300 w-80 max-w-full focus:outline-none focus:border-blue-400" />
      <button type="button" disabled={disabled || !text.trim()} onClick={() => void add()} className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 disabled:opacity-40">Add condition</button>
    </div>
  )
}

// ── the coverage view: conditions × actions ─────────────────────────────────────────────────────────────────
export function ConditionsCoverageView({ doc, actions, headings }: { doc: ConditionsDoc; actions: CanonicalAction[]; headings: CanonicalActionHeading[] }) {
  const cov = conditionCoverage(doc, actions)
  const cols = [...headings.flatMap((h) => actions.filter((a) => a.headingId === h.id).map((a) => ({ a, h }))), ...actions.filter((a) => !a.headingId || !headings.some((h) => h.id === a.headingId)).map((a) => ({ a, h: null as CanonicalActionHeading | null }))]
  if (!cov.rows.length) return <p className="text-[11px] text-zinc-600" data-conditions-empty>No conditions are set yet. Add them in “Conditions the proposal must meet” above, then this view shows each against the actions that deliver it.</p>
  return (
    <section aria-label="Coverage: conditions by actions" className="space-y-1.5" data-conditions-coverage>
      <p className="text-[11px] text-zinc-600">Each row is a condition; each column an action. <span className="font-semibold">●</span> means the action delivers that condition; <span className="font-semibold">S</span> marks an action as support (it delivers none directly). <span className="font-semibold">An empty row reads NO ACTION.</span></p>
      {cov.uncovered.length > 0 && (
        <div className="rounded border-2 border-zinc-900 bg-white p-2 text-[11px]">
          <p className="font-semibold">{cov.uncovered.length} condition{cov.uncovered.length === 1 ? ' has' : 's have'} no action:</p>
          <ul className="list-disc pl-4">{cov.uncovered.map((u) => <li key={u.condition.id}><span className="font-medium">Condition {u.number}</span> — {u.condition.text}</li>)}</ul>
        </div>
      )}
      <div className="overflow-x-auto rounded border border-zinc-200">
        <table className="text-[11px] border-collapse">
          <thead>
            <tr><th className="sticky left-0 bg-white border-b border-zinc-200 px-2 py-1 text-left min-w-[14rem]">Condition</th>
              {cols.map(({ a, h }) => (
                <th key={a.id} className="border-b border-zinc-200 px-1 py-1 font-medium align-bottom" title={`${actionLabel(a)}${h ? ` — ${h.name}` : ''}`} style={h ? { borderBottom: `4px solid ${colourFor(h.colourKey).hex}` } : undefined}>
                  <div className="tabular-nums">#{a.number}</div>{h && <div className="text-[9px] text-zinc-500 max-w-[4rem] truncate">{colourFor(h.colourKey).glyph} {h.name}</div>}
                </th>))}</tr>
          </thead>
          <tbody>
            {cov.rows.map((r) => (
              <tr key={r.condition.id} className={r.actionIds.length === 0 ? 'bg-zinc-100' : ''}>
                <th scope="row" className="sticky left-0 bg-inherit border-b border-zinc-100 px-2 py-1 text-left font-normal">
                  <span className="font-semibold">{r.number}.</span> {r.condition.text.length > 90 ? `${r.condition.text.slice(0, 89)}…` : r.condition.text}
                  {r.actionIds.length === 0 && <span className="ml-1 font-semibold text-zinc-900">— NO ACTION</span>}
                </th>
                {cols.map(({ a }) => <td key={a.id} className="border-b border-zinc-100 text-center px-1">{r.actionIds.includes(a.id) ? <span aria-label="delivers this condition">●</span> : a.supportOnly ? <span className="text-zinc-400" aria-label="support">S</span> : <span className="text-zinc-200" aria-hidden>·</span>}</td>)}
              </tr>))}
          </tbody>
        </table>
      </div>
      {cov.unassigned.length > 0 && <p className="text-[11px] text-zinc-600">{cov.unassigned.length} action{cov.unassigned.length === 1 ? ' delivers' : 's deliver'} no condition and {cov.unassigned.length === 1 ? 'is' : 'are'} not marked support: {cov.unassigned.slice(0, 40).map((id) => `#${actions.find((a) => a.id === id)?.number}`).join(', ')}{cov.unassigned.length > 40 ? ` and ${cov.unassigned.length - 40} more` : ''}. {cov.support} marked support.</p>}
    </section>
  )
}

// ── on an opened record ─────────────────────────────────────────────────────────────────────────────────────
export function ConditionChooser({ a, doc, ops, disabled }: { a: CanonicalAction; doc: ConditionsDoc; ops: OpsLike; disabled: boolean }) {
  const active = activeConditions(doc)
  if (!active.length) return null
  const set = (conditionIds: string[]) => void ops.run('assignConditions', { actionIds: [a.id], conditionIds, mode: 'set' }, undefined, () => 'Saved: what the action delivers.')
  return (
    <details className="text-[11px]" data-condition-chooser>
      <summary className="cursor-pointer text-zinc-600">Conditions it delivers: {conditionWords(doc, a)} — change</summary>
      <ul className="mt-1 space-y-0.5 max-h-48 overflow-y-auto">
        {active.map((c, i) => (
          <li key={c.id}><label className="flex items-start gap-1.5">
            <input type="checkbox" checked={!a.supportOnly && a.conditionIds.includes(c.id)} disabled={disabled} className="mt-0.5 accent-zinc-900"
              onChange={(e) => set(e.target.checked ? [...a.conditionIds, c.id] : a.conditionIds.filter((x) => x !== c.id))} />
            <span><span className="font-medium">{i + 1}.</span> {c.text}</span></label></li>
        ))}
        <li className="pt-0.5 border-t border-zinc-100"><label className="flex items-start gap-1.5">
          <input type="checkbox" checked={a.supportOnly} disabled={disabled} className="mt-0.5 accent-zinc-900"
            onChange={(e) => void ops.run('assignConditions', { actionIds: [a.id], support: e.target.checked, ...(e.target.checked ? {} : { conditionIds: a.conditionIds }) }, undefined, () => 'Saved: what the action delivers.')} />
          <span><span className="font-medium">Support</span> — delivers none of them directly (training, a pilot, a consultation)</span></label></li>
      </ul>
    </details>
  )
}

// ── Re-sort into headings ───────────────────────────────────────────────────────────────────────────────────
interface ResortPlanResult {
  targets: Array<{ name: string; purpose: string; liveNow: number; exists: boolean; renamesFrom: string | null }>
  retiring: Array<{ id: string; name: string; live: number }>
  actions: number
  batches: string[][]
  estimate: { pence: number; measured: boolean; calls: number }
}

export function ResortTool({ plan, undoable, ops, disabled }: { plan: HeadingPlan; undoable: number; ops: OpsLike; disabled: boolean }) {
  const [card, setCard] = useState<ResortPlanResult | null>(null)
  const open = async () => { const r = await ops.run('resortPlan', {}, 'reading the plan'); if (r.ok && r.result) setCard(r.result as ResortPlanResult) }
  const go = async (p: ResortPlanResult) => {
    setCard(null)
    let moved = 0, unchanged = 0, notPlaced = 0, spent = 0, unpriced = false, done = 0
    for (const ids of p.batches) {
      const r = await ops.run('resortBatch', { ids }, `Lex is placing the actions (${done} of ${p.actions} done)`)
      if (!r.ok || !r.result) { ops.setNote(`Placed ${done} of ${p.actions} actions before it stopped (${moved} moved). What was placed stays placed; press “Re-sort into headings” again to carry on — the rest are asked again. Nothing was deleted.`); return }
      moved += r.result.moved; unchanged += r.result.unchanged; notPlaced += r.result.notPlaced; done += ids.length
      if (r.result.pence == null) unpriced = true; else spent += r.result.pence
    }
    const fin = await ops.run('resortFinish', {}, 'tidying the old headings')
    const f = fin.ok ? (fin.result as { archived: string[]; stillHolding: Array<{ name: string; live: number }> }) : { archived: [], stillHolding: [] }
    ops.setNote(`Re-sorted ${p.actions} actions: ${moved} moved, ${unchanged} already on the right heading${notPlaced ? `, ${notPlaced} the model did not place (left where they were)` : ''}. ${unpriced ? 'The price was not recorded.' : `It cost ${pence(spent)} (measured on this run).`} `
      + `${f.archived.length ? `${f.archived.length} old heading${f.archived.length === 1 ? '' : 's'} archived (kept; restorable): ${f.archived.join(', ')}. ` : ''}${f.stillHolding.length ? `Still holding actions, so kept: ${f.stillHolding.map((h) => `${h.name} (${h.live})`).join(', ')}. ` : ''}`
      + 'Each action’s reason for its heading is on its record; “Undo the re-sort” puts every action back.')
  }
  const price = card ? card.estimate : null
  return (
    <>
      <button type="button" disabled={disabled} onClick={() => void open()} data-resort-button title="Puts every live action under one of your instrument headings, with a reason for each. Nothing is deleted: the old headings are archived and Undo puts everything back."
        className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-800 hover:bg-zinc-50 disabled:opacity-40">Re-sort into headings</button>
      {undoable > 0 && (
        <button type="button" disabled={disabled} data-resort-undo onClick={() => void ops.run('undoResort', {}, 'putting the actions back', (r: { restored: number; headingsBack: string[] }) => `Saved: ${r.restored} action${r.restored === 1 ? '' : 's'} back on the heading they were on${r.headingsBack.length ? `; ${r.headingsBack.length} archived heading${r.headingsBack.length === 1 ? '' : 's'} brought back` : ''}.`)}
          className="text-[11px] underline text-zinc-700 disabled:opacity-40">Undo the re-sort ({undoable} moved)</button>
      )}
      {card && (
        <div className="basis-full rounded border-2 border-zinc-900 bg-white p-2 text-xs space-y-1.5" data-resort-card role="alert">
          <p className="font-semibold">Re-sort {card.actions} actions into these {card.targets.length} headings?</p>
          <ol className="list-decimal pl-5 text-[11px] space-y-0.5">
            {card.targets.map((t) => <li key={t.name}><span className="font-medium">{t.name}</span>{t.renamesFrom ? <> — renames “{t.renamesFrom}” ({t.liveNow} now)</> : t.exists ? <> — {t.liveNow} now</> : ' — new'}</li>)}
          </ol>
          {card.retiring.length > 0 && <p className="text-[11px]">Archived once empty (kept, restorable): {card.retiring.map((h) => `${h.name} (${h.live})`).join(', ')}.</p>}
          <p className="text-[11px]">About {card.estimate.calls} request{card.estimate.calls === 1 ? '' : 's'}, estimated <span className="font-semibold">{pence(price!.pence)}</span> — {price!.measured ? 'from a measured run on a copy of a real idea' : 'not yet measured: this is a guess until a run on a copy of a real idea has been recorded'}. {price!.pence > RESORT_CONFIRM_ABOVE_PENCE ? 'That is above the usual line, so it asks.' : ''} Every action’s reason is kept, and Undo puts everything back. Nothing is deleted.</p>
          <p className="flex gap-2">
            <button type="button" disabled={disabled} onClick={() => void go(card)} className="font-medium px-2.5 py-1 rounded bg-zinc-900 text-white disabled:opacity-40" data-resort-go>Go on</button>
            <button type="button" onClick={() => setCard(null)} className="underline text-zinc-700">Cancel</button>
          </p>
        </div>
      )}
    </>
  )
}

// ── Consolidate this heading ────────────────────────────────────────────────────────────────────────────────
export interface ConsolidateCardState {
  headingId: string
  phase: 'confirm' | 'done'
  heading: string
  actions: number
  estimate: { pence: number; measured: boolean }
  result?: { folded: Array<{ id: string; number: number; intoNumber: number }>; merged: Array<{ id: string; number: number; intoNumber: number }>; refused: string[]; before: number; after: number; pence: number | null }
}

export function ConsolidateCard({ s, ops, disabled, onClose, setS }: { s: ConsolidateCardState; ops: OpsLike; disabled: boolean; onClose: () => void; setS: (s: ConsolidateCardState) => void }) {
  if (s.phase === 'confirm') {
    return (
      <div className="rounded border-2 border-zinc-900 bg-white p-2 text-xs space-y-1.5 mb-1" data-consolidate-card role="alert">
        <p className="font-semibold">Tidy “{s.heading}” ({s.actions} actions)?</p>
        <p className="text-[11px]">Lex reads the actions under this heading and sorts out two things. Parts of a bigger action — a field, a rule or a step that only makes sense inside another action on this list — are tucked into that action’s Detail, quoted word for word with their number, so nothing is lost and “Restore” puts any of them back as its own row. Two actions saying the same thing are joined into one, and both originals are kept. Nothing is deleted. Estimated {pence(s.estimate.pence)} — {s.estimate.measured ? 'measured on a copy of a real idea' : 'not yet measured: a guess until a run on a copy of a real idea is recorded'}.</p>
        <p className="flex gap-2">
          <button type="button" disabled={disabled} data-consolidate-go onClick={async () => {
            const r = await ops.run('consolidate', { headingId: s.headingId }, `Lex is consolidating “${s.heading}”`)
            if (r.ok && r.result) setS({ ...s, phase: 'done', result: r.result }); else onClose()
          }} className="font-medium px-2.5 py-1 rounded bg-zinc-900 text-white disabled:opacity-40">Go on</button>
          <button type="button" onClick={onClose} className="underline text-zinc-700">Cancel</button>
        </p>
      </div>
    )
  }
  const r = s.result!
  const ids = [...r.folded.map((f) => f.id), ...r.merged.map((m) => m.id)]
  return (
    <div className="rounded border-2 border-zinc-900 bg-white p-2 text-xs space-y-1 mb-1" data-consolidate-result role="status">
      <p className="font-semibold">{r.before} → {r.after} live actions{r.pence != null ? ` (${pence(r.pence)}, measured on this run)` : ''}.</p>
      {r.folded.length > 0 && <p className="text-[11px]">{r.folded.length} tucked into their bigger action: {r.folded.map((f) => `#${f.number} into #${f.intoNumber}`).join(', ')}. Each is quoted in that action’s Detail and kept under “Ruled out and merged away”.</p>}
      {r.merged.length > 0 && <p className="text-[11px]">{r.merged.length} {r.merged.length === 1 ? 'pair' : 'pairs'} joined: {r.merged.map((m) => `#${m.number} into #${m.intoNumber}`).join(', ')}, both kept.</p>}
      {r.folded.length === 0 && r.merged.length === 0 && <p className="text-[11px]">Lex found nothing here it was sure enough about, so nothing changed.</p>}
      {r.refused.length > 0 && <p className="text-[11px] text-zinc-700">Not applied: {r.refused.join('; ')}.</p>}
      <p className="flex gap-2">
        {ids.length > 0 && <button type="button" disabled={disabled} data-consolidate-undo onClick={async () => { const x = await ops.run('restore', { ids }, undefined, () => `Saved: ${ids.length} action${ids.length === 1 ? '' : 's'} restored; their quotes are out of the Detail.`); if (x.ok) onClose() }} className="underline font-medium disabled:opacity-40">Undo this consolidation</button>}
        <button type="button" onClick={onClose} className="underline text-zinc-700">Close</button>
      </p>
    </div>
  )
}
