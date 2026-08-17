// ─────────────────────────────────────────────────────────────────────────────
// SpendSection.tsx — BRIEF_SEARCH_S6 §3 ADDENDUM. The Admin tab Charlie asked for.
//
// Three things, in the order he asked for them:
//   1. daily tokens and cost, SEARCH and EVERYTHING ELSE separately
//   2. average cost per idea
//   3. ideas ranked most to least expensive over a chosen period
//
// ⚠⚠ NOTHING HERE CONTROLS ANYTHING. No cap, no throttle, no "suspend user". Charlie's
// instruction: "build the measurement, do not switch on any user-facing spend control.
// Until it's the user's own money, the only thing being measured is what this costs him."
// This component has no mutating action of any kind and the check asserts it.
//
// ⚠ "not known" IS A FIRST-CLASS RESULT HERE, not an error state. A model with no rate on
// file records tokens and a null cost, and the honest rendering is a dash with a count of
// the calls behind it — never £0.00, which is a claim, and the claim most likely to be
// believed.
// ─────────────────────────────────────────────────────────────────────────────
'use client'

import { useEffect, useState } from 'react'

type Kind = 'search' | 'everything-else' | 'unclassified'

interface DailyRow {
  day: string; kind: Kind; calls: number; failedCalls: number; unpricedCalls: number
  tokensIn: number; tokensOut: number; pence: number | null
}
interface IdeaRow {
  ideaId: string; title: string | null; calls: number; tokensIn: number
  tokensOut: number; pence: number | null; unpricedCalls: number
}
interface Overview {
  since: string; until: string; daily: DailyRow[]; ideas: IdeaRow[]
  averagePencePerIdea: number | null; ideasCounted: number; averageNote: string
  totals: { calls: number; tokensIn: number; tokensOut: number; pence: number | null; unpricedCalls: number }
  unclassifiedPasses: string[]
}

const fmtPence = (p: number | null) =>
  p == null ? '—' : p === 0 ? '£0.00' : p < 1 ? '<1p' : `£${(p / 100).toFixed(2)}`
const fmtNum = (v: number) => v.toLocaleString('en-GB')

const PERIODS = [7, 30, 90, 365]

export function SpendSection() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Overview | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true); setErr(null)
    fetch(`/api/admin/spend?days=${days}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`)
        return r.json()
      })
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [days])

  if (loading) return <p className="text-sm text-muted-foreground">Reading the ledger…</p>
  // ⚠ A failure says so. A spend page that renders empty looks like a platform that spent nothing.
  if (err) return <p className="text-sm text-red-700">Could not read the spend ledger — {err}</p>
  if (!data) return null

  // Roll the daily rows up per day so search and everything-else sit side by side.
  const byDay = new Map<string, Partial<Record<Kind, DailyRow>>>()
  for (const r of data.daily) {
    const e = byDay.get(r.day) ?? {}
    e[r.kind] = r
    byDay.set(r.day, e)
  }
  const days_ = [...byDay.entries()]

  return (
    <div className="space-y-8">
      {/* period picker */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Period:</span>
        {PERIODS.map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`rounded border px-2.5 py-1 text-xs font-medium ${
              d === days ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {d === 365 ? '1 year' : `${d} days`}
          </button>
        ))}
        <span className="ml-2 text-xs text-muted-foreground">{data.since} → {data.until}</span>
      </div>

      {/* headline */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card label="Total, this period" value={fmtPence(data.totals.pence)}
          note={data.totals.unpricedCalls > 0
            ? `⚠ plus ${fmtNum(data.totals.unpricedCalls)} calls with no rate on file`
            : `${fmtNum(data.totals.calls)} calls`} />
        <Card label="Average per idea" value={fmtPence(data.averagePencePerIdea)} note={data.averageNote} />
        <Card label="Tokens" value={`${fmtNum(data.totals.tokensIn)} in`} note={`${fmtNum(data.totals.tokensOut)} out`} />
      </div>

      {/* ⚠ an unclassified pass is a hole in the split and must be visible */}
      {data.unclassifiedPasses.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>⚠ {data.unclassifiedPasses.length} pass{data.unclassifiedPasses.length === 1 ? '' : 'es'} fall
          outside the search / everything-else split</strong> and are counted in neither column:{' '}
          <code>{data.unclassifiedPasses.join(', ')}</code>. Add them to the <code>LlmSpendKind</code> view in{' '}
          <code>prisma/llm_spend.sql</code>, or the totals above will keep understating one of the two.
        </div>
      )}

      {/* 1 — daily, split */}
      <section>
        <h3 className="mb-2 text-sm font-semibold">Daily — search vs everything else</h3>
        {days_.length === 0 ? (
          <p className="text-sm text-muted-foreground">No model calls recorded in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Day</th>
                  <th className="py-2 pr-4 text-right font-medium">Search tokens</th>
                  <th className="py-2 pr-4 text-right font-medium">Search cost</th>
                  <th className="py-2 pr-4 text-right font-medium">Other tokens</th>
                  <th className="py-2 pr-4 text-right font-medium">Other cost</th>
                  <th className="py-2 text-right font-medium">Calls</th>
                </tr>
              </thead>
              <tbody>
                {days_.map(([day, e]) => {
                  const s = e['search']; const o = e['everything-else']; const u = e['unclassified']
                  const calls = (s?.calls ?? 0) + (o?.calls ?? 0) + (u?.calls ?? 0)
                  return (
                    <tr key={day} className="border-b last:border-0">
                      <td className="py-2 pr-4 tabular-nums">{day}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{s ? fmtNum(s.tokensIn + s.tokensOut) : '—'}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{s ? fmtPence(s.pence) : '—'}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{o ? fmtNum(o.tokensIn + o.tokensOut) : '—'}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{o ? fmtPence(o.pence) : '—'}</td>
                      <td className="py-2 text-right tabular-nums">{fmtNum(calls)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          A dash in a cost column means at least one call that day used a model with no rate on file. It is not zero.
        </p>
      </section>

      {/* 3 — ideas ranked */}
      <section>
        <h3 className="mb-2 text-sm font-semibold">
          Ideas, most to least expensive{' '}
          <span className="font-normal text-muted-foreground">({data.ideasCounted} spent anything)</span>
        </h3>
        {data.ideas.length === 0 ? (
          <p className="text-sm text-muted-foreground">No idea-attributable spend in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Idea</th>
                  <th className="py-2 pr-4 text-right font-medium">Cost</th>
                  <th className="py-2 pr-4 text-right font-medium">Calls</th>
                  <th className="py-2 text-right font-medium">Tokens</th>
                </tr>
              </thead>
              <tbody>
                {data.ideas.map((i) => (
                  <tr key={i.ideaId} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <a href={`/ideas/${i.ideaId}`} className="hover:underline">
                        {i.title ?? <span className="text-muted-foreground">(untitled or deleted)</span>}
                      </a>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {fmtPence(i.pence)}
                      {i.unpricedCalls > 0 && (
                        <span className="ml-1 text-xs text-amber-700" title={`${i.unpricedCalls} calls with no rate on file`}>
                          ⚠{i.unpricedCalls}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{fmtNum(i.calls)}</td>
                    <td className="py-2 text-right tabular-nums">{fmtNum(i.tokensIn + i.tokensOut)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          ⚠ Ideas whose cost cannot be established sort first, not last — an unknown is more worth looking at than a
          known small number.
        </p>
      </section>

      <p className="rounded border bg-muted/40 p-3 text-xs text-muted-foreground">
        <strong>This page measures; it does not control.</strong> No allowance, cap or throttle is applied to any
        user. Until members are spending their own money, the only thing being measured here is what the platform
        costs to run.
      </p>
    </div>
  )
}

function Card({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded border p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{note}</div>
    </div>
  )
}
