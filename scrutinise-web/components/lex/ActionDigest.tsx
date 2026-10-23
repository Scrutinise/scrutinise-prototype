'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-T1 §2 — THE DIGEST ON THE SCREEN (decisions 146, 200, 201).
//
//   · a button on each heading ("Ask four models about this heading") and one on the toolbar ("…the whole set"), each with its PRICE
//     ("measured (n=…)" or "estimate") and an ask-first confirm - a run is over the 5p line (decision 121)
//   · a collapsed panel under the heading: "Digest · written 18 Oct · 5 actions then, 7 now" - the whole-set digest at the foot of step 1
//   · inside: the six answers, WHERE THE FOUR DISAGREE (each model's position named), the table conditions × actions as the four see it
//     ("all four" / "3 of 4" / "disputed"), the weight-bearing actions, the actions that deliver no condition, the gaps ranked by how many
//     models named them (each can be added as a SUGGESTION - never as an action), the conflicts (each action number opens that action), and
//     the conditions the models think are missing (already in the conditions panel as PROPOSALS)
//
// ⚠ NOTHING HERE WRITES AN ACTION. "Add as a suggestion" lands in the gap check's list, where the existing Accept is the only way in.
// ⚠ A digest that has fallen behind the list says so, in words, before anything else in it.
// ⚠ A task already under way is ANNOUNCED beside its button and carried on by the user, never started for them (docs/CLAUDE.md §32).
// ⚠ Never colour alone (§21): every state is a word and a shape.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActionDigestRequest } from '@/lib/lex/action-digest-schema'
import { DIGEST_OP_WORDS } from '@/lib/lex/action-digest-types'
import { DIGEST_QUESTIONS, DIGEST_CONFIRM_ABOVE_PENCE, type DigestView, type DigestQuote, type DigestPrice } from '@/lib/lex/action-digest-pure'
import { explainFailure } from '@/lib/api-rejection'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const pence = (p: number | null | undefined) => (p == null ? 'not priced' : p < 1 ? `${p.toFixed(2)}p` : `${p.toFixed(1)}p`)

// ── the state, shared by the heading buttons, the toolbar button and the panels ───────────────────────────────

export interface DigestState {
  digests: DigestView[]
  quote: DigestQuote | null
  /** The key of what is running: a heading id, 'SET', or a digest id. */
  busy: string | null
  stage: string | null
  error: string | null
  note: string | null
  clearError: () => void
  clearNote: () => void
  start: (scope: 'HEADING' | 'SET', headingId?: string) => Promise<void>
  carryOn: (d: DigestView, opts?: { goOnWithTheRest?: boolean }) => Promise<void>
  retry: (d: DigestView) => Promise<void>
  suggestGaps: (d: DigestView, index?: number) => Promise<void>
  forScope: (scope: 'HEADING' | 'SET', headingId?: string) => DigestView | null
}

export function useDigests(ideaId: string, enabled: boolean, onChanged?: () => void | Promise<boolean | void>): DigestState {
  const [digests, setDigests] = useState<DigestView[]>([])
  const [quote, setQuote] = useState<DigestQuote | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [stage, setStage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const refresh = useCallback(async (): Promise<DigestView[]> => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/action-digest`)
      const j = (await res.json().catch(() => ({}))) as { digests?: DigestView[]; quote?: DigestQuote; error?: unknown }
      if (!res.ok || !j.digests) { setError(`Not saved: ${explainFailure(j, res.status, 'Reading the digests')}`.replace('Not saved: ', 'Could not read the digests: ')); return [] }
      if (alive.current) { setDigests(j.digests); if (j.quote) setQuote(j.quote) }
      return j.digests
    } catch (e) { setError(`Could not read the digests: ${e instanceof Error ? e.message : 'network error'}.`); return [] }
  }, [ideaId])
  useEffect(() => { if (enabled) void refresh() }, [enabled, refresh])

  const post = useCallback(async (body: ActionDigestRequest): Promise<{ ok: true; result: unknown } | { ok: false }> => {
    const control = DIGEST_OP_WORDS[body.op]
    try {
      const res = await fetch(`/api/ideas/${ideaId}/action-digest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: unknown; error?: unknown }
      if (j.error || !res.ok) { setError(`Not saved: ${explainFailure(j, res.status, control)}`); return { ok: false } }
      return { ok: true, result: j.result }
    } catch (e) {
      setError(`Not saved: ${control} could not reach the server (${e instanceof Error ? e.message : 'network error'}). Nothing was changed.`)
      return { ok: false }
    }
  }, [ideaId])

  const put = (v: DigestView) => setDigests((all) => [v, ...all.filter((x) => !(x.scope === v.scope && x.headingId === v.headingId))])

  /** Run the stages one request at a time until the digest is READY or FAILED, or it needs the user's say (a model failed). */
  const drive = useCallback(async (first: DigestView, key: string, opts: { goOnWithTheRest?: boolean } = {}) => {
    setBusy(key)
    let v = first
    try {
      for (let i = 0; i < 10 && alive.current; i++) {
        if (v.status === 'READY' || v.status === 'FAILED') break
        if (v.working) {
          setStage('another request is working on it')
          await wait(5000)
          const all = await refresh()
          const again = all.find((d) => d.id === v.id)
          if (!again) break
          v = again
          continue
        }
        if (v.status === 'MODELS_DONE' && !opts.goOnWithTheRest && v.models.some((m) => m.status === 'FAILED')) break // the user decides: ask again, or go on
        setStage(v.status === 'MODELS_DONE' ? 'the judge is writing the digest' : 'the four models are reading the actions')
        const before = v.status
        const r = await post({ op: 'advance', digestId: v.id })
        if (!r.ok) break
        v = r.result as DigestView
        put(v)
        if (v.status === before && !v.working) break // no progress (the judge did not answer): the failure is on the digest
      }
    } finally {
      if (alive.current) { setBusy(null); setStage(null) }
      await refresh()
      await onChanged?.()
    }
  }, [post, refresh, onChanged])

  const start = useCallback(async (scope: 'HEADING' | 'SET', headingId?: string) => {
    setError(null); setNote(null)
    const key = scope === 'SET' ? 'SET' : headingId!
    setBusy(key)
    const r = await post(scope === 'SET' ? { op: 'start', scope: 'SET' } : { op: 'start', scope: 'HEADING', headingId: headingId! })
    if (!r.ok) { setBusy(null); return }
    const v = r.result as DigestView
    put(v)
    await drive(v, key)
  }, [post, drive])

  const carryOn = useCallback(async (d: DigestView, opts?: { goOnWithTheRest?: boolean }) => { setError(null); await drive(d, d.scope === 'SET' ? 'SET' : d.headingId ?? d.id, opts) }, [drive])

  const retry = useCallback(async (d: DigestView) => {
    setError(null)
    setBusy(d.scope === 'SET' ? 'SET' : d.headingId ?? d.id)
    const r = await post({ op: 'retry', digestId: d.id })
    if (!r.ok) { setBusy(null); return }
    const v = r.result as DigestView
    put(v)
    await drive(v, d.scope === 'SET' ? 'SET' : d.headingId ?? d.id)
  }, [post, drive])

  const suggestGaps = useCallback(async (d: DigestView, index?: number) => {
    setError(null); setNote(null)
    const r = await post(index == null ? { op: 'suggestGaps', digestId: d.id } : { op: 'suggestGaps', digestId: d.id, index })
    if (!r.ok) return
    const x = r.result as { added: number; skipped: number }
    setNote(x.added
      ? `${x.added} gap${x.added === 1 ? '' : 's'} added as suggestion${x.added === 1 ? '' : 's'}${x.skipped ? ` (${x.skipped} already there)` : ''}. They are in “Check for gaps” in the Coherent Actions list, marked “From: the digest”; nothing is an action until you accept it.`
      : `Nothing added: ${x.skipped} of these gaps ${x.skipped === 1 ? 'is' : 'are'} already in the suggestions or the list.`)
    await refresh()
    await onChanged?.()
  }, [post, refresh, onChanged])

  const forScope = useCallback((scope: 'HEADING' | 'SET', headingId?: string) =>
    digests.find((d) => d.scope === scope && (scope === 'SET' || d.headingId === headingId)) ?? null, [digests])

  return { digests, quote, busy, stage, error, note, clearError: () => setError(null), clearNote: () => setNote(null), start, carryOn, retry, suggestGaps, forScope }
}

// ── the button, with its price and its ask-first ───────────────────────────────────────────────────────────

export function AskButton({ label, price, running, disabled, onGo, dataAttr }: { label: string; price: DigestPrice | null; running: boolean; disabled: boolean; onGo: () => void; dataAttr: string }) {
  const [confirm, setConfirm] = useState(false)
  const priceWords = price ? price.words : 'the price is shown when it finishes'
  const over = price ? price.pence > DIGEST_CONFIRM_ABOVE_PENCE : true
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <button type="button" disabled={disabled || running} {...{ [dataAttr]: '' }}
        title={`Four models each answer the same six questions about ${label.includes('set') ? 'every action' : 'these actions'}, and a judge writes one digest that keeps each model’s position named. Nothing is added to your list. Price: ${priceWords}.`}
        onClick={() => (over ? setConfirm(true) : onGo())}
        className="text-[11px] font-medium px-1.5 py-0.5 rounded border border-zinc-300 text-zinc-800 hover:bg-zinc-50 disabled:opacity-40">{label}</button>
      {confirm && (
        <span className="inline-flex flex-wrap items-center gap-1.5 rounded border-2 border-zinc-900 bg-white px-2 py-1 text-[11px]" role="alert" data-digest-confirm>
          <span>This will cost <span className="font-semibold">{priceWords}</span>. It takes a few minutes and keeps going if you close the tab. Go on?</span>
          <button type="button" onClick={() => { setConfirm(false); onGo() }} className="font-medium px-2 py-0.5 rounded bg-zinc-900 text-white" data-digest-go>Go on</button>
          <button type="button" onClick={() => setConfirm(false)} className="underline text-zinc-700">Cancel</button>
        </span>
      )}
    </span>
  )
}

// ── one digest ─────────────────────────────────────────────────────────────────────────────────────────────

const STATUS_WORDS: Record<string, string> = {
  RUNNING: 'waiting for the four models', WORKING_MODELS: 'the four models are reading', MODELS_DONE: 'waiting for the judge',
  WORKING_JUDGE: 'the judge is writing', READY: 'ready', FAILED: 'failed',
}

function Cites({ text, labels, onOpen }: { text: string; labels: Record<number, string>; onOpen?: (n: number) => void }) {
  // "#12" in prose becomes a press that opens that action (conflicts "link to the actions"); an unknown number stays plain text
  const parts = text.split(/(?<![\w&])(#\d{1,5})\b/g)
  return (
    <>
      {parts.map((p, i) => {
        const m = /^#(\d{1,5})$/.exec(p)
        if (!m) return <span key={i}>{p}</span>
        const n = Number(m[1])
        return labels[n] && onOpen
          ? <button key={i} type="button" onClick={() => onOpen(n)} title={labels[n]} className="underline font-medium text-zinc-900" data-digest-cite>{p}</button>
          : <span key={i} className={labels[n] ? 'font-medium' : 'font-semibold border-b border-dashed border-zinc-900'} title={labels[n] ?? 'This number is not among the actions the digest read'}>{p}</span>
      })}
    </>
  )
}

export function DigestPanel({ d, state, onOpenAction, disabled }: { d: DigestView; state: DigestState; onOpenAction?: (n: number) => void; disabled: boolean }) {
  const j = d.judge
  const answering = d.table?.answering ?? d.models.filter((m) => m.status === 'OK').length
  const failed = d.models.filter((m) => m.status === 'FAILED')
  const running = state.busy === (d.scope === 'SET' ? 'SET' : d.headingId ?? d.id)
  const inFlight = d.status === 'RUNNING' || d.status === 'MODELS_DONE'
  const disagreeHeading = answering === 4 ? 'Where the four disagree' : `Where the ${answering} that answered disagree`
  const gapsHandled = j ? Object.keys(j.handled.gaps).length : 0
  return (
    <div className="mt-1 rounded-lg border border-zinc-300 bg-white p-2.5 space-y-3 text-xs text-zinc-800" data-digest-panel data-digest-status={d.status}>
      {d.staleSentence && (
        <p className="border-2 border-zinc-900 rounded px-2 py-1 font-semibold" role="note" data-digest-stale>⚠ {d.staleSentence}</p>
      )}

      <p className="text-[11px] text-zinc-600" data-digest-cost>
        {STATUS_WORDS[d.status] ?? d.status}. {answering} of {d.models.length} models answered. Cost {d.spentPence == null ? 'not recorded' : pence(d.spentPence)}{d.unpriced ? ' (at least one call could not be priced, so this is a floor)' : ' (measured on this run)'}.
        {j && (j.trimmedCommentaries > 0 ? ` ⚠ ${j.trimmedCommentaries} long ${j.trimmedCommentaries === 1 ? 'Detail was' : 'Details were'} cut at ${j.commentaryMax} characters to fit what the models can read.` : '')}
      </p>

      {/* who answered, and who did not - a failure announces itself with its cause (CLAUDE.md §18) */}
      <ul className="text-[11px] space-y-0.5" data-digest-models>
        {d.models.map((m) => (
          <li key={m.model}>
            <span aria-hidden>{m.status === 'OK' ? '✓' : m.status === 'FAILED' ? '✗' : '○'}</span>{' '}
            <span className="font-semibold">{m.model}</span> — {m.status === 'OK' ? 'answered' : m.status === 'FAILED' ? `did not answer: ${m.error ?? 'no reason recorded'}` : 'not asked yet'}
            {m.servedBy && <span> (answered by {m.servedBy}, the stand-in for this slot)</span>}
            {m.pence != null && <span className="text-zinc-500"> · {pence(m.pence)}</span>}
            {m.dropped && (m.dropped.badActionNumbers + m.dropped.missingWhatFails + m.dropped.badConditionNumbers > 0 || m.dropped.unknownRefs.length > 0) && (
              <span className="text-zinc-700"> · left out and counted: {[
                m.dropped.badActionNumbers ? `${m.dropped.badActionNumbers} action number${m.dropped.badActionNumbers === 1 ? '' : 's'} that are not on this list` : '',
                m.dropped.badConditionNumbers ? `${m.dropped.badConditionNumbers} condition number${m.dropped.badConditionNumbers === 1 ? '' : 's'} that do not exist` : '',
                m.dropped.missingWhatFails ? `${m.dropped.missingWhatFails} missing item${m.dropped.missingWhatFails === 1 ? '' : 's'} that could not say what fails without ${m.dropped.missingWhatFails === 1 ? 'it' : 'them'}` : '',
                m.dropped.unknownRefs.length ? `cited ${m.dropped.unknownRefs.join(', ')}, which the record never carried (kept, flagged)` : '',
              ].filter(Boolean).join('; ')}</span>
            )}
          </li>
        ))}
      </ul>

      {(inFlight || failed.length > 0) && !running && !d.working && (
        <p className="flex flex-wrap items-center gap-2 border border-zinc-400 rounded px-2 py-1 bg-zinc-50" data-digest-waiting>
          <span className="font-semibold">{failed.length ? `${failed.length} of the four did not answer.` : `This digest is ${STATUS_WORDS[d.status]}.`}</span>
          {failed.length > 0 && <button type="button" disabled={disabled} onClick={() => void state.retry(d)} className="font-medium px-2 py-0.5 rounded border border-zinc-900" data-digest-retry>Ask the ones that failed again</button>}
          {d.status === 'MODELS_DONE' && <button type="button" disabled={disabled} onClick={() => void state.carryOn(d, { goOnWithTheRest: true })} className="font-medium px-2 py-0.5 rounded bg-zinc-900 text-white" data-digest-carry-on>{failed.length ? `Go on with the ${answering} that answered` : 'Ask the judge'}</button>}
          {d.status === 'RUNNING' && <button type="button" disabled={disabled} onClick={() => void state.carryOn(d)} className="font-medium px-2 py-0.5 rounded bg-zinc-900 text-white" data-digest-carry-on>Carry on</button>}
        </p>
      )}
      {d.failure && <p className="font-semibold border-2 border-zinc-900 rounded px-2 py-1" role="alert" data-digest-failure>⚠ {d.failure}</p>}
      {(running || d.working) && <p className="text-[11px] font-semibold" role="status">Working: {state.stage ?? 'a stage is under way in another request'}…</p>}

      {j && (
        <>
          {(j.flags.strayCites.length > 0 || j.flags.unknownRefs.length > 0 || j.flags.badActionNumbers > 0 || j.flags.unnamedModels > 0 || j.flags.missingWhatFails > 0) && (
            <p className="text-[11px] border border-zinc-400 rounded px-2 py-1 bg-zinc-50" data-digest-flags>
              Checked against the record, and not hidden: {[
                j.flags.strayCites.length ? `the judge cited ${j.flags.strayCites.map((n) => `#${n}`).join(', ')}, which ${j.flags.strayCites.length === 1 ? 'is' : 'are'} not among the actions read (dashed underline below)` : '',
                j.flags.unknownRefs.length ? `the judge cited ${j.flags.unknownRefs.join(', ')}, which the record never carried` : '',
                j.flags.badActionNumbers ? `${j.flags.badActionNumbers} item${j.flags.badActionNumbers === 1 ? '' : 's'} named an action that is not on this list and ${j.flags.badActionNumbers === 1 ? 'was' : 'were'} left out` : '',
                j.flags.unnamedModels ? `${j.flags.unnamedModels} attribution${j.flags.unnamedModels === 1 ? '' : 's'} named no model on the panel and ${j.flags.unnamedModels === 1 ? 'was' : 'were'} left out` : '',
                j.flags.missingWhatFails ? `${j.flags.missingWhatFails} gap${j.flags.missingWhatFails === 1 ? '' : 's'} could not say what fails without ${j.flags.missingWhatFails === 1 ? 'it' : 'them'} and ${j.flags.missingWhatFails === 1 ? 'was' : 'were'} left out` : '',
              ].filter(Boolean).join('; ')}.
            </p>
          )}

          <section aria-label="The six questions" data-digest-answers>
            <h5 className="font-semibold text-zinc-900">The six questions, as the judge reconciled them</h5>
            <ol className="mt-1 space-y-2">
              {DIGEST_QUESTIONS.map((q, i) => {
                const a = j.digest.answers.find((x) => x.question === i + 1)
                return (
                  <li key={i}>
                    <p className="font-medium text-zinc-900">{i + 1}. {q}</p>
                    {a ? <p className="mt-0.5 whitespace-pre-wrap"><Cites text={a.reconciled} labels={d.labels} onOpen={onOpenAction} /></p> : <p className="mt-0.5 font-semibold">The judge gave no answer to this question.</p>}
                  </li>
                )
              })}
            </ol>
          </section>

          <section aria-label={disagreeHeading} data-digest-disagree>
            <h5 className="font-semibold text-zinc-900">{disagreeHeading}</h5>
            {j.digest.disagreements.length === 0
              ? <p className="mt-0.5 text-zinc-700">The judge found no real disagreement between the models that answered.</p>
              : <ul className="mt-1 space-y-2">{j.digest.disagreements.map((x, i) => (
                <li key={i} className="border border-zinc-300 rounded p-1.5">
                  <p className="font-medium">{x.topic}</p>
                  <ul className="mt-0.5 space-y-0.5">{x.positions.map((p) => <li key={p.model}><span className="font-semibold">{p.model}:</span> <Cites text={p.position} labels={d.labels} onOpen={onOpenAction} /></li>)}</ul>
                </li>))}</ul>}
          </section>
        </>
      )}

      {d.table && d.conditions.length > 0 && (
        <section aria-label="Conditions by actions, as the models see it" data-digest-table>
          <h5 className="font-semibold text-zinc-900">Which actions deliver each condition — as the models see it</h5>
          <p className="text-[10px] text-zinc-500">“all four” means every model that answered named the action for that condition; “disputed” means fewer than all but one. This is computed from the models’ own answers, not written by the judge.</p>
          <div className="overflow-x-auto mt-1">
            <table className="min-w-full text-[11px] border-collapse">
              <thead><tr className="text-left border-b border-zinc-300"><th className="py-0.5 pr-2 font-semibold">Condition</th><th className="py-0.5 font-semibold">Actions</th></tr></thead>
              <tbody>
                {d.table.rows.map((r) => (
                  <tr key={r.condition} className="border-b border-zinc-100 align-top" data-digest-table-row>
                    <td className="py-0.5 pr-2"><span className="font-semibold">{r.condition}.</span> {r.conditionText}</td>
                    <td className="py-0.5">
                      {r.nobody ? <span className="font-semibold border-2 border-zinc-900 rounded px-1">NO ACTION — none of the models named one</span>
                        : r.cells.map((c) => (
                          <span key={c.action} className="inline-block mr-2 mb-0.5" title={`named by ${c.models.join(', ')}`}>
                            <button type="button" onClick={() => onOpenAction?.(c.action)} className="underline font-medium" title={d.labels[c.action]}>#{c.action}</button>{' '}
                            <span className={c.label === 'disputed' ? 'font-semibold' : ''}><span aria-hidden>{c.label === 'disputed' ? '○' : c.label.startsWith('all') || c.label === 'both' ? '●' : '◐'}</span> {c.label}</span>
                          </span>))}
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {j && (
        <>
          <section aria-label="The actions that carry the most weight" data-digest-weight>
            <h5 className="font-semibold text-zinc-900">The actions that carry the most weight</h5>
            {j.digest.weightBearing.length === 0 ? <p className="mt-0.5 text-zinc-700">None named.</p> : <ul className="mt-0.5 space-y-0.5">{j.digest.weightBearing.map((w, i) => <li key={i}><button type="button" onClick={() => onOpenAction?.(w.action)} className="underline font-medium" title={d.labels[w.action]}>#{w.action}</button> {d.labels[w.action] ? `${d.labels[w.action]} — ` : '— '}{w.why} <span className="text-zinc-500">({w.namedBy.length} of {answering}: {w.namedBy.join(', ') || 'no model named'})</span></li>)}</ul>}
          </section>

          <section aria-label="Actions that deliver no condition directly" data-digest-nodirect>
            <h5 className="font-semibold text-zinc-900">Actions that deliver no condition directly</h5>
            {j.digest.noDirectCondition.length === 0 ? <p className="mt-0.5 text-zinc-700">None: the models find every action delivers at least one condition.</p> : <ul className="mt-0.5 space-y-0.5">{j.digest.noDirectCondition.map((w, i) => <li key={i}><button type="button" onClick={() => onOpenAction?.(w.action)} className="underline font-medium" title={d.labels[w.action]}>#{w.action}</button> {d.labels[w.action] ? `${d.labels[w.action]} — ` : '— '}{w.why} <span className="text-zinc-500">({w.namedBy.length} of {answering})</span></li>)}</ul>}
          </section>

          <section aria-label="What is missing" data-digest-gaps>
            <h5 className="font-semibold text-zinc-900 flex flex-wrap items-center gap-2">What is missing, most-named first
              {j.digest.gaps.length > 0 && <button type="button" disabled={disabled || gapsHandled >= j.digest.gaps.length} onClick={() => void state.suggestGaps(d)} className="text-[11px] font-medium px-1.5 py-0.5 rounded border border-zinc-900 disabled:opacity-40" data-digest-suggest-all>Add all as suggestions{gapsHandled ? ` (${j.digest.gaps.length - gapsHandled} left)` : ''}</button>}
            </h5>
            {j.digest.gaps.length === 0 ? <p className="mt-0.5 text-zinc-700">The models named nothing that fails without being added.</p> : (
              <ul className="mt-1 space-y-1.5">{j.digest.gaps.map((g, i) => (
                <li key={i} className="border border-zinc-300 rounded p-1.5" data-digest-gap>
                  <p><span className="font-semibold">{g.item}</span> <span className="text-zinc-500">· {g.category} · named by {g.namedBy.length} of {answering}{g.namedBy.length ? ` (${g.namedBy.join(', ')})` : ''}</span></p>
                  <p className="text-zinc-700"><span className="font-medium">What fails without it:</span> {g.whatFails}</p>
                  <p className="mt-0.5">{j.handled.gaps[String(i)]
                    ? <span className="font-semibold" data-digest-gap-added>✓ Added as a suggestion — From: the digest, {g.namedBy.length} of {answering} models</span>
                    : <button type="button" disabled={disabled} onClick={() => void state.suggestGaps(d, i)} className="text-[11px] font-medium px-1.5 py-0.5 rounded border border-zinc-400" data-digest-suggest-one>Add as a suggestion</button>}</p>
                </li>))}</ul>)}
          </section>

          <section aria-label="Conflicts" data-digest-conflicts>
            <h5 className="font-semibold text-zinc-900">Conflicts between actions, or with the policy</h5>
            {j.digest.conflicts.length === 0 ? <p className="mt-0.5 text-zinc-700">None named.</p> : <ul className="mt-0.5 space-y-0.5">{j.digest.conflicts.map((c, i) => (
              <li key={i}>
                {c.actions.length ? c.actions.map((n) => <button key={n} type="button" onClick={() => onOpenAction?.(n)} className="underline font-medium mr-1.5" title={d.labels[n]}>#{n}</button>) : <span className="font-semibold mr-1.5">With the guiding policy:</span>}
                <Cites text={c.what} labels={d.labels} onOpen={onOpenAction} /> <span className="text-zinc-500">({c.namedBy.length} of {answering})</span>
              </li>))}</ul>}
          </section>

          <section aria-label="Conditions the models think are missing" data-digest-conditions>
            <h5 className="font-semibold text-zinc-900">Conditions the models think your list lacks</h5>
            {j.digest.proposedConditions.length === 0 ? <p className="mt-0.5 text-zinc-700">None proposed.</p> : (
              <>
                <p className="text-[10px] text-zinc-500">These are proposals only. They are in the conditions panel at the top of this step, where you accept or set each aside; none is on your list.</p>
                <ul className="mt-0.5 space-y-0.5">{j.digest.proposedConditions.map((c, i) => (
                  <li key={i}><span className="font-medium">{c.text}</span> — {c.why} <span className="text-zinc-500">({c.namedBy.length} of {answering}) · {j.handled.conditions[String(i)] === 'PROPOSED' ? 'waiting in the conditions panel' : j.handled.conditions[String(i)] === 'DUPLICATE' ? 'already on your list or already proposed' : 'not yet written to the conditions panel'}</span></li>))}</ul>
              </>)}
          </section>
        </>
      )}

      {d.modelAnswers.length > 0 && (
        <details data-digest-model-answers>
          <summary className="cursor-pointer font-semibold text-zinc-900">Read each model’s own answers</summary>
          <div className="mt-1 space-y-2">
            {d.modelAnswers.map((m) => (
              <div key={m.model} className="border border-zinc-300 rounded p-1.5">
                <p className="font-semibold">{m.model}</p>
                <ol className="mt-0.5 space-y-1">{m.answers.sort((a, b) => a.question - b.question).map((a) => <li key={a.question}><span className="font-medium">{a.question}.</span> <span className="whitespace-pre-wrap"><Cites text={a.answer} labels={d.labels} onOpen={onOpenAction} /></span></li>)}</ol>
              </div>))}
          </div>
        </details>
      )}
    </div>
  )
}

// ── what sits under a heading, and at the foot of step 1 ───────────────────────────────────────────────────

export function HeadingDigest({ headingId, headingName, actionCount, state, onOpenAction, disabled, extra }: { headingId: string; headingName: string; actionCount: number; state: DigestState; onOpenAction?: (n: number) => void; disabled: boolean; extra?: React.ReactNode }) {
  const d = state.forScope('HEADING', headingId)
  const [open, setOpen] = useState(false)
  const running = state.busy === headingId
  const price = state.quote?.headings[headingId]?.price ?? null
  const waiting = d && (d.status === 'RUNNING' || d.status === 'MODELS_DONE') && !running
  return (
    <div className="mb-1.5" data-heading-digest={headingId}>
      <div className="flex flex-wrap items-center gap-2">
        <AskButton label="Ask four models about this heading" price={price} running={running} disabled={disabled || state.busy != null || actionCount === 0} dataAttr="data-ask-heading-digest"
          onGo={() => { setOpen(true); void state.start('HEADING', headingId) }} />
        {extra}
        {running && <span className="text-[11px] font-semibold" role="status">Working: {state.stage ?? 'starting'}…</span>}
        {d && (
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="text-[11px] text-zinc-700 underline" data-digest-line>
            {d.line}{d.staleness.stale ? ' · out of date' : ''}{d.status !== 'READY' ? ` · ${STATUS_WORDS[d.status] ?? d.status}` : ''} · {open ? 'hide −' : 'show +'}
          </button>
        )}
        {waiting && (
          <span className="text-[11px] font-semibold" data-digest-announce>A digest of “{headingName}” is {STATUS_WORDS[d!.status]}. <button type="button" disabled={disabled || state.busy != null} onClick={() => { setOpen(true); void state.carryOn(d!) }} className="underline">Carry on</button></span>
        )}
      </div>
      {d && open && <DigestPanel d={d} state={state} onOpenAction={onOpenAction} disabled={disabled || state.busy != null} />}
    </div>
  )
}

export function SetDigestButton({ state, disabled, onOpened }: { state: DigestState; disabled: boolean; onOpened: () => void }) {
  const running = state.busy === 'SET'
  const price = state.quote?.set.price ?? null
  return (
    <AskButton label="Ask four models about the whole set" price={price} running={running} disabled={disabled || state.busy != null || (state.quote?.set.actions ?? 0) === 0} dataAttr="data-ask-set-digest"
      onGo={() => { onOpened(); void state.start('SET') }} />
  )
}

export function SetDigest({ state, open, setOpen, onOpenAction, disabled }: { state: DigestState; open: boolean; setOpen: (v: boolean) => void; onOpenAction?: (n: number) => void; disabled: boolean }) {
  const d = state.forScope('SET')
  const running = state.busy === 'SET'
  if (!d && !running) return null
  const waiting = d && (d.status === 'RUNNING' || d.status === 'MODELS_DONE') && !running
  return (
    <section className="rounded-lg border border-zinc-300 p-2" aria-label="Digest of the whole set" data-set-digest>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-zinc-900">The whole set</span>
        {d && <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="text-[11px] text-zinc-700 underline" data-digest-line>{d.line}{d.staleness.stale ? ' · out of date' : ''}{d.status !== 'READY' ? ` · ${STATUS_WORDS[d.status] ?? d.status}` : ''} · {open ? 'hide −' : 'show +'}</button>}
        {running && <span className="text-[11px] font-semibold" role="status">Working: {state.stage ?? 'starting'}…</span>}
        {waiting && <span className="text-[11px] font-semibold" data-digest-announce>A digest of the whole set is {STATUS_WORDS[d!.status]}. <button type="button" disabled={disabled || state.busy != null} onClick={() => { setOpen(true); void state.carryOn(d!) }} className="underline">Carry on</button></span>}
      </div>
      {d && open && <DigestPanel d={d} state={state} onOpenAction={onOpenAction} disabled={disabled || state.busy != null} />}
    </section>
  )
}
