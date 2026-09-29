// ─────────────────────────────────────────────────────────────────────────────
// CostExplorer.tsx — COST DASHBOARD. Spend over any date range, by provider / model / feature / idea /
// user / build, each row drilling into the next grouping. READ-ONLY: nothing here caps, throttles,
// charges or changes anything (same instruction as SpendSection.tsx), and the check asserts it.
//
// ⚠ UNATTRIBUTED SPEND IS A ROW, NEVER A FOOTNOTE. It sits in the table with a ⚠ and its own label
// (the glyph, not only the colour — docs/CLAUDE.md §21), it drills like any other row, and the coverage
// panel above the table says how much of the money is attributed to a user, an idea and a build, and how
// much of THAT is an inference rather than a fact.
// ⚠ "not known" is a first-class result: a group with an unpriced call shows its priced part plus the
// count it cannot price — never a total that reads as complete.
// ─────────────────────────────────────────────────────────────────────────────
'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'

const DIMS = ['provider', 'model', 'feature', 'idea', 'user', 'build'] as const
type Dim = (typeof DIMS)[number]
const DIM_LABEL: Record<Dim, string> = { provider: 'Provider', model: 'Model', feature: 'Feature', idea: 'Idea', user: 'User', build: 'Build' }
const NONE = '__none__'

interface Row {
  key: string | null; label: string; calls: number; failedCalls: number; tokensIn: number; tokensOut: number
  pence: number | null; penceKnown: number; unpricedCalls: number; share: number
  breakdown?: Array<{ feature: string; pence: number; calls: number; origin: string }>
}
interface Recon {
  provider: string; day: string; ledgerPence: number; ledgerRows: number; providerUsd: number | null
  gapPence: number | null; status: 'RECONCILED' | 'NOT_READ' | 'NOT_RECONCILABLE'; reason: string | null; checkedAt: string
}
interface Result {
  by: Dim; rows: Row[]
  totals: { calls: number; tokensIn: number; tokensOut: number; pence: number | null; penceKnown: number; unpricedCalls: number }
  coverage: {
    rows: number; withUser: number; withIdea: number; withBuild: number; penceTotal: number; penceWithUser: number
    penceWithIdea: number; penceUnattributedToUser: number; bySource: Array<{ source: string; pence: number; rows: number }>
  }
  reconciliation: Recon[]
}

const gbp = (p: number) => (p === 0 ? '£0.00' : Math.abs(p) < 1 ? `${p.toFixed(2)}p` : `£${(p / 100).toFixed(2)}`)
const money = (r: { pence: number | null; penceKnown: number; unpricedCalls: number }) =>
  r.pence != null ? gbp(r.pence) : `${gbp(r.penceKnown)} + ${r.unpricedCalls} call${r.unpricedCalls === 1 ? '' : 's'} not priced`
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—')
const isoDay = (d: Date) => d.toISOString().slice(0, 10)
const SOURCE_TEXT: Record<string, string> = {
  none: 'no attribution', explicit: 'named by the caller', ambient: 'from the request/build context',
  'owner-of-idea': 'user derived from the idea’s creator (at write time)',
  'inferred-idea': 'INFERRED — user filled from the idea’s creator (backfill)',
  'inferred-window': 'INFERRED — the only build running at that moment (backfill)',
}

export function CostExplorer() {
  const today = new Date()
  const [from, setFrom] = useState(isoDay(new Date(today.getTime() - 30 * 86_400_000)))
  const [to, setTo] = useState(isoDay(today))
  const [by, setBy] = useState<Dim>('provider')
  const [filters, setFilters] = useState<Partial<Record<Dim, string>>>({})
  const [labels, setLabels] = useState<Partial<Record<Dim, string>>>({})
  const [data, setData] = useState<Result | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true); setErr(null)
    const q = new URLSearchParams({ from, to, by })
    for (const d of DIMS) if (filters[d]) q.set(d, filters[d]!)
    fetch(`/api/admin/spend/explore?${q}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`)
        return r.json() as Promise<Result>
      })
      .then(setData)
      .catch((e) => { setData(null); setErr(e instanceof Error ? e.message : String(e)) })
      .finally(() => setLoading(false))
  }, [from, to, by, filters])

  /** Drill: filter on this row's value in the CURRENT grouping, then group by the next dimension. */
  const drill = useCallback((row: Row) => {
    setFilters((f) => ({ ...f, [by]: row.key ?? NONE }))
    setLabels((l) => ({ ...l, [by]: row.label }))
    const next = DIMS.find((d) => d !== by && !filters[d] && DIMS.indexOf(d) > DIMS.indexOf(by)) ?? DIMS.find((d) => d !== by && !filters[d])
    if (next) setBy(next)
    setOpen(null)
  }, [by, filters])

  const clear = (d: Dim) => setFilters((f) => { const n = { ...f }; delete n[d]; return n })
  const preset = (days: number | 'all') => {
    setTo(isoDay(new Date())); setFrom(days === 'all' ? '2026-08-17' : isoDay(new Date(Date.now() - days * 86_400_000)))
  }

  const cov = data?.coverage
  const unattributedRows = data?.rows.filter((r) => r.key == null).length ?? 0

  return (
    <div className="mb-10 space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Cost explorer</h3>
        <p className="text-xs text-muted-foreground">
          Every ledger row, over any range, by provider, model, feature, idea, user or build. Click a row to drill into it.
          Spend with no idea, user or build is shown as its own line — never dropped. Measurement only.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 text-xs">
        <label className="flex flex-col gap-0.5">From
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="rounded border px-2 py-1" />
        </label>
        <label className="flex flex-col gap-0.5">To (inclusive)
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="rounded border px-2 py-1" />
        </label>
        {([7, 30, 90] as const).map((d) => (
          <button key={d} onClick={() => preset(d)} className="rounded border px-2 py-1 hover:bg-muted">Last {d} days</button>
        ))}
        <button onClick={() => preset('all')} className="rounded border px-2 py-1 hover:bg-muted">Since the ledger began</button>
      </div>

      {/* Group-by tabs. Weight + underline, not colour alone. */}
      <div role="tablist" className="flex flex-wrap gap-1 text-xs">
        <span className="self-center pr-1 text-muted-foreground">Group by</span>
        {DIMS.map((d) => (
          <button key={d} role="tab" aria-selected={by === d} disabled={!!filters[d]} onClick={() => setBy(d)}
            className={`rounded border px-2.5 py-1 disabled:opacity-40 ${by === d ? 'border-2 border-zinc-900 font-semibold underline underline-offset-4' : 'hover:bg-muted'}`}>
            {DIM_LABEL[d]}
          </button>
        ))}
      </div>

      {Object.keys(filters).length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Filtered to</span>
          {DIMS.filter((d) => filters[d]).map((d) => (
            <button key={d} onClick={() => clear(d)} className="rounded-full border-2 border-zinc-700 px-2 py-0.5" title="Remove this filter">
              {DIM_LABEL[d]}: {labels[d] ?? filters[d]} ✕
            </button>
          ))}
          <button onClick={() => { setFilters({}); setLabels({}); setBy('provider') }} className="underline">clear all</button>
        </div>
      )}

      {err && <p className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">⚠ {err}</p>}
      {loading && <p className="text-xs text-muted-foreground">Loading…</p>}

      {data && cov && (
        <>
          {/* COVERAGE — how much of this money can be attributed at all. */}
          <div className="rounded border p-3 text-xs">
            <p className="font-semibold">
              Attribution in this view: {gbp(cov.penceWithUser)} of {gbp(cov.penceTotal)} ({pct(cov.penceWithUser, cov.penceTotal)}) is attributed to a user
              {' · '}{pct(cov.penceWithIdea, cov.penceTotal)} to an idea{' · '}{cov.withBuild.toLocaleString('en-GB')} of {cov.rows.toLocaleString('en-GB')} rows to a build.
            </p>
            {cov.penceUnattributedToUser > 0 && (
              <p className="mt-1 text-amber-900">
                ⚠ {gbp(cov.penceUnattributedToUser)} has no user. It is the “Unattributed” line below
                {unattributedRows === 0 ? ' (group by User to see it)' : ''} — expand it to see what it is made of.
              </p>
            )}
            <details className="mt-1">
              <summary className="cursor-pointer text-muted-foreground">How attribution was learned</summary>
              <ul className="mt-1 space-y-0.5">
                {cov.bySource.map((s) => (
                  <li key={s.source}>{gbp(s.pence)} · {s.rows.toLocaleString('en-GB')} rows — {SOURCE_TEXT[s.source] ?? s.source}</li>
                ))}
              </ul>
              <p className="mt-1 text-muted-foreground">Rows marked INFERRED are a best reading, not a record; they are marked in the ledger and can be told apart from the rest.</p>
            </details>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-1 pr-3 font-medium">{DIM_LABEL[by]}</th>
                  <th className="py-1 pr-3 text-right font-medium">Calls</th>
                  <th className="py-1 pr-3 text-right font-medium">Tokens in / out</th>
                  <th className="py-1 pr-3 text-right font-medium">Cost</th>
                  <th className="py-1 font-medium">Share</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const un = r.key == null
                  const canDrill = DIMS.some((d) => d !== by && !filters[d])
                  return (
                    <Fragment key={r.key ?? NONE}>
                      <tr className={`border-b align-top ${un ? 'border-l-4 border-l-amber-600 bg-amber-50/60' : ''}`}>
                        <td className="py-1.5 pr-3">
                          {canDrill ? (
                            <button onClick={() => drill(r)} className="text-left underline-offset-2 hover:underline">
                              {un ? '⚠ ' : ''}{r.label}
                            </button>
                          ) : <span>{un ? '⚠ ' : ''}{r.label}</span>}
                          {un && (
                            <button onClick={() => setOpen(open === NONE ? null : NONE)} className="ml-2 text-muted-foreground underline">
                              {open === NONE ? 'hide' : 'what is this?'}
                            </button>
                          )}
                        </td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{r.calls.toLocaleString('en-GB')}{r.failedCalls ? ` (${r.failedCalls} failed)` : ''}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{Math.round(r.tokensIn).toLocaleString('en-GB')} / {Math.round(r.tokensOut).toLocaleString('en-GB')}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{money(r)}</td>
                        <td className="py-1.5">
                          <span className="inline-block h-2 rounded bg-zinc-700" style={{ width: `${Math.max(2, Math.round(r.share * 80))}px` }} aria-hidden />
                          <span className="ml-1.5 tabular-nums">{Math.round(r.share * 100)}%</span>
                        </td>
                      </tr>
                      {un && open === NONE && r.breakdown && (
                        <tr className="border-b bg-amber-50/40">
                          <td colSpan={5} className="py-1.5 pl-4 text-[11px]">
                            <p className="mb-1 font-medium">What the unattributed spend is made of ({by === 'provider' || by === 'model' || by === 'feature' ? 'no user/idea/build on these rows' : `no ${by}`}):</p>
                            <ul className="space-y-0.5">
                              {r.breakdown.map((b) => (
                                <li key={b.feature} className="tabular-nums">
                                  {gbp(b.pence)} · {b.calls.toLocaleString('en-GB')} calls · {b.feature} —{' '}
                                  <span className="font-medium">{
                                    b.origin === 'user-facing' ? 'a person’s own build, chat or search — attribution missing'
                                    : b.origin === 'measurement' ? 'a benchmark, probe or admin test — no user by nature'
                                    : b.origin === 'platform' ? 'platform work (ingest, graph) — no user by nature' : 'unclassified'
                                  }</span>
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
                {data.rows.length === 0 && <tr><td colSpan={5} className="py-3 text-muted-foreground">No ledger rows in this range and filter.</td></tr>}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="pt-2 pr-3">Total</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">{data.totals.calls.toLocaleString('en-GB')}</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">{Math.round(data.totals.tokensIn).toLocaleString('en-GB')} / {Math.round(data.totals.tokensOut).toLocaleString('en-GB')}</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">{money(data.totals)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground">Costs are list-price estimates from token counts (xAI rows use xAI’s own billed figure), not an invoice — see the reconciliation below.</p>

          <Reconciliation rows={data.reconciliation} />
        </>
      )}
    </div>
  )
}

/** Ledger vs each provider's own figures, per provider per day. Every state is worded, never coloured alone. */
function Reconciliation({ rows }: { rows: Recon[] }) {
  return (
    <div className="rounded border p-3 text-xs">
      <p className="font-semibold">Reconciliation — our ledger against each provider’s own figures</p>
      <p className="mt-0.5 text-muted-foreground">
        Written by the reconciliation job, the only place the provider admin keys are held. A provider it could not read is
        shown as such — its gap is unknown, not zero.
      </p>
      {rows.length === 0 ? (
        <p className="mt-2 text-amber-900">⚠ The reconciliation job has not written anything for this range.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b text-left text-muted-foreground">
              <th className="py-1 pr-3 font-medium">Day</th><th className="py-1 pr-3 font-medium">Provider</th>
              <th className="py-1 pr-3 text-right font-medium">Ledger</th><th className="py-1 pr-3 text-right font-medium">Provider</th>
              <th className="py-1 pr-3 text-right font-medium">Gap</th><th className="py-1 font-medium">Status</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.day}-${r.provider}`} className="border-b align-top">
                  <td className="py-1 pr-3 tabular-nums">{r.day}</td>
                  <td className="py-1 pr-3">{r.provider}</td>
                  <td className="py-1 pr-3 text-right tabular-nums">{gbp(r.ledgerPence)}</td>
                  <td className="py-1 pr-3 text-right tabular-nums">{r.providerUsd == null ? '—' : gbp(r.providerUsd * 79)}</td>
                  <td className="py-1 pr-3 text-right tabular-nums">
                    {r.gapPence == null ? '—' : `${r.gapPence > 0 ? '+' : ''}${gbp(r.gapPence)}`}
                  </td>
                  <td className="py-1">
                    {r.status === 'RECONCILED' && '✓ Reconciled'}
                    {r.status === 'NOT_READ' && `◌ Not read — ${r.reason ?? 'no reason recorded'}`}
                    {r.status === 'NOT_RECONCILABLE' && `⊘ Not reconcilable — ${r.reason ?? ''}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
