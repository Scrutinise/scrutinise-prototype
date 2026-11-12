'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-X X3 §6a (decisions 311, 314, 317) — THE DEEPENING PAGE'S SECTIONS, in the brief's order:
//
//   1 Collision            the schedule and every draft's collision report, with counts (267/269)
//   2 Four models          the digest of the WHOLE SET, over drafts (311): moved here from Organising; heading digests stay there
//   3 Review passes        the five passes over every accepted draft (a runner, priced and asked first) and the Risks view, by draft
//   4 Coherence and gaps   the gap check, and the conditions × actions table from the owner's links
//   5 Costs                the cost lines by heading and by year, years 1–5 (CCh-Lex 7 Nov (2), 3); "cost–benefit analysis: not yet available"
//
// Mounted INSIDE the lock (DeepeningGate): until every live action is accepted or needs no draft, none of this mounts, so none of it runs.
// ⚠ Never colour alone (§21): every state is a word, and a glyph where it is a state. ⚠ A run that spends asks first, at its measured price.
// ⚠ Labels come from screen-labels.ts (DEEPENING_UI); the field guide has an entry for each.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { explainFailure } from '@/lib/api-rejection'
import { DEEPENING_UI } from '@/lib/lex/screen-labels'
import { draftingHref } from '@/lib/lex/stages'
import { COST_YEARS, moneyWords, type CostRow } from '@/lib/lex/cost-years-pure'
import type { DeepeningOverview } from '@/lib/lex/deepening-overview'
import type { CanonicalAction, CanonicalActionHeading } from '@/lib/lex/page1-config'
import type { ConditionsDoc } from '@/lib/lex/action-conditions'
import { useDigests, SetDigestButton, SetDigest } from './ActionDigest'
import { ConditionsCoverageView } from './ActionsStructureTools'
import ActionGapCheck from './ActionGapCheck'
import RisksView from './RisksView'

const pence = (p: number | null | undefined) => (p == null ? 'not priced' : p < 1 ? `${p.toFixed(2)}p` : `${p.toFixed(1)}p`)
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="pt-3" data-deepening-section={id} aria-label={title}>
      <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-800 mb-1">{title}</h3>
      {children}
    </section>
  )
}

export default function DeepeningSections({ ideaId, actions, headings, conditions, onChanged, initial }: {
  ideaId: string; actions: CanonicalAction[]; headings: CanonicalActionHeading[]; conditions: ConditionsDoc; onChanged?: () => void | Promise<boolean | void>
  /** The overview already read (a server render, or a check); the page reads it again on mount. */
  initial?: DeepeningOverview
}) {
  const [o, setO] = useState<DeepeningOverview | null>(initial ?? null)
  const [error, setError] = useState<string | null>(null)
  const read = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/deepening/overview`)
      const body = await res.json().catch(() => null)
      if (!res.ok) { setError(explainFailure(body, res.status, 'Reading the Deepening’s sections')); return }
      setO(body as DeepeningOverview); setError(null)
    } catch (e) { setError(`Reading the Deepening’s sections could not reach the server (${e instanceof Error ? e.message : 'network error'}).`) }
  }, [ideaId])
  useEffect(() => { void read() }, [read])

  const digests = useDigests(ideaId, true, onChanged)
  const [setOpen, setSetOpen] = useState(true)
  const openAction = (n: number) => { window.location.href = draftingHref(ideaId, n) }
  const live = actions.filter((a) => a.status === 'LIVE' && !a.parked)

  return (
    <div data-deepening-sections>
      {error && (
        <p className="mt-2 text-xs font-semibold text-zinc-900 bg-white border-2 border-zinc-900 rounded px-2 py-1.5" role="alert">⚠ {error}{' '}
          <button type="button" onClick={() => void read()} className="ml-1 px-2 py-0.5 rounded border border-zinc-900 bg-zinc-100 font-semibold">{DEEPENING_UI.readAgain}</button></p>
      )}

      <Section id="collision" title={DEEPENING_UI.collision}>
        {!o ? <p className="text-xs text-zinc-600" role="status">Reading…</p> : <Collision ideaId={ideaId} c={o.collision} />}
      </Section>

      <Section id="four-models" title={DEEPENING_UI.fourModels}>
        <p className="text-xs text-zinc-700 mb-1">Each model reads an action’s accepted draft where one exists, otherwise its statement, and the digest says which for each. Heading digests stay on the Organising page.</p>
        <SetDigestButton state={digests} disabled={live.length === 0} onOpened={() => setSetOpen(true)} />
        {digests.error && <p className="mt-1 text-xs font-semibold border-2 border-zinc-900 rounded px-2 py-1" role="alert">⚠ {digests.error} <button type="button" onClick={digests.clearError} className="underline">OK</button></p>}
        <div className="mt-1"><SetDigest state={digests} open={setOpen} setOpen={setSetOpen} onOpenAction={openAction} disabled={false} /></div>
      </Section>

      <Section id="reviews" title={DEEPENING_UI.reviews}>
        {!o ? <p className="text-xs text-zinc-600" role="status">Reading…</p> : <Reviews ideaId={ideaId} r={o.reviews} onDone={read} />}
        <div className="pt-2"><RisksView ideaId={ideaId} /></div>
      </Section>

      <Section id="coherence" title={DEEPENING_UI.coherence}>
        <ActionGapCheck ideaId={ideaId} onChanged={() => void onChanged?.()} />
        <div className="pt-2"><ConditionsCoverageView doc={conditions} actions={live} headings={headings} /></div>
      </Section>

      <Section id="costs" title={DEEPENING_UI.costs}>
        {!o ? <p className="text-xs text-zinc-600" role="status">Reading…</p> : <Costs c={o.costs} />}
        <p className="mt-1 text-xs font-semibold text-zinc-800" data-cba-not-yet>{DEEPENING_UI.cbaNotYet}.</p>
      </Section>
    </div>
  )
}

// ── 1 Collision ────────────────────────────────────────────────────────────────────────────────────────────────
function Collision({ ideaId, c }: { ideaId: string; c: DeepeningOverview['collision'] }) {
  const docLine = (x: DeepeningOverview['collision']['reports'][number]) => (
    <li key={x.documentId} className="text-xs" data-collision-doc={x.d} data-collision-kind={x.kind}>
      <a href={draftingHref(ideaId, x.actionNumber)} className="underline font-medium">{x.d}</a>{' '}
      <span className="text-zinc-700">#{x.actionNumber ?? '?'} {x.actionTitle}</span>{' — '}
      {x.kind === 'CONSEQUENTIAL_SCHEDULE'
        ? <span>{plural(x.counts.clause, 'amendment or repeal listed', 'amendments and repeals listed')}</span>
        : <span>{plural(x.counts.clause, 'line of its own', 'lines of its own')} · <span className="font-medium">{x.counts.depends} that depend on it</span> · <span className="font-medium">{x.counts.refers} for review</span></span>}
      {x.v != null ? <span className="text-zinc-500"> · version {x.v}</span> : <span className="font-semibold"> · not generated yet</span>}
      {x.stale && <span className="font-semibold"> · ⚠ out of date: {x.stale}</span>}
    </li>
  )
  return (
    <div className="space-y-1.5" data-collision>
      <p className="text-xs text-zinc-800" data-collision-counts>
        {plural(c.reports.length, 'collision report', 'collision reports')}: {c.totals.depends} provisions depend on what the drafts change, and {c.totals.refers} refer to it and are for review.
        {c.missing.length ? ` ${plural(c.missing.length, 'action needs', 'actions need')} a report and ${c.missing.length === 1 ? 'has' : 'have'} none yet.` : ''}
      </p>
      {c.schedule.length > 0 && <div><p className="text-[11px] font-semibold text-zinc-900">The consequential schedule</p><ul className="space-y-0.5">{c.schedule.map(docLine)}</ul></div>}
      {c.reports.length > 0 && <div><p className="text-[11px] font-semibold text-zinc-900">The collision reports</p><ul className="space-y-0.5">{c.reports.map(docLine)}</ul></div>}
      {c.missing.length > 0 && (
        <div data-collision-missing><p className="text-[11px] font-semibold text-zinc-900">Need a report, have none yet</p>
          <ul className="space-y-0.5">{c.missing.map((m) => <li key={`${m.number}`} className="text-xs"><a href={draftingHref(ideaId, m.number)} className="underline">#{m.number ?? '?'} {m.title}</a></li>)}</ul></div>
      )}
      {!c.schedule.length && !c.reports.length && !c.missing.length && <p className="text-xs text-zinc-600">No action needs a collision report.</p>}
    </div>
  )
}

// ── 3 Review passes over every accepted draft ────────────────────────────────────────────────────────────────
function Reviews({ ideaId, r, onDone }: { ideaId: string; r: DeepeningOverview['reviews']; onDone: () => Promise<void> }) {
  const [confirm, setConfirm] = useState(false)
  const [running, setRunning] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])
  const stop = useRef(false)
  const todo = r.drafts.filter((d) => d.toRun > 0)
  const go = async () => {
    setConfirm(false); stop.current = false; setLog([])
    for (const d of todo) {
      if (stop.current) { setLog((l) => [...l, 'Stopped: the drafts not yet reviewed are unchanged.']); break }
      setRunning(d.d)
      try {
        const res = await fetch(`/api/ideas/${ideaId}/action-documents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'review', documentId: d.documentId }) })
        const body = await res.json().catch(() => null) as { data?: { outcomes?: Array<{ words: string }>; pence?: number | null } } | null
        if (!res.ok) setLog((l) => [...l, `${d.d}: not done — ${explainFailure(body, res.status, `“${DEEPENING_UI.reviewAll}”`)}`])
        else setLog((l) => [...l, `${d.d}: ${(body?.data?.outcomes ?? []).map((x) => x.words).join(' ')} (${pence(body?.data?.pence)})`])
      } catch (e) { setLog((l) => [...l, `${d.d}: could not reach the server (${e instanceof Error ? e.message : 'network error'}); nothing was written for it.`]) }
    }
    setRunning(null)
    await onDone()
  }
  return (
    <div className="space-y-1.5" data-reviews>
      <p className="text-xs text-zinc-800" data-reviews-count>
        {plural(r.drafts.length, 'accepted draft', 'accepted drafts')}{r.drafts.length ? `: ${r.drafts.filter((d) => d.passesRead >= r.passes).length} read by all ${r.passes} passes, ${todo.length} with passes still to run (${plural(r.toRun, 'pass', 'passes')} in all).` : '. A draft is reviewed here once it is accepted.'}
      </p>
      {r.drafts.length > 0 && (
        <ul className="space-y-0.5">{r.drafts.map((d) => (
          <li key={d.documentId} className="text-xs" data-review-draft={d.d}>
            <a href={draftingHref(ideaId, d.actionNumber)} className="underline font-medium">{d.d}</a> <span className="text-zinc-700">{d.kind}, version {d.v}</span> — <span aria-hidden>{d.passesRead >= r.passes ? '●' : d.passesRead ? '◐' : '○'}</span> {d.passesRead} of {r.passes} passes have read it{d.toRun ? ` · the rest: ${d.unmeasured ? 'not measured yet' : `about ${pence(d.pence)}`}` : ''}
            {running === d.d && <span className="font-semibold" role="status"> · reviewing now…</span>}
          </li>))}</ul>
      )}
      {r.movedOn.length > 0 && (
        <p className="text-xs text-zinc-800" data-reviews-moved-on>⚠ Accepted at an earlier version and changed since, so not reviewed here until the new version is accepted: {r.movedOn.map((m) => `${m.d} (accepted v${m.acceptedV}, now v${m.v})`).join('; ')}.</p>
      )}
      {todo.length > 0 && !running && (
        confirm ? (
          <p className="inline-flex flex-wrap items-center gap-1.5 rounded border-2 border-zinc-900 bg-white px-2 py-1 text-[11px]" role="alert" data-reviews-confirm>
            <span>This runs {plural(r.toRun, 'pass', 'passes')} over {plural(todo.length, 'draft', 'drafts')}, one draft after another, and costs <span className="font-semibold">{r.pence == null ? 'an amount not yet measured for every pass (the price of each is shown as it finishes)' : `about ${pence(r.pence)} (measured)`}</span>. Each draft is saved as it finishes. Go on?</span>
            <button type="button" onClick={() => void go()} className="font-medium px-2 py-0.5 rounded bg-zinc-900 text-white" data-reviews-go>{DEEPENING_UI.reviewGo}</button>
            <button type="button" onClick={() => setConfirm(false)} className="underline text-zinc-700">Cancel</button>
          </p>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} className="text-xs font-medium px-2 py-1 rounded border border-zinc-900 bg-white" data-reviews-all>{DEEPENING_UI.reviewAll} — {r.pence == null ? 'price not yet measured' : `about ${pence(r.pence)}`}</button>
        )
      )}
      {running && <button type="button" onClick={() => { stop.current = true }} className="text-xs underline">Stop after this draft</button>}
      {log.length > 0 && <ul className="text-[11px] text-zinc-800 space-y-0.5" data-reviews-log>{log.map((l, i) => <li key={i}>{l}</li>)}</ul>}
    </div>
  )
}

// ── 5 Costs, by heading and by year ──────────────────────────────────────────────────────────────────────────
function Costs({ c }: { c: DeepeningOverview['costs'] }) {
  const t = c.table
  const name = (r: CostRow) => (r.headingId ? c.headings[r.headingId] ?? 'a retired heading' : DEEPENING_UI.noHeading)
  const years = Array.from({ length: COST_YEARS }, (_, i) => i + 1)
  const row = (r: CostRow, label: string, total = false) => (
    <tr key={label} className={`border-b border-zinc-100 align-top ${total ? 'font-semibold border-t-2 border-zinc-900' : ''}`} data-cost-row={total ? 'total' : r.headingId ?? 'none'}>
      <td className="py-0.5 pr-2">{label}<span className="block text-[10px] font-normal text-zinc-500">{plural(r.lines, 'line', 'lines')}{r.noFigure ? ` · ${r.noFigure} with no figure` : ''}{r.oneSided ? ` · ${r.oneSided} given as one number (a floor)` : ''}</span></td>
      {years.map((y) => <td key={y} className="py-0.5 pr-2 text-right tabular-nums" data-cost-year={y}>{moneyWords(r.years[y - 1])}</td>)}
      <td className="py-0.5 text-right tabular-nums" data-cost-undated>{r.undatedLines ? `${moneyWords(r.undated)} (${plural(r.undatedLines, 'line', 'lines')})` : '—'}</td>
    </tr>
  )
  if (!t.total.lines) return <p className="text-xs text-zinc-700" data-costs-empty>No cost lines yet{c.noCostActions ? ` (${plural(c.noCostActions, 'action is', 'actions are')} recorded as costing nothing, each with its reason)` : ''}. {plural(c.uncosted, 'live action has', 'live actions have')} neither a cost line nor a “no cost” answer.</p>
  return (
    <div className="space-y-1" data-costs>
      <div className="overflow-x-auto">
        <table className="min-w-full text-[11px] border-collapse">
          <thead><tr className="text-left border-b border-zinc-300"><th className="py-0.5 pr-2 font-semibold">Heading</th>{years.map((y) => <th key={y} className="py-0.5 pr-2 font-semibold text-right">{DEEPENING_UI.year(String(y))}</th>)}<th className="py-0.5 font-semibold text-right">{DEEPENING_UI.undated}</th></tr></thead>
          <tbody>{t.rows.map((r) => row(r, name(r)))}{row(t.total, DEEPENING_UI.total, true)}</tbody>
        </table>
      </div>
      <p className="text-[10px] text-zinc-600" data-costs-note>
        A one-off line is in year 1; a per-year line is in each year of its duration (a part year is that part of the year’s figure; no duration means all five years); a line with no recurrence is under “{DEEPENING_UI.undated}”, counted and never placed in a year.
        {c.pricesOf ? ` Figures are uprated to ${c.pricesOf} prices${c.noPriceYear ? `; ${plural(c.noPriceYear, 'line carries', 'lines carry')} no price year and ${c.noPriceYear === 1 ? 'is' : 'are'} summed as entered` : ''}.` : ' No deflator series is loaded, so figures are summed as entered.'}
        {c.uncosted ? ` ${plural(c.uncosted, 'live action has', 'live actions have')} neither a cost line nor a “no cost” answer.` : ''}
      </p>
    </div>
  )
}
